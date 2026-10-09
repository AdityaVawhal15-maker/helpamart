# DEPLOYMENT & VERIFICATION CHECKLIST

**Date:** September 11, 2026  
**Latest Commit:** 332e905  
**Branch:** origin/main (pushed)  

---

## Step 1: Wait for Vercel Deployment

**What to do:**
- [ ] Go to Vercel Dashboard: https://vercel.com
- [ ] Select HELPAMART project
- [ ] Wait for deployment of commit **332e905** to show **Ready** status
- [ ] Check that deployment includes `/api/cashfree-verify-payment` function

**Expected Time:** 2-5 minutes after commit push

**How to verify:**
```
✓ Deployments tab shows: "332e905 Ready"
✓ Functions tab shows: /api/cashfree-verify-payment (up-to-date)
```

---

## Step 2: Test on Production

**Do NOT initiate another payment.** Use existing order ID.

### 2.1 Load the Payment Result Page

**URL:**
```
https://helpamart.com/booking-payment-result?order_id=BOOK-A185BCD1-1791560103932
```

**Expected Result:**
```
✓ Page loads without error
✓ Response shows amount: 9900 (not 0)
✓ Still shows paymentStatus: "pending" (this is OK if Cashfree settlement is ongoing)
```

**If amount is still 0:**
- Deployment may not be complete
- Try a hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows)
- Wait another minute and retry

### 2.2 Check Browser Console

**Open DevTools → Console**

**Look for logs starting with:**
```
[PAYMENT-RESULT] Verifying payment for order: BOOK-A185BCD1-...
[PAYMENT-RESULT] Verification result: {...}
```

**Copy these logs and save them for debugging**

---

## Step 3: Check Vercel Logs

**Where:** Vercel Dashboard → Project → Deployments → [332e905] → Logs

**What to look for:**

### Log Entry: Payment Verification Started
```
[VERIFY-PAYMENT] Request received
[VERIFY-PAYMENT] Verifying payment for order: BOOK-A185BCD1-1791560103932 user: [user-id]
[VERIFY-PAYMENT] Checking Cashfree for payment status...
```

### Log Entry: Cashfree API Response (CRITICAL)
```
[VERIFY-PAYMENT] === CASHFREE API RESPONSE ===
[VERIFY-PAYMENT] Total payment attempts: 1
[VERIFY-PAYMENT] Attempt 1:
  - cf_payment_id: [ID]
  - payment_status: [STATUS]  ← ⭐ WHAT WE NEED TO SEE
  - payment_amount: 99.00
  - payment_currency: INR
  - payment_method: [METHOD]
  - payment_time: [TIMESTAMP]
[VERIFY-PAYMENT] === END CASHFREE RESPONSE ===
```

### Key Question: What is the `payment_status` value?

**If it shows:**

| Value | Meaning | Action |
|-------|---------|--------|
| SUCCESS | ✅ Payment succeeded | Should map to "completed" |
| AUTHORIZED | ✅ Payment authorized | Should map to "completed" |
| CHARGED | ✅ Payment charged | Should map to "completed" |
| SETTLED | ✅ Payment settled | Should map to "completed" |
| PENDING | ⏳ Still processing | Normal during settlement |
| FAILED | ❌ Payment failed | Should map to "failed" |
| CANCELLED | ❌ User cancelled | Should map to "failed" |
| DECLINED | ❌ Bank declined | Should map to "failed" |

**If you see SUCCESS/AUTHORIZED/CHARGED/SETTLED:**
- The fix worked!
- But Cashfree is returning pending for subsequent queries (settlement delay)
- Retry the test in 5-10 minutes

**If you still see PENDING:**
- Payment may genuinely be pending in Cashfree (normal)
- Cashfree takes 5-30 minutes for settlement
- Webhook will confirm when settled
- Then booking auto-finalizes

---

## Step 4: Verify Booking Details

**In Supabase Dashboard:**

```sql
SELECT 
  id,
  price_cents,
  payment_status,
  status,
  cashfree_order_id,
  meet_link,
  paid_at
FROM bookings
WHERE cashfree_order_id = 'BOOK-A185BCD1-1791560103932';
```

**Expected result for PENDING payment:**
```
id: a185bcd1-b081-469f-adf7-da87692cb4da
price_cents: 9900
payment_status: pending
status: provisional
cashfree_order_id: BOOK-A185BCD1-1791560103932
meet_link: NULL
paid_at: NULL
```

**If payment succeeded in Cashfree, after next verification attempt:**
```
id: a185bcd1-b081-469f-adf7-da87692cb4da
price_cents: 9900
payment_status: completed       ← Changed
status: confirmed               ← Changed
cashfree_order_id: BOOK-A185BCD1-1791560103932
meet_link: https://meet.google.com/...  ← Generated
paid_at: 2026-09-11T...         ← Set
```

---

## Step 5: Wait for Webhook Confirmation

**If payment is pending in Cashfree:**

1. **Wait 5-10 minutes** for Cashfree to settle
2. **Cashfree webhook** will automatically call `/api/cashfree-webhook`
3. **Webhook updates** booking to confirmed status
4. **Booking finalization** runs (generates Meet link, sends emails)

**How to verify webhook was called:**

**In Vercel logs, look for:**
```
[CASHFREE-WEBHOOK] Payment webhook received
[CASHFREE-WEBHOOK] Order: BOOK-A185BCD1-1791560103932
[CASHFREE-WEBHOOK] Payment status: SUCCESS
```

**In Supabase, check for updates:**
- `payment_status` changed to "completed"
- `status` changed to "confirmed"
- `meet_link` populated
- `paid_at` set

---

## Step 6: Verify Success Page

