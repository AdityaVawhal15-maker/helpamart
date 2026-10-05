import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView, AnimatePresence } from 'framer-motion'
import { Compass, MessageCircle, Users, ArrowRight, Star, Briefcase, GraduationCap, Zap, Heart, Building2, Globe, ChevronRight, Loader2 } from 'lucide-react'
import { HERO_PILLS, CATEGORIES } from '@/data/taxonomy'
import { supabase } from '@/lib/supabase'
import type { Mentor } from '@/types'
import StoriesSection from '@/components/StoriesSection'
import CommunityHomePreview from '@/components/CommunityHomePreview'

const ease = [0.16, 1, 0.3, 1] as const

// Animation variants
const fadeUpVariant = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.7, ease, delay }
  })
}

const PILL_ICONS: Record<string, React.ReactNode> = {
  'Career': <Briefcase className="h-3.5 w-3.5" />,
  'College': <GraduationCap className="h-3.5 w-3.5" />,
  'Skills': <Zap className="h-3.5 w-3.5" />,
  'Life': <Heart className="h-3.5 w-3.5" />,
  'Business': <Building2 className="h-3.5 w-3.5" />,
  'Community': <Globe className="h-3.5 w-3.5" />,
}

// Position each pill around the image
const PILL_POSITIONS = [
  { top: '10%', left: '-8%', delay: 1.2, duration: 5.5 },
  { top: '28%', left: '-14%', delay: 1.4, duration: 6 },
  { top: '48%', left: '-16%', delay: 1.6, duration: 5 },
  { top: '12%', right: '-8%', delay: 1.3, duration: 5.8 },
  { top: '32%', right: '-14%', delay: 1.5, duration: 6.2 },
  { top: '55%', right: '-6%', delay: 1.7, duration: 5.3 },
  { top: '70%', left: '-8%', delay: 1.8, duration: 5.7 },
]

const BENEFITS = [
  {
    icon: <Compass className="h-5 w-5" />,
    title: 'A New Beginning',
    body: 'Start your journey with the right guidance.',
  },
  {
    icon: <MessageCircle className="h-5 w-5" />,
    title: 'Real Conversations',
    body: 'Ask. Learn. Grow.',
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: 'A Supportive Community',
    body: 'People who genuinely want to help.',
  },
]

const HOW_STEPS = [
  {
    n: '01',
    title: 'Tell us what you need.',
    body: 'Describe where you are and where you want to go.',
    image: '/how-01.jpg',
    alt: 'A student reflecting and writing goals in a journal by a sunlit stone window',
  },
  {
    n: '02',
    title: 'Discover the right person.',
    body: 'Browse real mentors with real experience in your area.',
    image: '/how-02.jpg',
    alt: 'A mentor and student reviewing a map of pathways and opportunities together',
  },
  {
    n: '03',
    title: 'Have a real conversation.',
    body: 'Book a session, show up, and ask what matters most.',
    image: '/how-03.jpg',
    alt: 'A mentor and mentee having a genuine, engaging guidance conversation over coffee',
  },
]

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  'Career': <Briefcase className="h-3.5 w-3.5" />,
  'Technology': <Zap className="h-3.5 w-3.5" />,
  'Design': <Star className="h-3.5 w-3.5" />,
  'Business': <Building2 className="h-3.5 w-3.5" />,
  'Startups': <Star className="h-3.5 w-3.5" />,
  'Education': <GraduationCap className="h-3.5 w-3.5" />,
  'Study Abroad': <Globe className="h-3.5 w-3.5" />,
  'Leadership': <Users className="h-3.5 w-3.5" />,
  'Personal Growth': <Heart className="h-3.5 w-3.5" />,
  'AI & Machine Learning': <Zap className="h-3.5 w-3.5" />,
  'Finance': <Building2 className="h-3.5 w-3.5" />,
  'Interview Preparation': <MessageCircle className="h-3.5 w-3.5" />,
}

