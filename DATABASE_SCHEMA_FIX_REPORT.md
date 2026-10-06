# DATABASE SCHEMA FIX REPORT

## Problem Identified

**Production Error**:
```
Could not save booking with Meet link:
Could not find the 'meet_space_name' column of 'bookings' in the schema cache
(code: PGRST204)
```

**Root Cause**: 
- Production Supabase database is missing the `meet_space_name` column on `public.bookings`
- Migration `20261004080000_in_app_notifications.sql` adds this column, but production hasn't applied it yet
- Backend (`api/book.ts`) tries to write to this column, causing PGRST204 error

**Result**: Bookings fail silently; real Google Meet URLs never saved

---

## Solution Implemented

### 1. Created Migration File

**File**: `supabase/migrations/20261006090000_add_meet_space_name.sql`

**SQL**:
```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS meet_space_name TEXT;

NOTIFY pgrst, 'reload schema';
```

**Characteristics**:
- ✅ Uses `IF NOT EXISTS` (idempotent, safe to re-run)
- ✅ Adds column as TEXT (matches metadata type)
- ✅ Reloads PostgREST schema cache automatically
- ✅ No breaking changes

### 2. Made Backend More Robust

**File**: `api/book.ts`

**Change**: Updated booking update logic to gracefully handle missing `meet_space_name` column

**Strategy**:
```javascript
// Try primary update (with optional meet_space_name)
const { error: primaryErr } = await db.from('bookings').update({
  meet_link: realMeetUrl,
  meet_space_name: meetSpace.spaceName || null,
  updated_at: new Date().toISOString(),
}).eq('id', bookingId)

// If column is missing, fallback to update meet_link only
if (primaryErr?.code === 'PGRST204' && primaryErr?.message?.includes('meet_space_name')) {
  const { error: fallbackErr } = await db.from('bookings').update({
    meet_link: realMeetUrl,
    updated_at: new Date().toISOString(),
  }).eq('id', bookingId)
  updateErr = fallbackErr
}
```

**Behavior**:
- ✅ **Primary case** (new schema with meet_space_name): Save both fields
- ✅ **Fallback case** (old schema without meet_space_name): Save only meet_link
- ✅ **Critical field** (meet_link): ALWAYS saved when Google Meet succeeds
- ✅ **Optional field** (meet_space_name): Saved if available, skipped if not

**Result**: Booking succeeds with or without the optional column

---

## Production Steps

### Step 1: Run Migration in Supabase

Go to Supabase SQL Editor and run:

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS meet_space_name TEXT;

NOTIFY pgrst, 'reload schema';
```

**Expected Result**:
```
success

success
```

### Step 2: Verify Column Exists

Run in Supabase SQL Editor:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'bookings'
  AND column_name = 'meet_space_name';
```

**Expected Result**:
```
meet_space_name | text
```

### Step 3: Verify PostgREST Sees Column

In production, the API response should work (or show different error if other issue).

### Step 4: Deploy Latest Code

Latest commit: `cdb0e8f`

Push to Vercel (should auto-deploy):
- ✅ api/book.ts (robust fallback logic)
- ✅ Migration file (for future deployments)

---

## Verification Checklist

After running migration and deploying:

- [ ] Migration ran successfully in Supabase SQL Editor
- [ ] Column `meet_space_name` exists on `public.bookings`
- [ ] `SELECT information_schema.columns` confirms it
- [ ] PostgREST schema cache reloaded
- [ ] Latest commit `cdb0e8f` deployed to Vercel
- [ ] Vercel shows **Ready** status
- [ ] Test booking created successfully
- [ ] Confirmation screen shows real Google Meet URL
- [ ] Button opens real `https://meet.google.com/...` URL
- [ ] Email contains real Meet URL
- [ ] No PGRST204 errors in Vercel logs
- [ ] Booking saved with both `meet_link` and `meet_space_name` (or just `meet_link` if column missing)

---

## Technical Details

### Why This Happened

The project has multiple migrations adding columns over time:

1. `20261004020000_helpamart_production_schema.sql` — Created `public.bookings` (without `meet_space_name`)
2. `20261004080000_in_app_notifications.sql` — Added `meet_space_name` + created `notifications` table
3. Production Supabase somehow didn't run migration 20261004080000

This is likely because migrations were applied piecemeal or the migration system skipped a file.

### Why The Fix Is Robust

1. **Graceful degradation**: If column missing, fallback to saving just `meet_link`
2. **No silent failures**: Still returns errors for real problems (bad JWT, RLS block, etc.)
3. **Idempotent migration**: Can be re-run multiple times safely
4. **Critical field protected**: The real Google Meet URL (`meet_link`) is guaranteed to be saved
5. **Optional field flexible**: `meet_space_name` is saved if available, skipped if not

### Google Meet Architecture Unchanged

- ✅ Google Meet API enabled in Google Cloud
- ✅ OAuth client configured
- ✅ Direct REST API call: `POST https://meet.googleapis.com/v2/spaces`
- ✅ Real `meetingUri` returned by Google
- ✅ Real URL saved to `public.bookings.meet_link`
- ✅ No Google Calendar involved
- ✅ No mentor OAuth connections needed
- ✅ Central HELPAMART account only

---

## Expected Production Behavior After Fix

### Successful Booking Flow

```
User: Confirm Booking
  ↓
Backend: POST /api/book
  ↓
Backend: Verify JWT ✓
Backend: Lookup mentor ✓
Backend: Create booking (meet_link = null) ✓
Backend: Get Google Meet credentials ✓
Backend: Exchange refresh token → access token ✓
Backend: POST https://meet.googleapis.com/v2/spaces ✓
Backend: Google returns real meetingUri ✓
Backend: UPDATE bookings SET meet_link = 'https://meet.google.com/...' ✓
Backend: Try UPDATE meet_space_name (succeeds or falls back) ✓
Backend: Send emails ✓
Backend: Create notifications ✓
Backend: Return HTTP 200 with real meetUrl ✓
  ↓
Frontend: Display "You're booked"
Frontend: Show [JOIN GOOGLE MEET] button
Frontend: Button opens real https://meet.google.com/... URL ✓
```

### Error Handling

If anything fails:

```
Backend: Google Meet API error → HTTP 503
Frontend: Display real error message (not generic)

Backend: Database error (real, not PGRST204) → HTTP 500
Frontend: Display real error message

Backend: JWT invalid → HTTP 401
Frontend: Display "Session expired"
```

---

## Commit Info

**Commit SHA**: `cdb0e8f`

**Files Changed**:
- `api/book.ts` — Robust fallback for missing `meet_space_name`
- `supabase/migrations/20261006090000_add_meet_space_name.sql` — Migration file

**Build Status**: ✅ Zero errors  
**TypeScript**: ✅ Pass  
**Ready for Production**: ✅ Yes

---

## Summary

| Item | Status |
|------|--------|
| Root cause identified | ✅ Missing `meet_space_name` column |
| Migration created | ✅ 20261006090000_add_meet_space_name.sql |
| Backend made robust | ✅ Fallback to `meet_link` only if column missing |
| Build verified | ✅ Zero errors |
| TypeScript checked | ✅ Pass |
| Google Meet API | ✅ Unchanged |
| Commit pushed | ✅ cdb0e8f |
| Next: Run migration in Supabase | ⏳ Manual step required |
| Then: Deploy to Vercel | ⏳ Should auto-deploy |
| Then: Test real booking | ⏳ After verification |

**Next immediate action**: Run the SQL migration in Supabase to add the `meet_space_name` column to production.
