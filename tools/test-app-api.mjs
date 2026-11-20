// End-to-end test of the terminal licence API (/api/app/*), the way EIMC Terminal will use it.
//
//   DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/eimc_app_test node tools/test-app-api.mjs
//
// SAFETY: it refuses any database that is not on localhost or whose name does not contain
// "test", because it edits subscriptions, devices and settings. Create one with
//   C:\EIMC\DB\setup-database.ps1 -Database eimc_app_test
// It signs with a throwaway Ed25519 key generated here, never the production key.
// Optional: TOKEN_OUT=<file> writes a fresh token + public key for the Python cross-check.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB = process.env.DATABASE_URL || '';
const m = DB.match(/@(localhost|127\.0\.0\.1)(:\d+)?\/([A-Za-z0-9_]+)/);
if (!m || !/test/.test(m[3])) {
  console.error('Refusing to run: DATABASE_URL must be a LOCAL database whose name contains "test".');
  process.exit(2);
}

/* ---------------------------------------------------------------- throwaway key + server */
const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
const seed = privateKey.export({ format: 'der', type: 'pkcs8' }).subarray(-32).toString('base64url');
const pubRaw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32).toString('base64url');
const KID = 'test';
const PORT = 3000 + Math.floor(Math.random() * 900) + 50;
const BASE = `http://localhost:${PORT}`;

const server = spawn(process.execPath, [path.join(root, 'tools', 'dev-server.mjs')], {
  env: { ...process.env, PORT: String(PORT), EIMC_SIGNING_KEY: seed, EIMC_SIGNING_KEY_ID: KID },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let serverLog = '';
server.stdout.on('data', d => { serverLog += d; });
server.stderr.on('data', d => { serverLog += d; });
const db = new pg.Pool({ connectionString: DB, max: 2 });

/* ---------------------------------------------------------------- helpers */
let passed = 0;
function ok(cond, what) {
  if (!cond) throw new Error(`FAIL: ${what}`);
  passed++; console.log(`ok  ${what}`);
}
async function call(route, payload, method = 'POST') {
  const r = await fetch(BASE + route, {
    method, headers: { 'content-type': 'application/json', 'user-agent': 'EIMC Terminal test', 'x-forwarded-for': '10.9.8.7' },
    body: method === 'POST' ? JSON.stringify(payload || {}) : undefined,
  });
  let json = null; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json, headers: r.headers };
}
function verify(token, device) {
  const [enc, sig] = token.split('.');
  const good = crypto.verify(null, Buffer.from(enc, 'ascii'), publicKey, Buffer.from(sig, 'base64url'));
  const claims = JSON.parse(Buffer.from(enc, 'base64url').toString('utf8'));
  return { good, claims, deviceOk: device ? claims.dev === device : true };
}
const sql = (t, p) => db.query(t, p);
const devA = crypto.randomBytes(16).toString('hex');      // 32 hex, like licensing/fingerprint.py
const devB = crypto.randomBytes(16).toString('hex');
const VER = '1.25.218.93';

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(BASE + '/api/app/status'); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('dev server did not start:\n' + serverLog);
}

