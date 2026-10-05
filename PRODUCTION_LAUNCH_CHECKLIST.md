# HELPAMART Production Launch Checklist

## Status: READY FOR PRODUCTION (pending admin authorization)

All code is in place. System is fully functional. Requires one-time admin setup to activate Google Calendar and Meet generation.

---

## Critical Pre-Launch Steps

### Step 1: Verify Vercel Environment Variables

Go to: **Vercel Dashboard** → **Project Settings** → **Environment Variables** (Production)

Verify these exist:
- `GOOGLE_CLIENT_ID` ✅
- `GOOGLE_CLIENT_SECRET` ✅
- `ADMIN_SECRET` ✅
- `SUPABASE_URL` ✅
- `SUPABASE_SERVICE_ROLE_KEY` ✅
- `SUPABASE_ANON_KEY` ✅
- `SMTP_HOST` ✅
- `SMTP_PORT` ✅
- `SMTP_USER` ✅
- `SMTP_PASS` ✅
- `SMTP_FROM` ✅
- `APP_URL` ✅

**If ANY are missing, add them now before proceeding.**

### Step 2: Verify Supabase Migrations

Go to: **Supabase Dashboard** → **SQL Editor** and run:

```sql
SELECT EXISTS (
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'google_service_connections'
);
```

Expected result: `true`

If false, run migration: `20261004070000_google_service_connection.sql`

### Step 3: Check Table Schema

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'bookings'
ORDER BY column_name;
```

Verify these columns exist:
- `meet_link` (TEXT)
- `calendar_event_id` (TEXT)
- `calendar_html_link` (TEXT)
- `calendar_status` (TEXT)
- `service_title` (TEXT)
- `reminder_60_sent_at` (TIMESTAMPTZ)
- `reminder_30_sent_at` (TIMESTAMPTZ)

### Step 4: Deploy Latest Code

Push latest commit (575b078 or later) to Vercel:

```bash
git push origin main
```

Wait for Vercel build to complete successfully.

---

## One-Time Admin Authorization

### Step 5: Authorize Central HELPAMART Google Account

This is the **CRITICAL** one-time setup step.

**Option A: Via curl (recommended):**

```bash
curl -L -H "Authorization: Bearer <your-ADMIN_SECRET>" \
  https://www.helpamart.com/api/admin-calendar-connect
```

This will:
1. Redirect to Google OAuth consent screen
2. Prompt to sign in with the **central HELPAMART Google account** (e.g. `calendar@helpamart.com`)
3. Ask for Calendar permission
4. Store the refresh token in the database
5. Show success page

**Option B: Via signed token:**

Generate a 10-minute-expiry token locally, then visit the URL.

(See ADMIN_SETUP.md for detailed instructions)

### Step 6: Verify Authorization Success

```bash
curl -H "Authorization: Bearer <your-ADMIN_SECRET>" \
  https://www.helpamart.com/api/admin-calendar-status
```

Expected response:
```json
{
  "configured": true,
  "accountEmail": "calendar@helpamart.com",
  "source": "db"
}
```

If not, check:
- ADMIN_SECRET is correct
- Central HELPAMART Google account authorized
- Supabase service-role key is correct

### Step 7: Verify Database Connection

```sql
SELECT key, status, account_email, refresh_token IS NOT NULL as has_token
FROM public.google_service_connections
WHERE key = 'helpamart_organizer';
```

Expected:
- `status`: `connected`
- `account_email`: your central account email
- `has_token`: `true`

---

## End-to-End Test

### Step 8: Test a Real Booking

1. Go to https://www.helpamart.com
2. Find a mentor, select a service, choose a time slot
3. Click "Confirm Booking"
4. Wait 5-10 seconds for backend processing
5. **Expected result**: Confirmation page shows:
   - ✅ Small gold confetti celebration
   - ✅ "You're booked."
   - ✅ Real Google Meet button with `https://meet.google.com/...` URL
   - ✅ "Open Google Calendar" button
   - ✅ "View My Bookings" button

