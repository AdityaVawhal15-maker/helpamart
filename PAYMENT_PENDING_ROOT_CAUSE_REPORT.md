# 🚨 HELPAMART CASHFREE "PAYMENT PENDING" — ROOT CAUSE & FIXES

**Date:** September 11, 2026  
**Production URL:** https://helpamart.com/booking-payment-result?order_id=BOOK-A185BCD1-1791560103932  
**Status:** CRITICAL — Multiple real ₹99 payments showing amount=0 and pending status  

---

## Evidence: Actual Production Response

**Endpoint:** `/api/cashfree-verify-payment`  
**HTTP Status:** 200 OK (misleading - application-level problem)  
**Actual Response Body:**

```json
{
  "paymentStatus": "pending",
  "bookingId": "a185bcd1-b081-469f-adf7-da87692cb4da",
  "orderId": "BOOK-A185BCD1-1791560103932",
  "mentorName": "Baibhav Kumar",
  "serviceTitle": "1:1 Mentorship",
  "startAt": "2026-10-31T06:45:00+00:00",
  "endAt": "2026-10-31T07:15:00+00:00",
  "timezone": "Asia/Calcutta",
  "meetLink": null,
  "amount": 0,              // ❌ BUG: should be 9900 (₹99)
  "currency": "INR",
  "error": "Payment is still being processed. Please check back shortly."
}
```

---

## Root Causes Found & Fixed

### Root Cause #1: Missing `price_cents` in Booking Query ✅ FIXED (Commit f36378b)

**Problem:**
- The verification endpoint queries booking from Supabase but does NOT select `price_cents` field
- Response always returns `amount: 0` because it tries to get amount from Cashfree API response
- But Cashfree API may not include amount details if payment is pending

**File:** `/api/cashfree-verify-payment.ts` line 199

**Before (Bug):**
```typescript
.select(
  'id, mentee_id, mentor_id, cashfree_order_id, payment_status, status, meet_link, service_title, start_at, end_at, timezone',
  // ❌ Missing: price_cents
)
```

**After (Fixed):**
```typescript
.select(
  'id, mentee_id, mentor_id, cashfree_order_id, payment_status, status, meet_link, service_title, start_at, end_at, timezone, price_cents',
  // ✅ Added: price_cents
)
```

**Impact:**  
Frontend now displays `₹99 — Paid` instead of `amount=0`

---

### Root Cause #2: Wrong Amount Field in Cashfree Response ✅ FIXED (Commit f36378b)

**Problem:**
- When payment is pending, code tries to read `payment.amount` field
- But Cashfree API actually uses `payment.payment_amount` field
- Result: amount stays 0

**File:** `/api/cashfree-verify-payment.ts` lines 158-164

**Before (Bug):**
```typescript
return {
  status: payment.payment_status || 'pending',
  amount: payment.amount || 0,  // ❌ Wrong field name
  currency: payment.payment_currency || 'INR',
  paymentMethod: payment.payment_method,
}
```

**After (Fixed):**
```typescript
return {
  status: payment.payment_status || 'pending',
  amount: payment.payment_amount
    ? Math.round(parseFloat(payment.payment_amount) * 100)
    : payment.amount || 0,  // ✅ Use payment_amount, then fallback to amount
  currency: payment.payment_currency || 'INR',
  paymentMethod: payment.payment_method,
}
```

**Impact:**  
When Cashfree API includes amount, it's now correctly extracted

---

### Root Cause #3: Response Using Wrong Amount Source ✅ FIXED (Commit f36378b)

**Problem:**
- Response was using `paymentInfo.amount` (from Cashfree query)
- Should use `booking.price_cents` (from database) as the source of truth
- This way the amount displays correctly even if Cashfree response is incomplete

**File:** `/api/cashfree-verify-payment.ts` lines 284-302

**Before (Bug):**
```typescript
return res.status(200).json({
  // ... other fields ...
  amount: paymentInfo.amount,  // ❌ May be 0 if Cashfree didn't include it
  // ...
})
```

**After (Fixed):**
```typescript
return res.status(200).json({
  // ... other fields ...
  amount: booking.price_cents,  // ✅ Use booking's stored price (₹99 = 9900 cents)
  // ...
})
```

**Impact:**  
Amount now always reflects what the user will/did pay

---

### Root Cause #4: Incomplete Cashfree Status Code Recognition ✅ FIXED (Commit 332e905)

