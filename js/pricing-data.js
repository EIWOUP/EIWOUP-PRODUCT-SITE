'use strict';
/* ═══════════════════════════════════════════════════════════════
   EVERY price and entitlement on this website lives here.
   Change a number in this file and all pages follow.

   Plans on sale: Free (demo data) and Pro (everything, live data).
   Pro is on a launch price (monthly) with the regular price in listPrice.
   The capability keys are EIMC's own, from license_server/plans.py.
   ═══════════════════════════════════════════════════════════════ */

export const CURRENCY = '₹';
export const GST_RATE = 0.18;           // India, SaaS
export const TRIAL_DAYS = 1;            // the Pro trial offer
export const YEARLY_MONTHS = 10;        // kept for old yearly subscriptions only

/* What Dhan itself charges for its Data APIs (paid to Dhan, not to EIMC).
   Shown on the pricing page so nobody is surprised or scammed. */
export const DHAN_API_MONTHLY = 499;

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
  { key: 'book',        name: 'Live order-book density, 200 levels' },
  { key: 'heat',        name: 'Liquidity heatmap & Order flow recording' },
  { key: 'live',        name: 'Live real-money orders through Dhan' },
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
      'No account, no card, no expiry',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    blurb: 'Everything EIMC does, on your own Dhan account with live market data.',
    monthly: 299,           // launch price for the first customers
    listPrice: 499,         // the regular price after the launch offer
    caps: ALL,
    demoOnly: false,
    liveData: true,
    flag: 'Launch price',
    trial: true,
    cta: 'Start 1-day free trial',
    highlights: [
      'Live NSE / BSE / MCX data from your Dhan account',
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
      'Live real-money orders via Dhan, with server-checked guardrails',
    ],
  },
];

/* Plans no longer sold. Kept only so older subscriptions still show a name. */
const RETIRED = [
  { id: 'basic', name: 'Basic', blurb: 'This plan is no longer sold. Pro now includes every feature.', monthly: 499, caps: ['charts', 'replay', 'levels'], liveData: true, highlights: [] },
  { id: 'elite', name: 'Elite', blurb: 'This plan is no longer sold. Pro now includes every feature.', monthly: 2999, caps: ALL, liveData: true, highlights: [] },
];

/* ── helpers ─────────────────────────────────────────────────── */

export const yearlyOf = p => p.monthly * YEARLY_MONTHS;

export const planById = id => PLANS.find(p => p.id === id) || RETIRED.find(p => p.id === id) || null;

export const hasCap = (plan, key) => plan.caps.includes(key);

/** 1499 -> "1,499" (Indian digit grouping) */
export const inr = n => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** What one billing period costs, before tax. */
export const priceOf = (plan, cycle) => (cycle === 'yearly' ? yearlyOf(plan) : plan.monthly);

/** The saving a yearly plan makes against twelve monthly payments. */
export const yearlySaving = p => p.monthly * 12 - yearlyOf(p);

/** 12 - YEARLY_MONTHS months free, as a percentage, for the toggle badge. */
export const SAVE_PCT = Math.round((1 - YEARLY_MONTHS / 12) * 100);   // 17
