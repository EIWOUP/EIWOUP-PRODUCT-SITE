/* POST /api/app/login  — EIMC Terminal sign-in, once per PC.
     { id, password, device_id, device_label, os, app_version }
   -> { licenceToken, refreshToken, licence, account, policy, notices, serverTime }

   id may be the client ID, email or mobile number (same as the website). On success this PC
   takes one of the account's device slots, and the terminal keeps the refresh token to stay
   signed in (POST /api/app/refresh). Failures carry a `code` the terminal turns into a screen:
   AUTH, LOCKED, BANNED, NO_LICENCE, DEVICE_LIMIT, DEVICE_BLOCKED, UPDATE_REQUIRED, SERVICE_DOWN. */
import { one, q, tx } from '../_db.js';
import { body, clientIp, fail, send } from '../_session.js';
import {
  AppError, appVersionOf, denial, deviceIdOf, issueLicence, logEvent, newRefreshToken, notices, policy,
  publicPolicy, sendError, sha256, text,
} from '../_licence.js';

const MAX_FAILS = 5;          // per login id, and per IP (x4), in the window below: same as the website
const WINDOW_MIN = 15;
const BAD = 'That client ID or email and password do not match.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  let userId = null, appVersion = null;
  const ip = clientIp(req);
  try {
    const b = await body(req);
    const id = String(b.id || '').trim().slice(0, 120);
    const password = String(b.password || '');
    if (!id || !password) throw new AppError(400, 'BAD_REQUEST', 'Enter your client ID or email, and your password.');
    const deviceId = deviceIdOf(b.device_id);
    appVersion = appVersionOf(b.app_version);
    const label = text(b.device_label, 60), os = text(b.os, 60);
    const ua = `EIMC Terminal ${appVersion}`;

    // Failed attempts are counted in the same table as website sign-ins, so guessing cannot
    // switch between the site and the terminal to get more tries.
    const lim = await one(
      `SELECT count(*) FILTER (WHERE lower(login_id) = lower($1))                     AS by_id,
              count(*) FILTER (WHERE $2::inet IS NOT NULL AND ip_address = $2::inet) AS by_ip
         FROM login_history
        WHERE NOT success AND at > now() - make_interval(mins => $3)`, [id, ip, WINDOW_MIN]);
    if (+lim.by_id >= MAX_FAILS || +lim.by_ip >= MAX_FAILS * 4)
      throw new AppError(429, 'LOCKED', `Too many attempts. Try again in ${WINDOW_MIN} minutes.`);

    const phone = id.replace(/[\s-]/g, '');
    const u = await one(
      `SELECT u.id, u.client_id, u.full_name, u.password_hash = crypt($2, u.password_hash) AS ok
         FROM users u
        WHERE u.client_id::text = $1 OR lower(u.email) = lower($1) OR u.phone = $3 OR u.phone = '+91' || $3
        LIMIT 1`, [id, password, phone]);
    if (!u) await q(`SELECT crypt($1, gen_salt('bf', 10))`, [password]);   // same time for unknown ids

    if (!(u && u.ok)) {
      await q(`INSERT INTO login_history (user_id, login_id, success, ip_address, user_agent) VALUES ($1, $2, false, $3, $4)`,
        [u?.id || null, id, ip, ua]);
      if (u) await q(`UPDATE user_security SET failed_login_count = failed_login_count + 1 WHERE user_id = $1`, [u.id]);
      throw new AppError(401, 'AUTH', BAD);
    }
    userId = u.id;

    // Account-level checks first (ban, version, maintenance), so a refused PC never takes a slot.
    const pol = await policy();
    const acct = await one(`SELECT * FROM app_access($1, NULL, $2)`, [userId, appVersion]);
    if (!['OK', 'EXPIRED'].includes(acct.code)) throw denial(acct.code, pol);

    const deviceHash = sha256(deviceId);
    const out = await tx(async c => {
      const reg = (await c.query(`SELECT * FROM app_register_device($1, $2, $3, $4, $5, $6)`,
        [userId, deviceHash, label, os, appVersion, ip])).rows[0];
      if (reg.code !== 'OK') throw denial(reg.code, pol);
      const access = (await c.query(`SELECT * FROM app_access($1, $2, $3)`, [userId, deviceHash, appVersion])).rows[0];
      if (!['OK', 'EXPIRED'].includes(access.code)) throw denial(access.code, pol);

      const refresh = await newRefreshToken(c, userId, reg.device_id, ip);
      await c.query(`INSERT INTO login_history (user_id, login_id, success, ip_address, user_agent) VALUES ($1, $2, true, $3, $4)`,
        [userId, id, ip, ua]);
      await c.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [userId]);
      await c.query(`UPDATE user_security SET failed_login_count = 0 WHERE user_id = $1`, [userId]);
      await logEvent(c, { userId, deviceRowId: reg.device_id, event: 'activate', reason: access.code, appVersion, ip,
                          details: { label, os } });
      return { access, refresh };
    });

    const { token, licence } = await issueLicence({ access: out.access, userId, deviceId, appVersion, pol });
    return send(res, 200, {
      licenceToken: token, refreshToken: out.refresh.token, licence,
      account: { userId: String(userId), clientId: String(u.client_id), name: u.full_name },
      policy: publicPolicy(pol), notices: await notices('terminal', licence.plan), serverTime: Date.now(),
    });
  } catch (e) {
    if (e instanceof AppError && userId && e.code !== 'BAD_REQUEST')
      await logEvent(null, { userId, event: 'denied', reason: e.code, appVersion, ip }).catch(() => {});
    return sendError(res, e, 'app/login');
  }
}
