'use strict';
/* ═══════════════════════════════════════════════════════════════
   The live FPS meter.

   It measures the frame rate this browser is actually achieving while
   the product's own mark animation (mark.js, unmodified) runs beside
   it — so the headline figure is demonstrated rather than asserted.

   Honest by construction: it reports what it measures. On a 60 Hz
   panel it reads ~60 and says so.
   ═══════════════════════════════════════════════════════════════ */

import { logoHTML, Logo } from '/static/js/logo.js';

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = {
  now:  document.getElementById('fps-now'),
  hz:   document.getElementById('fps-hz'),
  cv:   document.getElementById('fps-cv'),
  mark: document.getElementById('fps-mark'),
  note: document.getElementById('fps-note'),
};

if (el.now && el.cv) {
  /* A real load to measure against: the product's mark, drawing its
     market story on a canvas exactly as it does inside the terminal. */
  if (el.mark && !REDUCED) {
    el.mark.innerHTML = logoHTML({ size: 128, boot: true, tempo: 1 });
    const lg = new Logo(el.mark);
    setInterval(() => lg.replay(), 6000);      // keep the journey running
  }

  const ctx = el.cv.getContext('2d');
  const HIST = 180;
  const hist = [];
  let frames = 0, acc = 0, last = 0, shown = 0, peak = 0;

  /* The display's refresh rate, from the shortest frame intervals seen.
     The minimum is used rather than the mean because a stray long frame
     (a GC pause, a scroll) must not drag the panel's rate down. */
  let probe = [], hz = 0;

  function resize() {
    const r = el.cv.getBoundingClientRect();
    const dpr = Math.min(2, devicePixelRatio || 1);
    el.cv.width = Math.round(r.width * dpr);
    el.cv.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spark() {
    const r = el.cv.getBoundingClientRect();
    const W = r.width, H = r.height;
    ctx.clearRect(0, 0, W, H);
    if (hist.length < 2) return;

    const top = Math.max(70, (hz || 60) * 1.12);
    const x = i => (i / (HIST - 1)) * W;
    const y = v => H - 5 - (Math.min(v, top) / top) * (H - 10);

    // reference line at the display's own refresh rate
    if (hz) {
      ctx.strokeStyle = 'rgba(134,145,165,.3)';
      ctx.setLineDash([3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, y(hz)); ctx.lineTo(W, y(hz)); ctx.stroke();
      ctx.setLineDash([]);
    }

    // filled area, then the bright line — no shadowBlur, as the product does it
    ctx.beginPath();
    ctx.moveTo(x(0), H);
    for (let i = 0; i < hist.length; i++) ctx.lineTo(x(i), y(hist[i]));
    ctx.lineTo(x(hist.length - 1), H);
    ctx.closePath();
    ctx.fillStyle = 'rgba(94,255,196,.10)';
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < hist.length; i++) (i ? ctx.lineTo : ctx.moveTo).call(ctx, x(i), y(hist[i]));
    ctx.strokeStyle = '#5effc4';
    ctx.lineWidth = 1.6;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  function loop(t) {
    requestAnimationFrame(loop);
    if (!last) { last = t; return; }
    const dt = t - last;
    last = t;
    if (dt <= 0 || dt > 250) return;          // tab was hidden, or a stall: not a frame rate

    if (probe.length < 140) {
      probe.push(dt);
      if (probe.length === 140) {
        const sorted = [...probe].sort((a, b) => a - b);
        hz = Math.round(1000 / sorted[Math.floor(sorted.length * 0.1)]);   // 10th percentile
        // snap to the usual panel rates so 59.7 reads as 60
        const common = [60, 75, 90, 100, 120, 144, 165, 170, 180, 240, 360];
        const near = common.find(c => Math.abs(c - hz) <= Math.max(3, c * 0.04));
        if (near) hz = near;
        if (el.hz) el.hz.textContent = hz + ' Hz';
      }
    }

    frames++; acc += dt;
    if (acc >= 250) {                          // update the readout 4x a second
      const fps = Math.round(frames * 1000 / acc);
      frames = 0; acc = 0;
      shown = fps;
      peak = Math.max(peak, fps);
      el.now.textContent = fps;
      hist.push(fps);
      if (hist.length > HIST) hist.shift();
      spark();
    }
  }

  const ro = new ResizeObserver(() => { resize(); spark(); });
  ro.observe(el.cv);
  resize();

  if (REDUCED) {
    el.now.textContent = '—';
    if (el.hz) el.hz.textContent = 'reduced motion';
    if (el.note) el.note.textContent = 'Your system asks for reduced motion, so the meter is not running.';
  } else {
    requestAnimationFrame(loop);
  }
}
