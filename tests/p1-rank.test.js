// P1: Ranking. Eingaben selbst gebaut.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;
const L = (o = {}) => ({ id: 'a', rating: 4.8, reviewCount: 100, totalPrice: 600, currency: '€', isTotal: true, beds: 5, badges: [], ...o });

test('Nachtpreis ohne Nächtezahl: kein Preis-Teil, keine falsche „gesamt“-Beschriftung', () => {
  const r = R.scoreListing(L({ isTotal: false, totalPrice: 120 }), { people: 5, budget: 2000, nights: null });
  assert.equal(r.parts.price, null);
  assert.ok(!r.why.concat(r.warn).some(t => /gesamt/.test(t)));
  assert.ok(r.warn.some(t => /120 € pro Nacht/.test(t)));
});

test('Nachtpreis mit Nächten: Beschriftung und Pro-Kopf auf die Reisesumme', () => {
  const r = R.scoreListing(L({ isTotal: false, totalPrice: 100 }), { people: 4, budget: 800, nights: 4 });
  const t = r.why.concat(r.warn).find(x => /pro Nacht/.test(x));
  assert.match(t, /100 € pro Nacht \(400 € gesamt\) \(100 pro Person\)/);
});

test('Gesamtpreis: Text wie bisher', () => {
  const r = R.scoreListing(L(), { people: 5, budget: 1200, nights: 4 });
  assert.ok(r.why.some(t => t === '600 € gesamt (120 pro Person)'));
});

test('Budget pro Nacht × aktuelle Nächte; altes Gesamtbudget wird umgerechnet', () => {
  assert.equal(R.effectiveBudget({ budgetPerNight: 100, nights: 6 }), 600);
  assert.equal(R.effectiveBudget({ budget: 400, tripNights: 4, nights: 8 }), 800);
  assert.equal(R.effectiveBudget({ budget: 400, nights: 4 }), 400);
  assert.equal(R.effectiveBudget({}), null);
});

test('Personenzahl: adults von Airbnb gewinnt und Abweichung wird gemeldet', () => {
  const r = R.scoreListing(L({ beds: 5 }), { people: 5, adults: 6, nights: 4 });
  assert.equal(r.people, 6); assert.deepEqual(r.peopleMismatch, { trip: 5, airbnb: 6 });
  assert.ok(r.warn.some(t => /6 Gäste/.test(t)));
  assert.equal(R.resolvePeople({ people: 5 }).mismatch, null);
});

test('Betten: Schlafzimmer zählen nicht als Betten, nie „? Betten“', () => {
  assert.equal(R.bedScore({ bedrooms: 3 }, 5), null);
  const r = R.scoreListing(L({ beds: null, bedrooms: 1 }), { people: 6 });
  assert.equal(r.parts.beds, null);
  assert.ok(![...r.why, ...r.warn].some(t => t.includes('?')));
  assert.ok(r.warn.some(t => /Nur 1 Schlafzimmer für 6/.test(t)));
  assert.equal(R.bedScore({ sleeps: 5, beds: 2 }, 5), 1, 'Schlafplätze aus Doppelbetten');
});

test('Bäder, Privatzimmer, gewerblicher Gastgeber', () => {
  const r = R.scoreListing(L({ baths: 1, kind: 'Privatzimmer in Gràcia', pro: true }), { people: 6, nights: 4 });
  assert.ok(r.warn.some(t => /1 Bad für 6/.test(t)));
  assert.ok(r.warn.some(t => /Privatzimmer für 6/.test(t)));
  assert.ok(r.warn.some(t => /Gewerblich/.test(t)));
  assert.ok(r.unsuitable); assert.ok(r.unsuitableReasons.some(t => /Privatzimmer/.test(t)));
  const clean = R.scoreListing(L({ baths: 2, kind: 'Ferienwohnung in Gràcia' }), { people: 6, nights: 4 });
  assert.ok(r.score < clean.score);
  assert.equal(clean.unsuitable, false);
});

