'use strict';
/* ════════════════════════════════════════════════════════════════════
   Checkout — PLACEHOLDER.

   Everything that will one day talk to a payment gateway is isolated in
   startCheckout() at the bottom. Replace that one function body and the
   rest of the page keeps working unchanged.

   Razorpay is the natural target: the licence server already models its
   subscription states (trialing, past_due with a grace period,
   cancelled, halted) in license_server/models.py.
   ════════════════════════════════════════════════════════════════════ */

import {
  PLANS, priceOf, inr, CURRENCY, GST_RATE, TRIAL_DAYS, CAPS, hasCap,
} from '/js/pricing-data.js';
import { signedIn } from '/js/auth.js';

const q = new URLSearchParams(location.search);
const plan = PLANS.find(p => p.id === (q.get('plan') || 'pro').toLowerCase()) || null;
const cycle = 'monthly';      // only monthly billing is sold

const host = document.getElementById('order');
const side = document.getElementById('order-side');

if (!plan || plan.monthly === 0) {
  if (host) {
    host.innerHTML = `
      <h1 class="d2">Nothing to pay for here</h1>
      <p class="lede mt24">${plan
        ? 'The Free plan needs no checkout — download it and run it.'
        : 'That plan does not exist.'}</p>
      <div class="btns mt32">
        <a class="btn btn-fill" href="download.html">Download free</a>
        <a class="btn" href="pricing.html">See the plans</a>
      </div>`;
  }
  if (side) side.remove();
} else {
  const isTrial = !!plan.trial;
  const net = priceOf(plan);
  const gst = Math.round(net * GST_RATE);
  const total = net + gst;
  const per = 'month';

  host.innerHTML = `
    <div class="kicker plain">Checkout &middot; Monthly</div>
    <h1 class="d2">${isTrial ? `${TRIAL_DAYS} day${TRIAL_DAYS === 1 ? "" : "s"} of ${plan.name}, <em>free</em>` : `EIMC ${plan.name}`}</h1>
    <p class="lede mt24">${isTrial
      ? `The trial starts the moment you activate it and runs for ${TRIAL_DAYS} day${TRIAL_DAYS === 1 ? "" : "s"} with every Pro capability unlocked on live data. The billing below is what begins afterwards — nothing is charged today.`
      : plan.blurb}</p>

    <div class="box mt32">
      <div class="brow"><span class="k">Plan</span><span class="v">EIMC ${plan.name}</span></div>
      <div class="brow"><span class="k">Billing</span><span class="v">Monthly</span></div>
      <div class="brow"><span class="k">Subtotal</span><span class="v">${CURRENCY}${inr(net)} / ${per}</span></div>
      <div class="brow"><span class="k">GST (18%)</span><span class="v">${CURRENCY}${inr(gst)}</span></div>
      <div class="brow total">
        <span class="k">${isTrial ? `Due after ${TRIAL_DAYS} day${TRIAL_DAYS === 1 ? "" : "s"}` : 'Total'}</span>
        <span class="v">${CURRENCY}${inr(total)}</span>
      </div>
      ${isTrial ? `<p class="dim mt16" style="font-size:12.5px">Due today: <b class="up">${CURRENCY}0</b>. No card is taken for the trial.</p>` : ''}

      ${isTrial
        ? (signedIn()
          ? `<a class="btn btn-block btn-gold mt24" href="account.html#subscription">See my trial in my account</a>`
          : `<a class="btn btn-block btn-gold mt24" href="signup.html">Create account &amp; start my ${TRIAL_DAYS}-day trial</a>
             <p class="dim mt16" style="font-size:12.5px">Already have an account? <a class="tlink" href="login.html?next=account.html%23subscription">Log in</a></p>`)
        : `<button class="btn btn-block btn-fill mt24" id="pay">Pay ${CURRENCY}${inr(total)}</button>`}

      <div class="stub" id="pay-note" hidden>
        <b>Placeholder checkout</b>
        No payment gateway is connected yet. When it is, this button will open the gateway with
        <span class="num">plan=${plan.id}</span>, <span class="num">cycle=${cycle}</span> and
        <span class="num">${CURRENCY}${inr(total)}</span>, and the licence server will sign the
        entitlements alongside into your token. Nothing has been charged and no account created.
      </div>
    </div>

    <p class="dim mt24" style="font-size:12.5px">
      Prices in INR. A licence is valid for 7 days and refreshes on every launch that reaches the server,
      so a dropped connection will not lock you out during market hours. It is bound to the device that
      activates it.
    </p>`;

  if (side) {
    side.innerHTML = `
      <div class="box">
        <h3>What ${plan.name} unlocks</h3>
        <ul class="bul tick">
          ${CAPS.map(c => `<li class="${hasCap(plan, c.key) ? '' : 'no'}">${c.name}</li>`).join('')}
          <li>Connect your own Dhan account — live NSE / BSE / MCX</li>
        </ul>
        <p class="dim mt16" style="font-size:12px">
          Capability names are EIMC&rsquo;s own, from <code class="src">license_server/plans.py</code>.
        </p>
      </div>
      <div class="note mt24">
        <b>Changed your mind?</b> <a class="tlink" href="pricing.html">Compare the plans</a> &mdash; or take
        the free version first; it runs every mode on demo data with no expiry.
      </div>`;
  }

  document.getElementById('pay')?.addEventListener('click', () => startCheckout(plan.id, cycle, total));
}

/* ─────────────────────────────────────────────────────────────────
   REPLACE THIS FUNCTION BODY WHEN THE GATEWAY IS LIVE.
   Everything above is presentation and does not need to change.
   ───────────────────────────────────────────────────────────────── */
function startCheckout(planId, billingCycle, amountInr) {
  // → new Razorpay({ ... }).open()   /   → fetch('/api/subscribe', ...)
  const note = document.getElementById('pay-note');
  if (note) { note.hidden = false; note.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  const btn = document.getElementById('pay');
  if (btn) { btn.disabled = true; btn.textContent = 'Checkout not connected yet'; }
  console.info('[EIMC] checkout placeholder', { planId, billingCycle, amountInr });
}
