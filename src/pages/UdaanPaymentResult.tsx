import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Calendar,
  Clock,
  RefreshCw,
  Loader2,
  Sparkles,
  Mail,
  ShieldCheck,
} from 'lucide-react'

const ease = [0.16, 1, 0.3, 1] as const

type ResultState = 'loading' | 'success' | 'pending' | 'failed' | 'error'

interface EnrollmentInfo {
  id: string
  fullName: string
  email: string
  journey: string
  startsAt?: string
  endsAt?: string
  orderId: string
}

function formatDate(iso?: string): string {
  if (!iso) return 'Pending confirmation'
  try {
    return new Date(iso).toLocaleDateString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

// ─── Subtle Canvas Confetti ───────────────────────────────────────────────────
function ConfettiCanvas() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
      {[...Array(28)].map((_, i) => {
        const colors = ['#B77A22', '#1B3A6B', '#D4AF37', '#10B981', '#3B82F6']
        const color = colors[i % colors.length]
        const left = `${(i * 3.7) % 100}%`
        const size = 6 + (i % 6)
        const delay = (i * 0.08) % 1.5

        return (
          <motion.div
            key={i}
            initial={{ y: -20, opacity: 1, rotate: 0 }}
            animate={{
              y: ['0vh', '100vh'],
              opacity: [1, 1, 0],
              rotate: [0, 360 * (i % 2 === 0 ? 1 : -1)],
            }}
            transition={{
              duration: 3 + (i % 3),
              delay,
              repeat: Infinity,
              ease: 'linear',
            }}
            style={{
              position: 'absolute',
              top: '-20px',
              left,
              width: `${size}px`,
              height: `${size * 0.7}px`,
              backgroundColor: color,
              borderRadius: i % 3 === 0 ? '50%' : '2px',
            }}
          />
        )
      })}
    </div>
  )
}

