// Feature 2: Währung des Reise-Budgets aus der Seite ableiten statt festem „€“.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js'); require('../extension/extras.js');
const R = globalThis.StayMatchRank, X = globalThis.StayMatchExtras;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

test('pageCurrency: häufigste gelesene Währung, ohne Währung null (nichts erfinden)', () => {
  assert.equal(X.pageCurrency([{ currency: 'CHF' }, { currency: 'CHF' }, { currency: '€' }]), 'CHF');
  assert.equal(X.pageCurrency([{ currency: 'EUR' }, { currency: '€' }]), '€');
  assert.equal(X.pageCurrency([{ currency: null }]), null);
  assert.equal(X.pageCurrency([]), null);
});

test('Budgettexte nutzen die Währung der Seite', () => {
  const top = [{ id: '1', currency: 'CHF', rank: { stay: 400, parts: { price: 1 } } }];
  const t = X.budgetRest(top[0], { budget: 1000, nights: 4, tripNights: 4, people: 2, budgetCurrency: 'CHF' });
  assert.match(t, /CHF/); assert.doesNotMatch(t, /€/);
});

test('Panel: Budgetfeld und -zeile zeigen CHF, wenn die Seite in CHF rechnet', { skip }, async () => {
  const body = D.searchBody().replace(/ €/g, ' CHF');
  const { doc } = D.makePage({ body, chrome: D.chromeMock({ quick: { budgetNight: 150 } }) });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  const t = D.shadow(doc, 'sm-search').textContent;
  assert.match(t, /Budget pro Nacht \(CHF\)/); assert.doesNotMatch(t, /Budget pro Nacht \(€\)/);
});

test('Ohne gelesene Währung kein erfundenes „€“ in Budgettexten', () => {
  const first = { id: '1', rank: { stay: 400, parts: { price: 1 } } };
  const t = X.budgetRest(first, { budget: 1000, nights: 4, tripNights: 4, people: 2 });
  assert.ok(t && !/€/.test(t), t);
  const list = Array.from({ length: 10 }, (_, i) => ({ id: 'x' + i, totalPrice: 100 + i, isTotal: false, rating: 4.8, badges: ['Superhost'] }));
  const lever = X.budgetLever(list, { budgetPerNight: 100, nights: 4 });
  assert.ok(!lever || !/€/.test(lever), lever);
});
