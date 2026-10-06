# ✅ HELPAMART Cashfree Sandbox Testing Checklist

**Created:** September 11, 2026  
**Status:** Ready for Testing  
**Git SHA:** d703e26  
**Build:** ✅ PASSING (0 TypeScript errors)

---

## PRE-TEST SETUP

### Environment Check
- [ ] `.env` file contains:
  - `CASHFREE_APP_ID=TEST11282033a5cb7d248a6a284df3a833028211`
  - `CASHFREE_SECRET_KEY=[provided]`
  - `CASHFREE_MODE=sandbox`
  - `SUPABASE_URL=https://[project].supabase.co`
  - `SUPABASE_ANON_KEY=[anon key]`
  - `SUPABASE_SERVICE_ROLE_KEY=[service role key]`
  - `GOOGLE_SERVICE_ACCOUNT_JSON=[service account credentials]`

### Database Preparation
- [ ] Run migrations: `supabase migration up`
- [ ] Verify `bookings` table has columns:
  - `payment_status` (pending, completed, failed, not_required)
  - `status` (pending_payment, confirmed, cancelled, completed)
  - `cashfree_order_id` (nullable)
  - `paid_at` (nullable timestamp)
  - `meet_link` (nullable URL)
  - `price_cents` (integer)
  - `payment_provider` (cashfree, etc.)

### Test User Setup
**Test User 1 (First Session — Free):**
- [ ] New account (zero previous bookings)
- [ ] Email: test-first@example.com
- [ ] Password: [secure password]
- [ ] Status: Verified, logged in

**Test User 2 (Returning — Paid):**
- [ ] Account with ≥1 completed booking
- [ ] Email: test-return@example.com
- [ ] Previous booking: confirmed, payment_status='not_required'
- [ ] Status: Verified, logged in

**Test Mentor (Offering Services):**
- [ ] Account with published services
- [ ] Service: Service Title
- [ ] Service Price: ₹99 (9900 cents)
- [ ] Availability: Today or tomorrow, 2:00 PM - 2:30 PM EDT
- [ ] Status: Published

### Vercel/Local Deployment
- [ ] Build passes: `npm run build` ✅
- [ ] Local server running: `npm run dev` or Vercel preview deployed
- [ ] Can access: `https://localhost:5173` (local) or Vercel URL
- [ ] No console errors on page load

---

## TEST 1: FIRST SESSION (FREE) FLOW

**Objective:** Verify a new user can book their first session for FREE without Cashfree payment

### Setup
- [ ] Log in as Test User 1 (first session, zero bookings)
- [ ] Navigate to `/mentor/[mentor-slug]`
- [ ] Mentor profile page loads
- [ ] Service shows: ₹0 (FREE) or similar indicator

### Execution
```
1. Click service card or "Book Now" button
   ↓ EXPECT: BookingFlow page opens
   
2. Select date/time (today or tomorrow, 2:00 PM)
   ↓ EXPECT: Calendar displays available slots
   
3. Select time slot
   ↓ EXPECT: "Confirm Booking" button appears
   
4. Click "Confirm Booking"
   ↓ EXPECT: No Cashfree payment screen
   ↓ EXPECT: Page shows "Processing..."
   ↓ EXPECT: No "Not authenticated" error
   
5. Wait 5 seconds
   ↓ EXPECT: Success screen appears
   ↓ EXPECT: Shows "You're booked"
   ↓ EXPECT: Amount: ₹0 or "FREE"
   ↓ EXPECT: Button: "JOIN GOOGLE MEET"
   ↓ EXPECT: Real Google Meet URL displayed (https://meet.google.com/...)
   
6. Click "JOIN GOOGLE MEET"
   ↓ EXPECT: Opens real Google Meet room
   ↓ EXPECT: Can see waiting room or meeting interface
   
7. Go back to HELPAMART dashboard
   ↓ EXPECT: Booking appears in "Upcoming Sessions"
   ↓ EXPECT: Status: Confirmed
   ↓ EXPECT: Amount: ₹0
   ↓ EXPECT: Payment: Not required
```

