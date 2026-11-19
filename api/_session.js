/* Sessions: a random token in an HttpOnly cookie; the DB keeps only its SHA-256.
   Page scripts can never read the cookie, so a stolen localStorage is worthless. */
import crypto from 'node:crypto';
import { one, q } from './_db.js';

export const COOKIE = 'eimc_sid';
const LONG_DAYS = 30;      // "Keep me signed in"
const SHORT_HOURS = 12;    // otherwise (cookie also ends when the browser closes)

const sha = s => crypto.createHash('sha256').update(s).digest('hex');

export function clientIp(req) {
  const xf = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const ip = xf || req.socket?.remoteAddress || '';
  return /^[0-9a-f.:]+$/i.test(ip) ? ip.replace(/^::ffff:/, '') : null;
}

function cookieHeader(req, value, maxAgeSec) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || process.env.VERCEL ? '; Secure' : '';
  const age = maxAgeSec == null ? '' : `; Max-Age=${maxAgeSec}`;
  return `${COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax${secure}${age}`;
}

export async function createSession(req, res, userId, remember) {
  const token = crypto.randomBytes(32).toString('base64url');
  const ms = remember ? LONG_DAYS * 864e5 : SHORT_HOURS * 36e5;
  const ua = String(req.headers['user-agent'] || '').slice(0, 300);
  await q(`INSERT INTO sessions (user_id, token_hash, kind, device_label, ip_address, user_agent, last_used_at, expires_at)
           VALUES ($1, $2, 'web', $3, $4, $5, now(), now() + $6 * interval '1 millisecond')`,
    [userId, sha(token), browserLabel(ua), clientIp(req), ua, ms]);
  res.setHeader('Set-Cookie', cookieHeader(req, token, remember ? LONG_DAYS * 86400 : null));
  return new Date(Date.now() + ms);
}

function readCookie(req) {
  const m = String(req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([A-Za-z0-9_-]{20,100})`));
  return m ? m[1] : null;
}

/* the signed-in user for this request, or null */
export async function currentUser(req) {
  const token = readCookie(req);
  if (!token) return null;
  const row = await one(
    `UPDATE sessions s SET last_used_at = now()
       FROM users u
      WHERE s.token_hash = $1 AND NOT s.revoked AND s.expires_at > now()
        AND u.id = s.user_id AND u.status = 'active'
     RETURNING u.id AS user_id, u.client_id, s.id AS session_id`, [sha(token)]);
  return row;
}

export async function endSession(req, res) {
  const token = readCookie(req);
  if (token) await q(`UPDATE sessions SET revoked = true WHERE token_hash = $1`, [sha(token)]);
  res.setHeader('Set-Cookie', cookieHeader(req, '', 0));
}

export function browserLabel(ua) {
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\/|Opera/.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : /EIMC/.test(ua) ? 'EIMC Terminal' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android'
    : /Mac OS X/.test(ua) ? 'Mac' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${b} on ${os}` : b;
}

/* small JSON helpers shared by the routes */
export function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
export const fail = (res, status, message, code) => send(res, status, { error: message, code: code || null });

export async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return {}; } }
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 100_000) break; }
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

/* only accept same-site POSTs (basic CSRF guard on top of SameSite=Lax) */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch { return false; }
}
