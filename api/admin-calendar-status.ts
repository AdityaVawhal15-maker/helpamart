/**
 * HELPAMART — GET /api/admin-calendar-status
 *
 * Safe admin diagnostic: verifies whether the central HELPAMART Google
 * Calendar connection is present and usable, without exposing any token.
 *
 * Protected by Authorization: Bearer <ADMIN_SECRET> header.
 *
 * Response (safe — no credentials):
 *   { configured: true,  accountEmail: "calendar@helpamart.com", source: "db" }
 *   { configured: false, reason: "no_token" }
 *   { configured: false, reason: "token_invalid", detail: "..." }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

function verifyAdmin(req: VercelRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET
  if (!adminSecret) return false
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim() === adminSecret
  }
  return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only.' })
  if (!verifyAdmin(req)) return res.status(403).json({ error: 'Forbidden.' })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.json({ configured: false, reason: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not set' })
  }

  // Try DB first
  let refreshToken: string | null = null
  let source: string = 'none'
  let accountEmail: string | null = null

  try {
    const db = adminSupabase()
    const { data: conn } = await db
      .from('google_service_connections')
      .select('refresh_token, status, account_email')
      .eq('key', 'helpamart_organizer')
      .maybeSingle()

    if (conn?.status === 'connected' && conn.refresh_token) {
      refreshToken = conn.refresh_token
      accountEmail = conn.account_email ?? null
      source = 'db'
    }
  } catch (e: any) {
    return res.json({ configured: false, reason: 'db_error', detail: e?.message })
  }

  // Env var fallback
  if (!refreshToken) {
    const envToken = process.env.HELPAMART_GOOGLE_REFRESH_TOKEN
    if (envToken) {
      refreshToken = envToken
      source = 'env_var'
    }
  }

  if (!refreshToken) {
    return res.json({
      configured: false,
      reason: 'no_token',
      detail: 'No central Google account found. Run /api/admin-calendar-connect to authorise.',
    })
  }

  // Test the token by attempting to get a fresh access token
  try {
    const oauth2 = new google.auth.OAuth2(clientId, clientSecret)
    oauth2.setCredentials({ refresh_token: refreshToken })
    await oauth2.getAccessToken()
    return res.json({ configured: true, accountEmail, source })
  } catch (e: any) {
    return res.json({
      configured: false,
      reason: 'token_invalid',
      detail: e?.message || 'Could not refresh token — the authorisation may have been revoked.',
      source,
    })
  }
}