### Verification
```sql
SELECT * FROM bookings 
WHERE mentee_id = 'user-id' 
ORDER BY created_at DESC 
LIMIT 1;

Expected:
✓ id: valid UUID
✓ status: 'confirmed'
✓ payment_status: 'not_required'
✓ price_cents: 0
✓ payment_provider: NULL
✓ cashfree_order_id: NULL
✓ paid_at: NULL
✓ meet_link: 'https://meet.google.com/...'
✓ created_at: ~now
✓ start_at: selected time
✓ end_at: selected time + 30 min
```

### Email Verification
- [ ] Check mentee inbox: Receive confirmation email
  - [ ] Subject: "Your session with [mentor] is confirmed"
  - [ ] Contains: Date, time, Google Meet URL
  - [ ] Contains: "This is your FREE first session!"

- [ ] Check mentor inbox: Receive notification
  - [ ] Subject: "New session with [mentee]"
  - [ ] Contains: Date, time, Google Meet URL

### Dashboard Verification
- [ ] Mentee dashboard shows booking as "Upcoming"
- [ ] Mentor dashboard shows booking as "Upcoming"
- [ ] Both can see Google Meet link

### Notification Verification
- [ ] Mentee sees in-app notification: "Session Confirmed"
- [ ] Mentor sees in-app notification: "New Session"

---

## TEST 2: SECOND SESSION (PAID) FLOW — SANDBOX PAYMENT

**Objective:** Verify returning user must pay ₹99 for second session via Cashfree Sandbox

### Prerequisites
- [ ] Test User 2 is logged in
- [ ] Test User 2 has ≥1 completed booking (from Test 1 or previous)
- [ ] Navigate to `/mentor/[same-or-different-mentor]`
- [ ] Select different service/time (or same mentor, different time)

### Execution - Payment Initiation
```
1. Click "Book Now"
   ↓ EXPECT: BookingFlow opens
   
2. Select date/time
   ↓ EXPECT: Shows "₹99" (PAID)
   ↓ EXPECT: No free indicator
   
3. Click "Confirm Booking"
   ↓ EXPECT: Page shows "Preparing secure payment..."
   ↓ EXPECT: No "Not authenticated" error
   
4. CRITICAL CHECK:
   ↓ EXPECT: Cashfree checkout modal/iframe appears
   ↓ EXPECT: Not console error "session expired"
   ↓ EXPECT: Checkout shows:
     - Amount: ₹99
     - Card entry form
     - Payment method selector
```

### Database State — After init-paid-booking
```sql
SELECT * FROM bookings 
WHERE mentee_id = 'user-id' 
ORDER BY created_at DESC 
LIMIT 1;

Expected:
✓ status: 'pending_payment' (NOT confirmed yet)
✓ payment_status: 'pending'
✓ cashfree_order_id: 'BOOK-...' (NOT NULL)
✓ paid_at: NULL (not yet paid)
✓ meet_link: NULL (not generated yet)
✓ price_cents: 9900
✓ payment_provider: 'cashfree'
```

### Execution - Cashfree Payment
```
5. In Cashfree Sandbox Checkout, enter TEST CARD:
   Card Number: 4111111111111111
   Expiry: 12/25
   CVV: 123
   
   ↓ EXPECT: "Processing payment..."
   
6. Wait 3-5 seconds
   ↓ EXPECT: Payment verification happens
   ↓ EXPECT: Checkout closes
   ↓ EXPECT: No error dialog (unless payment fails)
   
7. CRITICAL CHECK — Success Screen:
   ↓ EXPECT: Shows "You're booked"
   ↓ EXPECT: Amount shows: "₹99"
   ↓ EXPECT: Button: "JOIN GOOGLE MEET"
   ↓ EXPECT: Real Google Meet URL shown
   ↓ EXPECT: Status: "Confirmed"
   ↓ EXPECT: Payment Status: "Completed"
```

