import { google } from 'googleapis'
import { db, nowIso } from './db.ts'

function configured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
}

function oauthClient(redirectUri: string) {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  )
}

export function googleAuthConfigured() {
  return configured()
}

export function authUrl() {
  const client = oauthClient(process.env.GOOGLE_REDIRECT_URI || '')
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['openid', 'email', 'profile'],
  })
}

// Google Meet authorization for central HELPAMART account
export function calendarAuthUrl() {
  const client = oauthClient(process.env.GOOGLE_MEET_REDIRECT_URI || process.env.GOOGLE_CALENDAR_REDIRECT_URI || '')
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/meetings.space.created',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })
}

export async function exchangeAuthCode(code: string) {
  const client = oauthClient(process.env.GOOGLE_REDIRECT_URI || '')
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data } = await oauth2.userinfo.get()
  return { tokens, profile: data }
}

export async function exchangeCalendarCode(code: string) {
  const client = oauthClient(process.env.GOOGLE_MEET_REDIRECT_URI || process.env.GOOGLE_CALENDAR_REDIRECT_URI || '')
  const { tokens } = await client.getToken(code)
  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: 'v2', auth: client })
  const { data } = await oauth2.userinfo.get()
  return { tokens, email: data.email || null }
}

export function saveCalendarConnection(
  userId: string,
  tokens: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null },
  email: string | null,
) {
  const existing = db.prepare('SELECT * FROM calendar_connections WHERE user_id = ?').get(userId) as
    | { refresh_token?: string }
    | undefined
  const refresh = tokens.refresh_token || existing?.refresh_token || null
  const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
  if (existing) {
    db.prepare(
      `UPDATE calendar_connections SET access_token=?, refresh_token=?, expiry=?, account_email=?, status=? WHERE user_id=?`,
    ).run(tokens.access_token || null, refresh, expiry, email, 'connected', userId)
  } else {
    db.prepare(
      `INSERT INTO calendar_connections (id, user_id, provider, access_token, refresh_token, expiry, account_email, calendar_id, status)
       VALUES (?, ?, 'google', ?, ?, ?, ?, 'primary', 'connected')`,
    ).run(crypto.randomUUID(), userId, tokens.access_token || null, refresh, expiry, email)
  }
}



/**
 * Creates a real Google Meet space via Google Meet REST API v2
 * POST https://meet.googleapis.com/v2/spaces
 */
export async function createMeetEvent(opts: {
  mentorUserId?: string
  menteeEmail?: string | null
  title?: string
  description?: string
  start?: string
  end?: string
  timezone?: string
}) {
  if (!configured()) {
    return { ok: false as const, reason: 'not_configured' }
  }

  // Look for any connected refresh token (central or fallback)
  let refreshToken = process.env.GOOGLE_MEET_REFRESH_TOKEN || process.env.HELPAMART_GOOGLE_REFRESH_TOKEN || null
  if (!refreshToken && opts.mentorUserId) {
    const row = db.prepare('SELECT refresh_token FROM calendar_connections WHERE user_id = ? AND status = "connected"').get(opts.mentorUserId) as { refresh_token?: string } | undefined
    if (row?.refresh_token) refreshToken = row.refresh_token
  }
  if (!refreshToken) {
    const anyRow = db.prepare('SELECT refresh_token FROM calendar_connections WHERE refresh_token IS NOT NULL AND status = "connected" LIMIT 1').get() as { refresh_token?: string } | undefined
    if (anyRow?.refresh_token) refreshToken = anyRow.refresh_token
  }

  if (!refreshToken) {
    return { ok: false as const, reason: 'not_authorized' }
  }

  try {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    })

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!tokenRes.ok) {
      throw new Error(`Token refresh failed: ${tokenRes.status}`)
    }

    const { access_token } = (await tokenRes.json()) as { access_token?: string }
    if (!access_token) throw new Error('No access_token returned')

    // Call Google Meet REST API
    const meetRes = await fetch('https://meet.googleapis.com/v2/spaces', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    })

    if (!meetRes.ok) {
      throw new Error(`Google Meet API failed: ${meetRes.status}`)
    }

    const meetData = (await meetRes.json()) as { meetingUri?: string; name?: string }
    const meetUri = meetData.meetingUri
    if (!meetUri || !meetUri.startsWith('https://meet.google.com/')) {
      throw new Error('Invalid meetingUri returned')
    }

    return {
      ok: true as const,
      eventId: meetData.name || null,
      meetLink: meetUri,
      htmlLink: null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'meet_error'
    return { ok: false as const, reason: message }
  }
}

export async function cancelMeetEvent(_mentorUserId: string, _eventId: string) {
  // Meet spaces do not require active calendar deletion
  return { ok: true as const }
}

export function calendarStatus(userId: string) {
  const row = db.prepare('SELECT status, account_email FROM calendar_connections WHERE user_id = ?').get(
    userId,
  ) as { status: string; account_email: string | null } | undefined
  return {
    configured: configured(),
    status: row?.status || 'connected',
    email: row?.account_email || null,
  }
}

export { nowIso }
