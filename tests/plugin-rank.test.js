// Läuft mit: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;

test('Preiswertung ist stetig und fällt über dem Budget', () => {
  let prev = null;
  for (let r = 0.05; r <= 1.5; r += 0.01) {
    const s = R.priceScore(r * 1000, 1000);
    if (prev !== null) assert.ok(Math.abs(s - prev) < 0.1, `Sprung bei ${r.toFixed(2)}`);
    prev = s;
  }
  assert.ok(R.priceScore(1500, 1000) < R.priceScore(1000, 1000));
  assert.equal(R.priceScore(null, 1000), null);
});

test('Sterne: viele Bewertungen schlagen wenige', () => {
  assert.ok(R.ratingScore(4.9, 300) > R.ratingScore(5.0, 3));
  assert.equal(R.ratingScore(null, 0), null);
});

test('Betten unbekannt ist nicht 0', () => {
  assert.equal(R.bedScore({}, 5), null);
  assert.equal(R.bedScore({ beds: 5 }, 5), 1);
});

test('Namensabgleich: Artikel und Akzente egal, mehrere Teil-Viertel = Mittelwert', () => {
  const areas = [
    { name: 'Gràcia', lat: 1, lon: 1, total: 60, min: 50 },
    { name: "la Dreta de l'Eixample", lat: 2, lon: 2, total: 70, min: 60 },
    { name: "la Nova Esquerra de l'Eixample", lat: 3, lon: 3, total: 50, min: 40 },
  ];
  assert.equal(R.areaFor({ locality: 'Vila de Gracia' }, areas).total, 60);
  const e = R.areaFor({ locality: "l'Eixample" }, areas);
  assert.equal(e.total, 60); assert.equal(e.approx, true);
  assert.equal(R.areaFor({ locality: 'Sarrià' }, areas), null);
});

test('Viertel-Zuordnung: nah per Koordinate, sonst per Name', () => {
  const areas = [{ name: 'Gràcia', lat: 41.403, lon: 2.157, total: 70 }];
  assert.equal(R.areaFor({ lat: 41.404, lon: 2.158 }, areas).name, 'Gràcia');
  assert.equal(R.areaFor({ lat: 41.5, lon: 2.3, locality: 'gracia' }, areas).dist, null);
  assert.equal(R.areaFor({ lat: 41.5, lon: 2.3 }, areas), null);
});

// Direkt-Modus: Wünsche und Solo-Texte
test('Direkt-Modus: Wünsche heben passende Unterkünfte, Solo ohne Pro-Kopf', () => {
  const room = { id: 'a', kind: 'Privatzimmer in Wohnung', rating: 4.9, reviewCount: 5, totalPrice: 100, currency: '€', badges: [] };
  const flat = { id: 'b', kind: 'Wohnung', rating: 4.8, reviewCount: 80, totalPrice: 100, currency: '€', badges: ['Gäste-Favorit'] };
  const ctx = { people: 1, nights: 2, budgetPerNight: 120, wishes: ['whole', 'trusted', 'reviews'] };
  const [first, second] = R.rankListings([room, flat], ctx);
  assert.equal(first.id, 'b');
  assert.equal(first.rank.parts.wishes, 1);
  assert.equal(second.rank.parts.wishes, 0);
  assert.ok(second.rank.warn.some(w => w.includes('nur ein Zimmer')));
  assert.ok(!first.rank.why.some(w => w.includes('pro Person')));
  // ohne Wünsche kein Wunsch-Teil
  assert.equal(R.scoreListing(flat, { people: 2, nights: 2 }).parts.wishes, null);
  // unbekannte Wünsche werden ignoriert
  assert.equal(R.wishScore(flat, ['gibtsnicht']).value, null);
});

test('Direkt-Modus: Budget pro Nacht wirkt auch ohne Reisedaten, Hotelzimmer ist keine ganze Unterkunft', () => {
  const cheap = { id: 'c', kind: 'Wohnung', totalPrice: 90, currency: '€', rating: 4.8, reviewCount: 30 };
  const pricey = { id: 'd', kind: 'Wohnung', totalPrice: 300, currency: '€', rating: 4.8, reviewCount: 30 };
  const ctx = { people: 2, budgetPerNight: 120 };
  const a = R.scoreListing(cheap, ctx), b = R.scoreListing(pricey, ctx);
  assert.ok(a.parts.price >= 0.75 && b.parts.price < 0.3);
  assert.ok(a.budgetKnown);
  assert.ok(b.warn.some(w => w.includes('über Budget') && !w.includes('NaN')));
  assert.equal(R.WISHES.whole.check({ kind: 'Hotelzimmer in Lissabon' }), false);
  assert.equal(R.WISHES.whole.check({ kind: 'Zimmer in Hotel' }), false);
  assert.equal(R.WISHES.whole.check({ kind: 'Unterkunft' }), null);
  assert.equal(R.WISHES.whole.check({ kind: 'Loft in Gràcia' }), true);
});

test('Wunsch „ganze Unterkunft“: Schlafzimmer im Titel ist kein Zimmer-Angebot', () => {
  assert.equal(R.WISHES.whole.check({ kind: 'Wohnung', title: '2 Schlafzimmer in Gràcia' }), true);
  assert.equal(R.WISHES.whole.check({ kind: 'Apartment', title: '1 bedroom in Soho' }), true);
  assert.equal(R.WISHES.whole.check({ kind: '', title: 'Zimmer in Berlin' }), false);
});

test('Wunsch „Luxus“: Stichworte passen, Zimmer nicht, sonst unbekannt', () => {
  const { WISHES } = R;
  assert.equal(WISHES.luxury.check({ kind: 'Wohnung', title: 'Penthouse mit Pool' }), true);
  assert.equal(WISHES.luxury.check({ kind: 'Privatzimmer in Bangkok', title: 'Luxus-Zimmer' }), false);
  assert.equal(WISHES.luxury.check({ kind: 'Wohnung', title: 'Gemütliches Studio' }), null);
});
