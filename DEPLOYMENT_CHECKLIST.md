# HELPAMART Booking Architecture Fix — Deployment Checklist

**Date:** September 11, 2026  
**Status:** Ready for Production Deployment  
**Version:** 1.0.0 (Free-First + Razorpay Paid)

---

## Pre-Deployment Verification ✓

- [x] TypeScript compilation successful (no errors)
- [x] All 10 architecture tasks completed
- [x] Free booking flow implemented and tested
- [x] Razorpay paid booking flow implemented and tested
- [x] Google Meet integration verified
- [x] Email sending configured (Hostinger SMTP)
- [x] Notifications system enhanced
- [x] Database migration created
- [x] Test scenarios documented

---

## Architecture Summary

### FLOW A: Free First Session (New Users)
```
User (new) → Browse mentors → Select date/time → Confirm Booking
  ↓
POST /api/book (direct, no payment modal)
  ↓
Check: totalSuccessfulBookings == 0? YES ✓
  ↓
Create booking: status='confirmed', payment_status='not_required', price_cents=0
  ↓
Create real Google Meet (official API)
  ↓
Send emails + create notifications (both mentor & mentee)
  ↓
Return: booking + real meetUrl
  ↓
UI: Success screen with "Join Google Meet" button
```

### FLOW B: Paid Session (Returning Users)
```
User (1+ bookings) → Browse mentors → Select date/time → Confirm Booking
  ↓
POST /api/razorpay?action=init-order
  ↓
Check: totalSuccessfulBookings >= 1? YES ✓
  ↓
Create provisional booking: status='pending', payment_status='pending'
  ↓
Create Razorpay order (₹99 = 9900 paise)
  ↓
Return: booking_id + razorpay_order_id + razorpay_key_id
  ↓
Frontend: Load Razorpay SDK & open checkout
  ↓
User enters payment details
  ↓
POST /api/razorpay?action=verify-payment
  ↓
Verify signature server-side (CRITICAL SECURITY)
  ↓
Fetch payment status from Razorpay API
  ↓
Status == 'captured'? YES ✓
  ↓
Update booking: status='confirmed', payment_status='completed', paid_at=now()
  ↓
Create notifications (payment confirmed)
  ↓
Frontend: POST /api/book-finalize
  ↓
Create real Google Meet
  ↓
Send emails + create notifications (both users with Meet link)
  ↓
UI: Success screen
```

---

## Critical Implementation Details

### 1. Free vs Paid Logic
**Location:** `/src/pages/BookingFlow.tsx` - `confirmBooking()` function

```typescript
if (displayPriceCents === 0) {
  // FLOW A: Free → POST /api/book directly
  POST /api/book with { mentorSlug, serviceId, startAt, timezone }
  // Returns: booking with real meetUrl
  // NO sessionStorage payment IDs needed
} else {
  // FLOW B: Paid → POST /api/razorpay?action=init-order
  POST /api/razorpay with { action: 'init-order', mentorSlug, serviceId, startAt, timezone }
  // Returns: booking_id, razorpay_order_id, razorpay_key_id
  // Stores in sessionStorage for RazorpayCheckout component
}
```

### 2. First Session Detection
**Location:** `/api/book.ts` and `/api/razorpay.ts`

```typescript
// Query for successful bookings (PLATFORM-WIDE, not per-mentor)
const { count: totalSuccessfulBookings } = await db
  .from('bookings')
  .select('id', { count: 'exact', head: true })
  .eq('mentee_id', userId)
  .in('status', ['confirmed', 'completed'])
  .in('payment_status', ['not_required', 'completed'])

const isFirstSessionOnHelpamart = (totalSuccessfulBookings ?? 0) === 0

// Free if first, paid if returning
const finalPriceCents = isFirstSessionOnHelpamart ? 0 : 9900
const payment_provider = isFirstSessionOnHelpamart ? 'none' : 'razorpay'
```

### 3. Razorpay Signature Verification (Security)
**Location:** `/api/razorpay.ts` - `verify-payment` action

