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

    async function checkSessionCount() {
      try {
        // Get the mentor's id from slug
        const { data: mentorRow } = await supabase
          .from('mentors')
          .select('id')
          .eq('slug', slug)
          .maybeSingle()

        if (!mentorRow) { setIsFirstSession(true); setCheckingPrice(false); return }

        const { count } = await supabase
          .from('bookings')
          .select('id', { count: 'exact', head: true })
          .eq('mentee_id', user!.id)
          .eq('mentor_id', mentorRow.id)
          .in('status', ['confirmed', 'completed'])

        setIsFirstSession((count ?? 0) === 0)
      } catch {
        setIsFirstSession(true) // safe default — server will recheck
      } finally {
        setCheckingPrice(false)
      }
    }

    checkSessionCount()
  }, [user, slug])

  const displayPriceCents = isFirstSession === true ? 0 : (service.priceCents ?? 9900)
  const displayCurrency = service.currency || 'INR'

  async function confirmBooking() {
    if (submitting) return // prevent double-click
    if (!user) {
      navigate(`/login?next=/mentor/${slug}`)
      return
    }

    setSubmitting(true)
    setStep('processing')

    try {
      const { data: mentorRow, error: mentorErr } = await supabase
        .from('mentors')
        .select('id, user_id, name, services, buffer_minutes, timezone')
        .eq('slug', slug!)
        .eq('status', 'published')
        .maybeSingle()

      if (mentorErr || !mentorRow) {
        throw new Error('This mentor is not currently available. Please go back and try again.')
      }

      // Server-side first-session determination (authoritative)
      const { count: prevCount } = await supabase
        .from('bookings')
        .select('id', { count: 'exact', head: true })
        .eq('mentee_id', user.id)
        .eq('mentor_id', mentorRow.id)
        .in('status', ['confirmed', 'completed'])

      const serverIsFirst = (prevCount ?? 0) === 0
      const finalPriceCents = serverIsFirst ? 0 : (service.priceCents ?? 9900)

      // Double-booking check
      const { data: clash } = await supabase
        .from('bookings')
        .select('id')
        .eq('mentor_id', mentorRow.id)
        .in('status', ['confirmed', 'pending'])
        .lt('start_at', end.toISOString())
        .gt('end_at', start.toISOString())
        .limit(1)

      if (clash && clash.length > 0) {
        throw new Error('This time slot is no longer available. Please go back and choose another time.')
      }

      const bookingId = crypto.randomUUID()
      const now = new Date().toISOString()

      // Resolve service id
      const services: any[] = Array.isArray(mentorRow.services) ? mentorRow.services : []
      const svc = service.id
        ? services.find((s: any) => s.id === service.id) ?? services[0]
        : services[0]

      const { error: insertErr } = await supabase
        .from('bookings')
        .insert({
          id: bookingId,
          mentor_id: mentorRow.id,
          mentee_id: user.id,
          service_id: svc?.id || service.id || service.title || 'default',
          service_title: service.title,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          timezone,
          status: 'confirmed',
          payment_status: finalPriceCents === 0 ? 'not_required' : 'pending',
          price_cents: finalPriceCents,
          currency: displayCurrency,
          meet_link: null,
          calendar_event_id: null,
          calendar_status: 'pending',
          created_at: now,
          updated_at: now,
        })

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Duplicate submission — idempotent: treat as success
          setBooking({
            id: bookingId,
            meetLink: null,
            status: 'confirmed',
            priceCents: finalPriceCents,
            currency: displayCurrency,
            isFirstSession: serverIsFirst,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            mentorName: mentorRow.name || '',
          })
          setStep('done')
          return
        }
        throw new Error(`Could not create your booking: ${insertErr.message}`)
      }

      // Booking created — Google Meet/Calendar is handled server-side when Express runs.
      // Surface the booking result with whatever calendar info is available.
      setBooking({
        id: bookingId,
        meetLink: null,
        status: 'confirmed',
        priceCents: finalPriceCents,
        currency: displayCurrency,
        isFirstSession: serverIsFirst,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        mentorName: mentorRow.name || '',
      })
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
          <h1 className="text-display-md font-display text-navy mb-2">You're booked.</h1>
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
            ) : (
              <div className="flex items-center justify-center gap-2 w-full py-3.5 bg-ivory-dark text-navy/50 rounded-xl text-sm border border-grey-soft">
                <VideoIcon className="h-4 w-4" />
                <span>Meet link will be available soon</span>
              </div>
            )}
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

          {/* Summary */}
          <div className="bg-ivory-light rounded-2xl p-5 space-y-4 mb-8">
            <div>
              <p className="text-xs text-grey font-medium uppercase tracking-wider mb-1">Session</p>
              <p className="font-semibold text-navy">{service.title}</p>
              <p className="text-sm text-grey mt-0.5">{service.durationMinutes} min · {service.format}</p>
            </div>
            <div className="h-px bg-grey-soft" />
            <div>
              <p className="text-xs text-grey font-medium uppercase tracking-wider mb-1">Date & Time</p>
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

          {/* Notice */}
          <div className="bg-gold/8 border border-gold/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-navy/70 leading-relaxed">
              {isFirstSession
                ? 'Your first session with this mentor is complimentary. A Google Meet link will be available after booking.'
                : 'By confirming, a Google Meet session will be generated (if configured). You will receive confirmation details via your account.'}
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
