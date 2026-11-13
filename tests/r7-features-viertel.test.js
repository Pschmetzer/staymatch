// Runde 7 E: neue Funktionen im Viertel-Finder (Rechnung in scoring.js, Anzeige in app-extra.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../web/scoring.js');
const SM = globalThis.StayMatch;
const { bootApp, until, tick, search, hasDom, web } = require('./helpers/app-dom.js');

const dom = { skip: !hasDom && 'jsdom fehlt (npm ci --prefix tests)' };
const withW = ppl => ppl.map(p => ({ ...p, w: SM.weightsOf(p) }));
const load = city => {
  const d = SM.fromFile(JSON.parse(fs.readFileSync(path.join(web, 'data', city + '.json'), 'utf8')));
  const { areas, pois } = SM.buildData(d.rows);
  SM.scoreAreas(areas, pois, 800); SM.annotateCentre(areas, d.geo);
  return { areas, pois, geo: d.geo };
};
const rank = (areas, ppl, f = 0.6) => { for (const a of areas) a.group = SM.groupScore(a.norm, ppl, f); return SM.sortAreas(areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10), 'fair'); };
const boot = (opt = {}) => { const w = bootApp(opt); w.eval(fs.readFileSync(path.join(web, 'app-extra.js'), 'utf8') + '\n//# sourceURL=app-extra.js'); return w; };

// ---------- Rechnung ----------
test('Tageslicht: Oslo im Dezember etwa 6 Stunden, Barcelona im Juni über 15', () => {
  assert.ok(Math.abs(SM.dayLength(59.91, '2026-12-21') - 5.9) < 0.3);
  assert.ok(SM.dayLength(41.39, '2026-06-21') > 15);
  assert.equal(SM.dayLength(78, '2026-12-21'), 0); // Polarnacht
  assert.equal(SM.dayLength(78, '2026-06-21'), 24);
  assert.equal(SM.dayLength(50, 'kaputt'), null);
  assert.match(SM.daylightText(59.91, '2026-12-21'), /Früh dunkel/);
  assert.match(SM.daylightText(59.91, '2026-06-21'), /Verdunkelung/);
  assert.match(SM.sundayNote('2026-11-15'), /Anreise am Sonntag/); // Sonntag
  assert.equal(SM.sundayNote('2026-11-16'), '');
});

test('Wünsche aus einem Satz: Häkchen und Budget mit Modus', () => {
  assert.deepEqual(SM.parseWishes('ruhige ganze Wohnung mit WLAN unter 120'), { wishes: ['whole', 'quiet', 'wifi'], budget: 120, mode: 'night' });
  const r = SM.parseWishes('Superhost, sauber, kein gewerblicher Anbieter, bis 900 € insgesamt');
  assert.deepEqual(r.wishes, ['private', 'trusted', 'clean']);
  assert.equal(r.budget, 900); assert.equal(r.mode, 'total');
  assert.equal(SM.parseWishes('max 300 pro Person').mode, 'pp');
  assert.deepEqual(SM.parseWishes('hallo'), { wishes: [], budget: null, mode: null });
});

test('Interessen als Text → eigene Gewichte; „keine“ zählt negativ, das Ja gewinnt', () => {
  const r = SM.interestsToWeights('Jazzbars und Flohmarkt, keine Clubs');
  assert.equal(r.w.party, 1); assert.equal(r.w.shop, 1); assert.equal(r.w.food, 0.3);
  const n = SM.interestsToWeights('keine Bars, viele Parks und Museen');
  assert.equal(n.w.party, -0.6); assert.equal(n.w.chill, 1); assert.equal(n.w.sights, 1);
  assert.ok(n.hits.includes('kein Party'));
  assert.equal(SM.interestsToWeights('xyz'), null);
  assert.ok(SM.cleanPerson({ name: 'A', custom: n.w }).custom, 'Gewichte passen durch cleanPerson');
});

