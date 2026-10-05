/**
 * HELPAMART — GET /api/admin-calendar-callback
 *
 * Receives the Google OAuth authorization code after the central HELPAMART
 * Google account grants Calendar consent.
 *
 * SECURITY:
 *   - Verifies the HMAC-signed state param to prevent CSRF / forged redirects.
 *   - Stores the refresh token ONLY in the google_service_connections DB table
 *     (service-role client — never readable by the browser via the Data API).
 *   - The refresh token is NEVER rendered in the HTML response.
 *   - The browser only sees: account email + "Connected successfully" message.
 *   - No token, secret, or credential appears in the response body or headers.
 *
 * After this callback succeeds, api/book.ts reads the token from the DB
 * (primary) or from the HELPAMART_GOOGLE_REFRESH_TOKEN env var (fallback).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'
const REDIRECT_URI = `${APP_URL}/api/admin-calendar-callback`

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

// ─── Verify HMAC-signed OAuth state ──────────────────────────────────────────
function verifyState(encodedState: string): boolean {
  try {
    const secret = process.env.ADMIN_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'helpamart-admin-state'
    const { data, sig } = JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf-8'))
    const expected = createHmac('sha256', secret).update(data).digest('hex')
    if (expected !== sig) return false
    const payload = JSON.parse(data) as { issued: number }
    // State is valid for 15 minutes (covers OAuth round-trip time)
    if (Date.now() - payload.issued > 15 * 60 * 1000) return false
    return true
  } catch {
    return false
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error: oauthError } = req.query as Record<string, string>

  if (oauthError) {
    console.warn('[ADMIN CAL CB] Google OAuth error:', oauthError)
    return res.status(400).send(`Google OAuth error: ${oauthError}. Please try again.`)
  }

  if (!code || !state) {
    return res.status(400).send('Missing authorization code or state parameter.')
  }

  // Verify state — prevents CSRF attacks on this sensitive endpoint
  if (!verifyState(state)) {
    console.error('[ADMIN CAL CB] State verification failed — possible CSRF or expired request')
    return res.status(403).send('Security check failed. The authorization request may have expired. Please start again.')
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google credentials not configured on this server.')
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).send('Database credentials not configured on this server.')
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      REDIRECT_URI,
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    if (!tokens.refresh_token && !tokens.access_token) {
      return res.status(400).send(
        'Google did not return tokens. ' +
        'If this account previously authorised the app, revoke access at ' +
        'https://myaccount.google.com/permissions and try again.',
      )
    }

    // Fetch account email — used only for display/audit, never in booking responses
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const accountEmail = userInfo.email || null

    // ── Store tokens in google_service_connections — server-side only ──────────
    // The service-role client bypasses RLS; no JWT-based client can read this.
    const db = adminSupabase()
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null

    const upsertPayload: Record<string, unknown> = {
      key: 'helpamart_organizer',
      provider: 'google',
      account_email: accountEmail,
      access_token: tokens.access_token ?? null,
      expiry,
      status: 'connected',
      updated_at: new Date().toISOString(),
    }
    // Only update refresh_token if Google returned a new one
    if (tokens.refresh_token) {
      upsertPayload.refresh_token = tokens.refresh_token
    }

    const { error: upsertErr } = await db
      .from('google_service_connections')
      .upsert(upsertPayload, { onConflict: 'key' })

    if (upsertErr) {
      // Log the error code but NOT the token
      console.error('[ADMIN CAL CB] DB upsert failed:', upsertErr.message, upsertErr.code)
      return res.status(500).send(
        `Failed to store the connection: ${upsertErr.message}. ` +
        'Check that the google_service_connections table exists (run migration 20261004070000).',
      )
    }

    console.log(`[ADMIN CAL CB] Central HELPAMART Calendar connected: ${accountEmail}`)

    // ── Return a safe success page — NO token, NO secret in the response ───────
    return res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <title>HELPAMART — Google Calendar Connected</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                 max-width: 520px; margin: 80px auto; padding: 0 24px; color: #071A35; }
          .card { background: #FDFBF7; border: 1px solid #e8e3d9; border-radius: 16px;
                  padding: 32px; text-align: center; }
          h1 { color: #B77A22; font-size: 22px; margin-bottom: 8px; }
          p  { color: #555; line-height: 1.6; margin: 8px 0; }
          .email { font-weight: 600; color: #071A35; }
          .note  { font-size: 12px; color: #999; margin-top: 24px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>&#x2705; Google Calendar Connected</h1>
          <p>The central HELPAMART Google account has been authorised.</p>
          ${accountEmail ? `<p>Connected account: <span class="email">${accountEmail}</span></p>` : ''}
          <p>Every new booking will now automatically generate a real Google Meet conference.</p>
          <p class="note">
            The authorisation tokens have been stored securely on the server.<br>
            No credentials were sent to this browser.
          </p>
        </div>
      </body>
      </html>
    `)
  } catch (err: any) {
    // Log message only — not the token or any credential
    console.error('[ADMIN CAL CB] Unexpected error:', err?.message)
    return res.status(500).send('Authorization failed. Check server logs for details.')
  }
}
