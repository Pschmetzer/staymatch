// Live-Städte (Nominatim + Overpass) laufen durch dieselben Kern-Helfer (shared/core.js) wie die vorab geladenen Städte.
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../web/core.js');
const { bootApp: boot, search, hasDom } = require('./helpers/app-dom.js');

// Fenster am Ende schließen: offene Staffel-Timer der Overpass-Abfrage (20/40 s) halten den Testlauf sonst auf
const wins = [];
const bootApp = o => { const w = boot(o); wins.push(w); return w; };
test.after(() => wins.forEach(w => w.close()));

const dom = { skip: !hasDom && 'jsdom fehlt (npm install in tests/)' };
const CITY = 'Testhausen';
const HIT = [{ lat: '50', lon: '10', boundingbox: ['49.95', '50.05', '9.95', '10.05'], display_name: 'Testhausen, Land', importance: 0.6 }];

// Zeile in FIELDS-Reihenfolge; Werte werden wie bei Overpass bei Komma/Anführungszeichen in "…" gesetzt
const q = v => /[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
function row(lat, lon, tags) { return C.FIELDS.map(f => f === 'lat' ? lat : f === 'lon' ? lon : q(tags[f] || '')).join('|'); }
function cityRows({ transit = 0 } = {}) {
  const r = [];
  const areas = [['Nordviertel', 50.01, 10], ['Südviertel', 49.99, 10], ['Ostviertel', 50, 10.015]];
  for (const [name, lat, lon] of areas) {
    r.push(row(lat, lon, { place: 'suburb', name }));
    for (let i = 0; i < 6; i++) {
      const d = i * 0.0003;
      r.push(row(lat + d, lon, { amenity: 'restaurant', name: `${name} Essen ${i}` }));
      r.push(row(lat, lon + d, { amenity: 'bar', name: `${name} Bar ${i}` }));
      r.push(row(lat - d, lon, { leisure: 'park', name: `${name} Park ${i}` }));
      r.push(row(lat, lon - d, { tourism: 'museum', name: `${name} Museum ${i}` }));
    }
  }
  r.push(row(50.0005, 10.0005, { place: 'square', name: 'Dam', tourism: 'attraction' })); // Platz: Ort, kein Viertel
  r.push(row(50.0101, 10.0001, { amenity: 'restaurant', name: '"O Canela" Churrasqueira' }));
  r.push(row(50.0102, 10.0001, { amenity: 'bar', name: 'Bar, Café' }));
  r.push(row(50.0103, 10.0001, { place: 'locality', name: 'Flur' })); // Flur ohne Kategorie: weder Viertel noch Ort
  for (let i = 0; i < transit; i++) r.push(row(49.96 + i * 0.0012, 9.96 + i * 0.0012, { railway: 'tram_stop', name: `Halt ${i}` }));
  return '@lat|@lon|' + C.FIELDS.slice(2).join('|') + '\n' + r.join('\n') + '\n';
}
// Netz: Nominatim liefert einen Treffer, Overpass die CSV oben
const live = (csv, extra) => async (u, opt, local) => {
  if (extra) { const r = await extra(u, opt, local); if (r !== undefined) return r; }
  if (u.startsWith('https://nominatim.openstreetmap.org/')) return { ok: true, status: 200, json: async () => HIT };
  if (C.OVERPASS_SERVERS.includes(u)) return { ok: true, status: 200, text: async () => csv };
};
const isOverpass = u => C.OVERPASS_SERVERS.includes(u);

test('Nominatim: App fragt über C.nominatimUrl mit 5 Treffern (für die Auswahl bei Mehrdeutigkeit)', dom, async () => {
  const w = bootApp({ fetch: live(cityRows()) });
  await search(w, CITY);
  assert.ok(w.requests.includes(C.nominatimUrl(CITY, null, 5)), w.requests.join('\n'));
  assert.ok(w.SMApp.data(), 'Ergebnis geladen');
});

test('Viertel live wie vorab: nur PLACE_TYPES mit Namen (C.isArea), Platz „Dam“ zählt als Sehenswürdigkeit', dom, async () => {
  const w = bootApp({ fetch: live(cityRows()) });
  await search(w, CITY);
  const { areas, pois } = w.SMApp.data();
  assert.deepEqual(Array.from(areas, a => a.name).sort(), ['Nordviertel', 'Ostviertel', 'Südviertel']);
  assert.ok(pois.some(p => p.name === 'Dam' && p.cat === 'sights'), 'Dam als Sehenswürdigkeit');
  assert.ok(!pois.some(p => p.name === 'Flur') && !areas.some(a => a.name === 'Flur'), 'Flur ohne Kategorie fällt weg');
  assert.ok(!w.document.getElementById('results').textContent.includes('Dam ·'), 'kein Viertel „Dam“');
});

test('Overpass live: C.parseOverpassCsv entfernt CSV-Anführungszeichen, auch im Tageszwischenspeicher', dom, async () => {
  const w = bootApp({ fetch: live(cityRows()) });
  await search(w, CITY);
  const names = w.SMApp.data().pois.map(p => p.name);
  assert.ok(names.includes('"O Canela" Churrasqueira'), 'innere Anführungszeichen bleiben einfach');
  assert.ok(names.includes('Bar, Café'), 'Komma-Name ohne äußere Anführungszeichen');
  assert.ok(!names.some(n => /^"[^"]*"$|""/.test(n || '')), names.filter(n => /"/.test(n || '')).join());
  const key = Object.keys(w.localStorage).find(k => k.startsWith('sm_osm4_'));
  const cached = JSON.parse(w.localStorage.getItem(key));
  assert.deepEqual(cached.fields, C.FIELDS);
  assert.ok(cached.rows.some(r => r[C.FIELDS.indexOf('name')] === 'Bar, Café'));
});

