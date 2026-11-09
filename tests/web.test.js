// Runde 4: Datum, Domain, Fast-Food-Gewicht
const test = require('node:test');
const assert = require('node:assert/strict');
require('../web/scoring.js');
const SM = globalThis.StayMatch;

test('Datum wird als lokaler Tag gelesen', () => {
  const d = SM.parseDay('2026-12-01');
  assert.equal(d.getDate(), 1); assert.equal(d.getMonth(), 11);
  assert.equal(SM.parseDay('kaputt'), null);
  assert.equal(SM.nights('2026-12-01', '2026-12-05'), 4);
  assert.equal(SM.nights('2026-03-28', '2026-03-30'), 2, 'Zeitumstellung');
  assert.equal(SM.nights('2026-12-05', '2026-12-01'), 0);
});

test('Airbnb-Domain und Währung nach Browsersprache', () => {
  assert.equal(SM.airbnbDomain('de-CH'), 'airbnb.ch');
  assert.equal(SM.airbnbDomain('de-DE'), 'airbnb.de');
  assert.equal(SM.airbnbDomain('en-GB'), 'airbnb.co.uk');
  assert.equal(SM.airbnbDomain('xx'), 'airbnb.de');
  assert.equal(SM.currencyFor('airbnb.ch'), 'CHF');
  const u = new URL(SM.airbnbUrl({ lat: 41.4, lon: 2.16, name: 'Gràcia', city: 'Barcelona', lang: 'fr-FR', radius: 500 }));
  assert.equal(u.hostname, 'www.airbnb.fr');
  assert.ok(+u.searchParams.get('ne_lat') - 41.4 > 0.0089, 'Ausschnitt mindestens 1 km');
});

test('Fast Food zählt weniger als Restaurant', () => {
  const a = SM.scoreAreas([{ lat: 0, lon: 0 }], [{ lat: 0, lon: 0, cat: 'food', w: 0.3 }], 800)[0];
  const b = SM.scoreAreas([{ lat: 0, lon: 0 }], [{ lat: 0, lon: 0, cat: 'food' }], 800)[0];
  assert.ok(a.sums.food < b.sums.food);
});
