/**
 * HELPAMART — GET /api/admin-meet-connect
 *
 * ONE-TIME admin endpoint to authorize the CENTRAL HELPAMART Google account
 * specifically for the Google Meet REST API (v2 spaces.create).
 *
 * Scope requested:
 *   - https://www.googleapis.com/auth/meetings.space.created
 *   - https://www.googleapis.com/auth/userinfo.email
 *
 * NO Google Calendar scope is requested.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { createHmac, randomBytes } from 'crypto'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'

function getRedirectUri(): string {
  if (process.env.GOOGLE_MEET_REDIRECT_URI) return process.env.GOOGLE_MEET_REDIRECT_URI
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI?.includes('admin-calendar-callback')) {
    // If the user already registered the calendar callback URL in Google Cloud Console,
    // we can use it because admin-calendar-callback also handles Meet token exchange.
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI
  }
  return `${APP_URL}/api/admin-meet-callback`
}

// ─── HMAC-sign the OAuth state ────────────────────────────────────────────────
function buildState(): string {
  const secret = process.env.ADMIN_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'helpamart-meet-admin-state'
  const nonce = randomBytes(16).toString('hex')
  const issued = Date.now()
  const data = JSON.stringify({ nonce, issued, type: 'meet_auth' })
  const sig = createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).send('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be configured in Vercel environment variables.')
  }

  const redirectUri = getRedirectUri()

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent', // always request refresh_token
    scope: [
      'https://www.googleapis.com/auth/meetings.space.created',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: buildState(),
  })

  return res.redirect(302, authUrl)
}
