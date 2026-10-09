# HELPAMART — Manual Payment Recovery Guide

**Purpose:** Investigate and recover existing ₹99 payments that may have succeeded on Cashfree but are stuck in "Payment Pending" status in HELPAMART.

**Order IDs to Investigate:**
- BOOK-A185BCD1-1791560103932
- BOOK-DC067700-1791556844233
- BOOK-FE23307C-1791555302505

---

## Step 1: Query Cashfree API Directly

**Objective:** Determine authoritative payment status from Cashfree's backend, independent of HELPAMART's state.

### Prerequisites

You need:
- Cashfree Live App ID
- Cashfree Live Secret Key
- An API client (curl, Postman, or similar)

### Query Each Order

**Endpoint:** `GET https://api.cashfree.com/pg/orders/{orderId}/payments`

**Headers:**
```
x-api-version: 2025-01-01
x-client-id: {CASHFREE_APP_ID}
x-client-secret: {CASHFREE_SECRET_KEY}
```

**Example curl command:**
```bash
curl -X GET "https://api.cashfree.com/pg/orders/BOOK-A185BCD1-1791560103932/payments" \
  -H "x-api-version: 2025-01-01" \
  -H "x-client-id: YOUR_APP_ID" \
  -H "x-client-secret: YOUR_SECRET_KEY"
```

### Interpret Response

**Successful Response (200):**
```json
{
  "payments": [
    {
      "cf_payment_id": "12345678",
      "payment_status": "SUCCESS",
      "payment_amount": "99.00",
      "payment_currency": "INR",
      "payment_method": "UPI",
      "payment_gateway": "CASHFREE",
      "created_at": "2026-09-11T10:30:00Z"
    }
  ]
}
```

**What to Note:**
- `payment_status`: Should be one of: SUCCESS, FAILED, PENDING, USER_DROPPED, CANCELLED
- `payment_amount`: Should be "99.00" (in rupees, not paise)
- `payment_currency`: Should be "INR"
- `cf_payment_id`: Save this for reconciliation

---

## Step 2: Check Current State in HELPAMART Database

**Objective:** See what HELPAMART's database currently thinks about each booking.

### Supabase Query (via Dashboard or SQL)

**Table:** `bookings`

**Query:**
```sql
SELECT 
  id,
  cashfree_order_id,
  mentee_id,
  mentor_id,
  payment_status,
  status,
  meet_link,
  paid_at,
  start_at,
  end_at
FROM bookings
WHERE cashfree_order_id IN (
  'BOOK-A185BCD1-1791560103932',
  'BOOK-DC067700-1791556844233',
  'BOOK-FE23307C-1791555302505'
)
ORDER BY created_at DESC;
```

### Interpret Results

For each booking:
- `payment_status`: Should be "completed" if paid, "pending" if unpaid
- `status`: Should be "confirmed" if paid, "provisional" if unpaid
- `meet_link`: Should be populated if booking is finalized
- `paid_at`: Should have a timestamp if paid

### Example Result (STUCK STATE)
```
id                           cashfree_order_id           payment_status  status       meet_link
e4c7-9f2a-...               BOOK-A185BCD1-...          pending         provisional  NULL
```

This indicates: Cashfree order created, but NOT finalized.

### Example Result (RECOVERED STATE)
```
id                           cashfree_order_id           payment_status  status       meet_link
e4c7-9f2a-...               BOOK-A185BCD1-...          completed       confirmed    https://meet.google.com/...
```

This indicates: Payment verified and finalized successfully.

---

## Step 3: Reconcile Cashfree Status with Database Status

### Match Results

| Cashfree Status | DB Status | Action |
|---|---|---|
| SUCCESS | pending/provisional | ✅ Payment succeeded but DB not updated → RECOVER |
| SUCCESS | completed/confirmed | ✓ Payment succeeded and DB updated → VERIFIED |
| PENDING | pending/provisional | ⏳ Payment truly pending → WAIT OR RETRY |
| FAILED | pending/provisional | ✗ Payment failed in Cashfree → CANCEL BOOKING |
| FAILED | cancelled | ✓ Payment failed and booking cancelled → VERIFIED |

### Example Reconciliation

**Order BOOK-A185BCD1-1791560103932:**

Cashfree API response:
```
payment_status: "SUCCESS"
payment_amount: "99.00"
cf_payment_id: "CF123456789"
```

Database query:
```
payment_status: "pending"
status: "provisional"
meet_link: NULL
```

**Conclusion:** ❌ MISMATCH — Payment succeeded on Cashfree but NOT updated in HELPAMART database. **NEEDS RECOVERY.**

