# EIMC Terminal — product website

Static marketing and checkout site for **EIMC Terminal v1.25.218.93**.

Hand-written HTML, CSS and vanilla ES modules. **No build system** — no `package.json`,
no bundler, no install step. EIMC's own frontend is also plain ES modules with no bundler,
which is what lets the product's boot animation be used completely unmodified.

## Run it locally

```sh
python -m http.server 8000
```

Then open <http://127.0.0.1:8000>. Opening over `file://` will **not** work: the boot splash
uses ES modules and a Web Worker, and both need a real origin.

## Deploy

Push to GitHub, import on Vercel, framework preset **Other**, no build command, output
directory = repo root. `vercel.json` only adds security headers and cache rules.

---

## Design system

**The site wears the product's own colours.** The palette is lifted from the app's
`static/css/app.css` tokens and from what it actually paints in the screen recordings, so a
visitor who watches the hero video and then scrolls never feels they left the app. (The
earlier warm gold theme is kept in `_backup-gold-theme-2026-11-17/`, which is not deployed.)

| | |
|---|---|
| **Ground** | navy-black `--ink #06080d` → `#0a0e15` → `#101622` → `#1a2231` → `#263044` — the app's `--bg-0…4` |
| **Text** | `#eef1f7`, then `#c3cad7`, `#8691a5`, `#5b6578` — the app's `--text-0…3` |
| **Accent** | the app's electric blue `#4c7dff` (`--gold*` variables keep their old names; they are the accent slot). Buttons use `--metal`, a blue sheen `#2f5ae6 → #4c7dff → #7aa2ff`. The `<em>` payoff in a heading uses `--aurora` (blue → cyan `#38bdf8` → violet `#b39dff`) drifting slowly. |
| **Also from the app** | cyan `#38bdf8`, violet `#8b5cf6`, bull teal `#22d3a6`, bear red `#f23645`, heatmap orange `#ff8c2a` |
| **Hairlines** | `rgba(196,212,240,.14)` and `.07` |
| **Typeface** | **Arimo**, self-hosted from `/fonts`, Apache-2.0, variable 400–700. Nothing is faux-bolded. |
| **Numbers** | JetBrains Mono, **only** in data grids — chart axes, option chain, depth ladder, countdown digits, FPS readout, inline code |
| **Texture** | a 40px cool grid (`.grid-tex`), radially masked so it fades out |

Teal and red mean bull and bear, exactly as in the app; they are not used as decoration.
The golden volume profile stays gold inside the replicas, because in the product it is gold.

## Real media (`css/media.css`, `js/media.js`, `/media`)

| Where | What |
|---|---|
| Home hero | `media/hero.mp4` in a golden split: the rounded "EIMC Terminal" window at 61.8 % of the screen, title and buttons in the 38.2 % beside it. It rises in once and settles flat; the ambient glow (sampled from the video), running border light, grid floor, reflection and a guided tour of six real screen areas sit around it, never moving or resampling it. |
| Features → *Watch it work* (`#watch`) | Videos (REC 01 order book, REC 05 option chain) at 61.8 % in rounded cards; screenshots (SHOT 04 golden-profile plan, SHOT 06 smart money, SHOT 07 indicators, SHOT 08 replay) full-width at 1:1; all with text below. REC 02 option flow (372×858) and SHOT 03 bias (363×548) at 1:1 beside their copy. Frames never move; the border light, breathing glow and bobbing labels (under the picture) carry the motion. Clips load only when their block approaches and play only while visible. |

**Gallery.** Clicking any showcase frame, or its "Wide view" button, opens a gallery. The screen assembles in a circle spreading from the point you clicked. Particles sampled from its own pixels burst out and settle while it sharpens out of a blur and fades in, and it dissolves in a circle from the point you click. ‹ › and the arrow keys step through the screens, and one click anywhere (or Esc) closes it. Key 1 shows true pixels (`gallery()` in `js/media.js`).

The particles are tiny (most are one screen pixel, some a little larger), and there are up to about 400–550 thousand per picture. They run on the graphics chip (WebGL 2). Each particle's path is computed in a shader, and its colour comes straight from the picture. While the picture moves, a shader also draws its ring, blur and fade. The real `<img>`/`<video>` waits hidden underneath and takes over, pixel-exact, for the last stretch. Screenshots are decoded and uploaded while the page is idle, so a click never waits on a decode. If frames are missed, the next animation uses fewer particles. Without WebGL 2, a canvas fallback draws a few thousand particles and uses CSS mask and blur.


