/**
 * HELPAMART — POST /api/cashfree-verify-payment
 *
 * Vercel serverless function (Node.js runtime).
 * Verifies payment status with Cashfree Live API after payment attempt.
 *
 * Called by frontend after Cashfree redirect to /booking-payment-result.
 * Uses Live/Production Cashfree credentials to verify authoritative payment status.
 *
 * Input:
 *   - orderId: Cashfree order ID from query string
 *   - Authorization: Bearer token (Supabase JWT)
 *
 * Output:
 *   - paymentStatus: 'completed' | 'failed' | 'pending'
 *   - bookingId: Associated booking ID (if found)
 *   - mentorName, serviceTitle, startAt, endAt, timezone (if paid and verified)
 *   - error: Human-readable error message
 *
 * Safeguards:
 * - Verifies JWT from Supabase
 * - Queries Cashfree Live API with Live credentials
 * - Matches order to correct booking and user
 * - Updates booking status only after verification
 * - Prevents duplicate finalization via idempotency
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// ─── Supabase admin client (service-role — server only) ──────────────────────
function adminSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Verify JWT ───────────────────────────────────────────────────────────────
async function verifyJwt(authHeader: string | undefined): Promise<string> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) {
    console.error('[VERIFY-PAYMENT] Missing authorization header')
    throw new Error('Not authenticated.')
  }

  const url = process.env.SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  if (!url) {
    console.error('[VERIFY-PAYMENT] SUPABASE_URL not configured')
    throw new Error('Payment service misconfigured.')
  }

  if (!anonKey) {
    console.error('[VERIFY-PAYMENT] SUPABASE_ANON_KEY not configured')
    throw new Error('Payment service misconfigured.')
  }

  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })

    if (!res.ok) {
      const errorText = await res.text()
      console.error('[VERIFY-PAYMENT] Supabase auth failed:', res.status, errorText.slice(0, 200))
      throw new Error('Session expired or invalid.')
    }

    const user = await res.json() as { id?: string }
    if (!user?.id) {
      console.error('[VERIFY-PAYMENT] No user ID in Supabase response')
      throw new Error('Could not identify user.')
    }

    console.log('[VERIFY-PAYMENT] JWT verified for user:', user.id)
    return user.id
  } catch (err: any) {
    console.error('[VERIFY-PAYMENT] JWT verification error:', err.message)
    throw err
  }
}

// ─── Verify payment with Cashfree Live API ────────────────────────────────────
async function verifyCashfreePayment(orderId: string): Promise<{
  status: string
  amount: number
  currency: string
  paymentMethod?: string
}> {
  const appId = process.env.CASHFREE_APP_ID
  const secretKey = process.env.CASHFREE_SECRET_KEY

  if (!appId || !secretKey) {
    throw new Error('Cashfree credentials not configured.')
  }

  // Use Live API endpoint (Production)
  const url = `https://api.cashfree.com/pg/orders/${orderId}/payments`

  console.log('[VERIFY-PAYMENT] Querying Cashfree Live API:', url.split('/').slice(0, -2).join('/'))

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'x-api-version': '2025-01-01',
      'x-client-id': appId,
      'x-client-secret': secretKey,
    },
  })

  const data = await res.json() as any

  if (!res.ok) {
    const errorMsg = data?.message || data?.error || 'Payment verification failed'
    console.error('[VERIFY-PAYMENT] Cashfree API error:', res.status, errorMsg)
    throw new Error(errorMsg)
  }

  // Check if payments array exists and has at least one payment
  if (!data.payments || data.payments.length === 0) {
    console.warn('[VERIFY-PAYMENT] No payments found for order:', orderId)
    return { status: 'pending', amount: 0, currency: 'INR' }
  }

  // Get the most recent payment (first in array)
  const payment = data.payments[0]

  console.log('[VERIFY-PAYMENT] Payment raw status:', payment.payment_status, 'Amount:', payment.amount)
  console.log('[VERIFY-PAYMENT] Payment ID:', payment.cf_payment_id || 'unknown')
  console.log('[VERIFY-PAYMENT] Total payments in order:', data.payments.length)

  return {
    status: payment.payment_status || 'pending',
    amount: payment.amount || 0,
    currency: payment.cf_payment_method?.payment_currency || 'INR',
    paymentMethod: payment.payment_method,
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  console.log('[VERIFY-PAYMENT] Request received')

  try {
    let userId: string
    try {
      userId = await verifyJwt(req.headers.authorization)
    } catch (authErr: any) {
      console.error('[VERIFY-PAYMENT] Authentication failed:', authErr.message)
      return res.status(401).json({ error: authErr.message || 'Authentication failed.' })
    }

    const db = adminSupabase()

    const { orderId } = req.body as { orderId?: string }

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required.' })
    }

    console.log('[VERIFY-PAYMENT] Verifying payment for order:', orderId, 'user:', userId)

    // Find booking by Cashfree order ID
    const { data: booking, error: bookingErr } = await db
      .from('bookings')
      .select(
        'id, mentee_id, mentor_id, cashfree_order_id, payment_status, status, meet_link, service_title, start_at, end_at, timezone',
      )
      .eq('cashfree_order_id', orderId)
      .maybeSingle()

    if (bookingErr) {
      console.error('[VERIFY-PAYMENT] Booking lookup failed:', bookingErr.message)
      return res.status(500).json({ error: 'Database error.' })
    }

    if (!booking) {
      console.warn('[VERIFY-PAYMENT] Booking not found for order:', orderId)
      return res.status(404).json({ error: 'Booking not found for this order.' })
    }

    // Verify user owns this booking
    if (booking.mentee_id !== userId) {
      console.warn('[VERIFY-PAYMENT] Unauthorized access attempt to booking:', booking.id)
      return res.status(403).json({ error: 'Unauthorized.' })
    }

    // Check Cashfree for payment status
    console.log('[VERIFY-PAYMENT] Checking Cashfree for payment status...')
    const paymentInfo = await verifyCashfreePayment(orderId)

    // Map Cashfree status to our payment status
    let paymentStatus = 'pending'
    const cfStatus = paymentInfo.status ? paymentInfo.status.toUpperCase() : ''
    if (cfStatus === 'SUCCESS' || cfStatus === 'SETTLED') {
      paymentStatus = 'completed'
    } else if (
      cfStatus === 'FAILED' ||
      cfStatus === 'CANCELLED' ||
      cfStatus === 'USER_DROPPED'
    ) {
      paymentStatus = 'failed'
    }

    console.log('[VERIFY-PAYMENT] Cashfree status:', paymentInfo.status, '→ paymentStatus:', paymentStatus)

    // If payment is verified as completed, update booking status
    if (paymentStatus === 'completed' && booking.payment_status !== 'completed') {
      console.log('[VERIFY-PAYMENT] Updating booking to confirmed:', booking.id)

      const { error: updateErr } = await db
        .from('bookings')
        .update({
          payment_status: 'completed',
          status: 'confirmed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', booking.id)

      if (updateErr) {
        console.error('[VERIFY-PAYMENT] Failed to update booking:', updateErr.message)
        // Don't fail the verification if update fails; frontend will retry
      }
    } else if (paymentStatus === 'failed' && booking.status !== 'cancelled') {
      // Mark booking as cancelled if payment failed
      console.log('[VERIFY-PAYMENT] Marking booking as cancelled due to failed payment:', booking.id)

      try {
        await db
          .from('bookings')
          .update({
            payment_status: 'failed',
            status: 'cancelled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', booking.id)
        console.log('[VERIFY-PAYMENT] Booking cancelled due to failed payment')
      } catch (err: any) {
        console.error('[VERIFY-PAYMENT] Failed to cancel booking:', err?.message)
      }
    }

    // Get mentor details for response
    const { data: mentor } = await db
      .from('mentors')
      .select('name')
      .eq('id', booking.mentor_id)
      .maybeSingle()

    return res.status(200).json({
      paymentStatus,
      bookingId: booking.id,
      orderId,
      mentorName: mentor?.name || 'Mentor',
      serviceTitle: booking.service_title || 'Mentorship Session',
      startAt: booking.start_at,
      endAt: booking.end_at,
      timezone: booking.timezone,
      meetLink: booking.meet_link || null,
      amount: paymentInfo.amount,
      currency: paymentInfo.currency,
      error:
        paymentStatus === 'failed'
          ? 'Payment was not successful. Please try again.'
          : paymentStatus === 'pending'
            ? 'Payment is still being processed. Please check back shortly.'
            : undefined,
    })
  } catch (err: any) {
    const msg = err?.message || 'Payment verification failed'
    console.error('[VERIFY-PAYMENT] Error:', msg)
    return res.status(500).json({ error: msg })
  }
}
