/* /api/plans  (public, GET)
   The plans on sale, read from the same database the admin panel edits, so a
   price changed in EIMC-Admin shows up on the pricing, offer and buy pages.
   js/pricing-data.js loads this and keeps its own numbers only as a fallback. */
import { many } from './_db.js';

const num = v => (v == null ? null : Number(v));

export default async function handler(req, res) {
  if (req.method !== 'GET') { res.statusCode = 405; return res.end('{"error":"Method not allowed."}'); }
  try {
    const rows = await many(
      `SELECT p.code, p.name, p.description, p.price_monthly, p.list_price, p.max_devices,
              coalesce(array_agg(pf.feature_code ORDER BY pf.feature_code) FILTER (WHERE pf.feature_code IS NOT NULL), '{}') AS features
         FROM plans p LEFT JOIN plan_features pf ON pf.plan_code = p.code
        WHERE p.is_sellable
        GROUP BY p.code ORDER BY p.sort_order, p.code`);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // a minute at the edge, so the database is not hit on every page view
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    res.end(JSON.stringify({
      plans: rows.map(p => ({
        code: p.code, name: p.name, description: p.description || '',
        monthly: num(p.price_monthly), listPrice: num(p.list_price), devices: p.max_devices, features: p.features,
      })),
    }));
  } catch (e) {
    console.error('plans', e);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.end('{"error":"Plans are not available right now."}');
  }
}
