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
    // Extract authorization token
    const authHeader = req.headers.authorization
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Set auth context with the token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' })
    }

    // GET /api/community — list posts
    if (req.method === 'GET') {
      return handleGetPosts(req, res, user.id)
    }

    // POST /api/community — create post
    if (req.method === 'POST') {
      return handleCreatePost(req, res, user.id)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Community API error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

async function handleGetPosts(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { category, search } = req.query

    let query = supabase
      .from('community_posts')
      .select(`
        id,
        title,
        body,
        category,
        likes_count,
        created_at,
        author_id,
        author:profiles(id, name),
        replies:community_replies(id)
      `)
      .order('created_at', { ascending: false })

    // Filter by category if provided
    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    // Filter by search if provided
    if (search) {
      query = query.or(
        `title.ilike.%${search}%,body.ilike.%${search}%`
      )
    }

    const { data: posts, error: postsError } = await query

    if (postsError) {
      return res.status(400).json({ error: postsError.message })
    }

    // Check if current user liked each post
    const postIds = posts?.map(p => p.id) || []
    let likedPostIds: string[] = []

    if (postIds.length > 0) {
      const { data: likes, error: likesError } = await supabase
        .from('community_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds)

      if (!likesError && likes) {
        likedPostIds = likes.map(l => l.post_id)
      }
    }

    // Format response
    const formattedPosts = (posts || []).map((post: any) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      created_at: post.created_at,
      author_name: getAuthorName(post.author),
      author_id: post.author_id,
      replyCount: post.replies?.length || 0,
      likesCount: post.likes_count || 0,
      likedByMe: likedPostIds.includes(post.id),
    }))

    res.status(200).json({ posts: formattedPosts })
  } catch (error: any) {
    console.error('Get posts error:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch posts' })
  }
}

async function handleCreatePost(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { category, title, body } = req.body

    // Validate input
    if (!category || !title || !body) {
      return res.status(400).json({ error: 'Missing required fields: category, title, body' })
    }

    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title must be a non-empty string' })
    }

    if (typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Body must be a non-empty string' })
    }

    // Insert post
    const { data: post, error: insertError } = await supabase
      .from('community_posts')
      .insert({
        author_id: userId,
        category,
        title: title.trim(),
        body: body.trim(),
        likes_count: 0,
      })
      .select(`
        id,
        title,
        body,
        category,
        likes_count,
        created_at,
        author_id,
        author:profiles(id, name)
      `)
      .single()

    if (insertError) {
      return res.status(400).json({ error: insertError.message })
    }

    // Format response
    const formattedPost = {
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      created_at: post.created_at,
      author_name: getAuthorName(post.author),
      author_id: post.author_id,
      replyCount: 0,
      likesCount: post.likes_count || 0,
      likedByMe: false,
    }

    res.status(201).json({ post: formattedPost })
  } catch (error: any) {
    console.error('Create post error:', error)
    res.status(500).json({ error: error.message || 'Failed to create post' })
  }
}
