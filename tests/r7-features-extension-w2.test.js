// Runde 7 E, Welle 2: Suchseite (Preis-Tricks, Gruppen, Seiten-Auswertungen, Kopiertext). Synthetische Daten.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
require('../extension/extras.js');
const { StayMatchParse: P, StayMatchRank: R, StayMatchExtras: X } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until } = D;
test.after(D.closeAll);

const L = (id, o = {}) => ({ id, title: 'T' + id, kind: 'Wohnung in X', totalPrice: 100, isTotal: false, priceWord: true, currency: '€', rating: 4.8, reviewCount: 50, ...o });

test('R7E Parser: Nacht- und Gesamtpreis, Bettarten', () => {
  assert.deepEqual(P.bothPrices('120 € pro Nacht · 480 € gesamt'), { nightPrice: 120, allTotal: 480 });
  assert.deepEqual(P.bothPrices('480 € gesamt'), {});
  assert.deepEqual(P.detailsExt(['1 Doppelbett, 2 Einzelbetten, 1 Schlafsofa']).bedKinds, { double: 1, single: 2, sofa: 1 });
});

test('R7E Ranking: Lockpreis, Gebühren-Anteil und -Filter, Sterne relativ, Einzelbetten fürs Paar, eigenes Bett', () => {
  const list = [1, 2, 3, 4, 5, 6].map(i => L(String(i), { totalPrice: 100, rating: 4.9 }));
  list.push(L('lure', { totalPrice: 80, nightPrice: 80, allTotal: 440, rating: 4.6 }));
  const r = R.rankListings(list, { nights: 4, people: 2 });
  const lure = r.find(l => l.id === 'lure');
  assert.ok(lure.rank.warn.some(w => /Lockpreis/.test(w)));
  assert.ok(lure.rank.info.some(w => /unter dem Seitenmedian/.test(w)));
  assert.ok(Math.abs(lure.rank.feeShare - 0.2727) < 0.01);
  assert.equal(R.feeShareOf({ nightPrice: 100, allTotal: 400 }, 3), 0.25);
  assert.equal(R.filterListings([{ rank: { feeShare: 0.3 } }, { rank: { feeShare: null } }], { lowFees: true }).length, 1);
  const twin = R.scoreListing(L('s', { bedKinds: { single: 2 }, sleeps: 2 }), { people: 2 });
  assert.ok(twin.warn.some(w => /Einzelbetten/.test(w)));
  const dbl = { beds: 2, bedKinds: { double: 2 }, sleeps: 4 };
  assert.equal(R.bedScore(dbl, 4), 1);
  assert.equal(R.bedScore(dbl, 4, true), 0.25);
  assert.equal(R.realSleeps({ bedKinds: { double: 1, sofa: 2 } }), 3);
});

