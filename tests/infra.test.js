// Infrastruktur: vercel.json (Weiterleitungen, Cache, CSP je Route), 404-Alias-Tabelle, dev-server-Header, Altadresse staymatch-tau
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
const vercel = JSON.parse(fs.readFileSync(path.join(web, 'vercel.json'), 'utf8'));
const exists = (p) => [p, p + '.html', path.join(p, 'index.html')].some((f) => fs.existsSync(f) && fs.statSync(f).isFile());

test('Weiterleitungen: Quellen sind eindeutig, Ziele existieren (Seite oder Stadtseite), keine Ketten', () => {
  const sources = vercel.redirects.map((r) => r.source);
  assert.equal(new Set(sources).size, sources.length, 'doppelte Quelle');
  for (const r of vercel.redirects) {
    const dest = r.destination.split('#')[0].replace(/^\//, '');
    assert.ok(dest === '' || exists(path.join(web, dest)), `${r.source} → ${r.destination}: Ziel fehlt`);
    assert.ok(!sources.includes('/' + dest) || dest === '', `${r.source} → ${r.destination} ist eine Kette`);
    assert.ok(!exists(path.join(web, r.source.replace(/^\//, ''))) || r.source === '/favicon.ico', `${r.source} existiert als Datei und wird überdeckt`);
  }
});

test('404-Alias-Tabelle und Städteliste passen zu scripts/cities.json', () => {
  const html = fs.readFileSync(path.join(web, '404.html'), 'utf8');
  const cities = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'cities.json'), 'utf8'));
  const cityObj = /const cities = (\{[^}]+\})/.exec(html)[1];
  const slugs = [...cityObj.matchAll(/(\w+): '/g)].map((m) => m[1]).sort();
  assert.deepEqual(slugs, Object.keys(cities).sort(), 'Städte in 404.html ≠ cities.json');
  const alias = Object.fromEntries([...(/const alias = \{([^}]+)\}/.exec(html)[1]).matchAll(/(\w+): '(\w+)'/g)].map((m) => [m[1], m[2]]));
  for (const [a, slug] of Object.entries(alias)) assert.ok((cities[slug] || []).includes(a), `Alias ${a} → ${slug} fehlt in cities.json`);
  for (const r of vercel.redirects.filter((x) => x.source.startsWith('/staedte/'))) {
    assert.ok(alias[r.source.split('/').pop()], `Weiterleitung ${r.source} fehlt in der 404-Alias-Tabelle`);
  }
});

test('Cache-Control: nirgends immutable ohne Hash im Namen (außer legal.css mit ?v=), Daten und Medien gecacht', () => {
  const cache = vercel.headers.filter((r) => r.headers.some((h) => h.key === 'Cache-Control'));
  const val = (src) => cache.find((r) => r.source.includes(src)).headers.find((h) => h.key === 'Cache-Control').value;
  for (const r of cache) {
    const v = r.headers.find((h) => h.key === 'Cache-Control').value;
    if (/immutable/.test(v)) assert.equal(r.source, '/legal.css');
  }
  for (const s of ['/(fonts|vendor)', '/media/', '/data/', 'og\\.png']) assert.match(val(s), /max-age=\d{5,}/, s);
  assert.match(val('(app|app-extra'), /max-age=0, must-revalidate/);
});

test('Alle Pfade außer /app: CSP ohne Fremddienste; Regeln überschneiden sich nicht', () => {
  const rules = vercel.headers.filter((r) => r.headers.some((h) => h.key === 'Content-Security-Policy'));
  const hit = (p) => rules.filter((r) => new RegExp(`^${r.source}$`).test(p));
  for (const p of ['/app', '/', '/en', '/staedte/rom', '/404', '/datenschutz', '/data/rom.json']) assert.equal(hit(p).length, 1, p);
  for (const p of ['/', '/en', '/staedte/rom', '/datenschutz']) {
    const csp = hit(p)[0].headers.find((h) => h.key === 'Content-Security-Policy').value;
    assert.match(csp, /connect-src 'self';/);
  }
});

test('dev-server liefert die CSP je Route wie vercel.json', async (t) => {
  const port = 20000 + Math.floor(Math.random() * 20000);
  const env = { ...process.env, PORT: String(port) };
  delete env.HOST;
  const srv = spawn(process.execPath, [path.join(root, 'scripts', 'dev-server.mjs')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => srv.kill());
  await new Promise((res, rej) => { srv.stdout.once('data', res); srv.once('exit', rej); });
  const csp = (p) => new Promise((res, rej) => http.get({ host: '127.0.0.1', port, path: p }, (r) => { r.resume(); res(r.headers['content-security-policy']); }).on('error', rej));
  assert.match(await csp('/app'), /nominatim/);
  assert.doesNotMatch(await csp('/'), /nominatim|overpass/);
  assert.doesNotMatch(await csp('/staedte/rom'), /nominatim|overpass/);
});

test('Altadresse staymatch-tau.vercel.app: Anzahl in web/ und Skripten (Warnung, bis der Kern umgestellt ist)', (t) => {
  const hits = [];
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => {
    const p = path.join(d, e.name);
    if (e.isDirectory()) return ['vendor', 'data', 'media', 'node_modules'].includes(e.name) ? null : walk(p);
    if (/\.(html|js|mjs|json|sh|xml|txt)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('staymatch-tau')) hits.push(path.relative(root, p));
  });
  walk(web); walk(path.join(root, 'scripts'));
  const wl = hits.filter((f) => !/core\.js$/.test(f)); // core.js (Kern/manifest) wird von einer anderen Session umgestellt
  if (hits.length) t.diagnostic(`Warnung: staymatch-tau noch in ${hits.join(', ')}`);
  if (process.env.STRICT_OLD_HOST) assert.deepEqual(hits, []);
  assert.deepEqual(wl, [], 'staymatch-tau nur noch im Kern (core.js) erlaubt, bis dort umgestellt ist');
});
