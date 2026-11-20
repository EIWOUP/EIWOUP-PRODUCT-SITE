'use strict';
/* ════════════════════════════════════════════════════════════════════
   Customer sign-in and the account data behind it.

   EVERYTHING the pages know about a customer comes through the
   `backend` object below. On the live site that is `httpBackend`: the
   /api functions (api/*.js) check the password against the PostgreSQL
   database and keep the session in an HttpOnly cookie. login.js,
   account.js and the header never touch storage or data directly.
   ════════════════════════════════════════════════════════════════════ */

const KEY = 'eimc.session';
const store = s => { try { return s === 'local' ? localStorage : sessionStorage; } catch { return null; } };

export class AuthError extends Error {
  constructor(message, code = 'auth') { super(message); this.code = code; }
}

/* ── the real backend: /api functions on Vercel, PostgreSQL behind them ──
   The password is checked on the server. The proof of login is an
   HttpOnly cookie (eimc_sid) that page scripts cannot read; the
   `eimc.session` entry in storage only remembers "this browser is signed
   in" so pages can redirect without a round trip. */
async function request(path, opts = {}) {
  let res;
  try {
    res = await fetch(path, {
      credentials: 'same-origin',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      ...opts,
    });
  } catch {
    throw new AuthError('Could not reach the server. Check your internet connection and try again.', 'network');
  }
  let data = null;
  try { data = await res.json(); } catch { /* empty or not JSON */ }
  if (!res.ok) {
    if (res.status === 401 && data?.code === 'expired') clearLocal();
    throw new AuthError(data?.error || 'Something went wrong. Try again.', data?.code || (res.status === 429 ? 'locked' : 'auth'));
  }
  return data;
}
const act = (action, ...args) => request('/api/account', { method: 'POST', body: JSON.stringify({ action, args }) });

const httpBackend = {
  async signIn(id, password, remember) {
    const r = await request('/api/login', { method: 'POST', body: JSON.stringify({ id, password, remember: !!remember }) });
    return { token: 'cookie', userId: r.userId, name: r.name, issued: Date.now(), serverExpires: r.expires };
  },
  async signOut() { await request('/api/logout', { method: 'POST', body: '{}' }); },
  account: () => request('/api/account'),
  saveProfile: (s, p) => act('saveProfile', p),
  savePrefs: (s, p) => act('savePrefs', p),
  saveBilling: (s, b) => act('saveBilling', b),
  setDefaultMethod: (s, id) => act('setDefaultMethod', id),
  setCancel: (s, cancel, reason) => act('setCancel', !!cancel, reason || ''),
  removeDevice: (s, id) => act('removeDevice', id),
  createTicket: (s, t) => act('createTicket', t),
  submitIdea: (s, i) => act('submitIdea', i),
  vote: (s, id, on) => act('vote', id, !!on),
  changePassword: (s, current, next) => act('changePassword', current, next),
  markNotificationsRead: () => act('markNotificationsRead'),
};

const backend = httpBackend;

function clearLocal() {
  for (const k of ['local', 'session']) { try { store(k)?.removeItem(KEY); } catch { /* fine */ } }
  document.documentElement.classList.remove('signed-in');
}

/* ── session ─────────────────────────────────────────────────────── */
const SESSION_DAYS = 30;

export function session() {
  for (const s of ['local', 'session']) {
    try {
      const v = JSON.parse(store(s)?.getItem(KEY));
      if (v && v.token === 'cookie' && (!v.expires || v.expires > Date.now())) return v;
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
    const s = await backend.signIn(String(id).trim(), String(password), remember);
    tries.n = 0;
    const v = { ...s, expires: remember ? (s.serverExpires || Date.now() + SESSION_DAYS * 864e5) : null };
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
  try { if (s) await backend.signOut(s); } catch { /* still forget it locally */ } finally {
    clearLocal();
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
  ['account', 'saveProfile', 'savePrefs', 'saveBilling', 'setDefaultMethod', 'setCancel',
    'removeDevice', 'createTicket', 'submitIdea', 'vote', 'changePassword', 'markNotificationsRead'].map(n => [n, call(n)]));

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
  if (!signedIn()) return null;
  try {
    const a = await api.account();
    box.querySelectorAll('[data-acct-initials]').forEach(n => { n.textContent = initials(a.profile.name); });
    box.querySelectorAll('[data-acct-name]').forEach(n => { n.textContent = a.profile.name; });
    box.querySelectorAll('[data-acct-id]').forEach(n => { n.textContent = `Client ID ${a.profile.clientId}`; });
    box.querySelectorAll('[data-acct-plan]').forEach(n => { n.textContent = a.subscription.planName; });
    return a;
  } catch { return null; /* the menu still works without the name */ }
}

export const initials = name => (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