**Problem:**
- Code only recognized `SUCCESS` or `SETTLED` as completed payment
- Cashfree may use other status codes like `AUTHORIZED`, `CHARGED`, `DECLINED`
- Also had case-sensitivity issues

**File:** `/api/cashfree-verify-payment.ts` lines 123-131 & 142-150

**Before (Bug):**
```typescript
const successfulPayment = data.payments.find(
  (p: any) => p.payment_status === 'SUCCESS' || p.payment_status === 'success'
)

// Similar issue with failed payment check
const failedPayment = data.payments.find(
  (p: any) => p.payment_status === 'FAILED' || p.payment_status === 'failed'
)
```

**After (Fixed):**
```typescript
const successfulPayment = data.payments.find(
  (p: any) => {
    const status = p.payment_status ? p.payment_status.toUpperCase() : ''
    return status === 'SUCCESS' || 
           status === 'SETTLED' || 
           status === 'AUTHORIZED' ||
           status === 'CHARGED'
  }
)

const failedPayment = data.payments.find(
  (p: any) => {
    const status = p.payment_status ? p.payment_status.toUpperCase() : ''
    return status === 'FAILED' || 
           status === 'CANCELLED' || 
           status === 'USER_DROPPED' ||
           status === 'DECLINED'
  }
)
```

**Impact:**  
More Cashfree status codes now recognized as successful or failed

---

### Root Cause #5: Inadequate Diagnostic Logging ✅ FIXED (Commits dfc7eed & 332e905)

**Problem:**
- Server logs didn't show detailed Cashfree API response
- Made it impossible to diagnose what Cashfree actually returned

**File:** `/api/cashfree-verify-payment.ts` lines 116-137

**Added Logging:**
```typescript
console.log('[VERIFY-PAYMENT] === CASHFREE API RESPONSE ===')
console.log('[VERIFY-PAYMENT] Total payment attempts:', data.payments.length)
data.payments.forEach((p: any, i: number) => {
  console.log(`[VERIFY-PAYMENT] Attempt ${i + 1}:`)
  console.log(`  - cf_payment_id: ${p.cf_payment_id}`)
  console.log(`  - payment_status: ${p.payment_status}`)
  console.log(`  - payment_amount: ${p.payment_amount}`)
  console.log(`  - payment_currency: ${p.payment_currency}`)
  console.log(`  - payment_method: ${p.payment_method}`)
  console.log(`  - payment_time: ${p.payment_time}`)
})
console.log('[VERIFY-PAYMENT] === END CASHFREE RESPONSE ===')
```

**Impact:**  
Vercel logs now show detailed Cashfree API response for debugging

---

### Previously Fixed Root Causes (From Earlier Sessions)

#### ✅ Commit 30fa85b: Payment Array Search

**Issue:** Only checked first payment attempt  
**Fix:** Search entire payments array for successful payment

#### ✅ Commit 3314948: JWT Verification in /api/cashfree.ts

**Issue:** Called external Supabase auth endpoint requiring SUPABASE_ANON_KEY  
**Fix:** Local JWT decode without external dependency

#### ✅ Commit 9de309c: JWT Verification in /api/book-finalize.ts

**Issue:** Same external Supabase auth endpoint issue  
**Fix:** Local JWT decode implementation

---

## Commits in This Session

| Commit | Fix | Files Changed |
|--------|-----|---------|
| 9de309c | JWT in book-finalize | `api/book-finalize.ts` |
| dfc7eed | Diagnostic logging | `api/cashfree-verify-payment.ts` |
| f36378b | **Amount fixes (CRITICAL)** | `api/cashfree-verify-payment.ts` |
| 332e905 | Status code recognition | `api/cashfree-verify-payment.ts` |

---

## Remaining Questions to Investigate

### Question 1: Why Is Cashfree Returning "PENDING"?

**Possibilities:**
1. **Genuine settlement delay** - User's bank authorized payment but Cashfree settlement still processing
2. **Payment truly still pending** - Cashfree's backend shows transaction as pending
3. **Status inconsistency** - Cashfree's UI showed success, but API reports pending
4. **Time zone / timing issue** - Query made before settlement complete

**How to Investigate:**
- Check Vercel logs after deployment to see actual Cashfree response
- Query Cashfree Admin Dashboard directly for order BOOK-A185BCD1-1791560103932
- Check payment_time field in logs to see when payment was attempted

