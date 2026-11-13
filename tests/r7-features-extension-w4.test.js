// Runde 7 E, Welle 4: Rabatt-Ehrlichkeit, Teilnoten, Kopier-Warnung, Gastgeber-Antworten, Storno-Abwägung, Vorjahr, Viertelgrenze.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
require('../extension/extras.js');
const { StayMatchParse: P, StayMatchRank: R, StayMatchExtras: X, StayMatchHints: H } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, shadow, until } = D;
test.after(D.closeAll);

test('R7E Rabatt: Normalpreis lesen, Ehrlichkeitscheck, Last-Minute', () => {
  assert.equal(P.bookPrice('150 € 120 € pro Nacht').was, 150);
  assert.equal(P.bookPrice('120 € pro Nacht').was, null);
  const hist = [{ p: 118, c: '€', ci: '2026-05-01', n: 3 }];
  assert.match(X.discountHonesty(150, 120, hist, () => true), /schon 118 pro Nacht/);
  assert.equal(X.discountHonesty(150, 120, [{ p: 150 }], () => true), null);
  assert.equal(X.discountHonesty(null, 120, hist, () => true), null);
  assert.equal(X.lastMinute('Last-Minute-Rabatt −15 %'), true);
  assert.equal(X.lastMinute('200 € pro Nacht'), false);
});

test('R7E Teilnoten, Kontaktdaten, Gastgeber-Bilanz, Gastgeber-Antworten', () => {
  const sub = X.subRatings('Sauberkeit 4,4\nGenauigkeit\n4,9\nKommunikation 5,0\nLage 4,3');
  assert.deepEqual(sub, { clean: 4.4, communication: 5, location: 4.3, accuracy: 4.9 });
  const n = X.subRatingNotes(sub, ['clean']);
  assert.match(n.warn[0], /Sauberkeit nur 4,4/);
  assert.match(n.info[0], /Lage 4,3/);
  assert.equal(X.contactLike('anna@example.org'), true);
  assert.equal(X.contactLike('+49 170 1234567'), true);
  assert.equal(X.contactLike('Schöne Wohnung'), false);
  assert.equal(X.hostReviewCount('1.234 Bewertungen · Superhost'), 1234);
  const r = H.hostReplies(['Leider schmutzig. Antwort des Gastgebers: Danke, wir haben die Reinigung gewechselt und alles behoben.', 'Sehr laut. ', 'Toll!']);
  assert.deepEqual(r, { critical: 2, replied: 1, fixing: 1 });
});

test('R7E Storno-Abwägung, Vorjahresvergleich, Viertelgrenze, Saison-Wünsche', () => {
  const top = [{ id: 'a', rank: { score: 80, stay: 520 }, currency: '€' }, { id: 'b', rank: { score: 79, stay: 500 }, currency: '€' }];
  const known = new Map([['a', { cancellation: { kind: 'free' } }], ['b', { cancellation: { kind: 'strict' } }]]);
  assert.equal(X.cancelTradeoff(top, known), 'Platz 1 kostet 20 € mehr als Platz 2, ist aber kostenlos stornierbar');
  assert.equal(X.cancelTradeoff(top, new Map()), null);
  const ly = X.lastYear([{ booked: { checkin: '2025-05-01' }, city: 'Lissabon', pricePerNight: 92, currency: '€' }], '/s/Lissabon--Portugal/homes', 118, '€');
  assert.equal(ly, 'Bei deiner Buchung ab 2025-05-01 hast du hier 92 € pro Nacht gezahlt, heute liegt die Mitte bei 118 €');
  const areas = [{ name: 'A', lat: 41.400, lon: 2.150, total: 80 }, { name: 'B', lat: 41.402, lon: 2.150, total: 40 }];
  assert.equal(R.areaFor({ lat: 41.401, lon: 2.150 }, areas).nearBorder, true);
  assert.equal(R.areaFor({ lat: 41.400, lon: 2.150 }, [areas[0], { ...areas[1], lat: 41.43 }]).nearBorder, undefined);
  assert.ok(R.scoreListing({ id: '1', lat: 41.401, lon: 2.150 }, { areas }).info.some(x => /±500 m/.test(x)));
  assert.equal(X.EXTRA_WISHES.fireplace.season, 'winter');
});

test('R7E Unterkunftsseite: Teilnoten-Konflikt, Last-Minute, Kopier-Warnung bei Kontaktdaten', { skip }, async () => {
  const body = `<div data-testid="book-it-default"><div>Last-Minute-Rabatt</div><div>150 € 120 € pro Nacht</div></div>
    <div data-section-id="REVIEWS_DEFAULT">Sauberkeit 4,3</div>
    <div data-section-id="DESCRIPTION_DEFAULT"><span id="tel">Ruf an: +49 170 1234567</span></div>`;
  const chrome = chromeMock({ quick: { wishes: ['clean'] } });
  const { doc, w } = makePage({ body, url: 'https://www.airbnb.de/rooms/88?checkin=2026-05-01&checkout=2026-05-03', chrome });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  assert.match(box.textContent, /Sauberkeit nur 4,3/);
  assert.match(box.querySelector('details')?.textContent || '', /Last-Minute/);
  assert.equal(chrome.data['l:88'].wasPrice, 150);
  const r = doc.createRange(); r.selectNodeContents(doc.getElementById('tel'));
  w.getSelection().removeAllRanges(); w.getSelection().addRange(r);
  doc.dispatchEvent(new w.Event('copy'));
  const box2 = await until(() => /nur über Airbnb/.test(shadow(doc, 'sm-room')?.querySelector('.box')?.textContent || '') && shadow(doc, 'sm-room').querySelector('.box'));
  assert.ok(box2);
});
