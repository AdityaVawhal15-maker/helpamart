/**
 * HELPAMART — GET /api/admin-calendar-connect
 *
 * FORWARDING COMPATIBILITY ENDPOINT:
 * Redirects to the Google Meet authorization flow (/api/admin-meet-connect).
 * Google Calendar is removed from the booking architecture.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Seamlessly redirect to the dedicated Google Meet authorization
  return res.redirect(302, '/api/admin-meet-connect')
}
