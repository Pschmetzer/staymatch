// Runde 7: Extension. Synthetische Eingaben (keine Airbnb-Kopien). Live-Verhalten von Airbnb ist hier NICHT geprüft.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
require('../extension/pool.js');
const { StayMatchParse: P, StayMatchRank: R, StayMatchHints: H, StayMatchPool: POOL } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until } = D;
test.after(D.closeAll);

// ---------- Welle 1 ----------
test('R7: indische Tausendergruppen (₹1,23,456)', () => {
  assert.equal(P.num('₹1,23,456 total'), 123456);
  assert.equal(P.priceOf('₹12,34,567 total').amount, 1234567);
  assert.equal(P.num('1.234 €'), 1234);
  assert.equal(P.num('12,50 €'), 12.5);
});

test('R7: Preis im Buchungsbereich, Währung vorn oder hinten, Rabatt', () => {
  assert.deepEqual(P.bookPrice('$120 night'), { night: 120, total: null, currency: '$', was: null });
  assert.equal(P.bookPrice('£95 night').night, 95);
  assert.equal(P.bookPrice('CHF 140 Nacht').night, 140);
  assert.equal(P.bookPrice('200 € pro Nacht').night, 200);
  assert.equal(P.bookPrice('150 zł za noc').currency, 'zł');
  // durchgestrichener Preis zuerst: der Preis direkt vor „night“ gilt
  assert.equal(P.bookPrice('$150 $120 night').night, 120);
  const t = P.bookPrice('$120 x 5 nights $600\nTotal before taxes $640');
  assert.equal(t.night, null);
  assert.equal(t.total, 640);
  assert.equal(P.bookPrice('702 € insgesamt').total, 702);
  assert.equal(P.bookPrice('CHF 140').night, null);
});

test('R7: Storno: kostenlose Frist vor „danach nicht erstattungsfähig“, „streng verboten“ ist keine Stornoregel', () => {
  assert.deepEqual(P.cancellation('Kostenlose Stornierung vor dem 12. Mai. Danach nicht erstattungsfähig.').kind, 'free');
  assert.equal(P.cancellation('Rauchen ist streng verboten.').kind, null);
  assert.equal(P.cancellation('Strenge Stornierungsbedingungen').kind, 'strict');
  assert.equal(P.cancellation('Cancellation policy: strict').kind, 'strict');
  assert.equal(P.cancellation('Streng').kind, 'strict');
  assert.equal(P.cancellation('Nicht erstattungsfähig').kind, 'nonrefundable');
});

test('R7: Geschirrspüler ist keine Waschmaschine', () => {
  const a = P.amenities('Dishwasher, Geschirrspüler');
  assert.equal(a.washer, false);
  assert.equal(a.dishwasher, true);
  assert.equal(P.amenities('Washer').washer, true);
  assert.equal(P.amenities('Waschmaschine').washer, true);
});

test('R7: Stichworte: Wortgrenzen an Umlauten', () => {
  assert.ok(H.reviewHints('Es war zu heiß.').includes('⚠️ ohne Klimaanlage'));
  assert.ok(H.reviewHints('Überteuerte Reinigungsgebühr.').includes('⚠️ Reinigungsgebühr hoch'));
  assert.ok(H.reviewHints('Die Reinigungsgebühr war überteuert.').includes('⚠️ Reinigungsgebühr hoch'));
  assert.deepEqual(H.reviewHints('Glaubte, es sei laut.'), ['⚠️ laut']);
});

test('R7: Stichworte: Verneinung im Treffer selbst', () => {
  assert.deepEqual(H.reviewHints('Der Gastgeber war nicht freundlich.'), ['⚠️ Gastgeber unfreundlich']);
  assert.deepEqual(H.reviewHints('WLAN war nicht schlecht.'), ['👍 WLAN ok']);
  // bisherige Fälle bleiben
  assert.deepEqual(H.reviewHints('Es war überhaupt nicht laut.'), ['👍 nicht laut']);
  assert.deepEqual(H.reviewHints('Not very clean at all.'), ['⚠️ nicht sauber']);
});

