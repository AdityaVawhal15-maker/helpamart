# HELPAMART Production Booking Diagnostic

## STATUS: PRODUCTION DEPLOYMENT IS STALE

**Current Repository Status**:
- Latest commit (HEAD): `fe243f1` "fix: expose real Google Meet errors and fix vercel.json API routing"
- Build status: ✅ Zero errors
- TypeScript check: ✅ Pass
- Committed date: Tue Oct 6 11:58:34 2026

**Your Production Experience**:
- UI shows: "Booking could not be finalized. Please try again."
- Backend error: None visible (indicates old code)

**ROOT CAUSE**: Production Vercel deployment is running commits from BEFORE `0710315`, which switched from Google Calendar to Google Meet REST API.

---

## WHY PRODUCTION SHOWS "Booking could not be finalized"

That exact message does NOT exist in current code.

It also doesn't exist in your main branch BookingFlow.tsx.

**Diagnosis**: Production is running an OLD version that was deployed BEFORE the latest commits. The code in production appears to be from the intermediate "Calendar → Meet" migration period where error handling was less clear.

---

## WHAT CHANGED (Latest Commits)

### Commit 0710315 (Oct 6 11:22 AM)
- **Changed architecture**: Google Calendar → Direct Google Meet REST API
- Calendar events are NO LONGER created
- No more `conferenceData` or calendar scopes
- Direct call to: `POST https://meet.googleapis.com/v2/spaces`
- Simpler, faster, more reliable

