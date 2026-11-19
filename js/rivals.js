'use strict';
/* ════════════════════════════════════════════════════════════════════
   WHAT ELSE YOU COULD BUY

   The price objection cannot be answered by insisting the price is
   fair. It is answered by showing the reader what the alternatives
   cost and, more decisively, what they do not do on NSE.

   Two components:

     renderRivals()  one row per competing product, with its own
                     published price and an honest note on its Indian
                     coverage. ATAS and Bookmap are superb tools —
                     the point is not that they are bad, it is that
                     they were built for CME and crypto, so a NIFTY
                     trader cannot buy their way to this.

     renderStack()   the assembly argument: what a trader who wanted
                     all of this would have to subscribe to, and the
                     two rows nothing in India sells at any price.

   Every figure comes from market-data.js, which records where it was
   read and when. Approximate ones are rendered with a tilde and
   carry the hedge in the footnote — if a reader can catch us
   inflating a rival's price, the whole page stops working.
   ════════════════════════════════════════════════════════════════════ */

import { RIVALS, STACK, rivalInr, stackTotal, PRICES_CHECKED, FX } from '/js/market-data.js';
import { CURRENCY, inr, planById } from '/js/pricing-data.js';

const NSE = {
  none:    { cls: 'no',   label: 'No NSE at all' },
  partial: { cls: 'part', label: 'NSE, no depth' },
  options: { cls: 'part', label: 'Options only' },
  full:    { cls: 'yes',  label: 'Built for NSE' },
};

const money = n => `${CURRENCY}${inr(n)}`;

export function renderRivals(host) {
  if (!host) return;

  const elite = planById('pro');
  const pro   = planById('pro');

  const rows = RIVALS.map(r => {
    const rs = rivalInr(r);
    const native = r.usd ? `$${r.usd}` : r.eur ? `€${r.eur}` : money(r.inr);
    const dataBit = r.dataUsd
      ? ` + $${r.dataUsd} data`
      : '';
    return `
    <tr>
      <td class="rv-n">
        <b>${r.name}</b><span>${r.tier}</span>
        <p>${r.what}</p>
      </td>
      <td class="rv-p">
        <b class="num">${r.approx ? '~' : ''}${money(rs)}</b><span>/ month</span>
        <p class="num">${native}${dataBit}${r.dataUsd ? ', per month' : ''}</p>
      </td>
      <td class="rv-d">
        <span class="rv-tag ${NSE[r.nse].cls}">${NSE[r.nse].label}</span>
        <p>${r.nseNote}</p>
      </td>
    </tr>`;
  }).join('');

  host.innerHTML = `
  <div class="tw rv-tw">
    <table class="t rvtab">
      <thead>
        <tr><th>The alternative</th><th>Its published price</th><th>On NIFTY 50 and NSE</th></tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="rv-us">
          <td class="rv-n">
            <b>EIMC Terminal</b><span>${elite.name} &mdash; every feature</span>
            <p>Order flow, recorded depth, profile, structure, the chain and live orders</p>
          </td>
          <td class="rv-p">
            <b class="num">${money(elite.monthly)}</b><span>/ month</span>
            <p>Launch price (regular ${money(pro.listPrice || pro.monthly)}) &middot; data is your own Dhan account</p>
          </td>
          <td class="rv-d">
            <span class="rv-tag yes">Built for NIFTY 50</span>
            <p>200-level depth recorded every second and shifted onto the index itself,
               because the index has no book of its own. Five sessions kept and replayable.</p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <p class="rv-foot">
    Competitor prices as published on their own pricing pages, read ${PRICES_CHECKED}. Converted at
    $1&nbsp;=&nbsp;&#8377;${FX.usd} and &euro;1&nbsp;=&nbsp;&#8377;${FX.eur} and rounded <b>down</b>, so each
    figure understates rather than overstates. A <span class="num">~</span> marks a price we could not read
    off a vendor page directly. Bookmap and ATAS are excellent at what they were built for &mdash;
    CME futures and crypto. That is exactly the point: neither of them can draw a NIFTY 50 order book,
    because NIFTY 50 does not have one.
  </p>`;
}

/* ════════════════════════════════════════════════════════════════
   THE STACK
   ════════════════════════════════════════════════════════════════ */
export function renderStack(host) {
  if (!host) return;

  const pro = planById('pro');
  const elite = pro;
  const total = stackTotal();

  const rows = STACK.map(r => r.buy
    ? `<tr>
         <td class="st-n">${r.need}</td>
         <td class="st-b">${r.buy}${r.foreign ? '<i>priced abroad</i>' : ''}</td>
         <td class="st-p num">${r.approx ? '~' : ''}${money(r.inr)}</td>
       </tr>`
    : `<tr class="st-x">
         <td class="st-n">${r.need}</td>
         <td class="st-b" colspan="2"><span class="st-none">${r.note}</span></td>
       </tr>`).join('');

  host.innerHTML = `
  <div class="st">
    <div class="tw">
      <table class="t stk">
        <thead><tr><th>What you want</th><th>What you would buy</th><th class="r">Per month</th></tr></thead>
        <tbody>
          ${rows}
          <tr class="st-sum">
            <td class="st-n"><b>Assembled, and still missing the last two rows</b></td>
            <td class="st-b">Four subscriptions and a foreign card</td>
            <td class="st-p num"><b>~${money(total)}</b></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="st-vs">
      <div class="st-card">
        <div class="k">All of it, in one window</div>
        <div class="v"><span class="cur">${CURRENCY}</span><b class="num">${inr(elite.monthly)}</b><i>/ month</i></div>
        <p>EIMC <b>Pro</b> &mdash; including the two rows above that nothing else in India sells.</p>
        <div class="st-save">
          About <b class="gold num">${money(total - elite.monthly)}</b> a month less than the stack,
          and the stack still cannot draw depth on the index.
        </div>
        <a class="btn btn-gold btn-block mt24" href="buy.html?plan=pro&amp;cycle=monthly">
          Start with 1 day of Pro, free <span class="arw">&rarr;</span></a>
        <p class="st-fine">No card for the trial. ${money(pro.monthly)}/month after, if you keep it.</p>
      </div>
    </div>
  </div>`;
}
