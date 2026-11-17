'use strict';
/* ════════════════════════════════════════════════════════════════════
   Real media: the hero recording and the features showcase.

     [data-px]           any recording or screenshot. Sized to exactly one
                         source pixel per screen pixel (source / devicePixelRatio)
                         and nudged onto whole device pixels, so UI text is
                         as sharp as in the app. Falls back to fit-to-width
                         only when the screen is narrower than the source.
                         data-px="bleed" may use the full viewport width;
                         data-px="golden" takes 61.8 % of the screen width.
                         See the sharpness rule at the top of css/media.css.
     [data-hero-video]   the home recording. Plays only while the hero is
                         on screen and the tab is visible, feeds the
                         ambient glow, has a pause button, and never
                         autoplays for prefers-reduced-motion.
     .sc                 a showcase block. Its clip is fetched only when
                         the block comes near the viewport, plays only
                         while visible, and drives the playback bar.
     .sc-frame           click (or "Wide view") opens it in the gallery;
                         see gallery() at the bottom.

   Every block gets .live while on screen; css/media.css pauses all of
   its loops without it, so nothing off screen costs a frame.
   ════════════════════════════════════════════════════════════════════ */

const $  = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const play = v => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };

/* ───────────────────────────────────────────────────── exact pixels */
(function exactPixels() {
  const root = document.documentElement;
  const BLEED_CROP = 24;          // px of a full-bleed source we may lose under a scrollbar
  let raf = 0;

  // What the ancestors are doing to the element right now:
  //   'none'      settled: snap both axes
  //   'translate' an entrance sliding it vertically: x is already true, snap
  //               x now and y once it settles
  //   'other'     scaled or rotated (the hero rise-in): wait
  const motion = el => {
    let kind = 'none';
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const t = getComputedStyle(n).transform;
      if (t === 'none') continue;
      const m = new DOMMatrixReadOnly(t);
      if (m.is2D && m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1 && m.e === 0) kind = 'translate';
      else return 'other';
    }
    return kind;
  };
  let retry = 0;

  function run() {
    raf = 0;
    clearTimeout(retry);
    // the gallery covers the page and nothing under it moves: look again once it has closed
    if (root.classList.contains('wv-lock')) { retry = setTimeout(queue, 400); return; }
    let pending = false;
    const dpr = devicePixelRatio || 1;
    root.style.setProperty('--dpr', String(dpr));
    const vw = root.clientWidth;
    const vh = innerHeight;

    for (const el of $$('[data-px]')) {
      const cs = getComputedStyle(el);
      const nw = parseFloat(cs.getPropertyValue('--nw')), nh = parseFloat(cs.getPropertyValue('--nh'));
      if (!nw || !nh) continue;
      const bleed = el.dataset.px === 'bleed';
      const host = el.parentElement, hs = getComputedStyle(host);
      const padL = parseFloat(hs.paddingLeft) || 0, padR = parseFloat(hs.paddingRight) || 0;
      const hostW = host.clientWidth - padL - padR;
      // golden: 61.8 % of the screen width (the user's chosen size for
      // landscape clips), never wider than its column; full column on
      // narrow screens where 61.8 % would be too small to read
      const golden = el.dataset.px === 'golden';
      const avail = bleed ? vw : golden && vw > 1120 ? Math.min(hostW, vw * 0.618) : hostW;

      // 1:1 on screen when it fits; otherwise scale down to whole pixels
      let w = nw / dpr;
      const exact = w <= avail + (bleed ? BLEED_CROP : 0);
      if (!exact) w = Math.floor(avail * dpr) / dpr;
      el.style.width = `${w}px`;
      el.style.height = `${w * nh / nw}px`;
      el.classList.toggle('px-fit', !exact);
      el.dataset.scale = (w * dpr / nw).toFixed(3);

      // onto whole device pixels, without touching layout (relative offsets)
      const m = motion(el);
      if (m === 'other') { pending = true; continue; }
      el.style.left = '0px';
      el.style.top = '0px';
      const r = el.getBoundingClientRect();
      // full-bleed: place it on the viewport (left edge if it is wider, else
      // centred). In flow: layout already centres it, so only the
      // sub-pixel fraction is removed.
      let target;
      if (bleed) target = w >= vw ? 0 : (vw - w) / 2;
      else target = r.left;
      target = Math.round(target * dpr) / dpr;
      el.style.left = `${target - r.left}px`;
      if (m === 'none') {
        el.style.top = `${(Math.round(r.top * dpr) - r.top * dpr) / dpr}px`;
      } else if (r.bottom > -400 && r.top < vh + 400) {
        pending = true;            // still sliding in near the viewport: try again shortly
      }
    }
    // an entrance near the viewport has not settled yet; look again soon
    if (pending) retry = setTimeout(queue, 350);
  }

  const queue = () => { if (!raf) raf = requestAnimationFrame(run); };
  queue();
  addEventListener('resize', queue);
  // blocks reveal as they scroll in; re-check once scrolling pauses
  let scrollT = 0;
  addEventListener('scroll', () => { clearTimeout(scrollT); scrollT = setTimeout(queue, 160); }, { passive: true });
  addEventListener('load', queue);
  document.fonts?.ready.then(queue);
  new ResizeObserver(queue).observe(document.body);
  // entrances end on transform: none; snap the moment they settle. A
  // finished keyframe animation still holds an identity matrix, so the
  // hero's rise-in is removed outright once it ends.
  document.addEventListener('transitionend', e => { if (e.propertyName === 'transform') queue(); });
  document.addEventListener('animationend', e => {
    if (e.animationName === 'hx-rise') e.target.classList.add('settled');
    queue();
  });
  if (REDUCED) $$('.hx-in').forEach(n => n.classList.add('settled'));
  // browser zoom changes devicePixelRatio
  const watchDpr = () => {
    const mq = matchMedia(`(resolution: ${devicePixelRatio}dppx)`);
    mq.addEventListener('change', () => { queue(); watchDpr(); }, { once: true });
  };
  watchDpr();
})();

