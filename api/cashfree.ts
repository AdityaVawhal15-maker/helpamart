/**
 * HELPAMART — POST /api/cashfree
 *
 * ⚠️  DEPRECATED: This endpoint is kept for webhook handling only.
 * ⚠️  DO NOT use this for new booking payments. Use /api/razorpay instead.
 *
 * Vercel serverless function (Node.js runtime).
 * Handles Cashfree payment order creation and verification.
 *
 * ENDPOINTS:
 *   POST /api/cashfree { action: 'create-order', bookingId, amount, currency }
 *     → [DEPRECATED] Create Cashfree order, return payment_session_id for frontend checkout
 *
 *   POST /api/cashfree { action: 'verify-payment', orderId }
 *     → [DEPRECATED] Verify payment status with Cashfree, confirm booking if successful
 *
 * SECURITY:
 *   - Verify Supabase JWT from Authorization header
 *   - Verify amount server-side from bookings table (never trust frontend amount)
 *   - Use service-role key for backend DB operations only
 *   - Protect secret key: never log, never expose to client
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

// ─── Cashfree API helper (environment-aware) ──────────────────────────────────
async function cashfreeRequest(
  endpoint: string,
  body?: Record<string, any>,
  method: string = 'POST',
): Promise<any> {
  const appId = process.env.CASHFREE_APP_ID
  const secretKey = process.env.CASHFREE_SECRET_KEY
  const environment = process.env.CASHFREE_ENVIRONMENT || 'sandbox'

  if (!appId || !secretKey) {
    console.error('[CASHFREE] CRITICAL: CASHFREE_APP_ID or CASHFREE_SECRET_KEY not set')
    throw new Error('Payment service not configured.')
  }

  // Select endpoint based on environment
  const baseUrl = environment === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com'

  console.log(`[CASHFREE] Endpoint: ${baseUrl}/pg${endpoint}`)
  console.log(`[CASHFREE] Environment: ${environment}`)
  console.log(`[CASHFREE] Using App ID ending: ...${appId.slice(-8)}`)

  const url = `${baseUrl}/pg${endpoint}`

  // Build headers based on method
  const headers: Record<string, string> = {
    'x-client-id': appId,
    'x-client-secret': secretKey,
    'x-api-version': '2025-01-01', // Updated to current version
    'Accept': 'application/json',
  }

  // For POST requests, add Content-Type
  if (method === 'POST' && body) {
    headers['Content-Type'] = 'application/json'
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  // Only add body for POST requests
  if (method === 'POST' && body) {
    fetchOptions.body = JSON.stringify(body)
  }

  console.log(`[CASHFREE] ${method} ${endpoint}`)

  const res = await fetch(url, fetchOptions)
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorMsg = (json as any)?.message || (json as any)?.error || `HTTP ${res.status}`
    const errorCode = (json as any)?.code || 'UNKNOWN'
    console.error('[CASHFREE] API ERROR:')
    console.error('  Endpoint:', url)
    console.error('  HTTP Status:', res.status)
    console.error('  Error Code:', errorCode)
    console.error('  Error Message:', errorMsg)
    console.error('  Response:', JSON.stringify(json))
    console.error('  [DIAGNOSTIC] Environment:', process.env.CASHFREE_ENVIRONMENT || 'sandbox')
    console.error('  [DIAGNOSTIC] Expected Auth Failure if environment/credentials mismatch')
    throw new Error(`Cashfree error (${res.status}): ${errorMsg}`)
  }

  console.log(`[CASHFREE] ${method} ${endpoint} → Success`)

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
  console.log('[CASHFREE] Creating payment order for booking:', opts.bookingId, 'amount:', opts.amount)

  // Generate unique order ID (format: BOOK-{booking_prefix}-{timestamp})
  const orderId = `BOOK-${opts.bookingId.slice(0, 8).toUpperCase()}-${Date.now()}`

  // Convert cents to rupees (9900 cents = 99 rupees)
  const orderAmount = opts.amount / 100

  const orderBody = {
    order_id: orderId,
    order_amount: orderAmount, // Must be a number, not string
    order_currency: opts.currency || 'INR',
    customer_details: {
      customer_id: opts.userId,
      customer_email: opts.customerEmail,
      customer_phone: '9999999999', // Placeholder (Cashfree requires this)
      customer_name: opts.customerName,
    },
    order_meta: {
      return_url: `${process.env.APP_URL || 'https://www.helpamart.com'}/booking-payment-result?order_id=${orderId}`,
      notify_url: `${process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.helpamart.com'}/api/cashfree-webhook`,
    },
  }

  console.log('[CASHFREE] Order body:', JSON.stringify(orderBody, null, 2))

  const orderResponse = await cashfreeRequest('/orders', orderBody, 'POST')

  if (!orderResponse?.payment_session_id) {
    console.error('[CASHFREE] No payment_session_id in response:', JSON.stringify(orderResponse))
    throw new Error('Cashfree did not return payment_session_id')
  }

  console.log('[CASHFREE] Order created:', orderId)
  console.log('[CASHFREE] Payment session ID:', orderResponse.payment_session_id.slice(0, 20) + '...')

  return {
    payment_session_id: orderResponse.payment_session_id,
    order_id: orderId,
  }
}

// ─── Verify payment status (GET /pg/orders/{order_id}/payments) ────────────────
async function verifyPaymentStatus(orderId: string): Promise<{
  payment_status: string
  amount: number
  error?: string
}> {
  console.log('[CASHFREE] Verifying payment for order:', orderId)

  try {
    // Use correct endpoint: /pg/orders/{order_id}/payments
    const paymentsResponse = await cashfreeRequest(`/orders/${orderId}/payments`, undefined, 'GET')

    console.log('[CASHFREE] Payments endpoint response:', JSON.stringify(paymentsResponse))

    // paymentsResponse should be an array of transactions or object with payments array
    const payments = Array.isArray(paymentsResponse) ? paymentsResponse : paymentsResponse?.data || []

    if (!payments || payments.length === 0) {
      console.log('[CASHFREE] No payments found for order:', orderId)
      return { payment_status: 'pending', amount: 0 }
    }

    // Look for a successful payment
    const successfulPayment = payments.find(
      (p: any) => p.payment_status === 'SUCCESS' || p.payment_status === 'success'
    )

    if (successfulPayment) {
      const amount = successfulPayment.payment_amount
        ? Math.round(parseFloat(successfulPayment.payment_amount) * 100)
        : 0
      console.log('[CASHFREE] Successful payment found:', {
        payment_status: 'completed',
        amount,
        payment_id: successfulPayment.cf_payment_id,
      })
      return { payment_status: 'completed', amount }
    }

    // Check for failed payments
    const failedPayment = payments.find(
      (p: any) => p.payment_status === 'FAILED' || p.payment_status === 'failed'
    )

    if (failedPayment) {
      console.log('[CASHFREE] Failed payment found:', failedPayment.payment_status)
      return { payment_status: 'failed', amount: 0, error: failedPayment.payment_status }
    }

    // All other statuses are pending
    console.log('[CASHFREE] Payment still pending')
    return { payment_status: 'pending', amount: 0 }
  } catch (err: any) {
    console.error('[CASHFREE] Payment verification error:', err.message)
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
    // Validate Cashfree environment configuration
    const cashfreeEnvironment = process.env.CASHFREE_ENVIRONMENT
    
    if (!cashfreeEnvironment) {
      console.error('[CASHFREE] CRITICAL: CASHFREE_ENVIRONMENT not set')
      console.error('[CASHFREE] Please configure CASHFREE_ENVIRONMENT in Vercel (sandbox or production)')
      return res.status(500).json({ 
        error: 'Payment service not properly configured. Please contact support.'
      })
    }

    if (cashfreeEnvironment !== 'sandbox' && cashfreeEnvironment !== 'production') {
      console.error('[CASHFREE] CRITICAL: CASHFREE_ENVIRONMENT has invalid value:', cashfreeEnvironment)
      return res.status(500).json({ 
        error: 'Payment service misconfigured. Please contact support.'
      })
    }

    console.log(`[CASHFREE] Handler initialized - Environment: ${cashfreeEnvironment}`)
    
    const userId = await verifyJwt(req.headers.authorization)
    const db = adminSupabase()
    const cashfreeEnvironmentValue = cashfreeEnvironment

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

      console.log('[CASHFREE] FLOW START: init-paid-booking')
      console.log('[CASHFREE] authenticated user:', userId)

      // STEP 1: Resolve mentor from public.mentors (ONLY columns that exist)
      const { data: mentorRow, error: mentorErr } = await db
        .from('mentors')
        .select('id, user_id, name, slug, services, status')
        .eq('slug', mentorSlug)
        .eq('status', 'published')
        .maybeSingle()

      if (mentorErr) {
        console.error('[CASHFREE] Mentor query error:', mentorErr.message)
        return res.status(500).json({ error: 'Unable to load mentor information. Please try again.' })
      }

      if (!mentorRow) {
        console.error('[CASHFREE] Mentor not found for slug:', mentorSlug)
        return res.status(404).json({ error: 'This mentor is not currently available.' })
      }

      console.log('[CASHFREE] mentor resolved:', mentorRow.id, mentorRow.name)

      // STEP 2: Get mentor email from public.profiles using user_id
      const { data: mentorProfile, error: profileErr } = await db
        .from('profiles')
        .select('email, full_name')
        .eq('id', mentorRow.user_id)
        .maybeSingle()

      if (profileErr) {
        console.error('[CASHFREE] Mentor profile query error:', profileErr.message)
        return res.status(500).json({ error: 'Unable to load mentor information. Please try again.' })
      }

      const mentorEmail = mentorProfile?.email || 'mentor@helpamart.com'
      const mentorName = mentorProfile?.full_name || mentorRow.name
      console.log('[CASHFREE] mentor profile resolved:', mentorEmail)

      // STEP 3: Get authenticated user's profile for student email and name
      const { data: userProfile, error: userProfileErr } = await db
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .maybeSingle()

      if (userProfileErr) {
        console.error('[CASHFREE] User profile query error:', userProfileErr.message)
        return res.status(500).json({ error: 'Unable to load your profile. Please try again.' })
      }

      const studentEmail = userProfile?.email || 'user@helpamart.com'
      const studentName = userProfile?.full_name || 'User'
      console.log('[CASHFREE] student profile resolved:', studentEmail)

      // STEP 4: Resolve service
      const services = Array.isArray(mentorRow.services) ? mentorRow.services : []
      console.log('[CASHFREE] Available services:', services.length, 'serviceId requested:', serviceId)

      const service = serviceId
        ? services.find((s: any) => s.id === serviceId || s.title === serviceId) ?? services[0]
        : services[0]

      if (!service) {
        console.error('[CASHFREE] No service found')
        return res.status(400).json({ error: 'This session type is no longer available.' })
      }

      console.log('[CASHFREE] Service resolved:', { id: service.id, title: service.title })

      // Validate service.id exists (required for bookings.service_id NOT NULL constraint)
      if (!service.id) {
        console.error('[CASHFREE] Service has no ID. Generating deterministic ID from title.')
        // Generate deterministic ID from service title if missing
        service.id = `svc-${mentorRow.id.slice(0, 8)}-${service.title.toLowerCase().replace(/\s+/g, '-')}`
        console.log('[CASHFREE] Generated service ID:', service.id)
      }

      // STEP 5: Calculate time
      const start = new Date(startAtStr)
      const durationMin = service.durationMinutes || 30
      const end = new Date(start.getTime() + durationMin * 60 * 1000)

      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: 'Invalid start time.' })
      }

      // STEP 6: Verify user is NOT first session (returning user)
      const { count: prevBookings } = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('mentee_id', userId)
        .in('status', ['confirmed', 'completed'])
        .in('payment_status', ['not_required', 'completed'])

      const isFirstSession = (prevBookings ?? 0) === 0
      console.log('[CASHFREE] previous successful bookings count:', prevBookings ?? 0, 'isFirstSession:', isFirstSession)

      if (isFirstSession) {
        console.log('[CASHFREE] REJECTED: First session is free')
        return res.status(400).json({ error: 'First session is free. Use regular booking flow.' })
      }

      console.log('[CASHFREE] VERIFIED: Returning user (paid session allowed)')

      // STEP 7: Create provisional booking (UNPAID STATE)
      // Use status='pending' (allowed by constraint), payment_status='pending' to track payment state
      const provisionalBookingId = crypto.randomUUID()
      console.log('[CASHFREE] Creating provisional booking:', provisionalBookingId)

      const { error: bookingErr } = await db.from('bookings').insert({
        id: provisionalBookingId,
        mentor_id: mentorRow.id,
        mentee_id: userId,
        service_id: service.id,
        service_title: service.title,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        timezone,
        status: 'pending', // Use 'pending' (allowed by constraint), not 'pending_payment'
        payment_status: 'pending', // Tracks actual payment state
        price_cents: 9900, // ₹99
        currency: 'INR',
        payment_provider: 'cashfree',
        meet_link: null,
        mentor_email: mentorEmail,
        student_email: studentEmail,
      }).select()

      if (bookingErr) {
        console.error('[CASHFREE] PROVISIONAL BOOKING INSERT FAILED')
        console.error('  code:', bookingErr.code)
        console.error('  message:', bookingErr.message)
        console.error('  details:', bookingErr.details)
        console.error('  hint:', bookingErr.hint)
        console.error('  Attempted INSERT with:')
        console.error('    id:', provisionalBookingId)
        console.error('    mentor_id:', mentorRow.id)
        console.error('    mentee_id:', userId)
        console.error('    service_id:', service.id)
        console.error('    service_title:', service.title)
        console.error('    start_at:', start.toISOString())
        console.error('    end_at:', end.toISOString())
        console.error('    timezone:', timezone)
        console.error('    status: pending')
        console.error('    payment_status: pending')
        console.error('    price_cents: 9900')
        console.error('    currency: INR')
        console.error('    payment_provider: cashfree')
        console.error('    mentor_email:', mentorEmail)
        console.error('    student_email:', studentEmail)
        return res.status(500).json({ error: 'Unable to create the booking record. Please try again.' })
      }

      console.log('[CASHFREE] Provisional booking created successfully:', provisionalBookingId)

      // STEP 8: Create Cashfree order
      console.log('[CASHFREE] Creating Cashfree order for booking:', provisionalBookingId)
      try {
        const { payment_session_id, order_id } = await createPaymentOrder({
          bookingId: provisionalBookingId,
          userId,
          amount: 9900,
          currency: 'INR',
          customerEmail: studentEmail,
          customerName: studentName,
        })

        console.log('[CASHFREE] Cashfree order created:', order_id)

        // Link Cashfree order to provisional booking
        const { error: updateErr } = await db
          .from('bookings')
          .update({
            cashfree_order_id: order_id,
          })
          .eq('id', provisionalBookingId)

        if (updateErr) {
          console.error('[CASHFREE] Failed to link Cashfree order to booking:', updateErr.message)
          // Still return success as order exists - re-linking on next attempt will work
        }

        console.log('[CASHFREE] SUCCESS: init-paid-booking complete', {
          booking_id: provisionalBookingId,
          order_id,
          mentor: mentorName,
          student: studentName,
          amount_cents: 9900,
          payment_session_id: payment_session_id.slice(0, 20) + '...',
        })

        return res.status(200).json({
          booking_id: provisionalBookingId,
          order_id,
          payment_session_id,
          cashfree_environment: cashfreeEnvironmentValue, // Include environment for frontend
        })
      } catch (err: any) {
        // Rollback provisional booking on Cashfree failure
        console.error('[CASHFREE] Cashfree order creation failed, rolling back booking:', err.message)
        await db.from('bookings').delete().eq('id', provisionalBookingId)
        return res.status(503).json({ error: err.message || 'Unable to start secure payment. Please try again.' })
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
        return res.status(200).json({
          payment_session_id,
          order_id,
          cashfree_environment: cashfreeEnvironmentValue, // Include environment for frontend
        })
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
