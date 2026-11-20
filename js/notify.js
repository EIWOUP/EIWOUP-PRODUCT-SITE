'use strict';
/* ════════════════════════════════════════════════════════════════════
   Notifications in the header: a bell next to the account button, a
   panel of messages from the EIMC team (sent from EIMC-Admin), and
   pop-downs for unread ones.

   Pop-down rules
   - only unread messages from the last 7 days, the 3 most recent;
   - they drop out of the bell, stay 3 seconds, then leave;
   - the cycle repeats every 30 minutes (across pages, per customer)
     until the customer opens the bell or Account → Notifications,
     which marks them read;
   - a message that arrives while the page is open pops at once.
   ════════════════════════════════════════════════════════════════════ */

import { api } from '/js/auth.js';

const WEEK = 7 * 864e5;
const CYCLE = 30 * 60e3;        // repeat the pop-down every 30 minutes
const SHOW = 3000;              // each pop-down stays 3 seconds
const POLL = 5 * 60e3;          // look for new messages every 5 minutes
const MAX_POP = 3;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ago = d => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  const n = Math.round(s / 86400);
  return n === 1 ? 'yesterday' : n < 7 ? `${n} days ago`
    : new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
};
const get = k => { try { return localStorage.getItem(k); } catch { return null; } };
const put = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: cycle per page only */ } };

const BELL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>';
const MAIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>';
const CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>';

let notes = [];
let who = 'me';
let root, btn, pop, list, badge, stack;

const unread = () => notes.filter(n => !n.read);
const lastKey = () => `eimc.ntf.last.${who}`;
const seenKey = () => `eimc.ntf.seen.${who}`;

