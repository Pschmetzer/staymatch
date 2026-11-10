// Runde 5, Paket „Plugin-Parser und Ranking“ (R5-79 bis R5-112). Nur synthetische Beispieltexte;
// wie Airbnb die Texte wirklich schreibt, ist hier NICHT geprüft.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/parse.js');
const P = globalThis.StayMatchParse;
const R = require('../extension/rank.js') && globalThis.StayMatchRank;

test('R5-79: Währungen R$, MX$, ¥, SEK, lei', () => {
  assert.equal(P.currency('R$ 350'), 'R$');
  assert.equal(P.currency('MX$ 2.400'), 'MX$');
  assert.equal(P.currency('120 SEK'), 'SEK');
  assert.equal(P.currency('450 lei'), 'lei');
  assert.equal(P.currency('¥12.000'), '¥');
  assert.equal(P.num('R$ 1.350'), 1350);
});

test('R5-80: durchgestrichener Preis gewinnt nicht', () => {
  assert.equal(P.priceOf('896 € 702 €').amount, 702);
  assert.equal(P.priceOf('702 € Gesamtpreis, ursprünglich 896 €').amount, 702);
  assert.equal(P.priceOf('120 € pro Nacht').amount, 120);
});

test('R5-81: „Nicht verfügbar“ ist kein Mehrfachangebot', () => {
  assert.equal(P.isMultiUnit('Nicht verfügbar'), false);
  assert.equal(P.isMultiUnit('3 Wohnungen verfügbar'), true);
  assert.equal(P.isMultiUnit('Not available'), false);
});

test('R5-82: Einheiten und Bewertungswort in weiteren Sprachen', () => {
  assert.ok(P.TOTAL_RE.test('€ 640 i alt'));
  assert.ok(P.TOTAL_RE.test('σύνολο 640 €'));
  assert.deepEqual(P.rating('4,8 · 12 avaliações'), { value: 4.8, count: 12 });
  assert.deepEqual(P.rating('4,8 · 12 değerlendirme'), { value: 4.8, count: 12 });
});

test('R5-84: Anzahl mit geschütztem Leerzeichen; Sterne aus aria-label', () => {
  assert.deepEqual(P.rating('4,92 (1 234)'), { value: 4.92, count: 1234 });
  assert.equal(P.ratingFromAria('4,92 von 5 Sternen'), 4.92);
  assert.equal(P.ratingFromAria('Note moyenne de 4,8 sur 5'), 4.8);
});

test('R5-85: „Neu“ ist erkennbar', () => {
  assert.equal(P.isNewLabel('Neu'), true);
  assert.equal(P.isNewLabel('4,9 (3)'), false);
});

test('R5-86/87: Bäder, Betten, mehr Sprachen, Kinderbett zählt nicht', () => {
  assert.equal(P.details(['1 gemeinsames Bad']).baths, 1);
  assert.equal(P.details(['1 Privatbad']).baths, 1);
  assert.equal(P.details(['2 slaapkamers', '3 bedden', '1 badkamer']).bedrooms, 2);
  assert.equal(P.details(['2 slaapkamers', '3 bedden', '1 badkamer']).beds, 3);
  assert.equal(P.details(['2 slaapkamers', '3 bedden', '1 badkamer']).baths, 1);
  assert.equal(P.details(['1 Queensize-Bett']).beds, 1);
  assert.equal(P.detailsExt(['1 Queensize-Bett', '1 Kinderbett']).sleeps, 2);
  assert.equal(P.details(['2 Betten', '1 Kinderbett']).beds, 2);
});

test('R5-88: Viertel auch mit Komma im Titel', () => {
  assert.equal(P.localityFromTitle('Wohnung in Gràcia, Barcelona'), 'Gràcia');
  assert.equal(P.localityFromTitle('Zimmer im Zentrum in Rom'), 'Rom');
});

test('R5-89/90: State rekursiv in beliebigem Block, Base64URL ohne Padding', () => {
  const id = Buffer.from('DemandStayListing:12345').toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(P.decodeId(id), '12345');
  const obj = { a: [{ x: { staysSearch: { results: { searchResults: [1] } } } }] };
  assert.deepEqual(P.findKey(obj, 'staysSearch'), { results: { searchResults: [1] } });
  const els = [{ textContent: '{"other":1}' }, { textContent: JSON.stringify({ deep: { presentation: { staysSearch: { results: { searchResults: [{ propertyId: 'p1', demandStayListing: { id } }] } } } } }) }];
  const doc = { querySelectorAll: sel => (sel.startsWith('script[id^') ? els : []), getElementById: () => null };
  const out = P.fromState(doc);
  assert.equal(out.length, 1); assert.equal(out[0].id, '12345');
});

