/**
 * HELPAMART — GET /api/admin-meet-status
 *
 * Verifies whether the central HELPAMART Google Meet connection is present
 * and usable, without exposing any token or secret.
 *
 * Safe for frontend consumption by the /admin/meet page.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', APP_URL)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET only.' })

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.json({ configured: false, reason: 'GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured in Vercel' })
  }

  let refreshToken: string | null = null
  let source = 'none'
  let accountEmail: string | null = null

  try {
    const db = adminSupabase()
    const { data: conn } = await db
      .from('google_service_connections')
      .select('refresh_token, status, account_email')
      .in('key', ['helpamart_meet', 'helpamart_organizer'])
      .eq('status', 'connected')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (conn?.status === 'connected' && conn.refresh_token) {
      refreshToken = conn.refresh_token
      accountEmail = conn.account_email ?? null
      source = 'db'
    }
  } catch (e: any) {
    return res.json({ configured: false, reason: 'db_lookup_error', detail: e?.message })
  }

  if (!refreshToken) {
    const envToken = process.env.GOOGLE_MEET_REFRESH_TOKEN || process.env.HELPAMART_GOOGLE_REFRESH_TOKEN
    if (envToken) {
      refreshToken = envToken
      source = 'env_var'
    }
  }

  if (!refreshToken) {
    return res.json({
      configured: false,
      reason: 'no_token',
      detail: 'No central Google Meet account authorized yet. Click "Connect HELPAMART Google Meet" to connect.',
    })
  }

  // Validate the token by refreshing an access token from Google
  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!tokenRes.ok) {
      return res.json({
        configured: false,
        reason: 'token_invalid',
        detail: `Google token refresh rejected (${tokenRes.status}). Re-authorization is required.`,
        source,
      })
    }

    return res.json({
      configured: true,
      accountEmail: accountEmail || 'Connected Account',
      source,
    })
  } catch (e: any) {
    return res.json({
      configured: false,
      reason: 'verification_failed',
      detail: e?.message || 'Could not verify token with Google.',
      source,
    })
  }
}
