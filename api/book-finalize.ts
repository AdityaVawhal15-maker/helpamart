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
import crypto from 'crypto'
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
  if (!token) throw new Error('Not authenticated.')

  const url = process.env.SUPABASE_URL!
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!res.ok) throw new Error('Session expired.')
  const user = await res.json() as { id?: string }
  if (!user?.id) throw new Error('Could not identify user.')
  return user.id
}

// ─── Create Google Meet (existing implementation) ──────────────────────────────
async function getCentralMeetCredentials(db: ReturnType<typeof adminSupabase>) {
  const { data: creds } = await db
    .from('stored_secrets')
    .select('*')
    .eq('name', 'google_calendar')
    .maybeSingle()

  if (!creds?.value) throw new Error('Google Meet credentials not configured.')

  let parsedCreds: any
  try {
    parsedCreds = JSON.parse(creds.value)
  } catch {
    throw new Error('Invalid Google credentials.')
  }

  if (!parsedCreds?.service_account_email) {
    throw new Error('Incomplete Google credentials.')
  }

  return parsedCreds
}

async function getGoogleAccessToken(creds: {
  private_key: string
  client_email: string
  token_uri: string
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const claims = {
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/meetings.space.create',
    aud: creds.token_uri,
    exp: now + 3600,
    iat: now,
  }

  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64')
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64')
  const signature = crypto
    .createSign('SHA256')
    .update(`${header}.${payload}`)
    .sign(creds.private_key, 'base64')

  const jwt = `${header}.${payload}.${signature}`

  const tokenRes = await fetch(creds.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = (await tokenRes.json()) as { access_token?: string }
  if (!tokenData.access_token) throw new Error('Could not get Google token.')

  return tokenData.access_token
}

async function createGoogleMeetSpace(accessToken: string): Promise<{ meetUrl: string; spaceName: string }> {
  const meetRes = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!meetRes.ok) {
    const error = await meetRes.text()
    console.error('[MEET] Failed:', error)
    throw new Error('Google Meet creation failed.')
  }

  const meetData = (await meetRes.json()) as { name?: string; meetingUri?: string }
  if (!meetData.meetingUri) throw new Error('No meetingUri returned.')

  return { meetUrl: meetData.meetingUri, spaceName: meetData.name || '' }
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
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts }).format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

async function sendEmails(opts: {
  bookingId: string
  mentorName: string
  mentorEmail: string | null
  menteeName: string
  menteeEmail: string | null
  serviceTitle: string
  startAt: string
  endAt: string
  timezone: string
  meetUrl: string
}) {
  const transport = getTransporter()
  const from = process.env.SMTP_FROM || 'HELPAMART <guidance@helpamart.com>'
  const dateStr = fmt(opts.startAt, opts.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = fmt(opts.startAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
  const endTime = fmt(opts.endAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })

  if (!transport) {
    console.warn('[EMAIL] SMTP not configured, skipping email send')
    return
  }

  try {
    if (opts.menteeEmail) {
      await transport.sendMail({
        from,
        to: opts.menteeEmail,
        subject: `Your session with ${opts.mentorName} is confirmed`,
        html: `
          <h2>Session Confirmed</h2>
          <p>Your mentorship session is confirmed:</p>
          <ul>
            <li><strong>Mentor:</strong> ${opts.mentorName}</li>
            <li><strong>Service:</strong> ${opts.serviceTitle}</li>
            <li><strong>Date & Time:</strong> ${dateStr}, ${startTime} – ${endTime}</li>
            <li><strong>Google Meet:</strong> <a href="${opts.meetUrl}">Join here</a></li>
          </ul>
          <p>See you soon!</p>
        `,
      })
      console.log('[EMAIL] Mentee email sent:', opts.menteeEmail)
    }

    if (opts.mentorEmail) {
      await transport.sendMail({
        from,
        to: opts.mentorEmail,
        subject: `New session with ${opts.menteeName}`,
        html: `
          <h2>New Session Scheduled</h2>
          <p>You have a new mentorship session:</p>
          <ul>
            <li><strong>Mentee:</strong> ${opts.menteeName}</li>
            <li><strong>Service:</strong> ${opts.serviceTitle}</li>
            <li><strong>Date & Time:</strong> ${dateStr}, ${startTime} – ${endTime}</li>
            <li><strong>Google Meet:</strong> <a href="${opts.meetUrl}">Join here</a></li>
          </ul>
          <p>See you there!</p>
        `,
      })
      console.log('[EMAIL] Mentor email sent:', opts.mentorEmail)
    }
  } catch (err: any) {
    console.error('[EMAIL] Failed:', err.message)
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
        'id, mentee_id, mentor_id, service_title, start_at, end_at, timezone, mentor_email, student_email, payment_status, status',
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
      .select('name, email')
      .eq('id', booking.mentor_id)
      .maybeSingle()

    const mentorName = mentor?.name || 'Mentor'

    // Create Google Meet space
    console.log('[FINALIZE] Creating Google Meet space...')
    const creds = await getCentralMeetCredentials(db)
    const accessToken = await getGoogleAccessToken(creds)
    const { meetUrl } = await createGoogleMeetSpace(accessToken)

    console.log('[FINALIZE] Google Meet created:', meetUrl.slice(0, 30) + '...')

    // Save Meet link to booking
    await db
      .from('bookings')
      .update({ meet_link: meetUrl, updated_at: new Date().toISOString() })
      .eq('id', bookingId)

    // Send confirmation emails
    console.log('[FINALIZE] Sending confirmation emails...')
    await sendEmails({
      bookingId,
      mentorName,
      mentorEmail: booking.mentor_email,
      menteeName,
      menteeEmail,
      serviceTitle: booking.service_title || 'Mentorship Session',
      startAt: booking.start_at,
      endAt: booking.end_at,
      timezone: booking.timezone,
      meetUrl,
    })

    console.log('[FINALIZE] Booking finalized:', bookingId)

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
