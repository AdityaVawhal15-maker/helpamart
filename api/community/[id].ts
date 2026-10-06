import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
)

function getAuthorName(author: any): string {
  if (!author) return 'Community Member'
  if (typeof author === 'object' && 'name' in author) return author.name || 'Community Member'
  if (Array.isArray(author) && author.length > 0) return author[0]?.name || 'Community Member'
  return 'Community Member'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { id } = req.query

    // GET /api/community/[id] — get single post with replies
    if (req.method === 'GET') {
      return handleGetPost(req, res, id as string)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Community post API error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

async function handleGetPost(req: VercelRequest, res: VercelResponse, postId: string) {
  try {
    // Get post with author info
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select(`
        id,
        title,
        body,
        category,
        likes_count,
        created_at,
        updated_at,
        author_id,
        author:profiles(id, name)
      `)
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // Get replies with author info
    const { data: replies, error: repliesError } = await supabase
      .from('community_replies')
      .select(`
        id,
        body,
        created_at,
        updated_at,
        author_id,
        author:profiles(id, name)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (repliesError) {
      return res.status(400).json({ error: repliesError.message })
    }

    // Extract auth token to check if user liked
    const authHeader = req.headers.authorization
    const token = authHeader?.replace('Bearer ', '')
    let userId: string | null = null
    let likedByMe = false

    if (token) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(token)
      if (!authError && user) {
        userId = user.id

        // Check if user liked this post
        const { data: likeData } = await supabase
          .from('community_likes')
          .select('id')
          .eq('post_id', postId)
          .eq('user_id', userId)
          .single()

        likedByMe = !!likeData
      }
    }

    // Format post
    const formattedPost = {
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      created_at: post.created_at,
      author_name: getAuthorName(post.author),
      author_id: post.author_id,
      likesCount: post.likes_count || 0,
      likedByMe,
    }

    // Format replies
    const formattedReplies = (replies || []).map((reply: any) => ({
      id: reply.id,
      body: reply.body,
      created_at: reply.created_at,
      author_name: getAuthorName(reply.author),
      author_id: reply.author_id,
    }))

    res.status(200).json({ post: formattedPost, replies: formattedReplies })
  } catch (error: any) {
    console.error('Get post error:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch post' })
  }
}
