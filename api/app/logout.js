/* POST /api/app/logout  — "Sign out" in EIMC Terminal.
     { refresh_token, device_id }  ->  { ok: true }

   Revokes every refresh token of this PC and frees its device slot (devices.revoked = true:
   "slot released"), so the customer can sign in on another PC straight away. Signing in again
   on this PC re-activates it if a slot is free. A PC the admin blocked stays blocked.
   Always answers { ok: true }, so it cannot be used to probe which tokens exist. */
import { one, tx } from '../_db.js';
import { body, clientIp, fail, send } from '../_session.js';
import { appVersionOf, logEvent, sendError, sha256 } from '../_licence.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  try {
    const b = await body(req);
    const presented = String(b.refresh_token || '');
    const deviceId = String(b.device_id || '').trim().toLowerCase();
    let appVersion = null;
    try { appVersion = appVersionOf(b.app_version); } catch { /* optional here */ }

    if (/^[A-Za-z0-9_-]{40,64}$/.test(presented) && /^[0-9a-f]{32,64}$/.test(deviceId)) {
      const t = await one(
        `SELECT t.user_id, t.device_id FROM app_refresh_tokens t JOIN devices d ON d.id = t.device_id
          WHERE t.token_hash = $1 AND d.device_hash = $2`, [sha256(presented), sha256(deviceId)]);
      if (t) await tx(async c => {
        await c.query(`UPDATE app_refresh_tokens SET revoked = true WHERE device_id = $1 AND NOT revoked`, [t.device_id]);
        await c.query(`UPDATE devices SET revoked = true WHERE id = $1 AND NOT blocked`, [t.device_id]);
        await logEvent(c, { userId: t.user_id, deviceRowId: t.device_id, event: 'signout', appVersion, ip: clientIp(req) });
      });
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    return sendError(res, e, 'app/logout');
  }
}
