/**
 * HELPAMART — CashfreeCheckout Component
 *
 * Displays Cashfree Hosted Checkout for paid bookings.
 *
 * IMPORTANT: This component RECEIVES a pre-initialized payment session from BookingFlow.
 * It does NOT create a second Cashfree order.
 *
 * Flow:
 * 1. BookingFlow calls init-paid-booking to create:
 *    - Provisional booking
 *    - Cashfree order
 *    - payment_session_id
 *
 * 2. BookingFlow passes these to CashfreeCheckout:
 *    - bookingId
 *    - orderId
 *    - paymentSessionId
 *
 * 3. CashfreeCheckout opens Hosted Checkout using the supplied paymentSessionId
 *
 * 4. After payment attempt, CashfreeCheckout calls verify-payment to confirm
 *
 * Security:
 * - Amount is display-only; server recalculates from database
 * - Never creates a second Cashfree order
 * - Server-side JWT verification required
 * - Booking ownership verified on backend
 */

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from './Button'

declare global {
  interface Window {
    Cashfree?: {
      load: (libraryId: string) => void
      checkout: (config: any) => Promise<any>
    }
  }
}

interface CashfreeCheckoutProps {
  bookingId: string                  // Real booking UUID (from init-paid-booking)
  orderId: string                    // Cashfree order ID (from init-paid-booking)
  paymentSessionId: string           // Payment session ID (from init-paid-booking)
  amount: number                     // in cents (₹99 = 9900) — display only
  currency: string                   // 'INR'
  onSuccess?: (data: { bookingId: string; orderId: string }) => void
  onError?: (error: string) => void
  onCancel?: () => void
  onRetry?: () => void
}

export function CashfreeCheckout({
  bookingId,
  orderId,
  paymentSessionId,
  amount,
  onSuccess,
  onError,
  onCancel,
  onRetry,
}: CashfreeCheckoutProps) {
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const scriptLoadedRef = useRef(false)
  const checkoutOpenedRef = useRef(false)

  // Load Cashfree checkout script and open checkout
  useEffect(() => {
    if (scriptLoadedRef.current) return

    const script = document.createElement('script')
    script.src = 'https://sdk.cashfree.com/js/sdk/v3.js'
    script.async = true
    script.onload = () => {
      scriptLoadedRef.current = true
      console.log('[CASHFREE] Script loaded, opening checkout')
      openCheckout()
    }
    script.onerror = () => {
      console.error('[CASHFREE] Failed to load script')
      setError('Failed to load payment service. Please try again.')
      onError?.('Failed to load payment service')
    }
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  // Open Cashfree Hosted Checkout using the payment_session_id from init-paid-booking
  const openCheckout = async () => {
    if (checkoutOpenedRef.current) return
    checkoutOpenedRef.current = true

    console.log('[CASHFREE] Opening checkout with payment_session_id:', paymentSessionId.slice(0, 20) + '...')

    if (!window.Cashfree?.checkout) {
      setError('Payment service not available. Please refresh and try again.')
      onError?.('Payment service not available')
      return
    }

    try {
      const checkoutResponse = await window.Cashfree.checkout({
        paymentSessionId,
        redirectTarget: '_self',
      })
      console.log('[CASHFREE] Checkout returned:', checkoutResponse)

      // After Cashfree checkout closes, verify the payment
      // This gives Cashfree time to process and return
      setTimeout(() => {
        handleVerifyPayment()
      }, 500)
    } catch (err: any) {
      const msg = err?.message || 'Payment checkout error'
      console.error('[CASHFREE] Checkout error:', msg)
      setError(msg)
      onCancel?.()
    }
  }

  // Verify payment after user returns from Cashfree
  const handleVerifyPayment = async () => {
    if (verifying) return

    setVerifying(true)
    setError(null)
    console.log('[CASHFREE] Verifying payment for order:', orderId)

    try {
      // Get Supabase session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error('Your session has expired. Please sign in again.')
      }

      const response = await fetch('/api/cashfree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'verify-payment',
          bookingId,
          orderId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to verify payment (${response.status})`)
      }

      const result = await response.json()
      console.log('[CASHFREE] Verification result:', result)

      if (result.payment_status === 'completed') {
        console.log('[CASHFREE] Payment verified successfully')
        setPaymentFailed(false)
        onSuccess?.({ bookingId, orderId })
      } else if (result.payment_status === 'failed') {
        console.error('[CASHFREE] Payment failed:', result.error)
        setPaymentFailed(true)
        setError('Payment failed. ' + (result.error || 'Please try again.'))
        onError?.(result.error || 'Payment failed')
      } else {
        // Still pending - will be confirmed by webhook
        console.log('[CASHFREE] Payment pending, webhook will confirm')
        setPaymentFailed(false)
        onSuccess?.({ bookingId, orderId })
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to verify payment'
      console.error('[CASHFREE] Verification error:', msg)
      setError(msg)
      onError?.(msg)
    } finally {
      setVerifying(false)
    }
  }

  const amountInRupees = Math.round(amount / 100)
  const isProcessing = verifying

  const handleRetry = () => {
    setError(null)
    setPaymentFailed(false)
    checkoutOpenedRef.current = false
    onRetry?.()
  }

  return (
    <div className="cashfree-checkout space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          Payment Amount: <span className="font-bold text-lg text-blue-600">₹{amountInRupees}</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Secure payment via Cashfree Sandbox
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {isProcessing && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-600">Verifying your payment…</p>
        </div>
      )}

      {paymentFailed && (
        <Button
          onClick={handleRetry}
          variant="outline-gold"
          className="w-full"
        >
          Try Again
        </Button>
      )}
    </div>
  )
}
