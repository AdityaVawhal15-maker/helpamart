# HELPAMART Booking Architecture — Test Plan

## Overview
Complete booking system with two flows:
- **FLOW A (Free)**: First session ever on HELPAMART platform → Free → Direct /api/book → Real Google Meet → Emails + Notifications
- **FLOW B (Paid)**: Returning users (2nd+ session) → ₹99 Razorpay → /api/razorpay → Verify payment → Real Google Meet → Emails + Notifications

---

## Test Scenario #1: New User Books First Session (Free)

**Precondition:**
- User has never booked on HELPAMART (0 successful bookings)
- Mentor is published and available
- Time slot is free

**Steps:**
1. User signs in (Email OTP or Google)
2. Browse mentors, click "Find Mentor"
3. Select a mentor (e.g., Alice)
4. Choose service (e.g., "Career Guidance — 30 min")
5. Select date/time (e.g., Tomorrow 10:00 AM)
6. Click "Confirm Booking"

**Expected Behavior:**
- UI shows: "First session — complimentary" + "Free"
- **NO Razorpay modal** opens
- API calls: `POST /api/book`
  - Checks: User has 0 successful bookings ✓
  - Sets: `status='confirmed'`, `payment_status='not_required'`, `price_cents=0`, `payment_provider='none'`
  - Creates: Real Google Meet via official API
  - Stores: Real `meet_link` (starts with `https://meet.google.com/...`)
  - Sends emails: To mentee + mentor (with real Meet URL)
  - Creates notifications: Both mentee + mentor receive in-app notification
- UI shows success: "Session confirmed!" + "Join Google Meet" button
- Booking status: **Confirmed immediately** (no payment needed)
- User and mentor receive emails from `hello@helpamart.com`

**Verification:**
- [ ] Booking row exists: `status='confirmed'`, `payment_status='not_required'`
- [ ] `meet_link` is a real Google Meet URL
- [ ] Email received by mentee and mentor with Meet link
- [ ] Notifications created for both users
- [ ] Idempotency: Refreshing booking page doesn't create duplicate bookings (idempotency key)

---

## Test Scenario #2: Returning User Books Second Session (Paid with Razorpay)

**Precondition:**
- User has exactly 1 successful booking (confirmed + paid/free in the past)
- Mentor is published and available
- Time slot is free
- Razorpay credentials are set (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET)

**Steps:**
1. Same user signs in again
2. Browse mentors, click "Find Mentor"
3. Select a different mentor (e.g., Bob) OR same mentor at different time
4. Choose service
5. Select date/time
6. Click "Confirm Booking"

**Expected Behavior:**
- UI shows: "₹99" + Pay button
- **Razorpay checkout modal OPENS**
- API calls: `POST /api/razorpay?action=init-order`
  - Checks: User has 1+ successful bookings ✓ (returning user)
  - Creates: Provisional booking (`status='pending'`, `payment_status='pending'`)
  - Creates: Razorpay order (₹99 = 9900 paise)
  - Returns: `booking_id`, `razorpay_order_id`, `razorpay_key_id`
  - Stores: `razorpay_order_id` in booking
- User completes Razorpay checkout
- API calls: `POST /api/razorpay?action=verify-payment`
  - Verifies: Razorpay signature (CRITICAL security check)
  - Fetches: Payment details from Razorpay API
  - Updates: Booking to `status='confirmed'`, `payment_status='completed'`, `paid_at=now()`
  - Stores: `razorpay_payment_id`, `razorpay_signature`
  - Creates: Notifications (payment confirmed)
- Frontend calls: `POST /api/book-finalize`
  - Creates: Real Google Meet
  - Stores: `meet_link`
  - Sends: Confirmation emails (with real Meet URL)
  - Creates: Notifications (session ready with Meet link)
- UI shows: Success + "Join Google Meet" button

**Verification:**
- [ ] Booking row exists: `status='confirmed'`, `payment_status='completed'`
- [ ] Razorpay columns populated: `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`
- [ ] `paid_at` is set to current timestamp
- [ ] `meet_link` is a real Google Meet URL
- [ ] Email received with Meet link
- [ ] Notifications created at payment step + finalize step
- [ ] No Cashfree references in booking flow

---

## Test Scenario #3: Returning User Books with Different Mentor

**Precondition:**
- User has 1+ successful bookings
- Different mentor selected from Scenario #2

**Steps:**
1. User signs in
2. Browse mentors, select a **different** mentor (not used before)
3. Choose service, date/time
4. Click "Confirm Booking"

