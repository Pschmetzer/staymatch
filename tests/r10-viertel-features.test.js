// Runde 10, Viertel-Finder: Typ-Link, Sensitivität, Konfidenz, Ruhe-Typ, Gehzeit, Bildkarte, OSM-Editor, Steckbrief, Datenstand
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../web/scoring.js');
const SM = globalThis.StayMatch;
const { bootApp, search, hasDom, web } = require('./helpers/app-dom.js');

const dom = { skip: !hasDom && 'jsdom fehlt (npm ci --prefix tests)' };
const withW = ppl => ppl.map(p => ({ ...p, w: SM.weightsOf(p) }));
const load = city => {
  const d = SM.fromFile(JSON.parse(fs.readFileSync(path.join(web, 'data', city + '.json'), 'utf8')));
  const { areas, pois } = SM.buildData(d.rows);
  SM.scoreAreas(areas, pois, 800); SM.annotateCentre(areas, d.geo);
  return { areas, pois, geo: d.geo, meta: d.meta };
};
const rank = (areas, ppl, f = 0.6) => { for (const a of areas) a.group = SM.groupScore(a.norm, ppl, f); return areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10).sort((a, b) => b.group.total - a.group.total); };
const boot = (opt = {}) => { const w = bootApp(opt); w.eval(fs.readFileSync(path.join(web, 'app-extra.js'), 'utf8') + '\n//# sourceURL=app-extra.js'); return w; };

test('typePerson / deepLink: bekannte Typen, Ruhe, Unbekanntes', () => {
  assert.deepEqual(SM.typePerson('party'), { type: 'party' });
  assert.equal(SM.typePerson('quiet').type, 'chill');
  assert.ok(SM.isQuiet(SM.cleanPerson({ name: 'A', ...SM.typePerson('quiet') })));
  assert.equal(SM.isQuiet({ type: 'chill' }), false);
  for (const x of ['', null, 'nope', '__proto__', 'constructor']) assert.equal(SM.typePerson(x), null, String(x));
  assert.equal(SM.deepLink({ c: 'Rom', t: 'party' }), 'https://staymatch.pro/app?c=Rom&t=party');
  assert.equal(SM.deepLink({ c: 'São Paulo', t: 'quiet', i: '2027-05-01', o: '' }), 'https://staymatch.pro/app?c=S%C3%A3o%20Paulo&t=quiet&i=2027-05-01');
});

test('Sensitivität: Schwelle liegt unter dem aktuellen Gewicht, Platz 1 hält dort', () => {
  const { areas } = load('rom'), ppl = withW([{ name: 'A', type: 'party' }]);
  const ranked = rank(areas, ppl), s = SM.sensitivity(ranked, ppl, 0.6);
  assert.equal(s.top, ranked[0].name); assert.equal(s.key, 'party');
  assert.ok(s.min <= s.cur && s.min >= 0);
  assert.match(SM.sensitivityText(s), /Party/);
  if (!s.always && !s.tight) {
    const pp = ppl.map(p => ({ ...p, w: { ...p.w, party: s.min } }));
    assert.equal(rank(areas, pp)[0].name, s.top); // an der Schwelle bleibt Platz 1
  }
  assert.equal(SM.sensitivity(ranked, [], 0.6), null);
  assert.equal(SM.sensitivityText(null), '');
  assert.match(SM.sensitivityText({ top: 'X', label: 'Party', cur: 1, min: 0.4 }), /solange Party ≥ 0,4/);
  assert.match(SM.sensitivityText({ top: 'X', label: 'Party', always: true }), /gar nicht zählt/);
});

test('Konfidenz: Anteil benannter Orte und Stufen', () => {
  const a = { lat: 0, lon: 0 };
  const mk = (n, named) => Array.from({ length: n }, (_, i) => ({ lat: 0, lon: 0, name: i < named ? 'x' : '' }));
  assert.equal(SM.confidence(a, mk(10, 10)).level, 'low');
  assert.equal(SM.confidence(a, mk(100, 20)).level, 'low');
  assert.equal(SM.confidence(a, mk(100, 50)).level, 'mid');
  const hi = SM.confidence(a, mk(200, 150)); assert.equal(hi.level, 'high'); assert.equal(hi.share, 75);
  assert.match(hi.text, /gut: 200 Orte im Umkreis, 75 % mit Namen/);
  assert.equal(SM.confidence(a, []).share, 0);
});

