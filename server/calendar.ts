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

export function calendarAuthUrl() {
  const client = oauthClient(process.env.GOOGLE_CALENDAR_REDIRECT_URI || '')
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
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
  const client = oauthClient(process.env.GOOGLE_CALENDAR_REDIRECT_URI || '')
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

async function clientForUser(userId: string) {
  const row = db.prepare('SELECT * FROM calendar_connections WHERE user_id = ?').get(userId) as
    | {
        access_token: string | null
        refresh_token: string | null
        expiry: string | null
        status: string
      }
    | undefined
  if (!row || row.status !== 'connected' || !row.refresh_token && !row.access_token) {
    return null
  }
  const client = oauthClient(process.env.GOOGLE_CALENDAR_REDIRECT_URI || '')
  client.setCredentials({
    access_token: row.access_token || undefined,
    refresh_token: row.refresh_token || undefined,
    expiry_date: row.expiry ? Date.parse(row.expiry) : undefined,
  })
  client.on('tokens', (tokens) => {
    saveCalendarConnection(userId, tokens, null)
  })
  return client
}

export async function createMeetEvent(opts: {
  mentorUserId: string
  menteeEmail: string | null
  title: string
  description: string
  start: string
  end: string
  timezone: string
}) {
  if (!configured()) {
    return { ok: false as const, reason: 'not_configured' }
  }
  const auth = await clientForUser(opts.mentorUserId)
  if (!auth) {
    return { ok: false as const, reason: 'not_authorized' }
  }
  try {
    const calendar = google.calendar({ version: 'v3', auth })
    const attendees = opts.menteeEmail ? [{ email: opts.menteeEmail }] : []
    const res = await calendar.events.insert({
      calendarId: 'primary',
      conferenceDataVersion: 1,
      requestBody: {
        summary: opts.title,
        description: opts.description,
        start: { dateTime: opts.start, timeZone: opts.timezone },
        end: { dateTime: opts.end, timeZone: opts.timezone },
        attendees,
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    })
    const meet =
      res.data.hangoutLink ||
      res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
      null
    return {
      ok: true as const,
      eventId: res.data.id || null,
      meetLink: meet,
      htmlLink: res.data.htmlLink || null,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'calendar_error'
    db.prepare(`UPDATE calendar_connections SET status=? WHERE user_id=?`).run('error', opts.mentorUserId)
    return { ok: false as const, reason: message }
  }
}

export async function cancelMeetEvent(mentorUserId: string, eventId: string) {
  const auth = await clientForUser(mentorUserId)
  if (!auth) return { ok: false as const }
  try {
    const calendar = google.calendar({ version: 'v3', auth })
    await calendar.events.delete({ calendarId: 'primary', eventId })
    return { ok: true as const }
  } catch {
    return { ok: false as const }
  }
}

export function calendarStatus(userId: string) {
  const row = db.prepare('SELECT status, account_email FROM calendar_connections WHERE user_id = ?').get(
    userId,
  ) as { status: string; account_email: string | null } | undefined
  return {
    configured: configured(),
    status: row?.status || 'disconnected',
    email: row?.account_email || null,
  }
}

export { nowIso }
