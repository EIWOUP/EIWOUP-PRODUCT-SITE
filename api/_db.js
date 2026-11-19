/* Shared PostgreSQL pool for the /api functions.
   DATABASE_URL comes from Vercel (added by the Neon integration) or from
   your shell when testing locally. Files starting with "_" are not routes. */
import pg from 'pg';

const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
const local = !raw || /@(localhost|127\.0\.0\.1)[:/]/.test(raw);

// SSL is set explicitly below (full certificate check), so drop the URL's ssl params.
const url = raw.replace(/([?&])(sslmode|channel_binding)=[^&]*/g, '$1').replace(/[?&]+$/, '').replace(/\?&+/, '?');

// One small pool per warm function instance. Neon's pooled URL handles the rest.
// search_path (eimc, public) is set on the database itself by setup-database.ps1;
// Neon's pooler does not accept it as a startup option.
const pool = globalThis.__eimcPool ||= new pg.Pool({
  connectionString: url,
  ssl: local ? false : { rejectUnauthorized: true },
  max: 3,
  idleTimeoutMillis: 10_000,
});

export const q = (text, params) => pool.query(text, params);
export const one = async (text, params) => (await pool.query(text, params)).rows[0] || null;
export const many = async (text, params) => (await pool.query(text, params)).rows;

/* run fn(client) inside BEGIN/COMMIT */
export async function tx(fn) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const r = await fn(c);
    await c.query('COMMIT');
    return r;
  } catch (e) {
    await c.query('ROLLBACK').catch(() => {});
    throw e;
  } finally { c.release(); }
}
