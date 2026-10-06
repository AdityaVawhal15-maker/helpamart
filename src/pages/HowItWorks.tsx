import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { ArrowRight, Search, Calendar, Star, ArrowUpRight } from 'lucide-react'

const STEPS = [
  {
    n: '01',
    icon: <Search className="h-6 w-6" />,
    title: 'Discover',
    headline: 'Find the right person.',
    body: 'Browse mentors by expertise, industry, or what you\'re working through. Read their background. Feel who resonates.',
    color: 'bg-gold/8 border-gold/20',
    iconColor: 'bg-gold/15 text-gold',
  },
  {
    n: '02',
    icon: <Calendar className="h-6 w-6" />,
    title: 'Book',
    headline: 'Choose a time that works.',
    body: 'Pick from their available slots. Confirm instantly. Get a real Google Meet link immediately — everything taken care of.',
    color: 'bg-navy/5 border-navy/10',
    iconColor: 'bg-navy/10 text-navy',
  },
  {
    n: '03',
    icon: <Star className="h-6 w-6" />,
    title: 'Connect',
    headline: 'Have a real conversation.',
    body: 'Show up. Ask the real questions. Your mentor has walked this path before — their experience is your shortcut.',
    color: 'bg-maroon/5 border-maroon/10',
    iconColor: 'bg-maroon/10 text-maroon',
  },
  {
    n: '04',
    icon: <ArrowUpRight className="h-6 w-6" />,
    title: 'Move Forward',
    headline: 'Leave with clarity.',
    body: 'Every session is designed around your next step. Not generic advice — but real direction for your real situation.',
    color: 'bg-orange/5 border-orange/10',
    iconColor: 'bg-orange/10 text-orange',
  },
]

const FAQS = [
  {
    q: 'Is HELPAMART free to use?',
    a: 'Browsing and discovering mentors is completely free. Your first session with any mentor is also free. If you want to continue, your second session is just ₹99.',
  },
  {
    q: 'How are mentors vetted?',
    a: 'Mentors apply and build profiles sharing their real background, experience, and credentials. We review profiles before they go live.',
  },
  {
    q: 'What happens after I book?',
    a: 'You receive an instant confirmation and a real Google Meet link. The mentor also gets notified immediately.',
  },
  {
    q: 'Can I cancel a booking?',
    a: 'Yes — you can cancel from your dashboard up to 24 hours before the session.',
  },
  {
    q: 'How do I become a mentor?',
    a: 'Click "Offer Help" or "Become a Mentor" and complete your profile. Once approved, you appear in search and people can start booking.',
  },
]

export default function HowItWorks() {
  return (
    <div className="bg-ivory min-h-screen">
      {/* Hero */}
      <div className="bg-ivory-light border-b border-grey-soft py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />How It Works<span className="w-5 h-px bg-gold" />
            </p>
            <h1 className="text-display-xl font-display text-navy mb-4">
              Simple. Human. Meaningful.
            </h1>
            <p className="text-grey text-lg max-w-xl mx-auto">
              Four steps between where you are and where the right guidance can take you.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Steps */}
      <div className="max-w-5xl mx-auto px-6 py-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: i * 0.1 }}
              className={`rounded-3xl border p-8 ${step.color}`}
            >
              <div className="flex items-center gap-4 mb-5">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${step.iconColor}`}>
                  {step.icon}
                </div>
                <span className="text-xs font-bold tracking-[0.15em] text-grey uppercase">{step.n} — {step.title}</span>
              </div>
              <h2 className="text-xl font-display text-navy mb-3">{step.headline}</h2>
              <p className="text-grey leading-relaxed">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white border-t border-grey-soft py-24">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-4 flex items-center justify-center gap-2">
              <span className="w-5 h-px bg-gold" />FAQ<span className="w-5 h-px bg-gold" />
            </p>
            <h2 className="text-display-lg font-display text-navy">Questions? We've got answers.</h2>
          </div>
          <div className="space-y-4">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                className="bg-ivory-light rounded-2xl p-6"
              >
                <p className="font-semibold text-navy mb-2">{faq.q}</p>
                <p className="text-grey text-sm leading-relaxed">{faq.a}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="bg-navy py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <h2 className="text-display-lg font-display text-white mb-4">
            Ready to find your person?
          </h2>
          <p className="text-white/60 mb-8">The right conversation could change your entire trajectory.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/find-mentor" className="inline-flex items-center gap-2 bg-gold text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-gold-mid transition-all group">
              Find a Mentor <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link to="/become-a-mentor" className="inline-flex items-center gap-2 border border-white/20 text-white px-7 py-3.5 rounded-xl font-semibold hover:border-white/40 transition-all">
              Become a Mentor
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
