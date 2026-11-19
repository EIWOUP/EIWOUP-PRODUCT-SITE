'use strict';
/* ════════════════════════════════════════════════════════════════════
   The customer account (account.html). One section at a time, picked by
   the URL hash (#overview, #subscription …), so every section can be
   linked to directly — the header menu does.

   All data comes from api.* in js/auth.js. Today that is the dummy
   backend; later it is the online database, with no change here.
   ════════════════════════════════════════════════════════════════════ */

import { api, signOut, signedIn, initials } from '/js/auth.js';
import { PLANS, CAPS, planById, inr, yearlyOf, yearlySaving, GST_RATE } from '/js/pricing-data.js';

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const body = $('#ac-body');
const DAY = 864e5;

if (!signedIn()) location.replace(`login.html?next=${encodeURIComponent('account.html' + location.hash)}`);

/* ── small helpers ────────────────────────────────────────────────── */
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const date = (d, o = {}) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata', ...o });
const time = d => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const money = n => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
const ago = d => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const n = Math.round(s / 86400);
  return n === 1 ? 'yesterday' : `${n} days ago`;
};
const I = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const ICON = {
  check: I('<path d="m5 12 4.5 4.5L19 7"/>'),
  lock: I('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>'),
  eye: I('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  down: I('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  up: I('<path d="m6 14 6-6 6 6"/>'),
  pc: I('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>'),
  mail: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  chat: I('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>'),
  book: I('<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>'),
  plug: I('<path d="M9 7V3M15 7V3M6 7h12v4a6 6 0 0 1-12 0zM12 17v4"/>'),
  upi: I('<path d="m7 4 5 8-5 8M13 4l5 8-5 8"/>'),
  card: I('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6.5 15h4"/>'),
  plus: I('<path d="M12 5v14M5 12h14"/>'),
  shield: I('<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/>'),
  arrow: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
};
const pill = (txt, kind = '') => `<span class="st-pill ${kind}">${esc(txt)}</span>`;

function toast(msg, kind = 'ok') {
  const t = $('#toast');
  t.className = `toast on ${kind}`;
  t.innerHTML = `${kind === 'ok' ? ICON.check : '!'}<span>${esc(msg)}</span>`;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('on'), 3200);
}

let lastFocus = null;
function modal(html, wire) {
  const m = $('#modal'), box = $('.modal-box', m);
  lastFocus = document.activeElement;
  box.innerHTML = html;
  m.hidden = false;
  requestAnimationFrame(() => m.classList.add('on'));
  const close = () => { m.classList.remove('on'); setTimeout(() => { m.hidden = true; lastFocus?.focus?.(); }, 200); };
  $$('[data-close]', m).forEach(b => { b.onclick = close; });
  m.onkeydown = e => { if (e.key === 'Escape') close(); };
  ($('[autofocus]', box) || $('button, input, select, textarea', box))?.focus();
  wire?.(box, close);
}

async function busy(btn, work) {
  const label = btn.innerHTML;
  btn.disabled = true; btn.classList.add('busy');
  try { return await work(); } finally { btn.disabled = false; btn.classList.remove('busy'); btn.innerHTML = label; }
}

function guard(e) {
  if (e?.code === 'expired') { location.replace(`login.html?next=${encodeURIComponent('account.html' + location.hash)}`); return true; }
  toast(e?.message || 'Something went wrong. Try again.', 'bad');
  return false;
}

/* ── state ────────────────────────────────────────────────────────── */
let A = null;              // the account, as the backend returned it
async function load() { A = await api.account(); return A; }

const head = (title, sub, extra = '') => `
  <header class="ac-head">
    <div><h1 class="ac-h" tabindex="-1">${title}</h1>${sub ? `<p class="ac-sub">${sub}</p>` : ''}</div>${extra}
  </header>`;

function period() {
  const s = A.subscription, a = new Date(s.currentStart).getTime(), b = new Date(s.currentEnd).getTime();
  const total = Math.round((b - a) / DAY), used = Math.min(total, Math.max(0, Math.floor((Date.now() - a) / DAY)));
  return { total, used, left: Math.max(0, Math.ceil((b - Date.now()) / DAY)), pct: Math.min(100, (Date.now() - a) / (b - a) * 100) };
}
const plan = () => planById(A.subscription.plan) || planById('free');
/* the plan's state as the database reports it */
const STATUS = { active: ['Active', 'ok'], trialing: ['Trial', 'info'], past_due: ['Payment due', 'warn'], halted: ['Paused', 'warn'],
  expired: ['Expired', 'warn'], cancelled: ['Ending', 'warn'], free: ['Free', ''] };
const statusPill = s => pill(...(STATUS[s.status] || ['Active', 'ok']));
const defaultMethod = () => A.methods.find(m => m.default) || A.methods[0];

/* ═════════════════════════════════════════════════════════ sections */
const S = {};

