/**
 * HELPAMART — GET /api/calendar-connect
 *
 * Initiates Google Calendar OAuth for the authenticated mentor.
 *
 * Security model:
 *   - Requires a valid Supabase Bearer JWT in the Authorization header
 *     (or as ?token= for redirect-based flows from the frontend).
 *   - The verified Supabase user ID is embedded in a HMAC-signed state param
 *     so the callback cannot be forged.
 *   - Redirects to Google's consent screen requesting Calendar write scope.
 *
 * Production redirect URI must be registered in Google Cloud Console:
 *   https://www.helpamart.com/api/calendar-callback
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { createHmac, randomBytes } from 'crypto'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'

// ─── Verify Supabase JWT (reused from book.ts) ────────────────────────────────
async function getAuthenticatedUserId(req: VercelRequest): Promise<string | null> {
  // Accept token from Authorization header OR ?token= query param
  // (The query param is needed because this route is hit via window.location.href redirect,
  //  not a fetch() call, so custom headers can't be set.)
  const authHeader = req.headers.authorization
  const token =
    (authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null) ||
    (req.query.token as string | undefined) ||
    null

  if (!token) return null

  const url = process.env.SUPABASE_URL!
  const anonKey = process.env.SUPABASE_ANON_KEY || ''

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return null
    const user = await res.json() as { id?: string }
    return user?.id || null
  } catch {
    return null
  }
}

// ─── HMAC-sign the OAuth state ────────────────────────────────────────────────
function signState(payload: object): string {
  const secret = process.env.CALENDAR_STATE_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'helpamart-state-secret'
  const nonce = randomBytes(16).toString('hex')
  const data = JSON.stringify({ ...payload, nonce })
  const sig = createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(501).json({
      error: 'Google Calendar is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel environment variables.',
    })
  }

  // Verify the caller is a real authenticated HELPAMART user
  const userId = await getAuthenticatedUserId(req)
  if (!userId) {
    // If no token was provided at all, redirect to login
    const noToken = !req.headers.authorization && !req.query.token
    if (noToken) {
      return res.redirect(302, `${APP_URL}/login?next=/mentor-dashboard`)
    }
    return res.status(401).json({ error: 'Session expired. Please sign in again.' })
  }

  const redirectUri =
    process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
    `${APP_URL}/api/calendar-callback`

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri,
  )

  // Sign the state so the callback can verify it wasn't forged
  const state = signState({ userId })

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',   // always show consent screen to guarantee refresh_token is returned
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state,
  })

  return res.redirect(302, authUrl)
}