/* ---------------------------------------------------------------- the test */
async function main() {
  await waitForServer();

  // status: public, cached, reports the seeded release
  let r = await call('/api/app/status', null, 'GET');
  ok(r.status === 200 && r.json.version.latest === VER, 'status lists the latest release');
  ok(/s-maxage=30/.test(r.headers.get('cache-control') || ''), 'status is edge-cacheable');
  ok(r.json.service.down === false && Array.isArray(r.json.notices), 'status has service + notices');

  // a real customer, made by the site's own sign-up (1-day Pro trial, 1 device)
  const tag = crypto.randomBytes(4).toString('hex');
  const email = `app-test-${tag}@example.com`, password = 'Test1234pass';
  const phone = '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0');
  r = await call('/api/signup', { name: 'App Test', email, phone, password, agree: true });
  ok(r.status === 201, `sign-up through /api/signup (${r.status} ${r.json?.error || ''})`);
  const uid = r.json.userId;

  // sign-in failures
  r = await call('/api/app/login', { id: email, password: 'wrong-pass1', device_id: devA, app_version: VER });
  ok(r.status === 401 && r.json.code === 'AUTH', 'wrong password = AUTH');
  r = await call('/api/app/login', { id: email, password, device_id: 'not-a-pc', app_version: VER });
  ok(r.status === 400 && r.json.code === 'BAD_REQUEST', 'bad device id = BAD_REQUEST');
  r = await call('/api/app/login', { id: email, password, device_id: devA });
  ok(r.status === 400 && r.json.code === 'BAD_REQUEST', 'missing app version = BAD_REQUEST');

  // sign in on PC A
  r = await call('/api/app/login', { id: email, password, device_id: devA, device_label: 'PC-A', os: 'Windows 11', app_version: VER });
  ok(r.status === 200, `sign in on PC A (${r.status} ${r.json?.error || ''})`);
  let rtA = r.json.refreshToken;
  let v = verify(r.json.licenceToken, devA);
  ok(v.good, 'licence signature verifies with the public key');
  ok(v.deviceOk && v.claims.sub === uid && v.claims.ver === VER && v.claims.kid === KID && v.claims.v === 1, 'licence claims: sub, dev, ver, kid, v');
  ok(v.claims.plan === 'pro' && v.claims.live === true && v.claims.until > 0, 'trial = pro + live, with access end');
  ok(v.claims.exp <= v.claims.until && v.claims.exp > v.claims.iat, 'licence never outlives the paid period');
  ok(Object.keys(JSON.parse(Buffer.from(r.json.licenceToken.split('.')[0], 'base64url'))).join() ===
     Object.keys(v.claims).sort().join(), 'payload keys are sorted (tokens.py format)');
  ok(r.json.account.userId === uid && r.json.policy.version.latest === VER, 'login returns account + policy');
  const dbHash = (await sql(`SELECT device_hash FROM devices WHERE user_id = $1 AND label = 'PC-A'`, [uid])).rows[0]?.device_hash;
  ok(dbHash === crypto.createHash('sha256').update(devA).digest('hex'), 'DB stores only sha256 of the PC id');
  ok((await sql(`SELECT count(*)::int n FROM app_refresh_tokens WHERE token_hash = $1`, [rtA])).rows[0].n === 0, 'refresh token itself is not stored');

  // second PC over the 1-device limit
  r = await call('/api/app/login', { id: email, password, device_id: devB, app_version: VER });
  ok(r.status === 403 && r.json.code === 'DEVICE_LIMIT', 'second PC refused: DEVICE_LIMIT');

  // refresh rotates; an immediate reuse is a race, a late reuse is theft
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 200 && r.json.refreshToken !== rtA && verify(r.json.licenceToken, devA).good, 'refresh rotates and re-issues');
  const rtA2 = r.json.refreshToken;
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 409 && r.json.code === 'STALE_REFRESH', 'just-rotated token reused = STALE_REFRESH');
  await sql(`UPDATE app_refresh_tokens SET last_used_at = now() - interval '10 minutes' WHERE replaced_by IS NOT NULL AND user_id = $1`, [uid]);
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 401 && r.json.code === 'SIGNED_OUT', 'old token reused later = SIGNED_OUT');
  r = await call('/api/app/refresh', { refresh_token: rtA2, device_id: devA, app_version: VER });
  ok(r.status === 401, 'theft revokes the newer token too');
  ok((await sql(`SELECT count(*)::int n FROM licence_events WHERE user_id = $1 AND event = 'token_reuse'`, [uid])).rows[0].n === 1, 'token reuse logged');

  // sign in again on A; a token copied to PC B is useless there
  r = await call('/api/app/login', { id: email, password, device_id: devA, app_version: VER });
  ok(r.status === 200, 'PC A signs in again');
  rtA = r.json.refreshToken;
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devB, app_version: VER });
  ok(r.status === 401 && r.json.code === 'SIGNED_OUT', 'refresh token copied to another PC = SIGNED_OUT');
  r = await call('/api/app/refresh', { refresh_token: 'x'.repeat(43), device_id: devA, app_version: VER });
  ok(r.status === 401, 'made-up refresh token = SIGNED_OUT');

  // version cutoff, with the update info the terminal needs
  await sql(`UPDATE app_policy SET min_supported_version = '9.0.0.0'`);
  await sql(`UPDATE app_releases SET download_url = 'https://example.com/EIMC-Setup.exe' WHERE is_latest`);
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 426 && r.json.code === 'UPDATE_REQUIRED' && r.json.update.minSupported === '9.0.0.0'
     && r.json.update.downloadUrl === 'https://example.com/EIMC-Setup.exe', 'old build = UPDATE_REQUIRED with download link');
  r = await call('/api/app/login', { id: email, password, device_id: devA, app_version: VER });
  ok(r.status === 426, 'old build cannot sign in either');
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: '9.0.0.0' });
  ok(r.status === 200, 'new build passes the cutoff');
  rtA = r.json.refreshToken;
  await sql(`UPDATE app_policy SET min_supported_version = '0.0.0.0'`);

  // maintenance
  await sql(`UPDATE service_status SET is_down = true, reason = 'Maintenance', message = 'Back at 6 PM'`);
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 503 && r.json.code === 'SERVICE_DOWN' && r.json.error === 'Back at 6 PM' && r.json.service.reason === 'Maintenance',
     'service down = SERVICE_DOWN with the message');
  r = await call('/api/app/status', null, 'GET');
  ok(r.json.service.down === true, 'status shows the outage too');
  await sql(`UPDATE service_status SET is_down = false`);

  // notices: everyone vs one plan
  await sql(`INSERT INTO announcements (title, body, shown_on) VALUES ('All', 'for everyone', 'terminal')`);
  await sql(`INSERT INTO announcements (title, body, shown_on, plan_code) VALUES ('Pro', 'pro only', 'both', 'pro')`);
  await sql(`INSERT INTO announcements (title, body, shown_on) VALUES ('Site', 'site only', 'site')`);
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 200 && r.json.notices.map(n => n.title).sort().join() === 'All,Pro', 'terminal notices: everyone + own plan, not site-only');
  rtA = r.json.refreshToken;
  r = await call('/api/app/status', null, 'GET');
  ok(r.json.notices.map(n => n.title).join() === 'All', 'public status lists only notices for everyone');

  // trial over -> still signed in, but Free (demo data), not locked out
  await sql(`UPDATE subscriptions SET trial_end = now() - interval '1 minute', current_period_end = now() - interval '1 minute' WHERE user_id = $1 AND is_current`, [uid]);
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  v = r.status === 200 ? verify(r.json.licenceToken, devA) : {};
  ok(r.status === 200 && v.claims.plan === 'free' && v.claims.live === false && v.claims.until === null
     && r.json.licence.status === 'expired', 'expired trial = Free licence, no live data');
  rtA = r.json.refreshToken;

  // sign-out frees the slot, so PC B can sign in
  r = await call('/api/app/logout', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 200 && r.json.ok, 'sign out');
  r = await call('/api/app/refresh', { refresh_token: rtA, device_id: devA, app_version: VER });
  ok(r.status === 401, 'signed-out PC cannot refresh');
  r = await call('/api/app/logout', { refresh_token: 'y'.repeat(43), device_id: devA });
  ok(r.status === 200 && r.json.ok, 'sign out with an unknown token still answers ok');
  r = await call('/api/app/login', { id: email, password, device_id: devB, device_label: 'PC-B', app_version: VER });
  ok(r.status === 200, 'PC B takes the freed slot');
  const tokenB = r.json.licenceToken, rtB = r.json.refreshToken;

  // admin blocks PC B; then suspends the account
  await sql(`UPDATE devices SET blocked = true WHERE user_id = $1 AND label = 'PC-B'`, [uid]);
  r = await call('/api/app/refresh', { refresh_token: rtB, device_id: devB, app_version: VER });
  ok(r.status === 403 && r.json.code === 'DEVICE_BLOCKED', 'blocked PC = DEVICE_BLOCKED');
  await sql(`UPDATE users SET status = 'suspended' WHERE id = $1`, [uid]);
  r = await call('/api/app/login', { id: email, password, device_id: devA, app_version: VER });
  ok(r.status === 403 && r.json.code === 'BANNED', 'suspended account = BANNED');

  const events = (await sql(`SELECT event, count(*)::int n FROM licence_events WHERE user_id = $1 GROUP BY event`, [uid])).rows;
  const by = Object.fromEntries(events.map(e => [e.event, e.n]));
  ok(by.activate >= 3 && by.refresh >= 3 && by.denied >= 4 && by.signout === 1, `licence events logged (${JSON.stringify(by)})`);

  // tampering: change one claim, keep the signature
  const [enc, sig] = tokenB.split('.');
  const forged = JSON.parse(Buffer.from(enc, 'base64url'));
  forged.plan = 'elite'; forged.exp += 365 * 86400;
  const tampered = Buffer.from(JSON.stringify(forged)).toString('base64url') + '.' + sig;
  ok(!verify(tampered).good, 'edited licence fails the signature check');

  if (process.env.TOKEN_OUT) {
    fs.writeFileSync(process.env.TOKEN_OUT, JSON.stringify({ token: tokenB, tampered, kid: KID, publicKey: pubRaw, device: devB, otherDevice: devA }));
    console.log(`wrote ${process.env.TOKEN_OUT} for the Python cross-check`);
  }
}

main()
  .then(() => { console.log(`\nALL ${passed} APP API TESTS PASSED`); process.exitCode = 0; })
  .catch(e => { console.error('\n' + (e.stack || e)); if (serverLog.trim()) console.error('\n--- server log ---\n' + serverLog); process.exitCode = 1; })
  .finally(async () => { server.kill(); await db.end(); });