/* ── overview ─────────────────────────────────────────────────────── */
S.overview = () => {
  const s = A.subscription, p = period(), pl = plan();
  const hr = +new Date().toLocaleString('en-GB', { hour: 'numeric', hour12: false, timeZone: 'Asia/Kolkata' });
  const hello = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const first = A.profile.name.split(' ')[0];
  const open = A.tickets.filter(t => t.status !== 'resolved').length;
  const elite = planById('elite');
  const locked = CAPS.filter(c => !pl.caps.includes(c.key));
  return `
  ${head(`${hello}, ${esc(first)}`, 'Here is your EIMC account at a glance.')}
  <section class="ov-hero card glow">
    <div class="ov-plan">
      <div class="ov-k">Your plan</div>
      <div class="ov-name">${esc(s.planName)} ${s.cancelAtPeriodEnd ? pill('Ends ' + date(s.currentEnd, { year: undefined }), 'warn') : statusPill(s)}</div>
      <div class="ov-px">${money(s.price)}<span> / ${s.cycle === 'yearly' ? 'year' : 'month'} + GST</span></div>
      <div class="ov-meta">${s.cancelAtPeriodEnd
        ? `Your plan stays on until <b>${date(s.currentEnd)}</b>, then it stops.`
        : `Renews on <b>${date(s.currentEnd)}</b> &middot; ${money(s.total)} via ${esc(defaultMethod().label)}`}</div>
      <div class="btns mt24">
        <a class="btn btn-gold btn-sm" href="#subscription">Manage subscription <span class="arw">&rarr;</span></a>
        <a class="btn btn-sm" href="#orders">Invoices</a>
      </div>
    </div>
    <div class="ov-ring" style="--p:${p.pct.toFixed(1)}">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="52"/><circle class="v" cx="60" cy="60" r="52" pathLength="100"/></svg>
      <div><b>${p.left}</b><span>day${p.left === 1 ? '' : 's'} left</span></div>
      <small>Day ${p.used + 1} of ${p.total} &middot; ${date(s.currentStart, { year: undefined })} &ndash; ${date(s.currentEnd, { year: undefined })}</small>
    </div>
  </section>

  <section class="tiles">
    <div class="tile"><span>Next payment</span><b>${s.cancelAtPeriodEnd ? '—' : money(A.upcoming.total)}</b><em>${s.cancelAtPeriodEnd ? 'No more charges' : date(A.upcoming.date)}</em></div>
    <div class="tile"><span>Devices</span><b>${A.devices.length} <i>of ${s.seats}</i></b><em>Seats on your licence</em></div>
    <div class="tile"><span>Market data</span><b class="ok-t">Live</b><em>Dhan ${esc(A.licence.broker.clientId)} connected</em></div>
    <div class="tile"><span>Support</span><b>${open}</b><em>${open === 1 ? 'Open ticket' : 'Open tickets'}</em></div>
  </section>

  <div class="ov-grid">
    <section class="card">
      <div class="card-h"><h2>What your plan includes</h2><a class="tlink" href="pricing.html">Compare plans</a></div>
      <ul class="caps">
        ${CAPS.map(c => {
          const on = pl.caps.includes(c.key);
          return `<li class="${on ? 'on' : 'off'}">${on ? ICON.check : ICON.lock}<span>${esc(c.name)}</span>${on ? '' : '<em>Elite</em>'}</li>`;
        }).join('')}
      </ul>
    </section>
    <div class="ov-col">
      ${locked.length ? `
      <section class="card up-card">
        <div class="ov-k">Upgrade</div>
        <h2>Elite adds what the book is doing</h2>
        <p>${locked.map(c => esc(c.name.split(' — ')[0].split(' & ')[0])).join(' and ')}. ${money(elite.monthly - pl.monthly)} a month more.</p>
        <a class="btn btn-sm mt16" href="buy.html?plan=elite&amp;cycle=${s.cycle}">See Elite <span class="arw">&rarr;</span></a>
      </section>` : ''}
      <section class="card">
        <div class="card-h"><h2>Shortcuts</h2></div>
        <div class="quick">
          <a href="download.html">${ICON.down}<div><b>Download the terminal</b><span>${esc(A.licence.version)} for Windows</span></div></a>
          <a href="download.html#dhan">${ICON.plug}<div><b>Connect Dhan</b><span>Live data in four steps</span></div></a>
          <a href="#support">${ICON.chat}<div><b>Contact support</b><span>Replies within one working day</span></div></a>
          <a href="#ideas">${ICON.book}<div><b>Suggest a feature</b><span>Vote on what we build next</span></div></a>
        </div>
      </section>
    </div>
  </div>`;
};

/* ── subscription ─────────────────────────────────────────────────── */
S.subscription = () => {
  const s = A.subscription, pl = plan(), p = period(), m = defaultMethod();
  const yearly = yearlyOf(pl), save = yearlySaving(pl);
  const order = ['basic', 'pro', 'elite'];
  return `
  ${head('Subscription', 'Your plan, what it costs and when it renews.')}
  ${s.cancelAtPeriodEnd ? `
  <div class="banner warn">
    <div><b>Your subscription is set to end on ${date(s.currentEnd)}.</b> You keep every Pro feature until then. Nothing more will be charged.</div>
    <button class="btn btn-sm" data-act="resume">Keep my subscription</button>
  </div>` : ''}
  <section class="card">
    <div class="sub-top">
      <div>
        <div class="ov-k">Current plan</div>
        <div class="ov-name">${esc(s.planName)} ${s.cancelAtPeriodEnd ? pill('Cancelling', 'warn') : pill('Active', 'ok')}</div>
        <p class="muted mt8">${esc(pl.blurb)}</p>
      </div>
      <div class="sub-bar">
        <div class="bar"><i style="width:${p.pct.toFixed(1)}%"></i></div>
        <div class="bar-l"><span>${date(s.currentStart)}</span><span>${p.left} days left</span><span>${date(s.currentEnd)}</span></div>
      </div>
    </div>
    <dl class="kv mt24">
      <div><dt>Billing cycle</dt><dd>Monthly${s.cycleNext === 'yearly' ? ' <em class="hint">switches to yearly on ' + date(s.currentEnd) + '</em>' : ''}</dd></div>
      <div><dt>Price</dt><dd>${money(s.price)} a month</dd></div>
      <div><dt>GST (${Math.round(GST_RATE * 100)}%)</dt><dd>${money(s.gst)}</dd></div>
      <div><dt>Charged each month</dt><dd><b>${money(s.total)}</b></dd></div>
      <div><dt>Current period</dt><dd>${date(s.currentStart)} &ndash; ${date(s.currentEnd)}</dd></div>
      <div><dt>${s.cancelAtPeriodEnd ? 'Ends on' : 'Next renewal'}</dt><dd>${date(s.currentEnd)}</dd></div>
      <div><dt>Pays with</dt><dd>${esc(m.label)} &middot; ${esc(m.detail)} <a class="tlink sm" href="#payments">Change</a></dd></div>
      <div><dt>Seats</dt><dd>${s.seats} PCs &middot; ${A.devices.length} in use</dd></div>
    </dl>
  </section>

  <section class="card">
    <div class="card-h"><h2>Billing cycle</h2></div>
    <div class="cyc">
      <button class="cyc-o ${s.cycleNext === 'monthly' ? 'on' : ''}" data-cycle="monthly">
        <b>Monthly</b><span>${money(pl.monthly)} a month + GST</span><em>Cancel any time</em>
      </button>
      <button class="cyc-o ${s.cycleNext === 'yearly' ? 'on' : ''}" data-cycle="yearly">
        <b>Yearly <i class="save">2 months free</i></b><span>${money(yearly)} a year + GST</span><em>Saves ${money(save)} against monthly</em>
      </button>
    </div>
    <p class="fine mt16">A change of cycle starts at your next renewal, ${date(s.currentEnd)}. Nothing is charged today.</p>
  </section>

  <section class="card">
    <div class="card-h"><h2>Change plan</h2><a class="tlink" href="pricing.html#compare">Full comparison</a></div>
    <div class="pl3">
      ${order.map(id => {
        const q = planById(id), cur = id === s.plan, up = order.indexOf(id) > order.indexOf(s.plan);
        return `<div class="pl ${cur ? 'cur' : ''}">
          <div class="pl-n">${esc(q.name)} ${cur ? pill('Your plan', 'ok') : ''}</div>
          <div class="pl-p">${money(q.monthly)}<span>/mo</span></div>
          <ul>${q.highlights.slice(0, 4).map(h => `<li>${esc(h)}</li>`).join('')}</ul>
          ${cur ? '<button class="btn btn-sm btn-block" disabled>Current plan</button>'
            : `<a class="btn btn-sm btn-block ${up ? 'btn-gold' : ''}" href="buy.html?plan=${id}&amp;cycle=${s.cycle}">${up ? 'Upgrade' : 'Switch'} to ${esc(q.name)}</a>`}
        </div>`;
      }).join('')}
    </div>
    <p class="fine mt16">Upgrades start at once and you pay only the difference for the days left. A downgrade starts at your next renewal.</p>
  </section>

  ${s.cancelAtPeriodEnd ? '' : `
  <section class="card danger-zone">
    <div><h2>Cancel subscription</h2><p class="muted">You keep ${esc(plan().name)} until ${date(s.currentEnd)}. The free terminal on demo data keeps working after that.</p></div>
    <button class="btn btn-sm btn-danger" data-act="cancel">Cancel subscription</button>
  </section>`}`;
};

