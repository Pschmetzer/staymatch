// Städtedaten: Zeilen dekodieren, Viertel erkennen (nur PLACE_TYPES), Overpass-CSV zerlegen
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../shared/core.js');
require('../web/scoring.js');
const SM = globalThis.StayMatch;

const dataDir = path.join(__dirname, '..', 'web', 'data');

test('isArea: nur suburb/neighbourhood/quarter mit Namen sind Viertel', () => {
  for (const place of C.PLACE_TYPES) assert.equal(C.isArea({ place, name: 'X' }), true, place);
  for (const place of ['square', 'islet', 'island', 'farm', 'plot', 'locality', 'isolated_dwelling', 'city'])
    assert.equal(C.isArea({ place, name: 'X' }), false, place);
  assert.equal(C.isArea({ place: 'quarter' }), false, 'ohne Namen kein Viertel');
  assert.equal(C.isArea(null), false);
});

test('splitRows: Platz mit tourism=attraction ist Sehenswürdigkeit, kein Viertel', () => {
  const tags = C.rowsToTags(C.FIELDS, [
    ['52.37', '4.89', 'square', 'Dam', '', '', 'attraction', '', '', '', '', '', 'Q123'],
    ['52.36', '4.88', 'quarter', 'Jordaan', '', '', '', '', '', '', '', '', ''],
    ['52.36', '4.88', 'quarter', 'Jordaan', '', '', '', '', '', '', '', '', ''], // doppelt in 1500 m
    ['52.35', '4.90', 'islet', 'Inselchen', '', '', '', '', '', '', '', '', ''], // kein Tag → weder Viertel noch Ort
    ['52.36', '4.89', '', 'Café X', 'cafe', '', '', '', '', '', '', '', ''],
  ]);
  const { areas, raw } = C.splitRows(tags, SM.categoriesOf);
  assert.deepEqual(areas.map(a => a.name), ['Jordaan']);
  assert.deepEqual(raw.map(p => [p.name, p.cat]), [['Dam', 'sights'], ['Café X', 'chill']]);
});

test('rowsToTags: leere Zellen und null fallen weg, Zahlen bleiben', () => {
  assert.deepEqual(C.rowsToTags(['lat', 'lon', 'name', 'wikidata'], [[1.5, 2, '', 1], [3, 4, null, '']]), [{ lat: 1.5, lon: 2, wikidata: 1 }, { lat: 3, lon: 4 }]);
});

test('parseOverpassCsv: Kopfzeile weg, „|“ im Namen verwirft die Zeile und wird gezählt', () => {
  const head = '@lat|@lon|' + C.FIELDS.slice(2).join('|');
  const ok = ['41.9', '12.5', '', 'Bar A', 'bar', '', '', '', '', '', '', '', ''].join('|');
  const bad = ['41.9', '12.5', '', 'Bar | B', 'bar', '', '', '', '', '', '', '', ''].join('|');
  const r = C.parseOverpassCsv([head, ok, bad, ''].join('\n'));
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0][3], 'Bar A');
  assert.equal(r.dropped, 1);
});

test('autoRadius: ab 60 ÖPNV-Orten 1200 m, sonst RADIUS.area', () => {
  const t = n => Array.from({ length: n }, () => ({ cat: 'transit' }));
  assert.equal(C.autoRadius(t(59)), C.RADIUS.area);
  assert.equal(C.autoRadius(t(60)), 1200);
});

test('nominatimUrl: limit einstellbar, Standard 1', () => {
  assert.match(C.nominatimUrl('Rom'), /limit=1&/);
  assert.match(C.nominatimUrl('Rom', 'de', 5), /limit=5&accept-language=de&/);
});

test('parseOverpassCsv: CSV-Anführungszeichen von Overpass werden entfernt', () => {
  const head = '@lat|@lon|' + C.FIELDS.slice(2).join('|');
  const q = ['41.9', '12.5', '', '"Café ""De Amstel"""', 'cafe', '', '', '', '', '', '', '', ''].join('|');
  assert.equal(C.parseOverpassCsv(head + '\n' + q).rows[0][3], 'Café "De Amstel"');
  assert.equal(C.unquoteCsv('"Amstelveen, Busstation"'), 'Amstelveen, Busstation');
  assert.equal(C.unquoteCsv('Bar'), 'Bar');
});

