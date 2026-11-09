// Viertel-Finder: Doppelzählung, Raster, Erklärungen, Sortierung, Gruppen-Text, Mischtyp
const test = require('node:test');
const assert = require('node:assert/strict');
require('../web/scoring.js');
const SM = globalThis.StayMatch, C = require('../web/core.js');

const poi = (lat, lon, cat, name) => ({ lat, lon, cat, name });

test('dedupePois: Bahnhofseingänge zählen einmal, gleicher Ort als Punkt und Gebäude einmal', () => {
  const ps = [poi(41.4, 2.17, 'transit', 'Metro A'), poi(41.40003, 2.17003, 'transit'), poi(41.40005, 2.1701, 'transit', 'Eingang B'),
    poi(41.41, 2.18, 'party', 'Bar Luna'), poi(41.41001, 2.18001, 'party', 'Bar Luna'), poi(41.41001, 2.18001, 'party', 'Bar Sol')];
  const out = SM.dedupePois(ps);
  assert.equal(out.filter(p => p.cat === 'transit').length, 1);
  assert.equal(out.filter(p => p.cat === 'party').length, 2, 'Luna doppelt, Sol anderer Name');
});

test('scoreAreas mit Raster = Ergebnis der einfachen Doppelschleife, dazu nächste Entfernung', () => {
  const areas = [{ name: 'A', lat: 41.39, lon: 2.17 }, { name: 'B', lat: 41.42, lon: 2.2 }];
  const pois = [];
  for (let i = 0; i < 300; i++) pois.push(poi(41.37 + (i % 30) * 0.002, 2.15 + Math.floor(i / 30) * 0.007, ['party', 'chill', 'transit'][i % 3], 'x' + i));
  SM.scoreAreas(areas, pois, 800);
  for (const a of areas) {
    const want = { party: 0, chill: 0, transit: 0 }; let near = Infinity;
    for (const p of pois) { const d = SM.distM(a, p); if (d <= 800) { want[p.cat]++; if (p.cat === 'transit') near = Math.min(near, d); } }
    for (const k of Object.keys(want)) assert.equal(a.counts[k], want[k], `${a.name}.${k}`);
    assert.equal(a.nearest.transit, near === Infinity ? null : Math.round(near));
  }
});

test('Mischtyp ist der Mittelwert, eigene Werte gehen vor', () => {
  const w = SM.weightsOf({ type: 'party', type2: 'chill' });
  assert.equal(w.party, 0.3); assert.equal(w.chill, 0.6);
  assert.deepEqual(SM.weightsOf({ type: 'party', type2: 'party' }), SM.PRESETS.party.w);
  assert.equal(SM.cleanPerson({ name: 'x', type: 'party', type2: 'gibts-nicht' }).type2, undefined);
  assert.equal(SM.cleanPerson({ name: 'x', type: 'party', type2: 'sport' }).type2, 'sport');
});

test('parseGroup: Text aus dem Chat', () => {
  const g = SM.parseGroup('Lena Party, Mia: Chill\nTom (Sightseeing) und Ana Familie; Bo');
  assert.deepEqual(g.map(x => [x.name, x.type]), [['Lena', 'party'], ['Mia', 'chill'], ['Tom', 'sights'], ['Ana', 'family'], ['Bo', 'chill']]);
  assert.deepEqual(SM.parseGroup(''), []);
  assert.equal(SM.parseGroup('x,'.repeat(100)).length, 30);
});

test('verdict, summary, breakdown', () => {
  assert.equal(SM.verdict(85), 'sehr gut'); assert.equal(SM.verdict(10), 'passt kaum');
  const norm = { party: 0.2, chill: 1, sights: 0, food: 0.5, transit: 0.5, shop: 0, sport: 0, kids: 0 };
  const ppl = [{ name: 'L', w: SM.PRESETS.party.w }, { name: 'J', w: SM.PRESETS.chill.w }];
  const a = { norm, counts: { party: 3, chill: 20, sights: 0, food: 5, transit: 4, shop: 0, sport: 0, kids: 0 }, group: SM.groupScore(norm, ppl) };
  assert.match(SM.summary(a, ppl), /^(Gut für die meisten|Für \d)/);
  const parts = SM.breakdown(norm, SM.PRESETS.chill.w);
  assert.equal(parts[0].key, 'chill'); assert.ok(parts.some(x => x.pts < 0), 'Party stört');
  assert.ok(Math.abs(parts.reduce((s, x) => s + x.pts, 0) - SM.personScore(norm, SM.PRESETS.chill.w)) <= 3, 'Teile ergeben den Wert');
});

function areaSet() {
  const mk = (name, norm, extra = {}) => ({ name, lat: 41.4, lon: 2.17, norm: { party: 0, chill: 0, sights: 0, food: 0, transit: 0, shop: 0, sport: 0, kids: 0, ...norm },
    counts: {}, nearest: { transit: null }, centerDist: 1000, tier: 2, ...extra });
  return [mk('Party', { party: 1, food: 0.5, transit: 0.5 }, { nearest: { transit: 300 }, centerDist: 500 }),
    mk('Ruhig', { chill: 1, food: 0.5, transit: 0.5 }, { nearest: { transit: 100 }, centerDist: 5000, tier: 1 }),
    mk('Mitte', { party: 0.5, chill: 0.5, sights: 0.5, food: 0.5, transit: 0.5 }, { nearest: { transit: 50 }, centerDist: 2000 })];
}