/* ── orders & invoices ────────────────────────────────────────────── */
S.orders = () => {
  const s = A.subscription, spent = A.orders.reduce((n, o) => n + (o.status === 'paid' ? o.total : 0), 0);
  return `
  ${head('Orders &amp; invoices', 'Every payment, with a GST invoice for your records.')}
  <section class="tiles three">
    <div class="tile"><span>Paid so far</span><b>${money(spent)}</b><em>Including GST</em></div>
    <div class="tile"><span>Orders</span><b>${A.orders.length}</b><em>Since ${date(A.profile.memberSince, { day: undefined })}</em></div>
    <div class="tile"><span>${s.cancelAtPeriodEnd ? 'Upcoming' : 'Next charge'}</span><b>${s.cancelAtPeriodEnd ? '—' : money(A.upcoming.total)}</b><em>${s.cancelAtPeriodEnd ? 'None, the plan is ending' : date(A.upcoming.date) + ' · ' + esc(defaultMethod().label)}</em></div>
  </section>
  <section class="card flush">
    <div class="tw-a">
      <table class="tbl">
        <thead><tr><th>Order</th><th>Date</th><th>Item</th><th class="r">Amount</th><th>Status</th><th class="r">Invoice</th></tr></thead>
        <tbody>
          ${s.cancelAtPeriodEnd ? '' : `<tr class="soon">
            <td class="mono">Upcoming</td><td>${date(A.upcoming.date)}</td><td>${esc(A.upcoming.item)}</td>
            <td class="r mono">${money(A.upcoming.total)}</td><td>${pill('Scheduled')}</td><td class="r muted">&mdash;</td></tr>`}
          ${A.orders.map(o => `<tr>
            <td class="mono">${esc(o.id)}</td>
            <td>${date(o.date)}<small>${time(o.date)}</small></td>
            <td>${esc(o.item)}<small>${date(o.period[0], { year: undefined })} &ndash; ${date(o.period[1], { year: undefined })}</small></td>
            <td class="r mono">${money(o.total)}${o.gst ? `<small>incl. ${money(o.gst)} GST</small>` : ''}</td>
            <td>${o.status === 'failed' ? pill('Failed', 'warn') : o.status === 'refunded' ? pill('Refunded') : pill(o.status === 'paid' ? 'Paid' : 'Completed', 'ok')}</td>
            <td class="r">${o.invoice ? `<button class="btn btn-sm" data-invoice="${esc(o.id)}">${ICON.down}PDF</button>` : '<span class="muted">No charge</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  </section>
  <p class="fine">Invoices open in a new tab, ready to print or save as PDF. Need your GSTIN on them? Add it under <a class="tlink sm" href="#payments">Payment methods</a>.</p>`;
};

function invoice(id) {
  const o = A.orders.find(x => x.id === id), b = A.billing;
  if (!o) return;
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups for this site to open the invoice.', 'bad'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${esc(o.invoice)}</title>
  <style>
    body{font:14px/1.5 Arial,Helvetica,sans-serif;color:#111;margin:48px;max-width:760px}
    h1{font-size:22px;margin:0 0 4px}.muted{color:#666}.row{display:flex;justify-content:space-between;gap:24px;margin:28px 0}
    table{width:100%;border-collapse:collapse;margin-top:12px}th,td{text-align:left;padding:10px 8px;border-bottom:1px solid #ddd}
    th{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#666}.r{text-align:right}
    .tot td{font-weight:700;border-bottom:0}.stamp{display:inline-block;margin-top:24px;padding:6px 12px;border:2px solid #0a7;color:#0a7;font-weight:700;letter-spacing:.1em}
    .demo{margin-top:36px;padding:12px 14px;background:#fff6d6;border:1px solid #e9cf72;font-size:12.5px}
    @media print{.demo{display:none}button{display:none}body{margin:24px}}
  </style></head><body>
  <h1>Tax invoice</h1><div class="muted">${esc(o.invoice)} &middot; ${date(o.date)}</div>
  <div class="row">
    <div><b>EIMC Terminal</b><br><span class="muted">Seller details and GSTIN print here on live invoices</span></div>
    <div><b>Billed to</b><br>${esc(b.name)}<br>${esc(b.line1)}<br>${esc(b.line2)}<br>${esc(b.city)}, ${esc(b.state)} ${esc(b.pin)}${b.gstin ? '<br>GSTIN ' + esc(b.gstin) : ''}<br>Client ID ${esc(A.profile.clientId)}</div>
  </div>
  <table><thead><tr><th>Description</th><th>Period</th><th class="r">Amount</th></tr></thead><tbody>
    <tr><td>EIMC ${esc(o.item)} subscription (SAC 998431)</td><td>${date(o.period[0])} &ndash; ${date(o.period[1])}</td><td class="r">${money(o.amount)}</td></tr>
    <tr><td>IGST @ ${Math.round(GST_RATE * 100)}%</td><td></td><td class="r">${money(o.gst)}</td></tr>
    <tr class="tot"><td>Total</td><td></td><td class="r">${money(o.total)}</td></tr>
  </tbody></table>
  <div class="muted" style="margin-top:12px">Paid by ${esc(o.method)} &middot; Order ${esc(o.id)}</div>
  <div class="stamp">PAID</div>
  <div class="demo"><b>Sample invoice.</b> This is the demo account; live invoices are issued by the billing system.</div>
  <p><button onclick="print()">Print or save as PDF</button></p>
  </body></html>`);
  w.document.close();
}

