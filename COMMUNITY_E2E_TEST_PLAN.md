# Community System End-to-End Test Plan

## Pre-Test Checklist

Before testing, ensure:

1. ✅ Migration applied to production Supabase (see COMMUNITY_MIGRATION_GUIDE.md)
2. ✅ `community_posts`, `community_replies`, `community_likes` tables exist
3. ✅ All RLS policies are active
4. ✅ Build passes: `npm run build` (zero TypeScript errors)
5. ✅ Vercel deployment successful: https://vercel.com/dashboard
6. ✅ Two test user accounts available (or ability to create them)

## Test Environment

- **Production URL**: https://helpamart.com
- **Test Path**: /community
- **Database**: Production Supabase (hespppkftlslbcsizyur)
- **API Routes**: Vercel Functions (api/community.ts, api/community/[id].ts, etc.)

---

## TEST A: Create Post (User A)

### Scenario
User A opens the community page and creates a post.

### Steps

1. **Open Community Page**
   - Navigate to: https://helpamart.com/community
   - Expected: Page loads with hero, category filters, empty feed (if first time)
   - ✅ Pass / ❌ Fail: ___

2. **Sign In (if needed)**
   - Click "Sign in to participate" button
   - Use test account credentials
   - Expected: Redirected back to /community as authenticated user
   - ✅ Pass / ❌ Fail: ___

3. **Start a Discussion**
   - Click "Start a Discussion" button (top left area)
   - Expected: Modal opens with title "Start a conversation"
   - ✅ Pass / ❌ Fail: ___

4. **Fill Form**
   - **Category**: Select "Tech"
   - **Topic/Title**: "How should I prepare for my first AI interview?"
   - **Details**: "I am a fresher aiming for an AI engineer role and have built several AI projects. What should I focus on?"
   - Expected: All fields fill without error
   - ✅ Pass / ❌ Fail: ___

5. **Validate Form State**
   - Verify "Post to Community" button is **enabled** (not grayed out)
   - Character counter shows correct length
   - Expected: No validation errors
   - ✅ Pass / ❌ Fail: ___

6. **Submit Post**
   - Click "Post to Community" button
   - Expected: 
     - Button shows "Posting…" with spinner
     - Modal closes after ~1-2 seconds
     - Success toast appears: "Posted to community!"
   - ✅ Pass / ❌ Fail: ___

7. **Verify Post Appears**
   - Post should appear at top of Community feed
   - Expected:
     - Title: "How should I prepare for my first AI interview?"
     - Category badge: "Tech" (with appropriate color)
     - Author: User A's name
     - Time: "just now"
     - Reply count: "0 replies"
     - Body preview visible
   - ✅ Pass / ❌ Fail: ___

8. **Check Browser Console**
   - Open DevTools → Console
   - Expected: No JavaScript errors
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — Post created and visible in feed
- ❌ **FAIL** — Post creation failed; see failure details below

**Failure Details** (if applicable):
- Error message from toast: ___
- Browser console error: ___
- Network request status: ___
- API response: ___

---

## TEST B: Refresh and Persistence (User A)

### Scenario
User A refreshes the page to verify the post persists in the database.

### Steps

1. **Refresh Page**
   - Press F5 or Cmd+R
   - Expected: Page reloads
   - ✅ Pass / ❌ Fail: ___

2. **Feed Reloads**
   - Expected:
     - Loading skeleton shows briefly
     - Post created in Test A appears at top
     - Author: User A
     - Title: "How should I prepare for my first AI interview?"
     - All details intact
   - ✅ Pass / ❌ Fail: ___

3. **Verify Database**
   - Go to: https://app.supabase.com/project/hespppkftlslbcsizyur/editor
   - Select: `community_posts` table
   - Expected:
     - One or more rows exist
     - Most recent row has:
       - `title`: "How should I prepare for my first AI interview?"
       - `category`: "Tech"
       - `author_id`: User A's UUID
       - `body`: Contains the details text
       - `likes_count`: 0
       - `created_at`: Recent timestamp
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — Post persists in database after refresh
- ❌ **FAIL** — Post disappeared; see details below

**Failure Details** (if applicable):
- Post visible after refresh: Yes / No
- Database row found: Yes / No
- Row contents: ___

---

