// R4 H1: Fehlertoleranz gegen Airbnb-DOM-Änderungen. Fehlt ein Element, bleibt es still bzw. null – nie ein falscher Wert.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

const parse = w => (w.eval(D.src('core.js')), w.eval(D.src('parse.js')), w.StayMatchParse);
const docOf = (html) => { const { JSDOM } = D; const dom = new JSDOM(`<!doctype html><body>${html}</body>`, { runScripts: 'outside-only', url: 'https://www.airbnb.de/s/x' }); D.track?.(dom.window); return dom.window; };

test('heartOf: Element fehlt, Label unbekannt, leeres aria-label → null (nie true/false geraten)', { skip }, () => {
  const w = docOf(''); const P = parse(w);
  const card = h => { const d = w.document.createElement('div'); d.innerHTML = h; return d; };
  assert.equal(P.heartOf(card('<a href="/rooms/1">x</a>')), null, 'kein Herz');
  assert.equal(P.heartOf(card('<button data-testid="listing-card-save-button"></button>')), null, 'Button ohne Label');
  assert.equal(P.heartOf(card('<button aria-label="Wunschliste öffnen und dann etwas Unklares"></button>')), null, 'Label ohne Zustand');
  assert.equal(P.heartOf(card('<button aria-label="Wunschliste" aria-pressed="mixed"></button>')), null, 'Zustand unklar');
  assert.equal(P.heartOf({}), null, 'Objekt ohne querySelectorAll');
  assert.equal(P.heartOf(null), null, 'null');
});

test('pageStatus: nur Zahlen, ungültige Eingaben ergeben „nicht erkannt“', { skip }, () => {
  const w = docOf(''); const P = parse(w);
  assert.deepEqual(JSON.parse(JSON.stringify(P.pageStatus('search', 12, { cards: 12, roomLinks: 14, stateNote: 'ok' }))), { kind: 'search', ok: true, found: 12, cards: 12, roomLinks: 14, state: 'ok' });
  for (const bad of [0, -3, NaN, undefined, null, 'abc']) assert.equal(P.pageStatus('wishlist', bad, null).ok, false);
  assert.equal(P.pageStatus('<script>', 1, null).kind, 'search');
  assert.equal(P.pageStatus('room', 1, { cards: '<x>', roomLinks: Infinity, stateNote: 'x'.repeat(99) }).state.length, 20);
});

test('Wunschliste ohne Karten: kein Panel, Popup-Status „nicht erkannt“, kein Absturz', { skip }, async () => {
  const chrome = D.chromeMock();
  const { doc } = D.makePage({ body: '<main><p>leer</p></main>', url: 'https://www.airbnb.de/wishlists/123456', chrome });
  await D.until(() => chrome.data.pageStatus);
  assert.equal(D.shadow(doc, 'sm-error'), null); assert.equal(D.shadow(doc, 'sm-search'), null);
  assert.equal(chrome.data.pageStatus.ok, false); assert.equal(chrome.data.pageStatus.kind, 'wishlist');
});

test('Suchseite ohne Karten: Status „nicht erkannt“; mit Karten „erkannt“ + Anzahl', { skip }, async () => {
  const c1 = D.chromeMock();
  D.makePage({ body: '<main></main>', chrome: c1 });
  await D.until(() => c1.data.pageStatus);
  assert.equal(c1.data.pageStatus.ok, false);
  const c2 = D.chromeMock();
  D.makePage({ body: D.searchBody(), chrome: c2 });
  await D.until(() => c2.data.pageStatus?.ok);
  assert.equal(c2.data.pageStatus.found, 4); assert.equal(c2.data.pageStatus.kind, 'search');
});

test('Karte ohne Preis, Sterne, Herz: kein NaN, keine geratenen Werte', { skip }, async () => {
  const body = `<main><div data-testid="card-container"><a href="/rooms/777">x</a><div data-testid="listing-card-title">Wohnung in Test</div></div></main>`;
  const chrome = D.chromeMock();
  const { doc, w } = D.makePage({ body, chrome });
  const got = w.StayMatchParse.parseSearch(doc);
  assert.equal(got.length, 1);
  const l = got[0];
  assert.equal(l.id, '777'); assert.ok(l.totalPrice == null && l.rating == null, 'nichts geraten');
  assert.ok(l.wishlisted == null, 'Herz unbekannt = null');
  assert.ok(!JSON.stringify(l).includes('NaN'));
});

test('Popup: Statuszeile nur frisch (30 min), sonst leer', { skip }, async () => {
  const fs = require('node:fs'), path = require('node:path');
  const mk = async st => {
    const chrome = D.chromeMock(st ? { pageStatus: st } : {});
    const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
    const w = dom.window; w.chrome = chrome; D.track(w);
    for (const f of ['core.js', 'rank.js', 'import.js', 'popup.js']) w.eval(D.src(f));
    await D.sleep(150);
    return w.document.getElementById('pageStatus').textContent;
  };
  assert.match(await mk({ at: Date.now(), kind: 'search', ok: true, found: 7 }), /Suchseite erkannt \(7 Unterkünfte/);
  assert.match(await mk({ at: Date.now(), kind: 'wishlist', ok: false, found: 0 }), /Wunschliste nicht erkannt/);
  assert.equal(await mk({ at: Date.now() - 3600e3, kind: 'search', ok: true, found: 7 }), '');
  assert.equal(await mk(null), '');
});