/* ── payment methods ──────────────────────────────────────────────── */
S.payments = () => {
  const b = A.billing;
  return `
  ${head('Payment methods', 'How your subscription is paid, and the details on your invoices.')}
  <section class="card">
    <div class="card-h"><h2>Saved methods</h2><button class="btn btn-sm" data-act="add-method">${ICON.plus}Add method</button></div>
    <div class="pm-list">
      ${A.methods.map(m => `
      <div class="pm ${m.default ? 'def' : ''}">
        <div class="pm-ic ${m.type}">${m.type === 'upi' ? ICON.upi : ICON.card}</div>
        <div class="pm-t"><b>${esc(m.label)} ${m.default ? pill('Default', 'ok') : ''}</b><span class="mono">${esc(m.detail)}</span><em>${esc(m.note)}</em></div>
        <div class="pm-a">${m.default ? '<span class="muted">Charged for renewals</span>'
          : `<button class="btn btn-sm" data-default="${esc(m.id)}">Make default</button>`}</div>
      </div>`).join('')}
    </div>
    <p class="fine mt16">${ICON.shield}Card and UPI details are held by the payment provider, never by EIMC. We only see the last digits.</p>
  </section>

  <section class="card">
    <div class="card-h"><h2>Billing details</h2><span class="muted">Printed on every invoice</span></div>
    <form class="form" id="f-billing" novalidate>
      <div class="grid2">
        ${field('Name or business name', 'name', b.name, { required: true, auto: 'organization' })}
        ${field('GSTIN', 'gstin', b.gstin, { placeholder: 'Optional — 15 characters', hint: 'Add it to claim input tax credit.', mono: true })}
        ${field('Address line 1', 'line1', b.line1, { required: true, auto: 'address-line1' })}
        ${field('Address line 2', 'line2', b.line2, { auto: 'address-line2' })}
        ${field('City', 'city', b.city, { required: true, auto: 'address-level2' })}
        ${field('State', 'state', b.state, { required: true, auto: 'address-level1' })}
        ${field('PIN code', 'pin', b.pin, { required: true, auto: 'postal-code', mode: 'numeric', mono: true })}
      </div>
      <div class="form-foot"><button class="btn btn-gold btn-sm" type="submit">Save billing details</button></div>
    </form>
  </section>`;
};

function field(label, name, value, o = {}) {
  const id = `f-${name}`;
  const ctl = o.options
    ? `<select id="${id}" name="${name}">${o.options.map(v => `<option${v === value ? ' selected' : ''}>${esc(v)}</option>`).join('')}</select>`
    : o.area
      ? `<textarea id="${id}" name="${name}" rows="${o.rows || 5}" placeholder="${esc(o.placeholder || '')}"${o.required ? ' required' : ''}${o.max ? ` maxlength="${o.max}"` : ''}>${esc(value)}</textarea>`
      : `<input id="${id}" name="${name}" type="${o.type || 'text'}" value="${esc(value)}"${o.placeholder ? ` placeholder="${esc(o.placeholder)}"` : ''}${o.auto ? ` autocomplete="${o.auto}"` : ''}${o.mode ? ` inputmode="${o.mode}"` : ''}${o.required ? ' required' : ''}${o.readonly ? ' readonly' : ''}${o.max ? ` maxlength="${o.max}"` : ''}${o.mono ? ' class="mono"' : ''}>`;
  return `<div class="fld${o.wide ? ' wide' : ''}"><label for="${id}">${esc(label)}${o.badge || ''}</label>${ctl}${o.hint ? `<div class="fld-hint">${o.hint}</div>` : ''}<div class="fld-err"></div></div>`;
}
const formData = f => Object.fromEntries(new FormData(f).entries());
function check(f, rules = {}) {
  let ok = true;
  $$('.fld', f).forEach(d => d.classList.remove('bad'));
  $$('[required]', f).forEach(i => { if (!i.value.trim()) { mark(i, 'Required.'); ok = false; } });
  for (const [name, [re, msg]] of Object.entries(rules)) {
    const i = f.elements[name];
    if (i && i.value.trim() && !re.test(i.value.trim())) { mark(i, msg); ok = false; }
  }
  if (!ok) $('.fld.bad input, .fld.bad select, .fld.bad textarea', f)?.focus();
  return ok;
}
function mark(i, msg) { const d = i.closest('.fld'); d.classList.add('bad'); $('.fld-err', d).textContent = msg; }

