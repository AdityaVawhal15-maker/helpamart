import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Zap,
  GraduationCap,
  BookOpen,
  Rocket,
  Sparkles,
  PenLine,
  Compass,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

declare global {
  interface Window {
    Cashfree?: any
  }
}

// ─── Journey Taxonomy ────────────────────────────────────────────────────────
export type JourneyType =
  | 'Tech Career'
  | 'JEE Journey'
  | 'NEET Journey'
  | 'Startup Journey'
  | 'Skill Mastery'
  | 'My Own Journey'

export interface JourneyOption {
  id: JourneyType
  title: string
  tagline: string
  details: string
  icon: typeof Zap
  badgeColor: string
}

export const JOURNEYS: JourneyOption[] = [
  {
    id: 'Tech Career',
    title: 'Tech Career',
    tagline: 'Coding, projects, interview preparation and career direction.',
    details: 'Weekly engineering checkpoints, resume guidance, project scoping, and real software engineer insights.',
    icon: Zap,
    badgeColor: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  },
  {
    id: 'JEE Journey',
    title: 'JEE Journey',
    tagline: 'Study planning, problem-solving strategy and preparation guidance.',
    details: 'Pacing frameworks, mock test review habits, and mental endurance advice from IITians who cleared it.',
    icon: GraduationCap,
    badgeColor: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  },
  {
    id: 'NEET Journey',
    title: 'NEET Journey',
    tagline: 'Study structure, revision strategy and preparation guidance.',
    details: 'NCERT mastery schedules, revision loops, and time management strategies for medical aspirants.',
    icon: BookOpen,
    badgeColor: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  },
  {
    id: 'Startup Journey',
    title: 'Startup Journey',
    tagline: 'Idea validation, execution planning and founder guidance.',
    details: 'Customer discovery tips, MVP prioritization, and honest feedback from founders who have built real products.',
    icon: Rocket,
    badgeColor: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  },
  {
    id: 'Skill Mastery',
    title: 'Skill Mastery',
    tagline: 'Develop expertise in a skill of the student\'s choice.',
    details: 'Deep-dive roadmap for design, data, public speaking, or specialized craft with weekly accountability.',
    icon: Sparkles,
    badgeColor: 'bg-gold/15 text-gold-darker border-gold/30',
  },
  {
    id: 'My Own Journey',
    title: 'My Own Journey',
    tagline: 'Enter a custom 30-day ambition tailored to you.',
    details: 'Define your unique objective; we match you with a mentor who aligns with your exact ambition.',
    icon: PenLine,
    badgeColor: 'bg-navy/10 text-navy border-navy/20',
  },
]

const SUPPORT_HIGHLIGHTS = [
  'A guided 30-day mentorship journey.',
  'Expert guidance aligned with your chosen goal.',
  'Structured weekly milestones and actionable tasks.',
  'Support through genuine platform channels (Google Meet & scheduled calls).',
  'Progress check-ins and practical feedback.',
  'A clear roadmap tailored to your chosen journey.',
]

const FAQS = [
  {
    q: 'What is included in the ₹149 enrollment?',
    a: 'You receive a complete 30-day structured roadmap, milestone check-ins, guidance from experienced mentors via Google Meet / calls based on mutual availability, and ongoing support for your chosen path.',
  },
  {
    q: 'Is this an auto-renewing subscription?',
    a: 'No. Udaan 30 is a single, one-time payment of ₹149 for 30 calendar days. There is zero recurring billing, no hidden fees, and no auto-renewal.',
  },
  {
    q: 'How does mentor matching work?',
    a: 'Upon successful enrollment, our Helpamart coordinator team reviews your selected journey, current level, and goals, then connects you with a verified mentor experienced in that exact domain.',
  },
  {
    q: 'Do you guarantee jobs, college admissions, or exam ranks?',
    a: 'No. We provide authentic, structured expert guidance and accountability. We do not make false guarantees about exam outcomes or hiring decisions.',
  },
  {
    q: 'When does my 30-day period begin?',
    a: 'Your 30-day period begins immediately upon payment verification and continues for 30 consecutive days.',
  },
]

