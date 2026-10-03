import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  MessageCircle, Plus, Heart, Search, X, ArrowRight,
  Loader2, Send, ChevronRight, Users, TrendingUp
} from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'

const ease = [0.16, 1, 0.3, 1] as const

export type CommunityPost = {
  id: string
  title: string
  body: string
  created_at: string
  author_name: string
  author_id: string
  replyCount: number
  likesCount: number
  likedByMe: boolean
  category: string
}

const CATEGORIES = ['All', 'Career', 'College', 'Tech', 'Life', 'Startups', 'Q&A', 'Internships', 'Projects']

const CAT_COLORS: Record<string, string> = {
  Career: 'bg-gold/15 text-gold',
  College: 'bg-navy/10 text-navy',
  Tech: 'bg-maroon/10 text-maroon',
  Life: 'bg-orange/10 text-orange',
  Startups: 'bg-gold/20 text-gold',
  'Q&A': 'bg-navy/15 text-navy',
  Internships: 'bg-maroon/15 text-maroon',
  Projects: 'bg-orange/15 text-orange',
  General: 'bg-grey-soft text-navy/60',
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

function CategoryBadge({ category }: { category: string }) {
  const cls = CAT_COLORS[category] || CAT_COLORS.General
  return (
    <span className={`inline-flex items-center text-[0.625rem] font-bold tracking-[0.14em] uppercase px-2.5 py-1 rounded-full ${cls}`}>
      {category}
    </span>
  )
}

/* ─── Avatar ─── */
function Avatar({ name, size = 8 }: { name: string; size?: number }) {
  const colors = ['#071A35', '#B77A22', '#641F2B', '#C96A2B', '#102C4C']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0`}
      style={{ backgroundColor: colors[idx] }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

/* ─── Post Card ─── */
export function PostCard({ post, onLike }: { post: CommunityPost; onLike?: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 16 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease }}
      whileHover={{ y: -3, transition: { duration: 0.25 } }}
      className="group bg-white rounded-2xl border border-grey-soft hover:border-gold/30 hover:shadow-[0_8px_32px_rgba(7,26,53,0.08)] transition-all duration-300"
    >
      <Link to={`/community/${post.id}`} className="block p-5 pb-4">
        {/* Top row */}
        <div className="flex items-center gap-2 mb-3">
          <CategoryBadge category={post.category} />
          <span className="text-[0.6875rem] text-grey ml-auto shrink-0">{timeAgo(post.created_at)}</span>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-navy text-base leading-snug group-hover:text-gold transition-colors mb-1.5 line-clamp-2">
          {post.title}
        </h3>

        {/* Body preview */}
        <p className="text-sm text-grey leading-relaxed line-clamp-2 mb-4">{post.body}</p>

        {/* Author row */}
        <div className="flex items-center gap-2.5">
          <Avatar name={post.author_name} size={7} />
          <span className="text-sm font-medium text-navy">{post.author_name}</span>
        </div>
      </Link>

      {/* Footer */}
      <div className="flex items-center gap-1 px-5 py-3 border-t border-grey-soft">
        <button
          onClick={(e) => { e.preventDefault(); onLike?.(post.id) }}
          className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all ${
            post.likedByMe
              ? 'text-maroon bg-maroon/8'
              : 'text-grey hover:text-maroon hover:bg-maroon/6'
          }`}
        >
          <Heart className={`h-3.5 w-3.5 ${post.likedByMe ? 'fill-maroon text-maroon' : ''}`} />
          {post.likesCount}
        </button>
        <Link
          to={`/community/${post.id}`}
          className="flex items-center gap-1.5 text-xs font-medium text-grey hover:text-navy px-2.5 py-1.5 rounded-lg hover:bg-ivory-dark transition-all"
        >
          <MessageCircle className="h-3.5 w-3.5" />
          {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
        </Link>
        <Link
          to={`/community/${post.id}`}
          className="ml-auto flex items-center gap-1 text-xs text-gold font-medium opacity-0 group-hover:opacity-100 transition-opacity"
        >
          Open <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </motion.div>
  )
}

