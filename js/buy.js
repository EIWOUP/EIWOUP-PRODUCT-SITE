'use strict';
/* ════════════════════════════════════════════════════════════════════
   Checkout (buy.html): buying Pro as a monthly Razorpay subscription.

   /api/subscribe says what this visitor may do (sign up for the trial,
   subscribe now, subscribe starting when their paid days end, or nothing
   because they are already subscribed). "Subscribe" opens Razorpay
   Checkout for a subscription the server created; when the customer
   pays, Checkout hands back a signed receipt that /api/subscribe checks
   and books. Razorpay's webhook books the same payment too, so a closed
   tab or a lost connection never loses a payment.
   ════════════════════════════════════════════════════════════════════ */

import { PLANS, inr, CURRENCY, GST_RATE, TRIAL_DAYS, CAPS, hasCap } from '/js/pricing-data.js';
import { signedIn } from '/js/auth.js';

const q = new URLSearchParams(location.search);
const plan = PLANS.find(p => p.id === (q.get('plan') || 'pro').toLowerCase()) || null;
const host = document.getElementById('order');
const side = document.getElementById('order-side');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = d => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
const money = n => `${CURRENCY}${Number(n).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const days = TRIAL_DAYS === 1 ? 'day' : 'days';
const here = `buy.html?plan=${plan?.id || 'pro'}`;

async function getJSON(url, opts) {
  const r = await fetch(url, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...opts });
  let data = null;
  try { data = await r.json(); } catch { /* not JSON */ }
  if (!r.ok) { const e = new Error(data?.error || 'Something went wrong. Try again.'); e.code = data?.code; e.status = r.status; throw e; }
  return data;
}

if (!plan || plan.monthly === 0) {
  host.innerHTML = `
    <h1 class="d2">Nothing to pay for here</h1>
    <p class="lede mt24">${plan ? 'The Free plan needs no checkout: download it and run it.' : 'That plan does not exist.'}</p>
    <div class="btns mt32">
      <a class="btn btn-fill" href="download.html">Download free</a>
      <a class="btn" href="pricing.html">See the plans</a>
    </div>`;
  side?.remove();
} else {
  renderSide();
  let st = null;
  try { st = await getJSON('/api/subscribe'); } catch { /* shown below */ }
  render(st);
}

/* ── the order box ────────────────────────────────────────────────── */
function render(st) {
  const net = st?.plan?.price ?? plan.monthly;
  const total = st?.plan?.total ?? Math.round(net * (1 + GST_RATE) * 100) / 100;
  const gst = Math.round((total - net) * 100) / 100;

  host.innerHTML = `
    <div class="kicker plain">Checkout &middot; Monthly</div>
    <h1 class="d2">EIMC ${esc(plan.name)}${plan.listPrice ? ' <em>at the launch price</em>' : ''}</h1>
    <p class="lede mt24">${esc(plan.blurb)}</p>

    <div class="box mt32">
      <div class="brow"><span class="k">Plan</span><span class="v">EIMC ${esc(plan.name)}</span></div>
      <div class="brow"><span class="k">Billing</span><span class="v">Monthly, renews by itself</span></div>
      <div class="brow"><span class="k">Price</span><span class="v">${money(net)} / month${plan.listPrice ? ` <s class="dim">${money(plan.listPrice)}</s>` : ''}</span></div>
      <div class="brow"><span class="k">GST (${Math.round(GST_RATE * 100)}%)</span><span class="v">${money(gst)}</span></div>
      <div class="brow total"><span class="k">Charged each month</span><span class="v">${money(total)}</span></div>
      <div id="pay-area">${payArea(st, total)}</div>
    </div>

    <p class="dim mt24" style="font-size:12.5px">
      Prices in INR, GST included in the monthly charge. Payments are handled by Razorpay: pay by card
      or UPI Autopay, and EIMC never sees your card number or UPI PIN. Cancel any time from your
      account; you keep ${esc(plan.name)} until the end of the month you paid for.
      By subscribing you agree to the <a class="tlink" href="terms.html">Terms</a> and the
      <a class="tlink" href="refund.html">Cancellation &amp; refund policy</a>.
    </p>`;
  wire();
}

function payArea(st, total) {
  if (!st) {
    return `<div class="note warn mt24">We could not reach the server. Check your connection and <a class="tlink" href="">try again</a>.</div>`;
  }
  if (!st.signedIn) {
    return `
      <a class="btn btn-block btn-gold mt24" href="signup.html">Create account &amp; start my ${TRIAL_DAYS}-${days} trial</a>
      <p class="dim mt16" style="font-size:12.5px">The trial is free and takes no card. Already have an account?
        <a class="tlink" href="login.html?next=${encodeURIComponent(here)}">Log in to subscribe</a></p>`;
  }
  if (!st.sales?.on) {
    return `<div class="note gold mt24">${esc(st.sales?.message || 'Online payments are not switched on yet.')}</div>
      <a class="btn btn-block mt16" href="account.html#subscription">See my plan</a>`;
  }
  if (!st.canBuy) {
    return `<div class="note gold mt24">${esc(st.message || 'You are already subscribed.')}</div>
      <a class="btn btn-block mt16" href="account.html#subscription">Manage my subscription</a>`;
  }
  const later = st.startsAt
    ? `<p class="dim mt16" style="font-size:12.5px">Your current ${st.current?.status === 'trialing' ? 'trial' : 'Pro period'} runs until
         <b>${date(st.startsAt)}</b>, so the first monthly charge is on that day, not today. Your bank may ask you to
         approve the mandate now.</p>`
    : '';
  return `
    <button class="btn btn-block btn-fill mt24" id="pay">Subscribe &middot; ${money(total)} a month</button>
    ${later}
    ${st.sales.mode === 'test' ? '<p class="dim mt16" style="font-size:12px">Test mode: use Razorpay\'s test card or UPI ID. No real money moves.</p>' : ''}
    <div class="note mt16" id="pay-msg" hidden></div>`;
}

/* ── paying ───────────────────────────────────────────────────────── */
function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((ok, no) => {
    const s = Object.assign(document.createElement('script'), { src: 'https://checkout.razorpay.com/v1/checkout.js', async: true });
    s.onload = () => (window.Razorpay ? ok() : no(new Error('Razorpay Checkout did not load.')));
    s.onerror = () => no(new Error('Razorpay Checkout could not be loaded. Check your connection, or turn off an ad blocker for this page.'));
    document.head.append(s);
  });
}

function say(msg, kind = '') {
  const n = document.getElementById('pay-msg');
  if (!n) return;
  n.className = `note mt16 ${kind}`;
  n.innerHTML = msg;
  n.hidden = false;
}

function wire() {
  const btn = document.getElementById('pay');
  if (!btn) return;
  const label = btn.innerHTML;
  const idle = () => { btn.disabled = false; btn.innerHTML = label; };

  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Opening secure checkout…';
    try {
      const [co] = await Promise.all([
        getJSON('/api/subscribe', { method: 'POST', body: JSON.stringify({ action: 'start', plan: plan.id }) }),
        loadCheckout(),
      ]);
      const rzp = new window.Razorpay({
        key: co.key,
        subscription_id: co.subscriptionId,
        name: co.name,
        description: co.description,
        image: `${location.origin}/assets/eimc.png`,
        prefill: co.prefill,
        notes: co.notes,
        theme: { color: '#2f5ae6' },
        handler: resp => confirmPayment(resp, btn),
        modal: { ondismiss: () => { idle(); say('Checkout closed. Nothing was charged.'); } },
      });
      rzp.on('payment.failed', e => {
        idle();
        say(`<b>The payment did not go through.</b> ${esc(e?.error?.description || 'Try again, or use another card or UPI app.')}`, 'warn');
      });
      rzp.open();
    } catch (e) {
      idle();
      if (e.code === 'expired') { location.href = `login.html?next=${encodeURIComponent(here)}`; return; }
      say(esc(e.message), 'warn');
    }
  });
}

async function confirmPayment(resp, btn) {
  btn.disabled = true;
  btn.textContent = 'Confirming your payment…';
  let r = null;
  for (let i = 0; i < 3 && !r; i++) {
    try { r = await getJSON('/api/subscribe', { method: 'POST', body: JSON.stringify({ action: 'verify', ...resp }) }); } catch (e) {
      if (e.code === 'signature' || i === 2) { done(false, e.message); return; }
      await new Promise(ok => setTimeout(ok, 1500));
    }
  }
  done(true, r.message, r.state);
}

function done(okay, message, state) {
  const area = document.getElementById('pay-area');
  if (!okay) {
    area.innerHTML = `<div class="note warn mt24">${esc(message)}</div>
      <a class="btn btn-block mt16" href="account.html#subscription">Go to my account</a>`;
    return;
  }
  area.innerHTML = `
    <div class="note gold mt24"><b>Thank you!</b> ${esc(message)}</div>
    <p class="dim mt16" style="font-size:12.5px">${state === 'scheduled'
      ? 'Your first invoice appears under Account &rarr; Orders &amp; invoices on the day of the first charge.'
      : 'Your invoice is under Account &rarr; Orders &amp; invoices. EIMC Terminal picks up the new plan within the hour, or at once if you restart it.'}</p>
    <div class="btns mt16">
      <a class="btn btn-gold" href="account.html#subscription">See my subscription</a>
      <a class="btn" href="download.html">Download the terminal</a>
    </div>`;
}

/* ── what the plan includes ───────────────────────────────────────── */
function renderSide() {
  if (!side) return;
  side.innerHTML = `
    <div class="box">
      <h3>What ${esc(plan.name)} unlocks</h3>
      <ul class="bul tick">
        ${CAPS.map(c => `<li class="${hasCap(plan, c.key) ? '' : 'no'}">${esc(c.name)}</li>`).join('')}
      </ul>
      <p class="dim mt16" style="font-size:12px">
        Sign in to EIMC Terminal with this account (client ID or email, and your password). It stays signed
        in and checks your plan in the background, on ${plan.devices || 1} PC${(plan.devices || 1) === 1 ? '' : 's'} at a time.
      </p>
    </div>
    <div class="note mt24">
      <b>Not sure yet?</b> Every new account gets ${TRIAL_DAYS} ${days} of ${esc(plan.name)} free, no card needed, and
      the Free plan runs every mode on demo data with no expiry. <a class="tlink" href="pricing.html">Compare the plans</a>
    </div>`;
}