/* ── personal info ────────────────────────────────────────────────── */
S.profile = () => {
  const p = A.profile;
  const ok = '<span class="vf">Verified</span>';
  return `
  ${head('Personal info', 'How we reach you, and a little about how you trade.')}
  <section class="card">
    <div class="pf-top">
      <span class="acct-av pf-av">${esc(initials(p.name))}</span>
      <div><b>${esc(p.name)}</b><span>Client ID <span class="mono">${esc(p.clientId)}</span> &middot; member since ${date(p.memberSince)}</span></div>
    </div>
    <form class="form mt24" id="f-profile" novalidate>
      <div class="grid2">
        ${field('Full name', 'name', p.name, { required: true, auto: 'name' })}
        ${field('Client ID', 'clientId', p.clientId, { readonly: true, mono: true, hint: 'Your client ID never changes.' })}
        ${field('Email', 'email', p.email, { type: 'email', required: true, auto: 'email', badge: p.emailVerified ? ok : '' , hint: 'Invoices and renewal reminders go here.' })}
        ${field('Mobile', 'phone', p.phone, { type: 'tel', required: true, auto: 'tel', badge: p.phoneVerified ? ok : '', mono: true })}
        ${field('City', 'city', p.city, { auto: 'address-level2' })}
        ${field('State', 'state', p.state, { auto: 'address-level1' })}
        ${field('Trading experience', 'experience', p.experience, { options: ['Under 1 year', '1–3 years', '3–5 years', '5+ years'] })}
        ${field('What you mostly trade', 'trades', p.trades, { options: ['NIFTY & BANKNIFTY options', 'Index futures', 'Stock options', 'Stocks (cash)', 'Commodities (MCX)'] })}
        ${field('Language', 'language', p.language, { options: ['English', 'हिन्दी (Hindi)', 'ગુજરાતી (Gujarati)'] })}
        ${field('Time zone', 'timezone', p.timezone, { readonly: true, hint: 'Market times are always shown in IST.' })}
      </div>
      <div class="form-foot"><span class="muted" id="pf-state"></span><button class="btn btn-gold btn-sm" type="submit">Save changes</button></div>
    </form>
  </section>
  <section class="card danger-zone">
    <div><h2>Download or delete your data</h2><p class="muted">Get a copy of everything we hold about you, or ask us to erase your account.</p></div>
    <div class="btns"><button class="btn btn-sm" data-act="export">Download my data</button><a class="btn btn-sm btn-danger" href="#support" data-prefill="delete">Request deletion</a></div>
  </section>`;
};

/* ── login & security ─────────────────────────────────────────────── */
S.security = () => `
  ${head('Login &amp; security', 'Your password, two-step verification and where you are logged in.')}
  <section class="card">
    <div class="card-h"><h2>Change password</h2></div>
    <form class="form" id="f-password" novalidate>
      <div class="grid2">
        ${field('Current password', 'current', '', { type: 'password', required: true, auto: 'current-password', wide: true })}
        ${field('New password', 'next', '', { type: 'password', required: true, auto: 'new-password', hint: '<div class="meter"><i></i></div><span class="meter-t">At least 8 characters, with a number and a symbol.</span>' })}
        ${field('Confirm new password', 'again', '', { type: 'password', required: true, auto: 'new-password' })}
      </div>
      <div class="form-foot"><button class="btn btn-gold btn-sm" type="submit">Update password</button></div>
    </form>
  </section>
  <section class="card row-card">
    <div class="rc-ic">${ICON.shield}</div>
    <div><h2>Two-step verification</h2><p class="muted">A one-time code from your phone each time you log in on a new device.</p></div>
    <span class="st-pill">Coming with online accounts</span>
  </section>
  <section class="card">
    <div class="card-h"><h2>Where you are logged in</h2><button class="btn btn-sm" data-act="out-all">Log out everywhere</button></div>
    <ul class="sess">
      ${A.sessions.map((x, i) => `<li>${i === 1 ? ICON.pc : ICON.shield}<div><b>${esc(x.device)}</b><span>${esc(x.where)} &middot; ${i === 0 ? 'Active now' : ago(x.when)}</span></div>${i === 0 ? pill('This browser', 'ok') : ''}</li>`).join('')}
    </ul>
  </section>`;

/* ── notifications ────────────────────────────────────────────────── */
const PREFS = [
  ['renewal', 'Renewal reminders', 'Three days before each charge, and if a payment fails.', true],
  ['invoices', 'Invoices and receipts', 'A copy of every invoice by email.'],
  ['product', 'Product updates', 'New versions of the terminal and what changed.'],
  ['setups', 'Weekly setup digest', 'How the DQRS setups did last week, every Saturday.'],
  ['offers', 'Offers', 'Occasional discounts. Never more than one a month.'],
];
S.notifications = () => `
  ${head('Notifications', 'Choose which emails we send you.')}
  <section class="card">
    <ul class="toggles">
      ${PREFS.map(([k, t, d, locked]) => `
      <li>
        <div><b>${t}</b><span>${d}${locked ? ' <em>Always on while you subscribe.</em>' : ''}</span></div>
        <label class="sw"><input type="checkbox" data-pref="${k}" ${A.prefs[k] || locked ? 'checked' : ''} ${locked ? 'disabled' : ''}><i></i><span class="sr">${t}</span></label>
      </li>`).join('')}
    </ul>
  </section>
  <p class="fine">Account and security emails (password changes, new log-ins) are always sent.</p>`;

/* ── licence & devices ────────────────────────────────────────────── */
S.devices = () => {
  const l = A.licence, s = A.subscription;
  const masked = l.key.replace(/^(EIMC-[A-Z]+-)(.*)(-[A-Z0-9]{4})$/, (_, a, b, c) => a + b.replace(/[A-Z0-9]/g, '•') + c);
  return `
  ${head('Licence &amp; devices', 'Your licence key, and the PCs the terminal is active on.')}
  <section class="card lic">
    <div>
      <div class="ov-k">Licence key</div>
      <div class="lic-key mono" data-key="${esc(l.key)}" data-masked="${esc(masked)}">${esc(masked)}</div>
      <p class="muted">Paste it into the terminal under Settings &rarr; Licence. Keep it private: it is tied to your account.</p>
    </div>
    <div class="btns">
      <button class="btn btn-sm" data-act="reveal">${ICON.eye}<span>Show</span></button>
      <button class="btn btn-sm" data-act="copy-key">${ICON.copy}Copy</button>
    </div>
  </section>
  <section class="tiles three">
    <div class="tile"><span>Seats used</span><b>${A.devices.length} <i>of ${s.seats}</i></b><div class="bar sm"><i style="width:${A.devices.length / s.seats * 100}%"></i></div></div>
    <div class="tile"><span>Latest version</span><b class="mono-b">${esc(l.version)}</b><em><a class="tlink sm" href="download.html">Download</a></em></div>
    <div class="tile"><span>Broker</span><b class="ok-t">${esc(l.broker.name)}</b><em>Connected &middot; ${esc(l.broker.clientId)}</em></div>
  </section>
  <section class="card">
    <div class="card-h"><h2>Activated PCs</h2><span class="muted">Remove one to free its seat</span></div>
    <ul class="dev">
      ${A.devices.length ? A.devices.map(d => {
        const old = d.version !== l.version;
        return `<li>
        <div class="dev-ic">${ICON.pc}</div>
        <div class="dev-t"><b>${esc(d.name)} ${d.here ? pill('Last used', 'ok') : ''}</b><span>${esc(d.os)} &middot; <span class="mono">${esc(d.version)}</span>${old ? ' <em class="warn-t">update available</em>' : ''}</span></div>
        <div class="dev-w"><span>Last active</span><b>${ago(d.lastSeen)}</b></div>
        <button class="btn btn-sm" data-remove-device="${esc(d.id)}">Remove</button>
      </li>`;
      }).join('') : '<li class="empty">No PCs are activated. Install the terminal and enter your key.</li>'}
    </ul>
  </section>`;
};

