'use strict';
/* ════════════════════════════════════════════════════════════════════
   Site-wide notices, set in EIMC-Admin → Releases & access:
   - "service down" with its reason (the terminal shows the same), and
   - announcements meant for the website (shown on "site" or "both").
   /api/app/status?for=site is cached at the edge for 30 s, so a change
   in the admin reaches every page within about half a minute.
   Each notice can be closed; it then stays closed in this browser
   until the admin changes it (its id and text are the key).
   ════════════════════════════════════════════════════════════════════ */

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KEY = 'eimc.notices.closed';
const closed = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); } };
const remember = set => { try { localStorage.setItem(KEY, JSON.stringify([...set].slice(-40))); } catch { /* private mode */ } };
const hash = s => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) | 0; return (h >>> 0).toString(36); };
const when = d => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });

export async function mountNotices() {
  if (typeof fetch !== 'function' || !/^https?:$/.test(location.protocol)) return;
  let s;
  try {
    const r = await fetch('/api/app/status?for=site', { headers: { Accept: 'application/json' } });
    if (!r.ok) return;
    s = await r.json();
  } catch { return; }

  const items = [];
  if (s.service?.down) {
    items.push({ key: `down-${hash(`${s.service.reason}|${s.service.message}`)}`, level: 'critical',
      title: `EIMC Terminal is down${s.service.reason ? `: ${s.service.reason}` : ''}`,
      body: [s.service.message, s.service.expectedBackAt ? `Expected back around ${when(s.service.expectedBackAt)} IST.` : ''].filter(Boolean).join(' ') });
  }
  for (const n of s.notices || []) {
    items.push({ key: `n${n.id}-${hash(`${n.title}|${n.body}`)}`, level: n.level || 'info', title: n.title, body: n.body || '' });
  }
  const gone = closed();
  const show = items.filter(i => !gone.has(i.key)).slice(0, 3);
  if (!show.length) return;

  const box = document.createElement('div');
  box.className = 'site-notices';
  box.setAttribute('role', 'region');
  box.setAttribute('aria-label', 'Notices from EIMC');
  box.innerHTML = show.map(i => `
    <div class="site-notice ${esc(i.level)}" data-key="${esc(i.key)}" role="${i.level === 'critical' ? 'alert' : 'status'}">
      <div><b>${esc(i.title)}</b>${i.body ? `<span>${esc(i.body)}</span>` : ''}</div>
      <button type="button" aria-label="Close this notice">&times;</button>
    </div>`).join('');
  box.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    const n = b.closest('.site-notice');
    gone.add(n.dataset.key); remember(gone);
    n.remove();
    if (!box.children.length) box.remove();
  });
  document.body.append(box);
}
