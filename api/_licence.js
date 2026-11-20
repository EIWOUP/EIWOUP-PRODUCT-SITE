/* Terminal licensing, shared by /api/app/*. Files starting with "_" are not routes.

   The licence token is what the EIMC Terminal (and later the market-data relay) trusts. It is
   the same wire format the terminal's licensing/tokens.py verifies:

       base64url(compact JSON, sorted keys) + "." + base64url(Ed25519 signature)

   The signature covers the encoded payload bytes, so verification never depends on JSON key
   order. Only this server holds the private key (EIMC_SIGNING_KEY); the terminal and the relay
   carry the public key, which can check a signature but never make one.

   Device identity: the terminal sends its machine fingerprint (licensing/fingerprint.py, 32 hex
   chars) as `device_id`. The token carries it as `dev`, so the terminal can confirm a token was
   issued to *this* PC. The database stores only sha256(device_id) as devices.device_hash.

   Access rules are NOT written here. They live in the database (eimc.app_access and
   eimc.app_register_device, sql/08_licensing.sql), so this API and the relay can never disagree. */
import crypto from 'node:crypto';
import { many, one, q } from './_db.js';
import { send } from './_session.js';

export const TOKEN_VERSION = 1;          // must match VERSION in licensing/tokens.py
const REFRESH_DAYS = 180;                // a signed-in PC stays signed in this long without use
const REUSE_GRACE_SEC = 120;             // a just-rotated refresh token reused this soon = a race, not theft

export const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const b64u = buf => Buffer.from(buf).toString('base64url');

/* ---------------------------------------------------------------- input */
const DEVICE_RE = /^[0-9a-f]{32,64}$/;
const VERSION_RE = /^v?\d+(\.\d+){1,3}$/;

export class AppError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra; }
}

export function deviceIdOf(v) {
  const id = String(v ?? '').trim().toLowerCase();
  if (!DEVICE_RE.test(id)) throw new AppError(400, 'BAD_REQUEST', 'This PC could not be identified. Update EIMC Terminal and try again.');
  return id;
}
export function appVersionOf(v) {
  const s = String(v ?? '').trim();
  if (!VERSION_RE.test(s)) throw new AppError(400, 'BAD_REQUEST', 'This EIMC Terminal build did not report its version. Install the latest version.');
  return s.replace(/^v/, '');
}
export const text = (v, max) => { const s = String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max); return s || null; };

/* ---------------------------------------------------------------- signing key */
// Ed25519 private keys arrive as the raw 32-byte seed (base64url), the format
// license_server/keys.py prints. Node wants PKCS#8, which for Ed25519 is a fixed 16-byte
// prefix followed by the seed.
const PKCS8_ED25519 = Buffer.from('302e020100300506032b657004220420', 'hex');
let signer = null;

function signingKey() {
  if (signer) return signer;
  const raw = process.env.EIMC_SIGNING_KEY || '';
  const kid = (process.env.EIMC_SIGNING_KEY_ID || '').trim();
  const seed = Buffer.from(raw.trim(), 'base64url');
  if (seed.length !== 32 || !kid) throw new Error('EIMC_SIGNING_KEY / EIMC_SIGNING_KEY_ID are not configured');
  const key = crypto.createPrivateKey({ key: Buffer.concat([PKCS8_ED25519, seed]), format: 'der', type: 'pkcs8' });
  const pub = crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).subarray(-32);
  signer = { kid, key, publicKey: b64u(pub) };
  return signer;
}

export const publicKeyInfo = () => { const s = signingKey(); return { kid: s.kid, key: s.publicKey }; };

/* Sign a licence. Keys are sorted so the JSON matches tokens.py byte for byte (not required for
   verification, but it keeps tokens from both implementations identical in shape). */
export function mint(claims) {
  const s = signingKey();
  const payload = { ...claims, v: TOKEN_VERSION, kid: s.kid, jti: crypto.randomBytes(9).toString('base64url') };
  const sorted = Object.fromEntries(Object.keys(payload).sort().map(k => [k, payload[k]]));
  const encoded = b64u(JSON.stringify(sorted));
  const sig = crypto.sign(null, Buffer.from(encoded, 'ascii'), s.key);
  return `${encoded}.${b64u(sig)}`;
}

/* ---------------------------------------------------------------- policy, notices */
export async function policy() {
  return one(
    `SELECT p.min_supported_version, p.update_message, p.licence_ttl_hours, p.relay_enabled,
            s.is_down, s.reason, s.message, s.expected_back_at,
            r.version AS latest_version, r.download_url, r.sha256, r.size_bytes, r.notes, r.released_at
       FROM app_policy p
       CROSS JOIN service_status s
       LEFT JOIN app_releases r ON r.is_latest AND r.channel = 'stable'`);
}

export function publicPolicy(p) {
  return {
    version: {
      latest: p.latest_version || null, minSupported: p.min_supported_version,
      downloadUrl: p.download_url || null, sha256: p.sha256 || null, sizeBytes: p.size_bytes ? Number(p.size_bytes) : null,
      notes: p.notes || null, releasedAt: p.released_at || null, updateMessage: p.update_message,
    },
    service: { down: !!p.is_down, reason: p.reason || null, message: p.message || null, expectedBackAt: p.expected_back_at || null },
  };
}

