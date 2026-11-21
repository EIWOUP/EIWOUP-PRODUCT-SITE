/* /api/subscribe  — buying Pro (signed-in customers; the session cookie decides who)

   GET                               -> what buy.html should offer: on sale?, the price, the
                                        customer's current plan, and whether a new subscription
                                        would start now or when their paid days / trial end
   POST { action: 'start', plan }    -> opens (or re-offers) a Razorpay subscription and returns
                                        the options Razorpay Checkout needs in the browser
   POST { action: 'verify', razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
                                     -> checks Checkout's signature, reads the subscription back
                                        from Razorpay and books it (the webhook would too: whichever
                                        arrives first books it, the other finds it done) */
import { one } from './_db.js';
import { BillingError, applyGateway, buyState, istDate, paiseOf, salesOpen, startCheckout } from './_billing.js';
import { GatewayError, checkoutSignatureOk, keyId, rzp } from './_razorpay.js';
import { body, currentUser, fail, sameOrigin, send } from './_session.js';

const ID = /^[A-Za-z0-9_]{6,64}$/;
// after Razorpay took the payment, a failure here only delays the booking: the webhook books it too
const AFTER_PAYMENT = 'Your payment went through, but we could not confirm it just yet. Pro switches on within a few minutes; refresh your account page then. If it does not, write to support@eimc.app.';
const iso = d => (d ? new Date(d).toISOString() : null);

async function state(uid) {
  const [sales, plan, st] = await Promise.all([
    salesOpen(),
    one(`SELECT code, name, price_monthly FROM plans WHERE code = 'pro'`),
    uid ? buyState(uid) : null,
  ]);
  const price = Number(plan?.price_monthly || 0);
  const s = st?.current;
  return {
    signedIn: !!uid,
    sales,
    plan: plan && { code: plan.code, name: plan.name, price, total: paiseOf(price) / 100 },
    current: s ? {
      plan: s.plan_code, status: s.status, accessUntil: iso(s.access_until), periodEnd: iso(s.current_period_end),
      gateway: s.gateway, autoRenew: s.auto_renew, cancelAtPeriodEnd: s.cancel_at_period_end,
    } : null,
    canBuy: !!st && st.canBuy && sales.on,
    reason: st ? st.reason : 'signin',
    message: st ? st.message : null,
    startsAt: iso(st?.startsAt),
  };
}

export default async function handler(req, res) {
  let action = null;
  try {
    const me = await currentUser(req);
    const uid = me ? String(me.user_id) : null;

    if (req.method === 'GET') return send(res, 200, await state(uid));
    if (req.method !== 'POST') return fail(res, 405, 'Method not allowed.');
    if (!sameOrigin(req)) return fail(res, 403, 'Bad origin.');
    if (!uid) return fail(res, 401, 'Log in to subscribe.', 'expired');
    const b = await body(req);
    action = b.action;

    if (b.action === 'start') {
      const sales = await salesOpen();
      if (!sales.on) return fail(res, 503, sales.message, 'closed');
      const { checkout, plan } = await startCheckout(uid, String(b.plan || 'pro'));
      const u = await one(`SELECT full_name, email, phone, client_id FROM users WHERE id = $1`, [uid]);
      return send(res, 200, {
        key: keyId(), mode: sales.mode, subscriptionId: checkout.provider_subscription_id,
        name: 'EIMC Terminal', description: `${plan.name}, monthly: ₹${Number(checkout.price)} + 18% GST`,
        amount: checkout.amount_paise, startsAt: iso(checkout.starts_at),
        prefill: { name: u.full_name, email: u.email, contact: u.phone || '' },
        notes: { client_id: String(u.client_id) },
      });
    }

    if (b.action === 'verify') {
      const pid = String(b.razorpay_payment_id || ''), sid = String(b.razorpay_subscription_id || '');
      if (!ID.test(pid) || !ID.test(sid) || !checkoutSignatureOk(pid, sid, String(b.razorpay_signature || ''))) {
        return fail(res, 400, 'We could not confirm this payment. If money left your account, it is safe: write to support@eimc.app with your client ID.', 'signature');
      }
      const co = await one(`SELECT * FROM checkouts WHERE provider_subscription_id = $1 AND user_id = $2`, [sid, uid]);
      if (!co) return fail(res, 404, 'That checkout is not on this account.', 'unknown');
      const [entity, payment] = await Promise.all([
        rzp('GET', `/subscriptions/${sid}`),
        rzp('GET', `/payments/${pid}?expand[]=card`).catch(() => null),
      ]);
      // to the second, like Razorpay's event times, so an event from the same second still applies
      const r = await applyGateway({ entity, payment, eventAt: new Date(Math.floor(Date.now() / 1000) * 1000), charge: 'full' });
      const now = await state(uid);
      const scheduled = !!co.starts_at && entity.status === 'authenticated';
      return send(res, 200, {
        ok: true,
        state: r.status === 'active' ? 'active' : scheduled ? 'scheduled' : 'confirming',
        message: r.status === 'active'
          ? `Pro is on until ${istDate(entity.current_end * 1000)}. It renews by itself each month.`
          : scheduled
            ? `You are subscribed. Pro continues on ${istDate(co.starts_at)}, with the first charge that day.`
            : 'Payment received. Your bank is still confirming the mandate; Pro switches on as soon as it does (usually within minutes).',
        current: now.current,
      });
    }
    return fail(res, 400, 'Unknown action.');
  } catch (e) {
    if (e instanceof BillingError) return fail(res, e.status, e.message, e.code);
    if (e instanceof GatewayError) {
      console.error('subscribe: razorpay', e.status, e.code, e.message);
      return fail(res, 502, action === 'verify' ? AFTER_PAYMENT : 'The payment provider did not answer properly. Nothing was charged. Try again in a minute.', 'gateway');
    }
    console.error('subscribe', e);
    return fail(res, 500, action === 'verify' ? AFTER_PAYMENT : 'Something went wrong on our side. Nothing was charged. Try again.');
  }
}
