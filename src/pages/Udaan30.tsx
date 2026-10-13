import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Compass,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  Calendar,
  PhoneCall,
  Video,
  Target,
  FileCheck2,
  RefreshCw,
  Trophy,
  HelpCircle,
  Code2,
  Atom,
  Stethoscope,
  Rocket,
  Palette,
  Compass as CompassIcon,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import UdaanUniverseIllustration from '@/components/udaan/UdaanUniverseIllustration'

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
  subtitle: string
  tagline: string
  details: string
  whoItsFor: string
  icon: typeof Code2
  colorScheme: {
    bg: string
    border: string
    activeBorder: string
    text: string
    badge: string
    iconBg: string
  }
}

export const JOURNEYS: JourneyOption[] = [
  {
    id: 'Tech Career',
    title: 'Tech Career',
    subtitle: 'Software, Data & AI',
    tagline: 'Coding, projects, interview strategy and engineering direction.',
    details: 'Navigate system design, DSA pacing, portfolio repositories, and realistic software engineer interviews with working tech professionals.',
    whoItsFor: 'College students, self-taught coders, and engineers transitioning to higher-tier tech roles.',
    icon: Code2,
    colorScheme: {
      bg: 'from-blue-500/10 to-indigo-500/5',
      border: 'border-blue-500/20',
      activeBorder: 'border-blue-600 ring-2 ring-blue-500/20',
      text: 'text-blue-700',
      badge: 'bg-blue-100 text-blue-800 border-blue-200',
      iconBg: 'bg-blue-50 text-blue-600',
    },
  },
  {
    id: 'JEE Journey',
    title: 'JEE Journey',
    subtitle: 'IIT-JEE Main & Advanced',
    tagline: 'Study planning, problem-solving habits and exam temperament.',
    details: 'Structure revision cycles, analyze test errors, and master time management with mentors who cleared the exam and walked the same path.',
    whoItsFor: 'Class 11, 12, and dropper students seeking calm, structured preparation strategy.',
    icon: Atom,
    colorScheme: {
      bg: 'from-amber-500/10 to-orange-500/5',
      border: 'border-amber-500/20',
      activeBorder: 'border-amber-600 ring-2 ring-amber-500/20',
      text: 'text-amber-800',
      badge: 'bg-amber-100 text-amber-800 border-amber-200',
      iconBg: 'bg-amber-50 text-amber-700',
    },
  },
  {
    id: 'NEET Journey',
    title: 'NEET Journey',
    subtitle: 'Medical Entrance Mastery',
    tagline: 'NCERT revision structure, consistency and test analysis.',
    details: 'Build an ironclad biology, chemistry, and physics revision loop, avoid burnout, and stay accountable during intensive preparation phases.',
    whoItsFor: 'Aspirants aiming for government medical colleges wanting genuine peer guidance.',
    icon: Stethoscope,
    colorScheme: {
      bg: 'from-emerald-500/10 to-teal-500/5',
      border: 'border-emerald-500/20',
      activeBorder: 'border-emerald-600 ring-2 ring-emerald-500/20',
      text: 'text-emerald-800',
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      iconBg: 'bg-emerald-50 text-emerald-700',
    },
  },
  {
    id: 'Startup Journey',
    title: 'Startup Journey',
    subtitle: '0 to 1 Venture Building',
    tagline: 'Idea validation, MVP scoping, and real customer discovery.',
    details: 'Cut through noise to validate hypotheses, talk to early users, and prioritize build sprints with founders who have shipped real products.',
    whoItsFor: 'Early-stage founders, indie makers, and students building their first product.',
    icon: Rocket,
    colorScheme: {
      bg: 'from-orange-500/10 to-rose-500/5',
      border: 'border-orange-500/20',
      activeBorder: 'border-orange-600 ring-2 ring-orange-500/20',
      text: 'text-orange-800',
      badge: 'bg-orange-100 text-orange-800 border-orange-200',
      iconBg: 'bg-orange-50 text-orange-700',
    },
  },
  {
    id: 'Skill Mastery',
    title: 'Skill Mastery',
    subtitle: 'Design, Product & Craft',
    tagline: 'Deep-dive into UI/UX, product thinking, writing, or analytics.',
    details: 'A focused 30-day sprint to level up a specific high-value craft with critique, portfolio reviews, and personalized milestone feedback.',
    whoItsFor: 'Creators, career changers, and professionals building verifiable domain skills.',
    icon: Palette,
    colorScheme: {
      bg: 'from-purple-500/10 to-pink-500/5',
      border: 'border-purple-500/20',
      activeBorder: 'border-purple-600 ring-2 ring-purple-500/20',
      text: 'text-purple-800',
      badge: 'bg-purple-100 text-purple-800 border-purple-200',
      iconBg: 'bg-purple-50 text-purple-700',
    },
  },
  {
    id: 'My Own Journey',
    title: 'My Own Journey',
    subtitle: 'Custom Ambition Roadmap',
    tagline: 'Define your unique 30-day objective; we provide the mentor match.',
    details: 'Whether switching fields, writing a paper, preparing for study abroad, or mastering public speaking—we align an experienced guide to your exact goal.',
    whoItsFor: 'Anyone with an ambitious personal goal who wants disciplined accountability.',
    icon: CompassIcon,
    colorScheme: {
      bg: 'from-navy/10 to-gold/10',
      border: 'border-gold/30',
      activeBorder: 'border-gold ring-2 ring-gold/30',
      text: 'text-navy',
      badge: 'bg-gold/20 text-gold-darker border-gold/40',
      iconBg: 'bg-navy/10 text-navy',
    },
  },
]

