# HELPAMART Admin Setup Guide

## Overview

HELPAMART uses a **central Google account** to organize Calendar events and generate Google Meet conferences for all mentorship bookings.

This guide walks the admin through the one-time setup process to authorize the central HELPAMART Google account.

---

## Prerequisites

Before starting, ensure:

- ✅ Vercel project is deployed to production: https://www.helpamart.com
- ✅ Supabase project is live and migrations are applied (including `20261004070000_google_service_connection.sql`)
- ✅ Google Cloud project created with Calendar API enabled
- ✅ OAuth 2.0 Client ID and Client Secret obtained

### Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable **Google Calendar API**:
   - Search for "Google Calendar API"
   - Click "Enable"
4. Create OAuth 2.0 credentials:
   - Go to "Credentials" → "Create Credentials" → "OAuth client ID"
   - Application type: **Web application**
   - Authorized JavaScript origins: Add `https://www.helpamart.com`
   - Authorized redirect URIs: Add `https://www.helpamart.com/api/admin-calendar-callback`
   - Copy the **Client ID** and **Client Secret**

---

## Step 1: Set Vercel Environment Variables

### Required Variables

Log in to [Vercel Dashboard](https://vercel.com) and go to:
- **Settings** → **Environment Variables** → **Production**

Add these variables:

| Variable | Value | Notes |
|---|---|---|
| `GOOGLE_CLIENT_ID` | From Google Cloud Console | Never expose in frontend |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console | Never expose in frontend |
| `ADMIN_SECRET` | Any secure random string (32+ chars) | Used to protect admin endpoints |
| `SUPABASE_URL` | Your Supabase project URL | Already set |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service-role key | Already set |
| `SUPABASE_ANON_KEY` | Your Supabase anono key | Already set |
| `SMTP_HOST` | Your email provider's SMTP host | For booking confirmations |
| `SMTP_PORT` | Usually 587 or 465 | For booking confirmations |
| `SMTP_USER` | Your email address | For booking confirmations |
| `SMTP_PASS` | Your email password or app-specific password | For booking confirmations |
| `SMTP_FROM` | e.g. `HELPAMART <guidance@helpamart.com>` | From address for emails |
| `APP_URL` | `https://www.helpamart.com` | Already set |

After adding these, **redeploy** your Vercel project:
- Go to **Deployments** → **Trigger redeploy** (or push to main branch)

---

## Step 2: Verify Central Connection Status

Before authorizing, check if the connection is already configured:

```bash
curl -H "Authorization: Bearer <ADMIN_SECRET>" \
  https://www.helpamart.com/api/admin-calendar-status
```

Expected response if configured:
```json
{
  "configured": true,
  "accountEmail": "calendar@helpamart.com",
  "source": "db"
}
```

Expected response if not yet configured:
```json
{
  "configured": false,
  "reason": "no_token",
  "detail": "No central Google account found. Run /api/admin-calendar-connect to authorise."
}
```

---

## Step 3: Authorize the Central HELPAMART Google Account

The admin must sign in with the **central HELPAMART Google account** (e.g., `calendar@helpamart.com`).

### Option A: Via Authorization Header (Recommended — No Browser History)

Use curl or Postman to initiate the OAuth flow:

```bash
curl -L -H "Authorization: Bearer <ADMIN_SECRET>" \
  https://www.helpamart.com/api/admin-calendar-connect
```

This will:
1. Redirect to Google's OAuth consent screen
2. Prompt you to sign in with the central HELPAMART Google account
3. Ask for Calendar permission
4. Redirect back to `/api/admin-calendar-callback`
5. Store the refresh token in `google_service_connections` table
6. Show a success page

### Option B: Via Signed URL Token (If Authorization Header Not Available)

Generate a signed token (expires in 10 minutes):

```bash
node -e "
  const c = require('crypto');
  const s = '<your-ADMIN_SECRET>';
  const exp = Date.now() + 600000;
  const d = JSON.stringify({exp});
  const sig = c.createHmac('sha256', s).update(d).digest('hex');
  console.log(Buffer.from(JSON.stringify({d,sig})).toString('base64url'));
"
```

Then visit in your browser:
```
https://www.helpamart.com/api/admin-calendar-connect?token=<output>
```

---

## Step 4: Verify Authorization Success

After the callback, you should see:

```
✅ Google Calendar Connected

The central HELPAMART Google account has been authorised.
Connected account: calendar@helpamart.com

Every new booking will now automatically generate a real Google Meet conference.
The authorisation tokens have been stored securely on the server.
No credentials were sent to this browser.
```

Now verify the connection is active:

```bash
curl -H "Authorization: Bearer <ADMIN_SECRET>" \
  https://www.helpamart.com/api/admin-calendar-status
```

Should return:
```json
{
  "configured": true,
  "accountEmail": "calendar@helpamart.com",
  "source": "db"
}
```

---

## Step 5: Test a Real Booking

Now that the central account is authorized, test a complete booking flow:

1. **Go to production**: https://www.helpamart.com
2. **Find a mentor** in the search / browse
3. **View their profile** → Select a service → Choose a time slot
4. **Confirm Booking**
5. **Expected behavior**:
   - ✅ Booking confirmation page appears
   - ✅ Small premium gold confetti celebration animation
   - ✅ "You're booked" message
   - ✅ "Join Google Meet" button with real URL
   - ✅ "Open Google Calendar" button
   - ✅ "View My Bookings" button
   - ✅ No error messages about "Google Calendar is not configured"

6. **Check emails**:
   - Mentor receives: "New HELPAMART session scheduled"
   - Mentee receives: "Your HELPAMART mentorship session is confirmed"
   - Both emails include the real Google Meet URL

7. **Open Google Meet**: Click "Join Google Meet" and confirm it opens a real Google Meet conference

---

## Troubleshooting

### Problem: "Google Calendar is not configured on this server"

**Solution**: The central Google account has not been authorized. Run Step 3 above.

### Problem: Booking succeeded but no Google Meet URL

**Solution**: The Google Calendar API took longer than 20 seconds to generate the Meet conference. This is rare but can happen.
- **Workaround**: The confirmation email will include the Meet URL if it eventually succeeds
- Check Vercel logs: https://vercel.com/dashboard → Logs → `/api/book`
- Look for `[BOOK] Meet video entry point found`

### Problem: OAuth redirect fails or "Forbidden"

**Solution**: 
- Check `ADMIN_SECRET` is set correctly and matches the header/token
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Confirm redirect URI `https://www.helpamart.com/api/admin-calendar-callback` is registered in Google Cloud Console
- Check Vercel logs for specific error

### Problem: Central account revoked or token expired

**Solution**: 
- Run Step 3 again to re-authorize the central HELPAMART Google account
- The new token will overwrite the old one in `google_service_connections`

---

## Monitoring

### Check Central Connection Status

```bash
# As admin:
curl -H "Authorization: Bearer <ADMIN_SECRET>" \
  https://www.helpamart.com/api/admin-calendar-status
```

### Review Booking Logs

In **Vercel Dashboard** → **Functions** → **Logs**:
- Search for `[BOOK]` to find booking traces
- Look for `Central Calendar client loaded`
- Check for `Meet video entry point found = true`

### Check Database

In **Supabase Dashboard** → **SQL Editor**:
```sql
SELECT key, status, account_email, updated_at
FROM public.google_service_connections
WHERE key = 'helpamart_organizer';
```

Should show one row with:
- `status`: `connected`
- `account_email`: The central HELPAMART Google account email
- `updated_at`: When the connection was last authorized

---

## Maintenance

### Renew Authorization

If the Google account access is revoked or needs to be re-authorized:
1. Go to [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
2. Find HELPAMART and revoke access
3. Run Step 3 above to re-authorize

### Rotate ADMIN_SECRET

If the `ADMIN_SECRET` is compromised:
1. Generate a new secret
2. Update `ADMIN_SECRET` in Vercel
3. Redeploy
4. The old secret will no longer work for `/api/admin-calendar-connect` or `/api/admin-calendar-status`

---

## Security Notes

- ✅ **Refresh tokens are never shown in the browser** — they are stored only in the Supabase database (`google_service_connections` table) using the service-role client
- ✅ **`ADMIN_SECRET` is never exposed in URLs by default** — use the `Authorization: Bearer` header
- ✅ **Calendar tokens never leave the server** — not in localStorage, not in frontend code
- ✅ **OAuth state is HMAC-signed** — prevents CSRF attacks on the callback endpoint
- ✅ **Secrets are never logged** — check logs but tokens will not appear

---

## Support

For issues or questions:
- Check **Vercel Logs**: https://vercel.com/dashboard → Functions
- Check **Supabase Logs**: https://supabase.com → Project → Database → Logs
- Review this guide again — most issues are configuration-related

