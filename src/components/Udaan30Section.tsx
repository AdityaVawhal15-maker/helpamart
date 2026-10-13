import { Link } from 'react-router-dom'
import { ArrowRight, Compass, Sparkles, CheckCircle2, ShieldCheck } from 'lucide-react'
import UdaanUniverseIllustration from './udaan/UdaanUniverseIllustration'

const DESTINATIONS = [
  { label: 'Tech & Engineering', tag: 'Coding, AI & System Design' },
  { label: 'JEE & NEET Aspirants', tag: 'Study Strategy & Revision' },
  { label: 'Startups & Founders', tag: '0→1 Execution & MVPs' },
  { label: 'Creative & Personal Goals', tag: 'Design, Skills & Any Ambition' },
]

export default function Udaan30Section() {
  return (
    <section
      id="udaan-30-showcase"
      className="relative py-20 lg:py-24 bg-gradient-to-b from-ivory-light via-[#F8F4EC] to-ivory border-y border-navy/[0.06] overflow-hidden"
    >
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-0 -translate-y-1/2 w-96 h-96 bg-gold/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[420px] h-[420px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left Column: Asymmetric Typography & Story */}
          <div className="lg:col-span-7 space-y-6">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gold/10 border border-gold/30 text-gold-darker text-xs font-bold tracking-[0.18em] uppercase">
              <Sparkles className="h-3.5 w-3.5 text-gold" />
              <span>INTRODUCING UDAAN 30</span>
            </div>

            {/* Headline */}
            <h2 className="text-display-xl md:text-display-2xl font-display text-navy leading-[1.08] tracking-tight">
              Big Dreams.{' '}
              <span className="italic font-normal text-gold block sm:inline">
                A Clearer Path.
              </span>
            </h2>

            {/* Concise concept statement */}
            <p className="text-grey-dark text-base sm:text-lg leading-relaxed max-w-xl">
              Big goals shouldn&apos;t rely on guesswork or a single hurried conversation. Udaan 30 pairs you with dedicated mentors for 30 structured days of milestone roadmaps, weekly check-ins, and actionable guidance—whatever your next frontier is.
            </p>

            {/* Breadth of ambitions / destination pills */}
            <div className="pt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-navy/60 mb-3">
                Tailored for every ambition:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl">
                {DESTINATIONS.map(d => (
                  <div
                    key={d.label}
                    className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-white/80 border border-navy/[0.08] shadow-[0_1px_3px_rgba(7,26,53,0.03)]"
                  >
                    <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-navy truncate">{d.label}</p>
                      <p className="text-[11px] text-grey truncate">{d.tag}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pricing Badge & Primary CTA */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white border border-navy/10 shadow-sm">
                <span className="text-2xl font-display font-bold text-navy">₹149</span>
                <span className="text-xs font-semibold text-grey uppercase tracking-wider">/ 30 Days</span>
                <span className="text-xs text-navy/30">•</span>
                <span className="text-xs text-gold-darker font-medium">One-time • No auto-renewal</span>
              </div>

              <Link
                to="/udaan-30"
                className="inline-flex items-center justify-center gap-2.5 bg-navy text-white px-7 py-3.5 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all shadow-[0_4px_16px_rgba(7,26,53,0.18)] hover:shadow-[0_6px_24px_rgba(7,26,53,0.25)] group"
              >
                <span>Explore Udaan 30</span>
                <ArrowRight className="h-4 w-4 text-gold transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Micro reassurance */}
            <div className="flex items-center gap-4 pt-1 text-xs text-grey">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-gold" />
                Verified Mentors
              </span>
              <span>•</span>
              <span>Direct 1-on-1 Guidance</span>
              <span>•</span>
              <span>Cashfree Verified Checkout</span>
            </div>
          </div>

          {/* Right Column: Compact Illustrated Universe Artwork */}
          <div className="lg:col-span-5 relative">
            <div className="relative rounded-3xl p-4 sm:p-6 bg-gradient-to-b from-white/90 to-white/60 backdrop-blur-sm border border-navy/[0.08] shadow-[0_12px_40px_rgba(7,26,53,0.06)]">
              {/* Floating ambient badge top-right */}
              <div className="absolute -top-3.5 right-6 bg-navy text-white text-[11px] font-semibold px-3 py-1 rounded-full shadow-md border border-gold/40 flex items-center gap-1.5 z-20">
                <Compass className="h-3 w-3 text-gold" />
                <span>The Udaan Universe</span>
              </div>

              {/* Compact illustration */}
              <UdaanUniverseIllustration variant="compact" className="w-full" />

              {/* Bottom caption / quote */}
              <div className="mt-3 text-center border-t border-navy/[0.06] pt-3">
                <p className="text-xs font-serif italic text-navy/80">
                  &ldquo;Whatever you want to become, you don&apos;t have to figure it out alone.&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