## TEST C: Second User Sees Post (User B)

### Scenario
A different user (User B) opens the community page and sees the post created by User A.

### Steps

1. **Open New Browser / Incognito**
   - Open a new incognito/private window (to avoid cache)
   - Navigate to: https://helpamart.com/community
   - Expected: Page loads
   - ✅ Pass / ❌ Fail: ___

2. **Sign In as User B**
   - If needed, click "Sign in to participate"
   - Use different test account credentials
   - Expected: Authenticated as User B (different email/ID)
   - ✅ Pass / ❌ Fail: ___

3. **See User A's Post**
   - Expected:
     - Post from User A appears in feed
     - Title: "How should I prepare for my first AI interview?"
     - Author: User A's name (not "Me" or User B's name)
     - Category: "Tech"
     - Reply count: "0 replies"
   - ✅ Pass / ❌ Fail: ___

4. **Filter by Category**
   - Click "Tech" category pill
   - Expected:
     - Feed filters to show only Tech posts
     - User A's post is visible
   - ✅ Pass / ❌ Fail: ___

5. **Search for Post**
   - Click search box
   - Type: "AI interview"
   - Press Enter
   - Expected:
     - Feed shows only posts matching search
     - User A's post appears
     - Search result indicator: "Showing results for 'AI interview'"
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — User B sees User A's post (multi-user visibility)
- ❌ **FAIL** — User B cannot see post; see details below

**Failure Details** (if applicable):
- Post visible to User B: Yes / No
- Category filter working: Yes / No
- Search working: Yes / No
- API endpoint issue: ___

---

## TEST D: Reply to Post (User B)

### Scenario
User B opens the post and replies to it.

### Steps

1. **Open Post Detail**
   - Click on User A's post (click "Open" link or title)
   - Expected: 
     - Page navigates to `/community/[postId]`
     - Full post displayed with title, body, author, category
     - Reply count shown (should be 0 initially)
     - Reply input field visible
   - ✅ Pass / ❌ Fail: ___

2. **Type Reply**
   - Click reply input field: "Write a reply..."
   - Type: "Great question! Focus on Python, ML fundamentals, and practice explaining your projects clearly. You already have good foundation with AI projects—now focus on communication."
   - Expected: Text appears in input field
   - ✅ Pass / ❌ Fail: ___

3. **Submit Reply**
   - Click "Reply" button
   - Expected:
     - Button shows spinner
     - Reply appears immediately below post
     - Reply author: User B's name
     - Reply text visible
     - Input field clears
     - Success toast (optional)
   - ✅ Pass / ❌ Fail: ___

4. **Verify Reply Count Updated**
   - Expected: Post header now shows "1 replies" (changed from 0)
   - ✅ Pass / ❌ Fail: ___

5. **Check Database**
   - Go to: https://app.supabase.com/project/hespppkftlslbcsizyur/editor
   - Select: `community_replies` table
   - Expected:
     - New row exists with:
       - `post_id`: User A's post ID
       - `author_id`: User B's UUID
       - `body`: Contains reply text
       - `created_at`: Recent timestamp
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — Reply created and visible
- ❌ **FAIL** — Reply creation failed; see details below

**Failure Details** (if applicable):
- Reply submitted successfully: Yes / No
- Reply visible immediately: Yes / No
- Database row created: Yes / No
- Error message: ___

---

## TEST E: User A Sees Reply (User A)

### Scenario
User A sees the reply that User B just created, without needing to refresh (Realtime) or after refreshing.

### Steps

1. **Go Back to Post (User A Browser)**
   - In User A's browser, keep community open or navigate back to post
   - If Realtime enabled: Reply should appear automatically
   - If not: Refresh page

2. **View Updated Post**
   - Expected:
     - Reply count updated: "1 replies"
     - Reply visible from User B
     - Reply body: "Great question! Focus on Python..."
     - Reply author: User B's name
     - Timestamp: Recent
   - ✅ Pass / ❌ Fail: ___

3. **Refresh to Verify**
   - Press F5 to refresh
   - Expected: Reply still visible and persisted
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — User A sees User B's reply
- ❌ **FAIL** — Reply not visible; see details below

**Failure Details** (if applicable):
- Reply visible without refresh: Yes / No
- Reply visible after refresh: Yes / No
- Reply count correct: Yes / No

