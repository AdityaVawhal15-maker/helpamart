import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle, Calendar, Clock, Globe, ArrowLeft, Loader2, VideoIcon } from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { MentorService } from '@/types'

type State = {
  service: MentorService
  startAt: string
  timezone: string
}

type Step = 'confirm' | 'processing' | 'done'

export default function BookingFlow() {
  const { slug } = useParams<{ slug: string }>()
  const { state } = useLocation() as { state: State }
  const navigate = useNavigate()
  const { toast } = useToast()
  const [step, setStep] = useState<Step>('confirm')
  const [booking, setBooking] = useState<{ id: string; meetLink: string | null } | null>(null)

  if (!state?.service || !state?.startAt) {
    navigate(`/mentor/${slug}`, { replace: true })
    return null
  }

  const { service, startAt, timezone } = state
  const start = new Date(startAt)
  const end = new Date(start.getTime() + service.durationMinutes * 60 * 1000)

  function formatDate(d: Date) {
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: timezone })
  }
  function formatTime(d: Date) {
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone })
  }

  async function confirmBooking() {
    setStep('processing')
    try {
      const result = await api<{ booking: { id: string; meetLink: string | null } }>('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ mentorSlug: slug, serviceId: service.id, startAt, timezone }),
      })
      setBooking(result.booking)
      setStep('done')
    } catch (err: unknown) {
      toast((err as Error).message || 'Booking failed. Please try again.', 'error')
      setStep('confirm')
    }
  }

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
          <p className="text-grey mb-8 leading-relaxed">
            Your session has been confirmed. See you soon.
          </p>

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
              <div className="flex items-center justify-center gap-2 w-full py-3.5 bg-ivory-dark text-navy/50 rounded-xl text-sm">
                <VideoIcon className="h-4 w-4" />
                Meet link will be sent to your email
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
              <p className="text-xs text-grey font-medium uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold text-navy">
                {service.priceCents === 0 ? 'Free' : `$${(service.priceCents / 100).toFixed(2)}`}
              </p>
            </div>
          </div>

          {/* Notice */}
          <div className="bg-gold/8 border border-gold/20 rounded-xl p-4 mb-6">
            <p className="text-xs text-navy/70 leading-relaxed">
              By confirming, a Google Meet session will be generated (if configured). You'll receive confirmation details via your account.
            </p>
          </div>

          <button
            onClick={confirmBooking}
            disabled={step === 'processing'}
            className="w-full py-4 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all hover:shadow-[0_6px_24px_rgba(7,26,53,0.2)] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {step === 'processing' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Confirming your session…
              </>
            ) : 'Confirm Booking'}
          </button>
        </motion.div>
      </div>
    </div>
  )
}
