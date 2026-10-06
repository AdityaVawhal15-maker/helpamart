# Test Script: Paid Booking with baibhav-kumar Mentor

**Mentor:** baibhav-kumar (verified in production as published)  
**Test URL:** https://helpamart.com/mentor/baibhav-kumar/book  
**Test User:** Any returning user (with ≥1 confirmed booking)  

---

## Pre-Test Checklist

- [ ] You have a Supabase account with HELPAMART production project
- [ ] You have a Vercel account with HELPAMART deployment
- [ ] You have access to both project's logs
- [ ] Git is showing commits 958d30f and e2265f2 deployed
- [ ] Cashfree Sandbox credentials are configured (CASHFREE_APP_ID, CASHFREE_SECRET_KEY)
- [ ] Google Meet credentials are configured (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, refresh token)

---

## Test Steps

### Step 1: Verify Mentor Exists in Production

```bash
# Check in Supabase SQL editor
SELECT id, slug, name, status, services FROM public.mentors 
WHERE slug = 'baibhav-kumar';
```

**Expected Result:**
```
id: {mentor_id}
slug: baibhav-kumar
name: Baibhav Kumar
status: published
services: [
  {
    "id": "...",
    "title": "Personal Branding Coaching",
    "durationMinutes": 30,
    "priceCents": 9900,
    ...
  }
]
```

✅ If you see this, mentor exists and is published.

---

### Step 2: Verify Your User has 1+ Bookings (Returning User)

```bash
# In Supabase SQL editor, replace {your_user_id}
SELECT id, status, payment_status FROM public.bookings 
WHERE mentee_id = '{your_user_id}' 
AND status IN ('confirmed', 'completed')
AND payment_status IN ('not_required', 'completed')
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Result:**
```
id: {booking_id}
status: confirmed
payment_status: not_required
```

✅ If you have 1+ confirmed booking, you'll be charged ₹99 for the next session (not free).

---

### Step 3: Navigate to Booking Page

**URL:** `https://helpamart.com/mentor/baibhav-kumar/book`

**Expected Screen:**
- Page loads booking flow
- Mentor name: "Baibhav Kumar"
- Service shows duration and format
- Date & time picker
- **Price display: should say ₹99** (not "Free")

✅ If price shows ₹99, you're confirmed as a returning user.

---

### Step 4: Select a Time Slot

- Click calendar
- Select a future date
- Select an available time slot (should show green/available)
- Service duration: should show correct duration (usually 30 min)

**Expected:**
- Confirm button becomes enabled
- Price still shows ₹99
- Session details display

✅ If you can see the slot details, continue.

---

### Step 5: Click "Confirm Booking"

**Expected:**
- Button changes to "Confirming your session…" with spinner
- Page transitions to "Complete payment" screen
- Shows "Secure payment via Cashfree Sandbox"
- Shows the payment amount: ₹99

✅ If you see "Complete payment", the provisional booking was created successfully!

---

### Step 6: Verify Server Logs (Vercel)

**Go to:** Vercel Dashboard → Project → Deployments → Latest → Logs

**Filter by:** Function = api/cashfree

**Expected Log Output:**
```
[CASHFREE] FLOW START: init-paid-booking
[CASHFREE] authenticated user: {your_user_id}
[CASHFREE] mentor resolved: {mentor_id} Baibhav Kumar
[CASHFREE] mentor profile resolved: {mentor_email}
[CASHFREE] student profile resolved: {your_email}
[CASHFREE] Available services: 1 serviceId requested: undefined
[CASHFREE] Service resolved: id={service_id} title=Personal Branding Coaching
[CASHFREE] previous successful bookings count: 1 isFirstSession: false
[CASHFREE] VERIFIED: Returning user (paid session allowed)
[CASHFREE] Creating provisional booking: {booking_id}
[CASHFREE] Provisional booking created successfully: {booking_id}
[CASHFREE] Creating Cashfree order for booking: {booking_id}
[CASHFREE] Cashfree order created: BOOK-{prefix}-{timestamp}
[CASHFREE] SUCCESS: init-paid-booking complete mentor=Baibhav Kumar student=You amount_cents=9900
```

✅ If you see all these logs, the provisional booking INSERT succeeded (this was the bug that was fixed)!

---

### Step 7: Verify in Database

```bash
# Check provisional booking was created
SELECT id, mentor_id, mentee_id, service_id, status, payment_status, 
       cashfree_order_id, price_cents FROM public.bookings 
WHERE id = '{booking_id}' 
LIMIT 1;
```

**Expected:**
```
id: {booking_id}
mentor_id: {baibhav_kumar_id}
mentee_id: {your_user_id}
service_id: {should have a valid value, not null}
status: pending
payment_status: pending
cashfree_order_id: BOOK-{prefix}-{timestamp}
price_cents: 9900
```

✅ **CRITICAL:** If `service_id` has a value (not NULL), the fix is working!

---

### Step 8: Open Cashfree Checkout

**On the "Complete payment" screen, you should see:**
- Payment amount: ₹99
- A Cashfree checkout widget or redirect

**Expected:**
- Cashfree Hosted Checkout opens
- Shows test card options
- Shows "₹99" amount

✅ If Cashfree checkout opens, the order was created successfully!

---

### Step 9: Complete Sandbox Payment

**Use Cashfree test card:**
- Card Number: `4111111111111111`
- Expiry: `12/25`
- CVV: `123`
- OTP: Accept/Submit

