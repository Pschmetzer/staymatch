// R4 H4: Hosttitel und andere Seitendaten sind nie Code: Panel (Shadow DOM), Kopiertexte (Markdown/Klartext), Kalender, Elementhelfer h().
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/core.js'); require('../extension/parse.js'); require('../extension/rank.js'); require('../extension/reminders.js');
const { StayMatchRank: R, StayMatchReminders: REM } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

const EVIL = ['<img src=x onerror="window.__x=1">', '"><script>window.__x=1</script>', '[Klick](https://evil.example)', '![p](https://evil.example/t.gif)', 'a | b | c', '<svg onload=window.__x=1>', 'x\n9. Gefälscht – https://evil.example', '=HYPERLINK("https://evil.example")', 'javascript:window.__x=1'];

test('Panel: Hosttitel und Ortsnamen werden als Text dargestellt (Shadow DOM, kein HTML, kein Handler)', { skip }, async () => {
  const cards = EVIL.slice(0, 4).map((t, i) => ({ id: String(900 + i), price: 400 + i * 10, rating: '4.8', count: 90, title: t, kind: EVIL[5] }));
  const { doc, w } = D.makePage({ body: D.searchBody(cards), chrome: D.chromeMock() });
  const sr = await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item'));
  assert.ok(sr, 'Panel da');
  const root = D.shadow(doc, 'sm-search');
  assert.equal(root.querySelectorAll('script, iframe, object, embed, svg, style[nonce]').length, 0);
  assert.equal(root.querySelectorAll('img[src="x"]').length, 0, 'kein eingeschleustes Bild');
  for (const el of root.querySelectorAll('*')) for (const a of el.attributes) assert.ok(!/^on/i.test(a.name), `Attribut ${a.name} an <${el.localName}>`);
  for (const a of root.querySelectorAll('a[href]')) assert.match(a.getAttribute('href'), /^https?:/i);
  assert.equal(w.__x, undefined, 'kein Skript ausgeführt');
  // Plaketten an den Karten: nur Text
  for (const b of doc.querySelectorAll('[data-staymatch-badge]')) assert.equal(b.children.length, 0);
});

test('h(): javascript:/data:-Adressen und Text-Handler werden verworfen, https und relative Pfade bleiben', { skip }, () => {
  const { w } = D.makePage({ body: '<main></main>' });
  const h = w.StayMatchContent.h;
  for (const bad of ['javascript:alert(1)', ' javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', '//evil.example/x', 'vbscript:x']) {
    assert.equal(h('a', { href: bad }).hasAttribute('href'), false, bad);
    assert.equal(h('img', { src: bad }).hasAttribute('src'), false, bad);
  }
  for (const ok of ['https://www.airbnb.de/rooms/1', 'http://localhost:8765/', '/rooms/1', '#x', 'blob:https://x/1']) assert.equal(h('a', { href: ok }).getAttribute('href'), ok);
  assert.equal(h('button', { onclick: 'alert(1)' }).onclick, null);
  assert.equal(typeof h('button', { onclick: () => 1 }).onclick, 'function');
});

test('Markdown-Kopie: Hosttitel werden maskiert (kein Link, kein Bild, keine Tabellenspalte, keine HTML-Tags)', () => {
  const items = EVIL.map((t, i) => ({ id: String(i), title: t, kind: t, locality: t, rating: 4.8, score: 80, url: 'https://www.airbnb.de/rooms/1', totalPrice: 100, currency: '€' }));
  const txt = R.shareText(items, { markdown: true, title: EVIL[2], sub: EVIL[0] });
  const lines = txt.split('\n');
  // jede Tabellenzeile hat genau so viele unmaskierte „|“ wie die Kopfzeile
  const unesc = l => (l.match(/(^|[^\\])\|/g) || []).length;
  const rows = lines.filter(l => l.startsWith('|'));
  assert.equal(rows.length, items.length + 2);
  for (const r of rows) assert.equal(unesc(r), unesc(rows[0]), r);
  assert.ok(!/(^|[^\\])[<>]/.test(txt), 'keine unmaskierten spitzen Klammern');
  assert.ok(!/(^|[^\\])\]\(/.test(txt.replace(/\]\(https:\/\/www\.airbnb\.de[^)]*\)/g, '')), 'kein Markdown-Link außer dem eigenen');
  assert.ok(!/(^|[^\\])!\[/.test(txt), 'kein Bild');
  assert.ok(!lines.some(l => /^9\. /.test(l)), 'Zeilenumbruch im Titel täuscht keinen Eintrag vor');
});

test('Klartext-Kopie: Zeilenumbrüche im Titel erzeugen keine zusätzlichen Einträge', () => {
  const txt = R.shareText([{ id: '1', title: 'Gut\n2. Gefälscht\nhttps://evil.example', locality: 'Ort\r\n3. Falsch', score: 80 }], {});
  assert.equal(txt.split('\n').filter(l => /^\d+\. /.test(l)).length, 1);
});

test('Kalender (.ics): Hosttitel können keine Zeilen oder Ereignisse einschleusen', () => {
  const evil = 'Haus\r\nBEGIN:VEVENT\rSUMMARY:Falsch\nEND:VEVENT;x,y\\z\u0007';
  const out = REM.ics({ 1: { id: '1', title: evil, locality: evil, url: 'https://www.airbnb.de/rooms/1', booked: { checkin: '2099-05-01', checkout: '2099-05-03', cancel: '2099-04-20' } } }, 1e12);
  assert.ok(out.endsWith('\r\n'));
  const physical = out.split('\r\n').filter(Boolean);
  for (const l of physical) assert.ok(/^( |[A-Z-]+[;:])/.test(l), 'Zeile beginnt mit Eigenschaft oder Fortsetzung: ' + JSON.stringify(l));
  assert.ok(!/[\r](?!\n)/.test(out) && !/(^|[^\r])\n/.test(out) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(out.replace(/\r\n/g, '')));
  const n = physical.filter(l => l.startsWith('UID:')).length;
  assert.ok(n >= 1 && n <= 2); assert.equal(physical.filter(l => l === 'BEGIN:VEVENT').length, n, 'nur eigene Ereignisse'); assert.equal(physical.filter(l => l === 'END:VEVENT').length, n);
  const unfolded = out.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:Haus\\nBEGIN:VEVENT\\nSUMMARY:Falsch\\nEND:VEVENT\\;x\\,y\\\\z'));
});