test('disliked ist ein eigenes Feld; badgeReason; breakdown', () => {
  const r = R.scoreListing(L(), { people: 5, nights: 4, budget: 1200, disliked: new Set(['a']) });
  assert.equal(r.disliked, true); assert.ok(r.score <= 20); assert.match(r.badgeReason, /👎/);
  const ok = R.scoreListing(L(), { people: 5, nights: 4, budget: 1200 });
  assert.equal(ok.disliked, false);
  assert.ok(ok.badgeReason.length > 0 && ok.badgeReason.length <= 40, ok.badgeReason);
  const sum = ok.breakdown.reduce((s, b) => s + b.points, 0);
  assert.ok(Math.abs(sum - ok.score) <= 5, `Anteile ${sum} ≈ Wert ${ok.score}`); // Abstand = Vertrauensbonus/Rundung
  assert.ok(ok.breakdown.every(b => b.share > 0 && b.share <= 1));
});

test('unsuitable: zu wenige Betten, deutlich über Budget', () => {
  const few = R.scoreListing(L({ beds: 1 }), { people: 6, nights: 4 });
  assert.equal(few.unsuitable, true); assert.match(few.unsuitableReasons[0], /Betten/);
  const dear = R.scoreListing(L({ totalPrice: 3000 }), { people: 5, nights: 4, budget: 1500 });
  assert.ok(dear.unsuitableReasons.some(t => /Budget/.test(t)));
});

test('Mehrfach-Angebot: ab-Preis ist unsicher', () => {
  const r = R.scoreListing(L({ multiUnit: true }), { people: 5, nights: 4, budget: 1200 });
  assert.equal(r.priceUncertain, true); assert.ok(r.warn.some(t => /ab“-Preis/.test(t)));
});

test('Geschmack: Preis je Nacht nicht doppelt geteilt, Profil je Währung, Median', () => {
  const taste = R.buildTaste([
    { vote: 1, pricePerNight: 100, currency: '€', rating: 4.9, locality: 'Gràcia' },
    { vote: 1, pricePerNight: 110, currency: '€', rating: 4.8 },
    { vote: 1, pricePerNight: 900, currency: 'kr', rating: 4.2 },
    { vote: 0, pricePerNight: 5 },
  ]);
  assert.equal(taste.likedCount, 3);
  assert.equal(taste.avgPricePerNightByCurrency['€'], 105);
  assert.equal(taste.avgPricePerNightByCurrency.kr, 900);
  assert.ok(Math.abs(taste.minRating - 4.75) < 1e-9, 'Median 4,8 − 0,05, nicht das Minimum 4,15');
  // Nachtpreis 100 liegt im Profil → +0,2; als Gesamtpreis über 4 Nächte (400 → 100 pro Nacht) ebenso
  const a = R.tasteScore({ totalPrice: 100, isTotal: false, nights: 4, currency: '€' }, taste);
  const b = R.tasteScore({ totalPrice: 400, isTotal: true, nights: 4, currency: '€' }, taste);
  assert.equal(a, b);
  // andere Währung ohne Profil: Preis zählt nicht
  assert.equal(R.tasteScore({ totalPrice: 100, isTotal: false, currency: 'US$' }, taste), 0.5);
  assert.equal(R.buildTaste([{ vote: -1 }]), null);
});

test('Gewichte: Betten zählen bei großen Gruppen mehr; Geschmack nicht mehr 5 %', () => {
  assert.ok(R.weightsFor(8).beds > R.weightsFor(2).beds);
  assert.ok(R.WEIGHTS.taste >= 0.1);
  for (const k of ['area', 'rating', 'price', 'beds', 'taste']) assert.equal(typeof R.WEIGHTS[k], 'number');
});

test('Namensabgleich: Teilname nur als ganzes Wort', () => {
  const areas = [{ name: 'Santa Cruz', lat: 1, lon: 1, total: 60, min: 50 }];
  assert.equal(R.areaFor({ locality: 'Sant' }, areas), null);
  assert.equal(R.areaFor({ locality: 'Barrio Santa Cruz' }, areas).total, 60);
});

test('Neuere Bewertungen zählen stärker', () => {
  const now = +new Date('2026-06-01');
  const w = R.weightedRecentRating([{ date: '2026-05-01', rating: 5 }, { date: '2022-01-01', rating: 3 }], now);
  assert.ok(w.value > 4.5);
  assert.equal(R.weightedRecentRating([], now), null);
  const old = R.scoreListing(L({ reviews: Array.from({ length: 6 }, () => ({ date: '2020-01-01', rating: 3 })) }), { people: 5 });
  const fresh = R.scoreListing(L({ reviews: Array.from({ length: 6 }, () => ({ date: new Date().toISOString(), rating: 5 })) }), { people: 5 });
  assert.ok(fresh.parts.rating > old.parts.rating);
});

