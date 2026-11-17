'use strict';
/* ════════════════════════════════════════════════════════════════════
   Interaction layer.

   Eight behaviours, all opt-in from markup, all no-ops when their
   element is absent — so every page loads this one file safely:

     [data-field]      atmosphere canvas behind the hero
     .track            pointer-following wash (CSS does the painting)
     [data-countdown]  days / hours / minutes / seconds to a date
     [data-tabs]       scroll-synced feature switcher + media panel
     [data-lens]       magnifier that follows the pointer over media
     [data-ring]       SVG dial that fills when it scrolls into view
     [data-perks]      stacked blocks that light as they pass centre
     #topbar           floating pill bar that arrives after the hero

   Performance rules, the same ones the product follows: no shadowBlur,
   no CSS filter in a hot path, gradients cached and rebuilt only on
   resize, every rAF loop suspended the moment it leaves the viewport,
   and pointer handlers write CSS custom properties rather than styles
   so the compositor does the work.
   ════════════════════════════════════════════════════════════════════ */

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function debounce(fn, wait = 120) {
  let id;
  return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), wait); };
}

function onVisible(el, start, stop) {
  let running = false;
  const go = () => { if (!running && !document.hidden) { running = true; start(); } };
  const halt = () => { if (running) { running = false; stop(); } };
  new IntersectionObserver(es => es.forEach(e => (e.isIntersecting ? go() : halt())),
    { rootMargin: '80px 0px', threshold: 0 }).observe(el);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) halt();
    else { const r = el.getBoundingClientRect(); if (r.bottom > -200 && r.top < innerHeight + 200) go(); }
  });
}

/* ───────────────────────────────────────── 1. BLUE ATMOSPHERE ───
   Drifting blue-violet nebula over navy-black, with a fine dust field.
   Every blob's radial gradient is built once and rebuilt only on
   resize; alpha is set with globalAlpha, never by rebuilding colour
   strings. The pointer gives it a slight parallax. */
(function goldField() {
  const host = $('[data-field]');
  if (!host) return;
  const cv = document.createElement('canvas');
  host.appendChild(cv);
  const ctx = cv.getContext('2d', { alpha: true });

  // the product's own colours: accent blue, info cyan, violet, bull teal,
  // and two deep navies so the nebula never turns into a light show
  const TONES = [
    [76, 125, 255], [56, 189, 248], [139, 92, 246],
    [34, 211, 166], [40, 70, 180], [24, 34, 72],
  ];
  let W = 0, H = 0, dpr = 1, blobs = [], dust = [], t = 0, px = 0.5, py = 0.4, tx = 0.5, ty = 0.4;

  function build() {
    blobs = [];
    const n = W < 760 ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const tone = TONES[i % TONES.length];
      const b = {
        x: Math.random(), y: Math.random() * 0.85,
        r: (0.22 + Math.random() * 0.4) * Math.max(W, H),
        vx: (Math.random() - 0.5) * 0.000055,
        vy: (Math.random() - 0.5) * 0.000040,
        a: 0.1 + Math.random() * 0.2,
        depth: 0.3 + Math.random() * 0.9,
        tone,
      };
      b.g = grad(b);
      blobs.push(b);
    }
    dust = [];
    const dn = W < 760 ? 70 : 150;
    for (let i = 0; i < dn; i++) {
      dust.push({
        x: Math.random(), y: Math.random(),
        r: 0.3 + Math.random() * 1.1,
        a: 0.08 + Math.random() * 0.45,
        vy: -(0.000012 + Math.random() * 0.00005),
        tw: Math.random() * 6.28,
        depth: 0.2 + Math.random() * 1.2,
      });
    }
  }

  function grad(b) {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, b.r);
    const [r, gg, bl] = b.tone;
    g.addColorStop(0, `rgba(${r},${gg},${bl},1)`);
    g.addColorStop(0.35, `rgba(${r},${gg},${bl},.42)`);
    g.addColorStop(1, `rgba(${r},${gg},${bl},0)`);
    return g;
  }

  function resize() {
    const rect = host.getBoundingClientRect();
    dpr = Math.min(2, devicePixelRatio || 1);
    W = Math.max(1, rect.width); H = Math.max(1, rect.height);
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    px += (tx - px) * 0.045;
    py += (ty - py) * 0.045;
    const ox = (px - 0.5), oy = (py - 0.5);

    ctx.globalCompositeOperation = 'lighter';
    for (const b of blobs) {
      const x = (b.x + ox * 0.05 * b.depth) * W;
      const y = (b.y + oy * 0.04 * b.depth) * H;
      ctx.globalAlpha = b.a;
      ctx.translate(x, y);
      ctx.fillStyle = b.g;
      ctx.beginPath(); ctx.arc(0, 0, b.r, 0, 6.2832); ctx.fill();
      ctx.translate(-x, -y);
    }

    ctx.fillStyle = '#cfe0ff';
    for (const d of dust) {
      const x = (d.x + ox * 0.09 * d.depth) * W;
      const y = (d.y + oy * 0.07 * d.depth) * H;
      ctx.globalAlpha = d.a * (0.45 + 0.55 * Math.abs(Math.sin(t * 0.0009 + d.tw)));
      ctx.beginPath(); ctx.arc(x, y, d.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  let raf = null, prev = 0;
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = prev ? Math.min(64, now - prev) : 16;
    prev = now; t += dt;
    for (const b of blobs) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.x < -0.4) b.x = 1.4; if (b.x > 1.4) b.x = -0.4;
      if (b.y < -0.4) b.y = 1.3; if (b.y > 1.3) b.y = -0.4;
    }
    for (const d of dust) { d.y += d.vy * dt; if (d.y < -0.05) { d.y = 1.05; d.x = Math.random(); } }
    draw();
  }

  addEventListener('pointermove', e => {
    const r = host.getBoundingClientRect();
    tx = clamp((e.clientX - r.left) / Math.max(1, r.width), -0.3, 1.3);
    ty = clamp((e.clientY - r.top) / Math.max(1, r.height), -0.3, 1.3);
  }, { passive: true });

  new ResizeObserver(debounce(() => { resize(); draw(); }, 120)).observe(host);
  resize(); draw();
  if (!REDUCED) onVisible(host, () => { if (raf === null) { prev = 0; raf = requestAnimationFrame(loop); } },
                                () => { if (raf !== null) { cancelAnimationFrame(raf); raf = null; } });
})();