test('Gewichte nach Aufenthaltsdauer: Kurztrip und lange Reise, eigene Regler bleiben', () => {
  const p = { name: 'A', type: 'sights' }, w = SM.weightsOf(p);
  assert.equal(SM.stayWeights(p, w, 4), w, '3 bis 9 Nächte: unverändert');
  assert.ok(SM.stayWeights(p, w, 2).transit > w.transit);
  assert.ok(SM.stayWeights(p, w, 14).shop > w.shop);
  assert.ok(SM.stayWeights(p, w, 14).sights <= 1);
  const c = { name: 'B', custom: { party: 1 } };
  assert.deepEqual(SM.stayWeights(c, SM.weightsOf(c), 1), SM.weightsOf(c));
  assert.match(SM.stayNote(1), /Kurztrip/); assert.equal(SM.stayNote(5), '');
});

test('Abstand zu Platz 1, schwächste Viertel, Ausreißer und einfache Sprache (Barcelona)', () => {
  const { areas } = load('barcelona'), ppl = withW([{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'chill' }]);
  const s = rank(areas, ppl), best = s[0];
  assert.equal(SM.gapToFirst(best, best, ppl), null);
  const g = SM.gapToFirst(s[5], best, ppl);
  assert.equal(g.pts, best.group.total - s[5].group.total);
  assert.match(SM.gapText(g), /^Bis Platz 1 fehlen \d+ Punkte?/);
  const worst = SM.worstAreas(s, ppl);
  assert.equal(worst.length, 3);
  assert.ok(worst[0].total <= worst[2].total);
  assert.match(worst[0].reason, /(wenig|zu viel) .+ für (Lena|Tom)|kaum etwas/);
  const odd = SM.oddOneOut(s, best, 1200);
  if (odd) { assert.notEqual(odd.area, best); assert.ok(odd.area.group.total >= best.group.total - 20); }
  assert.match(SM.plainText(best, ppl), /^(Sehr gut|Gut|Geht so|Passt eher nicht)\./);
});

test('Gruppe: wo ihr auseinanderliegt, robuste Empfehlung', () => {
  const ppl = withW([{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'chill' }]);
  const c = SM.groupConflicts(ppl);
  assert.ok(c.some(x => x.text === 'Lena will Party, Tom stört es.'));
  assert.deepEqual(SM.groupConflicts(withW([{ name: 'X', type: 'party' }])), []);
  const { areas } = load('wien'); const s = rank(areas, ppl);
  const r = SM.robustness(s, ppl, 0.6);
  assert.equal(r.top, s[0].name);
  assert.ok(r.kept <= r.total && r.total > 4);
  assert.match(SM.robustText(r), /Empfehlung|Knappe/);
});

test('Familien: Spielplatz mit Café daneben wird gezählt, Markt erkannt', () => {
  const a = { lat: 41.4, lon: 2.17 };
  const pois = [{ lat: 41.4005, lon: 2.17, cat: 'kids', tags: { leisure: 'playground' } }, { lat: 41.4006, lon: 2.1701, cat: 'chill', tags: { amenity: 'cafe' } },
    { lat: 41.403, lon: 2.17, cat: 'kids', tags: { leisure: 'playground' } }, { lat: 41.402, lon: 2.17, cat: 'shop', tags: { amenity: 'marketplace' }, name: 'Mercat' }];
  const f = SM.familySpots(a, pois, 800);
  assert.equal(f.pairs, 1);
  assert.equal(f.market.name, 'Mercat'); assert.ok(f.market.d > 200 && f.market.d < 240);
});

