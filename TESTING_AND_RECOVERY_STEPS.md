# Testing the Fix & Recovering Existing Orders

## Summary

This document provides step-by-step instructions to:
1. Verify the fix works for new payment attempts
2. Investigate why existing payments weren't found
3. Recover any genuinely-paid orders

---

## Phase 1: Verify the Fix Works (Test Cases)

### Test Case 1: Idempotency Detection
**Objective:** Confirm that restarting payment flow for same session reuses existing booking

**Steps:**
1. Navigate to https://www.helpamart.com/find-mentor
2. Select a mentor that requires paid session
3. Click "Book Session" → Completes booking flow → Sees Cashfree checkout
4. **DO NOT COMPLETE PAYMENT** - Instead, go back (click browser back or close tab)
5. Navigate back to same mentor booking page
6. Click "Book Session" again for SAME session slot
7. **Check server logs:**
   ```
   [CASHFREE] RETRY DETECTED: Reusing existing pending booking: {same-booking-id-as-before}
   [CASHFREE] Existing Cashfree order ID: BOOK-{same-order-id-as-before}
   ```

**Expected Outcome:**
- Same booking ID returned
- Same order ID returned (not a new one)
- Logs show "RETRY DETECTED" message

**Success Criteria:** Order ID stays the same across retries ✓

---

### Test Case 2: Payment Verification After Completion
**Objective:** Confirm verification finds payments after actual payment completion

**Prerequisites:**
- Have a test Cashfree account with sandbox credentials configured
- Fresh provisional booking in database with pending payment status

**Steps:**
1. Initiate paid booking through BookingFlow
2. Complete payment in Cashfree sandbox environment (use test card)
3. Browser redirected to: `/booking-payment-result?order_id=BOOK-{xxxxx}-{timestamp}`
4. Wait 2-3 seconds (allow webhook processing)
5. **Check Vercel logs:**
   ```
   [CASHFREE] ✅ SUCCESSFUL payment found
   [VERIFY-PAYMENT] Booking confirmed
   ```

**Expected Outcome:**
- Booking status changes from 'pending' to 'confirmed'
- Payment status changes from 'pending' to 'completed'
- Google Meet link generated
- User sees success page with "You're booked" + Meet link

**Success Criteria:** Payment verified and booking confirmed ✓

---

## Phase 2: Investigate Existing Orders

### Step 1: Verify Bookings Exist in Database

**Query:**
```sql
SELECT 
  id,
  mentee_id,
  mentor_id,
  cashfree_order_id,
  payment_status,
  status,
  price_cents,
  currency,
  created_at
FROM bookings
WHERE cashfree_order_id IN (
  'BOOK-A185BCD1-1791560103932',
  'BOOK-DC067700-1791556844233',
  'BOOK-FE23307C-1791555302505'
)
ORDER BY created_at DESC;
```

**Expected Result:**
```
id                                   | mentee_id          | cashfree_order_id                  | payment_status | status
a185bcd1-b081-469f-adf7-da87692cb4da | (user-uuid)        | BOOK-A185BCD1-1791560103932        | pending        | pending
```

**What to record:**
- [ ] Booking exists in database?
- [ ] Booking has cashfree_order_id set?
- [ ] Booking status: pending/confirmed/cancelled?
- [ ] Payment status: pending/completed/failed?
- [ ] Amount: 9900 cents (₹99)?
- [ ] Currency: INR?
- [ ] Creation timestamp?

---

### Step 2: Query Cashfree Directly

**Objective:** Check what Cashfree knows about each order

**Method 1: Using Browser DevTools (if you have Cashfree dashboard access)**
1. Log in to Cashfree dashboard: https://dashboard.cashfree.com
2. Navigate to Orders/Payments section
3. Search for each order ID:
   - `BOOK-A185BCD1-1791560103932`
   - `BOOK-DC067700-1791556844233`
   - `BOOK-FE23307C-1791555302505`
4. For each order, record:
   - [ ] Order exists? (Found / Not Found)
   - [ ] Order status in Cashfree? (CREATED / ACTIVE / PAID / FAILED / CANCELLED / EXPIRED)
   - [ ] Payment attempts? (Number of attempts)
   - [ ] Each payment's status? (SUCCESS / PENDING / FAILED / DECLINED / etc)
   - [ ] Payment amount? (Should be 99 INR)
   - [ ] Payment timestamp?

**Method 2: Using our Diagnostic Script (if you have server access)**

Run the test script we created:
```bash
cd /Users/theaditronik/Desktop/HELPAAY
CASHFREE_APP_ID=your_app_id CASHFREE_SECRET_KEY=your_secret_key node test-cashfree-query.js
```

This will output:
```
📋 Querying order: BOOK-A185BCD1-1791560103932
─────────────────────────────────────────

✅ GET Order Response (HTTP 200):
{
  "order_id": "BOOK-A185BCD1-1791560103932",
  "order_status": "PAID",  ← Key field
  "order_amount": 99,
  "order_currency": "INR",
  ...
}

✅ GET Payments Response (HTTP 200):
{
  "payments": [
    {
      "cf_payment_id": "123456789",
      "payment_status": "SUCCESS",  ← Key field
      "payment_amount": "99.00",
      "payment_currency": "INR",
      "payment_time": "2026-09-11T13:35:00Z"
    }
  ]
}
```

**What to record:**
- [ ] Order exists? (HTTP 200 = Yes, HTTP 404 = No)
- [ ] Order status in Cashfree?
- [ ] Payment attempts in response?
- [ ] Each payment's status?

---

### Step 3: Match Booking to Payment

For each order that has successful payments in Cashfree:

**Record:**
1. Booking ID from database: `{booking-id}`
2. Order ID from database: `{order-id}`
3. Payment status in Cashfree: `{payment_status}`
4. Payment amount in Cashfree: `{payment_amount}`
5. Mentee email: `{mentee-email}`
6. Mentor name: `{mentor-name}`
7. Session time: `{start_at} - {end_at}`

**Match verification:**
- [ ] Booking order ID matches Cashfree order ID?
- [ ] Payment amount matches booking price (9900 cents = 99 INR)?
- [ ] Currency matches (INR)?
- [ ] Mentee ID matches payment customer?

---

## Phase 3: Recovery

### For Each Confirmed Successful Payment

**Objective:** Update booking in database and trigger finalization (Meet link generation, emails)

#### Step 1: Update Booking Status

If Cashfree confirms `payment_status = "SUCCESS"`, update database:

```sql
UPDATE bookings
SET
  payment_status = 'completed',
  status = 'confirmed',
  paid_at = NOW(),
  updated_at = NOW()
WHERE cashfree_order_id = 'BOOK-A185BCD1-1791560103932'
  AND mentee_id = '{mentee-uuid}'
  AND payment_status = 'pending';
```

**Verify:**
```sql
SELECT id, status, payment_status, paid_at FROM bookings
WHERE cashfree_order_id = 'BOOK-A185BCD1-1791560103932';
```

Expected:
```
id       | status    | payment_status | paid_at
{uuid}   | confirmed | completed      | 2026-09-11T13:35:00Z
```

#### Step 2: Trigger Book Finalization

Call the finalization endpoint to generate Meet link and send emails:

**Using curl:**
```bash
curl -X POST http://localhost:8787/api/book-finalize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {supabase-jwt-token}" \
  -d '{"bookingId": "{booking-uuid}"}'
```

**Using Vercel logs:**
Check logs after update for:
```
[BOOK-FINALIZE] Generating Google Meet link for booking: {booking-id}
[BOOK-FINALIZE] Meet link created: https://meet.google.com/...
[BOOK-FINALIZE] Sending confirmation emails
[BOOK-FINALIZE] SUCCESS: Booking finalized
```

#### Step 3: Verify Recovery

**In database:**
```sql
SELECT 
  id,
  status,
  payment_status,
  meet_link,
  paid_at,
  updated_at
FROM bookings
WHERE id = '{booking-uuid}';
```

Expected:
```
id       | status    | payment_status | meet_link                                  | paid_at               | updated_at
{uuid}   | confirmed | completed      | https://meet.google.com/... | 2026-09-11T13:35:00Z | 2026-09-11T14:00:00Z
```

**Check emails:**
- [ ] Mentee received confirmation email with:
  - Mentor name
  - Session date/time
  - Google Meet link
  - Amount paid (₹99)
  
- [ ] Mentor received notification email with:
  - Student name
  - Session date/time
  - Google Meet link

**Check dashboards:**
- [ ] Mentee's `/dashboard/bookings` shows the booking as "Confirmed"
- [ ] Mentor's `/dashboard/mentor/bookings` shows the booking as "Confirmed"

---

## Summary Checklist

### Investigation
- [ ] Connected to Supabase/database
- [ ] Found all 3 existing orders in bookings table
- [ ] Queried Cashfree for each order
- [ ] Recorded order status and payment status for each
- [ ] Identified which payments were actually successful

### Recovery (if payments succeeded)
- [ ] Updated booking statuses in database
- [ ] Triggered book-finalize for each recovered booking
- [ ] Verified Meet links were generated
- [ ] Verified confirmation emails were sent
- [ ] Verified mentee/mentor dashboards show confirmed bookings

### Validation (for fix going forward)
- [ ] Tested retry flow - booking reused correctly
- [ ] Tested new payment completion - verified successfully
- [ ] Checked logs for expected messages
- [ ] Confirmed no duplicate bookings created

---

## Troubleshooting

### If booking lookup fails:
- Check mentee_id matches authenticated user
- Check booking hasn't been deleted
- Check cashfree_order_id column exists in bookings table
- Verify Supabase service role key permissions

### If Cashfree query fails:
- Verify CASHFREE_APP_ID and CASHFREE_SECRET_KEY are correct
- Check they're for LIVE environment (not sandbox)
- Verify API version is correct (2025-01-01)
- Check network connectivity to api.cashfree.com

### If Meet link generation fails:
- Check Google service account credentials in stored_secrets table
- Verify Google Meet API is enabled in Google Cloud Console
- Check service account has necessary permissions
- Verify private_key format is valid PEM

### If emails aren't sent:
- Check SMTP credentials in environment
- Verify SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS are set
- Check mentee/mentor email addresses in database
- Review SMTP server logs for delivery errors

---

## Need Help?

If you encounter issues:
1. Share server logs (redact sensitive data)
2. Share database query results
3. Share Cashfree dashboard screenshots
4. Describe the exact error message

We can then diagnose and implement additional recovery steps if needed.

---

## Timeline

- **Immediate:** Deploy fix to production
- **Within 1 hour:** Verify fix works with new bookings
- **Within 24 hours:** Investigate existing orders in Cashfree
- **Within 48 hours:** Recover confirmed payments
- **Ongoing:** Monitor for "RETRY DETECTED" logs to confirm fix is working

---

## Success Criteria

✅ **Fix is working if:**
- Retried payment flows show "RETRY DETECTED" in logs
- Same order ID used on retries (no new orders created)
- New bookings verify payments correctly

✅ **Existing orders recovered if:**
- All genuinely-paid bookings are confirmed in database
- All mentees received confirmation emails
- All mentors received notification emails
- All bookings appear confirmed in dashboards
- No duplicate bookings were created

✅ **Issue resolved if:**
- No more "Payment Pending" stuck states for new bookings
- All paid bookings auto-confirm within 2 minutes
- User can see correct Meet links for all confirmed bookings
