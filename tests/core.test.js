// Läuft mit: node --test tests/*.test.js
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

test('Namensabgleich: Artikel und Akzente egal, mehrere Teil-Viertel = Mittelwert', () => {
  const areas = [
    { name: 'Gràcia', lat: 1, lon: 1, total: 60, min: 50 },
    { name: "la Dreta de l'Eixample", lat: 2, lon: 2, total: 70, min: 60 },
    { name: "la Nova Esquerra de l'Eixample", lat: 3, lon: 3, total: 50, min: 40 },
  ];
  assert.equal(R.areaFor({ locality: 'Vila de Gracia' }, areas).total, 60);
  const e = R.areaFor({ locality: "l'Eixample" }, areas);
  assert.equal(e.total, 60); assert.equal(e.approx, true);
  assert.equal(R.areaFor({ locality: 'Sarrià' }, areas), null);
});

test('Wünsche: ganze Unterkunft, Superhost, Bewertungen', () => {
  const room = { kind: 'Privatzimmer in Berlin', badges: ['Superhost'], reviewCount: 5 };
  const flat = { kind: 'Wohnung in Berlin', badges: [], reviewCount: 120 };
  const w = ['whole', 'trusted', 'reviews'];
  assert.deepEqual(R.wishScore(room, w).hit, ['Superhost oder Gäste-Favorit']);
  assert.equal(R.wishScore(room, w).miss.length, 2);
  assert.equal(R.wishScore(flat, ['whole', 'reviews']).value, 1);
  assert.equal(R.wishScore({ kind: '' }, ['whole']).value, null, 'unbekannt zählt nicht');
  assert.equal(R.wishScore({ pro: false }, ['private']).value, null, 'privat ist nie sicher');
  assert.equal(R.wishScore({ pro: true }, ['private']).value, 0);
  assert.equal(R.wishScore(flat, []).value, null);
  assert.equal(R.wishScore({ kind: 'Wohnung', title: '2 Schlafzimmer in Gràcia' }, ['whole']).value, 1, 'Schlafzimmer ist kein Zimmer-Angebot');
  assert.equal(R.wishScore({ kind: 'Apartment', title: '1 bedroom in Soho' }, ['whole']).value, 1);
  assert.equal(R.wishScore({ kind: 'Zimmer in Berlin' }, ['whole']).value, 0);
});

test('Wünsche heben passende Unterkünfte nach oben', () => {
  const base = { rating: 4.8, reviewCount: 100, totalPrice: 500, isTotal: true };
  const ctx = { people: 1, budget: 800, wishes: ['whole'] };
  const a = R.scoreListing({ ...base, id: 1, kind: 'Wohnung' }, ctx).score;
  const b = R.scoreListing({ ...base, id: 2, kind: 'Privatzimmer' }, ctx).score;
  assert.ok(a > b);
});

test('Einzelperson: keine Gruppen-Texte, keine Betten, kein Preis pro Person', () => {
  const areas = [{ name: 'Gràcia', lat: 41.40, lon: 2.156, total: 80, min: 30, minName: 'Du' }];
  const r = R.scoreListing({ id: 1, lat: 41.401, lon: 2.157, totalPrice: 500, isTotal: true, beds: 1 }, { people: 1, budget: 800, areas });
  const text = [...r.why, ...r.warn].join(' | ');
  assert.match(text, /für dich/);
  assert.doesNotMatch(text, /Gruppe|unzufrieden|pro Person|Betten/);
  assert.equal(r.parts.beds, null);
});

test('Bewertungs-Stichworte gegen Wünsche', () => {
  const hints = ['👍 sauber (3×)', '⚠️ laut (2×)', '⚠️ WLAN'];
  assert.deepEqual(R.reviewConflicts(hints, ['quiet']), ['passt nicht zu deinem Wunsch „ruhig“: laut (2×)']);
  assert.equal(R.reviewConflicts(hints, ['clean']).length, 0, '👍 sauber ist kein Konflikt');
  assert.equal(R.reviewConflicts(hints, ['wifi']).length, 1);
  assert.equal(R.reviewConflicts(hints, undefined).length, 0);
});
