// Runde 7, Restpunkte: Wunsch-Profile im Popup (R7-597), Link zur Betrugshilfe, Startseiten-Deeplink, Feed, Stadtseiten „Kurz und einfach“.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, shadow, until } = D;
test.after(D.closeAll);
const ROOT = path.join(__dirname, '..');

function popup(data) {
  const chrome = chromeMock(data);
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('extras.js')); w.eval(D.src('popup.js'));
  return { w, chrome, doc: w.document };
}

test('R7-597 Popup: erster Klick setzt Arbeits-Profil, zweiter wechselt zu Urlaub, Budget bleibt', { skip }, async () => {
  const { doc, chrome } = popup({ quick: { budgetNight: 120, wishes: ['bathtub'] } });
  const btn = await until(() => !doc.getElementById('wishProfile').hidden && doc.getElementById('profileBtn'));
  assert.match(btn.textContent, /Arbeiten/);
  assert.equal(btn.getAttribute('aria-pressed'), 'false');
  btn.click();
  await until(() => chrome.data.quick.profile === 'work');
  assert.deepEqual(chrome.data.quick.wishes, ['wifi', 'workspace', 'quiet', 'selfCheckin']);
  assert.equal(chrome.data.quick.budgetNight, 120);
  await until(() => doc.getElementById('profileBtn').getAttribute('aria-pressed') === 'true');
  assert.match(doc.getElementById('profileBtn').textContent, /wechseln zu .*Urlaub/);
  doc.getElementById('profileBtn').click();
  await until(() => chrome.data.quick.profile === 'holiday');
  assert.deepEqual(chrome.data.quick.wishes, ['whole', 'trusted', 'clean']);
  assert.equal(chrome.data.quick.budgetNight, 120);
  // Alle gesetzten Wünsche gibt es im Plugin (sonst würden sie still ignoriert)
  const R = globalThis.StayMatchRank || (require('../extension/core.js'), require('../extension/parse.js'), require('../extension/rank.js'), globalThis.StayMatchRank);
  require('../extension/extras.js');
  for (const k of ['work', 'holiday']) for (const wk of globalThis.StayMatchExtras.PROFILES[k].wishes) assert.ok(R.WISHES[wk] || R.REVIEW_WISHES[wk] || globalThis.StayMatchExtras.EXTRA_WISHES[wk], wk);
});

test('Betrugsverdacht: Unterkunftsseite verlinkt die Hilfe auf der Startseite', { skip }, async () => {
  const body = `<script type="application/ld+json">${JSON.stringify({ name: 'Loft', aggregateRating: { ratingValue: '4.8', ratingCount: '55' } })}</script>
    <div data-section-id="DESCRIPTION_DEFAULT">Schreib mir auf WhatsApp, Zahlung außerhalb von Airbnb ist günstiger.</div>`;
  const { doc } = makePage({ body, url: 'https://www.airbnb.de/rooms/778?adults=2', chrome: chromeMock() });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box .err'));
  const a = [...box.querySelectorAll('a')].find(x => /Verdacht auf Betrug/.test(x.textContent));
  assert.ok(a, 'Link fehlt');
  assert.equal(a.getAttribute('href'), 'https://staymatch.pro/#verdacht');
  assert.equal(a.getAttribute('rel'), 'noopener');
  // Ziel existiert auf beiden Startseiten
  for (const f of ['index.html', 'en.html']) assert.match(fs.readFileSync(path.join(ROOT, 'web', f), 'utf8'), /<details id="verdacht"/);
});
