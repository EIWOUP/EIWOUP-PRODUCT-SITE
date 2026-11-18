'use strict';
/* ════════════════════════════════════════════════════════════════════
   DUMMY account data for the demo customer. It is only read by the dummy
   backend in js/auth.js and is replaced by the online database later.

   Every date is worked out from "now", so the demo always shows a live
   one-month Pro subscription, six days into its period, however long
   after today the site is opened.

   Every person, number and address here is invented.
   ════════════════════════════════════════════════════════════════════ */

import { planById, GST_RATE } from '/js/pricing-data.js';

export const DEMO_ID = '2222004';
export const DEMO_PASSWORD = '2222004';

const DAY = 864e5;
const addMonths = (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const iso = d => new Date(d).toISOString();

export function demoAccount(now) {
  const t = now.getTime();
  const start = new Date(t - 6 * DAY); start.setHours(9, 14, 0, 0);
  const end = addMonths(start, 1);
  const trial = new Date(start.getTime() - 3 * DAY); trial.setHours(18, 2, 0, 0);
  const pro = planById('pro');
  const base = pro.monthly, gst = Math.round(base * GST_RATE * 100) / 100;

  return {
    profile: {
      clientId: DEMO_ID,
      name: 'Aarav Mehta',
      email: 'aarav.mehta@example.com',
      phone: '+91 98250 22004',
      city: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      language: 'English',
      timezone: 'Asia/Kolkata (IST)',
      experience: '3–5 years',
      trades: 'NIFTY & BANKNIFTY options',
      memberSince: iso(trial),
      emailVerified: true,
      phoneVerified: true,
    },
    subscription: {
      plan: 'pro',
      planName: pro.name,
      cycle: 'monthly',
      cycleNext: 'monthly',
      status: 'active',
      price: base,
      gst,
      total: base + gst,
      currentStart: iso(start),
      currentEnd: iso(end),
      autoRenew: true,
      cancelAtPeriodEnd: false,
      seats: 2,
      trialUsed: true,
    },
    licence: {
      key: 'EIMC-PRO-7Q4K-M2XD-9H6T',
      version: 'v1.25.218.93',
      broker: { name: 'Dhan', status: 'connected', clientId: '••••1187', since: iso(start) },
    },
    devices: [
      { id: 'dev-1', name: 'TRADING-PC', os: 'Windows 11 Pro', version: 'v1.25.218.93', lastSeen: iso(t - 35 * 60e3), here: true },
      { id: 'dev-2', name: 'AARAV-LAPTOP', os: 'Windows 10 Home', version: 'v1.25.217.40', lastSeen: iso(t - 4 * DAY) },
    ],
    methods: [
      { id: 'pm-upi', type: 'upi', label: 'UPI Autopay', detail: 'aarav••••@okhdfcbank', note: 'Mandate up to ₹2,000 a month', added: iso(start), default: true },
      { id: 'pm-card', type: 'card', label: 'Visa', detail: '•••• 4242', note: 'Expires 08/29', added: iso(trial), default: false },
    ],
    billing: {
      name: 'Aarav Mehta',
      gstin: '',
      line1: '402, Shreeji Arcade, CG Road',
      line2: 'Navrangpura',
      city: 'Ahmedabad',
      state: 'Gujarat',
      pin: '380009',
    },
    orders: [
      { id: 'ORD-26-118204', invoice: 'EIMC/2026-27/000412', date: iso(start), item: 'Pro — monthly', period: [iso(start), iso(end)], amount: base, gst, total: base + gst, method: 'UPI Autopay', status: 'paid' },
      { id: 'ORD-26-117961', invoice: null, date: iso(trial), item: 'Pro — 3-day trial', period: [iso(trial), iso(trial.getTime() + 3 * DAY)], amount: 0, gst: 0, total: 0, method: '—', status: 'completed' },
    ],
    upcoming: { date: iso(end), item: 'Pro — monthly', amount: base, gst, total: base + gst },
    tickets: [
      { id: 'EIMC-1038', subject: 'Option chain greeks looked off on expiry day', category: 'Data & accuracy', status: 'resolved',
        created: iso(start.getTime() + 1 * DAY), updated: iso(start.getTime() + 2 * DAY),
        last: 'Fixed in v1.25.218.93: theta is now taken from the expiry-day session clock. Thanks for the screenshots.' },
    ],
    sessions: [
      { device: 'Chrome on Windows', where: 'Ahmedabad, IN', when: iso(t) },
      { device: 'EIMC Terminal on TRADING-PC', where: 'Ahmedabad, IN', when: iso(t - 35 * 60e3) },
      { device: 'Safari on iPhone', where: 'Ahmedabad, IN', when: iso(t - 2 * DAY) },
    ],
    prefs: {
      renewal: true,
      invoices: true,
      product: true,
      setups: false,
      offers: false,
    },
  };
}

/* the public board of feature requests (votes and statuses are made up) */
export const SEED_IDEAS = [
  { id: 'idea-layout', title: 'Multi-chart layouts (2×2, 1+3)', body: 'Watch NIFTY, BANKNIFTY and their futures side by side, each in its own mode.', status: 'planned', votes: 214, tag: 'Charts' },
  { id: 'idea-alerts', title: 'DQRS setup alerts on Telegram', body: 'Send a message when a setup arms or triggers, with the level and the stop.', status: 'review', votes: 167, tag: 'Setups' },
  { id: 'idea-mac', title: 'A macOS version', body: 'Native Apple Silicon build of the terminal.', status: 'considering', votes: 98, tag: 'Platform' },
  { id: 'idea-journal', title: 'Trade journal with screenshots', body: 'Log each trade with the chart as it was at entry and exit.', status: 'review', votes: 91, tag: 'Trading' },
  { id: 'idea-hotkeys', title: 'Custom keyboard shortcuts', body: 'Rebind every Alt+ shortcut.', status: 'shipped', votes: 143, tag: 'Terminal', shipped: 'v1.25.218' },
];
