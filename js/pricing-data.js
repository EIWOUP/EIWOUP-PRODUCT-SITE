'use strict';
/* ═══════════════════════════════════════════════════════════════
   EVERY price and entitlement on this website lives here.
   Change a number in this file and all pages follow.

   Plans on sale: Free (demo data) and Pro (everything, live data).
   Pro is on a launch price (monthly) with the regular price in listPrice.
   The numbers below are the fallback: the live values come from the
   database (/api/plans, edited in EIMC-Admin) and overwrite them.
   The capability keys are EIMC's own, from license_server/plans.py.
   ═══════════════════════════════════════════════════════════════ */

export const CURRENCY = '₹';
export const GST_RATE = 0.18;           // India, SaaS
export const TRIAL_DAYS = 1;            // the Pro trial offer (monthly billing only)


/* The 11 capabilities, in the order the pricing table lists them.
   `key` matches plans.py exactly. */
export const CAPS = [
  { key: 'charts',      name: 'Charts, 10 timeframes, indicators, drawings' },
  { key: 'replay',      name: 'Bar replay — practise when the market is shut' },
  { key: 'levels',      name: 'Scored liquidity Levels' },
  { key: 'smartmoney',  name: 'Smart money concepts — BOS, CHoCH, order blocks, FVG, stop hunts' },
  { key: 'setups',      name: 'DQRS setup tracker, forward-tested' },
  { key: 'goldvp',      name: 'Golden volume profile — TradingView-exact' },
  { key: 'optionchain', name: 'Option chain with greeks, buildup and max pain' },
  { key: 'optionflow',  name: 'Option flow — buyers vs sellers, scored 0–100' },
  { key: 'book',        name: 'Live order-book density, up to 200 levels' },
  { key: 'heat',        name: 'Liquidity heatmap & Order flow recording' },
  { key: 'live',        name: 'Live NSE / BSE / MCX market data, no broker account needed' },
];

const ALL = CAPS.map(c => c.key);

/* What is on sale: Free and Pro. Pro has everything. */
export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    blurb: 'The whole terminal on demo data. Explore every screen, no strings attached.',
    monthly: 0,
    caps: ALL,              // every mode is visible…
    demoOnly: true,         // …but only against Demo (synthetic) data
    liveData: false,
    cta: 'Download free',
    ctaHref: 'download.html',
    highlights: [
      'Every mode and every indicator',
      'Demo (synthetic) market data',
      'Bar replay on demo data',
      'Paper trading to practise',
      'Free account, no card, no expiry',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    blurb: 'Everything EIMC does, on live NSE, BSE and MCX market data. No broker account, no daily token.',
    monthly: 299,           // launch price for the first customers
    listPrice: 499,         // the regular price after the launch offer
    caps: ALL,
    demoOnly: false,
    liveData: true,
    flag: 'Launch price',
    trial: true,
    cta: 'Start 1-day free trial',
    highlights: [
      'Live NSE / BSE / MCX market data, straight from EIMC',
      'Tick-by-tick live candles, 10 timeframes',
      'Scored liquidity Levels',
      'Smart money concepts — BOS, CHoCH, order blocks, FVG',
      'DQRS setup tracker, forward-tested',
      'Golden volume profile',
      'Option chain with greeks + Option flow',
      'Order-book density, 200 levels',
      'Liquidity heatmap (Bookmap-style)',
      'Order flow and footprint recording (ATAS-style)',
      'Bar replay on real history',
      'Paper trading on live prices, to practise without risk',
    ],
  },
];

/* ── live prices from the database ────────────────────────────────
   /api/plans returns what EIMC-Admin has set (price, regular price,
   features, wording). Every page that imports this file waits for it,
   so a price changed in the admin shows up everywhere on the next load.
   If the database cannot be reached in time, the numbers above are used. */
async function loadLive() {
  if (typeof fetch !== 'function' || typeof location === 'undefined' || !/^https?:$/.test(location.protocol)) return;
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctl && setTimeout(() => ctl.abort(), 1500);
  try {
    const r = await fetch('/api/plans', { signal: ctl?.signal, headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    const { plans } = await r.json();
    for (const row of plans || []) {
      const plan = PLANS.find(p => p.id === row.code);
      if (!plan) continue;
      if (Number.isFinite(row.monthly)) plan.monthly = row.monthly;
      plan.listPrice = Number.isFinite(row.listPrice) && row.listPrice > plan.monthly ? row.listPrice : undefined;
      if (!plan.listPrice) delete plan.flag;
      if (row.description) plan.blurb = row.description;
      if (Array.isArray(row.features) && row.features.length) plan.caps = CAPS.map(c => c.key).filter(k => row.features.includes(k));
      if (Number.isFinite(row.devices)) plan.devices = row.devices;
    }
  } catch { /* offline or slow: keep the built-in prices */ } finally { if (timer) clearTimeout(timer); }
}
await loadLive();

/* ── helpers ─────────────────────────────────────────────────── */

export const planById = id => PLANS.find(p => p.id === id) || null;

export const hasCap = (plan, key) => plan.caps.includes(key);

/** 1499 -> "1,499" (Indian digit grouping) */
export const inr = n => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** What one billing period costs, before tax. Only monthly billing is sold. */
export const priceOf = plan => plan.monthly;
