# Testing Plan: Live Dashboard Statistics

## Overview
This document outlines comprehensive testing for the live mentor dashboard statistics implementation.

## Features Implemented
1. **Profile Views Tracking** - Track unique mentor profile visitors (1 per visitor per hour per mentor)
2. **Session Completion Marking** - Mentors manually mark sessions complete after they end
3. **Dashboard Statistics** - Live, accurate counts for upcoming sessions, completed sessions, and profile views
4. **Realtime Updates** - Dashboard updates without manual refresh when bookings/views change
5. **Profile Visitors Display** - Show recent profile visitors with names/avatars and timestamps

---

## Test Scenarios

### 1. Profile Views Tracking

#### Test 1.1: Anonymous Visitor Profile View
**Steps:**
1. Open incognito/private browser window
2. Navigate to `/mentor/[slug]` for any published mentor profile
3. Observe console logs for `recordProfileView` call

**Expected Result:**
- Profile view is recorded in `profile_views` table
- Entry has `visitor_id = NULL` (anonymous)
- Entry has `visitor_name = NULL`
- `mentors.profile_view_count` increases by 1

#### Test 1.2: Authenticated Visitor Profile View
**Steps:**
1. Log in as any authenticated user
2. Navigate to `/mentor/[slug]` for a different mentor's profile
3. Observe console logs

**Expected Result:**
- Profile view is recorded in `profile_views` table
- Entry has `visitor_id = [user_id]` (authenticated user)
- Entry has `visitor_name = [user's full_name]` from profiles table
- Entry has `visitor_avatar_url = [user's avatar_url]`
- `mentors.profile_view_count` increases by 1

#### Test 1.3: Deduplication - Same Visitor Within 1 Hour
**Steps:**
1. Visit a mentor profile as authenticated user
2. Wait 30 seconds
3. Refresh the mentor profile page (visit again)
4. Check `profile_views` table

**Expected Result:**
- First visit creates a profile_view record
- Second visit (within 1 hour) does NOT create a duplicate record
- `mentors.profile_view_count` only increases once
- Console logs "Already viewed in last hour, don't record duplicate" or similar

#### Test 1.4: Deduplication - Same Visitor After 1 Hour
**Steps:**
1. Visit a mentor profile as authenticated user at time T
2. Wait more than 1 hour
3. Visit same mentor profile again
4. Check `profile_views` table

**Expected Result:**
- First visit creates profile_view record at time T
- Second visit (after 1 hour) creates NEW profile_view record at time T+1hr
- `mentors.profile_view_count` increases twice
- Both records exist in database

#### Test 1.5: Anonymous Visitor Deduplication
**Steps:**
1. Open incognito browser
2. Visit mentor profile page
3. Refresh page multiple times within 1 hour
4. Check `profile_views` table

**Expected Result:**
- Only one profile_view record created (no duplicates from refreshes)
- `mentors.profile_view_count` increases by 1
- All refresh attempts after first are deduplicated

---

### 2. Session Completion Marking

#### Test 2.1: Mark Past Session Complete
**Steps:**
1. Log in as mentor with at least one past booking
2. Navigate to Mentor Dashboard → My Sessions
3. Locate a session with `end_at` time in the past and `status = confirmed`
4. Click "Mark Complete" button

**Expected Result:**
- Button shows loading spinner temporarily
- Session status changes from "confirmed" to "completed"
- `Sessions Completed` counter on dashboard increases by 1
- No error message appears

#### Test 2.2: Cannot Mark Future Session Complete
**Steps:**
1. Log in as mentor
2. Navigate to Mentor Dashboard → My Sessions
3. Look for sessions with `end_at` time in the future

**Expected Result:**
- "Mark Complete" button is NOT visible for future sessions
- Only Google Meet button appears

#### Test 2.3: Cannot Mark Already-Completed Session
**Steps:**
1. Log in as mentor
2. Navigate to Mentor Dashboard → My Sessions
3. Look for sessions already marked as "completed"

