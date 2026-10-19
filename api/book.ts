/**
 * HELPAMART — POST /api/book
 *
 * Vercel serverless function (Node.js runtime).
 * Handles the complete booking creation workflow:
 *   1. Authenticate via Supabase JWT
 *   2. Validate mentor / service / slot
 *   3. Compute first-session-free price from persistent history
 *   4. Double-booking check
 *   5. Create booking in Supabase
 *   6. Fetch central HELPAMART Google Meet credentials (server-side only)
 *   7. Exchange refresh token for fresh access token
 *   8. Call Google Meet REST API (POST https://meet.googleapis.com/v2/spaces)
 *   9. Extract & validate the REAL Google Meet URI
 *  10. Persist real meet_link (+ meet_space_name) to booking
 *  11. Send confirmation emails to mentee and mentor (with real Meet link)
 *  12. Create in-app notifications for mentee and mentor (with real Meet link)
 *  13. Return HTTP 200 with booking + real meetUrl
 *
 * CRITICAL RULE: NO SILENT FAILURES.
 * If Google Meet creation fails, the booking is deleted/rolled back,
 * HTTP 503 is returned, and NO booking is ever confirmed without a real Meet URL.
 *
 * NO GOOGLE CALENDAR DEPENDENCY:
 * No Calendar events, no conferenceData, no calendar scope, no mentor calendar connect.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
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

// ─── Central HELPAMART Google Meet credentials resolver ───────────────────────
// Resolves refresh token server-side only:
//   1. google_service_connections table (written by /api/admin-meet-callback)
//   2. GOOGLE_MEET_REFRESH_TOKEN or HELPAMART_GOOGLE_REFRESH_TOKEN env vars
async function getCentralMeetCredentials(db: ReturnType<typeof adminSupabase>): Promise<{
  clientId: string
  clientSecret: string
  refreshToken: string
  cachedAccessToken?: string | null
  connectionKey?: string
} | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    console.error('[BOOK] CRITICAL: GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set in Vercel env vars')
    return null
  }

  let refreshToken: string | null = null
  let cachedAccessToken: string | null = null
  let connectionKey = 'helpamart_meet'

  // 1. Try DB (authoritative)
  try {
    const { data: conn, error: dbErr } = await db
      .from('google_service_connections')
      .select('key, refresh_token, access_token, expiry, status, account_email')
      .in('key', ['helpamart_meet', 'helpamart_organizer'])
      .eq('status', 'connected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (dbErr) {
      console.warn(`[BOOK] google_service_connections query error: ${dbErr.message}`)
    }

    if (conn?.status === 'connected' && conn.refresh_token) {
      refreshToken = conn.refresh_token
      connectionKey = conn.key || 'helpamart_meet'
      console.log(`[BOOK] Central Google Meet token resolved from DB (account: ${conn.account_email || 'unknown'}, key: ${connectionKey})`)

      // Check if access_token in DB is still valid (with 5 min safety buffer)
      if (conn.access_token && conn.expiry) {
        const expiryMs = new Date(conn.expiry).getTime()
        const bufferMs = 5 * 60 * 1000 // 5 minutes
        if (!isNaN(expiryMs) && expiryMs > Date.now() + bufferMs) {
          cachedAccessToken = conn.access_token
          console.log('[BOOK] Active valid Google access token found in DB cache (expires:', conn.expiry, ')')
        }
      }
    }
  } catch (e: any) {
    console.error(`[BOOK] google_service_connections lookup failed: ${e?.message}`)
  }

  // 2. Env var fallback
  if (!refreshToken) {
    const envToken = process.env.GOOGLE_MEET_REFRESH_TOKEN || process.env.HELPAMART_GOOGLE_REFRESH_TOKEN
    if (envToken) {
      refreshToken = envToken
      console.log(`[BOOK] Central Google Meet token resolved from env_var`)
    }
  }

  if (!refreshToken) {
    console.error(`[BOOK] CRITICAL: No Google Meet refresh token found (DB or env). Visit /admin/meet to authorize.`)
    return null
  }

  return { clientId, clientSecret, refreshToken, cachedAccessToken, connectionKey }
}

// ─── Generate Google access token from refresh token ──────────────────────────
async function getGoogleAccessToken(
  creds: {
    clientId: string
    clientSecret: string
    refreshToken: string
    cachedAccessToken?: string | null
    connectionKey?: string
  },
  db?: ReturnType<typeof adminSupabase>
): Promise<string> {
  // If we have an active, valid cached access token, use it directly
  if (creds.cachedAccessToken) {
    return creds.cachedAccessToken
  }

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
    console.error('[BOOK] Google OAuth token refresh FAILED (HTTP', tokenRes.status, '):', errText)
    
    let isInvalidGrant = false
    try {
      const parsed = JSON.parse(errText)
      if (
        parsed.error === 'invalid_grant' ||
        String(parsed.error_description || '').toLowerCase().includes('revoked') ||
        String(parsed.error_description || '').toLowerCase().includes('expired')
      ) {
        isInvalidGrant = true
      }
    } catch {
      if (errText.includes('invalid_grant')) isInvalidGrant = true
    }

    if (isInvalidGrant && db) {
      console.warn('[BOOK] Refresh token is expired or revoked. Marking google_service_connections as disconnected in DB.')
      try {
        await db
          .from('google_service_connections')
          .update({
            status: 'disconnected',
            updated_at: new Date().toISOString(),
          })
          .in('key', ['helpamart_meet', 'helpamart_organizer'])
      } catch (markErr: any) {
        console.error('[BOOK] Failed to update connection status to disconnected:', markErr?.message)
      }
    }

    const error = new Error(
      isInvalidGrant
        ? 'Google Meet authorization expired or revoked. Re-authorization is required.'
        : `Google token refresh failed (HTTP ${tokenRes.status})`
    )
    ;(error as any).isInvalidGrant = isInvalidGrant
    throw error
  }

  const tokenData = (await tokenRes.json()) as {
    access_token?: string
    expires_in?: number
    refresh_token?: string
    error?: string
    error_description?: string
  }

  if (tokenData.error) {
    console.error('[BOOK] Google OAuth token error field:', tokenData.error, tokenData.error_description)
    throw new Error(`Google token error: ${tokenData.error}`)
  }
  if (!tokenData.access_token) {
    throw new Error('Google token refresh returned no access_token.')
  }

  // Persist the newly acquired access_token, expiry, and any rotated refresh_token to DB
  if (db) {
    try {
      const expiresInSec = typeof tokenData.expires_in === 'number' ? tokenData.expires_in : 3600
      const expiryDate = new Date(Date.now() + Math.max(0, expiresInSec - 60) * 1000).toISOString()
      const updatePayload: Record<string, any> = {
        access_token: tokenData.access_token,
        expiry: expiryDate,
        status: 'connected',
        updated_at: new Date().toISOString(),
      }
      if (tokenData.refresh_token) {
        updatePayload.refresh_token = tokenData.refresh_token
        console.log('[BOOK] Google issued rotated refresh_token; persisting to DB')
      }

      await db
        .from('google_service_connections')
        .update(updatePayload)
        .in('key', ['helpamart_meet', 'helpamart_organizer'])

      console.log('[BOOK] Cached fresh Google access token and expiry to DB')
    } catch (saveErr: any) {
      console.warn('[BOOK] Failed to cache access token in DB (non-fatal):', saveErr?.message)
    }
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
  console.log('[BOOK] Calling Google Meet REST API: POST https://meet.googleapis.com/v2/spaces')

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
      `[BOOK] Google Meet API spaces.create FAILED:`,
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
    console.error('[BOOK] Google Meet API returned unexpected body:', JSON.stringify(meetData))
    throw new Error(`Google Meet API did not return a valid meetingUri. Body: ${JSON.stringify(meetData)}`)
  }

  console.log(`[BOOK] Google Meet space created successfully: ${meetingUri} (space: ${meetData.name || 'none'})`)

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
    console.log('[DELIVERY] mentor_email=SKIPPED (no email)')
    return { success: false, error: 'no_email' }
  }

  const transport = getTransporter()
  if (!transport) {
    console.error('[DELIVERY] mentor_email=FAILED (SMTP not configured)')
    return { success: false, error: 'smtp_not_configured' }
  }

  const from = process.env.SMTP_FROM || 'HELPAMART <hello@helpamart.com>'

  // Validate Meet URL
  if (!opts.meetUrl || !opts.meetUrl.startsWith('https://meet.google.com/')) {
    console.error('[DELIVERY] mentor_email=FAILED (invalid meet URL):', opts.meetUrl)
    return { success: false, error: 'invalid_meet_url' }
  }

  const dateStr = fmt(opts.startAt, opts.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = fmt(opts.startAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
  const priceDisplay = opts.priceCents === 0
    ? 'Free (first session with this mentor)'
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
    console.log('[DELIVERY] mentor_email=SENT | to:', opts.mentorEmail.slice(0, 3) + '***', '| messageId:', info.messageId)
    return { success: true }
  } catch (e: any) {
    console.error('[DELIVERY] mentor_email=FAILED | to:', opts.mentorEmail, '| error:', e?.message || e)
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
    console.log('[DELIVERY] mentee_email=SKIPPED (no email)')
    return { success: false, error: 'no_email' }
  }

  const transport = getTransporter()
  if (!transport) {
    console.error('[DELIVERY] mentee_email=FAILED (SMTP not configured)')
    return { success: false, error: 'smtp_not_configured' }
  }

  const from = process.env.SMTP_FROM || 'HELPAMART <hello@helpamart.com>'

  // Validate Meet URL
  if (!opts.meetUrl || !opts.meetUrl.startsWith('https://meet.google.com/')) {
    console.error('[DELIVERY] mentee_email=FAILED (invalid meet URL):', opts.meetUrl)
    return { success: false, error: 'invalid_meet_url' }
  }

  const dateStr = fmt(opts.startAt, opts.timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const startTime = fmt(opts.startAt, opts.timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
  const priceDisplay = opts.priceCents === 0
    ? 'Free (first session with this mentor)'
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
    console.log('[DELIVERY] mentee_email=SENT | to:', opts.menteeEmail.slice(0, 3) + '***', '| messageId:', info.messageId)
    return { success: true }
  } catch (e: any) {
    console.error('[DELIVERY] mentee_email=FAILED | to:', opts.menteeEmail, '| error:', e?.message || e)
    return { success: false, error: e?.message }
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Idempotency-Key')
  if (req.method === 'OPTIONS') return res.status(200).end()

  const missingEnv: string[] = []
  if (!process.env.SUPABASE_URL) missingEnv.push('SUPABASE_URL')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missingEnv.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!process.env.GOOGLE_CLIENT_ID) missingEnv.push('GOOGLE_CLIENT_ID')
  if (!process.env.GOOGLE_CLIENT_SECRET) missingEnv.push('GOOGLE_CLIENT_SECRET')
  if (missingEnv.length > 0) {
    console.error('[BOOK] CRITICAL: missing env vars:', missingEnv.join(', '))
    return res.status(503).json({
      error: `Server misconfiguration: missing env vars: ${missingEnv.join(', ')}. Contact support.`,
    })
  }

  // ─── GET /api/book?mentorSlug=... (Server-authoritative price check) ───────
  if (req.method === 'GET') {
    const mentorSlug = (req.query.mentorSlug || req.query.slug) as string | undefined
    if (!mentorSlug) {
      return res.status(400).json({ error: 'mentorSlug query parameter is required.' })
    }
    const db = adminSupabase()

    let { data: mentorRow } = await db
      .from('mentors')
      .select('id, name, slug, status')
      .eq('slug', mentorSlug)
      .eq('status', 'published')
      .maybeSingle()

    if (!mentorRow) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(mentorSlug)
      let fallbackQuery = db.from('mentors').select('id, name, slug, status').eq('status', 'published')
      if (isUuid) {
        fallbackQuery = fallbackQuery.or(`id.eq.${mentorSlug},slug.ilike.${mentorSlug}-%`)
      } else {
        fallbackQuery = fallbackQuery.ilike('slug', `${mentorSlug}-%`)
      }
      const { data: fallbackRow } = await fallbackQuery.order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (fallbackRow) mentorRow = fallbackRow
    }

    if (!mentorRow) {
      return res.status(404).json({ error: 'Mentor not found.' })
    }

    // Authoritative per-mentor first session count:
    // Only confirmed/completed sessions count towards consuming the mentor's free session.
    // Cancelled, failed, or pending sessions do not consume the entitlement.
    const { count: mentorConfirmedBookings } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('mentor_id', mentorRow.id)
      .in('status', ['confirmed', 'completed'])

    const isFirstSession = (mentorConfirmedBookings ?? 0) === 0
    const priceCents = isFirstSession ? 0 : 9900

    return res.status(200).json({
      mentorId: mentorRow.id,
      mentorSlug: mentorRow.slug,
      mentorName: mentorRow.name,
      isFirstSession,
      priceCents,
      currency: 'INR',
    })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed.' })
  }

  let bookingCreated = false
  const bookingId = crypto.randomUUID()
  let db: ReturnType<typeof adminSupabase> | null = null
  const idempotencyKey = (req.headers['x-idempotency-key'] || req.headers['idempotency-key']) as string | undefined

  try {
    // 1. Authenticate mentee
    const userId = await verifyJwt(req.headers.authorization)
    console.log('[BOOK] authenticated user:', userId)
    db = adminSupabase()

    // 1.5. Idempotency check: if request has idempotency key, check if we've already processed it
    if (idempotencyKey) {
      console.log('[BOOK] idempotency key present:', idempotencyKey.slice(0, 8) + '...')
      const { data: existingBooking } = await db
        .from('bookings')
        .select('id, status, payment_status, meet_link')
        .eq('mentee_id', userId)
        .eq('idempotency_key', idempotencyKey)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingBooking) {
        console.log('[BOOK] idempotent request: returning existing booking', existingBooking.id)
        return res.status(200).json({
          booking: {
            id: existingBooking.id,
            meetUrl: existingBooking.meet_link,
            meetLink: existingBooking.meet_link,
            status: existingBooking.status,
            isFirstSession: false, // Cannot determine, but idempotent response
          },
          note: 'Idempotent response: booking already created',
        })
      }
    }

    const { mentorSlug, serviceId, startAt, timezone } = req.body as {
      mentorSlug?: string
      serviceId?: string
      startAt?: string
      timezone?: string
    }

    if (!mentorSlug || !startAt || !timezone) {
      return res.status(400).json({ error: 'mentorSlug, startAt, and timezone are required.' })
    }

    // 2. Validate mentor (server-authoritative)
    const { data: mentorRow, error: mentorErr } = await db
      .from('mentors')
      .select('id, user_id, name, slug, status, services, buffer_minutes, timezone')
      .eq('slug', mentorSlug)
      .eq('status', 'published')
      .maybeSingle()

    if (mentorErr || !mentorRow) {
      console.error('[BOOK] mentor lookup failed:', mentorErr?.message, '| slug:', mentorSlug)
      return res.status(404).json({ error: 'This mentor is not currently available.' })
    }
    console.log('[BOOK] mentor resolved:', mentorRow.id, mentorRow.name)

    // 3. Resolve service
    const services: any[] = Array.isArray(mentorRow.services) ? mentorRow.services : []
    const service = serviceId
      ? services.find((s: any) => s.id === serviceId || s.title === serviceId) ?? services[0]
      : services[0]

    if (!service) {
      return res.status(400).json({ error: 'That session type is not available.' })
    }
    console.log('[BOOK] service resolved:', service.title, '| duration:', service.durationMinutes, 'min')

    const durationMin = service.durationMinutes || 30
    const start = new Date(startAt)
    const end = new Date(start.getTime() + durationMin * 60 * 1000)

    if (isNaN(start.getTime())) {
      return res.status(400).json({ error: 'Invalid start time.' })
    }

    // 4. Server-side authoritative per-mentor price calculation
    // RULE: Every newly approved/registered mentor gets exactly ONE free session:
    // their first eligible booking with their first student.
    // After that mentor's first session is successfully confirmed/completed,
    // all subsequent sessions with that mentor cost ₹99 (regardless of which student books).
    const { count: mentorConfirmedBookings } = await db
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('mentor_id', mentorRow.id)
      .in('status', ['confirmed', 'completed'])

    const isFirstSessionForMentor = (mentorConfirmedBookings ?? 0) === 0
    const finalPriceCents = isFirstSessionForMentor ? 0 : 9900
    const currency = 'INR'
    console.log('[BOOK] price calculated: isFirstSessionForMentor=', isFirstSessionForMentor, '| priceCents=', finalPriceCents, '| mentorPreviousBookings=', mentorConfirmedBookings)

    // POST /api/book is the free booking endpoint. If the mentor has already used their free session,
    // reject and instruct the student to complete payment of ₹99.
    if (!isFirstSessionForMentor) {
      console.warn('[BOOK] REJECTED: Mentor has already used their free session. Mentor ID:', mentorRow.id)
      return res.status(400).json({
        error: 'The first free session for this mentor has already been claimed. Every subsequent session with this mentor is ₹99.',
        code: 'FREE_SESSION_ALREADY_CLAIMED',
        requiresPayment: true,
        priceCents: 9900,
      })
    }

    // 5. Double-booking check
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
    console.log('[BOOK] clash check passed')

    // Fetch participant profile info for notifications & emails
    // CRITICAL: Email resolution must be server-authoritative from profiles table
    const [{ data: mentorUser, error: mentorProfileErr }, { data: menteeUser, error: menteeProfileErr }] = await Promise.all([
      db.from('profiles').select('email, full_name').eq('id', mentorRow.user_id).maybeSingle(),
      db.from('profiles').select('email, full_name').eq('id', userId).maybeSingle(),
    ])

    if (mentorProfileErr) {
      console.error('[BOOK] mentor profile lookup FAILED:', mentorProfileErr.message, '| mentor.user_id:', mentorRow.user_id)
    }
    if (menteeProfileErr) {
      console.error('[BOOK] mentee profile lookup FAILED:', menteeProfileErr.message, '| mentee_id:', userId)
    }

    const mentorEmail = mentorUser?.email ?? null
    const menteeEmail = menteeUser?.email ?? null
    const mentorName = mentorRow.name || 'Mentor'
    const menteeName = menteeUser?.full_name || 'Student'

    console.log('[BOOK] profiles resolved:')
    console.log('  - mentor_id:', mentorRow.id, '| user_id:', mentorRow.user_id, '| email:', mentorEmail ? `${mentorEmail.slice(0, 3)}***${mentorEmail.slice(-6)}` : 'MISSING', '| name:', mentorName)
    console.log('  - mentee_id:', userId, '| email:', menteeEmail ? `${menteeEmail.slice(0, 3)}***${menteeEmail.slice(-6)}` : 'MISSING', '| name:', menteeName)

    // 6. Check central Google Meet credentials FIRST before finalizing
    const meetCreds = await getCentralMeetCredentials(db)
    if (!meetCreds) {
      console.error('[BOOK] CRITICAL: Google Meet central credentials not available')
      return res.status(503).json({
        error: 'Google Meet is not connected on this server. Please contact support.',
        details: 'The central HELPAMART Google account must be connected at /admin/meet.',
      })
    }
    console.log('[BOOK] central Meet credentials resolved')

    // 7. Insert booking (provisional)
    const now = new Date().toISOString()
    console.log('[BOOK] inserting provisional booking:', bookingId)
    const { error: insertErr } = await db.from('bookings').insert({
      id: bookingId,
      mentor_id: mentorRow.id,
      mentee_id: userId,
      service_id: service.id || service.title || 'default',
      service_title: service.title,
      start_at: start.toISOString(),
      end_at: end.toISOString(),
      timezone,
      status: isFirstSessionForMentor ? 'confirmed' : 'pending',
      payment_status: finalPriceCents === 0 ? 'not_required' : 'pending',
      price_cents: finalPriceCents,
      currency,
      payment_provider: finalPriceCents === 0 ? 'none' : 'cashfree',
      idempotency_key: idempotencyKey || undefined,
      meet_link: null, // Will ONLY be set once Google Meet API responds with real URI
      mentor_email: mentorEmail,
      student_email: menteeEmail,
      created_at: now,
      updated_at: now,
    })

    if (insertErr) {
      console.error('[BOOK] booking INSERT failed:', insertErr.message, '| code:', insertErr.code)
      if (insertErr.code === '23505') {
        return res.status(409).json({
          error: 'The first free session for this mentor has just been claimed by another booking. Every subsequent session with this mentor is ₹99.',
          code: 'FREE_SESSION_ALREADY_CLAIMED',
          requiresPayment: true,
          priceCents: 9900,
        })
      }
      return res.status(500).json({ error: `Could not create booking: ${insertErr.message}` })
    }
    bookingCreated = true
    console.log('[BOOK] provisional booking inserted:', bookingId)

    // 8. Generate Google access token server-side from refresh token
    console.log('[BOOK] acquiring Google access token')
    let accessToken: string
    try {
      accessToken = await getGoogleAccessToken(meetCreds, db)
    } catch (tokenErr: any) {
      const detail = tokenErr?.message || 'unknown token error'
      console.error('[BOOK] Google access token generation FAILED:', detail)
      await db.from('bookings').delete().eq('id', bookingId)
      return res.status(503).json({
        error: 'We could not generate the Google Meet room for this session. Please try again in a few moments, or contact support.',
        hint: 'Google Meet authorization expired. Please reconnect the central Google account at /admin/meet.',
      })
    }
    console.log('[BOOK] Google access token acquired')

    // 9. Call Google Meet REST API (POST https://meet.googleapis.com/v2/spaces)
    console.log('[BOOK] calling Google Meet API: POST https://meet.googleapis.com/v2/spaces')
    let meetSpace: { meetingUri: string; spaceName: string; meetingCode: string }
    try {
      meetSpace = await createGoogleMeetSpace(accessToken)
    } catch (meetErr: any) {
      const detail = meetErr?.message || 'unknown meet error'
      console.error('[BOOK] Google Meet space creation FAILED:', detail)
      // Rollback booking immediately — NEVER leave a booking without a real Meet URL
      const { error: rollbackErr } = await db.from('bookings').delete().eq('id', bookingId)
      if (rollbackErr) console.error('[BOOK] rollback delete also failed:', rollbackErr.message)
      return res.status(503).json({
        error: 'We could not generate the Google Meet room for this session. Please try again in a few moments, or contact support.',
        hint: 'Google Meet conference room creation failed. You may need to reconnect Google Meet at /admin/meet.',
      })
    }
    console.log('[BOOK] Google Meet API returned meetingUri (exists=true, spaceName=', meetSpace.spaceName, ')')

    const realMeetUrl = meetSpace.meetingUri

    // 10. Persist real Google Meet URL to the booking
    // Note: meet_space_name is optional metadata. meet_link is mandatory.
    console.log('[BOOK] updating booking with meet_link')
    
    // Try to update with both meet_link and meet_space_name
    let updateErr = null
    let updatePayload = {
      meet_link: realMeetUrl,
      meet_space_name: meetSpace.spaceName || null,
      updated_at: new Date().toISOString(),
    }
    
    const { error: primaryUpdateErr } = await db.from('bookings').update(updatePayload).eq('id', bookingId)
    
    // If update fails due to missing meet_space_name column (PGRST204), retry with just meet_link
    if (primaryUpdateErr?.code === 'PGRST204' && primaryUpdateErr?.message?.includes('meet_space_name')) {
      console.warn('[BOOK] meet_space_name column not found in schema, updating with meet_link only')
      const { error: fallbackErr } = await db.from('bookings').update({
        meet_link: realMeetUrl,
        updated_at: new Date().toISOString(),
      }).eq('id', bookingId)
      updateErr = fallbackErr
    } else {
      updateErr = primaryUpdateErr
    }

    if (updateErr) {
      // Log the FULL Supabase error — this is the most likely failure point when
      // SUPABASE_SERVICE_ROLE_KEY is missing or wrong, causing RLS to block the update.
      console.error(
        '[BOOK] CRITICAL: booking UPDATE failed.',
        '| message:', updateErr.message,
        '| code:', updateErr.code,
        '| details:', updateErr.details,
        '| hint:', updateErr.hint,
      )
      // Do NOT silently delete — log the rollback attempt result too
      const { error: rollbackErr } = await db.from('bookings').delete().eq('id', bookingId)
      if (rollbackErr) console.error('[BOOK] rollback delete also failed:', rollbackErr.message)
      return res.status(500).json({
        error: `Could not save booking with Meet link: ${updateErr.message} (code: ${updateErr.code})`,
        hint: 'Check that SUPABASE_SERVICE_ROLE_KEY is set correctly in Vercel env vars (not the anon key).',
      })
    }
    console.log('[BOOK] booking updated with meet_link — booking ID:', bookingId)

    console.log('[BOOK] booking', bookingId, 'successfully confirmed with real Meet URL')

    // 11. Send confirmation emails to BOTH mentee and mentor (Hostinger SMTP)
    // CRITICAL: Must AWAIT email completion before returning HTTP 200
    // Non-fatal: Email failure does NOT delete the booking (meet URL already saved)
    const emailResults = await Promise.allSettled([
      sendMentorBookingEmail({
        bookingId,
        mentorName,
        mentorEmail,
        menteeName,
        menteeEmail,
        serviceTitle: service.title,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        timezone,
        priceCents: finalPriceCents,
        meetUrl: realMeetUrl,
      }),
      sendMenteeBookingEmail({
        bookingId,
        mentorName,
        menteeName,
        menteeEmail,
        serviceTitle: service.title,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        timezone,
        priceCents: finalPriceCents,
        meetUrl: realMeetUrl,
      }),
    ])

    // Log email delivery results (non-fatal failures)
    const mentorResult = emailResults[0].status === 'fulfilled' ? emailResults[0].value : { success: false, error: emailResults[0].reason?.message }
    const menteeResult = emailResults[1].status === 'fulfilled' ? emailResults[1].value : { success: false, error: emailResults[1].reason?.message }
    console.log('[BOOK] email delivery completed | mentor:', mentorResult.success ? 'SENT' : 'FAILED (' + (mentorResult.error || 'unknown') + ')', '| mentee:', menteeResult.success ? 'SENT' : 'FAILED (' + (menteeResult.error || 'unknown') + ')')

    // 12. Create in-app notifications for BOTH mentee and mentor
    // CRITICAL: Notifications must include:
    //   - EXACT meet_link from bookings.meet_link (single source of truth)
    //   - Full booking details (date, time, service, amount)
    //   - Recipient as user_id (mentor or mentee)
    try {
      if (!realMeetUrl || !realMeetUrl.startsWith('https://meet.google.com/')) {
        throw new Error(`Invalid meet URL: ${realMeetUrl}`)
      }

      const dateStr = fmt(start.toISOString(), timezone, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      const startTime = fmt(start.toISOString(), timezone, { hour: '2-digit', minute: '2-digit', hour12: true })
      const amountDisplay = finalPriceCents === 0
        ? 'Complimentary (first session with this mentor)'
        : `₹${Math.round(finalPriceCents / 100)}`

      const menteeNotificationMessage = `Your session with ${mentorRow.name} is confirmed for ${dateStr} at ${startTime}. Service: ${service.title}. Amount: ${amountDisplay}. Click to join the Google Meet.`
      const mentorNotificationMessage = `New session booked with ${menteeName}. ${dateStr} at ${startTime}. Service: ${service.title}. Amount: ${amountDisplay}. Click to join the Google Meet.`

      const notifications = [
        {
          user_id: userId,
          title: 'Session Confirmed',
          message: menteeNotificationMessage,
          link: realMeetUrl,
          read: false,
          created_at: now,
          updated_at: now,
        },
      ]

      // Add mentor notification only if mentor account exists
      if (mentorRow.user_id) {
        notifications.push({
          user_id: mentorRow.user_id,
          title: 'New Session Booked',
          message: mentorNotificationMessage,
          link: realMeetUrl,
          read: false,
          created_at: now,
          updated_at: now,
        })
      }

      const { error: notifInsertErr } = await db.from('notifications').insert(notifications)
      if (notifInsertErr) {
        console.error('[BOOK] notification INSERT error:', notifInsertErr.message, '| code:', notifInsertErr.code)
      } else {
        console.log('[BOOK] notifications inserted successfully:', notifications.length, 'notifications')
      }
    } catch (notifErr: any) {
      console.error('[BOOK] notification creation error:', notifErr?.message || notifErr)
    }

    // 13. Return HTTP 200 with booking and REAL Meet URL
    console.log('[BOOK] returning HTTP 200 with booking and real meetUrl')
    return res.status(200).json({
      booking: {
        id: bookingId,
        meetUrl: realMeetUrl,
        meetLink: realMeetUrl,
        status: isFirstSessionForMentor ? 'confirmed' : 'pending',
        priceCents: finalPriceCents,
        currency,
        isFirstSession: isFirstSessionForMentor,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        mentorName: mentorRow.name,
      },
    })
  } catch (err: any) {
    console.error('[BOOK] Unhandled booking error:', err)
    if (bookingCreated && db) {
      // Rollback on unexpected failure
      try {
        await db.from('bookings').delete().eq('id', bookingId)
      } catch {
        // Ignore rollback deletion error
      }
    }
    const status = err?.message?.includes('authenticated') ? 401 : 500
    return res.status(status).json({ error: err?.message || 'An unexpected error occurred.' })
  }
}
