/* POST /api/signup  { name, email, phone, password, offers, agree, website }
   ->  { userId, clientId, name, trialEnds, expires }

   Self sign-up: creates everything an account needs in one transaction
   (user, profile, security, notification settings, licence key, a 1-day
   Pro trial and a welcome message), then signs the new customer in.
   Same tables EIMC-Admin reads, so the account shows up there at once,
   marked signup_source = 'website'.

   Abuse limits: a hidden honeypot field, at most 3 sign-ups per IP per
   hour, one account per email and per mobile number (so one trial each). */
import crypto from 'node:crypto';
import { one, tx } from './_db.js';
import { body, clientIp, createSession, fail, sameOrigin, send } from './_session.js';

const TRIAL_DAYS = 1;                 // matches TRIAL_DAYS in js/pricing-data.js
const PER_IP_HOUR = 3;

const str = (v, max) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
const licenceKey = () => 'EIMC-' + Array.from({ length: 3 }, () => crypto.randomBytes(2).toString('hex').toUpperCase()).join('-');

class UserError extends Error { constructor(m, field) { super(m); this.field = field; } }

function check(b) {
  const name = str(b.name, 120);
  const email = str(b.email, 320).toLowerCase();
  const raw = String(b.phone ?? '').replace(/[\s()-]/g, '');
  const password = String(b.password ?? '');
  if (name.length < 2 || !/\p{L}/u.test(name)) throw new UserError('Enter your full name.', 'name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new UserError('Enter a valid email address.', 'email');
  const digits = raw.replace(/^\+?91/, '').replace(/^0/, '');
  if (!/^[6-9]\d{9}$/.test(digits)) throw new UserError('Enter a 10-digit Indian mobile number.', 'phone');
  if (password.length < 8) throw new UserError('Use at least 8 characters for your password.', 'password');
  if (password.length > 128) throw new UserError('Use at most 128 characters for your password.', 'password');
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) throw new UserError('Use letters and at least one number in your password.', 'password');
  if (b.agree !== true) throw new UserError('Please confirm you have read the risk notice.', 'agree');
  const [first, ...rest] = name.split(' ');
  return { first, last: rest.join(' '), email, phone: `+91${digits}`, password, offers: b.offers === true };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
  if (!sameOrigin(req)) return fail(res, 403, 'Bad origin.');
  try {
    const b = await body(req);
    if (b.website) return fail(res, 400, 'Something went wrong. Try again.');   // honeypot: people never fill it
    const d = check(b);
    const ip = clientIp(req);
    const ua = String(req.headers['user-agent'] || '').slice(0, 300);

    if (ip) {
      const n = await one(`SELECT count(*)::int AS n FROM users WHERE signup_ip = $1::inet AND created_at > now() - interval '1 hour'`, [ip]);
      if (n.n >= PER_IP_HOUR) return fail(res, 429, 'Too many new accounts from this network. Try again in an hour.', 'locked');
    }

    const made = await tx(async c => {
      const taken = (await c.query(`SELECT lower(email) = lower($1) AS email, phone = $2 AS phone FROM users
                                     WHERE lower(email) = lower($1) OR phone = $2 LIMIT 1`, [d.email, d.phone])).rows[0];
      if (taken) throw new UserError(taken.email
        ? 'An account with this email already exists. Log in instead.'
        : 'An account with this mobile number already exists. Log in instead.', taken.email ? 'email' : 'phone');

      const u = (await c.query(
        `INSERT INTO users (first_name, last_name, email, phone, password_hash, signup_source, signup_ip, last_login_at)
         VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf', 10)), 'website', $6, now())
         RETURNING id, client_id, full_name`, [d.first, d.last, d.email, d.phone, d.password, ip])).rows[0];

      await c.query(`INSERT INTO user_profiles (user_id, billing_name) VALUES ($1, $2)`, [u.id, u.full_name]);
      await c.query(`INSERT INTO user_security (user_id) VALUES ($1)`, [u.id]);
      await c.query(`INSERT INTO notification_preferences (user_id, offers, email_marketing) VALUES ($1, $2, $2)`, [u.id, d.offers]);

      // the 1-day Pro trial, no card, and the licence key that unlocks it in the terminal
      const pro = (await c.query(`SELECT max_devices FROM plans WHERE code = 'pro'`)).rows[0];
      const seats = pro?.max_devices || 1;
      const sub = (await c.query(
        `INSERT INTO subscriptions (user_id, plan_code, billing_cycle, status, price, started_at, trial_end,
                                    current_period_start, current_period_end, auto_renew, seats)
         VALUES ($1, 'pro', 'trial', 'trialing', 0, now(), now() + make_interval(days => $2),
                 now(), now() + make_interval(days => $2), false, $3)
         RETURNING trial_end`, [u.id, TRIAL_DAYS, seats])).rows[0];
      await c.query(`INSERT INTO licences (user_id, licence_key, max_devices, last_issued_at) VALUES ($1, $2, $3, now())`,
        [u.id, licenceKey(), seats]);

      await c.query(`INSERT INTO notifications (user_id, channel, title, body) VALUES ($1, 'in_app', $2, $3)`, [u.id,
        `Welcome to EIMC, ${d.first}`,
        `Your client ID is ${u.client_id}. Your 1-day Pro trial is on: download EIMC Terminal and sign in with this account (client ID or email, and your password).`]);
      await c.query(`INSERT INTO login_history (user_id, login_id, success, ip_address, user_agent) VALUES ($1, $2, true, $3, $4)`,
        [u.id, d.email, ip, ua]);
      await c.query(`INSERT INTO audit_log (user_id, actor, action, details) VALUES ($1, 'customer', 'customer.signup', $2)`,
        [u.id, JSON.stringify({ source: 'website', trial_days: TRIAL_DAYS, offers: d.offers })]);
      return { ...u, trialEnds: sub.trial_end };
    });

    const expires = await createSession(req, res, made.id, true);
    return send(res, 201, {
      userId: String(made.id), clientId: String(made.client_id), name: made.full_name,
      trialEnds: new Date(made.trialEnds).toISOString(), expires: expires.getTime(),
    });
  } catch (e) {
    if (e instanceof UserError) return send(res, 400, { error: e.message, code: 'invalid', field: e.field || null });
    if (e.code === '23505') return send(res, 400, { error: 'An account with these details already exists. Log in instead.', code: 'invalid', field: 'email' });
    console.error('signup', e);
    return fail(res, 500, 'We could not create your account just now. Try again in a moment.');
  }
}