/* ─────────────────────────────────────────────────── hero recording */
(function heroVideo() {
  const sec = $('.hx');
  const v = $('[data-hero-video]');
  if (!sec || !v) return;
  const btn = $('[data-hero-toggle]');
  const amb = $('[data-ambient]', sec);
  let paused = REDUCED;      // the visitor's choice, not visibility
  let onScreen = true;

  if (REDUCED) { v.removeAttribute('autoplay'); v.pause(); }

  /* ambient light: the video's own colours, sampled into a 64x36 bitmap
     ~7 times a second. CSS blurs and stretches it above and below the
     band, so the glow changes as the heatmap and candles change. It never
     touches the video's own pixels. */
  let ambTimer = 0;
  const g = amb && amb.getContext('2d', { alpha: false });
  if (amb) { amb.width = 64; amb.height = 36; }
  const sample = () => {
    if (!g) return;
    try {
      if (v.readyState >= 2) g.drawImage(v, 0, 0, 64, 36);
      else if (v.poster) { const im = new Image(); im.onload = () => g.drawImage(im, 0, 0, 64, 36); im.src = v.poster; }
    } catch { /* a decode hiccup only costs one frame of glow */ }
  };
  const ambOn = () => { if (g && !ambTimer) { sample(); ambTimer = setInterval(sample, 140); } };
  const ambOff = () => { clearInterval(ambTimer); ambTimer = 0; };
  v.addEventListener('loadeddata', sample);
  sample();

  const sync = () => {
    if (btn) {
      btn.setAttribute('aria-pressed', String(paused));
      btn.setAttribute('aria-label', paused ? 'Play the recording' : 'Pause the recording');
    }
    if (!paused && onScreen && !document.hidden) { play(v); ambOn(); }
    else { v.pause(); ambOff(); sample(); }
  };

  btn?.addEventListener('click', () => { paused = !paused; sync(); });

  new IntersectionObserver(es => es.forEach(e => {
    onScreen = e.isIntersecting;
    sec.classList.toggle('live', onScreen);
    sync();
  }), { threshold: 0.02 }).observe(sec);
  document.addEventListener('visibilitychange', sync);
  sync();
})();

/* ──────────────────────────────────────────────── feature showcase */
(function showcase() {
  const blocks = $$('.sc');
  if (!blocks.length) return;

  // fetch a clip shortly before its block arrives
  const load = v => { if (v.dataset.src && !v.getAttribute('src')) { v.src = v.dataset.src; v.load(); } };
  const preload = new IntersectionObserver((es, io) => es.forEach(e => {
    if (!e.isIntersecting) return;
    $$('video[data-src]', e.target).forEach(load);
    io.unobserve(e.target);
  }), { rootMargin: '600px 0px' });
  blocks.forEach(b => preload.observe(b));

  // play only while visible; .live switches the CSS loops on
  const vis = new IntersectionObserver(es => es.forEach(e => {
    const b = e.target;
    b.classList.toggle('live', e.isIntersecting);
    $$('video', b).forEach(v => {
      if (e.isIntersecting && !document.hidden) { load(v); if (!REDUCED) play(v); }
      else v.pause();
    });
  }), { rootMargin: '60px 0px', threshold: 0.01 });
  blocks.forEach(b => vis.observe(b));

  document.addEventListener('visibilitychange', () => {
    blocks.forEach(b => $$('video', b).forEach(v => {
      if (document.hidden) v.pause();
      else if (b.classList.contains('live') && !REDUCED) play(v);
    }));
  });

  // playback bar, under the picture
  $$('.sc video').forEach(v => {
    const bar = v.closest('.sc-frame')?.querySelector('.sc-prog');
    if (!bar) return;
    v.addEventListener('timeupdate', () => {
      if (v.duration) bar.style.setProperty('--prog', (v.currentTime / v.duration).toFixed(4));
    });
  });
})();

/* ───────────────────────────────────────────────────────── gallery
   Click any screen in the showcase (or its "Wide view" button). The page
   fades back behind a blur and the screen assembles out of its own light,
   in a circle spreading from the exact point you clicked: particles burst
   out of that point and settle into place while the picture sharpens out of
   a blur and fades up. The ‹ › buttons (or the arrow keys) blend the picture
   out into dust in a circle from the button, and bring the next screen in
   the same way. One click anywhere else, or Esc, blends it out from the
   point you clicked and closes.
   Pictures are as large as the screen allows, never past their own pixels.
   Key 1 shows true pixels, and the picture then pans with the pointer.
   Once a picture has settled it carries no filter, mask or transform, so
   it is drawn exactly as sharp as the file. */
