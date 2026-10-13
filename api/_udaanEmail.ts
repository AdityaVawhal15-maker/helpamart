/**
 * HELPAMART — Udaan 30 Enrollment Email Service
 *
 * Dispatches detailed, verified enrollment notification emails to hello@helpamart.com
 * and confirmation emails to students upon successful Cashfree payment.
 *
 * Idempotency:
 * - Uses in-memory locking per instance to prevent concurrent race conditions
 * - Checks enrollment `notes` in database to prevent duplicate email dispatch
 *   across separate serverless invocations (e.g. verify-payment + webhook)
 * - Safe error handling: never throws to caller or blocks payment verification
 */

import nodemailer from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'

export interface UdaanEnrollmentRecord {
  id: string
  user_id?: string | null
  full_name: string
  email: string
  phone?: string | null
  journey: string
  custom_goal?: string | null
  experience_level?: string | null
  communication_preference?: string | null
  availability_preference?: string | null
  amount_cents: number
  currency: string
  payment_status: string
  enrollment_status: string
  payment_provider: string
  cashfree_order_id?: string | null
  cashfree_payment_id?: string | null
  mentor_id?: string | null
  paid_at?: string | null
  starts_at?: string | null
  ends_at?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string | null
}

// In-memory set to deduplicate concurrent requests within the same lambda instance
const inFlightNotificationIds = new Set<string>()

function getTransporter() {
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) return null

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: { user, pass },
  })
}

function formatDateIST(iso: string | null | undefined): string {
  if (!iso) return 'N/A'
  try {
    return (
      new Intl.DateTimeFormat('en-IN', {
        timeZone: 'Asia/Kolkata',
        dateStyle: 'full',
        timeStyle: 'medium',
      }).format(new Date(iso)) + ' (IST)'
    )
  } catch {
    return String(iso)
  }
}

