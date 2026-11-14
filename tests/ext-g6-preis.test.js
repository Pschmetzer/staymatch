// Feature 6: Preis manuell korrigieren oder ausschließen (priceImplausible).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);
const L = (id, o = {}) => ({ id, rating: 4.7, reviewCount: 50, totalPrice: 100, isTotal: false, currency: '€', beds: 4, badges: [], ...o });

test('applyPriceFixes: Korrektur setzt Nachtpreis, löscht Gebühren-Felder; Ausschluss markiert; Unsinn wird ignoriert', () => {
  const S = '2026-05-01|2026-05-05';
  const out = R.applyPriceFixes([L('a', { allTotal: 500, nightPrice: 100 }), L('b'), L('c'), L('d')], { ['a|' + S]: { price: 80 }, ['b|' + S]: { exclude: true }, ['c|' + S]: { price: -5 }, __proto__: { ['d|' + S]: { exclude: true } } }, S);
  assert.equal(out[0].totalPrice, 80); assert.equal(out[0].priceFixed, true); assert.equal(out[0].allTotal, undefined);
  assert.equal(out[1].priceImplausible, true); assert.equal(out[1].priceExcluded, true);
  assert.equal(out[2].totalPrice, 100); assert.equal(out[3].priceImplausible, undefined, 'geerbte Schlüssel zählen nicht');
  assert.deepEqual(R.applyPriceFixes([L('a')], null), [L('a')]);
  // andere Reisedaten: die Korrektur gilt nicht (kein Mai-Preis im Dezember)
  const dec = R.applyPriceFixes([L('a')], { ['a|' + S]: { price: 80 } }, '2026-12-01|2026-12-05');
  assert.equal(dec[0].totalPrice, 100); assert.equal(dec[0].priceFixed, undefined);
});

test('korrigierter Preis wird nicht als „zu niedrig“ verworfen; ausgeschlossener nicht bewertet', () => {
  const page = [L('x', { totalPrice: 150 }), L('y', { totalPrice: 160 }), L('z', { totalPrice: 140 }), L('w', { totalPrice: 155 })];
  const fixed = R.applyPriceFixes([L('low', { totalPrice: 10 }), ...page], { 'low|': { price: 12 } });
  const r = R.rankListings(fixed, { people: 2, nights: 4, budget: 800 }).find(l => l.id === 'low');
  assert.equal(r.priceImplausible, false); assert.ok(r.rank.parts.price != null);
  assert.ok(r.rank.info.some(t => /Preis von dir korrigiert: 12 € pro Nacht/.test(t)));
  const ex = R.rankListings(R.applyPriceFixes([L('e'), ...page], { 'e|': { exclude: true } }), { people: 2, nights: 4, budget: 800 }).find(l => l.id === 'e');
  assert.equal(ex.rank.parts.price, null); assert.ok(ex.rank.warn.some(t => /von dir ausgeschlossen/.test(t)));
});

test('Panel: Preis korrigieren speichert quick.priceFix, ausschließen und zurücksetzen', { skip }, async () => {
  const chrome = D.chromeMock({});
  const { doc } = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel details'));
  const root = () => D.shadow(doc, 'sm-search');
  const inp = root().querySelector('.item.hotel input[type=number]');
  const top = root().querySelector('.item.hotel .name').textContent;
  inp.value = '90'; [...inp.closest('details').querySelectorAll('button')].find(b => b.textContent === 'Übernehmen').click();
  await D.until(() => Object.values(chrome.data.quick?.priceFix || {})[0]?.price === 90);
  await D.until(() => /Preis von dir korrigiert: 90 € pro Nacht/.test(root().textContent));
  const id = Object.keys(chrome.data.quick.priceFix)[0];
  [...root().querySelectorAll('button')].find(b => b.textContent === 'Zurücksetzen').click();
  await D.until(() => !chrome.data.quick.priceFix[id]);
  assert.ok(!(id in chrome.data.quick.priceFix));
  assert.match(id, /^\d+\|2026-05-01\|2026-05-05$/, 'Schlüssel enthält die Reisedaten');
  // ausschließen
  await D.until(() => root().querySelector('.item.hotel details'));
  [...root().querySelector('.item.hotel details').querySelectorAll('button')].find(b => b.textContent === 'Preis nicht werten').click();
  await D.until(() => Object.values(chrome.data.quick.priceFix || {})[0]?.exclude === true);
  await D.until(() => /Preis von dir ausgeschlossen/.test(root().textContent));
  assert.ok(top);
});
