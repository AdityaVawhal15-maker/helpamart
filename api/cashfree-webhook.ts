/**
 * HELPAMART — POST /api/cashfree-webhook
 *
 * Vercel serverless function (Node.js runtime).
 * Cashfree webhook endpoint for payment notifications.
 *
 * Cashfree sends:
 * - order_id: Cashfree order ID
 * - order_status: PAID, FAILED, CANCELLED, etc.
 * - event_time: Timestamp of the event
 *
 * This endpoint:
 * 1. Verifies the webhook signature
 * 2. Updates booking payment status
 * 3. Confirms booking if payment successful
 * 4. Does NOT confirm booking if payment failed
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

// ─── Supabase admin client (service-role — server only) ──────────────────────
function adminSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Verify Cashfree webhook signature ────────────────────────────────────────
function verifyCashfreeSignature(
  rawBody: string,
  signature: string | undefined,
): boolean {
  const secretKey = process.env.CASHFREE_WEBHOOK_SECRET || process.env.CASHFREE_SECRET_KEY
  if (!secretKey || !signature) return false

  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(rawBody)
    .digest('base64')

  return computed === signature
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  console.log('[CASHFREE-WEBHOOK] Received webhook event')

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
    const signature = req.headers['x-webhook-signature']

    // Verify webhook signature
    if (!verifyCashfreeSignature(rawBody, signature as string)) {
      console.warn('[CASHFREE-WEBHOOK] Signature verification failed')
      return res.status(403).json({ error: 'Invalid signature.' })
    }

    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body

    const orderId = event.data?.order?.order_id || event.data?.order_id || event.order_id
    const orderStatus = event.data?.order?.order_status || event.data?.status || event.order_status
    const eventType = event.type || event.event
    console.log('[CASHFREE-WEBHOOK] Event type:', eventType)

    if (!orderId || !orderStatus) {
      console.warn('[CASHFREE-WEBHOOK] Missing orderId or orderStatus', { orderId, orderStatus })
      return res.status(400).json({ error: 'Invalid event data.' })
    }

    console.log('[CASHFREE-WEBHOOK] Processing order:', orderId, 'status:', orderStatus)

    const db = adminSupabase()

    // Find booking by Cashfree order ID
    const { data: booking, error: bookingErr } = await db
      .from('bookings')
      .select('id, mentee_id, payment_status, status, meet_link')
      .eq('cashfree_order_id', orderId)
      .maybeSingle()

    if (bookingErr) {
      console.error('[CASHFREE-WEBHOOK] Booking lookup failed:', bookingErr.message)
      return res.status(500).json({ error: 'Database error.' })
    }

    if (!booking) {
      console.warn('[CASHFREE-WEBHOOK] Booking not found for order:', orderId)
      return res.status(200).json({ received: true }) // Still return 200 to acknowledge webhook
    }

    // Update booking based on payment status
    let newPaymentStatus = 'pending'
    let newBookingStatus = booking.status

    if (orderStatus === 'PAID' || orderStatus === 'SETTLED') {
      newPaymentStatus = 'completed'
      newBookingStatus = 'confirmed' // Confirm booking after successful payment
      console.log('[CASHFREE-WEBHOOK] Payment successful for booking:', booking.id)
    } else if (orderStatus === 'FAILED' || orderStatus === 'CANCELLED' || orderStatus === 'EXPIRED') {
      newPaymentStatus = 'failed'
      newBookingStatus = 'cancelled' // Cancel booking if payment failed
      console.log('[CASHFREE-WEBHOOK] Payment failed for booking:', booking.id, 'reason:', orderStatus)
    }

    // Update booking payment status
    const { error: updateErr } = await db
      .from('bookings')
      .update({
        payment_status: newPaymentStatus,
        status: newBookingStatus,
        paid_at: newPaymentStatus === 'completed' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', booking.id)

    if (updateErr) {
      console.error('[CASHFREE-WEBHOOK] Booking update failed:', updateErr.message)
      return res.status(500).json({ error: 'Could not update booking.' })
    }

    console.log('[CASHFREE-WEBHOOK] Booking updated:', booking.id, 'payment_status:', newPaymentStatus, 'status:', newBookingStatus)
    return res.status(200).json({ received: true, bookingId: booking.id, newStatus: newBookingStatus })
  } catch (err: any) {
    console.error('[CASHFREE-WEBHOOK] Unhandled error:', err.message)
    return res.status(500).json({ error: 'Webhook processing failed.' })
  }
}
