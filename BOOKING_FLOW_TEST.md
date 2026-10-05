# HELPAMART Booking Flow — End-to-End Test Checklist

## Pre-Test Requirements

- ✅ Central HELPAMART Google account is authorized (see `ADMIN_SETUP.md`)
- ✅ `/api/admin-calendar-status` returns `{ configured: true, ... }`
- ✅ Vercel Production is live: https://www.helpamart.com
- ✅ At least one published mentor exists
- ✅ SMTP is configured (for confirmation emails)
- ✅ Test user accounts created (mentee + mentor if possible)

---

## Test Scenario: Full Booking → Google Meet → Confirmation

### **Phase 1: Discovery**

**Test**: Can the mentee find a mentor and select a session?

- [ ] Navigate to https://www.helpamart.com
- [ ] Click "Find Mentor" or browse mentors
- [ ] Select a published mentor
- [ ] Click on a service offering
- [ ] Choose an available time slot in the next 7 days
- [ ] Confirm all details are displayed correctly

**Expected**:
- Mentor name, photo, service title, duration, price visible
- Date and time display in mentee's timezone
- "Confirm Booking" button is active

---

### **Phase 2: Authentication**

**Test**: Is the mentee authenticated?

- [ ] If not signed in, click "Confirm Booking" → redirects to login
- [ ] Sign in or create account
- [ ] Redirects back to booking confirmation page
- [ ] Pre-filled details match the selected session

**Expected**:
- Seamless auth flow
- No data loss on redirect

---

### **Phase 3: Booking Confirmation Page**

**Test**: Does the confirmation page display correctly?

- [ ] Review screen shows:
  - [ ] Service title, duration, format
  - [ ] Date in full format (e.g., "Friday, October 4, 2026")
  - [ ] Time with timezone
  - [ ] Total price (or "Free" for first session)
  - [ ] Informational text about Google Meet + Calendar
- [ ] "Confirm Booking" button is ready to click

**Expected**:
- All information accurate
- Button is enabled (not loading)
- No error messages

---

### **Phase 4: Submit Booking**

**Test**: Does the booking submission work?

- [ ] Click "Confirm Booking"
- [ ] "Confirming your session…" message appears with spinner
- [ ] Wait for response (typically 3–8 seconds)

**Backend Processing During This Time**:
- [ ] `POST /api/book` receives request with mentorSlug, serviceId, startAt, timezone
- [ ] Server creates booking row with status "confirmed"
- [ ] Server fetches central Google Calendar client
- [ ] Server creates Google Calendar event
  - [ ] Mentor + mentee are added as attendees
  - [ ] Google Meet conference is requested
- [ ] Server polls Google for Meet URL (up to 20 seconds)
- [ ] Server saves meet_url + calendar_html_link to booking row
- [ ] Server sends confirmation emails (mentee + mentor)
- [ ] Server returns booking JSON to frontend

**Expected**:
- Request succeeds (HTTP 200)
- Response includes:
  - `booking.id`: UUID
  - `booking.meetLink`: Real Google Meet URL (e.g., `https://meet.google.com/...`)
  - `booking.calendarHtmlLink`: Google Calendar event URL
  - `booking.status`: "confirmed"
  - `booking.priceCents`: price or 0
  - `booking.mentorName`: Mentor's name

---

### **Phase 5: Success Screen**

**Test**: Is the success screen rendered correctly?

- [ ] Page transitions to success screen
- [ ] **Animation**: Small gold confetti particles burst outward for ~1 second (subtle, not childish)
- [ ] Check icon appears with smooth scale-up animation
- [ ] Heading: "You're booked."
- [ ] Subheading: "Your session with [Mentor Name] has been confirmed."
- [ ] If first session: "First session — complimentary ✦" badge displays
- [ ] Booking details card shows:
  - [ ] Date, Time, Timezone, Amount
  - [ ] All text correct and properly formatted

**Expected**:
- Premium, elegant celebration animation (not over-the-top)
- All info matches the booking
- Icons use HELPAMART gold color

