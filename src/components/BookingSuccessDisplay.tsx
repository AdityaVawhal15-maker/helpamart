/**
 * BookingSuccessDisplay
 *
 * Reusable success page for both FREE and PAID bookings.
 * Used by BookingFlow (FREE and PAID after finalization) and BookingPaymentResult (PAID after Cashfree).
 *
 * Shows:
 * - "You're booked."
 * - Mentor name
 * - Session details (date, time, timezone)
 * - Amount (Free or ₹99 — Paid)
 * - JOIN GOOGLE MEET button
 * - VIEW MY BOOKINGS button
 * - VIEW SESSION DETAILS button
 */

import { motion } from 'framer-motion'
import { CheckCircle, Calendar, Clock, Globe, IndianRupee, VideoIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

interface BookingSuccessDisplayProps {
  mentorName: string
  startAt: string
  endAt: string
  timezone: string
  meetUrl: string
  priceCents: number
  currency: string
  isFirstSession?: boolean
}

export default function BookingSuccessDisplay({
  mentorName,
  startAt,
  endAt,
  timezone,
  meetUrl,
  priceCents,
  currency,
  isFirstSession,
}: BookingSuccessDisplayProps) {
  const navigate = useNavigate()

  function formatPrice(cents: number, curr = 'INR') {
    if (cents === 0) return 'Free'
    const amount = Math.round(cents / 100)
    if (curr === 'INR') return `₹${amount}`
    if (curr === 'USD') return `$${amount}`
    return `${curr} ${amount}`
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('en-IN', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: timezone,
    })
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    })
  }

  const displayPrice = formatPrice(priceCents, currency)
  const isPaid = priceCents > 0

  return (
    <div className="relative z-10">
      {/* Animated icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6"
      >
        <CheckCircle className="h-8 w-8 text-gold" />
      </motion.div>

      {/* Title */}
      <motion.h1
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="text-display-md font-display text-navy mb-2"
      >
        You&apos;re booked.
      </motion.h1>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.5 }}
        className="text-grey mb-2 leading-relaxed"
      >
        Your session with <strong className="text-navy">{mentorName}</strong> has been confirmed.
      </motion.p>

      {/* First session badge (FREE only) */}
      {isFirstSession && !isPaid && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="text-sm text-gold font-semibold mb-6"
        >
          First session — complimentary ✦
        </motion.p>
      )}

      {/* Session details card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="bg-ivory-light rounded-2xl p-5 text-left space-y-3 mb-8"
      >
        {/* Date */}
        <div className="flex items-start gap-3">
          <Calendar className="h-4 w-4 text-gold mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-grey">Date</p>
            <p className="text-sm font-medium text-navy">{formatDate(startAt)}</p>
          </div>
        </div>

        {/* Time */}
        <div className="flex items-start gap-3">
          <Clock className="h-4 w-4 text-gold mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-grey">Time</p>
            <p className="text-sm font-medium text-navy">
              {formatTime(startAt)} – {formatTime(endAt)}
            </p>
          </div>
        </div>

        {/* Timezone */}
        <div className="flex items-start gap-3">
          <Globe className="h-4 w-4 text-gold mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-grey">Timezone</p>
            <p className="text-sm font-medium text-navy">{timezone}</p>
          </div>
        </div>

        {/* Amount */}
        <div className="flex items-start gap-3">
          <IndianRupee className="h-4 w-4 text-gold mt-0.5 shrink-0" />
          <div>
            <p className="text-xs text-grey">Amount</p>
            <p className="text-sm font-medium text-navy">
              {displayPrice}
              {isPaid && ' — Paid'}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Action buttons */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 0.5 }}
        className="space-y-3"
      >
        {/* JOIN GOOGLE MEET */}
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

        {/* VIEW SESSION DETAILS */}
        <button
          onClick={() => navigate('/dashboard/bookings')}
          className="w-full py-2.5 text-grey hover:text-navy text-xs font-semibold tracking-wider uppercase transition-colors"
        >
          VIEW SESSION DETAILS
        </button>
      </motion.div>
    </div>
  )
}
