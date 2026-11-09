// Läuft mit: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;

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

test('Viertel-Zuordnung: nah per Koordinate, sonst per Name', () => {
  const areas = [{ name: 'Gràcia', lat: 41.403, lon: 2.157, total: 70 }];
  assert.equal(R.areaFor({ lat: 41.404, lon: 2.158 }, areas).name, 'Gràcia');
  assert.equal(R.areaFor({ lat: 41.5, lon: 2.3, locality: 'gracia' }, areas).dist, null);
  assert.equal(R.areaFor({ lat: 41.5, lon: 2.3 }, areas), null);
});