// ─── 4-Week Illustrated Milestones ───────────────────────────────────────────
const FOUR_WEEK_STAGES = [
  {
    week: '01',
    title: 'Discover & Plan',
    subtitle: 'Audit, Baseline Diagnostic & Action Blueprint',
    desc: 'Audit where you currently stand, identify bottleneck habits or skill gaps, and define your realistic 30-day target milestones with your mentor.',
    deliverable: 'Your Personalized 30-Day Blueprint & Week 1 Priority Tasks',
    icon: Target,
  },
  {
    week: '02',
    title: 'Build & Practice',
    subtitle: 'Execution Momentum & First Mentor Checkpoint',
    desc: 'Dive into active execution—whether solving problem sets, shipping code, or revising critical units. Review initial deliverables and eliminate early obstacles.',
    deliverable: 'Initial Sprint Output Review & Tactical Adjustments',
    icon: FileCheck2,
  },
  {
    week: '03',
    title: 'Review & Improve',
    subtitle: 'Deep Work Critique & Course Calibration',
    desc: 'Midway checkpoint to assess momentum. Receive honest critique on your work, calibrate pacing, and unblock complex roadblocks before the final sprint.',
    deliverable: 'Mock Assessment / Code or Strategy Critique & Polishing',
    icon: RefreshCw,
  },
  {
    week: '04',
    title: 'Reflect & Move Forward',
    subtitle: 'Milestone Consolidation & Independent Next Steps',
    desc: 'Review completed 30-day deliverables, consolidate progress, and establish a clear, self-sustaining roadmap for the months ahead beyond Udaan 30.',
    deliverable: 'Final Milestone Review & Forward Momentum Roadmap',
    icon: Trophy,
  },
]

// ─── Mentorship Differentiators ──────────────────────────────────────────────
const DIFFERENTIATORS = [
  {
    title: 'Personalized to Your Exact Goal',
    desc: 'No generic recorded modules or cookie-cutter advice. Every roadmap and checkpoint aligns specifically with what you are building or preparing for.',
    icon: Target,
  },
  {
    title: 'A Structured 30-Day Cadence',
    desc: 'Clear weekly milestones give you focus. You always know what to work on today, avoiding analysis paralysis and wasted hours.',
    icon: Calendar,
  },
  {
    title: 'Active Accountability Check-ins',
    desc: 'Real mentors who check your progress, review your work, and help you course-correct before small roadblocks turn into stalled momentum.',
    icon: RefreshCw,
  },
  {
    title: 'Genuine Communication Channels',
    desc: 'Connect through authentic platform channels—Google Meet video sessions and scheduled phone calls mutually aligned with your mentor.',
    icon: Video,
  },
  {
    title: 'Honest Feedback & Constructive Critique',
    desc: 'Get unvarnished, experienced perspectives from people who have succeeded in your domain, helping you avoid rookie mistakes.',
    icon: PhoneCall,
  },
  {
    title: 'Clear Trajectory After Day 30',
    desc: 'Walk away with not just 30 days of accomplished work, but a solid action plan for your next 6 months of independent growth.',
    icon: Trophy,
  },
]