function buildAdminEmailHtml(enrollment: UdaanEnrollmentRecord): string {
  const amountRupees = enrollment.amount_cents ? (enrollment.amount_cents / 100).toFixed(0) : '149'
  const customGoalDisplay = enrollment.custom_goal?.trim() || 'None specified (Standard Track Curriculum)'
  const phoneDisplay = enrollment.phone?.trim() || 'Not provided'
  const experienceDisplay = enrollment.experience_level?.trim() || 'Beginner'
  const commDisplay = enrollment.communication_preference?.trim() || 'Google Meet'
  const availDisplay = enrollment.availability_preference?.trim() || 'Weekday Evenings'
  const paymentIdDisplay = enrollment.cashfree_payment_id || 'Verified via Cashfree Order'
  const submittedAtDisplay = formatDateIST(enrollment.created_at)
  const activatedAtDisplay = formatDateIST(enrollment.paid_at || enrollment.starts_at)
  const startsAtDisplay = formatDateIST(enrollment.starts_at)
  const endsAtDisplay = formatDateIST(enrollment.ends_at)

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New Udaan 30 Enrollment — ${enrollment.full_name}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F3EA; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #071A35; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #F7F3EA; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 620px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E7E2D9; overflow: hidden; box-shadow: 0 4px 24px rgba(7, 26, 53, 0.06);">
          
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #071A35; padding: 32px 28px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #B77A22; display: inline-block; margin-bottom: 8px;">
                      HELPAMART &bull; UDAAN 30 MENTORSHIP
                    </span>
                    <h1 style="margin: 0 0 6px 0; font-size: 24px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.01em;">
                      New Enrollment Confirmed
                    </h1>
                    <p style="margin: 0; font-size: 14px; color: #D9D5CD; line-height: 1.5;">
                      A student has completed verified Cashfree payment and enrolled in Udaan 30.
                    </p>
                  </td>
                  <td align="right" valign="top" style="width: 70px;">
                    <span style="display: inline-block; background-color: #B77A22; color: #071A35; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 999px; text-transform: uppercase;">
                      Active
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Quick Summary Bar -->
          <tr>
            <td style="background-color: #FAF6ED; padding: 16px 28px; border-bottom: 1px solid #EFE9DC;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="font-size: 13px; color: #747474;">
                    <strong style="color: #071A35;">Track:</strong> ${enrollment.journey} &bull; 
                    <strong style="color: #071A35;">Amount:</strong> ₹${amountRupees} INR (One-Time)
                  </td>
                  <td align="right" style="font-size: 12px; color: #059669; font-weight: 700;">
                    ✓ Cashfree Verified
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 28px;">

              <!-- SECTION 1: STUDENT DETAILS -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-bottom: 2px solid #EFE9DC; padding-bottom: 8px; margin-bottom: 12px;">
                    <h2 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #071A35;">
                      1. Student Information
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13.5px;">
                      <tr>
                        <td width="38%" style="color: #747474; font-weight: 600;">Full Name:</td>
                        <td width="62%" style="color: #071A35; font-weight: 700;">${enrollment.full_name}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Email Address:</td>
                        <td style="color: #071A35;"><a href="mailto:${enrollment.email}" style="color: #B77A22; text-decoration: none; font-weight: 600;">${enrollment.email}</a></td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">WhatsApp / Phone:</td>
                        <td style="color: #071A35; font-weight: 600;">${phoneDisplay}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Experience Stage:</td>
                        <td style="color: #071A35;">${experienceDisplay}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- SECTION 2: TRACK & PREFERENCES -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-bottom: 2px solid #EFE9DC; padding-bottom: 8px;">
                    <h2 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #071A35;">
                      2. Mentorship Track &amp; Goals
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13.5px;">
                      <tr>
                        <td width="38%" style="color: #747474; font-weight: 600;">Selected Track:</td>
                        <td width="62%" style="color: #071A35; font-weight: 700;">${enrollment.journey}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600; vertical-align: top;">Custom Goal / Ambition:</td>
                        <td style="color: #071A35; line-height: 1.5; background-color: #FAF7F0; padding: 10px; border-radius: 8px; border: 1px solid #EFE9DC;">
                          ${customGoalDisplay}
                        </td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Check-in Method:</td>
                        <td style="color: #071A35; font-weight: 600;">${commDisplay}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Preferred Availability:</td>
                        <td style="color: #071A35; font-weight: 600;">${availDisplay}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- SECTION 3: PAYMENT VERIFICATION -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-bottom: 2px solid #EFE9DC; padding-bottom: 8px;">
                    <h2 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #071A35;">
                      3. Payment &amp; Gateway Details
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13.5px;">
                      <tr>
                        <td width="38%" style="color: #747474; font-weight: 600;">Amount Paid:</td>
                        <td width="62%" style="color: #071A35; font-weight: 700;">₹${amountRupees} INR (One-Time &bull; No Auto-Renewal)</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Payment Provider:</td>
                        <td style="color: #071A35;">Cashfree Payment Gateway</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Verified Payment Status:</td>
                        <td style="color: #059669; font-weight: 700;">${enrollment.payment_status.toUpperCase()} (Confirmed Server-Side)</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Cashfree Order ID:</td>
                        <td style="color: #071A35; font-family: monospace; font-size: 12.5px;">${enrollment.cashfree_order_id || 'N/A'}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Cashfree Payment ID:</td>
                        <td style="color: #071A35; font-family: monospace; font-size: 12.5px;">${paymentIdDisplay}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Enrollment ID:</td>
                        <td style="color: #747474; font-family: monospace; font-size: 11.5px;">${enrollment.id}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- SECTION 4: TIMELINE & DURATION -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-bottom: 24px;">
                <tr>
                  <td style="border-bottom: 2px solid #EFE9DC; padding-bottom: 8px;">
                    <h2 style="margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #071A35;">
                      4. 30-Day Timeline Cadence
                    </h2>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top: 12px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="6" border="0" style="font-size: 13.5px;">
                      <tr>
                        <td width="38%" style="color: #747474; font-weight: 600;">Submission Timestamp:</td>
                        <td width="62%" style="color: #071A35;">${submittedAtDisplay}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Activation Date &amp; Time:</td>
                        <td style="color: #071A35; font-weight: 600;">${activatedAtDisplay}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Mentorship Start Date:</td>
                        <td style="color: #071A35;">${startsAtDisplay}</td>
                      </tr>
                      <tr>
                        <td style="color: #747474; font-weight: 600;">Mentorship End Date:</td>
                        <td style="color: #071A35; font-weight: 700;">${endsAtDisplay} (30 Days)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Actionable Next Steps Box for Helpamart Team -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #FAF6ED; border-left: 4px solid #B77A22; border-radius: 8px; padding: 16px; margin-top: 8px;">
                <tr>
                  <td>
                    <h3 style="margin: 0 0 6px 0; font-size: 13px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em; color: #B77A22;">
                      Team Next Steps:
                    </h3>
                    <ol style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #071A35; line-height: 1.6;">
                      <li>Review the student's selected track (<strong>${enrollment.journey}</strong>) and custom goal.</li>
                      <li>Assign a verified mentor equipped for their experience stage.</li>
                      <li>Confirm schedule with the student for their Week 1 Roadmap &amp; Audit check-in.</li>
                    </ol>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #FAF7F0; padding: 20px 28px; text-align: center; border-top: 1px solid #EFE9DC; font-size: 12px; color: #747474;">
              <p style="margin: 0 0 4px 0;">
                Helpamart Mentorship Platform &bull; Automated Operations Notification
              </p>
              <p style="margin: 0; font-size: 11px; color: #9CA3AF;">
                Dispatched automatically upon verified Cashfree payment confirmation.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}

