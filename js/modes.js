'use strict';
/* ════════════════════════════════════════════════════════════════════
   The four Modes.

   MODES is transcribed verbatim from the product's static/js/store.js
   (lines 63-72). store.js itself is not copied into this site because
   it imports heatbasket.js, which reaches into the app.

   TILES is likewise transcribed verbatim, from the product's
   static/js/modeviz.js:539-549 — the object its Modes menu renders
   from. We no longer IMPORT that module: it is 45 KB of tile renderer
   and all the site needs are these six strings per mode, so every page
   was paying for a whole drawing engine to read some labels.

   The shipping app has FOUR modes. README.md:110-126 still documents
   an older six-mode layout; Order book, Trend and Intraday moved into
   the Indicators dialog (README.md:126 says so).
   ════════════════════════════════════════════════════════════════════ */

import { terminalHTML } from '/js/ui.js';

/* --- verbatim from store.js:63-72 --- */
export const MODES = [
  ['gvp', 'Golden volume profile', "Previous day's 1-minute profile, TradingView-exact — POC, HVN and LVN zones carried to the next day's close", ['gvp']],
  ['oflow', 'Order flow', 'ATAS-style: walls, big trades, DOM, every candle’s delta — zoom in for footprints', []],
  ['smc', 'Smart money concepts', 'Structure, swings, zones, order blocks, FVG, liquidity, stop hunts, trade plan',
    ['structure', 'swings', 'zones', 'ob', 'fvg', 'liquidity', 'stopHunt', 'pd', 'plan', 'htfZones']],
  ['heat', 'Liquidity heatmap', 'Bookmap-style: resting orders over time behind the candles, trade bubbles, live DOM', []],
];

/* --- verbatim from modeviz.js:539-549 --- */
export const TILES = {
  gvp:   { head: 'Volume profile',   em: 'previous day → next day',          tag: 'TradingView-exact', mc: '#ffb74d', mc2: '#ff9800',
           desc: "Previous day's 1-min profile · POC · HVN & LVN zones carried to the next day's close" },
  oflow: { head: 'Footprint & delta', em: 'NIFTY + options · every trade',    tag: 'ATAS-style',        mc: '#22d3ee', mc2: '#7c6cff',
           desc: "Walls · big trades · live DOM · every candle's delta — zoom in for footprints" },
  smc:   { head: 'Market structure',  em: 'swings → liquidity → plan',    tag: 'ICT-style',         mc: '#c084fc', mc2: '#f472b6',
           desc: 'BOS & CHoCH · order blocks · fair-value gaps · liquidity sweeps · stop hunts · trade plan' },
  heat:  { head: 'Resting liquidity', em: 'NIFTY + options · book over time', tag: 'Bookmap-style',     mc: '#ffa630', mc2: '#ff5e3a',
           desc: 'Resting orders over time behind the candles · trade bubbles · live DOM' },
};

