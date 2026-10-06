# HELPAMART Booking Architecture Fix — Handoff Instructions

**Completed by:** Kiro (AI Development Agent)  
**Date:** September 11, 2026  
**Status:** ✅ Ready for Production Deployment  
**Commit:** `2e049dc` — feat: implement free-first-session + razorpay paid-sessions booking architecture

---

## What Was Delivered

### Problem Fixed
- **Original Error:** "Booking not found" when users clicked "Confirm Booking" on free first sessions
- **Root Cause:** Flawed sessionStorage-based provisional booking logic that never set `pendingBookingId` for free bookings
- **Solution:** Completely separated free and paid booking flows with clean server-side logic

### Architecture
- **FLOW A (Free):** First-ever session → Direct `/api/book` → Immediate confirmation → Real Google Meet
- **FLOW B (Paid):** Returning users → `/api/razorpay init-order` → Razorpay checkout → Payment verification → Real Google Meet

### Technology Stack
- **Payment:** Razorpay (₹99 per returning user session)
- **Video:** Google Meet REST API v2 (real URLs only)
- **Email:** Hostinger SMTP (from hello@helpamart.com)
- **Notifications:** Supabase (with RLS policies)
- **Security:** Server-side Razorpay signature verification + JWT auth

---

## Files to Review

### Critical Files (Review First)
1. **`/src/pages/BookingFlow.tsx`** — Main user-facing flow logic
   - `confirmBooking()` function — Separated free vs paid logic
   - Lines ~40-130: Core booking decision and API calls

2. **`/api/razorpay.ts`** — Razorpay payment handling (NEW)
   - `action=init-order` — Creates provisional booking + Razorpay order
   - `action=verify-payment` — Verifies signature + confirms booking
   - **SECURITY CRITICAL:** Line ~320-328 signature verification

3. **`/src/components/ui/RazorpayCheckout.tsx`** — Razorpay checkout UI (NEW)
   - Loads official Razorpay SDK
   - Handles success/cancel/error
   - Line ~49-105: Main checkout logic

### Implementation Files (Review Second)
4. **`/api/book.ts`** — Free booking endpoint
   - Line ~420-430: First-session detection
   - Line ~519: Sets `payment_provider='none'` for free

5. **`/api/book-finalize.ts`** — Meet generation for paid bookings
   - Lines ~285+: Notification creation (NEW)

6. **`/supabase/migrations/20261015000000_add_razorpay_fields.sql`** — DB schema (NEW)
   - Adds `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`

### Documentation Files (Read for Context)
7. **`BOOKING_ARCHITECTURE_TEST_PLAN.md`** — All 8 test scenarios
8. **`DEPLOYMENT_CHECKLIST.md`** — Step-by-step deployment guide
9. **`ARCHITECTURE_SUMMARY.md`** — Complete implementation overview
10. **`HANDOFF_INSTRUCTIONS.md`** — This file

---

## Key Implementation Details

### 1. Free vs Paid Decision (The Fix!)
**Location:** `/api/book.ts` lines 420-430 and `/api/razorpay.ts` lines 160-170

```typescript
// Query for user's TOTAL successful bookings (platform-wide, not per-mentor)
const { count: totalSuccessfulBookings } = await db
  .from('bookings')
  .select('id', { count: 'exact', head: true })
  .eq('mentee_id', userId)
  .in('status', ['confirmed', 'completed'])
  .in('payment_status', ['not_required', 'completed'])

const isFirstSessionOnHelpamart = (totalSuccessfulBookings ?? 0) === 0

// If first session: price = 0, provider = 'none'
// If returning: price = 9900 (₹99), provider = 'razorpay'
```

**Why This Works:**
- Query checks if user has ANY successful bookings across ALL mentors
- First session detection is platform-wide (not per-mentor)
- Once user has 1 successful booking, all future bookings are paid

### 2. Razorpay Signature Verification (Security!)
**Location:** `/api/razorpay.ts` lines 320-328

```typescript
// CRITICAL SECURITY CHECK
const computedSignature = crypto
  .createHmac('sha256', RAZORPAY_KEY_SECRET)
  .update(`${orderId}|${paymentId}`)
  .digest('hex')

const isSignatureValid = computedSignature === frontendSignature

if (!isSignatureValid) {
  return res.status(403).json({ error: 'Signature mismatch' })
}
```

**Why This Matters:**
- Frontend cannot be trusted to verify payments
- Only server has `RAZORPAY_KEY_SECRET`
- Even if frontend sends fake payment ID, signature won't match
- Prevents fraud/payment manipulation

### 3. Real Google Meet URLs (Quality!)
**Location:** `/api/book.ts` lines 590-610

```typescript
// Official Google Meet REST API
const meetSpace = await createGoogleMeetSpace(accessToken)

// Validate it's a REAL Meet URL
const meetingUri = meetSpace.meetingUri
if (!meetingUri || !meetingUri.startsWith('https://meet.google.com/')) {
  throw new Error('Invalid Google Meet response')
}

// Store ONLY if valid
await db.from('bookings').update({ meet_link: meetingUri })
```

