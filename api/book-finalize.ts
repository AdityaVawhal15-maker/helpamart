/**
 * HELPAMART — POST /api/book-finalize
 *
 * Vercel serverless function (Node.js runtime).
 * Finalizes a provisional booking after payment is verified.
 *
 * Called AFTER successful Cashfree payment.
 * Generates Google Meet link and sends confirmation emails.
 *
 * Input:
 *   - bookingId: Provisional booking ID (from Cashfree flow)
 *   - Authorization: Bearer token (Supabase JWT)
 *
 * Output:
 *   - meetUrl: Real Google Meet URL
 *   - status: 'confirmed'
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// ─── Supabase admin client ────────────────────────────────────────────────────
function adminSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Verify JWT ───────────────────────────────────────────────────────────────
async function verifyJwt(authHeader: string | undefined): Promise<string> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) {
    console.error('[BOOK-FINALIZE] Missing authorization header')
    throw new Error('Not authenticated.')
  }

  try {
    // Decode JWT to extract user ID without needing to call Supabase auth endpoint
    // JWT format: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format.')
    }

    // Decode payload (add padding if needed)
    const payload = parts[1]
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4)
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString()) as { sub?: string; user_id?: string }

    const userId = decoded.sub || decoded.user_id
    if (!userId) {
      console.error('[BOOK-FINALIZE] No user ID in JWT')
      throw new Error('Could not identify user from token.')
    }

    console.log('[BOOK-FINALIZE] JWT decoded for user:', userId)
    return userId
  } catch (err: any) {
    console.error('[BOOK-FINALIZE] JWT decoding error:', err.message)
    throw new Error('Authentication failed.')
  }
}

// ─── Resolve central Google Meet credentials ──────────────────────────────────
// Hierarchy:
//   1. google_service_connections table (written by /api/admin-meet-callback)
//   2. GOOGLE_MEET_REFRESH_TOKEN or HELPAMART_GOOGLE_REFRESH_TOKEN env vars
async function getCentralMeetCredentials(db: ReturnType<typeof adminSupabase>): Promise<{
  clientId: string
  clientSecret: string
  refreshToken: string
} | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[FINALIZE] CRITICAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in Vercel env vars')
    return null
  }

  let refreshToken: string | null = null

  // 1. Try DB (authoritative)
  try {
    const { data: conn, error: dbErr } = await db
      .from('google_service_connections')
      .select('refresh_token, status, account_email')
      .in('key', ['helpamart_meet', 'helpamart_organizer'])
      .eq('status', 'connected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dbErr) {
      console.warn(`[FINALIZE] google_service_connections query error: ${dbErr.message}`)
    }

    if (conn?.status === 'connected' && conn.refresh_token) {
      refreshToken = conn.refresh_token
      console.log(`[FINALIZE] Central Google Meet token resolved from DB (account: ${conn.account_email || 'unknown'})`)
    }
  } catch (e: any) {
    console.error(`[FINALIZE] google_service_connections lookup failed: ${e?.message}`)
  }

  // 2. Env var fallback
  if (!refreshToken) {
    const envToken = process.env.GOOGLE_MEET_REFRESH_TOKEN || process.env.HELPAMART_GOOGLE_REFRESH_TOKEN
    if (envToken) {
      refreshToken = envToken
      console.log(`[FINALIZE] Central Google Meet token resolved from env_var`)
    }
  }

  if (!refreshToken) {
    console.error(`[FINALIZE] CRITICAL: No Google Meet refresh token found (DB or env). Visit /admin/meet to authorize.`)
    return null
  }

  return { clientId, clientSecret, refreshToken }
}

// ─── Generate Google access token from refresh token ──────────────────────────
async function getGoogleAccessToken(creds: {
  clientId: string
  clientSecret: string
  refreshToken: string
}): Promise<string> {
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!tokenRes.ok) {
    const errText = await tokenRes.text()
    console.error('[FINALIZE] Google OAuth token refresh FAILED:', tokenRes.status, errText)
    let detail = errText
    try { detail = JSON.stringify(JSON.parse(errText)) } catch { /* raw text is fine */ }
    throw new Error(`Google token refresh failed (HTTP ${tokenRes.status}): ${detail}`)
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string; error_description?: string }
  if (tokenData.error) {
    console.error('[FINALIZE] Google OAuth token error field:', tokenData.error, tokenData.error_description)
    throw new Error(`Google token error: ${tokenData.error} — ${tokenData.error_description || 'no description'}`)
  }
  if (!tokenData.access_token) {
    throw new Error('Google token refresh returned no access_token.')
  }

  return tokenData.access_token
}

