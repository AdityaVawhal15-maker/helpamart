/**
 * HELPAMART — POST /api/udaan
 *
 * Handles Udaan 30 enrollment and Cashfree payment for ₹149.
 *
 * ENDPOINTS:
 *   POST /api/udaan { action: 'init-order', fullName, email, phone, journey, customGoal, experienceLevel, communicationPreference, availabilityPreference }
 *     → Creates pending enrollment record, creates Cashfree order, returns payment_session_id
 *
 *   POST /api/udaan { action: 'verify-payment', orderId }
 *     → Verifies payment status with Cashfree server-side, confirms enrollment, sets 30-day window
 *
 *   POST /api/udaan { action: 'get-enrollment', orderId }
 *     → Returns public sanitized enrollment details for display
 *
 * SECURITY:
 *   - Price is strictly fixed on server: ₹149 (14900 cents) — client amount is never accepted
 *   - Cashfree API keys and secrets stay securely on server
 *   - Service role key used for privileged database updates
 *   - Idempotent payment verification and duplicate prevention
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import nodemailer from 'nodemailer'

// ─── Fixed Constants ──────────────────────────────────────────────────────────
const UDAAN_PRICE_RUPEES = 149
const UDAAN_PRICE_CENTS = 14900
const UDAAN_CURRENCY = 'INR'
const UDAAN_DURATION_DAYS = 30

// ─── Supabase admin client (service-role — server only) ──────────────────────
function adminSupabase() {
  const url = process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  return createClient(url, key, { auth: { persistSession: false } })
}

// ─── Optional Supabase JWT verification ───────────────────────────────────────
async function extractUserId(authHeader: string | undefined): Promise<string | null> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) return null

  try {
    const url = process.env.SUPABASE_URL!
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${token}`, apikey: anonKey },
    })
    if (!res.ok) return null
    const user = (await res.json()) as { id?: string }
    return user?.id || null
  } catch {
    return null
  }
}

// ─── Email notification helpers (SMTP) ─────────────────────────────────────────
function getTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass },
  })
}

async function sendEnrollmentEmails(enrollment: any) {
  const transporter = getTransporter()
  if (!transporter) {
    console.log('[UDAAN] SMTP not configured; enrollment saved in DB for team operational review.')
    return
  }

  const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'hello@helpamart.com'
  const supportEmail = process.env.SUPPORT_EMAIL || 'support@helpamart.com'

  // 1. Confirmation email to student
  try {
    await transporter.sendMail({
      from: `"HELPAMART Udaan 30" <${fromAddress}>`,
      to: enrollment.email,
      subject: `Your Udaan 30 Mentorship is Confirmed! — ${enrollment.journey}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #071A35; padding: 20px;">
          <h2 style="color: #071A35; margin-bottom: 8px;">Your Udaan Begins Now! 🚀</h2>
          <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
            Hi ${enrollment.full_name},<br/><br/>
            Your enrollment in <strong>Udaan 30 — ${enrollment.journey}</strong> has been successfully confirmed.
          </p>
          <div style="background-color: #F8F9FA; border-left: 4px solid #B77A22; padding: 16px; margin: 20px 0; border-radius: 4px;">
            <p style="margin: 4px 0; font-size: 14px;"><strong>Order ID:</strong> ${enrollment.cashfree_order_id}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Journey:</strong> ${enrollment.journey}</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Duration:</strong> 30 Days</p>
            <p style="margin: 4px 0; font-size: 14px;"><strong>Amount Paid:</strong> ₹149 INR (via Cashfree)</p>
          </div>
          <p style="font-size: 14px; color: #4B5563; line-height: 1.6;">
            <strong>What happens next?</strong><br/>
            Our team coordinator will review your profile and match you with a verified mentor aligned with your goals. You will receive an onboarding roadmap and first check-in details directly by email.
          </p>
          <p style="font-size: 13px; color: #9CA3AF; margin-top: 30px;">
            Questions? Contact us at <a href="mailto:${supportEmail}" style="color: #B77A22;">${supportEmail}</a>.
          </p>
        </div>
      `,
    })
    console.log('[UDAAN] Confirmation email sent to student:', enrollment.email)
  } catch (err: any) {
    console.error('[UDAAN] Failed to send student confirmation email:', err.message)
  }

  // 2. Team notification email
  try {
    await transporter.sendMail({
      from: `"HELPAMART System" <${fromAddress}>`,
      to: supportEmail,
      subject: `[New Udaan 30 Enrollment] ${enrollment.full_name} — ${enrollment.journey}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; padding: 20px;">
          <h3>New Udaan 30 Mentorship Enrollment</h3>
          <p><strong>Student Name:</strong> ${enrollment.full_name}</p>
          <p><strong>Email:</strong> ${enrollment.email}</p>
          <p><strong>Phone:</strong> ${enrollment.phone || 'N/A'}</p>
          <p><strong>Journey:</strong> ${enrollment.journey}</p>
          <p><strong>Custom Goal:</strong> ${enrollment.custom_goal || 'N/A'}</p>
          <p><strong>Experience Level:</strong> ${enrollment.experience_level || 'N/A'}</p>
          <p><strong>Communication Preference:</strong> ${enrollment.communication_preference || 'N/A'}</p>
          <p><strong>Availability:</strong> ${enrollment.availability_preference || 'N/A'}</p>
          <p><strong>Order ID:</strong> ${enrollment.cashfree_order_id}</p>
          <p><strong>Enrolled At:</strong> ${new Date().toISOString()}</p>
        </div>
      `,
    })
    console.log('[UDAAN] Team notification email dispatched to:', supportEmail)
  } catch (err: any) {
    console.error('[UDAAN] Failed to send team notification email:', err.message)
  }
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
    console.error('[UDAAN-CASHFREE] CRITICAL: CASHFREE_APP_ID or CASHFREE_SECRET_KEY not set')
    throw new Error('Payment service not configured.')
  }

  const baseUrl = environment === 'production'
    ? 'https://api.cashfree.com'
    : 'https://sandbox.cashfree.com'

  const url = `${baseUrl}/pg${endpoint}`

  const headers: Record<string, string> = {
    'x-client-id': appId,
    'x-client-secret': secretKey,
    'x-api-version': '2025-01-01',
    'Accept': 'application/json',
  }

  if (method === 'POST' && body) {
    headers['Content-Type'] = 'application/json'
  }

  const fetchOptions: RequestInit = {
    method,
    headers,
  }

  if (method === 'POST' && body) {
    fetchOptions.body = JSON.stringify(body)
  }

  console.log(`[UDAAN-CASHFREE] ${method} ${url}`)

  const res = await fetch(url, fetchOptions)
  const json = await res.json().catch(() => ({}))

  if (!res.ok) {
    const errorMsg = (json as any)?.message || (json as any)?.error || `HTTP ${res.status}`
    console.error('[UDAAN-CASHFREE] API Error:', res.status, errorMsg, json)
    throw new Error(`Cashfree error (${res.status}): ${errorMsg}`)
  }

  return json
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  const { action } = (req.body || {}) as { action?: string }

  // ────────────────────────────────────────────────────────────────────────
  // ACTION: init-order
  // ────────────────────────────────────────────────────────────────────────
  if (action === 'init-order') {
    try {
      const {
        fullName,
        email,
        phone,
        journey,
        customGoal,
        experienceLevel,
        communicationPreference,
        availabilityPreference,
      } = req.body || {}

      if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
        return res.status(400).json({ error: 'Please enter your full name.' })
      }
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return res.status(400).json({ error: 'Please enter a valid email address.' })
      }
      if (!journey || typeof journey !== 'string') {
        return res.status(400).json({ error: 'Please select a mentorship journey.' })
      }

      const trimmedName = fullName.trim().slice(0, 100)
      const trimmedEmail = email.trim().toLowerCase().slice(0, 120)
      const trimmedPhone = phone ? phone.trim().slice(0, 20) : null
      const trimmedJourney = journey.trim().slice(0, 100)
      const trimmedGoal = customGoal ? customGoal.trim().slice(0, 1000) : null
      const trimmedLevel = experienceLevel ? experienceLevel.trim().slice(0, 100) : null
      const trimmedComm = communicationPreference ? communicationPreference.trim().slice(0, 100) : null
      const trimmedAvail = availabilityPreference ? availabilityPreference.trim().slice(0, 100) : null

      const userId = await extractUserId(req.headers.authorization)
      const db = adminSupabase()

      // Check for active enrollment within 30 days
      const { data: existingActive } = await db
        .from('udaan_enrollments')
        .select('id, journey, ends_at, payment_status, enrollment_status')
        .eq('email', trimmedEmail)
        .eq('payment_status', 'completed')
        .eq('enrollment_status', 'active')
        .gt('ends_at', new Date().toISOString())
        .maybeSingle()

      if (existingActive) {
        return res.status(400).json({
          error: `You already have an active Udaan 30 enrollment (${existingActive.journey}) ending on ${new Date(existingActive.ends_at).toLocaleDateString('en-IN')}.`,
        })
      }

      // Insert pending enrollment record
      const { data: enrollment, error: insertErr } = await db
        .from('udaan_enrollments')
        .insert({
          user_id: userId,
          full_name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          journey: trimmedJourney,
          custom_goal: trimmedGoal,
          experience_level: trimmedLevel,
          communication_preference: trimmedComm,
          availability_preference: trimmedAvail,
          amount_cents: UDAAN_PRICE_CENTS,
          currency: UDAAN_CURRENCY,
          payment_status: 'pending',
          enrollment_status: 'pending',
          payment_provider: 'cashfree',
        })
        .select()
        .single()

      if (insertErr || !enrollment) {
        console.error('[UDAAN] Insert enrollment error:', insertErr)
        return res.status(500).json({ error: 'Could not create enrollment record. Please try again.' })
      }

      // Generate unique Cashfree Order ID
      const orderId = `UDAAN-${enrollment.id.slice(0, 8).toUpperCase()}-${Date.now()}`

      // Create Cashfree Order
      const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.helpamart.com')
      const sanitizedPhone = trimmedPhone && trimmedPhone.replace(/\D/g, '').length >= 10
        ? trimmedPhone.replace(/\D/g, '').slice(-10)
        : '9999999999'

      const orderBody = {
        order_id: orderId,
        order_amount: UDAAN_PRICE_RUPEES,
        order_currency: UDAAN_CURRENCY,
        customer_details: {
          customer_id: userId || `udaan_${enrollment.id.slice(0, 12)}`,
          customer_email: trimmedEmail,
          customer_phone: sanitizedPhone,
          customer_name: trimmedName,
        },
        order_meta: {
          return_url: `${appUrl}/udaan-payment-result?order_id=${orderId}`,
          notify_url: `${appUrl}/api/cashfree-webhook`,
        },
        order_tags: {
          product: 'udaan_30',
          journey: trimmedJourney,
          enrollment_id: enrollment.id,
        },
      }

      console.log('[UDAAN] Creating Cashfree order:', orderId, 'for:', trimmedEmail)
      const orderResponse = await cashfreeRequest('/orders', orderBody, 'POST')

      if (!orderResponse?.payment_session_id) {
        console.error('[UDAAN] No payment_session_id returned from Cashfree:', orderResponse)
        return res.status(500).json({ error: 'Payment gateway did not provide a payment session.' })
      }

      // Update enrollment with cashfree_order_id
      await db
        .from('udaan_enrollments')
        .update({ cashfree_order_id: orderId })
        .eq('id', enrollment.id)

      const cashfreeEnvironment = process.env.CASHFREE_ENVIRONMENT || 'sandbox'

      return res.status(200).json({
        enrollment_id: enrollment.id,
        order_id: orderId,
        payment_session_id: orderResponse.payment_session_id,
        cashfree_environment: cashfreeEnvironment,
        amount: UDAAN_PRICE_RUPEES,
        currency: UDAAN_CURRENCY,
      })
    } catch (err: any) {
      console.error('[UDAAN] init-order error:', err)
      return res.status(500).json({ error: err.message || 'Failed to start payment.' })
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // ACTION: verify-payment
  // ────────────────────────────────────────────────────────────────────────
  if (action === 'verify-payment') {
    try {
      const { orderId } = req.body || {}
      if (!orderId || typeof orderId !== 'string') {
        return res.status(400).json({ error: 'Missing order ID.' })
      }

      const db = adminSupabase()

      // Look up enrollment
      const { data: enrollment, error: fetchErr } = await db
        .from('udaan_enrollments')
        .select('*')
        .eq('cashfree_order_id', orderId)
        .maybeSingle()

      if (fetchErr || !enrollment) {
        console.error('[UDAAN] Enrollment not found for order:', orderId, fetchErr)
        return res.status(404).json({ error: 'Enrollment record not found for this order.' })
      }

      // If already marked completed, return idempotent success
      if (enrollment.payment_status === 'completed' && enrollment.enrollment_status === 'active') {
        return res.status(200).json({
          verified: true,
          payment_status: 'completed',
          enrollment: {
            id: enrollment.id,
            fullName: enrollment.full_name,
            email: enrollment.email,
            journey: enrollment.journey,
            startsAt: enrollment.starts_at,
            endsAt: enrollment.ends_at,
            orderId: enrollment.cashfree_order_id,
          },
        })
      }

      // Query Cashfree API for order payments
      console.log('[UDAAN] Querying Cashfree payments for order:', orderId)
      const paymentsResponse = await cashfreeRequest(`/orders/${orderId}/payments`, undefined, 'GET')
      const payments = Array.isArray(paymentsResponse)
        ? paymentsResponse
        : Array.isArray(paymentsResponse?.data)
        ? paymentsResponse.data
        : []

      console.log('[UDAAN] Cashfree payments count:', payments.length)

      const successfulPayment = payments.find((p: any) => {
        const s = (p.payment_status || '').toUpperCase()
        return s === 'SUCCESS' || s === 'SETTLED' || s === 'AUTHORIZED' || s === 'CHARGED'
      })

      if (successfulPayment) {
        const now = new Date()
        const ends = new Date(now.getTime() + UDAAN_DURATION_DAYS * 24 * 60 * 60 * 1000)

        // Mark enrollment active and completed
        const { data: updated, error: updateErr } = await db
          .from('udaan_enrollments')
          .update({
            payment_status: 'completed',
            enrollment_status: 'active',
            cashfree_payment_id: successfulPayment.cf_payment_id || null,
            paid_at: now.toISOString(),
            starts_at: now.toISOString(),
            ends_at: ends.toISOString(),
          })
          .eq('id', enrollment.id)
          .select()
          .single()

        if (updateErr) {
          console.error('[UDAAN] Failed to update enrollment after payment:', updateErr)
          return res.status(500).json({ error: 'Failed to update enrollment record.' })
        }

        // Try to trigger team notification if notification table exists
        try {
          if (enrollment.user_id) {
            await db.from('notifications').insert({
              user_id: enrollment.user_id,
              type: 'udaan_enrollment_confirmed',
              title: 'Udaan 30 Confirmed!',
              message: `Your 30-day mentorship for ${enrollment.journey} is confirmed. Our team will reach out soon!`,
              data: { enrollment_id: enrollment.id, journey: enrollment.journey },
            })
          }
        } catch {
          // Non-blocking notification fallback
        }

        console.log('[UDAAN] Successfully activated enrollment:', enrollment.id)

        // Dispatch confirmation and team notification emails
        await sendEnrollmentEmails(updated)

        return res.status(200).json({
          verified: true,
          payment_status: 'completed',
          enrollment: {
            id: updated.id,
            fullName: updated.full_name,
            email: updated.email,
            journey: updated.journey,
            startsAt: updated.starts_at,
            endsAt: updated.ends_at,
            orderId: updated.cashfree_order_id,
          },
        })
      }

      // Check for failed payment
      const failedPayment = payments.find((p: any) => {
        const s = (p.payment_status || '').toUpperCase()
        return s === 'FAILED' || s === 'CANCELLED' || s === 'USER_DROPPED' || s === 'DECLINED'
      })

      if (failedPayment) {
        await db
          .from('udaan_enrollments')
          .update({ payment_status: 'failed' })
          .eq('id', enrollment.id)

        return res.status(200).json({
          verified: false,
          payment_status: 'failed',
          message: 'Payment was cancelled or failed.',
        })
      }

      // Otherwise payment is pending
      return res.status(200).json({
        verified: false,
        payment_status: 'pending',
        message: 'Payment is being processed by Cashfree.',
      })
    } catch (err: any) {
      console.error('[UDAAN] verify-payment error:', err)
      return res.status(500).json({ error: err.message || 'Payment verification failed.' })
    }
  }

  // ────────────────────────────────────────────────────────────────────────
  // ACTION: get-enrollment
  // ────────────────────────────────────────────────────────────────────────
  if (action === 'get-enrollment') {
    try {
      const { orderId } = req.body || {}
      if (!orderId || typeof orderId !== 'string') {
        return res.status(400).json({ error: 'Missing order ID.' })
      }

      const db = adminSupabase()
      const { data: enrollment, error } = await db
        .from('udaan_enrollments')
        .select('id, full_name, email, journey, starts_at, ends_at, payment_status, enrollment_status, cashfree_order_id')
        .eq('cashfree_order_id', orderId)
        .maybeSingle()

      if (error || !enrollment) {
        return res.status(404).json({ error: 'Enrollment not found.' })
      }

      return res.status(200).json({
        enrollment: {
          id: enrollment.id,
          fullName: enrollment.full_name,
          email: enrollment.email,
          journey: enrollment.journey,
          startsAt: enrollment.starts_at,
          endsAt: enrollment.ends_at,
          paymentStatus: enrollment.payment_status,
          enrollmentStatus: enrollment.enrollment_status,
          orderId: enrollment.cashfree_order_id,
        },
      })
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Error fetching enrollment.' })
    }
  }

  return res.status(400).json({ error: `Unknown action: ${action}` })
}