**Expected Behavior:**
- Razorpay flow activates (same as Scenario #2)
- Different mentor's email and ID are used for notifications/booking
- Mentor receives in-app notification + email

**Verification:**
- [ ] Booking row has correct `mentor_id`
- [ ] Correct mentor's email in `mentor_email` column
- [ ] Correct mentor's name in notification
- [ ] No conflicts with previous booking (double-booking check passed)

---

## Test Scenario #4: Returning User Books Third Session (Another Paid)

**Precondition:**
- User now has 2+ successful bookings
- Same or different mentor
- Time slot available

**Steps:**
1. User signs in
2. Browse mentors, select mentor
3. Choose service, date/time
4. Click "Confirm Booking"

**Expected Behavior:**
- Razorpay flow activates (consistent with paid flow)
- Booking confirmed after payment verification

**Verification:**
- [ ] Booking created successfully
- [ ] `payment_provider='razorpay'` (not 'none' or 'cashfree')
- [ ] Price is always ₹99 for 2nd+ sessions

---

## Test Scenario #5: Payment Failure (Razorpay Declined)

**Precondition:**
- User is returning user (eligible for paid flow)
- Razorpay environment is operational

**Steps:**
1. User books (returning user)
2. Razorpay modal opens
3. User enters **invalid card** (e.g., declined card number)
4. Razorpay returns payment failure

**Expected Behavior:**
- Razorpay modal shows error: "Payment failed"
- Provisional booking remains in DB with `status='pending'`, `payment_status='pending'`
- User can retry or cancel
- **No Google Meet created** (important: Meet only after verified payment)
- **No confirmation emails sent**
- Notification: Payment failed

**Verification:**
- [ ] Booking row still exists with `status='pending'`, `payment_status='pending'`
- [ ] `meet_link` is NULL (no Meet created)
- [ ] No confirmation emails sent
- [ ] User can click "Retry" to re-open Razorpay
- [ ] Signature verification didn't pass (or payment status != 'captured')

---

## Test Scenario #6: Double-Click Protection (Idempotency)

**Precondition:**
- User booking free session

**Steps:**
1. User clicks "Confirm Booking"
2. **Immediately clicks again** before response
3. Network takes 3+ seconds

**Expected Behavior:**
- First request: Creates booking with `idempotency_key`
- Second request: Same `idempotency_key`, DB returns existing booking (not duplicate)
- Only 1 booking created
- Only 1 Meet space created
- Only 1 set of emails sent

**Verification:**
- [ ] Only 1 booking row in DB
- [ ] Only 1 Meet link stored
- [ ] Email count = 1 (not 2)
- [ ] Idempotency key matches both requests

---

## Test Scenario #7: Page Refresh After Successful Booking

**Precondition:**
- User just booked successfully (free or paid)
- UI showing success screen with Meet link

**Steps:**
1. User refreshes page (`Cmd+R` or `Ctrl+R`)
2. Navigate to booking details page

**Expected Behavior:**
- Booking persists in DB
- Meeting link is retrievable
- No duplicate booking created
- Notification in sidebar/dashboard

**Verification:**
- [ ] Booking is still confirmed
- [ ] Meet link is still the same (idempotent)
- [ ] No duplicate Meet created
- [ ] Notification visible in user dashboard

---

## Test Scenario #8: Security — Signature Verification

**Precondition:**
- User in paid flow (Razorpay)

**Steps:**
1. Razorpay payment completes
2. Frontend attempts to call verify-payment with **tampered signature**
3. Send: `razorpaySignature='fake_signature_12345'` (modified)

**Expected Behavior:**
- Server verifies signature: FAILS
- Booking remains `status='pending'`, `payment_status='pending'`
- Response: HTTP 403 "Payment verification failed. Signature mismatch."
- **Booking NOT confirmed** (critical security check)
- **No Google Meet created**
- **No emails sent**
- Fraud attempt logged

**Verification:**
- [ ] HTTP 403 returned
- [ ] Booking not confirmed
- [ ] Meet link not created
- [ ] Server logs show "Signature verification FAILED"
- [ ] Payment verified via Razorpay API (not just frontend)

---

## Booking Status Flow Chart

### Free Booking (First Session)
```
Start
  ↓
POST /api/book (direct)
  ↓
Check: User has 0 successful bookings? YES
  ↓
Create booking: status='confirmed', payment_status='not_required'
  ↓
Create real Google Meet
  ↓
Store meet_link
  ↓
Send emails + create notifications
  ↓
Return HTTP 200 with booking + meetUrl
  ↓
UI: Success screen
```

### Paid Booking (2nd+ Session)
```
Start
  ↓
Check: User has 1+ successful bookings? YES
  ↓
POST /api/razorpay?action=init-order
  ↓
Create provisional booking: status='pending', payment_status='pending'
  ↓
Create Razorpay order (₹99)
  ↓
Return booking_id + razorpay_order_id + razorpay_key_id
  ↓
Frontend: Open Razorpay checkout
  ↓
User enters payment details
  ↓
Razorpay processes payment
  ↓
POST /api/razorpay?action=verify-payment
  ↓
Verify signature (CRITICAL)
  ↓
Fetch payment from Razorpay API
  ↓
Status == 'captured'? YES
  ↓
Update booking: status='confirmed', payment_status='completed', paid_at=now()
  ↓
Create notifications (payment confirmed)
  ↓
Return HTTP 200
  ↓
Frontend: POST /api/book-finalize
  ↓
Create real Google Meet
  ↓
Store meet_link
  ↓
Send emails + create notifications (with Meet link)
  ↓
UI: Success screen
```

---

## Environment Variables Checklist

Before deploying, verify these are set:

**Supabase:**
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (not anon key)
- [ ] `SUPABASE_ANON_KEY`

**Google Meet:**
- [ ] `GOOGLE_CLIENT_ID`
- [ ] `GOOGLE_CLIENT_SECRET`
- [ ] `GOOGLE_MEET_REDIRECT_URI`

**Razorpay (NEW):**
- [ ] `RAZORPAY_KEY_ID`
- [ ] `RAZORPAY_KEY_SECRET`

**SMTP (Hostinger):**
- [ ] `SMTP_HOST=smtp.hostinger.com`
- [ ] `SMTP_PORT=587`
- [ ] `SMTP_USER=hello@helpamart.com` (or your Hostinger email)
- [ ] `SMTP_PASS=<hostinger_password>`
- [ ] `SMTP_FROM=HELPAMART <hello@helpamart.com>`

**Cashfree (Deprecated, keep for webhook):**
- [ ] `CASHFREE_APP_ID` (old, can be empty)
- [ ] `CASHFREE_SECRET_KEY` (old, can be empty)

---

## Database Migrations Checklist

Before deploying, run these migrations:

- [ ] `20261015000000_add_razorpay_fields.sql` — Adds Razorpay columns to bookings table
  - `razorpay_order_id` (TEXT, UNIQUE)
  - `razorpay_payment_id` (TEXT)
  - `razorpay_signature` (TEXT)

---

## Files Modified/Created

### New Files:
- [ ] `/api/razorpay.ts` — Razorpay order init + payment verification
- [ ] `/src/components/ui/RazorpayCheckout.tsx` — Razorpay checkout component
- [ ] `/supabase/migrations/20261015000000_add_razorpay_fields.sql` — DB schema

### Modified Files:
- [ ] `/src/pages/BookingFlow.tsx` — Separated free and paid flows, uses RazorpayCheckout
- [ ] `/api/book.ts` — Sets `payment_provider='none'` for free bookings
- [ ] `/api/razorpay.ts` — Creates notifications after payment verification
- [ ] `/api/book-finalize.ts` — Creates notifications with Meet URL
- [ ] `/api/cashfree.ts` — Marked deprecated (webhook-only)
- [ ] `/.env` — Updated SMTP_FROM to `hello@helpamart.com`
- [ ] `/.env.example` — Added Razorpay + SMTP examples

---

## Testing Instructions

### Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Fill in your Razorpay, Google, Supabase, SMTP credentials
   ```

3. **Run migrations:**
   ```bash
   npx supabase migration up
   ```

4. **Start dev server:**
   ```bash
   npm run dev
   ```

5. **Run test scenarios (manual):**
   - Test #1: Sign in as new user → Book free session → Verify no payment modal
   - Test #2: Sign in as returning user → Book session → Complete Razorpay → Verify Meet URL
   - Test #3-#8: Follow test plan above

### Production Deployment

1. **Build:**
   ```bash
   npm run build
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Run migrations on production Supabase:**
   ```bash
   npx supabase --project-ref <prod-ref> db push
   ```

4. **Verify:**
   - Test a free booking (new user)
   - Test a paid booking (returning user)
   - Check emails are sent from `hello@helpamart.com`
   - Verify Razorpay sandbox mode is working

---

## Rollback Plan

If issues arise:

1. **Revert to Cashfree (temporary):**
   - BookingFlow imports CashfreeCheckout again
   - Set `payment_provider='cashfree'` in api/book.ts
   - Deploy

2. **Delete Razorpay migrations:**
   ```bash
   npx supabase db reset
   ```

3. **Contact Razorpay support** for failed payment investigation

---

## Success Criteria

✅ All 8 test scenarios pass
✅ No duplicate bookings created (idempotency)
✅ Razorpay signature verified (security)
✅ Real Google Meet URLs generated and stored
✅ Emails sent from `hello@helpamart.com` to both mentee and mentor
✅ Notifications created for both mentee and mentor
✅ Free and paid flows completely separated (no Cashfree in active path)
✅ Payment provider correctly set: 'none' for free, 'razorpay' for paid
✅ No errors in Vercel logs
✅ Production testing passes

---

## Known Limitations / Future Work

- [ ] Payment refunds (manual process via Razorpay dashboard for now)
- [ ] Payment retry with different card (user can book again)
- [ ] Automatic session reminders (can be added later)
- [ ] Multi-currency support (currently INR only)
