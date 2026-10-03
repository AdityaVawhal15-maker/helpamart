import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  Twitter, Linkedin, Instagram, ArrowRight,
  Sparkles, CheckCircle2, Mail
} from 'lucide-react'

const ease = [0.16, 1, 0.3, 1] as const

const EXPLORE_LINKS = [
  { label: 'Find a Mentor', to: '/find-mentor' },
  { label: 'Offer Your Help', to: '/offer-help' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Real Stories', to: '/stories' },
  { label: 'Pricing & Plans', to: '/pricing' },
]

const COMMUNITY_LINKS = [
  { label: 'Community Feed', to: '/community' },
  { label: 'Ask a Question', to: '/community' },
  { label: 'Question of the Week', to: '/community' },
  { label: 'HELPAMART Circles', to: '/community' },
]

const HELPAMART_LINKS = [
  { label: 'About HELPAMART', to: '/' },
  { label: 'Become a Mentor', to: '/become-a-mentor' },
  { label: 'Mentor Dashboard', to: '/mentor-dashboard' },
  { label: 'Contact Support', to: '/' },
]

const LEGAL_LINKS = [
  { label: 'Privacy Policy', to: '/' },
  { label: 'Terms of Service', to: '/' },
  { label: 'Safety & Guidelines', to: '/' },
]

export default function Footer() {
  const topStatementRef = useRef<HTMLDivElement>(null)
  const topStatementInView = useInView(topStatementRef, { once: true, margin: '-60px' })

  const wordmarkRef = useRef<HTMLDivElement>(null)
  const wordmarkInView = useInView(wordmarkRef, { once: true, margin: '-40px' })

  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !email.includes('@')) return
    setSubscribed(true)
  }

  return (
    <footer className="bg-navy text-white overflow-hidden relative border-t border-white/10 selection:bg-gold/30 selection:text-white">
      {/* Background ambient lighting */}
      <div
        className="absolute inset-0 pointer-events-none opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute top-0 right-1/4 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #B77A22 0%, transparent 70%)' }}
        aria-hidden="true"
      />
      <div
        className="absolute bottom-10 left-10 w-96 h-96 rounded-full opacity-5 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #D8A24A 0%, transparent 70%)' }}
        aria-hidden="true"
      />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. LARGE EDITORIAL BRAND STATEMENT & CONNECTED CIRCLE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative border-b border-white/10 z-10">
        <div
          ref={topStatementRef}
          className="max-w-7xl mx-auto px-6 pt-20 pb-16 lg:py-24"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Statement on the left */}
            <motion.div
              initial={{ opacity: 0, y: 25 }}
              animate={topStatementInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.8, ease }}
              className="lg:col-span-7 xl:col-span-8"
            >
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gold text-xs font-semibold tracking-[0.18em] uppercase mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                The HELPAMART Promise
                <span className="text-white/40">·</span>
                <span className="text-white/70 font-normal tracking-normal lowercase">human-first mentorship</span>
              </div>

              <h2 className="text-display-xl sm:text-display-2xl md:text-[3.5rem] font-display text-white leading-[1.08] mb-6">
                Learn from someone who's been there.<br />
                Help someone who's just beginning.<br />
                <em className="italic" style={{ color: '#D8A24A', fontFamily: 'var(--font-display)' }}>
                  Keep growing together.
                </em>
              </h2>

              <p className="text-white/70 text-base sm:text-lg leading-relaxed max-w-2xl font-normal">
                Mentorship on HELPAMART isn't a transactional coaching package. It is an honest conversation with a person who cares enough to share what they have learned.
              </p>
            </motion.div>

            {/* Signature Connected Circle Visual on the right */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={topStatementInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.9, ease, delay: 0.2 }}
              className="lg:col-span-5 xl:col-span-4"
            >
              <div className="relative rounded-3xl p-6 sm:p-8 bg-gradient-to-b from-white/[0.07] to-white/[0.02] border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.3)] backdrop-blur-sm">
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-gold" />
                    <span className="text-[0.6875rem] font-bold tracking-[0.2em] text-white/90 uppercase">
                      The HELPAMART Circle
                    </span>
                  </div>
                  <span className="text-[0.625rem] text-gold font-medium uppercase tracking-wider">
                    Always Connected
                  </span>
                </div>

                {/* Minimal Knowledge Ripple Graphic */}
                <div className="relative py-4 flex items-center justify-center">
                  <div className="relative w-48 h-48 flex items-center justify-center">
                    {/* Outer Orbit */}
                    <div className="absolute inset-0 rounded-full border border-dashed border-white/15 animate-[spin_40s_linear_infinite]" />
                    {/* Middle Orbit */}
                    <div className="absolute inset-6 rounded-full border border-gold/20" />
                    {/* Inner Orbit */}
                    <div className="absolute inset-12 rounded-full border border-white/10" />

                    {/* Central HELPAMART Spark Core */}
                    <div className="relative z-10 w-16 h-16 rounded-full bg-gradient-to-br from-gold-light via-gold to-navy-mid flex flex-col items-center justify-center shadow-[0_0_25px_rgba(183,122,34,0.5)] border border-gold-pale/40">
                      <Sparkles className="h-6 w-6 text-white" />
                      <span className="text-[0.5625rem] font-bold text-white tracking-widest uppercase mt-0.5">HM</span>
                    </div>

                    {/* Orbiting Node 1: Mentor */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 px-2.5 py-1 rounded-full bg-navy border border-gold/40 text-[0.625rem] font-medium text-white shadow-md flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                      Mentor
                    </div>

                    {/* Orbiting Node 2: Learner */}
                    <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 px-2.5 py-1 rounded-full bg-navy border border-white/20 text-[0.625rem] font-medium text-white/80 shadow-md flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                      Learner
                    </div>

                    {/* Orbiting Node 3: Guide */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 px-2.5 py-1 rounded-full bg-navy border border-white/20 text-[0.625rem] font-medium text-white/80 shadow-md flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold-light" />
                      Guide
                    </div>

                    {/* Orbiting Node 4: Community */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 px-2.5 py-1 rounded-full bg-navy border border-white/20 text-[0.625rem] font-medium text-white/80 shadow-md flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                      Circle
                    </div>
                  </div>
                </div>

                {/* Micro detail statement */}
                <div className="mt-4 pt-4 border-t border-white/10 text-center">
                  <p className="text-xs text-white/70 italic font-display">
                    "Someone once answered your question. Pass that kindness on."
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          2. COMPACT BUT POWERFUL CTA SECTION
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="border-b border-white/10 bg-navy-mid/40 relative z-10">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-1.5">
                Ready to take the next step?
              </p>
              <h3 className="text-xl sm:text-2xl font-display text-white">
                Find someone who can move you forward — or become that person for someone else.
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                to="/find-mentor"
                className="inline-flex items-center gap-2 bg-gold hover:bg-gold-mid text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 hover:shadow-[0_6px_20px_rgba(183,122,34,0.35)] group"
              >
                <span>Find a Mentor</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                to="/offer-help"
                className="inline-flex items-center gap-2 border border-white/25 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:border-white/50 hover:bg-white/5 transition-all"
              >
                <span>Offer Your Help</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          3. VISUAL SEPARATOR WITH HELPAMART EMBLEM
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="relative py-2 z-10">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-center">
          <div className="w-full border-t border-white/10 relative flex items-center justify-center">
            <span className="absolute bg-navy px-4 text-[0.625rem] font-bold tracking-[0.25em] text-gold uppercase flex items-center gap-2">
              <span className="w-1 h-1 rounded-full bg-gold" />
              HELP · GROW · HELP
              <span className="w-1 h-1 rounded-full bg-gold" />
            </span>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          4. MAIN NAVIGATION & BRAND GRID
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 relative z-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-12 lg:gap-10">
          {/* Brand & Newsletter Column */}
          <div className="md:col-span-12 lg:col-span-4 flex flex-col justify-between">
            <div>
              <Link to="/" className="inline-block mb-4" aria-label="HELPAMART home">
                <img
                  src="/helpamart-logo.png"
                  alt="HELPAMART"
                  className="h-14 w-auto object-contain drop-shadow-[0_0_2px_rgba(255,255,255,0.7)]"
                />
              </Link>

              <p className="text-white/70 text-sm leading-relaxed max-w-sm mb-6 font-normal">
                A premium human mentorship platform. Real people sharing genuine lessons, navigating crossroads, and passing experience forward.
              </p>

              {/* Social Media Links with refined micro-interactions */}
              <div className="flex items-center gap-2.5 mb-8">
                <SocialLink href="https://twitter.com" aria-label="HELPAMART on X / Twitter">
                  <Twitter className="h-4 w-4" />
                </SocialLink>
                <SocialLink href="https://linkedin.com" aria-label="HELPAMART on LinkedIn">
                  <Linkedin className="h-4 w-4" />
                </SocialLink>
                <SocialLink href="https://instagram.com" aria-label="HELPAMART on Instagram">
                  <Instagram className="h-4 w-4" />
                </SocialLink>
              </div>
            </div>

            {/* Newsletter / Stay in the loop */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 max-w-sm">
              <div className="flex items-center gap-2 text-gold text-xs font-semibold uppercase tracking-wider mb-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span>Stay in the loop</span>
              </div>
              <p className="text-white/60 text-xs leading-relaxed mb-3">
                Thoughtful ideas, community breakthroughs, and mentorship insights delivered gently.
              </p>

              {subscribed ? (
                <div className="flex items-center gap-2 text-xs text-gold-light bg-gold/10 px-3 py-2 rounded-lg border border-gold/20">
                  <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />
                  <span>You're in the loop. Welcome to HELPAMART.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Your email address"
                    aria-label="Email address for HELPAMART newsletter"
                    required
                    className="w-full bg-navy/80 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-gold transition-colors"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe to newsletter"
                    className="bg-gold hover:bg-gold-mid text-white px-3.5 py-2 rounded-lg text-xs font-semibold shrink-0 transition-colors cursor-pointer flex items-center justify-center"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Links Column 1: Explore */}
          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-gold uppercase mb-5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              Explore
            </p>
            <ul className="space-y-3">
              {EXPLORE_LINKS.map(l => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-white/70 hover:text-gold text-sm transition-all duration-150 inline-flex items-center gap-1.5 hover:translate-x-1"
                  >
                    <span>{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links Column 2: Community */}
          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-gold uppercase mb-5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              Community
            </p>
            <ul className="space-y-3">
              {COMMUNITY_LINKS.map(l => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-white/70 hover:text-gold text-sm transition-all duration-150 inline-flex items-center gap-1.5 hover:translate-x-1"
                  >
                    <span>{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links Column 3: HELPAMART */}
          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-gold uppercase mb-5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              Platform
            </p>
            <ul className="space-y-3">
              {HELPAMART_LINKS.map(l => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-white/70 hover:text-gold text-sm transition-all duration-150 inline-flex items-center gap-1.5 hover:translate-x-1"
                  >
                    <span>{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Links Column 4: Legal & Trust */}
          <div className="col-span-6 sm:col-span-3 lg:col-span-2">
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] text-gold uppercase mb-5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-gold" />
              Trust & Legal
            </p>
            <ul className="space-y-3">
              {LEGAL_LINKS.map(l => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-white/70 hover:text-gold text-sm transition-all duration-150 inline-flex items-center gap-1.5 hover:translate-x-1"
                  >
                    <span>{l.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          5. GIANT AMBIENT WORDMARK & JOURNEY LINE
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <div className="border-t border-white/10 overflow-hidden relative z-10">
        <div ref={wordmarkRef} className="max-w-7xl mx-auto px-6 pt-8 pb-12 flex flex-col">
          {/* Subtle Ambient Wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={wordmarkInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.9, ease }}
            className="relative overflow-hidden py-2"
          >
            <span
              className="font-display text-[12vw] md:text-[9vw] font-normal tracking-tight leading-none select-none block"
              style={{ color: 'rgba(255,255,255,0.04)' }}
              aria-hidden="true"
            >
              HELPAMART
            </span>

            {/* Glowing Golden Journey Horizon Line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={wordmarkInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.2, ease, delay: 0.3 }}
              className="absolute bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold/80 to-transparent origin-center"
            />
          </motion.div>

          {/* Copyright & Core Signature Row */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6 pt-4 border-t border-white/5 text-xs text-white/50">
            {/* Left */}
            <div>
              <p>
                © {new Date().getFullYear()} HELPAMART. Made for people helping people.
              </p>
            </div>

            {/* Center: Brand Philosophy Tag */}
            <div className="flex items-center gap-2 text-[0.6875rem] tracking-wider text-white/60 uppercase">
              <span>Learn</span>
              <span className="text-gold">→</span>
              <span>Grow</span>
              <span className="text-gold">→</span>
              <span className="text-gold-light font-medium">Give Back</span>
            </div>

            {/* Right: Closing Note & Quick Links */}
            <div className="flex items-center gap-4">
              <span className="font-display italic text-white/70 text-sm">
                I am here for you.
              </span>
              <span className="text-white/20">·</span>
              <Link to="/" className="hover:text-gold transition-colors">Privacy</Link>
              <span className="text-white/20">·</span>
              <Link to="/" className="hover:text-gold transition-colors">Terms</Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SocialLink({
  href,
  children,
  ...props
}: {
  href: string
  children: React.ReactNode
  [key: string]: unknown
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-9 h-9 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-white/60 hover:text-gold hover:border-gold/40 hover:bg-gold/10 hover:-translate-y-0.5 transition-all duration-200"
      {...props}
    >
      {children}
    </a>
  )
}
