// Runde 4: reine Logik des Plugins (Stichworte, Sammlung, Preis pro Person, Vergleich, Teilen, Diagnose)
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
require('../extension/pool.js');
const { StayMatchParse: P, StayMatchRank: R, StayMatchHints: H, StayMatchPool: POOL } = globalThis;
const { JSDOM } = require('./helpers/dom.js');

test('Stichworte: Warnungen aus Bewertungen (Treppen, Aufzug, Reinigungsgebühr, laut)', () => {
  const h = H.reviewHints('Sehr steile Treppen bis in den 5. Stock. Kein Aufzug. Die Reinigungsgebühr war hoch. Nachts sehr laut. Wohnung war sauber.');
  assert.ok(h.includes('⚠️ Treppen'), h.join('|'));
  assert.ok(h.includes('⚠️ kein Aufzug'));
  assert.ok(h.includes('⚠️ Reinigungsgebühr hoch'));
  assert.ok(h.includes('⚠️ laut'));
  assert.ok(h.includes('👍 sauber'));
  assert.deepEqual(H.warnings(h).length, 4);
});

test('Stichworte: Verneinung dreht um, "kein Aufzug" bleibt eine Warnung', () => {
  assert.deepEqual(H.reviewHints('Es war überhaupt nicht laut.'), ['👍 nicht laut']);
  assert.deepEqual(H.reviewHints('Not very clean at all.'), ['⚠️ nicht sauber']);
  assert.deepEqual(H.reviewHints('There was no elevator.'), ['⚠️ kein Aufzug']);
  assert.deepEqual(H.reviewHints('Die Reinigungsgebühr ist okay, Zentralheizung vorhanden, cleaning fee included.'), []);
  assert.deepEqual(H.reviewHints(''), []);
});

test('Stichworte: Zählung bei Wiederholung', () => {
  const h = H.reviewHints('Sehr laut. Wirklich laut!\nLärm bis Mitternacht.');
  assert.deepEqual(h, ['⚠️ laut (3×)']);
});

test('Sammlung: Seiten- und Kartenparameter ändern den Schlüssel nicht, Datum schon', () => {
  const a = 'https://www.airbnb.de/s/Barcelona/homes?checkin=2026-05-01&checkout=2026-05-05&adults=4';
  const b = a + '&items_offset=18&cursor=abc&ne_lat=1&ne_lng=2&zoom=14';
  assert.equal(POOL.poolKey(a), POOL.poolKey(b));
  assert.notEqual(POOL.poolKey(a), POOL.poolKey(a.replace('05-05', '05-06')));
  assert.equal(POOL.pageOf(a), '0');
  assert.equal(POOL.pageOf(b), '18');
});

test('Sammlung: mehrere Seiten werden vereinigt, neue Suche und Ablauf setzen zurück', () => {
  const u1 = 'https://www.airbnb.de/s/X/homes?adults=2', u2 = u1 + '&items_offset=18';
  const L = (id, extra = {}) => ({ id, title: 't' + id, totalPrice: 100, reviewTexts: 'x', ...extra });
  let p = POOL.mergePool(null, u1, [L('1'), L('2')], 1000);
  p = POOL.mergePool(p, u2, [L('3'), L('2', { totalPrice: 120 })], 2000);
  assert.deepEqual(p.pages, ['0', '18']);
  assert.deepEqual(Object.keys(p.items).sort(), ['1', '2', '3']);
  assert.equal(p.items['2'].totalPrice, 120, 'neuester Stand gewinnt');
  assert.equal(p.items['1'].reviewTexts, undefined, 'nur nötige Felder gespeichert');
  assert.equal(POOL.mergePool(null, 'https://www.airbnb.de/s/x?checkin=2026-12-09', [L(1, { image: 'https://a/b.jpg' })]).items['1'].image, 'https://a/b.jpg', 'Foto bleibt erhalten');
  assert.equal(POOL.mergePool(p, u1.replace('adults=2', 'adults=3'), [L('9')], 3000).pages.length, 1);
  assert.deepEqual(Object.keys(POOL.mergePool(p, u2, [L('9')], 2000 + POOL.TTL + 5).items), ['9']);
});

test('Sammlung: Obergrenze verwirft alte Einträge, nie die aktuelle Seite', () => {
  const u = 'https://www.airbnb.de/s/X/homes?adults=2';
  const many = n => Array.from({ length: n }, (_, i) => ({ id: 'a' + i }));
  let p = POOL.mergePool(null, u, many(POOL.MAX), 1);
  p = POOL.mergePool(p, u + '&items_offset=18', [{ id: 'new1' }, { id: 'new2' }], 2);
  assert.equal(Object.keys(p.items).length, POOL.MAX);
  assert.ok(p.items.new1 && p.items.new2);
});

const base = { id: '1', title: 'A', rating: 4.9, reviewCount: 200, beds: 4, bedrooms: 2, currency: '€' };

test('Preis pro Person und Nacht: Gesamtpreis und Preis pro Nacht', () => {
  const ctx = { people: 4, nights: 4, budget: 2400 };
  const ppn = (l, c) => R.scoreListing({ ...base, ...l }, c).ppn;
  assert.deepEqual(ppn({ totalPrice: 800, isTotal: true }, ctx), { night: 200, person: 50 });
  assert.deepEqual(ppn({ totalPrice: 200, isTotal: false }, ctx), { night: 200, person: 50 });
  assert.deepEqual(ppn({ totalPrice: 800, isTotal: true }, { people: 4 }), { night: null, person: null });
  assert.deepEqual(ppn({ totalPrice: 800, isTotal: true }, { nights: 4, people: 1 }), { night: 200, person: null }, 'eine Person: kein Preis pro Person');
  const r = R.scoreListing({ ...base, totalPrice: 800, isTotal: true }, ctx);
  assert.equal(r.ppn.person, 50);
  assert.equal(r.stay, 800);
});

