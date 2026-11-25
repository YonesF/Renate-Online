// Forhåndsvisning som oppfører seg som GitHub Pages: nettstedet ligger under /Renate-Online/,
// mapper uten skråstrek sendes videre til adressen med skråstrek, og ukjente adresser får 404.html.
//
//   node tools/serve.mjs            → http://localhost:4173/Renate-Online/

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const SITE = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname.slice(1))), '..');
const BASE = process.env.BASE || '/Renate-Online/';
const PORT = Number(process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.webp': 'image/webp', '.gif': 'image/gif', '.md': 'text/plain; charset=utf-8',
};

async function file(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isFile() ? p : null;
  } catch {
    return null;
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === '/' || pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE }).end();
    return;
  }
  if (!pathname.startsWith(BASE)) return notFound(res);
  const rel = pathname.slice(BASE.length);
  const target = path.resolve(SITE, rel);
  if (!target.startsWith(SITE)) return notFound(res);
  if (rel.startsWith('tools/')) return notFound(res);
  let found = await file(target);
  if (!found && (await file(path.join(target, 'index.html')))) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/${url.search}` }).end();
      return;
    }
    found = path.join(target, 'index.html');
  }
  if (!found) return notFound(res);
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(found)] || 'application/octet-stream' });
  res.end(await fs.readFile(found));
}).listen(PORT, () => console.log(`Forhåndsvisning: http://localhost:${PORT}${BASE}`));

async function notFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(await fs.readFile(path.join(SITE, '404.html')));
}
