import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Heart, Send, Loader2 } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'

type Reply = { id: string; body: string; authorName: string; createdAt: string }
type Post = {
  id: string; title: string; body: string; authorName: string
  createdAt: string; likesCount: number; replies: Reply[]
}

export default function CommunityPost() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const [post, setPost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)

  useEffect(() => {
    if (!id) return
    api<{ post: Post }>(`/api/community/${id}`)
      .then(d => setPost(d.post))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  async function submitReply() {
    if (!replyText.trim() || !user) return
    setReplying(true)
    try {
      const res = await api<{ reply: Reply }>(`/api/community/${id}/replies`, {
        method: 'POST',
        body: JSON.stringify({ body: replyText.trim() }),
      })
      setPost(prev => prev ? { ...prev, replies: [...prev.replies, res.reply] } : prev)
      setReplyText('')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not post reply.', 'error')
    } finally {
      setReplying(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="skeleton h-8 w-2/3 rounded mb-4" />
        <div className="skeleton h-40 rounded-2xl" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <p className="text-display-md font-display text-navy mb-4">Post not found.</p>
        <Link to="/community" className="text-gold hover:underline">← Back to Community</Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/community" className="inline-flex items-center gap-1.5 text-sm text-grey hover:text-gold transition-colors mb-8 group">
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Community
        </Link>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          {/* Post */}
          <div className="bg-white rounded-2xl border border-grey-soft p-6 mb-6">
            <h1 className="text-display-md font-display text-navy mb-2">{post.title}</h1>
            <p className="text-xs text-grey mb-6">by {post.authorName} · {new Date(post.createdAt).toLocaleDateString()}</p>
            <p className="text-navy/80 leading-relaxed whitespace-pre-line">{post.body}</p>
            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-grey-soft text-xs text-grey">
              <Heart className="h-4 w-4 text-maroon" /> {post.likesCount}
            </div>
          </div>

          {/* Replies */}
          <div className="space-y-4 mb-8">
            <h2 className="text-sm font-semibold text-navy">{post.replies.length} {post.replies.length === 1 ? 'Reply' : 'Replies'}</h2>
            {post.replies.map(r => (
              <div key={r.id} className="bg-white rounded-2xl border border-grey-soft p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-7 h-7 rounded-full bg-navy text-white text-xs font-bold flex items-center justify-center shrink-0">
                    {r.authorName?.[0] || '?'}
                  </div>
                  <span className="text-sm font-medium text-navy">{r.authorName}</span>
                  <span className="text-xs text-grey">{new Date(r.createdAt).toLocaleDateString()}</span>
                </div>
                <p className="text-navy/80 text-sm leading-relaxed">{r.body}</p>
              </div>
            ))}
          </div>

          {/* Reply composer */}
          {user ? (
            <div className="bg-white rounded-2xl border border-grey-soft p-5">
              <h3 className="text-sm font-semibold text-navy mb-3">Add a Reply</h3>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Share your thoughts…"
                className="field-input field-textarea mb-3"
                rows={3}
              />
              <button
                onClick={submitReply}
                disabled={replying || !replyText.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-navy-mid transition-all"
              >
                {replying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {replying ? 'Posting…' : 'Post Reply'}
              </button>
            </div>
          ) : (
            <div className="bg-ivory-light rounded-2xl border border-grey-soft p-5 text-center">
              <p className="text-sm text-grey mb-3">Sign in to join the conversation.</p>
              <Link to="/login?next=/community" className="inline-flex items-center gap-2 bg-navy text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                Sign In
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
