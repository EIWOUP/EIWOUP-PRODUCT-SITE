/* POST /api/login  { id, password, remember }  ->  { userId, name, expires }
   id may be the Client ID, email or mobile number. */
import { one, q } from './_db.js';
import { body, clientIp, createSession, fail, sameOrigin, send } from './_session.js';

const MAX_FAILS = 5;          // per login id, and per IP (x4), in the window below
const WINDOW_MIN = 15;
const BAD = 'That client ID and password do not match.';

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  if (!sameOrigin(req)) return fail(res, 403, 'Bad origin.');
  try {
    const b = await body(req);
    const id = String(b.id || '').trim().slice(0, 120);
    const password = String(b.password || '');
    if (!id || !password) return fail(res, 400, 'Enter your client ID and password.');
    const ip = clientIp(req);

    const lim = await one(
      `SELECT count(*) FILTER (WHERE lower(login_id) = lower($1))      AS by_id,
              count(*) FILTER (WHERE $2::inet IS NOT NULL AND ip_address = $2::inet) AS by_ip
         FROM login_history
        WHERE NOT success AND at > now() - make_interval(mins => $3)`, [id, ip, WINDOW_MIN]);
    if (+lim.by_id >= MAX_FAILS || +lim.by_ip >= MAX_FAILS * 4)
      return fail(res, 429, `Too many attempts. Try again in ${WINDOW_MIN} minutes.`, 'locked');

    const phone = id.replace(/[\s-]/g, '');
    const u = await one(
      `SELECT u.id, u.full_name, u.status, u.password_hash = crypt($2, u.password_hash) AS ok
         FROM users u
        WHERE u.client_id::text = $1 OR lower(u.email) = lower($1)
           OR u.phone = $3 OR u.phone = '+91' || $3
        LIMIT 1`, [id, password, phone]);

    // unknown id: still spend the bcrypt time, so response time does not reveal which ids exist
    if (!u) await q(`SELECT crypt($1, gen_salt('bf', 10))`, [password]);

    const ua = String(req.headers['user-agent'] || '').slice(0, 300);
    const ok = !!(u && u.ok && u.status === 'active');
    await q(`INSERT INTO login_history (user_id, login_id, success, ip_address, user_agent) VALUES ($1, $2, $3, $4, $5)`,
      [u?.id || null, id, ok, ip, ua]);

    if (!ok) {
      if (u) await q(`UPDATE user_security SET failed_login_count = failed_login_count + 1 WHERE user_id = $1`, [u.id]);
      return fail(res, 401, u && u.ok ? 'This account is not active. Please contact support.' : BAD, 'auth');
    }

    await q(`UPDATE users SET last_login_at = now() WHERE id = $1`, [u.id]);
    await q(`UPDATE user_security SET failed_login_count = 0 WHERE user_id = $1`, [u.id]);
    const expires = await createSession(req, res, u.id, !!b.remember);
    return send(res, 200, { userId: String(u.id), name: u.full_name, expires: expires.getTime() });
  } catch (e) {
    console.error('login', e);
    return fail(res, 500, 'The server could not sign you in. Try again in a moment.');
  }
}