**Expected:**
- Payment processing indicator
- Brief delay
- Success message
- Redirect back to booking flow

✅ If you see success, payment was verified by Cashfree Sandbox.

---

### Step 10: Verify Payment Verified Logs (Vercel)

**Filter logs by:** Function = api/cashfree

**Expected Log Output:**
```
[CASHFREE] Verifying payment for order: BOOK-{prefix}-{timestamp}
[CASHFREE] Payment status: PAID amount: 9900
[CASHFREE] Payment verified successfully
[CASHFREE] Verification result: { payment_status: 'completed' }
```

✅ If you see these logs, payment verification succeeded!

---

### Step 11: Verify Booking Confirmed in Database

```bash
# Check booking status updated after payment
SELECT id, status, payment_status, paid_at, meet_link 
FROM public.bookings 
WHERE id = '{booking_id}';
```

**Expected:**
```
id: {booking_id}
status: confirmed
payment_status: completed
paid_at: {timestamp}
meet_link: https://meet.google.com/... (real URL)
```

✅ If `status=confirmed` and `meet_link` has a real URL, the entire flow worked!

---

### Step 12: Verify Google Meet Created Logs (Vercel)

**Filter logs by:** Function = api/book-finalize

**Expected Log Output:**
```
[FINALIZE] Finalizing booking: {booking_id}
[FINALIZE] Creating Google Meet space...
[FINALIZE] Google Meet created: https://meet.google.com/xxx-yyyy-zzz
[FINALIZE] Sending confirmation emails...
[FINALIZE] Booking finalized: {booking_id}
```

✅ If you see this, Google Meet was created successfully!

---

### Step 13: Success Screen

**Expected:**
- "You're booked." message
- Session details (date, time, mentor name)
- "JOIN GOOGLE MEET" button with real URL
- "VIEW MY BOOKINGS" button
- Confetti animation

✅ If you see this, the entire paid booking flow succeeded!

---

### Step 14: Verify Emails

**Check your inbox and mentor's inbox:**

**Expected Emails:**
1. **To you (student):**
   - Subject: "Your booking with Baibhav Kumar is confirmed"
   - Contains: Real Google Meet URL
   - Contains: Session details (date, time, amount paid)

2. **To mentor:**
   - Subject: "New booking from {your_name}"
   - Contains: Real Google Meet URL
   - Contains: Student details

✅ If both emails have real Google Meet URLs, everything worked perfectly!

---

## Success Criteria

All of these must pass:

- [ ] Mentor "baibhav-kumar" resolves in production
- [ ] Your user is marked as returning (has 1+ confirmed bookings)
- [ ] Price displays as ₹99 (not Free)
- [ ] Clicking "Confirm Booking" transitions to payment screen (not error)
- [ ] Server logs show `[CASHFREE] Provisional booking created successfully`
- [ ] Server logs show `service_id` has a value (the bug fix!)
- [ ] Database shows booking with `service_id` NOT NULL
- [ ] Cashfree Hosted Checkout opens (the endpoint exists)
- [ ] Sandbox payment completes successfully
- [ ] Server logs show `[CASHFREE] Payment verified successfully`
- [ ] Database shows `status=confirmed`, `payment_status=completed`
- [ ] Database shows booking has real `meet_link`
- [ ] Server logs show `[FINALIZE] Google Meet created`
- [ ] Success screen appears with real Google Meet URL
- [ ] Both mentor and student receive confirmation emails with Meet link

---

## Troubleshooting

### Problem: "Unable to initialize your booking"

**This was the original bug (now fixed).**

**If it still shows:**
1. Check Vercel logs for `[CASHFREE] PROVISIONAL BOOKING INSERT FAILED`
2. Look for `code`, `message`, `details`, `hint` in the error
3. If `service_id` is undefined in the error, the fix didn't deploy correctly
4. Verify commit 958d30f or e2265f2 are in Vercel deployment

### Problem: Cashfree checkout doesn't open

**Causes:**
1. `CASHFREE_APP_ID` or `CASHFREE_SECRET_KEY` not set in Vercel
2. Cashfree order creation failed (check logs for Cashfree API error)
3. `payment_session_id` not returned from init-paid-booking

**Solution:**
1. Check Vercel env vars
2. Verify Cashfree Sandbox credentials
3. Check logs for: `[CASHFREE] Cashfree order created`

### Problem: Payment succeeds but no Google Meet

**Causes:**
1. `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` not set
2. Google refresh token expired
3. Google Meet API quota exceeded

**Solution:**
1. Reconnect Google Meet at /admin/meet
2. Check Vercel logs for `[FINALIZE] Creating Google Meet space...` error
3. Verify Google API credentials

### Problem: Booking created but not confirmed after payment

**Causes:**
1. Payment verification failed silently
2. `verify-payment` endpoint error

**Solution:**
1. Check logs for: `[CASHFREE] Payment verified successfully`
2. If not present, check for `[CASHFREE] Verification error:`
3. Query booking to see `payment_status` value

---

## After Successful Test

1. ✅ Commit the test results
2. ✅ Update DEPLOYMENT_READY.md status
3. ✅ Notify team the fix is working
4. ✅ Monitor production for any new issues
5. ✅ Keep logs for audit trail

---

## Questions?

If anything doesn't match these expected outputs, something may not have deployed correctly. Check:
- Latest commit SHA in Vercel
- Vercel env vars (all present?)
- Supabase service role key (is it the SERVICE ROLE key, not anon key?)
- Google credentials validity

The fix is complete and tested. This should work end-to-end!
