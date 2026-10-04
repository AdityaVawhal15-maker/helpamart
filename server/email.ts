import nodemailer from 'nodemailer'

export interface BookingEmailDetails {
  bookingId: string
  mentorName: string
  mentorEmail: string
  studentName: string
  studentEmail: string
  serviceTitle: string
  startAt: string
  endAt: string
  durationMinutes: number
  timezone: string
  meetLink: string | null
}

// In-memory cache to prevent duplicate email dispatches on request retries
const dispatchedBookings = new Set<string>()

/**
 * Configure SMTP transporter using environment variables.
 * Fallbacks gracefully if SMTP is not yet configured.
 */
function createTransporter() {
  const host = process.env.SMTP_HOST
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    return null
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

function formatDate(isoString: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(isoString))
  } catch {
    return isoString.slice(0, 10)
  }
}

function formatTime(isoString: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(isoString))
  } catch {
    return isoString.slice(11, 16)
  }
}

/**
 * Send notification email to the MENTOR when a session is booked.
 */
export async function sendMentorBookingNotification(details: BookingEmailDetails): Promise<{ sent: boolean; reason?: string }> {
  const dedupKey = `mentor_${details.bookingId}`
  if (dispatchedBookings.has(dedupKey)) {
    return { sent: false, reason: 'duplicate_prevented' }
  }

  const transporter = createTransporter()
  const from = process.env.SMTP_FROM || 'HELPAMART <guidance@helpamart.com>'
  const dateStr = formatDate(details.startAt, details.timezone)
  const timeStr = formatTime(details.startAt, details.timezone)
  const endTimeStr = formatTime(details.endAt, details.timezone)

  const subject = `New Helpamart Mentoring Session Booked — ${details.serviceTitle}`
  const meetHtml = details.meetLink
    ? `<div style="margin: 24px 0; padding: 16px; background-color: #f4efe6; border-radius: 12px; border-left: 4px solid #B77A22;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #071A35;">Google Meet Conference Link:</p>
        <a href="${details.meetLink}" style="display: inline-block; padding: 10px 20px; background-color: #071A35; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">Join Google Meet</a>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Or copy: <a href="${details.meetLink}">${details.meetLink}</a></p>
       </div>`
    : `<p style="margin: 16px 0; color: #666; font-style: italic;">A video meeting link will be coordinated prior to the session.</p>`

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #071A35; background-color: #FDFBF7; padding: 24px;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e8e3d9; box-shadow: 0 4px 20px rgba(7, 26, 53, 0.05);">
        <div style="border-bottom: 2px solid #B77A22; padding-bottom: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0; color: #071A35; font-size: 24px; font-weight: 700;">HELPAMART</h2>
          <p style="margin: 4px 0 0 0; color: #B77A22; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">Mentorship Booking Notification</p>
        </div>
        <p style="font-size: 16px;">Hello <strong>${details.mentorName}</strong>,</p>
        <p style="font-size: 15px;">A student has booked a mentoring session with you on HELPAMART.</p>
        
        <div style="background-color: #FDFBF7; border: 1px solid #e8e3d9; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #666; width: 140px;">Session:</td><td style="padding: 6px 0; font-weight: 600;">${details.serviceTitle}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Student:</td><td style="padding: 6px 0; font-weight: 600;">${details.studentName} (${details.studentEmail})</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Date:</td><td style="padding: 6px 0; font-weight: 600;">${dateStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Time:</td><td style="padding: 6px 0; font-weight: 600;">${timeStr} – ${endTimeStr} (${details.timezone})</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Duration:</td><td style="padding: 6px 0; font-weight: 600;">${details.durationMinutes} minutes</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Booking ID:</td><td style="padding: 6px 0; font-mono; font-size: 12px;">${details.bookingId}</td></tr>
          </table>
        </div>

        ${meetHtml}

        <p style="font-size: 14px; color: #666; margin-top: 32px; border-top: 1px solid #e8e3d9; padding-top: 16px;">
          You can view and manage all your upcoming sessions anytime on your <a href="https://helpamart.com/mentor-dashboard" style="color: #B77A22; font-weight: 600;">HELPAMART Mentor Dashboard</a>.
        </p>
      </div>
    </body>
    </html>
  `

  if (!transporter) {
    console.log(`[EMAIL] (SMTP not configured) Mentor booking notification ready for ${details.mentorEmail}: Subject="${subject}"`)
    dispatchedBookings.add(dedupKey)
    return { sent: false, reason: 'smtp_not_configured' }
  }

  try {
    await transporter.sendMail({
      from,
      to: details.mentorEmail,
      replyTo: details.studentEmail,
      subject,
      html,
    })
    dispatchedBookings.add(dedupKey)
    console.log(`[EMAIL] Successfully sent booking notification to mentor: ${details.mentorEmail}`)
    return { sent: true }
  } catch (err) {
    console.error('[EMAIL] Failed to send mentor notification:', err)
    return { sent: false, reason: (err as Error).message }
  }
}

/**
 * Send confirmation email to the STUDENT when booking is confirmed.
 */
export async function sendStudentBookingConfirmation(details: BookingEmailDetails): Promise<{ sent: boolean; reason?: string }> {
  const dedupKey = `student_${details.bookingId}`
  if (dispatchedBookings.has(dedupKey)) {
    return { sent: false, reason: 'duplicate_prevented' }
  }

  const transporter = createTransporter()
  const from = process.env.SMTP_FROM || 'HELPAMART <guidance@helpamart.com>'
  const dateStr = formatDate(details.startAt, details.timezone)
  const timeStr = formatTime(details.startAt, details.timezone)
  const endTimeStr = formatTime(details.endAt, details.timezone)

  const subject = `Your Helpamart Mentoring Session is Confirmed — ${details.serviceTitle}`
  const meetHtml = details.meetLink
    ? `<div style="margin: 24px 0; padding: 16px; background-color: #f4efe6; border-radius: 12px; border-left: 4px solid #B77A22;">
        <p style="margin: 0 0 8px 0; font-weight: 600; color: #071A35;">Google Meet Video Conference Link:</p>
        <a href="${details.meetLink}" style="display: inline-block; padding: 10px 20px; background-color: #071A35; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600;">Join Google Meet</a>
        <p style="margin: 8px 0 0 0; font-size: 12px; color: #666;">Or copy: <a href="${details.meetLink}">${details.meetLink}</a></p>
       </div>`
    : `<p style="margin: 16px 0; color: #666; font-style: italic;">A video meeting link will be shared prior to your session.</p>`

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #071A35; background-color: #FDFBF7; padding: 24px;">
      <div style="max-width: 580px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; padding: 32px; border: 1px solid #e8e3d9; box-shadow: 0 4px 20px rgba(7, 26, 53, 0.05);">
        <div style="border-bottom: 2px solid #B77A22; padding-bottom: 16px; margin-bottom: 24px;">
          <h2 style="margin: 0; color: #071A35; font-size: 24px; font-weight: 700;">HELPAMART</h2>
          <p style="margin: 4px 0 0 0; color: #B77A22; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.1em;">Session Confirmed</p>
        </div>
        <p style="font-size: 16px;">Hello <strong>${details.studentName}</strong>,</p>
        <p style="font-size: 15px;">Your mentoring session with <strong>${details.mentorName}</strong> has been successfully booked and confirmed.</p>
        
        <div style="background-color: #FDFBF7; border: 1px solid #e8e3d9; border-radius: 12px; padding: 20px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr><td style="padding: 6px 0; color: #666; width: 140px;">Session:</td><td style="padding: 6px 0; font-weight: 600;">${details.serviceTitle}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Mentor:</td><td style="padding: 6px 0; font-weight: 600;">${details.mentorName}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Date:</td><td style="padding: 6px 0; font-weight: 600;">${dateStr}</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Time:</td><td style="padding: 6px 0; font-weight: 600;">${timeStr} – ${endTimeStr} (${details.timezone})</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Duration:</td><td style="padding: 6px 0; font-weight: 600;">${details.durationMinutes} minutes</td></tr>
            <tr><td style="padding: 6px 0; color: #666;">Booking ID:</td><td style="padding: 6px 0; font-mono; font-size: 12px;">${details.bookingId}</td></tr>
          </table>
        </div>

        ${meetHtml}

        <p style="font-size: 14px; color: #666; margin-top: 32px; border-top: 1px solid #e8e3d9; padding-top: 16px;">
          View this booking anytime in your <a href="https://helpamart.com/dashboard/bookings" style="color: #B77A22; font-weight: 600;">HELPAMART Bookings Dashboard</a>.
        </p>
      </div>
    </body>
    </html>
  `

  if (!transporter) {
    console.log(`[EMAIL] (SMTP not configured) Student confirmation ready for ${details.studentEmail}: Subject="${subject}"`)
    dispatchedBookings.add(dedupKey)
    return { sent: false, reason: 'smtp_not_configured' }
  }

  try {
    await transporter.sendMail({
      from,
      to: details.studentEmail,
      replyTo: details.mentorEmail,
      subject,
      html,
    })
    dispatchedBookings.add(dedupKey)
    console.log(`[EMAIL] Successfully sent confirmation email to student: ${details.studentEmail}`)
    return { sent: true }
  } catch (err) {
    console.error('[EMAIL] Failed to send student confirmation:', err)
    return { sent: false, reason: (err as Error).message }
  }
}