**Expected Result:**
- "Mark Complete" button is NOT visible for completed sessions
- Status badge shows "completed"

#### Test 2.4: Completion Sets Database Fields Correctly
**Steps:**
1. Mark a past session complete
2. Query database directly or via API

**Expected Result:**
- Booking `status` = "completed"
- Booking `completed_at` = timestamp of completion (approximately now)
- Booking `updated_at` = timestamp of completion

---

### 3. Dashboard Statistics Accuracy

#### Test 3.1: Upcoming Sessions Count (Confirmed Only)
**Steps:**
1. Log in as mentor
2. Navigate to Mentor Dashboard (Overview)
3. Check "Upcoming Sessions" count
4. Query database: `SELECT COUNT(*) FROM bookings WHERE mentor_id='[id]' AND status='confirmed' AND start_at > NOW()`

**Expected Result:**
- Dashboard count matches database query result
- Only confirmed bookings are counted (not pending)
- Only future sessions counted (not past)

#### Test 3.2: Completed Sessions Count
**Steps:**
1. Log in as mentor
2. Navigate to Mentor Dashboard (Overview)
3. Check "Sessions Completed" count
4. Query database: `SELECT COUNT(*) FROM bookings WHERE mentor_id='[id]' AND status='completed' AND completed_at IS NOT NULL`

**Expected Result:**
- Dashboard count matches database query result
- Only bookings with both status='completed' AND completed_at set are counted
- Past sessions without completion mark are not counted

#### Test 3.3: Profile Views Count
**Steps:**
1. Log in as mentor
2. Navigate to Mentor Dashboard (Overview)
3. Check "Profile Views" count
4. Query database: `SELECT profile_view_count FROM mentors WHERE id='[mentor_id]'`

**Expected Result:**
- Dashboard count matches `mentors.profile_view_count` value
- Count reflects all profile views (from profile_views table)

---

### 4. Realtime Updates (Live Dashboard)

#### Test 4.1: Dashboard Updates When New Booking Confirmed
**Steps:**
1. Open mentor dashboard in browser A (logged in as Mentor 1)
2. Open booking form in browser B (logged in as Student)
3. Book a session with Mentor 1, choose "confirmed" status
4. Observe dashboard in browser A

**Expected Result:**
- "Upcoming Sessions" count increases by 1 within 5 seconds
- No manual refresh needed
- Realtime subscription detects the change

#### Test 4.2: Dashboard Updates When Session Marked Complete
**Steps:**
1. Open mentor dashboard in browser A (logged in as Mentor 1)
2. Open My Sessions page in browser B (same Mentor 1)
3. Mark a past session complete in browser B
4. Observe dashboard in browser A

**Expected Result:**
- "Sessions Completed" count increases by 1 within 5 seconds
- "Upcoming Sessions" count decreases by 1 (if it was upcoming)
- Updates happen without manual refresh

#### Test 4.3: Profile Views Count Updates in Realtime
**Steps:**
1. Open mentor dashboard in browser A (logged in as Mentor 1)
2. Open incognito browser B
3. Visit Mentor 1's public profile page in browser B
4. Observe dashboard in browser A

**Expected Result:**
- "Profile Views" count increases by 1 within 5 seconds
- "Recent Profile Visitors" section shows new visitor
- No manual refresh needed

#### Test 4.4: Profile Visitors List Updates in Realtime
**Steps:**
1. Mentor dashboard open with "Recent Profile Visitors" section visible
2. Open Mentor's public profile in another browser/tab
3. Observe visitors list

**Expected Result:**
- New visitor appears in "Recent Profile Visitors" section within 5 seconds
- Visitor shows: name (or "Anonymous Visitor"), avatar (if authenticated), timestamp
- List maintains most recent visitors at top
- Maximum 10 visitors displayed

---

### 5. Profile Visitors Display

