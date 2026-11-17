'use strict';
/* ═══════════════════════════════════════════════════════════════
   EVERY price and entitlement on this website lives here.
   Change a number in this file and all pages follow.

   The capability keys below are EIMC's own, copied from
   .removed-licensing/license_server/plans.py:

     BASIC = (CHARTS, REPLAY, LEVELS)
     PRO   = BASIC + (SMARTMONEY, SETUPS, GOLDVP, OPTIONCHAIN, OPTIONFLOW, BOOK)
     ELITE = PRO + (HEAT, LIVE)

   Keeping the same keys means the pricing page and the entitlement
   server can never drift apart — which is what plans.py asks for:
   "the tiers deliberately follow EIMC's existing Modes, so the
    pricing page can describe them in the words the app already uses."
   ═══════════════════════════════════════════════════════════════ */

export const CURRENCY = '₹';
export const GST_RATE = 0.18;           // India, SaaS
export const TRIAL_DAYS = 3;            // the Pro trial offer
export const YEARLY_MONTHS = 10;        // pay for 10, get 12 — "2 months free"

/* The 11 sellable capabilities, in the order the pricing table lists them.
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

const BASIC = ['charts', 'replay', 'levels'];
const PRO   = [...BASIC, 'smartmoney', 'setups', 'goldvp', 'optionchain', 'optionflow', 'book'];
const ELITE = [...PRO, 'heat', 'live'];

export const PLANS = [
  {
    id: 'free',
    name: 'Free',
    blurb: 'The whole terminal, running on generated data.',
    monthly: 0,
    caps: ELITE,            // every mode is visible…
    demoOnly: true,         // …but only against Demo (synthetic) data
    liveData: false,
    cta: 'Download free',
    ctaHref: 'download.html',
    highlights: [
      'Every mode and every indicator',
      'Demo (synthetic) market data',
      'Bar replay on demo data',
      'No account, no card, no expiry',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    blurb: 'Your own Dhan account, on live NSE / BSE / MCX data.',
    monthly: 499,
    caps: BASIC,
    demoOnly: false,
    liveData: true,
    cta: 'Choose Basic',
    highlights: [
      'Connect your own Dhan account',
      'Live candles, every tick',
      'Bar replay on real history',
      'Scored liquidity Levels',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    blurb: 'The analysis engine: structure, setups, profile and options.',
    monthly: 1499,
    caps: PRO,
    demoOnly: false,
    liveData: true,
    flag: 'Most popular',
    trial: true,
    cta: 'Start 3-day trial',
    highlights: [
      'Everything in Basic',
      'Smart money concepts',
      'DQRS setup tracker',
      'Golden volume profile',
      'Option chain + Option flow',
      'Order-book density',
    ],
  },
  {
    id: 'elite',
    name: 'Elite',
    blurb: 'Recorded liquidity and real orders, straight from the chart.',
    monthly: 2999,
    caps: ELITE,
    demoOnly: false,
    liveData: true,
    cta: 'Choose Elite',
    highlights: [
      'Everything in Pro',
      'Liquidity heatmap (Bookmap-style)',
      'Order flow recording (ATAS-style)',
      'Live real-money orders via Dhan',
      'Server-checked order guardrails',
    ],
  },
];

/* ── helpers ─────────────────────────────────────────────────── */

export const yearlyOf = p => p.monthly * YEARLY_MONTHS;

export const planById = id => PLANS.find(p => p.id === id) || null;

export const hasCap = (plan, key) => plan.caps.includes(key);

/** 1499 -> "1,499" (Indian digit grouping) */
export const inr = n => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });

/** What one billing period costs, before tax. */
export const priceOf = (plan, cycle) => (cycle === 'yearly' ? yearlyOf(plan) : plan.monthly);

/** The saving a yearly plan makes against twelve monthly payments. */
export const yearlySaving = p => p.monthly * 12 - yearlyOf(p);

/** 12 - YEARLY_MONTHS months free, as a percentage, for the toggle badge. */
export const SAVE_PCT = Math.round((1 - YEARLY_MONTHS / 12) * 100);   // 17
