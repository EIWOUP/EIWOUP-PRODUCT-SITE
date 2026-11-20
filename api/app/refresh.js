/* POST /api/app/refresh  — keeps a signed-in terminal signed in, with no password.
     { refresh_token, device_id, app_version }
   -> { licenceToken, refreshToken, licence, policy, notices, serverTime }

   The terminal calls this at launch and about once an hour. Every call re-checks the account
   (ban, subscription, version, maintenance, this PC) and replaces the refresh token, so:
     * a copied refresh token stops working as soon as the real PC refreshes, and
     * presenting a token that was already replaced (outside a short race window) is treated as
       theft: every token for that PC is revoked and it must sign in again.
   Codes: SIGNED_OUT (sign in again), STALE_REFRESH (another refresh just won; use the newest
   stored token), plus the denials login.js lists. */
import { one, q, tx } from '../_db.js';
import { body, clientIp, fail, send } from '../_session.js';
import {
  AppError, REFRESH_REUSE_GRACE_SEC, appVersionOf, denial, deviceIdOf, issueLicence, logEvent, newRefreshToken,
  notices, policy, publicPolicy, sendError, sha256,
} from '../_licence.js';

const TOKEN_RE = /^[A-Za-z0-9_-]{40,64}$/;
const signedOut = () => new AppError(401, 'SIGNED_OUT', 'You were signed out of EIMC Terminal. Sign in again.');

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  let userId = null, deviceRowId = null, appVersion = null;
  const ip = clientIp(req);
  try {
    const b = await body(req);
    const presented = String(b.refresh_token || '');
    if (!TOKEN_RE.test(presented)) throw signedOut();
    const deviceId = deviceIdOf(b.device_id);
    appVersion = appVersionOf(b.app_version);
    const deviceHash = sha256(deviceId);

    const t = await one(
      `SELECT t.id, t.user_id, t.device_id, t.revoked, t.replaced_by, t.expires_at <= now() AS expired,
              extract(epoch FROM now() - t.last_used_at)::int AS idle_sec, d.device_hash
         FROM app_refresh_tokens t JOIN devices d ON d.id = t.device_id
        WHERE t.token_hash = $1`, [sha256(presented)]);
    if (!t) throw signedOut();
    userId = t.user_id; deviceRowId = t.device_id;

    if (t.device_hash !== deviceHash) {              // a token copied to another PC
      await logEvent(null, { userId, deviceRowId, event: 'denied', reason: 'DEVICE_MISMATCH', appVersion, ip });
      throw signedOut();
    }
    if (t.revoked) {
      if (t.replaced_by && t.idle_sec <= REFRESH_REUSE_GRACE_SEC)
        throw new AppError(409, 'STALE_REFRESH', 'This sign-in was just renewed. Use the newest saved token.');
      if (t.replaced_by) {                           // an old token came back: assume it was stolen
        await q(`UPDATE app_refresh_tokens SET revoked = true WHERE device_id = $1 AND NOT revoked`, [deviceRowId]);
        await logEvent(null, { userId, deviceRowId, event: 'token_reuse', appVersion, ip });
      }
      throw signedOut();
    }
    if (t.expired) throw signedOut();

    const pol = await policy();
    const access = await one(`SELECT * FROM app_access($1, $2, $3)`, [userId, deviceHash, appVersion]);
    if (['DEVICE_REVOKED', 'DEVICE_UNKNOWN', 'DEVICE_BLOCKED', 'BANNED', 'UNKNOWN_USER'].includes(access.code))
      await q(`UPDATE app_refresh_tokens SET revoked = true WHERE device_id = $1 AND NOT revoked`, [deviceRowId]);
    if (!['OK', 'EXPIRED'].includes(access.code)) throw denial(access.code, pol);

    const refresh = await tx(async c => {
      // Only one of two simultaneous refreshes with the same token may win.
      const won = (await c.query(
        `UPDATE app_refresh_tokens SET revoked = true, last_used_at = now(), last_ip = $2 WHERE id = $1 AND NOT revoked RETURNING id`,
        [t.id, ip])).rowCount;
      if (!won) throw new AppError(409, 'STALE_REFRESH', 'This sign-in was just renewed. Use the newest saved token.');
      const next = await newRefreshToken(c, userId, deviceRowId, ip);
      await c.query(`UPDATE app_refresh_tokens SET replaced_by = $2 WHERE id = $1`, [t.id, next.id]);
      await c.query(`UPDATE devices SET last_seen = now(), last_ip = coalesce($2, last_ip), app_version = $3 WHERE id = $1`,
        [deviceRowId, ip, appVersion]);
      await logEvent(c, { userId, deviceRowId, event: 'refresh', reason: access.code, appVersion, ip });
      return next;
    });

    const { token, licence } = await issueLicence({ access, userId, deviceId, appVersion, pol });
    return send(res, 200, {
      licenceToken: token, refreshToken: refresh.token, licence,
      policy: publicPolicy(pol), notices: await notices('terminal', licence.plan), serverTime: Date.now(),
    });
  } catch (e) {
    if (e instanceof AppError && userId && !['SIGNED_OUT', 'STALE_REFRESH', 'BAD_REQUEST'].includes(e.code))
      await logEvent(null, { userId, deviceRowId, event: 'denied', reason: e.code, appVersion, ip }).catch(() => {});
    return sendError(res, e, 'app/refresh');
  }
}
