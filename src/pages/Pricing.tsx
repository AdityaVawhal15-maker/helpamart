import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Check, ArrowRight } from 'lucide-react'

const PLANS = [
  {
    id: 'mentee',
    name: 'For Mentees',
    tagline: 'Seeking Guidance',
    price: 'Free to browse',
    sub: 'Pay only for sessions you book.',
    features: [
      'Browse all mentor profiles',
      'Search by category or skill',
      'View mentor availability',
      'Community access',
      'Book sessions at mentor rates',
    ],
    cta: { label: 'Find a Mentor', to: '/find-mentor' },
    style: 'bg-white border-grey-soft',
    ctaStyle: 'bg-navy text-white hover:bg-navy-mid',
  },
  {
    id: 'mentor',
    name: 'For Mentors',
    tagline: 'Sharing Experience',
    price: 'Free',
    sub: 'Always. HELPA takes no commission.',
    features: [
      'Create your full mentor profile',
      'Set your own pricing (including free)',
      'Manage availability',
      'Accept and manage bookings',
      'Google Calendar + Meet integration',
      'Community participation',
    ],
    cta: { label: 'Become a Mentor', to: '/become-a-mentor' },
    style: 'bg-navy border-navy',
    ctaStyle: 'bg-gold text-white hover:bg-gold-mid',
    featured: true,
  },
]

export default function Pricing() {
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
              <span className="w-5 h-px bg-gold" />Pricing<span className="w-5 h-px bg-gold" />
            </p>
            <h1 className="text-display-xl font-display text-navy mb-4">
              Simple. Honest. Fair.
            </h1>
            <p className="text-grey text-lg max-w-xl mx-auto">
              HELPA is free to use. Mentors set their own rates. We take zero commission.
            </p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
          {PLANS.map((plan, i) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: i * 0.1 }}
              className={`rounded-3xl border-2 p-8 ${plan.style} ${plan.featured ? 'text-white' : 'text-navy'}`}
            >
              <div className="mb-6">
                <p className={`text-xs font-bold tracking-widest uppercase mb-2 ${plan.featured ? 'text-gold' : 'text-gold'}`}>{plan.tagline}</p>
                <h2 className="text-xl font-display mb-4">{plan.name}</h2>
                <p className="text-2xl font-bold">{plan.price}</p>
                <p className={`text-sm mt-1 ${plan.featured ? 'text-white/60' : 'text-grey'}`}>{plan.sub}</p>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-3 text-sm">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${plan.featured ? 'bg-gold/20' : 'bg-gold/15'}`}>
                      <Check className="h-3 w-3 text-gold" />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                to={plan.cta.to}
                className={`flex items-center justify-center gap-2 w-full py-3.5 rounded-xl font-semibold transition-all group ${plan.ctaStyle}`}
              >
                {plan.cta.label}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Note */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-12 text-center max-w-xl mx-auto"
        >
          <div className="bg-gold/8 border border-gold/20 rounded-2xl p-6">
            <p className="text-navy font-semibold mb-2">A note on trust</p>
            <p className="text-grey text-sm leading-relaxed">
              HELPA does not take a commission from sessions. Mentors keep 100% of what they earn. Payment processing fees (Stripe) apply when payments are enabled.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
