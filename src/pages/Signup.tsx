import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, User, ArrowRight, Loader2, AlertCircle, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { sendEmailOtp, verifyEmailOtp, signInWithGoogle } from '@/lib/supabase'
import OtpInput from '@/components/ui/OtpInput'

export default function Signup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { user, loading: authLoading, syncSupabaseSession } = useAuth()
  const next = params.get('next') || '/dashboard'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && user) {
      navigate(next, { replace: true })
    }
  }, [user, authLoading, navigate, next])

  // Countdown timer for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0))
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  async function handleSendOtp() {
    const cleanName = name.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (!cleanName) {
      setError('Please enter your full name.')
      return
    }
    if (!cleanEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setError('Please enter a valid email address.')
      return
    }

    setLoading(true)
    setError('')
    setSuccessMsg('')
    try {
      await sendEmailOtp({ email: cleanEmail, isSignUp: true, name: cleanName })
      setOtpSent(true)
      setResendCooldown(60)
      setSuccessMsg('A 6-digit verification code was sent to your email.')
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.toLowerCase().includes('rate limit')) {
        setError('Too many attempts. Please wait a moment before requesting another code.')
      } else {
        setError(msg || 'Unable to send verification code. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(codeToVerify?: string) {
    const code = (codeToVerify || otpCode).trim()
    if (code.length < 6) {
      setError('Please enter all 6 digits of your verification code.')
      return
    }

    setLoading(true)
    setError('')
    try {
      await verifyEmailOtp({ email: email.trim().toLowerCase(), token: code })
      await syncSupabaseSession()
      navigate(next, { replace: true })
    } catch (e: any) {
      const msg = e?.message || ''
      if (msg.toLowerCase().includes('expired')) {
        setError('Your verification code has expired. Please click resend to get a new code.')
      } else if (msg.toLowerCase().includes('invalid') || msg.toLowerCase().includes('token')) {
        setError('Incorrect verification code. Please check your email and try again.')
      } else {
        setError(msg || 'Verification failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResendCode() {
    if (resendCooldown > 0 || loading) return
    setError('')
    setSuccessMsg('')
    setLoading(true)
    try {
      await sendEmailOtp({ email: email.trim().toLowerCase(), isSignUp: true, name: name.trim() })
      setResendCooldown(60)
      setOtpCode('')
      setSuccessMsg('A fresh verification code has been sent.')
    } catch (e: any) {
      setError(e?.message || 'Could not resend code. Please try again in a moment.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true)
    setError('')
    try {
      await signInWithGoogle(next)
    } catch (e: any) {
      setError(e?.message || 'Google sign-up could not be started. Please try again.')
      setGoogleLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-ivory flex">
      {/* Left visual branding */}
      <div className="hidden lg:flex lg:flex-1 relative bg-navy overflow-hidden">
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-12 left-12 right-12 bottom-12 flex flex-col justify-between z-10">
          <Link to="/" className="inline-block" aria-label="HELPAMART home">
            <img
              src="/helpamart-logo.png"
              alt="HELPAMART"
              className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_0_1.5px_rgba(255,255,255,0.7)]"
            />
          </Link>
          <div>
            <blockquote className="text-display-lg font-display text-white leading-tight mb-6">
              "Your experience could
              <br />
              <em style={{ color: 'var(--color-gold-light)', fontStyle: 'italic' }}>
                change someone's direction.
              </em>
              "
            </blockquote>
            <p className="text-white/60 text-sm max-w-md leading-relaxed">
              Join as a mentee looking for guidance, or as a mentor ready to share your knowledge with
              the world.
            </p>
          </div>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="h-px bg-gradient-to-r from-transparent via-gold to-transparent origin-left"
          />
        </div>
      </div>

      {/* Right authentication form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden inline-block mb-8" aria-label="HELPAMART home">
            <img
              src="/helpamart-logo.png"
              alt="HELPAMART"
              className="h-12 w-auto object-contain"
            />
          </Link>

          <AnimatePresence mode="wait">
            {!otpSent ? (
              <motion.div
                key="signup-fields"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <h1 className="text-display-md font-display text-navy mb-1.5">
                  Create your account.
                </h1>
                <p className="text-grey text-sm mb-7">Start your journey with HELPAMART today.</p>

                {/* Google Sign In/Up */}
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 bg-white border border-grey-soft rounded-xl py-3 px-4 text-sm font-semibold text-navy hover:border-navy/30 hover:bg-ivory-dark/50 active:scale-[0.99] transition-all shadow-soft disabled:opacity-50 cursor-pointer"
                  aria-label="Continue with Google"
                >
                  {googleLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-navy" />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.97 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  )}
                  <span>Continue with Google</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-grey-soft" />
                  <span className="text-xs uppercase tracking-wider text-grey font-medium">
                    or continue with email
                  </span>
                  <div className="flex-1 h-px bg-grey-soft" />
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 bg-maroon/[0.08] border border-maroon/20 rounded-xl p-3 mb-4 text-xs text-maroon font-medium leading-relaxed"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1">{error}</div>
                  </motion.div>
                )}

                {/* Name & Email Fields */}
                <div className="space-y-4">
                  <div>
                    <label className="field-label" htmlFor="name-input">
                      Your Full Name
                    </label>
                    <div className="relative">
                      <input
                        id="name-input"
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          if (error) setError('')
                        }}
                        placeholder="John Doe"
                        className="field-input pl-10"
                        autoFocus
                        autoComplete="name"
                        disabled={loading}
                      />
                      <User className="h-4 w-4 text-grey absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="field-label" htmlFor="email-input">
                      Email Address
                    </label>
                    <div className="relative">
                      <input
                        id="email-input"
                        type="email"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value)
                          if (error) setError('')
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                        placeholder="you@example.com"
                        className="field-input pl-10"
                        autoComplete="email"
                        disabled={loading}
                      />
                      <Mail className="h-4 w-4 text-grey absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading || !name.trim() || !email.trim()}
                    className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 group cursor-pointer shadow-soft"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="signup-otp"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false)
                      setOtpCode('')
                      setError('')
                      setSuccessMsg('')
                    }}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-grey hover:text-navy transition-colors mb-4 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Change email or name</span>
                  </button>
                  <h1 className="text-display-md font-display text-navy mb-1.5">Verify your email.</h1>
                  <p className="text-grey text-sm">
                    We sent a 6-digit code to{' '}
                    <span className="font-semibold text-navy break-all">{email}</span>
                  </p>
                </div>

                {/* Success Banner */}
                {successMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 text-xs text-emerald-800 font-medium"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>{successMsg}</span>
                  </motion.div>
                )}

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-start gap-2.5 bg-maroon/[0.08] border border-maroon/20 rounded-xl p-3 mb-4 text-xs text-maroon font-medium leading-relaxed"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div className="flex-1">{error}</div>
                  </motion.div>
                )}

                {/* 6-box OTP component */}
                <div className="mb-5">
                  <label className="field-label block mb-2">Enter 6-digit verification code</label>
                  <OtpInput
                    length={6}
                    value={otpCode}
                    onChange={(val) => {
                      setOtpCode(val)
                      if (error) setError('')
                    }}
                    onComplete={(val) => handleVerifyOtp(val)}
                    disabled={loading}
                    hasError={Boolean(error)}
                    autoFocus
                  />
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={() => handleVerifyOtp()}
                    disabled={loading || otpCode.length < 6}
                    className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-soft"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <span>Complete Account Setup</span>
                    )}
                  </button>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={handleResendCode}
                      disabled={resendCooldown > 0 || loading}
                      className="text-xs font-semibold text-gold hover:text-gold-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOtpSent(false)
                        setOtpCode('')
                        setError('')
                        setSuccessMsg('')
                      }}
                      className="text-xs text-grey hover:text-navy transition-colors cursor-pointer"
                    >
                      Change details?
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-sm text-grey mt-8">
            Already have an account?{' '}
            <Link
              to={`/login${next !== '/dashboard' ? `?next=${next}` : ''}`}
              className="text-navy font-semibold hover:text-gold transition-colors"
            >
              Sign in
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