/* ─────────────────────────────────── 2. POINTER TRACKING ───
   Writes --mx / --my (percent) and --trk (0|1) on the host. All the
   painting is CSS, so a pointermove costs two property writes. */
(function track() {
  if (REDUCED) return;
  for (const el of $$('.track, .spot')) {
    let queued = false, mx = 50, my = 50;
    const apply = () => { queued = false; el.style.setProperty('--mx', mx + '%'); el.style.setProperty('--my', my + '%'); };
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      mx = ((e.clientX - r.left) / r.width) * 100;
      my = ((e.clientY - r.top) / r.height) * 100;
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    }, { passive: true });
    el.addEventListener('pointerenter', () => el.style.setProperty('--trk', '1'));
    el.addEventListener('pointerleave', () => el.style.setProperty('--trk', '0'));
  }
  // the hero's wash is on by default — it is the page's light source
  const hero = $('.hero.track');
  if (hero) hero.style.setProperty('--trk', '1');
})();

/* ───────────────────────────────────────────── 3. COUNTDOWN ───
   data-countdown="2026-12-15T00:00:00Z" on a container holding four
   [data-cd] cells (days, hours, minutes, seconds). Also fills any
   [data-cd-compact] with a single "16d 11:48:24" string. */
(function countdown() {
  const hosts = $$('[data-countdown]');
  const compacts = $$('[data-cd-compact]');
  if (!hosts.length && !compacts.length) return;

  const target = new Date(
    (hosts[0] || compacts[0]).dataset.countdown ||
    (hosts[0] || compacts[0]).dataset.cdCompact
  ).getTime();
  if (!Number.isFinite(target)) return;

  const pad = n => String(n).padStart(2, '0');

  function tick() {
    const left = Math.max(0, target - Date.now());
    const s = Math.floor(left / 1000);
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60), sec = s % 60;

    for (const host of hosts) {
      const cells = $$('[data-cd]', host);
      [d, h, m, sec].forEach((v, i) => {
        if (!cells[i]) return;
        const str = i === 0 ? String(v) : pad(v);
        if (cells[i].textContent !== str) cells[i].textContent = str;
      });
    }
    for (const c of compacts) {
      const str = `${d}d ${pad(h)}:${pad(m)}:${pad(sec)}`;
      if (c.textContent !== str) c.textContent = str;
    }
  }
  tick();
  setInterval(tick, 1000);
})();

/* ──────────────────────────── 4. SCROLL-SYNCED FEATURE TABS ───
   A vertical list whose active item follows the scroll position, with
   a media panel that cross-fades to match. Clicking a tab scrolls to
   it. Mirrors the reference's Iceberg / Stop Runs / Sweeps switcher. */
(function tabs() {
  for (const host of $$('[data-tabs]')) {
    const btns = $$('.ftab', host);
    const panes = $$('.ftab-panel', host);
    if (!btns.length) continue;

    // the single shared chart, if this switcher drives one
    const term = host.querySelector('.term');

    let active = -1;
    const set = i => {
      if (i === active) return;
      active = i;
      btns.forEach((b, n) => b.classList.toggle('on', n === i));
      panes.forEach((p, n) => p.classList.toggle('on', n === i));
      // Switching mode only re-tags the chart. The candles are never
      // redrawn, so the tape under every mode is the same pixels.
      const mode = btns[i].dataset.mode;
      if (mode) {
        host.dataset.mode = mode;
        if (term) {
          term.dataset.mode = mode;
          const name = term.querySelector('.term-mode-name');
          if (name) name.textContent = btns[i].querySelector('h3')?.textContent || '';
        }
      }
    };
    set(0);

    btns.forEach((b, i) => {
      b.addEventListener('click', () => {
        set(i);
        b.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
      });
      b.addEventListener('pointerenter', () => set(i));
    });

    if (REDUCED) continue;
    // whichever tab is nearest the viewport's middle wins
    let queued = false;
    const pick = () => {
      queued = false;
      const mid = innerHeight * 0.45;
      let best = 0, bestD = Infinity;
      btns.forEach((b, i) => {
        const r = b.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - mid);
        if (d < bestD) { bestD = d; best = i; }
      });
      set(best);
    };
    addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(pick); } }, { passive: true });
    pick();
  }
})();

