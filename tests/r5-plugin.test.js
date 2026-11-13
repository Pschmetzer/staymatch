// Runde 5: Plugin-Robustheit, Popup, Manifest. Synthetische Seiten (jsdom), kein echtes Airbnb.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until, sleep } = D;
test.after(D.closeAll);
const manifest = JSON.parse(D.src('manifest.json'));

test('Manifest: Inkognito aus, sensible Airbnb-Bereiche ausgeschlossen, Mindestversion, keine neuen Rechte', () => {
  assert.equal(manifest.incognito, 'not_allowed');
  assert.deepEqual(manifest.permissions, ['storage']);
  assert.ok(+manifest.minimum_chrome_version >= 102);
  const cs = manifest.content_scripts.find(c => c.js.includes('content-common.js'));
  for (const p of ['book', 'account-settings', 'hosting', 'messaging']) assert.ok(cs.exclude_matches.some(m => m.includes(`/${p}/`)), p);
});

test('Brücke: nur bekannte Felder, Längen begrenzt, Fremdes verworfen', () => {
  const store = {};
  const trip = { savedAt: 5, city: 'X'.repeat(500), nights: 4, budget: 900, checkin: '2026-05-01', evil: '<script>', people: [{ name: 'Lena', type: 'adult', secret: 1 }], wishes: ['quiet'], areas: [{ name: 'A', lat: 41.4, lon: 2.1, total: 80, min: 70, minName: 'Lena', extra: 'x' }] };
  const ctx = { localStorage: { getItem: () => JSON.stringify(trip) }, chrome: { storage: { local: { set: o => Object.assign(store, o) } } }, window: { addEventListener() {} }, document: { documentElement: { dataset: {} } } };
  vm.runInNewContext(D.src('bridge.js'), ctx);
  assert.equal(store.trip.city.length, 80);
  assert.equal(store.trip.evil, undefined);
  assert.equal(JSON.stringify(store.trip.people), JSON.stringify([{ name: 'Lena', type: 'adult' }]));
  assert.equal(store.trip.areas[0].extra, undefined);
  assert.equal(store.trip.areas[0].minName, 'Lena');
  // ungültige Zahl wird verworfen, kaputtes Objekt schreibt nichts
  for (const k of Object.keys(store)) delete store[k];
  trip.budget = 'viel'; trip.savedAt = 0;
  vm.runInNewContext(D.src('bridge.js'), ctx);
  assert.equal(store.trip, undefined);
});

test('Kartenverschieben setzt das Panel nicht zurück, neue Suche schon', { skip }, async () => {
  const { doc, w, api } = makePage({ body: searchBody(), chrome: chromeMock() });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.ok(box);
  w.history.pushState({}, '', '/s/Barcelona/homes?checkin=2026-05-01&checkout=2026-05-05&adults=4&ne_lat=41.5&ne_lng=2.2&zoom=13');
  api.route(); await sleep(80);
  assert.equal(shadow(doc, 'sm-search').querySelector('.box'), box, 'Panel wurde neu gebaut');
  w.history.pushState({}, '', '/s/Barcelona/homes?checkin=2026-06-01&checkout=2026-06-05&adults=4');
  api.route();
  await until(() => shadow(doc, 'sm-search')?.querySelector('.box') !== box);
  assert.notEqual(shadow(doc, 'sm-search')?.querySelector('.box'), box);
});

test('Unterkunftsseite: Notiz geht bei 👍 nicht verloren', { skip }, async () => {
  const ROOM = `<script type="application/ld+json">${JSON.stringify({ name: 'Loft', aggregateRating: { ratingValue: '4.8', ratingCount: '55' } })}</script><div data-testid="book-it-default"><div>200 € pro Nacht</div></div>`;
  const chrome = chromeMock();
  const { doc, w } = makePage({ body: ROOM, url: 'https://www.airbnb.de/rooms/777?checkin=2026-05-01&checkout=2026-05-05', chrome, test: { noteDelay: 5000 } });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  box.querySelector('textarea').value = 'Balkon prüfen';
  box.querySelector('textarea').dispatchEvent(new w.Event('input'));
  doc.body.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyL', altKey: true, shiftKey: true, bubbles: true }));
  await until(() => chrome.data['l:777'].vote === 1);
  assert.equal(chrome.data['l:777'].note, 'Balkon prüfen');
  assert.equal(shadow(doc, 'sm-room').querySelector('textarea').value, 'Balkon prüfen');
});

