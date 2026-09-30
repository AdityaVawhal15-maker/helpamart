import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Phone, ArrowRight, Loader2, AlertCircle, Chrome } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

type Method = 'email' | 'mobile' | 'password'

export default function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const next = params.get('next') || '/dashboard'

  const [method, setMethod] = useState<Method>('email')
  const [destination, setDestination] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function sendOtp() {
    if (!destination.trim()) return
    setLoading(true); setError('')
    try {
      await api('/api/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ destination: destination.trim(), channel: method }),
      })
      setOtpSent(true)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function verifyOtp() {
    if (!code.trim()) return
    setLoading(true); setError('')
    try {
      await api('/api/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ destination: destination.trim(), code: code.trim() }),
      })
      await refresh()
      navigate(next, { replace: true })
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loginPassword() {
    setLoading(true); setError('')
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: destination.trim(), password }),
      })
      await refresh()
      navigate(next, { replace: true })
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  function handleGoogleAuth() {
    window.location.href = '/api/auth/google'
  }

  return (
    <div className="min-h-screen bg-ivory flex">
      {/* Left visual */}
      <div className="hidden lg:flex lg:flex-1 relative bg-navy overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        <div className="absolute top-12 left-12 right-12 bottom-12 flex flex-col justify-between">
          <Link to="/" className="inline-block" aria-label="HELPA home">
            <img
              src="/helpa-logo.png"
              alt="HELPA"
              className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_0_1.5px_rgba(255,255,255,0.7)]"
            />
          </Link>

          <div>
            <blockquote className="text-display-lg font-display text-white leading-tight mb-6">
              "The right person<br />
              <em style={{ color: 'var(--color-gold-light)', fontStyle: 'italic' }}>changes everything.</em>"
            </blockquote>
            <p className="text-white/50 text-sm">Join thousands of people finding guidance through real human connection.</p>
          </div>

          {/* Decorative gold line */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
            className="h-px bg-gradient-to-r from-transparent via-gold to-transparent origin-left"
          />
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-sm"
        >
          {/* Mobile logo */}
          <Link to="/" className="lg:hidden inline-block mb-10" aria-label="HELPA home">
            <img
              src="/helpa-logo.png"
              alt="HELPA"
              className="h-14 w-auto object-contain"
            />
          </Link>

          <h1 className="text-display-md font-display text-navy mb-1">Welcome back.</h1>
          <p className="text-grey text-sm mb-8">Sign in to continue your journey.</p>

          {/* Method tabs */}
          <div className="flex gap-1 p-1 bg-ivory-dark rounded-xl mb-6">
            {([
              { id: 'email' as Method, label: 'Email', icon: <Mail className="h-3.5 w-3.5" /> },
              { id: 'mobile' as Method, label: 'Mobile', icon: <Phone className="h-3.5 w-3.5" /> },
              { id: 'password' as Method, label: 'Password', icon: <Mail className="h-3.5 w-3.5" /> },
            ]).map(tab => (
              <button
                key={tab.id}
                onClick={() => { setMethod(tab.id); setOtpSent(false); setError('') }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  method === tab.id ? 'bg-white text-navy shadow-soft' : 'text-grey hover:text-navy'
                }`}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-maroon/8 border border-maroon/20 rounded-xl p-3 mb-4 text-sm text-maroon">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Form */}
          <div className="space-y-4">
            {!otpSent ? (
              <>
                <div>
                  <label className="field-label">
                    {method === 'mobile' ? 'Mobile Number' : 'Email Address'}
                  </label>
                  <input
                    type={method === 'mobile' ? 'tel' : 'email'}
                    value={destination}
                    onChange={e => setDestination(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (method === 'password' ? null : sendOtp())}
                    placeholder={method === 'mobile' ? '+91 98765 43210' : 'you@example.com'}
                    className="field-input"
                    autoFocus
                  />
                </div>

                {method === 'password' && (
                  <div>
                    <label className="field-label">Password</label>
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && loginPassword()}
                      placeholder="Your password"
                      className="field-input"
                    />
                  </div>
                )}

                <button
                  onClick={method === 'password' ? loginPassword : sendOtp}
                  disabled={loading || !destination.trim() || (method === 'password' && !password)}
                  className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                    {method === 'password' ? 'Sign In' : 'Send Code'}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </>}
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="field-label">Verification Code</label>
                  <p className="text-xs text-grey mb-2">Code sent to {destination} (check server logs in dev mode)</p>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                    placeholder="6-digit code"
                    className="field-input text-center text-lg tracking-widest"
                    autoFocus
                  />
                </div>
                <button
                  onClick={verifyOtp}
                  disabled={loading || code.length < 6}
                  className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & Sign In'}
                </button>
                <button onClick={() => { setOtpSent(false); setCode('') }} className="w-full text-sm text-grey hover:text-navy transition-colors">
                  ← Change {method === 'mobile' ? 'number' : 'email'}
                </button>
              </>
            )}
          </div>

          {/* Google */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-grey-soft" />
            <span className="text-xs text-grey">or</span>
            <div className="flex-1 h-px bg-grey-soft" />
          </div>
          <button
            onClick={handleGoogleAuth}
            className="w-full flex items-center justify-center gap-2 border border-grey-soft rounded-xl py-3 text-sm font-medium text-navy hover:border-navy/30 hover:bg-ivory-dark transition-all"
          >
            <Chrome className="h-4 w-4 text-orange" />
            Continue with Google
          </button>

          <p className="text-center text-sm text-grey mt-8">
            Don't have an account?{' '}
            <Link to={`/signup${next !== '/dashboard' ? `?next=${next}` : ''}`} className="text-navy font-semibold hover:text-gold transition-colors">
              Sign up
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
