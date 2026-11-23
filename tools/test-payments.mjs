// End-to-end test of buying Pro: /api/subscribe, /api/razorpay-webhook and the account page's
// cancel, against a FAKE Razorpay that runs inside this script (no real money, no internet).
//
//   DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/eimc_pay_test node tools/test-payments.mjs
//
// SAFETY: refuses any database that is not on localhost or whose name lacks "test" (it creates
// customers, subscriptions and payments). Create one with
//   C:\EIMC\DB\setup-database.ps1 -Database eimc_pay_test
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
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
const db = new pg.Pool({ connectionString: DB, max: 2 });
const sql = async (t, p) => (await db.query(t, p)).rows;
const one = async (t, p) => (await sql(t, p))[0];

let passed = 0;
function ok(cond, what) {
  if (!cond) throw new Error(`FAIL: ${what}`);
  passed++; console.log(`ok  ${what}`);
}

/* ================================================================ fake Razorpay */
const KEY = 'rzp_test_FAKE123', SECRET = 'fake-key-secret', HOOK_SECRET = 'fake-webhook-secret';
const fake = { plans: new Map(), subs: new Map(), payments: new Map(), cancels: [], calls: [], n: 0 };
const RUN = crypto.randomBytes(3).toString('hex');      // ids unique across runs on the same test database
const now = () => Math.floor(Date.now() / 1000);
const DAY = 86400;
const fakeServer = http.createServer(async (req, res) => {
  let raw = '';
  for await (const c of req) raw += c;
  const body = raw ? JSON.parse(raw) : null;
  const u = new URL(req.url, 'http://x');
  fake.calls.push(`${req.method} ${u.pathname}`);
  const reply = (status, data) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
  const err = (status, description) => reply(status, { error: { code: 'BAD_REQUEST_ERROR', description } });
  if (req.headers.authorization !== `Basic ${Buffer.from(`${KEY}:${SECRET}`).toString('base64')}`) return err(401, 'Authentication failed');
  let mm;
  if (req.method === 'POST' && u.pathname === '/v1/plans') {
    const p = { id: `plan_F${RUN}${++fake.n}`, entity: 'plan', ...body };
    fake.plans.set(p.id, p); return reply(200, p);
  }
  if (req.method === 'POST' && u.pathname === '/v1/subscriptions') {
    if (!fake.plans.has(body.plan_id)) return err(400, 'The id provided does not exist');
    const s = { id: `sub_F${RUN}${++fake.n}`, entity: 'subscription', status: 'created', paid_count: 0, current_start: null, current_end: null, ...body };
    fake.subs.set(s.id, s); return reply(200, s);
  }
  if ((mm = u.pathname.match(/^\/v1\/subscriptions\/([^/]+)$/)) && req.method === 'GET') {
    const s = fake.subs.get(mm[1]); return s ? reply(200, s) : err(400, 'The id provided does not exist');
  }
  if ((mm = u.pathname.match(/^\/v1\/subscriptions\/([^/]+)\/cancel$/)) && req.method === 'POST') {
    const s = fake.subs.get(mm[1]);
    if (!s) return err(400, 'The id provided does not exist');
    if (['cancelled', 'completed', 'expired'].includes(s.status)) return err(400, `Subscription is not cancellable in ${s.status} status.`);
    fake.cancels.push({ id: s.id, atCycleEnd: body?.cancel_at_cycle_end });
    if (!body?.cancel_at_cycle_end) { s.status = 'cancelled'; s.ended_at = now(); }
    return reply(200, s);
  }
  if ((mm = u.pathname.match(/^\/v1\/payments\/([^/]+)$/)) && req.method === 'GET') {
    const p = fake.payments.get(mm[1]); return p ? reply(200, p) : err(400, 'The id provided does not exist');
  }
  return err(404, 'no such route');
});

