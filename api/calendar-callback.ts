/**
 * HELPAMART — GET /api/calendar-callback
 *
 * Handles the Google Calendar OAuth redirect after the mentor grants consent.
 * Verifies the HMAC-signed state param to prevent OAuth CSRF attacks.
 * Stores the mentor's refresh_token + access_token server-side only.
 *
 * The tokens NEVER reach the browser — only a ?calendar=connected
 * query param is returned to the frontend.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'

// ─── Verify HMAC-signed state produced by calendar-connect.ts ────────────────
function verifyState(encodedState: string): string | null {
  try {
    const secret = process.env.CALENDAR_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'helpamart-state-secret'
    const { data, sig } = JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf-8'))
    const expected = createHmac('sha256', secret).update(data).digest('hex')
    if (expected !== sig) {
      console.error('[CALENDAR CB] State signature mismatch — possible CSRF attempt')
      return null
    }
    const payload = JSON.parse(data)
    return payload.userId || null
  } catch (e) {
    console.error('[CALENDAR CB] State decode failed:', e)
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error: oauthError } = req.query as Record<string, string>

  if (oauthError) {
    console.warn('[CALENDAR CB] OAuth error from Google:', oauthError)
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=denied`)
  }

  if (!code || !state) {
    console.warn('[CALENDAR CB] Missing code or state')
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
  }

  // Verify the signed state — prevents CSRF and forged account-linking
  const userId = verifyState(state)
  if (!userId) {
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
  }

  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${APP_URL}/api/calendar-callback`

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    if (!tokens.refresh_token && !tokens.access_token) {
      console.error('[CALENDAR CB] Google returned no tokens for user', userId)
      return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
    }

    // Fetch connected Google account email (for display in dashboard only)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const accountEmail = userInfo.email || null

    const db = adminSupabase()
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null

    // Upsert — each mentor has at most one calendar connection row (UNIQUE on user_id)
    const { error: upsertErr } = await db.from('calendar_connections').upsert(
      {
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token || null,
        // Only update refresh_token if Google returned a new one
        // (Google omits refresh_token on subsequent authorizations unless prompt=consent was used)
        ...(tokens.refresh_token ? { refresh_token: tokens.refresh_token } : {}),
        expiry,
        account_email: accountEmail,
        calendar_id: 'primary',
        status: 'connected',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

    if (upsertErr) {
      console.error('[CALENDAR CB] DB upsert failed:', upsertErr)
      return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
    }

    console.log(`[CALENDAR CB] Calendar connected for user ${userId} (${accountEmail})`)
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=connected`)
  } catch (err) {
    console.error('[CALENDAR CB] Token exchange failed:', err)
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
  }
}