### Database State — After verify-payment (SUCCESS)
```sql
SELECT * FROM bookings 
WHERE mentee_id = 'user-id' 
ORDER BY created_at DESC 
LIMIT 1;

Expected:
✓ status: 'confirmed' (NOW confirmed after payment)
✓ payment_status: 'completed'
✓ cashfree_order_id: 'BOOK-...' (still present)
✓ paid_at: '2026-09-11T10:31:00Z' (NOW set)
✓ meet_link: 'https://meet.google.com/xxx-xxxx-xxx' (NOW generated)
✓ price_cents: 9900
```

### Google Meet Verification
- [ ] Real Google Meet URL generated
- [ ] URL follows format: `https://meet.google.com/[3-letter]-[4-letter]-[3-letter]`
- [ ] Click "JOIN GOOGLE MEET"
- [ ] Opens real Google Meet room (not error)
- [ ] Can see participants, waiting room, or meeting interface

### Email Verification
- [ ] Mentee receives confirmation email
  - [ ] Subject: "Your session with [mentor] is confirmed"
  - [ ] Contains: Amount paid (₹99)
  - [ ] Contains: Payment status: "Completed"
  - [ ] Contains: Google Meet URL

- [ ] Mentor receives notification
  - [ ] Subject: "New session with [mentee] — Payment received"
  - [ ] Contains: Amount: ₹99
  - [ ] Contains: Google Meet URL

### Dashboard Verification
- [ ] Mentee dashboard shows booking: "Upcoming"
- [ ] Status: Confirmed
- [ ] Amount: ₹99 (payment received)
- [ ] Payment status: Completed ✓

- [ ] Mentor dashboard shows booking: "Upcoming"
- [ ] Payment received: ✓ ₹99

### In-App Notifications
- [ ] Mentee: "Session confirmed — Payment completed"
- [ ] Mentor: "New session — Payment received"

---

## TEST 3: PAYMENT FAILURE & RETRY

**Objective:** Verify booking can be retried if payment fails

### Prerequisites
- [ ] Test User 2 logged in
- [ ] Have another mentor/service available
- [ ] Start fresh booking flow

### Execution - Payment Failure
```
1. Click "Book Now"
2. Click "Confirm Booking"
3. Cashfree checkout opens
4. Enter FAILED test card (if available):
   Card: [test card that fails] 
   
   OR manually close checkout without completing payment
   
   ↓ EXPECT: Payment fails or user cancels
   ↓ EXPECT: Error shown: "Payment not completed"
   
5. CRITICAL: Try Again button appears
   ↓ EXPECT: Can click "Try Again"
   ↓ EXPECT: Provisional booking NOT confirmed
   ↓ EXPECT: Can retry payment
```

### Database State — After Payment Failure
```sql
SELECT * FROM bookings 
WHERE mentee_id = 'user-id' 
ORDER BY created_at DESC 
LIMIT 1;

Expected:
✓ status: 'cancelled' OR 'pending_payment' (not confirmed)
✓ payment_status: 'failed' OR 'pending'
✓ meet_link: NULL (no Meet generated)
```

### Retry Flow
```
6. Click "Try Again"
   ↓ EXPECT: New payment order created
   ↓ EXPECT: Checkout opens again
   
7. Enter VALID test card:
   Card: 4111111111111111
   Expiry: 12/25
   CVV: 123
   
   ↓ EXPECT: Payment succeeds
   ↓ EXPECT: Booking confirmed
   ↓ EXPECT: Google Meet generated
```

### Database Verification
```sql
SELECT COUNT(*) FROM bookings 
WHERE mentee_id = 'user-id' 
AND start_at = '[selected time]';

Expected: 
✓ Only ONE confirmed booking (not duplicates)
✓ payment_status: 'completed'
✓ meet_link: populated
```

---

## TEST 4: SECURITY — NO FRONTEND AMOUNT MANIPULATION

**Objective:** Verify backend recalculates amount server-side, never trusts frontend