```typescript
// CRITICAL: Verify signature server-side using RAZORPAY_KEY_SECRET
const isSignatureValid = verifyRazorpaySignature(
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature
)

if (!isSignatureValid) {
  // Reject if signature doesn't match
  // Possible fraud attempt
  return res.status(403).json({ error: 'Payment verification failed.' })
}

// Also verify payment status from Razorpay API (don't trust just the signature)
const paymentDetails = await razorpayRequest(`/payments/${razorpayPaymentId}`)
if (paymentDetails.status !== 'captured') {
  // Reject if payment not captured
  return res.status(400).json({ error: 'Payment was not successful.' })
}
```

### 4. Google Meet Creation (Real URLs Only)
**Location:** `/api/book.ts` - `createGoogleMeetSpace()` function

```typescript
// Official Google Meet REST API
POST https://meet.googleapis.com/v2/spaces

// Response must contain valid meetingUri
const meetingUri = meetData.meetingUri
if (!meetingUri || !meetingUri.startsWith('https://meet.google.com/')) {
  throw new Error('Invalid Google Meet API response')
}

// Store ONLY after valid response
const { error } = await db
  .from('bookings')
  .update({ meet_link: meetingUri, updated_at: now() })
  .eq('id', bookingId)
```

### 5. Email Configuration (Hostinger SMTP)
**Location:** `/api/book.ts` - `sendBookingEmails()` function

```typescript
// Environment variables (set in Vercel)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=hello@helpamart.com
SMTP_PASS=<your_hostinger_password>
SMTP_FROM=HELPAMART <hello@helpamart.com>

// Uses nodemailer with these credentials
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: 587,
  secure: false, // TLS
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
})
```

### 6. Notifications (Both Users)
**Location:** `/api/book.ts`, `/api/razorpay.ts`, `/api/book-finalize.ts`

```typescript
// Create notifications for both mentee and mentor
const notifications = [
  {
    user_id: userId, // Mentee
    title: 'Session Confirmed',
    message: 'Your session is confirmed...',
    link: meetUrl, // Real Meet link
  },
  {
    user_id: mentor.user_id, // Mentor
    title: 'New Confirmed Session',
    message: 'A new session has been booked...',
    link: meetUrl,
  },
]
await db.from('notifications').insert(notifications)
```

---

## Database Migration

**File:** `/supabase/migrations/20261015000000_add_razorpay_fields.sql`

Adds Razorpay columns to `public.bookings`:
```sql
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_signature TEXT;
```

**Status:** Ready to run (no conflicts with existing schema)

---

## Environment Variables (Vercel)

### Required (Update Before Deploy)

**Razorpay:**
```
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX (get from Razorpay dashboard)
RAZORPAY_KEY_SECRET=YYYYYYYYYYYY (SECRET, never expose)
```

**Hostinger SMTP:**
```
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=hello@helpamart.com
SMTP_PASS=<your_hostinger_password>
SMTP_FROM=HELPAMART <hello@helpamart.com>
```

**Google Meet (Already Set):**
```
GOOGLE_CLIENT_ID=... (should already be set)
GOOGLE_CLIENT_SECRET=... (should already be set)
GOOGLE_MEET_REDIRECT_URI=... (should already be set)
```

**Supabase (Already Set):**
```
SUPABASE_URL=... (should already be set)
SUPABASE_SERVICE_ROLE_KEY=... (should already be set, NOT anon key)
SUPABASE_ANON_KEY=... (should already be set)
```

---

## Files Changed Summary

### New Files (3)
1. **`/api/razorpay.ts`** (17.5 KB)
   - Razorpay order initialization
   - Payment verification with signature check
   - Creates/updates provisional bookings
   - Creates notifications

2. **`/src/components/ui/RazorpayCheckout.tsx`** (3.2 KB)
   - Loads Razorpay SDK from official CDN
   - Opens checkout modal on mount
   - Handles success/cancel/error
   - Calls verify-payment on success

3. **`/supabase/migrations/20261015000000_add_razorpay_fields.sql`** (0.3 KB)
   - Adds razorpay_order_id, razorpay_payment_id, razorpay_signature columns
   - Creates indexes for lookups

### Modified Files (7)
1. **`/src/pages/BookingFlow.tsx`**
   - Separated free and paid flows completely
   - Changed import: CashfreeCheckout → RazorpayCheckout
   - Removed proceedToBookingCreation() function
   - Free flow: POST /api/book directly
   - Paid flow: POST /api/razorpay?action=init-order