**Sharpness rule.** Every recording and screenshot is a `[data-px]` element with its source size in `--nw`/`--nh`. `js/media.js` sizes it to source pixels ÷ devicePixelRatio and nudges it onto whole device pixels; it falls back to fit-to-width only on screens narrower than the source. Never put a transform, float, tilt or pixel-altering overlay on the media itself. Verified by screenshotting the page and finding `bias.png` and `gvp-plan.png` in it with 100.00% identical pixels.

The raw files live in `MEEEEDIAAA/` (excluded from deploys by `.vercelignore` and from git).
`media/*.mp4` are encoded with `python tools/encode_media.py` (native resolution, CRF 16–17, SSIM ≥ 0.995 against the originals): hero 8.5 MB (first 40 s), order book 9.5 MB, option flow 2.9 MB, option chain 7.9 MB, liquidity heatmap 7.6 MB, footprint & delta 15.2 MB. Re-run it after replacing a recording; tune segments and quality in its `JOBS` table.

The palette still comes from `/static/css/boot.css` for anything the product owns. **The
boot splash is unaffected by the site theme**: `.boot-word`, `.boot-sub` and `.boot-status`
pin `--font-ui` (Inter) and `--font-num` themselves inside that copied file, and
`css/site.css` never redefines those variables.

## Interactions (`js/fx.js`)

Eight behaviours, all opt-in from markup, all no-ops when their element is absent:

| Hook | What it does |
|---|---|
| `[data-field]` | atmosphere canvas — drifting blue, cyan and violet nebula + dust, with pointer parallax |
| `.track` / `.spot` | pointer-following blue wash, and a card border that lights where the cursor is. JS writes `--mx`/`--my`; CSS does all the painting. |
| `[data-countdown]` | days / hours / minutes / seconds to a date; `[data-cd-compact]` gets `16d 11:48:24` |
| `[data-tabs]` | scroll-synced feature switcher — the active tab follows the viewport centre and the media panel cross-fades |
| `[data-lens]` | magnifier that follows the pointer over the terminal, showing a 2.1× clone |
| `[data-ring]` | SVG dial that fills and counts up when it scrolls into view |
| `[data-perks]` | stacked copy blocks that light as they pass the viewport centre |
| `#topbar` | floating pill bar that arrives once the hero is behind you |

Performance rules are the product's own: no `shadowBlur`, no CSS `filter` in a hot path,
gradients cached and rebuilt only on resize, every rAF loop suspended off-screen, and
pointer handlers writing custom properties rather than styles.

## Layout

```
index.html          Home — the conversion path, in order:
                      hero → figures → X-RAY → the three losses → what is inside
                      (six cards linking into features.html) → points calculator
                      → rivals → accuracy → pricing → objections → founder's note
                      → close. Feature detail lives only on features.html.
why.html            Why EIMC — the thesis, the rival comparison, the claim table
                    (each number and the test file behind it), what we will NOT claim,
                    and an honest "buy something else if" list
features.html       Watch it work (3 recordings, 5 screenshots), the four modes in depth, DQRS,
                    levels, replay, chain, flow, trading, insights, NIFTY depth,
                    one session, and the searchable inventory
performance.html    Rendering notes, the full figures table, live FPS meter
pricing.html        Four tiers, monthly/yearly, points calculator, rival prices,
                    capability matrix, licensing, FAQ
download.html       Install, connect Dhan, keyboard, requirements
offer.html          Launch offer — countdown, perks, ring gauge, limited quantity, FAQ
buy.html            Checkout (placeholder — see below)

static/             COPIED VERBATIM FROM THE PRODUCT. Do not rename this folder.
  css/boot.css        extracted rule-for-rule from the app's css/app.css
  js/*.js             theme · mark · launch · launch.worker · logo · modeviz
  vendor/fonts/       Inter · JetBrains Mono · Jost · Instrument Serif (SIL OFL 1.1)

css/site.css        the site's own design system
css/convert.css     the conversion layer's components, kept apart from the design
                    system so a change to how the site SELLS cannot break how it LOOKS
js/boot.js          mounts the EIMC mark (no splash)
js/ui.js            the product UI replicas — chart, depth ladder, option chain
js/fx.js            the interaction layer (table above)
js/site.js          nav, reveal, counters
js/modes.js         the four MODES + long-form copy
js/pricing-data.js  EVERY price and entitlement — the single source of truth
js/pricing.js       plan cards + capability matrix
js/perf.js          the live FPS meter
js/buy.js           the placeholder checkout

                    ── the conversion layer ──
js/market-data.js   competitor prices, NSE lot sizes and the stack argument. Every
                    rival row carries `src` (the page it was read off) and the file
                    carries `checked` (the date). FX rounds AGAINST us on purpose.
js/xray.js          the X-ray: one chart, two layers, a draggable wipe
js/roi.js           the points calculator — what a plan costs in NIFTY points
js/rivals.js        the rival table and the "assemble it yourself" stack
js/session.js       one session, 09:00 to after the close
js/inventory.js     ~167 shipped capabilities, searchable and tier-tagged
```