/* ── contact support ──────────────────────────────────────────────── */
const CATS = ['Billing & payments', 'Licence & activation', 'Dhan connection', 'Data & accuracy', 'Bug report', 'Account', 'Something else'];
S.support = (prefill) => `
  ${head('Contact support', 'Real people who use the terminal themselves. We reply within one working day.')}
  <section class="chan">
    <a class="card chan-c" href="mailto:support@eimc.app">${ICON.mail}<div><b>Email</b><span>support@eimc.app</span><em>Within 1 working day</em></div></a>
    <a class="card chan-c" href="#support-form" data-jump>${ICON.chat}<div><b>Raise a ticket</b><span>Tracked here, with updates</span><em>Fastest for bugs and billing</em></div></a>
    <a class="card chan-c" href="download.html#keys">${ICON.book}<div><b>Guides</b><span>Setup, Dhan, shortcuts</span><em>Answers in minutes</em></div></a>
  </section>
  <section class="card" id="support-form">
    <div class="card-h"><h2>New ticket</h2><span class="muted">Mon–Sat, 9:00–18:00 IST</span></div>
    <form class="form" id="f-ticket" novalidate>
      <div class="grid2">
        ${field('Topic', 'category', prefill === 'delete' ? 'Account' : 'Billing & payments', { options: CATS })}
        ${field('Subject', 'subject', prefill === 'delete' ? 'Please delete my account and data' : '', { required: true, placeholder: 'One line about the problem', max: 120 })}
        ${field('What happened?', 'message', '', { area: true, required: true, wide: true, max: 4000, placeholder: 'What you did, what you expected, and what you saw instead. Screenshots help — reply to our email with them.' })}
      </div>
      <label class="chk mt16"><input type="checkbox" name="sys" checked><span></span>Include my plan, licence and terminal version</label>
      <div class="form-foot"><span class="muted">We reply to ${esc(A.profile.email)}</span><button class="btn btn-gold btn-sm" type="submit">Send ticket</button></div>
    </form>
  </section>
  <section class="card">
    <div class="card-h"><h2>Your tickets</h2></div>
    <ul class="tix">
      ${A.tickets.length ? A.tickets.map(t => `<li>
        <div class="tix-h"><span class="mono">${esc(t.id)}</span>${pill(t.status === 'resolved' ? 'Resolved' : t.status === 'open' ? 'Open' : 'Waiting on you', t.status === 'resolved' ? 'ok' : 'info')}</div>
        <b>${esc(t.subject)}</b>
        <span class="muted">${esc(t.category)} &middot; opened ${date(t.created)} &middot; updated ${ago(t.updated)}</span>
        ${t.last ? `<p class="tix-last">${esc(t.last)}</p>` : t.message ? `<p class="tix-last">${esc(t.message.slice(0, 220))}${t.message.length > 220 ? '…' : ''}</p>` : ''}
      </li>`).join('') : '<li class="empty">No tickets yet.</li>'}
    </ul>
  </section>`;

/* ── feature requests ─────────────────────────────────────────────── */
const ST = { new: ['New', ''], review: ['Under review', 'info'], planned: ['Planned', 'gold'], considering: ['Considering', ''], shipped: ['Shipped', 'ok'] };
let ideaFilter = 'all';
S.ideas = () => {
  const list = A.ideas
    .filter(i => ideaFilter === 'all' || (ideaFilter === 'mine' ? i.mine : i.status === ideaFilter))
    .sort((a, b) => (a.status === 'shipped') - (b.status === 'shipped') || b.votes - a.votes);
  return `
  ${head('Feature requests', 'Tell us what would make the terminal better, and vote for what others asked for.')}
  <section class="card">
    <div class="card-h"><h2>Suggest something</h2></div>
    <form class="form" id="f-idea" novalidate>
      <div class="grid2">
        ${field('Your idea', 'title', '', { required: true, placeholder: 'e.g. Alerts when price reaches a Level', max: 90, wide: true })}
        ${field('Area', 'tag', 'Charts', { options: ['Charts', 'Order flow', 'Options', 'Setups', 'Trading', 'Terminal', 'Platform', 'Account'] })}
        ${field('Why it matters to you', 'body', '', { area: true, rows: 3, placeholder: 'How you trade today, and what this would change.', max: 1200, wide: true })}
      </div>
      <div class="form-foot"><span class="muted">Ideas are public to other customers, without your name.</span><button class="btn btn-gold btn-sm" type="submit">Submit idea</button></div>
    </form>
  </section>
  <section class="card">
    <div class="card-h"><h2>Ideas board</h2>
      <div class="seg-f">${[['all', 'All'], ['planned', 'Planned'], ['review', 'Under review'], ['shipped', 'Shipped'], ['mine', 'Mine']]
        .map(([k, t]) => `<button class="${ideaFilter === k ? 'on' : ''}" data-filter="${k}">${t}</button>`).join('')}</div>
    </div>
    <ul class="ideas">
      ${list.length ? list.map(i => `<li>
        <button class="vote ${i.voted ? 'on' : ''}" data-vote="${esc(i.id)}" aria-pressed="${!!i.voted}" aria-label="Vote for ${esc(i.title)}" ${i.status === 'shipped' || i.mine ? 'disabled' : ''}>${ICON.up}<b>${i.votes}</b></button>
        <div><b>${esc(i.title)}</b>${i.body ? `<p>${esc(i.body)}</p>` : ''}
          <div class="idea-m">${pill(ST[i.status][0], ST[i.status][1])}<span>${esc(i.tag)}</span>${i.mine ? '<span>Your idea</span>' : ''}${i.shipped ? `<span>in ${esc(i.shipped)}</span>` : ''}</div></div>
      </li>`).join('') : '<li class="empty">Nothing here yet.</li>'}
    </ul>
  </section>`;
};

