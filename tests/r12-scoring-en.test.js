// Runde 12: scoring.js auf Deutsch und Englisch (t() mit deutschem Schlüssel), Sprachlogik für Typ- und Wunschwörter
const test = require('node:test');
const assert = require('node:assert/strict');
const I = require('../web/i18n.js');
require('../web/i18n-en-scoring.js');
const SM = require('../web/scoring.js') && globalThis.StayMatch;
const lang = l => { globalThis.SM_LANG = l; };
const DE = /[äöüß]|\b(und|oder|nicht|für|mit|der|die|das|dein|dir|bleibt|Viertel|Bahn|Platz|Wünsche)\b/;

// Kleine Beispielstadt: zwei Gruppen, drei Viertel
function demo() {
  const areas = [{ name: 'Altstadt', lat: 48.2, lon: 16.37 }, { name: 'Ring', lat: 48.21, lon: 16.38 }, { name: 'Rand', lat: 48.25, lon: 16.45 }];
  const pois = [];
  const add = (a, cat, n, name) => { for (let i = 0; i < n; i++) pois.push({ lat: a.lat + i * 1e-5, lon: a.lon, cat, name: name && `${name} ${i}`, tags: {} }); };
  add(areas[0], 'party', 40, 'Bar'); add(areas[0], 'sights', 20, 'Dom'); add(areas[0], 'transit', 2); add(areas[0], 'food', 10, 'Cafe');
  add(areas[1], 'chill', 30, 'Park'); add(areas[1], 'food', 12, 'Resto'); add(areas[1], 'transit', 3);
  add(areas[2], 'chill', 12, 'Wiese'); add(areas[2], 'food', 3, 'Stand');
  SM.scoreAreas(areas, pois);
  SM.annotateCentre(areas, { lat: 48.2, lon: 16.37 });
  const ppl = [{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'family' }, { name: 'Mia', type: 'sights' }].map(p => ({ ...p, w: SM.weightsOf(p) }));
  for (const a of areas) a.group = SM.groupScore(a.norm, ppl);
  const ranked = [...areas].sort((x, y) => y.group.total - x.group.total);
  return { areas, ranked, pois, ppl };
}
const texts = d => {
  const out = [];
  const { areas, ranked, pois, ppl } = d, a = ranked[0];
  out.push(SM.verdict(80), SM.verdict(10), SM.summary(a, ppl), SM.summary(a, [ppl[0]]), SM.plainText(a, ppl), SM.areasText(ranked, { city: 'Wien', ppl, stamp: '2026-01' }), SM.areasText(ranked, { md: true, emoji: false, questions: false }));
  out.push(...SM.awards(ranked, ppl).flat(), SM.typeSummary().map(x => x.join(' ')).join('; '), ...SM.worstAreas(areas, ppl).map(x => x.reason), ...SM.groupConflicts(ppl).map(x => x.text));
  out.push(SM.robustText(SM.robustness(areas, ppl)), SM.sensitivityText(SM.sensitivity(areas, ppl)), SM.confidence(a, pois).text, SM.cityStory('Wien', areas, pois), SM.gapText(SM.gapToFirst(ranked[2], ranked[0], ppl)));
  out.push(SM.daylightText(48.2, '2026-12-20'), SM.sundayNote('2026-05-10'), SM.stayNote(2), SM.stayNote(14), ...SM.legIssues([{ c: 'A', i: '2026-05-01', o: '2026-05-04' }, { c: 'B', i: '2026-05-06', o: '2026-05-08' }, { c: 'C', i: '2026-05-07', o: '2026-05-09' }]));
  out.push(SM.legsText([{ c: 'A', i: '2026-05-01', o: '2026-05-04', a: 'Ring', t: 80 }, { c: 'B', i: '2026-05-04', o: '2026-05-05' }]), ...SM.decisionQuestions(ranked[0], ranked[2]), SM.shareCardData(a, 0, 'Wien', ppl).sub);
  const v = { ranked, pois, ppl, r: 600, pool: areas, stats: SM.cityStats(areas), medCentre: 1000, awards: SM.awards(ranked, ppl), minDist: 800, relevant: [], byTotal: ranked };
  out.push(SM.cardHtml(ranked[1], 1, v, { url: 'https://x', key: 'k', fav: false, cmp: false, sortMode: 'fair' }), SM.cardHtml(ranked[2], 2, v, { url: 'https://x', key: 'k', fav: true, cmp: true, sortMode: 'fair' }));
  out.push(...SM.interestsToWeights('no bars, parks and museums').hits);
  return out;
};