test('whatIfWithout und sortAreas', () => {
  const areas = areaSet(), ppl = [{ name: 'P1', w: SM.PRESETS.party.w }, { name: 'P2', w: SM.PRESETS.party.w }, { name: 'C', w: SM.PRESETS.chill.w }];
  for (const a of areas) a.group = SM.groupScore(a.norm, ppl, 0.6);
  const byTotal = SM.sortAreas(areas, 'fair');
  const w = SM.whatIfWithout(areas, ppl, 0.6, byTotal[0].name);
  assert.ok(w.every(x => x.area !== byTotal[0].name), 'nur echte Änderungen');
  assert.equal(SM.sortAreas(areas, 'transit')[0].name, 'Mitte');
  assert.equal(SM.sortAreas(areas, 'center')[0].name, 'Party');
  assert.equal(SM.sortAreas(areas, 'cheap')[0].name, 'Ruhig');
  assert.equal(SM.sortAreas(areas, 'p:2')[0].name, 'Ruhig', 'beste für Person 3');
  assert.equal(SM.sortAreas(areas, 'p:99').length, 3, 'kaputter Modus fällt zurück');
});

test('awards: Kompromiss, Typ-Sieger, Bahn', () => {
  const areas = areaSet(), ppl = [{ name: 'P', type: 'party', w: SM.PRESETS.party.w }, { name: 'C', type: 'chill', w: SM.PRESETS.chill.w }];
  for (const a of areas) a.group = SM.groupScore(a.norm, ppl, 0.6);
  const ranked = SM.sortAreas(areas, 'fair'), aw = SM.awards(ranked, ppl);
  assert.deepEqual(aw[0].slice(0, 1), ['Bester Kompromiss']);
  assert.ok(aw.flat().some(t => t.startsWith('Beste Wahl für')));
  assert.ok(aw.every(l => l.length <= 2));
});

test('annotateCentre, Geheimtipp, cityStats', () => {
  const areas = areaSet(); for (const a of areas) { a.lat += (a.name === 'Ruhig' ? 0.05 : 0); a.counts = { party: 10, chill: 4 }; }
  SM.annotateCentre(areas, { lat: 41.4, lon: 2.17 });
  assert.ok(areas.every(a => a.tier >= 1 && a.tier <= 3 && a.centerDist >= 0));
  assert.ok(areas.find(a => a.name === 'Ruhig').centerDist > 5000);
  for (const a of areas) a.group = { total: 80 };
  assert.equal(SM.isSecretTip(areas.find(a => a.name === 'Ruhig'), 85, 100), true);
  assert.equal(SM.isSecretTip(areas.find(a => a.name === 'Mitte'), 85, 99999), false);
  assert.equal(SM.cityStats(areas).party, 10);
  assert.equal(SM.cityStats([]).party, 0);
});

test('Neue Kategorien: Einkaufen, Sport, Kinder werden erkannt und abgefragt', () => {
  assert.deepEqual(SM.categoriesOf({ shop: 'mall' }), ['shop']);
  assert.deepEqual(SM.categoriesOf({ leisure: 'playground' }), ['kids']);
  assert.deepEqual(SM.categoriesOf({ leisure: 'fitness_centre' }), ['sport']);
  const q = C.overpassQuery([1, 2, 3, 4]);
  for (const v of ['mall', 'playground', 'fitness_centre', 'marketplace']) assert.ok(q.includes(v), v);
  assert.ok(C.FIELDS.includes('shop'));
});

test('Airbnb-Link: Kinder, Babys, Schlafzimmer', () => {
  const u = new URL(SM.airbnbUrl({ lat: 41.4, lon: 2.17, name: 'Gràcia', city: 'Barcelona', adults: 4, children: 2, infants: 1, minBedrooms: 2, priceMaxNight: 120.4 }));
  assert.equal(u.searchParams.get('children'), '2'); assert.equal(u.searchParams.get('infants'), '1');
  assert.equal(u.searchParams.get('min_bedrooms'), '2'); assert.equal(u.searchParams.get('price_max'), '120');
  const v = new URL(SM.airbnbUrl({ lat: 41.4, lon: 2.17, name: 'x', city: 'y', adults: 2 }));
  assert.ok(!v.searchParams.has('children') && !v.searchParams.has('min_bedrooms'));
});

test('Kleine Treffer werden auf Mindestgröße aufgeweitet', () => {
  const g = C.geoFromNominatim({ lat: '41.40', lon: '2.15', boundingbox: ['41.398', '41.402', '2.148', '2.152'], display_name: 'Gràcia, Barcelona' });
  assert.ok(g.bbox[2] - g.bbox[0] >= 2 * 0.04 - 1e-9 && g.bbox[3] - g.bbox[1] >= 2 * 0.04 - 1e-9);
});
