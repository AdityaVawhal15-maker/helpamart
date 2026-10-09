# How to Read the Diagnostic Logs — Payment Pending Investigation

**Latest Commit:** 75a73b4  
**What Changed:** Enhanced logging in `/api/cashfree-verify-payment` to show EXACTLY what Cashfree returns and why it's classified as pending

---

## Step 1: Deploy & Test

1. Wait for Vercel to deploy commit 75a73b4 (shows "Ready")
2. Go to: `https://helpamart.com/booking-payment-result?order_id=BOOK-A185BCD1-1791560103932`
3. Page loads (will still show pending, but logs will show why)

---

## Step 2: View Vercel Logs

**Go to:**  
Vercel Dashboard → HELPAMART Project → Deployments → [75a73b4] → Logs → Function Logs

**Filter for:** `/api/cashfree-verify-payment`

---

## Step 3: Find the Log Entries

Look for lines starting with `[VERIFY-PAYMENT]`. You'll see output like:

```
[VERIFY-PAYMENT] Request received
[VERIFY-PAYMENT] Verifying payment for order: BOOK-A185BCD1-1791560103932 user: [user-id]
[VERIFY-PAYMENT] Checking Cashfree for payment status...
[VERIFY-PAYMENT] Cashfree HTTP Status: 200
[VERIFY-PAYMENT] Raw Cashfree Response: {
  "payments": [
    {
      "cf_payment_id": "12345678",
      "payment_status": "PENDING",
      "payment_amount": "99.00",
      "payment_currency": "INR",
      "payment_method": "UPI",
      "payment_time": "2026-09-11T10:30:00Z"
    }
  ]
}
[VERIFY-PAYMENT] === CASHFREE PAYMENTS ARRAY ===
[VERIFY-PAYMENT] Total attempts: 1
[VERIFY-PAYMENT] Attempt 1: {
  "cf_payment_id": "12345678",
  "payment_status": "PENDING",
  ...
}
[VERIFY-PAYMENT] === END PAYMENTS ARRAY ===
```

---

## Step 4: Interpret the Logs

### Key Information to Find

**1. Raw Cashfree Response**
```
[VERIFY-PAYMENT] Raw Cashfree Response: {...}
```

Look at `payment_status` value. Write it down:
```
Cashfree payment_status = ___________
```

**2. Payment Attempts**
```
[VERIFY-PAYMENT] Total attempts: X
```

How many payment attempts exist? (If >1, there were retries)

**3. Status Matching Results**

Look for lines like:
```
[VERIFY-PAYMENT] Checking payment 12345678: status="PENDING" - Match? SUCCESS=false, SETTLED=false, AUTHORIZED=false, CHARGED=false
```

This shows: Payment has status "PENDING", and it doesn't match any success code.

**4. Final Decision**
```
[VERIFY-PAYMENT] ⏳ No successful/failed payment found
[VERIFY-PAYMENT] First attempt payment_status: PENDING
[VERIFY-PAYMENT] Total attempts: 1
[VERIFY-PAYMENT] → MAPPING TO: pending (default fallback)
```

This explains WHY the response says pending.

---

## Step 5: Diagnose Based on Logs

### Scenario A: Status Is "SUCCESS" But Logs Show FAILED Match

**Log example:**
```
[VERIFY-PAYMENT] Checking payment 12345678: status="SUCCESS" - Match? SUCCESS=false
```

**Problem:** Status code comparison failed even though it says "SUCCESS"
**Cause:** Likely a case sensitivity or encoding issue
**Fix:** Check if Cashfree is returning a different encoding (e.g., "Success", "success", "successful")
**Action:** Report to Kiro with the exact case-sensitive value

### Scenario B: Status Is Genuinely "PENDING"

**Log example:**
```
[VERIFY-PAYMENT] Checking payment 12345678: status="PENDING" - Match? SUCCESS=false, SETTLED=false, AUTHORIZED=false, CHARGED=false
[VERIFY-PAYMENT] ⏳ No successful/failed payment found
[VERIFY-PAYMENT] → MAPPING TO: pending (default fallback)
```

**Problem:** Payment status in Cashfree is genuinely PENDING
**Cause 1:** Cashfree hasn't settled the payment yet (normal, takes 5-30 minutes)
**Cause 2:** Payment is stuck or declined at Cashfree level
**Action:** 
- If this is a first attempt, WAIT 10 minutes for settlement, then retry
- If multiple attempts show pending, check Cashfree dashboard directly for this order
- Check if webhook ever confirmed payment (check logs for `/api/cashfree-webhook`)

### Scenario C: Unknown Status Code

