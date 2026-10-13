import { Link } from 'react-router-dom'
import {
  Compass,
  ArrowRight,
  CheckCircle2,
  Zap,
  GraduationCap,
  BookOpen,
  Rocket,
  Sparkles,
  PenLine,
  Clock,
} from 'lucide-react'

const JOURNEY_CARDS = [
  {
    id: 'Tech Career',
    title: 'Tech Career',
    desc: 'Coding, projects, interview preparation and career direction.',
    icon: Zap,
    tag: 'Engineering & AI',
    color: 'from-blue-500/10 to-indigo-500/5 text-blue-600 border-blue-500/20',
  },
  {
    id: 'JEE Journey',
    title: 'JEE Journey',
    desc: 'Study planning, problem-solving strategy and preparation guidance.',
    icon: GraduationCap,
    tag: 'IIT JEE Prep',
    color: 'from-amber-500/10 to-orange-500/5 text-amber-600 border-amber-500/20',
  },
  {
    id: 'NEET Journey',
    title: 'NEET Journey',
    desc: 'Study structure, revision strategy and preparation guidance.',
    icon: BookOpen,
    tag: 'Medical Entrance',
    color: 'from-emerald-500/10 to-teal-500/5 text-emerald-600 border-emerald-500/20',
  },
  {
    id: 'Startup Journey',
    title: 'Startup Journey',
    desc: 'Idea validation, execution planning and founder guidance.',
    icon: Rocket,
    tag: '0 to 1 Building',
    color: 'from-purple-500/10 to-pink-500/5 text-purple-600 border-purple-500/20',
  },
  {
    id: 'Skill Mastery',
    title: 'Skill Mastery',
    desc: 'Develop expertise in a skill of the student\'s choice.',
    icon: Sparkles,
    tag: 'Design, Product, Data',
    color: 'from-gold/15 to-amber-500/5 text-gold-darker border-gold/30',
  },
  {
    id: 'My Own Journey',
    title: 'My Own Journey',
    desc: 'Enter a custom 30-day goal tailored to your specific aspiration.',
    icon: PenLine,
    tag: 'Custom Roadmap',
    color: 'from-navy/10 to-slate-500/5 text-navy border-navy/20',
  },
]

const SUPPORT_POINTS = [
  'A guided 30-day mentorship journey.',
  'Expert guidance aligned with your chosen goal.',
  'Structured weekly milestones and actionable tasks.',
  'Support through genuine platform channels (Google Meet & calls).',
  'Progress check-ins and practical feedback.',
  'A clear roadmap tailored to your chosen journey.',
]

const MILESTONES = [
  { week: '01', title: 'Roadmap & Audit', desc: 'Define target milestone and unblock current bottlenecks' },
  { week: '02', title: 'Sprint & Feedback', desc: 'First execution checkpoint with personalized mentor notes' },
  { week: '03', title: 'Recalibration', desc: 'Course correction and mock review to maintain pace' },
  { week: '04', title: 'Milestone Consolidation', desc: 'Final deliverables review and forward strategy' },
]

