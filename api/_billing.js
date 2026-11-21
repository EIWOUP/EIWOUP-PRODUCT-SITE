/* Billing: Razorpay subscriptions -> the website's subscriptions / orders / payments / invoices.

   Pro is sold as a Razorpay subscription: one checkout sets up a card e-mandate or UPI Autopay,
   and Razorpay charges it every month by itself. The database follows Razorpay:
     * the checkout's own confirmation (api/subscribe.js, "verify") and Razorpay's webhooks
       (api/razorpay-webhook.js) both end in applyGateway(), so a payment is booked exactly once
       whichever arrives first, and a late, older webhook never undoes a newer state;
     * someone whose paid days (or trial) still run is never charged twice: the new subscription
       starts when those days end (Razorpay's start_at);
     * cancelling is final at Razorpay (it cannot be undone), so "keep my subscription" after a
       cancel means subscribing again, which starts when the paid period ends. */
import crypto from 'node:crypto';
import { one, q, tx } from './_db.js';
import { GatewayError, configured, mode, rzp } from './_razorpay.js';

export const GST_PCT = 18;
/* ₹299.00 -> 35282 paise (299 + 18 %), in whole paise so it matches orders.total exactly */
export const paiseOf = price => Math.round(Math.round(Number(price) * 100) * (100 + GST_PCT) / 100);
export const TOTAL_COUNT = 120;          // monthly charges one subscription may make (10 years); Razorpay needs a number
const CHECKOUT_MINUTES = 60;             // an unpaid checkout expires after this
const REUSE_MINUTES = 45;                // ...and is offered again to the same customer until then
const MIN_LEAD_MS = 60 * 60e3;           // start later only if the paid days run at least an hour more

const r2 = n => Math.round(n * 100) / 100;
const ts = s => (s ? new Date(Number(s) * 1000) : null);
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
const licenceKey = () => 'EIMC-' + Array.from({ length: 3 }, () => crypto.randomBytes(2).toString('hex').toUpperCase()).join('-');

export class BillingError extends Error {
  constructor(message, code, status = 400) { super(message); this.code = code; this.status = status; }
}

/* ---------------------------------------------------------------- is Pro on sale? */
// Pro is live market data, which reaches customers only once EIMC-Admin turns live data on
// (after Dhan's written approval). Until then live-mode payments stay closed, so nobody pays for
// something they cannot get yet. Test keys (rzp_test_) always work, for trying the checkout.
// EIMC_SELL_BEFORE_LIVE=1 opens sales early on purpose (pre-orders).
export async function salesOpen() {
  if (!configured()) return { on: false, mode: null, message: 'Online payments are not switched on yet. Write to support@eimc.app to subscribe.' };
  if (mode() === 'live' && String(process.env.EIMC_SELL_BEFORE_LIVE || '').trim() !== '1') {
    const p = await one(`SELECT relay_enabled FROM app_policy`);
    if (!p?.relay_enabled) return { on: false, mode: 'live', message: 'Pro goes on sale the day live market data starts. Until then the 1-day trial and the Free plan work as normal.' };
  }
  return { on: true, mode: mode(), message: null };
}

/* ---------------------------------------------------------------- Razorpay plan for a price */
export async function gatewayPlan(plan) {
  const m = mode(), amount = paiseOf(plan.price_monthly);
  const find = () => one(`SELECT * FROM gateway_plans WHERE provider = 'razorpay' AND mode = $1 AND plan_code = $2 AND amount_paise = $3`,
    [m, plan.code, amount]);
  const have = await find();
  if (have) return have;
  const made = await rzp('POST', '/plans', {
    period: 'monthly', interval: 1,
    item: { name: `EIMC ${plan.name} (monthly)`, amount, currency: 'INR',
      description: `EIMC Terminal ${plan.name}: Rs ${Number(plan.price_monthly)} + ${GST_PCT}% GST a month` },
    notes: { plan_code: plan.code, price: String(Number(plan.price_monthly)) },
  });
  // two first buyers at once may both create one; the first stored wins, the other is never used
  await q(`INSERT INTO gateway_plans (mode, plan_code, price, amount_paise, provider_plan_id) VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT DO NOTHING`, [m, plan.code, plan.price_monthly, amount, made.id]);
  return find();
}

