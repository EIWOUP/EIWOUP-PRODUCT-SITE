'use strict';
/* ════════════════════════════════════════════════════════════════════
   Shared site behaviour: nav, scroll reveal, count-ups, and mounting
   the product UI replicas.

   Loads BEFORE js/fx.js on every page, because fx.js's magnifier
   clones whatever mountUI() has put on the page.
   ════════════════════════════════════════════════════════════════════ */

import { mountUI } from '/js/ui.js';
import { mountHeader } from '/js/auth.js';
import { mountThemeToggle } from '/js/theme-toggle.js';
import { mountNotifications } from '/js/notify.js';
import { mountNotices } from '/js/notices.js';

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

mountUI();
mountHeader().then(a => { if (a) mountNotifications(a); });
mountThemeToggle();
mountNotices();

/* ── live Pro price in the page text ─────────────────────────────────
   <span data-price="pro">299</span> and data-price="pro-list" are filled
   from the database prices (js/pricing-data.js -> /api/plans), so an
   admin price change reaches the copy too. Loaded without blocking. */
if (document.querySelector('[data-price], [data-price-count]')) {
  import('/js/pricing-data.js').then(({ planById, inr }) => {
    const pro = planById('pro');
    if (!pro) return;
    const val = { pro: pro.monthly, 'pro-list': pro.listPrice || pro.monthly };
    $$('[data-price]').forEach(n => { const v = val[n.dataset.price]; if (v != null) n.textContent = inr(v); });
    $$('[data-price-count]').forEach(n => {
      const v = val[n.dataset.priceCount];
      if (v != null) { n.dataset.count = String(v); n.textContent = inr(v); }
    });
  }).catch(() => { /* keep the printed prices */ });
}

/* ── nav ─────────────────────────────────────────────────────────── */
(function nav() {
  const bar = $('#nav');
  if (!bar) return;

  const burger = $('#burger');
  if (burger) {
    burger.addEventListener('click', e => { e.stopPropagation(); bar.classList.toggle('open'); });
    $$('.nav-links a', bar).forEach(a => a.addEventListener('click', () => bar.classList.remove('open')));
    document.addEventListener('click', e => { if (!bar.contains(e.target)) bar.classList.remove('open'); });
    addEventListener('keydown', e => { if (e.key === 'Escape') bar.classList.remove('open'); });
  }

  // stays at the top: hides while scrolling down, comes back on any scroll up
  let lastY = scrollY, queued = false;
  const onScroll = () => {
    queued = false;
    const y = Math.max(0, scrollY), dy = y - lastY;
    bar.classList.toggle('stuck', y > 8);
    if (y < 90 || bar.classList.contains('open')) bar.classList.remove('hid');
    else if (dy > 4) bar.classList.add('hid');
    else if (dy < -4) bar.classList.remove('hid');
    if (Math.abs(dy) > 4 || y < 90) lastY = y;
    document.body.classList.toggle('nav-up', !bar.classList.contains('hid'));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
  $$('.nav-links a', bar).forEach(a => {
    const href = (a.getAttribute('href') || '').split('#')[0].split('/').pop().toLowerCase();
    if (href && href === here) a.classList.add('on');
  });
})();

/* ── reveal on scroll ────────────────────────────────────────────── */
(function reveal() {
  if (REDUCED) return;
  const els = $$('[data-rv], .band > .wrap > *, .row, .proof > div, .plan, .fig, .step');
  if (!els.length) return;
  els.forEach(el => el.classList.add('rv'));
  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { threshold: 0.06, rootMargin: '0px 0px -60px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ── count-ups in the stat strip ─────────────────────────────────── */
(function counters() {
  const els = $$('[data-count]');
  if (!els.length || REDUCED) return;
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target, t0 = performance.now(), dur = 1100;
    const dp = (el.dataset.dp | 0);
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur);
      const to = parseFloat(el.dataset.count);   // read each frame: a live price can arrive mid-count
      el.textContent = (to * (1 - Math.pow(1 - k, 3)))
        .toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }), { threshold: 0.5 });
  els.forEach(el => io.observe(el));
})();

/* ── footer year ─────────────────────────────────────────────────── */
$$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });


export { $, $$, REDUCED };
