/**
 * HELPAMART — POST /api/book
 *
 * Vercel serverless function (Node.js runtime).
 * Handles the complete booking creation workflow:
 *   1. Authenticate via Supabase JWT
 *   2. Validate mentor / service / slot
 *   3. Compute first-session-free price from persistent history
 *   4. Double-booking check + atomic insert
 *   5. Google Calendar event + Google Meet conference
 *   6. Persist calendar_event_id + meet_link back to booking
 *   7. Send confirmation emails (mentor + mentee)
 *
 * Secrets (never exposed to the browser):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALENDAR_REDIRECT_URI
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'
import nodemailer from 'nodemailer'

// ─── Supabase admin client (service-role — server only) ──────────────────────
function adminSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in Vercel env vars.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Verify Supabase JWT and return user ID ───────────────────────────────────
async function verifyJwt(authHeader: string | undefined): Promise<string> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) throw new Error('Not authenticated. Please sign in.')

  const url = process.env.SUPABASE_URL!
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!res.ok) throw new Error('Session expired. Please sign in again.')
  const user = await res.json() as { id?: string; email?: string }
  if (!user?.id) throw new Error('Could not identify user.')
  return user.id
}

// ─── Google Calendar helper ───────────────────────────────────────────────────
async function getCalendarClient(mentorUserId: string, db: ReturnType<typeof adminSupabase>) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return null // Calendar not configured
  }

  const { data: conn } = await db
    .from('calendar_connections')
    .select('access_token, refresh_token, expiry, status')
    .eq('user_id', mentorUserId)
    .eq('status', 'connected')
    .maybeSingle()

  if (!conn?.refresh_token && !conn?.access_token) return null

  const oauth2 = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI || '',
  )

  oauth2.setCredentials({
    access_token: conn.access_token ?? undefined,
    refresh_token: conn.refresh_token ?? undefined,
    expiry_date: conn.expiry ? Date.parse(conn.expiry) : undefined,
  })

  // Persist refreshed tokens back to DB
  oauth2.on('tokens', async (tokens) => {
    try {
      await db.from('calendar_connections').update({
        access_token: tokens.access_token ?? conn.access_token,
        refresh_token: tokens.refresh_token ?? conn.refresh_token,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : conn.expiry,
        updated_at: new Date().toISOString(),
      }).eq('user_id', mentorUserId)
    } catch {}
  })

  return oauth2
}

// ─── Create Google Calendar event + Meet conference ───────────────────────────
async function createCalendarEvent(opts: {
  auth: any
  mentorName: string
  menteeEmail: string | null
  mentorEmail: string | null
  startAt: string
  endAt: string
  timezone: string
  bookingId: string
  serviceTitle: string
  db: ReturnType<typeof adminSupabase>
  mentorUserId: string
}): Promise<{ ok: boolean; eventId?: string | null; meetLink?: string | null; htmlLink?: string | null; reason?: string }> {
  try {
    const calendar = google.calendar({ version: 'v3', auth: opts.auth })

    const attendees: { email: string }[] = []
    if (opts.menteeEmail) attendees.push({ email: opts.menteeEmail })
    if (opts.mentorEmail) attendees.push({ email: opts.mentorEmail })

    const res = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      sendUpdates: 'all', // sends invitations to attendees
      requestBody: {
        summary: `HELPAMART Mentorship — ${opts.mentorName}`,
        description: [
          `HELPAMART mentoring session: ${opts.serviceTitle}`,
          `Booking ID: ${opts.bookingId}`,
          `Manage at: https://helpamart.com/dashboard/bookings`,
        ].join('\n'),
        start: { dateTime: opts.startAt, timeZone: opts.timezone },
        end: { dateTime: opts.endAt, timeZone: opts.timezone },
        attendees,
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'popup', minutes: 60 },
            { method: 'popup', minutes: 30 },
            { method: 'email', minutes: 60 },
          ],
        },
        conferenceData: {
          createRequest: {
            // Use booking ID as deterministic requestId to prevent duplicate Meet rooms on retry
            requestId: `helpamart-${opts.bookingId}`,
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    })

    const eventData = res.data

    // Meet link — may need a follow-up GET if conference is still pending
    let meetLink: string | null =
      eventData.hangoutLink ||
      eventData.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ||
      null

    // If conference is pending, poll once after 2 s
    if (!meetLink && eventData.id) {
      await new Promise(r => setTimeout(r, 2000))
      try {
        const polled = await calendar.events.get({ calendarId: 'primary', eventId: eventData.id })
        meetLink =
          polled.data.hangoutLink ||
          polled.data.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri ||
          null
      } catch {}
    }

    // Persist refreshed tokens if needed
    try {
      const tokens = await opts.auth.getAccessToken()
      if (tokens?.token) {
        await opts.db.from('calendar_connections').update({
          access_token: tokens.token,
          updated_at: new Date().toISOString(),
        }).eq('user_id', opts.mentorUserId)
      }
    } catch {}

    return { ok: true, eventId: eventData.id, meetLink, htmlLink: eventData.htmlLink }
  } catch (err: any) {
    // Mark calendar connection as errored so UI can prompt reconnect
    await opts.db.from('calendar_connections').update({ status: 'error' }).eq('user_id', opts.mentorUserId)
    return { ok: false, reason: err?.message || 'calendar_error' }
  }
}

// ─── Email helpers ────────────────────────────────────────────────────────────
function getTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass },
  })
}

function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions) {
  try { return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts }).format(new Date(iso)) }
  catch { return iso.slice(0, 16) }
}

async function sendBookingEmails(opts: {
  bookingId: string
  mentorName: string
  mentorEmail: string | null
  menteeName: string
  menteeEmail: string | null
  serviceTitle: string
  startAt: string
  endAt: string
  timezone: string
  priceCents: number
  currency: string
  meetLink: string | null
}) {
  const transport = getTransporter()
  const from = process.env.SMTP_FROM || 'HELPAMART <guidance@helpamart.com>'
  const dateStr = fmt(opts.startAt, opts.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = fmt(opts.startAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
  const endTime = fmt(opts.endAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
  const priceDisplay = opts.priceCents === 0 ? 'Free (first session)' : `₹${Math.round(opts.priceCents / 100)}`

  const meetBlock = opts.meetLink
    ? `<div style="margin:20px 0;padding:16px;background:#f4efe6;border-radius:10px;border-left:4px solid #B77A22;">
        <p style="margin:0 0 8px;font-weight:600;color:#071A35;">Google Meet</p>
        <a href="${opts.meetLink}" style="display:inline-block;padding:10px 20px;background:#071A35;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Join Google Meet</a>
        <p style="margin:8px 0 0;font-size:12px;color:#666;word-break:break-all;">${opts.meetLink}</p>
       </div>`
    : `<p style="color:#888;font-style:italic;margin:16px 0;">A video meeting link will be shared prior to the session.</p>`

  const table = (rows: [string, string][]) => `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows.map(([l, v]) => `<tr>
        <td style="padding:5px 0;color:#666;width:130px;">${l}</td>
        <td style="padding:5px 0;font-weight:600;">${v}</td>
      </tr>`).join('')}
    </table>`

  function wrap(title: string, greeting: string, body: string) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#071A35;background:#FDFBF7;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;border:1px solid #e8e3d9;">
      <div style="border-bottom:2px solid #B77A22;padding-bottom:14px;margin-bottom:22px;">
        <h2 style="margin:0;color:#071A35;font-size:22px;">HELPAMART</h2>
        <p style="margin:3px 0 0;color:#B77A22;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">${title}</p>
      </div>
      <p>${greeting}</p>
      ${body}
      <p style="font-size:13px;color:#888;margin-top:28px;border-top:1px solid #e8e3d9;padding-top:14px;">
        HELPAMART — I am here for you · <a href="https://helpamart.com" style="color:#B77A22;">helpamart.com</a>
      </p>
    </div></body></html>`
  }

  const detailRows: [string, string][] = [
    ['Session', opts.serviceTitle],
    ['Date', dateStr],
    ['Time', `${startTime} – ${endTime} (${opts.timezone})`],
    ['Amount', priceDisplay],
    ['Booking ID', opts.bookingId],
  ]

  // Mentor email
  if (opts.mentorEmail && transport) {
    const html = wrap(
      'New Session Booked',
      `Hello <strong>${opts.mentorName}</strong>, a new mentoring session has been booked with you.`,
      `<div style="background:#FDFBF7;border:1px solid #e8e3d9;border-radius:10px;padding:18px;margin:16px 0;">
        ${table([...detailRows, ['Student', `${opts.menteeName} (${opts.menteeEmail || '—'})`]])}
       </div>${meetBlock}
       <p style="font-size:14px;">View your sessions: <a href="https://helpamart.com/mentor-dashboard" style="color:#B77A22;font-weight:600;">Mentor Dashboard →</a></p>`,
    )
    try {
      await transport.sendMail({
        from, to: opts.mentorEmail,
        subject: `New HELPAMART session scheduled — ${opts.serviceTitle}`,
        html,
      })
    } catch (e) {
      console.error('[EMAIL] Mentor notification failed:', e)
    }
  }

  // Mentee email
  if (opts.menteeEmail && transport) {
    const html = wrap(
      'Session Confirmed',
      `Hello <strong>${opts.menteeName}</strong>, your mentoring session with <strong>${opts.mentorName}</strong> is confirmed.`,
      `<div style="background:#FDFBF7;border:1px solid #e8e3d9;border-radius:10px;padding:18px;margin:16px 0;">
        ${table([...detailRows, ['Mentor', opts.mentorName]])}
       </div>${meetBlock}
       <p style="font-size:14px;">View your bookings: <a href="https://helpamart.com/dashboard/bookings" style="color:#B77A22;font-weight:600;">My Bookings →</a></p>`,
    )
    try {
      await transport.sendMail({
        from, to: opts.menteeEmail,
        subject: `HELPAMART session confirmed — ${opts.serviceTitle} with ${opts.mentorName}`,
        html,
      })
    } catch (e) {
      console.error('[EMAIL] Mentee confirmation failed:', e)
    }
  }

  if (!transport) {
    console.log('[EMAIL] SMTP not configured — skipping emails for booking', opts.bookingId)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  try {
    const userId = await verifyJwt(req.headers.authorization)
    const db = adminSupabase()

    const { mentorSlug, serviceId, startAt, timezone } = req.body as {
      mentorSlug?: string
      serviceId?: string
      startAt?: string
      timezone?: string
    }

    if (!mentorSlug || !startAt || !timezone) {
      return res.status(400).json({ error: 'mentorSlug, startAt, and timezone are required.' })
    }

    // 1. Fetch mentor (server-authoritative — never trust frontend mentor ID)
    const { data: mentorRow, error: mentorErr } = await db
      .from('mentors')
      .select('id, user_id, name, slug, status, services, buffer_minutes, timezone')
      .eq('slug', mentorSlug)
      .eq('status', 'published')
      .maybeSingle()

    if (mentorErr || !mentorRow) {
      return res.status(404).json({ error: 'This mentor is not currently available.' })
    }

    // 2. Resolve service
    const services: any[] = Array.isArray(mentorRow.services) ? mentorRow.services : []
    const service = serviceId
      ? services.find((s: any) => s.id === serviceId || s.title === serviceId) ?? services[0]
      : services[0]

    if (!service) {
      return res.status(400).json({ error: 'That session type is not available.' })
    }

    const durationMin = service.durationMinutes || 30
    const start = new Date(startAt)
    const end = new Date(start.getTime() + durationMin * 60 * 1000)

    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid start time.' })
    }

    // 3. Server-side first-session price determination
    const { count: prevCount } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('mentee_id', userId)
      .eq('mentor_id', mentorRow.id)
      .in('status', ['confirmed', 'completed'])

    const isFirstSession = (prevCount ?? 0) === 0
    const finalPriceCents = isFirstSession ? 0 : (service.priceCents ?? 9900)
    const currency = service.currency || 'INR'

    // 4. Double-booking check
    const { data: clash } = await db
      .from('bookings')
      .select('id')
      .eq('mentor_id', mentorRow.id)
      .in('status', ['confirmed', 'pending'])
      .lt('start_at', end.toISOString())
      .gt('end_at', start.toISOString())
      .limit(1)

    if (clash && clash.length > 0) {
      return res.status(409).json({ error: 'This time slot is no longer available. Please choose another time.' })
    }

    // 5. Fetch mentor and mentee emails
    const [{ data: mentorUser }, { data: menteeUser }] = await Promise.all([
      db.from('profiles').select('email, full_name').eq('id', mentorRow.user_id).maybeSingle(),
      db.from('profiles').select('email, full_name').eq('id', userId).maybeSingle(),
    ])

    const mentorEmail = mentorUser?.email ?? null
    const menteeEmail = menteeUser?.email ?? null
    const menteeName = menteeUser?.full_name || 'Student'

    // 6. Insert booking
    const bookingId = crypto.randomUUID()
    const now = new Date().toISOString()

    const { error: insertErr } = await db.from('bookings').insert({
      id: bookingId,
      mentor_id: mentorRow.id,
      mentee_id: userId,
      service_id: service.id || service.title || 'default',
      service_title: service.title,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      timezone,
      status: 'confirmed',
      payment_status: finalPriceCents === 0 ? 'not_required' : 'pending',
      price_cents: finalPriceCents,
      currency,
      meet_link: null,
      calendar_event_id: null,
      calendar_status: 'pending',
      mentor_email: mentorEmail,
      student_email: menteeEmail,
      created_at: now,
      updated_at: now,
    })

    if (insertErr) {
      // Duplicate submission (same bookingId) — idempotent
      if (insertErr.code === '23505') {
        const { data: existing } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle()
        return res.status(200).json({
          booking: {
            id: bookingId,
            meetLink: existing?.meet_link ?? null,
            status: existing?.status ?? 'confirmed',
            priceCents: existing?.price_cents ?? finalPriceCents,
            currency,
            isFirstSession,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            mentorName: mentorRow.name,
          },
        })
      }
      return res.status(500).json({ error: `Could not create booking: ${insertErr.message}` })
    }

    // 7. Google Calendar + Meet (non-blocking on calendar failure — booking is preserved)
    let meetLink: string | null = null
    let calendarEventId: string | null = null
    let calendarStatus = 'not_configured'

    const calAuth = await getCalendarClient(mentorRow.user_id, db)

    if (calAuth) {
      const calResult = await createCalendarEvent({
        auth: calAuth,
        mentorName: mentorRow.name,
        menteeEmail,
        mentorEmail,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        timezone,
        bookingId,
        serviceTitle: service.title,
        db,
        mentorUserId: mentorRow.user_id,
      })

      if (calResult.ok) {
        meetLink = calResult.meetLink ?? null
        calendarEventId = calResult.eventId ?? null
        calendarStatus = meetLink ? 'created' : 'created_no_meet'
      } else {
        calendarStatus = calResult.reason || 'calendar_error'
        console.warn(`[BOOK] Calendar creation failed for booking ${bookingId}: ${calResult.reason}`)
      }

      // Persist Calendar/Meet data back to booking
      await db.from('bookings').update({
        meet_link: meetLink,
        calendar_event_id: calendarEventId,
        calendar_status: calendarStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', bookingId)
    } else {
      calendarStatus = process.env.GOOGLE_CLIENT_ID ? 'mentor_calendar_not_connected' : 'not_configured'
      await db.from('bookings').update({
        calendar_status: calendarStatus,
        updated_at: new Date().toISOString(),
      }).eq('id', bookingId)
    }

    // 8. Send confirmation emails (fire-and-forget — booking is already persisted)
    sendBookingEmails({
      bookingId,
      mentorName: mentorRow.name,
      mentorEmail,
      menteeName,
      menteeEmail,
      serviceTitle: service.title,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      timezone,
      priceCents: finalPriceCents,
      currency,
      meetLink,
    }).catch(e => console.error('[BOOK] Email dispatch error:', e))

    return res.status(200).json({
      booking: {
        id: bookingId,
        meetLink,
        calendarEventId,
        calendarStatus,
        status: 'confirmed',
        priceCents: finalPriceCents,
        currency,
        isFirstSession,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        mentorName: mentorRow.name,
      },
    })
  } catch (err: any) {
    console.error('[BOOK] Unhandled error:', err)
    const status = err?.message?.includes('authenticated') ? 401 : 500
    return res.status(status).json({ error: err?.message || 'An unexpected error occurred.' })
  }
}
