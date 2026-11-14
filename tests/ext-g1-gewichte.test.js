// Feature 1: eigene Gewichte als Regler (weightTweak).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);
const L = (o = {}) => ({ id: 'a', rating: 4.8, reviewCount: 100, totalPrice: 600, currency: '€', isTotal: true, beds: 5, badges: [], ...o });

test('cleanTweak: begrenzt, wirft Unbekanntes und Unsinn weg', () => {
  assert.deepEqual(R.cleanTweak({ price: 9, rating: 0, area: 'x', evil: 2, beds: 1, wishes: 1.5 }), { price: 3, rating: 0.25, wishes: 1.5 });
  assert.deepEqual(R.cleanTweak(null), {});
});

test('„Preis wichtiger“ hebt die günstige Unterkunft, „Sterne wichtiger“ die gut bewertete', () => {
  const cheap = L({ id: 'c', totalPrice: 300, rating: 4.4, reviewCount: 100 }), good = L({ id: 'g', totalPrice: 1000, rating: 4.95, reviewCount: 300 });
  const ctx = { people: 4, budget: 1000, nights: 4 };
  const sc = (l, t) => R.scoreListing(l, { ...ctx, weightTweak: t }).score;
  const gap = t => sc(cheap, t) - sc(good, t);
  assert.ok(gap({ price: 2 }) > gap({}), 'Preis wichtiger: günstige gewinnt Punkte');
  assert.ok(gap({ rating: 2 }) < gap({}), 'Sterne wichtiger: gute gewinnt Punkte');
});

test('Regler im Panel: speichert quick.weights und rechnet neu', { skip }, async () => {
  const chrome = D.chromeMock({});
  const { doc } = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  const sl = D.shadow(doc, 'sm-search').querySelector('input[type=range][aria-label^="Preis"]');
  assert.ok(sl, 'Regler für Preis');
  sl.value = '2'; sl.dispatchEvent(new doc.defaultView.Event('change', { bubbles: true }));
  await D.until(() => chrome.data.quick?.weights?.price === 2);
  assert.equal(chrome.data.quick.weights.price, 2);
  await D.until(() => /Preis: wichtiger/.test(D.shadow(doc, 'sm-search')?.textContent || ''));
  assert.match(D.shadow(doc, 'sm-search').textContent, /Preis: wichtiger/);
});