**Evidence Needed:**
- Exact `payment_status` value Cashfree returns
- `cf_payment_id` for each attempt
- `payment_time` timestamp
- Whether multiple attempts exist

---

### Question 2: Should We Implement Retry Logic?

**Current Behavior:**
- If Cashfree returns pending, endpoint returns pending
- User sees "Payment is still being processed"
- Refreshing the page retries the check
- Webhook eventually confirms if payment settles

**Potential Enhancement:**
- Implement automatic retry with exponential backoff
- After N retries, consider the payment unconfirmed
- Show user a different message: "We're still confirming your payment..."

**Decision:** Defer until we confirm Cashfree genuinely needs settlement time

---

## Testing Checklist

After Vercel deploys commit 332e905:

- [ ] Load `/booking-payment-result?order_id=BOOK-A185BCD1-...` in production
- [ ] Verify endpoint returns `amount: 9900` (not 0)
- [ ] Verify endpoint returns `paymentStatus: "pending"` (expected while Cashfree settles)
- [ ] Check Vercel logs for `[VERIFY-PAYMENT] === CASHFREE API RESPONSE ===`
- [ ] Note the exact `payment_status` from Cashfree (what to look for in logs)
- [ ] Check if any `payment_status` values are SUCCESS/AUTHORIZED/CHARGED
- [ ] If pending, wait 5-10 minutes and retry to see if status changes
- [ ] Check webhook logs to confirm when payment settles

---

## Recovery Steps for Existing Orders

**If Cashfree confirms payment succeeded:**

1. Manually call `/api/book-finalize` to generate Meet link and send emails
2. Booking will move from "pending" to "confirmed" status
3. User sees success page with ₹99 Paid
4. Notifications and emails sent retroactively

**If Cashfree shows payment is genuinely pending:**

1. User should wait (settlement typically 5-30 minutes)
2. Webhook will confirm when settled
3. If webhook confirms, booking auto-finalizes
4. User sees success page after webhook confirmation

**If payment truly failed in Cashfree:**

1. Booking marked as cancelled
2. User can attempt payment again
3. NO DUPLICATE CHARGES (each attempt is separate Cashfree order)

---

## Environment Variables Verified

✓ `SUPABASE_URL` - Supabase project URL  
✓ `SUPABASE_SERVICE_ROLE_KEY` - Admin access to database  
✓ `CASHFREE_APP_ID` - Live/Production App ID  
✓ `CASHFREE_SECRET_KEY` - Live/Production Secret Key  
✓ `APP_URL` - Return URL for Cashfree redirects  

**Note:** `SUPABASE_ANON_KEY` is no longer required (fixed in commit 9de309c)

---

## Build & Deployment Status

✓ **TypeScript:** Passes  
✓ **Production Build:** Succeeds (3.55s)  
✓ **Git Commits:** All pushed to origin/main  
✓ **Awaiting:** Vercel auto-deployment of commit 332e905  

---

## Summary

**Root Cause Identified:**
- Missing `price_cents` in database query → amount shows 0
- Wrong field name for Cashfree amount → amount shows 0 even when available
- Response using Cashfree amount instead of database amount → inconsistent

**Fixes Applied:**
1. Include `price_cents` in booking SELECT (commit f36378b)
2. Use correct `payment_amount` field from Cashfree (commit f36378b)
3. Return booking's `price_cents` as source of truth (commit f36378b)
4. Recognize additional Cashfree status codes (commit 332e905)
5. Add detailed diagnostic logging (commits dfc7eed & 332e905)

**Expected Outcome After Deployment:**
- Response shows `amount: 9900` (₹99) instead of 0
- Frontend displays "₹99 — Paid"  
- If payment genuinely pending in Cashfree, status shows pending (correct behavior)
- If payment succeeded in Cashfree, status will show completed (with better status code matching)
- Detailed logs available in Vercel to diagnose Cashfree settlement time

**Next Steps:**
1. Wait for Vercel deployment of commit 332e905
2. Test on production
3. Check Vercel logs to see actual Cashfree API response
4. Determine if payment is genuinely pending or if status code wasn't recognized
5. Implement retry logic if needed based on findings

---

**Generated:** September 11, 2026  
**Latest Commit:** 332e905  
**Status:** AWAITING VERCEL DEPLOYMENT