// ─── Create real Google Meet space via Google Meet REST API v2 ────────────────
// Direct call to POST https://meet.googleapis.com/v2/spaces
// Returns the real meetingUri generated by Google
async function createGoogleMeetSpace(accessToken: string): Promise<{
  meetingUri: string
  spaceName: string
  meetingCode: string
}> {
  console.log('[FINALIZE] Calling Google Meet REST API: POST https://meet.googleapis.com/v2/spaces')

  const meetRes = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!meetRes.ok) {
    const errText = await meetRes.text()
    let parsedErr: any = null
    try { parsedErr = JSON.parse(errText) } catch { /* raw text */ }
    const googleErrMsg = parsedErr?.error?.message || parsedErr?.message || errText
    const googleErrStatus = parsedErr?.error?.status || parsedErr?.status || 'UNKNOWN'
    console.error(
      `[FINALIZE] Google Meet API spaces.create FAILED:`,
      `HTTP ${meetRes.status}`,
      `status=${googleErrStatus}`,
      `message=${googleErrMsg}`,
      `full_body=${errText}`,
    )
    throw new Error(`Google Meet API error (HTTP ${meetRes.status} ${googleErrStatus}): ${googleErrMsg}`)
  }

  const meetData = (await meetRes.json()) as {
    name?: string
    meetingUri?: string
    meetingCode?: string
  }

  const meetingUri = meetData.meetingUri
  if (!meetingUri || typeof meetingUri !== 'string' || !meetingUri.startsWith('https://meet.google.com/')) {
    console.error('[FINALIZE] Google Meet API returned unexpected body:', JSON.stringify(meetData))
    throw new Error(`Google Meet API did not return a valid meetingUri. Body: ${JSON.stringify(meetData)}`)
  }

  console.log(`[FINALIZE] Google Meet space created successfully: ${meetingUri} (space: ${meetData.name || 'none'})`)
  return {
    meetingUri,
    spaceName: meetData.name || '',
    meetingCode: meetData.meetingCode || '',
  }
}

// ─── Email helpers (Hostinger SMTP) ───────────────────────────────────────────
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
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