---

## TEST F: Like Post (User B)

### Scenario
User B likes User A's post.

### Steps

1. **Like Post**
   - In User B's browser, still on post detail page
   - Click heart icon in post footer
   - Expected:
     - Heart fills with color (maroon/red)
     - Like count increments (0 → 1)
     - Button shows loading state briefly
   - ✅ Pass / ❌ Fail: ___

2. **Unlike Post**
   - Click heart icon again
   - Expected:
     - Heart returns to outline
     - Like count decrements (1 → 0)
   - ✅ Pass / ❌ Fail: ___

3. **Like Again**
   - Click heart icon once more
   - Expected:
     - Heart fills
     - Like count shows 1
   - ✅ Pass / ❌ Fail: ___

4. **Check Database**
   - Go to: https://app.supabase.com/project/hespppkftlslbcsizyur/editor
   - Select: `community_likes` table
   - Expected:
     - One row with:
       - `post_id`: User A's post ID
       - `user_id`: User B's UUID
       - `created_at`: Recent timestamp
   - ✅ Pass / ❌ Fail: ___

5. **Verify Like Count on Post**
   - Check `community_posts` table
   - Row for User A's post should have:
     - `likes_count`: 1
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — Like/unlike working correctly
- ❌ **FAIL** — Like functionality broken; see details below

**Failure Details** (if applicable):
- Like button clickable: Yes / No
- Like count updated: Yes / No
- Unlike working: Yes / No
- Database row created: Yes / No

---

## TEST G: Security — Cannot Modify Other User's Post

### Scenario
User B cannot modify or delete User A's post (RLS enforcement).

### Steps

1. **Attempt Direct Update (Advanced)**
   - Open DevTools → Console
   - Run (for reference only; should fail):
     ```javascript
     // This simulates what the database should reject
     fetch('/api/community/' + postId, {
       method: 'PUT',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ title: 'Hacked!' })
     })
     .then(r => r.json())
     .then(d => console.log(d))
     ```
   - Expected: 403 Forbidden or similar error
   - ✅ Pass / ❌ Fail: ___

2. **Verify UI Constraints**
   - In User B's browser, view User A's post detail
   - Expected:
     - No edit button visible for User A's post
     - No delete button visible
     - Only reply button available
   - ✅ Pass / ❌ Fail: ___

3. **Check RLS in Database**
   - Go to: https://app.supabase.com/project/hespppkftlslbcsizyur/sql/new
   - Run:
     ```sql
     SELECT policyname, roles, qual
     FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'community_posts'
     ORDER BY policyname;
     ```
   - Expected:
     - Policies listed:
       - `community_posts_read_all` (SELECT) — allows all
       - `community_posts_create` (INSERT) — checks `auth.uid() = author_id`
       - `community_posts_update_own` (UPDATE) — checks `auth.uid() = author_id`
       - `community_posts_delete_own` (DELETE) — checks `auth.uid() = author_id`
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — RLS preventing unauthorized modifications
- ❌ **FAIL** — Security issue; see details below

**Failure Details** (if applicable):
- RLS policies enforced: Yes / No
- User B able to modify User A's post: Yes / No (should be No)
- Policies exist in database: Yes / No

---

## TEST H: Community Stats

### Scenario
Community statistics are accurate and update correctly.

### Steps

1. **View Stats Block**
   - On community home page, look at stats box (left sidebar)
   - Expected: Shows three numbers:
     - People learning: N+
     - Conversations: 1+
     - Replies shared: 1+
   - ✅ Pass / ❌ Fail: ___

2. **Verify Stats Values**
   - Expected:
     - Post count: At least 1 (from Test A)
     - Reply count: At least 1 (from Test D)
     - User count: At least 2 (User A + User B)
   - ✅ Pass / ChecK: ___

3. **Test API Endpoint**
   - In DevTools Console, run:
     ```javascript
     fetch('/api/community/stats', {
       headers: { 'Authorization': 'Bearer ' + (await supabase.auth.getSession()).data.session.access_token }
     })
     .then(r => r.json())
     .then(d => console.log(d))
     ```
   - Expected response:
     ```json
     {
       "postCount": 1,
       "replyCount": 1,
       "userCount": 2
     }
     ```
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — Stats accurate and updating
- ❌ **FAIL** — Stats incorrect or not loading; see details below

