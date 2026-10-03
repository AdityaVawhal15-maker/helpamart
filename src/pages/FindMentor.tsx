import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import { Search, SlidersHorizontal, X, Users, ArrowRight, Star, Briefcase, GraduationCap, Zap, Heart, Building2, Globe, MessageCircle } from 'lucide-react'
import { api } from '@/lib/api'
import { MentorCardSkeleton } from '@/components/ui/LoadingSkeleton'
import { CATEGORIES } from '@/data/taxonomy'
import type { Mentor } from '@/types'

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

export default function FindMentor() {
  const [params, setParams] = useSearchParams()
  const [mentors, setMentors] = useState<Mentor[]>([])
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState(params.get('q') || '')
  const [activeCategory, setActiveCategory] = useState(params.get('category') || '')
  const [showFilters, setShowFilters] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const q = params.get('q') || ''
  const category = params.get('category') || ''

  useEffect(() => {
    setLoading(true)
    const query = new URLSearchParams()
    if (q) query.set('q', q)
    if (category) query.set('category', category)
    api<{ mentors: Mentor[] }>(`/api/mentors?${query}`)
      .then(d => setMentors(d.mentors))
      .catch(() => setMentors([]))
      .finally(() => setLoading(false))
  }, [q, category])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const next = new URLSearchParams(params)
    if (searchInput.trim()) next.set('q', searchInput.trim())
    else next.delete('q')
    setParams(next)
  }

  function handleCategory(cat: string) {
    const next = new URLSearchParams(params)
    if (cat === activeCategory) {
      next.delete('category')
      setActiveCategory('')
    } else {
      next.set('category', cat)
      setActiveCategory(cat)
    }
    setParams(next)
  }

  function clearSearch() {
    setSearchInput('')
    const next = new URLSearchParams(params)
    next.delete('q')
    setParams(next)
  }

  return (
    <div className="bg-ivory min-h-screen">
      {/* Hero */}
      <div className="bg-ivory-light border-b border-grey-soft py-16">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-3 flex items-center gap-2">
              <span className="w-5 h-px bg-gold" />
              Discover
            </p>
            <h1 className="text-display-xl font-display text-navy mb-3">
              Find the person<br />
              who can move you forward.
            </h1>
            <p className="text-grey text-base mb-10 max-w-lg">
              Not just someone who knows. Someone who has been there.
            </p>

            {/* Search */}
            <form onSubmit={handleSearch} className="relative max-w-2xl">
              <div className="flex items-center bg-white border-2 border-grey-soft rounded-2xl overflow-hidden transition-all focus-within:border-navy focus-within:shadow-[0_0_0_4px_rgba(7,26,53,0.06)]">
                <Search className="h-5 w-5 text-gold ml-4 shrink-0" />
                <input
                  ref={searchRef}
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="What are you trying to figure out?"
                  className="flex-1 px-4 py-4 text-base text-navy placeholder-grey bg-transparent outline-none"
                  aria-label="Search mentors"
                />
                {searchInput && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    className="text-grey hover:text-navy transition-colors mr-2 p-1"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="submit"
                  className="m-2 bg-navy text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-navy-mid transition-colors shrink-0"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Search examples */}
            {!q && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-grey">Try:</span>
                {['Career change', 'Interview prep', 'Starting a company', 'Learning AI', 'Study abroad'].map(ex => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => {
                      setSearchInput(ex)
                      const next = new URLSearchParams(params)
                      next.set('q', ex)
                      setParams(next)
                    }}
                    className="text-xs text-gold hover:underline"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="sticky top-16 z-20 bg-ivory-light/95 backdrop-blur-md border-b border-grey-soft">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center gap-3 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium border transition-all shrink-0 ${
              showFilters ? 'border-navy bg-navy text-white' : 'border-grey-soft bg-white text-navy hover:border-navy/30'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            Filters
          </button>

          <div className="w-px h-5 bg-grey-soft shrink-0" />

          <button
            onClick={() => handleCategory('')}
            className={`pill shrink-0 ${!activeCategory ? 'pill-active' : ''}`}
          >
            All
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategory(cat)}
              className={`pill shrink-0 flex items-center gap-1.5 ${activeCategory === cat ? 'pill-active' : ''}`}
            >
              <span className={activeCategory === cat ? 'opacity-70' : 'text-gold'}>
                {CATEGORY_ICONS[cat] ?? <Star className="h-3.5 w-3.5" />}
              </span>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-6 py-10">
        {/* Result count + active filters */}
        {!loading && (
          <div className="flex items-center gap-3 mb-6">
            <p className="text-sm text-grey">
              {mentors.length === 0 ? 'No mentors found' : `${mentors.length} mentor${mentors.length !== 1 ? 's' : ''}`}
              {q ? ` for "${q}"` : ''}
              {activeCategory ? ` in ${activeCategory}` : ''}
            </p>
            {(q || activeCategory) && (
              <button
                onClick={() => {
                  setSearchInput('')
                  setActiveCategory('')
                  setParams({})
                }}
                className="text-xs text-maroon hover:underline flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear all
              </button>
            )}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <MentorCardSkeleton key={i} />)}
          </div>
        ) : mentors.length === 0 ? (
          <MentorEmptyState hasSearch={Boolean(q || activeCategory)} />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={q + activeCategory}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5"
            >
              {mentors.map((m, i) => (
                <MentorCard key={m.id} mentor={m} index={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}

function MentorCard({ mentor, index }: { mentor: Mentor; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true })

  const priceDisplay = mentor.startingPriceCents != null
    ? mentor.startingPriceCents === 0
      ? 'Free'
      : `From $${(mentor.startingPriceCents / 100).toFixed(0)}`
    : null

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: Math.min(index * 0.06, 0.4) }}
    >
      <Link to={`/mentor/${mentor.slug}`} className="card-mentor block group">
        {/* Photo */}
        <div className="aspect-[4/3] bg-ivory-dark overflow-hidden relative">
          {mentor.photoUrl ? (
            <img
              src={mentor.photoUrl}
              alt={mentor.name}
              className="mentor-photo w-full h-full object-cover transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-ivory-dark to-grey-soft">
              <span className="text-5xl font-display text-grey-mid">
                {mentor.name.slice(0, 1)}
              </span>
            </div>
          )}
          {/* Availability badge */}
          {mentor.availabilityPreview && (
            <div className="absolute bottom-3 left-3">
              <span className="text-[0.6875rem] font-semibold bg-white/90 text-navy rounded-full px-2.5 py-1 shadow-soft">
                ● Available
              </span>
            </div>
          )}
          {/* Gold line on hover */}
          <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-400" />
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-semibold text-navy text-base truncate">{mentor.name}</h3>
          <p className="text-grey text-sm truncate mt-0.5">
            {mentor.role}
            {mentor.company ? <span className="text-grey-mid"> · {mentor.company}</span> : null}
          </p>

          {mentor.intro && (
            <p className="text-sm text-navy/70 mt-3 leading-snug line-clamp-2">{mentor.intro}</p>
          )}

          {/* Tags */}
          {mentor.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {mentor.categories.slice(0, 3).map(c => (
                <span key={c} className="text-[0.6875rem] font-medium px-2.5 py-1 bg-ivory-dark rounded-full text-navy/70">
                  {c}
                </span>
              ))}
            </div>
          )}

          {/* Languages */}
          {mentor.languages.length > 0 && (
            <p className="text-xs text-grey mt-2">{mentor.languages.slice(0, 2).join(' · ')}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-grey-soft">
            {priceDisplay ? (
              <span className="text-sm font-semibold text-gold">{priceDisplay}</span>
            ) : (
              <span className="text-sm text-grey">Session from —</span>
            )}
            <span className="inline-flex items-center gap-1 text-sm font-medium text-navy group-hover:text-gold transition-colors">
              View Profile
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function MentorEmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="flex flex-col items-center text-center py-24 max-w-lg mx-auto">
      <div className="w-20 h-20 rounded-3xl bg-gold/8 flex items-center justify-center mb-6 text-gold">
        <Users className="h-8 w-8" />
      </div>
      {hasSearch ? (
        <>
          <h2 className="text-display-md font-display text-navy mb-3">
            No mentors matched your search.
          </h2>
          <p className="text-grey mb-8 leading-relaxed">
            Try different keywords or browse all available mentors.
          </p>
        </>
      ) : (
        <>
          <h2 className="text-display-md font-display text-navy mb-3">
            Your next guide is waiting to be discovered.
          </h2>
          <p className="text-grey mb-8 leading-relaxed">
            HELPAMART is preparing the first generation of mentors.
            Be one of the first people to share your experience.
          </p>
        </>
      )}
      <Link
        to="/become-a-mentor"
        className="inline-flex items-center gap-2 bg-navy text-white px-7 py-3.5 rounded-xl font-semibold hover:bg-navy-mid transition-all group"
      >
        Become a Mentor
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
      </Link>
    </div>
  )
}
