'use strict';
/* ════════════════════════════════════════════════════════════════════
   ONE SESSION, 09:00 TO AFTER THE CLOSE

   A feature list asks the reader to imagine how the parts fit
   together. A timeline does that work for them, and it is also the
   only honest way to show the two things about EIMC that no screenshot
   can: that it starts working fifteen minutes before the market opens,
   and that it keeps working after it shuts.

   Every entry is a real behaviour with its real clock time, taken from
   the product's own documentation — the recorder window is literally
   09:00–15:35 IST, the chain really does refresh on five seconds, the
   reconciler really does re-check at 1 s, 6 s and 20 s.

   The `tier` field is honest about what a given moment needs, because
   a timeline that quietly shows Elite behaviour as though it were
   included in Free would be the worst kind of overselling.
   ════════════════════════════════════════════════════════════════════ */

export const SESSION = [
  {
    t: '09:00', tag: 'Before you are awake', tier: 'pro',
    h: 'The recorder is already running',
    d: 'Fifteen minutes before the open, EIMC starts taking a snapshot of the near-month '
     + 'future&rsquo;s 200-level order book every single second &mdash; whether the app is open in a '
     + 'browser or not. EIMC-DATA keeps no order-book history, so if EIMC does not record it, '
     + 'nobody does and it is gone.',
    k: ['200 levels', 'Every 1 s', 'App closed is fine'],
  },
  {
    t: '09:15', tag: 'The open', tier: 'pro',
    h: 'Yesterday is already drawn on today',
    d: 'The previous session&rsquo;s volume profile is on the chart before the first candle forms &mdash; '
     + 'its POC, its accepted areas and its thin ones, carried forward into today&rsquo;s space. '
     + 'You are not waiting for the day to build structure; you start with the map the last '
     + 'session left behind.',
    k: ['POC carried', 'HVN / LVN', "TradingView's rules"],
  },
  {
    t: '09:16', tag: 'First ticks', tier: 'pro',
    h: 'And the candles are already being checked',
    d: 'Every close is re-read against EIMC-DATA&rsquo;s own candles at 1&nbsp;s, 6&nbsp;s and 20&nbsp;s, then '
     + 'every 30&nbsp;s until EIMC-DATA has it. Requests use the exchange clock rather than your PC clock. '
     + 'The chip in the status bar tells you exactly how stale the newest candle is, '
     + 'instead of letting you assume.',
    k: ['1 s · 6 s · 20 s', 'Exchange clock', 'No dropped ticks'],
  },
  {
    t: '09:30', tag: 'Opening range closes', tier: 'pro',
    h: 'The ORB arms itself, on a closed candle',
    d: 'The first fifteen minutes become a level, and the breakout only marks when a candle '
     + '<b>closes</b> beyond it &mdash; not when a wick pokes through it. That one rule is the '
     + 'difference between a signal and a tease.',
    k: ['5 / 15 / 30 / 60 min', 'Close-confirmed'],
  },
  {
    t: '09:45', tag: 'Options come alive', tier: 'pro',
    h: 'The chain, and what it is telling you',
    d: 'Every five seconds: open interest with the walls marked, buildup per strike, IV skew, '
     + 'PCR by OI and by volume, max pain, and the expected move from the ATM straddle. '
     + 'Not a table to read &mdash; a verdict, with the evidence under it.',
    k: ['Refresh 5 s', 'IV skew', 'Expected move'],
  },
  {
    t: '10:10', tag: 'The map fills in', tier: 'pro',
    h: 'Stop pools get scored before price goes near them',
    d: 'Equal lows, yesterday&rsquo;s low, the session low &mdash; each scored &#9733;&nbsp;0&ndash;100 for how '
     + 'many stops are likely resting there, with a hunt band measured from this chart&rsquo;s own '
     + 'history of raids. The zone exists on the chart <b>before</b> the raid, which is the only '
     + 'time it is worth anything.',
    k: ['★ 0–100', '75% / 90% bands', 'Per symbol'],
  },
  {
    t: '11:05', tag: 'It happens', tier: 'pro',
    h: 'The low breaks, and the chart says &ldquo;hunt&rdquo;',
    d: 'Price takes the pool and closes back inside within three candles, then moves more than '
     + '1 ATR away. The engine calls that a hunt rather than a break, marks the invalidation, '
     + 'and DQRS writes up a SWEEP with its entry, stop and target &mdash; graded, with a hit rate '
     + 'measured on this symbol over 60 candles a trade.',
    k: ['SWEEP', 'Graded A/B/C', 'Measured, not claimed'],
  },
  {
    t: '12:40', tag: 'The dull hours', tier: 'pro',
    h: 'A wall builds where nothing seems to happen',
    d: 'The heatmap is the only thing on the screen doing anything at lunch: resting sell '
     + 'quantity stacking at one price, visible for forty minutes before it matters. '
     + 'When it is finally eaten, you already knew its size.',
    k: ['Bookmap-style', 'Recorded', 'Replayable'],
  },
  {
    t: '14:15', tag: 'The read changes', tier: 'pro',
    h: 'Call writers stop pressing',
    d: 'Option flow scores call buyers, call sellers, put buyers and put sellers 0&ndash;100 from '
     + 'premium change, the R&sup2; steadiness of today&rsquo;s path, a delta check against what the '
     + 'index move alone should have done, and open interest. When the writers step back, '
     + 'the card says so and shows you which of the four inputs moved.',
    k: ['Four inputs', 'Every 30 s', '30-min change'],
  },
  {
    t: '15:30', tag: 'The close', tier: 'pro',
    h: "Today's levels become tomorrow's",
    d: 'The day&rsquo;s high, low and open are pinned, the official daily bar settles them, and the '
     + 'profile for the session you just traded is computed once and kept. Tomorrow opens with '
     + 'today already drawn on it.',
    k: ['Official daily bars', 'Pinned levels'],
  },
  {
    t: '15:35', tag: 'Recording stops', tier: 'pro',
    h: 'And five sessions stay on disk',
    d: 'A week of second-by-second order book, yours to scroll back through. The wall from '
     + 'Tuesday is still there on Friday, with the tape that ate it.',
    k: ['5 sessions kept', 'Second by second'],
  },
  {
    t: 'After', tag: 'The market is shut', tier: 'free',
    h: 'So you practise on it instead',
    d: 'Bar replay runs today&rsquo;s tape forward at up to 1800&times;, each candle forming tick by '
     + 'tick from lower-timeframe data, through the same pipeline as live. Nothing after the '
     + 'replay clock is readable &mdash; a test corrupts every future candle and proves the payload '
     + 'stays byte-identical. When an indicator is wrong in replay, it would have been wrong live.',
    k: ['1× – 1800×', 'Provably blind', 'Paper scorecard'],
  },
];

const TIER = { free: 'Free', pro: 'Pro' };

export function renderSession(host) {
  if (!host) return;

  host.innerHTML = `
  <ol class="ses">
    ${SESSION.map((s, i) => `
      <li class="ses-i" data-i="${i}">
        <div class="ses-t">
          <b class="num">${s.t}</b>
          <span>${s.tag}</span>
        </div>
        <div class="ses-c">
          <div class="ses-h">
            <h3>${s.h}</h3>
            <span class="ses-tier ${s.tier}">${TIER[s.tier]}</span>
          </div>
          <p>${s.d}</p>
          <div class="ses-k">${s.k.map(k => `<span>${k}</span>`).join('')}</div>
        </div>
      </li>`).join('')}
  </ol>`;

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    host.querySelectorAll('.ses-i').forEach(el => el.classList.add('lit'));
    return;
  }

  /* Light each entry as it reaches the upper third of the viewport,
     and leave it lit — a timeline that dims again on the way back up
     reads as broken rather than as an effect. */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('lit'); io.unobserve(e.target); }
  }), { threshold: 0.3, rootMargin: '0px 0px -12% 0px' });

  host.querySelectorAll('.ses-i').forEach(el => io.observe(el));
}
