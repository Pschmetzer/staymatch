// Feature 5: „Warum nicht Platz 1?“ beim Anklicken einer Karte, „Platz 4 von 38“ auf der Unterkunftsseite.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/rank.js'); require('../extension/extras.js');
const R = globalThis.StayMatchRank, X = globalThis.StayMatchExtras;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

test('whyNotFirst: Rang, Abstand, Rückstand je Teil, Preisunterschied, Warnungen', () => {
  const mk = (id, o) => { const l = { id, title: 'T' + id, rating: 4.9, reviewCount: 100, isTotal: true, currency: '€', beds: 4, ...o }; return { ...l, rank: R.scoreListing(l, { people: 4, budget: 800, nights: 4 }) }; };
  const a = mk('1', { totalPrice: 500 }), b = mk('2', { totalPrice: 950, rating: 4.3, reviewCount: 8 });
  const t = X.whyNotFirst(b, a, { rank: 4, of: 38 });
  assert.match(t[0], /^Platz 4 von 38: \d+ Punkte hinter Platz 1 \(„T1“\)/);
  assert.ok(t.some(x => /^Preis: \d+ Punkte statt \d+ Punkte/.test(x) || /^Sterne: /.test(x)));
  assert.ok(t.some(x => /450 € teurer als Platz 1/.test(x)));
  assert.match(X.whyNotFirst(a, a, { rank: 1, of: 38 })[0], /^Platz 1 von 38: Das ist die beste/);
});

test('Klick auf die Plakette einer Karte öffnet „Warum nicht Platz 1?“ ohne die Karte zu öffnen', { skip }, async () => {
  const { doc, w } = D.makePage({ body: D.searchBody() });
  await D.until(() => doc.querySelectorAll('[data-staymatch-badge]').length >= 4);
  const badge = [...doc.querySelectorAll('[data-staymatch-badge]')].find(b => !b.dataset.top);
  assert.ok(badge, 'Karte außerhalb der Top 3');
  assert.equal(badge.getAttribute('role'), 'button');
  const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true }); badge.dispatchEvent(ev);
  assert.ok(ev.defaultPrevented, 'Link der Karte nicht ausgelöst');
  await D.until(() => /Warum nicht Platz 1\?/.test(D.shadow(doc, 'sm-search')?.textContent || ''));
  const t = D.shadow(doc, 'sm-search').textContent;
  assert.match(t, /Platz 4 von 4: \d+ Punkte hinter Platz 1/);
  [...D.shadow(doc, 'sm-search').querySelectorAll('button')].find(b => b.textContent === 'Schließen').click();
  await D.until(() => !/Warum nicht Platz 1\?/.test(D.shadow(doc, 'sm-search').textContent));
});

test('Suche merkt die Reihenfolge, die Unterkunftsseite sagt „Platz 2 von 4“', { skip }, async () => {
  const chrome = D.chromeMock({});
  const s = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => chrome.data.lastSearch?.order?.length === 4);
  const order = chrome.data.lastSearch.order;
  const id = order[1];
  const r = D.makePage({ body: `<main><script type="application/ld+json">{"name":"Loft"}</script><div data-testid="book-it-default">100 € pro Nacht</div></main>`, url: `https://www.airbnb.de/rooms/${id}?checkin=2026-05-01&checkout=2026-05-05`, chrome });
  await D.until(() => /Platz 2 von 4 in deiner letzten Suche/.test(D.shadow(r.doc, 'sm-room')?.textContent || ''));
  assert.match(D.shadow(r.doc, 'sm-room').textContent, /Platz 2 von 4 in deiner letzten Suche/);
});
