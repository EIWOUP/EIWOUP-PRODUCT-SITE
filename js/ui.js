'use strict';
/* ════════════════════════════════════════════════════════════════════
   The product's interface, rebuilt in HTML and SVG.

   ONE 16:9 chart. ONE candle series. Four overlays.

   The candles are drawn once and never redrawn — switching mode only
   fades an overlay group in or out, so the price action you are
   looking at is literally the same pixels in every mode. That is the
   whole point: you see what each mode ADDS to a chart you already
   understand, which is what using the terminal actually feels like.

   Every overlay is DERIVED FROM THE CANDLES, not drawn on top of them
   at arbitrary places:
     · the volume profile is accumulated from each candle's range,
       and the POC, HVN and LVN fall out of that histogram
     · the heat walls sit at the two prices the story actually turns
       on, and are consumed at the candle that eats them
     · BOS, CHoCH, the sweep, the order blocks and the fair-value gap
       are found by scanning the series
     · delta comes from where each candle closed inside its own range

   The price path is scripted rather than random, and tells the story
   the product was built to read: drift down, sweep the pool below,
   reverse, break the wall above, retest it, make a new high.
   ════════════════════════════════════════════════════════════════════ */

/* ── palette: the product's own ──────────────────────────────────── */
const C = {
  bull: '#089981', bullHi: '#22d3a6', bullDim: 'rgba(8,153,129,.45)',
  bear: '#f23645', bearHi: '#ff6b78', bearDim: 'rgba(242,54,69,.45)',
  gold: '#c98a3e', goldHi: '#e8b27a', amber: '#ffb74d', orange: '#ff9800',
  violet: '#c084fc', pink: '#f472b6', cyan: '#22d3ee', blue: '#38bdf8',
  mint: '#5effc4', bone: '#eef1f7', smoke: '#8691a5', ash: '#5b6578',
  grid: 'rgba(134,145,165,.06)',
};
const MONO = 'JetBrains Mono, ui-monospace, monospace';

/* ── geometry (16:9) ─────────────────────────────────────────────── */
const W = 1280, H = 720;
const PL = 10, PR = 1180;        // price plot, x
const PT = 26, PB = 548;         // price plot, y
const QT = 586, QB = 682;        // lower pane (volume / delta)
const TXY = 706;                 // time axis baseline

/* ── the scripted series ─────────────────────────────────────────── */
function series() {
  let s = 20261110;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const j = m => (rnd() - 0.5) * m;

  const out = [];
  let p = 24868;
  const push = (close, wu = 7, wd = 7, volk = 1) => {
    const o = p, c = close;
    const hi = Math.max(o, c) + wu + Math.abs(j(6));
    const lo = Math.min(o, c) - wd - Math.abs(j(6));
    const rng = hi - lo;
    // volume tracks range and conviction, with a floor so nothing is empty
    const v = (0.4 + rng / 34 + Math.abs(c - o) / 26) * volk * (0.85 + rnd() * 0.3);
    out.push({ o, c, h: hi, l: lo, v });
    p = c;
  };

  for (let i = 0; i < 13; i++) push(p - 9 + j(16));              // drift down
  for (let i = 0; i < 3; i++) push(p - 16 + j(8), 5, 16);        // probe the pool
  push(p - 34, 4, 48, 2.6);                                      // 16 · THE SWEEP
  push(p + 31, 11, 6, 2.2);                                      // 17 · close back inside
  for (let i = 0; i < 12; i++) push(p + 13 + j(15), 8, 6, 1.15); // 18-29 · rally
  for (let i = 0; i < 4; i++) push(p + 5 + j(10), 17, 5, 1.5);   // 30-33 · absorbed at the wall
  push(p + 30, 7, 5, 2.4);                                       // 34 · BOS
  push(p + 18, 8, 5, 1.4);                                       // 35
  for (let i = 0; i < 8; i++) push(p - 8 + j(12), 7, 9);         // 36-43 · pull back
  for (let i = 0; i < 4; i++) push(p + 3 + j(9), 7, 10);         // 44-47 · it holds
  for (let i = 0; i < 14; i++) push(p + 12 + j(14), 9, 6, 1.1);  // 48-61 · new high
  return out;
}

/* ── structure found by scanning the series ─────────────────────── */
function structure(cd) {
  const lowIn = (a, b) => { let m = Infinity, k = a; for (let i = a; i <= b; i++) if (cd[i].l < m) { m = cd[i].l; k = i; } return { p: m, i: k }; };
  const highIn = (a, b) => { let m = -Infinity, k = a; for (let i = a; i <= b; i++) if (cd[i].h > m) { m = cd[i].h; k = i; } return { p: m, i: k }; };

  const pool = lowIn(13, 17);          // the liquidity taken
  const wall = highIn(29, 33);         // the level that broke
  const bos = 34;                      // the candle that broke it
  const choch = 17;                    // structure flips after the sweep
  const retest = { a: 40, b: 47 };
  const top = highIn(48, cd.length - 1);

  // bullish fair-value gap on the impulse: candle i-1 high < candle i+1 low
  let fvg = null;
  for (let i = bos; i < bos + 4 && i + 1 < cd.length; i++) {
    if (cd[i - 1].h < cd[i + 1].l) { fvg = { i, lo: cd[i - 1].h, hi: cd[i + 1].l }; break; }
  }
  if (!fvg) fvg = { i: bos, lo: cd[bos].o, hi: cd[bos].c };

  return { pool, wall, bos, choch, retest, top, fvg };
}

