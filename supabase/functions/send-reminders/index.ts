/**
 * HELPAMART — Supabase Edge Function: send-reminders
 *
 * Runs on a schedule (via pg_cron or Supabase Dashboard scheduler).
 * Finds bookings where:
 *   - status = 'confirmed'
 *   - start_at is between now+25min and now+65min  (30-min window)
 *   - or start_at is between now+55min and now+65min (60-min window)
 *
 * For each qualifying booking it:
 *   1. Checks the idempotency columns (reminder_60_sent_at / reminder_30_sent_at)
 *   2. Sends reminder emails to mentor + mentee
 *   3. Marks the reminder as sent so it is never re-sent
 *
 * Deploy:
 *   supabase functions deploy send-reminders --no-verify-jwt
 *
 * Schedule (Supabase Dashboard → Edge Functions → Cron):
 *   */2 * * * *    (every 2 minutes)
 *
 * Required secrets (set via `supabase secrets set`):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? ''
const SMTP_PORT = Number(Deno.env.get('SMTP_PORT') ?? 587)
const SMTP_USER = Deno.env.get('SMTP_USER') ?? ''
const SMTP_PASS = Deno.env.get('SMTP_PASS') ?? ''
const SMTP_FROM = Deno.env.get('SMTP_FROM') ?? 'HELPAMART <guidance@helpamart.com>'
const APP_URL = Deno.env.get('APP_URL') ?? 'https://www.helpamart.com'

const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmt(iso: string, tz: string, opts: Record<string, unknown>): string {
  try {
    return new Intl.DateTimeFormat('en-IN', { timeZone: tz, ...opts as Intl.DateTimeFormatOptions })
      .format(new Date(iso))
  } catch {
    return iso.slice(0, 16)
  }
}

// ─── Email sender via Fetch → SMTP (uses nodemailer-compatible REST if available,
//     falls back to Deno SMTP library) ─────────────────────────────────────────
//
// Supabase Edge Functions run Deno. We use the smtp library available via esm.sh.

async function sendEmail(opts: {
  to: string
  subject: string
  html: string
}): Promise<void> {
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    console.log('[REMINDER] SMTP not configured — skipping email to', opts.to)
    return
  }

  // Use fetch to a self-hosted SMTP-over-HTTP proxy, or use an SMTP Deno library.
  // Here we use the well-maintained SmtpClient from deno-smtp.
  const { SmtpClient } = await import('https://deno.land/x/denomailer@1.6.0/mod.ts')

  const client = new SmtpClient()
  await client.connectTLS({
    hostname: SMTP_HOST,
    port: SMTP_PORT,
    username: SMTP_USER,
    password: SMTP_PASS,
  })

  await client.send({
    from: SMTP_FROM,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  })

  await client.close()
}

// ─── Email templates ──────────────────────────────────────────────────────────

