import { useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  Users, Zap, Briefcase, GraduationCap, Heart,
  ArrowRight, CheckCircle2, Sparkles, Lightbulb, MessageCircle,
  HelpCircle, Target, ShieldCheck, Star, Clock, ArrowUpRight
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'

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

export default function OfferHelp() {
  const { user, mentor } = useAuth()
  const navigate = useNavigate()

  // Handle CTA routing based on auth state
  const handleOfferHelpClick = () => {
    if (!user) {
      navigate('/signup?next=/become-a-mentor')
    } else if (mentor) {
      navigate('/mentor-dashboard')
    } else {
      navigate('/become-a-mentor')
    }
  }

  const primaryCtaLabel = !user
    ? 'Offer Your Help'
    : mentor
    ? 'Go to Mentor Dashboard'
    : 'Start Mentor Profile'

  return (
    <div className="bg-ivory min-h-screen text-navy overflow-hidden">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          1. HERO SECTION (With The Knowledge Chain)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-navy text-white min-h-[90vh] relative overflow-hidden flex items-center py-20 lg:py-28">
        {/* Subtle background glow & constellation grain */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '32px 32px',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/4 -left-32 w-96 h-96 rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #B77A22 0%, transparent 70%)' }}
          aria-hidden="true"
        />
        <div
          className="absolute -bottom-20 right-10 w-[500px] h-[500px] rounded-full opacity-15 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #D8A24A 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-6 w-full relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Narrative & Action */}
            <div className="lg:col-span-6 xl:col-span-6">
              <FadeIn delay={0.05}>
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-gold text-xs font-semibold tracking-[0.15em] uppercase mb-6">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                  Offer Help
                  <span className="text-white/40">·</span>
                  <span className="text-white/70 font-normal tracking-normal lowercase">pass it forward</span>
                </div>
              </FadeIn>

              <FadeIn delay={0.15}>
                <h1 className="text-display-xl sm:text-display-2xl font-display text-white mb-6 leading-[1.08]">
                  You learned it.<br />
                  <em className="italic" style={{ color: '#D8A24A', fontFamily: 'var(--font-display)' }}>
                    Now pass it on.
                  </em>
                </h1>
              </FadeIn>

              <FadeIn delay={0.25}>
                <p className="text-white/70 text-lg sm:text-xl font-normal leading-relaxed mb-8 max-w-xl">
                  Someone once helped you take the next step. Now you can be that person for someone else.
                  Your experience might be the exact answer someone is looking for today.
                </p>
              </FadeIn>

              {/* Dynamic Auth / Action Block */}
              <FadeIn delay={0.35}>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8">
                  <button
                    onClick={handleOfferHelpClick}
                    className="inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-mid text-white px-8 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:shadow-[0_8px_30px_rgba(183,122,34,0.4)] group cursor-pointer"
                  >
                    <span>{primaryCtaLabel}</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </button>

                  <Link
                    to="/find-mentor"
                    className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-7 py-4 rounded-xl font-semibold text-base hover:border-white/40 hover:bg-white/5 transition-all"
                  >
                    Find a Mentor
                  </Link>
                </div>

                {/* Status Callout Pill */}
                {user ? (
                  <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold" />
                    <span>
                      Signed in as <strong className="text-white font-medium">{user.name}</strong>
                      {mentor ? ' · Mentor profile active' : ' · Ready to build your profile'}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-white/50">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gold/80" /> You set your own hours
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-gold/80" /> Free or paid sessions
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-gold/80" /> 5-minute setup
                    </span>
                  </div>
                )}
              </FadeIn>
            </div>

            {/* Right Column: The Knowledge Chain Signature Visual */}
            <div className="lg:col-span-6 xl:col-span-6">
              <FadeIn delay={0.2} className="relative">
                {/* Visual Frame */}
                <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-navy-mid/60 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur-sm group">
                  {/* Top Bar Label */}
                  <div className="px-6 py-3.5 bg-navy/90 border-b border-white/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gold" />
                      <span className="font-semibold text-white/90 tracking-wider uppercase text-[0.6875rem]">
                        The Knowledge Chain
                      </span>
                    </div>
                    <span className="text-white/40 text-[0.6875rem] tracking-wider uppercase">
                      Pass It Forward
                    </span>
                  </div>

                  {/* Editorial Illustration */}
                  <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full overflow-hidden bg-navy">
                    <img
                      src="/offer-help-chain.jpg"
                      alt="The Knowledge Chain: From learning to guiding to growing"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    {/* Gradient Overlay for legibility */}
                    <div className="absolute inset-0 bg-gradient-to-t from-navy via-transparent to-transparent opacity-80" />
                  </div>

                  {/* Interactive Nodes Strip */}
                  <div className="p-6 bg-navy/95 border-t border-white/10">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-gold/30 transition-colors">
                        <p className="text-[0.625rem] font-bold tracking-widest text-gold uppercase mb-1">
                          Person 01
                        </p>
                        <h2 className="text-xs font-semibold text-white">Learned</h2>
                        <p className="text-[0.6875rem] text-white/50 mt-0.5 line-clamp-1">Experience gained</p>
                      </div>

                      <div className="bg-gold/10 rounded-xl p-3 border border-gold/30 hover:border-gold transition-colors">
                        <p className="text-[0.625rem] font-bold tracking-widest text-gold-light uppercase mb-1">
                          Person 02
                        </p>
                        <h2 className="text-xs font-semibold text-white">Guided</h2>
                        <p className="text-[0.6875rem] text-gold-pale mt-0.5 line-clamp-1">Pass the spark</p>
                      </div>

                      <div className="bg-white/5 rounded-xl p-3 border border-white/5 hover:border-white/20 transition-colors">
                        <p className="text-[0.625rem] font-bold tracking-widest text-white/60 uppercase mb-1">
                          Person 03
                        </p>
                        <h2 className="text-xs font-semibold text-white">Growing</h2>
                        <p className="text-[0.6875rem] text-white/50 mt-0.5 line-clamp-1">Moving forward</p>
                      </div>
                    </div>

                    {/* Flow indicators */}
                    <div className="flex items-center justify-center gap-2 mt-4 text-[0.6875rem] text-white/60 uppercase tracking-widest">
                      <span>Experience</span>
                      <span className="text-gold">→</span>
                      <span>Perspective</span>
                      <span className="text-gold">→</span>
                      <span>Guidance</span>
                      <span className="text-gold">→</span>
                      <span className="text-white font-medium">Growth</span>
                    </div>
                  </div>
                </div>

                {/* Subtle Floating Quote Pill */}
                <div className="hidden sm:flex absolute -bottom-5 -left-6 bg-white text-navy px-5 py-3 rounded-2xl shadow-[0_10px_30px_rgba(7,26,53,0.3)] border border-grey-soft items-center gap-3 z-20">
                  <div className="w-8 h-8 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-gold" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-navy">"I didn't need a lecture."</p>
                    <p className="text-[0.6875rem] text-grey">"I needed someone 2 years ahead of me."</p>
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          2. THE CORE HELPAMART PHILOSOPHY
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-ivory-light py-20 border-b border-grey-soft">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              The HELPAMART Philosophy
              <span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-lg sm:text-display-xl font-display text-navy mb-6">
              People who have learned something can help someone who is just beginning.
            </h2>
            <p className="text-grey text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
              You do not need to be a celebrity founder, a 30-year veteran, or an academic theorist.
              If you have made a transition, survived an interview, or built a project from scratch,
              you already have the exact perspective someone needs right now.
            </p>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          3. WHAT CAN YOU SHARE?
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-ivory py-24">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-3 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              Your Experience Has Value
              <span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-lg sm:text-display-xl font-display text-navy mb-4">
              What can you share?
            </h2>
            <p className="text-grey text-base leading-relaxed">
              Every stage of your journey contains insights that books and documentation miss.
              Here are the core areas mentors on HELPAMART offer guidance in.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {SHARE_CARDS.map((card, i) => (
              <FadeIn key={card.title} delay={i * 0.08}>
                <div className="bg-white rounded-2xl p-8 border border-grey-soft shadow-soft hover:-translate-y-1 hover:border-gold/40 hover:shadow-card transition-all duration-300 flex flex-col h-full group">
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-ivory flex items-center justify-center text-navy group-hover:bg-gold/10 group-hover:text-gold transition-colors">
                      {card.icon}
                    </div>
                    <span className="text-[0.6875rem] font-bold tracking-widest text-gold uppercase px-2.5 py-1 rounded-md bg-gold/10">
                      {card.tag}
                    </span>
                  </div>

                  <h3 className="text-xl font-display text-navy mb-3 group-hover:text-gold transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm font-medium text-navy/90 mb-3 leading-snug">
                    {card.highlight}
                  </p>
                  <p className="text-xs text-grey leading-relaxed mt-auto">
                    {card.description}
                  </p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          4. ONE PERSON CAN CHANGE A PATH (Flowchart)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-navy text-white py-24 relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden="true"
        />

        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-3 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              The HELPAMART Chain Reaction
              <span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-lg sm:text-display-xl font-display text-white mb-4">
              One conversation can change the direction of someone's journey.
            </h2>
            <p className="text-white/60 text-base leading-relaxed">
              When advice is tailored to a human being instead of a generic audience, progress accelerates.
            </p>
          </FadeIn>

          {/* 4 Connected Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {STEPS_CHAIN.map((step, idx) => (
              <FadeIn key={step.title} delay={idx * 0.1}>
                <div className="relative rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col h-full hover:border-gold/50 transition-colors group">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl font-display text-gold">0{idx + 1}</span>
                    <div className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/80 group-hover:text-gold group-hover:bg-gold/15 transition-colors">
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="text-lg font-display text-white mb-2">{step.title}</h3>
                  <p className="text-xs font-medium text-gold-light mb-2">{step.tagline}</p>
                  <p className="text-xs text-white/60 leading-relaxed mt-auto">{step.description}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          5. BEFORE / AFTER TRANSFORMATION
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-ivory py-24 border-b border-grey-soft">
        <div className="max-w-6xl mx-auto px-6">
          <FadeIn className="text-center max-w-3xl mx-auto mb-16">
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-3 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              The Transformation
              <span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-lg sm:text-display-xl font-display text-navy mb-4">
              From stuck in the noise to moving forward.
            </h2>
            <p className="text-grey text-base leading-relaxed">
              This is the difference one honest mentor conversation creates.
            </p>
          </FadeIn>

          <div className="grid grid-cols-1 lg:grid-cols-11 gap-6 items-center">
            {/* Before Card */}
            <FadeIn delay={0.1} className="lg:col-span-5 h-full">
              <div className="bg-white rounded-3xl p-8 border border-grey-soft shadow-soft h-full flex flex-col">
                <div className="flex items-center gap-2.5 mb-6 text-grey">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                  <span className="text-xs font-bold tracking-widest uppercase text-grey">Before Mentorship</span>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="p-4 rounded-xl bg-ivory border border-grey-soft text-sm text-navy/80 italic font-display text-lg">
                    "I'm stuck. Too many tutorials point in opposite directions."
                  </div>
                  <div className="p-4 rounded-xl bg-ivory border border-grey-soft text-sm text-navy/80 italic font-display text-lg">
                    "Where do I actually start? Every roadmap looks overwhelming."
                  </div>
                  <div className="p-4 rounded-xl bg-ivory border border-grey-soft text-sm text-navy/80 italic font-display text-lg">
                    "Is this even the right path, or am I wasting my months alone?"
                  </div>
                </div>
                <p className="text-xs text-grey mt-auto">
                  Learning alone often means fighting uncertainty rather than building skill.
                </p>
              </div>
            </FadeIn>

            {/* Middle Catalyst Bridge */}
            <FadeIn delay={0.2} className="lg:col-span-1 text-center py-4 lg:py-0">
              <div className="w-12 h-12 rounded-full bg-gold text-white flex items-center justify-center mx-auto shadow-gold animate-bounce">
                <Sparkles className="h-5 w-5" />
              </div>
              <p className="text-[0.625rem] font-bold uppercase tracking-widest text-gold mt-2 hidden lg:block">
                A Conversation
              </p>
            </FadeIn>

            {/* After Card */}
            <FadeIn delay={0.3} className="lg:col-span-5 h-full">
              <div className="bg-navy text-white rounded-3xl p-8 border border-gold/30 shadow-[0_12px_40px_rgba(7,26,53,0.15)] h-full flex flex-col relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full blur-2xl pointer-events-none" />
                <div className="flex items-center gap-2.5 mb-6 text-gold">
                  <span className="w-2.5 h-2.5 rounded-full bg-gold" />
                  <span className="text-xs font-bold tracking-widest uppercase text-gold">After A Session</span>
                </div>
                <div className="space-y-4 mb-6 relative z-10">
                  <div className="p-4 rounded-xl bg-white/10 border border-white/10 text-sm text-white font-display text-lg">
                    "I know the exact two things I need to focus on this week."
                  </div>
                  <div className="p-4 rounded-xl bg-white/10 border border-white/10 text-sm text-white font-display text-lg">
                    "I have someone who has actually been there in my corner."
                  </div>
                  <div className="p-4 rounded-xl bg-white/10 border border-white/10 text-sm text-white font-display text-lg">
                    "I stopped second-guessing myself and submitted the application."
                  </div>
                </div>
                <p className="text-xs text-white/60 mt-auto relative z-10">
                  Clarity comes from conversation with people who have walked the path.
                </p>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          6. MENTOR PROFILE PREVIEW
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-ivory-light py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Narrative */}
            <div className="lg:col-span-6">
              <FadeIn>
                <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-3 flex items-center gap-2">
                  <span className="w-5 h-px bg-gold" />
                  How It Works For You
                </p>
                <h2 className="text-display-lg sm:text-display-xl font-display text-navy mb-6">
                  Turn what you know into someone's next step.
                </h2>
                <p className="text-grey text-base leading-relaxed mb-6">
                  Build an editorial mentor profile in minutes. State what topics you can help with, set your calendar rules, and decide if you want to offer free sessions, paid advice, or both.
                </p>
                <ul className="space-y-3.5 mb-8 text-sm text-navy/85">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                    <span><strong>Full control over your schedule:</strong> Set your custom weekly availability windows.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                    <span><strong>Defined conversation formats:</strong> 30-min chats, portfolio reviews, or structured mock sessions.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-gold shrink-0 mt-0.5" />
                    <span><strong>No commitments or quotas:</strong> Help as little as 1 hour a month or as much as you like.</span>
                  </li>
                </ul>

                <button
                  onClick={handleOfferHelpClick}
                  className="inline-flex items-center gap-2 bg-navy text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-navy-mid transition-all cursor-pointer group"
                >
                  <span>Build Your Mentor Profile</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </FadeIn>
            </div>

            {/* Right: Mock Profile Card */}
            <div className="lg:col-span-6">
              <FadeIn delay={0.2}>
                <div className="bg-white rounded-3xl p-8 border border-grey-soft shadow-[0_12px_40px_rgba(7,26,53,0.08)] max-w-lg mx-auto relative">
                  <div className="absolute -top-3.5 right-6 px-3.5 py-1 bg-gold text-white text-[0.6875rem] font-bold uppercase tracking-wider rounded-full shadow-sm">
                    Live Profile Preview
                  </div>

                  {/* Profile Header */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-navy text-gold font-display text-2xl flex items-center justify-center font-bold border-2 border-gold/40 shrink-0">
                      EC
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-xl text-navy">Elena Chen</h3>
                        <CheckCircle2 className="h-4 w-4 text-gold" />
                      </div>
                      <p className="text-xs text-grey font-medium">Senior Product Designer · ex-Stripe</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-gold">
                        <Star className="h-3.5 w-3.5 fill-gold text-gold" />
                        <span className="font-bold text-navy">5.0</span>
                        <span className="text-grey">(34 sessions completed)</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-navy/80 leading-relaxed mb-6 bg-ivory-light p-3.5 rounded-xl border border-grey-soft">
                    "Helping first-generation designers and career switchers craft portfolios that hiring managers can't ignore."
                  </p>

                  {/* Helping With */}
                  <div className="mb-6">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-grey mb-2.5">
                      Helping people with
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {['Design Systems', 'Portfolio Review', 'Career Pivot', 'Design Thinking'].map(skill => (
                        <span key={skill} className="px-2.5 py-1 rounded-lg bg-ivory text-navy text-xs font-medium border border-grey-soft">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Available Services */}
                  <div className="mb-6">
                    <p className="text-[0.6875rem] font-bold uppercase tracking-widest text-grey mb-2.5">
                      Available for
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between p-3 rounded-xl border border-grey-soft text-xs">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3.5 w-3.5 text-gold" />
                          <span className="font-medium text-navy">30 min Career Strategy</span>
                        </div>
                        <span className="font-semibold text-gold">Free</span>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-xl border border-grey-soft text-xs">
                        <div className="flex items-center gap-2">
                          <Briefcase className="h-3.5 w-3.5 text-gold" />
                          <span className="font-medium text-navy">45 min Portfolio Teardown</span>
                        </div>
                        <span className="font-semibold text-navy">$35</span>
                      </div>
                    </div>
                  </div>

                  {/* Testimonial Snippet */}
                  <div className="border-t border-grey-soft pt-4 text-xs text-grey italic">
                    "Elena gave me more actionable feedback in 30 minutes than 3 months of job hunting."
                  </div>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          7. VALUE CALLOUT FOR LOGGED OUT / LOGGED IN
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-ivory py-20 border-t border-grey-soft">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <FadeIn>
            <h2 className="text-display-md sm:text-display-lg font-display text-navy mb-4">
              Ready to share what you've learned?
            </h2>
            <p className="text-grey text-base leading-relaxed max-w-xl mx-auto mb-8">
              Create your mentor profile, choose what topics you can help with, set your availability, and let ambitious people find you.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleOfferHelpClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-mid text-white px-8 py-3.5 rounded-xl font-semibold transition-all hover:shadow-[0_6px_20px_rgba(183,122,34,0.35)] cursor-pointer"
              >
                <span>Get Started Now</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              {!user && (
                <Link
                  to="/login?next=/become-a-mentor"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-grey-mid text-navy px-7 py-3.5 rounded-xl font-medium hover:border-navy transition-colors text-sm"
                >
                  Already have an account? Sign In
                </Link>
              )}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          8. FINAL EMOTIONAL CTA
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-navy text-white py-28 relative overflow-hidden">
        {/* Background elements */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10 pointer-events-none"
          style={{ background: 'radial-gradient(circle, #B77A22 0%, transparent 70%)' }}
          aria-hidden="true"
        />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <FadeIn>
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-6 flex items-center justify-center gap-2">
              <span className="w-6 h-px bg-gold inline-block" />
              PASS IT FORWARD
              <span className="w-6 h-px bg-gold inline-block" />
            </p>
            <h2 className="text-display-xl sm:text-display-2xl font-display text-white mb-6">
              Someone out there is looking for<br />
              <em className="italic" style={{ color: '#D8A24A', fontFamily: 'var(--font-display)' }}>
                what you already know.
              </em>
            </h2>
            <p className="text-white/70 text-lg leading-relaxed max-w-xl mx-auto mb-10">
              You don't need to know everything. You just need to know something someone else is trying to learn.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={handleOfferHelpClick}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gold hover:bg-gold-mid text-white px-9 py-4 rounded-xl font-semibold text-base transition-all duration-200 hover:shadow-[0_8px_30px_rgba(183,122,34,0.4)] group cursor-pointer"
              >
                <span>Offer Your Help</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>

              <Link
                to="/find-mentor"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 border border-white/20 text-white px-8 py-4 rounded-xl font-semibold text-base hover:border-white/40 hover:bg-white/5 transition-all"
              >
                Find a Mentor
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>
    </div>
  )
}

/* ─────────────────────────────────────────────────
   DATA: What You Can Share
───────────────────────────────────────────────── */
const SHARE_CARDS = [
  {
    title: 'Mentorship',
    tag: '1:1 Guidance',
    highlight: "Help someone navigate what you've already experienced.",
    description: 'Share honest roadmaps, avoid common mistakes, and provide calm clarity on difficult career crossroads.',
    icon: <Users className="h-6 w-6" />,
  },
  {
    title: 'Skills & Craft',
    tag: 'Practice',
    highlight: "Teach something you've spent years learning.",
    description: 'From clean code architecture to design systems, break down complex concepts with practical, hands-on feedback.',
    icon: <Zap className="h-6 w-6" />,
  },
  {
    title: 'Career & Industry',
    tag: 'Real Lessons',
    highlight: "Share the lessons that don't come from textbooks.",
    description: 'Interview preparation, salary negotiation, resume teardowns, and navigating organizational dynamics.',
    icon: <Briefcase className="h-6 w-6" />,
  },
  {
    title: 'Projects & MVPs',
    tag: 'Execution',
    highlight: "Help someone turn an idea into something real.",
    description: 'Give feedback on system design, debug architectural roadblocks, and help first-time founders ship.',
    icon: <Lightbulb className="h-6 w-6" />,
  },
  {
    title: 'Exam & College',
    tag: 'Admissions',
    highlight: "Share what you wish someone had told you earlier.",
    description: 'Demystify university choices, master’s programs, study abroad logistics, and campus recruitment realities.',
    icon: <GraduationCap className="h-6 w-6" />,
  },
  {
    title: 'Life & Perspective',
    tag: 'Empathy',
    highlight: 'Sometimes perspective is the most valuable advice.',
    description: 'Normalize imposter syndrome, combat burnout, and help others find steady confidence in their own abilities.',
    icon: <Heart className="h-6 w-6" />,
  },
]

/* ─────────────────────────────────────────────────
   DATA: The 4 Connected Chain Steps
───────────────────────────────────────────────── */
const STEPS_CHAIN = [
  {
    title: 'The Question',
    tagline: 'Stuck in generic theory',
    description: 'The student or professional has watched dozens of tutorials, but cannot connect them to their specific goal.',
    icon: <HelpCircle className="h-5 w-5" />,
  },
  {
    title: 'The Conversation',
    tagline: '30 minutes with a human',
    description: 'A focused, empathetic conversation with someone who already walked that exact path two years earlier.',
    icon: <MessageCircle className="h-5 w-5" />,
  },
  {
    title: 'The Clarity',
    tagline: 'Noise disappears',
    description: 'The overwhelming list of options narrows down to the two or three concrete actions that actually matter.',
    icon: <Target className="h-5 w-5" />,
  },
  {
    title: 'The Next Step',
    tagline: 'Forward momentum',
    description: 'The application is sent. The prototype is launched. Progress replaces paralysis, and the chain continues.',
    icon: <ArrowUpRight className="h-5 w-5" />,
  },
]