/* ── volume profile, accumulated from the candles themselves ────── */
function profile(cd, min, max, rows = 46) {
  const bins = new Array(rows).fill(0);
  const up = new Array(rows).fill(0);
  const step = (max - min) / rows;
  for (const c of cd) {
    const a = Math.max(0, Math.floor((c.l - min) / step));
    const b = Math.min(rows - 1, Math.floor((c.h - min) / step));
    const n = Math.max(1, b - a + 1);
    const share = c.v / n;                       // volume spread across the candle's range
    for (let i = a; i <= b; i++) { bins[i] += share; if (c.c >= c.o) up[i] += share; }
  }
  const peak = Math.max(...bins);
  const poc = bins.indexOf(peak);

  // value area: grow out from the POC until 70% of total volume is inside
  const total = bins.reduce((s, v) => s + v, 0);
  let lo = poc, hi = poc, acc = bins[poc];
  while (acc < total * 0.7 && (lo > 0 || hi < rows - 1)) {
    const d = lo > 0 ? bins[lo - 1] : -1;
    const u = hi < rows - 1 ? bins[hi + 1] : -1;
    if (u >= d) { hi++; acc += bins[hi]; } else { lo--; acc += bins[lo]; }
  }

  // HVN: a peak holding >= 25% of the POC and standing 15% of it above its saddle
  // LVN: a trough <= half the POC and 8% of it below its wall
  const hvn = [], lvn = [];
  for (let i = 2; i < rows - 2; i++) {
    const v = bins[i], l = bins[i - 2], r = bins[i + 2];
    if (v > l && v > r && v >= peak * 0.25 && v - Math.min(l, r) >= peak * 0.15) hvn.push(i);
    if (v < l && v < r && v <= peak * 0.5 && Math.max(l, r) - v >= peak * 0.08) lvn.push(i);
  }
  return { bins, up, peak, poc, va: [lo, hi], hvn, lvn, step, rows };
}

const fmt = n => n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = n => Number(n).toFixed(1);

function txt(x, y, s, fill, size = 11, weight = 500, anchor = 'start', extra = '') {
  return `<text x="${esc(x)}" y="${esc(y)}" fill="${fill}" font-family="${MONO}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" ${extra}>${s}</text>`;
}
function chip(x, y, label, fill, size = 10) {
  const w = label.length * size * 0.62 + 12, h = size + 9;
  return `<g><rect x="${esc(x)}" y="${esc(y - h + 3)}" width="${esc(w)}" height="${esc(h)}" rx="3" fill="${fill}" opacity=".16"/>`
       + `<rect x="${esc(x)}" y="${esc(y - h + 3)}" width="${esc(w)}" height="${esc(h)}" rx="3" fill="none" stroke="${fill}" opacity=".55"/>`
       + txt(x + 6, y - 1, label, fill, size, 600) + `</g>`;
}

/* ════════════════════════════════════════════════════════════════════
   THE CHART
   ════════════════════════════════════════════════════════════════════ */
