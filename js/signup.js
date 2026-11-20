'use strict';
/* The sign-up page: create an account, start the 1-day Pro trial, sign in.
   Everything that matters is checked again on the server (api/signup.js). */

import { signUp } from '/js/auth.js';
import { mountThemeToggle } from '/js/theme-toggle.js';

mountThemeToggle();

const $ = s => document.querySelector(s);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.querySelectorAll('[data-year]').forEach(n => { n.textContent = new Date().getFullYear(); });

// live Pro price in the brand panel (same source as every other page)
import('/js/pricing-data.js').then(({ planById, inr }) => {
  const pro = planById('pro');
  if (pro) document.querySelectorAll('[data-price="pro"]').forEach(n => { n.textContent = inr(pro.monthly); });
}).catch(() => {});

const form = $('#su-form'), go = $('#lg-go'), err = $('#lg-err'), card = $('#lg-card');
const F = { name: $('#su-name'), email: $('#su-email'), phone: $('#su-phone'), password: $('#su-pw') };

function fail(msg, field) {
  err.textContent = msg;
  err.classList.add('on');
  card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  const el = F[field] || (field === 'agree' ? $('#su-agree') : null);
  if (el) { el.closest('.inp')?.classList.add('bad'); el.focus(); }
}
Object.values(F).forEach(f => f.addEventListener('input', () => { f.closest('.inp').classList.remove('bad'); err.classList.remove('on'); }));
F.phone.addEventListener('input', () => { F.phone.value = F.phone.value.replace(/[^\d]/g, '').replace(/^(91|0)(?=\d{10})/, '').slice(0, 10); });
F.email.addEventListener('blur', () => { F.email.value = F.email.value.trim().toLowerCase(); });

/* password strength: length, letters + digits, mixed case, a symbol */
const meter = $('#su-meter'), hint = $('#su-pw-hint');
F.password.addEventListener('input', () => {
  const p = F.password.value;
  const s = !p ? 0 : 1 + (p.length >= 8 && /[A-Za-z]/.test(p) && /\d/.test(p)) + (/[a-z]/.test(p) && /[A-Z]/.test(p)) + (/[^A-Za-z0-9]/.test(p) && p.length >= 10);
  meter.dataset.s = String(s);
  hint.textContent = !p ? 'Use letters and at least one number.'
    : s < 2 ? 'Too weak: at least 8 characters, with letters and a number.' : s < 3 ? 'Good. Mixed case or a symbol makes it stronger.' : 'Strong password.';
});
$('#su-eye').addEventListener('click', e => {
  const show = F.password.type === 'password';
  F.password.type = show ? 'text' : 'password';
  e.currentTarget.setAttribute('aria-pressed', String(show));
  e.currentTarget.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  F.password.focus();
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  if (go.disabled) return;
  const name = F.name.value.trim().replace(/\s+/g, ' ');
  const email = F.email.value.trim().toLowerCase();
  const phone = F.phone.value.replace(/\D/g, '');
  const password = F.password.value;
  if (name.length < 2) return fail('Enter your full name.', 'name');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return fail('Enter a valid email address.', 'email');
  if (!/^[6-9]\d{9}$/.test(phone)) return fail('Enter a 10-digit Indian mobile number.', 'phone');
  if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return fail('Use at least 8 characters, with letters and a number.', 'password');
  if (!$('#su-agree').checked) return fail('Please tick the box to confirm you have read the risk notice.', 'agree');

  go.disabled = true; go.classList.add('busy'); $('.lg-go-t').textContent = 'Creating your account';
  try {
    try { sessionStorage.setItem('eimc.justSignedUp', '1'); } catch { /* fine */ }
    const r = await signUp({ name, email, phone, password, agree: true, offers: $('#su-offers').checked, website: $('#su-web').value });
    done(r, name);
  } catch (ex) {
    try { sessionStorage.removeItem('eimc.justSignedUp'); } catch { /* fine */ }
    go.disabled = false; go.classList.remove('busy'); $('.lg-go-t').textContent = 'Create account';
    fail(ex.message, ex.field);
  }
});

function done(r, name) {
  $('#su-first').textContent = name.split(' ')[0];
  $('#su-id').textContent = r.clientId;
  $('#su-until').textContent = new Date(r.trialEnds).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  const step = $('#su-step'), ok = $('#su-done');
  const show = () => { step.hidden = true; ok.hidden = false; ok.focus({ preventScroll: true }); try { sessionStorage.removeItem('eimc.justSignedUp'); } catch { /* fine */ } };
  if (REDUCED) show(); else { step.style.transition = 'opacity .25s'; step.style.opacity = '0'; setTimeout(show, 250); }
  $('#su-copy').addEventListener('click', async e => {
    try { await navigator.clipboard.writeText(r.clientId); e.currentTarget.textContent = 'Copied'; } catch { /* select it instead */ }
  });
}

F.name.focus({ preventScroll: true });

/* the brand panel video, as on the login page */
(function bg() {
  const v = $('#lg-vid');
  if (!v) return;
  if (REDUCED || getComputedStyle(v).display === 'none') { v.removeAttribute('autoplay'); v.pause(); return; }
  const play = () => { const p = v.play(); if (p && p.catch) p.catch(() => {}); };
  document.addEventListener('visibilitychange', () => (document.hidden ? v.pause() : play()));
  play();
})();
