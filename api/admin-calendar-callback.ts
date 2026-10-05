/**
 * HELPAMART — GET /api/admin-calendar-callback
 *
 * Receives the authorization code after the central HELPAMART Google account
 * completes OAuth consent. Displays the refresh token so the admin can copy
 * it into Vercel → Environment Variables → HELPAMART_GOOGLE_REFRESH_TOKEN.
 *
 * This endpoint is called automatically by Google after /api/admin-calendar-connect.
 * It is never used by mentors or students.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'
const REDIRECT_URI = `${APP_URL}/api/admin-calendar-callback`

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, error } = req.query as Record<string, string>

  if (error) {
    return res.status(400).send(`Google OAuth error: ${error}`)
  }

  if (!code) {
    return res.status(400).send('Missing authorization code.')
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google credentials not configured.')
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Fetch connected account email for display
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const email = userInfo.email || 'unknown'

    const refreshToken = tokens.refresh_token
    if (!refreshToken) {
      return res.status(400).send(
        'Google did not return a refresh token. ' +
        'Make sure you are using prompt=consent and that this Google account has not previously authorised this app. ' +
        'Revoke access at https://myaccount.google.com/permissions and try again.',
      )
    }

    // Display the token securely — admin must copy this into Vercel env vars
    return res.status(200).send(`
      <!DOCTYPE html>
      <html>
      <head><title>HELPAMART Admin — Google Calendar Authorized</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 640px; margin: 60px auto; padding: 0 24px; color: #071A35; }
        h1 { color: #B77A22; }
        code { display: block; background: #f4efe6; padding: 16px; border-radius: 8px; word-break: break-all; font-size: 13px; margin: 12px 0; }
        .step { background: #FDFBF7; border: 1px solid #e8e3d9; border-radius: 12px; padding: 20px; margin: 20px 0; }
        strong { color: #071A35; }
      </style>
      </head>
      <body>
        <h1>✅ HELPAMART Google Calendar Authorized</h1>
        <p>Connected Google account: <strong>${email}</strong></p>

        <div class="step">
          <p><strong>Step 1:</strong> Copy the refresh token below:</p>
          <code>${refreshToken}</code>
        </div>

        <div class="step">
          <p><strong>Step 2:</strong> Go to Vercel → Project → Settings → Environment Variables</p>
          <p>Add a new variable:</p>
          <code>HELPAMART_GOOGLE_REFRESH_TOKEN = ${refreshToken}</code>
        </div>

        <div class="step">
          <p><strong>Step 3:</strong> Redeploy your Vercel project (or wait for the next deploy).</p>
          <p>Every new booking will now automatically create a Google Calendar event and real Google Meet conference.</p>
        </div>

        <p style="color:#888;font-size:13px;margin-top:32px;">
          ⚠️ This token grants HELPAMART Calendar access. Store it securely in Vercel env vars only.
          Do not commit it to Git.
        </p>
      </body>
      </html>
    `)
  } catch (err: any) {
    console.error('[ADMIN CALENDAR CB] Error:', err?.message)
    return res.status(500).send(`Authorization failed: ${err?.message || 'Unknown error'}`)
  }
}
