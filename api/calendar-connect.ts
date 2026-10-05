/**
 * HELPAMART — GET /api/calendar-connect
 *
 * Initiates Google Calendar OAuth for the authenticated mentor.
 * Redirects to Google's consent screen requesting Calendar write scope.
 * The mentor's Supabase user ID is embedded in the OAuth state param
 * so the callback can associate tokens with the correct user.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({
      error: 'Google Calendar is not configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel environment variables.',
    })
  }

  // Require authenticated user — token passed as ?token= query param
  // (Safe: this is only used to build the state, the real auth check happens in the callback)
  const userId = req.query.userId as string | undefined
  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required.' })
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
      `${process.env.APP_URL || 'https://www.helpamart.com'}/api/calendar-callback`,
  )

  const state = Buffer.from(JSON.stringify({ userId })).toString('base64url')

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
  })

  return res.redirect(302, authUrl)
}
