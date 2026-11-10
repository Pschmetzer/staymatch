// R5-137: Daten in web/data, Alias-Schlüssel, Manifest-Hosts, Sitemap gegen echte Seiten
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../web/core.js');

const web = path.join(__dirname, '..', 'web');
const dataDir = path.join(web, 'data');
const index = JSON.parse(fs.readFileSync(path.join(dataDir, 'index.json'), 'utf8'));
const files = [...new Set(Object.values(index))];

test('index.json: Schlüssel sind normCity-fest, jede Datei existiert', () => {
  for (const [key, file] of Object.entries(index)) {
    assert.equal(C.normCity(key), key, `Alias „${key}“ ist nicht in normCity-Form`);
    assert.ok(fs.existsSync(path.join(dataDir, file)), `${key} verweist auf fehlende Datei ${file}`);
  }
});

test('data/*.json: jede Datei ist im Index erreichbar (keine Waisen)', () => {
  const onDisk = fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'index.json');
  for (const f of onDisk) assert.ok(files.includes(f), `${f} steht nicht in index.json`);
});

for (const file of files.filter(f => fs.existsSync(path.join(dataDir, f)))) {
  test(`data/${file}: Felder, Zeilenlänge, Bounding-Box`, () => {
    const d = JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8'));
    assert.equal(typeof d.city, 'string');
    assert.ok(Number.isFinite(d.t) && d.t > 1.6e12, 't ist ein Millisekunden-Zeitstempel');
    assert.deepEqual(d.fields.slice(0, 2), ['lat', 'lon']);
    for (const f of C.FIELDS.filter(f => f !== 'shop')) assert.ok(d.fields.includes(f), `Feld ${f} fehlt`);
    const [s, w, n, e] = d.bbox;
    assert.ok(s < n && w < e, 'bbox [s,w,n,e] geordnet');
    assert.ok(n - s < 1 && e - w < 1, 'bbox kleiner als 1 Grad');
    assert.ok(d.rows.length > 100, 'genug Zeilen');
    let places = 0, outside = 0;
    for (const r of d.rows) {
      if (r.length !== d.fields.length) assert.fail(`Zeile mit ${r.length} statt ${d.fields.length} Spalten`);
      if (!(r[0] >= s - 0.01 && r[0] <= n + 0.01 && r[1] >= w - 0.01 && r[1] <= e + 0.01)) outside++; // Overpass-Mittelpunkte großer Flächen ragen vereinzelt über den Rand
      if (r[d.fields.indexOf('place')] && r[d.fields.indexOf('name')]) places++;
    }
    assert.ok(outside <= d.rows.length * 0.01, `${outside} Punkte außerhalb der bbox`);
    assert.ok(places >= 2, 'mindestens 2 benannte Viertel, sonst wirft app.js einen Fehler');
  });
}

// Echter Fehler: Die vorab geladenen Dateien haben keine Spalte „shop“ (core.js FIELDS hat sie), Einkaufen zählt dort immer 0.
test('data/*.json: Spalte „shop“ vorhanden', { todo: 'Fehler: data/*.json stammen aus einer Zeit vor der Spalte shop; scripts/prefetch-cities.mjs neu laufen lassen' }, () => {
  for (const f of files.filter(f => fs.existsSync(path.join(dataDir, f)))) {
    assert.ok(JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')).fields.includes('shop'), f);
  }
});

// Echter Fehler: app.js bietet „Rom“ als Stadt an, es gibt aber weder rom.json noch einen Index-Eintrag.
test('Städte-Liste in app.js hat vorab geladene Daten', { todo: 'Fehler: Rom steht in CITIES, aber es gibt kein data/rom.json und keinen Index-Eintrag' }, () => {
  const src = fs.readFileSync(path.join(web, 'app.js'), 'utf8');
  const cities = eval(/const CITIES = (\[.*?\]);/.exec(src)[1]);
  for (const c of cities) assert.ok(index[C.normCity(c)], `${c} fehlt im Index`);
});

test('Aliase zeigen auf dieselbe Datei wie der Stadtname', () => {
  const alias = { lisboa: 'lissabon', lisbon: 'lissabon', praha: 'prag', prague: 'prag', vienna: 'wien' };
  for (const [a, k] of Object.entries(alias)) assert.equal(index[a], index[k], a);
  assert.equal(index[C.normCity('Wien')], 'wien.json');
});

test('manifest.json: Airbnb-Hosts = core.js AIRBNB_DOMAINS, Hosts ohne Platzhalter, StayMatch-Brücke', () => {
  const m = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'manifest.json'), 'utf8'));
  const air = m.content_scripts.find(c => c.js.includes('content-search.js'));
  const hosts = air.matches.map(x => new URL(x.replace('/*', '/')).hostname);
  assert.ok(hosts.every(h => h.startsWith('www.airbnb.')), 'nur Airbnb-Hosts');
  const domains = C.AIRBNB_DOMAINS;
  if (Array.isArray(domains)) {
    const want = domains.map(d => d.startsWith('www.') ? d : 'www.' + d).sort();
    assert.deepEqual([...hosts].sort(), want);
  }
  const bridge = m.content_scripts.find(c => c.js.includes('bridge.js'));
  for (const o of C.STAYMATCH_ORIGINS) assert.ok(bridge.matches.some(x => x.startsWith(o)), `Brücke deckt ${o} nicht ab`);
  assert.ok(!(m.host_permissions || []).some(h => /<all_urls>|\*:\/\/\*\//.test(h)));
});

test('sitemap.xml: jede Adresse hat eine Seite, canonical stimmt', () => {
  const xml = fs.readFileSync(path.join(web, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1]));
  assert.ok(locs.length >= 2);
  for (const u of locs) {
    assert.equal(u.origin, 'https://staymatch.pro');
    const rel = u.pathname === '/' ? 'index' : u.pathname.slice(1);
    const f = path.join(web, rel + '.html');
    assert.ok(fs.existsSync(f), `${u.pathname}: ${rel}.html fehlt`);
    const html = fs.readFileSync(f, 'utf8');
    const m = /<link rel="canonical" href="([^"]+)"/.exec(html);
    if (m) assert.equal(m[1].replace(/\/$/, ''), u.href.replace(/\/$/, ''), `canonical von ${u.pathname}`);
  }
});

test('CSP in vercel.json erlaubt alle Overpass-Server aus core.js', () => {
  const v = JSON.parse(fs.readFileSync(path.join(web, 'vercel.json'), 'utf8'));
  const csp = v.headers.flatMap(h => h.headers).find(h => h.key === 'Content-Security-Policy').value;
  for (const s of C.OVERPASS_SERVERS) assert.ok(csp.includes(new URL(s).origin), `${s} fehlt in connect-src`);
  assert.ok(csp.includes('https://nominatim.openstreetmap.org'));
});