---

### **Phase 6: Action Buttons — Join Google Meet**

**Test**: Can the mentee join the Google Meet?

- [ ] "Join Google Meet" button visible and ready to click
- [ ] Button shows:
  - [ ] Video icon
  - [ ] Text: "Join Google Meet"
  - [ ] Navy background, hover effect
- [ ] Click the button
- [ ] Opens in new tab
- [ ] URL is a real `meet.google.com` link

**Expected**:
- Real Google Meet opens in new tab
- Mentee can join the meeting
- Meeting shows the session details in the title/description

**If Meet URL is not available**:
- [ ] Button shows: "Google Meet link will be emailed to you" (not clickable, informational state)
- [ ] This should be rare (Google takes >20s to create Meet)
- [ ] Check confirmation email to see if Meet URL is there

---

### **Phase 7: Action Buttons — Open Google Calendar**

**Test**: Can the mentee open their Google Calendar?

- [ ] "Open Google Calendar" button visible
- [ ] Button shows:
  - [ ] Calendar icon (gold)
  - [ ] Text: "Open Google Calendar"
  - [ ] Border style, hover effect
- [ ] Click the button
- [ ] Opens Google Calendar in new tab
- [ ] Calendar event is visible

**Expected**:
- Google Calendar opens to the day of the booking
- Event is visible with title "HELPAMART Mentorship — [Mentor Name]"
- Event includes the Google Meet link
- Mentor + mentee are listed as attendees

---

### **Phase 8: Action Buttons — View My Bookings**

**Test**: Can the mentee view their booking history?

- [ ] "View My Bookings" button visible
- [ ] Click the button
- [ ] Navigates to `/dashboard/bookings`
- [ ] New booking appears in the list
- [ ] Shows date, mentor, service, status: "Confirmed"

**Expected**:
- Dashboard loads
- Booking is listed
- "Join Google Meet" button available from the dashboard too

---

### **Phase 9: Confirmation Email — Mentee**

**Test**: Does the mentee receive a confirmation email?

- [ ] Check mentee's email inbox
- [ ] Email arrives from SMTP_FROM address
- [ ] Subject: "HELPAMART session confirmed — [Service] with [Mentor]"
- [ ] Email contains:
  - [ ] Mentor name
  - [ ] Service title
  - [ ] Date and time with timezone
  - [ ] Total amount
  - [ ] Google Meet link (clickable button)
  - [ ] Google Calendar event link
  - [ ] "View My Bookings" link
  - [ ] Professional HTML formatting with HELPAMART branding (cream, navy, gold)

**Expected**:
- Email is professional and matches HELPAMART design
- All links are real and clickable
- No internal errors or placeholders in email

---

### **Phase 10: Confirmation Email — Mentor**

**Test**: Does the mentor receive a notification?

- [ ] Check mentor's email inbox
- [ ] Email arrives from SMTP_FROM address
- [ ] Subject: "New HELPAMART session scheduled — [Service]"
- [ ] Email contains:
  - [ ] Mentee name
  - [ ] Service title
  - [ ] Date and time with timezone
  - [ ] Total amount
  - [ ] Google Meet link
  - [ ] "Mentor Dashboard" link
  - [ ] Professional HTML formatting

**Expected**:
- Email matches mentee email in design and quality
- All links are clickable
- Mentor can see mentee info and join the Meet

---

### **Phase 11: In-App Notifications**

**Test**: Do both participants see notifications?

- [ ] If mentee stays signed in on another browser/tab, check dashboard
- [ ] If mentor has dashboard open, check for notification badge
- [ ] Notification text: "Your HELPAMART session with [Name] is confirmed" or similar

**Expected**:
- Notifications appear in real-time or within a few seconds
- Include booking date/time
- Include Google Meet link if available

---

### **Phase 12: Reminders — 60 Minutes Before**

**Test**: Do participants receive a 60-minute reminder?

**Setup**:
- [ ] Create a test booking for exactly 60 minutes from now (or manipulate server time if needed)
- [ ] Wait for the reminder to be sent (Edge Function runs every 2 minutes)

