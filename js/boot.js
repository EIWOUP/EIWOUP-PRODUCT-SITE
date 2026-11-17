'use strict';
/* ════════════════════════════════════════════════════════════════════
   The boot splash, wired into the website.

   IT PLAYS ONCE. The first page a visitor lands on gets the full F1
   sequence; every page they open after that shows no splash at all —
   not a shorter one, none. Navigating home → features → pricing never
   interrupts them again.

   How "once" is enforced, in two layers:

     1. An inline script in each page's <head> (before any stylesheet)
        reads the same flag and puts .booted on <html>, which hides
        .boot in CSS. This runs before the first paint, so a repeat
        page never even flashes the dark splash for a frame.
     2. This module then removes #boot from the DOM entirely and mounts
        the marks directly, so bootSplash() is never called.

   Nothing in /static/js is modified. Everything called here is the
   product's own code, byte-for-byte.
   ════════════════════════════════════════════════════════════════════ */

import { bootSplash, logoHTML, faviconURL, Logo } from '/static/js/logo.js';

/* Change SCOPE to 'ever' to show the splash only once per browser,
   instead of once per browsing session. The inline <head> script checks
   both stores, so nothing else needs changing. */
const KEY = 'eimc.boot.seen';
const SCOPE = 'session';              // 'session' | 'ever'

function flag() {
  try { return SCOPE === 'ever' ? localStorage : sessionStorage; } catch { return null; }
}
function alreadySeen() {
  try {
    return sessionStorage.getItem(KEY) === '1' || localStorage.getItem(KEY) === '1';
  } catch { return false; }       // private mode / storage blocked: treat as first visit
}
function markSeen() {
  try { flag()?.setItem(KEY, '1'); } catch { /* storage blocked; the splash just plays again */ }
}

/* The real generated favicon — the sheet, the bands, the journey, the tip. */
try {
  const link = document.querySelector('link[rel="icon"]');
  if (link) link.href = faviconURL();
} catch { /* a favicon is never worth breaking a page over */ }

/* The mark in the nav bar. On the first page it is the element the
   splash's mark flies into, so it must exist before lights out. */
const navHost = document.getElementById('nav-mark');
let navLogo = null;
if (navHost) {
  navHost.innerHTML = logoHTML({ size: 26, boot: false });
  navLogo = new Logo(navHost, { defer: true });
  navHost.addEventListener('mouseenter', () => navLogo?.replay());
}

/* Work that happens once the terminal is visible, on either path. */
function afterBoot({ animateHero }) {
  navLogo?.wake();

  const heroHost = document.getElementById('hero-mark');
  if (heroHost) {
    const size = +heroHost.dataset.size || 240;
    heroHost.innerHTML = logoHTML({ size, boot: animateHero, tempo: 1 });
    const heroLogo = new Logo(heroHost);
    heroHost.addEventListener('mouseenter', () => heroLogo.replay());
  }

  document.body.classList.add('booted');
}

if (alreadySeen()) {
  /* ── Seen it already: no splash, no delay, no flash. ───────────── */
  document.getElementById('boot')?.remove();
  document.body.classList.remove('booting');
  document.documentElement.classList.add('booted');     // in case the inline script was blocked
  afterBoot({ animateHero: false });
} else {
  /* ── First page of the session: play it in full. ───────────────── */
  markSeen();                       // set now, not at the end: navigating away
                                    // mid-animation must not replay it on the next page
  const splash = bootSplash(navHost);
  splash.status(document.body.dataset.bootStatus || 'Opening the paper…');

  // The lights only go out once done() is called.
  const ready = () => splash.done();
  if (document.readyState === 'complete') ready();
  else addEventListener('load', ready, { once: true });

  splash.onClose(() => afterBoot({ animateHero: true }));
}
