// Local test server: serves the site like Vercel does and runs api/*.js.
//   node tools/dev-server.mjs            -> http://localhost:3000
// DATABASE_URL is read from .env.local (not committed), e.g.
//   DATABASE_URL=postgres://postgres:PASSWORD@localhost:5432/eimc
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envFile = path.join(root, '.env.local');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.txt': 'text/plain', '.xml': 'application/xml' };
const PORT = +process.env.PORT || 3000;

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    // /api/<name> and one folder deep, /api/<folder>/<name> (Vercel routes api/app/login.js the
    // same way). Names starting with "_" are helpers, never routes.
    const api = url.pathname.match(/^\/api\/((?:[a-z0-9-]+\/)?[a-z0-9-]+)$/);
    if (api) {
      const file = path.join(root, 'api', `${api[1]}.js`);
      if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('{"error":"not found"}'); }
      const mod = await import(pathToFileURL(file).href);
      return await mod.default(req, res);
    }
    let p = decodeURIComponent(url.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.normalize(path.join(root, p));
    if (!file.startsWith(root) || /[\\/](api|node_modules|\.git)[\\/]/.test(file.slice(root.length)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.statusCode = 404; return res.end('Not found');
    }
    res.setHeader('Content-Type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e); res.statusCode = 500; res.end('Server error');
  }
}).listen(PORT, () => console.log(`EIMC site on http://localhost:${PORT}  (db: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'})`));