test('Fake-Bewertungs-Hinweis: vorsichtig formuliert', () => {
  assert.match(R.fakeReviewHint({ rating: 5, reviewCount: 3 }), /wenig aussagekräftig/);
  assert.equal(R.fakeReviewHint({ rating: 4.8, reviewCount: 300 }), null);
  const dup = R.fakeReviewHint({ rating: 4.8, reviewCount: 30, reviewTexts: ['Toll!', 'Toll!', 'toll', 'Super Lage', 'Super Lage', 'Nett'] });
  assert.match(dup, /kein Beweis/);
});

test('filterListings', () => {
  const ctx = { people: 5, nights: 4, budget: 1000 };
  const list = R.rankListings([
    L({ id: '1', rating: 4.9, totalPrice: 600, badges: ['Superhost'] }),
    L({ id: '2', rating: 4.5, totalPrice: 600 }),
    L({ id: '3', rating: 4.9, totalPrice: 2000 }),
    L({ id: '4', rating: 4.9, beds: 1 }),
  ], ctx);
  const ids = f => R.filterListings(list, f).map(x => x.id).sort().join();
  assert.equal(ids({}), '1,2,3,4');
  assert.equal(ids({ minRating: true }), '1,3,4');
  assert.equal(ids({ inBudget: true }), '1,2,4');
  assert.equal(ids({ enoughBeds: true }), '1,2,3');
  assert.equal(ids({ favorite: true }), '1');
  // ohne Budget wirkt der Budget-Filter nicht
  const noBudget = R.rankListings([L({ id: '9' })], { people: 5, nights: 4 });
  assert.equal(R.filterListings(noBudget, { inBudget: true }).length, 1);
});

test('Eine Person: keine Betten, kein „pro Person“, Texte „für dich“; Wünsche als Teil', () => {
  const ctx = { people: 1, nights: 4, budget: 1000, wishes: ['whole', 'private', 'trusted', 'reviews'], areas: [{ name: 'Gràcia', lat: 1, lon: 1, total: 70, min: 20, minName: 'Tom' }] };
  const r = R.scoreListing(L({ kind: 'Wohnung in Gràcia', locality: 'Gràcia', beds: 1, reviewCount: 50, badges: ['Superhost'] }), ctx);
  assert.equal(r.parts.beds, null); assert.equal(r.parts.wishes, 1);
  const all = [...r.why, ...r.warn].join('|');
  assert.ok(!/pro Person|Betten|unzufrieden/.test(all), all);
  assert.match(all, /für dich/); assert.match(all, /✓ ganze Unterkunft/);
  const bad = R.scoreListing(L({ kind: 'Privatzimmer in Gràcia', pro: true, reviewCount: 5 }), ctx);
  assert.ok(bad.warn.some(t => /Wunsch nicht erfüllt: nur ein Zimmer/.test(t)));
  assert.ok(bad.warn.some(t => /gewerblicher Anbieter/.test(t)));
  assert.ok(bad.parts.wishes < 0.5 && bad.score < r.score);
  assert.equal(R.wishScore(L({ kind: 'Etwas' }), ['whole']).value, null, 'unbekannt zählt nicht');
  assert.equal(R.wishScore(L({ kind: 'Zimmer in Rom' }), ['whole']).value, 0);
});

test('Gruppe (2+) bleibt: Betten, pro Person', () => {
  const r = R.scoreListing(L(), { people: 4, nights: 4, budget: 1200 });
  assert.notEqual(r.parts.beds, null); assert.ok(r.why.some(t => /pro Person/.test(t)));
});

test('Wunsch-Stichworte aus Bewertungen', () => {
  assert.equal(R.reviewConflicts(['⚠️ mehrfach „laut“'], ['quiet']).length, 1);
  assert.deepEqual(R.reviewConflicts(['⚠️ laut'], ['clean']), []);
});
