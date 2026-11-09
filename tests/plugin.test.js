// Runde 4: Preislogik, Bewertungs-Stichworte, Parser für weitere Sprachen
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/parse.js');
require('../extension/rank.js');
const P = globalThis.StayMatchParse, R = globalThis.StayMatchRank;

test('Preis: Nacht- und Gesamtpreis werden richtig umgerechnet', () => {
  assert.equal(R.stayTotal({ totalPrice: 100, isTotal: false }, 4), 400);
  assert.equal(R.stayTotal({ totalPrice: 400, isTotal: true }, 4), 400);
  assert.equal(R.stayTotal({ totalPrice: 100, isTotal: false }, null), null, 'ohne Nächte kein Gesamtpreis');
  assert.equal(R.perNight({ totalPrice: 400, isTotal: true }, 4), 100);
  assert.equal(R.perNight({ totalPrice: 100, isTotal: false }, 4), 100, 'Nachtpreis nicht nochmal teilen');
});

test('Preis: ohne Nächte wird ein Nachtpreis nicht mit dem Gesamtbudget verglichen', () => {
  const r = R.scoreListing({ id: '1', totalPrice: 100, isTotal: false }, { budget: 1000, nights: null });
  assert.equal(r.parts.price, null);
  assert.ok(r.why.some(w => /pro Nacht/.test(w)));
  assert.ok(!r.why.some(w => /100 € gesamt/.test(w)), 'Nachtpreis nicht als "gesamt" anzeigen');
});

test('Preis: pro Person aus dem Gesamtpreis', () => {
  const r = R.scoreListing({ id: '1', totalPrice: 100, isTotal: false }, { budget: 1000, nights: 4, people: 4 });
  assert.ok(r.why.concat(r.warn).some(w => /400 € gesamt \(100 pro Person\)/.test(w)), JSON.stringify(r.why));
});

test('Geschmack: Nachtpreis wird nicht durch die Nächte geteilt', () => {
  const taste = { likedCount: 1, avgPricePerNight: 100 };
  const a = R.tasteScore({ totalPrice: 100, isTotal: false, nights: 4 }, taste);
  const b = R.tasteScore({ totalPrice: 400, isTotal: true, nights: 4 }, taste);
  assert.equal(a, b);
  assert.ok(a > 0.5);
});

test('Betten: Schlafzimmer zählen als mehr als ein Schlafplatz', () => {
  assert.equal(R.bedScore({ bedrooms: 3 }, 5), 1);
  assert.equal(R.bedScore({ bedrooms: 1 }, 5), 0.25);
});

test('Bewertungen: "laut" als "gemäß" ist kein Lärm', () => {
  assert.deepEqual(P.reviewHints('Laut Beschreibung gibt es WLAN.'), []);
  assert.deepEqual(P.reviewHints('Laut Gastgeber ist alles da.'), []);
  assert.deepEqual(P.reviewHints('Nachts war es sehr laut.'), ['⚠️ laut']);
  assert.deepEqual(P.reviewHints('Die Straße ist laut.'), ['⚠️ laut']);
});

test('Bewertungen: Lob mit "kein"/"no" kippt nicht', () => {
  assert.deepEqual(P.reviewHints('No complaints, spotless!'), ['👍 sauber']);
  assert.deepEqual(P.reviewHints('Kein Problem, alles sauber.'), ['👍 sauber']);
});

test('Bewertungen: verneinte Störfaktoren als lesbare Gegenbegriffe', () => {
  assert.deepEqual(P.reviewHints('Die Wohnung war nicht laut.'), ['👍 ruhig']);
  assert.deepEqual(P.reviewHints('Gar nicht schmutzig.'), ['👍 sauber']);
});

test('Parser: Doppelbetten, Schlafsofa, halbe Bäder, andere Sprachen', () => {
  assert.deepEqual(P.details(['2 Schlafzimmer · 3 Doppelbetten · 1,5 Badezimmer']), { bedrooms: 2, beds: 3, baths: 1.5, pro: false });
  assert.equal(P.details(['1 Schlafsofa']).beds, 1);
  assert.equal(P.details(['2 bedrooms', '3 beds']).beds, 3);
  assert.equal(P.details(['2 dormitorios · 3 camas']).beds, 3);
  assert.equal(P.details(['2 chambres · 4 lits']).bedrooms, 2);
  assert.equal(P.details(['1 letto']).beds, 1);
});

test('Parser: Kinder zählen mit, Stadt aus der URL', () => {
  const sp = P.searchParams('https://www.airbnb.de/s/Barcelona--Spanien/homes?adults=2&children=1&infants=1');
  assert.equal(sp.adults, 3);
  assert.equal(sp.place, 'Barcelona, Spanien');
});

test('Parser: Gesamtpreis in mehreren Sprachen', () => {
  for (const t of ['702 € Gesamtpreis', '€702 total', '702 € totale', '702 zł łącznie']) assert.ok(P.TOTAL_RE.test(t), t);
  assert.ok(!P.TOTAL_RE.test('120 € pro Nacht'));
});

test('Viertel-Abgleich nutzt Alternativnamen (deutsch/original)', () => {
  const areas = [{ name: 'Altstadt', alt: ['Ciutat Vella'], lat: 1, lon: 1, total: 70, min: 60 }];
  assert.equal(R.areaFor({ locality: 'Ciutat Vella' }, areas).total, 70);
});

test('Unterkunft am Viertelrand zählt etwas weniger als mittendrin', () => {
  const areas = [{ name: 'A', lat: 41.4, lon: 2.16, total: 80, min: 70 }];
  const mid = R.scoreListing({ id: '1', lat: 41.4, lon: 2.16 }, { areas });
  const edge = R.scoreListing({ id: '2', lat: 41.412, lon: 2.16 }, { areas });
  assert.ok(mid.parts.area > edge.parts.area);
});