**Expected**:
- Mentee receives email: "HELPAMART reminder — your session starts in 60 minutes"
- Mentor receives email: "HELPAMART reminder — your session starts in 60 minutes"
- Both emails include:
  - [ ] Session details
  - [ ] Google Meet link
  - [ ] Time until session starts
- Email sent exactly once (no duplicates)

---

### **Phase 13: Reminders — 30 Minutes Before**

**Test**: Do participants receive a 30-minute reminder?

**Setup**:
- [ ] Same test booking as Phase 12
- [ ] Wait ~30 more minutes (or until reminder window)

**Expected**:
- Mentee receives email: "HELPAMART reminder — your session starts in 30 minutes"
- Mentor receives email: "HELPAMART reminder — your session starts in 30 minutes"
- Email sent exactly once (no duplicates)
- Website can be closed — reminders still execute on the server

---

### **Phase 14: Database Verification**

**Test**: Is the booking data correct in Supabase?

In **Supabase Dashboard** → **SQL Editor**, run:

```sql
SELECT 
  id, mentor_id, mentee_id, service_title, 
  start_at, end_at, timezone, status,
  meet_link, calendar_event_id, calendar_html_link,
  reminder_60_sent_at, reminder_30_sent_at
FROM public.bookings
ORDER BY created_at DESC
LIMIT 1;
```

**Expected**:
- [ ] `id`: UUID (matching success page)
- [ ] `status`: "confirmed"
- [ ] `service_title`: Correct service name
- [ ] `start_at`, `end_at`: Correct times in ISO format
- [ ] `timezone`: Matches mentee's timezone
- [ ] `meet_link`: Starts with `https://meet.google.com/`
- [ ] `calendar_event_id`: Non-null Google Calendar event ID
- [ ] `calendar_html_link`: Starts with `https://calendar.google.com/`
- [ ] `reminder_60_sent_at`, `reminder_30_sent_at`: NULL initially, then filled after reminders are sent

---

### **Phase 15: Google Calendar Verification**

**Test**: Is the Calendar event created correctly?

- [ ] Sign in to the central HELPAMART Google account
- [ ] Open Google Calendar
- [ ] Navigate to the booking date
- [ ] Calendar event visible: "HELPAMART Mentorship — [Mentor Name]"
- [ ] Event details show:
  - [ ] Description includes booking ID
  - [ ] Organizer: Central HELPAMART account
  - [ ] Attendees: Mentor email + Mentee email
  - [ ] Google Meet link in event
  - [ ] Reminders set: 60 min (popup), 30 min (popup), 60 min (email)

**Expected**:
- Event is real and functional
- All attendees can see it
- Meet conference is embedded in the event

---

### **Phase 16: Idempotency Test**

**Test**: Is double-booking prevented?

- [ ] Create a booking
- [ ] Immediately refresh the page and click "Confirm Booking" again (before initial response completes)
- [ ] OR submit the form twice quickly

**Expected**:
- Only one booking is created
- Second submission either:
  - Returns the same booking (idempotent), OR
  - Shows a conflict error ("This time slot is no longer available")
- No duplicate Calendar events

---

### **Phase 17: Calendar Conflict Test**

**Test**: Can two bookings be made at the same time?

- [ ] Create booking for Mentor A at 3:00 PM
- [ ] Try to create another booking for Mentor A at 3:00 PM (different mentee)

**Expected**:
- First booking succeeds
- Second booking fails: "This time slot is no longer available. Please choose another time."

---

### **Phase 18: First Session Free Test** *(if applicable)*

**Test**: Is the first session free?

- [ ] Create a brand new test user account
- [ ] Book first session with a mentor
- [ ] Confirmation screen should show: "First session — complimentary ✦"
- [ ] Price should be "Free"
- [ ] Email to mentee should say: "First session — complimentary"

**Expected**:
- First session charged at 0 (free)
- Second booking by same mentee → normal price
- DB shows `price_cents: 0` for first session

---

