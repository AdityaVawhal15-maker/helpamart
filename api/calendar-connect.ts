/**
 * HELPAMART — GET /api/calendar-connect
 *
 * Mentors do NOT need to connect Google Calendar.
 * All bookings automatically generate Google Meet video spaces via the central HELPAMART account.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    message: 'Mentors do not need to connect Google Calendar. Google Meet is handled automatically by HELPAMART.',
  })
}
