'use strict';
/* ════════════════════════════════════════════════════════════════════
   Plan cards and the capability matrix.
   Every number comes from pricing-data.js; nothing is written into
   markup, so one edit there updates the whole site.
   ════════════════════════════════════════════════════════════════════ */

import {
  PLANS, CAPS, CURRENCY, TRIAL_DAYS,
  inr, hasCap,
} from '/js/pricing-data.js';

const buyHref = plan =>
  plan.ctaHref ? plan.ctaHref : `buy.html?plan=${plan.id}&cycle=monthly`;

function priceBlock(plan) {
  if (plan.monthly === 0) {
    return `<div class="plan-px"><span class="amt">Free</span></div>
            <div class="plan-sub">No card, no expiry</div>`;
  }
  const was = plan.listPrice
    ? `<s style="opacity:.55;font-size:20px;font-weight:600;margin-right:8px">${CURRENCY}${inr(plan.listPrice)}</s>` : '';
  const sub = plan.listPrice
    ? `<b>Launch price</b> for our first customers &mdash; regular price ${CURRENCY}${inr(plan.listPrice)}`
    : '+ GST';
  return `<div class="plan-px">
            ${was}<span class="cur">${CURRENCY}</span><span class="amt">${inr(plan.monthly)}</span><span class="per">/ month</span>
          </div>
          <div class="plan-sub">${sub}</div>`;
}

function card(plan, compact) {
  const list = compact ? plan.highlights.slice(0, 5) : plan.highlights;
  const btn = plan.trial ? 'btn-gold' : plan.id === 'free' ? '' : 'btn-fill';
  return `
  <div class="plan${plan.trial ? ' feature' : ''}">
    ${plan.flag ? `<span class="plan-flag">${plan.flag}</span>` : ''}
    <div class="plan-name">${plan.name}</div>
    <div class="plan-for">${plan.blurb}</div>
    ${priceBlock(plan)}
    <a class="btn btn-block ${btn}" href="${buyHref(plan)}">${plan.cta}</a>
    <ul class="bul tick plan-foot">${list.map(h => `<li>${h}</li>`).join('')}</ul>
  </div>`;
}

/** Draw the plan cards into `host`. */
export function renderPlanCards(host, { compact = false } = {}) {
  if (!host) return;
  host.innerHTML = PLANS.map(p => card(p, compact)).join('');
}

/** Draws the cards and the matrix. Only monthly billing is sold now,
    so the old monthly / yearly switch is hidden. */
export function wireToggle(toggleHost, cardsHost, tableHost) {
  if (toggleHost) (toggleHost.closest('.btns') || toggleHost).style.display = 'none';
  renderPlanCards(cardsHost);
  if (tableHost) renderCompare(tableHost);
}

/** The capability matrix — one row per entitlement in plans.py. */
export function renderCompare(host) {
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
          : `${CURRENCY}${inr(p.monthly)}<span class="dim">/mo</span>`}</td>`).join('')}
      </tr>
      <tr>
        <td class="cap"><b>Live market data</b><br><span class="dim" style="font-size:12.5px">NSE / BSE / MCX, no broker account needed</span></td>
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