test('R7: Viertel ohne total: Score bleibt eine Zahl', () => {
  const s = R.scoreListing({ id: '1', rating: 4.8, reviewCount: 50, locality: 'Gràcia' }, { areas: [{ name: 'Gràcia' }] });
  assert.ok(Number.isFinite(s.score));
  const s2 = R.scoreListing({ id: '1', rating: 4.8, reviewCount: 50, lat: 41.4, lon: 2.16 }, { areas: [{ name: 'X', lat: 41.4, lon: 2.16 }, { name: 'Y', lat: 41.41, lon: 2.16, total: 70 }] });
  assert.ok(Number.isFinite(s2.score));
  assert.equal(s2.area.name, 'Y');
  // Mittel aus Teilvierteln nur über Viertel mit Zahl
  const a = R.areaFor({ locality: 'Sant Gervasi' }, [{ name: 'Sant Gervasi Galvany', total: 80, min: 70 }, { name: 'Sant Gervasi Bonanova' }]);
  assert.equal(a.total, 80);
});

test('R7: Brücke: Viertel ohne total werden nicht übernommen', () => {
  const store = {};
  const trip = { savedAt: 5, areas: [{ name: 'A', lat: 41.4, lon: 2.1, total: 80 }, { name: 'B', lat: 41.4, lon: 2.1 }] };
  const ctx = { localStorage: { getItem: () => JSON.stringify(trip) }, chrome: { storage: { local: { set: o => Object.assign(store, o) } } }, window: { addEventListener() {} }, document: { documentElement: { dataset: {} } } };
  vm.runInNewContext(D.src('bridge.js'), ctx);
  assert.equal(JSON.stringify(store.trip.areas.map(a => a.name)), '["A"]');
});

test('R7: Popup-Empfehlung: keine 👎, Einheit wird mitgespeichert', { skip }, async () => {
  const chrome = chromeMock({ 'l:111': { id: '111', vote: -1, lastSeen: 1, visits: 1 } });
  const { doc } = makePage({ body: searchBody(D.DEFAULT.map(c => c.id === '222' ? { ...c, night: true, price: 120 } : c), false), chrome });
  await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  await until(() => chrome.data.lastSearch);
  const top = chrome.data.lastSearch.top;
  assert.ok(!top.some(l => l.id === '111'), 'abgelehnte Unterkunft im Popup');
  assert.equal(top.find(l => l.id === '222').isTotal, false);
  assert.equal(top.find(l => l.id === '333').isTotal, true);
});

test('R7: Popup zeigt „pro Nacht“ statt „gesamt“ bei Nachtpreisen', { skip }, async () => {
  const fs = require('node:fs'), path = require('node:path');
  const chrome = chromeMock({ lastSearch: { at: 1, url: 'https://www.airbnb.de/s/x', top: [{ id: '1', title: 'A', score: 80, totalPrice: 120, currency: '€', isTotal: false, url: 'https://www.airbnb.de/rooms/1' }, { id: '2', title: 'B', score: 70, totalPrice: 600, currency: '€', isTotal: true, url: 'https://www.airbnb.de/rooms/2' }] } });
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('import.js')); w.eval(D.src('popup.js'));
  await until(() => w.document.getElementById('list').querySelectorAll('.item').length > 1);
  const txt = w.document.getElementById('list').textContent;
  assert.match(txt, /120 € pro Nacht/);
  assert.match(txt, /600 € gesamt/);
  assert.ok(!/120 € gesamt/.test(txt));
});

const ROOM_URL = 'https://www.airbnb.com/rooms/4242?checkin=2026-05-01&checkout=2026-05-05';
test('R7: Unterkunftsseite: Betrugshinweis oben, Preis mit Währung vorn', { skip }, async () => {
  const body = `<script type="application/ld+json">${JSON.stringify({ name: 'Loft', aggregateRating: { ratingValue: '4.8', ratingCount: '55' } })}</script>
    <div data-testid="book-it-default"><div>$150 $120 night</div></div>
    <div data-section-id="DESCRIPTION_DEFAULT">Bitte kontaktiere mich per WhatsApp.</div>`;
  const chrome = chromeMock();
  const { doc } = makePage({ body, url: ROOM_URL, chrome });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  assert.equal(chrome.data['l:4242'].pricePerNight, 120);
  assert.equal(chrome.data['l:4242'].currency, '$');
  const first = box.querySelector('.body').firstElementChild;
  assert.match(first.textContent, /Messenger/);
  assert.ok(first.classList.contains('err'));
});
