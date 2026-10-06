/**
 * HELPAMART — GET /api/admin-calendar-callback
 *
 * COMPATIBILITY ENDPOINT:
 * In case Google Cloud Console OAuth 2.0 Client credentials still list
 * /api/admin-calendar-callback as the authorized redirect URI, this endpoint
 * accepts the callback and completes the Google Meet token exchange.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import meetCallbackHandler from './admin-meet-callback.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  return meetCallbackHandler(req, res)
}
