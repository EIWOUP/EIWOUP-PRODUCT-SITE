/* POST /api/razorpay-webhook  — Razorpay tells us what happened (no sign-in; the signature decides)

   Razorpay Dashboard -> Account & Settings -> Webhooks -> Add new webhook:
     URL     https://eimc.vercel.app/api/razorpay-webhook
     Secret  any long random text; the same value goes in Vercel as RAZORPAY_WEBHOOK_SECRET
     Events  subscription.authenticated, subscription.activated, subscription.charged,
             subscription.pending, subscription.halted, subscription.cancelled,
             subscription.completed, subscription.paused, subscription.resumed, refund.processed

   This is a Web-standard handler (export POST(request)), not (req, res): the signature is an
   HMAC of the raw body exactly as sent, so the body must be read as text before anything parses
   it. Every verified event is stored in payment_events (X-Razorpay-Event-Id is unique there):
   a repeat delivery is answered "duplicate" without being applied twice. Anything that fails is
   answered 500, so Razorpay delivers it again later. */
import crypto from 'node:crypto';
import { one, q } from './_db.js';
import { applyGateway, applyRefund } from './_billing.js';
import { webhookSignatureOk } from './_razorpay.js';

const json = (status, data) => new Response(JSON.stringify(data), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});

export async function POST(request) {
  const raw = await request.text();
  if (raw.length > 1_000_000) return json(413, { error: 'too large' });
  if (!webhookSignatureOk(raw, request.headers.get('x-razorpay-signature'))) return json(400, { error: 'bad signature' });

  let ev;
  try { ev = JSON.parse(raw); } catch { return json(400, { error: 'not JSON' }); }
  const name = String(ev.event || '');
  const sub = ev.payload?.subscription?.entity || null;
  const payment = ev.payload?.payment?.entity || null;
  const refund = ev.payload?.refund?.entity || null;
  const eventId = String(request.headers.get('x-razorpay-event-id') || '').slice(0, 100)
    || `sha256:${crypto.createHash('sha256').update(raw).digest('hex')}`;

  try {
    let row = await one(
      `INSERT INTO payment_events (event_id, event, provider_subscription_id, provider_payment_id, payload)
       VALUES ($1, $2, $3, $4, $5) ON CONFLICT (provider, event_id) DO NOTHING RETURNING id`,
      [eventId, name.slice(0, 80), sub?.id || null, payment?.id || refund?.payment_id || null, ev]);
    if (!row) {
      const seen = await one(`SELECT id, processed_at FROM payment_events WHERE provider = 'razorpay' AND event_id = $1`, [eventId]);
      if (seen.processed_at) return json(200, { ok: true, duplicate: true });
      row = seen;                                     // stored before but failed: try again now
    }

    let r;
    const at = ev.created_at ? new Date(Number(ev.created_at) * 1000) : new Date();
    if (name.startsWith('subscription.') && sub) {
      r = await applyGateway({ entity: sub, payment, eventAt: at, charge: name === 'subscription.charged' ? 'always' : 'full' });
    } else if (name === 'refund.processed') {
      r = await applyRefund({ payment, refund });
    } else {
      r = { result: `ignored: ${name || 'no event name'} is not used` };
    }
    await q(`UPDATE payment_events SET processed_at = now(), result = $2, user_id = $3 WHERE id = $1`,
      [row.id, String(r.result).slice(0, 300), r.userId || null]);
    return json(200, { ok: true, result: r.result });
  } catch (e) {
    console.error('razorpay-webhook', name, eventId, e);
    await q(`UPDATE payment_events SET result = $2 WHERE provider = 'razorpay' AND event_id = $1`,
      [eventId, `error: ${String(e.message || e).slice(0, 280)}`]).catch(() => {});
    return json(500, { error: 'not processed, retry' });
  }
}
