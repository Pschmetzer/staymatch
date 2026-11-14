// Feature 6: Etiketten je Unterkunft (Plan A/B), im Popup filterbar; Import bereinigt Etiketten.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);
require('../extension/import.js');
const I = globalThis.StayMatchImport;

test('Etiketten bereinigen: höchstens 5, 20 Zeichen, nur Text, keine Doppelten; Teilen-Export lässt sie weg', () => {
  assert.deepEqual(I.cleanTags(['Plan A', ' Plan A ', '<b>x</b>', 5, '', 'a'.repeat(40), 'c', 'd', 'e', 'f']).map(String), ['Plan A', 'bx/b', 'a'.repeat(20), 'c', 'd']);
  const m = I.migrateListing({ id: '1', tags: ['Plan B', 7], schema: 1 });
  assert.equal(m.tags.join(), 'Plan B');
  assert.ok(!('tags' in I.migrateListing({ id: '2', tags: [] })));
  assert.ok(!('tags' in I.sanitizeListings({ 1: { id: '1', tags: ['Plan A'], title: 'X' } })['1']));
  const merged = I.mergeListing({ id: '1', tags: ['Plan A'], lastSeen: 1 }, { id: '1', lastSeen: 2, title: 'N' });
  assert.equal(merged.tags.join(), 'Plan A', 'Import ohne Etiketten behält die vorhandenen');
});

function popup(data) {
  const html = require('node:fs').readFileSync(require('node:path').join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new D.JSDOM(html, { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window, chrome = D.chromeMock(data); w.chrome = chrome; D.track(w);
  for (const f of ['core.js', 'rank.js', 'import.js', 'popup.js']) w.eval(D.src(f));
  return { w, doc: w.document, chrome };
}

test('Popup: Etikett-Filter erscheint nur mit Etiketten und filtert den Verlauf', { skip }, async () => {
  const { w, doc } = popup({ 'l:1': { id: '1', title: 'Loft', tags: ['Plan A'], lastSeen: 3 }, 'l:2': { id: '2', title: 'Villa', tags: ['Plan B'], lastSeen: 2 }, 'l:3': { id: '3', title: 'Hütte', lastSeen: 1 } });
  doc.querySelector('[data-tab="all"]').click();
  await D.until(() => doc.getElementById('tagFilter').options.length === 3);
  assert.equal(doc.getElementById('list').children.length, 3);
  const f = doc.getElementById('tagFilter'); f.value = 'Plan B'; f.dispatchEvent(new w.Event('change'));
  assert.equal(doc.getElementById('list').children.length, 1);
  assert.match(doc.getElementById('list').textContent, /Villa/);
  assert.match(doc.getElementById('list').textContent, /🏷 Plan B/);
});

test('Popup: ohne Etiketten kein Filter', { skip }, async () => {
  const { doc } = popup({ 'l:1': { id: '1', title: 'Loft', lastSeen: 3 } });
  await D.until(() => doc.getElementById('list').children.length);
  assert.equal(doc.getElementById('tagFilter').parentElement.hidden, true);
});

test('Unterkunftsseite: Etikett-Chip setzt und entfernt „Plan A“, eigenes Etikett per Enter', { skip }, async () => {
  const room = '<main><script type="application/ld+json">{"name":"Loft","aggregateRating":{"ratingValue":"4.9","ratingCount":212}}</script><div data-testid="book-it-default">100 € pro Nacht</div></main>';
  const chrome = D.chromeMock({});
  const { doc, w } = D.makePage({ body: room, url: 'https://www.airbnb.de/rooms/12345?checkin=2026-05-01&checkout=2026-05-05', chrome });
  const rootBox = () => D.shadow(doc, 'sm-room')?.querySelector('.box');
  await D.until(() => rootBox()?.querySelector('[aria-label="Etiketten"]'));
  const chip = t => [...rootBox().querySelectorAll('[aria-label="Etiketten"] button')].find(b => b.textContent.includes(t));
  chip('Plan A').click();
  await D.until(() => chrome.data['l:12345']?.tags?.includes('Plan A'));
  await D.until(() => chip('Plan A')?.getAttribute('aria-pressed') === 'true');
  const inp = rootBox().querySelector('[aria-label="Eigenes Etikett hinzufügen"]'); inp.value = 'Favorit';
  inp.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await D.until(() => chrome.data['l:12345'].tags.includes('Favorit'));
  chip('Plan A').click();
  await D.until(() => !chrome.data['l:12345'].tags.includes('Plan A'));
  assert.deepEqual([...chrome.data['l:12345'].tags], ['Favorit']);
});
