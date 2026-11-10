// Läuft mit: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../shared/core.js');
require('../web/scoring.js');
const SM = globalThis.StayMatch;

test('Ort zählt in mehreren Kategorien (Park mit Sehenswürdigkeit)', () => {
  assert.deepEqual(SM.categoriesOf({ leisure: 'park', tourism: 'attraction' }).sort(), ['chill', 'sights']);
  assert.deepEqual(SM.categoriesOf({ amenity: 'bar' }), ['party']);
  assert.deepEqual(SM.categoriesOf({ shop: 'bakery' }), []);
});

test('Gruppenwertung: schwächste Person zählt mit', () => {
  const norm = { party: 1, chill: 0, sights: 0, food: 0, transit: 0 };
  const party = { w: SM.PRESETS.party.w }, chill = { w: SM.PRESETS.chill.w };
  const solo = SM.groupScore(norm, [party, party]).total;
  const mixed = SM.groupScore(norm, [party, chill]).total;
  assert.ok(mixed < solo, 'Chill-Person drückt die Wertung in der Partymeile');
  assert.equal(SM.personScore(norm, chill.w), 0, 'nie unter 0');
});

test('pickDiverse: keine Nachbarn', () => {
  const a = { lat: 41.40, lon: 2.16 }, b = { lat: 41.4005, lon: 2.1605 }, c = { lat: 41.45, lon: 2.20 };
  assert.equal(SM.pickDiverse([a, b, c], 8, 1200).length, 2);
});

test('Airbnb-Link enthält Datum, Gäste und Kartenausschnitt', () => {
  const u = new URL(SM.airbnbUrl({ lat: 41.4, lon: 2.16, name: 'Gràcia', city: 'Barcelona', checkin: '2026-12-07', checkout: '2026-12-11', adults: 5, priceMaxNight: 500 }));
  for (const k of ['checkin', 'checkout', 'adults', 'price_max', 'ne_lat', 'sw_lng']) assert.ok(u.searchParams.has(k), k);
});

test('Entfernungsabfall: nahe Orte zählen mehr als ferne', () => {
  const near = { name: 'A', lat: 41.40, lon: 2.16 }, far = { name: 'B', lat: 41.40, lon: 2.16 };
  const pois = [{ lat: 41.40, lon: 2.16, cat: 'party' }];
  const areas = SM.scoreAreas([near, far], [{ lat: 41.4003, lon: 2.16, cat: 'party' }, { lat: 41.4, lon: 2.1695, cat: 'party' }], 800);
  // beide Gebiete identisch → gleiche Werte; ein weiter entfernter Ort zählt weniger als ein naher
  const a = SM.scoreAreas([{ lat: 41.40, lon: 2.16 }], [{ lat: 41.4003, lon: 2.16, cat: 'party' }], 800)[0];
  const b = SM.scoreAreas([{ lat: 41.40, lon: 2.16 }], [{ lat: 41.4065, lon: 2.16, cat: 'party' }], 800)[0];
  assert.ok(a.sums.party > b.sums.party);
  assert.equal(a.counts.party, 1);
  assert.equal(b.counts.party, 1, 'rohe Anzahl bleibt gleich');
  assert.equal(areas.length, 2); assert.ok(pois.length);
});

test('Erklärung: was fehlt oder stört', () => {
  const norm = { party: 0.9, chill: 0.1, sights: 0.5, food: 0.5, transit: 0.5 };
  const counts = { party: 90, chill: 2, sights: 10, food: 20, transit: 5 };
  const missing = SM.weakness(norm, counts, SM.PRESETS.nature.w);
  assert.equal(missing.kind, 'missing'); assert.match(missing.label, /Chillen/);
  const toomuch = SM.weakness({ ...norm, chill: 1 }, counts, { party: -1, chill: 0.2 });
  assert.equal(toomuch.kind, 'toomuch'); assert.match(toomuch.label, /Party/);
});

test('Neue Typen existieren und haben alle Kategorien', () => {
  for (const k of ['party', 'chill', 'sights', 'foodie', 'family', 'nature']) {
    assert.ok(SM.PRESETS[k], k);
    for (const c of Object.keys(SM.CATEGORIES)) assert.equal(typeof SM.PRESETS[k].w[c], 'number', `${k}.${c}`);
  }
});

