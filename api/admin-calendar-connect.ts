/**
 * HELPAMART — GET /api/admin-calendar-connect
 *
 * ONE-TIME admin endpoint to authorise the central HELPAMART Google account
 * for Calendar/Meet event creation.
 *
 * SECURITY MODEL:
 *   - Caller must supply the ADMIN_SECRET in the Authorization header:
 *       Authorization: Bearer <ADMIN_SECRET>
 *     OR as a one-time signed token in the URL:
 *       ?token=<HMAC-signed-token>
 *     The raw ADMIN_SECRET is NEVER placed in a plain URL query param so it
 *     cannot appear in server logs, browser history, or Referer headers.
 *
 *   - The OAuth state param carries a short-lived (10-minute) HMAC-signed
 *     nonce so the callback can confirm the request came from this server
 *     rather than a forged redirect.
 *
 * USAGE (run once after deploy):
 *   Option A — Authorization header (e.g. via curl or Postman):
 *     curl -L -H "Authorization: Bearer <ADMIN_SECRET>" \
 *       https://www.helpamart.com/api/admin-calendar-connect
 *
 *   Option B — Signed URL token (safe for browser, expires in 10 minutes):
 *     1. Generate a signed token server-side:
 *        node -e "const c=require('crypto');const s=process.env.ADMIN_SECRET;
 *          const exp=Date.now()+600000;const d=JSON.stringify({exp});
 *          const sig=c.createHmac('sha256',s).update(d).digest('hex');
 *          console.log(Buffer.from(JSON.stringify({d,sig})).toString('base64url'))"
 *     2. Visit: https://www.helpamart.com/api/admin-calendar-connect?token=<signed-token>
 *
 *   After authorisation the callback stores the refresh token in the
 *   google_service_connections table (service-role only, never shown in browser).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { google } from 'googleapis'
import { createHmac, randomBytes } from 'crypto'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'
const REDIRECT_URI = `${APP_URL}/api/admin-calendar-callback`

// ─── Verify admin identity ────────────────────────────────────────────────────
function verifyAdmin(req: VercelRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false

  // Option A: Bearer token in Authorization header (preferred — never in URL)
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() === adminSecret
  }

  // Option B: Short-lived HMAC-signed URL token (expires 10 min, single nonce)
  const urlToken = req.query.token as string | undefined
  if (urlToken) {
    try {
      const { d, sig } = JSON.parse(Buffer.from(urlToken, 'base64url').toString('utf-8'))
      const expected = createHmac('sha256', adminSecret).update(d).digest('hex')
      if (expected !== sig) return false
      const payload = JSON.parse(d) as { exp: number }
      if (Date.now() > payload.exp) return false // expired
      return true
    } catch {
      return false
    }
  }

  return false
}

// ─── HMAC-sign the OAuth state ────────────────────────────────────────────────
function buildState(): string {
  const secret = process.env.ADMIN_SECRET || process.env.GOOGLE_CLIENT_SECRET || 'helpamart-admin-state'
  const nonce = randomBytes(16).toString('hex')
  const issued = Date.now()
  const data = JSON.stringify({ nonce, issued })
  const sig = createHmac('sha256', secret).update(data).digest('hex')
  return Buffer.from(JSON.stringify({ data, sig })).toString('base64url')
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!verifyAdmin(req)) {
    // Return 403 without revealing whether ADMIN_SECRET is set
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
    prompt: 'consent', // always request refresh_token
    scope: [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
    ],
    state: buildState(),
  })

  return res.redirect(302, authUrl)
}
