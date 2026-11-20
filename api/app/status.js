/* GET /api/app/status[?for=terminal|site]  — public, no sign-in.
   -> { version: { latest, minSupported, downloadUrl, sha256, ... }, service: { down, reason, ... },
        notices: [...] }

   The terminal calls this before anything else at launch, so it can say "update required" or
   "down for maintenance" even when nobody is signed in, and the download page reads the latest
   installer from it. Only notices meant for everyone are listed here; plan-specific ones come
   with the signed-in licence. Cached at the edge for 30 s: changing a setting in admin reaches
   everyone within about half a minute. */
import { fail } from '../_session.js';
import { notices, policy, publicPolicy, sendError } from '../_licence.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return fail(res, 405, 'Method not allowed.');
  try {
    const shownOn = new URL(req.url, 'http://x').searchParams.get('for') === 'site' ? 'site' : 'terminal';
    const pol = await policy();
    const payload = { ...publicPolicy(pol), notices: await notices(shownOn) };
    // Same for everyone, so the edge may cache it (send() would force no-store).
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');
    res.end(JSON.stringify(payload));
  } catch (e) {
    return sendError(res, e, 'app/status');
  }
}
