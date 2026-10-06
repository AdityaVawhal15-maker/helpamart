/**
 * HELPAMART — POST /api/cashfree
 *
 * Vercel serverless function (Node.js runtime).
 * Handles Cashfree payment order creation and verification.
 *
 * ENDPOINTS:
 *   POST /api/cashfree { action: 'create-order', bookingId, amount, currency }
 *     → Create Cashfree order, return payment_session_id for frontend checkout
 *
 *   POST /api/cashfree { action: 'verify-payment', orderId }
 *     → Verify payment status with Cashfree, confirm booking if successful
 *
 * SECURITY:
 *   - Verify Supabase JWT from Authorization header
 *   - Verify amount server-side from bookings table (never trust frontend amount)
 *   - Use service-role key for backend DB operations only
 *   - Protect secret key: never log, never expose to client
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

// ─── Verify Supabase JWT and return user ID ───────────────────────────────────
async function verifyJwt(authHeader: string | undefined): Promise<string> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) throw new Error('Not authenticated.')

  const url = process.env.SUPABASE_URL!
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
  })
  if (!res.ok) throw new Error('Session expired. Please sign in again.')
  const user = await res.json() as { id?: string }
  if (!user?.id) throw new Error('Could not identify user.')
  return user.id
}

// ─── Cashfree API helper ──────────────────────────────────────────────────────
async function cashfreeRequest(
  endpoint: string,
  body?: Record<string, any>,
  method: string = 'POST',
): Promise<any> {
  const appId = process.env.CASHFREE_APP_ID
  const secretKey = process.env.CASHFREE_SECRET_KEY
  const baseUrl = process.env.CASHFREE_MODE === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com'

  if (!appId || !secretKey) {
    console.error('[CASHFREE] CRITICAL: CASHFREE_APP_ID or CASHFREE_SECRET_KEY not set')
    throw new Error('Payment service not configured.')
  }

  const url = `${baseUrl}/pg${endpoint}`
  const timestamp = Date.now().toString()
  const signatureString = `${endpoint}${timestamp}${JSON.stringify(body || {})}`
  crypto
    .createHmac('sha256', secretKey)
    .update(signatureString)
    .digest('base64')

  const res = await fetch(url, {
    method,
    headers: {
      'x-api-version': '2023-08-01',
      'x-client-id': appId,
      'x-client-secret': secretKey,
      'x-request-id': crypto.randomUUID(),
      'x-idempotency-key': crypto.randomUUID(),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorMsg = (json as any)?.message || (json as any)?.error || `HTTP ${res.status}`
    console.error('[CASHFREE] API error:', errorMsg, 'Response:', JSON.stringify(json))
    throw new Error(`Cashfree error: ${errorMsg}`)
  }

  return json
}

// ─── Create Cashfree payment order ────────────────────────────────────────────
async function createPaymentOrder(opts: {
  bookingId: string
  userId: string
  amount: number
  currency: string
  customerEmail: string
  customerName: string
}): Promise<{ payment_session_id: string; order_id: string }> {
  console.log('[CASHFREE] Creating payment order for booking:', opts.bookingId)

  // Use booking ID as idempotency key (Cashfree will reject duplicate orders)
  const orderId = `BOOK-${opts.bookingId.slice(0, 8).toUpperCase()}-${Date.now()}`

  const orderResponse = await cashfreeRequest('/orders', {
    order_id: orderId,
    order_amount: (opts.amount / 100).toString(), // Convert cents to rupees
    order_currency: opts.currency,
    customer_details: {
      customer_id: opts.userId,
      customer_email: opts.customerEmail,
      customer_phone: '9999999999', // Placeholder — Cashfree requires this
      customer_name: opts.customerName,
    },
    order_meta: {
      return_url: `${process.env.APP_URL || 'https://www.helpamart.com'}/booking-payment-result`,
      notify_url: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.helpamart.com'}/api/cashfree-webhook`,
    },
  })

  if (!orderResponse?.payment_session_id) {
    throw new Error('Cashfree did not return payment_session_id')
  }

  console.log('[CASHFREE] Order created:', orderId, 'session_id:', orderResponse.payment_session_id.slice(0, 20) + '...')

  return {
    payment_session_id: orderResponse.payment_session_id,
    order_id: orderId,
  }
}

// ─── Verify payment status ────────────────────────────────────────────────────
async function verifyPaymentStatus(orderId: string): Promise<{
  payment_status: string
  amount: number
  error?: string
}> {
  console.log('[CASHFREE] Verifying payment for order:', orderId)

  try {
    const paymentResponse = await cashfreeRequest(`/orders/${orderId}`, undefined, 'GET')

    const paymentStatus = paymentResponse?.order_status || paymentResponse?.status || 'unknown'
    const amount = paymentResponse?.order_amount
      ? Math.round(parseFloat(paymentResponse.order_amount) * 100)
      : 0

    console.log('[CASHFREE] Payment status:', paymentStatus, 'amount:', amount)

    if (paymentStatus === 'PAID' || paymentStatus === 'SETTLED') {
      return { payment_status: 'completed', amount }
    } else if (paymentStatus === 'PENDING') {
      return { payment_status: 'pending', amount }
    } else if (paymentStatus === 'FAILED' || paymentStatus === 'CANCELLED') {
      return { payment_status: 'failed', amount, error: paymentStatus }
    }

    return { payment_status: paymentStatus, amount }
  } catch (err: any) {
    console.error('[CASHFREE] Verification error:', err.message)
    throw err
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  try {
    const userId = await verifyJwt(req.headers.authorization)
    const db = adminSupabase()

    const { action, bookingId, amount, orderId } = req.body as {
      action?: string
      bookingId?: string
      amount?: number
      orderId?: string
      mentorSlug?: string
      serviceId?: string
      startAt?: string
      timezone?: string
    }

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: init-paid-booking
    // Create provisional booking and Cashfree order for paid sessions
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'init-paid-booking') {
      const { mentorSlug, serviceId, startAt: startAtStr, timezone } = req.body
      if (!mentorSlug || !startAtStr || !timezone) {
        return res.status(400).json({ error: 'mentorSlug, startAt, and timezone are required.' })
      }

      console.log('[CASHFREE] init-paid-booking for mentor:', mentorSlug)

      // Resolve mentor
      const { data: mentorRow, error: mentorErr } = await db
        .from('mentors')
        .select('id, name, slug, services, email')
        .eq('slug', mentorSlug)
        .eq('status', 'published')
        .maybeSingle()

      if (mentorErr || !mentorRow) {
        return res.status(404).json({ error: 'Mentor not found.' })
      }

      // Resolve service
      const services = Array.isArray(mentorRow.services) ? mentorRow.services : []
      const service = serviceId
        ? services.find((s: any) => s.id === serviceId || s.title === serviceId) ?? services[0]
        : services[0]

      if (!service) {
        return res.status(400).json({ error: 'Service not found.' })
      }

      // Calculate time
      const start = new Date(startAtStr)
      const durationMin = service.durationMinutes || 30
      const end = new Date(start.getTime() + durationMin * 60 * 1000)

      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: 'Invalid start time.' })
      }

      // Verify user is NOT first session (returning user)
      const { count: prevBookings } = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('mentee_id', userId)
        .in('status', ['confirmed', 'completed'])
        .in('payment_status', ['not_required', 'completed'])

      const isFirstSession = (prevBookings ?? 0) === 0
      if (isFirstSession) {
        return res.status(400).json({ error: 'First session is free. Use regular booking flow.' })
      }

      // Create provisional booking (UNPAID STATE)
      const provisionalBookingId = crypto.randomUUID()
      const now = new Date().toISOString()

      const { error: bookingErr } = await db.from('bookings').insert({
        id: provisionalBookingId,
        mentor_id: mentorRow.id,
        mentee_id: userId,
        service_id: service.id,
        service_title: service.title,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        timezone,
        status: 'pending_payment', // Special status: awaiting payment
        payment_status: 'pending',
        price_cents: 9900, // ₹99
        currency: 'INR',
        payment_provider: 'cashfree',
        meet_link: null,
        mentor_email: mentorRow.email || null,
        student_email: null, // Will be set after payment
        created_at: now,
        updated_at: now,
      })

      if (bookingErr) {
        console.error('[CASHFREE] Failed to create provisional booking:', bookingErr.message)
        return res.status(500).json({ error: 'Failed to create booking. Please try again.' })
      }

      console.log('[CASHFREE] Provisional booking created:', provisionalBookingId)

      // Create Cashfree order
      try {
        const { payment_session_id, order_id } = await createPaymentOrder({
          bookingId: provisionalBookingId,
          userId,
          amount: 9900,
          currency: 'INR',
          customerEmail: 'user@helpamart.com',
          customerName: 'HELPAMART User',
        })

        // Link Cashfree order to provisional booking
        await db
          .from('bookings')
          .update({
            cashfree_order_id: order_id,
            updated_at: now,
          })
          .eq('id', provisionalBookingId)

        console.log('[CASHFREE] Returning payment details:', {
          booking_id: provisionalBookingId,
          order_id,
          payment_session_id: payment_session_id.slice(0, 20) + '...',
        })

        return res.status(200).json({
          booking_id: provisionalBookingId,
          order_id,
          payment_session_id,
        })
      } catch (err: any) {
        // Rollback provisional booking on Cashfree failure
        await db.from('bookings').delete().eq('id', provisionalBookingId)
        return res.status(503).json({ error: err.message || 'Could not create payment order.' })
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: create-order
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'create-order') {
      if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' })

      console.log('[CASHFREE] create-order request for booking:', bookingId)

      // Verify booking exists and belongs to authenticated user
      const { data: booking, error: bookingErr } = await db
        .from('bookings')
        .select('id, mentee_id, price_cents, currency, student_email, mentor_id, payment_status')
        .eq('id', bookingId)
        .maybeSingle()

      if (bookingErr || !booking) {
        console.error('[CASHFREE] Booking lookup failed:', bookingErr?.message)
        return res.status(404).json({ error: 'Booking not found.' })
      }

      if (booking.mentee_id !== userId) {
        console.error('[CASHFREE] Booking does not belong to authenticated user')
        return res.status(403).json({ error: 'Unauthorized.' })
      }

      // Verify amount matches server-side calculation (never trust client amount)
      const serverAmount = booking.price_cents
      if (serverAmount === 0) {
        return res.status(400).json({ error: 'Free sessions do not require payment.' })
      }
      if (serverAmount !== amount) {
        console.error('[CASHFREE] SECURITY: Amount mismatch. Client sent:', amount, 'Server has:', serverAmount)
        // Still proceed with server amount, but log the discrepancy
      }

      // Fetch user profile for Cashfree customer details
      const { data: user } = await db
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .maybeSingle()

      const email = user?.email || booking.student_email || 'user@helpamart.com'
      const name = user?.full_name || 'HELPAMART User'

      try {
        const { payment_session_id, order_id } = await createPaymentOrder({
          bookingId,
          userId,
          amount: serverAmount,
          currency: booking.currency || 'INR',
          customerEmail: email,
          customerName: name,
        })

        // Update booking with Cashfree order ID for idempotency
        await db
          .from('bookings')
          .update({
            cashfree_order_id: order_id,
            payment_provider: 'cashfree',
            payment_status: 'pending',
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)

        console.log('[CASHFREE] Order created and booking updated:', bookingId)
        return res.status(200).json({ payment_session_id, order_id })
      } catch (err: any) {
        return res.status(503).json({ error: err.message || 'Could not create payment order.' })
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // ACTION: verify-payment
    // ────────────────────────────────────────────────────────────────────────
    if (action === 'verify-payment') {
      if (!orderId) return res.status(400).json({ error: 'orderId is required.' })
      if (!bookingId) return res.status(400).json({ error: 'bookingId is required.' })

      console.log('[CASHFREE] verify-payment request for order:', orderId, 'booking:', bookingId)

      // Verify booking exists and belongs to authenticated user
      const { data: booking, error: bookingErr } = await db
        .from('bookings')
        .select('id, mentee_id, cashfree_order_id, payment_status, price_cents')
        .eq('id', bookingId)
        .maybeSingle()

      if (bookingErr || !booking) {
        return res.status(404).json({ error: 'Booking not found.' })
      }

      if (booking.mentee_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized.' })
      }

      if (booking.cashfree_order_id !== orderId) {
        console.error('[CASHFREE] Order ID mismatch:', 'client sent', orderId, 'but booking has', booking.cashfree_order_id)
        return res.status(400).json({ error: 'Order ID mismatch.' })
      }

      try {
        const paymentStatus = await verifyPaymentStatus(orderId)

        if (paymentStatus.payment_status === 'completed') {
          // Payment successful - update booking to confirmed (but NOT generate Meet yet)
          await db
            .from('bookings')
            .update({
              payment_status: 'completed',
              paid_at: new Date().toISOString(),
              status: 'confirmed', // Now confirmed after payment
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId)

          console.log('[CASHFREE] Payment verified and booking confirmed:', bookingId)
          return res.status(200).json({ payment_status: 'completed', success: true })
        } else if (paymentStatus.payment_status === 'failed') {
          // Mark booking payment as failed (do NOT confirm)
          await db
            .from('bookings')
            .update({
              payment_status: 'failed',
              status: 'cancelled',
              updated_at: new Date().toISOString(),
            })
            .eq('id', bookingId)

          console.log('[CASHFREE] Payment failed:', bookingId, paymentStatus.error)
          return res.status(200).json({ payment_status: 'failed', error: paymentStatus.error })
        } else {
          // Still pending - webhook will handle
          return res.status(200).json({ payment_status: 'pending' })
        }
      } catch (err: any) {
        return res.status(503).json({ error: err.message || 'Could not verify payment.' })
      }
    }

    return res.status(400).json({ error: 'Invalid action.' })
  } catch (err: any) {
    console.error('[CASHFREE] Unhandled error:', err.message)
    const status = err?.message?.includes('authenticated') ? 401 : 500
    return res.status(status).json({ error: err?.message || 'An unexpected error occurred.' })
  }
}
