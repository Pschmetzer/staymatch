// Runde 7, Welle 2: Extension. Synthetische Eingaben (keine Airbnb-Kopien). Live-Verhalten von Airbnb ist hier NICHT geprüft.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
require('../extension/pool.js');
const { StayMatchParse: P, StayMatchRank: R, StayMatchPool: POOL } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until } = D;
test.after(D.closeAll);
const ROOM_URL = 'https://www.airbnb.com/rooms/4242?checkin=2026-05-01&checkout=2026-05-05';

function popup(data) {
  const chrome = chromeMock(data);
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('import.js')); w.eval(D.src('popup.js'));
  return { w, chrome, doc: w.document };
}

test('R7: Parser Suchseite: kurzes Nachtwort, Mehrfachangebot, Singular-Zimmer, Präpositionen', () => {
  assert.equal(P.NIGHT_RE.test('$120 night'), true);
  assert.equal(P.NIGHT_RE.test('80 € Nacht'), true);
  assert.equal(P.isMultiUnit('Self check-in available'), false);
  assert.equal(P.isMultiUnit('Sofort verfügbar'), false);
  assert.equal(P.isMultiUnit('3 Wohnungen verfügbar'), true);
  assert.equal(P.isMultiUnit('5 units available'), true);
  assert.equal(P.details(['1 habitación']).bedrooms, 1);
  assert.equal(P.details(['1 camera da letto']).bedrooms, 1);
  assert.equal(P.details(['2 camere da letto']).bedrooms, 2);
  assert.equal(P.localityFromTitle('Apartament w Krakowie'), 'Krakowie');
  assert.equal(P.localityFromTitle('Byt v Praze'), 'Praze');
  assert.equal(P.localityFromTitle('Ferienhaus am Gardasee'), 'Gardasee');
  assert.equal(P.localityFromTitle('Finca auf Mallorca'), 'Mallorca');
  assert.equal(P.localityFromTitle('Wohnung in Gràcia'), 'Gràcia');
});

const b64 = s => Buffer.from(s).toString('base64');
function fakeDoc(state, cards) {
  const card = c => ({ innerText: c.text, querySelector: sel => {
    if (sel.includes('/rooms/')) return { getAttribute: () => `/rooms/${c.id}` };
    if (sel.includes('price-availability-row')) return c.price ? { innerText: c.price } : null;
    if (sel.includes('listing-card-name')) return { innerText: 'Titel ' + c.id };
    return null;
  }, querySelectorAll: () => [] });
  const st = { textContent: JSON.stringify({ a: { staysSearch: { results: { searchResults: state } } } }) };
  return { querySelectorAll: sel => sel.includes('data-deferred-state') ? [st] : sel.includes('card-container') ? cards.map(card) : [], getElementById: () => null };
}
test('R7: Merge: leere State-Werte überschreiben DOM-Superhost nicht; Nur-State-Rückfall ist veraltet', () => {
  const state = [{ demandStayListing: { id: b64('DemandStayListing:55') }, badges: [], structuredDisplayPrice: { primaryLine: { accessibilityLabel: '500 € gesamt' } } }];
  const out = P.parseSearch(fakeDoc(state, [{ id: '55', text: 'Wohnung\nSuperhost\n500 € gesamt', price: '500 € gesamt' }]));
  assert.deepEqual([...out[0].badges], ['Superhost']);
  const only = P.parseSearch(fakeDoc([{ ...state[0], nameLocalized: { localizedStringWithTranslationPreference: 'x' } }], []));
  assert.equal(only[0].priceStale, true);
});

test('R7: Ruhezeit mit am/pm, Lift und Pool mit Kontext', () => {
  assert.deepEqual(P.houseRules('Quiet hours 10 pm to 8 am').quietHours, { from: 22, to: 8 });
  assert.deepEqual(P.houseRules('Quiet hours 10:00 PM - 7:00 AM').quietHours, { from: 22, to: 7 });
  assert.deepEqual(P.houseRules('Ruhezeiten 22:00 bis 08:00').quietHours, { from: 22, to: 8 });
  assert.equal(P.amenities('Skilift nearby').elevator, false);
  assert.equal(P.amenities('Ski lift nearby').elevator, false);
  assert.equal(P.amenities('Lift').elevator, true);
  assert.equal(P.amenities('Pool table').pool, false);
  assert.equal(P.amenities('Pool').pool, true);
});

