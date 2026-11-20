/* /api/account
   GET                     -> the whole account object js/account.js renders
   POST { action, args }   -> one change (saveProfile, savePrefs, ...)
   Every query is limited to the signed-in user's own user_id. */
import { many, one, q, tx } from './_db.js';
import { body, currentUser, fail, sameOrigin, send } from './_session.js';

const CATS = ['Billing & payments', 'Licence & activation', 'Dhan connection', 'Data & accuracy', 'Bug report', 'Account', 'Something else'];
const TAGS = ['Charts', 'Order flow', 'Options', 'Setups', 'Trading', 'Terminal', 'Platform', 'Account'];
const GST = 0.18;

const iso = d => (d ? new Date(d).toISOString() : null);
const num = v => (v == null ? 0 : Number(v));
const r2 = n => Math.round(n * 100) / 100;
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const BRAND = { visa: 'Visa', mastercard: 'Mastercard', rupay: 'RuPay', amex: 'Amex', diners: 'Diners' };
const cycleWord = c => (c === 'trial' ? 'trial' : 'monthly');   // only monthly billing is sold
const plus = d => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x; };

class UserError extends Error { constructor(m, code, status = 400) { super(m); this.code = code; this.status = status; } }

/* ═══════════════════════════════════════════════════════ read */
async function account(uid) {
  const u = await one(
    `SELECT u.*, p.*, np.*, sec.two_factor_enabled
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       LEFT JOIN notification_preferences np ON np.user_id = u.id
       LEFT JOIN user_security sec ON sec.user_id = u.id
      WHERE u.id = $1`, [uid]);

  const s = await one(
    `SELECT s.*, pl.name AS plan_name, pl.price_monthly, pl.max_devices,
            eimc.access_until(s) AS access_until,
            EXISTS (SELECT 1 FROM subscriptions h WHERE h.user_id = s.user_id AND h.billing_cycle = 'trial' AND h.id <> s.id) AS had_trial
       FROM subscriptions s JOIN plans pl ON pl.code = s.plan_code
      WHERE s.user_id = $1 AND s.is_current`, [uid]);

  const [methods, devices, orders, tickets, logins, ideas, lic, notes] = await Promise.all([
    many(`SELECT * FROM payment_methods WHERE user_id = $1 AND status <> 'removed' ORDER BY is_default DESC, created_at DESC`, [uid]),
    many(`SELECT * FROM devices WHERE user_id = $1 AND NOT revoked ORDER BY last_seen DESC`, [uid]),
    many(`SELECT o.*, i.invoice_no,
                 CASE pm.method_type WHEN 'card' THEN initcap(pm.card_brand) || ' •••• ' || pm.card_last4
                                     WHEN 'upi'  THEN 'UPI Autopay' ELSE pm.method_type END AS paid_with
            FROM orders o
            LEFT JOIN invoices i ON i.order_id = o.id
            LEFT JOIN LATERAL (SELECT * FROM payments p WHERE p.order_id = o.id ORDER BY p.paid_at DESC LIMIT 1) p ON true
            LEFT JOIN payment_methods pm ON pm.id = p.payment_method_id
           WHERE o.user_id = $1 ORDER BY o.created_at DESC`, [uid]),
    many(`SELECT t.*, (SELECT m.body FROM support_messages m WHERE m.ticket_id = t.id AND m.sender = 'agent'
                        ORDER BY m.created_at DESC LIMIT 1) AS last_reply
            FROM support_tickets t WHERE t.user_id = $1 ORDER BY t.created_at DESC`, [uid]),
    many(`SELECT user_agent, location, at FROM login_history WHERE user_id = $1 AND success ORDER BY at DESC LIMIT 5`, [uid]),
    many(`SELECT f.*, f.base_votes + (SELECT count(*) FROM feature_votes v WHERE v.feature_request_id = f.id) AS votes,
                 EXISTS (SELECT 1 FROM feature_votes v WHERE v.feature_request_id = f.id AND v.user_id = $1) AS voted
            FROM feature_requests f ORDER BY f.created_at DESC`, [uid]),
    one(`SELECT * FROM licences WHERE user_id = $1`, [uid]),
    // messages the EIMC team sends from the admin panel (push and in-app)
    many(`SELECT id, channel, title, body, is_read, created_at FROM notifications
           WHERE user_id = $1 AND channel IN ('in_app', 'push') ORDER BY created_at DESC LIMIT 50`, [uid]),
  ]);

  // ---- subscription (free plan if none)
  const now = new Date();
  let sub;
  if (s) {
    const trial = s.status === 'trialing';
    const start = s.current_period_start || s.started_at;
    const end = trial ? (s.trial_end || s.current_period_end) : (s.current_period_end || plus(start));
    const cycle = 'monthly';
    const price = num(s.price_monthly);
    const gst = r2(price * GST);
    sub = {
      plan: s.plan_code, planName: s.plan_name + (trial ? ' trial' : ''),
      cycle, cycleNext: 'monthly', status: s.status,
      price, gst, total: r2(price + gst),
      currentStart: iso(start), currentEnd: iso(end),
      accessUntil: iso(s.access_until), hasAccess: !!s.access_until,
      autoRenew: s.auto_renew, cancelAtPeriodEnd: s.cancel_at_period_end,
      seats: s.seats || s.max_devices, trialUsed: trial || s.had_trial,
    };
  } else {
    const end = plus(now);
    sub = { plan: 'free', planName: 'Free', cycle: 'monthly', cycleNext: 'monthly', status: 'free', price: 0, gst: 0, total: 0,
      currentStart: iso(now), currentEnd: iso(end), accessUntil: null, hasAccess: false,
      autoRenew: false, cancelAtPeriodEnd: false, seats: 1, trialUsed: false };
  }

  const mapMethod = m => m.method_type === 'card'
    ? { id: `pm-${m.id}`, type: 'card', label: BRAND[m.card_brand] || 'Card', detail: `•••• ${m.card_last4}`,
        note: `${m.status === 'expired' ? 'Expired' : 'Expires'} ${String(m.card_exp_month).padStart(2, '0')}/${String(m.card_exp_year).slice(-2)}`,
        added: iso(m.created_at), default: m.is_default }
    : { id: `pm-${m.id}`, type: m.method_type, label: m.method_type === 'upi' ? 'UPI Autopay' : 'Net banking',
        detail: m.upi_vpa_masked || m.bank_name || '', note: m.method_type === 'upi' ? 'Autopay mandate' : '',
        added: iso(m.created_at), default: m.is_default };
  const ms = methods.map(mapMethod);
  if (ms.length && !ms.some(m => m.default)) ms[0].default = true;

  const ticketStatus = t => (['resolved', 'closed'].includes(t) ? 'resolved' : t === 'waiting_customer' ? 'waiting' : 'open');
  const itemName = (plan, cycle, fallback) => plan ? `${plan[0].toUpperCase()}${plan.slice(1)} — ${cycleWord(cycle)}` : fallback;

  return {
    profile: {
      clientId: String(u.client_id), name: u.full_name, email: u.email, phone: u.phone || '',
      city: u.city || '', state: u.state || '', country: u.country || 'India',
      language: u.language || 'English', timezone: 'Asia/Kolkata (IST)',
      experience: u.experience || '', trades: u.trades || '',
      memberSince: iso(u.created_at), emailVerified: u.email_verified, phoneVerified: u.phone_verified,
      twoFactor: !!u.two_factor_enabled,
    },
    subscription: sub,
    licence: lic ? {
      key: lic.licence_key, version: lic.app_version, revoked: lic.revoked,
      broker: { name: lic.broker_name, status: lic.broker_status, clientId: lic.broker_client_masked || '—', since: iso(lic.broker_since) },
    } : { key: '—', version: 'v1.25.218.93', revoked: false, broker: { name: 'Dhan', status: 'not connected', clientId: '—', since: null } },
    devices: devices.map((d, i) => ({
      id: `dev-${d.id}`, name: d.label || 'PC', os: d.os || 'Windows', version: d.app_version || '',
      lastSeen: iso(d.last_seen), here: i === 0,
    })),
    methods: ms,
    billing: {
      name: u.billing_name || u.full_name, gstin: u.gstin || '', line1: u.billing_line1 || '', line2: u.billing_line2 || '',
      city: u.billing_city || '', state: u.billing_state || '', pin: u.billing_pin || '',
    },
    orders: orders.map(o => ({
      id: o.order_no, invoice: o.invoice_no, date: iso(o.created_at),
      item: itemName(o.plan_code, o.billing_cycle, o.description),
      period: [iso(o.created_at), iso(plus(o.created_at))],
      amount: num(o.amount) - num(o.discount), gst: num(o.gst_amount), total: num(o.total),
      method: o.paid_with || '—', status: o.status,
    })),
    upcoming: { date: sub.currentEnd, item: `${s ? s.plan_name : 'Free'} — monthly`,
      amount: sub.price, gst: r2(sub.price * GST), total: r2(sub.price * (1 + GST)) },
    notifications: notes.map(n => ({
      id: `note-${n.id}`, channel: n.channel, title: n.title, body: n.body || '', read: n.is_read, created: iso(n.created_at),
    })),
    tickets: tickets.map(t => ({
      id: t.ticket_no, subject: t.subject, category: t.category, status: ticketStatus(t.status),
      created: iso(t.created_at), updated: iso(t.updated_at), last: t.last_reply || '',
    })),
    sessions: logins.map((l, i) => ({ device: deviceName(l.user_agent), where: l.location || 'India', when: iso(l.at), current: i === 0 })),
    prefs: { renewal: u.renewal ?? true, invoices: u.invoices ?? true, product: u.product ?? true, setups: u.setups ?? false, offers: u.offers ?? false },
    ideas: ideas.map(f => ({
      id: `idea-${f.id}`, title: f.title, body: f.description || '', status: f.status, votes: Number(f.votes),
      tag: f.tag, mine: f.user_id === uid, voted: f.voted, shipped: f.shipped_version || undefined, created: iso(f.created_at),
    })),
  };
}