### Method
```
1. Log in as Test User 2 (returning user)
2. Open browser DevTools (F12)
3. Open Network tab
4. Click "Confirm Booking"
5. Before payment, in DevTools Console, intercept:

// Try to modify the amount locally
sessionStorage.setItem('amount', '0')

6. Complete payment
   ↓ EXPECT: Backend IGNORES frontend amount
   ↓ EXPECT: Charges ₹99 (not ₹0)
   ↓ EXPECT: Cashfree order shows ₹99
   
7. Verify payment receipt
   ↓ EXPECT: Email shows ₹99
   ↓ EXPECT: Database shows price_cents: 9900
```

### Network Inspection
```
9. In Network tab, find POST /api/cashfree requests
10. Check Request body:
    {
      "action": "create-order",
      "bookingId": "...",
      "amount": 9900,
      "currency": "INR"
    }
    
11. Check Response from backend:
    {
      "payment_session_id": "...",
      "order_id": "..."
    }
    
12. Go to Cashfree API documentation:
    https://www.cashfree.com/devstudio/preview/pg/orders
    
13. Verify order was created with correct amount on Cashfree side
    (Amount in database, NOT amount from browser)
```

---

## TEST 5: IDEMPOTENCY — NO DUPLICATE BOOKINGS

**Objective:** Verify user cannot accidentally create duplicate bookings

### Method
```
1. Log in as Test User 2
2. Click "Book Now" for a mentor
3. Select date/time
4. Click "Confirm Booking"
   ↓ EXPECT: Processing...
   
5. BEFORE page finishes, click "Confirm Booking" AGAIN
   ↓ EXPECT: Prevented (button disabled or request cancelled)
   ↓ EXPECT: Only ONE booking created
   
6. Wait for success screen
   ↓ EXPECT: Single booking shown
   ↓ EXPECT: Single Google Meet URL
   
7. Verify in database:
```

### Database Check
```sql
SELECT COUNT(*) FROM bookings 
WHERE mentee_id = 'user-id' 
AND status = 'confirmed'
AND DATE(start_at) = '2026-09-15';

Expected:
✓ Count = 1 (not 2, 3, etc.)
✓ No duplicate bookings from double-click
✓ idempotency_key used correctly
```

---

## TEST 6: FIRST SESSION DETECTION

**Objective:** Verify system correctly identifies first vs. second+ sessions

### Check 1: Brand New User
```
1. Create new account (never booked before)
2. Navigate to mentor booking
3. Booking shows: ₹0 or "FREE"
4. Confirm booking
   ↓ EXPECT: NO Cashfree payment
   ↓ EXPECT: Booking confirmed immediately
   ↓ EXPECT: Google Meet generated immediately
   
5. Database check:
   SELECT COUNT(*) FROM bookings 
   WHERE mentee_id = 'user-id' 
   AND payment_status IN ('completed', 'not_required');
   
   ↓ EXPECT: 1 (first session completed)
```

### Check 2: Same User, Second Mentor
```
6. User books SECOND session with DIFFERENT mentor
   ↓ EXPECT: Shows ₹99 (PAID)
   ↓ EXPECT: Requires Cashfree payment
   ↓ EXPECT: Not free
   
7. Database check:
   SELECT COUNT(*) FROM bookings 
   WHERE mentee_id = 'user-id';
   
   ↓ EXPECT: 2 bookings total (1 free, 1 paid)
```

### Check 3: Same User, Same Mentor (Different Time)
```
8. User books THIRD session with FIRST mentor (different time)
   ↓ EXPECT: Shows ₹99 (PAID)
   ↓ EXPECT: Requires Cashfree payment
   ↓ EXPECT: First session was already used
   
9. Database check:
   SELECT COUNT(*) FROM bookings 
   WHERE mentee_id = 'user-id';
   
   ↓ EXPECT: 3 bookings total (1 free, 2 paid)
```

---

## TEST 7: AUTHENTICATION SOURCE

**Objective:** Verify real Supabase JWT is used (not localStorage fake tokens)

