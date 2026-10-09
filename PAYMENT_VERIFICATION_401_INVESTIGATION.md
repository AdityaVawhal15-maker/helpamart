# Payment Verification 401 Investigation

## Problem
User completes Cashfree payment, sees success screen, but payment-result page shows "Unauthorized" error (401).

Order: `BOOK-DC067700-1791556844233`

## Analysis

### JWT Verification Flow
The `api/cashfree-verify-payment.ts` endpoint verifies the user's JWT token by:
1. Extracting token from `Authorization: Bearer <token>` header
2. Calling Supabase's `/auth/v1/user` endpoint with:
   - Header: `Authorization: Bearer <token>` (user's access token)
   - Header: `apikey: <SUPABASE_ANON_KEY>` (Supabase anonymous key)
3. If successful, returns user ID
4. If failed, throws error (which becomes 401 response)

### Required Environment Variables (Vercel Production)

For the JWT verification to work, these MUST be set in Vercel Production environment:

```
SUPABASE_URL=https://hespppkftlslbcsizyur.supabase.co
SUPABASE_ANON_KEY=sb_publishable_8wuCVEEzGOAI3eRf6_8QQA_U6WjJICY
```

### Potential Root Causes

#### 1. Missing SUPABASE_ANON_KEY in Vercel
If `SUPABASE_ANON_KEY` is not set in Vercel Production:
- The code will use empty string: `anonKey = '' `
- Supabase auth endpoint will reject the request (401)
- Endpoint returns: `{ error: 'Payment service misconfigured.' }`

**FIX**: Add `SUPABASE_ANON_KEY` to Vercel Production environment variables

#### 2. Expired or Invalid Access Token
If the user's access token (JWT) is:
- Expired (user's session timed out)
- Tampered with
- From a different Supabase project

Then Supabase will reject it (401).

**FIX**: User needs to refresh page and authenticate again

#### 3. Token Refresh Issue
If the frontend's token needs refresh but hasn't been refreshed:
- Old/stale token is sent to backend
- Supabase rejects it

**FIX**: Ensure AuthContext waits for token refresh before calling API

#### 4. CORS or Network Issue
If the backend can't reach Supabase's auth endpoint:
- Fetch fails or times out
- Returns error

**FIX**: Check Vercel function logs for network errors

## Current Fix Deployed
Commit: `f558757`

The fix includes:
- Enhanced error logging in `verifyJwt()`
- Validation of required environment variables
- Better error messages for debugging
- Frontend waits for AuthContext to load
- Frontend uses `useAuth()` hook for session

## Next Steps to Diagnose

### 1. Check Vercel Environment Variables
Verify these are set in Vercel Production dashboard:
```
SUPABASE_URL=https://hespppkftlslbcsizyur.supabase.co
SUPABASE_ANON_KEY=sb_publishable_8wuCVEEzGOAI3eRf6_8QQA_U6WjJICY
```

### 2. Check Vercel Function Logs
Look at production logs for `/api/cashfree-verify-payment`:
- Does it log "Missing authorization header"?
- Does it log "SUPABASE_ANON_KEY not configured"?
- Does it log "Supabase auth failed"?
- What HTTP status does Supabase return?

### 3. Check Browser Network Tab
When user navigates to payment-result page:
- Request to `/api/cashfree-verify-payment`: What status?
- Response body: What error message?
- Request headers: Is `Authorization: Bearer <token>` present?

### 4. Test with Fresh Session
- Clear browser localStorage
- Sign in to HELPAMART again (fresh token)
- Try payment-result page
- Check if it works with new token

## Configuration Needed

To resolve the 401 permanently, ensure Vercel Production has:

**Environment Variables:**
```
SUPABASE_URL=https://hespppkftlslbcsizyur.supabase.co
SUPABASE_ANON_KEY=sb_publishable_8wuCVEEzGOAI3eRf6_8QQA_U6WjJICY
SUPABASE_SERVICE_ROLE_KEY=[get from Supabase Dashboard]
```

**Steps:**
1. Log in to Vercel dashboard
2. Go to HELPAMART project → Settings → Environment Variables
3. Add/verify the above variables are set
4. Redeploy the application
5. Test payment flow again

## Order Recovery

Once 401 is fixed:
1. User navigates to: `/booking-payment-result?order_id=BOOK-DC067700-1791556844233`
2. Frontend calls `/api/cashfree-verify-payment` with valid token
3. Backend queries Cashfree API to verify payment status
4. If Cashfree confirms `payment_status: 'success'` (or similar):
   - Update booking to confirmed
   - Call book-finalize endpoint
   - Generate Google Meet link
   - Send confirmation emails
   - Create notifications
   - Show success page with "You're booked" and Meet link
5. Both dashboards updated
6. Idempotent: refresh doesn't duplicate anything
