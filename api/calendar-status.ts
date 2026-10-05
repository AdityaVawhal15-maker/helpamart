/**
 * HELPAMART — GET /api/calendar-status
 *
 * Returns the Google Calendar connection status for the currently authenticated mentor.
 *
 * Security: derives user identity from the Supabase Bearer JWT in the
 * Authorization header — never from a query param.
 *
 * Uses the service-role key to bypass RLS, so the result is always
 * authoritative regardless of any RLS race conditions on the anon client.
 *
 * Response:
 *   { connected: true,  status: 'connected',    accountEmail: '...' }
 *   { connected: false, status: 'disconnected', accountEmail: null  }
 *   { connected: false, status: 'error',         accountEmail: null  }  (connection exists but needs renewal)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

function adminSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

async function verifyJwt(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
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

const APP_URL = process.env.APP_URL || 'https://www.helpamart.com'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS — allow requests from the frontend origin
  res.setHeader('Access-Control-Allow-Origin', APP_URL)
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' })

  const userId = await verifyJwt(req.headers.authorization)
  if (!userId) {
    return res.status(401).json({ error: 'Not authenticated.' })
  }

  try {
    const db = adminSupabase()

    // Service role bypasses RLS — this is always authoritative
    const { data: conn, error } = await db
      .from('calendar_connections')
      .select('status, account_email')
      .eq('user_id', userId)
      .maybeSingle()

    if (error) {
      console.error('[CALENDAR STATUS] DB error for user', userId, ':', error.message)
      return res.status(500).json({ error: 'Could not check calendar status.' })
    }

    if (!conn) {
      return res.json({ connected: false, status: 'disconnected', accountEmail: null })
    }

    return res.json({
      connected: conn.status === 'connected',
      status: conn.status,
      accountEmail: conn.account_email ?? null,
    })
  } catch (err: any) {
    console.error('[CALENDAR STATUS] Unexpected error:', err?.message)
    return res.status(500).json({ error: 'Could not check calendar status.' })
  }
}