/* active notices for the terminal (or the site); planCode = null -> only the ones for everyone */
export async function notices(shownOn, planCode = null) {
  return many(
    `SELECT id, title, body, level, starts_at AS "startsAt", ends_at AS "endsAt"
       FROM announcements
      WHERE shown_on IN ($1, 'both') AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now())
        AND (plan_code IS NULL OR plan_code = $2)
      ORDER BY CASE level WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END, starts_at DESC
      LIMIT 10`, [shownOn, planCode]);
}

/* ---------------------------------------------------------------- denials */
// app_access / app_register_device codes -> what the terminal is told. Anything not listed
// is a server-side surprise and becomes a 500.
const DENIALS = {
  BANNED:          [403, 'This account cannot use EIMC Terminal. Contact support.'],
  NO_LICENCE:      [403, 'This account has no terminal licence yet. Contact support.'],
  DEVICE_LIMIT:    [403, 'Your plan is already in use on the maximum number of PCs. Sign out on another PC, or remove it under Account → Devices.'],
  DEVICE_BLOCKED:  [403, 'This PC has been blocked for this account. Contact support.'],
  DEVICE_REVOKED:  [401, 'This PC was signed out. Sign in again to use it.'],
  DEVICE_UNKNOWN:  [401, 'This PC is not signed in. Sign in again.'],
  UNKNOWN_USER:    [401, 'This account no longer exists.'],
  UPDATE_REQUIRED: [426, null],          // message comes from app_policy.update_message
  SERVICE_DOWN:    [503, null],          // message comes from service_status
};

export function denial(code, pol) {
  const d = DENIALS[code];
  if (!d) throw new Error(`unexpected access code ${code}`);
  let message = d[1], extra;
  if (code === 'UPDATE_REQUIRED') { message = pol.update_message; extra = { update: publicPolicy(pol).version }; }
  if (code === 'SERVICE_DOWN') { message = pol.message || pol.reason || 'EIMC is down for maintenance. Please try again later.'; extra = { service: publicPolicy(pol).service }; }
  return new AppError(d[0], code, message, extra);
}

/* ---------------------------------------------------------------- licence */
/* The licence for an access result that is OK or EXPIRED. An expired customer still gets a
   licence, on the Free plan: the terminal runs on demo data and offers "Renew", the same thing
   the website shows them (api/account.js treats no access as Free). */
export async function issueLicence({ access, userId, deviceId, appVersion, pol }) {
  const expired = access.code === 'EXPIRED';
  const now = Math.floor(Date.now() / 1000);
  const until = !expired && access.access_until ? Math.floor(new Date(access.access_until).getTime() / 1000) : null;
  let exp = now + pol.licence_ttl_hours * 3600;
  if (until) exp = Math.min(exp, until);         // never outlive the paid period

  let plan = access.plan_code || 'free', live = !!access.live_data, feat = access.features || [];
  if (expired) {
    plan = 'free'; live = false;
    feat = (await one(`SELECT coalesce(array_agg(feature_code ORDER BY feature_code), '{}') AS f FROM plan_features WHERE plan_code = 'free'`)).f;
  }
  const claims = { sub: String(userId), plan, feat: [...feat].sort(), dev: deviceId, ver: appVersion, live, until, iat: now, exp };
  return {
    token: mint(claims),
    licence: { plan, live, features: claims.feat, accessUntil: until ? new Date(until * 1000).toISOString() : null,
               expiresAt: new Date(exp * 1000).toISOString(), status: expired ? 'expired' : 'active' },
  };
}

/* ---------------------------------------------------------------- refresh tokens */
export async function newRefreshToken(db, userId, deviceRowId, ip) {
  const token = crypto.randomBytes(32).toString('base64url');
  const row = (await db.query(
    `INSERT INTO app_refresh_tokens (user_id, device_id, token_hash, expires_at, last_used_at, last_ip)
     VALUES ($1, $2, $3, now() + make_interval(days => $4), now(), $5) RETURNING id`,
    [userId, deviceRowId, sha256(token), REFRESH_DAYS, ip])).rows[0];
  return { token, id: row.id };
}

export const REFRESH_REUSE_GRACE_SEC = REUSE_GRACE_SEC;

export async function logEvent(db, { userId = null, deviceRowId = null, event, reason = null, appVersion = null, ip = null, details = null }) {
  await (db || { query: q }).query(
    `INSERT INTO licence_events (user_id, device_id, event, reason, app_version, ip, details) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [userId, deviceRowId, event, reason, appVersion, ip, details ? JSON.stringify(details) : null]);
}

/* ---------------------------------------------------------------- responses */
export function sendError(res, e, where) {
  if (e instanceof AppError) return send(res, e.status, { error: e.message, code: e.code, ...(e.extra || {}) });
  console.error(where, e);
  return send(res, 500, { error: 'The licence server had a problem. Try again in a moment.', code: 'SERVER' });
}
