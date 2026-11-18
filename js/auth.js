'use strict';
/* ════════════════════════════════════════════════════════════════════
   Customer sign-in and the account data behind it.

   EVERYTHING the pages know about a customer comes through the
   `backend` object below. Today that is a dummy backend that runs in the
   browser with one demo customer (client ID 2222004, a one-month Pro
   subscription). When the online database is ready, replace
   `dummyBackend` with an API client that has the same method names and
   returns the same shapes. login.js, account.js and the header never
   touch storage or data directly, so nothing else has to change.

   ⚠ The dummy check is NOT security. Anyone can read this file. The real
   backend must check the password on the server, return a short-lived
   token (HTTP-only cookie preferred), and send the account data only to
   a valid token. Do not put real customer data in this file.
   ════════════════════════════════════════════════════════════════════ */

import { DEMO_ID, DEMO_PASSWORD, demoAccount, SEED_IDEAS } from '/js/account-data.js';

const KEY = 'eimc.session';
const LOCAL = id => `eimc.demo.${id}`;          // the dummy backend's own "database"
const wait = ms => new Promise(r => setTimeout(r, ms));
const store = s => { try { return s === 'local' ? localStorage : sessionStorage; } catch { return null; } };

export class AuthError extends Error {
  constructor(message, code = 'auth') { super(message); this.code = code; }
}

/* ── the dummy backend: same shape as the future API ─────────────── */
function readDb(id) {
  try { return JSON.parse(localStorage.getItem(LOCAL(id))) || {}; } catch { return {}; }
}
function writeDb(id, patch) {
  const db = { ...readDb(id), ...patch };
  try { localStorage.setItem(LOCAL(id), JSON.stringify(db)); } catch { /* storage full or blocked */ }
  return db;
}

const dummyBackend = {
  async signIn(id, password) {
    await wait(700);                                  // a real request takes a moment too
    if (id !== DEMO_ID || password !== DEMO_PASSWORD) throw new AuthError('That client ID and password do not match.');
    return { token: `demo.${Math.random().toString(36).slice(2)}`, userId: id, issued: Date.now() };
  },
  async signOut() { await wait(150); },
  async account(session) {
    await wait(260);
    const db = readDb(session.userId);
    const a = demoAccount(new Date());
    Object.assign(a.profile, db.profile || {});
    Object.assign(a.prefs, db.prefs || {});
    if (db.billing) Object.assign(a.billing, db.billing);
    if (db.cancelAtPeriodEnd != null) a.subscription.cancelAtPeriodEnd = db.cancelAtPeriodEnd;
    if (db.cycleNext) a.subscription.cycleNext = db.cycleNext;
    if (db.defaultMethod) a.methods.forEach(m => { m.default = m.id === db.defaultMethod; });
    if (db.removedDevices) a.devices = a.devices.filter(d => !db.removedDevices.includes(d.id));
    a.tickets = [...(db.tickets || []), ...a.tickets];
    a.ideas = mergeIdeas(db);
    a.sessions[0].current = true;
    return a;
  },
  async saveProfile(session, profile) { await wait(400); writeDb(session.userId, { profile }); return profile; },
  async savePrefs(session, prefs) { await wait(200); writeDb(session.userId, { prefs }); return prefs; },
  async saveBilling(session, billing) { await wait(400); writeDb(session.userId, { billing }); return billing; },
  async setDefaultMethod(session, id) { await wait(300); writeDb(session.userId, { defaultMethod: id }); },
  async setCancel(session, cancel, reason) { await wait(600); writeDb(session.userId, { cancelAtPeriodEnd: cancel, cancelReason: reason || null }); },
  async setNextCycle(session, cycle) { await wait(500); writeDb(session.userId, { cycleNext: cycle }); },
  async removeDevice(session, id) {
    await wait(400);
    const db = readDb(session.userId);
    writeDb(session.userId, { removedDevices: [...(db.removedDevices || []), id] });
  },
  async createTicket(session, t) {
    await wait(650);
    const db = readDb(session.userId);
    const n = 1042 + (db.tickets || []).length;
    const ticket = { id: `EIMC-${n}`, ...t, status: 'open', created: new Date().toISOString(), updated: new Date().toISOString() };
    writeDb(session.userId, { tickets: [ticket, ...(db.tickets || [])] });
    return ticket;
  },
  async submitIdea(session, idea) {
    await wait(500);
    const db = readDb(session.userId);
    const mine = { id: `idea-${Date.now()}`, ...idea, status: 'new', votes: 1, mine: true, created: new Date().toISOString() };
    writeDb(session.userId, { ideas: [mine, ...(db.ideas || [])], voted: [...(db.voted || []), mine.id] });
    return mine;
  },
  async vote(session, id, on) {
    await wait(120);
    const db = readDb(session.userId);
    const voted = new Set(db.voted || []);
    on ? voted.add(id) : voted.delete(id);
    writeDb(session.userId, { voted: [...voted] });
  },
  async changePassword(session, current, next) {
    await wait(700);
    if (current !== DEMO_PASSWORD) throw new AuthError('Your current password is not right.', 'password');
    if (next.length < 8) throw new AuthError('Use at least 8 characters.', 'password');
    // the demo login keeps working with 2222004: nothing is stored
  },
};

