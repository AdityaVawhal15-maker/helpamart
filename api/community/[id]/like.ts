import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!,
)

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

    // POST /api/community/[id]/like — toggle like
    if (req.method === 'POST') {
      return handleToggleLike(req, res, user.id)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Community like API error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

async function handleToggleLike(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { id: postId } = req.query

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select('id, likes_count')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // Check if already liked
    const { data: existingLike, error: checkError } = await supabase
      .from('community_likes')
      .select('id')
      .eq('post_id', postId as string)
      .eq('user_id', userId)
      .single()

    if (!checkError && existingLike) {
      // Unlike
      const { error: deleteError } = await supabase
        .from('community_likes')
        .delete()
        .eq('post_id', postId as string)
        .eq('user_id', userId)

      if (deleteError) {
        return res.status(400).json({ error: deleteError.message })
      }

      // Get updated count
      const { data: updatedPost } = await supabase
        .from('community_posts')
        .select('likes_count')
        .eq('id', postId)
        .single()

      return res.status(200).json({
        liked: false,
        likesCount: updatedPost?.likes_count || 0,
      })
    } else {
      // Like
      const { error: insertError } = await supabase
        .from('community_likes')
        .insert({
          post_id: postId as string,
          user_id: userId,
        })

      if (insertError) {
        return res.status(400).json({ error: insertError.message })
      }

      // Get updated count
      const { data: updatedPost } = await supabase
        .from('community_posts')
        .select('likes_count')
        .eq('id', postId)
        .single()

      return res.status(200).json({
        liked: true,
        likesCount: updatedPost?.likes_count || 0,
      })
    }
  } catch (error: any) {
    console.error('Toggle like error:', error)
    res.status(500).json({ error: error.message || 'Failed to toggle like' })
  }
}
