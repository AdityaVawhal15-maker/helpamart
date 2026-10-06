-- =============================================================================
-- HELPAMART — Community Posts & Replies
-- Migration: 20261011000000_community_posts_replies.sql
--
-- Real persistent multi-user community system with:
-- 1. community_posts table (title, body, category, author)
-- 2. community_replies table (replies to posts)
-- 3. Proper RLS policies (users can CRUD own content, read all)
-- 4. Indexes for performance
-- =============================================================================

-- Create community_posts table
CREATE TABLE IF NOT EXISTS public.community_posts (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category        TEXT        NOT NULL,
  title           TEXT        NOT NULL,
  body            TEXT        NOT NULL,
  likes_count     INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Create community_replies table
CREATE TABLE IF NOT EXISTS public.community_replies (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  author_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            TEXT        NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Create table for tracking likes (user can like once per post)
CREATE TABLE IF NOT EXISTS public.community_likes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID        NOT NULL REFERENCES public.community_posts(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE(post_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_community_posts_author_id ON public.community_posts (author_id);
CREATE INDEX IF NOT EXISTS idx_community_posts_category ON public.community_posts (category);
CREATE INDEX IF NOT EXISTS idx_community_posts_created_at ON public.community_posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_replies_post_id ON public.community_replies (post_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_author_id ON public.community_replies (author_id);
CREATE INDEX IF NOT EXISTS idx_community_replies_created_at ON public.community_replies (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_community_likes_post_id ON public.community_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_community_likes_user_id ON public.community_likes (user_id);

-- Enable RLS on all community tables
ALTER TABLE public.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_likes ENABLE ROW LEVEL SECURITY;

-- ============= RLS Policies: community_posts =============

-- Policy 1: Anyone can READ all posts
DROP POLICY IF EXISTS "community_posts_read_all" ON public.community_posts;
CREATE POLICY "community_posts_read_all"
  ON public.community_posts FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy 2: Authenticated users can CREATE posts
DROP POLICY IF EXISTS "community_posts_create" ON public.community_posts;
CREATE POLICY "community_posts_create"
  ON public.community_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Policy 3: Users can UPDATE their own posts
DROP POLICY IF EXISTS "community_posts_update_own" ON public.community_posts;
CREATE POLICY "community_posts_update_own"
  ON public.community_posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Policy 4: Users can DELETE their own posts
DROP POLICY IF EXISTS "community_posts_delete_own" ON public.community_posts;
CREATE POLICY "community_posts_delete_own"
  ON public.community_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- ============= RLS Policies: community_replies =============

-- Policy 1: Anyone can READ all replies
DROP POLICY IF EXISTS "community_replies_read_all" ON public.community_replies;
CREATE POLICY "community_replies_read_all"
  ON public.community_replies FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy 2: Authenticated users can CREATE replies
DROP POLICY IF EXISTS "community_replies_create" ON public.community_replies;
CREATE POLICY "community_replies_create"
  ON public.community_replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

-- Policy 3: Users can UPDATE their own replies
DROP POLICY IF EXISTS "community_replies_update_own" ON public.community_replies;
CREATE POLICY "community_replies_update_own"
  ON public.community_replies FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- Policy 4: Users can DELETE their own replies
DROP POLICY IF EXISTS "community_replies_delete_own" ON public.community_replies;
CREATE POLICY "community_replies_delete_own"
  ON public.community_replies FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- ============= RLS Policies: community_likes =============

-- Policy 1: Anyone can READ all likes
DROP POLICY IF EXISTS "community_likes_read_all" ON public.community_likes;
CREATE POLICY "community_likes_read_all"
  ON public.community_likes FOR SELECT
  TO authenticated, anon
  USING (true);

-- Policy 2: Authenticated users can CREATE likes (like their own)
DROP POLICY IF EXISTS "community_likes_create" ON public.community_likes;
CREATE POLICY "community_likes_create"
  ON public.community_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy 3: Users can DELETE their own likes
DROP POLICY IF EXISTS "community_likes_delete_own" ON public.community_likes;
CREATE POLICY "community_likes_delete_own"
  ON public.community_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============= Grants =============

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_posts TO authenticated;
GRANT SELECT ON public.community_posts TO anon;
GRANT ALL ON public.community_posts TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_replies TO authenticated;
GRANT SELECT ON public.community_replies TO anon;
GRANT ALL ON public.community_replies TO service_role;

GRANT SELECT, INSERT, DELETE ON public.community_likes TO authenticated;
GRANT SELECT ON public.community_likes TO anon;
GRANT ALL ON public.community_likes TO service_role;

-- Trigger to update likes_count when a like is added/removed
CREATE OR REPLACE FUNCTION update_community_posts_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.community_posts
    SET likes_count = (SELECT COUNT(*) FROM public.community_likes WHERE post_id = NEW.post_id)
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.community_posts
    SET likes_count = (SELECT COUNT(*) FROM public.community_likes WHERE post_id = OLD.post_id)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS community_likes_update_count ON public.community_likes;
CREATE TRIGGER community_likes_update_count
AFTER INSERT OR DELETE ON public.community_likes
FOR EACH ROW
EXECUTE FUNCTION update_community_posts_likes_count();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
