// Feature 3: „Seit deinem letzten Besuch“.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js'); require('../extension/parse.js'); require('../extension/rank.js'); require('../extension/hints.js'); require('../extension/extras.js');
const X = globalThis.StayMatchExtras;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);
const L = (id, p, t = false) => ({ id, totalPrice: p, isTotal: t });
const T0 = 1e12, H = 3600e3;

test('Erster Besuch: kein Vergleich, danach neuer Besuch nach 30 Minuten Pause', () => {
  const a = X.sinceLastVisit(null, [L('1', 100), L('2', 200)], 1, T0);
  assert.equal(a.diff, null);
  const same = X.sinceLastVisit(a.entry, [L('3', 50)], 2, T0 + 60e3); // gleicher Besuch: nur ansammeln
  assert.equal(same.diff, null);
  const b = X.sinceLastVisit(same.entry, [L('1', 90), L('3', 50), L('4', 10)], 2, T0 + 2 * H);
  assert.deepEqual(b.diff.fresh, ['4']);
  assert.deepEqual(b.diff.cheaper, [{ id: '1', from: 100, to: 90 }]);
  assert.deepEqual(b.diff.gone.sort(), ['2'], 'Treffer 2 war da und fehlt jetzt');
  assert.equal(b.diff.since, T0 + 60e3);
});

test('Verschwunden nur, wenn gleich viele Seiten offen sind; andere Einheit zählt nicht als günstiger', () => {
  const a = X.sinceLastVisit(null, [L('1', 100), L('2', 200)], 2, T0);
  const b = X.sinceLastVisit(a.entry, [L('1', 50, true)], 1, T0 + 2 * H);
  assert.deepEqual(b.diff.gone, [], 'nur 1 von 2 Seiten geöffnet');
  assert.deepEqual(b.diff.cheaper, [], 'Nachtpreis vs. Gesamtpreis nicht vergleichbar');
});

test('Text und Speicher: höchstens 12 Suchen, nichts bei Unverändertem', () => {
  assert.equal(X.visitText({ fresh: [], cheaper: [], gone: [], since: 0 }), null);
  assert.match(X.visitText({ fresh: ['a', 'b'], cheaper: [{}], gone: [], since: T0 - 2 * 864e5 }, T0), /vor 2 Tagen\): 2 neu, 1 günstiger\./);
  let v = {}; for (let i = 0; i < 20; i++) v = X.visitStore(v, 'k' + i, { curAt: i });
  assert.equal(Object.keys(v).length, 12); assert.ok(v.k19 && !v.k0);
});

test('Suchseite zeigt die Zeile beim zweiten Besuch und speichert den Stand', { skip }, async () => {
  const chrome = D.chromeMock({});
  const p1 = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => chrome.data.visits);
  assert.ok(Object.keys(chrome.data.visits).length === 1);
  const key = Object.keys(chrome.data.visits)[0], e = chrome.data.visits[key];
  // Besuch von „gestern“: ein Treffer ist weg, ein Preis war höher
  e.curAt -= 86400e3; e.cur = { ...e.cur, '999': [100, true], '111': [900, true] };
  const chrome2 = D.chromeMock({ visits: { [key]: e } });
  const p2 = D.makePage({ body: D.searchBody(), chrome: chrome2 });
  await D.until(() => /Seit deinem letzten Besuch/.test(D.shadow(p2.doc, 'sm-search')?.textContent || ''), 3000);
  assert.match(D.shadow(p2.doc, 'sm-search').textContent, /Seit deinem letzten Besuch \(gestern\)/);
});