test('R7E Kopiertext: ohne Preise, ohne Emojis, Markdown, Preisstand, Entscheidungsfragen', () => {
  const items = [{ title: 'A ⭐', locality: 'Gràcia', rating: 4.9, score: 90, stay: 500, currency: '€', url: 'https://www.airbnb.de/rooms/1' }];
  assert.ok(!/500/.test(R.shareText(items, { noPrices: true })));
  assert.ok(!/⭐/.test(R.shareText(items, { noEmoji: true })));
  const md = R.shareText(items, { markdown: true, stamp: Date.parse('2026-11-13T14:20:00') });
  assert.match(md, /\| # \| Unterkunft \|/);
  assert.match(md, /\[öffnen\]\(https:\/\/www\.airbnb\.de\/rooms\/1\)/);
  assert.match(md, /Preise Stand 13\.11\., 14:20/);
  const top = [{ rank: { stay: 600, area: { name: 'Gràcia' } }, currency: '€', rating: 4.9, bedrooms: 3 }, { rank: { stay: 450, area: { name: 'Eixample' } }, currency: '€', rating: 4.6, bedrooms: 2 }];
  const qs = R.decisionQuestions(top);
  assert.equal(qs.length, 2);
  assert.match(qs[0], /150 € mehr/);
  assert.match(R.shareText(items, { questions: qs }), /Zum Entscheiden:\n- 1 kostet/);
});

test('R7E Seiten-Auswertung: Anker, Hebel, Zwilling, Lücke, Rabattschwelle, Links, Filter, Solo, Stern-Preis, Gesamtpreis-Schalter', () => {
  const list = Array.from({ length: 12 }, (_, i) => L(String(i), { totalPrice: 60 + i * 10, rating: 4.5 + i * 0.04, bedrooms: 1, badges: i === 6 ? ['Superhost'] : [] }));
  const ctx = { nights: 3, budgetPerNight: 110, people: 4 };
  const ranked = R.rankListings(list, ctx);
  assert.match(X.priceAnchor(ranked, ctx).text, /Mitte 115 €/);
  assert.match(X.budgetLever(ranked, ctx), /Mit 11 € mehr pro Nacht kämen 1/);
  const top = ranked.slice(0, 3);
  const g = X.gapToFirst(ranked[1], ranked[0]);
  assert.ok(g === null || /hinter Platz 1/.test(g));
  assert.match(X.gapToFirst({ rank: { score: 70, breakdown: [{ key: 'price', points: 10 }] } }, { rank: { score: 80, breakdown: [{ key: 'price', points: 20 }] } }), /10 Punkte hinter Platz 1 \(vor allem Preis -10\)/);
  assert.match(X.discountThreshold(6), /Wochenrabatt/);
  assert.match(X.discountThreshold(26), /Monatsrabatt/);
  assert.equal(X.discountThreshold(3), null);
  const links = X.shiftLinks('https://www.airbnb.de/s/X/homes?checkin=2026-05-01&checkout=2026-05-04&items_offset=18');
  assert.match(links[0].url, /checkin=2026-04-30&checkout=2026-05-03/);
  assert.ok(!/items_offset/.test(links[1].url));
  assert.match(X.filterSuggestion('https://www.airbnb.de/s/X/homes', ranked, 4).url, /min_bedrooms=2/);
  const twins = X.cheapTwins([{ id: 'a', rank: { score: 80, stay: 600 }, currency: '€' }], [{ id: 'b', title: 'Billig', rank: { score: 78, stay: 500 }, currency: '€' }]);
  assert.match(twins[0].text, /100 € günstiger/);
  assert.match(X.starPrice(ranked, ctx), /0,1 Sterne mehr kosten/);
  assert.match(X.totalSwitchHint(ranked, 3), /Gesamtpreis anzeigen/);
  const solo = [L('w', { kind: 'Wohnung in X', totalPrice: 200 }), L('z', { kind: 'Privatzimmer in X', totalPrice: 70, badges: ['Superhost'] })];
  assert.match(X.soloAlternative(solo, [solo[0]], { people: 1 }).text, /65 % günstiger/);
  assert.match(X.budgetRest({ rank: { stay: 300, parts: { price: 0.9 } } }, { budget: 400, people: 2 }), /75 % des Budgets, es bleiben 100 € \(50 € pro Person\)/);
});

test('R7E Seiten-Auswertung: Weiterblättern, Kartenecke, zwei Wohnungen, gemischte Einheiten, eigener Preisverlauf, Stabilität, Ausreißer', () => {
  const top = ['a', 'b', 'c'].map(id => ({ id, rank: { score: 80 } }));
  const pool = { pages: ['0', '18', '36'], items: { a: { id: 'a', page: '0' }, x: { id: 'x', page: '36' } } };
  assert.match(X.stopPaging(pool, [...top, { id: 'x', rank: { score: 50 } }], top), /lohnt kaum/);
  assert.equal(X.stopPaging(pool, [...top, { id: 'x', rank: { score: 85 } }], top), null);
  const pts = Array.from({ length: 15 }, (_, i) => ({ id: 'p' + i, lat: 41 + (i % 5) * 0.01, lon: 2 + Math.floor(i / 5) * 0.01 }));
  const ne = [{ lat: 41.04, lon: 2.02 }, { lat: 41.035, lon: 2.019 }, { lat: 41.03, lon: 2.015 }];
  assert.match(X.mapCorner(pts, ne), /Nordosten/);
  const flats = [{ id: 'big', sleeps: 8, rank: { stay: 1000 }, currency: '€' }, { id: 'f1', lat: 41, lon: 2, sleeps: 4, rank: { stay: 400 }, currency: '€' }, { id: 'f2', lat: 41.001, lon: 2, sleeps: 4, rank: { stay: 350 }, currency: '€' }];
  assert.match(X.twoFlats(flats, { people: 8 }).text, /zusammen 750 €, 250 € weniger/);
  assert.match(X.mixedUnits({ items: { 1: { page: '0', priceWord: true, totalPrice: 1, isTotal: true }, 2: { page: '18', priceWord: true, totalPrice: 1, isTotal: false } } }), /teils Gesamt-/);
  const log = [{ path: '/s/X', ci: '2026-05-04', nights: 2, med: 100, cur: '€' }];
  const notes = X.priceHistoryNotes(log, { path: '/s/X', ci: '2026-05-08', nights: 2, med: 180, cur: '€' });
  assert.match(notes[0], /1,8× so teuer/);
  assert.match(notes[1], /Wochenende kostet hier etwa \+80 %/);
  const list = [L('1', { totalPrice: 100, rating: 4.95 }), L('2', { totalPrice: 60, rating: 4.5 }), L('3', { totalPrice: 80, rating: 4.7 }), L('4', { totalPrice: 90, rating: 4.8 })];
  const ctx = { nights: 2, budgetPerNight: 100 };
  const r = R.rankListings(list, ctx);
  assert.ok(['Empfehlung stabil', 'Empfehlung knapp'].some(t => X.robustness(list, ctx, r.map(l => l.id)).text.startsWith(t)));
  const out = X.outlierPick([{ id: 'o', title: 'Hausboot', rating: 4.95, reviewCount: 40, rank: { score: 70, parts: { taste: 0.3 } } }], [], { taste: {} });
  assert.match(out.text, /Mal was anderes: „Hausboot“/);
});

test('R7E Suchseite: Mehr Wünsche, Mehr zu dieser Seite, ±1 Person, Gebühren-Chip, Gebucht-Banner, Ausstattungs-Wunsch aus dem Verlauf', { skip }, async () => {
  const chrome = chromeMock({ quick: { wishes: ['bathtub'], budgetNight: 150 }, 'l:222': { id: '222', title: 'Gebuchte', extra: { features: { bathtub: true }, amenRead: true }, booked: { checkin: '2026-05-01' } } });
  const { doc } = makePage({ body: searchBody(), chrome });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  const t = box.textContent;
  assert.match(t, /Für diese Daten hast du schon gebucht: Gebuchte/);
  assert.match(t, /Mehr Wünsche und Gruppe \(1 aktiv\)/);
  assert.match(t, /niedrige Gebühren/);
  assert.match(t, /Mehr zu dieser Seite/);
  assert.match(t, /Anreise einen Tag früher/);
  // Wunsch Badewanne: 222 erfüllt ihn (Seite schon geöffnet)
  const items = [...box.querySelectorAll('.item')].map(x => x.textContent);
  assert.ok(items.some(x => /T?itel 222|222/.test(x) && /✓ Badewanne/.test(x)) || /✓ Badewanne/.test(t));
  const plus = [...box.querySelectorAll('button')].find(b => b.textContent === '+1');
  plus.click();
  await until(() => chrome.data.quick.peopleDelta === 1);
  const box2 = await until(() => /Personen: 5 \(Airbnb: 4\)/.test(shadow(doc, 'sm-search')?.querySelector('.box')?.textContent || '') && shadow(doc, 'sm-search').querySelector('.box'));
  assert.ok(box2);
});