// ─── Helper to send MENTOR booking email (awaitable, returns result) ─────────
async function sendMentorBookingEmail(opts: {
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
  meetUrl: string
}): Promise<{ success: boolean; error?: string }> {
  if (!opts.mentorEmail) {
    console.log('[FINALIZE] mentor_email=SKIPPED (no email)')
    return { success: false, error: 'no_email' }
  }

  const transport = getTransporter()
  if (!transport) {
    console.error('[FINALIZE] mentor_email=FAILED (SMTP not configured)')
    return { success: false, error: 'smtp_not_configured' }
  }

  const from = process.env.SMTP_FROM || 'HELPAMART <hello@helpamart.com>'

  // Validate Meet URL
  if (!opts.meetUrl || !opts.meetUrl.startsWith('https://meet.google.com/')) {
    console.error('[FINALIZE] mentor_email=FAILED (invalid meet URL):', opts.meetUrl)
    return { success: false, error: 'invalid_meet_url' }
  }

  const dateStr = fmt(opts.startAt, opts.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = fmt(opts.startAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
  const priceDisplay = opts.priceCents === 0
    ? 'Free (first HELPAMART session)'
    : `₹${Math.round(opts.priceCents / 100)}`

  const meetBlock = `
    <div style="margin:24px 0;padding:20px;background:#f4efe6;border-radius:12px;border-left:4px solid #B77A22;">
      <p style="margin:0 0 8px;font-weight:700;color:#071A35;font-size:16px;">Google Meet Video Call</p>
      <p style="margin:0 0 14px;color:#555;font-size:14px;">Your session will take place via Google Meet. Click below to join at your scheduled time:</p>
      <a href="${opts.meetUrl}" style="display:inline-block;padding:12px 24px;background:#071A35;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Join Google Meet</a>
      <p style="margin:12px 0 0;font-size:13px;color:#666;word-break:break-all;">Direct Link: <a href="${opts.meetUrl}" style="color:#B77A22;">${opts.meetUrl}</a></p>
    </div>`

  const table = (rows: [string, string][]) => `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows.map(([l, v]) => `<tr>
        <td style="padding:6px 0;color:#666;width:130px;">${l}</td>
        <td style="padding:6px 0;font-weight:600;color:#071A35;">${v}</td>
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
      <p style="font-size:15px;margin-bottom:16px;">${greeting}</p>
      ${body}
      <p style="font-size:13px;color:#888;margin-top:28px;border-top:1px solid #e8e3d9;padding-top:14px;">
        HELPAMART — I am here for you · <a href="https://helpamart.com" style="color:#B77A22;text-decoration:none;">helpamart.com</a>
      </p>
    </div></body></html>`
  }

  const detailRows: [string, string][] = [
    ['Session', opts.serviceTitle],
    ['Date', dateStr],
    ['Time', `${startTime} (${opts.timezone})`],
    ['Amount', priceDisplay],
    ['Booking ID', opts.bookingId],
  ]

  const html = wrap(
    'New Session Booked',
    `Hello <strong>${opts.mentorName}</strong>, a new mentoring session has been booked with you.`,
    `<div style="background:#FDFBF7;border:1px solid #e8e3d9;border-radius:10px;padding:18px;margin:16px 0;">
      ${table([...detailRows, ['Student', `${opts.menteeName} (${opts.menteeEmail || 'N/A'})`]])}
     </div>
     ${meetBlock}
     <p style="font-size:14px;">View your sessions in your <a href="https://helpamart.com/mentor-dashboard/bookings" style="color:#B77A22;font-weight:600;">Mentor Dashboard →</a></p>`,
  )

  try {
    const info = await transport.sendMail({
      from,
      to: opts.mentorEmail,
      subject: `New HELPAMART session scheduled — ${opts.serviceTitle}`,
      html,
    })
    console.log('[FINALIZE] mentor_email=SENT | to:', opts.mentorEmail.slice(0, 3) + '***', '| messageId:', info.messageId)
    return { success: true }
  } catch (e: any) {
    console.error('[FINALIZE] mentor_email=FAILED | to:', opts.mentorEmail, '| error:', e?.message || e)
    return { success: false, error: e?.message }
  }
}

// ─── Helper to send MENTEE booking email (awaitable, returns result) ─────────
async function sendMenteeBookingEmail(opts: {
  bookingId: string
  mentorName: string
  menteeName: string
  menteeEmail: string | null
  serviceTitle: string
  startAt: string
  endAt: string
  timezone: string
  priceCents: number
  meetUrl: string
}): Promise<{ success: boolean; error?: string }> {
  if (!opts.menteeEmail) {
    console.log('[FINALIZE] mentee_email=SKIPPED (no email)')
    return { success: false, error: 'no_email' }
  }

  const transport = getTransporter()
  if (!transport) {
    console.error('[FINALIZE] mentee_email=FAILED (SMTP not configured)')
    return { success: false, error: 'smtp_not_configured' }
  }

  const from = process.env.SMTP_FROM || 'HELPAMART <hello@helpamart.com>'

  // Validate Meet URL
  if (!opts.meetUrl || !opts.meetUrl.startsWith('https://meet.google.com/')) {
    console.error('[FINALIZE] mentee_email=FAILED (invalid meet URL):', opts.meetUrl)
    return { success: false, error: 'invalid_meet_url' }
  }

  const dateStr = fmt(opts.startAt, opts.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = fmt(opts.startAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
  const priceDisplay = opts.priceCents === 0
    ? 'Free (first HELPAMART session)'
    : `₹${Math.round(opts.priceCents / 100)}`

  const meetBlock = `
    <div style="margin:24px 0;padding:20px;background:#f4efe6;border-radius:12px;border-left:4px solid #B77A22;">
      <p style="margin:0 0 8px;font-weight:700;color:#071A35;font-size:16px;">Google Meet Video Call</p>
      <p style="margin:0 0 14px;color:#555;font-size:14px;">Your session will take place via Google Meet. Click below to join at your scheduled time:</p>
      <a href="${opts.meetUrl}" style="display:inline-block;padding:12px 24px;background:#071A35;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">Join Google Meet</a>
      <p style="margin:12px 0 0;font-size:13px;color:#666;word-break:break-all;">Direct Link: <a href="${opts.meetUrl}" style="color:#B77A22;">${opts.meetUrl}</a></p>
    </div>`

  const table = (rows: [string, string][]) => `
    <table style="width:100%;border-collapse:collapse;font-size:14px;">
      ${rows.map(([l, v]) => `<tr>
        <td style="padding:6px 0;color:#666;width:130px;">${l}</td>
        <td style="padding:6px 0;font-weight:600;color:#071A35;">${v}</td>
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
      <p style="font-size:15px;margin-bottom:16px;">${greeting}</p>
      ${body}
      <p style="font-size:13px;color:#888;margin-top:28px;border-top:1px solid #e8e3d9;padding-top:14px;">
        HELPAMART — I am here for you · <a href="https://helpamart.com" style="color:#B77A22;text-decoration:none;">helpamart.com</a>
      </p>
    </div></body></html>`
  }

  const detailRows: [string, string][] = [
    ['Session', opts.serviceTitle],
    ['Date', dateStr],
    ['Time', `${startTime} (${opts.timezone})`],
    ['Amount', priceDisplay],
    ['Booking ID', opts.bookingId],
  ]

  const html = wrap(
    'Session Confirmed',
    `Hello <strong>${opts.menteeName}</strong>, your mentoring session with <strong>${opts.mentorName}</strong> is confirmed.`,
    `<div style="background:#FDFBF7;border:1px solid #e8e3d9;border-radius:10px;padding:18px;margin:16px 0;">
      ${table([...detailRows, ['Mentor', opts.mentorName]])}
     </div>
     ${meetBlock}
     <p style="font-size:14px;">View your sessions in <a href="https://helpamart.com/dashboard/bookings" style="color:#B77A22;font-weight:600;">My Bookings →</a></p>`,
  )

  try {
    const info = await transport.sendMail({
      from,
      to: opts.menteeEmail,
      subject: `HELPAMART session confirmed — ${opts.serviceTitle} with ${opts.mentorName}`,
      html,
    })
    console.log('[FINALIZE] mentee_email=SENT | to:', opts.menteeEmail.slice(0, 3) + '***', '| messageId:', info.messageId)
    return { success: true }
  } catch (e: any) {
    console.error('[FINALIZE] mentee_email=FAILED | to:', opts.menteeEmail, '| error:', e?.message || e)
    return { success: false, error: e?.message }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  console.log('[FINALIZE] Request received')

  try {
    const userId = await verifyJwt(req.headers.authorization)
    const db = adminSupabase()

    const { bookingId } = req.body as { bookingId?: string }

    if (!bookingId) {
      return res.status(400).json({ error: 'bookingId is required.' })
    }

    console.log('[FINALIZE] Finalizing booking:', bookingId)

    // Verify booking exists, belongs to user, and is confirmed after payment
    const { data: booking, error: bookingErr } = await db
      .from('bookings')
      .select(
        'id, mentee_id, mentor_id, service_title, start_at, end_at, timezone, mentor_email, student_email, payment_status, status, meet_link, price_cents',
      )
      .eq('id', bookingId)
      .maybeSingle()

    if (bookingErr || !booking) {
      console.error('[FINALIZE] Booking not found:', bookingErr?.message)
      return res.status(404).json({ error: 'Booking not found.' })
    }

    if (booking.mentee_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized.' })
    }

    // Ensure booking is confirmed (payment should be verified)
    if (booking.status !== 'confirmed' || booking.payment_status !== 'completed') {
      return res.status(400).json({ error: 'Booking payment not verified.' })
    }

    // Get mentee profile for email
    const { data: menteeProfile } = await db.from('profiles').select('full_name, email').eq('id', userId).maybeSingle()

    const menteeName = menteeProfile?.full_name || 'HELPAMART User'
    const menteeEmail = booking.student_email || menteeProfile?.email

    // Get mentor profile
    const { data: mentor } = await db
      .from('mentors')
      .select('name, user_id')
      .eq('id', booking.mentor_id)
      .maybeSingle()

    const mentorName = mentor?.name || 'Mentor'
    
    // Get mentor email from profiles using user_id
    let mentorEmail = booking.mentor_email
    if (!mentorEmail && mentor?.user_id) {
      const { data: mentorProfile } = await db
        .from('profiles')
        .select('email')
        .eq('id', mentor.user_id)
        .maybeSingle()
      mentorEmail = mentorProfile?.email
    }

    // Create (or reuse existing) Google Meet space — idempotent
    let meetUrl: string
    if (booking.meet_link) {
      // Reuse existing Meet link — do not create a duplicate space
      meetUrl = booking.meet_link
      console.log('[FINALIZE] Reusing existing Meet link:', meetUrl.slice(0, 30) + '...')
    } else {
      console.log('[FINALIZE] Resolving central Google Meet credentials...')
      const creds = await getCentralMeetCredentials(db)
      if (!creds) {
        throw new Error('Google Meet credentials not configured in DB or environment. Please visit /admin/meet to connect.')
      }
      const accessToken = await getGoogleAccessToken(creds)
      const meetSpace = await createGoogleMeetSpace(accessToken)
      meetUrl = meetSpace.meetingUri
      console.log('[FINALIZE] Google Meet created:', meetUrl.slice(0, 30) + '...')

      // Save Meet link to booking
      const { error: primaryUpdateErr } = await db
        .from('bookings')
        .update({
          meet_link: meetUrl,
          meet_space_name: meetSpace.spaceName || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      // Fallback if meet_space_name column not found in DB schema
      if (primaryUpdateErr?.code === 'PGRST204' && primaryUpdateErr?.message?.includes('meet_space_name')) {
        await db
          .from('bookings')
          .update({ meet_link: meetUrl, updated_at: new Date().toISOString() })
          .eq('id', bookingId)
      }
    }

    // Send confirmation emails and notifications only on FIRST finalization
    // (i.e. when the Meet link was not previously set — avoids duplicate sends on retry)
    if (!booking.meet_link) {
      console.log('[FINALIZE] Sending confirmation emails...')
      const priceCents = booking.price_cents ?? 9900

      await Promise.allSettled([
        sendMentorBookingEmail({
          bookingId,
          mentorName,
          mentorEmail: mentorEmail || booking.mentor_email,
          menteeName,
          menteeEmail,
          serviceTitle: booking.service_title || 'Mentorship Session',
          startAt: booking.start_at,
          endAt: booking.end_at,
          timezone: booking.timezone,
          priceCents,
          meetUrl,
        }),
        sendMenteeBookingEmail({
          bookingId,
          mentorName,
          menteeName,
          menteeEmail,
          serviceTitle: booking.service_title || 'Mentorship Session',
          startAt: booking.start_at,
          endAt: booking.end_at,
          timezone: booking.timezone,
          priceCents,
          meetUrl,
        }),
      ])

      console.log('[FINALIZE] Booking finalized:', bookingId)

      // Create in-app notifications with real Meet URL
      try {
        const now = new Date().toISOString()
        const dateStr = fmt(booking.start_at, booking.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        const startTime = fmt(booking.start_at, booking.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
        const amountDisplay = priceCents === 0
          ? 'Complimentary (first HELPAMART session)'
          : `₹${Math.round(priceCents / 100)}`

        const menteeNotificationMessage = `Your session with ${mentorName} is confirmed for ${dateStr} at ${startTime}. Service: ${booking.service_title || 'Mentorship Session'}. Amount: ${amountDisplay}. Click to join the Google Meet.`
        const mentorNotificationMessage = `New session booked with ${menteeName}. ${dateStr} at ${startTime}. Service: ${booking.service_title || 'Mentorship Session'}. Amount: ${amountDisplay}. Click to join the Google Meet.`

        const notifications = [
          {
            user_id: userId,
            title: 'Session Confirmed',
            message: menteeNotificationMessage,
            link: meetUrl,
            read: false,
            created_at: now,
            updated_at: now,
          },
        ]
        if (mentor?.user_id) {
          notifications.push({
            user_id: mentor.user_id,
            title: 'New Session Booked',
            message: mentorNotificationMessage,
            link: meetUrl,
            read: false,
            created_at: now,
            updated_at: now,
          })
        }
        await db.from('notifications').insert(notifications)
        console.log('[FINALIZE] Notifications created with Meet URL')
      } catch (notifErr: any) {
        console.warn('[FINALIZE] Notification creation error:', notifErr?.message)
      }
    } else {
      console.log('[FINALIZE] Retry detected — Meet link already existed; skipping email/notification resend')
    }

    return res.status(200).json({
      booking: {
        id: bookingId,
        meetUrl,
        status: 'confirmed',
      },
    })
  } catch (err: any) {
    console.error('[FINALIZE] Error:', err.message)
    return res.status(500).json({ error: err?.message || 'Booking finalization failed.' })
  }
}
