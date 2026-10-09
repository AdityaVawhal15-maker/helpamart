/**
 * HELPAMART — /booking-payment-result
 *
 * Post-payment return page for Cashfree Live/Production payments.
 * Cashfree redirects here after payment attempt with order_id in query string.
 *
 * This component:
 * 1. Extracts order_id from URL
 * 2. Calls backend to verify payment with Cashfree
 * 3. Shows appropriate success/failure/pending state
 * 4. Triggers booking finalization if payment successful
 * 5. Displays session details and Google Meet link
 */

import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { X, Clock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import BookingSuccessDisplay from '@/components/BookingSuccessDisplay'

type PaymentState = 'loading' | 'verifying' | 'success' | 'failed' | 'pending' | 'error'

interface BookingDetails {
  id: string
  mentorName: string
  serviceTitle: string
  startAt: string
  endAt: string
  timezone: string
  meetUrl: string
  amount: number
  currency: string
}

export default function BookingPaymentResult() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [state, setState] = useState<PaymentState>('loading')
  const [booking, setBooking] = useState<BookingDetails | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  const orderId = searchParams.get('order_id')

  useEffect(() => {
    if (!orderId) {
      setState('error')
      setErrorMsg('Missing order ID')
      return
    }

    // Wait for auth context to load
    if (authLoading) {
      setState('loading')
      return
    }

    // If user is not authenticated, prompt them to sign in
    if (!user) {
      setState('error')
      setErrorMsg('Your session has expired. Please sign in to continue.')
      return
    }

    const verifyAndFinalize = async () => {
      setState('verifying')

      try {
        // Get fresh session token
        const { data: { session } } = await supabase.auth.getSession()
        if (!session?.access_token) {
          setState('error')
          setErrorMsg('Your session has expired. Please sign in again.')
          return
        }

        // Step 1: Call backend to verify payment with Cashfree
        console.log('[PAYMENT-RESULT] Verifying payment for order:', orderId, 'user:', user.id)

        const verifyRes = await fetch('/api/cashfree-verify-payment', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ orderId }),
        })

        if (!verifyRes.ok) {
          const errorData = await verifyRes.json().catch(() => ({}))
          const msg = (errorData as any).error || 'Failed to verify payment'
          console.error('[PAYMENT-RESULT] Verification failed:', verifyRes.status, msg)
          
          // If 401, session might have expired, show retry option
          if (verifyRes.status === 401) {
            setState('error')
            setErrorMsg('Session expired. Please refresh the page to try again.')
            return
          }
          
          setState('error')
          setErrorMsg(msg)
          return
        }

        const verifyData = await verifyRes.json()
        console.log('[PAYMENT-RESULT] Verification result:', verifyData.paymentStatus)

        if (verifyData.paymentStatus === 'completed') {
          // If booking already has a Meet link (e.g. from prior finalization or recovery), display success immediately
          if (verifyData.meetLink) {
            console.log('[PAYMENT-RESULT] Booking already finalized with meetLink:', verifyData.meetLink)
            setBooking({
              id: verifyData.bookingId,
              mentorName: verifyData.mentorName,
              serviceTitle: verifyData.serviceTitle,
              startAt: verifyData.startAt,
              endAt: verifyData.endAt,
              timezone: verifyData.timezone,
              meetUrl: verifyData.meetLink,
              amount: verifyData.amount,
              currency: verifyData.currency,
            })
            setState('success')
            return
          }

          // Step 2: Call book-finalize to complete the flow
          console.log('[PAYMENT-RESULT] Payment verified, finalizing booking:', verifyData.bookingId)

          const finalizeRes = await fetch('/api/book-finalize', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ bookingId: verifyData.bookingId }),
          })

          if (!finalizeRes.ok) {
            const errorData = await finalizeRes.json().catch(() => ({}))
            const msg = (errorData as any).error || 'Failed to finalize booking'
            console.error('[PAYMENT-RESULT] Finalization failed:', msg)
            setState('error')
            setErrorMsg(msg)
            return
          }

          const finalizeData = await finalizeRes.json()
          console.log('[PAYMENT-RESULT] Booking finalized:', finalizeData.booking)

          // Display success with booking details
          setBooking({
            id: finalizeData.booking.id,
            mentorName: verifyData.mentorName,
            serviceTitle: verifyData.serviceTitle,
            startAt: verifyData.startAt,
            endAt: verifyData.endAt,
            timezone: verifyData.timezone,
            meetUrl: finalizeData.booking.meetUrl,
            amount: verifyData.amount,
            currency: verifyData.currency,
          })

          setState('success')
        } else if (verifyData.paymentStatus === 'failed') {
          console.error('[PAYMENT-RESULT] Payment failed')
          setState('failed')
          setErrorMsg(verifyData.error || 'Payment was not successful')
        } else if (verifyData.paymentStatus === 'pending') {
          console.log('[PAYMENT-RESULT] Payment still pending')
          setState('pending')
          setErrorMsg(
            'Payment is still being processed. It may take a few minutes. Check your email for confirmation.',
          )
        }
      } catch (err: any) {
        const msg = err?.message || 'An unexpected error occurred'
        console.error('[PAYMENT-RESULT] Error:', msg)
        setState('error')
        setErrorMsg(msg)
      }
    }

    verifyAndFinalize()
  }, [orderId, user, authLoading])

  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-md w-full"
      >
        {state === 'loading' || state === 'verifying' ? (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full border-3 border-gold border-t-transparent animate-spin mx-auto mb-4" />
            <h1 className="text-display-md font-display text-navy mb-2">
              {state === 'loading' ? 'Loading' : 'Verifying Payment'}
            </h1>
            <p className="text-grey text-sm">
              {state === 'loading' ? 'Please wait...' : 'Checking with Cashfree...'}
            </p>
          </div>
        ) : state === 'success' && booking ? (
          <div className="bg-white rounded-3xl shadow-[0_20px_60px_rgba(7,26,53,0.12)] p-8 text-center relative overflow-hidden">
            <BookingSuccessDisplay
              mentorName={booking.mentorName}
              startAt={booking.startAt}
              endAt={booking.endAt}
              timezone={booking.timezone}
              meetUrl={booking.meetUrl}
              priceCents={booking.amount}
              currency={booking.currency}
              isFirstSession={false}
            />
          </div>
        ) : state === 'failed' ? (
          <div>
            <div className="bg-red-50 border border-red-200 rounded-3xl p-8 mb-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <h1 className="text-display-md font-display text-navy mb-2">Payment Failed</h1>
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => navigate(-1)}
                variant="primary"
                className="w-full"
              >
                Try Again
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline-gold"
                className="w-full"
              >
                Go Home
              </Button>
            </div>
          </div>
        ) : state === 'pending' ? (
          <div>
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-8 mb-8 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <h1 className="text-display-md font-display text-navy mb-2">Payment Pending</h1>
              <p className="text-amber-700 text-sm">{errorMsg}</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
                className="w-full"
              >
                Check Status Again
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline-gold"
                className="w-full"
              >
                Go Home
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="bg-red-50 border border-red-200 rounded-3xl p-8 mb-8 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                <X className="w-6 h-6 text-red-600" />
              </div>
              <h1 className="text-display-md font-display text-navy mb-2">Error</h1>
              <p className="text-red-700 text-sm">{errorMsg || 'Something went wrong'}</p>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
                className="w-full"
              >
                Refresh & Try Again
              </Button>
              <Button
                onClick={() => navigate('/dashboard/bookings')}
                variant="outline-gold"
                className="w-full"
              >
                View Your Bookings
              </Button>
              <Button
                onClick={() => navigate('/')}
                variant="outline-gold"
                className="w-full"
              >
                Go Home
              </Button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
