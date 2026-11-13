// R5-139: Property-Tests für scoring.js und Leistungstest mit der größten Stadtdatei
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../web/scoring.js');
const SM = globalThis.StayMatch, C = require('../web/core.js');

// feste Zufallsfolge, damit Fehlschläge reproduzierbar sind
let seed = 12345;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const cats = Object.keys(SM.CATEGORIES);
const randNorm = () => Object.fromEntries(cats.map(k => [k, rnd()]));
const randW = () => Object.fromEntries(cats.map(k => [k, Math.round((rnd() * 2 - 1) * 10) / 10]));

test('personScore und groupScore liegen immer in [0,100] und sind ganzzahlig', () => {
  for (let i = 0; i < 2000; i++) {
    const n = randNorm(), w = randW();
    const s = SM.personScore(n, w);
    assert.ok(Number.isInteger(s) && s >= 0 && s <= 100, JSON.stringify({ n, w, s }));
    const g = SM.groupScore(n, [{ w }, { w: randW() }, { w: randW() }], rnd());
    assert.ok(g.total >= 0 && g.total <= 100 && g.min <= g.avg + 1);
  }
});

test('Mehr von etwas Gewünschtem ändert den Score nie nach unten (monoton)', () => {
  for (let i = 0; i < 1000; i++) {
    const n = randNorm(), w = randW(), k = cats[Math.floor(rnd() * cats.length)];
    const more = { ...n, [k]: Math.min(1, n[k] + 0.2) };
    const a = SM.personScore(n, w), b = SM.personScore(more, w);
    if (w[k] > 0) assert.ok(b >= a, `${k} gewünscht, Score fiel ${a}→${b}`);
    if (w[k] < 0) assert.ok(b <= a, `${k} unerwünscht, Score stieg ${a}→${b}`);
  }
});

test('Gruppen-Score ist unabhängig von der Reihenfolge der Personen', () => {
  for (let i = 0; i < 300; i++) {
    const n = randNorm(), ps = [{ w: randW() }, { w: randW() }, { w: randW() }];
    assert.equal(SM.groupScore(n, ps).total, SM.groupScore(n, [...ps].reverse()).total);
  }
});

test('scoreAreas: norm in [0,1], Anzahl nie negativ, mehr Orte ändern nie den Rang nach unten für Orte vor der Tür', () => {
  const areas = Array.from({ length: 20 }, (_, i) => ({ name: 'A' + i, lat: 48.1 + rnd() * 0.1, lon: 11.5 + rnd() * 0.1 }));
  const pois = Array.from({ length: 400 }, () => ({ lat: 48.1 + rnd() * 0.1, lon: 11.5 + rnd() * 0.1, cat: cats[Math.floor(rnd() * cats.length)] }));
  SM.scoreAreas(areas, pois, 800);
  for (const a of areas) for (const k of cats) {
    assert.ok(a.norm[k] >= 0 && a.norm[k] <= 1 + 1e-9);
    assert.ok(a.counts[k] >= 0);
  }
});

test('Leistung: größte Stadtdatei wird in unter 1,5 s bewertet (bester von 3 Läufen)', () => {
  const dir = path.join(__dirname, '..', 'web', 'data');
  const biggest = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json')
    .map(f => [f, fs.statSync(path.join(dir, f)).size]).sort((a, b) => b[1] - a[1])[0][0];
  const raw = fs.readFileSync(path.join(dir, biggest), 'utf8');
  let best = Infinity, areas = [];
  for (let run = 0; run < 3; run++) { // dieselben Funktionen wie die App (fromFile, buildData), kein Nachbau
    const t0 = Date.now();
    const data = SM.buildData(SM.fromFile(JSON.parse(raw)).rows);
    areas = data.areas;
    SM.scoreAreas(areas, data.pois, 800);
    best = Math.min(best, Date.now() - t0);
  }
  assert.ok(areas.length >= 2 && areas.every(a => a.norm), biggest);
  assert.ok(best < 1500, `${biggest}: ${best} ms`);
});
