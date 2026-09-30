import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

export default function Stories() {
  return (
    <div className="bg-ivory min-h-screen">
      <div className="bg-ivory-light border-b border-grey-soft py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />Stories<span className="w-5 h-px bg-gold" />
            </p>
            <h1 className="text-display-xl font-display text-navy mb-4">
              Stories of guidance.<br />
              <em style={{ fontStyle: 'italic', color: 'var(--color-gold)' }}>Stories of growth.</em>
            </h1>
            <p className="text-grey text-lg max-w-xl mx-auto">
              Real accounts from people who found their direction through HELPA.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <div className="w-20 h-20 rounded-3xl bg-gold/10 flex items-center justify-center mx-auto mb-8 text-gold">
            <span className="text-3xl font-display">"</span>
          </div>
          <h2 className="text-display-lg font-display text-navy mb-5">
            Every great story starts with<br />finding the right person.
          </h2>
          <p className="text-grey leading-relaxed max-w-xl mx-auto mb-10">
            As our community grows, this page will fill with stories of people who discovered the right guidance at the right time. The first chapter is being written now — and it could be yours.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/find-mentor"
              className="inline-flex items-center gap-2 bg-navy text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-navy-mid transition-all group"
            >
              Start Your Story
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              to="/become-a-mentor"
              className="inline-flex items-center gap-2 border border-navy/20 text-navy px-7 py-3.5 rounded-xl font-semibold hover:border-gold/40 transition-all"
            >
              Help Someone Else
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