function deviceName(ua = '') {
  if (/EIMC/.test(ua)) return 'EIMC Terminal';
  const b = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad/.test(ua) ? 'iPhone' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'Mac' : '';
  return os ? `${b} on ${os}` : b;
}

const idOf = (v, prefix) => {
  const m = String(v || '').match(new RegExp(`^${prefix}-(\\d{1,18})$`));
  if (!m) throw new UserError('That item was not found.');
  return m[1];
};

/* ═══════════════════════════════════════════════════════ writes */
const actions = {
  async saveProfile(uid, [p = {}]) {
    const name = str(p.name, 120).replace(/\s+/g, ' ');
    const email = str(p.email, 320).toLowerCase();
    const phone = str(p.phone, 20).replace(/[\s-]/g, '');
    if (!name) throw new UserError('Enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new UserError('Enter a valid email address.');
    if (phone && !/^\+?\d{10,15}$/.test(phone)) throw new UserError('Enter a valid mobile number.');
    const [first, ...rest] = name.split(' ');
    const normPhone = phone ? (phone.startsWith('+') ? phone : `+91${phone.slice(-10)}`) : null;
    await tx(async c => {
      const cur = await c.query(`SELECT email, phone FROM users WHERE id = $1`, [uid]);
      const was = cur.rows[0];
      await c.query(`UPDATE users SET first_name = $2, last_name = $3, email = $4, phone = $5,
                       email_verified = email_verified AND lower(email) = lower($4),
                       phone_verified = phone_verified AND phone IS NOT DISTINCT FROM $5
                     WHERE id = $1`, [uid, first, rest.join(' ') || '', email, normPhone]);
      await c.query(`UPDATE user_profiles SET city = $2, state = $3, experience = $4, trades = $5, language = $6, updated_at = now()
                     WHERE user_id = $1`, [uid, str(p.city, 80), str(p.state, 80), str(p.experience, 60), str(p.trades, 120), str(p.language, 40) || 'English']);
      await c.query(`INSERT INTO audit_log (user_id, actor, action, details) VALUES ($1, 'customer', 'profile.updated', $2)`,
        [uid, JSON.stringify({ emailChanged: was.email !== email, phoneChanged: was.phone !== normPhone })]);
    }).catch(e => { if (e.code === '23505') throw new UserError('That email or mobile number is already used by another account.'); throw e; });
    return { ok: true };
  },

  async savePrefs(uid, [p = {}]) {
    const b = k => p[k] === true;
    await q(`UPDATE notification_preferences SET renewal = $2, invoices = $3, product = $4, setups = $5, offers = $6,
               email_marketing = $6, email_product_updates = $4, updated_at = now() WHERE user_id = $1`,
      [uid, b('renewal'), b('invoices'), b('product'), b('setups'), b('offers')]);
    return p;
  },

  async saveBilling(uid, [d = {}]) {
    const gstin = str(d.gstin, 15).toUpperCase();
    if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new UserError('That is not a valid 15-character GSTIN.');
    const pin = str(d.pin, 6);
    if (pin && !/^[1-9]\d{5}$/.test(pin)) throw new UserError('Use a 6-digit PIN code.');
    await q(`UPDATE user_profiles SET billing_name = $2, gstin = nullif($3, ''), billing_line1 = $4, billing_line2 = $5,
               billing_city = $6, billing_state = $7, billing_pin = $8, updated_at = now() WHERE user_id = $1`,
      [uid, str(d.name, 120), gstin, str(d.line1), str(d.line2), str(d.city, 80), str(d.state, 80), pin]);
    return d;
  },

  async setDefaultMethod(uid, [id]) {
    const pm = idOf(id, 'pm');
    await tx(async c => {
      const r = await c.query(`SELECT id FROM payment_methods WHERE id = $1 AND user_id = $2 AND status = 'active'`, [pm, uid]);
      if (!r.rowCount) throw new UserError('That payment method cannot be used.');
      await c.query(`UPDATE payment_methods SET is_default = false WHERE user_id = $1 AND is_default`, [uid]);
      await c.query(`UPDATE payment_methods SET is_default = true WHERE id = $1`, [pm]);
      await c.query(`UPDATE subscriptions SET payment_method_id = $1 WHERE user_id = $2 AND is_current`, [pm, uid]);
    });
  },

  async setCancel(uid, [cancel, reason]) {
    const on = cancel === true;
    const r = await q(`UPDATE subscriptions SET cancel_at_period_end = $2, auto_renew = NOT $2,
                         cancelled_at = CASE WHEN $2 THEN now() END, cancel_reason = CASE WHEN $2 THEN nullif($3, '') END,
                         status = CASE WHEN $2 AND status = 'active' THEN 'cancelled'
                                       WHEN NOT $2 AND status = 'cancelled' AND current_period_end > now() THEN 'active'
                                       ELSE status END
                       WHERE user_id = $1 AND is_current AND status IN ('active','trialing','past_due','cancelled')`,
      [uid, on, str(reason, 500)]);
    if (!r.rowCount) throw new UserError('There is no subscription to change.');
    await q(`INSERT INTO audit_log (user_id, actor, action, details) VALUES ($1, 'customer', $2, $3)`,
      [uid, on ? 'subscription.cancel' : 'subscription.resume', JSON.stringify({ reason: str(reason, 500) || null })]);
  },

  async markNotificationsRead(uid) {
    await q(`UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read AND channel IN ('in_app', 'push')`, [uid]);
  },

  async removeDevice(uid, [id]) {
    const r = await q(`UPDATE devices SET revoked = true WHERE id = $1 AND user_id = $2 AND NOT revoked`, [idOf(id, 'dev'), uid]);
    if (!r.rowCount) throw new UserError('That PC was not found.');
  },

  async createTicket(uid, [t = {}]) {
    const category = CATS.includes(t.category) ? t.category : 'Something else';
    const subject = str(t.subject, 120), message = str(t.message, 4000);
    if (!subject || !message) throw new UserError('Add a subject and describe what happened.');
    const open = await one(`SELECT count(*)::int AS n FROM support_tickets WHERE user_id = $1 AND created_at > now() - interval '1 day'`, [uid]);
    if (open.n >= 10) throw new UserError('You have sent a lot of tickets today. We will reply to those first.');
    const row = await tx(async c => {
      const r = await c.query(`INSERT INTO support_tickets (user_id, category, subject, include_system) VALUES ($1, $2, $3, $4)
                               RETURNING ticket_no, created_at`, [uid, category, subject, t.system === true]);
      await c.query(`INSERT INTO support_messages (ticket_id, sender, body)
                     SELECT id, 'customer', $2 FROM support_tickets WHERE ticket_no = $1`, [r.rows[0].ticket_no, message]);
      return r.rows[0];
    });
    return { id: row.ticket_no, category, subject, status: 'open', created: iso(row.created_at), updated: iso(row.created_at), last: '' };
  },

  async submitIdea(uid, [i = {}]) {
    const title = str(i.title, 90), text = str(i.body, 1200);
    const tag = TAGS.includes(i.tag) ? i.tag : 'Terminal';
    if (!title) throw new UserError('Give your idea a title.');
    const row = await tx(async c => {
      const r = await c.query(`INSERT INTO feature_requests (user_id, title, description, tag) VALUES ($1, $2, $3, $4) RETURNING id, created_at`,
        [uid, title, text, tag]);
      await c.query(`INSERT INTO feature_votes (feature_request_id, user_id) VALUES ($1, $2)`, [r.rows[0].id, uid]);
      return r.rows[0];
    });
    return { id: `idea-${row.id}`, title, body: text, tag, status: 'new', votes: 1, mine: true, voted: true, created: iso(row.created_at) };
  },

  async vote(uid, [id, on]) {
    const fid = idOf(id, 'idea');
    if (on === true) {
      await q(`INSERT INTO feature_votes (feature_request_id, user_id)
               SELECT id, $2 FROM feature_requests WHERE id = $1 AND status <> 'shipped'
               ON CONFLICT DO NOTHING`, [fid, uid]);
    } else {
      await q(`DELETE FROM feature_votes v USING feature_requests f
                WHERE v.feature_request_id = $1 AND v.user_id = $2 AND f.id = v.feature_request_id AND f.user_id IS DISTINCT FROM $2`, [fid, uid]);
    }
  },

  async changePassword(uid, [current, next], session) {
    const cur = String(current || ''), nxt = String(next || '');
    const ok = await one(`SELECT eimc.check_password($1, $2) AS ok`, [uid, cur]);
    if (!ok?.ok) throw new UserError('Your current password is not right.', 'password');
    if (nxt.length < 8) throw new UserError('Use at least 8 characters.', 'password');
    if (nxt.length > 128) throw new UserError('Use at most 128 characters.', 'password');
    if (nxt === cur) throw new UserError('Choose a password different from the current one.', 'password');
    await tx(async c => {
      await c.query(`SELECT eimc.set_password($1, $2)`, [uid, nxt]);
      // sign out every other browser and terminal; keep this one
      await c.query(`UPDATE sessions SET revoked = true WHERE user_id = $1 AND id <> $2 AND NOT revoked`, [uid, session.session_id]);
      await c.query(`INSERT INTO audit_log (user_id, actor, action) VALUES ($1, 'customer', 'password.changed')`, [uid]);
    });
  },
};

/* ═══════════════════════════════════════════════════════ route */
export default async function handler(req, res) {
  try {
    const me = await currentUser(req);
    if (!me) return fail(res, 401, 'Your session has ended. Please log in again.', 'expired');
    const uid = String(me.user_id);

    if (req.method === 'GET') return send(res, 200, await account(uid));

    if (req.method === 'POST') {
      if (!sameOrigin(req)) return fail(res, 403, 'Bad origin.');
      const b = await body(req);
      const fn = Object.hasOwn(actions, b.action) ? actions[b.action] : null;
      if (!fn) return fail(res, 400, 'Unknown action.');
      const result = await fn(uid, Array.isArray(b.args) ? b.args : [], me);
      return send(res, 200, result ?? { ok: true });
    }
    return fail(res, 405, 'Method not allowed.');
  } catch (e) {
    if (e instanceof UserError) return fail(res, e.status, e.message, e.code);
    console.error('account', e);
    return fail(res, 500, 'Something went wrong on our side. Try again.');
  }
}