test('R7: Ranking: Währungs-Aliase im Geschmack, unbekannte Anzahl, Nachtpreis neutral, keine erfundene Währung', () => {
  const taste = R.buildTaste([{ vote: 1, pricePerNight: 100, currency: '€', rating: 4.8 }]);
  assert.equal(R.tasteScore({ totalPrice: 100, currency: 'EUR', isTotal: false }, taste), 0.7);
  const r = R.scoreListing({ id: '1', rating: 4.9, reviewCount: null }, {});
  assert.ok(r.why.concat(r.warn).some(x => /Anzahl unbekannt/.test(x)));
  assert.ok(!r.why.concat(r.warn).some(x => /bei 0 Bewertungen/.test(x)));
  const n = R.scoreListing({ id: '1', totalPrice: 80, currency: '€', isTotal: false, rating: 4.8, reviewCount: 50 }, { nights: 4 });
  assert.ok(n.why.some(x => /80 € pro Nacht/.test(x)));
  assert.ok(!n.warn.some(x => /pro Nacht/.test(x)));
  const nn = R.scoreListing({ id: '1', totalPrice: 80, currency: '€', isTotal: false }, {});
  assert.ok(nn.warn.some(x => /Nächtezahl fehlt/.test(x)));
  const nc = R.scoreListing({ id: '1', totalPrice: 600, isTotal: true }, {});
  assert.ok(!nc.why.concat(nc.warn).some(x => /€/.test(x)), 'keine erfundene €-Angabe');
  const l = { id: '1', totalPrice: 600, isTotal: true };
  const rows = R.compareRows([{ ...l, rank: R.scoreListing(l, { nights: 4 }) }], {});
  assert.ok(!JSON.stringify(rows).includes('€'));
});

test('R7: Pool: Überlauf wirft die älteste Seite weg, egal wie lang die Ids sind', () => {
  let pool = null;
  const mk = (n, base) => Array.from({ length: n }, (_, i) => ({ id: String(BigInt(base) + BigInt(i)) }));
  const url = o => `https://www.airbnb.de/s/X/homes?items_offset=${o}`;
  pool = POOL.mergePool(pool, url(0), mk(150, '1000000000000000000'), 1); // lange Ids, älteste Seite
  pool = POOL.mergePool(pool, url(18), mk(150, '50000'), 2); // kurze Ids
  pool = POOL.mergePool(pool, url(36), mk(10, '90000'), 3); // Überlauf
  const ids = Object.keys(pool.items);
  assert.equal(ids.length, POOL.MAX);
  assert.ok(ids.includes('50000'), 'kurze Id von neuerer Seite wurde verworfen');
  assert.equal(ids.filter(i => pool.items[i].page === '0').length, 140);
});

test('R7: Brücke: Reise aus anderem Tab (storage-Event), mehr als 60 Viertel', () => {
  const store = {}, handlers = {};
  const trip = { savedAt: 5, areas: Array.from({ length: 120 }, (_, i) => ({ name: 'A' + i, total: 50 })) };
  let raw = JSON.stringify(trip);
  const ctx = { localStorage: { getItem: () => raw }, chrome: { storage: { local: { set: o => Object.assign(store, o) } } }, window: { addEventListener(n, f) { handlers[n] = f; } }, document: { documentElement: { dataset: {} } } };
  vm.runInNewContext(D.src('bridge.js'), ctx);
  assert.equal(store.trip.areas.length, 120);
  raw = JSON.stringify({ ...trip, savedAt: 9 });
  handlers.storage({ key: 'sm_trip' });
  assert.equal(store.trip.savedAt, 9);
});

test('R7: Suchseite: Zusammensetzung in Punkten, Budget im Kopf wie gerechnet, keine Namen im Airbnb-DOM, lang=de', { skip }, async () => {
  const trip = { savedAt: 1, city: 'Barcelona', people: [{ name: 'Lena' }, { name: 'Max' }, { name: 'C' }, { name: 'D' }], nights: 8, budget: 2400, checkin: '2026-05-01', areas: [{ name: 'Gràcia', lat: 41.4, lon: 2.16, total: 82, min: 20, minName: 'Lena' }] };
  const { doc } = makePage({ body: searchBody(), chrome: chromeMock({ trip }) });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.equal(box.getAttribute('lang'), 'de');
  assert.match(box.textContent, /Budget 1200 € für 4 Nächte/);
  assert.match(box.textContent, /Zusammensetzung \(Punkte\): Viertel \d+/);
  assert.match(box.textContent, /Lena/, 'Warnung zu Mitreisenden fehlt im eigenen Panel');
  for (const b of doc.querySelectorAll('[data-staymatch-badge]')) assert.ok(!/Lena/.test(b.title + b.textContent), b.title);
});

