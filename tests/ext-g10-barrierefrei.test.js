// Feature 10: Screenreader-Ansage der Tastenkürzel, Vergleichstabelle scrollbar bei großer Schrift.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);
const press = (doc, w, code) => doc.body.dispatchEvent(new w.KeyboardEvent('keydown', { code, altKey: true, shiftKey: true, bubbles: true }));
const live = doc => D.shadow(doc, 'sm-search').querySelector('.sr-live');

test('Tastenkürzel werden in der Live-Region angesagt (Vergleich, Einklappen, Andocken)', { skip }, async () => {
  const { doc, w } = D.makePage({ body: D.searchBody() });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  await D.until(() => /Neu bewertet/.test(live(doc).textContent));
  press(doc, w, 'KeyV'); await D.until(() => live(doc).textContent === 'Vergleich eingeschaltet');
  press(doc, w, 'KeyV'); await D.until(() => live(doc).textContent === 'Vergleich ausgeschaltet');
  press(doc, w, 'KeyM'); await D.until(() => live(doc).textContent === 'Panel eingeklappt');
  press(doc, w, 'KeyM'); await D.until(() => live(doc).textContent === 'Panel ausgeklappt');
  press(doc, w, 'KeyD'); await D.until(() => live(doc).textContent === 'Panel links angedockt');
  assert.equal(live(doc).getAttribute('aria-live'), 'polite');
});

test('Schaltflächen tragen aria-keyshortcuts; Vergleichstabelle ist fokussierbar und scrollbar', { skip }, async () => {
  const { doc } = D.makePage({ body: D.searchBody() });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  const root = D.shadow(doc, 'sm-search');
  assert.equal(root.querySelector('[aria-keyshortcuts="Alt+Shift+V"]').textContent.includes('Vergleich'), true);
  assert.ok(root.querySelector('[aria-keyshortcuts="Alt+Shift+K"]'));
  [...root.querySelectorAll('button')].find(b => /Vergleich/.test(b.textContent)).click();
  await D.until(() => root.querySelector('.cmp-scroll'));
  const sc = root.querySelector('.cmp-scroll');
  assert.equal(sc.getAttribute('tabindex'), '0'); assert.match(sc.getAttribute('aria-label'), /scrollbar/);
  assert.ok(root.querySelector('tbody th[scope="row"]'), 'Zeilenköpfe');
  const css = require('node:fs').readFileSync(require('node:path').join(D.EXT, 'content-common.js'), 'utf8');
  assert.match(css, /\.cmp-scroll \{ overflow-x: auto/);
});