export default function UdaanPaymentResult() {
  const [searchParams] = useSearchParams()
  const orderId = searchParams.get('order_id')

  const [status, setStatus] = useState<ResultState>('loading')
  const [enrollment, setEnrollment] = useState<EnrollmentInfo | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const verifyPayment = async (isManualRefresh = false) => {
    if (!orderId) {
      setStatus('error')
      setErrorMessage('No order reference found in URL.')
      return
    }

    if (isManualRefresh) setIsRefreshing(true)

    try {
      const res = await fetch('/api/udaan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-payment',
          orderId,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to verify payment status.')
      }

      if (data.verified && data.payment_status === 'completed') {
        setStatus('success')
        setEnrollment(data.enrollment)
      } else if (data.payment_status === 'pending') {
        setStatus('pending')
      } else if (data.payment_status === 'failed') {
        setStatus('failed')
        setErrorMessage(data.message || 'Payment was not completed.')
      } else {
        setStatus('pending')
      }
    } catch (err: any) {
      console.error('[UDAAN-RESULT] Error:', err)
      setStatus('error')
      setErrorMessage(err.message || 'An error occurred while verifying your payment.')
    } finally {
      if (isManualRefresh) setIsRefreshing(false)
    }
  }

  useEffect(() => {
    verifyPayment()
  }, [orderId])

  return (
    <div className="relative min-h-screen bg-ivory flex items-center justify-center p-4 sm:p-6 overflow-hidden">
      {status === 'success' && <ConfettiCanvas />}

      <div className="w-full max-w-xl relative z-10 my-8">
        {/* ─── LOADING STATE ──────────────────────────────────────────────── */}
        {status === 'loading' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-10 sm:p-12 text-center shadow-[0_20px_60px_rgba(7,26,53,0.08)] border border-navy/[0.04]"
          >
            <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="h-8 w-8 text-gold animate-spin" />
            </div>
            <h2 className="text-display-md font-display text-navy mb-2">Verifying Your Payment</h2>
            <p className="text-grey text-sm max-w-sm mx-auto">
              Confirming your Cashfree transaction and preparing your 30-day mentorship roadmap...
            </p>
          </motion.div>
        )}

        {/* ─── SUCCESS STATE ──────────────────────────────────────────────── */}
        {status === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease }}
            className="bg-white rounded-3xl p-8 sm:p-10 shadow-[0_24px_70px_rgba(7,26,53,0.12)] border border-navy/[0.05]"
          >
            {/* Success Icon */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 350, damping: 20, delay: 0.2 }}
              className="w-20 h-20 rounded-2xl bg-gold/12 border border-gold/30 flex items-center justify-center mx-auto mb-6 shadow-sm"
            >
              <CheckCircle2 className="h-10 w-10 text-gold" />
            </motion.div>

            {/* Eyebrow badge */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <span className="w-6 h-px bg-gold/60" />
              <span className="text-[11px] font-bold tracking-[0.2em] text-gold uppercase flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Enrollment Confirmed
              </span>
              <span className="w-6 h-px bg-gold/60" />
            </div>

            {/* Primary Heading */}
            <h1 className="text-display-lg font-display text-navy text-center mb-3">
              Your Udaan Begins Now!
            </h1>

            {/* Supporting Message */}
            <p className="text-grey text-center text-sm sm:text-base leading-relaxed max-w-md mx-auto mb-8">
              Your 30-day mentorship journey is confirmed. Our Helpamart team will contact you by email with your next steps.
            </p>

            {/* Details Card */}
            <div className="rounded-2xl bg-navy text-white p-6 mb-6 space-y-4 shadow-inner">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <span className="text-xs uppercase tracking-wider text-white/50 font-medium">Selected Journey</span>
                <span className="text-sm font-semibold text-gold bg-gold/10 px-3 py-1 rounded-full border border-gold/20">
                  {enrollment?.journey || '30-Day Mentorship'}
                </span>
              </div>

              <div className="flex items-start justify-between pb-3 border-b border-white/10">
                <span className="text-xs uppercase tracking-wider text-white/50 font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-gold" />
                  Mentorship Window
                </span>
                <div className="text-right">
                  <p className="text-xs text-white/90 font-medium">
                    {formatDate(enrollment?.startsAt)}
                  </p>
                  <p className="text-[11px] text-white/40">to {formatDate(enrollment?.endsAt)}</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50 font-medium">Order Reference</span>
                <span className="font-mono text-white/80 select-all">{orderId || enrollment?.orderId}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50 font-medium">Payment Verified</span>
                <span className="text-green-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  ₹149 INR via Cashfree
                </span>
              </div>
            </div>

            {/* Team Email Notice */}
            <div className="bg-ivory-light border border-gold/20 rounded-2xl p-4 mb-8 flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-xl bg-gold/15 flex items-center justify-center shrink-0 mt-0.5 text-gold">
                <Mail className="h-4 w-4" />
              </div>
              <p className="text-xs text-grey-dark leading-relaxed">
                We have sent your confirmation receipt. An assigned Helpamart mentor coordinator will reach out to{' '}
                <strong className="text-navy">{enrollment?.email}</strong> with your personalized onboarding roadmap and first check-in schedule.
              </p>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link
                to="/dashboard"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-navy text-white px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all shadow-[0_4px_16px_rgba(7,26,53,0.15)] group"
              >
                Go to My Dashboard
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-semibold text-sm border border-navy/15 text-navy hover:bg-ivory-dark/50 transition-colors"
              >
                Back to Helpamart
              </Link>
            </div>
          </motion.div>
        )}

        {/* ─── PENDING STATE ──────────────────────────────────────────────── */}
        {status === 'pending' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 sm:p-10 text-center shadow-[0_20px_60px_rgba(7,26,53,0.08)] border border-navy/[0.04]"
          >
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-6">
              <Clock className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-display-md font-display text-navy mb-3">
              We're Confirming Your Payment
            </h2>
            <p className="text-grey text-sm max-w-md mx-auto mb-6 leading-relaxed">
              Your payment is currently being acknowledged by the bank or UPI network. If you completed payment, it may take a few moments to reflect.
            </p>

            <div className="bg-ivory rounded-2xl p-4 text-xs font-mono text-grey mb-6">
              Order Ref: {orderId}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => verifyPayment(true)}
                disabled={isRefreshing}
                className="inline-flex items-center justify-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Checking...' : 'Check Status Again'}
              </button>
              <Link
                to="/"
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl font-semibold text-sm border border-navy/15 text-navy hover:bg-ivory-dark transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </motion.div>
        )}

        {/* ─── FAILED / ERROR STATE ───────────────────────────────────────── */}
        {(status === 'failed' || status === 'error') && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-8 sm:p-10 text-center shadow-[0_20px_60px_rgba(7,26,53,0.08)] border border-navy/[0.04]"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-display-md font-display text-navy mb-3">
              Payment Not Completed
            </h2>
            <p className="text-grey text-sm max-w-md mx-auto mb-6 leading-relaxed">
              {errorMessage || 'Your payment did not go through. No amount has been deducted. You can safely try again.'}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                to="/udaan-30"
                className="inline-flex items-center justify-center gap-2 bg-navy text-white px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-colors"
              >
                Return to Udaan 30 & Retry
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/"
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-xl font-semibold text-sm border border-navy/15 text-navy hover:bg-ivory-dark transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
