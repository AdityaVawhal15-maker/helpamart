/**
 * HELPAMART — GET /api/admin-meet-callback
 *
 * Receives the Google OAuth authorization code after the central HELPAMART
 * Google account grants consent for Google Meet.
 *
 * SECURITY:
 *   - Verifies HMAC-signed state parameter to prevent CSRF / forged redirects.
 *   - Stores the refresh token ONLY in the google_service_connections DB table
 *     (service-role client — never readable by the browser via the Data API).
 *   - The refresh token is NEVER sent to the browser or rendered in HTML.
 *   - Browser only sees: "Google Meet Connected" + account email.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'
import { createHmac } from 'crypto'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'

function getRedirectUri(): string {
  if (process.env.GOOGLE_MEET_REDIRECT_URI) return process.env.GOOGLE_MEET_REDIRECT_URI
  if (process.env.GOOGLE_CALENDAR_REDIRECT_URI?.includes('admin-calendar-callback')) {
    return process.env.GOOGLE_CALENDAR_REDIRECT_URI
  }
  return `${APP_URL}/api/admin-meet-callback`
}

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function verifyState(encodedState: string): boolean {
  try {
    const secret = process.env.ADMIN_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'helpamart-meet-admin-state'
    const { data, sig } = JSON.parse(Buffer.from(encodedState, 'base64url').toString('utf-8'))
    const expected = createHmac('sha256', secret).update(data).digest('hex')
    if (expected !== sig) {
      // Also try legacy secret in case request started from old route
      const fallbackSecret = process.env.ADMIN_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'helpamart-admin-state'
      const fallbackExpected = createHmac('sha256', fallbackSecret).update(data).digest('hex')
      if (fallbackExpected !== sig) return false
    }
    const payload = JSON.parse(data) as { issued: number }
    if (Date.now() - payload.issued > 15 * 60 * 1000) return false // 15 min TTL
    return true
  } catch {
    return false
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error: oauthError } = req.query as Record<string, string>

  if (oauthError) {
    console.warn('[ADMIN MEET CB] Google OAuth error:', oauthError)
    return res.status(400).send(`Google OAuth error: ${oauthError}. Please try again.`)
  }

  if (!code || !state) {
    return res.status(400).send('Missing authorization code or state parameter.')
  }

  if (!verifyState(state)) {
    console.error('[ADMIN MEET CB] State verification failed')
    return res.status(403).send('Security check failed. The authorization request may have expired. Please start again from /admin/meet.')
  }

  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).send('Google credentials not configured on this server.')
  }

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).send('Database credentials not configured on this server.')
  }

  try {
    const redirectUri = getRedirectUri()
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri,
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    if (!tokens.refresh_token && !tokens.access_token) {
      return res.status(400).send(
        'Google did not return tokens. Revoke access at https://myaccount.google.com/permissions and authorize again.',
      )
    }

    // Fetch account email for audit display
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const accountEmail = userInfo.email || null

    const db = adminSupabase()
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    const now = new Date().toISOString()

    const upsertPayload: Record<string, unknown> = {
      key: 'helpamart_meet',
      provider: 'google',
      account_email: accountEmail,
      access_token: tokens.access_token ?? null,
      expiry,
      status: 'connected',
      updated_at: now,
    }
    if (tokens.refresh_token) {
      upsertPayload.refresh_token = tokens.refresh_token
    }

    // Upsert primary key 'helpamart_meet'
    const { error: upsertErr1 } = await db
      .from('google_service_connections')
      .upsert(upsertPayload, { onConflict: 'key' })

    if (upsertErr1) {
      console.error('[ADMIN MEET CB] DB upsert failed:', upsertErr1.message)
      return res.status(500).send(`Failed to store connection in DB: ${upsertErr1.message}`)
    }

    // Also update 'helpamart_organizer' for compatibility
    try {
      await db
        .from('google_service_connections')
        .upsert({ ...upsertPayload, key: 'helpamart_organizer' }, { onConflict: 'key' })
    } catch {
      // Non-fatal
    }

    console.log(`[ADMIN MEET CB] Central HELPAMART Google Meet successfully connected: ${accountEmail}`)

    // Redirect to the Admin UI with success indication
    return res.redirect(302, `${APP_URL}/admin/meet?status=connected&email=${encodeURIComponent(accountEmail || '')}`)
  } catch (err: any) {
    console.error('[ADMIN MEET CB] Unexpected error:', err?.message)
    return res.status(500).send('Authorization failed. Check server logs for details.')
  }
}