**Why This Matters:**
- Only real URLs stored (no fake/placeholder URLs)
- URLs start with `https://meet.google.com/` (official domain)
- Users can click and join instantly
- No expired URLs (generated on-demand)

---

## Testing Checklist (Before Deploying)

### Local Testing
```bash
# 1. Build should succeed
npm run build
# Expected: ✓ built in 1.74s

# 2. No TypeScript errors
tsc -b
# Expected: No output (success)
```

### Manual Testing (Local or Staging)

**Test 1: Free Booking (New User)**
- [ ] Sign in with NEW email (0 bookings)
- [ ] Browse mentors → Select one
- [ ] Choose date/time
- [ ] Click "Confirm Booking"
- [ ] Verify: NO Razorpay modal opens
- [ ] Verify: "Session confirmed" screen appears with real Meet link
- [ ] Verify: Email received from `hello@helpamart.com` with Meet link

**Test 2: Paid Booking (Returning User)**
- [ ] Sign in with account that has 1+ bookings
- [ ] Browse mentors → Select one
- [ ] Choose date/time
- [ ] Click "Confirm Booking"
- [ ] Verify: Razorpay modal opens
- [ ] Verify: Amount shows ₹99
- [ ] Complete payment with test card: `4111 1111 1111 1111`
- [ ] Verify: "Session confirmed" screen appears
- [ ] Verify: Email received with real Meet link
- [ ] Check database: `razorpay_order_id`, `razorpay_payment_id` are set

**Test 3: Payment Failure**
- [ ] Repeat Test 2 but use declined card: `4000 0000 0000 0002`
- [ ] Verify: Razorpay shows error
- [ ] Verify: Booking remains in DB with `status='pending'`
- [ ] Verify: No email sent
- [ ] Verify: User can click "Retry" to try again

**Test 4: Security - Tampered Signature**
- [ ] Intercept payment verification request
- [ ] Modify `razorpaySignature` to random string
- [ ] Send request
- [ ] Verify: HTTP 403 returned
- [ ] Verify: Booking NOT confirmed
- [ ] Verify: `meet_link` remains NULL

---

## Deployment Steps

### Step 1: Pre-Deployment Review
```bash
# View all changes
git show --stat 2e049dc

# Verify you see:
#  - 10 files changed, 1861 insertions(+), 113 deletions(-)
#  - api/razorpay.ts (NEW)
#  - src/components/ui/RazorpayCheckout.tsx (NEW)
#  - supabase/migrations/20261015000000_add_razorpay_fields.sql (NEW)
```

### Step 2: Set Vercel Environment Variables
1. Go to: https://vercel.com/dashboard
2. Select HELPAMART project
3. Settings → Environment Variables
4. Add/verify these variables:

```
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
RAZORPAY_KEY_SECRET=YYYYYYYYYYYYYY
SMTP_USER=hello@helpamart.com
SMTP_PASS=<your_hostinger_password>
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_FROM=HELPAMART <hello@helpamart.com>
```