/* ---------------------------------------------------------------- can this customer buy now? */
export async function buyState(uid) {
  const s = await one(
    `SELECT s.*, eimc.access_until(s) AS access_until, pl.name AS plan_name,
            EXISTS (SELECT 1 FROM checkouts c WHERE c.provider_subscription_id = s.provider_subscription_id) AS gateway
       FROM subscriptions s JOIN plans pl ON pl.code = s.plan_code
      WHERE s.user_id = $1 AND s.is_current`, [uid]);
  // paid for, waiting for its first charge (a continuation, or a bank still confirming)
  const pending = await one(
    `SELECT c.* FROM checkouts c
      WHERE c.user_id = $1 AND c.status = 'authenticated'
        AND coalesce(c.starts_at, c.updated_at) > now() - interval '1 day'
        AND NOT EXISTS (SELECT 1 FROM subscriptions x WHERE x.provider_subscription_id = c.provider_subscription_id)
      ORDER BY c.created_at DESC LIMIT 1`, [uid]);

  const now = Date.now();
  const st = { current: s, pending, canBuy: true, reason: null, message: null, startsAt: null, cancelFirst: null };
  if (pending) {
    return { ...st, canBuy: false, reason: 'scheduled', message: pending.starts_at
      ? `You are already subscribed: Pro continues on ${istDate(pending.starts_at)}, with the first charge that day.`
      : 'Your payment is being confirmed by your bank. Pro switches on as soon as it is.' };
  }
  if (s?.gateway && s.status === 'active' && !s.cancel_at_period_end) {
    return { ...st, canBuy: false, reason: 'subscribed', message: `You are subscribed to ${s.plan_name}. It renews by itself on ${istDate(s.current_period_end)}.` };
  }
  // a subscription Razorpay may still charge (retrying a failed payment, or halted): cancel it first
  if (s?.gateway && ['past_due', 'halted'].includes(s.status)) st.cancelFirst = s.provider_subscription_id;
  // paid days (or trial) still running: the new subscription starts when they end
  const paidTill = s && ['active', 'cancelled', 'trialing'].includes(s.status) && s.access_until ? new Date(s.access_until).getTime() : 0;
  if (paidTill > now + MIN_LEAD_MS) st.startsAt = new Date(paidTill);
  return st;
}

export const istDate = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });

