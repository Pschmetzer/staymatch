// Runde 8, Viertel-Finder: Städteschlüssel, Gruppentext, Wertung, Link-Prüfung, Schlüssel-Migration
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('../web/scoring.js');
const SM = globalThis.StayMatch, C = require('../web/core.js');

test('cityKeys: Land als Zusatz ok, anderer Ort nicht („Paris, Texas“)', () => {
  assert.deepEqual(SM.cityKeys('Rom'), ['rom']);
  assert.ok(SM.cityKeys('Rom, Italien').includes('rom'));
  assert.ok(SM.cityKeys('Wien (Österreich)').includes('wien'));
  assert.ok(SM.cityKeys('  BARCELONA ').includes('barcelona'));
  for (const x of ['Paris, Texas', 'Rome, Georgia', 'Vienna, Virginia', 'Madrid, Iowa']) {
    const keys = SM.cityKeys(x), idx = JSON.parse(fs.readFileSync(__dirname + '/../web/data/index.json', 'utf8'));
    assert.equal(keys.map(k => idx[k]).find(Boolean), undefined, x);
  }
});
test('cityCountry und airbnbHost', () => {
  assert.equal(SM.cityCountry('Wien'), 'at');
  assert.equal(SM.cityCountry('Paris, Texas'), null);
  assert.equal(SM.airbnbHost('de', 'at'), 'www.airbnb.at');
  assert.equal(SM.airbnbHost('de', 'ch'), 'www.airbnb.ch');
  assert.equal(SM.airbnbHost('de'), 'www.airbnb.de');
  assert.equal(SM.airbnbHost('en'), 'www.airbnb.com');
  assert.equal(SM.airbnbHost('en', 'gb'), 'www.airbnb.co.uk');
  assert.match(SM.airbnbUrl({ lang: 'en', lat: 1, lon: 1, name: 'A', city: 'B' }), /^https:\/\/www\.airbnb\.com\/s\//);
  assert.match(SM.airbnbUrl({ lat: 1, lon: 1, name: 'A', city: 'B' }), /^https:\/\/www\.airbnb\.de\/s\//);
  for (const h of ['de', 'en']) for (const c of [null, 'at', 'ch', 'gb']) assert.ok(C.AIRBNB_DOMAINS.includes(SM.airbnbHost(h, c).replace(/^www\./, '')));
});

test('parseGroup: englische Typwörter, nur ganze Wörter', () => {
  const t = s => SM.parseGroup(s).map(p => `${p.name}:${p.type}`);
  assert.deepEqual(t('Anna Culture, Ben Nightlife'), ['Anna:culture', 'Ben:party']);
  assert.deepEqual(t('Tom Sightseeing'), ['Tom:sights']);
  assert.deepEqual(t('Lena Kindergarten'), ['Lena Kindergarten:chill']);
  assert.deepEqual(t('Max Lauf'), ['Max Lauf:chill']);
  assert.deepEqual(t('Sven Stadtbummel'), ['Sven Stadtbummel:chill']);
  assert.deepEqual(t('Kindra, Naturin'), ['Kindra:chill', 'Naturin:chill']);
  assert.deepEqual(t('Lena Party, Mia Chill'), ['Lena:party', 'Mia:chill']);
  assert.deepEqual(t('Tom: Sightseeing\nHans-Peter Natur'), ['Tom:sights', 'Hans-Peter:nature']);
  assert.deepEqual(t('3 Party').map(x => x.split(':')[1]), ['party', 'party', 'party']);
});

test('Normierung: Ausreißer drückt die anderen nicht mehr', () => {
  const areas = Array.from({ length: 40 }, (_, i) => ({ name: 'V' + i, lat: 41 + i * 0.001, lon: 2 }));
  const pois = [];
  for (let i = 0; i < 40; i++) for (let j = 0; j < (i === 0 ? 200 : 10); j++) pois.push({ lat: areas[i].lat, lon: 2, cat: 'party' });
  SM.scoreAreas(areas, pois, 100);
  assert.ok(areas[0].norm.party <= 1 && areas[0].norm.party > 0.99);
  assert.ok(areas.every(a => a.norm.party >= 0 && a.norm.party <= 1));
  assert.ok(areas[5].norm.party > 0.85, `Normalwert ${areas[5].norm.party}`); // am reinen Maximum wäre es sqrt(10/200) ≈ 0,22
});

test('personScore: Abneigung skaliert mit ihrem Gewichtsanteil, bleibt in 0..100', () => {
  const w = { sights: 1, party: -1 };
  assert.equal(SM.personScore({ sights: 1, party: 0 }, w), 100);
  assert.equal(SM.personScore({ sights: 1, party: 1 }, w), 50); // statt vorher 0
  assert.equal(SM.personScore({ sights: 0, party: 1 }, w), 0);
  assert.equal(SM.personScore({ sights: 1, party: 1 }, { sights: 1, party: -0.1 }), 91);
  assert.equal(SM.personScore({ party: 0 }, { party: -1 }), 100);
  assert.equal(SM.personScore({ party: 1 }, { party: -1 }), 0);
  assert.equal(SM.personScore({ party: 1 }, { sights: 1 }), 0);
});

test('Veto: absolute Mindestzahl', () => {
  const ppl = [{ name: 'A', veto: ['party'] }];
  assert.equal(SM.vetoes({ party: 0.9 }, ppl, { party: 12 }).length, 0);
  assert.equal(SM.vetoes({ party: 0.9 }, ppl, { party: 40 }).length, 1);
});

test('remapKeys: alte Schlüssel folgen dem Viertel nach Datenauffrischung', () => {
  const keyOf = a => `${a.name}@${a.lat.toFixed(4)}`;
  const areas = [{ name: 'Gràcia', lat: 41.4012, lon: 2.15 }, { name: 'Gràcia', lat: 41.5, lon: 2.15 }, { name: 'Eixample', lat: 41.39, lon: 2.16 }];
  const out = SM.remapKeys(['Gràcia@41.4010', 'Eixample@41.3950', 'Weg@1.0000'], areas, keyOf);
  assert.deepEqual(out, ['Gràcia@41.4012', 'Eixample@41.3900', 'Weg@1.0000']);
  assert.deepEqual(SM.remapKeys(['Gràcia@41.45'], areas, keyOf), ['Gràcia@41.45']); // zu weit weg
});

test('quantile', () => {
  assert.equal(SM.quantile([1, 2, 3, 4], 0.75), 4);
  assert.equal(SM.quantile([], 0.5), 0);
});

test('shareDecode: Längen und Typen begrenzt, Fuzz ohne Absturz', () => {
  const base = { c: 'Rom', p: [['Tom', 'party', 0, 0, 0]], f: 60 };
  const enc = o => SM.shareEncode ? Buffer.from(JSON.stringify(o)).toString('base64url') : '';
  const d = SM.shareDecode(enc({ ...base, bm: 'x'.repeat(500), r: { a: 1 }, mc: 'y'.repeat(50), k: 9999, y: -4, bd: 'ja', w: ['whole', 5, 'z'.repeat(100)] }));
  assert.ok(d);
  assert.ok(d.form.bm.length <= 10);
  assert.equal(d.form.r, '');
  assert.equal(d.form.mc, '');
  assert.equal(d.form.k, 10); assert.equal(d.form.y, 0); assert.equal(d.form.bd, false);
  assert.deepEqual(d.wishes, ['whole']);
  // Zufallsmüll: nie ein Fehler, immer null oder ein Objekt
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const junk = () => { const r = rnd(); return r < 0.2 ? null : r < 0.4 ? rnd() * 1e9 : r < 0.6 ? 'x'.repeat(Math.floor(rnd() * 100)) : r < 0.8 ? [junk()] : { a: junk() }; };
  for (let i = 0; i < 300; i++) {
    const o = { ...base }; for (const k of ['c', 'i', 'o', 'b', 'bm', 'r', 'mc', 'k', 'y', 'bd', 'w', 'm', 'mw', 'f', 'v']) if (rnd() < 0.7) o[k] = junk();
    const r = SM.shareDecode(enc(o)); assert.ok(r === null || typeof r === 'object');
  }
  assert.equal(SM.shareDecode('%%%'), null);
});

test('shareEncode ohne Namen', () => {
  const st = { c: 'Rom', fairness: 0.6, people: [{ name: 'Tom', type: 'party' }, { name: 'Mia', type: 'chill' }], wishes: [], votes: { Tom: ['A@1.0000'] }, anon: true };
  const d = SM.shareDecode(SM.shareEncode(st));
  assert.deepEqual(d.people.map(p => p.name), ['Person 1', 'Person 2']);
  assert.deepEqual(d.votes, {});
});

test('breakdown: Summe der Punkte passt zur Wertung', () => {
  for (const [norm, w] of [[{ sights: 1, party: 1 }, { sights: 1, party: -1 }], [{ sights: 0.6, party: 0.2, food: 0.4 }, { sights: 1, party: -0.5, food: 0.5 }]]) {
    const sum = SM.breakdown(norm, w).reduce((x, b) => x + b.pts, 0), score = SM.personScore(norm, w);
    assert.ok(Math.abs(Math.max(0, sum) - score) <= 2, `${sum} vs ${score}`);
  }
});