test('Ruhe: Lärmproxy fällt mit Bars und steigt mit Abstand zum Zentrum', () => {
  const loud = { norm: { party: 1 }, centerDist: 0 }, calm = { norm: { party: 0 }, centerDist: 5000 };
  assert.equal(SM.quietScore(loud), 0); assert.equal(SM.quietScore(calm), 100);
  assert.ok(SM.quietScore({ norm: { party: 0.3 }, centerDist: 1500 }) > SM.quietScore({ norm: { party: 0.6 }, centerDist: 1500 }));
  const { areas } = load('rom'); rank(areas, withW([{ name: 'A', type: 'chill' }]));
  const s = SM.sortAreas(areas, 'quiet'); assert.ok(SM.quietScore(s[0]) >= SM.quietScore(s[s.length - 1]));
});

test('Ruhig-Typ: andere Top 8 als Chill, ruhigere Lage; Teilen-Link-Rundlauf behält den Typ', () => {
  const { areas } = load('rom'), mk = p => withW([{ name: 'A', ...p }]);
  const top = ppl => rank(areas, ppl).slice(0, 8), avgQ = l => l.reduce((x, a) => x + SM.quietScore(a), 0) / l.length;
  const chill = top(mk({ type: 'chill' })).map(a => a.name), quietL = top(mk(SM.typePerson('quiet')));
  assert.notDeepEqual(quietL.map(a => a.name), chill); assert.ok(quietL.map(a => a.name).filter(n => chill.includes(n)).length < 8);
  assert.ok(avgQ(quietL) > avgQ(top(mk({ type: 'chill' }))), 'Ruhig-Typ soll ruhigere Viertel wählen');
  assert.equal(Object.keys(areas[0].norm).includes('quiet'), false); // nicht aufzählbar
  const st = { c: 'Rom', i: '', o: '', fairness: 0.6, people: [SM.cleanPerson({ name: 'Ich', ...SM.typePerson('quiet') }), SM.cleanPerson({ name: 'Tom', ...SM.typePerson('party') })], wishes: [], m: [], mw: 'g' };
  const back = SM.shareDecode(SM.shareEncode(st));
  assert.equal(SM.isQuiet(back.people[0]), true); assert.equal(back.people[1].type, 'party'); assert.equal(SM.isQuiet(back.people[1]), false);
});

test('Gehzeit: Luftlinie × 1,3 bei 80 m/min, mindestens 1 Minute', () => {
  assert.equal(SM.walkMin(800), 13); assert.equal(SM.walkMin(0), 1); assert.equal(SM.walkMin(80), 1); assert.equal(SM.walkMin(1500), 24);
});

test('Steckbrief: erzählender Absatz aus echten Zahlen, ohne Viertel leer', () => {
  const { areas, pois } = load('rom'); rank(areas, withW([{ name: 'A', type: 'chill' }]));
  const t = SM.cityStory('Rom', areas, pois);
  assert.match(t, /^Rom: \d+ von \d+ Viertel haben genug Daten/); assert.match(t, /Nachtleben bündelt sich rund um/); assert.ok(t.length > 250);
  assert.equal(SM.cityStory('X', [], []), '');
});

test('OSM-Editor-Link und Bildkarten-Daten', () => {
  assert.equal(SM.osmEditUrl(41.9, 12.5), 'https://www.openstreetmap.org/edit?editor=id#map=17/41.90000/12.50000&presets=place/neighbourhood');
  const { areas } = load('rom'), ppl = withW([{ name: 'A', type: 'sights' }]), r = rank(areas, ppl);
  for (const a of r) a.group = SM.groupScore(a.norm, ppl);
  const c = SM.shareCardData(r[0], 0, 'Rom', ppl);
  assert.match(c.title, /^1\. /); assert.match(c.sub, /^Rom · \d+\/100/); assert.ok(c.bars.length >= 1 && c.bars.every(([, p]) => p >= 0 && p <= 100)); assert.equal(c.foot, 'staymatch.pro');
  assert.ok(c.line.length <= 120);
});

test('fromFile liefert Datenstand und Quelle', () => {
  const m = load('rom').meta;
  assert.ok(m.n > 1000); assert.match(m.lic, /ODbL/); assert.ok(m.src);
});

