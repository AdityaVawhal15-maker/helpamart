/**
 * HELPAMART — POST /api/cashfree-diagnostic
 * 
 * TEMPORARY DIAGNOSTIC ENDPOINT
 * 
 * Queries Cashfree Live API directly for existing orders to diagnose
 * why payment verification returns empty payments array despite user
 * reporting successful payment completion.
 * 
 * Usage: POST /api/cashfree-diagnostic
 * Body: { orderId: "BOOK-A185BCD1-1791560103932" }
 * 
 * Returns:
 * - Order details from Cashfree Get Order endpoint
 * - Payment details from Cashfree Get Payments endpoint
 * - Diagnostic analysis
 * 
 * Security: Restricted to authenticated users (JWT required)
 * Output: Sanitized (no secrets, only payment status/amount)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── Verify JWT ───────────────────────────────────────────────────────────────
async function verifyJwt(authHeader: string | undefined): Promise<string> {
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null
  if (!token) {
    console.error('[DIAGNOSTIC] Missing authorization header')
    throw new Error('Not authenticated.')
  }

  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid token format.')
    }

    const payload = parts[1]
    const padded = payload + '='.repeat((4 - payload.length % 4) % 4)
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString()) as { sub?: string; user_id?: string }

    const userId = decoded.sub || decoded.user_id
    if (!userId) {
      console.error('[DIAGNOSTIC] No user ID in JWT')
      throw new Error('Could not identify user from token.')
    }

    return userId
  } catch (err: any) {
    console.error('[DIAGNOSTIC] JWT decoding error:', err.message)
    throw new Error('Authentication failed.')
  }
}

// ─── Query Cashfree directly ──────────────────────────────────────────────────
async function queryCashfreeOrder(orderId: string) {
  const appId = process.env.CASHFREE_APP_ID
  const secretKey = process.env.CASHFREE_SECRET_KEY

  if (!appId || !secretKey) {
    throw new Error('Cashfree credentials not configured.')
  }

  console.log('[DIAGNOSTIC] Querying Cashfree for order:', orderId)

  // Step 1: Get Order details
  console.log('[DIAGNOSTIC] GET /pg/orders/{orderId}')
  const orderUrl = `https://api.cashfree.com/pg/orders/${orderId}`
  
  const orderRes = await fetch(orderUrl, {
    method: 'GET',
    headers: {
      'x-api-version': '2025-01-01',
      'x-client-id': appId,
      'x-client-secret': secretKey,
    },
  })

  const orderData = await orderRes.json() as any
  
  console.log('[DIAGNOSTIC] Get Order response (HTTP ' + orderRes.status + ')')
  if (!orderRes.ok) {
    console.error('[DIAGNOSTIC] Order lookup failed:', orderData?.message || 'Unknown error')
    return {
      orderId,
      getOrderStatus: orderRes.status,
      getOrderError: orderData?.message || orderData?.error || 'HTTP ' + orderRes.status,
      orderExists: false,
      payments: [],
    }
  }

  console.log('[DIAGNOSTIC] Order found:', {
    order_id: orderData.order_id,
    order_status: orderData.order_status,
    order_amount: orderData.order_amount,
    order_currency: orderData.order_currency,
  })

  // Step 2: Get Payments for this order
  console.log('[DIAGNOSTIC] GET /pg/orders/{orderId}/payments')
  const paymentsUrl = `https://api.cashfree.com/pg/orders/${orderId}/payments`
  
  const paymentsRes = await fetch(paymentsUrl, {
    method: 'GET',
    headers: {
      'x-api-version': '2025-01-01',
      'x-client-id': appId,
      'x-client-secret': secretKey,
    },
  })

  const paymentsData = await paymentsRes.json() as any

  console.log('[DIAGNOSTIC] Get Payments response (HTTP ' + paymentsRes.status + ')')
  
  if (!paymentsRes.ok) {
    console.error('[DIAGNOSTIC] Payments lookup failed:', paymentsData?.message || 'Unknown error')
    return {
      orderId,
      getOrderStatus: orderRes.status,
      orderDetails: {
        order_id: orderData.order_id,
        order_status: orderData.order_status,
        order_amount: orderData.order_amount,
        order_currency: orderData.order_currency,
      },
      getPaymentsStatus: paymentsRes.status,
      getPaymentsError: paymentsData?.message || paymentsData?.error || 'HTTP ' + paymentsRes.status,
      payments: [],
    }
  }

  // ⚠️ CRITICAL: Cashfree returns a direct JSON array, NOT { payments: [...] }
  const payments: any[] = Array.isArray(paymentsData)
    ? paymentsData
    : Array.isArray(paymentsData?.payments)
      ? paymentsData.payments
      : []
  console.log('[DIAGNOSTIC] Payment attempts found:', payments.length)
  payments.forEach((p: any, i: number) => {
    console.log(`[DIAGNOSTIC] Attempt ${i + 1}:`, {
      cf_payment_id: p.cf_payment_id,
      payment_status: p.payment_status,
      payment_amount: p.payment_amount,
      payment_currency: p.payment_currency,
      payment_method: p.payment_method,
    })
  })

  return {
    orderId,
    getOrderStatus: orderRes.status,
    orderDetails: {
      order_id: orderData.order_id,
      order_status: orderData.order_status,
      order_amount: orderData.order_amount,
      order_currency: orderData.order_currency,
    },
    getPaymentsStatus: paymentsRes.status,
    payments: payments.map((p: any) => ({
      cf_payment_id: p.cf_payment_id,
      payment_status: p.payment_status,
      payment_amount: p.payment_amount,
      payment_currency: p.payment_currency,
      payment_method: p.payment_method,
      payment_time: p.payment_time,
    })),
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' })

  try {
    const userId = await verifyJwt(req.headers.authorization)
    console.log('[DIAGNOSTIC] Authenticated user:', userId)

    const { orderId } = req.body as { orderId?: string }

    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required.' })
    }

    console.log('[DIAGNOSTIC] Diagnostic request for order:', orderId)

    const result = await queryCashfreeOrder(orderId)

    return res.status(200).json(result)
  } catch (err: any) {
    const msg = err?.message || 'Diagnostic query failed'
    console.error('[DIAGNOSTIC] Error:', msg)
    return res.status(500).json({ error: msg })
  }
}