export const DETAIL = {
  gvp: {
    shortcut: 'Shift+Z',
    pitch: 'Yesterday’s business, standing over today’s.',
    lead: "EIMC rebuilds the previous session's volume profile from its 1-minute candles using TradingView's own rules, then carries its POC and its high- and low-volume zones forward into the next day's space. You trade today against where the market actually did business yesterday — not against a line someone drew.",
    paras: [
      "Accuracy here is not a claim, it is a test. The profile was checked against a Dhan TradingView screenshot of NIFTY 50 on 19 October 2026: every row landed within <b>0.6 px</b>, the POC fell on the same row, and the value area ended on the same edge. That comparison runs as <code class=\"src\">tests/test_volprofile.py</code> on every build.",
      "Each candle's volume is shared equally by every tick between its low and its high, and volume counts as up when the close is at or above the open. The value area grows outward from the POC by TradingView's documented rule. An index counts in 0.01; every other instrument counts in its own exchange tick.",
      "<b>HVN</b> marks price the market accepted — a peak holding at least 25% of the POC's volume and standing 15% of it above its saddle. <b>LVN</b> marks the opposite: a trough at least 8% of the POC's volume below its lower wall and no more than half of it. Thin trade between two accepted areas, where price travels fast.",
    ],
    specs: [
      ['Rows', 'Default 100. Ticks per row = range / rows / tick, rounded to the whole tick count whose row count is closer to the request.'],
      ['Value area', 'Default 70%, grown from the POC by TradingView’s documented rule'],
      ['HVN', '≥ 25% of POC volume, standing 15% of it above its saddle'],
      ['LVN', '≥ 8% of POC volume below its lower wall, and ≤ half of it'],
      ['Verified', 'NIFTY 50, 19 Oct 2026 — every row within 0.6 px of Dhan’s TradingView chart'],
      ['Timeframes', 'Intraday only, 1m – 4H'],
      ['Cost', 'A finished session never changes, so each is computed once (GET /api/gvp)'],
    ],
    tags: ['POC', 'HVN', 'LVN', 'Value area 70%', '100 rows', 'Session stepper'],
  },

  oflow: {
    shortcut: 'Shift+X',
    pitch: 'Every trade that printed, and who paid for it.',
    lead: "Order flow turns the recorded book into a footprint read: the walls standing in the way, the size going through them, a live DOM down the right edge, and each candle's delta underneath. Zoom in far enough and the candles open into full footprints.",
    paras: [
      "Delta answers the question every other indicator answers late: of everything that traded inside this candle, how much lifted the offer and how much hit the bid. A candle that closes green on negative delta was bought by nobody — it drifted up because sellers stepped away. You see that here before you see it anywhere else.",
      "The data is recorded, not reconstructed. Dhan keeps no order-book history, so EIMC writes its own — once a second, 09:00 to 15:35 IST on market days, whether the app is open or not. NIFTY is always recorded; options join from the Option Chain.",
      "Order flow and the Liquidity heatmap are the two <b>heat modes</b>, and only one runs at a time — both paint the chart background, and the product keeps them mutually exclusive.",
    ],
    specs: [
      ['Recording', 'Once a second, 09:00 – 15:35 IST, with the app open or closed'],
      ['Instruments', 'NIFTY 50 always, plus up to 6 options you pick (NSE)'],
      ['Retention', '5 sessions kept on disk'],
      ['Exclusivity', 'One heat mode at a time — Order flow or Liquidity heatmap'],
      ['Reads', 'Walls · big trades · live DOM · per-candle delta · footprints on zoom'],
    ],
    tags: ['Delta', 'Footprint', 'Walls', 'Big trades', 'Live DOM', '1 s recording'],
  },

  smc: {
    shortcut: 'Shift+C',
    pitch: 'Where structure broke, and who got stopped out.',
    lead: "One switch owns ten overlays — structure, swings, zones, order blocks, fair-value gaps, liquidity, stop hunts, premium/discount, the trade plan and higher-timeframe zones. It reads the chart the way a desk reads it.",
    paras: [
      "Swings are labelled <b>HH / HL / LH / LL</b>, a <b>BOS</b> marks continuation and a <b>CHoCH</b> marks the reversal. Zones are built by clustering swing points and carry their swing count, a flip marker, how many times they have been tested, and a <b>fresh</b> flag while price has not returned.",
      "<b>Stop-loss liquidity</b> is the part most tools leave out. Retail stops rest just past the obvious levels — below swing lows, equal lows and the previous day, week or month low; above the matching highs. Those pools are drawn as pink <b>STOPS ▼</b> and blue <b>STOPS ▲</b> bands, each scored <b>★ 0–100</b> for how many stops are likely waiting.",
      "How far a raid usually goes is measured on this chart's own history — up to 3,000 candles, in ATR, so it adapts to the symbol and the timeframe. The band runs from the level to where <b>75%</b> of past hunts turned; the dotted line marks where <b>90%</b> turned. A raid only counts as a hunt if price closes back inside within 3 candles and then moves at least 1 ATR away. Otherwise it was a real break.",
      "Every trade plan carries an entry zone, a stop no tighter than <b>0.5 ATR</b>, and targets in R-multiples, graded <b>A</b> at 2R or better, <b>B</b> at 1.5R, otherwise <b>C</b> — with a higher-timeframe alignment check and the risk per lot. If the stop sits inside a stop cluster, the plan shows a <b>hunt-safe SL</b> beyond the 90% line.",
    ],
    specs: [
      ['Owns', 'structure · swings · zones · ob · fvg · liquidity · stopHunt · pd · plan · htfZones'],
      ['Hunt zone', 'Level → where 75% of this chart’s past hunts turned; dotted line at 90%'],
      ['Hunt test', 'Close back inside within 3 candles, then ≥ 1 ATR away'],
      ['Sample', 'Measured in ATR over up to 3,000 of this chart’s own candles'],
      ['★ score', '0–100 from equal highs/lows, major swings, prior session levels, round numbers, volume and age'],
      ['Trade plan', 'Stop ≥ 0.5 ATR · grade A ≥ 2R, B ≥ 1.5R · HTF alignment · risk per lot'],
      ['Replay-safe', 'Uses only candles up to the last one, so it behaves identically in a bar replay'],
    ],
    tags: ['BOS', 'CHoCH', 'HH / HL / LH / LL', 'SWEEP', 'SUPPLY OB', 'STOPS ▼', 'Premium / discount'],
  },

  heat: {
    shortcut: 'Shift+V',
    pitch: 'An order book for an index that has none.',
    lead: "Resting orders drawn behind the candles as a heat field running back through time, with trade bubbles where size actually went through and a live DOM on the right edge. A wall that stood for forty minutes before it was eaten is still on the chart when you go looking for it.",
    paras: [
      "Dhan keeps no order-book history, so EIMC records its own — once a second, 09:00 to 15:35 IST, whether the app is open or not. Five sessions are kept.",
      "<b>NIFTY 50 is always recorded.</b> An index has no book of its own, so EIMC takes its near-month future's book and shifts it onto the index chart by the basis. That is a depth map for NIFTY that does not otherwise exist. <b>Options you pick</b> join the heat recorder from the Option Chain — click ◉ beside any call or put, up to six, NSE only.",
      "Depth is the constraint and EIMC is built around it. The 200-level feed carries one instrument per socket and an account may hold only five, so EIMC's market-data server holds them for everyone: up to three instruments streamed at 200 levels (NIFTY's near-month future first), and 20-level books for the rest, each fetched once and shared with every customer watching it.",
    ],
    specs: [
      ['Recording', 'Once a second, 09:00 – 15:35 IST, app open or closed'],
      ['Always on', 'NIFTY 50 — its near-month future’s book, shifted onto the index by the basis'],
      ['Your picks', 'Up to 6 options from the Option Chain heat recorder (NSE)'],
      ['Depth', '200 levels on up to 3 instruments EIMC streams deep, 20 levels on up to 5 books you pick'],
      ['Sockets', 'Held and shared by EIMC’s market-data server, never by your PC'],
      ['Retention', '5 sessions'],
      ['Tunable', 'EIMC_DEEP_SOCKETS in .env, 1–5, default 4'],
    ],
    tags: ['200-level depth', 'Trade bubbles', 'Live DOM', '1 s recording', '5 sessions', 'NIFTY + 6 options'],
  },
};

