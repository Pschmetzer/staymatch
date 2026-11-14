// Runde 8: Parser, Ranking und Hinweise (Code-Prüfung). Nur synthetische Beispieltexte.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
const P = globalThis.StayMatchParse, R = globalThis.StayMatchRank, H = globalThis.StayMatchHints;

const cardDoc = (text, price) => ({
  querySelectorAll: s => s === '[data-testid="card-container"]' ? [{
    querySelector: q => q.includes('/rooms/') ? { getAttribute: () => '/rooms/5' } : q.includes('price-availability-row') ? { innerText: price || '' } : null,
    querySelectorAll: () => [], innerText: text, }] : [],
  getElementById: () => null,
});

test('Preiszeile mit Nacht- und Gesamtpreis: Einheit gilt für den ersten Betrag', () => {
  const [a] = P.parseSearch(cardDoc('Wohnung', '120 € pro Nacht · 480 € insgesamt'));
  assert.equal(a.totalPrice, 120); assert.equal(a.isTotal, false);
  assert.equal(a.nightPrice, 120); assert.equal(a.allTotal, 480);
  const [b] = P.parseSearch(cardDoc('Wohnung', '480 € insgesamt · 120 € pro Nacht'));
  assert.equal(b.totalPrice, 480); assert.equal(b.isTotal, true);
  const [c] = P.parseSearch(cardDoc('Wohnung', '702 € insgesamt'));
  assert.equal(c.isTotal, true);
});

test('Ausstattung: Verneinung, „ac“ in Fremdtext, Großschreibung AC', () => {
  assert.equal(P.amenities('Kein WLAN').wifi, false);
  assert.equal(P.amenities('Küche, ohne Parkplatz').parking, false);
  assert.equal(P.amenities('Küche, ohne Parkplatz').kitchen, true);
  assert.equal(P.amenities('No wifi, free parking').wifi, false);
  assert.equal(P.amenities('WLAN vorhanden').wifi, true);
  assert.equal(P.amenities('Pool nicht vorhanden').pool, false);
  assert.equal(P.amenities('Bilder von Pac und Mac').ac, false);
  assert.equal(P.amenities('AC, Küche').ac, true);
  assert.equal(P.amenities('A/C').ac, true);
});

test('Mehrfachangebot: „3 Nächte verfügbar“ nicht, „3 Wohnungen verfügbar“ ja', () => {
  assert.equal(P.isMultiUnit('3 Nächte verfügbar'), false);
  assert.equal(P.isMultiUnit('5 days available'), false);
  assert.equal(P.isMultiUnit('3 freie Nächte verfügbar'), false);
  assert.equal(P.isMultiUnit('3 Wohnungen verfügbar'), true);
});

test('Ruhezeit: Einzelbuchstaben-Trennwort nur als eigenes Wort', () => {
  assert.deepEqual(P.houseRules('Ruhezeit 22 Uhr a 8 Uhr').quietHours, { from: 22, to: 8 });
  assert.deepEqual(P.houseRules('Quiet hours 10 pm to 8 am').quietHours, { from: 22, to: 8 });
  // „Ruhezeit 22 Uhr ab 8“: kein Trennwort → nur Hinweis, keine erfundene Zeitspanne
  assert.equal(P.houseRules('Ruhezeit 22 Uhr abends 8 Gäste').quietHours, true);
});

test('Sternezeile: zwei Zeilen und „★“ davor', () => {
  const two = P.fromCards(cardDoc('Wohnung\n4,92\n(123)\nBarcelona', '100 € pro Nacht'))[0];
  assert.equal(two.rating, 4.92); assert.equal(two.reviewCount, 123);
  const star = P.fromCards(cardDoc('Wohnung\n★ 4,85 (40)', '100 € pro Nacht'))[0];
  assert.equal(star.rating, 4.85); assert.equal(star.reviewCount, 40);
  const one = P.fromCards(cardDoc('Wohnung\n4,59 (800)', '100 € pro Nacht'))[0];
  assert.equal(one.rating, 4.59);
});

test('Scam: Messenger allein nur Info, mit Zahlung stark', () => {
  assert.deepEqual(P.scamSignals('Gern auch per WhatsApp.'), []);
  assert.equal(P.scamInfos('Gern auch per WhatsApp.').length, 1);
  assert.ok(P.scamSignals('Zahlung per WhatsApp möglich').length >= 1);
});

test('State-Cache: gleicher Inhalt wird nicht neu geparst, geänderter schon', () => {
  const b64 = s => Buffer.from(s).toString('base64');
  const mk = price => ({ textContent: JSON.stringify({ staysSearch: { results: { searchResults: [{ demandStayListing: { id: b64('DemandStayListing:1') }, structuredDisplayPrice: { primaryLine: { accessibilityLabel: `${price} € pro Nacht` } } }] } } }) });
  const doc = els => ({ querySelectorAll: s => s.startsWith('script') ? els : [], getElementById: () => null });
  assert.equal(P.fromState(doc([mk(100)]))[0].totalPrice, 100);
  assert.equal(P.fromState(doc([mk(100)]))[0].totalPrice, 100);
  assert.equal(P.fromState(doc([mk(250)]))[0].totalPrice, 250);
});

