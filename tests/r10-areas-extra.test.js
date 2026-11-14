// areas-extra.json: Ergänzungen, Filter (drop, maxKm) und Datenreduktion im Datenskript (nicht in core.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../shared/core.js');

const F = C.FIELDS, row = o => F.map(f => (f in o ? o[f] : ''));
const area = (name, lat, lon) => row({ lat, lon, place: 'neighbourhood', name });
const meta = extras => ({ t: 1.8e12, city: 'X', center: [41.9, 12.5], bbox: [41.8, 12.4, 42.0, 12.6], queryHash: 'x', extras });
const names = d => d.rows.filter(r => r[2] && r[3]).map(r => r[3]);

test('add: fehlendes Viertel kommt dazu, echter Eintrag in der Nähe gewinnt, zweiter Lauf ändert nichts', async () => {
  const D = await import('../scripts/city-data.mjs');
  const rows = [area('Trastevere', 41.889, 12.47), row({ lat: 41.9, lon: 12.5, amenity: 'bar', name: 'B' })];
  const ex = { add: [{ name: 'Monti', lat: 41.895, lon: 12.49 }, { name: 'Trastévere', lat: 41.8892, lon: 12.4701 }] };
  const { data } = D.buildCity(meta(ex), F, rows);
  assert.deepEqual(names(data).sort(), ['Monti', 'Trastevere']);
  const again = D.buildCity(meta(ex), data.fields, data.rows).data;
  assert.equal(D.serialize(again), D.serialize(data), 'idempotent');
});

test('drop und maxKm: Name (mit Koordinate nur der eine Eintrag) und Vororte fallen heraus, Orte bleiben', async () => {
  const D = await import('../scripts/city-data.mjs');
  const rows = [
    area('Centre', 41.9, 12.5), area('Centre', 41.95, 12.58), area('Nah', 41.91, 12.51), area('Vorort', 41.99, 12.59),
    row({ lat: 41.99, lon: 12.59, place: 'suburb', name: 'Bar im Vorort', amenity: 'bar' }),
  ];
  const ex = { maxKm: 6, drop: [{ name: 'Centre', lat: 41.95, lon: 12.58 }] };
  const { data, stats } = D.buildCity(meta(ex), F, rows);
  assert.deepEqual(names(data).sort(), ['Centre', 'Nah']);
  assert.equal(stats.extra.dropped, 1);
  assert.ok(data.rows.some(r => r[3] === 'Bar im Vorort' && !r[2]), 'Ort bleibt, nur das Viertel entfällt');
});

test('reduced: unbenannte Gärten fallen weg, benannte und das Feld bleiben, wiederholbar', async () => {
  const D = await import('../scripts/city-data.mjs');
  const rows = [row({ lat: 41.9, lon: 12.5, leisure: 'garden' }), row({ lat: 41.91, lon: 12.5, leisure: 'garden', name: 'Giardino' }), area('Q', 41.92, 12.5)];
  const { data } = D.buildCity({ ...meta(null), reduced: ['unnamedGarden'] }, F, rows);
  assert.equal(data.rows.length, 2);
  assert.deepEqual(data.reduced, ['unnamedGarden']);
  assert.equal(D.serialize(D.buildCity(data, data.fields, data.rows).data), D.serialize(data));
});

test('areas-extra.json: gültig, Ergänzungen liegen in den Daten innerhalb der bbox', async () => {
  const D = await import('../scripts/city-data.mjs');
  const x = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'scripts', 'areas-extra.json'), 'utf8'));
  for (const [key, e] of Object.entries(x)) {
    if (key.startsWith('_')) continue;
    const f = path.join(__dirname, '..', 'web', 'data', `${key}.json`);
    if (!fs.existsSync(f)) continue;
    const d = JSON.parse(fs.readFileSync(f, 'utf8')), [s, w, n, ea] = d.bbox;
    for (const a of e.add || []) assert.ok(a.lat > s && a.lat < n && a.lon > w && a.lon < ea, `${key}: ${a.name} außerhalb der bbox`);
    // Datei ist mit den Ergänzungen aufbereitet: Neuaufbereitung ändert nichts
    assert.equal(D.serialize(D.buildCity({ ...d, key, extras: e }, d.fields, d.rows).data), D.serialize(d), `${key}: --reprocess ändert die Datei`);
    const have = new Set(d.rows.filter(r => r[2] && r[3]).map(r => C.norm(r[3])));
    for (const a of e.add || []) assert.ok(have.has(C.norm(a.name)), `${key}: ${a.name} fehlt in der Datei (node scripts/prefetch-cities.mjs --reprocess ${key})`);
  }
});
