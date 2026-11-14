// Runde 7 E, Welle 3: Einstellungen, Popup-Werkzeuge, Datenschutz-Funktionen. Synthetische Daten.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
require('../extension/core.js');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/extras.js');
const { StayMatchExtras: X, StayMatchCore: C } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until } = D;
test.after(D.closeAll);

function popup(data) {
  const chrome = chromeMock(data);
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('extras.js')); w.eval(D.src('import.js')); w.eval(D.src('popup.js'));
  return { w, chrome, doc: w.document };
}

test('R7E Link-Echtheit, Freundes-Merkliste, Etappen-Text, Datenauskunft', () => {
  assert.equal(X.linkCheck('https://www.airbnb.de/rooms/1', C.AIRBNB_DOMAINS).ok, true);
  assert.match(X.linkCheck('https://airbnb-secure-pay.com/x', C.AIRBNB_DOMAINS).text, /KEINE Airbnb-Adresse/);
  assert.match(X.linkCheck('http://www.airbnb.de/x', C.AIRBNB_DOMAINS).text, /ohne https/);
  assert.match(X.linkCheck('quatsch', C.AIRBNB_DOMAINS).text, /Kein gültiger Link/);
  assert.deepEqual(X.friendIds('1. A\n   https://www.airbnb.de/rooms/12\n2. B https://www.airbnb.com/rooms/plus/34 /rooms/12'), ['12', '34']);
  const t = X.tripsText([
    { title: 'Zwei', booked: { checkin: '2026-05-04', checkout: '2026-05-06', total: 400, people: 4, currency: '€' }, extra: { fees: { cleaning: 60, currency: '€' } } },
    { title: 'Eins', locality: 'Gràcia', booked: { checkin: '2026-05-01', checkout: '2026-05-04', cancel: '20. April' }, extra: { fees: { cleaning: 80, currency: '€' } } },
    { title: 'Nicht gebucht' }]);
  assert.match(t, /1\. Eins \(Gràcia\)\n   2026-05-01 bis 2026-05-04\n   Storno: kostenlos bis 20\. April/);
  assert.match(t, /2\. Zwei\n   2026-05-04 bis 2026-05-06 · 100 € p\. P\./);
  assert.match(t, /Reinigungsgebühren der 2 Wechsel zusammen: 140 €/);
  assert.ok(!/Nicht gebucht/.test(t));
  assert.equal(X.tripsText([]), '');
  const sum = X.storageSummary({ 'l:1': { vote: 1, note: 'x' }, 'l:2': { vote: -1, booked: {} }, trip: { city: 'Rom', people: [1, 2] } });
  assert.match(sum[0], /2 Unterkünfte im Verlauf \(1 👍, 1 👎, 1 mit Notiz, 1 gebucht\)/);
  assert.ok(sum.some(x => /Reise: Rom, 2 Personen/.test(x)));
});

test('R7E Popup: Geschmack korrigieren, Link-Prüfung, Datenauskunft, offenes Exportformat, Backup-Erinnerung, Etappen', { skip }, async () => {
  const old = Date.now() - 100 * 864e5;
  const data = { settings: { firstUse: old }, stats: { day: new Date().toISOString().slice(0, 10), rated: 42, opened: 3, ids: [] } };
  for (let i = 1; i <= 5; i++) data['l:' + i] = { id: String(i), vote: 1, locality: i < 3 ? 'Gràcia' : 'Born', rating: 4.8, lastSeen: i };
  const { doc, chrome, w } = popup(data);
  await until(() => doc.getElementById('profile').textContent.includes('Gràcia'));
  assert.equal(doc.getElementById('backup').hidden, false);
  assert.match(doc.getElementById('stats').textContent, /42 Unterkünfte/);
  const x = [...doc.querySelectorAll('#profile button')].find(b => /Gràcia/.test(b.getAttribute('aria-label')));
  x.click();
  await until(() => /Gestrichen/.test(doc.getElementById('profile').textContent));
  assert.match(doc.getElementById('profile').textContent, /Gestrichen: gràcia/);
  const lc = doc.getElementById('linkCheck');
  lc.value = 'https://airbnb-secure-pay.com/pay'; lc.dispatchEvent(new w.Event('input'));
  assert.match(doc.getElementById('linkResult').textContent, /Nachbau/);
  doc.getElementById('dataInfo').click();
  await until(() => doc.getElementById('dataOut').textContent);
  assert.match(doc.getElementById('dataOut').textContent, /5 Unterkünfte im Verlauf/);
  let blob = null;
  w.URL.createObjectURL = b => { blob = b; return 'blob:x'; };
  w.HTMLAnchorElement.prototype.click = () => {};
  w.confirm = () => false;
  doc.getElementById('export').click();
  const j = JSON.parse(await blob.text());
  assert.equal(j.format, 'staymatch-merkliste');
  assert.equal(j.version, 1);
  await until(() => chrome.data.settings.lastBackup);
  assert.ok(chrome.data.settings.lastBackup > old);
  doc.getElementById('pause').click();
  await until(() => chrome.data.settings.pauseUntil > Date.now());
  assert.match(doc.getElementById('pauseInfo').textContent, /aktiv bis/);
});

test('R7E Suchseite: Screenshot-Modus, Blindverkostung, Kennenlernen, Freundes-Likes, Zähler, Textgröße', { skip }, async () => {
  const chrome = chromeMock({ settings: { scoreOnly: true, blind: true, fontScale: 1.3 }, friendLikes: { 111: ['Lena'] } });
  const { doc } = makePage({ body: searchBody(), chrome });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  await until(() => doc.querySelector('[data-staymatch-badge]'));
  const badge = doc.querySelector('[data-staymatch-badge]');
  assert.match(badge.textContent, /^\d+$/);
  assert.equal(badge.title, '');
  assert.equal(doc.querySelector('[data-testid="card-container"] img').style.visibility, 'hidden');
  assert.match(box.textContent, /Kurz erklärt/);
  assert.match(box.textContent, /Lena mag das/);
  assert.equal(box.style.getPropertyValue('--sm-scale'), '1.3');
  await until(() => chrome.data.stats?.rated === 4);
  assert.equal(chrome.data.stats.rated, 4);
  [...box.querySelectorAll('button')].find(b => b.textContent === 'Verstanden').click();
  await until(() => !/Kurz erklärt/.test(shadow(doc, 'sm-search')?.querySelector('.box')?.textContent || 'Kurz erklärt'));
  assert.equal(chrome.data.settings.onboarded, true);
});

test('R7E Spuren-Pause: Unterkunftsseite speichert keinen Besuch, 👍 aber schon', { skip }, async () => {
  const chrome = chromeMock({ settings: { pauseUntil: Date.now() + 3600e3 } });
  const { doc } = makePage({ body: '<div data-section-id="DESCRIPTION_DEFAULT">Text</div>', url: 'https://www.airbnb.de/rooms/55', chrome });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  assert.equal(chrome.data['l:55'], undefined);
  [...box.querySelectorAll('button')].find(b => /Gefällt mir/.test(b.textContent)).click();
  await until(() => chrome.data['l:55']?.vote === 1);
  assert.equal(chrome.data['l:55'].vote, 1);
});