export function chartSVG() {
  const cd = series();
  const st = structure(cd);
  const n = cd.length;

  const hi = Math.max(...cd.map(c => c.h)), lo = Math.min(...cd.map(c => c.l));
  const pad = (hi - lo) * 0.09;
  const max = hi + pad, min = lo - pad;
  const y = p => PT + (max - p) / (max - min) * (PB - PT);
  const step = (PR - PL - 26) / n;
  const x = i => PL + 14 + i * step + step / 2;
  const bw = Math.max(5, step * 0.64);

  const vmax = Math.max(...cd.map(c => c.v));
  const prof = profile(cd, min, max);
  const pocPrice = min + (prof.poc + 0.5) * prof.step;
  const last = cd[n - 1].c;

  /* ── BASE: grid, candles, volume, axes. Identical in every mode ── */
  let base = '';

  base += `<g stroke="${C.grid}" stroke-width="1">`;
  for (let i = 1; i < 8; i++) { const yy = esc(PT + (PB - PT) / 8 * i); base += `<line x1="${PL}" y1="${yy}" x2="${PR}" y2="${yy}"/>`; }
  for (let i = 1; i < 10; i++) { const xx = esc(PL + (PR - PL) / 10 * i); base += `<line x1="${xx}" y1="${PT}" x2="${xx}" y2="${PB}"/>`; }
  base += `</g>`;

  // wicks in one pass, bodies in two (one per direction) — the product's own batching
  let wick = '', upB = '', dnB = '';
  cd.forEach((c, i) => {
    const cx = esc(x(i));
    wick += `M${cx} ${esc(y(c.h))}V${esc(y(c.l))}`;
    const t = y(Math.max(c.o, c.c)), b = y(Math.min(c.o, c.c));
    const r = `M${esc(x(i) - bw / 2)} ${esc(t)}h${esc(bw)}v${esc(Math.max(1.6, b - t))}h${esc(-bw)}Z`;
    if (c.c >= c.o) upB += r; else dnB += r;
  });
  base += `<path d="${wick}" stroke="${C.smoke}" stroke-width="1.3" opacity=".95" fill="none"/>`;
  base += `<path d="${upB}" fill="${C.bull}"/><path d="${dnB}" fill="${C.bear}"/>`;

  // last price
  base += `<line x1="${PL}" y1="${esc(y(last))}" x2="${PR}" y2="${esc(y(last))}" stroke="${C.bullHi}" stroke-width="1" opacity=".5" stroke-dasharray="5 5"/>`;
  base += `<rect x="${PR}" y="${esc(y(last) - 11)}" width="86" height="22" rx="3" fill="${C.bull}"/>`;
  base += txt(PR + 43, y(last) + 4.5, fmt(last), '#fff', 11.5, 600, 'middle');

  // price axis
  base += `<line x1="${PR}" y1="${PT}" x2="${PR}" y2="${TXY}" stroke="rgba(230,222,208,.1)"/>`;
  for (let i = 0; i <= 7; i++) {
    const p = min + (max - min) * (i / 7);
    base += txt(PR + 11, y(p) + 4, Math.round(p).toLocaleString('en-IN'), C.ash, 10.5, 400);
  }
  // time axis
  base += `<line x1="${PL}" y1="${PB + 2}" x2="${PR}" y2="${PB + 2}" stroke="rgba(230,222,208,.1)"/>`;
  ['09:15', '10:00', '10:45', '11:30', '12:15', '13:00', '13:45', '14:30', '15:15']
    .forEach((t, i) => { base += txt(PL + (PR - PL) / 9 * i + 16, TXY, t, C.ash, 10.5, 400); });

  /* ── LOWER PANE: volume (all modes) ─────────────────────────── */
  let pane = `<g class="pane-vol">`;
  pane += txt(PL + 4, QT - 7, 'VOLUME', C.ash, 9.5, 600, 'start', 'letter-spacing="1.4"');
  cd.forEach((c, i) => {
    const h = (c.v / vmax) * (QB - QT);
    pane += `<rect x="${esc(x(i) - bw / 2)}" y="${esc(QB - h)}" width="${esc(bw)}" height="${esc(h)}" fill="${c.c >= c.o ? C.bull : C.bear}" opacity=".5"/>`;
  });
  pane += `</g>`;

  /* ════════════════ OVERLAY 1 — GOLDEN VOLUME PROFILE ════════════ */
  let gvp = `<g class="ov ov-gvp">`;
  {
    const rowH = (PB - PT) / prof.rows;
    const maxW = 250;
    for (let i = 0; i < prof.rows; i++) {
      const p0 = min + i * prof.step;
      const yy = y(p0 + prof.step), hh = Math.max(1.6, rowH - 1.4);
      const wBar = (prof.bins[i] / prof.peak) * maxW;
      const inVA = i >= prof.va[0] && i <= prof.va[1];
      const upW = (prof.up[i] / Math.max(1e-6, prof.bins[i])) * wBar;
      gvp += `<rect x="${PL}" y="${esc(yy)}" width="${esc(wBar)}" height="${esc(hh)}" fill="${C.gold}" opacity="${inVA ? .2 : .1}"/>`;
      gvp += `<rect x="${PL}" y="${esc(yy)}" width="${esc(upW)}" height="${esc(hh)}" fill="${C.amber}" opacity="${inVA ? .55 : .2}"/>`;
    }
    // value-area edges
    gvp += `<line x1="${PL}" y1="${esc(y(min + prof.va[0] * prof.step))}" x2="${esc(PL + maxW)}" y2="${esc(y(min + prof.va[0] * prof.step))}" stroke="${C.amber}" stroke-width="1" opacity=".45" stroke-dasharray="4 4"/>`;
    gvp += `<line x1="${PL}" y1="${esc(y(min + (prof.va[1] + 1) * prof.step))}" x2="${esc(PL + maxW)}" y2="${esc(y(min + (prof.va[1] + 1) * prof.step))}" stroke="${C.amber}" stroke-width="1" opacity=".45" stroke-dasharray="4 4"/>`;
    gvp += txt(PL + maxW + 8, y(min + (prof.va[1] + 1) * prof.step) - 5, 'VALUE AREA 70%', C.amber, 10, 600, 'start', 'letter-spacing="1.1"');

    // POC, carried across the whole session
    gvp += `<line x1="${PL}" y1="${esc(y(pocPrice))}" x2="${PR}" y2="${esc(y(pocPrice))}" stroke="${C.orange}" stroke-width="1.6" opacity=".9"/>`;
    gvp += chip(PR - 150, y(pocPrice) - 6, `POC  ${Math.round(pocPrice).toLocaleString('en-IN')}`, C.orange);

    // HVN / LVN zones, carried to the next session's close
    prof.hvn.slice(0, 2).forEach(i => {
      const a = y(min + (i + 1.4) * prof.step), b = y(min + (i - 1.4) * prof.step);
      gvp += `<rect x="${PL}" y="${esc(a)}" width="${esc(PR - PL)}" height="${esc(b - a)}" fill="${C.blue}" opacity=".085"/>`;
      gvp += `<line x1="${PL}" y1="${esc(a)}" x2="${PR}" y2="${esc(a)}" stroke="${C.blue}" stroke-width="1" opacity=".3"/>`;
      gvp += chip(PL + 262, a - 5, 'HVN  accepted', C.blue);
    });
    prof.lvn.slice(0, 2).forEach(i => {
      const a = y(min + (i + 1.4) * prof.step), b = y(min + (i - 1.4) * prof.step);
      gvp += `<rect x="${PL}" y="${esc(a)}" width="${esc(PR - PL)}" height="${esc(b - a)}" fill="${C.gold}" opacity=".1"/>`;
      gvp += chip(PL + 262, a - 5, 'LVN  price travels', C.goldHi);
    });
    gvp += chip(PL + 6, PT + 20, "PREVIOUS SESSION · 1-MIN PROFILE · 46 ROWS", C.amber, 10);
  }
  gvp += `</g>`;

  /* ════════════════════ OVERLAY 2 — ORDER FLOW ═══════════════════ */
  let oflow = `<g class="ov ov-oflow">`;
  {
    // delta per candle, from where it closed inside its own range
    const delta = cd.map(c => {
      const rng = Math.max(1e-6, c.h - c.l);
      const pos = (c.c - c.l) / rng;              // 0 = closed on the low, 1 = on the high
      return c.v * (pos * 2 - 1);
    });
    const dmax = Math.max(...delta.map(Math.abs));

    oflow += `<rect x="${PL}" y="${QT - 18}" width="${esc(PR - PL)}" height="${esc(QB - QT + 20)}" fill="#0b0907"/>`;
    oflow += txt(PL + 4, QT - 7, 'DELTA · PER CANDLE', C.cyan, 9.5, 600, 'start', 'letter-spacing="1.4"');
    const zero = QT + (QB - QT) / 2;
    oflow += `<line x1="${PL}" y1="${esc(zero)}" x2="${PR}" y2="${esc(zero)}" stroke="rgba(230,222,208,.16)"/>`;
    delta.forEach((d, i) => {
      const h = (Math.abs(d) / dmax) * ((QB - QT) / 2 - 3);
      oflow += `<rect x="${esc(x(i) - bw / 2)}" y="${esc(d >= 0 ? zero - h : zero)}" width="${esc(bw)}" height="${esc(h)}" fill="${d >= 0 ? C.bullHi : C.bearHi}" opacity=".85"/>`;
    });

    // resting walls on the right edge — the DOM
    for (let i = 0; i < 26; i++) {
      const p = min + (max - min) * (i / 26);
      const ask = p > last;
      const q = 0.25 + 0.75 * Math.abs(Math.sin(i * 1.7 + 0.6));
      const big = Math.abs(p - st.wall.p) < (max - min) * 0.03;
      const wpx = q * (big ? 150 : 64);
      oflow += `<rect x="${esc(PR - wpx)}" y="${esc(y(p) - 5)}" width="${esc(wpx)}" height="9" fill="${ask ? C.bear : C.bull}" opacity="${big ? .55 : .2}"/>`;
    }
    oflow += chip(PR - 150, PT + 20, 'LIVE DOM', C.cyan);

    // big prints
    [[16, 'SELL 1,840'], [17, 'BUY 2,310'], [34, 'BUY 3,120']].forEach(([i, lbl]) => {
      const c = cd[i], cy = y((c.h + c.l) / 2);
      const buy = lbl.startsWith('BUY');
      oflow += `<circle cx="${esc(x(i))}" cy="${esc(cy)}" r="13" fill="${buy ? C.bull : C.bear}" opacity=".3"/>`;
      oflow += `<circle cx="${esc(x(i))}" cy="${esc(cy)}" r="5" fill="${buy ? C.bullHi : C.bearHi}"/>`;
      oflow += txt(x(i) + 18, cy + 4, lbl, buy ? C.bullHi : C.bearHi, 10.5, 600);
    });

    // footprint zoom — three candles, bid x ask per price row
    const zx = 690, zy = 56, zw = 290, zh = 196;
    oflow += `<rect x="${zx}" y="${zy}" width="${zw}" height="${zh}" rx="8" fill="#0d0b09" stroke="${C.cyan}" stroke-opacity=".45"/>`;
    oflow += txt(zx + 12, zy + 20, 'FOOTPRINT · BID × ASK', C.cyan, 10, 600, 'start', 'letter-spacing="1.2"');
    const rowsF = 5, colW = 86;
    for (let col = 0; col < 3; col++) {
      const idx = 33 + col;
      const cc = cd[idx];
      oflow += txt(zx + 22 + col * colW + 30, zy + 40, cc.c >= cc.o ? '▲' : '▼', cc.c >= cc.o ? C.bullHi : C.bearHi, 10, 600, 'middle');
      for (let r = 0; r < rowsF; r++) {
        const bid = Math.round(18 + 70 * Math.abs(Math.sin(col * 2.1 + r * 1.3)));
        const ask = Math.round(18 + 70 * Math.abs(Math.cos(col * 1.7 + r * 0.9)));
        const imbalance = ask > bid * 2.2 ? C.bullHi : bid > ask * 2.2 ? C.bearHi : C.smoke;
        const yy = zy + 58 + r * 26;
        if (imbalance !== C.smoke) oflow += `<rect x="${zx + 16 + col * colW}" y="${yy - 12}" width="${colW - 8}" height="20" rx="3" fill="${imbalance}" opacity=".14"/>`;
        oflow += txt(zx + 22 + col * colW, yy + 3, String(bid), imbalance === C.bearHi ? C.bearHi : C.smoke, 11, 500);
        oflow += txt(zx + 22 + col * colW + 58, yy + 3, String(ask), imbalance === C.bullHi ? C.bullHi : C.smoke, 11, 500, 'end');
      }
    }
    oflow += `<line x1="${esc(x(34))}" y1="${esc(y(cd[34].h) - 6)}" x2="${zx + zw / 2}" y2="${zy + zh}" stroke="${C.cyan}" stroke-width="1" opacity=".3" stroke-dasharray="3 4"/>`;
  }
  oflow += `</g>`;

  /* ═══════════════ OVERLAY 3 — SMART MONEY CONCEPTS ══════════════ */
  let smc = `<g class="ov ov-smc">`;
  {
    const wallY = y(st.wall.p), poolY = y(st.pool.p);

    // premium / discount, split at the mid of the swing
    const mid = (st.top.p + st.pool.p) / 2;
    smc += `<rect x="${PL}" y="${esc(y(st.top.p))}" width="${esc(PR - PL)}" height="${esc(y(mid) - y(st.top.p))}" fill="${C.bear}" opacity=".04"/>`;
    smc += `<rect x="${PL}" y="${esc(y(mid))}" width="${esc(PR - PL)}" height="${esc(poolY - y(mid))}" fill="${C.bull}" opacity=".04"/>`;
    smc += txt(PL + 8, y(st.top.p) + 16, 'PREMIUM', C.bearHi, 10, 600, 'start', 'opacity=".75" letter-spacing="1.2"');
    smc += txt(PL + 8, poolY - 8, 'DISCOUNT', C.bullHi, 10, 600, 'start', 'opacity=".75" letter-spacing="1.2"');

    // supply order block, left unfilled above the wall
    const obT = y(st.wall.p + (max - min) * 0.028);
    smc += `<rect x="${esc(x(29))}" y="${esc(obT)}" width="${esc(PR - x(29))}" height="${esc(wallY - obT)}" fill="${C.bear}" opacity=".13"/>`;
    smc += `<rect x="${esc(x(29))}" y="${esc(obT)}" width="${esc(PR - x(29))}" height="${esc(wallY - obT)}" fill="none" stroke="${C.bear}" stroke-opacity=".45"/>`;
    smc += chip(x(29) + 6, obT - 5, 'SUPPLY OB', C.bearHi);

    // demand order block at the reversal
    const dT = y(Math.max(cd[16].o, cd[17].c)), dB = y(cd[16].l);
    smc += `<rect x="${esc(x(16) - bw)}" y="${esc(dT)}" width="${esc(PR - x(16) + bw)}" height="${esc(dB - dT)}" fill="${C.bull}" opacity=".12"/>`;
    smc += `<rect x="${esc(x(16) - bw)}" y="${esc(dT)}" width="${esc(PR - x(16) + bw)}" height="${esc(dB - dT)}" fill="none" stroke="${C.bull}" stroke-opacity=".45"/>`;
    smc += chip(x(16) + 6, dB + 18, 'DEMAND OB', C.bullHi);

    // fair-value gap on the impulse
    smc += `<rect x="${esc(x(st.fvg.i - 1))}" y="${esc(y(st.fvg.hi))}" width="${esc(PR - x(st.fvg.i - 1))}" height="${esc(y(st.fvg.lo) - y(st.fvg.hi))}" fill="${C.violet}" opacity=".16"/>`;
    smc += `<line x1="${esc(x(st.fvg.i - 1))}" y1="${esc((y(st.fvg.hi) + y(st.fvg.lo)) / 2)}" x2="${PR}" y2="${esc((y(st.fvg.hi) + y(st.fvg.lo)) / 2)}" stroke="${C.violet}" stroke-width="1" opacity=".5" stroke-dasharray="3 3"/>`;
    smc += chip(x(38), wallY + 34, 'FVG 50%', C.violet);

    // stop-loss liquidity under the pool
    const stT = poolY, stB = y(st.pool.p - (max - min) * 0.045);
    smc += `<rect x="${PL}" y="${esc(stT)}" width="${esc(PR - PL)}" height="${esc(stB - stT)}" fill="${C.pink}" opacity=".13"/>`;
    smc += `<line x1="${PL}" y1="${esc(stB)}" x2="${PR}" y2="${esc(stB)}" stroke="${C.pink}" stroke-width="1" opacity=".55" stroke-dasharray="2 5"/>`;
    smc += chip(PL + 8, stT + 20, 'STOPS ▼  ★ 78  ·  hunt zone to 75%', C.pink);
    smc += txt(PR - 8, stB - 6, '90% of past hunts turned above here', C.pink, 9.5, 500, 'end', 'opacity=".8"');

    // the broken level and the structure labels
    smc += `<line x1="${esc(x(26))}" y1="${esc(wallY)}" x2="${PR}" y2="${esc(wallY)}" stroke="${C.violet}" stroke-width="1.3" opacity=".7" stroke-dasharray="7 5"/>`;
    smc += chip(x(36), wallY - 9, 'BOS ↑ then retested', C.violet);
    smc += chip(x(17) + 10, y(cd[17].h) - 8, 'CHoCH', C.mint);
    smc += chip(x(16) - 6, poolY + 46, 'SWEEP — liquidity taken', C.mint);
    smc += txt(x(st.pool.i), poolY + 16, 'LL', C.smoke, 10.5, 600, 'middle');
    smc += txt(x(st.wall.i), wallY - 10, 'HH', C.smoke, 10.5, 600, 'middle');
    smc += txt(x(44), y(cd[44].l) + 16, 'HL · retest holds', C.smoke, 10, 500, 'middle');
    smc += txt(x(st.top.i), y(st.top.p) - 10, 'HH', C.smoke, 10.5, 600, 'middle');

    // equal lows at the pool
    smc += `<line x1="${esc(x(13))}" y1="${esc(y(cd[14].l))}" x2="${esc(x(15))}" y2="${esc(y(cd[14].l))}" stroke="${C.goldHi}" stroke-width="1.4" opacity=".8"/>`;
    smc += txt(x(13) - 8, y(cd[14].l) + 4, 'EQL', C.goldHi, 10, 600, 'end');

    // the trade plan
    const entry = cd[44].l, stop = st.pool.p - (max - min) * 0.012, tgt = st.top.p + (max - min) * 0.03;
    const plan = [[entry, C.cyan, 'ENTRY'], [stop, C.bear, 'STOP  hunt-safe'], [tgt, C.bull, 'TARGET  3.1R']];
    plan.forEach(([p, col, lbl]) => {
      smc += `<line x1="${esc(x(48))}" y1="${esc(y(p))}" x2="${PR}" y2="${esc(y(p))}" stroke="${col}" stroke-width="1.2" opacity=".75"/>`;
      smc += chip(PR - 168, y(p) - 6, lbl, col);
    });
    smc += `<rect x="${esc(x(48))}" y="${esc(y(tgt))}" width="${esc(PR - x(48))}" height="${esc(y(entry) - y(tgt))}" fill="${C.bull}" opacity=".05"/>`;
    smc += `<rect x="${esc(x(48))}" y="${esc(y(entry))}" width="${esc(PR - x(48))}" height="${esc(y(stop) - y(entry))}" fill="${C.bear}" opacity=".05"/>`;
    smc += chip(PL + 6, PT + 20, 'A  SWEEP ▲ 3.1R  ·  HTF aligned', C.mint, 10);
  }
  smc += `</g>`;

  /* ═════════════════ OVERLAY 4 — LIQUIDITY HEATMAP ═══════════════ */
  let heat = `<g class="ov ov-heat">`;
  {
    // Bookmap's own cells are chunky, so a coarse grid is both honest and
    // an order of magnitude lighter than one cell per candle per tick.
    const cols = 34, rowsH = 22;
    const stepH = (max - min) / rowsH;
    const wallRow = Math.floor((st.wall.p - min) / stepH);
    const poolRow = Math.floor((st.pool.p - min) / stepH);
    const cw = (PR - PL) / cols, ch = (PB - PT) / rowsH;
    const sweepCol = Math.round((16 / n) * cols), bosCol = Math.round((st.bos / n) * cols);

    for (let t = 0; t < cols; t++) {
      for (let r = 0; r < rowsH; r++) {
        // ambient resting size
        let q = 0.1 + 0.17 * Math.abs(Math.sin(r * 0.9 + t * 0.33));
        // the ask wall above: thick until the breakout candle eats it
        const dW = Math.abs(r - wallRow);
        if (dW < 2) q += (t < bosCol ? 0.82 : 0.05) * (1 - dW / 2);
        // the bid pool below: thick until the sweep takes it
        const dP = Math.abs(r - poolRow);
        if (dP < 2) q += (t < sweepCol ? 0.7 : 0.04) * (1 - dP / 2);
        if (q < 0.22) continue;
        const col = q > 0.72 ? '#fff3d0' : q > 0.55 ? '#ffb74d' : q > 0.38 ? '#e2611f' : q > 0.26 ? '#9c2a1a' : '#3a1410';
        // integer coords: these are chunky blocks, sub-pixel precision buys
        // nothing and costs ~5 KB of markup across the field
        const R = Math.round;
        heat += `<rect x="${R(PL + t * cw)}" y="${R(PT + (rowsH - 1 - r) * ch)}" width="${R(cw + 1)}" height="${R(ch + 1)}" fill="${col}" opacity="${q.toFixed(2)}"/>`;
      }
    }
    // the two walls, named
    heat += chip(x(6), y(st.wall.p) - 6, 'ASK WALL · held 40 min · eaten at the break', '#ffd79a');
    heat += chip(x(2), y(st.pool.p) + 24, 'BID POOL · swept', '#ffb74d');

    // trade bubbles where size went through
    [[16, 26, C.bear], [17, 20, C.bull], [34, 30, C.bull], [50, 15, C.bull]].forEach(([i, r, col]) => {
      const c = cd[i];
      heat += `<circle cx="${esc(x(i))}" cy="${esc(y((c.h + c.l) / 2))}" r="${r}" fill="${col}" opacity=".22"/>`;
      heat += `<circle cx="${esc(x(i))}" cy="${esc(y((c.h + c.l) / 2))}" r="${r}" fill="none" stroke="${col}" stroke-opacity=".6"/>`;
    });

    // live DOM, right edge
    for (let r = 0; r < rowsH; r++) {
      const p = min + r * stepH;
      const q = 0.12 + 0.5 * Math.abs(Math.sin(r * 1.4));
      const big = Math.abs(r - wallRow) < 2;
      heat += `<rect x="${esc(PR - (big ? 120 : 46) * q)}" y="${esc(y(p) - ch / 2)}" width="${esc((big ? 120 : 46) * q)}" height="${esc(ch - 1)}" fill="${p > last ? C.bear : C.bull}" opacity="${big ? .6 : .26}"/>`;
    }
    heat += chip(PR - 150, PT + 20, 'LIVE DOM', '#ffb74d');
    heat += chip(PL + 6, PB - 14, 'RECORDED 1×/SECOND · 09:00–15:35 IST · 5 SESSIONS KEPT', '#ffb74d', 10);
  }
  heat += `</g>`;

  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="EIMC Terminal charting NIFTY 50; the same candles under each of the four modes">
  <g class="base">${base}${pane}</g>${gvp}${oflow}${smc}${heat}</svg>`;
}

/* ── the 200-level depth ladder beside the chart ─────────────────── */
function railHTML(levels = 26) {
  let s = `<div class="h">Depth · 200</div>`;
  const mid = Math.floor(levels / 2);
  const p = 24980;
  for (let i = 0; i < levels; i++) {
    const ask = i < mid;
    const dist = Math.abs(i - mid);
    const q = Math.max(0.08, (Math.sin(i * 1.9) * 0.3 + 0.55) * (1 - dist / levels * 0.5));
    const wall = i === 3 || i === mid + 4;
    const w = (q * (wall ? 125 : 86)).toFixed(0);
    s += `<div class="lv"><i class="bar" style="width:${w}%;background:${ask ? C.bear : C.bull};opacity:${wall ? .5 : .22}"></i>`
       + `<span style="color:${wall ? (ask ? C.bearHi : C.bullHi) : ''}">${(p - i * 5).toLocaleString('en-IN')}</span></div>`;
  }
  return s;
}

/* ── the terminal window ─────────────────────────────────────────── */
const MODE_LABEL = {
  gvp: 'Golden volume profile',
  oflow: 'Order flow',
  smc: 'Smart money concepts',
  heat: 'Liquidity heatmap',
};
const MODE_DOT = { gvp: '#ffb74d', oflow: '#22d3ee', smc: '#c084fc', heat: '#ff5e3a' };

export function terminalHTML(mode = 'smc') {
  const cd = series();
  const last = cd[cd.length - 1].c, first = cd[0].o;
  const chg = last - first, pct = (chg / first) * 100;
  const tfs = ['1m', '5m', '15m', '25m', '1H', '2H', '4H', '1D', '1W', '1M'];
  return `
  <div class="term" data-mode="${mode}">
    <div class="term-bar">
      <div class="term-sym"><b>NIFTY 50</b><span class="tf">NSE · INDEX</span></div>
      <div class="term-px"><span class="p">${fmt(last)}</span><span class="c">▲ ${fmt(Math.abs(chg))} &nbsp;+${pct.toFixed(2)}%</span></div>
      <div class="term-tfs">${tfs.map(t => `<span class="${t === '5m' ? 'on' : ''}">${t}</span>`).join('')}</div>
      <div class="term-modes">${Object.keys(MODE_LABEL).map(k =>
        `<i data-dot="${k}" style="background:${MODE_DOT[k]}"></i>`).join('')}</div>
    </div>
    <div class="term-body">
      <div class="term-chart">${chartSVG()}</div>
      <div class="term-rail">${railHTML()}</div>
    </div>
    <div class="term-status">
      <span class="ok">● Live</span>
      <span>142 ticks/s · 38 ms</span>
      <span>Candles synced 2s ago</span>
      <span class="term-mode-name">${MODE_LABEL[mode] || ''}</span>
      <span class="r">PAPER</span>
    </div>
  </div>`;
}

/* ── the option chain ────────────────────────────────────────────── */
const CHAIN = [
  [24600,  38.4, -12.1, 'sc', 14.8, 318.40,  21.6,  18.2, 'sb', 15.9,  42.15],
  [24700,  44.1,  -6.4, 'sc', 14.2, 232.70,  29.8,  24.6, 'sb', 15.2,  58.90],
  [24800,  52.7,   9.8, 'lb', 13.6, 158.25,  47.3,  31.4, 'sb', 14.6,  84.60],
  [24900,  61.2,  22.4, 'sb', 13.1,  98.75,  39.1,  11.7, 'lb', 14.1, 126.30],
  [25000, 118.6,  34.9, 'sb', 12.8,  54.20,  26.4,  -8.3, 'lu', 13.8, 182.05],
  [25100,  74.3,  27.2, 'sb', 12.9,  28.65,  18.2, -14.6, 'lu', 13.6, 256.40],
  [25200,  58.9,  15.6, 'sb', 13.2,  13.90,  12.7, -19.1, 'lu', 13.5, 341.75],
];
const BU = { lb: 'LB', sb: 'SB', sc: 'SC', lu: 'LU' };
const ATM = 24900;

export function chainHTML() {
  const maxOI = Math.max(...CHAIN.flatMap(r => [r[1], r[6]]));
  const row = r => {
    const [k, cOI, cChg, cBu, cIV, cLTP, pOI, pChg, pBu, pIV, pLTP] = r;
    const w = v => ((v / maxOI) * 100).toFixed(0);
    return `<tr class="${k === ATM ? 'atm' : ''}">
      <td class="oibar l"><i style="width:${w(cOI)}%"></i><span>${cOI.toFixed(1)}L</span></td>
      <td><span class="bu ${cBu}">${BU[cBu]}</span> ${cChg > 0 ? '+' : ''}${cChg.toFixed(1)}%</td>
      <td>${cIV.toFixed(1)}</td>
      <td style="color:var(--bone)">${cLTP.toFixed(2)}</td>
      <td class="strike c">${k.toLocaleString('en-IN')}</td>
      <td style="color:var(--bone)">${pLTP.toFixed(2)}</td>
      <td>${pIV.toFixed(1)}</td>
      <td><span class="bu ${pBu}">${BU[pBu]}</span> ${pChg > 0 ? '+' : ''}${pChg.toFixed(1)}%</td>
      <td class="oibar r"><i style="width:${w(pOI)}%"></i><span>${pOI.toFixed(1)}L</span></td>
    </tr>`;
  };
  const head = [
    ['ATM IV', '13.1'], ['IV skew', '+1.0'], ['PCR (OI)', '0.68'],
    ['Max pain', '24,900'], ['Expected move', '± 212'], ['Days to expiry', '3'],
  ];
  return `
  <div class="oc">
    <div class="oc-head">
      ${head.map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${v}</span></div>`).join('')}
    </div>
    <div class="oc-tw">
      <table class="oc-t">
        <thead><tr>
          <th>Call OI</th><th>OI chg</th><th>IV</th><th>LTP</th>
          <th class="c">Strike</th>
          <th>LTP</th><th>IV</th><th>OI chg</th><th>Put OI</th>
        </tr></thead>
        <tbody>${CHAIN.map(row).join('')}</tbody>
      </table>
    </div>
  </div>`;
}

export { MODE_LABEL };

/* ════════════════════════════════════════════════════════════════════
   STORY BEATS, AS PERCENTAGES OF THE CHART BOX

   js/xray.js pins HTML callouts over the chart. Those callouts must
   land on the exact candles the overlays are drawn from, so the
   coordinates are computed here from the same series() and
   structure() the SVG uses rather than measured off a screenshot.

   The SVG scales with its container and keeps its 1280×720 viewBox,
   so a percentage of the viewBox is a percentage of the rendered box
   at any width — which is why these survive a resize with no
   listener.
   ════════════════════════════════════════════════════════════════════ */
export function beats() {
  const cd = series();
  const st = structure(cd);
  const n = cd.length;

  const hi = Math.max(...cd.map(c => c.h)), lo = Math.min(...cd.map(c => c.l));
  const pad = (hi - lo) * 0.09;
  const max = hi + pad, min = lo - pad;

  const step = (PR - PL - 26) / n;
  const xp = i => ((PL + 14 + i * step + step / 2) / W) * 100;
  const yp = p => ((PT + (max - p) / (max - min) * (PB - PT)) / H) * 100;

  return {
    /* the sweep: the candle that took the pool out */
    sweep: { x: xp(16), y: yp(cd[16].l), price: cd[16].l },
    /* the pool itself, and the floor of the hunt zone */
    pool:  { x: xp(st.pool.i), y: yp(st.pool.p), price: st.pool.p },
    hunt:  { x: xp(8), y: yp(st.pool.p - (max - min) * 0.045) },
    /* the wall price action stalled against for four candles */
    wall:  { x: xp(31), y: yp(st.wall.p), price: st.wall.p },
    /* the break of structure, and the retest that held */
    bos:   { x: xp(34), y: yp(st.wall.p), price: st.wall.p },
    retest:{ x: xp(44), y: yp(cd[44].l) },
    /* where it ended up */
    top:   { x: xp(st.top.i), y: yp(st.top.p), price: st.top.p },
    last:  { x: xp(n - 1), y: yp(cd[n - 1].c), price: cd[n - 1].c },
    /* the move the sweep paid, in points — used in the copy so the
       number on the page and the number on the chart cannot drift */
    run:   Math.round(st.top.p - cd[16].l),
    drop:  Math.round(cd[13].c - cd[16].l),
  };
}

/* ── mount points ────────────────────────────────────────────────── */
export function mountUI() {
  document.querySelectorAll('[data-ui="terminal"]').forEach(el => {
    el.innerHTML = terminalHTML(el.dataset.mode || 'smc');
  });
  document.querySelectorAll('[data-ui="chain"]').forEach(el => { el.innerHTML = chainHTML(); });
}
