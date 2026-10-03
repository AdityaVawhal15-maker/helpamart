import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Sparkles, Shield } from 'lucide-react'

const ease = [0.16, 1, 0.3, 1] as const

function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export default function Pricing() {
  return (
    <div className="bg-ivory min-h-screen">
      {/* ── Hero header ── */}
      <div className="bg-ivory-light border-b border-grey-soft py-20 relative overflow-hidden">
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 70% 60% at 60% 50%, rgba(183,122,34,0.07) 0%, transparent 70%)',
          }}
        />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, ease }}
          >
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              Pricing
              <span className="w-5 h-px bg-gold" />
            </p>
            <h1 className="text-display-xl font-display text-navy mb-5">
              Start Free.{' '}
              <em style={{ fontStyle: 'italic', color: '#B77A22', fontFamily: 'var(--font-display)' }}>
                Continue for ₹99.
              </em>
            </h1>
            <p className="text-grey text-lg max-w-xl mx-auto leading-relaxed">
              Your first mentoring session is on us. If you connect with your mentor and want to go further, your second session is just ₹99.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Journey cards ── */}
      <div className="max-w-3xl mx-auto px-6 py-24">
        <div className="relative flex flex-col items-center gap-0">

          {/* ── Step 01: FREE ── */}
          <FadeIn delay={0.1} className="w-full">
            <div className="relative rounded-3xl border-2 border-gold/30 bg-navy overflow-hidden p-8 md:p-10">
              {/* Background dot texture */}
              <div
                className="absolute inset-0 pointer-events-none opacity-[0.04]"
                style={{
                  backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
                  backgroundSize: '24px 24px',
                }}
              />
              {/* Gold glow top-right */}
              <div
                className="absolute top-0 right-0 w-64 h-64 pointer-events-none"
                style={{
                  background: 'radial-gradient(circle, rgba(183,122,34,0.18) 0%, transparent 70%)',
                }}
              />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex-1">
                  {/* Step label */}
                  <p className="text-[0.6875rem] font-bold tracking-[0.22em] text-gold/70 uppercase mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-gold/50" />
                    Step 01
                  </p>
                  <h2 className="text-xl font-display text-white mb-1">First Session</h2>
                  <p className="text-white/55 text-sm leading-relaxed max-w-xs">
                    Meet your mentor. Ask what matters most. No commitment, no cost.
                  </p>

                  {/* Trust badge */}
                  <div className="mt-5 inline-flex items-center gap-2 bg-white/8 border border-white/12 rounded-xl px-3.5 py-2">
                    <Sparkles className="h-3.5 w-3.5 text-gold shrink-0" />
                    <span className="text-white/70 text-xs font-medium">No credit card needed</span>
                  </div>
                </div>

                {/* Price display */}
                <div className="text-right sm:text-right">
                  <p
                    className="font-display leading-none tracking-tight"
                    style={{
                      fontSize: 'clamp(4rem, 10vw, 6rem)',
                      color: '#D8A24A',
                    }}
                  >
                    FREE
                  </p>
                  <p className="text-white/40 text-sm mt-1 font-medium">₹0 · Zero risk</p>
                </div>
              </div>
            </div>
          </FadeIn>

          {/* ── Connector ── */}
          <FadeIn delay={0.25} className="flex flex-col items-center py-2 z-10">
            <div className="w-px h-8 bg-gradient-to-b from-gold/60 to-gold/20" />
            <div
              className="w-7 h-7 rounded-full border-2 border-gold/50 bg-ivory flex items-center justify-center"
              style={{ boxShadow: '0 0 0 4px rgba(183,122,34,0.08)' }}
            >
              <ArrowRight className="h-3.5 w-3.5 text-gold rotate-90" />
            </div>
            <div className="w-px h-8 bg-gradient-to-b from-gold/20 to-transparent" />
          </FadeIn>

          {/* ── Step 02: ₹99 ── */}
          <FadeIn delay={0.35} className="w-full">
            <div className="relative rounded-3xl border-2 border-grey-soft bg-white overflow-hidden p-8 md:p-10">
              {/* Subtle gold tint top edge */}
              <div
                className="absolute top-0 left-0 right-0 h-px pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(183,122,34,0.3), transparent)' }}
              />

              <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div className="flex-1">
                  {/* Step label */}
                  <p className="text-[0.6875rem] font-bold tracking-[0.22em] text-gold/70 uppercase mb-3 flex items-center gap-2">
                    <span className="w-4 h-px bg-gold/50" />
                    Step 02
                  </p>
                  <h2 className="text-xl font-display text-navy mb-1">Second Session</h2>
                  <p className="text-grey text-sm leading-relaxed max-w-xs">
                    Continue your journey. Go deeper with the same mentor.
                  </p>

                  {/* Trust badge */}
                  <div className="mt-5 inline-flex items-center gap-2 bg-gold/8 border border-gold/20 rounded-xl px-3.5 py-2">
                    <Shield className="h-3.5 w-3.5 text-gold shrink-0" />
                    <span className="text-navy/70 text-xs font-medium">Simple. No subscriptions.</span>
                  </div>
                </div>

                {/* Price display */}
                <div className="text-right sm:text-right">
                  <p
                    className="font-display leading-none tracking-tight text-navy"
                    style={{ fontSize: 'clamp(4rem, 10vw, 6rem)' }}
                  >
                    <span style={{ color: '#B77A22' }}>₹</span>99
                  </p>
                  <p className="text-grey text-sm mt-1 font-medium">Per session · Pay as you go</p>
                </div>
              </div>
            </div>
          </FadeIn>
        </div>

        {/* ── CTA ── */}
        <FadeIn delay={0.5} className="mt-14 flex flex-col items-center gap-4 text-center">
          <Link
            to="/find-mentor"
            className="group inline-flex items-center gap-2 bg-navy text-white px-8 py-4 rounded-xl text-base font-semibold hover:bg-navy-mid transition-all hover:shadow-[0_8px_28px_rgba(7,26,53,0.22)]"
          >
            Start Your Free Session
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="text-grey text-sm">
            No account needed to browse.{' '}
            <Link to="/find-mentor" className="text-gold hover:underline font-medium">
              Explore mentors →
            </Link>
          </p>
        </FadeIn>

        {/* ── Mentor note ── */}
        <FadeIn delay={0.6} className="mt-16">
          <div className="bg-gold/8 border border-gold/20 rounded-2xl p-7 text-center">
            <p className="text-navy font-semibold font-display text-lg mb-2">
              Want to offer mentorship?
            </p>
            <p className="text-grey text-sm leading-relaxed max-w-md mx-auto mb-5">
              Joining HELPAMART as a mentor is completely free. Create your profile, set your own availability, and start helping people who need your experience.
            </p>
            <Link
              to="/become-a-mentor"
              className="group inline-flex items-center gap-2 bg-gold hover:bg-gold-mid text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:shadow-[0_8px_20px_rgba(183,122,34,0.3)]"
            >
              Become a Mentor — It's Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </FadeIn>
      </div>
    </div>
  )
}
