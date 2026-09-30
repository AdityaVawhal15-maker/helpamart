import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Loader2, AlertCircle, Chrome } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'

export default function Signup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const next = params.get('next') || '/dashboard'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) return
    setLoading(true); setError('')
    try {
      await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      })
      await refresh()
      navigate(next, { replace: true })
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
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
              "Your experience could<br />
              <em style={{ color: 'var(--color-gold-light)', fontStyle: 'italic' }}>change someone's direction.</em>"
            </blockquote>
            <p className="text-white/50 text-sm">Join as a mentee looking for guidance, or as a mentor ready to give back.</p>
          </div>
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
          <Link to="/" className="lg:hidden inline-block mb-10" aria-label="HELPA home">
            <img
              src="/helpa-logo.png"
              alt="HELPA"
              className="h-14 w-auto object-contain"
            />
          </Link>

          <h1 className="text-display-md font-display text-navy mb-1">Create your account.</h1>
          <p className="text-grey text-sm mb-8">Start your journey with HELPA today.</p>

          {error && (
            <div className="flex items-start gap-2 bg-maroon/8 border border-maroon/20 rounded-xl p-3 mb-4 text-sm text-maroon">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="field-label">Your Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="field-input" autoFocus />
            </div>
            <div>
              <label className="field-label">Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="field-input" />
            </div>
            <div>
              <label className="field-label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleRegister()} placeholder="At least 8 characters" className="field-input" />
            </div>

            <button
              onClick={handleRegister}
              disabled={loading || !name.trim() || !email.trim() || password.length < 8}
              className="w-full py-3.5 bg-navy text-white rounded-xl font-semibold hover:bg-navy-mid transition-all disabled:opacity-50 flex items-center justify-center gap-2 group"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                Create Account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </>}
            </button>
          </div>

          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-grey-soft" />
            <span className="text-xs text-grey">or</span>
            <div className="flex-1 h-px bg-grey-soft" />
          </div>

          <a
            href="/api/auth/google"
            className="w-full flex items-center justify-center gap-2 border border-grey-soft rounded-xl py-3 text-sm font-medium text-navy hover:border-navy/30 hover:bg-ivory-dark transition-all"
          >
            <Chrome className="h-4 w-4 text-orange" />
            Continue with Google
          </a>

          <p className="text-center text-sm text-grey mt-8">
            Already have an account?{' '}
            <Link to="/login" className="text-navy font-semibold hover:text-gold transition-colors">Sign in</Link>
          </p>
        </motion.div>
      </div>
    </div>
  )
}