/* ---------------------------------------------------------------- open a checkout */
export async function startCheckout(uid, planCode) {
  const plan = await one(`SELECT * FROM plans WHERE code = $1 AND is_sellable AND price_monthly > 0`, [planCode]);
  if (!plan) throw new BillingError('That plan cannot be bought.', 'plan');
  const st = await buyState(uid);
  if (!st.canBuy) throw new BillingError(st.message, st.reason, 409);
  let gp = await gatewayPlan(plan);
  const startsAt = st.startsAt ? new Date(Math.floor(st.startsAt.getTime() / 1000) * 1000) : null;

  const reuse = await one(
    `SELECT * FROM checkouts WHERE user_id = $1 AND status = 'created' AND mode = $2 AND provider_plan_id = $3
        AND starts_at IS NOT DISTINCT FROM $4 AND created_at > now() - make_interval(mins => $5)
      ORDER BY created_at DESC LIMIT 1`, [uid, mode(), gp.provider_plan_id, startsAt, REUSE_MINUTES]);
  if (reuse) return { checkout: reuse, plan };

  if (st.cancelFirst) await cancelAtGateway(st.cancelFirst, false);
  const u = await one(`SELECT client_id FROM users WHERE id = $1`, [uid]);
  const body = {
    plan_id: gp.provider_plan_id, total_count: TOTAL_COUNT, quantity: 1, customer_notify: 1,
    expire_by: Math.floor(Date.now() / 1000) + CHECKOUT_MINUTES * 60,
    notes: { user_id: String(uid), client_id: String(u.client_id), plan_code: plan.code },
  };
  if (startsAt) body.start_at = Math.floor(startsAt.getTime() / 1000);
  let sub;
  try {
    sub = await rzp('POST', '/subscriptions', body);
  } catch (e) {
    // a stored plan Razorpay no longer knows (deleted there, or another Razorpay account): forget it, make it again
    if (!(e instanceof GatewayError) || e.status !== 400 || !/does not exist|invalid plan/i.test(e.message)) throw e;
    await q(`DELETE FROM gateway_plans WHERE provider_plan_id = $1`, [gp.provider_plan_id]);
    gp = await gatewayPlan(plan);
    sub = await rzp('POST', '/subscriptions', { ...body, plan_id: gp.provider_plan_id });
  }

  const { checkout, replaced } = await tx(async c => {
    const old = await c.query(`UPDATE checkouts SET status = 'replaced' WHERE user_id = $1 AND status = 'created'
                               RETURNING provider_subscription_id`, [uid]);
    const row = await c.query(
      `INSERT INTO checkouts (user_id, plan_code, mode, provider_subscription_id, provider_plan_id, price, amount_paise, starts_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [uid, plan.code, mode(), sub.id, gp.provider_plan_id, plan.price_monthly, gp.amount_paise, startsAt]);
    return { checkout: row.rows[0], replaced: old.rows.map(r => r.provider_subscription_id) };
  });
  // an older tab must not be able to pay a checkout that was replaced (best effort: it expires anyway)
  for (const id of replaced) rzp('POST', `/subscriptions/${id}/cancel`, { cancel_at_cycle_end: false }).catch(() => {});
  return { checkout, plan };
}

/* ---------------------------------------------------------------- cancel at Razorpay */
// atCycleEnd: keep the paid period, charge nothing more. Razorpay cannot undo either kind.
export async function cancelAtGateway(providerSubId, atCycleEnd) {
  try {
    return await rzp('POST', `/subscriptions/${encodeURIComponent(providerSubId)}/cancel`, { cancel_at_cycle_end: !!atCycleEnd });
  } catch (e) {
    if (!(e instanceof GatewayError) || e.status !== 400) throw e;
    // already ended there (cancelled, completed or expired): nothing left to stop
    const s = await rzp('GET', `/subscriptions/${encodeURIComponent(providerSubId)}`).catch(() => null);
    if (s && ['cancelled', 'completed', 'expired'].includes(s.status)) return s;
    throw e;
  }
}

/* Is this subscription one the website created at Razorpay (not an admin-made or demo row)? */
export async function gatewaySub(providerSubId) {
  if (!providerSubId) return false;
  return !!(await one(`SELECT 1 FROM checkouts WHERE provider_subscription_id = $1`, [providerSubId]));
}

/* ---------------------------------------------------------------- apply Razorpay's state */
// Razorpay subscription status -> ours. 'created' / 'authenticated' change nothing on a live row.
function ourStatus(gw, row) {
  switch (gw) {
    case 'active': return row?.cancel_at_period_end ? 'cancelled' : 'active';
    case 'pending': return 'past_due';
    case 'halted': case 'paused': return 'halted';
    case 'cancelled': return 'cancelled';
    case 'completed': case 'expired': return 'expired';
    default: return row?.status || null;
  }
}
const CHECKOUT_STATUS = { authenticated: 'authenticated', cancelled: 'cancelled', completed: 'expired', expired: 'expired' };

/* entity  : Razorpay subscription entity (from a webhook, or fetched)
   payment : Razorpay payment entity that came with it, or null
   eventAt : when Razorpay produced this state (the webhook's created_at; now() for a fetch)
   charge  : 'always' (subscription.charged) | 'full' (book a captured payment only if it is a
             whole month: a future-start checkout's small authorisation payment is not a charge) */
export async function applyGateway({ entity, payment = null, eventAt = new Date(), charge = 'full' }) {
  const sid = entity?.id;
  if (!sid) return { result: 'ignored: no subscription in the event' };
  return tx(async c => {
    await c.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`razorpay:${sid}`]);
    const co = (await c.query(`SELECT * FROM checkouts WHERE provider_subscription_id = $1 FOR UPDATE`, [sid])).rows[0];
    let row = (await c.query(`SELECT * FROM subscriptions WHERE provider_subscription_id = $1 FOR UPDATE`, [sid])).rows[0];
    if (!co && !row) return { result: 'ignored: not a subscription this website created' };

    const userId = String(co?.user_id ?? row.user_id);
    const gw = String(entity.status || '');
    const paid = Number(entity.paid_count || 0);
    const before = row?.status || null;
    let created = false;

    if (!row && (gw === 'active' || paid > 0)) {
      // ---- first charge: this becomes the customer's subscription
      const plan = (await c.query(`SELECT * FROM plans WHERE code = $1`, [co.plan_code])).rows[0];
      await c.query(`UPDATE subscriptions SET is_current = false, status = CASE WHEN status = 'trialing' THEN 'expired' ELSE status END
                      WHERE user_id = $1 AND is_current`, [userId]);
      row = (await c.query(
        `INSERT INTO subscriptions (user_id, plan_code, billing_cycle, status, price, started_at, current_period_start,
                                    current_period_end, auto_renew, provider, provider_subscription_id, seats, next_cycle, provider_event_at)
         VALUES ($1, $2, 'monthly', $3, $4, now(), $5, $6, $7, 'razorpay', $8, $9, 'monthly', $10) RETURNING *`,
        [userId, co.plan_code, ourStatus(gw, null), co.price, ts(entity.current_start) || new Date(),
         ts(entity.current_end), ['active', 'pending'].includes(gw), sid, plan.max_devices, eventAt])).rows[0];
      await c.query(`INSERT INTO licences (user_id, licence_key, max_devices, last_issued_at) VALUES ($1, $2, $3, now())
                     ON CONFLICT (user_id) DO UPDATE SET max_devices = GREATEST(licences.max_devices, EXCLUDED.max_devices)`,
        [userId, licenceKey(), plan.max_devices]);
      await c.query(`UPDATE checkouts SET status = 'active' WHERE id = $1`, [co.id]);
      await c.query(`INSERT INTO audit_log (user_id, actor, action, details) VALUES ($1, 'razorpay', 'subscription.started', $2)`,
        [userId, JSON.stringify({ provider_subscription_id: sid, plan: co.plan_code, price: Number(co.price), status: row.status })]);
      created = true;
    } else if (!row) {
      // ---- not charged yet: only the checkout moves (mandate set up, expired, cancelled)
      if (CHECKOUT_STATUS[gw]) await c.query(`UPDATE checkouts SET status = $2 WHERE id = $1 AND status <> 'active'`, [co.id, CHECKOUT_STATUS[gw]]);
      return { result: `applied: checkout ${CHECKOUT_STATUS[gw] || 'unchanged'}`, userId };
    } else if (!(row.provider_event_at && eventAt < row.provider_event_at)) {
      // ---- a live subscription: follow Razorpay (periods only ever move forward)
      const ending = ['cancelled', 'completed', 'expired'].includes(gw);
      const r = await c.query(
        `UPDATE subscriptions SET status = $2,
                current_period_start = CASE WHEN $3::timestamptz > coalesce(current_period_start, '-infinity') THEN $3 ELSE current_period_start END,
                current_period_end = GREATEST(current_period_end, $4::timestamptz),
                cancel_at_period_end = cancel_at_period_end OR $5,
                auto_renew = NOT (cancel_at_period_end OR $5) AND $6,
                cancelled_at = CASE WHEN $5 THEN coalesce(cancelled_at, $7) ELSE cancelled_at END,
                provider_event_at = $7
          WHERE id = $1 RETURNING *`,
        [row.id, ourStatus(gw, row), ts(entity.current_start), ts(entity.current_end), ending, ['active', 'pending'].includes(gw), eventAt]);
      row = r.rows[0];
    }

    // ---- the payment that came with it
    let booked = null;
    if (payment?.id) {
      const amountOk = charge === 'always' || Number(payment.amount) >= Number(co?.amount_paise || 1);
      if (payment.status === 'captured' && amountOk) booked = await bookPayment(c, { userId, row, entity, payment, co });
      else if (payment.status === 'failed') booked = await bookFailure(c, { userId, row, payment, co });
    }

    // ---- tell the customer when something changed for them
    const note = created && row.status === 'active'
      ? ['Pro is on. Thank you!', `Your ${row.plan_code === 'pro' ? 'Pro' : row.plan_code} subscription is active${row.current_period_end ? ` until ${istDate(row.current_period_end)}` : ''} and renews by itself each month. EIMC Terminal picks it up within the hour, or at once if you restart it.`]
      : before !== row.status && row.status === 'past_due'
        ? ['Your payment did not go through', 'Razorpay will try again over the next few days. Pro keeps working for 3 days meanwhile. Check your card or UPI app, or subscribe again with another method from Account → Subscription.']
        : before !== row.status && row.status === 'halted'
          ? ['Pro is paused', 'The monthly payment failed several times, so Pro has stopped. Subscribe again from Account → Subscription to switch it back on.']
          : null;
    if (note) await c.query(`INSERT INTO notifications (user_id, channel, title, body) VALUES ($1, 'in_app', $2, $3)`, [userId, ...note]);

    return { result: 'applied', userId, subscriptionId: String(row.id), status: row.status, created, booked };
  });
}

/* ---------------------------------------------------------------- orders, payments, invoices */
async function bookPayment(c, { userId, row, entity, payment, co }) {
  if ((await c.query(`SELECT 1 FROM payments WHERE provider_payment_id = $1`, [payment.id])).rowCount) return 'already booked';
  const amount = Number(payment.amount);                              // paise, incl. GST
  const price = co && paiseOf(co.price) === amount ? Number(co.price) : r2(amount / (100 + GST_PCT));
  const at = ts(payment.created_at) || new Date();
  const methodId = await saveMethod(c, userId, payment);
  if (methodId) await c.query(`UPDATE subscriptions SET payment_method_id = $2 WHERE id = $1`, [row.id, methodId]);
  const planName = row.plan_code === 'pro' ? 'Pro' : row.plan_code;
  const o = (await c.query(
    `INSERT INTO orders (user_id, subscription_id, plan_code, billing_cycle, description, amount, status, provider_order_id,
                         created_at, period_start, period_end)
     VALUES ($1, $2, $3, 'monthly', $4, $5, 'paid', $6, $7, $8, $9) RETURNING id, amount, discount, gst_amount, total`,
    [userId, row.id, row.plan_code, `${planName} plan - monthly`, price, payment.order_id || null, at,
     ts(entity.current_start), ts(entity.current_end)])).rows[0];
  await c.query(`INSERT INTO payments (order_id, user_id, payment_method_id, amount, status, provider, provider_payment_id, paid_at)
                 VALUES ($1, $2, $3, $4, 'captured', 'razorpay', $5, $6)`, [o.id, userId, methodId, amount / 100, payment.id, at]);
  await c.query(
    `INSERT INTO invoices (invoice_no, order_id, user_id, billing_name, billing_gstin, subtotal, gst_amount, total, status, issued_at)
     SELECT eimc.next_invoice_no(), $1, u.id, coalesce(nullif(p.billing_name, ''), u.full_name), nullif(p.gstin, ''), $3, $4, $5, 'paid', $6
       FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $2`,
    [o.id, userId, Number(o.amount) - Number(o.discount), o.gst_amount, o.total, at]);
  return 'booked';
}

async function bookFailure(c, { userId, row, payment, co }) {
  if ((await c.query(`SELECT 1 FROM payments WHERE provider_payment_id = $1`, [payment.id])).rowCount) return 'already booked';
  const amount = Number(payment.amount);
  const price = co && paiseOf(co.price) === amount ? Number(co.price) : r2(amount / (100 + GST_PCT));
  const at = ts(payment.created_at) || new Date();
  const o = (await c.query(
    `INSERT INTO orders (user_id, subscription_id, plan_code, billing_cycle, description, amount, status, provider_order_id, created_at)
     VALUES ($1, $2, $3, 'monthly', $4, $5, 'failed', $6, $7) RETURNING id`,
    [userId, row.id, row.plan_code, `${row.plan_code === 'pro' ? 'Pro' : row.plan_code} plan - monthly (renewal)`, price, payment.order_id || null, at])).rows[0];
  await c.query(`INSERT INTO payments (order_id, user_id, amount, status, provider, provider_payment_id, failure_reason, paid_at)
                 VALUES ($1, $2, $3, 'failed', 'razorpay', $4, $5, $6)`,
    [o.id, userId, amount / 100, payment.id, String(payment.error_description || payment.error_reason || 'Payment failed').slice(0, 300), at]);
  return 'failure booked';
}

/* the card / UPI / bank mandate a payment used, saved as the customer's default (last digits only) */
const BRAND = { visa: 'visa', mastercard: 'mastercard', rupay: 'rupay', 'american express': 'amex', amex: 'amex', 'diners club': 'diners', diners: 'diners' };
const maskVpa = v => { const [n, h] = String(v).split('@'); return `${n.slice(0, 2)}****${h ? '@' + h : ''}`; };
async function saveMethod(c, userId, p) {
  let m = null;
  if (p.method === 'card' && p.card?.last4) {
    m = { type: 'card', token: p.token_id || p.card_id || p.card.id || `card:${p.card.network}:${p.card.last4}`,
      brand: BRAND[String(p.card.network || '').toLowerCase()] || null, last4: String(p.card.last4).slice(-4),
      funding: ['credit', 'debit', 'prepaid'].includes(p.card.type) ? p.card.type : null, bank: p.card.issuer || null, name: p.card.name || null };
  } else if (p.method === 'upi' && (p.vpa || p.upi?.vpa)) {
    const vpa = p.vpa || p.upi.vpa;
    m = { type: 'upi', token: p.token_id || `vpa:${sha(vpa.toLowerCase()).slice(0, 32)}`, vpa: maskVpa(vpa) };
  } else if (['netbanking', 'emandate', 'nach'].includes(p.method)) {
    m = { type: 'netbanking', token: p.token_id || `bank:${p.bank || 'unknown'}`, bank: p.bank || null };
  }
  if (!m) return null;
  let id = (await c.query(`SELECT id FROM payment_methods WHERE user_id = $1 AND provider_token = $2 AND status = 'active'`, [userId, m.token])).rows[0]?.id;
  if (!id) {
    id = (await c.query(
      `INSERT INTO payment_methods (user_id, method_type, card_brand, card_last4, card_holder_name, card_issuer_bank, card_funding,
                                    upi_vpa_masked, bank_name, provider, provider_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'razorpay', $10) RETURNING id`,
      [userId, m.type, m.brand || null, m.last4 || null, m.name || null, m.type === 'card' ? m.bank : null, m.funding || null,
       m.vpa || null, m.type === 'netbanking' ? m.bank : null, m.token])).rows[0].id;
  }
  await c.query(`UPDATE payment_methods SET is_default = false WHERE user_id = $1 AND is_default AND id <> $2`, [userId, id]);
  await c.query(`UPDATE payment_methods SET is_default = true WHERE id = $1`, [id]);
  return id;
}

/* ---------------------------------------------------------------- refunds (made in the Razorpay dashboard) */
// A full refund marks the payment, order and invoice refunded. It does not end access by itself:
// EIMC-Admin decides that (a goodwill refund may keep the month running).
export async function applyRefund({ payment, refund }) {
  const pid = payment?.id || refund?.payment_id;
  if (!pid) return { result: 'ignored: no payment in the event' };
  return tx(async c => {
    const p = (await c.query(`SELECT * FROM payments WHERE provider_payment_id = $1 FOR UPDATE`, [pid])).rows[0];
    if (!p) return { result: 'ignored: payment not on file' };
    const refunded = Number(payment?.amount_refunded ?? refund?.amount ?? 0);
    const total = Number(payment?.amount ?? Math.round(Number(p.amount) * 100));
    const full = refunded >= total;
    if (full && p.status !== 'refunded') {
      await c.query(`UPDATE payments SET status = 'refunded' WHERE id = $1`, [p.id]);
      await c.query(`UPDATE orders SET status = 'refunded' WHERE id = $1`, [p.order_id]);
      await c.query(`UPDATE invoices SET status = 'refunded' WHERE order_id = $1`, [p.order_id]);
    }
    await c.query(`INSERT INTO audit_log (user_id, actor, action, details) VALUES ($1, 'razorpay', 'payment.refunded', $2)`,
      [p.user_id, JSON.stringify({ provider_payment_id: pid, refund_id: refund?.id || null, refunded: refunded / 100, full })]);
    return { result: full ? 'applied' : 'applied: partial refund noted', userId: String(p.user_id) };
  });
}