---

## Step 4: Manual Recovery (If Payment Succeeded but DB Shows Pending)

**Objective:** Mark payment as completed and finalize the booking.

### Option A: Via Dashboard (If you have Supabase access)

1. **Login to Supabase Dashboard**
2. **Navigate to bookings table**
3. **Find the booking (by cashfree_order_id or booking id)**
4. **Edit the row:**
   - Set `payment_status` = "completed"
   - Set `status` = "confirmed"
   - Set `paid_at` = current timestamp

5. **Manually generate Google Meet link (if not present):**
   - If `meet_link` is NULL, you need to generate one
   - See Step 5 below

### Option B: Via API (Manual POST Request)

**Endpoint:** `/api/book-finalize`

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {VALID_JWT_TOKEN}"
}
```

**Body:**
```json
{
  "bookingId": "e4c7-9f2a-..."
}
```

**What happens:**
1. Verifies JWT token (identifies user)
2. Checks booking exists and payment_status = "completed"
3. Generates Google Meet link
4. Sends confirmation emails to mentee and mentor
5. Returns booking with meet_link

**Result:**
```json
{
  "booking": {
    "id": "e4c7-9f2a-...",
    "meetUrl": "https://meet.google.com/abc-defg-hij",
    "status": "confirmed",
    "payment_status": "completed"
  }
}
```

### Option C: Via Node.js Script (Advanced)

**File:** `scripts/recover-payment.js`

```javascript
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function recoverPayment(bookingId) {
  try {
    // 1. Check current state
    const { data: booking } = await db
      .from('bookings')
      .select('*')
      .eq('id', bookingId)
      .single();

    console.log('Current booking state:', booking);

    // 2. Verify Cashfree payment
    const cashfreeResponse = await fetch(
      `https://api.cashfree.com/pg/orders/${booking.cashfree_order_id}/payments`,
      {
        headers: {
          'x-api-version': '2025-01-01',
          'x-client-id': process.env.CASHFREE_APP_ID,
          'x-client-secret': process.env.CASHFREE_SECRET_KEY,
        }
      }
    );
    const cashfreeData = await cashfreeResponse.json();
    console.log('Cashfree status:', cashfreeData);

    // 3. If successful, update booking
    const successful = cashfreeData.payments?.find(p => p.payment_status === 'SUCCESS');
    if (successful) {
      const { error } = await db
        .from('bookings')
        .update({
          payment_status: 'completed',
          status: 'confirmed',
          paid_at: new Date().toISOString(),
        })
        .eq('id', bookingId);

      if (!error) {
        console.log('✓ Booking payment status updated to completed');
      } else {
        console.error('✗ Failed to update booking:', error);
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

// Usage
recoverPayment('e4c7-9f2a-...');
```

---

## Step 5: Generate Google Meet Links (If Missing)

**Objective:** If payment was recovered but `meet_link` is still NULL, generate the Google Meet link.

### Prerequisites

- Google Service Account credentials (already configured in `stored_secrets` table)
- The `meet_space_name` field populated in booking record

### Automatic (Preferred)

Call `/api/book-finalize` with valid JWT token (see Step 4, Option B).

### Manual (If endpoint fails)

**Contact Google Meet Admin Service directly:**

1. **Get Google Service Account credentials:**
   ```sql
   SELECT value FROM stored_secrets WHERE name = 'google_calendar';
   ```

2. **Use credentials to authenticate with Google Docs API**
3. **Create a new Docs document with sharing link**
4. **Extract the meeting link**
5. **Update booking record:**
   ```sql
   UPDATE bookings
   SET meet_link = 'https://meet.google.com/...'
   WHERE id = 'e4c7-9f2a-...';
   ```

---

## Step 6: Send Confirmation Emails (If Missing)

**Objective:** If booking is now finalized but emails weren't sent, send them retroactively.

### Check Email Status

**Table:** `email_logs` or similar (if you track sent emails)

```sql
SELECT * FROM email_logs WHERE booking_id = 'e4c7-9f2a-...';
```

### Manual Email Trigger

If `/api/book-finalize` didn't send emails (due to error), manually trigger them:

**Data needed for mentee email:**
```
Mentee name: from users table
Mentee email: from bookings.student_email
Mentor name: from mentors table
Start time: from bookings.start_at
Timezone: from bookings.timezone
Meet link: from bookings.meet_link
```

**Data needed for mentor email:**
```
Mentor name: from mentors table
Mentor email: from bookings.mentor_email
Mentee name: from users table
Start time: from bookings.start_at
Timezone: from bookings.timezone
Meet link: from bookings.meet_link
```

---

## Step 7: Verify Recovery Success

### Checklist

- [ ] Cashfree API shows `payment_status: "SUCCESS"`
- [ ] Database shows `payment_status: "completed"`, `status: "confirmed"`
- [ ] `meet_link` is populated with a valid Google Meet URL
- [ ] Mentee received confirmation email
- [ ] Mentor received confirmation email
- [ ] Booking appears in mentee's "My Bookings" dashboard
- [ ] Booking appears in mentor's "My Bookings" dashboard
- [ ] User can see booking with "₹99 Paid" on success page
- [ ] User can access Google Meet link

### Test on Production

1. **Login as mentee** (same user who made the payment)
2. **Go to Dashboard → My Bookings**
3. **Click on recovered booking**
4. **Verify all details are correct and meet link works**

---

## Step 8: Handle Duplicate Payments (If Multiple Orders Succeeded)

**Scenario:** Three orders all show SUCCESS on Cashfree for same mentee/mentor/time slot.

### Investigation

```sql
SELECT 
  id,
  mentee_id,
  mentor_id,
  start_at,
  cashfree_order_id,
  payment_status,
  created_at
FROM bookings
WHERE mentee_id = 'xxx' 
  AND mentor_id = 'yyy'
  AND DATE(start_at) = '2026-09-11'
ORDER BY created_at;
```

### Resolution

1. **Keep ONE booking** (usually the earliest one)
2. **Cancel other bookings:**
   ```sql
   UPDATE bookings
   SET status = 'cancelled', payment_status = 'failed'
   WHERE id IN ('booking-id-2', 'booking-id-3');
   ```
3. **Contact user:** "We detected duplicate payment attempts. We kept [1 booking], cancelled [2 others]. Please review your bank statement for any duplicate charges and contact your bank to request refunds if needed."
4. **Process refund** (if necessary):
   - Use Cashfree refund API
   - Note refund in internal records
   - Follow up with user

---

## Troubleshooting

### Issue: `/api/book-finalize` Returns 401 "Unauthorized"

**Cause:** JWT token validation failed (old bug, now fixed in commit 9de309c)

**Solution:** 
- Ensure production has deployed commit 9de309c
- Or generate a fresh JWT token and retry

### Issue: Google Meet Link Generation Fails

**Cause:** Google Service Account credentials misconfigured

**Solution:**
1. Check `stored_secrets` table for 'google_calendar' entry
2. Verify credentials have required scopes: `https://www.googleapis.com/auth/meetings.space.create`
3. If missing, re-upload Google credentials via admin panel

### Issue: Emails Not Sending

**Cause:** Email service down or credentials misconfigured

**Solution:**
1. Check email configuration in environment variables
2. Verify Nodemailer credentials
3. Check email logs for error details
4. Manually retry email sending

---

## Recovery Checklist

```
[ ] Step 1: Query Cashfree API for all three order IDs
[ ] Step 2: Check current database state for each booking
[ ] Step 3: Reconcile Cashfree status with database status
[ ] Step 4a: Update database payment_status to "completed" (if Cashfree shows SUCCESS)
[ ] Step 4b: Call /api/book-finalize to generate meet link and send emails
[ ] Step 5: Verify meet_link is populated
[ ] Step 6: Verify emails were sent
[ ] Step 7: Test on production (login as mentee, check bookings)
[ ] Step 8: Handle duplicate payments (if any)
[ ] Step 9: Document recovery results for user support
[ ] Step 10: Follow up with user - booking is now confirmed
```

---

## Support Communication Template

**If recovery is successful:**

```
Hi [Mentee Name],

Good news! Your ₹99 payment for mentorship with [Mentor Name] has been verified and confirmed. 

✓ Booking confirmed for: [Date] at [Time] [Timezone]
✓ Google Meet link is ready: [Link]
✓ Confirmation email sent

You can now:
- View your booking in My Bookings
- Access Google Meet at session time
- Reschedule if needed

Thank you for choosing HELPAMART!
```

**If duplicate payments detected:**

```
Hi [Mentee Name],

We detected multiple payment attempts for the same session. We've confirmed one booking and cancelled the others.

✓ Confirmed booking: [Booking ID] - [Date/Time]
✗ Cancelled bookings: [IDs]

If you were charged for the cancelled bookings, please check your bank statement. Contact your bank directly for refund requests. We're also working with Cashfree to process refunds on our end.

We apologize for this issue. This bug has been fixed in production.

Thank you!
```

---

**Last Updated:** 2026-09-11  
**Severity:** CRITICAL — Real payments stuck  
**Manual Recovery:** Required until Vercel deployment confirmed
