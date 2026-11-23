'use strict';
/* ════════════════════════════════════════════════════════════════════
   EVERYTHING IN THE BOX — the full capability inventory.

   Every line here is a real, shipped behaviour taken from the
   product's own README, not a marketing bullet. The point of the
   component is volume plus verifiability: a trader who wants to know
   whether EIMC does one specific thing can type it and find out in
   two seconds, and the answer is specific enough that a bluff would
   be obvious.

   `t` is the tier gate, and it matches pricing-data.js exactly:
     'free'  — works on demo data with no account
     'pro'   — everything on live data (Pro or the trial)

   Keep the wording concrete. "Scored 0–100 from four inputs" earns
   trust; "powerful analytics" spends it.
   ════════════════════════════════════════════════════════════════════ */

export const GROUPS = [
  { id: 'chart',   name: 'Chart engine',        note: 'TradingView Lightweight Charts, driven tick by tick' },
  { id: 'candle',  name: 'Candle accuracy',     note: 'Why the numbers agree with the exchange' },
  { id: 'struct',  name: 'Market structure',    note: 'Swings, breaks, zones and the smart-money set' },
  { id: 'levels',  name: 'Levels & liquidity',  note: 'One scored line per price that matters' },
  { id: 'gvp',     name: 'Golden volume profile', note: "TradingView's own rules, verified row by row" },
  { id: 'depth',   name: 'Order book & flow',   note: '200-level depth, recorded all session' },
  { id: 'options', name: 'Options',             note: 'The full chain, and who is winning it' },
  { id: 'dqrs',    name: 'DQRS setups',         note: 'Five mechanical setups, forward-tested' },
  { id: 'replay',  name: 'Bar replay',          note: 'Provably blind to the future' },
  { id: 'trade',   name: 'Paper trading',       note: 'Practise on live prices and in replay, no real orders' },
  { id: 'ind',     name: 'Indicators',          note: "TradingView's formulas, browser and server in parity" },
  { id: 'ux',      name: 'Interface & workflow', note: 'Keyboard, modes, memory' },
  { id: 'sys',     name: 'System & security',   note: 'Local-only, per-user, your credentials' },
];

