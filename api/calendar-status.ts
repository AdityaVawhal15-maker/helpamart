/**
 * HELPAMART — GET /api/calendar-status
 *
 * Mentors do NOT need to connect Google Calendar.
 * All bookings automatically generate Google Meet video spaces via the central HELPAMART account.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_URL || 'https://www.helpamart.com')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()

  return res.status(200).json({
    connected: false,
    required: false,
    message: 'Google Calendar connection is not required. All sessions use central Google Meet automatically.',
  })
}