test('Tageszwischenspeicher: Zeilen über C.rowsToTags, keine neue Overpass-Abfrage', dom, async () => {
  const w1 = bootApp({ fetch: live(cityRows()) });
  await search(w1, CITY);
  const key = Object.keys(w1.localStorage).find(k => k.startsWith('sm_osm4_'));
  const w = bootApp({ storage: { [key]: w1.localStorage.getItem(key) }, fetch: live('kaputt') });
  await search(w, CITY);
  assert.ok(!w.requests.some(isOverpass), 'kein Overpass-Aufruf');
  const { areas, pois } = w.SMApp.data();
  assert.equal(areas.length, 3);
  assert.ok(pois.some(p => p.name === 'Bar, Café'));
  assert.ok(pois.every(p => Object.values(p.tags).every(v => v !== '')), 'leere Zellen fallen weg');
});

// Vorab-Datei mit eigenem Zentrum (Feld center) bzw. ohne → Mitte der Box
function prefetchHandler(center) {
  const csv = cityRows().trim().split('\n').slice(1).map(l => l.split('|').map(x => x.replace(/^"(.*)"$/, '$1').replace(/""/g, '"')));
  const file = { v: 1, t: Date.now(), city: 'Zentrumstadt', center, bbox: [49.95, 9.95, 50.05, 10.05], fields: C.FIELDS, rows: csv };
  return async u => {
    if (u === 'data/index.json') return { ok: true, status: 200, json: async () => ({ zentrumstadt: 'zentrumstadt.json' }) };
    if (u === 'data/zentrumstadt.json') return { ok: true, status: 200, json: async () => file };
  };
}
test('Stadtdatei: Feld center wird gelesen, ohne center Mitte der Box', dom, async () => {
  const w = bootApp({ fetch: prefetchHandler([50.01, 10.002]) });
  await search(w, 'Zentrumstadt');
  const g = w.SMApp.data().geo;
  assert.ok(g.lat === 50.01 && g.lon === 10.002, `${g.lat},${g.lon}`);
  assert.ok(!w.requests.some(u => u.includes('nominatim') || isOverpass(u)), 'ohne Netz');
  const nord = w.SMApp.data().areas.find(a => a.name === 'Nordviertel');
  assert.equal(nord.centerDist, Math.round(C.distM(nord, { lat: 50.01, lon: 10.002 })), 'Zentrumsabstand vom center der Datei');

  const w2 = bootApp({ fetch: prefetchHandler(null) });
  await search(w2, 'Zentrumstadt');
  const g2 = w2.SMApp.data().geo;
  assert.ok(Math.abs(g2.lat - 50) < 1e-9 && Math.abs(g2.lon - 10) < 1e-9, `${g2.lat},${g2.lon}`);
});

test('Umkreis: Auswahl der Person gilt, C.autoRadius (Stadtseiten) überstimmt sie nicht', dom, async () => {
  const w = bootApp({ fetch: live(cityRows({ transit: 70 })) });
  w.document.getElementById('radius').value = '500';
  await search(w, CITY);
  const { pois } = w.SMApp.data();
  assert.equal(C.autoRadius(pois), 800, 'autoRadius der Stadtseiten = App-Standard, nicht die Auswahl der Person');
  assert.equal(w.SMApp.view().r, 500);
});