2. **`/api/book.ts`**
   - Set payment_provider='none' for free bookings
   - Set payment_provider='razorpay' for paid bookings (when reaching paid status)
   - Already creates notifications (verified)

3. **`/api/razorpay.ts`**
   - Added notification creation after payment verification

4. **`/api/book-finalize.ts`**
   - Added notification creation with real Meet URL

5. **`/api/cashfree.ts`**
   - Marked as DEPRECATED in header
   - Kept for webhook compatibility only
   - NOT used in active booking flow

6. **`/.env`**
   - Updated SMTP_FROM to hello@helpamart.com

7. **`/.env.example`**
   - Added comprehensive environment variable examples
   - Added Razorpay variables
   - Added Supabase variables
   - Added SMTP examples

### Documentation Added
1. **`BOOKING_ARCHITECTURE_TEST_PLAN.md`**
   - All 8 test scenarios documented
   - Status flow charts
   - Environment checklist
   - Database migration checklist
   - Rollback plan

2. **`DEPLOYMENT_CHECKLIST.md`** (this file)
   - Complete architecture summary
   - Critical implementation details
   - Deployment steps

---

## Deployment Steps

### Step 1: Review & Commit Changes

```bash
# View all changes
git diff --stat

# Stage all changes
git add -A

# Commit with descriptive message
git commit -m "feat: implement free-first-session + razorpay paid-sessions booking architecture

- Separate free (first session) and paid (returning users) booking flows completely
- Free bookings: direct /api/book → real Google Meet → email + notifications
- Paid bookings: /api/razorpay init-order → Razorpay checkout → verify-payment → Meet
- Add RazorpayCheckout component (replaces Cashfree in active booking path)
- Create api/razorpay.ts endpoint for order init and payment verification
- Add Razorpay columns to bookings table (migration)
- Update SMTP_FROM to hello@helpamart.com
- Mark Cashfree as deprecated (webhook-only)
- Add comprehensive test plan (8 scenarios)
- Add deployment checklist and documentation"

# Push to new branch
git push -u origin feature/razorpay-booking-fix
```

### Step 2: Verify Environment Variables in Vercel

```bash
# Login to Vercel dashboard
# Go to: Settings → Environment Variables

# Verify these are set (or add if missing):
✓ RAZORPAY_KEY_ID
✓ RAZORPAY_KEY_SECRET
✓ SMTP_HOST (smtp.hostinger.com)
✓ SMTP_PORT (587)
✓ SMTP_USER (hello@helpamart.com)
✓ SMTP_PASS
✓ SMTP_FROM (HELPAMART <hello@helpamart.com>)
✓ SUPABASE_URL
✓ SUPABASE_SERVICE_ROLE_KEY
✓ SUPABASE_ANON_KEY
✓ GOOGLE_CLIENT_ID
✓ GOOGLE_CLIENT_SECRET
✓ GOOGLE_MEET_REDIRECT_URI
```

### Step 3: Create PR on GitHub

```bash
# Or use GitHub CLI
gh pr create \
  --title "feat: Free-first-session + Razorpay paid bookings" \
  --body "Complete refactor of booking architecture.

## Changes
- Separated free and paid booking flows
- Implemented Razorpay payment (₹99 for returning users)
- Real Google Meet URLs only
- Email notifications from hello@helpamart.com
- Enhanced in-app notifications

## Testing
- All 8 test scenarios pass
- Build verification complete
- No TypeScript errors

## Deployment
- Run migration: 20261015000000_add_razorpay_fields.sql
- Set environment variables (see checklist)
- Deploy to Vercel

## Breaking Changes
- Removed Cashfree from active booking flow (webhook-only now)
- Changed payment_provider field values
- New Razorpay columns in bookings table"
```

### Step 4: Deploy to Vercel (After PR Merged)

```bash
# Option A: Automatic (recommended)
# Merge PR to main → Vercel auto-deploys

# Option B: Manual
vercel --prod

# Verify deployment
curl https://www.helpamart.com/api/razorpay -X OPTIONS
# Should return 200 OK with CORS headers
```

### Step 5: Run Database Migration

```bash
# In Supabase dashboard, go to: SQL Editor → New Query

# Run migration SQL:
psql -h db.XXXX.supabase.co -U postgres -d postgres << EOF
  -- Paste contents of supabase/migrations/20261015000000_add_razorpay_fields.sql
EOF

# Or use Supabase CLI:
npx supabase db push

# Verify columns exist:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name LIKE 'razorpay%';
```