// Eingefroren: so sieht die Abfrage aus (bei neuen Kategorien bewusst anpassen, dann Städte neu vorladen)
test('Overpass-Abfrage aus CATEGORIES ist gleich der eingefrorenen Abfrage', () => {
  const b = '41.3170,2.0770,41.4580,2.2280';
  const old = `[out:csv(::lat,::lon,place,name,amenity,leisure,tourism,historic,natural,railway,public_transport,shop,wikidata;true;"|")][timeout:90];(
    nwr["place"~"^(suburb|neighbourhood|quarter)$"](${b});
    nwr["amenity"~"^(bar|pub|nightclub|biergarten|cafe|restaurant|fast_food|marketplace)$"](${b});
    nwr["leisure"~"^(park|garden|spa|fitness_centre|sports_centre|playground)$"](${b});
    nwr["tourism"~"^(attraction|museum|viewpoint|gallery|zoo|theme_park)$"](${b});
    node["historic"="monument"](${b});
    nwr["natural"="beach"](${b});
    node["railway"~"^(station|subway_entrance|tram_stop)$"](${b});
    node["public_transport"="station"](${b});
    nwr["shop"~"^(mall|department_store)$"](${b});
  );out center;`;
  assert.equal(C.overpassQuery([41.317, 2.077, 41.458, 2.228]), old);
  assert.deepEqual(C.FIELDS, ['lat', 'lon', 'place', 'name', 'amenity', 'leisure', 'tourism', 'historic', 'natural', 'railway', 'public_transport', 'shop', 'wikidata']);
});

test('Nominatim-URL wie vorher (Web-App ohne, Prefetch mit accept-language)', () => {
  assert.equal(C.nominatimUrl('Lissabon Zentrum'), 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=Lissabon%20Zentrum');
  assert.equal(C.nominatimUrl('Lissabon Zentrum', 'de'), 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=Lissabon%20Zentrum');
});

test('Bbox wird um das Zentrum begrenzt', () => {
  const g = C.geoFromNominatim({ lat: '41.38', lon: '2.17', boundingbox: ['41.0', '41.9', '1.8', '2.6'], display_name: 'Barcelona, Katalonien, Spanien' });
  assert.equal(g.name, 'Barcelona');
  assert.ok(Math.abs(g.bbox[0] - (41.38 - C.BBOX_HALF)) < 1e-9 && Math.abs(g.bbox[2] - (41.38 + C.BBOX_HALF)) < 1e-9);
  assert.ok(g.bbox[1] > 1.8 && g.bbox[3] < 2.6);
});

test('Zwei Normalisierungen: norm entfernt Satzzeichen, normCity nicht', () => {
  assert.equal(C.norm('Gràcia-Nord'), 'gracia nord');
  assert.equal(C.normCity(' Saint-Denis '), 'saint-denis');
  assert.equal(C.normCity('Kraków'), 'krakow');
});

test('Domainlisten passen zu manifest.json', () => {
  const m = require('../extension/manifest.json');
  assert.deepEqual(m.content_scripts[0].matches, C.AIRBNB_DOMAINS.map(d => `https://www.${d}/*`));
  assert.deepEqual(m.content_scripts[1].matches, C.STAYMATCH_ORIGINS.map(o => `${o}/*`));
  assert.ok(C.APP_URL.startsWith(C.STAYMATCH_ORIGINS[0] + '/'));
  assert.equal(m.content_scripts[0].js[0], 'core.js');
});

test('Kopien in web/ und extension/ sind aktuell', () => {
  const { execFileSync } = require('node:child_process');
  execFileSync(process.execPath, [require('node:path').join(__dirname, '../scripts/sync-core.mjs'), '--check'], { stdio: 'pipe' });
});

test('i18n: t() ersetzt Platzhalter, unbekannter Schlüssel bleibt', () => {
  const I = require('../shared/i18n.js');
  assert.equal(I.t('gibt.es.nicht'), 'gibt.es.nicht');
  I.DICT.de['x.test'] = '{n} Viertel';
  assert.equal(I.t('x.test', { n: 3 }), '3 Viertel');
  delete I.DICT.de['x.test'];
});