/* simulate what Checkout + Razorpay do when the customer pays */
function payFirst(sid, { auth = false, method = 'card' } = {}) {
  const s = fake.subs.get(sid);
  const plan = fake.plans.get(s.plan_id);
  const p = {
    id: `pay_F${RUN}${++fake.n}`, entity: 'payment', amount: auth ? 500 : plan.item.amount, currency: 'INR', status: 'captured',
    order_id: `order_F${RUN}${fake.n}`, method, created_at: now(),
    ...(method === 'card' ? { card_id: 'card_F42', card: { id: 'card_F42', last4: '4242', network: 'Visa', type: 'credit', issuer: 'HDFC' } }
      : { vpa: 'gaurav@okhdfc' }),
  };
  fake.payments.set(p.id, p);
  if (auth) { s.status = 'authenticated'; }
  else { s.status = 'active'; s.paid_count = 1; s.current_start = now(); s.current_end = now() + 30 * DAY; }
  const signature = crypto.createHmac('sha256', SECRET).update(`${p.id}|${sid}`).digest('hex');
  return { razorpay_payment_id: p.id, razorpay_subscription_id: sid, razorpay_signature: signature, payment: p };
}
function charge(sid, { failed = false, at } = {}) {
  const s = fake.subs.get(sid), plan = fake.plans.get(s.plan_id);
  const p = { id: `pay_F${RUN}${++fake.n}`, entity: 'payment', amount: plan.item.amount, currency: 'INR', status: failed ? 'failed' : 'captured',
    order_id: `order_F${RUN}${fake.n}`, method: 'card', card_id: 'card_F42', card: { id: 'card_F42', last4: '4242', network: 'Visa', type: 'credit' },
    created_at: at || now(), ...(failed ? { error_description: 'Payment declined by the bank' } : {}) };
  fake.payments.set(p.id, p);
  if (!failed) {
    s.status = 'active'; s.paid_count = (s.paid_count || 0) + 1;
    s.current_start = s.current_end || now(); s.current_end = s.current_start + 30 * DAY;
  }
  return p;
}

