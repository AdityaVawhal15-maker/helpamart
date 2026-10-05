/**
 * HELPAMART — GET /api/admin-calendar-connect
 *
 * ONE-TIME admin endpoint to authorize the central HELPAMART Google account
 * for Calendar/Meet event creation.
 *
 * This endpoint is protected by ADMIN_SECRET query param.
 * It is never shown to mentors or students.
 *
 * USAGE (run once after deploy):
 *   1. Visit:
 *      https://www.helpamart.com/api/admin-calendar-connect?secret=<ADMIN_SECRET>
 *   2. Sign in with the central HELPAMART Google account (e.g. calendar@helpamart.com)
 *   3. Grant Google Calendar permission
 *   4. The callback page shows: HELPAMART_GOOGLE_REFRESH_TOKEN=<value>
 *   5. Copy that value and set it in Vercel → Environment Variables
 *
 * After HELPAMART_GOOGLE_REFRESH_TOKEN is set in Vercel, every booking
 * will use that central account to create Calendar events and Meet conferences.
 *
 * SECURITY:
 *   - Protected by ADMIN_SECRET env var
 *   - Refresh token is shown ONCE in the response and stored manually in Vercel
 *   - Never stored in the database, never exposed to the browser during booking
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'
// Callback URI must be registered in Google Cloud Console
const REDIRECT_URI = `${APP_URL}/api/admin-calendar-callback`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Protect with admin secret
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) {
    return res.status(500).send('ADMIN_SECRET env var is not set.')
  }
  if (req.query.secret !== adminSecret) {
    return res.status(403).send('Forbidden.')
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).send('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in Vercel env vars.')
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT_URI,
  )

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',  // always request refresh_token
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
  })

  return res.redirect(302, authUrl)
}
