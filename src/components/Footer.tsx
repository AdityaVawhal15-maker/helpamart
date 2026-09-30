import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { useRef } from 'react'
import { Twitter, Linkedin, Instagram } from 'lucide-react'

const EXPLORE_LINKS = [
  { label: 'Find a Mentor', to: '/find-mentor' },
  { label: 'Become a Mentor', to: '/become-a-mentor' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Stories', to: '/stories' },
]

const COMMUNITY_LINKS = [
  { label: 'Ask the Community', to: '/community' },
  { label: 'HELPA Circles', to: '/community' },
  { label: 'Resources', to: '/community' },
]

const HELPA_LINKS = [
  { label: 'About', to: '/' },
  { label: 'Contact', to: '/' },
  { label: 'Privacy', to: '/' },
  { label: 'Terms', to: '/' },
]

export default function Footer() {
  const wordmarkRef = useRef<HTMLDivElement>(null)
  const wordmarkInView = useInView(wordmarkRef, { once: true, margin: '-60px' })

  return (
    <footer className="bg-navy text-white overflow-hidden">
      {/* Top statement */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="max-w-3xl">
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-6 flex items-center gap-2">
              <span className="w-6 h-px bg-gold inline-block" />
              HELP TODAY. GROW TOMORROW.
            </p>
            <h2 className="text-display-xl font-display text-white mb-6">
              Your journey doesn't end here.
            </h2>
            <p className="text-white/60 text-lg leading-relaxed max-w-xl">
              Find the person who can move you forward. Or become the person who helps someone else move.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Link
                to="/find-mentor"
                className="inline-flex items-center justify-center gap-2 bg-gold hover:bg-gold-mid text-white px-7 py-3.5 rounded-xl font-semibold transition-all hover:shadow-[0_6px_20px_rgba(183,122,34,0.4)] group"
              >
                Find a Mentor
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
              <Link
                to="/become-a-mentor"
                className="inline-flex items-center justify-center gap-2 border border-white/20 text-white px-7 py-3.5 rounded-xl font-semibold hover:border-white/40 hover:bg-white/5 transition-all"
              >
                Offer Your Help
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Links grid */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="inline-block mb-4" aria-label="HELPA home">
              <img
                src="/helpa-logo.png"
                alt="HELPA"
                className="h-16 w-auto object-contain drop-shadow-[0_0_1.5px_rgba(255,255,255,0.7)]"
              />
            </Link>
            <p className="text-white/50 text-sm leading-relaxed">
              A premium human mentorship platform. Real people. Real experience.
            </p>
            <div className="flex gap-3 mt-5">
              <SocialLink href="#" aria-label="Twitter">
                <Twitter className="h-4 w-4" />
              </SocialLink>
              <SocialLink href="#" aria-label="LinkedIn">
                <Linkedin className="h-4 w-4" />
              </SocialLink>
              <SocialLink href="#" aria-label="Instagram">
                <Instagram className="h-4 w-4" />
              </SocialLink>
            </div>
          </div>

          {/* Explore */}
          <div>
            <p className="text-xs font-bold tracking-widest text-white/30 uppercase mb-5">Explore</p>
            <ul className="space-y-3">
              {EXPLORE_LINKS.map(l => (
                <li key={l.to}>
                  <Link to={l.to} className="text-white/60 hover:text-gold text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community */}
          <div>
            <p className="text-xs font-bold tracking-widest text-white/30 uppercase mb-5">Community</p>
            <ul className="space-y-3">
              {COMMUNITY_LINKS.map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-white/60 hover:text-gold text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* HELPA */}
          <div>
            <p className="text-xs font-bold tracking-widest text-white/30 uppercase mb-5">HELPA</p>
            <ul className="space-y-3">
              {HELPA_LINKS.map(l => (
                <li key={l.label}>
                  <Link to={l.to} className="text-white/60 hover:text-gold text-sm transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Wordmark + copyright */}
      <div className="border-t border-white/10 overflow-hidden">
        <div ref={wordmarkRef} className="max-w-7xl mx-auto px-6 pt-6 pb-12 flex flex-col">
          {/* Giant wordmark */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={wordmarkInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            className="relative overflow-hidden"
          >
            <span
              className="font-display text-[10vw] md:text-[8vw] font-normal tracking-tight leading-none select-none"
              style={{ color: 'rgba(255,255,255,0.05)' }}
              aria-hidden="true"
            >
              HELPA
            </span>
            {/* Gold journey line */}
            <motion.div
              initial={{ scaleX: 0 }}
              animate={wordmarkInView ? { scaleX: 1 } : {}}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
              className="absolute bottom-2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gold to-transparent origin-left"
            />
          </motion.div>

          {/* Copyright */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mt-4">
            <p className="text-white/30 text-xs">
              © {new Date().getFullYear()} HELPA. All rights reserved.
            </p>
            <p className="text-white/20 text-xs font-display italic">
              I am here for you.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SocialLink({ href, children, ...props }: { href: string; children: React.ReactNode; [key: string]: unknown }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-gold hover:border-gold/30 transition-all"
      {...props}
    >
      {children}
    </a>
  )
}