test('Eigene Orte: GeoJSON und KML, Unsinn wird verworfen', () => {
  const gj = JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [2.17, 41.4] }, properties: { name: 'Bar <b>' } },
    { type: 'Feature', geometry: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } }, { geometry: { type: 'Point', coordinates: [999, 1] } }] });
  assert.deepEqual(SM.parsePlaces(gj), [{ lat: 41.4, lon: 2.17, name: 'Bar <b>' }]);
  const kml = '<kml><Document><Placemark><name><![CDATA[Café X]]></name><Point><coordinates>16.37,48.21,0</coordinates></Point></Placemark></Document></kml>';
  assert.deepEqual(SM.parsePlaces(kml), [{ lat: 48.21, lon: 16.37, name: 'Café X' }]);
  assert.deepEqual(SM.parsePlaces('{kaputt'), []);
  assert.equal(SM.placesNear({ lat: 41.4, lon: 2.17 }, SM.parsePlaces(gj), 500).length, 1);
});

test('Abstimmung: Stimmen im Teilen-Link, geprüft und gezählt', () => {
  const v = { Lena: ['Gràcia@41.4036', 'Sants@41.3750'], Tom: ['Gràcia@41.4036', 'böse'], '': ['X@1.0000'] };
  const h = SM.shareEncode({ c: 'Barcelona', fairness: 0.6, people: [{ name: 'Lena', type: 'party' }], wishes: [], votes: v });
  const s = SM.shareDecode(h);
  assert.deepEqual(s.votes, { Lena: ['Gràcia@41.4036', 'Sants@41.3750'], Tom: ['Gràcia@41.4036'] });
  const t = SM.tallyVotes(s.votes);
  assert.deepEqual(t[0], { key: 'Gràcia@41.4036', name: 'Gràcia', names: ['Lena', 'Tom'] });
  assert.deepEqual(SM.shareDecode(SM.shareEncode({ c: 'x', fairness: 0.6, people: [{ name: 'A', type: 'party' }], wishes: [] })).votes, {}, 'alte Links ohne Stimmen');
});

test('Etappen: Reihenfolge, Lücken, Überschneidungen und Kopiertext', () => {
  const legs = [{ c: 'Wien', i: '2026-05-05', o: '2026-05-08', a: 'Neubau', t: 81 }, { c: 'Prag', i: '2026-05-01', o: '2026-05-04', a: 'Vinohrady', t: 77 }, { c: 'x', i: 'kaputt', o: '' }];
  assert.deepEqual(SM.cleanLegs(legs).map(l => l.c), ['Prag', 'Wien']);
  assert.deepEqual(SM.legIssues(legs), ['Zwischen Prag und Wien fehlt 1 Nacht.']);
  assert.match(SM.legIssues([{ c: 'A', i: '2026-05-01', o: '2026-05-05' }, { c: 'B', i: '2026-05-03', o: '2026-05-06' }])[0], /beginnt vor dem Ende/);
  const t = SM.legsText(legs, { emoji: false });
  assert.match(t, /^Etappe 1: Prag, 01\.05\.–04\.05\. \(3 Nächte\), Viertel Vinohrady \(77\/100\)/);
  assert.match(t, /7 Nächte insgesamt\./);
  assert.doesNotMatch(t, /📍/);
});