function reminderHtml(opts: {
  recipientName: string
  otherPartyName: string
  role: 'mentor' | 'mentee'
  minutesBefore: number
  serviceTitle: string
  dateStr: string
  timeStr: string
  timezone: string
  meetLink: string | null
  bookingId: string
}): string {
  const isCountdown = opts.minutesBefore === 60 ? '1 hour' : '30 minutes'
  const otherRole = opts.role === 'mentor' ? 'student' : 'mentor'
  const dashboardUrl = opts.role === 'mentor'
    ? `${APP_URL}/mentor-dashboard/bookings`
    : `${APP_URL}/dashboard/bookings`

  const meetBlock = opts.meetLink
    ? `<div style="margin:20px 0;padding:16px;background:#f4efe6;border-radius:10px;border-left:4px solid #B77A22;">
        <p style="margin:0 0 8px;font-weight:600;color:#071A35;">Join your Google Meet session:</p>
        <a href="${opts.meetLink}"
           style="display:inline-block;padding:10px 20px;background:#071A35;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Join Google Meet
        </a>
        <p style="margin:8px 0 0;font-size:12px;color:#666;word-break:break-all;">${opts.meetLink}</p>
       </div>`
    : `<p style="color:#888;font-style:italic;margin:16px 0;">Check your bookings for the video meeting link.</p>`

  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
  <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#071A35;background:#FDFBF7;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:16px;padding:28px;border:1px solid #e8e3d9;">
    <div style="border-bottom:2px solid #B77A22;padding-bottom:12px;margin-bottom:20px;">
      <h2 style="margin:0;color:#071A35;font-size:20px;">HELPAMART</h2>
      <p style="margin:3px 0 0;color:#B77A22;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;">
        Session Reminder — ${isCountdown}
      </p>
    </div>
    <p>Hello <strong>${opts.recipientName}</strong>,</p>
    <p>Your HELPAMART session with <strong>${opts.otherPartyName}</strong> starts in <strong>${isCountdown}</strong>.</p>
    <div style="background:#FDFBF7;border:1px solid #e8e3d9;border-radius:10px;padding:16px;margin:16px 0;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:4px 0;color:#666;width:100px;">Session</td><td style="padding:4px 0;font-weight:600;">${opts.serviceTitle}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">${opts.role === 'mentor' ? 'Student' : 'Mentor'}</td><td style="padding:4px 0;font-weight:600;">${opts.otherPartyName}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Date</td><td style="padding:4px 0;font-weight:600;">${opts.dateStr}</td></tr>
        <tr><td style="padding:4px 0;color:#666;">Time</td><td style="padding:4px 0;font-weight:600;">${opts.timeStr} (${opts.timezone})</td></tr>
      </table>
    </div>
    ${meetBlock}
    <p style="font-size:13px;color:#888;margin-top:24px;border-top:1px solid #e8e3d9;padding-top:12px;">
      <a href="${dashboardUrl}" style="color:#B77A22;font-weight:600;">View in your HELPAMART dashboard →</a>
    </p>
  </div>
  </body></html>`
}

// ─── Core reminder logic ──────────────────────────────────────────────────────

async function processReminders(minutesBefore: number, column: 'reminder_60_sent_at' | 'reminder_30_sent_at') {
  const now = new Date()

  // Window: [now + (minutesBefore - 5), now + (minutesBefore + 5)]
  // Running every 2 min with a ±5 min window catches each booking exactly once.
  const windowStart = new Date(now.getTime() + (minutesBefore - 5) * 60_000).toISOString()
  const windowEnd   = new Date(now.getTime() + (minutesBefore + 5) * 60_000).toISOString()

  const { data: bookings, error } = await db
    .from('bookings')
    .select(`
      id, mentor_id, mentee_id,
      service_title, start_at, end_at, timezone, meet_link,
      mentor_email, student_email,
      ${column},
      mentors!inner(name, user_id)
    `)
    .eq('status', 'confirmed')
    .gte('start_at', windowStart)
    .lte('start_at', windowEnd)
    .is(column, null)   // not yet sent

  if (error) {
    console.error(`[REMINDER-${minutesBefore}] query error:`, error.message)
    return
  }

  if (!bookings || bookings.length === 0) {
    console.log(`[REMINDER-${minutesBefore}] No pending reminders in window ${windowStart} → ${windowEnd}`)
    return
  }

  console.log(`[REMINDER-${minutesBefore}] Processing ${bookings.length} booking(s)`)

  for (const b of bookings) {
    const mentor = (b as any).mentors
    const mentorName: string = mentor?.name ?? 'Your mentor'
    const tz = b.timezone || 'UTC'

    const dateStr = fmt(b.start_at, tz, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    const timeStr = fmt(b.start_at, tz, { hour: '2-digit', minute: '2-digit', hour12: true })

    // Fetch mentee profile name
    const { data: menteeProfile } = await db
      .from('profiles')
      .select('full_name, email')
      .eq('id', b.mentee_id)
      .maybeSingle()

    const menteeName = menteeProfile?.full_name ?? 'Student'
    const menteeEmail = b.student_email ?? menteeProfile?.email ?? null
    const mentorEmail = b.mentor_email ?? null

    const serviceTitle = b.service_title ?? 'Mentorship Session'

    // Send to mentee
    if (menteeEmail) {
      try {
        await sendEmail({
          to: menteeEmail,
          subject: `HELPAMART reminder — your session starts in ${minutesBefore} minutes`,
          html: reminderHtml({
            recipientName: menteeName,
            otherPartyName: mentorName,
            role: 'mentee',
            minutesBefore,
            serviceTitle,
            dateStr,
            timeStr,
            timezone: tz,
            meetLink: b.meet_link,
            bookingId: b.id,
          }),
        })
        console.log(`[REMINDER-${minutesBefore}] ✓ Email → mentee ${menteeEmail}`)
      } catch (e) {
        console.error(`[REMINDER-${minutesBefore}] ✗ Email failed for mentee ${menteeEmail}:`, e)
      }
    }

    // Send to mentor
    if (mentorEmail) {
      try {
        await sendEmail({
          to: mentorEmail,
          subject: `HELPAMART reminder — your session starts in ${minutesBefore} minutes`,
          html: reminderHtml({
            recipientName: mentorName,
            otherPartyName: menteeName,
            role: 'mentor',
            minutesBefore,
            serviceTitle,
            dateStr,
            timeStr,
            timezone: tz,
            meetLink: b.meet_link,
            bookingId: b.id,
          }),
        })
        console.log(`[REMINDER-${minutesBefore}] ✓ Email → mentor ${mentorEmail}`)
      } catch (e) {
        console.error(`[REMINDER-${minutesBefore}] ✗ Email failed for mentor ${mentorEmail}:`, e)
      }
    }

    // Mark as sent regardless of email success so we don't keep retrying
    const sentAt = new Date().toISOString()
    await db
      .from('bookings')
      .update({ [column]: sentAt, updated_at: sentAt })
      .eq('id', b.id)
  }
}

// ─── Edge Function entry point ────────────────────────────────────────────────

Deno.serve(async (_req: Request): Promise<Response> => {
  try {
    // Run both reminder windows in parallel
    await Promise.all([
      processReminders(60, 'reminder_60_sent_at'),
      processReminders(30, 'reminder_30_sent_at'),
    ])
    return new Response(JSON.stringify({ ok: true, ts: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[REMINDER] Fatal error:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
