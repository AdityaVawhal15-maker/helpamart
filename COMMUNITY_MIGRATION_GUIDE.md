# Community System Migration Guide

## Overview

This guide explains how to apply the Community system migration to the production Supabase database. The migration creates three tables with proper RLS policies to enable a real, persistent multi-user community system.

## Tables Created

1. **community_posts** — Posts with title, body, category, author_id, likes_count
2. **community_replies** — Replies to posts, linked by post_id
3. **community_likes** — Like tracking (one like per user per post)

## Step 1: Apply Migration via Supabase SQL Editor

1. Go to https://app.supabase.com/project/hespppkftlslbcsizyur/sql/new
2. Create a new SQL query
3. Copy the entire content of: `supabase/migrations/20261011000000_community_posts_replies.sql`
4. Paste it into the SQL editor
5. Click **RUN**
6. Verify: All statements should execute successfully with no errors

## Step 2: Verify Tables Exist

After migration, run these verification queries:

```sql
-- Check community_posts table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'community_posts'
ORDER BY ordinal_position;

-- Check community_replies table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'community_replies'
ORDER BY ordinal_position;

-- Check community_likes table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'community_likes'
ORDER BY ordinal_position;
```

Expected: All three tables should exist with their columns.

## Step 3: Verify RLS Policies

Run this query to check policies:

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'community_%'
ORDER BY tablename, policyname;
```

Expected: 12 policies total:
- 4 policies for community_posts (read, create, update own, delete own)
- 4 policies for community_replies (read, create, update own, delete own)
- 4 policies for community_likes (read, create, delete own, and implied)

## Step 4: Test Insert with RLS

1. Go to https://app.supabase.com/project/hespppkftlslbcsizyur/editor
2. Select **community_posts** table
3. Verify:
   - You can see the table structure
   - Columns: id, author_id, category, title, body, likes_count, created_at, updated_at
   - All columns are correct types

## Step 5: Verify PostgREST Schema Cache

The migration runs `NOTIFY pgrst, 'reload schema';` to reload the PostgREST schema cache. To verify it worked:

1. Go to https://app.supabase.com/project/hespppkftlslbcsizyur/api/docs
2. In the API docs, search for: `community_posts`
3. You should see three endpoints:
   - GET /community_posts
   - POST /community_posts
   - (details endpoint)

If you don't see them, manually reload schema:

```sql
NOTIFY pgrst, 'reload schema';
```

Then wait 5 seconds and refresh the API docs.

## Step 6: Verify Deployment

After migration:

1. **Commit code**: `git add . && git commit -m "feat: add community system with Supabase persistence"`
2. **Push to main**: `git push origin main`
3. **Verify Vercel build**: Check https://vercel.com/dashboard — build should pass
4. **Test in production**: Go to https://helpamart.com/community
5. **Create a test post**: Open /community, click "Start a Discussion", fill form, click "Post to Community"
6. **Verify in Database**: Check https://app.supabase.com → Editor → community_posts table, verify row exists

## Troubleshooting

### Error: "Could not find the 'community_posts' column..."

**Cause**: Table hasn't been created yet.
**Fix**: Apply the migration (Step 1).

### Error: "permission denied for schema public"

**Cause**: Using wrong role (service_role needed for migration).
**Fix**: In Supabase SQL Editor, click the role dropdown and ensure you're running as service role (should be default).

### Error: "relation 'public.community_posts' does not exist"

**Cause**: Migration failed silently.
**Fix**: 
1. Check the migration query output for errors
2. Manually run individual CREATE TABLE statements
3. Check Supabase audit logs for details

### Error: RLS policies not enforcing

**Cause**: RLS might not be enabled or policies have issues.
**Fix**: Run verification query (Step 3) and check policies are listed. If not, re-apply the RLS section of the migration.

### API returns 404 for /api/community

**Cause**: Vercel didn't rebuild with new API routes.
**Fix**: 
1. Check Vercel deployment logs at https://vercel.com/dashboard
2. Re-deploy: `git push origin main`
3. Wait for build to complete
4. Test in production

## Performance Notes

The migration creates indexes on:
- `community_posts.author_id` — to find posts by author
- `community_posts.category` — to filter posts by category
- `community_posts.created_at DESC` — to order posts newest first
- Similar indexes for replies and likes

These ensure queries stay fast as data grows.

## Rollback (Emergency Only)

If you need to remove all community tables:

```sql
DROP TABLE IF EXISTS public.community_likes CASCADE;
DROP TABLE IF EXISTS public.community_replies CASCADE;
DROP TABLE IF EXISTS public.community_posts CASCADE;

-- Optional: Recreate if rolling back incorrectly applied migration
-- (Don't do this unless you have a specific reason)
```

⚠️ WARNING: This will permanently delete all community posts, replies, and likes data. Only do this if the migration was applied incorrectly.

## Success Criteria

✅ Migration applied successfully  
✅ All three tables exist  
✅ All RLS policies exist  
✅ PostgREST schema cache reloaded  
✅ Can see tables in Supabase Editor  
✅ Vercel build passes  
✅ Production site loads /community page  
✅ Can create a test post  
✅ Post appears in database  
✅ Refresh still shows post (persistence verified)
