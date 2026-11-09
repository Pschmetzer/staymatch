// Läuft mit: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
require('../web/scoring.js');
require('../extension/parse.js');
require('../extension/rank.js');
const SM = globalThis.StayMatch, P = globalThis.StayMatchParse, R = globalThis.StayMatchRank;

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

test('Preiswertung ist stetig und fällt über dem Budget', () => {
  let prev = null;
  for (let r = 0.05; r <= 1.5; r += 0.01) {
    const s = R.priceScore(r * 1000, 1000);
    if (prev !== null) assert.ok(Math.abs(s - prev) < 0.1, `Sprung bei ${r.toFixed(2)}`);
    prev = s;
  }
  assert.ok(R.priceScore(1500, 1000) < R.priceScore(1000, 1000));
  assert.equal(R.priceScore(null, 1000), null);
});

test('Sterne: viele Bewertungen schlagen wenige', () => {
  assert.ok(R.ratingScore(4.9, 300) > R.ratingScore(5.0, 3));
  assert.equal(R.ratingScore(null, 0), null);
});

test('Betten unbekannt ist nicht 0', () => {
  assert.equal(R.bedScore({}, 5), null);
  assert.equal(R.bedScore({ beds: 5 }, 5), 1);
});

test('Parser: Preise, Sterne, Details', () => {
  assert.equal(P.num('702 € Gesamtpreis, ursprünglich 896 €'), 702);
  assert.equal(P.num('1.234 €'), 1234);
  assert.deepEqual(P.rating('4,59 (800)'), { value: 4.59, count: 800 });
  assert.deepEqual(P.rating('Neu'), { value: null, count: null });
  assert.deepEqual(P.details(['4 Schlafzimmer', '5 Betten', '2 Badezimmer']), { bedrooms: 4, beds: 5, baths: 2, pro: false });
  assert.equal('/rooms/plus/123?x=1'.match(P.ROOM_RE)[1], '123');
});

test('Parser: Suchparameter', () => {
  const sp = P.searchParams('https://www.airbnb.de/s/x/homes?checkin=2026-12-07&checkout=2026-12-11&adults=5');
  assert.deepEqual(sp, { checkin: '2026-12-07', checkout: '2026-12-11', nights: 4, adults: 5 });
});

test('Airbnb-Link enthält Datum, Gäste und Kartenausschnitt', () => {
  const u = new URL(SM.airbnbUrl({ lat: 41.4, lon: 2.16, name: 'Gràcia', city: 'Barcelona', checkin: '2026-12-07', checkout: '2026-12-11', adults: 5, priceMaxNight: 500 }));
  for (const k of ['checkin', 'checkout', 'adults', 'price_max', 'ne_lat', 'sw_lng']) assert.ok(u.searchParams.has(k), k);
});