const FAQS = [
  {
    q: 'What is included in the ₹149 enrollment fee?',
    a: 'You receive a complete 30-day guided roadmap, weekly milestone reviews, structured feedback, and scheduled 1-on-1 check-ins via Google Meet or voice calls based on mutual availability with your matched mentor.',
  },
  {
    q: 'Is this an auto-renewing subscription or recurring charge?',
    a: 'No. Udaan 30 is strictly a single, one-time payment of ₹149 for 30 calendar days. There is zero automatic renewal, no hidden recurring fees, and no unexpected charges.',
  },
  {
    q: 'How does mentor matching work after I enroll?',
    a: 'Upon successful enrollment and payment verification, our Helpamart coordination team reviews your selected journey, current stage, and goals. We then match you with a verified mentor experienced in that exact domain.',
  },
  {
    q: 'Do you guarantee job offers, college admissions, or exam ranks?',
    a: 'No. Helpamart believes in complete honesty. Mentorship provides proven guidance, structured roadmaps, and accountability to maximize your progress, but your personal dedication and effort determine your ultimate results.',
  },
  {
    q: 'How are meetings and calls scheduled?',
    a: 'Sessions are scheduled flexibly based on your availability preferences (e.g. weekday evenings or weekends) and your mentor’s schedule through Google Meet and platform channels.',
  },
  {
    q: 'What if I have an unconventional or interdisciplinary goal?',
    a: 'Select “My Own Journey”. You can describe your specific goal in detail, and our team will match you with a mentor equipped to guide that custom roadmap.',
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

  // UI states
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const formRef = useRef<HTMLDivElement>(null)
  const journeySectionRef = useRef<HTMLDivElement>(null)

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

  const scrollToJourneys = () => {
    journeySectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

  const activeJourneyData = JOURNEYS.find(j => j.id === selectedJourney) || JOURNEYS[0]

  return (
    <div className="bg-ivory min-h-screen text-navy font-sans antialiased selection:bg-gold/25 selection:text-navy">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION A — HERO (Editorial Two-Column with Udaan Universe Artwork)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-28 overflow-hidden bg-gradient-to-b from-[#FBF8F1] via-ivory to-ivory border-b border-navy/[0.06]">
        {/* Soft atmospheric gradient orbs */}
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-gold/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 left-10 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Story, Headings & CTAs */}
            <div className="lg:col-span-6 space-y-7 text-center lg:text-left">
              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold-darker text-xs font-bold tracking-[0.18em] uppercase"
              >
                <Compass className="h-3.5 w-3.5 text-gold" />
                <span>YOUR NEXT CHAPTER STARTS HERE</span>
              </motion.div>

              {/* Main Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="text-display-xl sm:text-display-2xl md:text-5xl lg:text-[3.5rem] font-display text-navy leading-[1.08] tracking-tight"
              >
                Your Dreams Deserve{' '}
                <span className="italic font-normal text-gold block sm:inline">
                  a Game Plan.
                </span>
              </motion.h1>

              {/* Supporting Copy */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-grey-dark text-base sm:text-lg leading-relaxed max-w-xl mx-auto lg:mx-0"
              >
                Personal growth shouldn’t happen through trial and error alone. Udaan 30 pairs you with dedicated mentors to make tangible, weekly progress across careers, competitive exams, entrepreneurship, creative skills, or your own unique goals.
              </motion.p>

              {/* Pricing Disclosure Box */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="inline-flex flex-col sm:flex-row items-center gap-3 p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-white border border-navy/10 shadow-sm"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl font-display font-bold text-navy">₹149</span>
                  <div className="text-left">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-grey">30-Day Program</p>
                    <p className="text-xs font-semibold text-gold-darker">One-time payment • No auto-renewal</p>
                  </div>
                </div>
              </motion.div>

              {/* Action Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5 pt-1"
              >
                <button
                  type="button"
                  onClick={() => scrollToEnrollment()}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-navy text-white px-8 py-4 rounded-xl font-semibold text-sm sm:text-base hover:bg-navy-mid transition-all shadow-[0_6px_20px_rgba(7,26,53,0.18)] hover:shadow-[0_8px_28px_rgba(7,26,53,0.25)] group cursor-pointer"
                >
                  <span>Start My Udaan</span>
                  <ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" />
                </button>

                <button
                  type="button"
                  onClick={scrollToJourneys}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-sm text-navy hover:text-gold bg-transparent border border-navy/15 hover:border-gold/50 transition-all cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-gold" />
                  <span>Explore Your Journey</span>
                </button>
              </motion.div>

              {/* Trust Indicators */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.5 }}
                className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs text-grey pt-2"
              >
                <span className="inline-flex items-center gap-1.5 font-medium text-navy/80">
                  <ShieldCheck className="h-4 w-4 text-gold" />
                  Verified Mentors
                </span>
                <span>•</span>
                <span>1-on-1 Personalized Roadmaps</span>
                <span>•</span>
                <span>Secure Cashfree Verification</span>
              </motion.div>
            </div>

            {/* Right Column: Custom Illustrated "Udaan Universe" */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-6 relative"
            >
              <div className="relative rounded-3xl p-4 sm:p-6 bg-gradient-to-b from-white/95 to-white/70 backdrop-blur-md border border-navy/[0.08] shadow-[0_20px_60px_rgba(7,26,53,0.08)]">
                {/* Floating badge */}
                <div className="absolute -top-3.5 right-8 bg-navy text-white text-xs font-semibold px-3.5 py-1 rounded-full shadow-lg border border-gold/40 flex items-center gap-1.5 z-20">
                  <Compass className="h-3.5 w-3.5 text-gold" />
                  <span>The Udaan Universe</span>
                </div>

                {/* Main Hero Illustration */}
                <UdaanUniverseIllustration variant="hero" className="w-full" />

                {/* Editorial Caption */}
                <div className="mt-4 pt-3 border-t border-navy/[0.06] text-center">
                  <p className="text-xs font-display italic text-navy/75">
                    &ldquo;Whatever you want to become, you don’t have to figure it out alone.&rdquo;
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION B — CHOOSE YOUR JOURNEY (Interactive Constellation & Selector)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={journeySectionRef} className="py-24 bg-white border-b border-navy/[0.06]" id="journeys">
        <div className="max-w-7xl mx-auto px-6">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase flex items-center justify-center gap-2">
              <span className="w-6 h-px bg-gold" />
              <span>THE FLOATING ISLANDS OF AMBITION</span>
              <span className="w-6 h-px bg-gold" />
            </p>

            <h2 className="text-display-xl md:text-display-2xl font-display text-navy tracking-tight">
              Whatever your aspiration,{' '}
              <span className="italic font-normal text-gold block sm:inline">
                there is a path for you.
              </span>
            </h2>

            <p className="text-grey-dark text-base sm:text-lg leading-relaxed">
              Udaan 30 is built for everyone—engineers, medical aspirants, early founders, creative professionals, and students with unique ambitions. Select your focus below to tailor your 30-day experience.
            </p>
          </div>

          {/* Interactive Illustrated Journey Constellation Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {JOURNEYS.map(j => {
              const Icon = j.icon
              const isSelected = selectedJourney === j.id

              return (
                <div
                  key={j.id}
                  tabIndex={0}
                  role="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedJourney(j.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setSelectedJourney(j.id)
                    }
                  }}
                  className={`group relative rounded-3xl p-7 transition-all duration-300 cursor-pointer flex flex-col justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-gold ${
                    isSelected
                      ? `bg-gradient-to-br ${j.colorScheme.bg} ${j.colorScheme.activeBorder} shadow-[0_12px_36px_rgba(7,26,53,0.1)] -translate-y-1`
                      : 'bg-[#FCFAF6] border border-navy/[0.08] hover:border-gold/40 hover:bg-white hover:shadow-lg'
                  }`}
                >
                  <div>
                    {/* Header with Icon and Badge */}
                    <div className="flex items-center justify-between mb-5">
                      <div
                        className={`w-13 h-13 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${j.colorScheme.iconBg}`}
                      >
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${j.colorScheme.badge}`}>
                        {j.subtitle}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xl font-display font-bold text-navy mb-1.5 flex items-center justify-between">
                      <span>{j.title}</span>
                      {isSelected && <CheckCircle2 className="h-5 w-5 text-gold shrink-0" />}
                    </h3>

                    {/* Tagline & Details */}
                    <p className="text-xs font-semibold text-navy/70 mb-3">{j.tagline}</p>
                    <p className="text-xs text-grey-dark leading-relaxed mb-4">{j.details}</p>

                    {/* Who it's for pill */}
                    <div className="pt-3 border-t border-navy/[0.06]">
                      <p className="text-[11px] text-grey leading-snug">
                        <span className="font-semibold text-navy/80">Ideal for: </span>
                        {j.whoItsFor}
                      </p>
                    </div>
                  </div>

                  {/* Bottom selection action */}
                  <div className="mt-6 pt-4 border-t border-navy/[0.06] flex items-center justify-between">
                    <span className="text-xs font-semibold text-gold group-hover:text-gold-darker transition-colors">
                      {isSelected ? 'Selected Track' : 'Choose This Track'}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        scrollToEnrollment(j.id)
                      }}
                      className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                        isSelected
                          ? 'bg-navy text-white hover:bg-navy-mid'
                          : 'bg-navy/5 text-navy hover:bg-navy hover:text-white'
                      }`}
                    >
                      <span>Enroll</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Active Track Highlight Banner */}
          <div className="rounded-3xl p-6 sm:p-8 bg-gradient-to-r from-navy via-[#0C2340] to-navy text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="space-y-2 text-center md:text-left">
              <div className="inline-flex items-center gap-2 text-gold text-xs font-bold uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Selected Track: {activeJourneyData.title}</span>
              </div>
              <h4 className="text-display-md font-display text-white">
                Ready to build your 30-day game plan?
              </h4>
              <p className="text-xs sm:text-sm text-white/70 max-w-xl">
                {activeJourneyData.details}
              </p>
            </div>

            <button
              type="button"
              onClick={() => scrollToEnrollment(activeJourneyData.id)}
              className="shrink-0 inline-flex items-center gap-2.5 bg-gold hover:bg-gold-mid text-navy font-bold px-6 py-3.5 rounded-xl transition-all shadow-md cursor-pointer"
            >
              <span>Continue with {activeJourneyData.title}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION C — THE 30-DAY JOURNEY (Illustrated 4-Week Timeline)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 bg-ivory border-b border-navy/[0.06] relative overflow-hidden">
        {/* Ambient subtle glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gold/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase flex items-center justify-center gap-2">
              <span className="w-6 h-px bg-gold" />
              <span>THE 30-DAY MILESTONE CADENCE</span>
              <span className="w-6 h-px bg-gold" />
            </p>

            <h2 className="text-display-xl md:text-display-2xl font-display text-navy tracking-tight">
              One Month of Focused Guidance.{' '}
              <span className="italic font-normal text-gold block sm:inline">
                Four Distinct Stages.
              </span>
            </h2>

            <p className="text-grey-dark text-base sm:text-lg leading-relaxed">
              We replace endless unstructured calls with a disciplined 4-week progression. Here is how your mentorship experience unfolds from Day 1 to Day 30.
            </p>
          </div>

          {/* Timeline Layout */}
          <div className="relative">
            {/* Center Golden Connecting Line for Desktop */}
            <div className="hidden lg:block absolute left-1/2 top-10 bottom-10 w-1 -translate-x-1/2 bg-gradient-to-b from-gold/30 via-gold to-gold/30 rounded-full" />

            <div className="space-y-8 lg:space-y-12">
              {FOUR_WEEK_STAGES.map((stage, idx) => {
                const isEven = idx % 2 === 1
                const Icon = stage.icon

                return (
                  <div
                    key={stage.week}
                    className={`relative flex flex-col lg:flex-row items-center gap-8 ${
                      isEven ? 'lg:flex-row-reverse' : ''
                    }`}
                  >
                    {/* Content Card */}
                    <div className="w-full lg:w-1/2">
                      <div className="bg-white rounded-3xl p-7 sm:p-8 border border-navy/[0.08] shadow-[0_4px_24px_rgba(7,26,53,0.04)] hover:shadow-md transition-shadow">
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs font-bold tracking-wider uppercase text-gold">
                            Week {stage.week}
                          </span>
                          <span className="w-8 h-8 rounded-xl bg-gold/10 text-gold font-bold flex items-center justify-center text-xs">
                            W{stage.week}
                          </span>
                        </div>

                        <h3 className="text-xl font-display font-bold text-navy mb-1">
                          {stage.title}
                        </h3>
                        <p className="text-xs font-semibold text-gold-darker mb-3">
                          {stage.subtitle}
                        </p>
                        <p className="text-xs sm:text-sm text-grey-dark leading-relaxed mb-5">
                          {stage.desc}
                        </p>

                        <div className="p-3.5 rounded-xl bg-ivory border border-navy/[0.06] flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                          <div className="text-xs">
                            <span className="font-semibold text-navy">Tangible Outcome: </span>
                            <span className="text-grey-dark">{stage.deliverable}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Milestone Center Badge */}
                    <div className="hidden lg:flex w-14 h-14 rounded-full bg-navy border-4 border-white text-gold shadow-lg items-center justify-center shrink-0 z-10">
                      <Icon className="h-6 w-6 text-gold" />
                    </div>

                    {/* Spacer for the other side */}
                    <div className="hidden lg:block w-1/2" />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Genuine Communication Transparency */}
          <div className="mt-14 text-center">
            <p className="text-xs text-grey italic max-w-xl mx-auto">
              * Mentorship check-ins are conducted via Google Meet and scheduled voice calls based on mutual availability. No false claims of 24/7 unlimited on-demand calls.
            </p>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION D — WHAT MAKES UDAAN DIFFERENT?
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 bg-white border-b border-navy/[0.06]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase flex items-center justify-center gap-2">
              <span className="w-6 h-px bg-gold" />
              <span>THE HELPAMART ADVANTAGE</span>
              <span className="w-6 h-px bg-gold" />
            </p>

            <h2 className="text-display-xl md:text-display-2xl font-display text-navy tracking-tight">
              Honest Guidance.{' '}
              <span className="italic font-normal text-gold block sm:inline">
                Real Accountability.
              </span>
            </h2>

            <p className="text-grey-dark text-base sm:text-lg leading-relaxed">
              We designed Udaan 30 around the exact elements that make long-term mentorship work, without the excessive fees or empty promises common in traditional programs.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-14">
            {DIFFERENTIATORS.map((item, idx) => {
              const Icon = item.icon
              return (
                <div
                  key={idx}
                  className="rounded-3xl p-7 bg-[#FAF7F0] border border-navy/[0.07] hover:border-gold/30 hover:bg-white hover:shadow-lg transition-all"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white text-gold border border-navy/[0.06] flex items-center justify-center mb-5 shadow-sm">
                    <Icon className="h-6 w-6 text-gold" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-navy mb-2">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-grey-dark leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              )
            })}
          </div>

          {/* Transparency Pledge */}
          <div className="max-w-3xl mx-auto p-6 rounded-2xl bg-gold/10 border border-gold/30 text-center">
            <p className="text-xs sm:text-sm text-gold-darker font-medium leading-relaxed">
              <strong>Our Transparency Pledge:</strong> We do not claim instant rank guarantees, effortless jobs, or effortless funding. We provide proven direction, structure, and experienced insight. The commitment and hard work remain yours.
            </p>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION E — ENROLLMENT & CASHFREE CHECKOUT FORM
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section ref={formRef} className="py-24 bg-ivory border-b border-navy/[0.06]" id="enroll">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-12 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gold/15 text-gold-darker text-xs font-bold uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5" />
              <span>STEP INTO YOUR 30-DAY TRACK</span>
            </div>
            <h2 className="text-display-xl font-display text-navy">
              Enroll in Udaan 30
            </h2>
            <p className="text-grey-dark text-sm sm:text-base">
              Complete your profile and preferences below to initiate your personalized 30-day mentorship roadmap.
            </p>
          </div>

          <form
            onSubmit={handleEnrollment}
            className="bg-white rounded-3xl p-8 sm:p-11 border border-navy/10 shadow-xl space-y-7"
          >
            {errorMsg && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm flex items-start gap-3">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Journey Selector Pills inside form */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2.5">
                1. Selected Track *
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {JOURNEYS.map(j => (
                  <button
                    type="button"
                    key={j.id}
                    onClick={() => setSelectedJourney(j.id)}
                    className={`px-3.5 py-3 rounded-xl text-xs font-medium text-left transition-all cursor-pointer ${
                      selectedJourney === j.id
                        ? 'bg-navy text-white font-semibold shadow-sm ring-2 ring-gold/40'
                        : 'bg-ivory text-navy/80 border border-navy/10 hover:border-gold/40 hover:bg-white'
                    }`}
                  >
                    <div className="truncate font-semibold">{j.title}</div>
                    <div className={`text-[10px] truncate ${selectedJourney === j.id ? 'text-gold-pale' : 'text-grey'}`}>
                      {j.subtitle}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Goal Input for "My Own Journey" */}
            {selectedJourney === 'My Own Journey' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2">
                  Describe your specific 30-day goal *
                </label>
                <textarea
                  rows={3}
                  value={customGoal}
                  onChange={e => setCustomGoal(e.target.value)}
                  placeholder="e.g. Completing my frontend portfolio, preparing for 10 mock interviews, and applying to internships..."
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-ivory-light text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                  required
                />
              </div>
            )}

            {/* Student Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="Aditya Sharma"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-ivory-light text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="aditya@example.com"
                  required
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-ivory-light text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                />
              </div>
            </div>

            {/* Phone & Current Experience Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2">
                  WhatsApp / Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-ivory-light text-sm text-navy placeholder:text-grey/60 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2">
                  Current Experience / Stage
                </label>
                <select
                  value={experienceLevel}
                  onChange={e => setExperienceLevel(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-ivory-light text-sm text-navy focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                >
                  <option value="Beginner">Beginner / Just Starting Out</option>
                  <option value="Intermediate">Intermediate / Halfway in Prep</option>
                  <option value="Preparing for Exam">Intensive Exam Revision</option>
                  <option value="Advanced / Building">Advanced / Polishing Deliverables</option>
                </select>
              </div>
            </div>

            {/* Communication & Availability Preferences */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2">
                  Preferred Check-in Method
                </label>
                <select
                  value={communicationPreference}
                  onChange={e => setCommunicationPreference(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-ivory-light text-sm text-navy focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                >
                  <option value="Google Meet">Google Meet Video Sessions</option>
                  <option value="Phone Call">Scheduled Phone Check-ins</option>
                  <option value="WhatsApp/Chat">Chat & Text Check-ins</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-navy/80 mb-2">
                  Preferred Availability Slot
                </label>
                <select
                  value={availabilityPreference}
                  onChange={e => setAvailabilityPreference(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-navy/15 bg-ivory-light text-sm text-navy focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold transition-colors"
                >
                  <option value="Weekday Evenings">Weekday Evenings (6 PM - 10 PM)</option>
                  <option value="Weekend Mornings">Weekend Mornings (9 AM - 1 PM)</option>
                  <option value="Weekend Evenings">Weekend Evenings (4 PM - 8 PM)</option>
                  <option value="Flexible">Flexible / Mutually Coordinated</option>
                </select>
              </div>
            </div>

            {/* Order & Payment Summary Card */}
            <div className="p-6 rounded-2xl bg-ivory border border-navy/10 space-y-3.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-navy flex items-center justify-between">
                <span>Enrollment Summary</span>
                <span className="text-[11px] font-semibold text-gold-darker">Helpamart Verified</span>
              </h4>
              <div className="flex justify-between text-xs text-grey-dark">
                <span>Selected Track</span>
                <span className="font-semibold text-navy">{selectedJourney}</span>
              </div>
              <div className="flex justify-between text-xs text-grey-dark">
                <span>Duration</span>
                <span className="font-semibold text-navy">30 Consecutive Calendar Days</span>
              </div>
              <div className="flex justify-between text-xs text-grey-dark">
                <span>Billing Frequency</span>
                <span className="text-emerald-700 font-semibold">One-time payment (Zero Auto-Renewal)</span>
              </div>
              <div className="pt-3 border-t border-navy/[0.08] flex justify-between items-center text-sm font-bold text-navy">
                <span>Total Amount Due</span>
                <span className="text-xl text-gold font-display font-bold">₹149 INR</span>
              </div>
            </div>

            {/* Terms and Conduct note */}
            <p className="text-[11px] text-grey leading-relaxed">
              By enrolling, you agree to Helpamart&apos;s mentorship code of conduct. The ₹149 fee covers 30 days of structured milestone roadmap coordination and mentor alignment. Instant activation occurs upon payment verification via Cashfree.
            </p>

            {/* Cashfree Payment Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full inline-flex items-center justify-center gap-2.5 bg-navy text-white px-8 py-4.5 rounded-xl font-bold text-base hover:bg-navy-mid transition-all hover:shadow-[0_8px_24px_rgba(7,26,53,0.25)] disabled:opacity-60 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-gold" />
                  <span>Connecting to Cashfree Payment Gateway...</span>
                </>
              ) : (
                <>
                  <span>Confirm & Pay ₹149 via Cashfree</span>
                  <ArrowRight className="h-5 w-5 text-gold" />
                </>
              )}
            </button>
          </form>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          SECTION F — FINAL MEMORABLE CTA
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-24 bg-gradient-to-b from-white to-ivory border-b border-navy/[0.06] relative overflow-hidden">
        <div className="max-w-4xl mx-auto px-6 text-center space-y-7 relative z-10">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gold/15 text-gold-darker mx-auto mb-2">
            <Compass className="h-7 w-7 text-gold" />
          </div>

          <h2 className="text-display-xl sm:text-display-2xl md:text-5xl font-display text-navy leading-[1.12]">
            &ldquo;Your next chapter doesn’t have to be{' '}
            <span className="italic font-normal text-gold block sm:inline">
              a solo journey.&rdquo;
            </span>
          </h2>

          <p className="text-grey-dark text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Bring your ambition. We&apos;ll help you build the roadmap.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => scrollToEnrollment()}
              className="inline-flex items-center justify-center gap-2.5 bg-navy text-white px-9 py-4 rounded-xl font-semibold text-base hover:bg-navy-mid transition-all shadow-[0_6px_20px_rgba(7,26,53,0.2)] hover:shadow-[0_8px_28px_rgba(7,26,53,0.3)] group cursor-pointer"
            >
              <span>Begin My 30-Day Journey — ₹149</span>
              <ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" />
            </button>
            <p className="text-xs text-grey mt-3.5">
              One-time 30-day enrollment • Zero recurring charges • Verified mentor guidance
            </p>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          FAQS SECTION
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="py-20 bg-ivory">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-12 space-y-2">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase flex items-center justify-center gap-2">
              <HelpCircle className="h-4 w-4 text-gold" />
              <span>FREQUENTLY ASKED QUESTIONS</span>
            </p>
            <h2 className="text-display-md font-display text-navy">
              Everything You Need to Know About Udaan 30
            </h2>
          </div>

          <div className="space-y-3.5">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx
              return (
                <div
                  key={idx}
                  className="bg-white rounded-2xl border border-navy/10 overflow-hidden transition-all shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full p-6 text-left flex items-center justify-between gap-4 font-semibold text-sm sm:text-base text-navy hover:text-gold transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? (
                      <ChevronUp className="h-5 w-5 text-gold shrink-0" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-grey shrink-0" />
                    )}
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="px-6 pb-6 text-xs sm:text-sm text-grey-dark leading-relaxed border-t border-navy/[0.04] pt-4"
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