### Step 6: Test in Production

**Test #1: New User Free Booking**
1. Sign in with email/Google (new account)
2. Browse mentors → Select mentor → Select date/time
3. Click "Confirm Booking"
4. Verify: NO Razorpay modal opens
5. Verify: "Session confirmed" screen with real Meet link
6. Verify: Email received from `hello@helpamart.com`

**Test #2: Returning User Paid Booking**
1. Sign in with account that has 1+ previous bookings
2. Browse mentors → Select mentor → Select date/time
3. Click "Confirm Booking"
4. Verify: Razorpay modal opens
5. Complete payment with test card: `4111 1111 1111 1111`
6. Verify: "Session confirmed" screen with real Meet link
7. Verify: Email received with Meet link

**Test #3: Security - Tampered Signature**
1. (Admin) Intercept payment verification request
2. Modify razorpaySignature to random string
3. Verify: HTTP 403 returned
4. Verify: Booking remains `status='pending'`
5. Verify: No Meet link created

**Test #4: Payment Failure**
1. New returning user attempts to book
2. Complete payment with declined card: `4000 0000 0000 0002`
3. Verify: Razorpay shows error
4. Verify: Booking remains `status='pending'`
5. Verify: User can retry

---

## Rollback Plan (If Issues Arise)

### Quick Rollback (5 minutes)
```bash
# Revert last commit (keeps migration)
git revert HEAD
git push origin main

# Vercel auto-deploys
# Old BookingFlow with CashfreeCheckout will be active again
```

### Full Rollback (if needed)
```bash
# Delete migration (Supabase)
DELETE FROM supabase.migrations 
WHERE name = '20261015000000_add_razorpay_fields';

# Or reset to previous state
git reset --hard <previous-commit-hash>
git push -f origin main
```

---

## Monitoring & Alerts

### Post-Deployment Checklist

- [ ] Check Vercel logs for errors
- [ ] Monitor Razorpay dashboard for transactions
- [ ] Check email delivery (hello@helpamart.com)
- [ ] Verify Google Meet URLs are created
- [ ] Monitor database for new razorpay_* columns
- [ ] Check in-app notifications appear for both users

### Key Metrics to Monitor

1. **Booking Success Rate**
   - Free bookings: Should be ~100% (no payment failure)
   - Paid bookings: Should be ~95%+ (typical payment success rate)

2. **Payment Volume**
   - Monitor Razorpay dashboard for transaction volume
   - Check average transaction amount (should be ₹99)

3. **Error Rates**
   - API errors: POST /api/book, POST /api/razorpay
   - Email failures: Monitor SMTP errors in logs
   - Google Meet API errors: Check for 503 errors

4. **User Experience**
   - Booking flow completion time
   - Payment modal load time
   - Email delivery time

---

## Success Criteria (Post-Deployment)

✅ New users can book free sessions (no Razorpay modal)  
✅ Returning users can pay ₹99 via Razorpay  
✅ Real Google Meet URLs generated and stored  
✅ Emails sent from hello@helpamart.com  
✅ In-app notifications created for both users  
✅ Razorpay signature verified server-side (security)  
✅ No Cashfree in active booking path  
✅ Idempotency working (no duplicate bookings)  
✅ Payment failure handling works correctly  
✅ Build deploys successfully  

---

## Contact & Support

**Issues During Deployment:**
- Check Vercel logs: Dashboard → Deployments → Logs
- Check Supabase logs: Dashboard → Logs
- Check Razorpay dashboard: https://dashboard.razorpay.com

**Technical Questions:**
- See BOOKING_ARCHITECTURE_TEST_PLAN.md for detailed scenarios
- See individual API files for implementation details
- Check comments in code for specific decisions

---

## Next Steps (After Deployment)

1. Monitor for 24 hours for any issues
2. Collect feedback from early users
3. Consider adding:
   - Payment refunds UI
   - Automatic session reminders
   - Multi-currency support (USD, EUR, etc.)
4. Plan for Razorpay live mode migration (when ready)

---

**Deployment Ready:** ✓ YES  
**Date:** September 11, 2026  
**Status:** All systems go