// ---------- Oberfläche ----------
test('App: ?c=Rom&t=party setzt den Typ der ersten Person', dom, async () => {
  const w = boot({ url: 'http://localhost/app?c=Rom&t=party' });
  assert.equal(w.document.getElementById('city').value, 'Rom');
  assert.equal(JSON.parse(w.localStorage.getItem('sm_people'))[0].type, 'party');
  assert.equal(w.document.querySelector('#people select').value, 'party');
  const q = boot({ url: 'http://localhost/app?c=Rom&t=quiet' });
  assert.equal(q.document.querySelector('#people select').value, 'quiet');
  const bad = boot({ url: 'http://localhost/app?c=Rom&t=zzz' });
  assert.notEqual(JSON.parse(bad.localStorage.getItem('sm_people') || '[{"type":"chill"}]')[0].type, 'zzz');
});

test('App: Karten zeigen Sensitivität, Konfidenz, Gehzeit, Bild- und OSM-Editor-Knopf; Panel Steckbrief und Datenstand', dom, async () => {
  const w = boot({ storage: { sm_people: [{ name: 'Ich', type: 'party' }] } });
  await search(w, 'Rom');
  const d = w.document, first = d.querySelector('#area-0 .xcard');
  assert.ok(first, 'Zusatzzeilen fehlen');
  assert.match(first.textContent, /Party/); assert.match(first.textContent, /Datenlage/); assert.match(first.textContent, /Min\. zu Fuß/);
  assert.ok(first.querySelector('button[data-xcard="0"]'));
  assert.match(first.querySelector('a[href*="openstreetmap.org/edit"]').href, /presets=place\/neighbourhood/);
  assert.doesNotMatch(d.querySelector('#area-1 .xcard').textContent, /bleibt vorn|liegt knapp vorn/); // nur Platz 1
  // andere Sortierung: Platz 1 der Karte ist nicht Platz 1 der Wertung, dann darf die Zeile nicht an einem fremden Viertel stehen
  const sel = d.getElementById('sort'); sel.value = 'transit'; sel.dispatchEvent(new w.Event('change')); await new Promise(r => setTimeout(r, 50));
  const card = d.querySelector('#area-0'), name = card.querySelector('h3').textContent.replace(/^\d+\.\s*/, '');
  const m = /(.+?) (bleibt vorn|liegt knapp vorn)/.exec(card.querySelector('.xcard').textContent.split('🎚️')[1] || '');
  if (m) assert.equal(m[1].trim(), name);
  assert.match(d.getElementById('story').textContent, /^Rom: /);
  assert.match(d.getElementById('dataInfo').textContent, /Datenstand .* Quelle: .*ODbL/);
  assert.match(fs.readFileSync(path.join(web, 'app.js'), 'utf8'), /mapLegend'\)\.textContent \+= .*walkMin\(r\)/); // Karte braucht Leaflet, hier nur Quelltext
  assert.deepEqual(w.errors, []);
});

test('App: Bildkarte ohne Canvas meldet sich, mit Canvas wird ein PNG gebaut; Typ-Link wird kopiert', dom, async () => {
  const w = boot({ storage: { sm_people: [{ name: 'Ich', type: 'party' }] } });
  await search(w, 'Rom');
  const d = w.document, calls = [];
  d.querySelector('button[data-xcard="0"]').click();
  assert.match(d.getElementById('xMsg').textContent, /Bild nicht möglich/); // jsdom ohne Canvas
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: (t, k, v) => { t[k] = v; return true; } });
  w.HTMLCanvasElement.prototype.getContext = () => ctx;
  w.HTMLCanvasElement.prototype.toBlob = function (cb) { calls.push([this.width, this.height]); cb(new w.Blob(['x'], { type: 'image/png' })); };
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = () => {};
  d.querySelector('button[data-xcard="0"]').click(); await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(calls, [[1080, 648]]); assert.match(d.getElementById('xMsg').textContent, /Bild gespeichert/);
  let copied = ''; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
  d.getElementById('typeLink').click(); await new Promise(r => setTimeout(r, 10));
  assert.match(copied, /^https:\/\/staymatch\.pro\/app\?c=Rom&t=party&/);
});