/* ── rendering ───────────────────────────────────────────────────── */

/** The scroll-synced switcher: a tab list and ONE chart.
 *
 *  The chart is a single terminal with all four overlays baked in and
 *  CSS fading between them, so the candles never move when you switch
 *  mode — you are watching what each mode ADDS to the same tape. */
export function renderModeTabs(listHost, mediaHost) {
  if (!listHost || !mediaHost) return;

  listHost.innerHTML = MODES.map(([k, name]) => {
    const t = TILES[k];
    return `<button class="ftab" type="button" data-mode="${k}" style="--mc:${t.mc};--mc2:${t.mc2}">
      <h3>${name}</h3>
      <p>${t.desc}</p>
    </button>`;
  }).join('');

  mediaHost.innerHTML = terminalHTML(MODES[0][0])
    + `<div class="mode-tagbar">${MODES.map(([k]) => `
        <div class="mode-tags" data-for="${k}">
          ${DETAIL[k].tags.slice(0, 5).map(c => `<span class="tag">${c}</span>`).join('')}
          <span class="tag hot">${DETAIL[k].shortcut}</span>
        </div>`).join('')}</div>
    <p class="frame-cap">
      One chart, one tape. Switching mode changes only what is drawn over it &mdash; the candles,
      the volume and the axis never move.
    </p>`;
}

/** Features page: one alternating row per mode. */
export function renderModeSections(host) {
  if (!host) return;
  host.innerHTML = MODES.map(([k, name], i) => {
    const t = TILES[k], d = DETAIL[k];
    return `
    <section class="band" id="${k}" style="--mc:${t.mc};--mc2:${t.mc2}">
      <div class="wrap">
        <div class="row wide-left${i % 2 ? ' flip' : ''}">
          <div class="row-copy">
            <div class="kicker"><span class="n">${String(i + 1).padStart(2, '0')}</span> <b>${name}</b> &middot; ${t.tag}</div>
            <h2 class="d2">${d.pitch}</h2>
            <p class="lede mt24">${d.lead}</p>
            ${d.paras.map(p => `<p>${p}</p>`).join('')}
            <div class="tags">
              ${d.tags.map(c => `<span class="tag">${c}</span>`).join('')}
              <span class="tag hot">${d.shortcut}</span>
            </div>
          </div>
          <div class="row-media">
            <div class="specs" style="margin-top:0">
              ${d.specs.map(([a, b]) => `<div class="r"><div class="k">${a}</div><div class="v">${b}</div></div>`).join('')}
            </div>
          </div>
        </div>
      </div>
    </section>`;
  }).join('');
}
