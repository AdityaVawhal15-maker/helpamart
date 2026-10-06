/**
 * HELPAMART — CashfreeCheckout Component
 *
 * Displays Cashfree payment checkout UI for paid bookings.
 *
 * Flow:
 * 1. User clicks "Pay & Confirm Booking"
 * 2. Frontend calls /api/cashfree with action='create-order'
 * 3. Cashfree returns payment_session_id
 * 4. Load Cashfree hosted checkout widget
 * 5. User completes payment in Cashfree UI
 * 6. After successful payment, verify with backend via /api/cashfree verify-payment
 * 7. Backend updates booking status to 'confirmed'
 *
 * Security:
 * - Amount is display-only; server recalculates from database
 * - Never trust frontend amount for actual payment
 * - Server verifies booking ownership before creating order
 * - Webhook async verification for durability
 */

import { useState, useEffect, useRef } from 'react'
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
  bookingId: string
  amount: number // in cents (₹99 = 9900)
  currency: string // 'INR'
  onSuccess?: (data: { bookingId: string; orderId: string }) => void
  onError?: (error: string) => void
  onCancel?: () => void
  onRetry?: () => void
}

export function CashfreeCheckout({
  bookingId,
  amount,
  currency,
  onSuccess,
  onError,
  onCancel,
  onRetry,
}: CashfreeCheckoutProps) {
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [orderId, setOrderId] = useState<string | null>(null)
  const [paymentFailed, setPaymentFailed] = useState(false)
  const scriptLoadedRef = useRef(false)

  // Load Cashfree checkout script
  useEffect(() => {
    if (scriptLoadedRef.current) return

    const script = document.createElement('script')
    script.src = 'https://sdk.cashfree.com/js/sdk/v3.js'
    script.async = true
    script.onload = () => {
      scriptLoadedRef.current = true
      console.log('[CASHFREE] Script loaded')
      if (window.Cashfree) {
        ;(window.Cashfree as any).load('helpamart')
      }
    }
    script.onerror = () => {
      console.error('[CASHFREE] Failed to load script')
      setError('Failed to load payment service. Please try again.')
    }
    document.body.appendChild(script)

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  // Create payment order
  const handleCreateOrder = async () => {
    if (loading) return

    setLoading(true)
    setError(null)
    console.log('[CASHFREE] Creating payment order for booking:', bookingId)

    try {
      const token = localStorage.getItem('sb-token')
      if (!token) {
        throw new Error('Not authenticated. Please sign in.')
      }

      const response = await fetch('/api/cashfree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'create-order',
          bookingId,
          amount,
          currency,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Failed to create payment order (${response.status})`)
      }

      const { payment_session_id, order_id } = await response.json()
      console.log('[CASHFREE] Order created:', order_id)

      setOrderId(order_id)

      // Open Cashfree checkout
      if (window.Cashfree?.checkout) {
        const checkoutResponse = await window.Cashfree.checkout({
          paymentSessionId: payment_session_id,
          redirectTarget: '_self',
        })
        console.log('[CASHFREE] Checkout response:', checkoutResponse)

        // If user closes checkout without paying, handle gracefully
        if (checkoutResponse?.error) {
          setError('Payment cancelled or failed. Please try again.')
          onCancel?.()
        }
      } else {
        throw new Error('Payment service not available. Please refresh and try again.')
      }
    } catch (err: any) {
      const msg = err?.message || 'Failed to process payment'
      console.error('[CASHFREE] Error:', msg)
      setError(msg)
      onError?.(msg)
    } finally {
      setLoading(false)
    }
  }

  // Verify payment after user returns from Cashfree
  const handleVerifyPayment = async () => {
    if (!orderId || verifying) return

    setVerifying(true)
    setError(null)
    console.log('[CASHFREE] Verifying payment for order:', orderId)

    try {
      const token = localStorage.getItem('sb-token')
      if (!token) {
        throw new Error('Not authenticated.')
      }

      const response = await fetch('/api/cashfree', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'verify-payment',
          bookingId,
          orderId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to verify payment')
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
  const isProcessing = loading || verifying

  const handleRetry = () => {
    setError(null)
    setOrderId(null)
    setPaymentFailed(false)
    onRetry?.()
  }

  return (
    <div className="cashfree-checkout space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          Payment Amount: <span className="font-bold text-lg text-blue-600">₹{amountInRupees}</span>
        </p>
        <p className="text-xs text-gray-500 mt-2">
          You will be redirected to Cashfree secure payment page
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700 mb-3">{error}</p>
          {paymentFailed && (
            <Button
              onClick={handleRetry}
              disabled={isProcessing}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-2 text-sm"
            >
              {isProcessing ? 'Retrying...' : 'Try Again'}
            </Button>
          )}
        </div>
      )}

      {!orderId ? (
        <Button
          onClick={handleCreateOrder}
          disabled={isProcessing || paymentFailed}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2"
        >
          {isProcessing ? 'Processing...' : `Pay ₹${amountInRupees} & Confirm Booking`}
        </Button>
      ) : (
        <>
          <Button
            onClick={handleVerifyPayment}
            disabled={isProcessing}
            className="w-full bg-green-600 hover:bg-green-700 text-white py-2"
          >
            {isProcessing ? 'Verifying Payment...' : 'Verify Payment'}
          </Button>
          <Button
            onClick={onCancel}
            disabled={isProcessing}
            variant="outline-gold"
            className="w-full py-2"
          >
            Cancel
          </Button>
        </>
      )}
    </div>
  )
}