export default function Udaan30Section() {
  return (
    <section id="udaan-30" className="bg-ivory-light py-28 border-y border-navy/[0.06] relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-gold/8 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="max-w-3xl mx-auto text-center mb-16">
          <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
            <span className="w-5 h-px bg-gold" />
            <Compass className="h-3.5 w-3.5 text-gold" />
            YOUR NEXT 30 DAYS START HERE
            <span className="w-5 h-px bg-gold" />
          </p>

          <h2 className="text-display-xl md:text-display-2xl font-display text-navy mb-6">
            Udaan 30 — Your Ambition.{' '}
            <em className="text-gold font-display" style={{ fontStyle: 'italic' }}>
              Our Expert Saath.
            </em>
          </h2>

          <p className="text-grey-dark text-base md:text-lg leading-relaxed mb-6">
            “Big goals deserve more than one conversation. Get a month of expert guidance, structured action plans and ongoing support to move confidently towards your next milestone.”
          </p>

          <div className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl bg-white border border-navy/10 shadow-sm">
            <span className="text-xl font-display font-bold text-navy">₹149</span>
            <span className="text-xs font-semibold text-grey uppercase tracking-wider">/ 30 Days</span>
            <span className="text-xs text-navy/40">•</span>
            <span className="text-xs text-gold-darker font-medium">One-time enrollment • No auto-renewal</span>
          </div>
        </div>

        {/* 6 Journey Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {JOURNEY_CARDS.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.id}
                to={`/udaan-30?journey=${encodeURIComponent(item.id)}`}
                className="group relative bg-white rounded-2xl p-6 border border-navy/10 hover:border-gold/50 transition-all duration-300 hover:shadow-[0_12px_32px_rgba(7,26,53,0.08)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-xl bg-ivory flex items-center justify-center text-navy group-hover:text-gold group-hover:scale-105 transition-all">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${item.color}`}>
                      {item.tag}
                    </span>
                  </div>

                  <h3 className="text-lg font-display font-semibold text-navy mb-2 group-hover:text-navy-mid transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-xs text-grey leading-relaxed">
                    {item.desc}
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-navy/[0.05] flex items-center justify-between text-xs font-semibold text-gold group-hover:text-gold-darker transition-colors">
                  <span>Explore 30-Day Track</span>
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Milestone Timeline & Highlights Card */}
        <div className="bg-navy rounded-3xl p-8 sm:p-12 text-white shadow-xl mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left Column: What's included */}
            <div className="lg:col-span-7">
              <span className="text-[11px] font-bold tracking-[0.2em] text-gold uppercase mb-3 block">
                COMPREHENSIVE EXPERT SUPPORT
              </span>
              <h3 className="text-display-md font-display mb-4">
                Structured Guidance for Real Progress
              </h3>
              <p className="text-white/70 text-xs sm:text-sm leading-relaxed mb-6">
                Connect with verified mentors who provide tactical direction, review your work, and keep you accountable every week.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {SUPPORT_POINTS.map((point, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 bg-white/5 p-3 rounded-xl border border-white/10">
                    <CheckCircle2 className="h-4 w-4 text-gold shrink-0 mt-0.5" />
                    <span className="text-xs text-white/90 leading-snug">{point}</span>
                  </div>
                ))}
              </div>

              <div className="text-[11px] text-white/50 leading-relaxed italic">
                * Mentorship schedule is mutually aligned with your mentor via Google Meet or scheduled voice sessions.
              </div>
            </div>

            {/* Right Column: 4-Week Milestone Framework */}
            <div className="lg:col-span-5 bg-white/5 border border-white/10 rounded-2xl p-6">
              <h4 className="text-xs font-bold tracking-wider uppercase text-gold mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-gold" />
                30-Day Milestone Cadence
              </h4>
              <div className="space-y-4">
                {MILESTONES.map(m => (
                  <div key={m.week} className="flex items-start gap-3.5">
                    <span className="w-8 h-8 rounded-lg bg-gold/15 text-gold font-mono text-xs font-bold flex items-center justify-center shrink-0 border border-gold/30">
                      W{m.week}
                    </span>
                    <div>
                      <h5 className="text-xs font-semibold text-white">{m.title}</h5>
                      <p className="text-[11px] text-white/60 leading-snug">{m.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA Bar */}
        <div className="text-center">
          <Link
            to="/udaan-30"
            className="inline-flex items-center gap-3 bg-navy text-white px-8 py-4 rounded-xl font-semibold text-sm sm:text-base hover:bg-navy-mid transition-all shadow-[0_6px_20px_rgba(7,26,53,0.18)] hover:shadow-[0_8px_28px_rgba(7,26,53,0.25)] group"
          >
            <span>Begin My 30-Day Journey — ₹149</span>
            <ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" />
          </Link>
          <p className="text-xs text-grey mt-3">
            Instant activation upon payment verification • Verified mentors • Secure Cashfree payment
          </p>
        </div>
      </div>
    </section>
  )
}