/** Called by js/site.js with the account the header already loaded. */
export function mountNotifications(account) {
  const user = document.querySelector('.nav-user');
  const acct = user?.querySelector('[data-acct]');
  if (!user || !acct || root) return;
  who = account?.profile?.clientId || 'me';
  notes = account?.notifications || [];

  root = document.createElement('div');
  root.className = 'ntf';
  root.innerHTML = `
    <button type="button" class="ntf-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="Notifications">${BELL}<i class="ntf-badge" aria-hidden="true"></i></button>
    <div class="ntf-pop" role="dialog" aria-label="Notifications">
      <div class="ntf-h"><b>Notifications</b><button type="button" class="ntf-all" data-ntf-read>Mark all read</button></div>
      <ul class="ntf-list"></ul>
      <a class="ntf-foot" href="account.html#notifications">See all in your account <span aria-hidden="true">&rarr;</span></a>
    </div>`;
  acct.before(root);
  btn = root.querySelector('.ntf-btn');
  pop = root.querySelector('.ntf-pop');
  list = root.querySelector('.ntf-list');
  badge = root.querySelector('.ntf-badge');

  stack = document.createElement('div');
  stack.className = 'ntf-stack';
  stack.setAttribute('aria-live', 'polite');
  document.body.append(stack);

  btn.addEventListener('click', e => { e.stopPropagation(); root.classList.contains('open') ? close() : open(); });
  root.querySelector('[data-ntf-read]').addEventListener('click', () => markRead());
  document.addEventListener('click', e => { if (!root.contains(e.target)) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  // the account page marks them read when its Notifications section opens
  addEventListener('eimc:notes-read', e => { if (e.detail?.from === 'bell') return; notes.forEach(n => { n.read = true; }); render(); });

  render();
  put(seenKey(), JSON.stringify(notes.map(n => n.id)));
  maybePop();
  setInterval(maybePop, 60e3);           // the 30-minute cycle, checked each minute
  setInterval(poll, POLL);
}

function render() {
  const n = unread().length;
  badge.textContent = n > 9 ? '9+' : n || '';
  root.classList.toggle('has', n > 0);
  btn.setAttribute('aria-label', n ? `Notifications, ${n} unread` : 'Notifications');
  root.querySelector('[data-ntf-read]').hidden = !n;
  list.innerHTML = notes.length ? notes.slice(0, 8).map(x => `
    <li class="${x.read ? '' : 'new'}"><span class="ntf-ic">${x.channel === 'push' ? CHAT : MAIL}</span>
      <div><b>${esc(x.title)}</b>${x.body ? `<p>${esc(x.body)}</p>` : ''}<span>${ago(x.created)}</span></div></li>`).join('')
    : '<li class="ntf-empty">You are all caught up.</li>';
}

function open() {
  root.classList.add('open');
  btn.setAttribute('aria-expanded', 'true');
  clearStack();
  if (unread().length) markRead();      // seeing the list counts as reading it
}
function close() {
  if (!root?.classList.contains('open')) return;
  root.classList.remove('open');
  btn.setAttribute('aria-expanded', 'false');
}

async function markRead() {
  if (!unread().length) return;
  try { await api.markNotificationsRead(); } catch { return; }
  // keep the "new" dots visible while the panel is open; the badge clears now
  badge.textContent = ''; root.classList.remove('has');
  root.querySelector('[data-ntf-read]').hidden = true;
  notes.forEach(n => { n.read = true; });
  dispatchEvent(new CustomEvent('eimc:notes-read', { detail: { from: 'bell' } }));
}

/* ── pop-downs ─────────────────────────────────────────────────────── */
function due() {
  return unread().filter(n => Date.now() - new Date(n.created) < WEEK)
    .sort((a, b) => new Date(b.created) - new Date(a.created)).slice(0, MAX_POP);
}

function maybePop(force = false) {
  if (root.classList.contains('open') || document.hidden) return;
  const items = due();
  if (!items.length) return;
  const last = +get(lastKey()) || 0;
  if (!force && Date.now() - last < CYCLE) return;
  put(lastKey(), String(Date.now()));
  show(items);
}

async function poll() {
  if (document.hidden) return;
  try {
    const a = await api.account();
    const seen = new Set(JSON.parse(get(seenKey()) || '[]'));
    notes = a.notifications || [];
    render();
    const fresh = unread().some(n => !seen.has(n.id));
    put(seenKey(), JSON.stringify(notes.map(n => n.id)));
    if (fresh) maybePop(true);           // something new arrived: pop at once
  } catch { /* offline or signed out: try again next time */ }
}

function clearStack() { stack.querySelectorAll('.ntf-toast').forEach(t => leave(t)); }

function show(items) {
  clearStack();
  const r = btn.getBoundingClientRect();
  stack.style.top = `${Math.round(r.bottom + 14)}px`;
  const edge = root.parentElement.getBoundingClientRect().right;   // line up with the account button's edge
  stack.style.right = `${Math.max(16, Math.round(innerWidth - edge))}px`;
  stack.style.setProperty('--bell-x', `${Math.round(r.left + r.width / 2)}px`);
  items.forEach((n, i) => {
    const t = document.createElement('a');
    t.className = 'ntf-toast';
    t.href = 'account.html#notifications';
    t.style.setProperty('--i', i);
    t.innerHTML = `<span class="ntf-ic">${n.channel === 'push' ? CHAT : MAIL}</span>
      <div><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ''}<span>${ago(n.created)} &middot; EIMC</span></div>
      <i class="ntf-life" aria-hidden="true"></i>`;
    stack.append(t);
    // origin of the drop: the bell, measured from this toast's own box
    const b = t.getBoundingClientRect();   // forces layout, so the start state is painted before .in
    t.style.setProperty('--ox', `${Math.round(r.left + r.width / 2 - b.left)}px`);
    setTimeout(() => t.classList.add('in'), 30 + (REDUCED ? 0 : i * 140));
    setTimeout(() => leave(t), SHOW + (REDUCED ? 0 : i * 140));
  });
  if (!REDUCED) { btn.classList.remove('ring'); void btn.offsetWidth; btn.classList.add('ring'); }
}

function leave(t) {
  if (t.classList.contains('out')) return;
  t.classList.add('out');
  setTimeout(() => t.remove(), 420);
}