export default function Home() {
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [mentorsLoading, setMentorsLoading] = useState(true)
  const [mentorsError, setMentorsError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [heroLoaded, setHeroLoaded] = useState(false)

  const heroRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Trigger hero animation
    const timer = setTimeout(() => setHeroLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    let cancelled = false
    setMentorsLoading(true)
    setMentorsError(null)

    async function fetchMentors() {
      try {
        const { data, error } = await supabase
          .from('mentors')
          .select('*')
          .eq('status', 'published')
          .order('published_at', { ascending: false })
          .limit(8)

        if (cancelled) return

        if (error) {
          console.error('[Home] Supabase mentors error:', error)
          setMentorsError(error.message)
          setMentors([])
          return
        }

        if (!Array.isArray(data)) { setMentors([]); return }

        // Reuse the same mapping logic as FindMentor
        const results: Mentor[] = data.map((row: any) => {
          function parseArr(val: any): any[] {
            if (Array.isArray(val)) return val
            if (typeof val === 'string') { try { return JSON.parse(val) } catch { return [] } }
            return []
          }
          const services = parseArr(row.services)
          const prices = services
            .map((s: any) => (typeof s.priceCents === 'number' ? s.priceCents : null))
            .filter((p: any): p is number => p !== null)
          return {
            id: row.id,
            slug: row.slug,
            name: row.name || '',
            role: row.role || '',
            company: row.company || '',
            location: row.location || '',
            intro: row.intro || '',
            about: row.about || '',
            photoUrl: row.photo_url || null,
            languages: parseArr(row.languages),
            yearsExperience: row.years_experience ?? null,
            linkedinUrl: row.linkedin_url || null,
            websiteUrl: row.website_url || null,
            education: parseArr(row.education),
            companies: parseArr(row.companies),
            achievements: parseArr(row.achievements),
            status: row.status || 'published',
            timezone: row.timezone || 'UTC',
            bufferMinutes: row.buffer_minutes ?? 15,
            advanceDays: row.advance_days ?? 30,
            minNoticeHours: row.min_notice_hours ?? 24,
            maxBookingsPerDay: row.max_bookings_per_day ?? 4,
            categories: parseArr(row.categories),
            skills: parseArr(row.skills),
            services,
            availability: parseArr(row.availability),
            // Derive startingPriceCents live from services if DB column is null
            startingPriceCents: row.starting_price_cents ?? (prices.length > 0 ? Math.min(...prices) : null),
            availabilityPreview: row.availability_preview ?? null,
          }
        })

        setMentors(results)
      } catch (err: any) {
        if (cancelled) return
        console.error('[Home] Unexpected mentors fetch error:', err)
        setMentorsError(err?.message || 'Failed to load mentors')
        setMentors([])
      } finally {
        if (!cancelled) setMentorsLoading(false)
      }
    }

    fetchMentors()
    return () => { cancelled = true }
  }, [])

  const safeMentors = Array.isArray(mentors) ? mentors : []
  const filteredMentors = activeCategory
    ? safeMentors.filter(m => Array.isArray(m?.categories) && m.categories.includes(activeCategory))
    : safeMentors

  return (
    <div className="bg-ivory min-h-screen">
      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HERO
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section
        ref={heroRef}
        className="relative min-h-screen flex items-center overflow-hidden bg-ivory-light pt-16"
      >
        {/* Ambient background */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 70% 40%, rgba(183,122,34,0.07) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 60% 50% at 10% 80%, rgba(7,26,53,0.04) 0%, transparent 70%)',
          }}
        />

        {/* Gold journey line SVG */}
        <motion.svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1440 800"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <motion.path
            d="M-40 600 Q200 500 400 520 Q600 540 700 400 Q800 260 900 280 Q1000 300 1100 200 Q1200 100 1480 150"
            fill="none"
            stroke="url(#goldGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={heroLoaded ? { pathLength: 1, opacity: 1 } : {}}
            transition={{ duration: 2.5, ease, delay: 1.8 }}
          />
          <defs>
            <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B77A22" stopOpacity="0" />
              <stop offset="30%" stopColor="#C88A2D" stopOpacity="0.7" />
              <stop offset="70%" stopColor="#D8A24A" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#B77A22" stopOpacity="0" />
            </linearGradient>
          </defs>
        </motion.svg>

        <div className="max-w-7xl mx-auto px-6 w-full py-24 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* ── Left: Content ── */}
          <div className="flex flex-col items-start">
            {/* Eyebrow */}
            <motion.p
              custom={0.3}
              variants={fadeUpVariant}
              initial="hidden"
              animate={heroLoaded ? 'visible' : 'hidden'}
              className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-gold/80 flex items-center gap-3 mb-6"
            >
              <span className="w-6 h-px bg-gold/60" />
              Real People. Real Guidance. A Brighter You.
            </motion.p>

            {/* Headline */}
            <div className="overflow-hidden mb-2">
              <motion.h1
                custom={0.5}
                variants={fadeUpVariant}
                initial="hidden"
                animate={heroLoaded ? 'visible' : 'hidden'}
                className="text-display-hero text-navy font-display"
              >
                The right person
              </motion.h1>
            </div>
            <div className="overflow-hidden mb-2">
              <motion.div
                custom={0.65}
                variants={fadeUpVariant}
                initial="hidden"
                animate={heroLoaded ? 'visible' : 'hidden'}
                className="text-display-hero text-navy font-display"
              >
                changes{' '}
                <em className="italic-serif not-italic" style={{ fontStyle: 'italic' }}>everything.</em>
              </motion.div>
            </div>

            {/* Brand Statement */}
            <motion.p
              custom={0.85}
              variants={fadeUpVariant}
              initial="hidden"
              animate={heroLoaded ? 'visible' : 'hidden'}
              className="text-xl sm:text-2xl font-display text-navy/85 mt-5 mb-8"
            >
              Your Ambition. Their Experience.
            </motion.p>

            {/* CTAs */}
            <motion.div
              custom={1.0}
              variants={fadeUpVariant}
              initial="hidden"
              animate={heroLoaded ? 'visible' : 'hidden'}
              className="flex flex-col sm:flex-row gap-3 mb-12"
            >
              <Link
                to="/find-mentor"
                className="group inline-flex items-center gap-2 bg-navy text-white px-7 py-3.5 rounded-xl text-base font-semibold hover:bg-navy-mid transition-all hover:shadow-[0_8px_28px_rgba(7,26,53,0.22)]"
              >
                Find Someone to Help
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                to="/become-a-mentor"
                className="inline-flex items-center gap-2 border border-navy/20 bg-white text-navy px-7 py-3.5 rounded-xl text-base font-semibold hover:border-gold/50 hover:bg-ivory-dark/60 transition-all"
              >
                I Can Help Someone
              </Link>
            </motion.div>

            {/* Benefits */}
            <motion.div
              custom={1.15}
              variants={fadeUpVariant}
              initial="hidden"
              animate={heroLoaded ? 'visible' : 'hidden'}
              className="flex flex-col sm:flex-row gap-6"
            >
              {BENEFITS.map(b => (
                <div key={b.title} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center shrink-0 text-gold mt-0.5">
                    {b.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-navy">{b.title}</p>
                    <p className="text-xs text-grey mt-0.5">{b.body}</p>
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Community proof — abstract avatars only */}
            <motion.div
              custom={1.3}
              variants={fadeUpVariant}
              initial="hidden"
              animate={heroLoaded ? 'visible' : 'hidden'}
              className="flex items-center gap-4 mt-8 pt-8 border-t border-grey-soft"
            >
              <AbstractAvatarCluster />
              <p className="text-sm text-grey leading-snug max-w-[200px]">
                A community that helps, grows, and moves forward —{' '}
                <em className="font-display text-gold not-italic italic">together.</em>
              </p>
            </motion.div>
          </div>

          {/* ── Right: Hero Visual ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={heroLoaded ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 1, ease, delay: 0.8 }}
            className="relative hidden lg:flex justify-center items-center"
          >
            {/* Main image */}
            <div className="relative w-full max-w-lg aspect-[4/3] rounded-3xl overflow-hidden shadow-[0_24px_80px_rgba(7,26,53,0.15)]">
              <img
                src="/hero.jpg"
                alt="A mentor helping someone climb steps toward their goals"
                className="w-full h-full object-cover"
                loading="eager"
              />
              {/* Subtle overlay for pill readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-navy/10 via-transparent to-transparent" />

              {/* "Guidance today" badge */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={heroLoaded ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 1.6 }}
                className="absolute top-4 right-4 glass-ivory rounded-xl px-4 py-3 shadow-soft"
              >
                <p className="font-display italic text-navy text-sm leading-tight">
                  Guidance today.
                </p>
                <p className="font-display text-gold font-normal text-base leading-tight">
                  Greater tomorrows.
                </p>
              </motion.div>
            </div>

            {/* Floating category pills */}
            {HERO_PILLS.map((pill, i) => {
              const pos = PILL_POSITIONS[i]
              const Icon = PILL_ICONS[pill] ?? <Star className="h-3.5 w-3.5" />
              return (
                <motion.div
                  key={pill}
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={heroLoaded ? { opacity: 1, scale: 1 } : {}}
                  transition={{ duration: 0.5, ease, delay: pos.delay }}
                  className="hero-pill absolute glass-ivory text-navy"
                  style={{
                    top: pos.top,
                    left: 'left' in pos ? pos.left : undefined,
                    right: 'right' in pos ? pos.right : undefined,
                    animationName: 'float-pill',
                    animationDuration: `${pos.duration}s`,
                    animationTimingFunction: 'ease-in-out',
                    animationIterationCount: 'infinite',
                    animationDelay: `${i * 0.3}s`,
                  }}
                >
                  <span className="text-gold">{Icon}</span>
                  <span className="text-xs font-semibold">{pill}</span>
                </motion.div>
              )
            })}
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={heroLoaded ? { opacity: 1 } : {}}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <p className="text-[0.625rem] tracking-widest text-grey uppercase">Scroll to explore</p>
          <div
            className="w-px h-8 bg-gradient-to-b from-gold to-transparent"
            style={{ animation: 'scroll-bounce 2s ease-in-out infinite' }}
          />
        </motion.div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          FIND YOUR DIRECTION
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-6">
          {/* Editorial statement */}
          <FadeIn className="max-w-2xl mb-16">
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-4 flex items-center gap-2">
              <span className="w-5 h-px bg-gold" />
              Find Your Direction
            </p>
            <h2 className="text-display-xl font-display text-navy mb-4">
              Sometimes you don't need more information.
              <br />
              <em className="italic-serif" style={{ fontStyle: 'italic' }}>You need the right person.</em>
            </h2>
          </FadeIn>

          {/* Category pills */}
          <FadeIn delay={0.15}>
            <div className="flex flex-wrap gap-2 mb-12">
              <button
                onClick={() => setActiveCategory(null)}
                className={`pill ${!activeCategory ? 'pill-active' : ''}`}
              >
                All
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
                  className={`pill flex items-center gap-1.5 ${activeCategory === cat ? 'pill-active' : ''}`}
                >
                  <span className={activeCategory === cat ? 'opacity-80' : 'text-gold'}>
                    {CATEGORY_ICONS[cat] ?? <Star className="h-3.5 w-3.5" />}
                  </span>
                  {cat}
                </button>
              ))}
            </div>
          </FadeIn>

          {/* Mentor grid / empty state */}
          <AnimatePresence mode="wait">
            {mentorsLoading ? (
              <motion.div
                key="loading-direction"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-20"
              >
                <Loader2 className="h-6 w-6 animate-spin text-gold" />
              </motion.div>
            ) : mentorsError ? (
              <motion.div
                key="error-direction"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                className="text-center py-16 border border-grey-soft rounded-2xl bg-ivory-light"
              >
                <p className="text-sm text-grey mb-2">Could not load mentors right now.</p>
                <p className="text-xs text-grey/50 font-mono">{mentorsError}</p>
              </motion.div>
            ) : safeMentors.length === 0 ? (
              <motion.div
                key="empty-direction"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                className="text-center py-16 border border-grey-soft rounded-2xl bg-ivory-light"
              >
                <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-5 text-gold">
                  <Users className="h-7 w-7" />
                </div>
                <h3 className="text-display-md font-display text-navy mb-2">
                  Your next guide is coming soon.
                </h3>
                <p className="text-grey mb-6 max-w-sm mx-auto">
                  HELPAMART is preparing the first generation of mentors. Be one of them.
                </p>
                <Link
                  to="/become-a-mentor"
                  className="inline-flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-semibold hover:bg-navy-mid transition-all group"
                >
                  Become a Mentor
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </motion.div>
            ) : filteredMentors.length === 0 ? (
              <motion.div
                key="empty-filtered"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.4 }}
                className="text-center py-12"
              >
                <p className="text-grey">No mentors in this category yet.</p>
                <button
                  onClick={() => setActiveCategory(null)}
                  className="mt-4 text-gold text-sm font-medium hover:underline"
                >
                  View all mentors →
                </button>
              </motion.div>
            ) : (
              <motion.div
                key={activeCategory ?? 'all'}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
              >
                {filteredMentors.slice(0, 8).map(m => (
                  <HomeMentorCard key={m.id} mentor={m} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {safeMentors.length > 0 && (
            <FadeIn delay={0.2} className="mt-10 text-center">
              <Link
                to="/find-mentor"
                className="inline-flex items-center gap-2 text-navy font-semibold hover:text-gold transition-colors group"
              >
                View all mentors
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </FadeIn>
          )}
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          HOW IT WORKS
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-ivory py-28">
        <div className="max-w-5xl mx-auto px-6">
          <FadeIn className="text-center mb-20">
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              How It Works
              <span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-xl font-display text-navy">
              Good guidance<br />
              <em style={{ fontStyle: 'italic' }} className="text-gold font-display">starts with one step.</em>
            </h2>
          </FadeIn>

          <div className="relative">
            {/* Vertical gold journey line */}
            <div className="absolute left-[2.25rem] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent lg:left-1/2 lg:-translate-x-px hidden sm:block" />

            <div className="space-y-16">
              {HOW_STEPS.map((step, i) => (
                <HowStep key={step.n} step={step} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          BECOME A MENTOR CTA
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-navy py-28 overflow-hidden relative">
        {/* Background texture */}
        <div
          className="absolute inset-0 pointer-events-none opacity-5"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.5) 1px, transparent 0)',
            backgroundSize: '28px 28px',
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-[0.07] pointer-events-none"
          style={{ background: 'radial-gradient(circle, #B77A22 0%, transparent 70%)' }} />

        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <FadeIn>
            <p className="text-xs font-bold tracking-[0.15em] text-gold/70 uppercase mb-6 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold/50" />
              Become a Mentor
              <span className="w-5 h-px bg-gold/50" />
            </p>
            <h2 className="text-display-xl font-display text-white mb-5">
              Your experience could<br />
              <em className="italic" style={{ color: '#D8A24A', fontFamily: 'var(--font-display)' }}>
                change someone's direction.
              </em>
            </h2>
            <p className="text-white/60 text-lg leading-relaxed max-w-xl mx-auto mb-10">
              You've already learned the hard lessons. Now help someone skip a few.
            </p>
            <Link
              to="/become-a-mentor"
              className="group inline-flex items-center gap-2 bg-gold hover:bg-gold-mid text-white px-8 py-4 rounded-xl text-base font-semibold transition-all hover:shadow-[0_8px_30px_rgba(183,122,34,0.4)]"
            >
              Offer Your Help
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          STORIES (preview — 3 cards)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <StoriesSection preview={true} />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          COMMUNITY (preview — 3 live posts)
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <CommunityHomePreview />

      {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
          WHY HELPAMART
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      <section className="bg-ivory-light py-24">
        <div className="max-w-7xl mx-auto px-6">
          <FadeIn className="text-center mb-16">
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />
              Why HELPAMART
              <span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-lg font-display text-navy mb-3">
              Built on real human experience.
            </h2>
          </FadeIn>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                num: '01',
                title: 'Experience',
                body: 'Every mentor on HELPAMART has walked a real path. They bring lived experience, not just credentials.',
                color: 'bg-gold/8 border-gold/20',
                textColor: 'text-gold',
              },
              {
                num: '02',
                title: 'Connection',
                body: 'Real conversations create breakthroughs. We connect people, not just profiles.',
                color: 'bg-navy/5 border-navy/10',
                textColor: 'text-navy',
              },
              {
                num: '03',
                title: 'Progress',
                body: 'Every session is designed around your next step — not vague advice, but clear direction.',
                color: 'bg-maroon/5 border-maroon/15',
                textColor: 'text-maroon',
              },
            ].map(card => (
              <FadeIn key={card.num} delay={Number(card.num) * 0.1}>
                <div className={`rounded-2xl border p-8 h-full ${card.color}`}>
                  <span className={`text-4xl font-display opacity-30 ${card.textColor}`}>{card.num}</span>
                  <h3 className={`text-xl font-display mt-4 mb-3 ${card.textColor}`}>{card.title}</h3>
                  <p className="text-grey leading-relaxed">{card.body}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

/* ──────────────────────────────────────────────
   SUB-COMPONENTS
────────────────────────────────────────────── */

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
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function AbstractAvatarCluster() {
  const colors = ['#B77A22', '#071A35', '#641F2B', '#C96A2B', '#102C4C']
  const shapes = ['◆', '●', '▲', '◉', '■']
  return (
    <div className="flex -space-x-2.5">
      {colors.map((c, i) => (
        <div
          key={i}
          className="w-9 h-9 rounded-full border-2 border-ivory-light flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: c, zIndex: colors.length - i }}
          aria-hidden="true"
        >
          {shapes[i]}
        </div>
      ))}
    </div>
  )
}

function HomeMentorCard({ mentor }: { mentor: Mentor }) {
  // Cards always show "First session free" per HELPAMART pricing model.

  return (
    <Link to={`/mentor/${mentor.slug}`} className="card-mentor block group">
      {/* Photo */}
      <div className="aspect-[4/3] bg-ivory-dark overflow-hidden">
        {mentor.photoUrl ? (
          <img
            src={mentor.photoUrl}
            alt={mentor.name}
            className="mentor-photo w-full h-full object-cover transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-grey-mid flex items-center justify-center text-3xl font-display text-grey">
              {mentor.name.slice(0, 1)}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-semibold text-navy text-base truncate">{mentor.name}</h3>
        <p className="text-grey text-sm truncate mt-0.5">{mentor.role}{mentor.company ? ` · ${mentor.company}` : ''}</p>

        {mentor.intro && (
          <p className="text-sm text-navy/70 mt-3 leading-snug line-clamp-2">{mentor.intro}</p>
        )}

        {/* Tags */}
        {Array.isArray(mentor?.categories) && mentor.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {mentor.categories.slice(0, 2).map(c => (
              <span key={c} className="text-[0.6875rem] font-medium px-2.5 py-1 bg-ivory-dark rounded-full text-navy/70">
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-grey-soft">
          <span className="text-sm font-semibold text-gold">First session free</span>
          <span className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-navy group-hover:text-gold transition-colors">
            View Profile
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
          </span>
        </div>
      </div>
    </Link>
  )
}

function HowStep({
  step,
  index,
}: {
  step: { n: string; title: string; body: string; image: string; alt: string }
  index: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const isEven = index % 2 === 0

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, x: isEven ? -24 : 24 }}
      animate={inView ? { opacity: 1, x: 0 } : {}}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      className={`flex gap-6 sm:gap-8 items-start lg:items-center ${isEven ? 'lg:flex-row' : 'lg:flex-row-reverse'}`}
    >
      {/* Step number */}
      <div className="flex-shrink-0 relative pt-1 lg:pt-0">
        <div className="w-[4.5rem] h-[4.5rem] rounded-2xl bg-white border-2 border-grey-soft flex flex-col items-center justify-center shadow-soft group-hover:border-gold transition-colors">
          <span className="text-[0.625rem] font-bold tracking-widest text-gold uppercase">{step.n}</span>
        </div>
        {/* Progress dot */}
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gold/40" />
      </div>

      {/* Content */}
      <div className="flex-1 max-w-sm">
        <h3 className="text-xl font-display text-navy mb-2">{step.title}</h3>
        <p className="text-grey leading-relaxed">{step.body}</p>

        {/* Visual for mobile and tablet screens */}
        <div className="mt-5 lg:hidden relative w-full aspect-[4/3] max-w-sm rounded-2xl overflow-hidden shadow-soft border border-gold/15 bg-ivory-light">
          <img
            src={step.image}
            alt={step.alt}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy/15 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Visual for desktop screens */}
      <div className="hidden lg:block flex-1 max-w-xs">
        <div className="group/img relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow-soft hover:shadow-card border border-gold/20 hover:border-gold/40 bg-ivory-light transition-all duration-500">
          <img
            src={step.image}
            alt={step.alt}
            className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/img:scale-105"
            loading="lazy"
          />
          {/* Subtle warm overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-navy/15 via-transparent to-transparent pointer-events-none" />
        </div>
      </div>
    </motion.div>
  )
}