test('R5-91/92: Suchparameter ohne NaN, Kinder, flexible Daten', () => {
  const sp = P.searchParams('https://www.airbnb.de/s/x/homes?checkin=kaputt&checkout=2026-12-11&adults=2&children=2&infants=1&pets=1');
  assert.equal(sp.nights, null);
  assert.deepEqual([sp.children, sp.infants, sp.pets], [2, 1, 1]);
  assert.equal(P.searchParams('https://www.airbnb.de/s/x/homes?monthly_length=3&monthly_start_date=2026-12-01').flexible, true);
  assert.equal(P.searchParams('https://www.airbnb.de/s/x/homes?date_picker_type=flexible_dates').flexible, true);
});

test('R5-95: Badge-Art aus loggingContext, sonst fremdsprachiger Text', () => {
  assert.equal(P.normBadge({ text: 'Coup de cœur voyageurs' }), 'Gäste-Favorit');
  assert.equal(P.normBadge({ text: 'Preferito dagli ospiti' }), 'Gäste-Favorit');
  assert.equal(P.normBadge({ text: 'irgendwas', loggingContext: { badgeType: 'GUEST_FAVORITE' } }), 'Gäste-Favorit');
  assert.equal(P.normBadge({ text: 'x', loggingContext: { badgeType: 'SUPERHOST' } }), 'Superhost');
  assert.equal(P.normBadge({ text: 'Neu' }), 'Neu');
});

test('R5-96: Ruhezeit und Betrugs-Regex', () => {
  assert.deepEqual(P.houseRules('Ruhezeiten 22:00 bis 08:00').quietHours, { from: 22, to: 8 });
  assert.equal(P.houseRules('Quiet hours 22:00 to 08:00').quietHours.to, 8);
  assert.deepEqual(P.scamSignals('Das Signal vom Bahnhof ist gut, Telefon auf dem Tisch.'), []);
  assert.equal(P.scamSignals('Schreib mir per Signal oder WhatsApp.').length, 1);
});

test('R5-97: nur https-Bilder', () => {
  const doc = {
    querySelectorAll: s => (s === '[data-testid="card-container"]' ? [{
      querySelector: q => (q === 'img' ? { src: 'data:image/gif;base64,AAAA' } : q === 'a[href*="/rooms/"]' ? { getAttribute: () => '/rooms/9' } : null),
      querySelectorAll: () => [], innerText: 'Wohnung\n100 € pro Nacht',
    }] : []),
    getElementById: () => null,
  };
  assert.equal(P.fromCards(doc)[0].image, null);
});

test('R5-98: fehlender DOM-Preis → State-Preis als veraltet markiert', () => {
  const id = Buffer.from('DemandStayListing:7').toString('base64');
  const state = { textContent: JSON.stringify({ x: { staysSearch: { results: { searchResults: [{ propertyId: '7', demandStayListing: { id }, structuredDisplayPrice: { primaryLine: { accessibilityLabel: '500 € Gesamtpreis' } } }] } } } }) };
  const card = { querySelector: q => (q === 'a[href*="/rooms/"]' ? { getAttribute: () => '/rooms/7' } : null), querySelectorAll: () => [], innerText: 'Wohnung\nNeu' };
  const doc = { querySelectorAll: s => (s.startsWith('script') ? [state] : s === '[data-testid="card-container"]' ? [card] : []), getElementById: () => null };
  const l = P.parseSearch(doc)[0];
  assert.equal(l.totalPrice, 500); assert.equal(l.priceStale, true); assert.equal(l.isNew, true);
});

// ---- Ranking ----
const L = (o = {}) => ({ id: 'a', rating: 4.8, reviewCount: 100, totalPrice: 600, currency: '€', isTotal: true, beds: 4, badges: [], ...o });

