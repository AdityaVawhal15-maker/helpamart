/**
 * HELPAMART — GET /api/calendar-callback
 *
 * Handles Google Calendar OAuth redirect after user grants consent.
 * Stores access_token + refresh_token in public.calendar_connections
 * (server-side only — tokens never reach the browser).
 * Redirects mentor back to their dashboard on success or error.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { code, state, error: oauthError } = req.query as Record<string, string>

  if (oauthError) {
    console.warn('[CALENDAR CB] OAuth error from Google:', oauthError)
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=denied`)
  }

  if (!code || !state) {
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
  }

  let userId: string
  try {
    const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'))
    userId = decoded.userId
    if (!userId) throw new Error('missing userId in state')
  } catch {
    console.error('[CALENDAR CB] Invalid state param')
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
  }

  try {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
        `${APP_URL}/api/calendar-callback`,
    )

    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Fetch account email
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()
    const accountEmail = userInfo.email || null

    const db = adminSupabase()
    const expiry = tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null

    // Upsert so re-authorising updates existing row
    const { error: upsertErr } = await db.from('calendar_connections').upsert(
      {
        user_id: userId,
        provider: 'google',
        access_token: tokens.access_token || null,
        refresh_token: tokens.refresh_token || null,
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

    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=connected`)
  } catch (err) {
    console.error('[CALENDAR CB] Token exchange failed:', err)
    return res.redirect(302, `${APP_URL}/mentor-dashboard?calendar=error`)
  }
}