/* ─── Create Post Modal ─── */
function CreatePostModal({
  open, onClose, onCreated
}: {
  open: boolean
  onClose: () => void
  onCreated: (post: CommunityPost) => void
}) {
  const { toast } = useToast()
  const [category, setCategory] = useState('Career')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [posting, setPosting] = useState(false)

  async function submit() {
    if (!title.trim() || !body.trim()) {
      toast('Please fill in both the title and details.', 'error')
      return
    }
    setPosting(true)
    try {
      const res = await api<{ post: CommunityPost }>('/api/community', {
        method: 'POST',
        body: JSON.stringify({ category, title: title.trim(), body: body.trim() }),
      })
      onCreated(res.post)
      setTitle(''); setBody(''); setCategory('Career')
      onClose()
      toast('Posted to community!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not post.', 'error')
    } finally {
      setPosting(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="lg">
      <div className="space-y-5">
        {/* Header */}
        <div>
          <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-gold uppercase mb-1">New Discussion</p>
          <h2 className="text-display-md font-display text-navy">Start a conversation</h2>
          <p className="text-grey text-sm mt-1">Ask a question, share an experience, or start a discussion.</p>
        </div>

        {/* Category */}
        <div>
          <label className="field-label">Category</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CATEGORIES.filter(c => c !== 'All').map(c => (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  category === c
                    ? 'bg-navy text-white border-navy'
                    : 'bg-white text-grey border-grey-soft hover:border-navy/30 hover:text-navy'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label htmlFor="post-title" className="field-label">Your question or topic</label>
          <input
            id="post-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. How should I prepare for my first AI internship?"
            className="field-input"
            maxLength={200}
          />
          <p className="text-[0.6875rem] text-grey mt-1 text-right">{title.length}/200</p>
        </div>

        {/* Body */}
        <div>
          <label htmlFor="post-body" className="field-label">Details</label>
          <textarea
            id="post-body"
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Share your question, experience or idea in more detail…"
            className="field-input field-textarea"
            rows={5}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={submit}
            disabled={posting || !title.trim() || !body.trim()}
            className="flex items-center gap-2 px-6 py-3 bg-navy text-white rounded-xl font-semibold text-sm disabled:opacity-50 hover:bg-navy-mid transition-all"
          >
            {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {posting ? 'Posting…' : 'Post to Community'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 border border-grey-soft rounded-xl text-sm text-grey hover:text-navy transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ─── Community Stats ─── */
function CommunityStats() {
  const [stats, setStats] = useState<{ postCount: number; replyCount: number; userCount: number } | null>(null)
  useEffect(() => {
    api<{ postCount: number; replyCount: number; userCount: number }>('/api/community/stats')
      .then(setStats).catch(() => {})
  }, [])

  const items = [
    { value: stats ? `${stats.userCount}+` : '—', label: 'People learning' },
    { value: stats ? `${stats.postCount}+` : '—', label: 'Conversations' },
    { value: stats ? `${stats.replyCount}+` : '—', label: 'Replies shared' },
  ]

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map(({ value, label }) => (
        <div key={label} className="text-center">
          <p className="text-2xl font-display text-navy font-bold">{value}</p>
          <p className="text-xs text-grey mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

/* ─── Topics ─── */
const TOPICS = [
  'AI internships', 'Building projects', 'First job', 'College life',
  'Starting a startup', 'Learning to code', 'Interview prep', 'Career switch',
]

/* ─── MAIN COMMUNITY PAGE ─── */
export default function Community() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<CommunityPost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [compose, setCompose] = useState(false)

  const fetchPosts = useCallback(async (cat: string, q: string) => {
    setLoading(true)
    const params = new URLSearchParams()
    if (cat !== 'All') params.set('category', cat)
    if (q) params.set('search', q)
    try {
      const data = await api<{ posts: CommunityPost[] }>(`/api/community?${params}`)
      setPosts(data.posts)
    } catch {
      setPosts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPosts(activeCategory, search) }, [fetchPosts, activeCategory, search])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setSearch(searchInput.trim())
    setActiveCategory('All')
  }

  function clearSearch() {
    setSearch('')
    setSearchInput('')
  }

  async function handleLike(postId: string) {
    if (!user) return
    try {
      const res = await api<{ liked: boolean; likesCount: number }>(`/api/community/${postId}/like`, { method: 'POST' })
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likedByMe: res.liked, likesCount: res.likesCount } : p))
    } catch { /* silent */ }
  }

  function onPostCreated(post: CommunityPost) {
    setPosts(prev => [post, ...prev])
  }

  return (
    <div className="min-h-screen bg-ivory">
      {/* ── Hero ── */}
      <div className="bg-ivory-light border-b border-grey-soft pt-16 pb-0 overflow-hidden relative">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse 60% 60% at 60% 40%, rgba(183,122,34,0.08) 0%, transparent 65%)' }} />

        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pb-0">
            {/* Left */}
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease }}
              className="py-14"
            >
              <p className="text-xs font-bold tracking-[0.2em] text-gold uppercase mb-4 flex items-center gap-2">
                <span className="w-5 h-px bg-gold" />
                Community
              </p>
              <h1 className="text-display-xl font-display text-navy mb-4">
                You're not figuring it{' '}
                <em style={{ fontStyle: 'italic', color: '#B77A22', fontFamily: 'var(--font-display)' }}>
                  out alone.
                </em>
              </h1>
              <p className="text-grey text-lg leading-relaxed mb-8 max-w-md">
                Ask. Share. Grow together. Questions, ideas, and conversations from people walking different paths — together.
              </p>

              {/* Stats */}
              <div className="bg-white/60 border border-grey-soft rounded-2xl p-5 mb-8 max-w-sm">
                <CommunityStats />
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                {user ? (
                  <button
                    onClick={() => setCompose(true)}
                    className="group inline-flex items-center gap-2 bg-navy text-white px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all hover:shadow-[0_8px_24px_rgba(7,26,53,0.2)]"
                  >
                    <Plus className="h-4 w-4" />
                    Start a Discussion
                  </button>
                ) : (
                  <Link
                    to="/login?next=/community"
                    className="group inline-flex items-center gap-2 bg-navy text-white px-6 py-3.5 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all"
                  >
                    Sign in to participate
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                )}
                <a
                  href="#feed"
                  className="inline-flex items-center gap-2 border border-navy/20 text-navy px-6 py-3.5 rounded-xl font-semibold text-sm hover:border-gold/40 transition-all"
                >
                  Browse Discussions
                </a>
              </div>
            </motion.div>

            {/* Right — illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, ease, delay: 0.3 }}
              className="hidden lg:flex items-end justify-center relative"
            >
              <img
                src="/community-hero.jpg"
                alt="Diverse community members connected through conversations"
                className="w-full max-w-lg object-contain"
                loading="eager"
              />
            </motion.div>
          </div>
        </div>
      </div>

      {/* ── Topics strip ── */}
      <div className="border-b border-grey-soft bg-white py-4 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[0.6875rem] font-bold tracking-[0.18em] text-navy/40 uppercase shrink-0">People are talking about</span>
            {TOPICS.map(t => (
              <button
                key={t}
                onClick={() => { setSearchInput(t); setSearch(t); setActiveCategory('All') }}
                className="text-xs px-3 py-1.5 bg-ivory-dark text-navy/70 rounded-full hover:bg-gold/10 hover:text-gold transition-all font-medium"
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feed ── */}
      <div id="feed" className="max-w-7xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">

          {/* Main feed column */}
          <div>
            {/* Search + category bar */}
            <div className="mb-6 space-y-4">
              {/* Search */}
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-grey pointer-events-none" />
                <input
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search discussions…"
                  className="field-input pl-10 pr-10"
                />
                {searchInput && (
                  <button type="button" onClick={clearSearch} className="absolute right-3 top-1/2 -translate-y-1/2 text-grey hover:text-navy">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </form>

              {/* Category filters */}
              <div className="flex gap-2 flex-wrap">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => { setActiveCategory(c); setSearch(''); setSearchInput('') }}
                    className={`pill text-xs ${activeCategory === c && !search ? 'pill-active' : ''}`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              {/* Active search indicator */}
              {search && (
                <div className="flex items-center gap-2 text-sm text-grey">
                  <TrendingUp className="h-4 w-4 text-gold" />
                  Showing results for "<span className="font-medium text-navy">{search}</span>"
                  <button onClick={clearSearch} className="text-gold hover:underline text-xs ml-1">Clear</button>
                </div>
              )}
            </div>

            {/* Posts */}
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="skeleton rounded-2xl h-36" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <EmptyState onCompose={user ? () => setCompose(true) : undefined} search={search} />
            ) : (
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeCategory + search}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-4"
                >
                  {posts.map(post => (
                    <PostCard key={post.id} post={post} onLike={handleLike} />
                  ))}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-5">
            {/* QOTW */}
            <div className="bg-navy rounded-2xl p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(183,122,34,0.2) 0%, transparent 70%)' }} />
              <p className="text-[0.6875rem] font-bold tracking-[0.18em] text-gold/70 uppercase mb-3 relative z-10">
                Question of the Week
              </p>
              <blockquote className="font-display italic text-white/90 text-base leading-snug relative z-10" style={{ fontStyle: 'italic' }}>
                "If you could ask someone 5 years ahead of you ONE question, what would it be?"
              </blockquote>
              <div className="mt-4 pt-4 border-t border-white/10 relative z-10">
                {user ? (
                  <button
                    onClick={() => { setCompose(true) }}
                    className="text-gold text-sm font-medium hover:text-gold-light transition-colors flex items-center gap-1"
                  >
                    Share your answer <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <Link to="/login?next=/community" className="text-gold text-sm font-medium hover:text-gold-light transition-colors flex items-center gap-1">
                    Sign in to answer <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            </div>

            {/* Topics list */}
            <div className="bg-white rounded-2xl border border-grey-soft p-5">
              <p className="text-xs font-bold tracking-[0.15em] text-navy/40 uppercase mb-4">Browse Topics</p>
              <div className="space-y-1">
                {TOPICS.map(t => (
                  <button
                    key={t}
                    onClick={() => { setSearchInput(t); setSearch(t); setActiveCategory('All') }}
                    className="w-full text-left text-sm text-navy/70 py-2 px-3 rounded-lg hover:bg-ivory-dark hover:text-gold transition-all flex items-center justify-between group"
                  >
                    {t}
                    <ChevronRight className="h-3.5 w-3.5 text-grey opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>

            {/* Mentor CTA */}
            <div className="bg-gold/8 border border-gold/20 rounded-2xl p-5">
              <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-2">Need direct help?</p>
              <p className="text-sm text-navy/70 leading-relaxed mb-4">
                Sometimes a 1:1 session with a mentor answers what a thread cannot.
              </p>
              <Link
                to="/find-mentor"
                className="group inline-flex items-center gap-2 bg-navy text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-navy-mid transition-all"
              >
                Find a Mentor
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Create Post Modal */}
      <CreatePostModal open={compose} onClose={() => setCompose(false)} onCreated={onPostCreated} />
    </div>
  )
}

/* ─── Empty State ─── */
function EmptyState({ onCompose, search }: { onCompose?: () => void; search: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="text-center py-20 border border-grey-soft rounded-2xl bg-ivory-light"
    >
      <div className="w-16 h-16 rounded-2xl bg-gold/10 flex items-center justify-center mx-auto mb-5 text-gold">
        <Users className="h-7 w-7" />
      </div>
      {search ? (
        <>
          <h3 className="text-display-md font-display text-navy mb-2">No results for "{search}"</h3>
          <p className="text-grey mb-6 max-w-sm mx-auto text-sm">Try a different search term, or start a new discussion about this topic.</p>
        </>
      ) : (
        <>
          <h3 className="text-display-md font-display text-navy mb-2">Every community starts with one question.</h3>
          <p className="text-grey mb-6 max-w-sm mx-auto text-sm">Be the first person to start a conversation in this category.</p>
        </>
      )}
      {onCompose && (
        <button
          onClick={onCompose}
          className="group inline-flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all"
        >
          <Plus className="h-4 w-4" />
          Start a Discussion
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
        </button>
      )}
    </motion.div>
  )
}
