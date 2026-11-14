// Feature 5: Panel verschiebbar/andockbar, Top-3 hervorgehoben, „schon angesehen“, Klick scrollt zur Karte.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);
const box = (doc, w) => D.shadow(doc, 'sm-search').querySelector('.box');

test('Panel: gespeicherte Seite „links“ und freie Position werden angewendet', { skip }, async () => {
  const a = D.makePage({ body: D.searchBody(), chrome: D.chromeMock({ settings: { panelSide: 'left' } }) });
  await D.until(() => D.shadow(a.doc, 'sm-search'));
  await D.until(() => box(a.doc).classList.contains('left'));
  const b = D.makePage({ body: D.searchBody(), chrome: D.chromeMock({ settings: { panelPos: { x: 40, y: 60 } } }) });
  await D.until(() => D.shadow(b.doc, 'sm-search'));
  await D.until(() => box(b.doc).style.left === '40px');
  assert.equal(box(b.doc).style.top, '60px'); assert.equal(box(b.doc).style.right, 'auto');
});

test('Panel: Ziehen an der Kopfzeile speichert die Position, ⇆ dockt links an und löscht die freie Position', { skip }, async () => {
  const chrome = D.chromeMock({});
  const { doc, w } = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => D.shadow(doc, 'sm-search') && box(doc));
  const head = box(doc).querySelector('.head');
  const ev = (t, x, y) => head.dispatchEvent(new w.MouseEvent(t, { clientX: x, clientY: y, bubbles: true, button: 0 }));
  ev('pointerdown', 10, 10); ev('pointermove', 200, 150); ev('pointerup', 200, 150);
  await D.until(() => chrome.data.settings?.panelPos);
  assert.ok(Number.isFinite(chrome.data.settings.panelPos.x) && Number.isFinite(chrome.data.settings.panelPos.y));
  await D.until(() => D.shadow(doc, 'sm-search').querySelector('.box').style.left);
  D.shadow(doc, 'sm-search').querySelector('[aria-label="Panel links oder rechts andocken"]').click();
  await D.until(() => chrome.data.settings.panelSide === 'left');
  assert.equal(chrome.data.settings.panelPos, undefined);
});

test('Suchseite: Top-3-Karten umrandet, „schon angesehen“ nach Besuch, 📍 scrollt zur Karte', { skip }, async () => {
  const chrome = D.chromeMock({ 'l:222': { id: '222', title: 'Schon da', visits: 2, lastSeen: Date.now() } });
  const { doc, w } = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => doc.querySelector('[data-staymatch-badge]'), 3000);
  await D.until(() => [...doc.querySelectorAll('[data-testid="card-container"]')].some(c => c.style.outline));
  const cards = [...doc.querySelectorAll('[data-testid="card-container"]')];
  assert.equal(cards.filter(c => c.style.outline).length, 3, 'genau drei Top-Karten');
  const seen = cards.find(c => c.querySelector('a[href*="/rooms/222"]'));
  assert.match(seen.querySelector('[data-staymatch-badge]').textContent, /schon angesehen/);
  assert.ok(!cards.find(c => c.querySelector('a[href*="/rooms/111"]')).querySelector('[data-staymatch-badge]').textContent.includes('angesehen'));
  let scrolled = null; w.HTMLElement.prototype.scrollIntoView = function () { scrolled = this; };
  const pin = [...D.shadow(doc, 'sm-search').querySelectorAll('button')].find(b => /auf der Seite zeigen/.test(b.getAttribute('aria-label') || ''));
  pin.click();
  assert.ok(scrolled && scrolled.matches('[data-testid="card-container"]'));
});