/* ══════════════════════════════════════════════════════════ routing */
const TABS = Object.keys(S);
let prefill = null;
function route() {
  const id = (location.hash || '#overview').slice(1).split('-')[0];
  const tab = TABS.includes(id) ? id : 'overview';
  body.innerHTML = S[tab](prefill);
  prefill = null;
  body.dataset.tab = tab;
  $$('.ac-l').forEach(a => { const on = a.dataset.tab === tab; a.classList.toggle('on', on); on ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current'); });
  document.title = `${tab === 'overview' ? 'Your account' : $('.ac-h', body)?.textContent || 'Account'} | EIMC Terminal`;
  wire(tab);
  body.classList.remove('in'); void body.offsetWidth; body.classList.add('in');
}
function badges() {
  const open = A.tickets.filter(t => t.status !== 'resolved').length;
  const set = (k, v, cls = '') => { const n = $(`[data-badge="${k}"]`); if (n) { n.textContent = v || ''; n.className = v ? cls : ''; } };
  set('support', open || '');
  set('subscription', A.subscription.cancelAtPeriodEnd ? 'Ends' : '', 'warn');
}
function who() {
  $$('.ac-me [data-acct-initials], [data-acct] [data-acct-initials]').forEach(n => { n.textContent = initials(A.profile.name); });
  $$('.ac-me [data-acct-name], [data-acct] [data-acct-name]').forEach(n => { n.textContent = A.profile.name; });
  $$('.ac-me [data-acct-id], [data-acct] [data-acct-id]').forEach(n => { n.textContent = `Client ID ${A.profile.clientId}`; });
}
async function refresh(keepTab = true) { await load(); who(); badges(); if (keepTab) route(); }

/* ══════════════════════════════════════════════════════════ actions */
function wire(tab) {
  const on = (sel, ev, fn) => $$(sel, body).forEach(n => n.addEventListener(ev, fn));

  on('[data-invoice]', 'click', e => invoice(e.currentTarget.dataset.invoice));

  on('[data-cycle]', 'click', async e => {
    const c = e.currentTarget.dataset.cycle;
    if (c === A.subscription.cycleNext) return;
    try { await api.setNextCycle(c); await refresh(); toast(c === 'yearly' ? `You switch to yearly on ${date(A.subscription.currentEnd)}.` : 'You stay on monthly billing.'); } catch (x) { guard(x); }
  });
  on('[data-act="resume"]', 'click', e => busy(e.currentTarget, async () => {
    try { await api.setCancel(false); await refresh(); toast('Welcome back — your subscription will renew as normal.'); } catch (x) { guard(x); }
  }));
  on('[data-act="cancel"]', 'click', () => modal(`
    <h3 id="modal-h">Cancel your Pro subscription?</h3>
    <p>You keep every Pro feature until <b>${date(A.subscription.currentEnd)}</b>. After that the terminal goes back to the free plan on demo data. Your settings and drawings stay.</p>
    <div class="fld mt16"><label for="m-why">What made you cancel? <span class="muted">(optional)</span></label>
      <select id="m-why"><option value="">Choose a reason</option><option>Too expensive</option><option>Missing a feature I need</option><option>Not trading for a while</option><option>Moving to another tool</option><option>Something else</option></select></div>
    <div class="note gold mt16"><b>Taking a break?</b> Switch to Basic instead: ${money(planById('basic').monthly)} a month keeps live data and bar replay.</div>
    <div class="modal-f"><button class="btn btn-sm" data-close autofocus>Keep Pro</button><button class="btn btn-sm btn-danger" data-confirm>Cancel at period end</button></div>`,
  (box, close) => $('[data-confirm]', box).addEventListener('click', e => busy(e.currentTarget, async () => {
    try { await api.setCancel(true, $('#m-why', box).value); close(); await refresh(); toast(`Cancelled. Pro stays on until ${date(A.subscription.currentEnd)}.`); } catch (x) { guard(x); }
  }))));

  on('[data-default]', 'click', e => busy(e.currentTarget, async () => {
    try { await api.setDefaultMethod(e.currentTarget.dataset.default); await refresh(); toast('Default payment method changed.'); } catch (x) { guard(x); }
  }));
  on('[data-act="add-method"]', 'click', () => modal(`
    <h3 id="modal-h">Add a payment method</h3>
    <p>New cards and UPI Autopay mandates are added on the payment provider's secure page, so EIMC never sees your full card number or UPI PIN.</p>
    <div class="pm-pick">
      <button class="pm-o" disabled>${ICON.upi}<b>UPI Autopay</b><span>Any UPI app</span></button>
      <button class="pm-o" disabled>${ICON.card}<b>Credit or debit card</b><span>Visa, Mastercard, RuPay</span></button>
    </div>
    <p class="fine">This opens once accounts go online. Until then, your current methods keep working.</p>
    <div class="modal-f"><button class="btn btn-sm" data-close autofocus>Close</button></div>`));

  const fb = $('#f-billing', body);
  fb?.addEventListener('submit', e => { e.preventDefault();
    if (!check(fb, { gstin: [/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i, 'That is not a valid 15-character GSTIN.'], pin: [/^[1-9]\d{5}$/, 'Use a 6-digit PIN code.'] })) return;
    busy($('[type=submit]', fb), async () => { try { const d = formData(fb); d.gstin = d.gstin.toUpperCase(); await api.saveBilling(d); await refresh(); toast('Billing details saved.'); } catch (x) { guard(x); } });
  });

  const fp = $('#f-profile', body);
  if (fp) {
    fp.addEventListener('input', () => { $('#pf-state').textContent = 'Unsaved changes'; });
    fp.addEventListener('submit', e => { e.preventDefault();
      if (!check(fp, { email: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Enter a valid email address.'], phone: [/^\+?[\d\s-]{10,16}$/, 'Enter a valid mobile number.'] })) return;
      busy($('[type=submit]', fp), async () => {
        try { const d = formData(fp); delete d.clientId; delete d.timezone; await api.saveProfile(d); await refresh(); toast('Personal info saved.'); } catch (x) { guard(x); }
      });
    });
  }
  on('[data-act="export"]', 'click', () => {
    const blob = new Blob([JSON.stringify({ exported: new Date().toISOString(), ...A }, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `eimc-account-${A.profile.clientId}.json` });
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Your data is downloading.');
  });
  on('[data-prefill]', 'click', e => { prefill = e.currentTarget.dataset.prefill; });

  const fw = $('#f-password', body);
  if (fw) {
    const nx = fw.elements.next, meter = $('.meter i', fw), mt = $('.meter-t', fw);
    nx.addEventListener('input', () => {
      const v = nx.value, sc = [v.length >= 8, /\d/.test(v), /[^A-Za-z0-9]/.test(v), /[A-Z]/.test(v) && /[a-z]/.test(v), v.length >= 12].filter(Boolean).length;
      meter.style.width = `${sc * 20}%`; meter.dataset.s = sc;
      mt.textContent = !v ? 'At least 8 characters, with a number and a symbol.' : ['Too short', 'Weak', 'Fair', 'Good', 'Strong', 'Very strong'][sc];
    });
    fw.addEventListener('submit', e => { e.preventDefault();
      if (!check(fw)) return;
      if (fw.elements.next.value !== fw.elements.again.value) { mark(fw.elements.again, 'The two new passwords do not match.'); return; }
      busy($('[type=submit]', fw), async () => {
        try { await api.changePassword(fw.elements.current.value, fw.elements.next.value); fw.reset(); meter.style.width = '0'; toast('Password updated.'); }
        catch (x) { if (x.code === 'password') mark(/current/.test(x.message) ? fw.elements.current : fw.elements.next, x.message); else guard(x); }
      });
    });
  }
  on('[data-act="out-all"]', 'click', () => modal(`
    <h3 id="modal-h">Log out everywhere?</h3>
    <p>This ends every session, including this browser and the terminal on your PCs. You will need to log in again on each.</p>
    <div class="modal-f"><button class="btn btn-sm" data-close autofocus>Stay logged in</button><button class="btn btn-sm btn-danger" data-confirm>Log out everywhere</button></div>`,
  box => $('[data-confirm]', box).addEventListener('click', async () => { await signOut(); location.replace('login.html'); })));

  on('[data-pref]', 'change', async e => {
    const k = e.currentTarget.dataset.pref, v = e.currentTarget.checked;
    try { await api.savePrefs({ ...A.prefs, [k]: v }); A.prefs[k] = v; toast(v ? 'Turned on.' : 'Turned off.'); } catch (x) { e.currentTarget.checked = !v; guard(x); }
  });

  on('[data-act="reveal"]', 'click', e => {
    const k = $('.lic-key', body), show = k.textContent === k.dataset.masked;
    k.textContent = show ? k.dataset.key : k.dataset.masked;
    $('span', e.currentTarget).textContent = show ? 'Hide' : 'Show';
  });
  on('[data-act="copy-key"]', 'click', async () => {
    try { await navigator.clipboard.writeText(A.licence.key); toast('Licence key copied.'); } catch { toast('Copy failed — select the key and copy it.', 'bad'); }
  });
  on('[data-remove-device]', 'click', e => {
    const d = A.devices.find(x => x.id === e.currentTarget.dataset.removeDevice);
    modal(`<h3 id="modal-h">Remove ${esc(d.name)}?</h3>
      <p>The terminal on that PC goes back to the free plan the next time it starts, and the seat is free for another PC.</p>
      <div class="modal-f"><button class="btn btn-sm" data-close autofocus>Keep it</button><button class="btn btn-sm btn-danger" data-confirm>Remove PC</button></div>`,
    (box, close) => $('[data-confirm]', box).addEventListener('click', ev => busy(ev.currentTarget, async () => {
      try { await api.removeDevice(d.id); close(); await refresh(); toast(`${d.name} removed. One seat is free.`); } catch (x) { guard(x); }
    })));
  });

  on('[data-jump]', 'click', e => { e.preventDefault(); $('#support-form', body).scrollIntoView({ behavior: 'smooth' }); $('#f-subject', body).focus({ preventScroll: true }); });
  const ft = $('#f-ticket', body);
  ft?.addEventListener('submit', e => { e.preventDefault();
    if (!check(ft)) return;
    busy($('[type=submit]', ft), async () => {
      try {
        const d = formData(ft);
        const t = await api.createTicket({ category: d.category, subject: d.subject.trim(), message: d.message.trim(), system: !!d.sys });
        await refresh(); toast(`Ticket ${t.id} sent. We will reply by email.`);
      } catch (x) { guard(x); }
    });
  });

  const fi = $('#f-idea', body);
  fi?.addEventListener('submit', e => { e.preventDefault();
    if (!check(fi)) return;
    busy($('[type=submit]', fi), async () => {
      try { const d = formData(fi); await api.submitIdea({ title: d.title.trim(), body: d.body.trim(), tag: d.tag }); ideaFilter = 'mine'; await refresh(); toast('Thanks — your idea is on the board.'); } catch (x) { guard(x); }
    });
  });
  on('[data-filter]', 'click', e => { ideaFilter = e.currentTarget.dataset.filter; route(); });
  on('[data-vote]', 'click', async e => {
    const id = e.currentTarget.dataset.vote, i = A.ideas.find(x => x.id === id), v = !i.voted;
    i.voted = v; i.votes += v ? 1 : -1; route();
    try { await api.vote(id, v); } catch (x) { i.voted = !v; i.votes += v ? -1 : 1; route(); guard(x); }
  });

  $('.ac-h', body)?.focus({ preventScroll: true });
}

/* ── log out ──────────────────────────────────────────────────────── */
$('[data-logout-page]')?.addEventListener('click', async e => {
  e.currentTarget.disabled = true;
  await signOut();
  location.replace('index.html');
});

/* ── start ────────────────────────────────────────────────────────── */
addEventListener('hashchange', () => { route(); scrollTo({ top: 0, behavior: 'smooth' }); });
try {
  await refresh(false);
  route();
} catch (x) {
  if (!guard(x)) body.innerHTML = `<div class="card"><h2>We could not load your account.</h2><p class="muted mt8">Check your connection and <a class="tlink" href="">try again</a>.</p></div>`;
}
