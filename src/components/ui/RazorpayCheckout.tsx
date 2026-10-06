import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'

interface RazorpayCheckoutProps {
  bookingId: string
  razorpayOrderId: string
  razorpayKeyId: string
  amount: number // in paise
  currency: string // e.g., 'INR'
  onSuccess: (paymentId: string) => Promise<void> | void
  onError: (error: string) => void
  onCancel: () => void
  onRetry: () => void
}

declare global {
  interface Window {
    Razorpay: any
  }
}

export function RazorpayCheckout({
  bookingId,
  razorpayOrderId,
  razorpayKeyId,
  amount,
  currency,
  onSuccess,
  onError,
  onCancel,
  onRetry,
}: RazorpayCheckoutProps) {
  const checkoutOpenedRef = useRef(false)
  const processingRef = useRef(false)

  useEffect(() => {
    if (checkoutOpenedRef.current) return

    // Load Razorpay SDK
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => {
      openCheckout()
    }
    script.onerror = () => {
      onError('Failed to load payment gateway. Please refresh and try again.')
    }
    document.body.appendChild(script)

    return () => {
      // Cleanup
      if (document.body.contains(script)) {
        document.body.removeChild(script)
      }
    }
  }, [])

  const openCheckout = async () => {
    if (checkoutOpenedRef.current || processingRef.current) return

    try {
      if (!window.Razorpay) {
        throw new Error('Razorpay SDK not loaded')
      }

      const options = {
        key: razorpayKeyId, // Razorpay Key ID from environment
        amount: amount, // Amount in paise
        currency: currency,
        name: 'HELPAMART',
        description: 'Mentorship Session',
        order_id: razorpayOrderId, // Order ID from server
        handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
          processingRef.current = true
          try {
            console.log('[RAZORPAY] Payment success:', {
              paymentId: response.razorpay_payment_id,
              orderId: response.razorpay_order_id,
              signature: response.razorpay_signature,
            })

            // Verify payment on server
            const { data: sessionData } = await (await import('@/lib/supabase')).supabase.auth.getSession()
            const token = sessionData?.session?.access_token
            if (!token) throw new Error('Session expired')

            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'
            const verifyRes = await fetch(`${API_BASE}/api/razorpay`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({
                action: 'verify-payment',
                bookingId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            })

            const verifyJson = await verifyRes.json().catch(() => ({}))

            if (!verifyRes.ok) {
              const err = verifyJson as { error?: string }
              throw new Error(err.error || 'Payment verification failed')
            }

            console.log('[RAZORPAY] Payment verified successfully')
            await onSuccess(response.razorpay_payment_id)
          } catch (err) {
            console.error('[RAZORPAY] Payment verification error:', err)
            onError((err as Error).message || 'Payment verification failed')
          } finally {
            processingRef.current = false
          }
        },
        modal: {
          ondismiss: () => {
            console.log('[RAZORPAY] Checkout cancelled by user')
            onCancel()
          },
        },
        prefill: {
          name: '', // Can be filled with user name if available
          email: '', // Can be filled with user email if available
        },
        theme: {
          color: '#1a1a2e', // Navy color
        },
      }

      checkoutOpenedRef.current = true
      const razorpay = new window.Razorpay(options)
      razorpay.open()

      // Handle external close (if user closes without explicit cancel)
      razorpay.on('payment.failed', (response: { error: { code: string; description: string } }) => {
        console.error('[RAZORPAY] Payment failed:', response.error)
        onError(response.error.description || 'Payment failed')
      })
    } catch (err) {
      console.error('[RAZORPAY] Checkout error:', err)
      onError((err as Error).message || 'Failed to open payment checkout')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 text-gold animate-spin mb-4" />
      <p className="text-grey text-sm">Opening secure payment gateway...</p>
      <p className="text-xs text-grey/60 mt-2">Amount: ₹{amount / 100}</p>

      <button
        onClick={onRetry}
        className="mt-6 text-sm text-blue-600 hover:text-blue-700 underline"
      >
        Didn't open? Click here to retry
      </button>

      <button
        onClick={onCancel}
        className="mt-3 text-sm text-grey hover:text-navy transition-colors"
      >
        Cancel
      </button>
    </div>
  )
}
