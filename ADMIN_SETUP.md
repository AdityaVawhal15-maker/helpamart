# HELPAMART Google Meet Admin Setup Guide

## Overview

HELPAMART uses **ONLY Google Meet REST API v2** (`POST https://meet.googleapis.com/v2/spaces`) to generate genuine Google Meet rooms for all mentorship sessions.

**Google Calendar is completely removed from the booking architecture**:
- No Google Calendar API calls (`calendar.events.insert`, `conferenceData`).
- No mentor calendar connections required or requested.
- No Google Calendar invitations or calendar events created.
- One central HELPAMART Google account provides OAuth authorization solely for Google Meet.

---

## Architecture Flow

```
Central HELPAMART Google Account
            ↓
OAuth 2.0 Refresh Token (stored server-side in google_service_connections)
            ↓
Server-Side Access Token (generated on-demand via https://oauth2.googleapis.com/token)
            ↓
Google Meet REST API: POST https://meet.googleapis.com/v2/spaces
            ↓
REAL Google Meet Space & Meeting URI (https://meet.google.com/xxx-yyyy-zzz)
            ↓
Saved to Supabase booking (bookings.meet_link)
            ↓
Returned in API response (HTTP 200)
            ↓
┌─────────────────────────┬─────────────────────────┬─────────────────────────┐
│        Frontend         │         Emails          │  In-App Notifications   │
│  "JOIN GOOGLE MEET"     │  Real Meet Link sent    │  Sent to mentee and     │
│  button shown instantly │  to mentee and mentor   │  mentor with Meet link  │
└─────────────────────────┴─────────────────────────┴─────────────────────────┘
```

---

## Prerequisites

1. ✅ Vercel project deployed: `https://www.helpamart.com`
2. ✅ Supabase project with migrations applied (`20261004070000_google_service_connection.sql`, `20261004080000_in_app_notifications.sql`)
3. ✅ Google Cloud project with **Google Meet API** enabled

### Google Cloud Setup

1. Open [Google Cloud Console](https://console.cloud.google.com).
2. Enable **Google Meet API**:
   - Go to **APIs & Services** → **Library**.
   - Search for **Google Meet API**.
   - Click **Enable**.
3. Configure OAuth 2.0 Credentials:
   - Go to **Credentials** → **Create Credentials** → **OAuth client ID**.
   - Application type: **Web application**.
   - Authorized JavaScript origins:
     - `https://www.helpamart.com`
     - `http://localhost:5173` (for local development)
   - Authorized redirect URIs:
     - `https://www.helpamart.com/api/admin-meet-callback`
     - `https://www.helpamart.com/api/admin-calendar-callback` (legacy alias)
4. Copy your **Client ID** and **Client Secret**.

---

## Step 1: Set Vercel Environment Variables

In your [Vercel Dashboard](https://vercel.com) under **Settings** → **Environment Variables**:

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth Client ID from Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | OAuth Client Secret from Google Cloud Console |
| `GOOGLE_MEET_REDIRECT_URI` | `https://www.helpamart.com/api/admin-meet-callback` (optional, defaults to this) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role secret |
| `SUPABASE_ANON_KEY` | Supabase anon key |
| `SMTP_HOST` | Hostinger SMTP host (e.g. `smtp.hostinger.com`) |
| `SMTP_PORT` | `465` (SSL) or `587` (TLS) |
| `SMTP_USER` | Email username (e.g. `guidance@helpamart.com`) |
| `SMTP_PASS` | Email password |
| `SMTP_FROM` | `HELPAMART <guidance@helpamart.com>` |
| `APP_URL` | `https://www.helpamart.com` |

---

## Step 2: One-Time Google Meet Authorization via Browser

**No terminal or curl commands are required.**

1. Visit your admin setup page in the browser:
   **`https://www.helpamart.com/admin/meet`**
2. Click **Connect HELPAMART Google Meet**.
3. Sign in with the central HELPAMART Google account.
4. Google will request consent for:
   - `Create and manage meetings in Google Meet` (`https://www.googleapis.com/auth/meetings.space.created`)
5. Upon approval, you will be redirected back to `/admin/meet`:
   - ✅ **Google Meet Connected** badge appears.
   - Shows connected email.
   - Refresh token is stored securely in the `google_service_connections` table.
   - The token is never exposed to any browser or client.

---

## Verification & Booking Guarantees

- **No Silent Failures**: If Google Meet API fails or credentials are missing, the booking is automatically rolled back and deleted. An error (HTTP 503) is returned.
- **Genuine Meet URLs**: Only URLs returned by `POST https://meet.googleapis.com/v2/spaces` (matching `https://meet.google.com/...`) are accepted.
- **Immediate Frontend Access**: The mentee confirmation screen shows `[ JOIN GOOGLE MEET ]` immediately.
- **Automated Notifications**: Real Meet link is included directly in emails and in-app notifications.