test('normalizeRows: place nur für Viertel, Namen sauber, Rundung, bbox, wikidata-Merker, leere Zeilen weg', async () => {
  const D = await import('../scripts/city-data.mjs');
  const F = C.FIELDS, row = (o) => F.map(f => (f in o ? o[f] : ''));
  const bbox = [41.8, 12.4, 42.0, 12.6];
  const { rows, stats } = D.normalizeRows(F, [
    row({ lat: 41.900001, lon: 12.500004, place: 'square', name: 'Piazza Navona', tourism: 'attraction', wikidata: 'Q1' }),
    row({ lat: 41.9, lon: 12.5, place: 'quarter', name: '  Parione   Rione ' }),
    row({ lat: 41.9, lon: 12.5, place: 'islet', name: 'Isola' }), // ohne Kategorie → weg
    row({ lat: 43.0, lon: 12.5, amenity: 'bar', name: 'Weit weg' }), // außerhalb → weg
    row({ lat: 41.95, lon: 12.45, amenity: 'parking', name: 'Parkhaus' }), // keine Kategorie → weg
    row({ lat: 41.8, lon: 12.39, amenity: 'bar', name: 'Am Rand' }), // innerhalb der Toleranz
  ], bbox);
  const iP = F.indexOf('place'), iN = F.indexOf('name'), iW = F.indexOf('wikidata');
  assert.equal(rows.length, 3);
  const navona = rows.find(r => r[iN] === 'Piazza Navona');
  assert.equal(navona[iP], '', 'Platz verliert place, bleibt als Sehenswürdigkeit');
  assert.equal(navona[iW], 1);
  assert.deepEqual(navona.slice(0, 2), [41.9, 12.5]);
  assert.ok(rows.some(r => r[iN] === 'Parione Rione' && r[iP] === 'quarter'));
  assert.equal(stats.outside, 1);
  assert.equal(stats.placeCleared, 2);
});

test('buildCity + serialize: Pflichtfelder, eine Zeile pro Datensatz, wiederholbar', async () => {
  const D = await import('../scripts/city-data.mjs');
  const F = C.FIELDS, row = (o) => F.map(f => (f in o ? o[f] : ''));
  const rows = [row({ lat: 41.9, lon: 12.5, amenity: 'bar', name: 'B' }), row({ lat: 41.91, lon: 12.51, place: 'quarter', name: 'Q' })];
  const meta = { t: 1.8e12, city: 'Rom', center: [41.89331, 12.48293], bbox: [41.818320299999996, 12.38, 41.97, 12.58], queryHash: D.queryHash() };
  const { data } = D.buildCity(meta, F, rows);
  assert.equal(data.v, D.VERSION);
  assert.equal(data.license, 'ODbL-1.0');
  assert.deepEqual(data.bbox, [41.81832, 12.38, 41.97, 12.58]);
  assert.deepEqual(data.center, [41.89331, 12.48293]);
  const text = D.serialize(data);
  assert.deepEqual(JSON.parse(text), data);
  assert.equal(text.split('\n').length, data.rows.length + 3, 'Kopf, je Zeile eine Textzeile, Ende');
  assert.equal(D.serialize(D.buildCity(data, data.fields, data.rows).data), text, 'zweimal aufbereiten ändert nichts');
});

test('centreFor: beidseitig beschnittene Achse → Mitte der bbox, sonst Nominatim', async () => {
  const D = await import('../scripts/city-data.mjs');
  const h = C.BBOX_HALF, lat = 47.5, hl = h / Math.cos(lat * Math.PI / 180);
  assert.deepEqual(D.centreFor([lat - h, 19 - hl, lat + h, 19 + hl], [47.48, 19.14]).map(x => +x.toFixed(4)), [47.5, 19]);
  assert.deepEqual(D.centreFor([38.69, -9.23, 38.78, -9.09], [38.7077, -9.1366]), [38.7077, -9.1366]);
});

test('Stadtseiten: kein Platz/keine Insel in den Top-5-Listen', async () => {
  const { rankCity } = await import('../scripts/build-city-pages.mjs');
  for (const f of fs.readdirSync(dataDir).filter(f => f.endsWith('.json') && f !== 'index.json')) {
    const d = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
    const iP = d.fields.indexOf('place'), iN = d.fields.indexOf('name');
    const areaNames = new Set(d.rows.filter(r => C.PLACE_TYPES.includes(r[iP])).map(r => r[iN]));
    for (const list of Object.values(rankCity(d).top)) for (const { a } of list)
      assert.ok(areaNames.has(a.name), `${f}: „${a.name}“ ist kein Viertel laut PLACE_TYPES`);
  }
});