**Failure Details** (if applicable):
- Stats visible: Yes / No
- Stats values accurate: Yes / No
- API endpoint working: Yes / No

---

## TEST I: Error Handling

### Scenario
Application handles errors gracefully.

### Steps

1. **Post Validation Error**
   - Open "Start a Discussion" modal
   - Leave title empty
   - Try to click "Post to Community"
   - Expected:
     - Button disabled (grayed out)
     - Or validation error: "Please fill in both the title and details."
   - ✅ Pass / ❌ Fail: ___

2. **Network Error (Simulate)**
   - In DevTools, go to Network tab
   - Check "Offline" to simulate network failure
   - Try to create a post
   - Expected:
     - Error toast appears
     - Error message indicates network/connection issue
     - Page doesn't crash
   - ✅ Pass / ❌ Fail: ___

3. **Invalid Post ID**
   - Manually navigate to: https://helpamart.com/community/invalid-uuid
   - Expected:
     - Error state: "Discussion not found."
     - Back link to community available
     - No JavaScript errors in console
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — Error handling working
- ❌ **FAIL** — Errors not handled gracefully; see details below

**Failure Details** (if applicable):
- Validation working: Yes / No
- Network error message clear: Yes / No
- Invalid post handled: Yes / No

---

## TEST J: Performance & Responsiveness

### Scenario
Application performs well and responds quickly.

### Steps

1. **Page Load Time**
   - Open DevTools → Performance tab
   - Reload /community
   - Expected: Page interactive within 2-3 seconds
   - Measure: Largest Contentful Paint < 3s
   - ✅ Pass / ❌ Fail: ___

2. **Feed Rendering**
   - With 5+ posts visible, scroll through feed
   - Expected: Smooth scrolling, no janky animations
   - ✅ Pass / ❌ Fail: ___

3. **Modal Opening**
   - Click "Start a Discussion"
   - Expected: Modal opens smoothly (< 300ms)
   - ✅ Pass / ChecK: ___

4. **API Response Time**
   - Check Network tab while creating post
   - Expected: POST /api/community request < 2 seconds
   - ✅ Pass / ❌ Fail: ___

### Result
- ✅ **PASS** — Performance acceptable
- ❌ **FAIL** — Performance issues; see details below

**Failure Details** (if applicable):
- Page load time: ___ ms
- Largest Contentful Paint: ___ ms
- Scroll performance: Smooth / Janky
- API response time: ___ ms

---

## Summary

### Overall Test Result

| Test | Result | Notes |
|------|--------|-------|
| A. Create Post | ✅ / ❌ | |
| B. Refresh & Persistence | ✅ / ❌ | |
| C. Second User Sees Post | ✅ / ❌ | |
| D. Reply to Post | ✅ / ❌ | |
| E. User A Sees Reply | ✅ / ❌ | |
| F. Like Post | ✅ / ❌ | |
| G. Security (RLS) | ✅ / ❌ | |
| H. Community Stats | ✅ / ❌ | |
| I. Error Handling | ✅ / ❌ | |
| J. Performance | ✅ / ❌ | |

### Overall Status

- ✅ **ALL PASS** — Community system fully functional
- ⚠️ **PARTIAL** — Some features working; see failures above
- ❌ **FAILED** — Critical issues; system not ready for production

### Issues Found

1. Issue: ___
   - Severity: Critical / Major / Minor
   - Fix: ___

2. Issue: ___
   - Severity: Critical / Major / Minor
   - Fix: ___

### Sign-Off

- **Tester Name**: ___
- **Date**: ___
- **Time Spent**: ___
- **Approved for Production**: Yes / No / Conditional

### Notes

___

---

## Rollback Plan (if needed)

If testing reveals critical issues:

1. Stop Vercel deployment
2. Revert commits on main branch
3. Drop community tables (if data integrity compromised):
   ```sql
   DROP TABLE IF EXISTS public.community_likes CASCADE;
   DROP TABLE IF EXISTS public.community_replies CASCADE;
   DROP TABLE IF EXISTS public.community_posts CASCADE;
   ```
4. Redeploy previous version
5. Investigate root cause
6. Fix and re-test
