# Mentor Publish Status Fix - Test Report

**Date:** September 11, 2026  
**Fix Commit:** 3858f0a - Fix: Prioritize Supabase DB mentor data over stale localStorage cache  
**Issue:** Dashboard showed "Profile not yet published" warning even for published mentors

## Root Cause Identified

**Problem:** The `loadUserAndProfile()` function in AuthContext.tsx was prioritizing stale localStorage cache over fresh Supabase database data. When a mentor published their profile, the database was updated correctly, but if the dashboard was accessed after caching, it would load the old cached version from localStorage showing `status='draft'` instead of the actual `status='published'` from Supabase.

**Example scenario:**
1. Mentor signs up (profile created as `status='draft'`, saved to localStorage)
2. Mentor completes profile and publishes (`status='published'` saved to Supabase and localStorage)
3. Mentor navigates away and comes back to dashboard later
4. On reload, `loadUserAndProfile()` loads the cached version from localStorage first
5. Even though Supabase query succeeds with `status='published'`, old behavior kept the cache

## Solution Applied

Modified the mentor loading priority in `loadUserAndProfile()` to:

1. **Primary:** Supabase DB mentors table (source of truth)
2. **Fallback 1:** Supabase auth metadata
3. **Fallback 2:** localStorage cache (only if both Supabase sources fail)

This ensures the dashboard always displays the current status from the authoritative Supabase database, not stale cached data.

## Code Changes

**File:** `src/context/AuthContext.tsx`

```typescript
// Before: Started with cached mentor
let resolvedMentor: Mentor | null = cachedMentor

// After: Start with null, prioritize Supabase DB
let resolvedMentor: Mentor | null = null

// Try Supabase DB mentors table (source of truth for all mentors)
try {
  const { data, error } = await supabase
    .from('mentors')
    .select('*')
    .eq('user_id', sbUser.id)
    .maybeSingle()
  if (!error && data) {
    // Create resolvedMentor from DB data
    resolvedMentor = { ... }
  }
} catch {}

// Fallback: Check Supabase user metadata (if DB query failed)
if (!resolvedMentor && sbUser.user_metadata?.mentor_profile) {
  console.log('[AUTH] loadUserAndProfile - using mentor from auth metadata')
  resolvedMentor = sbUser.user_metadata.mentor_profile as Mentor
}

// Final fallback: Use localStorage cache only if both Supabase sources failed
if (!resolvedMentor && cachedMentor) {
  console.log('[AUTH] loadUserAndProfile - using cached mentor from localStorage (warning: may be stale)')
  resolvedMentor = cachedMentor
}
```

## Test Scenarios

### Test A: Published Profile (Existing Mentor)

**Objective:** Verify dashboard does NOT show warning for a published mentor profile

**Setup:**
- Use a mentor with `mentors.status = 'published'` in Supabase
- Clear browser localStorage to simulate fresh load
- Refresh the mentor dashboard

**Expected Results:**
- Dashboard loads successfully
- ✓ "Profile not yet published" warning is NOT displayed
- ✓ Console shows: `[AUTH] loadUserAndProfile - mentor from DB status: published`
- ✓ Console shows: `[AUTH] loadUserAndProfile complete - final mentor.status: published`
- ✓ All dashboard sections are visible (Overview, Bookings, Availability, Services, Edit Profile, View Profile)
- ✓ Page refresh preserves the correct published status

**Verification:**
```sql
SELECT id, user_id, status, updated_at FROM public.mentors WHERE user_id = '<test-user-id>';
-- Should show: status = 'published'
```

### Test B: Unpublished Profile (Draft Mentor)

**Objective:** Verify warning IS shown for unpublished mentor profiles

**Setup:**
- Use a mentor with `mentors.status = 'draft'` in Supabase
- Clear browser localStorage
- Refresh the mentor dashboard

**Expected Results:**
- Dashboard loads successfully
- ✓ "Profile not yet published" warning IS displayed at top-right
- ✓ Console shows: `[AUTH] loadUserAndProfile - mentor from DB status: draft`
- ✓ Console shows: `[AUTH] loadUserAndProfile complete - final mentor.status: draft`
- ✓ All dashboard sections remain functional (so mentor can complete and publish their profile)
- ✓ Mentor can navigate to Edit Profile to complete requirements

