/* POST /api/logout  ->  revokes this browser's session and clears the cookie */
import { endSession, fail, sameOrigin, send } from './_session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  if (!sameOrigin(req)) return fail(res, 403, 'Bad origin.');
  try { await endSession(req, res); } catch (e) { console.error('logout', e); }
  return send(res, 200, { ok: true });
}
