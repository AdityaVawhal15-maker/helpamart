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

    // POST /api/community/[id]/replies — create reply
    if (req.method === 'POST') {
      return handleCreateReply(req, res, user.id)
    }

    res.status(405).json({ error: 'Method not allowed' })
  } catch (error: any) {
    console.error('Community replies API error:', error)
    res.status(500).json({ error: error.message || 'Internal server error' })
  }
}

async function handleCreateReply(req: VercelRequest, res: VercelResponse, userId: string) {
  try {
    const { id: postId } = req.query
    const { body } = req.body

    // Validate input
    if (!body || typeof body !== 'string' || body.trim().length === 0) {
      return res.status(400).json({ error: 'Reply body is required' })
    }

    // Verify post exists
    const { data: post, error: postError } = await supabase
      .from('community_posts')
      .select('id')
      .eq('id', postId)
      .single()

    if (postError || !post) {
      return res.status(404).json({ error: 'Post not found' })
    }

    // Create reply
    const { data: reply, error: insertError } = await supabase
      .from('community_replies')
      .insert({
        post_id: postId as string,
        author_id: userId,
        body: body.trim(),
      })
      .select(`
        id,
        body,
        created_at,
        author_id,
        author:profiles(id, name)
      `)
      .single()

    if (insertError) {
      return res.status(400).json({ error: insertError.message })
    }

    // Format response
    const formattedReply = {
      id: reply.id,
      body: reply.body,
      created_at: reply.created_at,
      author_name: getAuthorName(reply.author),
      author_id: reply.author_id,
    }

    res.status(201).json({ reply: formattedReply })
  } catch (error: any) {
    console.error('Create reply error:', error)
    res.status(500).json({ error: error.message || 'Failed to create reply' })
  }
}