test('Preis pro Nacht ohne bekannte Nächte wird nicht mit dem Gesamtbudget verglichen', () => {
  const r = R.scoreListing({ ...base, totalPrice: 150, isTotal: false }, { people: 4, budget: 1000 });
  assert.equal(r.parts.price, null);
  assert.equal(r.ppn.person, 38);
  assert.equal(r.stay, null);
});

test('Warnstichworte aus früheren Besuchen senken die Wertung und erscheinen als Warnung', () => {
  const l = { ...base, totalPrice: 800, isTotal: true };
  const plain = R.scoreListing(l, { people: 4, nights: 4, budget: 2400 });
  const known = new Map([['1', { hints: ['👍 sauber', '⚠️ Treppen', '⚠️ laut (2×)'] }]]);
  const warned = R.scoreListing(l, { people: 4, nights: 4, budget: 2400, known });
  assert.equal(warned.score, plain.score - 7); // R7: gestaffelt: Treppen 1× = 3, laut 2× = 4
  assert.ok(warned.warn.some(w => w.includes('Treppen')));
  assert.ok(warned.warn.some(w => w.includes('laut')));
  assert.equal(R.scoreListing(l, { people: 4, nights: 4, budget: 2400, known: new Map([['1', { hints: ['👍 sauber'] }]]) }).score, plain.score);
});

test('Vergleichstabelle: eine Spalte je Unterkunft, fehlende Werte als Strich', () => {
  const ctx = { people: 4, nights: 4, budget: 2400 };
  const top = R.rankListings([
    { ...base, id: '1', totalPrice: 800, isTotal: true, badges: ['Superhost'] },
    { id: '2', title: 'B', totalPrice: 600, isTotal: true, locality: 'Gràcia' },
  ], ctx);
  const rows = R.compareRows(top, ctx);
  const row = l => rows.find(r => r.label === l).cells;
  assert.equal(rows[0].cells.length, 2);
  const byId = id => top.findIndex(l => l.id === id);
  assert.equal(row('pro Person/Nacht')[byId('1')], '50 €');
  assert.equal(row('Sterne')[byId('2')], 'neu');
  assert.equal(row('Betten')[byId('2')], '–');
  assert.equal(row('Auszeichnung')[byId('1')], 'Superhost'); // R7: Zeile heißt jetzt Auszeichnung
  assert.equal(row('Viertel')[byId('2')], 'Gràcia');
});

test('Teilen: Text mit Titel, Eckdaten und Link, ohne Notiz-Zeile wenn leer', () => {
  const ctx = { people: 4, nights: 4 };
  const [a] = R.rankListings([{ ...base, totalPrice: 800, isTotal: true, locality: 'Gràcia' }], ctx);
  const t = R.shareText([{ ...a, score: a.rank.score, url: 'https://www.airbnb.de/rooms/1?adults=4', note: 'Balkon' }, { id: '2', title: 'Zweite' }], { title: 'Kopf', sub: '4 Personen', notes: true }); // R7: Notizen nur auf Wunsch
  const lines = t.split('\n');
  assert.equal(lines[0], 'Kopf');
  assert.equal(lines[1], '4 Personen');
  assert.ok(t.includes('1. A – Gràcia · ⭐ 4,9'));
  assert.ok(t.includes('800 € gesamt · 50 € p. P./Nacht'));
  assert.ok(t.includes('Notiz: Balkon'));
  assert.ok(t.includes('https://www.airbnb.de/rooms/1?adults=4'));
  assert.ok(t.includes('2. Zweite'));
  assert.ok(!t.includes('undefined') && !t.includes('null'));
});

test('Diagnose: Seitenzustand fehlt / Struktur anders / ok, Karten und Links werden gezählt', { skip: !JSDOM && 'jsdom nicht installiert (npm install --prefix tests)' }, () => {
  const doc = html => new JSDOM(html).window.document;
  let d = P.diagnose(doc('<body><a href="/rooms/123">x</a><a href="/rooms/plus/456">y</a><a href="/rooms/123">z</a></body>'));
  assert.deepEqual([d.stateNote, d.cards, d.roomLinks], ['fehlt', 0, 2]);
  assert.match(P.diagnosisText(d), /Seitenaufbau/);
  d = P.diagnose(doc('<script id="data-deferred-state-0">{"niobeClientData":[[0,{"data":{"foo":1}}]]}</script>'));
  assert.equal(d.stateNote, 'Struktur anders als erwartet');
  d = P.diagnose(doc('<script id="data-deferred-state-0">{kaputt</script>'));
  assert.equal(d.stateNote, 'kein gültiges JSON');
  d = P.diagnose(doc('<body></body>'));
  assert.match(P.diagnosisText(d), /Keine Unterkünfte gefunden/);
});

test('Qualität: zählt fehlende Felder', () => {
  const q = P.quality([{ totalPrice: 1, rating: 4 }, { rating: 4, beds: 2 }, {}]);
  assert.deepEqual(q, { n: 3, noPrice: 2, noRating: 1, noBeds: 2, noTitle: 0, noCoords: 0 });
});
