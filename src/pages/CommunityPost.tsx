import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ChevronLeft, Heart, Send, Loader2, MessageCircle, MoreVertical, Trash2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import {
  getCommunityPost,
  getCommunityReplies,
  createCommunityReply,
  updateCommunityPost,
  deleteCommunityPost,
  toggleCommunityLike,
  updateCommunityReply,
  deleteCommunityReply,
  type CommunityPost as DirectCommunityPost,
  type CommunityReply as DirectCommunityReply,
} from '@/lib/community'

const ease = [0.16, 1, 0.3, 1] as const

type Reply = DirectCommunityReply

type FullPost = DirectCommunityPost

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

function Avatar({ name, size = 9 }: { name: string; size?: number }) {
  const colors = ['#071A35', '#B77A22', '#641F2B', '#C96A2B', '#102C4C']
  const idx = name.charCodeAt(0) % colors.length
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0`}
      style={{ backgroundColor: colors[idx] }}
      aria-hidden="true"
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  )
}

export default function CommunityPostPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const { toast } = useToast()
  const [post, setPost] = useState<FullPost | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const [liking, setLiking] = useState(false)
  const [editingPostId, setEditingPostId] = useState<string | null>(null)
  const [editPostTitle, setEditPostTitle] = useState('')
  const [editPostBody, setEditPostBody] = useState('')
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null)
  const [editReplyBody, setEditReplyBody] = useState('')
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      try {
        const [postData, repliesData] = await Promise.all([
          getCommunityPost(id),
          getCommunityReplies(id),
        ])
        setPost(postData)
        setReplies(repliesData)
      } catch {
        // Silent failure
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  async function submitReply() {
    if (!replyText.trim() || !user || !id) return
    setReplying(true)
    try {
      const reply = await createCommunityReply(id, replyText.trim())
      setReplies(prev => [...prev, reply])
      setPost(prev => prev ? { ...prev, replyCount: prev.replyCount + 1 } : prev)
      setReplyText('')
      toast('Reply posted!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not post reply.', 'error')
    } finally {
      setReplying(false)
    }
  }

  async function toggleLike() {
    if (!user || !post) { toast('Sign in to like posts.', 'error'); return }
    if (liking) return
    setLiking(true)
    try {
      const liked = await toggleCommunityLike(post.id)
      setPost(prev => prev ? { ...prev, likedByMe: liked, likes_count: prev.likes_count + (liked ? 1 : -1) } : prev)
    } catch { /* silent */ }
    finally { setLiking(false) }
  }

  async function submitEditPost() {
    if (!editPostTitle.trim() || !editPostBody.trim() || !post) return
    setEditing(true)
    try {
      const updated = await updateCommunityPost(post.id, {
        title: editPostTitle.trim(),
        body: editPostBody.trim(),
      })
      setPost(updated)
      setEditingPostId(null)
      toast('Post updated!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not update post.', 'error')
    } finally {
      setEditing(false)
    }
  }

  async function submitDeletePost() {
    if (!post) return
    setDeleting(true)
    try {
      await deleteCommunityPost(post.id)
      toast('Post deleted.', 'success')
      window.location.href = '/community'
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not delete post.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  async function submitEditReply() {
    if (!editReplyBody.trim() || !editingReplyId) return
    setEditing(true)
    try {
      const updated = await updateCommunityReply(editingReplyId, editReplyBody.trim())
      setReplies(prev => prev.map(r => r.id === editingReplyId ? updated : r))
      setEditingReplyId(null)
      toast('Reply updated!', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not update reply.', 'error')
    } finally {
      setEditing(false)
    }
  }

  async function submitDeleteReply(replyId: string) {
    setDeleting(true)
    try {
      await deleteCommunityReply(replyId)
      setReplies(prev => prev.filter(r => r.id !== replyId))
      setPost(prev => prev ? { ...prev, replyCount: Math.max(0, prev.replyCount - 1) } : prev)
      toast('Reply deleted.', 'success')
    } catch (e: unknown) {
      toast((e as Error).message || 'Could not delete reply.', 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory">
        <div className="max-w-3xl mx-auto px-6 py-10 space-y-4">
          <div className="skeleton h-5 w-24 rounded" />
          <div className="skeleton h-10 w-3/4 rounded" />
          <div className="skeleton h-48 rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!post) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center">
        <div className="text-center">
          <p className="text-display-md font-display text-navy mb-4">Discussion not found.</p>
          <Link to="/community" className="text-gold hover:underline font-medium">← Back to Community</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory">
      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Back link */}
        <Link
          to="/community"
          className="inline-flex items-center gap-1.5 text-sm text-grey hover:text-gold transition-colors mb-8 group"
        >
          <ChevronLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          Back to Community
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease }}
          className="space-y-5"
        >
          {/* ── Main post card ── */}
          <div className="bg-white rounded-3xl border border-grey-soft shadow-soft overflow-hidden">
            {/* Category bar */}
            <div className="bg-navy px-6 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                <span className="text-[0.625rem] font-bold tracking-[0.2em] text-gold/80 uppercase">{post?.category}</span>
              </div>
              {user?.id === post?.author_id && (
                <button
                  onClick={() => { setEditingPostId(post.id); setEditPostTitle(post.title); setEditPostBody(post.body) }}
                  className="text-gold/60 hover:text-gold transition-colors"
                  title="Edit post"
                >
                  <MoreVertical className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="p-6 md:p-8">
              <h1 className="text-display-md font-display text-navy mb-5">{post?.title}</h1>

              {/* Author info */}
              <div className="flex items-center gap-3 mb-6 pb-6 border-b border-grey-soft">
                <Avatar name={post?.author_name || 'User'} />
                <div>
                  <p className="font-semibold text-navy text-sm">{post?.author_name}</p>
                  <p className="text-xs text-grey">{post && timeAgo(post.created_at)}</p>
                </div>
              </div>

              <p className="text-navy/80 leading-relaxed whitespace-pre-line text-base">{post?.body}</p>

              {/* Reaction row */}
              <div className="flex items-center gap-4 mt-8 pt-5 border-t border-grey-soft">
                <button
                  onClick={toggleLike}
                  disabled={liking}
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-xl border transition-all ${
                    post?.likedByMe
                      ? 'bg-maroon/8 border-maroon/20 text-maroon'
                      : 'border-grey-soft text-grey hover:border-maroon/30 hover:text-maroon hover:bg-maroon/5'
                  }`}
                >
                  <Heart className={`h-4 w-4 ${post?.likedByMe ? 'fill-maroon text-maroon' : ''}`} />
                  {post?.likes_count} {post?.likes_count === 1 ? 'like' : 'likes'}
                </button>
                <span className="flex items-center gap-2 text-sm text-grey">
                  <MessageCircle className="h-4 w-4" />
                  {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                </span>
              </div>
            </div>
          </div>

          {/* ── Replies ── */}
          {replies.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold tracking-[0.15em] text-navy/40 uppercase px-1">
                {replies.length} {replies.length === 1 ? 'Reply' : 'Replies'}
              </p>
              {replies.map((r, i) => (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease, delay: i * 0.05 }}
                  className="bg-white rounded-2xl border border-grey-soft p-5"
                >
                  <div className="flex items-center gap-3 mb-3 justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar name={r.author_name} size={8} />
                      <div>
                        <p className="text-sm font-semibold text-navy">{r.author_name}</p>
                        <p className="text-xs text-grey">{timeAgo(r.created_at)}</p>
                      </div>
                    </div>
                    {user?.id === r.author_id && (
                      <button
                        onClick={() => { setEditingReplyId(r.id); setEditReplyBody(r.body) }}
                        className="text-grey hover:text-gold transition-colors"
                        title="Edit reply"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  <p className="text-navy/80 text-sm leading-relaxed whitespace-pre-line">{r.body}</p>
                </motion.div>
              ))}
            </div>
          )}

          {/* ── Reply composer ── */}
          {user ? (
            <div className="bg-white rounded-2xl border border-grey-soft p-5">
              <div className="flex items-center gap-3 mb-4">
                <Avatar name={user.name} size={8} />
                <div>
                  <p className="text-sm font-semibold text-navy">{user.name}</p>
                  <p className="text-xs text-grey">Replying to this discussion</p>
                </div>
              </div>
              <textarea
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Share your thoughts, experience, or advice…"
                className="field-input field-textarea mb-4"
                rows={4}
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
            <div className="bg-ivory-light rounded-2xl border border-grey-soft p-6 text-center">
              <p className="text-base font-display text-navy mb-2">Join the conversation</p>
              <p className="text-sm text-grey mb-5">Sign in to share your thoughts and reply to this discussion.</p>
              <Link
                to="/login?next=/community"
                className="inline-flex items-center gap-2 bg-navy text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-navy-mid transition-all"
              >
                Sign In
              </Link>
            </div>
          )}
        </motion.div>
      </div>

      {/* Edit Post Modal */}
      <Modal open={!!editingPostId} onClose={() => setEditingPostId(null)} maxWidth="lg">
        <div className="space-y-4">
          <div>
            <label className="field-label">Title</label>
            <input
              value={editPostTitle}
              onChange={e => setEditPostTitle(e.target.value)}
              className="field-input"
              maxLength={200}
            />
          </div>
          <div>
            <label className="field-label">Body</label>
            <textarea
              value={editPostBody}
              onChange={e => setEditPostBody(e.target.value)}
              className="field-input field-textarea"
              rows={6}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={submitEditPost}
              disabled={editing || !editPostTitle.trim() || !editPostBody.trim()}
              className="flex-1 px-4 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-navy-mid transition-all"
            >
              {editing ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => submitDeletePost()}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2.5 border border-maroon/30 text-maroon rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-maroon/5 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => setEditingPostId(null)}
              className="px-4 py-2.5 border border-grey-soft text-grey rounded-xl text-sm font-semibold hover:text-navy transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Reply Modal */}
      <Modal open={!!editingReplyId} onClose={() => setEditingReplyId(null)} maxWidth="md">
        <div className="space-y-4">
          <div>
            <label className="field-label">Reply</label>
            <textarea
              value={editReplyBody}
              onChange={e => setEditReplyBody(e.target.value)}
              className="field-input field-textarea"
              rows={5}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={submitEditReply}
              disabled={editing || !editReplyBody.trim()}
              className="flex-1 px-4 py-2.5 bg-navy text-white rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-navy-mid transition-all"
            >
              {editing ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={() => submitDeleteReply(editingReplyId!)}
              disabled={deleting}
              className="flex items-center gap-2 px-4 py-2.5 border border-maroon/30 text-maroon rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-maroon/5 transition-all"
            >
              <Trash2 className="h-4 w-4" />
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => setEditingReplyId(null)}
              className="px-4 py-2.5 border border-grey-soft text-grey rounded-xl text-sm font-semibold hover:text-navy transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
