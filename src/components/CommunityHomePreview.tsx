/**
 * CommunityHomePreview
 * Shows 3 live community posts from the backend on the Home page.
 * Placed after Stories and before Why HELPAMART.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { MessageCircle, Heart, ArrowRight, Users, Plus } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import type { CommunityPost } from '@/pages/Community'

const ease = [0.16, 1, 0.3, 1] as const

function FadeIn({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, ease, delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

function MiniAvatar({ name }: { name: string }) {
  const colors = ['#071A35', '#B77A22', '#641F2B', '#C96A2B', '#102C4C']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
      style={{ backgroundColor: colors[idx] }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

function MiniPostCard({ post, index }: { post: CommunityPost; index: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease, delay: index * 0.1 }}
      whileHover={{ y: -4, transition: { duration: 0.25 } }}
      className="group"
    >
      <Link
        to={`/community/${post.id}`}
        className="block bg-white rounded-2xl border border-grey-soft p-5 hover:border-gold/30 hover:shadow-[0_8px_32px_rgba(7,26,53,0.08)] transition-all duration-300 h-full"
      >
        {/* Category + time */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[0.625rem] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-full bg-gold/10 text-gold">
            {post.category}
          </span>
          <span className="text-[0.6875rem] text-grey ml-auto">{timeAgo(post.created_at)}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-navy text-sm leading-snug group-hover:text-gold transition-colors mb-2 line-clamp-2">
          {post.title}
        </h3>

        {/* Preview text */}
        <p className="text-xs text-grey leading-relaxed line-clamp-2 mb-4">{post.body}</p>

        {/* Footer */}
        <div className="flex items-center gap-3 pt-3 border-t border-grey-soft">
          <MiniAvatar name={post.author_name} />
          <span className="text-xs font-medium text-navy truncate flex-1">{post.author_name}</span>
          <span className="flex items-center gap-1 text-xs text-grey">
            <Heart className="h-3 w-3" />{post.likesCount}
          </span>
          <span className="flex items-center gap-1 text-xs text-grey">
            <MessageCircle className="h-3 w-3" />{post.replyCount}
          </span>
        </div>
      </Link>
    </motion.div>
  )
}

export default function CommunityHomePreview() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api<{ posts: CommunityPost[] }>('/api/community?limit=3')
      .then(d => setPosts(d.posts.slice(0, 3)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <section className="bg-white py-24 border-y border-grey-soft">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <FadeIn className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-4 flex items-center gap-2">
                <span className="w-5 h-px bg-gold" />
                Community
              </p>
              <h2 className="text-display-xl font-display text-navy">
                You're not figuring it{' '}
                <em style={{ fontStyle: 'italic', color: '#B77A22', fontFamily: 'var(--font-display)' }}>
                  out alone.
                </em>
              </h2>
              <p className="text-grey text-lg mt-4 leading-relaxed">
                Ask questions. Share what you've learned. Help someone who's one step behind you.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
              <Link
                to="/community"
                className="group inline-flex items-center gap-2 text-navy font-semibold hover:text-gold transition-colors"
              >
                Explore Community
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              {user && (
                <Link
                  to="/community"
                  className="inline-flex items-center gap-2 text-sm text-grey hover:text-navy transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Start a discussion
                </Link>
              )}
            </div>
          </div>
        </FadeIn>

        {/* Posts */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="skeleton rounded-2xl h-48" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <FadeIn delay={0.2}>
            <div className="text-center py-16 border border-grey-soft rounded-2xl bg-ivory-light">
              <div className="w-14 h-14 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-4 text-gold">
                <Users className="h-6 w-6" />
              </div>
              <p className="text-display-md font-display text-navy mb-2">Every community starts with one question.</p>
              <p className="text-grey text-sm mb-5">Be the first to start a conversation.</p>
              <Link
                to="/community"
                className="group inline-flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all"
              >
                Go to Community
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </FadeIn>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post, i) => (
              <MiniPostCard key={post.id} post={post} index={i} />
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {posts.length > 0 && (
          <FadeIn delay={0.3} className="mt-10 text-center">
            <Link
              to="/community"
              className="group inline-flex items-center gap-2 border border-navy/20 bg-ivory-light text-navy px-7 py-3.5 rounded-xl font-semibold hover:border-gold/40 hover:bg-ivory-dark/40 transition-all"
            >
              See all discussions
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </FadeIn>
        )}
      </div>
    </section>
  )
}