(function gallery() {
  const frames = $$('.sc-frame');
  if (!frames.length) return;
  const root = document.documentElement;
  const dpr = () => devicePixelRatio || 1;
  const snap = v => Math.round(v * dpr()) / dpr();
  const floorPx = v => Math.floor(v * dpr()) / dpr();
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  // 67 % of the way in the first 33 % of the time, then a long glide
  const K = Math.log(1 / 3) / Math.log(0.67);
  const ease = t => 1 - Math.pow(1 - t, K);

  const items = frames.map(f => {
    const sc = f.closest('.sc');
    const cs = getComputedStyle(f);
    return {
      frame: f,
      media: f.querySelector(':scope > img, :scope > video'),
      nw: parseFloat(cs.getPropertyValue('--nw')), nh: parseFloat(cs.getPropertyValue('--nh')),
      tag: (f.querySelector('.sc-rec')?.textContent || '').replace(/\s*·.*$/, '').trim(),
      title: (sc?.querySelector('.sc-k')?.textContent || '').replace(/^\s*(REC|SHOT)\s+\d+\s*/, '').trim(),
      cap: (f.closest('figure')?.querySelector('figcaption')?.textContent || '').trim(),
      color: (sc && getComputedStyle(sc).getPropertyValue('--sc').trim()) || '#4c7dff',
    };
  }).filter(it => it.media && it.nw && it.nh);
  if (!items.length) return;

  const chev = d => `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const box = document.createElement('div');
  box.className = 'wv';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'Screen gallery');
  box.innerHTML = `
    <div class="wv-veil"></div>
    <div class="wv-stage"></div>
    <canvas class="wv-dust" aria-hidden="true"></canvas>
    <div class="wv-top"><span class="wv-tag"></span><b class="wv-title"></b><span class="wv-n"></span></div>
    <button type="button" class="wv-nav wv-prev" aria-label="Previous screen">${chev('M14.5 5 8 12l6.5 7')}</button>
    <button type="button" class="wv-nav wv-next" aria-label="Next screen">${chev('m9.5 5 6.5 7-6.5 7')}</button>
    <div class="wv-cap"><span class="wv-cap-t"></span><span class="wv-hint">Click anywhere to close</span></div>`;
  document.body.appendChild(box);
  const stage = $('.wv-stage', box);
  let cv = $('.wv-dust', box);

  let state = 'closed';            // closed | open | closing
  let cur = -1, pic = null, mode = 'fit', lastFocus = null;
  const ptr = { x: innerWidth / 2, y: innerHeight / 2 };
  const pan = { tx: 0, ty: 0, cx: 0, cy: 0, raf: 0 };

  /* ── layout ── */
  const bounds = () => {
    const r = stage.getBoundingClientRect();
    const side = innerWidth < 760 ? 10 : 100;      // room for the ‹ › buttons
    return { x: r.left + side, y: r.top + 4, w: r.width - side * 2, h: r.height - 8 };
  };
  function fitRect(it) {
    const b = bounds();
    let w = Math.min(it.nw / dpr(), b.w, b.h * it.nw / it.nh);
    w = floorPx(w);
    const h = w * it.nh / it.nw;
    return { x: snap(b.x + (b.w - w) / 2), y: snap(b.y + (b.h - h) / 2), w, h };
  }
  const canPx = it => fitRect(it).w < it.nw / dpr() - 0.5;
  function place(node, r) {
    const s = stage.getBoundingClientRect();
    node.style.left = `${snap(r.x - s.left)}px`;
    node.style.top = `${snap(r.y - s.top)}px`;
    node.style.width = `${r.w}px`;
    node.style.height = `${r.h}px`;
  }

  /* ── the dust: particles made from the picture's own pixels ──
     Everything spreads as a circle from the point you clicked, and each
     particle's timing is its distance from that point, so every point
     plays its part.
       in   a ring grows out of the click point. Particles burst outward
            from the point, swirl, and settle onto their own spot as the
            ring reaches it; inside the ring the picture sharpens out of a
            blur and fades up.
       out  a hole opens at the click point and grows. As its edge passes
            a point, it lifts off as a particle flying outward, swirling
            and fading; the rest of the picture blurs and fades with it.
     All of it runs on the graphics chip (WebGL 2) in one canvas over the
     stage. The particles (a few hundred thousand, most one screen pixel,
     some a little larger) work out their own paths in the vertex shader
     and read their colour straight from the picture; the picture's ring,
     blur and fade are drawn by a shader too. The real <img> or <video>
     waits hidden underneath and takes over, sharp, for the last stretch,
     so the browser never re-filters a big picture per frame. If frames
     are missed, the next animation uses fewer particles. Without WebGL 2,
     a canvas fallback draws a few thousand particles and the picture is
     masked and blurred with CSS. */
  const systems = new Set();
  let raf = 0, last = 0, gaps = [];
  let quality = 1;                          // 1 = full density; lowered after missed frames
  const LIFE = 0.55;                        // how long a particle lives, in units of the ring's travel
  const SWAP = 0.86;                        // in: when the real picture takes over from the shader
  const DENSITY = { in: 420000, out: 560000 };   // particles per picture at full quality
  let gpu, g = null;                        // gpu: undefined = not tried yet, null = canvas fallback

  // the particles
  const PVS = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D uTex;
uniform vec2 uView, uCell, uO;
uniform vec4 uPic, uArea, uRing;
uniform int uCols;
uniform float uIn, uDpr;
uniform uint uSeed;
out vec4 vC;
out float vSoft;
uint hsh(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float rn(inout uint s) { s = hsh(s); return float(s >> 8) * (1.0 / 16777216.0); }
void main() {
  gl_Position = vec4(-9.0, -9.0, 0.0, 1.0);
  gl_PointSize = 1.0;
  vC = vec4(0.0);
  vSoft = 0.0;
  int id = gl_VertexID;
  uint s = (uint(id) * 0x9e3779b9u) ^ uSeed;
  float hx = rn(s); float hy = rn(s); float hk = rn(s); float hu = rn(s); float hs = rn(s);
  float hw = rn(s); float hp = rn(s); float hz = rn(s); float hz2 = rn(s);
  // its own spot on the picture, jittered inside its cell so there is no grid
  vec2 P = uArea.xy + (vec2(float(id % uCols), float(id / uCols)) + 0.5 + (vec2(hx, hy) - 0.5) * 0.96) * uCell;
  ivec2 ts = textureSize(uTex, 0);
  vec4 tx = texelFetch(uTex, clamp(ivec2((P - uPic.xy) / uPic.zw * vec2(ts)), ivec2(0), ts - 1), 0);
  float lum = dot(tx.rgb, vec3(0.2126, 0.7152, 0.0722));
  if (lum < 0.07 && hk > (uIn > 0.5 ? 0.1 : 0.2)) return;   // the dark ground mostly just fades
  vec2 d = P - uO;
  float dist = max(length(d), 1.0);
  vec2 dir = d / dist;                                  // straight out from the click
  float u = clamp((dist - uRing.x) / uRing.y, 0.0, 1.0) * 0.88 + hu * 0.12;
  // in: 1 = just launched from the point, 0 = landed; out: 0 = just lifted, 1 = gone
  float age = uIn > 0.5 ? (u - uRing.z) / uRing.w : (uRing.z - u) / uRing.w;
  if (age <= 0.0 || age >= 1.0) return;
  float e = 1.0 - (1.0 - age) * (1.0 - age);
  float sp = 70.0 + hs * 260.0;
  float reach = uIn > 0.5 ? -min(dist * 0.92, sp * 1.4) : sp;
  float sw = (hw < 0.5 ? -1.0 : 1.0) * (14.0 + fract(hw * 7.31) * 30.0) * sin(age * 3.14159);   // swirl round the point
  float ph = hp * 6.28318;
  vec2 q = P + dir * (reach * e) + vec2(-dir.y, dir.x) * sw + vec2(sin(ph + age * 5.0), cos(ph + age * 4.0)) * (6.0 * age);
  if (uIn < 0.5) q.y -= 40.0 * e * e;
  gl_Position = vec4(q.x / uView.x * 2.0 - 1.0, 1.0 - q.y / uView.y * 2.0, 0.0, 1.0);
  // most are one pixel, some a little larger
  float sz = hz < 0.62 ? 1.0 : (hz < 0.92 ? 1.35 + hz2 * 0.5 : 2.0 + hz2 * 0.9);
  sz *= uIn > 0.5 ? 1.0 - age * 0.2 : 1.0 - age * 0.35;
  gl_PointSize = max(1.0, sz * uDpr);
  vSoft = step(1.7, gl_PointSize);
  float a = min(1.0, 0.32 + lum * 1.8) * (uIn > 0.5 ? sin(age * 3.14159) * 0.9 + (1.0 - age) * 0.1 : pow(1.0 - age, 1.15));
  vC = vec4(min(vec3(1.0), tx.rgb * 1.3 + vec3(0.055, 0.07, 0.118)), a);
}`;
  const PFS = `#version 300 es
precision mediump float;
in vec4 vC;
in float vSoft;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float a = vC.a * mix(1.0, clamp(1.25 - dot(q, q), 0.0, 1.0), vSoft);
  o = vec4(vC.rgb * a, a);
}`;
  // the picture itself while it moves: the ring, a blur, brightness and the fade
  const SVS = `#version 300 es
precision highp float;
uniform vec2 uView;
uniform vec4 uArea;
out vec2 vP;
void main() {
  vec2 c = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vP = uArea.xy + c * uArea.zw;
  gl_Position = vec4(vP.x / uView.x * 2.0 - 1.0, 1.0 - vP.y / uView.y * 2.0, 0.0, 1.0);
}`;
  const SFS = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform vec2 uO;
uniform vec4 uPic, uRing;
uniform float uIn, uQ, uA, uDpr, uRad;
in vec2 vP;
out vec4 o;
void main() {
  vec2 rel = vP - uPic.xy;
  vec2 uv = rel / uPic.zw;
  // rounded corners, anti-aliased
  vec2 h = uPic.zw * 0.5;
  vec2 k = abs(rel - h) - (h - uRad);
  float sd = length(max(k, 0.0)) + min(max(k.x, k.y), 0.0) - uRad;
  float a = clamp(0.5 - sd * uDpr, 0.0, 1.0);
  // the ring
  float r = distance(vP, uO), f = uRing.z;
  a *= uIn > 0.5
    ? 1.0 - smoothstep(uRing.x + (f - 0.16) * uRing.y, uRing.x + (f + 0.04) * uRing.y, r)
    : smoothstep(uRing.x + (f - 0.04) * uRing.y, uRing.x + (f + 0.16) * uRing.y, r);
  a *= uA * (1.0 - uQ * 0.65);
  if (a <= 0.002) discard;
  vec3 c;
  float sig = uQ * 16.0;                       // like CSS blur(16px * q)
  if (sig < 0.25) c = texture(uTex, uv).rgb;
  else {
    // 8 taps on a sunflower spiral over a disc of 2 sigma, each read from
    // the mip level whose texels match the tap spacing (the mips do the rest)
    vec2 tpp = vec2(textureSize(uTex, 0)) / uPic.zw;
    float rad = sig * 2.0;
    float lod = log2(max(1.0, rad * 0.62 * max(tpp.x, tpp.y)));
    c = vec3(0.0);
    for (int i = 0; i < 8; i++) {
      float fi = float(i) + 0.5;
      float th = fi * 2.39996323;
      c += textureLod(uTex, uv + vec2(cos(th), sin(th)) * (sqrt(fi / 8.0) * rad) / uPic.zw, lod).rgb;
    }
    c /= 8.0;
  }
  // the brightness and saturate the CSS version used
  c *= 1.0 + uQ * 0.7;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = clamp(mix(vec3(l), c, 1.0 + uQ * 0.6), 0.0, 1.0);
  o = vec4(c * a, a);
}`;
  const PN = ['uTex', 'uView', 'uCell', 'uO', 'uPic', 'uArea', 'uRing', 'uCols', 'uIn', 'uDpr', 'uSeed'];
  const SN = ['uTex', 'uView', 'uArea', 'uO', 'uPic', 'uRing', 'uIn', 'uQ', 'uA', 'uDpr', 'uRad'];

  function makeGpu(canvas) {
    let gl = null;
    try { gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false }); } catch { /* none */ }
    if (!gl) return null;
    const eng = { gl, lost: false };
    eng.texture = src => {
      const t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      try {
        if (ArrayBuffer.isView(src)) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
        else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        gl.generateMipmap(gl.TEXTURE_2D);
      } catch { gl.deleteTexture(t); return null; }
      return t;
    };
    const program = (vs, fs, names) => {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const p = gl.createProgram();
      gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
      gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
      const u = {};
      for (const n of names) u[n] = gl.getUniformLocation(p, n);
      gl.useProgram(p);
      gl.uniform1i(u.uTex, 0);
      return { p, u };
    };
    eng.init = () => {
      eng.pp = program(PVS, PFS, PN);
      eng.sp = program(SVS, SFS, SN);
      if (!eng.pp || !eng.sp) return false;
      eng.vao = gl.createVertexArray();
      gl.bindVertexArray(eng.vao);
      gl.enable(gl.BLEND);
      gl.clearColor(0, 0, 0, 0);
      // one invisible draw of each now, so the shaders are built before the first click
      const t = eng.texture(new Uint8Array([255, 255, 255, 255]));
      eng.draw([{ gl: true, tex: t, count: 1, pic: [0, 0, 1, 1], area: [0, 0, 1, 1], cell: [1, 1], cols: 1, ox: 0, oy: 0,
        dmin: 0, span: 1, front: -9, q: 0, a: 0, mode: 'in', seed: 1 }]);
      gl.deleteTexture(t);
      eng.draw([]);
      return true;
    };
    eng.draw = list => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (!list.length) return;
      gl.bindVertexArray(eng.vao);
      gl.activeTexture(gl.TEXTURE0);
      const W = innerWidth, H = innerHeight, D = dpr();
      // the pictures first, the leaving one under the arriving one
      let u = eng.sp.u;
      gl.useProgram(eng.sp.p);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(u.uView, W, H);
      gl.uniform1f(u.uDpr, D);
      gl.uniform1f(u.uRad, mode === 'px' ? 4 : 10);
      for (const s of [...list].sort((a, b) => (a.mode === 'in') - (b.mode === 'in'))) {
        if (!(s.a > 0)) continue;
        gl.bindTexture(gl.TEXTURE_2D, s.tex);
        gl.uniform4f(u.uArea, s.area[0], s.area[1], s.area[2], s.area[3]);
        gl.uniform4f(u.uPic, s.pic[0], s.pic[1], s.pic[2], s.pic[3]);
        gl.uniform2f(u.uO, s.ox, s.oy);
        gl.uniform4f(u.uRing, s.dmin, s.span, s.front, 0);
        gl.uniform1f(u.uIn, s.mode === 'in' ? 1 : 0);
        gl.uniform1f(u.uQ, s.q);
        gl.uniform1f(u.uA, s.a);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      // then the dust, whose light adds up like 'lighter'
      u = eng.pp.u;
      gl.useProgram(eng.pp.p);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform2f(u.uView, W, H);
      gl.uniform1f(u.uDpr, D);
      for (const s of list) {
        if (!s.count) continue;
        gl.bindTexture(gl.TEXTURE_2D, s.tex);
        gl.uniform4f(u.uPic, s.pic[0], s.pic[1], s.pic[2], s.pic[3]);
        gl.uniform4f(u.uArea, s.area[0], s.area[1], s.area[2], s.area[3]);
        gl.uniform2f(u.uCell, s.cell[0], s.cell[1]);
        gl.uniform1i(u.uCols, s.cols);
        gl.uniform2f(u.uO, s.ox, s.oy);
        gl.uniform4f(u.uRing, s.dmin, s.span, s.front, LIFE);
        gl.uniform1f(u.uIn, s.mode === 'in' ? 1 : 0);
        gl.uniform1ui(u.uSeed, s.seed);
        gl.drawArrays(gl.POINTS, 0, s.count);
      }
    };
    if (!eng.init()) return null;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); eng.lost = true; });
    canvas.addEventListener('webglcontextrestored', () => { eng.lost = !eng.init(); });
    return eng;
  }
  // the graphics chip if it can, else a plain canvas (on a fresh element if WebGL took this one)
  function engine() {
    if (gpu !== undefined) return gpu;
    gpu = makeGpu(cv);
    if (!gpu) {
      g = cv.getContext('2d');
      if (!g) { const c = cv.cloneNode(); cv.replaceWith(c); cv = c; g = cv.getContext('2d'); }
      return gpu;
    }
    items.forEach(upload);
    // a lost context loses its textures: decode them again on the next open
    cv.addEventListener('webglcontextrestored', () => { texCache.clear(); bmp.clear(); });
    return gpu;
  }
  function sizeCanvas() {
    engine();
    const d = dpr();
    cv.width = Math.round(innerWidth * d);
    cv.height = Math.round(innerHeight * d);
  }

  // Each screenshot is decoded off the main thread and put on the graphics
  // chip while the page is idle, so starting an animation never uploads
  // anything. (A video's current frame is copied off the main thread.)
  const idle = window.requestIdleCallback || (f => setTimeout(f, 700));
  const bmp = new Map(), texCache = new Map();
  function warm(it) {
    if (bmp.has(it) || it.media.tagName !== 'IMG' || !window.createImageBitmap) return;
    bmp.set(it, null);
    fetch(it.media.currentSrc || it.media.src)
      .then(r => r.blob()).then(b => createImageBitmap(b))
      .then(b => { bmp.set(it, b); idle(() => upload(it)); })
      .catch(() => bmp.delete(it));
  }
  function upload(it) {
    const b = bmp.get(it);
    if (!b || texCache.has(it) || !gpu || gpu.lost) return;
    const t = gpu.texture(b);
    if (!t) return;
    texCache.set(it, t);
    b.close();                                  // the chip has it now
    bmp.set(it, null);
  }

  // the ring's travel: from the nearest point of the picture to its farthest corner
  function ring(r, ox, oy) {
    const nx = clamp(ox, r.left, r.right), ny = clamp(oy, r.top, r.bottom);
    const dmin = Math.hypot(ox - nx, oy - ny);
    const dmax = Math.max(...[[r.left, r.top], [r.right, r.top], [r.left, r.bottom], [r.right, r.bottom]]
      .map(([x, y]) => Math.hypot(ox - x, oy - y)));
    return { dmin, span: Math.max(1, dmax - dmin) };
  }
  function dust(node, src, { mode = 'out', it = null, ox, oy, ms = 1000, delay = 0 } = {}) {
    return new Promise(resolve => {
      const r = node.getBoundingClientRect();
      if (ox == null) { ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
      const now = performance.now();
      const s = { node, ms, mode, resolve, start: now + delay, born: now, ox, oy, ...ring(r, ox, oy),
        cx: ox - r.left, cy: oy - r.top, front: mode === 'in' ? -1 : -0.06, q: mode === 'in' ? 1 : 0, a: 1 };
      const eng = engine();
      systems.add(s);
      if (eng && !eng.lost && (src || texCache.has(it))) {
        s.gl = true;
        gpuSystem(s, r, src, it);
        if (mode === 'in') node.classList.add('gl');      // the shader draws it until it settles
      } else {
        if (src && !eng) s.P = cpuParticles(s, r, src);
        apply(s, s.front);
      }
      if (!raf) { last = 0; raf = requestAnimationFrame(tick); }
    });
  }
  function gpuSystem(s, r, src, it) {
    // only the part of the picture inside the stage counts
    const sr = stage.getBoundingClientRect();
    const x0 = Math.max(r.left, sr.left, 0), y0 = Math.max(r.top, sr.top, 0);
    const x1 = Math.min(r.right, sr.right, innerWidth), y1 = Math.min(r.bottom, sr.bottom, innerHeight);
    const aw = Math.max(1, x1 - x0), ah = Math.max(1, y1 - y0);
    const pitch = Math.max(1.1, Math.sqrt(aw * ah / (DENSITY[s.mode] * quality)));
    const cols = Math.max(1, Math.round(aw / pitch)), rows = Math.max(1, Math.round(ah / pitch));
    Object.assign(s, { pic: [r.left, r.top, r.width, r.height], area: [x0, y0, aw, ah],
      cell: [aw / cols, ah / rows], cols, count: cols * rows, seed: (Math.random() * 4294967295) >>> 0 });
    const ready = texCache.get(it);
    if (ready) { s.tex = ready; s.shared = true; return; }
    // otherwise: an ImageBitmap uploads at once; a video frame or an undecoded
    // image is first turned into one off the main thread
    const up = b => { if (systems.has(s) && gpu && !gpu.lost) s.tex = gpu.texture(b); };
    if (src instanceof ImageBitmap || !window.createImageBitmap) up(src);
    else createImageBitmap(src).then(b => { up(b); b.close(); }, () => {});
  }
  // the canvas fallback: a few thousand small squares
  function cpuParticles(s, r, src) {
    const { ox, oy, dmin, span } = s;
    const cell = clamp(Math.round(r.width / 260), 3, 8);
    const cols = Math.max(1, Math.round(r.width / cell)), rows = Math.max(1, Math.round(r.height / cell));
    const P = [];
    try {
      const oc = document.createElement('canvas');
      oc.width = cols; oc.height = rows;
      const og = oc.getContext('2d', { willReadFrequently: true });
      og.drawImage(src, 0, 0, cols, rows);
      const d = og.getImageData(0, 0, cols, rows).data;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const k = (j * cols + i) * 4, R = d[k], G = d[k + 1], B = d[k + 2];
        const lum = 0.2126 * R + 0.7152 * G + 0.0722 * B;
        if (lum < 18 && Math.random() > 0.1) continue;
        const x = r.left + (i + 0.5) * r.width / cols, y = r.top + (j + 0.5) * r.height / rows;
        const dist = Math.hypot(x - ox, y - oy) || 1;
        P.push({
          x, y, dist, ux: (x - ox) / dist, uy: (y - oy) / dist,
          u: clamp((dist - dmin) / span, 0, 1) * 0.88 + Math.random() * 0.12,
          sp: 70 + Math.random() * 260,
          sw: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 30),
          ph: Math.random() * 6.283, s: cell * (0.35 + Math.random() * 0.5),
          c: `rgb(${Math.min(255, R * 1.3 + 14) | 0},${Math.min(255, G * 1.3 + 18) | 0},${Math.min(255, B * 1.3 + 30) | 0})`,
          a: Math.min(1, 0.3 + lum / 150),
        });
      }
    } catch { /* not decoded yet: it still blurs and fades */ }
    const MAX = s.mode === 'in' ? 4000 : 5600;
    if (P.length > MAX) {
      const keep = MAX / P.length, grow = Math.min(1.6, Math.sqrt(1 / keep));
      for (let k = P.length - 1; k >= 0; k--) {
        if (Math.random() > keep) { P[k] = P[P.length - 1]; P.pop(); } else P[k].s *= grow;
      }
    }
    return P;
  }
  function draw2d(list) {
    const W = innerWidth, H = innerHeight;
    g.setTransform(dpr(), 0, 0, dpr(), 0, 0);
    g.clearRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const s of list) {
      if (!s.P) continue;
      const inn = s.mode === 'in', front = s.front;
      for (const p of s.P) {
        const age = inn ? (p.u - front) / LIFE : (front - p.u) / LIFE;
        if (age <= 0 || age >= 1) continue;
        const e = 1 - (1 - age) * (1 - age);
        const reach = inn ? -Math.min(p.dist * 0.92, p.sp * 1.4) : p.sp;
        const sw = p.sw * Math.sin(age * 3.1416);
        const x = p.x + p.ux * reach * e - p.uy * sw + Math.sin(p.ph + age * 5) * 6 * age;
        const y = p.y + p.uy * reach * e + p.ux * sw + Math.cos(p.ph + age * 4) * 6 * age - (inn ? 0 : 40 * e * e);
        if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
        const sz = Math.max(1, p.s * (inn ? 1 - age * 0.3 : 1 - age * 0.5));
        g.globalAlpha = p.a * (inn ? Math.sin(age * 3.1416) * 0.9 + (1 - age) * 0.1 : Math.pow(1 - age, 1.5));
        g.fillStyle = p.c;
        g.fillRect(x - sz / 2, y - sz / 2, sz, sz);
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
  }
  function clearDust() {
    if (gpu) { if (!gpu.lost) gpu.draw([]); }
    else if (g) { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cv.width, cv.height); }
  }
  // 1 = all dust, 0 = the whole picture
  const haze = (mode, front) => mode === 'in' ? clamp(1 - (front + 0.1) / 1.2, 0, 1) : clamp((front + 0.12) / 1.3, 0, 1);
  // the CSS version of the picture's share (no WebGL): a circular mask at the ring, plus blur and fade
  function apply(s, front) {
    const R = f => `${(s.dmin + f * s.span).toFixed(1)}px`;
    const at = `circle at ${s.cx.toFixed(1)}px ${s.cy.toFixed(1)}px`;
    const st = s.node.style;
    st.webkitMaskImage = st.maskImage = s.mode === 'in'
      ? `radial-gradient(${at}, #000 ${R(front - 0.16)}, transparent ${R(front + 0.04)})`
      : `radial-gradient(${at}, transparent ${R(front - 0.04)}, #000 ${R(front + 0.16)})`;
    const q = haze(s.mode, front);
    st.filter = q > 0.001 ? `blur(${(q * 16).toFixed(2)}px) brightness(${(1 + q * 0.7).toFixed(3)}) saturate(${(1 + q * 0.6).toFixed(3)})` : '';
    st.opacity = String(1 - q * 0.65);
  }
  // the real picture may only take over once it can be shown at once
  function notReady(node) {
    const m = node.firstElementChild;
    if (!m) return false;
    if (m.tagName === 'VIDEO') return m.readyState < 2 || m.seeking;
    return !m.dataset.ready;
  }
  function end(s, ok = true) {
    systems.delete(s);
    if (s.tex && !s.shared && gpu && !gpu.lost) gpu.gl.deleteTexture(s.tex);
    s.tex = null;
    s.resolve(ok);
  }
  function tick(now) {
    if (last) gaps.push(now - last);
    last = now;
    const list = [...systems];
    for (const s of list) {
      if (s.gl && !s.tex) {
        // still copying the pixels: wait (the real picture keeps showing),
        // or after a while do it the CSS way
        if (now - s.born < 700) { s.start = Math.max(s.start, now); s.wait = true; continue; }
        s.gl = false;
        s.node.classList.remove('gl');
      }
      s.wait = false;
      let t = clamp((now - s.start) / s.ms, 0, 1);
      if (s.gl && s.mode === 'in' && !s.shown && t >= SWAP) {
        if (notReady(s.node)) { s.start = now - SWAP * s.ms; t = SWAP; }   // hold here until it can take over
        else { s.shown = true; s.node.classList.remove('gl'); }
      }
      // in: the ring races out, then settles gently; out: the hole opens and accelerates
      s.front = s.mode === 'in' ? -LIFE + (1.2 + LIFE) * ease(t) : -0.06 + (1.06 + LIFE) * Math.pow(t, 1.12);
      s.t = t;
      if (s.gl) {
        s.q = haze(s.mode, s.front);
        // in: the shader's picture hands over to the real one underneath
        s.a = s.mode === 'in' && s.shown ? clamp(1 - (t - SWAP) / (1 - SWAP), 0, 1) : 1;
        if (s.mode === 'out' && !s.hidden) { s.hidden = true; s.node.classList.add('gl'); }
      } else apply(s, s.front);
    }
    const run = list.filter(s => !s.wait);
    if (gpu) { if (!gpu.lost) gpu.draw(run.filter(s => s.gl && s.tex)); }
    else if (g) draw2d(run);
    for (const s of run) if (s.t >= 1) end(s);
    if (systems.size) raf = requestAnimationFrame(tick);
    else { raf = 0; clearDust(); judge(); }
  }
  // missed frames: the next animation uses fewer particles, so it never stutters twice
  function judge() {
    const d = gaps.slice(3);
    gaps = []; last = 0;
    if (d.length < 8) return;
    const beat = Math.max(6, Math.min(...d));         // the screen's own frame interval
    const slow = d.filter(x => x > beat * 1.5 + 2).length / d.length;
    if (slow > 0.4) quality = Math.max(0.25, quality * 0.5);
    else if (slow > 0.15) quality = Math.max(0.25, quality * 0.72);
  }
  const stopDust = node => { for (const s of [...systems]) if (s.node === node) end(s, false); };
  const settle = node => {
    const st = node.style;
    st.webkitMaskImage = st.maskImage = st.filter = st.opacity = '';
    node.classList.remove('gl');
  };

  // what to sample: the decoded copy if it is ready, else the picture in the gallery, else the one on the card
  function sourceFor(it, node) {
    const m = node.firstElementChild;
    if (m.tagName === 'IMG') {
      if (bmp.get(it)) return bmp.get(it);
      if (m.complete && m.naturalWidth) return m;
      return it.media.complete && it.media.naturalWidth ? it.media : null;
    }
    if (m.readyState >= 2) return m;
    return it.media.readyState >= 2 ? it.media : null;
  }
  function arrive(node, it, pt, delay) {
    const m = node.firstElementChild;
    if (REDUCED) { node.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220 }); return; }
    // a video holds the card's frame while it arrives, and plays once it has settled
    if (m.tagName === 'VIDEO') it.media.pause();
    dust(node, sourceFor(it, node), { mode: 'in', it, ox: pt?.x, oy: pt?.y, ms: 1250, delay }).then(ok => {
      if (!ok) return;
      settle(node);
      if (m.tagName === 'VIDEO') play(m);
    });
  }
  function leave(node, it, pt, ms) {
    stopDust(node);
    const done = () => node.remove();
    if (REDUCED) return node.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' }).finished.then(done);
    settle(node);
    node.classList.add('gone');
    const m = node.firstElementChild;
    if (m.tagName === 'VIDEO') m.pause();                 // so the dust is made of the frame on screen
    return dust(node, sourceFor(it, node), { mode: 'out', it, ox: pt?.x, oy: pt?.y, ms }).then(done);
  }

  /* ── pictures ── */
  function makeMedia(it) {
    let m;
    if (it.media.tagName === 'VIDEO') {
      const v = it.media;
      m = document.createElement('video');
      m.muted = true; m.loop = true; m.playsInline = true;
      m.preload = 'auto';
      if (v.poster) m.poster = v.poster;
      m.src = v.currentSrc || v.getAttribute('src') || v.dataset.src;
      m.setAttribute('aria-label', v.getAttribute('aria-label') || '');
      m.addEventListener('loadedmetadata', () => { try { m.currentTime = v.currentTime || 0; } catch { /* fine */ } }, { once: true });
      if (REDUCED) m.controls = true;
    } else {
      m = it.media.cloneNode();
      m.removeAttribute('loading');
      m.removeAttribute('style');
      m.decoding = 'async';
      // decoded off the main thread before it is first shown
      const ok = () => { m.dataset.ready = '1'; };
      if (m.decode) m.decode().then(ok, ok); else ok();
    }
    return m;
  }
  function fill(i) {
    const it = items[i];
    cur = i;
    box.style.setProperty('--wc', it.color);
    $('.wv-tag', box).textContent = it.tag;
    $('.wv-title', box).textContent = it.title;
    $('.wv-n', box).textContent = `${i + 1} / ${items.length}`;
    $('.wv-cap-t', box).textContent = it.cap.replace(/Wide view$/, '').trim();
    pic = document.createElement('div');
    pic.className = 'wv-pic';
    pic.appendChild(makeMedia(it));
    stage.appendChild(pic);
    mode = 'fit';
    box.classList.remove('px');
    place(pic, fitRect(it));
  }

  /* ── true pixels (key 1): pans with the pointer by whole device pixels ── */
  function setPx(on) {
    const it = items[cur];
    if (on && !canPx(it)) return;
    mode = on ? 'px' : 'fit';
    box.classList.toggle('px', on);
    cancelAnimationFrame(pan.raf); pan.raf = 0;
    if (on) {
      panTarget();
      pan.cx = pan.tx; pan.cy = pan.ty;
      pic.style.width = `${it.nw / dpr()}px`;
      pic.style.height = `${it.nh / dpr()}px`;
      pic.style.left = `${snap(pan.cx)}px`;
      pic.style.top = `${snap(pan.cy)}px`;
    } else {
      place(pic, fitRect(it));
    }
    if (!REDUCED) pic.animate([{ filter: 'blur(8px)', opacity: 0.5 }, { filter: 'blur(0px)', opacity: 1 }],
      { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
  function panTarget() {
    const it = items[cur];
    const w = it.nw / dpr(), h = it.nh / dpr();
    const s = stage.getBoundingClientRect();
    const fx = clamp((ptr.x - s.left) / s.width, 0, 1), fy = clamp((ptr.y - s.top) / s.height, 0, 1);
    pan.tx = w > s.width ? -(w - s.width) * fx : (s.width - w) / 2;
    pan.ty = h > s.height ? -(h - s.height) * fy : (s.height - h) / 2;
  }
  function panLoop() {
    pan.cx += (pan.tx - pan.cx) * 0.16;
    pan.cy += (pan.ty - pan.cy) * 0.16;
    if (Math.abs(pan.tx - pan.cx) < 0.25 && Math.abs(pan.ty - pan.cy) < 0.25) { pan.cx = pan.tx; pan.cy = pan.ty; pan.raf = 0; }
    else pan.raf = requestAnimationFrame(panLoop);
    pic.style.left = `${snap(pan.cx)}px`;
    pic.style.top = `${snap(pan.cy)}px`;
  }

  /* ── open / step / close ── */
  // scroll is locked with overflow alone: the scrollbar's gutter stays
  // (css/media.css), so nothing on the page has to be laid out again
  const lock = on => root.classList.toggle('wv-lock', on);
  // fx, fy: where on the card it was clicked (0..1); the ring starts at the same spot on the big picture
  function open(i, fx = 0.5, fy = 0.5) {
    if (state !== 'closed') return;
    state = 'open';
    lastFocus = document.activeElement;
    lock(true);
    box.hidden = false;
    sizeCanvas();
    fill(i);
    const it = items[i];
    const r = pic.getBoundingClientRect();
    arrive(pic, it, { x: r.left + fx * r.width, y: r.top + fy * r.height }, 120);
    requestAnimationFrame(() => box.classList.add('on'));
    $('.wv-next', box).focus({ preventScroll: true });
    // fetch and decode the other screens now, so stepping never waits
    items.forEach(warm);
  }
  // pt: where it was clicked; with the keyboard, the edge the arrow points to / the middle
  function step(d, pt) {
    if (state !== 'open') return;
    cancelAnimationFrame(pan.raf); pan.raf = 0;
    pt = pt || { x: d > 0 ? innerWidth - 50 : 50, y: innerHeight / 2 };
    const old = pic, oldIt = items[cur];
    old.classList.add('out');
    leave(old, oldIt, pt, 850);
    fill((cur + d + items.length) % items.length);
    arrive(pic, items[cur], pt, 170);
  }
  function close(pt) {
    if (state !== 'open') return;
    state = 'closing';
    cancelAnimationFrame(pan.raf); pan.raf = 0;
    const node = pic;
    box.classList.remove('on');
    leave(node, items[cur], pt, 1050).then(() => {
      box.hidden = true;
      box.classList.remove('px');
      lock(false);
      // the cards' clips carry on where they are on screen
      if (!REDUCED) items.forEach(o => { if (o.media.tagName === 'VIDEO' && o.frame.closest('.sc')?.classList.contains('live')) play(o.media); });
      cur = -1; pic = null; state = 'closed';
      cv.width = cv.height = 1;               // give the canvas memory back while it is shut
      lastFocus?.focus?.({ preventScroll: true });
    });
  }

  /* ── wiring ── */
  items.forEach((it, i) => {
    const f = it.frame;
    f.classList.add('wv-able');
    f.setAttribute('tabindex', '0');
    f.setAttribute('role', 'button');
    f.setAttribute('aria-label', `Open ${it.title || 'this screen'} in the gallery`);
    f.addEventListener('click', e => {
      const r = it.media.getBoundingClientRect();
      open(i, clamp((e.clientX - r.left) / r.width, 0, 1), clamp((e.clientY - r.top) / r.height, 0, 1));
    });
    f.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i); } });
    // decode this screen's pixels for the dust as soon as the pointer or focus comes near it
    f.addEventListener('pointerenter', () => warm(it), { once: true });
    f.addEventListener('focus', () => warm(it), { once: true });
    const cap = f.closest('figure')?.querySelector('figcaption');
    if (cap) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'sc-wide';
      b.innerHTML = '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M9.5 2.5h4v4M6.5 13.5h-4v-4M13.5 2.5 9 7M2.5 13.5 7 9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>Wide view';
      b.addEventListener('click', e => { e.stopPropagation(); open(i); });
      cap.appendChild(b);
    }
  });

  // one click anywhere closes, except on ‹ ›
  box.addEventListener('click', e => {
    const nav = e.target.closest('.wv-nav');
    // a keyboard "click" on a button reports 0,0: start from the button itself
    let pt = { x: e.clientX, y: e.clientY };
    if (!e.detail && nav) { const b = nav.getBoundingClientRect(); pt = { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }
    if (nav) step(nav.classList.contains('wv-next') ? 1 : -1, pt);
    else close(pt);
  });
  addEventListener('pointermove', e => {
    ptr.x = e.clientX; ptr.y = e.clientY;
    if (state === 'open' && mode === 'px') { panTarget(); if (!pan.raf) pan.raf = requestAnimationFrame(panLoop); }
  }, { passive: true });
  addEventListener('keydown', e => {
    if (state !== 'open') return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
    else if (e.key === '1') setPx(mode !== 'px');
    else if (e.key === 'Tab') {
      e.preventDefault();
      const b = $$('.wv-nav', box), k = b.indexOf(document.activeElement);
      b[(k + 1) % b.length].focus();
    }
  });
  // build the particle shaders while the page is idle, not on the first click
  if (document.readyState === 'complete') idle(engine);
  else addEventListener('load', () => idle(engine), { once: true });
  addEventListener('resize', () => {
    if (state === 'closed') return;
    sizeCanvas();
    if (pic) mode === 'px' ? setPx(true) : place(pic, fitRect(items[cur]));
  });
})();