test('scoring: Deutsch bleibt Deutsch, Englisch hat keinen deutschen Rest und keine offenen Platzhalter', () => {
  lang('de'); const de = texts(demo());
  lang('en'); I.missing.clear(); const en = texts(demo());
  assert.deepEqual([...I.missing], [], 'fehlende EN-Texte: ' + [...I.missing].join(' | '));
  assert.ok(de.some(x => DE.test(x)), 'DE enthält Deutsch');
  for (const x of en) {
    assert.ok(!/\{\w+\}/.test(x), 'Platzhalter offen: ' + x.slice(0, 80));
    const plain = String(x).replace(/<[^>]*>/g, ' ');
    assert.ok(!DE.test(plain), 'deutscher Rest in EN: ' + plain.slice(0, 120));
  }
  assert.notDeepEqual(de, en);
  lang('de');
});

test('scoring EN: Zahlen, Links und Domains in der Sprache der Seite', () => {
  lang('en');
  assert.equal(SM.deepLink({ c: 'Paris', t: 'family' }), 'https://staymatch.pro/en/app?c=Paris&t=family');
  assert.match(SM.airbnbUrl({ lat: 51.5, lon: -0.1, name: 'Soho', city: 'London', cc: 'gb' }), /^https:\/\/www\.airbnb\.co\.uk\/s\//);
  assert.match(SM.airbnbUrl({ lat: 40.7, lon: -74, name: 'SoHo', city: 'New York' }), /^https:\/\/www\.airbnb\.com\/s\//);
  assert.match(SM.sensitivityText({ top: 'X', key: 'party', label: 'nightlife', cur: 0.7, min: 0.4 }), /≥ 0\.4 \(now 0\.7\)/);
  assert.match(SM.areasText([{ name: 'A', centerDist: 1500, nearest: { transit: 100 }, group: { total: 70 } }], {}), /1\.5 km/);
  assert.match(SM.legsText([{ c: 'A', i: '2026-05-01', o: '2026-05-04' }]), /01\/05–04\/05 \(3 nights\)/);
  lang('de');
  assert.equal(SM.deepLink({ c: 'Paris', t: 'family' }), 'https://staymatch.pro/app?c=Paris&t=family');
  assert.match(SM.airbnbUrl({ lat: 48, lon: 11, name: 'X', city: 'Y' }), /^https:\/\/www\.airbnb\.de\//);
  assert.match(SM.areasText([{ name: 'A', centerDist: 1500, nearest: { transit: 100 }, group: { total: 70 } }], {}), /1,5 km/);
});

test('scoring: englische Typ-, Wunsch- und Interessenwörter', () => {
  const g = SM.parseGroup('Lena party, Tom family, 3 foodies, Ann hiking and Bob quiet');
  assert.deepEqual(g.map(p => p.type), ['party', 'family', 'foodie', 'foodie', 'foodie', 'nature', 'chill']);
  assert.deepEqual(g.map(p => p.name).slice(0, 3), ['Lena', 'Tom', 'foodies 1']);
  assert.deepEqual(SM.parseWishes('quiet, luxury, wifi, whole home').wishes.sort(), ['luxury', 'quiet', 'whole', 'wifi']);
  assert.deepEqual(SM.parseWishes('private host with many reviews, clean').wishes.sort(), ['clean', 'private', 'reviews']);
  assert.deepEqual([SM.parseWishes('under 120 per night').budget, SM.parseWishes('under 120 per night').mode], [120, 'night']);
  assert.deepEqual([SM.parseWishes('up to 900 in total').budget, SM.parseWishes('up to 900 in total').mode], [900, 'total']);
  assert.equal(SM.parseWishes('max 80 € per person').mode, 'pp');
  const w = SM.interestsToWeights('museums, parks, no bars, good food, subway').w;
  assert.deepEqual([w.sights, w.chill, w.party, w.food, w.transit], [1, 1, -0.6, 1, 1]);
  // Deutsch unverändert
  assert.deepEqual(SM.parseGroup('Lena Party, Tom Familie').map(p => p.type), ['party', 'family']);
  assert.equal(SM.parseWishes('ruhig unter 120 pro Nacht').mode, 'night');
});

test('scoring: LABELS und Kategorien folgen der Sprache', () => {
  lang('de'); assert.deepEqual(SM.LABELS.party, ['🍸', 'Bars/Clubs']);
  lang('en'); assert.deepEqual([...SM.LABELS.party], ['🍸', 'Bars/clubs']);
  assert.equal(SM.breakdown({ party: 1 }, { party: 1 })[0].label, 'Nightlife');
  lang('de'); assert.equal(SM.breakdown({ party: 1 }, { party: 1 })[0].label, 'Party');
});