/* ── the inventory ──────────────────────────────────────────────── */
export const ITEMS = [
  /* chart engine */
  ['chart', 'pro', 'Instruments covered', 'NIFTY 50, BANKNIFTY, FINNIFTY, SENSEX and INDIA VIX, every NSE F&amp;O name, NSE and BSE cash, and MCX commodities — through EIMC-DATA.'],
  ['chart', 'free', 'Ten timeframes', '1m · 5m · 15m · 25m · 1H · 2H · 4H · 1D · 1W · 1M, each on a number key.'],
  ['chart', 'free', 'Six chart types', 'Candles, Hollow, Heikin Ashi, Bars, Line and Area.'],
  ['chart', 'free', 'Infinite history', 'Scroll to the left edge and older candles load themselves.'],
  ['chart', 'pro', 'Tick-by-tick live candles', "The forming candle and every indicator on it update on each tick from EIMC-DATA's live feed, keeping your zoom and scroll position."],
  ['chart', 'free', 'Mouse-wheel and pinch zoom', 'Kinetic scrolling, drag either axis to rescale, double-click an axis to reset.'],
  ['chart', 'free', 'Auto-fit price axis', 'The A button fits the axis to what is on screen, and switches itself off the moment you drag the axis.'],
  ['chart', 'free', 'Logarithmic price axis', 'The L button makes equal percentage moves look equal. Both A and L are remembered.'],
  ['chart', 'free', 'PNG snapshot', 'Alt+S writes the chart to an image.'],
  ['chart', 'free', 'Fullscreen', 'The chart takes the whole window.'],
  ['chart', 'pro', 'Live watchlist', 'Your symbols with live prices beside the chart.'],
  ['chart', 'free', 'Symbol search on any letter', 'Start typing and the search opens — no field to click first.'],
  ['chart', 'free', 'Drawing tools', 'Trend line, horizontal level, rectangle and measure, on Alt+T / Alt+H / Alt+B / Alt+M, with Delete, Ctrl+Z and Esc.'],

  /* candle accuracy */
  ['candle', 'pro', 'Triple close reconciliation', "Every candle close is re-checked against EIMC-DATA's own candles 1 s, 6 s and 20 s later, then every 30 s until EIMC-DATA has it."],
  ['candle', 'pro', 'Exchange clock, not your PC clock', "Data requests use the exchange's clock, so a slow PC clock can no longer hide the newest candle."],
  ['candle', 'pro', 'Clock drift readout', 'The status bar shows how far this machine is from the exchange, and when candles last synced.'],
  ['candle', 'pro', 'No dropped ticks', "A new day high or low that lands between EIMC-DATA's ~1 s snapshots still reaches the candle's wick."],
  ['candle', 'pro', 'Tick-size snapping', 'The EIMC-DATA feed sends float32, so 25843.35 arrives as 25843.3496. Prices are snapped back to the instrument tick.'],
  ['candle', 'pro', 'Official daily bars', "Previous day, week and month levels, pivots, CPR and change % use EIMC-DATA's official daily bars — and for NSE stocks the official close is the 30-minute VWAP, not the last trade."],
  ['candle', 'pro', 'Re-check on reconnect and on tab focus', 'Candles are verified again after a dropped connection and when the tab comes back into view.'],
  ['candle', 'pro', 'Confirming-candle state', 'The chip reads "Confirming live candle…" while the newest candle exists only from ticks.'],

  /* market structure */
  ['struct', 'free', 'HH / HL / LH / LL swings', 'Labelled on the candles as they form.'],
  ['struct', 'pro', 'Break of structure (BOS)', 'Continuation breaks, marked on the candle that did it.'],
  ['struct', 'pro', 'Change of character (CHoCH)', 'The reversal break, which is the one that matters after a sweep.'],
  ['struct', 'pro', 'Support and resistance zones', 'Clustered swing points carrying a swing count, a ⇅ flip marker, how many times they have been tested, and a fresh flag when price has not returned yet.'],
  ['struct', 'pro', 'Demand and supply order blocks', 'The candle range institutional orders were filled from, drawn until it is consumed.'],
  ['struct', 'pro', 'Fair value gaps', 'Open FVGs with their 50% line and a live fill percentage.'],
  ['struct', 'pro', 'Equal highs and equal lows', 'The classic resting-stop pool, marked as EQH ×2 / EQL ×2.'],
  ['struct', 'pro', 'Liquidity sweeps', 'Where price poked through a level and reversed — liquidity taken.'],
  ['struct', 'pro', 'Premium / discount zones', 'Which half of the dealing range price is working in.'],
  ['struct', 'pro', 'Higher-timeframe zone overlay', 'Lay 1H / 4H / 1D / 1W zones over a lower-timeframe chart from the MTF tab.'],
  ['struct', 'pro', 'Trade plan with R:R grade', 'Entry zone, a stop at least 0.5 ATR clear, targets with R-multiples, an A/B/C grade on reward-to-risk, a higher-timeframe alignment check and the risk per lot.'],
  ['struct', 'pro', 'Bias score', 'Structure, DMI when ADX confirms a trend, volume confirmation, and the next higher timeframe at double weight.'],

  /* stop hunts */
  ['levels', 'pro', 'Stop-loss liquidity zones', 'Where retail stops actually rest — below swing lows, equal lows and prior session lows for longs, above the mirror highs for shorts.'],
  ['levels', 'pro', '★ stop score, 0–100', 'How many stops are likely waiting, raised by equal highs/lows, a major swing, a prior day/week/month level, a round number, high volume and age.'],
  ['levels', 'pro', 'Hunt zone from this chart\'s own history', "The band runs from the level to where 75% of this symbol's past raids turned; the dotted line marks the 90% point. Measured in ATR over up to 3,000 candles, so it adapts per symbol and timeframe."],
  ['levels', 'pro', 'Hunt versus genuine break', 'A raid counts as a hunt only if price closes back inside within 3 candles and then moves at least 1 ATR away. Otherwise it is recorded as a real break.'],
  ['levels', 'pro', 'Live raid banner', 'While price is through a level it tells you the exact close that would confirm the hunt, then shows the invalidation level once reclaimed.'],
  ['levels', 'pro', 'Reach %', "The chance price trades to a level within about one session, from this chart's own distribution of moves."],
  ['levels', 'pro', 'Draw on liquidity', 'Which side price is most likely to hunt next.'],
  ['levels', 'pro', 'Hunt-safe stop', 'If a trade plan\'s stop sits inside a stop cluster, the plan offers a replacement beyond the 90% line.'],

  /* levels */
  ['levels', 'pro', 'One scored line per price', 'No boxes. Green below the last price, red above it, thickness by strength.'],
  ['levels', 'pro', 'Votes merge, weights add', 'Sources within 0.15 ATR collapse into one line that keeps the sum of their weights, so the label names every reason behind it.'],
  ['levels', 'pro', 'Labelled sources', 'EQH / EQL, "4 taps", Swept H/L, Hunt H/L, Day H/L/O, PDH/PDL/PDC, PWH/PWL, PMH/PML, Stops ★nn, POC and HVN.'],
  ['levels', 'pro', 'Today and yesterday always drawn', "Day H/L/O and PDH/PDL/PDC are pinned whatever else wins on score."],
  ['levels', 'pro', 'Noise control', 'Levels beyond 12 ATR are dropped and two lines never land within 0.35 ATR of each other. Both adjustable.'],
  ['levels', 'pro', 'Works where there is no volume', "Every line comes from the chart's own swings, sweeps and session boundaries — so it behaves identically on NIFTY 50 and SENSEX, which carry no volume at all."],
  ['levels', 'pro', 'Previous day / week / month levels', 'Highs, lows and closes from official daily bars.'],
  ['levels', 'pro', 'Floor pivots, CPR and Camarilla', 'H3/H4/L3/L4 with optional H5/L5 and the inner levels.'],
  ['levels', 'pro', 'Session breaks', 'Where one session ends and the next begins, drawn on intraday charts.'],
  ['levels', 'pro', 'Opening range', 'First 5, 15, 30 or 60 minutes, with the breakout marked only on a closed candle.'],
  ['levels', 'pro', 'Anchored VWAP, up to three', 'Week, month, swing or BOS presets, or Alt+A on any candle you choose.'],

  /* golden volume profile */
  ['gvp', 'pro', "TradingView's own profile rules", "Rows, value area and POC computed the way TradingView documents them, from the session's 1-minute candles."],
  ['gvp', 'pro', 'Verified against a real TradingView chart', 'Checked against an EIMC-DATA TradingView screenshot of NIFTY 50 on 19 Oct 2026: every row within 0.6 px, same POC row, same value-area edge.'],
  ['gvp', 'pro', 'Yesterday carried into today', "The previous session's profile, POC and zones are drawn forward to the next session's close."],
  ['gvp', 'pro', 'HVN zones', 'A peak holding at least 25% of the POC\'s volume and standing 15% above its saddle — an area the market accepted.'],
  ['gvp', 'pro', 'LVN zones', 'A trough at least 8% below its lower wall and at most half the POC — thin trade, where price tends to move fast.'],
  ['gvp', 'pro', 'Configurable rows and value area', 'Row count (default 100), value area (default 70%), start at the open or 15 minutes later, width and zone sensitivity.'],
  ['gvp', 'pro', 'Session stepper', 'The gold chip walks back through every session on the chart; click the date to return to the latest.'],
  ['gvp', 'pro', 'Computed once per session', 'A finished session never changes, so each is computed once and cached.'],
  ['gvp', 'pro', 'Replay-safe', 'In a bar replay, only sessions that closed before the replay clock can be read.'],

  /* order book, heatmap, flow */
  ['depth', 'pro', '200-level order book', "EIMC-DATA's deepest feed, falling back to 20 levels then 5 if a socket is unavailable."],
  ['depth', 'pro', 'Order-book density on the chart', 'One horizontal band per price level hugging the right edge, whose length and opacity both grow with the quantity resting there. Walls keep their price line and label.'],
  ['depth', 'pro', 'Independent of the panel', 'The density map keeps working with the Book tab closed.'],
  ['depth', 'pro', 'Liquidity heatmap, Bookmap-style', 'Resting orders over time, so you can see a wall build and then get eaten.'],
  ['depth', 'pro', 'Order flow and footprint', 'Per-price traded volume and delta, ATAS-style.'],
  ['depth', 'pro', 'The book recorded every second', 'EIMC-DATA keeps no order-book history, so EIMC records its own — once a second, 09:00 to 15:35 IST on market days, whether the app is open or not.'],
  ['depth', 'pro', 'Five sessions kept', 'A week of recorded liquidity on disk, replayable.'],
  ['depth', 'pro', 'Depth for NIFTY 50, which has no book', "The near-month future's 200-level book, shifted onto the index chart by the basis."],
  ['depth', 'pro', 'Up to six options recorded', 'Pick them in the option chain. Up to five books record 20 levels; the instruments EIMC streams deep record 200.'],
  ['depth', 'pro', 'Depth sockets are our job', "The exchange data provider limits how many depth feeds one account may hold. EIMC's market-data server holds them and shares each book with everyone watching it, so there is nothing to juggle on your PC."],
  ['depth', 'pro', 'Resting buy versus sell pressure', 'Across the five depth levels, per option leg, in the chain.'],

  /* options */
  ['options', 'pro', 'The full chain, every five seconds', 'Calls, strike, puts for one expiry, refreshed every 5 s while the market is open.'],
  ['options', 'pro', 'Two endpoints merged', "The option-chain API for OI, volume and greeks, and the market-quote API for everything the chain leaves out — so each row carries what the exchange actually reports."],
  ['options', 'pro', 'Open interest with walls marked', 'OI with its bar, and R / S on the biggest call and put wall in view.'],
  ['options', 'pro', 'Buildup read per strike', 'LB long buildup, SB short buildup, SC short covering, LU long unwinding — coloured by what it means for the underlying.'],
  ['options', 'pro', 'Volume ÷ OI', 'How much of the position was churned today.'],
  ['options', 'pro', 'Bid, ask and spread %', 'With a bar of resting buy versus sell quantity across five depth levels.'],
  ['options', 'pro', 'Day range with position %', "Today's low to high with the open marked and the last price as a dot — 97% means it is trading at the top of the day's range."],
  ['options', 'pro', 'Time value and breakeven', 'What is left in the premium, and where the trade breaks even at expiry.'],
  ['options', 'pro', 'Premium sparkline', "Today's 1-minute premium path, per strike."],
  ['options', 'pro', 'IV skew', 'Put IV minus call IV. Positive means the market is paying up for downside protection.'],
  ['options', 'pro', 'PCR by OI and by volume', 'Both, because they disagree and the disagreement is the signal.'],
  ['options', 'pro', 'Max pain and total OI', 'With the change on the day.'],
  ['options', 'pro', 'Expected move', 'From the ATM straddle, in points and as an implied range by expiry.'],
  ['options', 'pro', 'Chain bias score', "Every strike's buildup weighted by the open interest it actually moved."],
  ['options', 'pro', 'Four mini charts', 'The underlying today, OI by strike with the top support and resistance named, OI change today, and the IV smile.'],
  ['options', 'pro', 'Full strike panel', 'Click a strike for both legs: intraday premium chart, O/H/L/PC, day VWAP and distance from it, day swing %, turnover, OI with its own day range, all five greeks, intrinsic and time value, breakeven, moneyness, premium as % of spot, resting quantity with a pressure read, cost per lot, circuit limits, last trade time and the 5-level book.'],
  ['options', 'pro', 'Column groups you choose', 'Turn groups on and off in the Columns bar; the choice is remembered.'],
  ['options', 'pro', 'Option flow, scored 0–100', 'Call buyers, call sellers, put buyers and put sellers, each scored across the ATM strike and one either side.'],
  ['options', 'pro', 'Premium change as an input', 'Buyers push premiums up, writers press them down.'],
  ['options', 'pro', 'Trend steadiness as an input', "R² of today's 1-minute premium path — a straight, one-way move means one side is in control."],
  ['options', 'pro', 'Delta check as an input', 'What the index move alone should have done to each premium, from delta, gamma and decay, against what it actually did. Calls flat in a rally means writers are absorbing it.'],
  ['options', 'pro', 'Open interest as an input', 'Fresh positions versus the other side closing out.'],
  ['options', 'pro', 'Bull and bear camps', 'Call buyers plus put sellers against put buyers plus call sellers, with a verdict, 30-minute change, a session chart, the evidence table and the reasons in plain words.'],
  ['options', 'pro', 'Refreshes every 30 seconds', 'And you can switch expiry with one button.'],

  /* DQRS */
  ['dqrs', 'pro', 'Four-axis scorecard', 'Direction (trend agreement), Quality (what else is at that level), Risk (a stop clear of noise and what it buys) and Signal (how convincing the trigger candle is).'],
  ['dqrs', 'pro', 'SWEEP', 'A swing high or low is taken out, then price closes back inside within 3 candles.'],
  ['dqrs', 'pro', 'REJECT', 'Price tags a level and closes away from it, having left a long wick.'],
  ['dqrs', 'pro', 'RETEST', 'After a break of structure, price returns to the broken level and holds it.'],
  ['dqrs', 'pro', 'ORB', 'The opening range breaks and the candle closes beyond it.'],
  ['dqrs', 'pro', 'PULLBACK', "With the trend, a pullback into EMA 21 or 50 closes back the trend's way."],
  ['dqrs', 'pro', 'Hit rates are measured, not claimed', 'Each rule has fixed entry, stop and target arithmetic, so every past occurrence is replayed forward over 60 candles — stop first when one candle covers both, the conservative reading — to see which came first.'],
  ['dqrs', 'pro', 'Measured on your symbol and timeframe', 'Not on a vendor backtest of something else.'],
  ['dqrs', 'pro', 'Live setups drawn on the chart', 'With their exact entry, stop and target, labelled like "A SWEEP ▲ 3.0R".'],
  ['dqrs', 'pro', 'Past setups marked by outcome', '✓ where target came first, ✗ where the stop did.'],
  ['dqrs', 'pro', 'Protected geometry', 'A stop closer than 0.5 ATR is widened, and the target must be an opposing swing worth at least 1.2 R.'],
  ['dqrs', 'pro', 'Grade filter', 'Show A only, A and B, or everything.'],
  ['dqrs', 'pro', 'Costs nothing when off', 'The forward test only runs while the mode is on.'],

  /* replay */
  ['replay', 'free', 'Replay any candle forward', 'Click the candle to start from, or use Random or Date. That candle and everything after it are hidden.'],
  ['replay', 'free', 'Provably blind to the future', 'The server returns no candle after the replay clock, and the analysis only runs on candles up to it. A test corrupts every candle and tick after the clock and checks the chart payload and MTF table stay byte-identical.'],
  ['replay', 'free', 'The same pipeline as live', 'Replay ticks go through the live tick stream, candle builder, indicator engine, reconciler, order lines and paper fills — so a replay is not a separate, friendlier code path.'],
  ['replay', 'pro', 'Intra-bar formation', 'Each candle forms tick by tick from lower-timeframe data: 1m for charts up to 25m, 5m for 1H–4H, 15m for 1D, daily for 1W and 1M.'],
  ['replay', 'free', 'Speed 1× to 1800×, or Max', 'Of market time. Space plays and pauses, Shift+→ finishes the candle, Shift+← hides it again.'],
  ['replay', 'free', 'Keeps your place', 'Change timeframe or symbol and the replay moment is preserved. It pauses itself when you switch browser tabs.'],
  ['replay', 'free', 'Paper trading with a scorecard', 'Trades, win rate and P&L, filling at the replay\'s prices. No real order is ever sent.'],
  ['replay', 'free', 'No leaking the hidden future', 'Open replay trades are closed at the current price when you rewind or jump.'],
  ['replay', 'free', 'Live-only data hidden', 'Watchlist quotes, the option chain and the order book disappear during a replay, so nothing leaks from the present.'],

  /* trading */
  ['trade', 'free', 'Paper trading only', 'EIMC never sends an order to a broker. Every trade is a paper trade, on live prices with Pro and in bar replay.'],
  ['trade', 'free', 'A scorecard that keeps you honest', 'Trades, win rate and P&L for every paper trade, so practice is measured, not remembered.'],
  ['trade', 'free', 'Targets and stops in one click', 'Set a target and a stop with the entry; both appear on the chart and close the paper trade when hit.'],
  ['trade', 'free', 'Rounding that favours you', 'The target rounds up to the tick, so a 0.20% target is never 0.19%. The stop rounds toward entry, so the loss never exceeds your stop %.'],
  ['trade', 'free', 'Drag to modify', 'Drag the TP/SL lines or a pending limit line to change the paper order; ✕ exits or cancels.'],
  ['trade', 'free', 'Position lines on the chart', 'Average shows your position average, Last fill shows the latest fill with its TP/SL.'],
  ['trade', 'free', 'Quantity remembered per symbol', 'And your last-used order settings come back with you.'],
  ['sys', 'free', 'Sign-in kept in Windows Credential Manager', 'Through keyring — not a config file in the install folder.'],
  ['sys', 'free', 'The server is local-only', 'It refuses any request arriving with a Host or Origin header other than its own, so nothing on the network can talk to it.'],
  ['sys', 'pro', 'Shared, cached market data', "Candles, quotes and the option chain are fetched once and shared across customers, inside the data provider's published limits."],
  ['sys', 'pro', 'Signed in, and staying signed in', 'Your licence renews by itself in the background. A dropped connection never signs you out: the last licence keeps working for up to a day.'],
  ['sys', 'pro', 'Entitlement decided server-side', 'Signed into the token; the app only reads back what was verified. Nothing in the interface is what unlocks a feature.'],
  ['sys', 'free', 'Uncapped rendering', 'Up to 144 FPS, with no shadowBlur and no CSS filters in a hot path, gradients cached and rebuilt only on resize, and every animation loop suspended off-screen.'],
  ['sys', 'free', 'Demo data generator', 'The whole terminal, every mode, running on synthetic data with no account, no card and no expiry.'],
];