test('R5-100: Budget in €, Preis in £: Preisteil ausgesetzt', () => {
  const r = R.scoreListing(L({ currency: '£' }), { people: 2, nights: 4, budget: 800, budgetCurrency: '€' });
  assert.equal(r.parts.price, null);
  assert.ok(r.warn.some(w => /Budget in €/.test(w)));
  assert.notEqual(R.scoreListing(L(), { people: 2, nights: 4, budget: 800, budgetCurrency: '€' }).parts.price, null);
});

test('R5-101: Airbnb-Gästezahl hat Vorrang und meldet Abweichung', () => {
  const r = R.scoreListing(L({ beds: 2 }), { people: 2, adults: 4, nights: 4, budget: 800 });
  assert.equal(r.people, 4); assert.ok(r.warn.some(w => /Airbnb zeigt 4 Gäste/.test(w)));
});

test('R5-83: Preis ohne Einheitswort, der zu Nächte × Median passt, gilt als Gesamtpreis', () => {
  const base = [1, 2, 3, 4].map(i => L({ id: 'k' + i, totalPrice: 100, isTotal: false, priceWord: true }));
  const odd = L({ id: 'x', totalPrice: 400, isTotal: false, priceWord: false });
  const ranked = R.rankListings([...base, odd], { people: 2, nights: 4, budget: 600 });
  const x = ranked.find(l => l.id === 'x');
  assert.equal(x.isTotal, true); assert.equal(x.unitGuessed, true);
  assert.equal(x.rank.stay, 400);
  // bekannte Einheit bleibt unangetastet
  const known = R.rankListings([...base, { ...odd, priceWord: true }], { people: 2, nights: 4, budget: 600 }).find(l => l.id === 'x');
  assert.equal(known.isTotal, false);
});

test('R5-110: Preis unter 20 % des Medians ist unplausibel und nicht bewertet', () => {
  const base = [1, 2, 3, 4].map(i => L({ id: 'k' + i, totalPrice: 500 }));
  const x = R.rankListings([...base, L({ id: 'x', totalPrice: 30 })], { people: 2, nights: 4, budget: 800 }).find(l => l.id === 'x');
  assert.equal(x.priceImplausible, true); assert.equal(x.rank.parts.price, null);
});

test('R5-85: „neu“ und „nicht gelesen“ werden unterschieden', () => {
  const n = R.scoreListing(L({ rating: null, reviewCount: null, isNew: true }), { people: 2 });
  const u = R.scoreListing(L({ rating: null, reviewCount: null }), { people: 2 });
  assert.ok(n.warn.includes('neu, noch keine Bewertungen'));
  assert.ok(u.warn.includes('Bewertung nicht gelesen'));
});

test('R5-106: Paar mit einem Bett ist ok; Singular', () => {
  assert.equal(R.bedScore({ beds: 1 }, 2), 1);
  assert.equal(R.bedScore({ beds: 1 }, 3), 0.25);
  const r = R.scoreListing(L({ beds: 1 }), { people: 3, nights: 4 });
  assert.ok(r.warn.some(w => /1 Bett für 3/.test(w)), r.warn.join('|'));
});

test('R5-107: Favorit zählt nicht doppelt', () => {
  const a = R.scoreListing(L({ badges: ['Gäste-Favorit'] }), { people: 2 }).score;
  assert.equal(a, R.scoreListing(L(), { people: 2 }).score);
});

test('R5-108: „Entire rental unit“ zählt als ganze Unterkunft', () => {
  for (const k of ['Entire rental unit', 'Logement entier', 'Intero appartamento']) assert.equal(R.WISHES.whole.check({ kind: k }), true, k);
});

test('R5-99: Befunde der Unterkunftsseite fließen ins Ranking der Suche', () => {
  const known = new Map([['a', { scamSignals: ['Kontakt außerhalb der Plattform (Messenger) erwähnt'] }]]);
  const r = R.scoreListing(L(), { people: 2, known });
  assert.ok(r.warn.some(w => /Messenger/.test(w)));
});

test('R5-102: buildTaste rechnet je Währung', () => {
  const t = R.buildTaste([{ vote: 1, pricePerNight: 100, currency: '€' }, { vote: 1, pricePerNight: 900, currency: 'kr' }]);
  assert.equal(t.avgPricePerNightByCurrency['€'], 100); assert.equal(t.avgPricePerNightByCurrency.kr, 900);
});
