import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Quote } from 'lucide-react'
import StoriesSection, { FadeIn } from '@/components/StoriesSection'

const ease = [0.16, 1, 0.3, 1] as const

/* ─────────────────────────────────────────────────
   BEFORE / AFTER TRANSFORMATION SECTION
───────────────────────────────────────────────── */
const BEFORE = ['Confused', 'Too many options', 'Afraid to start', 'Learning alone']
const AFTER = ['Clearer direction', 'Realistic next steps', 'More confidence', 'Someone to learn from']

function TransformationSection() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })

  return (
    <section className="bg-navy py-28 relative overflow-hidden">
      {/* Background texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />
      <div
        className="absolute top-0 left-0 w-80 h-80 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(183,122,34,0.12) 0%, transparent 70%)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(183,122,34,0.08) 0%, transparent 70%)' }}
      />

      <div className="max-w-5xl mx-auto px-6 relative z-10">
        <FadeIn className="text-center mb-16">
          <p className="text-xs font-bold tracking-[0.2em] text-gold/70 uppercase mb-4 flex items-center justify-center gap-2">
            <span className="w-5 h-px bg-gold/50" />
            The Shift
            <span className="w-5 h-px bg-gold/50" />
          </p>
          <h2 className="text-display-xl font-display text-white">
            Sometimes the change is simply{' '}
            <em style={{ fontStyle: 'italic', color: '#D8A24A', fontFamily: 'var(--font-display)' }}>
              having someone to ask.
            </em>
          </h2>
        </FadeIn>

        <div ref={ref} className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-6 md:gap-4 items-center">
          {/* BEFORE */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-7"
          >
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-maroon/80 mb-5">Before</p>
            <ul className="space-y-3">
              {BEFORE.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: -12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-3 text-white/60 text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-maroon/60 shrink-0" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>

          {/* Connector */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={inView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.6, ease, delay: 0.35 }}
            className="flex flex-col items-center gap-2 py-4 md:py-0"
          >
            <div className="w-px h-8 bg-gradient-to-b from-transparent via-gold/40 to-transparent hidden md:block" />
            <div className="w-16 h-16 rounded-full border-2 border-gold/40 bg-gold/10 flex items-center justify-center">
              <span className="text-gold font-display italic text-xl" style={{ fontStyle: 'italic' }}>1:1</span>
            </div>
            <p className="text-[0.625rem] font-bold tracking-[0.2em] text-gold/60 uppercase text-center max-w-[80px] leading-tight">
              One Conversation
            </p>
            <div className="w-px h-8 bg-gradient-to-b from-transparent via-gold/40 to-transparent hidden md:block" />
          </motion.div>

          {/* AFTER */}
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.7, ease, delay: 0.1 }}
            className="bg-gold/8 border border-gold/20 rounded-2xl p-7"
          >
            <p className="text-[0.6875rem] font-bold tracking-[0.2em] uppercase text-gold mb-5">After</p>
            <ul className="space-y-3">
              {AFTER.map((item, i) => (
                <motion.li
                  key={item}
                  initial={{ opacity: 0, x: 12 }}
                  animate={inView ? { opacity: 1, x: 0 } : {}}
                  transition={{ duration: 0.5, ease, delay: 0.2 + i * 0.07 }}
                  className="flex items-center gap-3 text-white/80 text-sm"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
                  {item}
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────
   STORY TIMELINE
───────────────────────────────────────────────── */
const TIMELINE_STEPS = [
  { n: '01', label: 'The Question', text: '"I don\'t know what to do next."' },
  { n: '02', label: 'The Search', text: '"I found someone who had been there."' },
  { n: '03', label: 'The Conversation', text: '"I finally asked the questions I was afraid to ask."' },
  { n: '04', label: 'The First Step', text: '"I knew what I had to do next."' },
  { n: '05', label: 'The Journey', text: '"And that was only the beginning."' },
]

function StoryTimeline() {
  return (
    <section className="bg-ivory-light py-24">
      <div className="max-w-4xl mx-auto px-6">
        <FadeIn className="text-center mb-16">
          <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
            <span className="w-5 h-px bg-gold" />
            The Journey
            <span className="w-5 h-px bg-gold" />
          </p>
          <h2 className="text-display-lg font-display text-navy">
            Every great journey starts with{' '}
            <em style={{ fontStyle: 'italic', color: '#B77A22', fontFamily: 'var(--font-display)' }}>
              a single question.
            </em>
          </h2>
        </FadeIn>

        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-[1.75rem] top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-gold/30 to-transparent hidden sm:block" />

          <div className="space-y-10">
            {TIMELINE_STEPS.map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div className="flex gap-6 items-start">
                  {/* Step marker */}
                  <div className="relative shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-white border-2 border-grey-soft flex flex-col items-center justify-center shadow-soft">
                      <span className="text-[0.5625rem] font-bold tracking-widest text-gold uppercase">{step.n}</span>
                    </div>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-gold/30" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 pt-1.5">
                    <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-gold uppercase mb-1">{step.label}</p>
                    <p className="font-display text-navy text-lg italic" style={{ fontStyle: 'italic' }}>{step.text}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────
   LARGE EDITORIAL QUOTE
───────────────────────────────────────────────── */
function EditorialQuote() {
  return (
    <section className="bg-ivory-light border-y border-grey-soft py-28">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <FadeIn>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease }}
            className="inline-flex w-16 h-16 rounded-2xl bg-gold/10 items-center justify-center mb-8 mx-auto"
          >
            <Quote className="h-7 w-7 text-gold" />
          </motion.div>
          <blockquote className="text-display-xl font-display text-navy leading-tight">
            "Sometimes you don't need someone to give you the answer.
            <br />
            <em
              style={{ fontStyle: 'italic', color: '#B77A22', fontFamily: 'var(--font-display)' }}
            >
              You need someone who helps you see it yourself."
            </em>
          </blockquote>
        </FadeIn>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────
   CLOSING CTA
───────────────────────────────────────────────── */
function StoryCTA() {
  return (
    <section className="bg-navy py-28 relative overflow-hidden">
      {/* Dot texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.8) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        className="absolute top-0 right-0 w-96 h-96 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(183,122,34,0.1) 0%, transparent 70%)' }}
      />

      <div className="max-w-3xl mx-auto px-6 text-center relative z-10">
        <FadeIn>
          <p className="text-xs font-bold tracking-[0.2em] text-gold/70 uppercase mb-6 flex items-center justify-center gap-2">
            <span className="w-5 h-px bg-gold/50" />
            Your Story
            <span className="w-5 h-px bg-gold/50" />
          </p>
          <h2 className="text-display-xl font-display text-white mb-5">
            Your story could be{' '}
            <em style={{ fontStyle: 'italic', color: '#D8A24A', fontFamily: 'var(--font-display)' }}>
              next.
            </em>
          </h2>
          <p className="text-white/60 text-lg leading-relaxed max-w-xl mx-auto mb-10">
            Everyone who has figured something out once had to start somewhere. Your mentor is already here.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/find-mentor"
              className="group inline-flex items-center gap-2 bg-gold hover:bg-gold-mid text-white px-8 py-4 rounded-xl text-base font-semibold transition-all hover:shadow-[0_8px_30px_rgba(183,122,34,0.4)]"
            >
              Find Your Mentor
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/community"
              className="inline-flex items-center gap-2 border border-white/20 text-white px-8 py-4 rounded-xl text-base font-semibold hover:border-white/40 hover:bg-white/5 transition-all"
            >
              Share Your Story
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────
   STORIES PAGE
───────────────────────────────────────────────── */
export default function Stories() {
  return (
    <div className="bg-ivory min-h-screen">
      {/* ── Hero ── */}
      <div className="bg-ivory-light border-b border-grey-soft py-24 relative overflow-hidden">
        {/* Ambient gold glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 70% 60% at 55% 50%, rgba(183,122,34,0.08) 0%, transparent 65%)',
          }}
        />
        {/* Large decorative quotation mark */}
        <div
          className="absolute right-8 top-8 font-display text-[12rem] leading-none text-navy/[0.04] select-none pointer-events-none hidden lg:block"
          aria-hidden="true"
          style={{ fontFamily: 'var(--font-display)', fontStyle: 'italic' }}
        >
          "
        </div>

        <div className="max-w-4xl mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-5 flex items-center gap-2">
              <span className="w-5 h-px bg-gold" />
              Stories
            </p>
            <h1 className="text-display-hero font-display text-navy mb-4">
              Everyone starts
              <br />
              <em style={{ fontStyle: 'italic', color: '#B77A22', fontFamily: 'var(--font-display)' }}>
                somewhere.
              </em>
            </h1>
            <p className="text-grey text-xl max-w-2xl leading-relaxed mt-6">
              Sometimes, you just need the right person. Stories of people who found clarity, confidence and direction through guidance from someone who had already walked the path.
            </p>
          </motion.div>
        </div>
      </div>

      {/* ── Story cards section ── */}
      <StoriesSection preview={false} />

      {/* ── Editorial quote ── */}
      <EditorialQuote />

      {/* ── Before / After ── */}
      <TransformationSection />

      {/* ── Timeline ── */}
      <StoryTimeline />

      {/* ── Closing CTA ── */}
      <StoryCTA />
    </div>
  )
}