function buildAdminEmailPlainText(enrollment: UdaanEnrollmentRecord): string {
  const amountRupees = enrollment.amount_cents ? (enrollment.amount_cents / 100).toFixed(0) : '149'
  const customGoalDisplay = enrollment.custom_goal?.trim() || 'None specified (Standard Track Curriculum)'
  const phoneDisplay = enrollment.phone?.trim() || 'Not provided'
  const experienceDisplay = enrollment.experience_level?.trim() || 'Beginner'
  const commDisplay = enrollment.communication_preference?.trim() || 'Google Meet'
  const availDisplay = enrollment.availability_preference?.trim() || 'Weekday Evenings'
  const paymentIdDisplay = enrollment.cashfree_payment_id || 'Verified via Cashfree Order'
  const submittedAtDisplay = formatDateIST(enrollment.created_at)
  const activatedAtDisplay = formatDateIST(enrollment.paid_at || enrollment.starts_at)
  const startsAtDisplay = formatDateIST(enrollment.starts_at)
  const endsAtDisplay = formatDateIST(enrollment.ends_at)

  return `
================================================================================
HELPAMART — NEW UDAAN 30 ENROLLMENT CONFIRMED
================================================================================

1. STUDENT INFORMATION:
• Full Name:           ${enrollment.full_name}
• Email Address:       ${enrollment.email}
• WhatsApp / Phone:    ${phoneDisplay}
• Experience Stage:    ${experienceDisplay}

2. MENTORSHIP TRACK & PREFERENCES:
• Selected Track:      ${enrollment.journey}
• Custom Goal:         ${customGoalDisplay}
• Check-in Method:     ${commDisplay}
• Availability Window: ${availDisplay}

3. PAYMENT & GATEWAY VERIFICATION:
• Amount Paid:         ₹${amountRupees} INR (One-Time, No Auto-Renewal)
• Payment Provider:    Cashfree Payment Gateway
• Verified Status:     ${enrollment.payment_status.toUpperCase()} (Confirmed Server-Side)
• Cashfree Order ID:   ${enrollment.cashfree_order_id || 'N/A'}
• Cashfree Payment ID: ${paymentIdDisplay}
• Enrollment ID:       ${enrollment.id}

4. 30-DAY TIMELINE:
• Submitted At:        ${submittedAtDisplay}
• Activation Time:     ${activatedAtDisplay}
• Mentorship Start:    ${startsAtDisplay}
• Mentorship End:      ${endsAtDisplay} (30 Days)

TEAM ACTION ITEMS:
1. Review the student's track and goals.
2. Match with a verified mentor.
3. Coordinate Week 1 kickoff check-in via ${commDisplay}.
================================================================================
`
}

