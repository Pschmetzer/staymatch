// Eigenschaftstest gegen die echten Stadtdaten (web/data) und Fuzz für applyForm.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../web/scoring.js');
const SM = globalThis.StayMatch;
const { bootApp, hasDom, web } = require('./helpers/app-dom.js');

const cities = fs.readdirSync(path.join(web, 'data')).filter(f => f.endsWith('.json') && f !== 'index.json').map(f => f.slice(0, -5));

for (const city of cities) {
  test(`Ruhe: Platz 1 ist in ${city} nicht das lauteste Viertel`, () => {
    const d = SM.fromFile(JSON.parse(fs.readFileSync(path.join(web, 'data', city + '.json'), 'utf8')));
    const { areas, pois } = SM.buildData(d.rows);
    SM.scoreAreas(areas, pois, 800); SM.annotateCentre(areas, d.geo);
    const ppl = [{ name: 'Ruhe', type: 'chill' }].map(p => ({ ...p, w: SM.weightsOf(p) }));
    const ok = SM.eligibleAreas(areas, ppl).withData;
    assert.ok(ok.length >= 5, 'zu wenige Viertel mit Daten');
    for (const a of ok) a.group = SM.groupScore(a.norm, ppl, 0.6);
    const ranked = SM.sortAreas(ok.slice(), 'fair');
    const loudest = ok.reduce((m, a) => (a.norm.party > m.norm.party ? a : m));
    assert.notEqual(ranked[0].name, loudest.name, `${ranked[0].name} ist zugleich das lauteste Viertel`);
    assert.ok(ranked[0].norm.party < loudest.norm.party);
  });
}

test('applyForm: Fuzz-Eingänge werfen nie und lassen nur gültige Werte im Formular', { skip: !hasDom && 'jsdom fehlt (npm ci --prefix tests)' }, () => {
  const w = bootApp();
  let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const junk = () => { const r = rnd(); return r < 0.15 ? null : r < 0.3 ? rnd() * 1e9 - 5e8 : r < 0.5 ? 'x'.repeat(Math.floor(rnd() * 200)) : r < 0.6 ? '<img src=x onerror=1>' : r < 0.7 ? [junk()] : r < 0.8 ? { a: junk() } : r < 0.9 ? NaN : rnd() < 0.5; };
  const bad = [null, undefined, 0, 'text', [], true, 42];
  for (const f of bad) w.applyForm(f);
  for (let i = 0; i < 400; i++) {
    const o = {}; for (const k of ['c', 'i', 'o', 'b', 'bm', 'r', 'mc', 'k', 'y', 'bd', 'mh']) if (rnd() < 0.7) o[k] = junk();
    w.applyForm(o, { dates: rnd() < 0.5 });
    const $ = id => w.document.getElementById(id);
    assert.ok($('city').value.length <= 80);
    assert.ok([...$('budgetMode').options].some(x => x.value === $('budgetMode').value), 'Budgetmodus ungültig');
    assert.ok([...$('radius').options].some(x => x.value === $('radius').value), 'Radius ungültig');
    assert.ok(+$('kids').value >= 0 && +$('kids').value <= 10 && +$('babys').value >= 0 && +$('babys').value <= 5);
  }
  assert.deepEqual(w.errors, []);
});
