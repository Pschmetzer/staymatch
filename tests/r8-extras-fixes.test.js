// Runde 8: Fehltreffer in extras.js (Ausstattungs-Regexe, Saison, Budget, Links). Synthetische Texte.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/extras.js');
const { StayMatchExtras: X, StayMatchCore: C } = globalThis;
const F = X.FEATURES;

test('Backofen: „four bedrooms“ kein Ofen, französisches „le four“ schon', () => {
  assert.equal(F.oven.test('Sleeps eight, four bedrooms and a garden'), false);
  assert.equal(F.oven.test('four guests, four bathrooms'), false);
  assert.equal(F.oven.test('cuisine avec le four et un frigo'), true);
  assert.equal(F.oven.test('Backofen und Herd'), true);
  assert.equal(F.oven.test('electric oven'), true);
});
test('Herd: Wortgrenze', () => {
  assert.equal(F.stove.test("Shepherd's Bush, 5 min zur U-Bahn"), false);
  assert.equal(F.stove.test('Die Herde grast nebenan'), false);
  assert.equal(F.stove.test('Herd mit vier Platten'), true);
});
test('Arbeitsplatz: „Front desk“ zählt nicht', () => {
  assert.equal(F.workspace.test('24h front desk, reception desk'), false);
  assert.equal(F.workspace.test('Large desk and chair'), true);
  assert.equal(F.workspace.test('Schreibtisch am Fenster'), true);
});
test('Kamin: spanisch „camino“ (Weg) kein Kamin', () => {
  assert.equal(F.fireplace.test('Está en el Camino de Santiago'), false);
  assert.equal(F.fireplace.test('Kamin im Wohnzimmer'), true);
  assert.equal(F.fireplace.test('caminetto acceso'), true);
});

test('Fläche: Grundstück/Garten nicht als Wohnfläche', () => {
  assert.equal(X.area('Haus mit 100 m² Wohnfläche auf 800 m² Grundstück'), 100);
  assert.equal(X.area('Grundstück: 800 m², Haus 120 m²'), 120);
  assert.equal(X.area('Garten von 300 m² und Wohnung 70 m²'), 70);
  assert.equal(X.area('Plot of 500 sq m'), null);
  assert.equal(X.area('Wohnung 65 m² im 3. Stock'), 65);
});

test('Wünsche aus Satz: Budget nicht aus Personen/Minuten', () => {
  assert.equal(X.wishesFromSentence('bis 10 Personen').budgetNight, null);
  assert.equal(X.wishesFromSentence('max 20 Minuten zum Strand').budgetNight, null);
  assert.equal(X.wishesFromSentence('unter 120').budgetNight, 120);
  assert.equal(X.wishesFromSentence('bis 80 €').budgetNight, 80);
  assert.equal(X.wishesFromSentence('bis 10 Personen unter 150 euro').budgetNight, 150);
});

test('contactLike: Buchungsnummern/Daten kein Kontakt, Telefon schon', () => {
  assert.equal(X.contactLike('Buchung 0512 2026 bestätigt'), false);
  assert.equal(X.contactLike('Anreise 05.12.2026'), false);
  assert.equal(X.contactLike('Ruf an: 0171 1234567'), true);
  assert.equal(X.contactLike('+49 171 1234567'), true);
  assert.equal(X.contactLike('mail me@example.com'), true);
});

test('linkCheck: abnb.me und weitere Landesdomains sind echt', () => {
  assert.equal(X.linkCheck('https://abnb.me/abc', C.AIRBNB_DOMAINS).ok, true);
  assert.equal(X.linkCheck('https://www.airbnb.hu/rooms/1', C.AIRBNB_DOMAINS).ok, true);
  assert.equal(X.linkCheck('https://www.airbnb.co.in/rooms/1', C.AIRBNB_DOMAINS).ok, true);
  assert.equal(X.linkCheck('https://abnb.me.evil.com/x', C.AIRBNB_DOMAINS).ok, false);
  assert.match(X.linkCheck('https://airbnb-secure-pay.com/x', C.AIRBNB_DOMAINS).text, /KEINE/);
});

test('Vorjahresvergleich: Stadt aus Pfad, „San Sebastián“ nicht nur „san“', () => {
  const booked = [
    { booked: { checkin: '2025-08-01' }, pricePerNight: 100, currency: '€', city: 'San Sebastián' },
    { booked: { checkin: '2025-08-01' }, pricePerNight: 70, currency: '€', city: 'San Francisco' },
  ];
  const t = X.lastYear(booked, '/s/San-Sebastián--Spanien/homes', 120, '€');
  assert.match(t, /100/);
  assert.equal(X.lastYear([booked[1]], '/s/San-Sebastián--Spanien/homes', 120, '€'), null);
  assert.match(X.lastYear(booked, '/s/Berlin--Deutschland/homes', 120, '€') || 'x', /x/);
});

test('Saison: Tropen ohne „kalte Jahreszeit“, Südhalbkugel gespiegelt', () => {
  const x = { features: { pool: true }, amenRead: true };
  const has = (lat, checkin) => X.roomNotes(x, { lat, checkin, nights: 3 }).info.some(i => /kalten Jahreszeit/.test(i));
  assert.equal(has(-8.4, '2026-12-20'), false);   // Bali
  assert.equal(has(15, '2026-12-20'), false);     // Thailand
  assert.equal(has(28.3, '2026-01-10'), false);   // Kanaren
  assert.equal(has(48, '2026-12-20'), true);      // Mitteleuropa
  assert.equal(has(-34, '2026-07-10'), true);     // Sydney im Juli
  assert.equal(has(-34, '2026-12-20'), false);    // Sydney im Dezember
  assert.equal(X.isColdSeason(-8, 12), false);
  assert.equal(X.isColdSeason(-34, 7), true);
  assert.equal(X.isColdSeason(52, 1), true);
  assert.equal(X.isColdSeason(null, 11), true);
  assert.equal(X.isColdSeason(null, 7), false);
});

test('Werbewörter: Anteil statt Anzahl, Hinweis nur bei hoher Dichte', () => {
  const long = 'Ein Haus mit atemberaubend, einzigartig, traumhaft, wunderschön. ' + 'Normaler Text. '.repeat(120);
  const dense = 'atemberaubend einzigartig traumhaft wunderschön Oase Paradies Juwel';
  const note = t => X.roomNotes({ superlatives: X.superlatives(t) }, {}).info.some(i => /Werbewörter/.test(i));
  assert.equal(note(long), false);
  assert.equal(note(dense), true);
});

test('Gastgeber-Hinweis: neutral statt „Fake?“', () => {
  const w = X.roomNotes({ host: { listings: 12 } }, { hostSince: String(new Date().getFullYear()) }).warn.join(' ');
  assert.match(w, /viele Inserate, neues Konto/);
  assert.doesNotMatch(w, /Fake/);
});