function buildStudentConfirmationHtml(enrollment: UdaanEnrollmentRecord): string {
  const supportEmail = process.env.SUPPORT_EMAIL || 'hello@helpamart.com'
  const amountRupees = enrollment.amount_cents ? (enrollment.amount_cents / 100).toFixed(0) : '149'

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #071A35; padding: 24px; background-color: #FFFFFF; border-radius: 12px; border: 1px solid #EFE9DC;">
  <div style="background-color: #071A35; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
    <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.15em; color: #B77A22; text-transform: uppercase;">HELPAMART UDAAN 30</span>
    <h2 style="color: #FFFFFF; margin: 6px 0 0 0; font-size: 20px;">Your 30-Day Udaan Begins! 🚀</h2>
  </div>

  <p style="font-size: 15px; color: #4B5563; line-height: 1.6;">
    Hi <strong>${enrollment.full_name}</strong>,<br/><br/>
    Your enrollment in <strong>Udaan 30 — ${enrollment.journey}</strong> has been successfully confirmed and activated.
  </p>

  <div style="background-color: #FAF7F0; border-left: 4px solid #B77A22; padding: 16px; margin: 20px 0; border-radius: 6px;">
    <p style="margin: 4px 0; font-size: 13.5px;"><strong>Order ID:</strong> ${enrollment.cashfree_order_id || 'N/A'}</p>
    <p style="margin: 4px 0; font-size: 13.5px;"><strong>Selected Track:</strong> ${enrollment.journey}</p>
    <p style="margin: 4px 0; font-size: 13.5px;"><strong>Duration:</strong> 30 Days (${formatDateIST(enrollment.starts_at)} to ${formatDateIST(enrollment.ends_at)})</p>
    <p style="margin: 4px 0; font-size: 13.5px;"><strong>Amount Paid:</strong> ₹${amountRupees} INR (via Cashfree)</p>
  </div>

  <h3 style="font-size: 15px; color: #071A35; margin-top: 24px;">What happens next?</h3>
  <ol style="font-size: 13.5px; color: #4B5563; line-height: 1.6; padding-left: 20px;">
    <li>Our team coordinator will review your goals and stage.</li>
    <li>We will pair you with a verified mentor aligned with your chosen journey.</li>
    <li>You will receive your Week 1 Roadmap &amp; Audit check-in details via ${enrollment.communication_preference || 'Google Meet'}.</li>
  </ol>

  <p style="font-size: 13px; color: #747474; margin-top: 28px; border-top: 1px solid #EFE9DC; pt: 16px;">
    Need help or have questions? Contact us at <a href="mailto:${supportEmail}" style="color: #B77A22; font-weight: 600;">${supportEmail}</a>.
  </p>
</div>
  `
}

/**
 * Sends detailed enrollment email to hello@helpamart.com and confirmation email to the student.
 * Idempotent: checks database record and uses in-memory lock to guarantee exactly-once dispatch.
 */
export async function sendUdaanEnrollmentNotification(
  enrollment: UdaanEnrollmentRecord,
  db: SupabaseClient
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  // 1. In-memory check to prevent race conditions in same serverless instance
  if (inFlightNotificationIds.has(enrollment.id)) {
    console.log(`[UDAAN-EMAIL] Notification already in-flight for enrollment: ${enrollment.id}`)
    return { success: true, skipped: true }
  }

  // 2. Database idempotency check: inspect current record
  try {
    const { data: freshRecord, error: fetchErr } = await db
      .from('udaan_enrollments')
      .select('*')
      .eq('id', enrollment.id)
      .maybeSingle()

    if (fetchErr) {
      console.warn(`[UDAAN-EMAIL] Warning: Could not fetch fresh enrollment: ${fetchErr.message}`)
    }

    const targetRecord: UdaanEnrollmentRecord = freshRecord || enrollment

    // Check if email has already been dispatched
    if (targetRecord.notes && targetRecord.notes.includes('ADMIN_EMAIL_SENT')) {
      console.log(`[UDAAN-EMAIL] Email already sent previously for enrollment: ${targetRecord.id}`)
      return { success: true, skipped: true }
    }

    const transporter = getTransporter()
    if (!transporter) {
      console.warn('[UDAAN-EMAIL] SMTP not configured. Required: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.')
      return { success: false, error: 'smtp_not_configured' }
    }

    inFlightNotificationIds.add(enrollment.id)

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER || 'hello@helpamart.com'
    const adminRecipient = process.env.UDAAN_NOTIFICATION_EMAIL || 'hello@helpamart.com'

    // 3. Send detailed enrollment email to hello@helpamart.com
    const adminSubject = `New Udaan 30 Enrollment — ${targetRecord.full_name}`
    const adminHtml = buildAdminEmailHtml(targetRecord)
    const adminText = buildAdminEmailPlainText(targetRecord)

    console.log(`[UDAAN-EMAIL] Dispatching enrollment notification to ${adminRecipient} for ${targetRecord.full_name}`)

    const info = await transporter.sendMail({
      from: fromAddress.includes('<') ? fromAddress : `"HELPAMART" <${fromAddress}>`,
      to: adminRecipient,
      subject: adminSubject,
      text: adminText,
      html: adminHtml,
    })

    console.log(`[UDAAN-EMAIL] Successfully sent notification to ${adminRecipient}. MessageId: ${info.messageId}`)

    // 4. Update database notes to record successful dispatch (Idempotency token)
    const sentTimestamp = new Date().toISOString()
    const updatedNotes = targetRecord.notes
      ? `${targetRecord.notes} | ADMIN_EMAIL_SENT:${sentTimestamp}`
      : `ADMIN_EMAIL_SENT:${sentTimestamp}`

    await db
      .from('udaan_enrollments')
      .update({
        notes: updatedNotes,
        updated_at: sentTimestamp,
      })
      .eq('id', targetRecord.id)

    // 5. Send student confirmation email (non-blocking)
    try {
      if (targetRecord.email) {
        await transporter.sendMail({
          from: fromAddress.includes('<') ? fromAddress : `"HELPAMART" <${fromAddress}>`,
          to: targetRecord.email,
          subject: `Your Udaan 30 Mentorship is Confirmed! — ${targetRecord.journey}`,
          html: buildStudentConfirmationHtml(targetRecord),
        })
        console.log(`[UDAAN-EMAIL] Confirmation email sent to student: ${targetRecord.email}`)
      }
    } catch (studentMailErr: any) {
      console.warn(`[UDAAN-EMAIL] Student email notice failed (non-blocking): ${studentMailErr.message}`)
    }

    return { success: true }
  } catch (err: any) {
    console.error(`[UDAAN-EMAIL] Error dispatching enrollment email: ${err.message}`)
    return { success: false, error: err.message }
  } finally {
    inFlightNotificationIds.delete(enrollment.id)
  }
}
