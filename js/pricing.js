'use strict';
/* ════════════════════════════════════════════════════════════════════
   Plan cards and the capability matrix.
   Every number comes from pricing-data.js; nothing is written into
   markup, so one edit there updates the whole site.
   ════════════════════════════════════════════════════════════════════ */

import {
  PLANS, CAPS, CURRENCY, TRIAL_DAYS, SAVE_PCT,
  inr, priceOf, hasCap, yearlySaving, yearlyOf,
} from '/js/pricing-data.js';

const buyHref = (plan, cycle) =>
  plan.ctaHref ? plan.ctaHref : `buy.html?plan=${plan.id}&cycle=${cycle}`;

function priceBlock(plan, cycle) {
  if (plan.monthly === 0) {
    return `<div class="plan-px"><span class="amt">Free</span></div>
            <div class="plan-sub">No card, no expiry</div>`;
  }
  const per = cycle === 'yearly' ? '/ year' : '/ month';
  const sub = cycle === 'yearly'
    ? `<span class="save">Save ${CURRENCY}${inr(yearlySaving(plan))}</span> against monthly`
    : `${CURRENCY}${inr(yearlyOf(plan))} yearly &mdash; two months free`;
  return `<div class="plan-px">
            <span class="cur">${CURRENCY}</span><span class="amt">${inr(priceOf(plan, cycle))}</span><span class="per">${per}</span>
          </div>
          <div class="plan-sub">${sub}</div>`;
}

function card(plan, cycle, compact) {
  const list = compact ? plan.highlights.slice(0, 5) : plan.highlights;
  const btn = plan.trial ? 'btn-gold' : plan.id === 'free' ? '' : 'btn-fill';
  return `
  <div class="plan${plan.trial ? ' feature' : ''}">
    ${plan.flag ? `<span class="plan-flag">${plan.flag}</span>` : ''}
    <div class="plan-name">${plan.name}</div>
    <div class="plan-for">${plan.blurb}</div>
    ${priceBlock(plan, cycle)}
    <a class="btn btn-block ${btn}" href="${buyHref(plan, cycle)}">${plan.cta}</a>
    <ul class="bul tick plan-foot">${list.map(h => `<li>${h}</li>`).join('')}</ul>
  </div>`;
}

/** Draw the four plan cards into `host`. */
export function renderPlanCards(host, { cycle = 'monthly', compact = false } = {}) {
  if (!host) return;
  host.innerHTML = PLANS.map(p => card(p, cycle, compact)).join('');
}

/** The monthly / yearly switch. Re-renders the cards and the matrix. */
export function wireToggle(toggleHost, cardsHost, tableHost) {
  if (!toggleHost) return;
  toggleHost.innerHTML = `
    <button data-cycle="monthly" class="on">Monthly</button>
    <button data-cycle="yearly">Yearly <span class="save">SAVE ${SAVE_PCT}%</span></button>`;

  const apply = cycle => {
    [...toggleHost.children].forEach(b => b.classList.toggle('on', b.dataset.cycle === cycle));
    renderPlanCards(cardsHost, { cycle });
    if (tableHost) renderCompare(tableHost, cycle);
  };

  toggleHost.addEventListener('click', e => {
    const b = e.target.closest('button[data-cycle]');
    if (b) apply(b.dataset.cycle);
  });
  apply('monthly');
}

/** The capability matrix — one row per entitlement in plans.py. */
export function renderCompare(host, cycle = 'monthly') {
  if (!host) return;
  const cell = (plan, key) => {
    if (!hasCap(plan, key)) return '<td class="pc n">&mdash;</td>';
    if (plan.demoOnly) return '<td class="pc d">demo</td>';
    return '<td class="pc y">&#10003;</td>';
  };

  host.innerHTML = `
  <table class="t cmp">
    <thead>
      <tr>
        <th>Capability</th>
        ${PLANS.map(p => `<th class="pc${p.trial ? ' star' : ''}">${p.name}</th>`).join('')}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="cap"><b>Price</b></td>
        ${PLANS.map(p => `<td class="pc num">${p.monthly === 0 ? 'Free'
          : `${CURRENCY}${inr(priceOf(p, cycle))}<span class="dim">${cycle === 'yearly' ? '/yr' : '/mo'}</span>`}</td>`).join('')}
      </tr>
      <tr>
        <td class="cap"><b>Connect your own Dhan account</b><br><span class="dim" style="font-size:12.5px">live NSE / BSE / MCX data</span></td>
        ${PLANS.map(p => p.liveData ? '<td class="pc y">&#10003;</td>' : '<td class="pc n">&mdash;</td>').join('')}
      </tr>
      ${CAPS.map(c => `<tr><td class="cap">${c.name}</td>${PLANS.map(p => cell(p, c.key)).join('')}</tr>`).join('')}
      <tr>
        <td class="cap"><b>${TRIAL_DAYS}-day free trial</b></td>
        ${PLANS.map(p => p.trial ? '<td class="pc y">&#10003;</td>' : '<td class="pc n">&mdash;</td>').join('')}
      </tr>
    </tbody>
  </table>`;
}
