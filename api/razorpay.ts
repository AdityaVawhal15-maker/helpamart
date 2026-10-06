/**
 * HELPAMART — POST /api/razorpay
 *
 * Vercel serverless function (Node.js runtime).
 * Handles Razorpay payment order creation and verification.
 *
 * ENDPOINTS:
 *   POST /api/razorpay { action: 'init-order', mentorSlug, serviceId, startAt, timezone }
 *     → Create provisional booking, create Razorpay order, return booking_id + razorpay_order_id + razorpay_key_id
 *
 *   POST /api/razorpay { action: 'verify-payment', bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature }
 *     → Verify payment signature (CRITICAL SECURITY), confirm booking
 *
 * SECURITY:
 *   - Verify Supabase JWT from Authorization header
 *   - Verify Razorpay signature server-side using RAZORPAY_KEY_SECRET (never trust frontend)
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

// ─── Razorpay API helper ──────────────────────────────────────────────────────
async function razorpayRequest(
  endpoint: string,
  body?: Record<string, any>,
  method: string = 'POST',
): Promise<any> {
  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_KEY_SECRET

  if (!keyId || !keySecret) {
    console.error('[RAZORPAY] CRITICAL: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set')
    throw new Error('Payment service not configured.')
  }

  const url = `https://api.razorpay.com/v1${endpoint}`

  // Basic Auth header
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64')

  const headers: Record<string, string> = {
    'Authorization': `Basic ${auth}`,
    'Content-Type': 'application/json',
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (method === 'POST' && body) {
    fetchOptions.body = JSON.stringify(body)
  }

  console.log(`[RAZORPAY] ${method} ${endpoint}`)

  const res = await fetch(url, fetchOptions)
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorMsg = (json as any)?.error?.description || (json as any)?.message || `HTTP ${res.status}`
    const errorCode = (json as any)?.error?.code || 'UNKNOWN'
    console.error('[RAZORPAY] API ERROR:', errorCode, '-', errorMsg)
    throw new Error(`Razorpay API error: ${errorMsg}`)
  }

  return json
}

// ─── Verify Razorpay payment signature (critical security) ─────────────────────
function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string,
): boolean {
  const keySecret = process.env.RAZORPAY_KEY_SECRET!
  const message = `${orderId}|${paymentId}`
  const computedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(message)
    .digest('hex')

  const isValid = computedSignature === signature
  console.log('[RAZORPAY] Signature verification:', isValid ? 'PASSED' : 'FAILED')
  return isValid
}

// ─── Main handler ──────────────────────────────────────────────────────────────
async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  console.log('[RAZORPAY] Request received')

  try {
    const userId = await verifyJwt(req.headers.authorization)
    console.log('[RAZORPAY] Authenticated user:', userId)

    const db = adminSupabase()
    const { action } = req.body as { action?: string }

    if (!action) {
      return res.status(400).json({ error: 'action is required (init-order or verify-payment).' })
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION: init-order — Create provisional booking + Razorpay order
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'init-order') {
      const { mentorSlug, serviceId, startAt, timezone } = req.body as {
        mentorSlug?: string
        serviceId?: string
        startAt?: string
        timezone?: string
      }

      if (!mentorSlug || !startAt || !timezone) {
        return res.status(400).json({ error: 'mentorSlug, startAt, and timezone are required.' })
      }

      console.log('[RAZORPAY] init-order: mentorSlug=', mentorSlug, '| startAt=', startAt)

      // 1. Validate mentor
      const { data: mentorRow, error: mentorErr } = await db
        .from('mentors')
        .select('id, user_id, name, slug, status, services, buffer_minutes, timezone')
        .eq('slug', mentorSlug)
        .eq('status', 'published')
        .maybeSingle()

      if (mentorErr || !mentorRow) {
        console.error('[RAZORPAY] Mentor not found:', mentorErr?.message)
        return res.status(404).json({ error: 'This mentor is not currently available.' })
      }
      console.log('[RAZORPAY] Mentor resolved:', mentorRow.name)

      // 2. Resolve service
      const services: any[] = Array.isArray(mentorRow.services) ? mentorRow.services : []
      const service = serviceId
        ? services.find((s: any) => s.id === serviceId || s.title === serviceId) ?? services[0]
        : services[0]

      if (!service) {
        return res.status(400).json({ error: 'That session type is not available.' })
      }
      console.log('[RAZORPAY] Service resolved:', service.title)

      const durationMin = service.durationMinutes || 30
      const start = new Date(startAt)
      const end = new Date(start.getTime() + durationMin * 60 * 1000)

      if (isNaN(start.getTime())) {
        return res.status(400).json({ error: 'Invalid start time.' })
      }

      // 3. Verify user has at least 1 successful booking (returning user = paid flow)
      const { count: totalSuccessfulBookings } = await db
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('mentee_id', userId)
        .in('status', ['confirmed', 'completed'])
        .in('payment_status', ['not_required', 'completed'])

      const isFirstSession = (totalSuccessfulBookings ?? 0) === 0

      // IMPORTANT: Paid flow only for returning users (not first session)
      if (isFirstSession) {
        console.warn('[RAZORPAY] User attempted paid flow but is a first-time user (free). Rejecting.')
        return res.status(400).json({
          error: 'Your first session is complimentary. Please use the free booking flow.',
        })
      }

      console.log('[RAZORPAY] User is returning (totalPreviousBookings=', totalSuccessfulBookings, ')')

      // 4. Double-booking check
      const { data: clash } = await db
        .from('bookings')
        .select('id')
        .eq('mentor_id', mentorRow.id)
        .in('status', ['confirmed', 'pending'])
        .lt('start_at', end.toISOString())
        .gt('end_at', start.toISOString())
        .limit(1)

      if (clash && clash.length > 0) {
        return res.status(409).json({ error: 'This time slot is no longer available. Please choose another time.' })
      }

      // 5. Calculate price (returning users always pay ₹99 = 9900 paise)
      const finalPriceCents = 9900
      const currency = 'INR'
      console.log('[RAZORPAY] Price: ₹99 (paise:', finalPriceCents, ')')

      // 6. Fetch profile info for emails/notifications
      const [{ data: mentorUser }, { data: menteeUser }] = await Promise.all([
        db.from('profiles').select('email, full_name').eq('id', mentorRow.user_id).maybeSingle(),
        db.from('profiles').select('email, full_name').eq('id', userId).maybeSingle(),
      ])

      const mentorEmail = mentorUser?.email ?? null
      const menteeEmail = menteeUser?.email ?? null

      // 7. Create provisional booking (status='pending', payment_status='pending')
      const bookingId = crypto.randomUUID()
      const now = new Date().toISOString()

      console.log('[RAZORPAY] Inserting provisional booking:', bookingId)
      const { error: insertErr } = await db.from('bookings').insert({
        id: bookingId,
        mentor_id: mentorRow.id,
        mentee_id: userId,
        service_id: service.id || service.title || 'default',
        service_title: service.title,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        timezone,
        status: 'pending',
        payment_status: 'pending',
        price_cents: finalPriceCents,
        currency,
        payment_provider: 'razorpay',
        meet_link: null, // Will be created after payment verification
        mentor_email: mentorEmail,
        student_email: menteeEmail,
        created_at: now,
        updated_at: now,
      })

      if (insertErr) {
        console.error('[RAZORPAY] Booking INSERT failed:', insertErr.message)
        return res.status(500).json({ error: `Could not create booking: ${insertErr.message}` })
      }
      console.log('[RAZORPAY] Provisional booking inserted:', bookingId)

      // 8. Create Razorpay order
      console.log('[RAZORPAY] Creating Razorpay order for ₹99')
      let razorpayOrder: any
      try {
        razorpayOrder = await razorpayRequest('/orders', {
          amount: finalPriceCents, // in paise
          currency: currency,
          receipt: bookingId, // Use booking ID as receipt
          notes: {
            bookingId,
            menteeId: userId,
            mentorId: mentorRow.id,
          },
        })
      } catch (orderErr: any) {
        console.error('[RAZORPAY] Order creation failed:', orderErr.message)
        // Rollback booking
        try {
          await db.from('bookings').delete().eq('id', bookingId)
        } catch (rbErr: any) {
          console.error('[RAZORPAY] Rollback error:', rbErr.message)
        }
        return res.status(503).json({
          error: 'Failed to create payment order. Please try again.',
          hint: orderErr.message,
        })
      }

      const razorpayOrderId = razorpayOrder.id
      console.log('[RAZORPAY] Razorpay order created:', razorpayOrderId)

      // 9. Store Razorpay order ID in booking (for reference during verification)
      try {
        await db
          .from('bookings')
          .update({
            razorpay_order_id: razorpayOrderId,
            updated_at: new Date().toISOString(),
          })
          .eq('id', bookingId)
      } catch (storeErr: any) {
        console.error('[RAZORPAY] Failed to store order ID:', storeErr.message)
      }

      // 10. Return booking ID + Razorpay details (frontend will open checkout)
      const razorpayKeyId = process.env.RAZORPAY_KEY_ID!
      return res.status(200).json({
        booking_id: bookingId,
        razorpay_order_id: razorpayOrderId,
        razorpay_key_id: razorpayKeyId,
        amount: finalPriceCents,
        currency: currency,
      })
    }

    // ════════════════════════════════════════════════════════════════════════
    // ACTION: verify-payment — Verify Razorpay signature + confirm booking
    // ════════════════════════════════════════════════════════════════════════
    if (action === 'verify-payment') {
      const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body as {
        bookingId?: string
        razorpayOrderId?: string
        razorpayPaymentId?: string
        razorpaySignature?: string
      }

      if (!bookingId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        return res.status(400).json({
          error: 'bookingId, razorpayOrderId, razorpayPaymentId, and razorpaySignature are required.',
        })
      }

      console.log('[RAZORPAY] verify-payment: bookingId=', bookingId, '| paymentId=', razorpayPaymentId)

      // 1. Fetch booking
      const { data: booking, error: bookingErr } = await db
        .from('bookings')
        .select('id, mentee_id, mentor_id, razorpay_order_id, status, payment_status')
        .eq('id', bookingId)
        .maybeSingle()

      if (bookingErr || !booking) {
        console.error('[RAZORPAY] Booking not found:', bookingErr?.message)
        return res.status(404).json({ error: 'Booking not found.' })
      }

      // 2. Verify user owns this booking
      if (booking.mentee_id !== userId) {
        console.warn('[RAZORPAY] Unauthorized: user', userId, 'does not own booking', bookingId)
        return res.status(403).json({ error: 'Unauthorized.' })
      }

      // 3. CRITICAL: Verify Razorpay signature server-side
      const isSignatureValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
      if (!isSignatureValid) {
        console.error('[RAZORPAY] Signature verification FAILED — possible fraud attempt')
        return res.status(403).json({ error: 'Payment verification failed. Signature mismatch.' })
      }

      console.log('[RAZORPAY] Signature verified successfully')

      // 4. Fetch payment details from Razorpay API to confirm status
      console.log('[RAZORPAY] Fetching payment details from Razorpay API')
      let paymentDetails: any
      try {
        paymentDetails = await razorpayRequest(`/payments/${razorpayPaymentId}`)
      } catch (paymentErr: any) {
        console.error('[RAZORPAY] Could not fetch payment details:', paymentErr.message)
        return res.status(503).json({
          error: 'Could not verify payment status. Please contact support.',
        })
      }

      if (paymentDetails.status !== 'captured') {
        console.error('[RAZORPAY] Payment status is not captured:', paymentDetails.status)
        return res.status(400).json({
          error: 'Payment was not successful. Please try again.',
        })
      }

      console.log('[RAZORPAY] Payment captured successfully')

      // 5. Update booking: mark as confirmed + payment completed
      console.log('[RAZORPAY] Updating booking to confirmed status')
      const { error: updateErr } = await db
        .from('bookings')
        .update({
          status: 'confirmed',
          payment_status: 'completed',
          razorpay_payment_id: razorpayPaymentId,
          razorpay_signature: razorpaySignature,
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)

      if (updateErr) {
        console.error('[RAZORPAY] Booking update failed:', updateErr.message)
        return res.status(500).json({
          error: 'Payment verified but could not update booking. Please contact support.',
        })
      }

      console.log('[RAZORPAY] Booking confirmed successfully')

      // 6. Create in-app notifications for mentee and mentor
      try {
        // Fetch booking details for notification content
        const { data: bookingDetails } = await db
          .from('bookings')
          .select('mentor_id, service_title, start_at, timezone')
          .eq('id', bookingId)
          .maybeSingle()

        // Fetch mentor details
        const { data: mentor } = await db
          .from('mentors')
          .select('name, user_id')
          .eq('id', bookingDetails?.mentor_id)
          .maybeSingle()

        const notifications = [
          {
            user_id: userId,
            title: 'Payment Confirmed',
            message: `Your payment for "${bookingDetails?.service_title}" with ${mentor?.name} has been confirmed. Your session details will be sent via email.`,
            link: `/dashboard/bookings/${bookingId}`,
          },
        ]

        if (mentor?.user_id) {
          notifications.push({
            user_id: mentor.user_id,
            title: 'New Confirmed Session',
            message: `Payment confirmed for a new session. Session details: "${bookingDetails?.service_title}"`,
            link: `/mentor-dashboard/bookings/${bookingId}`,
          })
        }

        await db.from('notifications').insert(notifications)
        console.log('[RAZORPAY] Notifications created')
      } catch (notifErr: any) {
        console.warn('[RAZORPAY] Notification creation error:', notifErr?.message)
        // Don't fail the API response due to notification errors
      }

      return res.status(200).json({
        success: true,
        bookingId: bookingId,
        message: 'Payment verified. Booking confirmed.',
      })
    }

    // ────────────────────────────────────────────────────────────────────────
    return res.status(400).json({ error: `Unknown action: ${action}` })
  } catch (err: any) {
    console.error('[RAZORPAY] Unhandled error:', err)
    const status = err?.message?.includes('authenticated') ? 401 : 500
    return res.status(status).json({ error: err?.message || 'An unexpected error occurred.' })
  }
}

export default handler