## No boot splash

The boot splash was removed on 2026-11-18. `js/boot.js` now only draws the EIMC mark (favicon, header, login page, any hero mark). The splash code in `/static/js` is unused.

## The product UI replicas (`js/ui.js`)

The terminal interface rebuilt in HTML and SVG at the product's real colours, so it stays
sharp at any size. Not a mock-up of something that does not exist — every overlay drawn is
one EIMC actually draws: the golden volume profile with POC, HVN and LVN, a break of
structure, a supply order block, a stop-loss liquidity band with its ★ score, and the
200-level depth ladder. The price path is scripted, not random, and tells the product's own
story: drift down, sweep the pool, reverse, break the wall, retest, new high.

Swap in real screenshots later by replacing the `[data-ui="terminal"]` and
`[data-ui="chain"]` mount points.

## Changing prices

Edit `js/pricing-data.js`. Every page reads from it. The capability keys (`charts`,
`replay`, `levels`, `smartmoney`, `setups`, `goldvp`, `optionchain`, `optionflow`, `book`,
`heat`, `live`) are EIMC's own, from `.removed-licensing/license_server/plans.py`, so the
site and the licence server cannot drift apart.

## Still placeholders

| What | Where | To finish |
|---|---|---|
| Payment gateway | `js/buy.js` → `startCheckout()` | Replace that one function body (Razorpay — the licence server already models its subscription states) |
| Installer download | `download.html` → `#dl` handler | Drop `EIMC-Setup-1.25.218.93.exe` in the site root and point the button at it |
| Legal pages | not built | Terms, Privacy and Refund URLs are normally required for Razorpay merchant onboarding |
| **Product screenshots** | `js/ui.js` replicas stand in | **The highest-value thing left.** Capture the four modes + the option chain and swap the mount points. See below. |


## How the home page is meant to sell

The order is deliberate and each block has one job. If you edit the page, keep the job.

| Block | Its one job |
|---|---|
| Hero | Name the pain in the reader's own words, then the mechanism. "You had no instrument that could show it to you." |
| X-ray | **Show, do not tell.** The same seeded candles with the lights off and on. This is the only block that has to work. |
| The three losses | Agitate, but only with things a candle chart *structurally cannot* show: stop pools, resting size, who is winning the chain. |
| Points calculator | Convert ₹ into the only unit a trader thinks in. Pro is ~23 NIFTY points a month; one 30-point stop-out is ₹1,950. |
| Rivals + stack | Answer the price objection with someone else's price list, and with coverage — Bookmap and ATAS do not reach NSE. |
| Accuracy + claim table | Every number names the test file behind it. This is what makes the rest believable. |
| Inventory | ~167 shipped behaviours, searchable. Volume plus specificity; a bluff here would be obvious. |
| Objections | The awkward questions asked properly, including "₹2,999 is a lot" and "who is this not for". |
| Founder's note | The honest first-person reason it exists, and an invitation to disbelieve it. |

Three rules the copy follows, which are worth keeping:

1. **No profit claims, ever.** The arithmetic on the site is about the *cost* of the tool,
   never about returns. There is no equity curve anywhere and there should not be.
2. **No invented social proof.** There are no testimonials, no user counts and no logos,
   because there are no real ones yet. The trust substitutes are the free tier, the
   no-card trial, the named test files and the founder's note.
3. **Every comparative number is checkable.** `js/market-data.js` records where each rival
   price was read and when, and the footnote under the table says so. One wrong figure and
   the whole page stops working.

