import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MessageCircle, Plus, Heart, Users, ChevronRight } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

type Post = {
  id: string; title: string; body: string; createdAt: string
  authorName: string; replyCount: number; likesCount: number; category: string
}

const CATEGORIES = ['All', 'Career', 'College', 'Tech', 'Life', 'Startups', 'Q&A']

export default function Community() {
  const { user } = useAuth()
  const { toast } = useToast()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState('All')
  const [compose, setCompose] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newBody, setNewBody] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    api<{ posts: Post[] }>('/api/community')
      .then(d => setPosts(d.posts))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function submitPost() {
    if (!newTitle.trim() || !newBody.trim()) return
    if (!user) { toast('Sign in to post.', 'error'); return }
    setPosting(true)
    try {
      const res = await api<{ post: Post }>('/api/community', {
        method: 'POST',
        body: JSON.stringify({ title: newTitle.trim(), body: newBody.trim(), category: activeCategory === 'All' ? 'General' : activeCategory }),
      })
      setPosts(prev => [res.post, ...prev])
      setNewTitle(''); setNewBody(''); setCompose(false)
      toast('Post shared!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not post.', 'error')
    } finally {
      setPosting(false)
    }
  }

  const filtered = activeCategory === 'All' ? posts : posts.filter(p => p.category === activeCategory)

  return (
    <div className="min-h-screen bg-ivory">
      {/* Header */}
      <div className="bg-ivory-light border-b border-grey-soft py-14">
        <div className="max-w-4xl mx-auto px-6">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <p className="text-xs font-bold tracking-[0.15em] text-gold uppercase mb-3 flex items-center gap-2">
              <span className="w-5 h-px bg-gold" /> Community
            </p>
            <h1 className="text-display-xl font-display text-navy mb-3">
              A space to ask, share,<br />
              <em style={{ fontStyle: 'italic', color: 'var(--color-gold)' }}>and grow together.</em>
            </h1>
            <p className="text-grey text-base mb-6">Ask questions. Share lessons. Connect with people on similar journeys.</p>
            {user ? (
              <button
                onClick={() => setCompose(v => !v)}
                className="inline-flex items-center gap-2 bg-navy text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all"
              >
                <Plus className="h-4 w-4" /> Start a Discussion
              </button>
            ) : (
              <Link to="/login?next=/community" className="inline-flex items-center gap-2 bg-navy text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-navy-mid transition-all">
                Sign in to participate
              </Link>
            )}
          </motion.div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Compose */}
        {compose && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-grey-soft p-5 mb-6"
          >
            <h3 className="text-sm font-semibold text-navy mb-4">New Discussion</h3>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="What's on your mind? (Title)"
              className="field-input mb-3"
            />
            <textarea
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="Share your question, story, or insight…"
              className="field-input field-textarea mb-4"
              rows={4}
            />
            <div className="flex gap-3">
              <button onClick={submitPost} disabled={posting || !newTitle.trim()} className="px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold disabled:opacity-50">
                {posting ? 'Posting…' : 'Post'}
              </button>
              <button onClick={() => setCompose(false)} className="px-5 py-2.5 border border-grey-soft rounded-xl text-sm text-grey hover:text-navy transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}

        {/* Category filters */}
        <div className="flex gap-2 flex-wrap mb-8">
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setActiveCategory(c)}
              className={`pill text-xs ${activeCategory === c ? 'pill-active' : ''}`}>
              {c}
            </button>
          ))}
        </div>

        {/* Posts */}
        {loading ? (
          <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-10 w-10 text-grey-mid mx-auto mb-4" />
            <p className="text-display-md font-display text-navy mb-2">No discussions yet.</p>
            <p className="text-grey">Be the first to start a conversation.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((post, i) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05, duration: 0.4 }}
              >
                <Link to={`/community/${post.id}`} className="block bg-white rounded-2xl border border-grey-soft p-5 hover:border-gold/30 transition-all group">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        {post.category && (
                          <span className="text-[0.6875rem] font-semibold px-2 py-0.5 bg-ivory-dark rounded-full text-navy/70">{post.category}</span>
                        )}
                        <span className="text-xs text-grey">{new Date(post.createdAt).toLocaleDateString()}</span>
                      </div>
                      <h3 className="font-semibold text-navy group-hover:text-gold transition-colors">{post.title}</h3>
                      <p className="text-sm text-grey mt-1.5 line-clamp-2">{post.body}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-grey shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="flex items-center gap-4 mt-4 text-xs text-grey">
                    <span className="flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5 text-gold" />{post.replyCount}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5 text-maroon" />{post.likesCount}</span>
                    <span>by {post.authorName}</span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