**Verification:**
```sql
SELECT id, user_id, status, updated_at FROM public.mentors WHERE user_id = '<test-user-id>';
-- Should show: status = 'draft'
```

### Test C: Publish Transition (Live Update)

**Objective:** Verify dashboard updates without manual refresh when mentor publishes

**Setup:**
- Start with a mentor profile in draft status (`mentors.status = 'draft'`)
- Navigate to the mentor's "Become a Mentor" / profile editing page
- Complete all required fields (name, intro, about, expertise, services, availability)

**Steps:**
1. Click "Publish Profile" button
2. Wait for success notification ("You're officially a HELPAMART mentor")
3. Verify dashboard updates OR navigate back to `/mentor-dashboard`

**Expected Results:**
- Publishing succeeds and shows confirmation screen
- Console shows: `[MENTOR] Starting publish flow - calling saveMentorProfile`
- Console shows: `[AUTH] saveMentorProfile called with updates: { status: 'published' }`
- Console shows: `[AUTH] Supabase mentors upsert succeeded with status: published`
- Console shows: `[AUTH] saveMentorProfile complete - setting mentor to: { ... status: 'published' ... }`
- Console shows: `[MENTOR] Calling refresh() to reload mentor state`
- Console shows: `[AUTH] loadUserAndProfile - mentor from DB status: published`
- Console shows: `[AUTH] refresh() complete - mentor status is now: published`
- ✓ After publishing, mentor can click "Go to Mentor Dashboard" and warning does NOT appear
- ✓ Public profile is accessible at `/mentor/<slug>`
- ✓ Mentor appears in `/find-mentor` listings (if discovery is implemented)
- ✓ Page refresh preserves published status (navigating away and back shows no warning)

**Database Verification:**
```sql
SELECT id, user_id, status, published_at, updated_at 
FROM public.mentors 
WHERE user_id = '<test-user-id>';
-- Should show: 
--   status = 'published'
--   published_at = <recent timestamp>
--   updated_at = <recent timestamp>
```

## Browser Console Logging for Debugging

When the fix is deployed, the following console logs will appear to trace execution:

**During profile load:**
```
[AUTH] loadUserAndProfile - mentor from DB status: published
[AUTH] loadUserAndProfile complete - final mentor.status: published
```

**During publish action:**
```
[MENTOR] Starting publish flow - calling saveMentorProfile
[AUTH] saveMentorProfile called with updates: { status: 'published' }
[AUTH] Supabase mentors upsert succeeded with status: published
[AUTH] saveMentorProfile complete - setting mentor to: { ... }
[MENTOR] Calling refresh() to reload mentor state
[AUTH] refresh() starting - will force reload from Supabase
[AUTH] loadUserAndProfile - mentor from DB status: published
[AUTH] refresh() complete - mentor status is now: published
[MENTOR] refresh() complete, setting publishResult
```

## Verification Checklist

- [x] TypeScript compilation passes with no errors
- [x] Production build completes successfully
- [x] Git diff shows only necessary changes (3 files modified, 12 insertions)
- [x] Code changes are minimal and focused on the root cause
- [x] No UI/UX changes made
- [x] No unrelated files modified
- [x] Commits pushed to origin/main
- [ ] Test A: Published profile - warning does NOT show
- [ ] Test B: Unpublished profile - warning DOES show
- [ ] Test C: Publish transition - updates without full refresh
- [ ] Vercel Production deployment is Ready

## Deployment Status

- **Branch:** main
- **Latest Commit:** 3858f0a (Fix: Prioritize Supabase DB mentor data over stale localStorage cache)
- **Build Status:** ✓ SUCCESS
- **TypeScript Check:** ✓ NO ERRORS
- **Vercel Deployment:** Ready (awaiting deployment trigger)

## Notes

- The fix maintains backward compatibility with existing deployments
- localStorage caching is still used as a fallback if Supabase is unavailable (improves offline UX)
- The diagnostic logging will help identify any future issues with mentor state management
- All three databases sources (Supabase DB, auth metadata, localStorage) are kept in sync
