// Feature 7: Datenlage am Passt-Wert („auf 3 von 6 Teilen“).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;
const L = (o = {}) => ({ id: 'a', rating: 4.8, reviewCount: 100, totalPrice: 600, currency: '€', isTotal: true, beds: 5, badges: [], ...o });

test('Datenlage: nur Sterne bekannt → 1 von 6 Teilen', () => {
  const r = R.scoreListing(L({ totalPrice: null, beds: null }), { people: 4, nights: 4 });
  assert.deepEqual(r.coverage, { have: 1, of: 6 });
});
test('Datenlage: Preis, Sterne, Betten → 3 von 6', () => {
  const r = R.scoreListing(L(), { people: 4, budget: 1200, nights: 4 });
  assert.deepEqual(r.coverage, { have: 3, of: 6 });
});
test('Datenlage: eine Person hat nur 5 mögliche Teile (Betten zählen nicht)', () => {
  const r = R.scoreListing(L(), { people: 1, budget: 1200, nights: 4 });
  assert.equal(r.coverage.of, 5);
});
test('Datenlage ist vollständig bei allen Teilen', () => {
  const r = R.scoreListing(L(), { people: 2, budget: 1200, nights: 4, areas: [], wishes: ['whole'], taste: null });
  assert.ok(r.coverage.have <= r.coverage.of);
});

const D = require('./helpers/dom.js');
test('Panel zeigt „Datenlage: … von … Teilen“', { skip: !D.JSDOM && 'jsdom nicht installiert' }, async () => {
  const { doc } = D.makePage({ body: D.searchBody() });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  assert.match(D.shadow(doc, 'sm-search').textContent, /Datenlage: Passt-Wert beruht auf \d von 6 Teilen/);
  assert.match(D.shadow(doc, 'sm-search').querySelector('.score').title, /beruht auf \d von 6 Teilen/);
});
test.after(D.closeAll);
