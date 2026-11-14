// Feature 4: Vergleichstabelle mit Bädern, Storno-Art, Viertelabstand und freier Auswahl von 2 bis 4 Unterkünften.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js');
const R = globalThis.StayMatchRank;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

test('compareRows: Bäder, Storno-Art (aus besuchten Seiten), Viertelabstand, geschätzter Gesamtpreis mit ≈', () => {
  const a = { id: 'a', baths: 1.5, rating: 4.8, reviewCount: 10, totalPrice: 100, isTotal: false, currency: '€', lat: 41.4, lon: 2.16 };
  const b = { id: 'b', rating: 4.8, reviewCount: 10, totalPrice: 500, isTotal: true, currency: '€' };
  const ctx = { nights: 4, areas: [{ name: 'Gràcia', lat: 41.4, lon: 2.1635, total: 80, min: 70 }], known: new Map([['a', { cancellation: { kind: 'free', until: '5. Mai' } }], ['b', { cancellation: { kind: 'nonrefundable' } }]]) };
  const top = [a, b].map(l => ({ ...l, rank: R.scoreListing(l, ctx) }));
  const rows = Object.fromEntries(R.compareRows(top, ctx).map(r => [r.label, r.cells]));
  assert.deepEqual(rows['Bäder'], ['1,5', '–']);
  assert.deepEqual(rows['Storno-Art'], ['kostenlos bis 5. Mai', 'nicht erstattbar']);
  assert.match(rows['Abstand zum Viertelzentrum'][0], /^\d+ m$/); assert.equal(rows['Abstand zum Viertelzentrum'][1], '–');
  assert.equal(rows['Gesamtpreis'][0], '400 €'); // ohne Gebührenwerte: berechnet, nicht „≈“
});

test('Storno-Art ohne Besuch bleibt „–“ (nichts erfunden)', () => {
  const a = { id: 'a', rating: 4.8, reviewCount: 10, totalPrice: 500, isTotal: true, currency: '€' };
  const rows = R.compareRows([{ ...a, rank: R.scoreListing(a, {}) }], {});
  assert.deepEqual(rows.find(r => r.label === 'Storno-Art').cells, ['–']);
});

const cells = (doc, label) => [...D.shadow(doc, 'sm-search').querySelectorAll('tbody tr')].find(tr => tr.querySelector('th').textContent === label)?.querySelectorAll('td');

test('Panel: Auswahl von 2 Unterkünften (eine aus dem Verlauf), Maximum 4, Tabelle scrollbar', { skip }, async () => {
  const hist = { id: '999', title: 'Aus dem Verlauf', visits: 2, lastSeen: Date.now(), pricePerNight: 80, currency: '€', rating: 4.6, reviewCount: 40, baths: 2 };
  const chrome = D.chromeMock({ 'l:999': hist });
  const { doc } = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  const root = () => D.shadow(doc, 'sm-search');
  [...root().querySelectorAll('button')].find(b => /Vergleich/.test(b.textContent)).click();
  await D.until(() => root().querySelector('.cmp-scroll'));
  const sc = root().querySelector('.cmp-scroll'); assert.equal(sc.getAttribute('tabindex'), '0'); assert.equal(sc.getAttribute('role'), 'region');
  assert.equal(root().querySelectorAll('thead th').length, 4); // Beschriftung + Top 3
  const box = id => [...root().querySelectorAll('input[type=checkbox]')].find(c => c.getAttribute('aria-label').includes(id));
  // nach jedem Klick auf den Neuaufbau des Panels warten (der Haken steht dann im neuen DOM)
  const pick = async (t, n) => { box(t).click(); await D.until(() => chrome.data.quick?.compare?.length === n && box(t)?.checked); };
  await pick('Aus dem Verlauf', 1);
  await pick('Titel 111', 2);
  await D.until(() => root().querySelectorAll('thead th').length === 3);
  assert.deepEqual([...cells(doc, 'pro Nacht')].map(c => c.textContent).sort(), ['150 €', '80 €']); // Verlaufs-Eintrag und Karte 111
  assert.deepEqual(chrome.data.quick.compare.sort(), ['111', '999']);
  // vier wählen: der fünfte Haken ist gesperrt
  await pick('Titel 222', 3); await pick('Titel 333', 4);
  await D.until(() => box('Titel 444')?.disabled);
  assert.ok(box('Titel 444').disabled);
});
