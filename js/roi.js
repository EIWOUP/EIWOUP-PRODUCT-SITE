'use strict';
/* ════════════════════════════════════════════════════════════════════
   THE POINTS CALCULATOR

   A trader does not think in rupees per month, they think in points.
   ₹1,499 is an abstraction; "23 NIFTY points" is a number they can
   check against their own last bad trade in about one second.

   That translation is the entire argument for the price, so it gets
   a real component rather than a sentence: pick your instrument, set
   how many lots you trade, and the page tells you what the
   subscription costs in the only unit that matters — then compares it
   to one ordinary stop-out.

   Everything is derived. Nothing here is a hardcoded marketing
   number, so changing a price in pricing-data.js or a lot size in
   market-data.js updates the whole argument.
   ════════════════════════════════════════════════════════════════════ */

import { PLANS, CURRENCY, planById } from '/js/pricing-data.js';
import { LOTS } from '/js/market-data.js';

/** Points per month a plan costs, given a contract size and lot count. */
const pointsOf = (rupees, lot, lots) => rupees / (lot * lots);

const f1 = n => n.toFixed(1);
const f0 = n => Math.round(n).toLocaleString('en-IN');

export function renderROI(host) {
  if (!host) return;

  const paid = PLANS.filter(p => p.monthly > 0);

  host.innerHTML = `
  <div class="roi">
    <div class="roi-controls">
      <div class="roi-field">
        <label>What you trade</label>
        <div class="seg" id="roi-sym">
          ${LOTS.map((l, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-lot="${l.lot}" data-sym="${l.sym}">${l.sym}</button>`).join('')}
        </div>
        <span class="roi-hint" id="roi-lotnote">1 lot = <b class="num">65</b> units &middot; NSE, Nov 2026 series</span>
      </div>

      <div class="roi-field">
        <label>Lots per trade <b class="num" id="roi-lots-v">1</b></label>
        <input type="range" id="roi-lots" min="1" max="20" step="1" value="1" class="rng">
        <span class="roi-hint">Most intraday index traders sit at one to three.</span>
      </div>

      <div class="roi-field">
        <label>Plan</label>
        <div class="seg" id="roi-plan">
          ${paid.map((p, i) => `<button type="button" class="${p.id === 'pro' ? 'on' : ''}" data-plan="${p.id}">${p.name}</button>`).join('')}
        </div>
      </div>
    </div>

    <div class="roi-out">
      <div class="roi-big">
        <div class="roi-pre">This costs you, per month</div>
        <div class="roi-n"><span class="num" id="roi-points">23.1</span><i>points</i></div>
        <div class="roi-post" id="roi-post">of <b>NIFTY 50</b>, on <b>1 lot</b></div>
      </div>
      <div class="roi-bars">
        <div class="roi-bar">
          <div class="roi-bl"><span>One ordinary stop-out <em>&mdash; 30 points</em></span><b class="num" id="roi-stop">₹1,950</b></div>
          <div class="roi-tr"><i style="--w:100%"></i></div>
        </div>
        <div class="roi-bar on">
          <div class="roi-bl"><span>A month of <b id="roi-pname">Pro</b></span><b class="num" id="roi-cost">₹299</b></div>
          <div class="roi-tr"><i id="roi-w" style="--w:77%"></i></div>
        </div>
      </div>
      <p class="roi-verdict" id="roi-verdict"></p>
    </div>
  </div>`;

  const $ = s => host.querySelector(s);

  const el = {
    sym: $('#roi-sym'), lots: $('#roi-lots'), lotsV: $('#roi-lots-v'),
    plan: $('#roi-plan'), cycle: $('#roi-cycle'), lotnote: $('#roi-lotnote'),
    points: $('#roi-points'), post: $('#roi-post'),
    stop: $('#roi-stop'), cost: $('#roi-cost'), w: $('#roi-w'),
    pname: $('#roi-pname'), verdict: $('#roi-verdict'),
  };

  const state = { lot: LOTS[0].lot, sym: LOTS[0].sym, lots: 1, plan: 'pro', cycle: 'monthly' };

  /* A single stop-out we compare against. 30 points is deliberately
     modest for an intraday index trade — the argument should hold at
     the low end, not only at a flattering one. */
  const STOP_POINTS = 30;

  const draw = () => {
    const plan = planById(state.plan);
    const per  = plan.monthly;
    const pts  = pointsOf(per, state.lot, state.lots);
    const stopRs = STOP_POINTS * state.lot * state.lots;

    el.points.textContent = f1(pts);
    el.post.innerHTML = `of <b>${state.sym}</b>, on <b>${state.lots} lot${state.lots > 1 ? 's' : ''}</b>`
      + ` &mdash; <span class="num">${CURRENCY}${f0(per)}</span> a month`;

    el.stop.textContent = `${CURRENCY}${f0(stopRs)}`;
    el.cost.textContent = `${CURRENCY}${f0(per)}`;
    el.pname.textContent = plan.name;
    el.lotnote.innerHTML = `1 lot = <b class="num">${state.lot}</b> units &middot; ${
      LOTS.find(l => l.lot === state.lot && l.sym === state.sym)?.note || 'current series'}`;

    const ratio = per / stopRs;
    el.w.style.setProperty('--w', `${Math.min(100, ratio * 100).toFixed(0)}%`);

    /* The verdict line is the whole point of the component, so it is
       written from the numbers rather than picked from a list. */
    const trades = stopRs / per;
    el.verdict.innerHTML = trades >= 1
      ? `Avoid <b>one</b> ${STOP_POINTS}-point stop-out a month and ${plan.name} has paid for itself
         <b class="gold">${f1(trades)}&times; over</b>. Everything after that is yours.`
      : `${plan.name} costs about <b class="gold">${f1(1 / trades)}</b> of those stop-outs a month.
         The question is whether seeing the pool before price gets there is worth that.`;
  };

  el.sym.addEventListener('click', e => {
    const b = e.target.closest('button[data-lot]'); if (!b) return;
    state.lot = +b.dataset.lot; state.sym = b.dataset.sym;
    [...el.sym.children].forEach(c => c.classList.toggle('on', c === b));
    draw();
  });
  el.plan.addEventListener('click', e => {
    const b = e.target.closest('button[data-plan]'); if (!b) return;
    state.plan = b.dataset.plan;
    [...el.plan.children].forEach(c => c.classList.toggle('on', c === b));
    draw();
  });
  el.cycle?.addEventListener('click', e => {
    const b = e.target.closest('button[data-cycle]'); if (!b) return;
    state.cycle = b.dataset.cycle;
    [...el.cycle.children].forEach(c => c.classList.toggle('on', c === b));
    draw();
  });
  el.lots.addEventListener('input', () => {
    state.lots = +el.lots.value;
    el.lotsV.textContent = state.lots;
    draw();
  });

  draw();
}

/** The headline figure, for the hero: what Pro costs in NIFTY points. */
export function proPoints() {
  const pro = planById('pro');
  return Math.round(pointsOf(pro.monthly, LOTS[0].lot, 1));
}

/** Fill any [data-pts] element with that figure, so the hero copy cannot drift. */
export function wirePoints() {
  const n = proPoints();
  document.querySelectorAll('[data-pts]').forEach(el => { el.textContent = n; });
}