test('Speicher voll: saveListing wirft nicht', { skip }, async () => {
  const chrome = chromeMock();
  chrome.storage.local.set = async () => { throw new Error('QUOTA_BYTES quota exceeded'); };
  const { w } = makePage({ body: '', url: 'https://www.airbnb.de/account-settings', chrome });
  // Die erwartete Meldung samt Stacktrace abfangen statt in die Testausgabe schreiben, und prüfen, dass sie kommt
  const logged = [], debug = w.console.debug;
  w.console.debug = (...a) => { logged.push(a.map(String).join(' ')); };
  try {
    const item = await w.StayMatchContent.saveListing('9', { note: 'x' });
    assert.equal(item.note, 'x');
    assert.equal(w.StayMatchContent.saveFailed, true);
    assert.ok(logged.some(m => /Speichern fehlgeschlagen/.test(m) && /QUOTA_BYTES/.test(m)), logged.join('\n'));
  } finally { w.console.debug = debug; }
});

function popup(data) {
  const chrome = chromeMock(data);
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('popup.js'));
  return { w, chrome, doc: w.document };
}

test('Popup: lädt keine Bilder (keine Anfragen an Airbnb), Tabs mit Pfeiltasten, Suche', { skip }, async () => {
  const { w, doc } = popup({ 'l:1': { id: '1', title: 'Loft Gràcia', image: 'https://a0.muscache.com/x.jpg', lastSeen: Date.now() }, 'l:2': { id: '2', title: 'Villa Sol', lastSeen: Date.now() - 1, pricePerNight: 100 } });
  await until(() => doc.getElementById('list').children.length);
  doc.getElementById('tab-top').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  assert.equal(doc.getElementById('tab-all').getAttribute('aria-selected'), 'true');
  assert.equal(doc.getElementById('list').querySelectorAll('img').length, 0);
  assert.equal(doc.getElementById('list').querySelectorAll('.item').length, 2);
  const s = doc.getElementById('search'); s.value = 'villa'; s.dispatchEvent(new w.Event('input'));
  assert.equal(doc.getElementById('list').querySelectorAll('.item').length, 1);
});

test('Popup: Export ohne Notizen und Namen, wenn der Dialog verneint wird', { skip }, async () => {
  const { w, doc } = popup({ trip: { savedAt: 1, people: [{ name: 'Lena', type: 'adult' }], areas: [{ name: 'A', minName: 'Lena' }] }, 'l:1': { id: '1', title: 'Loft', note: 'geheim' } });
  await until(() => doc.getElementById('list').children.length);
  let blob = null; w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; w.HTMLAnchorElement.prototype.click = () => {};
  w.confirm = () => false; doc.getElementById('export').click();
  const text = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blob); });
  assert.ok(!text.includes('geheim') && !text.includes('Lena'), text);
});

test('Popup: Löschen „verlauf“ lässt Einstellungen und Reise stehen', { skip }, async () => {
  const { w, chrome, doc } = popup({ settings: { theme: 'dark' }, trip: { savedAt: 1 }, 'l:1': { id: '1' }, lastSearch: { at: 1 } });
  await until(() => doc.getElementById('list').children.length);
  w.prompt = () => 'verlauf'; doc.getElementById('wipe').click();
  await until(() => !chrome.data['l:1']);
  assert.ok(chrome.data.settings && chrome.data.trip && chrome.data.lastSearch);
});
