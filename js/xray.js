'use strict';
/* ════════════════════════════════════════════════════════════════════
   THE X-RAY — the same candles, with the lights off and on.

   This is the one component on the site that has to do the selling.
   Everything else explains; this shows. One NIFTY 50 chart, drawn
   once, with a wipe down the middle: to the left of the handle it is
   the chart the trader already has, and to the right it is the same
   bars with the pool, the wall and the break marked.

   Why a wipe rather than two charts side by side: side-by-side
   invites the reader to look for differences in the price action.
   A wipe makes it unarguable that the price action is identical and
   the only variable is what you were shown about it. The candles are
   literally the same seeded series in both layers.

   The callouts are pinned from ui.js's beats(), which computes them
   from the same series the SVG is drawn from, and the point figures
   in the copy are injected from the same place — so the chart and the
   words can never disagree.
   ════════════════════════════════════════════════════════════════════ */

import { chartSVG, beats } from '/js/ui.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

/* ── the story, in two columns ─────────────────────────────────────
   These are read out BELOW the chart rather than pinned over it.

   Pinned callouts were the first attempt and they were wrong twice
   over: six 268px boxes cannot be laid over a 16:9 chart without
   colliding with each other and overflowing the frame, and they
   covered the thing they were describing. The chart already labels
   its own findings — the SVG draws SWEEP, STOPS ▼ ★78, SUPPLY OB,
   BOS and the trade plan's ENTRY exactly where they belong, because
   that is what the product actually puts on screen. The job left for
   HTML is to explain, not to point.

   So the wipe stays the interaction and the chart stays clean and
   authentic, while each column dims and brightens with how much of
   its own side is showing. */
const NAKED = [
  {
    t: 'Support just broke',
    d: 'Fifteen candles of lower highs, and now the low is gone. The obvious read is down, '
     + 'so you sell the break with a stop just above it.',
  },
  {
    t: 'It stalls. No idea why',
    d: 'Four candles die inside the same few points. Nothing here says whether that is '
     + 'sellers defending a price, or simply nobody buying.',
  },
  {
    t: 'Then it runs without you',
    d: 'By the close it is at a new high. You were right about the level and wrong about '
     + 'the direction, and the chart cannot tell you which part you got wrong.',
  },
];

const LIT = [
  {
    t: 'STOPS ▼ ★ 78',
    d: 'Equal lows plus yesterday&rsquo;s low, scored and drawn <b>before</b> price went near '
     + 'them. The band runs to where 75% of this chart&rsquo;s own past raids turned, with the '
     + '90% line dotted.',
  },
  {
    t: 'SWEEP, not a breakdown',
    d: 'Price closed back inside within three candles and then moved more than 1 ATR away. '
     + 'That is the engine&rsquo;s test for a stop hunt rather than a real break, and it '
     + 'resolved live, on the candle.',
  },
  {
    t: 'SUPPLY OB, and the level',
    d: 'The candles those sellers filled from, held as a block until it is consumed, with the '
     + 'broken level extended across the chart. Switch <b>Order book</b> on too and the resting '
     + 'quantity behind it is drawn as well.',
  },
  {
    t: 'A SWEEP ▲ 3.1R',
    d: 'Entry, stop and target on the candle, graded A, checked against the higher timeframe '
     + '&mdash; and the hit rate printed beside it was measured on this symbol, stop-first, '
     + 'not quoted at you.',
  },
];