/* ================================================================ the site */
const PORT = 3000 + Math.floor(Math.random() * 800) + 100;
let BASE = `http://localhost:${PORT}`;
const servers = [];
function startSite(port, extraEnv) {
  const proc = spawn(process.execPath, [path.join(root, 'tools', 'dev-server.mjs')], {
    env: { ...process.env, PORT: String(port), RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '', RAZORPAY_WEBHOOK_SECRET: '', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc.log = '';
  proc.stdout.on('data', d => { proc.log += d; });
  proc.stderr.on('data', d => { proc.log += d; });
  servers.push(proc);
  return proc;
}
async function waitFor(base, proc) {
  for (let i = 0; i < 60; i++) {
    try { await fetch(base + '/api/plans'); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('dev server did not start:\n' + proc.log);
}

let ipN = 10;
const NET = `10.${1 + Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`;   // fresh per run: sign-ups are limited per IP
async function call(route, payload, { method = 'POST', cookie, base = BASE } = {}) {
  const r = await fetch(base + route, {
    method, headers: { 'content-type': 'application/json', 'x-forwarded-for': `${NET}.${ipN}`, ...(cookie ? { cookie } : {}) },
    body: method === 'POST' ? JSON.stringify(payload || {}) : undefined,
  });
  let json = null; try { json = await r.json(); } catch { /* not json */ }
  return { status: r.status, json, headers: r.headers };
}
const act = (cookie, action, ...args) => call('/api/account', { action, args }, { cookie });

async function signUp(tag) {
  ipN++;
  const phone = `9${String(Date.now()).slice(-6)}${String(ipN).padStart(3, '0')}`;
  const r = await call('/api/signup', { name: `Pay ${tag}`, email: `pay-${tag}-${Date.now()}@example.com`, phone, password: 'secret123', agree: true });
  if (r.status !== 201) throw new Error(`sign-up failed: ${r.status} ${r.json?.error}`);
  const cookie = r.headers.get('set-cookie').split(';')[0];
  return { cookie, uid: r.json.userId };
}

async function hook(event, payload, { eventId = `evt_${crypto.randomBytes(6).toString('hex')}`, createdAt = now(), sig } = {}) {
  const raw = JSON.stringify({ entity: 'event', account_id: 'acc_FAKE', event, contains: Object.keys(payload), payload, created_at: createdAt });
  const r = await fetch(BASE + '/api/razorpay-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-razorpay-event-id': eventId,
      'x-razorpay-signature': sig ?? crypto.createHmac('sha256', HOOK_SECRET).update(raw).digest('hex') },
    body: raw,
  });
  let json = null; try { json = await r.json(); } catch { /* */ }
  return { status: r.status, json, eventId };
}
const subPayload = (sid, payment) => ({ subscription: { entity: { ...fake.subs.get(sid) } }, ...(payment ? { payment: { entity: payment } } : {}) });
const access = async uid => one(`SELECT * FROM eimc.app_access($1)`, [uid]);
const current = async uid => one(`SELECT *, eimc.access_until(s) AS until FROM eimc.subscriptions s WHERE user_id = $1 AND is_current`, [uid]);

/* ================================================================ the test */
async function main() {
  await new Promise(r => fakeServer.listen(0, '127.0.0.1', r));
  const FAKE = `http://127.0.0.1:${fakeServer.address().port}/v1`;
  const env = { RAZORPAY_KEY_ID: KEY, RAZORPAY_KEY_SECRET: SECRET, RAZORPAY_WEBHOOK_SECRET: HOOK_SECRET, RAZORPAY_API_BASE: FAKE };
  const site = startSite(PORT, env);
  await waitFor(BASE, site);
  await sql(`UPDATE eimc.app_policy SET relay_enabled = false`);
  await sql(`UPDATE eimc.plans SET price_monthly = 299 WHERE code = 'pro'`);
  // a plan id stored by an earlier run (or another Razorpay account) that this Razorpay does not know
  await sql(`DELETE FROM eimc.gateway_plans WHERE mode = 'test'`);
  await sql(`INSERT INTO eimc.gateway_plans (mode, plan_code, price, amount_paise, provider_plan_id) VALUES ('test', 'pro', 299, 35282, $1)`,
    [`plan_STALE${Date.now()}`]);

  // ---------------------------------------------------------------- not signed in
  let r = await call('/api/subscribe', null, { method: 'GET' });
  ok(r.status === 200 && r.json.signedIn === false && r.json.sales.on === true && r.json.sales.mode === 'test',
    'buy state without sign-in: on sale in test mode (test keys ignore the live-data switch)');
  ok(r.json.plan.price === 299 && r.json.plan.total === 352.82, 'price ₹299 + 18% GST = ₹352.82');
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' });
  ok(r.status === 401, 'starting a checkout needs a sign-in');

  // sign-up keeps a 10-digit mobile that begins 91, and still accepts +91 / 91 / 0 prefixes
  const tail = String(Date.now()).slice(-8);
  for (const [phone, label] of [[`91${tail}`, '10 digits starting 91'], [`+917${tail}1`, '+91 prefix'], [`06${tail}3`, 'leading 0']]) {
    ipN++;
    const rr = await call('/api/signup', { name: 'Phone Check', email: `phone-${Date.now()}-${ipN}@example.com`, phone, password: 'secret123', agree: true });
    ok(rr.status === 201, `sign-up accepts a mobile number: ${label}`);
  }

  // ---------------------------------------------------------------- A: trial ended, pays at once
  const A = await signUp('a');
  await sql(`UPDATE eimc.subscriptions SET trial_end = now() - interval '1 minute', current_period_end = now() - interval '1 minute'
              WHERE user_id = $1 AND is_current`, [A.uid]);
  ok((await access(A.uid)).code === 'EXPIRED', 'A: trial over, terminal access EXPIRED (Free licence)');
  r = await call('/api/subscribe', null, { method: 'GET', cookie: A.cookie });
  ok(r.json.canBuy === true && r.json.startsAt === null, 'A: can buy; the subscription starts at once (no paid days left)');

  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: A.cookie });
  ok(r.status === 200 && r.json.key === KEY && /^sub_F/.test(r.json.subscriptionId) && r.json.amount === 35282,
    `A: checkout opened (${r.status} ${r.json?.error || ''})`);
  const sidA = r.json.subscriptionId;
  const fs1 = fake.subs.get(sidA), plan1 = fake.plans.get(fs1.plan_id);
  ok(plan1.period === 'monthly' && plan1.interval === 1 && plan1.item.amount === 35282 && plan1.item.currency === 'INR',
    'a Razorpay plan was made for the price: monthly, 35282 paise');
  ok((await one(`SELECT count(*)::int AS n FROM eimc.gateway_plans WHERE provider_plan_id LIKE 'plan_STALE%'`)).n === 0,
    'a stored plan Razorpay did not know was dropped and made again');
  ok(fs1.total_count === 120 && fs1.notes.user_id === A.uid && !fs1.start_at && fs1.expire_by > now(), 'the Razorpay subscription: 120 cycles, our user id in notes, starts now, expires unpaid');
  ok(r.json.prefill.email.startsWith('pay-a-') && r.json.description.includes('299'), 'checkout prefilled with the customer');
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: A.cookie });
  ok(r.json.subscriptionId === sidA && fake.plans.size === 1 && fake.subs.size === 1, 'clicking Pay again re-offers the same checkout (no second plan or subscription)');
  ok((await one(`SELECT count(*)::int AS n FROM eimc.checkouts WHERE user_id = $1`, [A.uid])).n === 1, 'one checkout row stored');

  const paid = payFirst(sidA);
  r = await call('/api/subscribe', { action: 'verify', ...paid, razorpay_signature: 'f'.repeat(64) }, { cookie: A.cookie });
  ok(r.status === 400 && r.json.code === 'signature', 'a forged checkout signature is refused');
  ok(!(await one(`SELECT 1 FROM eimc.subscriptions WHERE provider_subscription_id = $1`, [sidA])), '...and nothing is booked');
  const other = await signUp('x');
  r = await call('/api/subscribe', { action: 'verify', ...paid }, { cookie: other.cookie });
  ok(r.status === 404, "another customer cannot claim A's payment");

  r = await call('/api/subscribe', { action: 'verify', ...paid }, { cookie: A.cookie });
  ok(r.status === 200 && r.json.state === 'active', `A: payment confirmed, Pro on (${r.status} ${r.json?.error || r.json?.state})`);
  let s = await current(A.uid);
  ok(s.provider_subscription_id === sidA && s.status === 'active' && s.auto_renew && s.billing_cycle === 'monthly' && Number(s.price) === 299,
    'A: current subscription = the Razorpay one, active, auto-renewing at ₹299');
  ok(Math.abs(new Date(s.current_period_end) - (Date.now() + 30 * DAY * 1000)) < 120e3, 'A: period end taken from Razorpay');
  ok((await one(`SELECT status FROM eimc.subscriptions WHERE user_id = $1 AND billing_cycle = 'trial'`, [A.uid])).status === 'expired',
    'A: the trial row became history (expired)');
  let o = await sql(`SELECT o.*, p.amount AS paid, p.status AS pstatus, p.provider_payment_id, i.invoice_no, i.total AS itotal, i.billing_name
                       FROM eimc.orders o JOIN eimc.payments p ON p.order_id = o.id LEFT JOIN eimc.invoices i ON i.order_id = o.id
                      WHERE o.user_id = $1`, [A.uid]);
  ok(o.length === 1 && o[0].status === 'paid' && Number(o[0].amount) === 299 && Number(o[0].total) === 352.82 && Number(o[0].paid) === 352.82,
    'A: one paid order ₹299 + GST = ₹352.82, payment captured for the same');
  ok(/^EIMC\/\d\d-\d{5}$/.test(o[0].invoice_no) && Number(o[0].itotal) === 352.82 && o[0].billing_name === 'Pay a', `A: GST invoice ${o[0].invoice_no} issued`);
  ok(o[0].period_start && o[0].period_end, 'A: the order records the period it paid for');
  const pm = await one(`SELECT * FROM eimc.payment_methods WHERE user_id = $1`, [A.uid]);
  ok(pm && pm.method_type === 'card' && pm.card_last4 === '4242' && pm.card_brand === 'visa' && pm.is_default && pm.card_exp_month === null,
    'A: card saved by last 4 digits only, as the default');
  let acc = await access(A.uid);
  ok(acc.code === 'OK' && acc.live_data === true, 'A: terminal access OK with live data');
  ok((await one(`SELECT count(*)::int AS n FROM eimc.notifications WHERE user_id = $1 AND title LIKE 'Pro is on%'`, [A.uid])).n === 1, 'A: told "Pro is on" in the account inbox');

  // ---------------------------------------------------------------- webhooks for the same payment
  r = await hook('subscription.activated', subPayload(sidA, paid.payment));
  ok(r.status === 200 && r.json.result === 'applied', 'webhook subscription.activated accepted');
  const ev = await hook('subscription.charged', subPayload(sidA, paid.payment));
  ok(ev.status === 200, 'webhook subscription.charged accepted');
  ok((await one(`SELECT count(*)::int AS n FROM eimc.orders WHERE user_id = $1`, [A.uid])).n === 1, 'the same payment from checkout and two webhooks is booked once');
  r = await hook('subscription.charged', subPayload(sidA, paid.payment), { eventId: ev.eventId });
  ok(r.status === 200 && r.json.duplicate === true, 'a redelivered event (same event id) is answered "duplicate"');
  r = await hook('subscription.charged', subPayload(sidA, paid.payment), { sig: 'a'.repeat(64) });
  ok(r.status === 400, 'a webhook with a wrong signature is refused');
  ok(!(await one(`SELECT 1 FROM eimc.payment_events WHERE event_id = $1`, [r.eventId])), '...and not stored');

  r = await call('/api/subscribe', null, { method: 'GET', cookie: A.cookie });
  ok(r.json.canBuy === false && r.json.reason === 'subscribed', 'A: buy page says already subscribed');
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: A.cookie });
  ok(r.status === 409, 'A: a second subscription cannot be started');

  // ---------------------------------------------------------------- renewal, failures, order of events
  const renew = charge(sidA);
  r = await hook('subscription.charged', subPayload(sidA, renew));
  s = await current(A.uid);
  ok(r.status === 200 && Math.abs(new Date(s.current_period_end) - (Date.now() + 60 * DAY * 1000)) < 120e3, 'renewal: the period moves a month on');
  o = await sql(`SELECT i.invoice_no FROM eimc.orders o JOIN eimc.invoices i ON i.order_id = o.id WHERE o.user_id = $1 ORDER BY o.id`, [A.uid]);
  ok(o.length === 2 && o[0].invoice_no !== o[1].invoice_no, 'renewal: a second order with its own invoice number');

  const failedPay = charge(sidA, { failed: true });
  fake.subs.get(sidA).status = 'pending';
  r = await hook('subscription.pending', subPayload(sidA, failedPay), { createdAt: now() - 3600 });
  ok((await current(A.uid)).status === 'active', 'an OLDER event arriving late does not change the status');
  ok((await one(`SELECT status FROM eimc.payments WHERE provider_payment_id = $1`, [failedPay.id])).status === 'failed', '...but its failed payment is still recorded');
  r = await hook('subscription.pending', subPayload(sidA, failedPay), { createdAt: now() + 5 });
  s = await current(A.uid);
  ok(s.status === 'past_due' && (await access(A.uid)).code === 'OK', 'payment failed: past due, terminal still works (grace days)');
  ok((await one(`SELECT count(*)::int AS n FROM eimc.notifications WHERE user_id = $1 AND title = 'Your payment did not go through'`, [A.uid])).n === 1, 'A: told the payment failed');
  ok((await one(`SELECT count(*)::int AS n FROM eimc.orders WHERE user_id = $1 AND status = 'failed'`, [A.uid])).n === 1, 'one failed order, booked once');
  fake.subs.get(sidA).status = 'halted';
  await hook('subscription.halted', subPayload(sidA), { createdAt: now() + 10 });
  ok((await current(A.uid)).status === 'halted' && (await access(A.uid)).code === 'EXPIRED', 'halted: Pro stops, terminal goes to Free');

  // ---------------------------------------------------------------- A subscribes again after halting
  r = await call('/api/subscribe', null, { method: 'GET', cookie: A.cookie });
  ok(r.json.canBuy === true && r.json.startsAt === null, 'A (halted): can subscribe again, starting at once');
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: A.cookie });
  const sidA2 = r.json.subscriptionId;
  ok(r.status === 200 && sidA2 !== sidA, 'A: a new checkout');
  ok(fake.cancels.some(c => c.id === sidA && c.atCycleEnd === false), 'the halted subscription was cancelled at Razorpay first (it can never charge again)');
  const paid2 = payFirst(sidA2, { method: 'upi' });
  r = await call('/api/subscribe', { action: 'verify', ...paid2 }, { cookie: A.cookie });
  s = await current(A.uid);
  ok(r.json.state === 'active' && s.provider_subscription_id === sidA2, 'A: the new subscription is current');
  ok((await one(`SELECT is_current FROM eimc.subscriptions WHERE provider_subscription_id = $1`, [sidA])).is_current === false, 'the halted one is history');
  const upi = await one(`SELECT * FROM eimc.payment_methods WHERE user_id = $1 AND method_type = 'upi'`, [A.uid]);
  ok(upi && upi.upi_vpa_masked === 'ga****@okhdfc' && upi.is_default, 'UPI saved masked (ga****@okhdfc) and made the default');

  // ---------------------------------------------------------------- cancel from the account page
  r = await act(A.cookie, 'setCancel', true, 'Too expensive');
  ok(r.status === 200, `cancel from Account (${r.status} ${r.json?.error || ''})`);
  ok(fake.cancels.some(c => c.id === sidA2 && c.atCycleEnd === true), 'cancel reached Razorpay: at the end of the paid period');
  s = await current(A.uid);
  ok(s.cancel_at_period_end && !s.auto_renew && s.status === 'cancelled' && (await access(A.uid)).code === 'OK', 'A: ending, but keeps Pro until the period ends');
  r = await act(A.cookie, 'setCancel', false);
  ok(r.status === 400 && r.json.code === 'final', 'undoing a Razorpay cancel is refused with how to subscribe again');
  r = await call('/api/account', null, { method: 'GET', cookie: A.cookie });
  ok(r.status === 200 && r.json.subscription.gateway === true && r.json.upcoming === null && r.json.orders.length >= 3, 'account page data: managed by Razorpay, no upcoming charge, orders listed');

  // ---------------------------------------------------------------- resubscribe while paid days remain: starts later
  r = await call('/api/subscribe', null, { method: 'GET', cookie: A.cookie });
  ok(r.json.canBuy && Math.abs(new Date(r.json.startsAt) - new Date(s.current_period_end)) < 2000, 'A (cancelled, days left): a new subscription would start when they end');
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: A.cookie });
  const sidA3 = r.json.subscriptionId;
  ok(fake.subs.get(sidA3).start_at === Math.floor(new Date(s.current_period_end) / 1000), 'Razorpay start_at = the end of the paid period (nothing charged twice)');
  const auth3 = payFirst(sidA3, { auth: true });
  r = await call('/api/subscribe', { action: 'verify', ...auth3 }, { cookie: A.cookie });
  ok(r.json.state === 'scheduled', 'the mandate is set up: "Pro continues on <date>"');
  ok((await one(`SELECT count(*)::int AS n FROM eimc.payments WHERE provider_payment_id = $1`, [auth3.payment.id])).n === 0, 'the small authorisation payment is not booked as a month');
  ok((await current(A.uid)).provider_subscription_id === sidA2, 'the paid-up subscription stays current until it ends');
  r = await call('/api/subscribe', null, { method: 'GET', cookie: A.cookie });
  ok(r.json.canBuy === false && r.json.reason === 'scheduled', 'buy page: already continuing');
  r = await call('/api/account', null, { method: 'GET', cookie: A.cookie });
  ok(r.json.pending?.startsAt && r.json.upcoming?.total === 352.82, 'account page: the next charge is the continuation');
  // the day it starts, Razorpay charges and says so
  const first3 = charge(sidA3);
  r = await hook('subscription.charged', subPayload(sidA3, first3));
  s = await current(A.uid);
  ok(r.status === 200 && s.provider_subscription_id === sidA3 && s.status === 'active', 'at start: the continuation becomes the current subscription');

  // ---------------------------------------------------------------- refunds
  r = await hook('refund.processed', { refund: { entity: { id: 'rfnd_F1', payment_id: first3.id, amount: 10000 } },
    payment: { entity: { ...first3, amount_refunded: 10000 } } });
  ok(r.status === 200 && (await one(`SELECT status FROM eimc.payments WHERE provider_payment_id = $1`, [first3.id])).status === 'captured', 'a partial refund is noted, the payment stays paid');
  r = await hook('refund.processed', { refund: { entity: { id: 'rfnd_F2', payment_id: first3.id, amount: first3.amount } },
    payment: { entity: { ...first3, amount_refunded: first3.amount } } });
  const ref = await one(`SELECT p.status AS p, o.status AS o, i.status AS i FROM eimc.payments p JOIN eimc.orders o ON o.id = p.order_id
                           JOIN eimc.invoices i ON i.order_id = o.id WHERE p.provider_payment_id = $1`, [first3.id]);
  ok(ref.p === 'refunded' && ref.o === 'refunded' && ref.i === 'refunded', 'a full refund marks payment, order and invoice refunded');

  // ---------------------------------------------------------------- B: trial running, pays before it ends
  const B = await signUp('b');
  r = await call('/api/subscribe', null, { method: 'GET', cookie: B.cookie });
  const trialEnd = (await current(B.uid)).trial_end;
  ok(r.json.canBuy && Math.abs(new Date(r.json.startsAt) - new Date(trialEnd)) < 2000, 'B (in trial): the subscription would start when the trial ends');
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: B.cookie });
  const sidB = r.json.subscriptionId;
  r = await call('/api/subscribe', { action: 'verify', ...payFirst(sidB, { auth: true }) }, { cookie: B.cookie });
  ok(r.json.state === 'scheduled' && (await current(B.uid)).status === 'trialing', 'B: scheduled, the trial carries on');
  r = await act(B.cookie, 'cancelScheduled');
  ok(r.status === 200 && fake.cancels.some(c => c.id === sidB && c.atCycleEnd === false), 'B cancels the scheduled subscription: cancelled at Razorpay');
  r = await call('/api/subscribe', null, { method: 'GET', cookie: B.cookie });
  ok(r.json.canBuy === true, 'B: can subscribe again later');
  await sql(`INSERT INTO eimc.checkouts (user_id, plan_code, mode, provider_subscription_id, provider_plan_id, price, amount_paise, status)
             SELECT $1, 'pro', 'test', 'sub_FLOOD' || $2 || k, 'plan_x', 299, 35282, 'replaced' FROM generate_series(1, 8) k`, [B.uid, RUN]);
  const subsBefore = fake.subs.size;
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: B.cookie });
  ok(r.status === 429 && fake.subs.size === subsBefore, 'more than 8 new checkouts an hour: refused before anything is created at Razorpay');
  await sql(`DELETE FROM eimc.checkouts WHERE provider_subscription_id LIKE 'sub_FLOOD%'`);

  // ---------------------------------------------------------------- odd webhooks
  r = await hook('subscription.charged', { subscription: { entity: { id: 'sub_SOMEONE_ELSE', status: 'active', paid_count: 1 } } });
  ok(r.status === 200 && /ignored/.test(r.json.result), 'a subscription this site never created is stored and ignored');
  r = await hook('payment.captured', { payment: { entity: { id: 'pay_X', status: 'captured', amount: 100 } } });
  ok(r.status === 200 && /ignored/.test(r.json.result), 'events the site does not use are ignored');
  const bad = await hook('subscription.charged', { subscription: { entity: { ...fake.subs.get(sidA3), current_end: 'garbage' } }, payment: { entity: charge(sidA3) } });
  ok(bad.status === 500, 'a webhook that fails to apply answers 500 (Razorpay will retry)');
  const stored = await one(`SELECT processed_at, result FROM eimc.payment_events WHERE event_id = $1`, [bad.eventId]);
  ok(stored && !stored.processed_at && /^error:/.test(stored.result), '...and is kept, marked with the error');
  r = await hook('subscription.charged', subPayload(sidA3, fake.payments.get([...fake.payments.keys()].pop())), { eventId: bad.eventId });
  ok(r.status === 200 && !r.json.duplicate, 'the retry of a failed event is processed (not treated as a duplicate)');

  // ---------------------------------------------------------------- sales closed: live keys before live data / no keys
  const live = startSite(PORT + 1, { ...env, RAZORPAY_KEY_ID: 'rzp_live_FAKE' });
  const none = startSite(PORT + 2, {});
  await waitFor(`http://localhost:${PORT + 1}`, live);
  await waitFor(`http://localhost:${PORT + 2}`, none);
  r = await call('/api/subscribe', null, { method: 'GET', base: `http://localhost:${PORT + 1}` });
  ok(r.json.sales.on === false && r.json.sales.mode === 'live', 'live keys + live data switched off: Pro is not on sale');
  r = await call('/api/subscribe', { action: 'start', plan: 'pro' }, { cookie: B.cookie, base: `http://localhost:${PORT + 1}` });
  ok(r.status === 503 && r.json.code === 'closed', '...and a checkout cannot be opened');
  await sql(`UPDATE eimc.app_policy SET relay_enabled = true`);
  r = await call('/api/subscribe', null, { method: 'GET', base: `http://localhost:${PORT + 1}` });
  ok(r.json.sales.on === true, 'live data on: Pro is on sale with live keys');
  await sql(`UPDATE eimc.app_policy SET relay_enabled = false`);
  r = await call('/api/subscribe', null, { method: 'GET', base: `http://localhost:${PORT + 2}` });
  ok(r.json.sales.on === false && /not switched on/.test(r.json.sales.message), 'no Razorpay keys: payments not switched on');
  r = await call('/api/account', null, { method: 'GET', cookie: B.cookie, base: `http://localhost:${PORT + 2}` });
  ok(r.status === 200 && r.json.sales.on === false, 'the account page still loads without payments');

  console.log(`\n${passed} checks passed`);
}

main().catch(e => {
  console.error(e.message);
  for (const s of servers) if (s.log.trim()) console.error('--- server log ---\n' + s.log.slice(-3000));
  process.exitCode = 1;
}).finally(async () => {
  for (const s of servers) s.kill();
  fakeServer.close();
  await db.end();
});