#### Test 5.1: Authenticated Visitor Display
**Steps:**
1. Log in as User A
2. Visit a mentor's public profile
3. Log in as Mentor and check dashboard
4. Look for User A in "Recent Profile Visitors"

**Expected Result:**
- Visitor name appears (User A's full_name)
- Visitor avatar appears (User A's profile avatar)
- Timestamp shows when profile was viewed

#### Test 5.2: Anonymous Visitor Display
**Steps:**
1. Open incognito browser
2. Visit a mentor's public profile (no login)
3. Log in as Mentor and check dashboard
4. Look for visitor in "Recent Profile Visitors"

**Expected Result:**
- Visitor name displays as "Anonymous Visitor"
- Avatar shows generic user icon (no personal avatar)
- Timestamp shows when profile was viewed

#### Test 5.3: Multiple Visitors Display
**Steps:**
1. Have 15+ different users/browsers visit a mentor's profile
2. Check mentor dashboard "Recent Profile Visitors" section

**Expected Result:**
- Shows last 10 visitors (most recent first)
- Each visitor has consistent formatting
- No duplicates from same visitor within 1-hour window
- Older visitors not shown but still exist in database

#### Test 5.4: Empty Visitors State
**Steps:**
1. Create new mentor account
2. Immediately check dashboard
3. Look at "Recent Profile Visitors" section

**Expected Result:**
- Section shows empty state message
- Icon and text explaining no visitors yet
- No errors displayed

---

### 6. Edge Cases & Error Handling

#### Test 6.1: Session Completed Without Verified Ownership
**Steps:**
1. Try to mark another mentor's session as complete (via API call)
2. Should not be authenticated as that mentor

**Expected Result:**
- Completion fails with "Unauthorized" error
- Database is NOT updated
- Other mentor's stats are NOT affected

#### Test 6.2: View Recording Fails Gracefully
**Steps:**
1. Block profile_views table INSERT permissions temporarily (if possible)
2. Try to view mentor profile

**Expected Result:**
- Profile page still loads normally
- recordProfileView error is caught and logged to console
- No user-facing error
- Page remains functional

#### Test 6.3: Stats Load Handles No Bookings
**Steps:**
1. Log in as new mentor with no bookings
2. Check dashboard

**Expected Result:**
- All stats show 0 (zero)
- No errors displayed
- Dashboard renders correctly

#### Test 6.4: Stats Load Handles Database Errors
**Steps:**
1. Temporarily disconnect from Supabase (if possible in dev environment)
2. Try to load mentor dashboard

**Expected Result:**
- Stats show 0 (fallback values)
- Errors logged to console
- Dashboard shows but with fallback data
- No critical app crash

---

## Manual Testing Checklist

- [ ] Profile view deduplication works (same visitor, 1 hour window)
- [ ] Authenticated visitors show name and avatar
- [ ] Anonymous visitors show "Anonymous Visitor"
- [ ] Mark Complete button only shows for past sessions
- [ ] Session completion updates database correctly
- [ ] Dashboard counts are accurate (confirmed sessions, completed sessions, views)
- [ ] Realtime updates work for new bookings
- [ ] Realtime updates work for completed sessions
- [ ] Realtime updates work for profile views
- [ ] Profile visitors list shows recent visitors in correct order
- [ ] No XSS vulnerabilities in visitor names/avatars display
- [ ] RLS policies prevent unauthorized viewing of profile_views
- [ ] Build completes with no TypeScript errors
- [ ] No console errors during normal operation

---

## Performance Considerations

- Profile view deduplication check uses indexed query on (mentor_id, visitor_id, viewed_at)
- Realtime subscriptions use efficient postgres_changes channel filtering
- getMentorProfileVisitors limits to 10 records by default
- Stats queries use count with exact option for performance

---

## Notes

- All timestamps in profile_views are in UTC (timezone('utc'::text, now()))
- Deduplication happens at application level (1-hour window check before insert)
- RLS policies allow anyone to insert but only mentor can view their own profile_views
- Completed_at is set when markBookingCompleted is called, not automatically