test('R7: Unterkunftsseite: Regeln/Storno-Zeile, Passt-Wert aus der Suche, Ort getrennt von Stadt, doppelte Bewertungen, Preisverlauf je Reise', { skip }, async () => {
  const body = `<script type="application/ld+json">${JSON.stringify({ name: 'Loft', aggregateRating: { ratingValue: '4.8', ratingCount: '55' }, address: { addressLocality: 'Barcelona' } })}</script>
    <div data-testid="book-it-default"><div>200 € pro Nacht</div></div>
    <div data-section-id="POLICIES_DEFAULT">Keine Partys. Ruhezeiten 22:00 bis 08:00.</div>
    <div data-section-id="CANCELLATION_DEFAULT">Kostenlose Stornierung bis 5. Mai</div>
    <div data-section-id="REVIEWS_DEFAULT"><div role="listitem"><div data-review-id="1">Nachts laut.</div></div></div>`;
  const chrome = chromeMock({ lastSearch: { at: 1, top: [{ id: '4242', score: 77, why: ['Viertel Gràcia: 82/100', '⭐ 4,8 bei 55 Bewertungen', 'drei'] }] },
    'l:4242': { id: '4242', visits: 1, lastSeen: 1, priceHistory: [{ t: 1, p: 100, c: '€', ci: '2025-07-01', n: 4 }] } });
  const { doc, w } = makePage({ body, url: ROOM_URL, chrome });
  const meta = doc.createElement('meta'); meta.setAttribute('property', 'og:title'); meta.setAttribute('content', 'Wohnung in Gràcia · ★4,8'); doc.head.append(meta);
  void w;
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  const t = box.textContent;
  assert.match(t, /Keine Partys/);
  assert.match(t, /Ruhe 22–8 Uhr/);
  assert.match(t, /Kostenlos stornierbar bis 5\. Mai/);
  assert.match(t, /Passt-Wert 77\/100/);
  assert.ok(!/Preis seit dem ersten Besuch/.test(t), 'andere Reise verglichen');
  const l = chrome.data['l:4242'];
  assert.equal(l.locality, 'Gràcia');
  assert.equal(l.city, 'Barcelona');
  assert.equal(JSON.stringify(l.hints), '["⚠️ laut"]');
  assert.equal(l.priceHistory.at(-1).ci, '2026-05-01');
  assert.ok(box.getAttribute('aria-label').includes('Loft'));
});

test('R7: Shadow Root geschlossen, Popup mit strenger CSP', { skip }, async () => {
  const { doc } = makePage({ body: searchBody(), chrome: chromeMock() });
  await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.equal(doc.getElementById('sm-search').shadowRoot, null, 'Seitenskripte erreichen das Panel');
  const csp = JSON.parse(D.src('manifest.json')).content_security_policy.extension_pages;
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /connect-src 'none'/);
  assert.match(csp, /img-src 'self'/);
});

test('R7: Popup: Geschmack je Währung, Link mit gemerkten Daten', { skip }, async () => {
  const { doc } = popup({ 'l:1': { id: '1', vote: 1, pricePerNight: 100, currency: '€', url: 'https://www.airbnb.de/rooms/1', checkin: '2099-05-01', checkout: '2099-05-05', lastSeen: 2 }, 'l:2': { id: '2', vote: 1, pricePerNight: 300, currency: '$', url: 'https://www.airbnb.com/rooms/2', lastSeen: 1 } });
  await until(() => doc.getElementById('profile').textContent.includes('Geschmack'));
  const p = doc.getElementById('profile').textContent;
  assert.match(p, /100 €\/Nacht/);
  assert.match(p, /300 \$\/Nacht/);
  doc.getElementById('tab-all').click();
  const a = [...doc.querySelectorAll('#list a.item')].find(x => x.href.includes('/rooms/1'));
  assert.match(a.href, /check_in=2099-05-01&check_out=2099-05-05/);
});
