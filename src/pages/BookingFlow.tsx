import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, Calendar, Clock, Globe, ArrowLeft, Loader2, VideoIcon, IndianRupee } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { RazorpayCheckout } from '@/components/ui/RazorpayCheckout'
import type { MentorService } from '@/types'

type State = {
  service: MentorService
  startAt: string
  timezone: string
}

type BookingResult = {
  id: string
  meetUrl?: string
  meetLink: string
  status: string
  priceCents: number
  currency: string
  isFirstSession: boolean
  startAt: string
  endAt: string
  mentorName: string
}

type Step = 'confirm' | 'payment' | 'processing' | 'done'

// Format ₹ or Free
function formatPrice(priceCents: number, currency = 'INR') {
  if (priceCents === 0) return 'Free'
  const amount = Math.round(priceCents / 100)
  if (currency === 'INR') return `₹${amount}`
  if (currency === 'USD') return `$${amount}`
  return `${currency} ${amount}`
}

// Canonical API base — in production this is the same origin (Vercel serverless).
// In local dev the Vite proxy forwards /api → Express on :8787.
const API_BASE = ''

export default function BookingFlow() {
  const { slug } = useParams<{ slug: string }>()
  const { state } = useLocation() as { state: State }
  const navigate = useNavigate()
  const { user } = useAuth()
  const { toast } = useToast()

  const [step, setStep] = useState<Step>('confirm')
  const [booking, setBooking] = useState<BookingResult | null>(null)
  const [isFirstSession, setIsFirstSession] = useState<boolean | null>(null)
  const [checkingPrice, setCheckingPrice] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [idempotencyKey] = useState(() => crypto.randomUUID())

  if (!state?.service || !state?.startAt) {
    navigate(`/mentor/${slug}`, { replace: true })
    return null
  }

  const { service, startAt, timezone } = state
  const start = new Date(startAt)
  const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000)

  function formatDate(d: Date) {
    return d.toLocaleDateString('en-IN', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      timeZone: timezone,
    })
  }
  function formatTime(d: Date) {
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
  }

  // Determine first-session-free status from real booking history (platform-wide)
  useEffect(() => {
    if (!user) { setCheckingPrice(false); return }
    let cancelled = false

    async function checkSessionCount() {
      try {
        // Query ALL successful bookings for this user across ALL mentors
        if (!user) return
        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('mentee_id', user.id)
          .in('status', ['confirmed', 'completed'])
          .in('payment_status', ['not_required', 'completed'])

        if (!cancelled) {
          const isFirst = (count ?? 0) === 0
          setIsFirstSession(isFirst)
          console.log('[BOOKING] Platform-wide first session check: isFirst=', isFirst, 'totalBookings=', count)
        }
      } catch (err) {
        console.error('[BOOKING] Session count error:', err)
        if (!cancelled) setIsFirstSession(true)
      } finally {
        if (!cancelled) setCheckingPrice(false)
      }
    }

    checkSessionCount()
    return () => { cancelled = true }
  }, [user])

  const displayPriceCents = isFirstSession === true ? 0 : (service.priceCents ?? 9900)
  const displayCurrency = service.currency || 'INR'

  async function confirmBooking() {
    if (submitting) return
    if (!user) { navigate(`/login?next=/mentor/${slug}`); return }

    setSubmitting(true)
    setStep('processing')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Session expired. Please sign in again.')

      // FLOW A: FREE FIRST SESSION
      if (displayPriceCents === 0) {
        console.log('[BOOKING] Free session flow - calling /api/book directly')
        
        const res = await fetch(`${API_BASE}/api/book`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            mentorSlug: slug,
            serviceId: service.id,
            startAt,
            timezone,
          }),
        })

        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          const errData = json as { error?: string }
          throw new Error(errData.error || 'Failed to create free booking. Please try again.')
        }

        const result = json as { booking: BookingResult }
        const meetUrl = result?.booking?.meetUrl || result?.booking?.meetLink
        if (!result?.booking?.id || !meetUrl) {
          throw new Error('Google Meet room could not be created. Please try again.')
        }

        console.log('[BOOKING] Free booking created successfully:', result.booking.id)
        setBooking({ ...result.booking, meetLink: meetUrl, meetUrl })
        setStep('done')
        return
      }

      // FLOW B: PAID SESSION (RAZORPAY)
      console.log('[BOOKING] Paid session flow - calling /api/razorpay to init order')
      
      const res = await fetch(`${API_BASE}/api/razorpay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: 'init-order',
          mentorSlug: slug,
          serviceId: service.id,
          startAt,
          timezone,
        }),
      })

      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        const errData = json as { error?: string }
        throw new Error(errData.error || 'Failed to initiate payment. Please try again.')
      }

      const { booking_id, razorpay_order_id, razorpay_key_id } = json as {
        booking_id: string
        razorpay_order_id: string
        razorpay_key_id: string
      }

      console.log('[BOOKING] Razorpay order initialized:', razorpay_order_id)

      // Store for Razorpay component
      sessionStorage.setItem('pendingBookingId', booking_id)
      sessionStorage.setItem('razorpayOrderId', razorpay_order_id)
      sessionStorage.setItem('razorpayKeyId', razorpay_key_id)

      setStep('payment')
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Booking failed. Please try again.'
      toast(msg, 'error')
      setStep('confirm')
    } finally {
      setSubmitting(false)
    }
  }


  if (step === 'payment') {
    const bookingId = sessionStorage.getItem('pendingBookingId')

    if (!bookingId) {
      return (
        <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
          <div className="max-w-md w-full text-center">
            <p className="text-red-600">Error: Payment initialization failed.</p>
            <button
              onClick={() => {
                setStep('confirm')
                sessionStorage.removeItem('pendingBookingId')
                sessionStorage.removeItem('razorpayOrderId')
                sessionStorage.removeItem('razorpayKeyId')
              }}
              className="mt-4 text-blue-600 hover:underline"
            >
              Go Back
            </button>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
        <div className="max-w-md w-full">
          <button
            onClick={() => {
              setStep('confirm')
              sessionStorage.removeItem('pendingBookingId')
              sessionStorage.removeItem('razorpayOrderId')
              sessionStorage.removeItem('razorpayKeyId')
            }}
            className="flex items-center gap-2 text-sm text-grey hover:text-navy transition-colors mb-8 group"
          >
            <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl shadow-soft p-8"
          >
            <h1 className="text-display-md font-display text-navy mb-1">Complete payment</h1>
            <p className="text-grey text-sm mb-8">Secure payment via Razorpay</p>

            <RazorpayCheckout
              bookingId={bookingId}
              razorpayOrderId={sessionStorage.getItem('razorpayOrderId') || ''}
              razorpayKeyId={sessionStorage.getItem('razorpayKeyId') || ''}
              amount={displayPriceCents}
              currency={displayCurrency}
              onSuccess={async () => {
                // Clear session storage
                sessionStorage.removeItem('pendingBookingId')
                sessionStorage.removeItem('razorpayOrderId')
                sessionStorage.removeItem('razorpayKeyId')
                
                // Fetch the completed booking
                try {
                  const { data: sessionData } = await supabase.auth.getSession()
                  const token = sessionData?.session?.access_token
                  if (!token) throw new Error('Session expired')

                  const res = await fetch(`${API_BASE}/api/book-finalize`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ bookingId }),
                  })

                  const json = await res.json().catch(() => ({}))
                  if (!res.ok) throw new Error(json.error || 'Failed to finalize booking')

                  const result = json as { booking: BookingResult }
                  setBooking(result.booking)
                  setStep('done')
                } catch (err) {
                  toast((err as Error).message || 'Failed to finalize booking', 'error')
                  setStep('confirm')
                }
              }}
              onError={(error: string) => {
                toast(error, 'error')
              }}
              onCancel={() => {
                setStep('confirm')
                sessionStorage.removeItem('pendingBookingId')
                sessionStorage.removeItem('razorpayOrderId')
                sessionStorage.removeItem('razorpayKeyId')
              }}
              onRetry={() => {
                setStep('confirm')
                sessionStorage.removeItem('pendingBookingId')
                sessionStorage.removeItem('razorpayOrderId')
                sessionStorage.removeItem('razorpayKeyId')
              }}
            />

            <div className="bg-gold/8 border border-gold/20 rounded-xl p-4 mt-6">
              <p className="text-xs text-navy/70 leading-relaxed">
                Your booking will be confirmed after successful payment.
                A Google Meet link will be generated and sent to both you and your mentor.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === 'done' && booking) {
    const meetUrl = booking.meetUrl || booking.meetLink

    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full bg-white rounded-3xl shadow-[0_20px_60px_rgba(7,26,53,0.12)] p-8 text-center relative overflow-hidden"
        >
          {/* Premium confetti burst — soft gold particles */}
          <ConfettiBurst />

          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
              className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6"
            >
              <CheckCircle className="h-8 w-8 text-gold" />
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.5 }}
              className="text-display-md font-display text-navy mb-2"
            >
              You&apos;re booked.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.45, duration: 0.5 }}
              className="text-grey mb-2 leading-relaxed"
            >
              Your session with <strong className="text-navy">{booking.mentorName}</strong> has been confirmed.
            </motion.p>
            {booking.isFirstSession && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.4 }}
                className="text-sm text-gold font-semibold mb-6"
              >
                First session — complimentary ✦
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="bg-ivory-light rounded-2xl p-5 text-left space-y-3 mb-8"
            >
              <div className="flex items-start gap-3">
                <Calendar className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-grey">Date</p>
                  <p className="text-sm font-medium text-navy">{formatDate(start)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-grey">Time</p>
                  <p className="text-sm font-medium text-navy">{formatTime(start)} – {formatTime(end)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Globe className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-grey">Timezone</p>
                  <p className="text-sm font-medium text-navy">{timezone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <IndianRupee className="h-4 w-4 text-gold mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-grey">Amount</p>
                  <p className="text-sm font-medium text-navy">{formatPrice(booking.priceCents, booking.currency)}</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              className="space-y-3"
            >
              {/* JOIN GOOGLE MEET — real URL returned from Google Meet REST API */}
              <a
                href={meetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-4 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid hover:shadow-[0_6px_20px_rgba(7,26,53,0.2)] transition-all cursor-pointer text-sm"
              >
                <VideoIcon className="h-4 w-4" />
                JOIN GOOGLE MEET
              </a>

              {/* VIEW MY BOOKINGS */}
              <button
                onClick={() => navigate('/dashboard/bookings')}
                className="w-full py-3.5 border border-grey-soft text-navy rounded-xl font-semibold text-sm hover:border-gold/40 hover:bg-ivory-light transition-colors"
              >
                VIEW MY BOOKINGS
              </button>

              {/* OPEN / VIEW SESSION DETAILS */}
              <button
                onClick={() => navigate('/dashboard/bookings')}
                className="w-full py-2.5 text-grey hover:text-navy text-xs font-semibold tracking-wider uppercase transition-colors"
              >
                VIEW SESSION DETAILS
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Confirm screen ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-grey hover:text-navy transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-3xl shadow-soft p-8"
        >
          <h1 className="text-display-md font-display text-navy mb-1">Confirm your session</h1>
          <p className="text-grey text-sm mb-8">Review the details below before booking.</p>

          <div className="bg-ivory-light rounded-2xl p-5 space-y-4 mb-8">
            <div>
              <p className="text-xs text-grey font-medium uppercase tracking-wider mb-1">Session</p>
              <p className="font-semibold text-navy">{service.title}</p>
              <p className="text-sm text-grey mt-0.5">{service.durationMinutes} min · {service.format}</p>
            </div>
            <div className="h-px bg-grey-soft" />
            <div>
              <p className="text-xs text-grey font-medium uppercase tracking-wider mb-1">Date &amp; Time</p>
              <p className="font-semibold text-navy">{formatDate(start)}</p>
              <p className="text-sm text-grey mt-0.5">{formatTime(start)} – {formatTime(end)} · {timezone}</p>
            </div>
            <div className="h-px bg-grey-soft" />
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-grey font-medium uppercase tracking-wider">Total</p>
                {isFirstSession === true && (
                  <p className="text-[0.6875rem] text-gold mt-0.5">First session — complimentary</p>
                )}
              </div>
              {checkingPrice ? (
                <div className="flex items-center gap-1.5 text-grey text-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Calculating…
                </div>
              ) : (
                <p className="text-lg font-bold text-navy">
                  {formatPrice(displayPriceCents, displayCurrency)}
                </p>
              )}
            </div>
          </div>

          <div className="bg-gold/8 border border-gold/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-navy/70 leading-relaxed">
              A Google Meet link will be generated automatically for your session.
              Confirmation emails with the meeting link will be sent to both you and your mentor.
            </p>
          </div>

          <button
            onClick={confirmBooking}
            disabled={step === 'processing' || submitting || checkingPrice}
            className="w-full py-4 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all hover:shadow-[0_6px_24px_rgba(7,26,53,0.2)] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {step === 'processing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming your session…
              </>
            ) : (
              'Confirm Booking'
            )}
          </button>
        </motion.div>
      </div>
    </div>
  )
}

// ─── Premium celebration: soft gold confetti burst ────────────────────────────
// Uses Framer Motion to animate a small number of minimal gold/cream particles
// that burst outward for ~1 second on the booking success screen.
// Deliberately subtle — no childish colors, no full-screen takeover.
function ConfettiBurst() {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    // Alternate between HELPAMART gold, ivory, and navy
    color: i % 3 === 0 ? '#B77A22' : i % 3 === 1 ? '#F5F0E8' : '#071A35',
    angle: (360 / 18) * i,
    distance: 60 + (i % 4) * 20,
    size: i % 3 === 0 ? 6 : 4,
    delay: (i % 5) * 0.04,
    shape: i % 2 === 0 ? 'circle' : 'rect',
  }))

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center overflow-hidden">
      <AnimatePresence>
        {particles.map(p => {
          const rad = (p.angle * Math.PI) / 180
          const x = Math.cos(rad) * p.distance
          const y = Math.sin(rad) * p.distance
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
              animate={{ opacity: [0, 1, 1, 0], x, y, scale: [0, 1, 1, 0.5] }}
              transition={{ duration: 1.1, delay: p.delay, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                width: p.size,
                height: p.shape === 'rect' ? p.size * 2 : p.size,
                borderRadius: p.shape === 'circle' ? '50%' : 2,
                backgroundColor: p.color,
                opacity: 0.7,
              }}
            />
          )
        })}
      </AnimatePresence>
    </div>
  )
}