/* ── rendering ──────────────────────────────────────────────────── */
const TIER = {
  free:  { label: 'Free',  cls: 'free'  },
  pro:   { label: 'Pro',   cls: 'pro'   },
};

/* Search keys are read back off the rendered DOM rather than built
   into an attribute. textContent gives us the text a reader actually
   sees — entities already decoded, markup already gone — so there is
   no escaping to get wrong and no way for "&rsquo;" or a stray quote
   to end up in the index. Non-breaking spaces are folded to ordinary
   ones so typing "1 s" finds "1 s". */
const norm = s => s.toLowerCase().replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

/**
 * The searchable inventory. Renders the filter chips, the live search
 * box and the grouped list, then wires filtering entirely in the DOM
 * (no re-render churn — we toggle a hidden class, so typing stays
 * smooth with ~180 rows on the page).
 */
export function renderInventory(host) {
  if (!host) return;

  const byGroup = GROUPS.map(g => ({
    ...g,
    items: ITEMS.filter(i => i[0] === g.id),
  })).filter(g => g.items.length);

  host.innerHTML = `
    <div class="inv-bar">
      <div class="inv-search">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
        <input type="search" id="inv-q" placeholder="Search ${ITEMS.length} capabilities — try &ldquo;stop hunt&rdquo;, &ldquo;expiry&rdquo;, &ldquo;200&rdquo;, &ldquo;replay&rdquo;" autocomplete="off" spellcheck="false">
        <button type="button" class="inv-clear" id="inv-clear" aria-label="Clear">&times;</button>
      </div>
      <div class="inv-chips" id="inv-tiers">
        <button type="button" class="on" data-tier="all">All tiers</button>
        ${Object.entries(TIER).map(([k, v]) => `<button type="button" data-tier="${k}">${v.label}</button>`).join('')}
      </div>
    </div>
    <div class="inv-count" id="inv-count"></div>
    <div class="inv-groups">
      ${byGroup.map(g => `
        <section class="inv-g" data-g="${g.id}">
          <div class="inv-gh">
            <h3>${g.name}</h3>
            <p>${g.note}</p>
            <span class="inv-gn num">${g.items.length}</span>
          </div>
          <div class="inv-list">
            ${g.items.map(([, t, name, desc]) => `
              <div class="inv-i" data-t="${t}" data-g="${g.id}">
                <span class="inv-t ${TIER[t].cls}">${TIER[t].label}</span>
                <div class="inv-c"><b>${name}</b><p>${desc}</p></div>
              </div>`).join('')}
          </div>
        </section>`).join('')}
    </div>
    <p class="inv-none" id="inv-none">Nothing matches that. Every line in this list is a shipped behaviour &mdash;
      if you were looking for something specific and it is not here, it is worth asking before you buy.</p>`;

  const q      = host.querySelector('#inv-q');
  const clear  = host.querySelector('#inv-clear');
  const chips  = host.querySelector('#inv-tiers');
  const count  = host.querySelector('#inv-count');
  const none   = host.querySelector('#inv-none');
  const items  = [...host.querySelectorAll('.inv-i')];
  const groups = [...host.querySelectorAll('.inv-g')];

  let tier = 'all';

  /* index once, off the rendered text, plus the group name so
     "options" finds the whole Options section */
  const GNAME = Object.fromEntries(GROUPS.map(g => [g.id, g.name]));
  const keys = new WeakMap();
  items.forEach(el => keys.set(el, norm(`${el.textContent} ${GNAME[el.dataset.g] || ''}`)));

  const apply = () => {
    /* Match every word, not the phrase. Someone typing "stop hunt"
       means both words, and the text that answers them reads
       "...counts as a hunt only if..." three sentences from
       "...where retail stops rest...". A contiguous substring search
       returns nothing for the most obvious query on the page, which
       makes the box look broken. */
    const words = norm(q.value).split(' ').filter(Boolean);
    let shown = 0;

    items.forEach(el => {
      const okTier = tier === 'all' || el.dataset.t === tier;
      const k = keys.get(el);
      const okText = words.every(w => k.includes(w));
      const ok = okTier && okText;
      el.classList.toggle('off', !ok);
      if (ok) shown++;
    });

    // a group with nothing left in it collapses away entirely
    groups.forEach(g => {
      const live = [...g.querySelectorAll('.inv-i')].filter(i => !i.classList.contains('off')).length;
      g.classList.toggle('off', !live);
      g.querySelector('.inv-gn').textContent = live;
    });

    host.classList.toggle('empty', shown === 0);
    clear.classList.toggle('on', !!q.value);
    count.innerHTML = shown === ITEMS.length
      ? `<b class="num">${ITEMS.length}</b> capabilities, every one of them shipped`
      : `<b class="num">${shown}</b> of <span class="num">${ITEMS.length}</span> capabilities`;
    none.style.display = shown === 0 ? '' : 'none';
  };

  q.addEventListener('input', apply);
  clear.addEventListener('click', () => { q.value = ''; q.focus(); apply(); });
  chips.addEventListener('click', e => {
    const b = e.target.closest('button[data-tier]');
    if (!b) return;
    tier = b.dataset.tier;
    [...chips.children].forEach(c => c.classList.toggle('on', c === b));
    apply();
  });

  apply();
}
