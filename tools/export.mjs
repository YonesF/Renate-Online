// Eksporterer hjelpesenteret i prototypen til et statisk nettsted for GitHub Pages.
//
// Krever at prototypen kjører lokalt (docker compose up, port 8080). Skriptet henter
// hver side slik PHP-appen viser den, og skriver den som index.html i en mappe, så
// adressene blir /kategori/sublimering/ osv. Alle interne lenker gjøres relative,
// slik at nettstedet virker under en undermappe som /Renate-Online/.
//
// Lena-panelet byttes mot en demo uten server (lena/lena-demo.js) som spiller av
// ekte svar fra Lena (lena/answers.js, laget med tools/record-lena.mjs) og ellers
// søker i hjelpesenterets egne tekster (lena/search-index.js, laget her).
//
//   node tools/export.mjs

import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const SITE = path.resolve(path.dirname(decodeURIComponent(new URL(import.meta.url).pathname.slice(1))), '..');
const ADDRESS = process.env.ADDRESS || '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);
const HELP_HOST = process.env.HELP_HOST || 'hjelp.localhost:8080';
const AGENT_HOST = process.env.AGENT_HOST || 'agent.localhost:8080';

function get(urlPath, host = HELP_HOST) {
  return new Promise((resolve, reject) => {
    http.get({ host: ADDRESS, port: PORT, path: urlPath, headers: { Host: host } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] || '', body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

async function write(rel, data) {
  const file = path.join(SITE, rel);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, data);
}

function mustReplace(src, from, to, what) {
  if (!src.includes(from)) throw new Error(`Fant ikke ${what} – har kildekoden endret seg?`);
  return src.split(from).join(to);
}

// ------------------------------------------------------------------ sidene
const pageFile = (p) => (p === '/' ? 'index.html' : `${p.slice(1)}/index.html`);
const depthOf = (p) => (p === '/' ? 0 : p.slice(1).split('/').length);
const media = new Map(); // /media/<id> → filnavn med filendelse
const assets = new Set();
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };

function relative(url, prefix) {
  const [, p, q = '', h = ''] = url.match(/^([^?#]*)(\?[^#]*)?(#.*)?$/);
  if (p === '/') return (prefix || './') + q + h;
  if (p.startsWith('/assets/')) {
    assets.add(p);
    return prefix + p.slice(1) + q + h;
  }
  if (p.startsWith('/media/')) {
    if (!media.has(p)) media.set(p, null);
    return `${prefix}media/${p.slice('/media/'.length)}@@MEDIA${h}`;
  }
  if (/^\/(kategori|artikkel)\/[a-z0-9-]+$/.test(p)) return `${prefix}${p.slice(1)}/${q}${h}`;
  return prefix + p.slice(1) + q + h;
}

function transformPage(html, p) {
  const prefix = '../'.repeat(depthOf(p));
  let out = html
    .replace(/ nonce="[^"]*"/g, '')
    .replace(/\b(href|src|action)="(\/(?!\/)[^"]*)"/g, (m, attr, url) => `${attr}="${relative(url, prefix)}"`)
    .replace(/url\((["']?)(\/assets\/[^"')]+)\1\)/g, (m, quote, url) => `url(${quote}${relative(url, prefix)}${quote})`);
  out = mustReplace(out, `data-origin="http://${AGENT_HOST}"`, `data-origin="${prefix}lena"`, 'adressen til Lenas panel');
  out = mustReplace(out, '<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">\n<link rel="icon" href="data:,">', 'meta charset');
  out = mustReplace(out, '<div class="wrap">Hjelp med produkter, prosjekt og tekniske utfordringer</div>',
    '<div class="wrap"><span><span class="demo-badge" title="Prototype fra IS-219 – ikke Creative Arts offisielle hjelpesenter">Prototype</span>'
      + 'Hjelp med produkter, prosjekt og tekniske utfordringer</span></div>',
    'den røde stripen øverst');
  return out;
}

const seen = new Set();
const queue = ['/', '/kategori/sublimering', '/kategori/varmepresser', '/kategori/vinyl-og-tekstil'];
const pages = new Map();
while (queue.length) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  const res = await get(p);
  if (res.status !== 200) throw new Error(`${p} svarte ${res.status}`);
  const html = res.body.toString('utf8');
  pages.set(p, html);
  for (const [, link] of html.matchAll(/href="(\/(?:kategori|artikkel)\/[a-z0-9-]+)(?:[#?][^"]*)?"/g)) {
    if (!seen.has(link)) queue.push(link);
  }
}
for (const [p, html] of pages) await write(pageFile(p), transformPage(html, p));

// Bilder i artiklene: lagres med filendelse, så GitHub Pages sender riktig type.
for (const id of media.keys()) {
  const res = await get(id);
  if (res.status !== 200) throw new Error(`${id} svarte ${res.status}`);
  const ext = EXT[res.type.split(';')[0].trim()] || 'bin';
  const name = `${id.slice('/media/'.length)}.${ext}`;
  media.set(id, name);
  await write(`media/${name}`, res.body);
}
for (const [p] of pages) {
  const file = path.join(SITE, pageFile(p));
  const html = await fs.readFile(file, 'utf8');
  await fs.writeFile(file, html.replace(/media\/([A-Za-z0-9_-]+)@@MEDIA/g, (m, id) => `media/${media.get(`/media/${id}`)}`));
}

// ------------------------------------------------------------------ Lenas panel (demo)
{
  const res = await get('/?page=%2F&title=Hjelp', AGENT_HOST);
  if (res.status !== 200) throw new Error(`Panelet svarte ${res.status}`);
  let html = res.body.toString('utf8').replace(/ nonce="[^"]*"/g, '');
  html = html.replace(/href="\/assets\/site\.css(\?[^"]*)?"/, (m, q = '') => `href="../assets/site.css${q}"`);
  html = html.replace(/<script src="\/assets\/panel\.js[^"]*"><\/script>/,
    '<script src="answers.js"></script>\n<script src="search-index.js"></script>\n<script src="lena-demo.js"></script>');
  if (!html.includes('lena-demo.js')) throw new Error('Fant ikke panel.js i panelet');
  html = html.replace(/data-help-origin="[^"]*"/, 'data-help-origin=".."');
  html = mustReplace(html, 'Lena er en AI og kan ta feil. Vi i CreativeArt kan lese samtalen.',
    'Demo: Lena svarer med ekte svar spilt inn fra prototypen. Det du skriver her, sendes ikke noe sted.', 'merknaden under chatten');
  html = mustReplace(html, '<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex">\n<link rel="icon" href="data:,">', 'meta charset i panelet');
  assets.add('/assets/site.css');
  await write('lena/index.html', html);
}

// ------------------------------------------------------------------ CSS, skript, skrifter og bilder
let css = (await get('/assets/site.css')).body.toString('utf8');
for (const [, url] of css.matchAll(/url\(["']?(\/assets\/[^"')]+)["']?\)/g)) assets.add(url);
css = css.replace(/url\((["']?)\/assets\/([^"')]+)\1\)/g, 'url($1$2$1)');
css += `
/* Statisk prototype: merkelapp i den røde stripen øverst, så ingen tar siden for Creative Arts egen. */
.demo-badge {
  display: inline-block; margin-right: 8px; padding: 2px 8px; border-radius: 999px;
  background: #ffffff; color: #a3170c; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em;
  line-height: 1.5; vertical-align: 1px; white-space: nowrap;
}
/* Toppfeltet i prototypen er bredere enn en telefon; her får det bryte over to linjer. */
@media (max-width: 40rem) {
  .topbar-inner { flex-wrap: wrap; justify-content: center; row-gap: 0.6rem; padding-block: 0.75rem; }
}
.msg-demo-note { font-size: 0.8em; opacity: 0.75; margin: 0 0 6px; }
`;
await write('assets/site.css', css);

// Kildefilene kan ha Windows-linjeskift (CRLF); endringene under forutsetter LF.
let js = (await get('/assets/help.js')).body.toString('utf8').replace(/\r\n/g, '\n');
js = mustReplace(js, "'use strict';\n", `'use strict';

  // Statisk utgave: roten til nettstedet finnes fra adressen til dette skriptet (assets/help.js),
  // så lenkene virker også når nettstedet ligger i en undermappe på GitHub Pages.
  const SITE_ROOT = new URL('../', (document.currentScript && document.currentScript.src) || location.href);
  const siteUrl = (url) => (/^https?:/.test(url) ? url
    : new URL(url.replace(/^\\//, '').replace(/^(kategori|artikkel)\\/([a-z0-9-]+)(?=[#?]|$)/, '$1/$2/'), SITE_ROOT).href);
`, 'starten av help.js');
js = mustReplace(js, "window.location.pathname !== '/'", "location.pathname.replace(/index\\.html$/, '') !== SITE_ROOT.pathname", 'sjekken for forsiden');
js = mustReplace(js, 'a.href = item.url;', 'a.href = siteUrl(item.url);', 'lenken i søkeforslagene');
js = mustReplace(js, 'location.href = selectedItem.url;', 'location.href = siteUrl(selectedItem.url);', 'valgt søkeforslag');
js = mustReplace(js, 'location.href = chosen.url;', 'location.href = siteUrl(chosen.url);', 'søk med Enter');
await write('assets/help.js', js);

for (const a of assets) {
  if (a === '/assets/site.css' || a === '/assets/help.js') continue;
  const res = await get(a);
  if (res.status !== 200) throw new Error(`${a} svarte ${res.status}`);
  await write(a.slice(1), res.body);
}

// ------------------------------------------------------------------ søkeindeks for demo-Lena
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»' };
function toText(html) {
  return html
    .replace(/<(script|style|svg)[\s\S]*?<\/\1>/g, ' ')
    .replace(/<\/(td|th)>/g, ' · ')
    .replace(/<(br|\/p|\/li|\/h[1-6]|\/tr|\/div|\/summary)\b[^>]*>/g, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n[\n ]*/g, '\n')
    .trim();
}
const index = [];
for (const [p, html] of pages) {
  const url = p === '/' ? '' : `${p.slice(1)}/`;
  if (p.startsWith('/artikkel/')) {
    const title = toText(html.match(/<article class="article">[\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '');
    const prose = html.match(/<div class="prose"[^>]*>([\s\S]*?)<nav class="pager"/)?.[1] || html.match(/<div class="prose"[^>]*>([\s\S]*?)<\/article>/)?.[1] || '';
    const parts = prose.split(/(?=<h2 id=")/);
    for (const part of parts) {
      const h = part.match(/^<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/);
      const text = toText(h ? part.slice(h[0].length) : part);
      if (text.length < 40) continue;
      index.push({ page: title, title: h ? toText(h[2]) : title, url: h ? `${url}#${h[1]}` : url, text: text.slice(0, 2500) });
    }
  }
  if (p.startsWith('/kategori/')) {
    const page = toText(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1] || '');
    for (const [, id, body] of html.matchAll(/<details class="guide-section" id="([^"]+)"[^>]*>([\s\S]*?)<\/details>/g)) {
      const title = toText(body.match(/<h2 class="guide-title"[^>]*>([\s\S]*?)<\/h2>/)?.[1] || id);
      const text = toText(body.replace(/<summary[\s\S]*?<\/summary>/, ''));
      index.push({ page, title, url: `${url}#${id}`, text: text.slice(0, 2500) });
    }
  }
}
await write('lena/search-index.js', `// Tekstene i hjelpesenteret, delt opp i avsnitt. Laget av tools/export.mjs.\nwindow.LENA_SEARCH = ${JSON.stringify(index)};\n`);

console.log(`Sider: ${pages.size}, bilder: ${media.size}, filer i assets: ${assets.size}, avsnitt i søkeindeksen: ${index.length}`);
for (const p of pages.keys()) console.log(`  ${pageFile(p)}`);