export function mountXray(host) {
  if (!host) return;

  const b = beats();

  host.innerHTML = `
  <div class="xr">
    <div class="xr-chrome">
      <div class="term-bar">
        <div class="term-sym"><b>NIFTY 50</b><span class="tf">NSE &middot; INDEX &middot; 5m</span></div>
        <div class="xr-state">
          <span class="xr-s off">Chart only</span>
          <span class="xr-s on">Modes &middot; Smart money</span>
        </div>
      </div>

      <div class="xr-heads">
        <span class="xr-tag l">Your chart</span>
        <span class="xr-tag r">The same candles, in EIMC</span>
      </div>

      <div class="xr-stage" id="xr-stage">
        <div class="xr-lit">${chartSVG()}</div>
        <div class="xr-naked" id="xr-naked">${chartSVG()}</div>

        <div class="xr-split" id="xr-split">
          <button class="xr-grab" id="xr-grab" type="button"
                  role="slider" aria-label="Reveal what EIMC draws on the same candles"
                  aria-valuemin="0" aria-valuemax="100" aria-valuenow="70" tabindex="0">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9.5 7.5L5.5 12l4 4.5M14.5 7.5l4 4.5-4 4.5"/></svg>
          </button>
        </div>
      </div>
    </div>

    <p class="xr-cap">
      Drag the handle. The bars never change &mdash; only what you were told about them.
      That sweep gave back <b class="num" data-beat="drop"></b> points on the way down and ran
      <b class="num" data-beat="run"></b> on the way back up.
    </p>

    <div class="xr-read">
      <div class="xr-col naked" id="xr-col-n">
        <h4>What your chart showed you</h4>
        ${NAKED.map(c => `<div class="xr-r"><b>${c.t}</b><p>${c.d}</p></div>`).join('')}
      </div>
      <div class="xr-col lit" id="xr-col-l">
        <h4>What EIMC drew on the same bars</h4>
        ${LIT.map(c => `<div class="xr-r"><b>${c.t}</b><p>${c.d}</p></div>`).join('')}
      </div>
    </div>
  </div>`;

  /* the derived point figures, so copy and chart cannot drift */
  host.querySelectorAll('[data-beat]').forEach(el => {
    el.textContent = b[el.dataset.beat];
  });

  const stage = host.querySelector('#xr-stage');
  const split = host.querySelector('#xr-split');
  const grab  = host.querySelector('#xr-grab');
  const colN  = host.querySelector('#xr-col-n');
  const colL  = host.querySelector('#xr-col-l');

  let at = 70;

  const put = v => {
    at = clamp(v, 6, 94);
    stage.style.setProperty('--split', `${at}%`);
    grab.setAttribute('aria-valuenow', at.toFixed(0));

    /* Each column's presence tracks how much of its own side of the
       wipe is on screen, so dragging visibly trades one read for the
       other. It floors at .3 rather than 0 — a column that vanishes
       reads as a bug, and the text should stay legible at any split. */
    const n = clamp(at / 52, 0.3, 1);
    colN.style.setProperty('--lit', n.toFixed(3));
    colL.style.setProperty('--lit', clamp((100 - at) / 52, 0.3, 1).toFixed(3));
  };

  /* ── dragging ──────────────────────────────────────────────────── */
  const xOf = e => {
    const r = stage.getBoundingClientRect();
    return ((e.clientX - r.left) / r.width) * 100;
  };

  let dragging = false;
  const down = e => {
    dragging = true;
    stage.classList.add('dragging');
    split.setPointerCapture?.(e.pointerId);
    put(xOf(e));
  };
  const move = e => { if (dragging) { e.preventDefault(); put(xOf(e)); } };
  const up   = () => { dragging = false; stage.classList.remove('dragging'); };

  split.addEventListener('pointerdown', down);
  stage.addEventListener('pointerdown', e => { if (e.target.closest('.xr-box')) return; down(e); });
  addEventListener('pointermove', move, { passive: false });
  addEventListener('pointerup', up);
  addEventListener('pointercancel', up);

  grab.addEventListener('keydown', e => {
    const k = { ArrowLeft: -4, ArrowRight: 4, Home: -100, End: 100 }[e.key];
    if (k === undefined) return;
    e.preventDefault();
    put(at + k);
  });

  put(at);

  /* ── the one-time nudge ────────────────────────────────────────
     The handle is only obviously draggable once you have seen it
     move. On first scroll into view it walks right and settles,
     which teaches the affordance without a tooltip. Off entirely
     under prefers-reduced-motion. */
  if (REDUCED) return;
  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now(), from = at, to = 32, dur = 1600;
      const tick = now => {
        if (dragging) return;
        const k = clamp((now - t0) / dur, 0, 1);
        /* travel most of the way, then ease back a little, so the
           handle stops somewhere a reader will want to grab it */
        const e2 = k < .66
          ? (1 - Math.pow(1 - k / .66, 3))
          : 1 - (k - .66) / .34 * 0.22;
        put(from + (to - from) * e2);
        if (k < 1) requestAnimationFrame(tick);
      };
      setTimeout(() => requestAnimationFrame(tick), 420);
    });
  }, { threshold: 0.45 });
  io.observe(stage);
}