/* ────────────────────────────────────── 5. MAGNIFIER LENS ───
   A circular loupe that follows the pointer across a media panel and
   shows a 2x clone of it, like the reference's zoomed footprint. */
(function lens() {
  if (REDUCED || matchMedia('(pointer: coarse)').matches) return;
  for (const host of $$('[data-lens]')) {
    const source = host.firstElementChild;
    if (!source) continue;
    const Z = +host.dataset.lens || 2.1, R = 95;

    const el = document.createElement('div');
    el.className = 'lens';
    const inner = document.createElement('div');
    inner.className = 'lens-inner';
    el.appendChild(inner);
    host.appendChild(el);

    let clone = null, queued = false, cx = 0, cy = 0;
    const sync = () => {
      clone = source.cloneNode(true);
      clone.style.pointerEvents = 'none';
      inner.innerHTML = '';
      const r = host.getBoundingClientRect();
      clone.style.width = r.width + 'px';
      inner.appendChild(clone);
    };
    sync();
    new ResizeObserver(debounce(sync, 160)).observe(host);

    const apply = () => {
      queued = false;
      el.style.setProperty('--lx', cx + 'px');
      el.style.setProperty('--ly', cy + 'px');
      inner.style.transform = `translate(${R - cx * Z}px, ${R - cy * Z}px) scale(${Z})`;
    };
    host.addEventListener('pointermove', e => {
      const r = host.getBoundingClientRect();
      cx = e.clientX - r.left; cy = e.clientY - r.top;
      if (!queued) { queued = true; requestAnimationFrame(apply); }
    }, { passive: true });
    host.addEventListener('pointerenter', () => { el.style.setProperty('--lo', '1'); el.style.setProperty('--ls', '1'); });
    host.addEventListener('pointerleave', () => { el.style.setProperty('--lo', '0'); el.style.setProperty('--ls', '.6'); });
  }
})();

/* ─────────────────────────────────────────── 6. RING GAUGE ───
   data-ring="78" fills to 78% of the circle when it scrolls in, and
   counts the number in the middle up to match. */
(function rings() {
  for (const host of $$('[data-ring]')) {
    const pct = clamp(+host.dataset.ring || 0, 0, 100);
    const fill = $('.ring-fill', host);
    const out = $('[data-ring-val]', host);
    if (!fill) continue;
    const r = +fill.getAttribute('r');
    const C = 2 * Math.PI * r;
    fill.style.strokeDasharray = `${C} ${C}`;
    fill.style.strokeDashoffset = C;

    const run = () => {
      fill.style.strokeDashoffset = String(C * (1 - pct / 100));
      if (!out) return;
      const to = +out.dataset.ringVal || pct, t0 = performance.now(), dur = 1500;
      const step = now => {
        const k = Math.min(1, (now - t0) / dur);
        out.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if (REDUCED) { fill.style.transition = 'none'; run(); continue; }
    const io = new IntersectionObserver(es => es.forEach(e => {
      if (e.isIntersecting) { io.unobserve(e.target); run(); }
    }), { threshold: 0.35 });
    io.observe(host);
  }
})();

/* ───────────────────────────────── 7. SCROLL-LIT PERK BLOCKS ───
   The stacked copy beside the ring: whichever block is nearest the
   middle of the viewport is at full opacity, the rest recede. */
(function perks() {
  const host = $('[data-perks]');
  if (!host || REDUCED) return;
  const items = $$('.perk', host);
  if (items.length < 2) return;
  let queued = false;
  const pick = () => {
    queued = false;
    const mid = innerHeight * 0.45;
    let best = 0, bestD = Infinity;
    items.forEach((el, i) => {
      const r = el.getBoundingClientRect();
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestD) { bestD = d; best = i; }
    });
    items.forEach((el, i) => el.classList.toggle('on', i === best));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(pick); } }, { passive: true });
  pick();
})();

/* ──────────────────────────────────── 8. FLOATING TOP BAR ───
   Arrives once the hero is behind you, the way the reference's pill
   bar does. Writes the class only when the boolean flips. */
(function topbar() {
  const bar = $('#topbar');
  if (!bar) return;
  const trigger = () => ($('.hero') || $('.phead') || { offsetHeight: 400 }).offsetHeight * 0.75;
  let shown = false, queued = false, at = trigger();
  addEventListener('resize', debounce(() => { at = trigger(); }, 200));
  const read = () => {
    queued = false;
    const want = scrollY > at;
    if (want !== shown) { shown = want; bar.classList.toggle('in', shown); }
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(read); } }, { passive: true });
  read();
})();

export { $, $$, REDUCED, debounce, onVisible };