test('Kopiertext: Liste, Markdown-Tabelle, ohne Symbole, mit Entscheidungsfragen und Datenstand', () => {
  const { areas, geo } = load('barcelona'), ppl = withW([{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'chill' }]);
  const s = rank(areas, ppl);
  const plain = SM.areasText(s, { city: geo.name, ppl, stamp: '13.11.2026' });
  assert.match(plain, /🏘️ Passende Viertel in .+ für 2 Personen/);
  assert.match(plain, /^1\. .+: \d+\/100 \(/m);
  assert.match(plain, /Stand 13\.11\.2026/);
  const md = SM.areasText(s, { md: true, emoji: false, questions: false });
  assert.match(md, /\| Platz \| Viertel \| Wert \| Bahn \| Zentrum \|/);
  assert.doesNotMatch(md, /🏘️|🤔/); assert.doesNotMatch(md, /Zum Entscheiden/);
  const q = SM.decisionQuestions(s[0], s[s.length - 1]);
  assert.ok(q.length >= 1 && q.length <= 2);
});

test('Paarweises Duell: Paare unterscheiden sich, Antworten ergeben Gewichte', () => {
  const { areas } = load('wien'), ppl = withW([{ name: 'A', type: 'chill' }]);
  const s = rank(areas, ppl), pairs = SM.duelPairs(s);
  assert.ok(pairs.length >= 3);
  for (const [a, b] of pairs) assert.notEqual(a, b);
  // Immer das Viertel mit mehr Bars wählen → Party wird wichtig
  const picks = pairs.map(([a, b]) => (a.norm.party >= b.norm.party ? { win: a, lose: b } : { win: b, lose: a }));
  const w = SM.duelWeights(picks);
  assert.ok(w.party > 0);
  assert.ok(Object.values(w).every(x => x >= -1 && x <= 1));
  assert.equal(SM.duelWeights(picks.slice(0, 2)), null);
});

test('Fairness-Konto: merkt die Unzufriedenste der letzten Reise derselben Gruppe', () => {
  const ppl = withW([{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'chill' }]);
  const best = { name: 'Gràcia', group: { scores: [80, 52] } };
  let r = SM.fairMemory({}, ppl, 'Barcelona', best);
  assert.equal(r.hint, null);
  r = SM.fairMemory(r.mem, ppl, 'Barcelona', best);
  assert.equal(r.hint, null, 'gleiche Stadt: kein Hinweis');
  r = SM.fairMemory(r.mem, [...ppl].reverse(), 'Wien', { name: 'Neubau', group: { scores: [90, 88] } });
  assert.deepEqual(r.hint, { name: 'Tom', score: 52, city: 'Barcelona', area: 'Gràcia' });
  assert.equal(SM.fairMemory(r.mem, ppl.slice(0, 1), 'Wien', best).hint, null, 'allein: nichts');
});

// ---------- Oberfläche (jsdom) ----------
test('Viertel-Finder: Zusatzpanel, Kartenzeilen und Werkzeuge nach der Suche (Barcelona)', dom, async () => {
  const w = boot({ storage: { sm_people: [{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'family' }] } });
  const $ = id => w.document.getElementById(id);
  await search(w, 'Barcelona');
  await until(() => $('extra').querySelector('.card'));
  const txt = $('extra').textContent;
  assert.match(txt, /Tageslicht am Anreisetag/);
  assert.match(txt, /Lena will Party, Tom stört es\./);
  assert.match(txt, /Empfehlung|Knappe Empfehlung/);
  assert.match(txt, /Diese Viertel passen nicht/);
  assert.match(txt, /Begriffe kurz erklärt/);
  assert.match($('area-1').textContent, /Bis Platz 1 fehlen/);
  // Einfache Sprache an
  $('plain').checked = true; $('plain').dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.match($('area-0').querySelector('.xplain').textContent, /^(Sehr gut|Gut|Geht so|Passt eher nicht)\./);
  assert.equal(w.localStorage.getItem('sm_plain'), 'true');
  // Kopieren ohne Zwischenablage: Text erscheint zum Markieren
  $('cpFmt').value = 'md'; $('cpGo').click(); await tick(5);
  assert.match($('cpOut').value, /\| Platz \| Viertel/);
  assert.equal(w.errors.length, 0, String(w.errors));
});

test('Viertel-Finder: Wünsche als Satz und Interessen als Text übernehmen', dom, async () => {
  const w = boot();
  const $ = id => w.document.getElementById(id);
  $('wishText').value = 'ruhige ganze Wohnung mit WLAN unter 120 € pro Nacht'; $('wishGo').click();
  assert.deepEqual(JSON.parse(w.localStorage.getItem('sm_wishes')), ['whole', 'quiet', 'wifi']);
  assert.equal($('budgetMode').value, 'night'); assert.equal($('budget').value, '120');
  assert.match($('wishMsg').textContent, /Übernommen: .*Budget 120 €/);
  $('intText').value = 'keine Bars, Parks und Museen'; $('intGo').click();
  const p = JSON.parse(w.localStorage.getItem('sm_people'))[0];
  assert.equal(p.custom.party, -0.6); assert.equal(p.custom.chill, 1);
  assert.match($('intMsg').textContent, /kein Party/);
  assert.equal(w.errors.length, 0, String(w.errors));
});

test('Viertel-Finder: Abstimmung per Link, Etappen, Duell, Textgröße (Wien)', dom, async () => {
  const link = SM.shareEncode({ c: 'Wien', fairness: 0.6, people: [{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'chill' }], wishes: [], votes: { Lena: ['Neubau@48.1990'] } });
  const w = boot({ url: 'http://localhost/app#t=' + link });
  const $ = id => w.document.getElementById(id);
  await until(() => !$('go').disabled && $('extra').querySelector('.card'), 15000);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('sm_votes')).wien, { Lena: ['Neubau@48.1990'] });
  assert.match($('voteBox').textContent, /Neubau: 1 \(Lena\)/);
  assert.equal($('meSel').value, '', 'fremde Stimmen: erst fragen, wer ich bin');
  // Ich bin Tom, Herz für Platz 1 → Link enthält beide Stimmen
  $('meSel').value = 'Tom'; $('meSel').dispatchEvent(new w.Event('change', { bubbles: true }));
  $('area-0').querySelector('button[data-fav]').click(); await tick(5);
  const v = w.SMExtra.votes();
  assert.deepEqual(Object.keys(v).sort(), ['Lena', 'Tom']);
  assert.match($('area-0').textContent, /👍 \d Stimme/);
  // Etappe merken
  $('legAdd').click();
  const legs = JSON.parse(w.localStorage.getItem('sm_legs'));
  assert.equal(legs.length, 1); assert.equal(legs[0].c, 'Wien');
  assert.match($('extra').textContent, /Etappen \(1\)/);
  // Duell: alle Runden spielen, dann für Tom übernehmen
  $('duelGo').click();
  for (let i = 0; i < 12 && $('duelBox').querySelector('[data-duel]'); i++) $('duelBox').querySelector('[data-duel="0"]').click();
  assert.match($('duelBox').textContent, /Dein Geschmack laut Duell/);
  $('duelWho').value = '1'; $('duelUse').click();
  assert.ok(JSON.parse(w.localStorage.getItem('sm_people'))[1].custom, 'Gewichte aus dem Duell gespeichert');
  // Textgröße
  $('fsUp').click();
  assert.equal(w.localStorage.getItem('sm_fs'), '1.15');
  assert.equal($('results').style.zoom, '1.15');
  assert.equal(w.errors.length, 0, String(w.errors));
});

test('Viertel-Finder: eigene Orte erscheinen an den Karten, Vorlesen nur mit lokaler Stimme', dom, async () => {
  const w = boot({ storage: { sm_places: [{ lat: 48.2082, lon: 16.3738, name: 'Stephansdom' }] } });
  const $ = id => w.document.getElementById(id);
  assert.match($('placesMsg').textContent, /1 eigene Orte/);
  await search(w, 'Wien');
  await until(() => $('extra').querySelector('.card'));
  assert.ok([...w.document.querySelectorAll('#results article')].some(a => /📌 1 deiner Orte im Umkreis: Stephansdom/.test(a.textContent)));
  w.speechSynthesis = { speaking: false, getVoices: () => [{ lang: 'de-DE', localService: false }], speak() { throw new Error('darf nicht sprechen'); }, cancel() {} };
  w.SpeechSynthesisUtterance = function () {};
  $('speak').click();
  assert.match($('xMsg').textContent, /Keine deutsche Stimme/);
  assert.equal(w.errors.length, 0, String(w.errors));
});
