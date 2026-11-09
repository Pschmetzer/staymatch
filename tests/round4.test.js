// Runde 4: Regler, Fairness, Veto, Vergleich, Ortswahl. Läuft mit: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../web/scoring.js');
const SM = globalThis.StayMatch;

test('cleanWeights: begrenzt, rundet, ergänzt fehlende Kategorien, verwirft Müll', () => {
  assert.equal(SM.cleanWeights(null), null);
  assert.equal(SM.cleanWeights('x'), null);
  const w = SM.cleanWeights({ party: 5, chill: -9, sights: 'abc', food: 0.34, evil: 1 });
  assert.deepEqual(w, { party: 1, chill: -1, sights: 0, food: 0.3, transit: 0, shop: 0, sport: 0, kids: 0 });
  assert.ok(!('evil' in w));
});

test('weightsOf: eigene Regler gehen vor dem Typ, unbekannter Typ fällt auf chill zurück', () => {
  assert.deepEqual(SM.weightsOf({ type: 'party' }), SM.PRESETS.party.w);
  assert.deepEqual(SM.weightsOf({ type: 'gibts-nicht' }), SM.PRESETS.chill.w);
  assert.equal(SM.weightsOf({ type: 'party', custom: { party: -1 } }).party, -1);
  assert.deepEqual(SM.weightsOf({ type: 'party', custom: 'kaputt' }), SM.PRESETS.party.w);
});

test('cleanPerson: Pflichtfelder, Länge, Veto-Liste nur mit bekannten Kategorien', () => {
  assert.equal(SM.cleanPerson(null), null);
  assert.equal(SM.cleanPerson({ name: 5 }), null);
  const p = SM.cleanPerson({ name: 'x'.repeat(100), type: 'weg', veto: ['party', 'party', 'bogus'], custom: { party: 1 } });
  assert.equal(p.name.length, 40);
  assert.equal(p.type, 'chill');
  assert.deepEqual(p.veto, ['party']);
  assert.equal(p.custom.party, 1);
  assert.equal(SM.cleanPerson({ name: 'A', type: 'party' }).veto, undefined);
});

test('Fairness-Regler: 1 = nur die Unzufriedenste, 0 = nur der Schnitt, Standard 0,6', () => {
  const norm = { party: 1, chill: 0, sights: 0, food: 0, transit: 0 };
  const ppl = [{ w: SM.PRESETS.party.w }, { w: SM.PRESETS.chill.w }]; // 100/0-ähnlich
  const g = SM.groupScore(norm, ppl);
  assert.equal(SM.groupScore(norm, ppl, 1).total, Math.round(g.min));
  assert.equal(SM.groupScore(norm, ppl, 0).total, Math.round(g.avg));
  assert.equal(SM.groupScore(norm, ppl, 0.6).total, g.total);
  assert.equal(SM.groupScore(norm, ppl, 'quatsch').total, g.total);
  assert.equal(SM.groupScore(norm, ppl, 7).total, SM.groupScore(norm, ppl, 1).total, 'über 1 wird auf 1 begrenzt');
  assert.equal(SM.cleanFairness(''), 0.6);
  assert.equal(SM.cleanFairness(null), 0.6);
  assert.equal(SM.cleanFairness(0), 0);
});

test('groupScore nimmt Personen mit custom/type ohne fertiges w', () => {
  const norm = { party: 1, chill: 0, sights: 0, food: 0, transit: 0 };
  const a = SM.groupScore(norm, [{ type: 'party' }]).total;
  const b = SM.groupScore(norm, [{ type: 'chill', custom: SM.PRESETS.party.w }]).total;
  assert.equal(a, b);
});

test('personScore: nur Abneigungen ergibt sinnvolle Werte statt immer 0', () => {
  const w = { party: -1, chill: 0, sights: 0, food: 0, transit: 0 };
  assert.equal(SM.personScore({ party: 0 }, w), 100);
  assert.equal(SM.personScore({ party: 1 }, w), 0);
  assert.equal(SM.personScore({ party: 0.5 }, w), 50);
  assert.equal(SM.personScore({ party: 1 }, { party: 0, chill: 0, sights: 0, food: 0, transit: 0 }), 100, 'alles egal = zufrieden');
});

test('Veto: greift ab Schwelle, nennt Person und Kategorie', () => {
  const ppl = [{ name: 'Sara', veto: ['party'] }, { name: 'Tom' }];
  assert.deepEqual(SM.vetoes({ party: 0.2 }, ppl), []);
  const v = SM.vetoes({ party: SM.VETO_LIMIT }, ppl);
  assert.equal(v.length, 1);
  assert.equal(v[0].name, 'Sara');
  assert.equal(v[0].label, 'Party');
  assert.deepEqual(SM.vetoes({}, ppl), []);
});

test('thinData: wenig Orte = wackelige Wertung', () => {
  assert.equal(SM.thinData({ a: 5, b: 10 }), true);
  assert.equal(SM.thinData({ a: 20, b: 10 }), false);
});

test('compareAreas: Gewinner je Kategorie, je Person und gesamt', () => {
  const A = { counts: { party: 10, chill: 3, sights: 5, food: 8, transit: 1 }, group: { total: 70, scores: [80, 60] } };
  const B = { counts: { party: 4, chill: 3, sights: 9, food: 8, transit: 2 }, group: { total: 55, scores: [50, 60] } };
  const c = SM.compareAreas(A, B, [{ name: 'L' }, { name: 'M' }]);
  assert.deepEqual(c.cats.map(x => x.win), [1, 0, 2, 0, 2, 0, 0, 0]);
  assert.deepEqual(c.persons.map(x => x.win), [1, 0]);
  assert.equal(c.total.win, 1);
  assert.equal(c.persons[0].name, 'L');
});

test('placeChoices: Paris/Paris(Texas) nachfragen, Dubletten und Randtreffer nicht', () => {
  const r = (name, imp, lat = 1) => ({ display_name: name, importance: imp, lat, lon: 2, boundingbox: [0, 0, 1, 1] });
  const res = SM.placeChoices([
    r('Paris, Île-de-France, Frankreich', 0.9),
    r('Paris, Île-de-France, Frankreich', 0.9),
    r('Paris, Lamar County, Texas, USA', 0.6),
    r('Paris, Kleinstadt, Irgendwo', 0.1),
  ]);
  assert.equal(res.length, 2);
  assert.ok(res[1].display_name.includes('Texas'));
  assert.deepEqual(SM.placeChoices('kaputt'), []);
  assert.deepEqual(SM.placeChoices([{ display_name: 'x' }]), [], 'ohne Koordinaten/Box verworfen');
  assert.equal(SM.placeChoices([r('Berlin, Deutschland', 0.8)]).length, 1);
});

test('Kultur-Typ existiert und alle Typen haben alle Kategorien', () => {
  assert.ok(SM.PRESETS.culture);
  for (const p of Object.values(SM.PRESETS)) assert.deepEqual(Object.keys(p.w).sort(), Object.keys(SM.CATEGORIES).sort());
});