6. Click "Join Google Meet" → real meeting opens
7. Check email inbox → both mentee and mentor receive confirmation with real Meet URL
8. Verify Supabase booking row contains:
   - `meet_url`: starts with `https://meet.google.com/`
   - `calendar_event_id`: Google Calendar event ID
   - `calendar_html_link`: Google Calendar event URL

### Step 9: Monitor Logs

Go to **Vercel Dashboard** → **Functions** → **Logs**

After test booking, search for `[BOOK]`:
- Look for: `central_calendar_auth=OK`
- Look for: `calendar_event_created=true`
- Look for: `Meet poll attempt 1: status=pending`
- Look for: `Meet poll attempt N: status=success`
- Look for: `Meet URL successfully obtained:`

If any say `FAILED`, check:
- Google OAuth credentials are correct
- Calendar API is enabled in Google Cloud Console
- Central account has Calendar write permission

---

## Production Verification Checklist

After launching, verify:

- [ ] First 10 bookings all include real Meet URLs
- [ ] No "Google Meet link will be emailed to you" placeholders
- [ ] Mentors receive confirmation emails with Meet links
- [ ] Mentees receive confirmation emails with Meet links
- [ ] T-60 reminders include Meet links
- [ ] T-30 reminders include Meet links
- [ ] Open Google Calendar button works for all bookings
- [ ] Join Google Meet button opens real meetings
- [ ] No duplicate bookings or Calendar events
- [ ] No duplicate emails or notifications
- [ ] Vercel logs show no errors in `[BOOK]` traces

---

## Troubleshooting

### Problem: "Google Meet link will be emailed to you"

**Cause**: Central Google account is not authorized, or authorization failed.

**Fix**:
1. Run Step 5 again to authorize
2. Check Vercel logs for `[BOOK] central_calendar_auth=FAILED`
3. Verify Google credentials in Vercel env vars

### Problem: Booking takes >20 seconds

**Cause**: Google Meet is taking longer than expected to generate.

**Expected**: Should complete within 15-20 seconds.

**Fix**: Check Vercel logs for poll attempts. If status stays `pending` after 8 attempts, there may be a Google API issue.

### Problem: Booking succeeds but no Meet URL

**Cause**: Poll loop completed but Meet URL not found.

**Fix**:
1. Check Vercel logs for `[BOOK] Meet URL not obtained`
2. Look at Google API errors in logs
3. Verify Calendar API is enabled
4. Check OAuth scopes include Calendar write access

### Problem: Database shows `refresh_token IS NULL`

**Cause**: Authorization completed but token wasn't stored.

**Fix**:
1. Re-run authorization (Step 5)
2. Check that Google returned a refresh token
3. Verify database upsert succeeded (check logs for `[ADMIN CAL CB] Central HELPAMART Calendar connected`)

---

## Rollback Plan

If something goes wrong:

1. Stop accepting bookings (or warn users with banner)
2. Review Vercel logs for errors
3. Fix the issue
4. Re-run Step 5 (admin authorization) if needed
5. Run one test booking
6. If successful, resume

---

## Success Criteria

✅ All items below verified before declaring production-ready:

- Central HELPAMART Google account authorized
- `/api/admin-calendar-status` returns `configured: true`
- Test booking includes real Meet URL
- Real Google Meet opens successfully
- Confirmation emails include real Meet URL
- Reminders include real Meet URL
- No duplicate events or bookings
- Vercel logs show successful traces
- Database contains all booking fields
- No UI placeholders or "email will contain" messages

**Status**: ALL CODE READY. AWAITING ADMIN AUTHORIZATION.

---

## Next Steps

1. ✅ Code deployed to Vercel
2. ⏳ **PENDING**: Admin authorizes central Google account (Step 5)
3. ⏳ **PENDING**: Run end-to-end test (Step 8)
4. ⏳ **PENDING**: Verify all success criteria
5. ⏳ **PENDING**: Monitor production for 24 hours

Once admin completes Step 5, bookings will automatically include real Google Meet URLs.