function loadCashfreeSdk(): Promise<boolean> {
  return new Promise(resolve => {
    if (typeof window.Cashfree !== 'undefined') {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://sdk.cashfree.com/js/v3/cashfree.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

export default function Udaan30() {
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  // Form states
  const [selectedJourney, setSelectedJourney] = useState<JourneyType>('Tech Career')
  const [customGoal, setCustomGoal] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [experienceLevel, setExperienceLevel] = useState('Beginner')
  const [communicationPreference, setCommunicationPreference] = useState('Google Meet')
  const [availabilityPreference, setAvailabilityPreference] = useState('Weekday Evenings')

  // UI / Step states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  // Pre-fill user profile info when available
  useEffect(() => {
    if (user) {
      if (user.name && !fullName) setFullName(user.name)
      if (user.email && !email) setEmail(user.email)
    }
  }, [user])

  // Pre-select journey if present in query param
  useEffect(() => {
    const jParam = searchParams.get('journey')
    if (jParam) {
      const match = JOURNEYS.find(
        j => j.id.toLowerCase() === jParam.toLowerCase() || j.title.toLowerCase().includes(jParam.toLowerCase())
      )
      if (match) setSelectedJourney(match.id)
    }
  }, [searchParams])

  const scrollToEnrollment = (journey?: JourneyType) => {
    if (journey) setSelectedJourney(journey)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleEnrollment = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)

    if (!fullName.trim() || fullName.trim().length < 2) {
      setErrorMsg('Please enter your full name.')
      return
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.')
      return
    }
    if (selectedJourney === 'My Own Journey' && !customGoal.trim()) {
      setErrorMsg('Please specify your custom 30-day goal.')
      return
    }

    setIsSubmitting(true)

    try {
      // 1. Load Cashfree SDK v3
      const sdkLoaded = await loadCashfreeSdk()
      if (!sdkLoaded) {
        throw new Error('Payment gateway failed to load. Please check your internet connection.')
      }

      // 2. Fetch session token if user is signed in
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      if (token) headers['Authorization'] = `Bearer ${token}`

      // 3. Create order on server
      const res = await fetch('/api/udaan', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'init-order',
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          journey: selectedJourney,
          customGoal: selectedJourney === 'My Own Journey' ? customGoal.trim() : undefined,
          experienceLevel,
          communicationPreference,
          availabilityPreference,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize enrollment. Please try again.')
      }

      const { payment_session_id, cashfree_environment } = data

      if (!payment_session_id) {
        throw new Error('No payment session received from gateway.')
      }

      // 4. Trigger Cashfree Checkout
      const mode = cashfree_environment === 'production' ? 'production' : 'sandbox'
      const cashfree = window.Cashfree({ mode })

      await cashfree.checkout({
        paymentSessionId: payment_session_id,
        redirectTarget: '_self',
      })
    } catch (err: any) {
      console.error('[UDAAN-ENROLL] Checkout error:', err)
      setErrorMsg(err.message || 'An unexpected error occurred during checkout.')
      setIsSubmitting(false)
    }
  }

  return (
    <div className="bg-ivory min-h-screen text-navy font-sans antialiased">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HERO SECTION — Editorial & Premium
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative pt-24 pb-20 md:pt-32 md:pb-28 overflow-hidden bg-gradient-to-b from-ivory-light via-ivory to-ivory">
        <div className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-r from-gold/15 via-blue-500/10 to-transparent blur-3xl rounded-full" />
        </div>

        <div className="max-w-6xl mx-auto px-6 relative z-10 text-center">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold-darker text-xs font-bold tracking-[0.18em] uppercase mb-6"
          >
            <Compass className="h-3.5 w-3.5 text-gold" />
            YOUR NEXT 30 DAYS START HERE
          </motion.div>

          {/* Heading */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-display-xl md:text-display-2xl font-display text-navy mb-6 tracking-tight max-w-4xl mx-auto"
          >
            Udaan 30 — Your Ambition.{' '}
            <span className="italic font-normal text-gold block sm:inline">Our Expert Saath.</span>
          </motion.h1>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-grey-dark text-base md:text-lg max-w-2xl mx-auto leading-relaxed mb-8"
          >
            Big goals deserve more than one conversation. Get a month of expert guidance, structured action plans, and ongoing support to move confidently towards your next milestone.
          </motion.p>

          {/* Price & CTA badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="inline-flex flex-col sm:flex-row items-center gap-4 bg-white/80 backdrop-blur-md border border-navy/10 p-3 sm:pr-4 rounded-2xl shadow-sm mb-12"
          >
            <div className="flex items-center gap-3 px-3">
              <span className="text-2xl font-display font-bold text-navy">₹149</span>
              <span className="text-xs text-grey uppercase tracking-wider font-semibold">/ 30 Days</span>
            </div>
            <button
              onClick={() => scrollToEnrollment()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all hover:shadow-[0_4px_16px_rgba(7,26,53,0.2)] group"
            >
              Begin My 30-Day Journey
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SELECT YOUR JOURNEY (6 CARDS)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-white border-y border-navy/[0.06]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-3 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              CHOOSE YOUR FOCUS
              <span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-md font-display text-navy mb-4">
              Structured Paths for High Aspirations
            </h2>
            <p className="text-grey text-sm md:text-base">
              Select the direction you are committed to advancing over the next month.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {JOURNEYS.map(j => {
              const Icon = j.icon
              const isSelected = selectedJourney === j.id

              return (
                <div
                  key={j.id}
                  onClick={() => scrollToEnrollment(j.id)}
                  className={`group relative rounded-2xl p-6 transition-all duration-300 cursor-pointer border ${
                    isSelected
                      ? 'bg-ivory-light border-gold shadow-[0_8px_30px_rgba(183,122,34,0.12)] ring-1 ring-gold'
                      : 'bg-white border-navy/10 hover:border-navy/25 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-ivory flex items-center justify-center text-navy group-hover:text-gold transition-colors">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${j.badgeColor}`}>
                      30-Day Focus
                    </span>
                  </div>

                  <h3 className="text-lg font-display font-semibold text-navy mb-2 flex items-center justify-between">
                    {j.title}
                    {isSelected && <CheckCircle2 className="h-4 w-4 text-gold" />}
                  </h3>
                  <p className="text-xs font-medium text-navy/80 mb-3">{j.tagline}</p>
                  <p className="text-xs text-grey leading-relaxed">{j.details}</p>

                  <div className="mt-5 pt-4 border-t border-navy/[0.06] flex items-center justify-between text-xs font-semibold text-gold group-hover:text-gold-darker transition-colors">
                    <span>{isSelected ? 'Selected Journey' : 'Select This Path'}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          WHAT YOU RECEIVE & SUPPORT HIGHLIGHTS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-ivory">
        <div className="max-w-5xl mx-auto px-6">
          <div className="bg-navy rounded-3xl p-8 sm:p-12 text-white shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 w-96 h-96 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl">
              <span className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-3 block">
                WHAT ₹149 INCLUDES
              </span>
              <h2 className="text-display-md font-display mb-6">
                Clear Roadmaps. Honest Checkpoints. Genuine Saath.
              </h2>
              <p className="text-white/70 text-sm leading-relaxed mb-8">
                We believe in genuine mentorship, not hollow promises. In your 30-day enrollment, you receive direct, structured support tailored to your journey:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                {SUPPORT_HIGHLIGHTS.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-white/5 p-3.5 rounded-xl border border-white/10">
                    <CheckCircle2 className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                    <span className="text-xs text-white/90 leading-snug">{item}</span>
                  </div>
                ))}
              </div>

              <div className="p-4 rounded-xl bg-gold/15 border border-gold/30 text-xs text-gold-light leading-relaxed">
                <strong>Our Transparency Pledge:</strong> We do not claim instant exam ranks, guaranteed startup funding, or effortless job placements. Mentorship provides proven direction, error reduction, and momentum. The effort remains yours.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          ENROLLMENT & CHECKOUT FORM
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={formRef} className="py-20 bg-white border-t border-navy/[0.06]" id="enroll">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-10">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-2">
              STEP INTO YOUR JOURNEY
            </p>
            <h2 className="text-display-md font-display text-navy mb-3">
              Enroll in Udaan 30
            </h2>
            <p className="text-grey text-sm">
              Provide your details below to initiate your 30-day mentorship roadmap.
            </p>
          </div>

          <form
            onSubmit={handleEnrollment}
            className="bg-ivory-light rounded-3xl p-8 sm:p-10 border border-navy/10 shadow-sm space-y-6"
          >
            {errorMsg && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Journey selector pills inside form */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                Selected Journey *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {JOURNEYS.map(j => (
                  <button
                    type="button"
                    key={j.id}
                    onClick={() => setSelectedJourney(j.id)}
                    className={`px-3 py-2.5 rounded-xl text-xs font-medium border text-left transition-all ${
                      selectedJourney === j.id
                        ? 'bg-navy text-white border-navy shadow-sm'
                        : 'bg-white text-navy/80 border-navy/15 hover:border-navy/40'
                    }`}
                  >
                    {j.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Goal if My Own Journey is selected */}
            {selectedJourney === 'My Own Journey' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                  What is your main goal for the next 30 days? *
                </label>
                <textarea
                  rows={3}
                  value={customGoal}
                  onChange={e => setCustomGoal(e.target.value)}
                  placeholder="e.g. Completing my portfolio website and applying to 15 internships..."
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-white text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold transition-colors"
                  required
                />
              </div>
            )}

            {/* Student Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-white text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@domain.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-white text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold transition-colors"
                />
              </div>
            </div>

            {/* Phone & Current Experience Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                  WhatsApp / Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-white text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                  Current Experience / Level
                </label>
                <select
                  value={experienceLevel}
                  onChange={e => setExperienceLevel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-white text-sm text-navy focus:outline-none focus:border-gold transition-colors"
                >
                  <option value="Beginner">Beginner / Starting Out</option>
                  <option value="Intermediate">Intermediate / In Progress</option>
                  <option value="Preparing for Exam">Preparing for Exam / Revision</option>
                  <option value="Advanced / Building">Advanced / Polishing Portfolio</option>
                </select>
              </div>
            </div>

            {/* Communication & Availability Preferences */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                  Preferred Communication Method
                </label>
                <select
                  value={communicationPreference}
                  onChange={e => setCommunicationPreference(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-white text-sm text-navy focus:outline-none focus:border-gold transition-colors"
                >
                  <option value="Google Meet">Google Meet Video Calls</option>
                  <option value="Phone Call">Scheduled Phone Calls</option>
                  <option value="WhatsApp/Chat">Chat & Text Check-ins</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/70 mb-2">
                  Preferred Availability Window
                </label>
                <select
                  value={availabilityPreference}
                  onChange={e => setAvailabilityPreference(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-white text-sm text-navy focus:outline-none focus:border-gold transition-colors"
                >
                  <option value="Weekday Evenings">Weekday Evenings (6 PM - 10 PM)</option>
                  <option value="Weekend Mornings">Weekend Mornings (9 AM - 1 PM)</option>
                  <option value="Weekend Evenings">Weekend Evenings (4 PM - 8 PM)</option>
                  <option value="Flexible">Flexible / Mutually Agreed</option>
                </select>
              </div>
            </div>

            {/* ─── PAYMENT & ORDER SUMMARY ─────────────────────────────────── */}
            <div className="p-5 rounded-2xl bg-white border border-navy/10 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy">
                Enrollment Summary
              </h4>
              <div className="flex justify-between text-xs text-grey">
                <span>Selected Track</span>
                <span className="font-semibold text-navy">{selectedJourney}</span>
              </div>
              <div className="flex justify-between text-xs text-grey">
                <span>Duration</span>
                <span className="font-semibold text-navy">30 Days (from activation)</span>
              </div>
              <div className="flex justify-between text-xs text-grey">
                <span>Payment Schedule</span>
                <span className="text-navy">One-time payment (no auto-renewal)</span>
              </div>
              <div className="pt-2 border-t border-navy/[0.08] flex justify-between items-center text-sm font-bold text-navy">
                <span>Total Payable</span>
                <span className="text-lg text-gold font-display">₹149 INR</span>
              </div>
            </div>

            {/* Terms check */}
            <p className="text-[11px] text-grey leading-relaxed">
              By proceeding, you confirm your details and agree to Helpamart's mentorship code of conduct. The ₹149 fee covers 30 days of guidance and roadmap coordination. Cancel anytime before first scheduled check-in for full refund.
            </p>

            {/* Pay Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2 bg-navy text-white px-8 py-4 rounded-xl font-semibold text-base hover:bg-navy-mid transition-all hover:shadow-[0_6px_20px_rgba(7,26,53,0.25)] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-gold" />
                  Connecting to Cashfree...
                </>
              ) : (
                <>
                  Confirm & Pay ₹149 via Cashfree
                  <ArrowRight className="h-5 w-5 text-gold" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          FAQS SECTION
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-ivory">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-2">
              FREQUENTLY ASKED QUESTIONS
            </p>
            <h2 className="text-display-md font-display text-navy">
              Everything You Need to Know
            </h2>
          </div>

          <div className="space-y-4">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-navy/10 overflow-hidden transition-colors"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-semibold text-sm text-navy hover:text-gold transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-gold shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-grey shrink-0" />
                    )}
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-6 pb-6 text-xs text-grey-dark leading-relaxed border-t border-navy/[0.04] pt-4"
                      >
                        {faq.a}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