**Log example:**
```
[VERIFY-PAYMENT] Checking payment 12345678: status="PROCESSING" - Match? SUCCESS=false, SETTLED=false, AUTHORIZED=false, CHARGED=false
[VERIFY-PAYMENT] Checking payment 12345678: status="PROCESSING" - Match? FAILED=false, CANCELLED=false, USER_DROPPED=false, DECLINED=false
[VERIFY-PAYMENT] → MAPPING TO: pending (default fallback)
```

**Problem:** Cashfree returned a status code we don't recognize ("PROCESSING")
**Cause:** Cashfree added a new status code that isn't in our list
**Action:** Report the exact status value to Kiro, we'll add it to the recognized codes

### Scenario D: Multiple Attempts, Mixed Statuses

**Log example:**
```
[VERIFY-PAYMENT] Total attempts: 2
[VERIFY-PAYMENT] Attempt 1: {
  "cf_payment_id": "111",
  "payment_status": "FAILED"
}
[VERIFY-PAYMENT] Attempt 2: {
  "cf_payment_id": "222",
  "payment_status": "SUCCESS"
}
[VERIFY-PAYMENT] Checking payment 111: status="FAILED" - Match? FAILED=true
[VERIFY-PAYMENT] ❌ FAILED payment found: FAILED
```

**Problem:** First attempt failed, but second attempt succeeded. Code picks up first failure and stops.
**Cause:** Logic checks failures before successes
**Fix:** Need to prioritize success checks (find successes first, THEN check for failures)
**Action:** Report with both payment IDs, Kiro will fix the order of operations

---

## Step 6: Common Values You'll See

| Status | Meaning | Expected Behavior |
|--------|---------|-------------------|
| SUCCESS | ✅ Payment succeeded | Should show success (map to 'completed') |
| SETTLED | ✅ Money received | Should show success (map to 'completed') |
| AUTHORIZED | ✅ Payment authorized | Should show success (map to 'completed') |
| CHARGED | ✅ Payment charged | Should show success (map to 'completed') |
| PENDING | ⏳ Still processing | Show pending (normal during settlement) |
| FAILED | ❌ Payment failed | Should show failed (map to 'failed') |
| CANCELLED | ❌ User cancelled | Should show failed (map to 'failed') |
| DECLINED | ❌ Bank declined | Should show failed (map to 'failed') |
| USER_DROPPED | ❌ User abandoned | Should show failed (map to 'failed') |

---

## Step 7: What to Report Back

After analyzing the logs, compile:

```
Order ID: BOOK-A185BCD1-1791560103932
Cashfree payment_status: [exact value from logs]
Number of attempts: [X]
Attempt 1 status: [value]
Attempt 2 status: [value, if exists]
Attempt 3 status: [value, if exists]
HTTP Status from Cashfree: [200/400/500]
Error message (if any): [error]
Whether any attempt shows SUCCESS/SETTLED/AUTHORIZED/CHARGED: YES/NO
Logs show payment being mapped to: [pending/success/failed]
Reason for mapping: [explanation from logs]
```

---

## Step 8: Next Actions Based on Findings

### If Status is Genuinely "PENDING":
- Wait 10 minutes for Cashfree settlement
- Check webhook logs to see if payment settled
- If webhook confirms, booking should auto-finalize
- If not, retry verification

### If Status Shows SUCCESS But Logs Show Failure Match:
- Report exact status code with case sensitivity
- Kiro will add recognition for the specific code

### If Multiple Attempts and Mixed Status:
- Report both attempt statuses
- Kiro will fix the logic to prioritize successes

### If Completely Unknown Status:
- Report the exact status value
- Kiro will add it to the recognized codes

---

## Quick Reference: Grep for Logs

**In Vercel, search for:**

| What | Search For |
|-----|-----------|
| Raw response | `Raw Cashfree Response` |
| HTTP error | `Cashfree API error` |
| Payment attempts | `PAYMENTS ARRAY` |
| Each attempt's status | `Checking payment` |
| Why it was marked pending | `MAPPING TO` |

---

## Important Notes

✅ These logs are **SAFE** — no secrets, tokens, or personal data  
✅ Logs show **EXACT** Cashfree response, not interpreted  
✅ Logs show **EVERY STEP** of the decision logic  
✅ This is what Kiro needs to fix the root cause  

**DO NOT:**
- Ignore the "Checking payment" lines — these show the exact logic
- Mix up "PENDING" from Cashfree with "pending" in our app
- Assume all attempts have same status — each is checked separately
- Trust the HTTP 200 — look at what Cashfree returned inside

---

**After Vercel deploys 75a73b4, run this test and report back the logs**

This will give us the exact data needed to fix the issue permanently.
