import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
)

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // GET /api/community/stats — get community statistics
    if (req.method === 'GET') {
      return handleGetStats(req, res)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Community stats API error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

async function handleGetStats(_req: VercelRequest, res: VercelResponse) {
  try {
    // Count posts
    const { count: postCount, error: postsError } = await supabase
      .from('community_posts')
      .select('*', { count: 'exact', head: true })

    if (postsError) {
      return res.status(400).json({ error: postsError.message })
    }

    // Count replies
    const { count: replyCount, error: repliesError } = await supabase
      .from('community_replies')
      .select('*', { count: 'exact', head: true })

    if (repliesError) {
      return res.status(400).json({ error: repliesError.message })
    }

    // Count unique users who posted or replied
    const { data: postAuthors, error: postAuthorsError } = await supabase
      .from('community_posts')
      .select('author_id')

    const { data: replyAuthors, error: replyAuthorsError } = await supabase
      .from('community_replies')
      .select('author_id')

    let userCount = 0
    if (!postAuthorsError && !replyAuthorsError) {
      const authorIds = new Set([
        ...(postAuthors || []).map(p => p.author_id),
        ...(replyAuthors || []).map(r => r.author_id),
      ])
      userCount = authorIds.size
    }

    res.status(200).json({
      postCount: postCount || 0,
      replyCount: replyCount || 0,
      userCount,
    })
  } catch (error: any) {
    console.error('Get stats error:', error)
    res.status(500).json({ error: error.message || 'Failed to fetch stats' })
  }
}