function mergeIdeas(db) {
  const voted = new Set(db.voted || []);
  return [...(db.ideas || []), ...SEED_IDEAS.map(i => ({ ...i }))]
    .map(i => ({ ...i, voted: voted.has(i.id), votes: i.votes + (voted.has(i.id) && !i.mine ? 1 : 0) }));
}

/* Swap this line for the real API client when the database is online. */
const backend = dummyBackend;

/* ── session ─────────────────────────────────────────────────────── */
const SESSION_DAYS = 30;

export function session() {
  for (const s of ['local', 'session']) {
    try {
      const v = JSON.parse(store(s)?.getItem(KEY));
      if (v && v.token && (!v.expires || v.expires > Date.now())) return v;
    } catch { /* corrupt or blocked */ }
  }
  return null;
}
export const signedIn = () => !!session();

// failed attempts: slow down guessing (the real server must enforce this too)
const tries = { n: 0, until: 0 };
export function lockedFor() { return Math.max(0, tries.until - Date.now()); }

export async function signIn(id, password, remember) {
  if (lockedFor()) throw new AuthError('Too many attempts. Wait a moment and try again.', 'locked');
  try {
    const s = await backend.signIn(String(id).trim(), String(password));
    tries.n = 0;
    const v = { ...s, expires: remember ? Date.now() + SESSION_DAYS * 864e5 : null };
    store(remember ? 'local' : 'session')?.setItem(KEY, JSON.stringify(v));
    document.documentElement.classList.add('signed-in');
    return v;
  } catch (e) {
    if (++tries.n >= 5) { tries.until = Date.now() + 30000; tries.n = 0; }
    throw e;
  }
}

export async function signOut() {
  const s = session();
  try { if (s) await backend.signOut(s); } finally {
    for (const k of ['local', 'session']) { try { store(k)?.removeItem(KEY); } catch { /* fine */ } }
    document.documentElement.classList.remove('signed-in');
  }
}

/* every account call goes through here: no session, no data */
function call(name) {
  return (...args) => {
    const s = session();
    if (!s) return Promise.reject(new AuthError('Your session has ended. Please log in again.', 'expired'));
    return backend[name](s, ...args);
  };
}
export const api = Object.fromEntries(
  ['account', 'saveProfile', 'savePrefs', 'saveBilling', 'setDefaultMethod', 'setCancel', 'setNextCycle',
    'removeDevice', 'createTicket', 'submitIdea', 'vote', 'changePassword'].map(n => [n, call(n)]));

/* only same-site paths are allowed as a place to return to after logging in */
export function safeNext(raw, fallback = 'account.html') {
  if (!raw || !/^[a-z0-9_-]+\.html(#[a-z0-9-]*)?$/i.test(raw)) return fallback;
  return raw;
}

/* ── the header: Log in, or the account menu ─────────────────────── */
export async function mountHeader() {
  const box = document.querySelector('[data-acct]');
  if (!box) return;
  const btn = box.querySelector('.acct-btn');
  const pop = box.querySelector('.acct-pop');
  const close = () => { box.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const on = box.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(on));
  });
  document.addEventListener('click', e => { if (!box.contains(e.target)) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  pop.querySelector('[data-logout]')?.addEventListener('click', async () => {
    await signOut();
    location.href = 'index.html';
  });
  if (!signedIn()) return;
  try {
    const a = await api.account();
    box.querySelectorAll('[data-acct-initials]').forEach(n => { n.textContent = initials(a.profile.name); });
    box.querySelectorAll('[data-acct-name]').forEach(n => { n.textContent = a.profile.name; });
    box.querySelectorAll('[data-acct-id]').forEach(n => { n.textContent = `Client ID ${a.profile.clientId}`; });
    box.querySelectorAll('[data-acct-plan]').forEach(n => { n.textContent = a.subscription.planName; });
  } catch { /* the menu still works without the name */ }
}

export const initials = name => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
