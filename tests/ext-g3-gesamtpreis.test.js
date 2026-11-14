// Feature 3: Gesamtpreis aus dem Nachtpreis mit sichtbarer Annahme (Nächte aus der Suche, Gebühren aus dem Seitenmedian).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;
const N = (id, o = {}) => ({ id, rating: 4.7, reviewCount: 50, totalPrice: 100, isTotal: false, currency: '€', beds: 4, badges: [], ...o });

test('ohne Gebührenangaben: Nächte × Preis, Annahme nennt „ohne Gebühren“', () => {
  const [r] = R.rankListings([N('a')], { people: 2, nights: 4 });
  assert.equal(r.rank.stay, 400); assert.equal(r.rank.stayEstimated, false);
  assert.match(r.rank.assumption, /4 Nächte laut Suche × 100 €, ohne Gebühren/);
  assert.ok(r.rank.info.includes(r.rank.assumption));
});

test('mit Gebührenwerten anderer Karten: Median schlägt auf den Gesamtpreis auf, Annahme sichtbar', () => {
  // drei Karten zeigen Nacht 100 und gesamt 500 bei 4 Nächten → (500−400)/500 = 20 % Gebühren
  const fee = i => N('f' + i, { nightPrice: 100, allTotal: 500, isTotal: true, totalPrice: 500 });
  const out = R.rankListings([fee(1), fee(2), fee(3), N('x')], { people: 2, nights: 4 });
  const x = out.find(l => l.id === 'x');
  assert.equal(x.rank.stay, 500); assert.equal(x.rank.stayEstimated, true);
  assert.match(x.rank.assumption, /plus etwa 20 % Gebühren \(Median/);
  assert.ok(x.rank.why.some(t => /≈ 500 € gesamt/.test(t)) || x.rank.warn.some(t => /≈ 500 € gesamt/.test(t)));
  const f = out.find(l => l.id === 'f1'); assert.equal(f.rank.assumption, null); // echter Gesamtpreis
});

test('weniger als 3 Gebührenwerte: keine Schätzung', () => {
  const fee = i => N('f' + i, { nightPrice: 100, allTotal: 500, isTotal: true, totalPrice: 500 });
  const x = R.rankListings([fee(1), fee(2), N('x')], { people: 2, nights: 4 }).find(l => l.id === 'x');
  assert.equal(x.rank.stayEstimated, false); assert.equal(x.rank.stay, 400);
});

test('ohne Nächtezahl keine Gesamtsumme und keine Annahme', () => {
  const [r] = R.rankListings([N('a')], { people: 2, nights: null });
  assert.equal(r.rank.stay, null); assert.equal(r.rank.assumption, null);
});