**Note:** Keep existing values:
- `SUPABASE_URL` (don't change)
- `SUPABASE_SERVICE_ROLE_KEY` (don't change)
- `SUPABASE_ANON_KEY` (don't change)
- `GOOGLE_CLIENT_ID` (don't change)
- `GOOGLE_CLIENT_SECRET` (don't change)

### Step 3: Create Pull Request
```bash
# On main branch, commit is ready (2e049dc)

# Create PR or merge directly to main
# PR title: "feat: Free-first-session + Razorpay paid bookings"
# Description: See DEPLOYMENT_CHECKLIST.md for details
```

### Step 4: Run Database Migration
```bash
# Option A: Via Supabase CLI
npx supabase db push

# Option B: Via Supabase Dashboard
# 1. Go to SQL Editor
# 2. Create new query
# 3. Copy-paste: supabase/migrations/20261015000000_add_razorpay_fields.sql
# 4. Run

# Verify migration ran:
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'bookings' AND column_name LIKE 'razorpay%';
# Should return: razorpay_order_id, razorpay_payment_id, razorpay_signature
```

### Step 5: Deploy to Vercel
```bash
# After PR merged to main, Vercel auto-deploys
# OR manually:
vercel --prod

# Verify deployment:
curl https://www.helpamart.com/api/razorpay -X OPTIONS
# Should return 200 OK with CORS headers
```

### Step 6: Production Testing
- [ ] Test #1: New user free booking
- [ ] Test #2: Returning user paid booking
- [ ] Test #3: Different mentor payment
- [ ] Test #4: Payment failure handling
- [ ] Test #5: Double-click protection
- [ ] Test #6: Email delivery
- [ ] Test #7: In-app notifications
- [ ] Test #8: Google Meet URLs work

### Step 7: Monitor Post-Deployment
- [ ] Check Vercel logs for errors (24 hours)
- [ ] Monitor Razorpay dashboard for transactions
- [ ] Check email delivery rates
- [ ] Verify Google Meet URLs are created
- [ ] Monitor database for new columns

---

## Troubleshooting Guide

### Problem: "TypeScript compilation failed"
**Solution:** Run `npm install` to ensure all dependencies are installed
```bash
npm install
npm run build
```

### Problem: "Razorpay order creation failed"
**Check:**
1. `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are set in Vercel
2. Keys are from Razorpay SANDBOX (not production)
3. API credentials are correct (copy-paste carefully)

### Problem: "Google Meet API returned unexpected response"
**Check:**
1. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
2. Google Meet API is enabled in Google Cloud Console
3. Admin has connected Google account via `/admin/meet-connect`

### Problem: "Emails not being sent"
**Check:**
1. `SMTP_HOST=smtp.hostinger.com`
2. `SMTP_USER=hello@helpamart.com` (must match Hostinger account)
3. `SMTP_PASS` is correct (test in Hostinger webmail)
4. `SMTP_PORT=587`
5. Hostinger has email account `hello@helpamart.com` created

### Problem: "Booking stuck in 'pending' status"
**Check:**
1. Razorpay signature verification passed (check logs)
2. Payment status from Razorpay API is 'captured'
3. `/api/book-finalize` is being called after payment

### Problem: "User sees 'Booking not found' error"
**This should NOT happen** — But if it does:
1. Check that user is authenticated (JWT valid)
2. Check that mentor exists and is published
3. Check that time slot is available
4. Check Supabase logs for database errors

---

## Rollback Instructions (If Needed)

### Quick Rollback (Keep Database)
```bash
# Revert the commit (keeps database migration)
git revert HEAD
git push origin main

# Vercel auto-deploys the reverted version
# Old CashfreeCheckout will be active again (if you revert further)
```

### Full Rollback (Delete Migration)
```bash
# If you need to delete the Razorpay columns:

# Option A: Via Supabase Dashboard
# SQL Editor → New Query:
ALTER TABLE public.bookings 
DROP COLUMN IF EXISTS razorpay_order_id;
ALTER TABLE public.bookings 
DROP COLUMN IF EXISTS razorpay_payment_id;
ALTER TABLE public.bookings 
DROP COLUMN IF EXISTS razorpay_signature;

# Option B: Via Supabase CLI
npx supabase db reset
```

---

## Support & Questions

### Documentation to Read
1. **ARCHITECTURE_SUMMARY.md** — Complete technical overview
2. **BOOKING_ARCHITECTURE_TEST_PLAN.md** — All 8 test scenarios + expected results
3. **DEPLOYMENT_CHECKLIST.md** — Detailed deployment instructions
4. **Code comments** — Each API file has detailed comments explaining the flow

### Key Files to Reference
- `/api/razorpay.ts` — Payment logic (see comments for explanation)
- `/src/pages/BookingFlow.tsx` — UI flow logic
- `/api/book.ts` — Free booking logic + first-session detection

### Common Questions
**Q: Why separate free and paid flows?**  
A: The original unified flow tried to read payment IDs that didn't exist for free bookings. Separation makes each flow clear and prevents errors.

**Q: Why verify signature on server?**  
A: Frontend can be manipulated. Only server has the secret key, so only server can verify legitimate payments.

**Q: Why verify payment status from Razorpay API?**  
A: Don't trust just the signature. The signature proves it's from Razorpay, but the status confirms the payment succeeded.

**Q: Can we modify the ₹99 price?**  
A: Yes — Change line 226 in `/api/razorpay.ts`: `const finalPriceCents = 9900`

**Q: Can we add more payment providers?**  
A: Yes — Create a new `/api/stripe.ts` following the same pattern as `/api/razorpay.ts`

---

## Success Indicators (Post-Deployment)

- [ ] New users can book free sessions (no Razorpay modal)
- [ ] Returning users see ₹99 Razorpay modal
- [ ] Bookings confirmed immediately for free, after payment for paid
- [ ] Real Google Meet URLs generated and stored
- [ ] Emails received from `hello@helpamart.com`
- [ ] In-app notifications appear for both mentee and mentor
- [ ] No errors in Vercel logs
- [ ] Razorpay transactions appearing in dashboard
- [ ] Database columns populated correctly

---

## Next Steps (Future Enhancements)

- [ ] Switch Razorpay to LIVE mode (when ready for real transactions)
- [ ] Add refund processing UI
- [ ] Add multi-currency support
- [ ] Add automatic session reminders
- [ ] Add invoice generation
- [ ] Add payment history for users
- [ ] Add discount codes/coupons

---

## Contact

**Questions about the implementation?**
- Read the comments in `/api/razorpay.ts` (detailed explanations)
- Check `/BOOKING_ARCHITECTURE_TEST_PLAN.md` for scenarios
- Review `/DEPLOYMENT_CHECKLIST.md` for step-by-step guide

**Issues after deployment?**
- Check Vercel logs first
- Check Razorpay dashboard for transaction details
- Check Supabase logs for database errors
- Verify environment variables are set correctly

---

**Status:** ✅ Ready for Production  
**Date:** September 11, 2026  
**Commit:** `2e049dc`

Good luck with the deployment! 🚀
