import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { ArrowRight, Quote } from 'lucide-react'

/* ─────────────────────────────────────────────────
   SHARED ANIMATION UTILITIES
───────────────────────────────────────────────── */
const ease = [0.16, 1, 0.3, 1] as const

export function FadeIn({
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
      initial={{ opacity: 0, y: 22 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────
   STORY DATA
───────────────────────────────────────────────── */
export interface Story {
  id: string
  tag: string        // "Community Story"
  name: string
  identity: string
  quote: string
  problem: string
  turning: string
  outcome: string
  illustration: string
  darkCard?: boolean
}

export const STORIES: Story[] = [
  {
    id: 'aarav',
    tag: 'Community Story',
    name: 'Aarav',
    identity: 'Computer Science Student',
    quote: "I wasn't looking for a mentor. I was looking for an answer.",
    problem: 'Too many choices and no idea which one actually mattered. Every tutorial pointed somewhere different.',
    turning: 'One afternoon, I spoke to someone who had already been exactly where I was — three years ahead.',
    outcome: 'I finally know what I want to build. And I know the next three steps to get there.',
    illustration: '/story-student.jpg',
    darkCard: false,
  },
  {
    id: 'priya',
    tag: 'Community Story',
    name: 'Priya',
    identity: 'Design Graduate, Career Switcher',
    quote: "She didn't give me a roadmap. She helped me see I already had one.",
    problem: "I'd been watching tutorials for months. I knew theory but felt stuck. I didn't need more courses — I needed a person.",
    turning: 'A 45-minute conversation with a working designer answered questions no YouTube video ever could.',
    outcome: 'I got my first freelance client two weeks after that session.',
    illustration: '/story-mentor.jpg',
    darkCard: true,
  },
  {
    id: 'rohan',
    tag: 'Community Story',
    name: 'Rohan',
    identity: 'First-Generation Founder',
    quote: "I almost gave up on the idea before I even started.",
    problem: "The idea felt too big. I couldn't see where to begin. Every plan I wrote felt impossibly far away.",
    turning: 'My mentor helped me ignore everything except the one thing I could do today.',
    outcome: 'Three months later, I had a working prototype and my first five users.',
    illustration: '/story-breakthrough.jpg',
    darkCard: false,
  },
  {
    id: 'simran',
    tag: 'Community Story',
    name: 'Simran',
    identity: 'Software Engineer, Career Transition',
    quote: "One conversation changed everything — not the direction, just my confidence in it.",
    problem: 'I knew what I wanted but kept second-guessing myself. Imposter syndrome was louder than any plan.',
    turning: 'Talking to someone who had navigated the same transition quietly removed the noise.',
    outcome: "I applied for the role I'd been afraid of. I got it.",
    illustration: '/story-student.jpg',
    darkCard: false,
  },
  {
    id: 'arjun',
    tag: 'Community Story',
    name: 'Arjun',
    identity: 'MSc Student, Unsure About Next Steps',
    quote: "I had a degree but no direction. I had skills but no story.",
    problem: "Finishing a master's felt like the end of the plan, not the beginning. I didn't know what came next.",
    turning: 'Hearing how someone else had navigated that exact ambiguity made mine feel smaller.',
    outcome: 'I started reaching out with intention. I had better conversations. Things started clicking.',
    illustration: '/story-mentor.jpg',
    darkCard: true,
  },
  // Student & Aspirant Stories
  {
    id: 'kavya-jee',
    tag: 'Community Story',
    name: 'Kavya',
    identity: 'JEE Aspirant, Class 11',
    quote: "I was drowning in concepts. I didn't need more practice problems - I needed someone who got it.",
    problem: 'Preparing for JEE felt like a mountain with no peak. Thousands of problems but no strategy. I scored well in mock tests but panicked in real ones.',
    turning: 'My mentor walked me through how he approached JEE three years ago. Not the answers - his thinking process.',
    outcome: 'I got a 98 percentile. More importantly, I stopped hating physics.',
    illustration: '/story-student.jpg',
    darkCard: false,
  },
  {
    id: 'neil-neet',
    tag: 'Community Story',
    name: 'Neil',
    identity: 'NEET Aspirant, Class 12',
    quote: "I knew the content. I just didn't know me.",
    problem: 'I could memorize concepts but froze during exams. I was studying 12 hours a day and burning out. No one understood the pressure.',
    turning: 'One conversation with a doctor who had been exactly where I was changed everything. She shared her actual study routine, not a generic schedule.',
    outcome: 'I scored 620, got into my dream college. But the real win? I stopped sacrificing my health to chase a rank.',
    illustration: '/story-mentor.jpg',
    darkCard: true,
  },
  {
    id: 'aditya-class10',
    tag: 'Community Story',
    name: 'Aditya',
    identity: 'Class 10 Student, First-Gen Learner',
    quote: "They said I needed to know what I wanted to do by age 15. That felt impossible.",
    problem: "I was the first in my family to attend school beyond eighth grade. I didn't know what career paths existed, let alone which one was for me.",
    turning: 'A mentor from my school introduced me to three different professionals - a software engineer, a teacher, an entrepreneur. Real conversations. Real journeys.',
    outcome: 'I started Class 11 knowing what interests me. I still don\'t know everything, but now I know where to look.',
    illustration: '/story-breakthrough.jpg',
    darkCard: false,
  },
  {
    id: 'deepa-medical',
    tag: 'Community Story',
    name: 'Deepa',
    identity: 'Medical Student, Uncertain Career Path',
    quote: "Medicine felt like the only option. No one asked if it was my option.",
    problem: 'I got into a good medical college but felt empty. I realized I chose medicine because it was expected, not because I wanted it.',
    turning: 'I found a mentor who was a doctor but understood my doubts. She didn\'t tell me to quit or stay - she helped me explore what medicine could actually look like for me.',
    outcome: 'I\'m still in medical college. But now it\'s my choice. I\'m exploring public health. I feel alive again.',
    illustration: '/story-student.jpg',
    darkCard: false,
  },
  {
    id: 'ravi-mental-health',
    tag: 'Community Story',
    name: 'Ravi',
    identity: 'Class 11 Student, Struggling with Anxiety',
    quote: "I was doing everything right on the outside. Falling apart on the inside.",
    problem: 'Good grades, good college aspirations, but crippling anxiety about the future. My parents didn\'t understand. My friends didn\'t know. I felt alone.',
    turning: 'A mentor who had been through similar struggles just listened. Not solutions - presence. She shared her own story of managing anxiety while chasing dreams.',
    outcome: 'I started therapy, talked to my parents, and adjusted my pace. My anxiety didn\'t disappear, but I did. I found myself again.',
    illustration: '/story-mentor.jpg',
    darkCard: true,
  },
]

/* ─────────────────────────────────────────────────
   FEATURED STORY (large editorial card — Story 0)
───────────────────────────────────────────────── */
function FeaturedStory({ story }: { story: Story }) {
  return (
    <FadeIn delay={0.1} className="w-full">
      <div className="relative rounded-3xl overflow-hidden border border-grey-soft bg-white shadow-[0_4px_40px_rgba(7,26,53,0.07)]">
        {/* Top label bar */}
        <div className="bg-navy px-8 py-3 flex items-center gap-3">
          <span className="w-1.5 h-1.5 rounded-full bg-gold" />
          <span className="text-[0.625rem] font-bold tracking-[0.25em] text-gold/80 uppercase">
            Featured · {story.tag}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2">
          {/* Left — illustration */}
          <div className="relative bg-ivory-dark flex items-center justify-center min-h-[280px] lg:min-h-[420px] overflow-hidden">
            <img
              src={story.illustration}
              alt={`Illustration for ${story.name}'s story`}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
            {/* Name badge overlaid */}
            <div className="absolute bottom-5 left-5 bg-white/90 backdrop-blur-sm rounded-2xl px-4 py-2.5 shadow-soft">
              <p className="text-navy font-semibold text-sm">{story.name}</p>
              <p className="text-grey text-xs mt-0.5">{story.identity}</p>
            </div>
          </div>

          {/* Right — story content */}
          <div className="p-8 md:p-10 flex flex-col justify-between gap-6">
            {/* Pull quote */}
            <div>
              <Quote className="h-8 w-8 text-gold/40 mb-4" />
              <blockquote className="text-display-md font-display text-navy italic leading-snug mb-6" style={{ fontStyle: 'italic' }}>
                "{story.quote}"
              </blockquote>
            </div>

            {/* Story beats */}
            <div className="space-y-5">
              <StoryBeat label="The Problem" text={story.problem} accent="text-maroon" dotColor="bg-maroon" />
              <StoryBeat label="The Turning Point" text={story.turning} accent="text-gold" dotColor="bg-gold" />
              <StoryBeat label="Now" text={story.outcome} accent="text-navy" dotColor="bg-navy" />
            </div>

            {/* CTA */}
            <div className="pt-2">
              <Link
                to="/find-mentor"
                className="group inline-flex items-center gap-2 text-navy font-semibold hover:text-gold transition-colors"
              >
                Start your own journey
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </FadeIn>
  )
}

function StoryBeat({
  label,
  text,
  accent,
  dotColor,
}: {
  label: string
  text: string
  accent: string
  dotColor: string
}) {
  return (
    <div className="flex gap-3">
      <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 shrink-0`} />
      <div>
        <p className={`text-[0.6875rem] font-bold tracking-[0.18em] uppercase mb-1 ${accent}`}>{label}</p>
        <p className="text-grey text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────
   STORY CARD (smaller editorial cards)
───────────────────────────────────────────────── */
export function StoryCard({ story, index }: { story: Story; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-50px' })

  const isDark = story.darkCard

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.65, ease, delay: index * 0.08 }}
      whileHover={{ y: -5, transition: { duration: 0.3, ease } }}
      className={`rounded-2xl border overflow-hidden flex flex-col cursor-default transition-shadow duration-300 hover:shadow-[0_12px_40px_rgba(7,26,53,0.12)] ${
        isDark
          ? 'bg-navy border-navy/80 text-white'
          : 'bg-white border-grey-soft text-navy'
      }`}
    >
      {/* Illustration strip */}
      <div className={`relative h-44 overflow-hidden ${isDark ? 'bg-navy-light' : 'bg-ivory-dark'}`}>
        <img
          src={story.illustration}
          alt={`Illustration for ${story.name}`}
          className="w-full h-full object-cover object-top transition-transform duration-700 ease-out hover:scale-105"
          loading="lazy"
        />
        {/* Tag */}
        <div className="absolute top-3 left-3">
          <span className={`text-[0.6rem] font-bold tracking-[0.2em] uppercase px-2.5 py-1 rounded-full ${
            isDark ? 'bg-gold/20 text-gold' : 'bg-white/90 text-gold'
          }`}>
            {story.tag}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col gap-4 flex-1">
        <div>
          <p className={`text-xs font-semibold mb-0.5 ${isDark ? 'text-gold' : 'text-gold'}`}>{story.name}</p>
          <p className={`text-xs ${isDark ? 'text-white/50' : 'text-grey'}`}>{story.identity}</p>
        </div>

        <blockquote className={`font-display italic text-base leading-snug ${isDark ? 'text-white/90' : 'text-navy'}`} style={{ fontStyle: 'italic' }}>
          "{story.quote}"
        </blockquote>

        <p className={`text-sm leading-relaxed flex-1 ${isDark ? 'text-white/55' : 'text-grey'}`}>
          {story.outcome}
        </p>

        {/* Footer */}
        <div className={`pt-4 border-t ${isDark ? 'border-white/10' : 'border-grey-soft'} flex items-center justify-between`}>
          <span className={`text-[0.6875rem] font-bold tracking-[0.15em] uppercase ${isDark ? 'text-gold/60' : 'text-gold/70'}`}>
            Illustrative Journey
          </span>
        </div>
      </div>
    </motion.div>
  )
}

/* ─────────────────────────────────────────────────
   MAIN EXPORTED SECTION (used on both pages)
   preview = true  →  Home version (3 cards + CTA)
   preview = false →  full Stories page section
───────────────────────────────────────────────── */
interface StoriesSectionProps {
  preview?: boolean
}

export default function StoriesSection({ preview = false }: StoriesSectionProps) {
  const previewStories = preview ? STORIES.slice(0, 3) : STORIES

  return (
    <section className={`${preview ? 'bg-ivory' : 'bg-ivory'} py-24`}>
      <div className="max-w-7xl mx-auto px-6">
        {/* ── Section header ── */}
        <FadeIn className="mb-16">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-2xl">
              <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-4 flex items-center gap-2">
                <span className="w-5 h-px bg-gold" />
                Stories
              </p>
              <h2 className="text-display-xl font-display text-navy">
                Everyone starts{' '}
                <em style={{ fontStyle: 'italic', color: '#B77A22', fontFamily: 'var(--font-display)' }}>
                  somewhere.
                </em>
              </h2>
              <p className="text-grey text-lg mt-4 leading-relaxed max-w-lg">
                Stories of people who found clarity, confidence, and direction through a single conversation with the right person.
              </p>
            </div>
            {preview && (
              <Link
                to="/stories"
                className="group inline-flex items-center gap-2 text-navy font-semibold hover:text-gold transition-colors shrink-0"
              >
                Read all stories
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            )}
          </div>
        </FadeIn>

        {/* ── Featured story (only full page) ── */}
        {!preview && (
          <div className="mb-14">
            <FeaturedStory story={STORIES[0]} />
          </div>
        )}

        {/* ── Story card grid ── */}
        <div className={`grid gap-5 ${preview ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}>
          {previewStories.map((story, i) => (
            <StoryCard key={story.id} story={story} index={i} />
          ))}
        </div>

        {/* ── "View all" CTA for home preview ── */}
        {preview && (
          <FadeIn delay={0.3} className="mt-10 text-center">
            <Link
              to="/stories"
              className="group inline-flex items-center gap-2 border border-navy/20 bg-white text-navy px-7 py-3.5 rounded-xl font-semibold hover:border-gold/40 hover:bg-ivory-dark/50 transition-all"
            >
              Explore all stories
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </FadeIn>
        )}
      </div>
    </section>
  )
}