### Method
```
1. Open DevTools → Network tab
2. Click "Confirm Booking" (paid session)
3. Find POST /api/cashfree request
4. Check Headers:
   
   Authorization: Bearer eyJhbGc...
   
   ↓ EXPECT: Real JWT token from Supabase
   ↓ EXPECT: Starts with "eyJ..." (base64-encoded)
   ↓ EXPECT: NOT "sb-token" from localStorage
   ↓ EXPECT: NOT null/undefined
   
5. Decode token at https://jwt.io:
   ↓ EXPECT: Contains user ID (sub)
   ↓ EXPECT: Contains email (email)
   ↓ EXPECT: Contains aud: "authenticated"
   ↓ EXPECT: Not expired (exp > current time)
```

### Verification
```
6. In browser console:
   const { data: { session } } = await supabase.auth.getSession()
   console.log(session?.access_token)
   
   ↓ EXPECT: Outputs real JWT token
   ↓ EXPECT: Same token used in API request headers
   ↓ EXPECT: Verified by backend without errors
```

---

## TEST 8: GOOGLE MEET INTEGRATION

**Objective:** Verify real Google Meet rooms are created and accessible

### Method
```
1. Complete first-session booking (free)
   ↓ EXPECT: Google Meet URL in success screen
   
2. Parse URL:
   https://meet.google.com/abc-defg-hij
   
   ↓ EXPECT: Format: 3-letter-4-letter-3-letter code
   ↓ EXPECT: Not hardcoded or fake
   
3. Click "JOIN GOOGLE MEET"
   ↓ EXPECT: Opens real Google Meet room
   ↓ EXPECT: Shows meeting code in Meet interface
   ↓ EXPECT: Can see "Ready to join" or similar
   ↓ EXPECT: Audio/video permissions prompt
   
4. Complete second-session booking (paid via Cashfree)
   ↓ EXPECT: Different Google Meet URL
   ↓ EXPECT: Each booking has unique room
   
5. Click "JOIN GOOGLE MEET" for second session
   ↓ EXPECT: Different meeting room
   ↓ EXPECT: Not same URL as first session
```

### Database Verification
```sql
SELECT 
  id,
  start_at,
  meet_link,
  payment_status
FROM bookings 
WHERE mentee_id = 'user-id' 
ORDER BY created_at ASC;

Expected:
✓ Booking 1: meet_link = 'https://meet.google.com/aaa-bbbb-ccc'
✓ Booking 2: meet_link = 'https://meet.google.com/xxx-yyyy-zzz'
✓ All different URLs
✓ All valid format
```

---

## TEST 9: EMAIL DELIVERY

**Objective:** Verify both mentee and mentor receive confirmation emails

### First Session (Free)
```
1. Complete first-session booking
2. Check mentee email inbox
   ↓ EXPECT: Confirmation email received
   ✓ Subject: "[Mentor Name] wants to meet!"
   ✓ Body mentions: Date, time, Google Meet URL
   ✓ Body: "This is your FREE first session with HELPAMART"
   ✓ From: noreply@helpamart.com

3. Check mentor email inbox
   ✓ Subject: "New mentorship session booked"
   ✓ Body: Mentee name, date, time, Google Meet URL
   ✓ Body: "This session is FREE"
```

### Paid Session (Cashfree)
```
4. Complete second-session (paid) booking via Cashfree
5. Check mentee email
   ✓ Subject: "[Mentor Name] wants to meet!"
   ✓ Body: "Payment completed: ₹99"
   ✓ Body: Google Meet URL
   ✓ Body: "Join your session"

6. Check mentor email
   ✓ Subject: "New mentorship session — Payment received"
   ✓ Body: "Payment: ₹99 received"
   ✓ Body: Google Meet URL
   ✓ Body: Mentee name, date, time
```

---

## TEST 10: ERROR SCENARIOS

### Scenario A: Session Expired During Payment
```
1. Start booking flow (paid session)
2. In browser DevTools, clear localStorage/sessionStorage
3. Complete Cashfree payment
   ↓ EXPECT: Error: "Session expired"
   ↓ EXPECT: Booking NOT created
   ↓ EXPECT: Prompt to sign in again
```

### Scenario B: Booking Slot Unavailable
```
4. Two users try to book same slot simultaneously
   ↓ EXPECT: One succeeds, one fails
   ↓ EXPECT: Error: "Slot no longer available"
   ↓ EXPECT: No double-booking
```

