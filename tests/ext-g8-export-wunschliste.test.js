// Feature 8: Top 3 als druckbare Seite; Wunschliste /wishlists/<id> lesen, Herz nur lesen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

test('Top 3 drucken: speichert printTop und bittet den Service Worker um die Seite', { skip }, async () => {
  const sent = [];
  const chrome = D.chromeMock({});
  chrome.runtime.sendMessage = async m => { sent.push(m); };
  const { doc } = D.makePage({ body: D.searchBody(), chrome });
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  [...D.shadow(doc, 'sm-search').querySelectorAll('button')].find(b => /Top 3 drucken/.test(b.textContent)).click();
  await D.until(() => sent.length);
  assert.equal(sent.length, 1); assert.equal(sent[0].type, 'sm-print');
  const p = chrome.data.printTop;
  assert.equal(p.items.length, 3); assert.equal(p.items[0].rank, 1); assert.match(p.items[0].url, /^https:\/\/www\.airbnb\.de\/rooms\/\d+$/);
  assert.ok(p.items.every(i => typeof i.score === 'number' && !/[<>]/.test(i.title)));
});

test('print.html: lädt nur print.js, rendert Text (kein HTML), unsichere Links fallen weg', { skip }, async () => {
  const html = fs.readFileSync(path.join(D.EXT, 'print.html'), 'utf8');
  assert.doesNotMatch(html, /<script(?![^>]*src=)/); assert.doesNotMatch(html, /https?:\/\/(?!www\.w3)/);
  const chrome = D.chromeMock({ printTop: { at: Date.now(), people: 4, nights: 4, count: 20, items: [
    { rank: 1, title: '<img src=x onerror=alert(1)>', score: 88, why: ['gut'], warn: ['laut'], url: 'https://www.airbnb.de/rooms/1' },
    { rank: 2, title: 'Zwei', score: 70, url: 'javascript:alert(1)' }] } });
  const dom = new D.JSDOM(html, { runScripts: 'outside-only', url: 'chrome-extension://abc/print.html' });
  D.track(dom.window); dom.window.chrome = chrome;
  dom.window.eval(D.src('print.js'));
  await D.until(() => dom.window.document.querySelectorAll('article').length === 2);
  const d = dom.window.document;
  assert.equal(d.querySelectorAll('img').length, 0);
  assert.match(d.querySelector('h2').textContent, /<img src=x/);
  assert.equal(d.querySelectorAll('article a').length, 1);
  assert.match(d.getElementById('meta').textContent, /4 Personen · 4 Nächte · 20 Unterkünfte/);
});

test('print.html ohne gespeicherten Stand: freundlicher Hinweis', { skip }, async () => {
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'print.html'), 'utf8'), { runScripts: 'outside-only' });
  D.track(dom.window); dom.window.chrome = D.chromeMock({});
  dom.window.eval(D.src('print.js'));
  await D.until(() => /Keine Top 3/.test(dom.window.document.getElementById('meta').textContent));
});

test('Wunschliste: wird wie eine Suche bewertet, Herz wird gelesen (nie geklickt)', { skip }, async () => {
  const heart = (id, label, extra = '') => `<button data-testid="listing-card-save-button" aria-label="${label}" ${extra}>♥</button>`;
  const cards = D.DEFAULT.map(c => D.cardHtml(c).replace('</div>\n', '</div>').replace(/<\/div>$/, `${c.id === '111' ? heart(c.id, 'Aus Wunschliste entfernen', 'aria-pressed="true"') : c.id === '222' ? heart(c.id, 'Zur Wunschliste hinzufügen') : ''}</div>`));
  let clicked = 0;
  const { doc, w } = D.makePage({ body: `<main>${cards.join('')}</main>`, url: 'https://www.airbnb.de/wishlists/123456?adults=2' });
  doc.addEventListener('click', () => clicked++, true);
  await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel'));
  const t = D.shadow(doc, 'sm-search').textContent;
  assert.match(t, /Top 3 deiner Wunschliste/);
  assert.match(t, /♥ in deiner Wunschliste/);
  assert.equal(doc.querySelectorAll('[data-staymatch-badge]').length >= 3, true);
  assert.equal(clicked, 0);
  const P = w.StayMatchParse; const got = P.parseSearch(doc);
  assert.equal(got.find(l => l.id === '111').wishlisted, true); assert.equal(got.find(l => l.id === '222').wishlisted, false); assert.equal(got.find(l => l.id === '333').wishlisted, null);
});

test('Andere Airbnb-Seiten (Konto, Wunschliste-Übersicht ohne Id) bleiben unberührt', { skip }, async () => {
  const { doc } = D.makePage({ body: D.searchBody(), url: 'https://www.airbnb.de/wishlists' });
  await D.sleep(150);
  assert.equal(D.shadow(doc, 'sm-search'), null);
});

test('Service Worker: öffnet print.html nur auf Nachricht der eigenen Erweiterung', async () => {
  const vm = require('node:vm');
  const tabs = []; let onMsg;
  const chrome = {
    storage: { local: { get: async () => ({}) }, onChanged: { addListener() {} } },
    runtime: { id: 'me', getURL: p => 'chrome-extension://me/' + p, onStartup: { addListener() {} }, onInstalled: { addListener() {} }, onMessage: { addListener: f => { onMsg = f; } } },
    tabs: { create: o => tabs.push(o.url) }, action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
  };
  const ctx = vm.createContext({ chrome, importScripts: f => { for (const x of [].concat(f)) vm.runInContext(D.src(x), ctx); } });
  ctx.self = ctx; vm.runInContext(D.src('background.js'), ctx);
  onMsg({ type: 'sm-print' }, { id: 'fremd' }); onMsg({ type: 'anderes' }, { id: 'me' }); assert.equal(tabs.length, 0);
  onMsg({ type: 'sm-print' }, { id: 'me' }); assert.deepEqual([...tabs], ['chrome-extension://me/print.html']);
});