## Success Criteria

### ✅ All tests pass if:

1. **Booking Flow**:
   - [ ] User can discover → select → confirm a booking
   - [ ] Confirmation page is elegant and professional
   - [ ] Celebration animation is subtle and premium (gold confetti, ~1 sec)

2. **Google Calendar**:
   - [ ] Real Calendar event created in central account
   - [ ] Mentor + mentee are attendees
   - [ ] Calendar event is viewable and editable by participants

3. **Google Meet**:
   - [ ] Real Meet conference created with deterministic requestId (no duplicates)
   - [ ] Meet URL appears on confirmation page (or in email if delayed)
   - [ ] Clicking "Join Google Meet" opens a real meeting
   - [ ] Both mentor and mentee can join the same Meet

4. **Emails**:
   - [ ] Mentee receives: "Your HELPAMART mentorship session is confirmed"
   - [ ] Mentor receives: "New HELPAMART mentorship session scheduled"
   - [ ] Both include real Meet URL + Calendar link
   - [ ] Professional HTML formatting

5. **Reminders**:
   - [ ] T-60: Both participants receive 60-minute reminder
   - [ ] T-30: Both participants receive 30-minute reminder
   - [ ] Reminders are idempotent (only sent once per window)
   - [ ] Reminders execute even if website is closed

6. **UI/UX**:
   - [ ] No error messages visible to end users
   - [ ] Success page is premium and minimal
   - [ ] "Join Google Meet" button is always clearly visible
   - [ ] "Open Google Calendar" button always clearly visible
   - [ ] All CTAs work correctly

7. **Data Integrity**:
   - [ ] Booking rows have all required fields
   - [ ] No duplicate bookings or Calendar events
   - [ ] IDs and links are correct and persistent
   - [ ] First session is free; subsequent sessions charged correctly

8. **Security**:
   - [ ] No tokens appear in browser localStorage, URLs, or logs
   - [ ] No internal configuration errors shown to end users
   - [ ] Calendar tokens remain server-side only

---

## Rollback Plan

If tests fail, check:

1. **Central Google Connection**:
   ```bash
   curl -H "Authorization: Bearer <ADMIN_SECRET>" \
     https://www.helpamart.com/api/admin-calendar-status
   ```
   Should return `{ configured: true, ... }`

2. **Vercel Logs**:
   - https://vercel.com/dashboard → Functions → Logs
   - Search for `[BOOK]` entries
   - Check for errors in Calendar/Meet creation

3. **Supabase Logs**:
   - Check for edge function errors
   - Check for SMTP configuration errors

4. **Browser Console**:
   - Check for JavaScript errors
   - Check network tab for failed API calls

5. **Email Logs**:
   - Verify SMTP credentials are correct
   - Check if emails are being rejected by ISP

---

## Test Results Template

```
Test Date: ____________
Tester: ________________
Environment: Production / Staging

Overall Result: ✅ PASS / ❌ FAIL

Phase 1 (Discovery):  ✅ / ❌
Phase 2 (Auth):       ✅ / ❌
Phase 3 (Confirm):    ✅ / ❌
Phase 4 (Submit):     ✅ / ❌
Phase 5 (Success):    ✅ / ❌
Phase 6 (Meet):       ✅ / ❌
Phase 7 (Calendar):   ✅ / ❌
Phase 8 (Dashboard):  ✅ / ❌
Phase 9 (Email Me):   ✅ / ❌
Phase 10 (Email Mn):  ✅ / ❌
Phase 11 (Notify):    ✅ / ❌
Phase 12 (Rem 60):    ✅ / ❌
Phase 13 (Rem 30):    ✅ / ❌
Phase 14 (DB):        ✅ / ❌
Phase 15 (Cal Ev):    ✅ / ❌
Phase 16 (Idem):      ✅ / ❌
Phase 17 (Conflict):  ✅ / ❌
Phase 18 (First):     ✅ / ❌

Notes:
_____________________________________________________________________________
_____________________________________________________________________________

Approved by: _________________ Date: _____________
```