**After webhook confirms payment (or if payment succeeded immediately):**

**Load the booking result page again:**
```
https://helpamart.com/booking-payment-result?order_id=BOOK-A185BCD1-1791560103932
```

**Expected display:**
```
✓ "You're booked."
✓ Mentor name: Baibhav Kumar
✓ Date/time: Oct 31, 2026, 6:45 AM - 7:15 AM Asia/Calcutta
✓ Amount: ₹99 — Paid
✓ Button: "JOIN GOOGLE MEET"
✓ Button: "VIEW MY BOOKINGS"
✓ Button: "VIEW SESSION DETAILS"
✓ Valid Google Meet URL displayed/clickable
```

---

## Step 7: Check Emails

**Mentee should receive:**
- Subject: "Your mentorship session is confirmed! ✓"
- Content includes: Mentor name, date/time, Google Meet link

**Mentor should receive:**
- Subject: "New student confirmed: [Student Name]"
- Content includes: Student name, date/time, Google Meet link

**If emails not received after 5 minutes:**
- Check Supabase for email_logs (if tracked)
- Check book-finalize logs for email errors
- Manually trigger email resend if needed

---

## Step 8: Check Dashboards

**Login as mentee:**
- [ ] Dashboard → My Bookings shows the booking
- [ ] Status shows: "Confirmed" (not Pending)
- [ ] Can see mentor name, date/time, and Meet link

**Login as mentor:**
- [ ] Dashboard → My Bookings shows the booking
- [ ] Status shows: "Confirmed"
- [ ] Can see mentee name, date/time, and Meet link

---

## Step 9: Handle Other Order IDs

**Check the other two orders:**
- BOOK-DC067700-1791556844233
- BOOK-FE23307C-1791555302505

**For each:**
- [ ] Load the booking-payment-result page
- [ ] Verify amount shows (not 0)
- [ ] Check payment status
- [ ] If succeeded, verify booking was finalized
- [ ] If pending, wait and check webhook

---

## Step 10: Document Findings

**After all tests, record:**

```markdown
## Test Results — [Date]

### Commit 332e905 Deployment
- Vercel deployment status: [Ready/Failed]
- Deployment completed at: [Time]

### Test 1: Amount Display Fix
- Response shows amount: 9900? YES/NO
- Was showing 0 before, now shows 99? YES/NO

### Test 2: Payment Status
- Cashfree API returns payment_status: [VALUE]
- Expected mappings: SUCCESS→completed / PENDING→pending / FAILED→failed

### Test 3: Booking Status
- DB shows payment_status: [pending/completed]
- DB shows status: [provisional/confirmed]
- Meet link generated? YES/NO

### Test 4: Success Page
- After webhook/finalization, success page loads? YES/NO
- Displays amount as ₹99 — Paid? YES/NO
- Google Meet link functional? YES/NO

### Test 5: Email Notifications
- Mentee email received? YES/NO
- Mentor email received? YES/NO
- Emails include Meet link? YES/NO

### Test 6: Dashboards
- Mentee sees booking in My Bookings? YES/NO
- Mentor sees booking in My Bookings? YES/NO
- Status shows "Confirmed"? YES/NO

### Conclusion
- [ ] All tests passed - issue resolved
- [ ] Some tests failed - need further investigation
- [ ] Payment genuinely pending in Cashfree - working as designed
```

---

## Troubleshooting

### Problem: Response still shows amount=0

**Cause 1: Deployment not complete**
- Solution: Wait 2-3 minutes and refresh
- Use Cmd+Shift+R (hard refresh) to bypass cache

**Cause 2: Old code cached**
- Solution: Verify Vercel shows commit 332e905 as current deployment
- Check /api/cashfree-verify-payment in Vercel Functions list

**Cause 3: Database not returning price_cents**
- Solution: Run the Supabase query to check if column exists
- May need to apply migrations if using older database version

### Problem: paymentStatus still shows "pending"

**Cause 1: Cashfree genuinely still settling**
- This is normal behavior
- Wait 5-30 minutes for webhook confirmation
- Check logs for webhook success

**Cause 2: Status code not recognized**
- Solution: Check Vercel logs for exact `payment_status` value Cashfree returns
- If it's something not in our recognition list (SUCCESS, AUTHORIZED, CHARGED, SETTLED, FAILED, DECLINED), create an issue

**Cause 3: Payment actually failed in Cashfree**
- Check Cashfree logs in Cashfree Dashboard
- Booking should be marked as cancelled
- User needs to attempt payment again

### Problem: Meet link is null

**Cause 1: Booking not yet confirmed**
- Meet link generated only after `payment_status = "completed"`
- Wait for webhook confirmation

**Cause 2: Google Meet generation failed**
- Check book-finalize logs for errors
- Verify Google Service Account credentials in stored_secrets

**Cause 3: Finalization never ran**
- Check if webhook was called
- Check if manual finalize endpoint returned an error

---

## Success Criteria

✅ **Issue considered resolved when:**

1. **Production page shows ₹99 amount** (not 0)
2. **If payment pending in Cashfree:** Webhook settles payment and finalizes booking
3. **If payment succeeded in Cashfree:** Status correctly maps and booking finalizes
4. **Success page displays correctly** with:
   - Mentor name
   - Date/time/timezone
   - ₹99 — Paid
   - Valid Google Meet link
5. **Both dashboards show booking as confirmed**
6. **Both users received confirmation emails with Meet link**
7. **No duplicate charges or bookings created**

---

**⏰ Estimated Time:** 15-20 minutes after Vercel deployment  
**🎯 Success Indicator:** Amount showing as 9900, success page displaying correctly  
**📋 Keep this checklist for reference and document results**