test('Betten: ein Paar mit „1 Einzelbett“ bekommt nicht 1,0; Doppelbett schon', () => {
  assert.equal(R.bedScore({ beds: 1, sleeps: 1, bedKinds: { single: 1 } }, 2), 0.25);
  assert.equal(R.bedScore({ beds: 1, sleeps: 2, bedKinds: { double: 1 } }, 2), 1);
  assert.equal(R.bedScore({ beds: 1 }, 2), 1); // Art unbekannt: ein Paar teilt sich ein Bett
});

test('Schlafsofa zählt in Wertung und Preis je Schlafplatz gleich (halb)', () => {
  // 1 Doppelbett + 1 Schlafsofa = 2,5 Plätze: für 3 Personen 0,65, nicht 1
  const l = { beds: 2, sleeps: 3, bedKinds: { double: 1, sofa: 1 } };
  assert.equal(R.realSleeps(l), 2.5);
  assert.equal(R.bedScore(l, 3), 0.65);
  assert.equal(R.bedScore(l, 3, true), 0.25); // eigenes Bett: 1 + 0,5 Plätze für 3
});

test('Filter „im Budget“: Karte ohne Preis bleibt, zu teure fliegt raus', () => {
  const mk = (price, id) => ({ id, rank: { budgetKnown: true, parts: { price, beds: null } } });
  const out = R.filterListings([mk(null, 'a'), mk(0.9, 'b'), mk(0.2, 'c')], { inBudget: true });
  assert.deepEqual(out.map(x => x.id), ['a', 'b']);
});

test('Ganze Unterkunft: Ferienhaus, Reihenhaus, Piso, Vivienda, Flat, Cabin, Hütte', () => {
  for (const kind of ['Ferienhaus in Prag', 'Reihenhaus in Köln', 'Landhaus in Tirol', 'Piso entero en Madrid', 'Vivienda en Sevilla', 'Flat in London', 'Cabin in Aspen', 'Hütte in Tirol']) {
    assert.equal(R.WISHES.whole.check({ kind }), true, kind);
  }
});

test('Entscheidungsfrage: „Platz 1 kostet …“', () => {
  const q = R.decisionQuestions([{ rank: { stay: 500 }, currency: '€' }, { rank: { stay: 350 }, currency: '€' }]);
  assert.match(q[0], /^Platz 1 kostet 150 € mehr/);
});

test('Markdown-Export: Hosttitel mit Link-Syntax wird nicht klickbar', () => {
  const out = R.shareText([{ title: '[Zahlung](https://böse.example) *fett* _kursiv_ <b>', url: 'https://www.airbnb.de/rooms/1', rating: 4.8, score: 90 }], { markdown: true });
  assert.ok(!out.includes('[Zahlung]('));
  assert.ok(out.includes('\\[Zahlung\\]\\(https://böse.example\\)'));
  assert.ok(out.includes('[öffnen](https://www.airbnb.de/rooms/1)'));
});

test('Luxus: wird je Karte und Kontext nur einmal gerechnet, auch bei Kopie', () => {
  const ctx = { medianNight: {} };
  const a = { id: '7', kind: 'Villa mit Privatpool', title: 'x', badges: [] };
  const v1 = R.luxuryInfo(a, ctx);
  assert.equal(R.luxuryInfo({ ...a, extra: 1 }, ctx), v1);
  assert.notEqual(R.luxuryInfo(a, { medianNight: {} }), v1);
});

test('Hinweise: „2 amazing nights“ ist keine Uhrzeit; „2 am“ schon', () => {
  assert.equal(H.noiseTimes(['Es war laut, wir blieben 2 amazing nights.']), null);
  assert.equal(H.noiseTimes(['Laut bis 2 am.']), 'meist nachts');
  assert.equal(H.noiseTimes(['Müllabfuhr um 6 Uhr, laut.']), 'meist morgens');
});

test('Hinweise: Trend und Renovierung nur mit bekannter Sortierung (neueste zuerst)', () => {
  const trend = [...Array.from({ length: 10 }, () => 'Okay.'), ...Array.from({ length: 10 }, () => 'Sehr sauber.')];
  assert.equal(H.keywordTrend(trend), null);
  assert.match(H.keywordTrend(trend, 'sauber', { newestFirst: true }), /früher oft gelobt/);
  assert.equal(H.renovated(['Neu renoviert!']), false);
  assert.equal(H.renovated(['Neu renoviert!'], 5, { newestFirst: true }), true);
});

test('Hinweise: toter Code ist weg, „nicht nur sauber“ bleibt keine Verneinung', () => {
  assert.equal(H.politeFives, undefined);
  assert.equal(P.searchKey, undefined);
  assert.equal(P.mergeSearchResults, undefined);
  assert.deepEqual(H.reviewHints('Nicht nur sauber, sondern auch schön. Nicht nur sauber, sondern top.'), ['👍 sauber (2×)']);
});