## The one thing that would most improve this site

**Real screenshots.** There are none in the product repo, so `js/ui.js` draws accurate
replicas at the product's own palette and geometry. They are honest and they look good, but
a trader can tell. Capture these six and the site gets materially more convincing:

| Shot | What must be visible |
|---|---|
| Smart money on NIFTY 50 5m | BOS, CHoCH, a sweep, order blocks, the `STOPS ▼ ★nn` band |
| Liquidity heatmap | A wall building over 30+ minutes, then being eaten |
| Golden volume profile | Yesterday's profile carried onto today, POC + HVN/LVN |
| Option chain, `Alt+O` | The header strip, buildup badges, the four mini charts |
| Option flow card | The 2×2 scores with their 30-minute change |
| Bar replay | The scorecard and the speed control mid-replay |

Drop them in `assets/` and replace the `[data-ui="..."]` mount points. The X-ray in
particular is built to take two real images instead of two SVGs — the wipe does not care
what it is wiping, so `js/xray.js` only needs its two `chartSVG()` calls swapped for
`<img>` tags of the same chart with Modes off and Modes on.

---

Chart engine: [Lightweight Charts](https://github.com/tradingview/lightweight-charts)
© TradingView (Apache-2.0). Trading involves a risk of loss. EIMC is an analysis tool, not
investment advice.

## Accounts (login.html, account.html)

There is no boot splash any more. Visitors land straight on the page, and the header has **Log in** at the top right. Once signed in, that becomes an account menu (initials + plan) with Overview, Subscription, Orders, Support and Log out. The "Start trial" button hides for signed-in customers.

- `login.html`: client ID + password, show/hide, Caps Lock warning, "keep me logged in for 30 days", a slow-down after 5 wrong tries, and `?next=` to return to the page you came from (same-site pages only).
- `account.html`: Overview, Subscription (billing cycle, change plan, cancel/resume), Orders & invoices (printable GST invoice), Payment methods + billing details/GSTIN, Personal info (+ data export), Login & security, Notifications, Licence & devices, Contact support (tickets), and Feature requests (ideas board with votes). Each section has its own link, e.g. `account.html#orders`.
- **Demo data only.** `js/auth.js` holds a dummy backend, and `js/account-data.js` holds one invented customer: client ID `2222004`, password `2222004`, Pro monthly, six days into the month. Edits are saved in the visitor's browser.
- **Going online:** replace `dummyBackend` in `js/auth.js` with an API client that has the same method names. Nothing else changes. The password check, rate limiting and the session token must live on the server; the dummy check in the browser is not security.
- `login.html` and `account.html` are `noindex` and disallowed in `robots.txt`.

## Light theme

Light is the default for a first visit (changed 2026-11-18). The sun/moon button in the header (it replaced "Download free") switches themes and remembers the choice in `localStorage` (`eimc.theme`). A tiny script in every `<head>` applies it before the first paint. The switch reveals the real new page in a circle from the button (View Transitions), so text, images and video change theme as the edge reaches them. The gallery's particle dust (`js/theme-dust.js`) flies off the edge. Without View Transitions it falls back to a dissolving sheet, and without WebGL 2 to a fade. Code: `js/theme-toggle.js`, `js/theme-dust.js`.

How the colours work (`css/site.css`, "LIGHT THEME"):
- Every tint, line, glow and shadow in the CSS is built from colour-channel tokens (`--tint`, `--acc`, `--g0..2`, `--sh`, `--teal-c` …). The light theme moves each one deliberately; it does not invert anything.
- **Ground:** neutrals carry the brand's own blue hue (222°) at low saturation. Paper is `#f3f5f9`, cards are white, and wells are `#e6eaf1`.
- **Depth:** a raised surface is whiter and casts a soft navy-tinted shadow (`--elev`), not a black one.
- **Text:** navy-black `#0e1628` with four lightness steps; secondary text meets 4.5:1 or better on paper.
- **Accent and signals:** the blue deepens to `#2f5ae6` / `#2449c9` so it passes contrast on white. Teal, red, orange, cyan and violet each drop in lightness. Glows become shadows, and the hero's light effects blend in as faint tints (`mix-blend-mode: multiply`).
- **Screens stay dark:** the recordings, gallery, terminal replicas, chips and the login brand panel get the dark tokens back (the `:is(.hx-screen, .sc-frame, …)` rule).