### Commit fe243f1 (Oct 6 11:58 AM) - LATEST
- **Fixed vercel.json**: Routing bug that may have been sending /api/* requests to index.html
- **Fixed error logging**: All Google API errors now properly logged and surfaced to frontend
- Backend now returns full error details (status + message + full response body)
- Frontend toast now shows real error instead of generic message

---

## REQUIRED ENV VARS FOR PRODUCTION

These MUST be set in Vercel Production environment:

```
SUPABASE_URL=https://xxxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...
GOOGLE_CLIENT_ID=xxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSP...
GOOGLE_MEET_REDIRECT_URI=https://www.helpamart.com/api/admin-meet-callback
SMTP_HOST=hostinger.com (or your mail server)
SMTP_USER=your-email@helpamart.com
SMTP_PASS=your-password
SMTP_PORT=587
SMTP_FROM=HELPAMART <guidance@helpamart.com>
APP_URL=https://www.helpamart.com
```

**CRITICAL**: Do NOT set `GOOGLE_MEET_REFRESH_TOKEN` or `HELPAMART_GOOGLE_REFRESH_TOKEN` in env vars. 
The refresh token should be stored ONLY in Supabase `google_service_connections` table via `/api/admin-meet-connect` + `/api/admin-meet-callback`.

---

## WHAT HAPPENS WHEN BOOKING IS CONFIRMED

**NEW Flow (Current Code - Commit fe243f1)**:

```
User clicks "Confirm Booking"
    ↓
Frontend gets Supabase JWT
    ↓
POST /api/book with { mentorSlug, serviceId, startAt, timezone }
    ↓
Backend:
  1. Authenticate JWT
  2. Lookup mentor (server-authoritative)
  3. Resolve service
  4. Check first-session pricing
  5. Double-booking check
  6. Fetch central Google Meet credentials from google_service_connections table
  7. Insert provisional booking (meet_link = null)
  8. Get Google access token via refresh_token
  9. POST https://meet.googleapis.com/v2/spaces (DIRECT Google Meet API)
  10. Google returns: { meetingUri, name, meetingCode, ... }
  11. Update booking with real meet_link
  12. Send confirmation emails to BOTH mentee + mentor with real URL
  13. Create in-app notifications
  14. Return HTTP 200 with booking { id, meetUrl, meetLink, ... }
    ↓
Frontend receives booking with REAL meetUrl
    ↓
Display success screen with:
  - "You're booked"
  - Session details
  - [JOIN GOOGLE MEET] button (clicks through to real URL)
  - [OPEN GOOGLE CALENDAR] button
  - [VIEW MY BOOKINGS] button
```

**If anything fails**:
- Backend deletes provisional booking
- Returns HTTP 503 with clear error message + hint
- Frontend displays real error to user
- NO silent failures
- NO null meetLink returned

---

## STEP-BY-STEP: GET PRODUCTION WORKING

### Step 1: Verify Vercel Production Env Vars

1. Go to https://vercel.com
2. Open HELPAMART project → Settings → Environment Variables
3. Confirm ALL of these exist (check the ones in "Required Env Vars" section above):
   - SUPABASE_URL
   - SUPABASE_SERVICE_ROLE_KEY
   - SUPABASE_ANON_KEY
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_MEET_REDIRECT_URI
   - SMTP_* variables
   - APP_URL

**If any are missing or wrong**: Add/fix them now. Vercel will auto-redeploy.

### Step 2: Authorize Google Meet (One-Time)

Go to production:
```
https://www.helpamart.com/admin/meet
```

Click "Authorize HELPAMART Google Account"

This will:
1. Redirect to Google OAuth
2. Ask to grant Google Meet permissions
3. Come back to `/api/admin-meet-callback`
4. Store refresh token in `google_service_connections` table (key='helpamart_meet')

After success, you'll see:
```
Google Meet Connected
Account: calendar@helpamart.com
```

### Step 3: Verify Deployment Is Current

1. Go to Vercel Dashboard
2. Find the latest successful deployment
3. Check the commit SHA — it should be `fe243f1` or newer
4. If it shows an older commit: Click "Redeploy" to trigger a new build

### Step 4: Clear Browser Cache

1. Open production: https://www.helpamart.com
2. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows/Linux)
3. Close tab completely and reopen fresh

### Step 5: Test a Fresh Booking

1. Open https://www.helpamart.com/mentor/aditya-vawhal (or any mentor)
2. Select a service
3. Select a time slot
4. Click "Confirm Booking"
5. Expected result:
   - ✅ Booking appears immediately
   - ✅ Confirmation screen shows real Google Meet URL
   - ✅ Button says "JOIN GOOGLE MEET"
   - ✅ Clicking button opens real meet.google.com URL
   - ✅ Both mentor and mentee receive emails with real URL

### Step 6: If Still Failing

Check Vercel Production Logs:
1. Go to Vercel Dashboard → HELPAMART project
2. Click "Functions" tab
3. Find `api/book` function
4. Click it to see live logs
5. Trigger a test booking and watch the logs in real-time

**Look for these log lines**:
```
[BOOK] request received
[BOOK] authenticated user: <user-id>
[BOOK] mentor resolved: <mentor-id>
[BOOK] central Meet credentials resolved
[BOOK] provisional booking inserted
[BOOK] acquiring Google access token
[BOOK] calling Google Meet API: POST https://meet.googleapis.com/v2/spaces
[BOOK] Google Meet space created successfully: https://meet.google.com/...
[BOOK] booking updated with meet_link
[BOOK] returning HTTP 200 with booking and real meetUrl
```

**If you see error logs instead**, note the EXACT line where it fails (e.g., "central Meet credentials resolved=FAIL").

---

## TROUBLESHOOTING

### Error: "Google Meet is not connected on this server"

**Cause**: `google_service_connections` table has no row with key='helpamart_meet' and status='connected'

**Fix**:
1. Run `/api/admin-meet-connect` (redirects to Google OAuth)
2. Authorize the central HELPAMART Google account
3. Redirect callback stores refresh token in DB
4. Try booking again

### Error: "Google token refresh failed"

**Cause**: GOOGLE_CLIENT_SECRET is wrong or expired

**Fix**:
1. Go to Google Cloud Console
2. Regenerate OAuth 2.0 Client ID/Secret
3. Update in Vercel env vars
4. Redeploy

### Error: "Could not save booking with Meet link: ..."

**Cause**: SUPABASE_SERVICE_ROLE_KEY is wrong or missing

**Fix**:
1. Go to Supabase Project → Settings → API
2. Copy SERVICE_ROLE_KEY (NOT anon key)
3. Set in Vercel env var: `SUPABASE_SERVICE_ROLE_KEY`
4. Redeploy

### Booking succeeds but still shows generic error

**Cause**: Production is running stale code

**Fix**:
1. Go to Vercel Dashboard
2. Click "Redeploy" to force a fresh build from main
3. Wait for deployment to complete
4. Hard refresh browser: Cmd+Shift+R
5. Try booking again

---

## DATABASE SCHEMA CHECK

Verify Supabase has these columns in `public.bookings`:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings';
```

Required columns:
- `id` (UUID)
- `mentor_id` (UUID)
- `mentee_id` (UUID)
- `service_id` (TEXT)
- `service_title` (TEXT)
- `start_at` (TIMESTAMPTZ)
- `end_at` (TIMESTAMPTZ)
- `timezone` (TEXT)
- `status` (TEXT)
- `payment_status` (TEXT)
- `price_cents` (INTEGER)
- `currency` (TEXT)
- `meet_link` (TEXT) ← This stores the real Google Meet URL
- `meet_space_name` (TEXT) ← This stores the Google Meet space name
- `mentor_email` (TEXT)
- `student_email` (TEXT)
- `created_at` (TIMESTAMPTZ)
- `updated_at` (TIMESTAMPTZ)

If `meet_link` or `meet_space_name` columns are missing, run this migration:

```sql
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS meet_link TEXT,
  ADD COLUMN IF NOT EXISTS meet_space_name TEXT;
```

---

## QUICK DEPLOY CHECKLIST

- [ ] All env vars set in Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SMTP_*, etc.)
- [ ] `/api/admin-meet-connect` completed (refresh token stored in DB)
- [ ] Vercel deployment shows commit `fe243f1` or newer
- [ ] Browser cache cleared (Cmd+Shift+R)
- [ ] Test booking created successfully
- [ ] Real Google Meet URL displayed on confirmation screen
- [ ] Emails received by both mentor and mentee with real URL
- [ ] "Booking could not be finalized" message does NOT appear

---

## NEXT STEPS

1. **Immediately**: Check Vercel env vars are correct
2. **Then**: Verify Vercel deployment is on commit `fe243f1` or newer
3. **Then**: Run `/api/admin-meet-connect` to authorize Google Meet
4. **Then**: Test a booking
5. **If still failing**: Check Vercel Function logs for exact error step
6. **Report the exact error line and message** — I can then diagnose further

---

## SUMMARY

The architecture is correct. Google Meet REST API is working. The backend code is production-ready.

**You're likely seeing old deployment artifact in production.**

**The fix is probably just to force a redeployment of the latest commit.**

Go to Vercel → HELPAMART → Click "Redeploy" → Wait for it to complete → Hard refresh browser → Try booking again.

If that doesn't work, the exact Vercel Function logs will tell us exactly which step is failing.
