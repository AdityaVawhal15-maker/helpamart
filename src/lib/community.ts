/**
 * Direct Supabase Community API
 * =============================
 *
 * Community feature uses DIRECT Supabase calls (no Vercel API dependency).
 * Security comes from Supabase RLS policies, not API middleware.
 *
 * Tables:
 * - public.community_posts (id, author_id, category, title, body, likes_count, created_at, updated_at)
 * - public.community_replies (id, post_id, author_id, body, created_at, updated_at)
 * - public.community_likes (id, post_id, user_id, created_at) - UNIQUE(post_id, user_id)
 */

import { supabase } from './supabase'

export type CommunityPost = {
  id: string
  title: string
  body: string
  category: string
  author_id: string
  author_name: string
  likes_count: number
  created_at: string
  updated_at: string
  replyCount: number
  likedByMe: boolean
}

export type CommunityReply = {
  id: string
  post_id: string
  author_id: string
  author_name: string
  body: string
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────────────────────────
// GET Community Posts (Feed)
// ─────────────────────────────────────────────────────────────────

export async function getCommunityPosts(options?: {
  category?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ posts: CommunityPost[]; total: number }> {
  const { category, search, limit = 20, offset = 0 } = options || {}

  try {
    // Get current user for like checking
    const { data: { session } } = await supabase.auth.getSession()
    const currentUserId = session?.user?.id

    let query = supabase
      .from('community_posts')
      .select(
        `id, title, body, category, author_id, likes_count, created_at, updated_at,
         author:profiles(id, full_name, avatar_url),
         replies:community_replies(id)`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // Filter by category
    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    // Filter by search
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`
      query = query.or(`title.ilike.${searchTerm},body.ilike.${searchTerm}`)
    }

    const { data: posts, error, count } = await query

    if (error) throw error

    // Check user's liked posts
    let likedPostIds: string[] = []
    if (currentUserId && posts && posts.length > 0) {
      const postIds = posts.map(p => p.id)
      const { data: likes, error: likesError } = await supabase
        .from('community_likes')
        .select('post_id')
        .eq('user_id', currentUserId)
        .in('post_id', postIds)

      if (!likesError && likes) {
        likedPostIds = likes.map(l => l.post_id)
      }
    }

    // Format response
    const formattedPosts: CommunityPost[] = (posts || []).map((post: any) => ({
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      author_id: post.author_id,
      author_name: (post.author && post.author[0]?.full_name) || 'Community Member',
      likes_count: post.likes_count || 0,
      created_at: post.created_at,
      updated_at: post.updated_at,
      replyCount: post.replies?.length || 0,
      likedByMe: likedPostIds.includes(post.id),
    }))

    return { posts: formattedPosts, total: count || 0 }
  } catch (err) {
    console.error('[Community] getCommunityPosts error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// GET Single Community Post
// ─────────────────────────────────────────────────────────────────

export async function getCommunityPost(postId: string): Promise<CommunityPost | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const currentUserId = session?.user?.id

    const { data: post, error } = await supabase
      .from('community_posts')
      .select(
        `id, title, body, category, author_id, likes_count, created_at, updated_at,
         author:profiles(id, full_name, avatar_url)`
      )
      .eq('id', postId)
      .single()

    if (error) throw error
    if (!post) return null

    // Check if user liked this post
    let likedByMe = false
    if (currentUserId) {
      const { data: likes } = await supabase
        .from('community_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserId)
        .limit(1)

      likedByMe = !!likes && likes.length > 0
    }

    // Get reply count
    const { count: replyCount } = await supabase
      .from('community_replies')
      .select('id', { count: 'exact' })
      .eq('post_id', postId)

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      author_id: post.author_id,
      author_name: (post.author && post.author[0]?.full_name) || 'Community Member',
      likes_count: post.likes_count || 0,
      created_at: post.created_at,
      updated_at: post.updated_at,
      replyCount: replyCount || 0,
      likedByMe,
    }
  } catch (err) {
    console.error('[Community] getCommunityPost error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// CREATE Community Post
// ─────────────────────────────────────────────────────────────────

export async function createCommunityPost(input: {
  category: string
  title: string
  body: string
}): Promise<CommunityPost> {
  try {
    // Get current user
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated. Please sign in first.')
    }

    const userId = session.user.id

    // Validate input
    if (!input.category?.trim()) throw new Error('Category is required')
    if (!input.title?.trim()) throw new Error('Title is required')
    if (!input.body?.trim()) throw new Error('Body is required')

    // Insert post (RLS ensures author_id = current user)
    const { data: post, error } = await supabase
      .from('community_posts')
      .insert({
        author_id: userId,
        category: input.category.trim(),
        title: input.title.trim(),
        body: input.body.trim(),
        likes_count: 0,
      })
      .select(`id, title, body, category, author_id, likes_count, created_at, updated_at,
               author:profiles(id, full_name, avatar_url)`)
      .single()

    if (error) throw error

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      author_id: post.author_id,
      author_name: (post.author && post.author[0]?.full_name) || 'Community Member',
      likes_count: 0,
      created_at: post.created_at,
      updated_at: post.updated_at,
      replyCount: 0,
      likedByMe: false,
    }
  } catch (err) {
    console.error('[Community] createCommunityPost error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE Community Post (own posts only, enforced by RLS)
// ─────────────────────────────────────────────────────────────────

export async function updateCommunityPost(
  postId: string,
  input: { category?: string; title?: string; body?: string }
): Promise<CommunityPost> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // RLS will ensure only the author can update
    const { data: post, error } = await supabase
      .from('community_posts')
      .update({
        ...(input.category && { category: input.category.trim() }),
        ...(input.title && { title: input.title.trim() }),
        ...(input.body && { body: input.body.trim() }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', postId)
      .select(`id, title, body, category, author_id, likes_count, created_at, updated_at,
               author:profiles(id, full_name, avatar_url)`)
      .single()

    if (error) throw error

    // Get reply count
    const { count: replyCount } = await supabase
      .from('community_replies')
      .select('id', { count: 'exact' })
      .eq('post_id', postId)

    return {
      id: post.id,
      title: post.title,
      body: post.body,
      category: post.category,
      author_id: post.author_id,
      author_name: (post.author && post.author[0]?.full_name) || 'Community Member',
      likes_count: post.likes_count || 0,
      created_at: post.created_at,
      updated_at: post.updated_at,
      replyCount: replyCount || 0,
      likedByMe: false,
    }
  } catch (err) {
    console.error('[Community] updateCommunityPost error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE Community Post (own posts only, enforced by RLS)
// ─────────────────────────────────────────────────────────────────

export async function deleteCommunityPost(postId: string): Promise<void> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    // RLS will ensure only the author can delete
    const { error } = await supabase
      .from('community_posts')
      .delete()
      .eq('id', postId)

    if (error) throw error
  } catch (err) {
    console.error('[Community] deleteCommunityPost error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// GET Community Replies for a Post
// ─────────────────────────────────────────────────────────────────

export async function getCommunityReplies(postId: string): Promise<CommunityReply[]> {
  try {
    const { data: replies, error } = await supabase
      .from('community_replies')
      .select(`id, post_id, author_id, body, created_at, updated_at,
               author:profiles(id, full_name, avatar_url)`)
      .eq('post_id', postId)
      .order('created_at', { ascending: true })

    if (error) throw error

    return (replies || []).map((reply: any) => ({
      id: reply.id,
      post_id: reply.post_id,
      author_id: reply.author_id,
      author_name: (reply.author && reply.author[0]?.full_name) || 'Community Member',
      body: reply.body,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
    }))
  } catch (err) {
    console.error('[Community] getCommunityReplies error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// CREATE Community Reply
// ─────────────────────────────────────────────────────────────────

export async function createCommunityReply(
  postId: string,
  body: string
): Promise<CommunityReply> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    if (!body?.trim()) throw new Error('Reply cannot be empty')

    // Insert reply (RLS ensures author_id = current user)
    const { data: reply, error } = await supabase
      .from('community_replies')
      .insert({
        post_id: postId,
        author_id: session.user.id,
        body: body.trim(),
      })
      .select(`id, post_id, author_id, body, created_at, updated_at,
               author:profiles(id, full_name, avatar_url)`)
      .single()

    if (error) throw error

    return {
      id: reply.id,
      post_id: reply.post_id,
      author_id: reply.author_id,
      author_name: (reply.author && reply.author[0]?.full_name) || 'Community Member',
      body: reply.body,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
    }
  } catch (err) {
    console.error('[Community] createCommunityReply error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// UPDATE Community Reply (own replies only)
// ─────────────────────────────────────────────────────────────────

export async function updateCommunityReply(
  replyId: string,
  body: string
): Promise<CommunityReply> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    if (!body?.trim()) throw new Error('Reply cannot be empty')

    const { data: reply, error } = await supabase
      .from('community_replies')
      .update({
        body: body.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', replyId)
      .select(`id, post_id, author_id, body, created_at, updated_at,
               author:profiles(id, full_name, avatar_url)`)
      .single()

    if (error) throw error

    return {
      id: reply.id,
      post_id: reply.post_id,
      author_id: reply.author_id,
      author_name: (reply.author && reply.author[0]?.full_name) || 'Community Member',
      body: reply.body,
      created_at: reply.created_at,
      updated_at: reply.updated_at,
    }
  } catch (err) {
    console.error('[Community] updateCommunityReply error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// DELETE Community Reply (own replies only)
// ─────────────────────────────────────────────────────────────────

export async function deleteCommunityReply(replyId: string): Promise<void> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const { error } = await supabase
      .from('community_replies')
      .delete()
      .eq('id', replyId)

    if (error) throw error
  } catch (err) {
    console.error('[Community] deleteCommunityReply error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// TOGGLE Community Like
// ─────────────────────────────────────────────────────────────────

export async function toggleCommunityLike(postId: string): Promise<boolean> {
  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session?.user?.id) {
      throw new Error('Not authenticated')
    }

    const userId = session.user.id

    // Check if already liked
    const { data: existing, error: checkError } = await supabase
      .from('community_likes')
      .select('id')
      .eq('post_id', postId)
      .eq('user_id', userId)
      .limit(1)

    if (checkError) throw checkError

    if (existing && existing.length > 0) {
      // Unlike
      const { error: deleteError } = await supabase
        .from('community_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId)

      if (deleteError) throw deleteError
      return false // Now unliked
    } else {
      // Like
      const { error: insertError } = await supabase
        .from('community_likes')
        .insert({
          post_id: postId,
          user_id: userId,
        })

      if (insertError) throw insertError
      return true // Now liked
    }
  } catch (err) {
    console.error('[Community] toggleCommunityLike error:', err)
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// GET Community Stats
// ─────────────────────────────────────────────────────────────────

export async function getCommunityStats(): Promise<{
  postCount: number
  replyCount: number
  userCount: number
}> {
  try {
    const { count: postCount } = await supabase
      .from('community_posts')
      .select('id', { count: 'exact' })

    const { count: replyCount } = await supabase
      .from('community_replies')
      .select('id', { count: 'exact' })

    // Get unique authors
    const { data: uniqueAuthors } = await supabase
      .from('community_posts')
      .select('author_id')

    const userCount = new Set(uniqueAuthors?.map(p => p.author_id) || []).size

    return {
      postCount: postCount || 0,
      replyCount: replyCount || 0,
      userCount,
    }
  } catch (err) {
    console.error('[Community] getCommunityStats error:', err)
    // Return defaults on error instead of throwing
    return { postCount: 0, replyCount: 0, userCount: 0 }
  }
}
