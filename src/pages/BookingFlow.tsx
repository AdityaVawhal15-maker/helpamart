import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Calendar, Clock, Globe, ArrowLeft, Loader2, VideoIcon, IndianRupee } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import type { MentorService } from '@/types'

type State = {
  service: MentorService
  startAt: string
  timezone: string
}

type BookingResult = {
  id: string
  meetLink: string | null
  calendarStatus: string | null
  calendarHtmlLink: string | null
  status: string
  priceCents: number
  currency: string
  isFirstSession: boolean
  startAt: string
  endAt: string
  mentorName: string
}

type Step = 'confirm' | 'processing' | 'done'

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

  // Determine first-session-free status from real booking history
  useEffect(() => {
    if (!user || !slug) { setCheckingPrice(false); return }
    let cancelled = false

    async function checkSessionCount() {
      try {
        const { data: mentorRow } = await supabase
          .from('mentors')
          .select('id')
          .eq('slug', slug!)
          .maybeSingle()

        if (cancelled) return
        if (!mentorRow) { setIsFirstSession(true); setCheckingPrice(false); return }

        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('mentee_id', user!.id)
          .eq('mentor_id', mentorRow.id)
          .in('status', ['confirmed', 'completed'])

        if (!cancelled) setIsFirstSession((count ?? 0) === 0)
      } catch {
        if (!cancelled) setIsFirstSession(true)
      } finally {
        if (!cancelled) setCheckingPrice(false)
      }
    }

    checkSessionCount()
    return () => { cancelled = true }
  }, [user, slug])

  const displayPriceCents = isFirstSession === true ? 0 : (service.priceCents ?? 9900)
  const displayCurrency = service.currency || 'INR'

  async function confirmBooking() {
    if (submitting) return
    if (!user) { navigate(`/login?next=/mentor/${slug}`); return }

    setSubmitting(true)
    setStep('processing')

    try {
      // Get Supabase JWT to authenticate the server-side API route
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      if (!token) throw new Error('Session expired. Please sign in again.')

      // Call the Vercel API route — handles Calendar, Meet, email, idempotency
      const res = await fetch(`${API_BASE}/api/book`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
        throw new Error((json as { error?: string }).error || 'Booking failed. Please try again.')
      }

      const result = json as { booking: BookingResult }
      if (!result?.booking?.id) throw new Error('Unexpected response from server.')

      setBooking(result.booking)
      setStep('done')
    } catch (err: unknown) {
      const msg = (err as Error).message || 'Booking failed. Please try again.'
      toast(msg, 'error')
      setStep('confirm')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === 'done' && booking) {
    // Build Google Calendar web URL — opens the user's own Google Calendar
    const calendarWebUrl = booking.calendarHtmlLink || 'https://calendar.google.com'

    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-md w-full bg-white rounded-3xl shadow-[0_20px_60px_rgba(7,26,53,0.12)] p-8 text-center"
        >
          <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-8 w-8 text-gold" />
          </div>
          <h1 className="text-display-md font-display text-navy mb-2">You&apos;re booked.</h1>
          <p className="text-grey mb-2 leading-relaxed">
            Your session with <strong className="text-navy">{booking.mentorName}</strong> has been confirmed.
          </p>
          {booking.isFirstSession && (
            <p className="text-sm text-gold font-semibold mb-6">First session — complimentary ✦</p>
          )}

          <div className="bg-ivory-light rounded-2xl p-5 text-left space-y-3 mb-8">
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
          </div>

          <div className="space-y-3">
            {/* Join Google Meet — only shown when real URL exists */}
            {booking.meetLink ? (
              <a
                href={booking.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full py-3.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all"
              >
                <VideoIcon className="h-4 w-4" />
                Join Google Meet
              </a>
            ) : booking.calendarStatus?.includes('error') || booking.calendarStatus === 'created_no_meet' ? (
              <div className="w-full py-3.5 bg-maroon/8 border border-maroon/20 text-maroon rounded-xl text-sm text-center">
                Google Meet could not be generated for this session. Please contact support.
              </div>
            ) : booking.calendarStatus === 'not_configured' ? (
              <div className="w-full py-3.5 bg-ivory-dark border border-grey-soft text-navy/60 rounded-xl text-sm text-center">
                Google Calendar is not configured on this server. Contact the HELPAMART admin.
              </div>
            ) : null}

            {/* Open Google Calendar */}
            <a
              href={calendarWebUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-3 border border-grey-soft text-navy rounded-xl font-medium text-sm hover:border-gold/40 hover:bg-ivory-light transition-colors"
            >
              <Calendar className="h-4 w-4 text-gold" />
              Open Google Calendar
            </a>

            <button
              onClick={() => navigate('/dashboard/bookings')}
              className="w-full py-3 border border-grey-soft text-navy rounded-xl font-medium text-sm hover:border-gold/40 transition-colors"
            >
              View My Bookings
            </button>
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
              {isFirstSession
                ? 'Your first session is complimentary. A Google Meet link will be generated and emailed to you.'
                : 'A Google Calendar event and Google Meet link will be created. You will receive confirmation by email.'}
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
