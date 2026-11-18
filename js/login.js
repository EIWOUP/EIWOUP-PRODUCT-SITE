'use strict';
/* The login page: the form, and the slow live-looking chart behind the brand panel. */

import { signIn, signedIn, safeNext, lockedFor } from '/js/auth.js';
import { mountThemeToggle } from '/js/theme-toggle.js';

mountThemeToggle();

const $ = s => document.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const next = safeNext(new URLSearchParams(location.search).get('next'));

if (signedIn()) location.replace(next);
document.querySelectorAll('[data-year]').forEach(n => { n.textContent = new Date().getFullYear(); });

/* ── the form ─────────────────────────────────────────────────────── */
const form = $('#lg-form'), id = $('#lg-id'), pw = $('#lg-pw'), go = $('#lg-go'), err = $('#lg-err');
const card = $('#lg-card');

function fail(msg, field) {
  err.textContent = msg;
  err.classList.add('on');
  card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  if (field) { field.closest('.inp').classList.add('bad'); field.focus(); }
}
[id, pw].forEach(f => f.addEventListener('input', () => { f.closest('.inp').classList.remove('bad'); err.classList.remove('on'); }));
id.addEventListener('input', () => { id.value = id.value.replace(/\s+/g, ''); });

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (go.disabled) return;
  if (!id.value.trim()) return fail('Enter your client ID.', id);
  if (!pw.value) return fail('Enter your password.', pw);
  const wait = lockedFor();
  if (wait) return fail(`Too many attempts. Try again in ${Math.ceil(wait / 1000)} seconds.`);
  go.disabled = true; go.classList.add('busy'); $('.lg-go-t').textContent = 'Logging in';
  try {
    await signIn(id.value, pw.value, $('#lg-remember').checked);
    $('.lg-go-t').textContent = 'Welcome back';
    go.classList.remove('busy'); go.classList.add('ok');
    setTimeout(() => location.replace(next), REDUCED ? 0 : 380);
  } catch (ex) {
    go.disabled = false; go.classList.remove('busy'); $('.lg-go-t').textContent = 'Log in';
    pw.value = '';
    fail(ex.message, ex.code === 'locked' ? null : pw);
  }
});

$('#lg-eye').addEventListener('click', e => {
  const show = pw.type === 'password';
  pw.type = show ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', String(show));
  e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  pw.focus();
});
const caps = e => { $('#lg-caps').hidden = !(e.getModifierState && e.getModifierState('CapsLock')); };
pw.addEventListener('keydown', caps); pw.addEventListener('keyup', caps);
$('#lg-forgot').addEventListener('click', () => { const b = $('#lg-forgot-box'); b.hidden = !b.hidden; });
id.focus({ preventScroll: true });

/* ── the brand panel: the home page recording, zoomed onto the candles ── */
(function bg() {
  const v = $('#lg-vid');
  if (!v) return;
  if (REDUCED || getComputedStyle(v).display === 'none') { v.removeAttribute('autoplay'); v.pause(); return; }
  const go = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  document.addEventListener('visibilitychange', () => (document.hidden ? v.pause() : go()));
  go();
})();
