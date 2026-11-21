/* Razorpay: the REST calls and the two signature checks. No SDK, so nothing new to install.

   Vercel env (Production), from Razorpay Dashboard -> Account & Settings -> API keys / Webhooks:
     RAZORPAY_KEY_ID          rzp_test_... while testing, rzp_live_... once KYC is done
     RAZORPAY_KEY_SECRET      the key's secret: never sent to a browser
     RAZORPAY_WEBHOOK_SECRET  the secret typed in when adding the webhook
   RAZORPAY_API_BASE is only for the local tests (a fake Razorpay); leave it unset. */
import crypto from 'node:crypto';

const env = k => String(process.env[k] || '').trim();

export const keyId = () => env('RAZORPAY_KEY_ID');
export const configured = () => !!(keyId() && env('RAZORPAY_KEY_SECRET'));
/* test and live keys see different plans and subscriptions, so everything stored says which */
export const mode = () => (keyId().startsWith('rzp_live_') ? 'live' : 'test');
const base = () => (env('RAZORPAY_API_BASE') || 'https://api.razorpay.com/v1').replace(/\/+$/, '');

export class GatewayError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code || null; }
}

/* One call to the Razorpay API. Throws GatewayError on anything but 2xx, with Razorpay's own text. */
export async function rzp(method, path, payload) {
  const auth = Buffer.from(`${keyId()}:${env('RAZORPAY_KEY_SECRET')}`).toString('base64');
  let r;
  try {
    r = await fetch(base() + path, {
      method,
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(12_000),
    });
  } catch (e) {
    throw new GatewayError(`Razorpay could not be reached (${e.name === 'TimeoutError' ? 'timed out' : e.message}).`, 503, 'NETWORK');
  }
  let data = null;
  try { data = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) throw new GatewayError(data?.error?.description || `Razorpay answered ${r.status}.`, r.status, data?.error?.code);
  return data;
}

const hmac = (key, msg) => crypto.createHmac('sha256', key).update(msg).digest('hex');
function same(a, b) {
  const x = Buffer.from(String(a || ''), 'utf8'), y = Buffer.from(String(b || ''), 'utf8');
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

/* Checkout's handler gets {razorpay_payment_id, razorpay_subscription_id, razorpay_signature};
   for a subscription the signature is HMAC-SHA256(payment_id + "|" + subscription_id, key secret). */
export const checkoutSignatureOk = (paymentId, subscriptionId, signature) =>
  configured() && same(hmac(env('RAZORPAY_KEY_SECRET'), `${paymentId}|${subscriptionId}`), signature);

/* Webhooks: X-Razorpay-Signature = HMAC-SHA256(raw body exactly as received, webhook secret). */
export const webhookSignatureOk = (rawBody, signature) =>
  !!env('RAZORPAY_WEBHOOK_SECRET') && same(hmac(env('RAZORPAY_WEBHOOK_SECRET'), rawBody), signature);
