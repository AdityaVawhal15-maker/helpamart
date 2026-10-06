/**
 * HELPAMART — GET /api/admin-calendar-status
 *
 * COMPATIBILITY ENDPOINT:
 * Checks Google Meet connection status via admin-meet-status.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import meetStatusHandler from './admin-meet-status.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return meetStatusHandler(req, res)
}
