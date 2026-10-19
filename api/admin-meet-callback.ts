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

    const db = adminSupabase()
    let refreshTokenToSave = tokens.refresh_token || null

    if (!refreshTokenToSave) {
      // Check if existing DB connection has a working refresh token
      const { data: existingConn } = await db
        .from('google_service_connections')
        .select('refresh_token, status')
        .eq('key', 'helpamart_meet')
        .maybeSingle()

      if (existingConn?.refresh_token) {
        try {
          const testRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.GOOGLE_CLIENT_ID!,
              client_secret: process.env.GOOGLE_CLIENT_SECRET!,
              refresh_token: existingConn.refresh_token,
              grant_type: 'refresh_token',
            }),
          })
          if (testRes.ok) {
            refreshTokenToSave = existingConn.refresh_token
          }
        } catch {
          // Token test failed
        }
      }
    }

    if (!refreshTokenToSave) {
      console.error('[ADMIN MEET CB] Google did not return a refresh token and no valid refresh token exists in DB')
      return res.status(400).send(
        'Google did not return a refresh token. To obtain a new refresh token, please visit https://myaccount.google.com/permissions, remove access for HELPAMART, and then reconnect from /admin/meet.',
      )
    }

    // Fetch account email for audit display
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const accountEmail = userInfo.email || null

    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    const now = new Date().toISOString()

    const upsertPayload: Record<string, unknown> = {
      key: 'helpamart_meet',
      provider: 'google',
      account_email: accountEmail,
      access_token: tokens.access_token ?? null,
      refresh_token: refreshTokenToSave,
      expiry,
      status: 'connected',
      updated_at: now,
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