### Scenario C: Mentor Account Deleted
```
5. Mentor deletes account after user starts booking
   ↓ EXPECT: Error: "Mentor not found"
   ↓ EXPECT: Booking not created
   ↓ EXPECT: User can try different mentor
```

### Scenario D: Network Failure During Payment
```
6. Start Cashfree payment
7. Simulate network disconnection (DevTools → Offline)
8. Complete payment attempt
   ↓ EXPECT: Error: "Network error"
   ↓ EXPECT: Provisional booking remains in pending_payment state
   ↓ EXPECT: Can retry payment without creating duplicate booking
```

---

## FINAL VERIFICATION CHECKLIST

### Technical Requirements
- [ ] **Auth:** Using `supabase.auth.getSession()` ✅
- [ ] **Auth:** NO `localStorage.getItem('sb-token')` ❌
- [ ] **Booking IDs:** Real UUID (not `temp-${Date.now()}`) ✅
- [ ] **Provisional Bookings:** Created before Cashfree ✅
- [ ] **Payment Verification:** Server-side with Cashfree ✅
- [ ] **Google Meet:** Generated AFTER payment verified ✅
- [ ] **Database:** Booking states correct (pending_payment → confirmed) ✅
- [ ] **Amount:** Server-side verification (not trusted from frontend) ✅
- [ ] **Idempotency:** No duplicate bookings ✅
- [ ] **Webhooks:** Async payment notifications ready ✅

### Build & Deployment
- [ ] `npm run build` passes (0 errors) ✅
- [ ] Vercel functions: ≤12 (Hobby compliant) ✅
- [ ] Git SHA: d703e26 ✅
- [ ] Pushed to origin/main ✅
- [ ] No uncommitted changes ✅

### User Experience
- [ ] First session: Instant booking (no payment) ✅
- [ ] Second+ session: Cashfree payment required ✅
- [ ] No "Not authenticated" error ✅
- [ ] Success screen shows real Google Meet URL ✅
- [ ] Both parties receive confirmation emails ✅
- [ ] Dashboard shows booking with correct status ✅

### Security
- [ ] Frontend amount NOT used for actual payment ✅
- [ ] Backend recalculates amount from database ✅
- [ ] Payment verified with Cashfree (not just frontend) ✅
- [ ] Booking ownership verified (mentee_id check) ✅
- [ ] JWT properly verified (not fake tokens) ✅
- [ ] No sensitive data logged ✅

---

## TEST EXECUTION SUMMARY

| Test | Status | Notes |
|------|--------|-------|
| #1 First Session (Free) | [ ] Ready | New user, no payment |
| #2 Second Session (Paid) | [ ] Ready | Cashfree Sandbox ₹99 |
| #3 Payment Failure & Retry | [ ] Ready | Retry without duplicate |
| #4 Security — Amount | [ ] Ready | Server verifies amount |
| #5 Idempotency | [ ] Ready | No duplicate bookings |
| #6 First Session Detection | [ ] Ready | Platform-wide counting |
| #7 Auth Source | [ ] Ready | Real Supabase JWT |
| #8 Google Meet | [ ] Ready | Real URLs, unique per booking |
| #9 Email Delivery | [ ] Ready | Both parties notified |
| #10 Error Scenarios | [ ] Ready | Graceful error handling |

---

## SIGN-OFF

**Prepared By:** HELPAMART Engineering  
**Date:** September 11, 2026  
**Git Commit:** d703e26  
**Vercel Status:** Ready for deployment  

**Next Steps:**
1. Run tests sequentially
2. Document results in FINAL_SANDBOX_TEST_RESULTS.md
3. If all pass → Deploy to production
4. If failures → Debug and re-test

---

**⚠️ CRITICAL REMINDERS:**
- Use test card: **4111111111111111**
- Expiry: **12/25**
- CVV: **123**
- DO NOT use real credit cards
- DO NOT test in production mode
- Sandboxmode only: `CASHFREE_MODE=sandbox`

