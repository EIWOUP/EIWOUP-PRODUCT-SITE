'use strict';
/* ════════════════════════════════════════════════════════════════════
   MARKET FACTS AND COMPETITOR PRICING — the single source of truth
   for every comparative claim the site makes.

   RULE: nothing in this file is an estimate dressed as a fact. Each
   competitor row carries `src` (where the number came from) and
   `checked` (the date it was read off that page). Anything we could
   not read off a vendor's own page is marked `approx: true` and the
   UI renders it with a "~" and a hedge.

   Why that matters commercially: the price argument on this site is
   the strongest one we have, and it is only worth making if a
   sceptical trader can open the competitor's own pricing page and
   find the same number. One wrong figure and the whole page reads
   like marketing.

   FX is deliberately conservative — we round the competitor DOWN in
   rupees, never up, so the comparison understates our advantage
   rather than overstating it.
   ════════════════════════════════════════════════════════════════════ */

/** When the competitor prices below were last read off vendor pages. */
export const PRICES_CHECKED = '14 Nov 2026';

/* ── FX, rounded against our own interest ───────────────────────── */
export const FX = { usd: 95, eur: 106 };

/* ── NSE contract sizes (NSE F&O lot-size file, Nov 2026) ───────── */
export const LOTS = [
  { sym: 'NIFTY 50',  lot: 65, note: 'Nov 2026 series' },
  { sym: 'BANKNIFTY', lot: 35, note: 'Nov 2026 series' },
  { sym: 'SENSEX',    lot: 20, note: 'BSE, Nov 2026 series' },
];
export const NIFTY_LOT = 65;

/* ════════════════════════════════════════════════════════════════
   WHAT THE ALTERNATIVES COST, AND WHAT THEY DO ON NSE

   `nse` is the honest, decisive column. Order-flow platforms are
   built for CME futures and crypto; their Indian coverage, where it
   exists at all, is thin. That is a statement of fact about data
   plumbing, not a swipe at the products — ATAS and Bookmap are
   excellent at what they were built for.
   ════════════════════════════════════════════════════════════════ */
export const RIVALS = [
  {
    name: 'Bookmap',
    tier: 'Global+',
    what: 'Order-book heatmap, the category original',
    usd: 99,
    dataUsd: 34,
    dataNote: 'BookmapData CME, per exchange',
    nse: 'none',
    nseNote: 'Built for CME futures and crypto. Its Indian route was NSE Level 2 — five depth levels — via ICICIdirect, and TrueData has said its Bookmap connection has ended.',
    src: 'bookmap.com/packages',
    srcUrl: 'https://bookmap.com/packages',
  },
  {
    name: 'ATAS',
    tier: 'PRO',
    what: 'Footprint, delta, cluster and profile analysis',
    eur: 69.95,
    dataNote: 'Real-time futures on PRO and above; START and PLUS are 15-minute delayed',
    nse: 'none',
    nseNote: 'No NSE, BSE or MCX connection. Futures, stocks and crypto through its own broker and feed list.',
    src: 'atas.net/pricing',
    srcUrl: 'https://atas.net/pricing/',
  },
  {
    name: 'GoCharting',
    tier: 'Premium',
    what: 'Footprint and market profile, on NSE',
    inr: 1495,
    approx: true,
    dataNote: 'Real-time NSE spot, futures and options on every tier',
    nse: 'partial',
    nseNote: 'Genuinely covers NSE, and footprint is Premium-only. Browser-based, with no recorded order book and no 200-level depth.',
    src: 'gocharting.com/pricing',
    srcUrl: 'https://gocharting.com/pricing',
  },
  {
    name: 'Sensibull',
    tier: 'Pro',
    what: 'Option chain and strategy analytics',
    inr: 800,
    approx: true,
    dataNote: 'Free on some brokers',
    nse: 'options',
    nseNote: 'Options analytics only — no chart engine, no order flow, no depth.',
    src: 'published broker rate cards',
  },
  {
    name: 'Opstra',
    tier: 'Pro',
    what: 'Option analytics and backtesting',
    inr: 1300,
    approx: true,
    nse: 'options',
    nseNote: 'Options analytics only — no order flow, no depth, no chart terminal.',
    src: 'published rate cards',
  },
];

/** Monthly rupee cost of a rival, software + its own data, rounded down. */
export const rivalInr = r => {
  if (r.inr) return r.inr;
  const soft = r.usd ? r.usd * FX.usd : r.eur * FX.eur;
  const data = r.dataUsd ? r.dataUsd * FX.usd : 0;
  return Math.floor((soft + data) / 10) * 10;
};

/* ════════════════════════════════════════════════════════════════
   THE STACK ARGUMENT

   What a NIFTY trader who wanted all of this would actually have to
   assemble today, and what it would cost a month. Order flow and
   depth are the two rows nothing in India sells at all — which is
   the reason this product exists.
   ════════════════════════════════════════════════════════════════ */
export const STACK = [
  { need: 'Charts, indicators, drawings',          buy: 'TradingView Essential',  inr: 1200, approx: true },
  { need: 'Footprint and delta on NSE',            buy: 'GoCharting Premium',     inr: 1495, approx: true },
  { need: 'Option chain, greeks, buildup',         buy: 'Sensibull Pro',          inr: 800,  approx: true },
  { need: 'Option analytics and backtesting',      buy: 'Opstra Pro',             inr: 1300, approx: true },
  { need: 'Order-book heatmap',                    buy: 'Bookmap Global+ + data', inr: 12630, foreign: true },
  { need: 'Recorded 200-level depth on NIFTY 50',  buy: null, note: 'Not sold in India at any price' },
  { need: 'Measured, forward-tested setup scores', buy: null, note: 'Not sold in India at any price' },
];

export const stackTotal = () => STACK.reduce((n, r) => n + (r.inr || 0), 0);
