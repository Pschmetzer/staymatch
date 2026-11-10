// Runde 4: content.js, parse.js und rank.js zusammen auf einer synthetischen Airbnb-ähnlichen Seite (jsdom).
// Das ist KEIN echtes Airbnb: die Seite ist selbst gebaut. Ob echtes Airbnb so aussieht, ist damit nicht belegt.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, DEFAULT, shadow, until, sleep } = D;
test.after(D.closeAll);
const txt = (doc, id) => shadow(doc, id)?.textContent || '';
const TRIP = { savedAt: 1, city: 'Barcelona', people: ['a', 'b', 'c', 'd'], nights: 4, budget: 2400, checkin: '2026-05-01', areas: [{ name: 'Gràcia', lat: 41.4, lon: 2.16, total: 82, min: 70, minName: 'Lena' }] };

test('Suchseite: Panel mit Top 3, Plaketten an den Karten, Preis pro Person und Nacht', { skip }, async () => {
  const { doc } = makePage({ body: searchBody(), chrome: chromeMock({ trip: TRIP }) });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.ok(box, 'Panel fehlt');
  assert.equal(box.querySelectorAll('.item').length, 3);
  assert.match(box.textContent, /4 Unterkünfte/);
  assert.match(box.textContent, /pro Person und Nacht/);
  const badges = [...doc.querySelectorAll('[data-staymatch-badge]')];
  assert.equal(badges.length, 4);
  assert.match(badges[0].textContent, /^StayMatch \d+ · \d+ € p\. P\.\/Nacht$/);
  // Gast-Favorit 111 (4,92 bei 210, 5 Betten) steht vorne
  assert.match(box.querySelector('.item a').textContent, /^1\. Titel 111/);
});

test('Suchseite: Texte der Seite werden nie als HTML eingesetzt', { skip }, async () => {
  const evil = '<img src=x onerror="window.pwned=1">';
  const cards = [{ id: '111', price: 600, rating: '4.9', count: 100, title: '&lt;img src=x onerror=window.pwned=1&gt;' }];
  const { doc, w } = makePage({ body: searchBody(cards), chrome: chromeMock({ trip: TRIP }) });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.ok(box);
  assert.equal(w.pwned, undefined);
  assert.equal(box.querySelectorAll('img').length, 0);
  void evil;
});

test('Vergleich: Tabelle mit drei Spalten, umschaltbar, Panel wird breiter', { skip }, async () => {
  const { doc } = makePage({ body: searchBody(), chrome: chromeMock({ trip: TRIP }) });
  let box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  const btn = [...box.querySelectorAll('button')].find(b => b.textContent.includes('Vergleich'));
  btn.click();
  box = shadow(doc, 'sm-search').querySelector('.box');
  assert.ok(box.classList.contains('wide'));
  const heads = box.querySelectorAll('thead th');
  assert.equal(heads.length, 4, 'leere Ecke + 3 Unterkünfte');
  const rows = [...box.querySelectorAll('tbody tr')].map(r => r.querySelector('th').textContent);
  assert.ok(rows.includes('pro Person/Nacht') && rows.includes('Gesamtpreis') && rows.includes('Warnungen'));
  [...box.querySelectorAll('button')].find(b => b.textContent.includes('Vergleich')).click();
  assert.equal(shadow(doc, 'sm-search').querySelectorAll('table').length, 0);
});

test('Teilen: Top 3 landen als Text in der Zwischenablage (mit Links)', { skip }, async () => {
  const { doc, w } = makePage({ body: searchBody(), chrome: chromeMock({ trip: TRIP }) });
  let copied = null;
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  [...box.querySelectorAll('button')].find(b => b.textContent.includes('kopieren')).click();
  await until(() => copied);
  assert.match(copied, /^Unsere Top 3 \(StayMatch\)\n4 Personen · 4 Nächte · Budget 2400 €/);
  assert.equal((copied.match(/https:\/\/www\.airbnb\.de\/rooms\/\d+\?/g) || []).length, 3);
  await until(() => /Kopiert/.test(txt(doc, 'sm-search')));
  assert.match(txt(doc, 'sm-search'), /Kopiert ✓/);
});

test('Tastenkürzel: Alt+Shift+V schaltet Vergleich, nicht beim Tippen in einem Feld', { skip }, async () => {
  const { doc, w } = makePage({ body: searchBody() + '<input id="q">', chrome: chromeMock({ trip: TRIP }) });
  await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  const press = (target, code) => target.dispatchEvent(new w.KeyboardEvent('keydown', { code, altKey: true, shiftKey: true, bubbles: true, composed: true }));
  press(doc.getElementById('q'), 'KeyV');
  assert.equal(shadow(doc, 'sm-search').querySelectorAll('table').length, 0, 'im Eingabefeld ignoriert');
  press(doc.body, 'KeyV');
  assert.equal(shadow(doc, 'sm-search').querySelectorAll('table').length, 1);
  press(doc.body, 'KeyM');
  assert.ok(shadow(doc, 'sm-search').querySelector('.box').classList.contains('min'));
});

test('Seitenaufbau unbekannt: klare Fehlermeldung statt leerem Panel, nur Zahlen im Bericht', { skip }, async () => {
  const body = '<main><a href="/rooms/123?x=1">A</a><a href="/rooms/456">B</a></main>';
  const { doc } = makePage({ body, chrome: chromeMock() });
  const box = await until(() => shadow(doc, 'sm-error')?.querySelector('.box'));
  assert.ok(box, 'Fehlerpanel fehlt');
  assert.match(box.textContent, /Ich verstehe diese Seite nicht/);
  assert.match(box.textContent, /Karten: 0 · Links zu Unterkünften: 2/);
  assert.equal(doc.getElementById('sm-search'), null);
  const a = box.querySelector('a.btn');
  assert.match(a.href, /^https:\/\/github\.com\/pschmetzer\/staymatch\/issues\/new\?/i);
  const body2 = decodeURIComponent(a.href);
  assert.match(body2, new RegExp(`StayMatch ${require('../extension/manifest.json').version.replace(/\./g, '\\.')}`));
  assert.ok(!body2.includes('airbnb.de'), 'keine Adresse im Bericht');
});

test('Fehlermeldung verschwindet, sobald doch Unterkünfte erscheinen', { skip }, async () => {
  const { doc, api } = makePage({ body: '<main></main>', chrome: chromeMock({ trip: TRIP }) });
  await until(() => shadow(doc, 'sm-error')?.querySelector('.box'));
  doc.querySelector('main').innerHTML = D.cardHtml({ id: '111', price: 600, rating: '4.9', count: 100 });
  await api.handleSearch();
  assert.equal(doc.getElementById('sm-error'), null);
  assert.ok(shadow(doc, 'sm-search')?.querySelector('.box'));
});

test('Teilweise erkannt: fehlende Preise werden im Panel benannt', { skip }, async () => {
  const cards = DEFAULT.map(c => ({ ...c, noPrice: true }));
  const { doc } = makePage({ body: searchBody(cards, false), chrome: chromeMock({ trip: TRIP }) });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.match(box.textContent, /Preise.*nicht gelesen/);
});

test('Mehrere Seiten: Blättern sammelt, Top 3 kommt aus allen Seiten, Leeren setzt zurück', { skip }, async () => {
  const chrome = chromeMock({ trip: TRIP });
  const p1 = makePage({ body: searchBody(DEFAULT.slice(0, 2)), chrome });
  await until(() => shadow(p1.doc, 'sm-search')?.querySelector('.box'));
  assert.deepEqual(chrome.data.pool.pages, ['0']);
  // Seite 2 (neues Dokument, gleicher Speicher): ein sehr guter Treffer nur dort
  const best = { id: '999', price: 400, rating: '4.99', count: 900, beds: 5, fav: true };
  const p2 = makePage({ body: searchBody([best, DEFAULT[2]]), chrome, url: 'https://www.airbnb.de/s/Barcelona/homes?checkin=2026-05-01&checkout=2026-05-05&adults=4&items_offset=18' });
  const box = await until(() => shadow(p2.doc, 'sm-search')?.querySelector('.box'));
  assert.deepEqual(chrome.data.pool.pages, ['0', '18']);
  assert.deepEqual(Object.keys(chrome.data.pool.items).sort(), ['111', '222', '333', '999']);
  assert.match(box.textContent, /4 Unterkünfte von 2 Seiten/);
  assert.match(box.querySelector('.item a').textContent, /^1\. Titel 999/);
  assert.equal(p2.doc.querySelectorAll('[data-staymatch-badge]').length, 2, 'Plaketten nur an sichtbaren Karten');
  [...box.querySelectorAll('button')].find(b => b.textContent === 'Sammlung leeren').click();
  await until(() => chrome.data.pool?.pages.length === 1);
  assert.deepEqual(Object.keys(chrome.data.pool.items).sort(), ['333', '999']);
});

test('Dunkles Panel: Einstellung gilt sofort und beim Neuaufbau', { skip }, async () => {
  const chrome = chromeMock({ trip: TRIP, settings: { theme: 'dark' } });
  const { doc } = makePage({ body: searchBody(), chrome });
  let box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.ok(box.classList.contains('dark'));
  await chrome.storage.local.set({ settings: { theme: 'light' } });
  box = shadow(doc, 'sm-search').querySelector('.box');
  assert.ok(box.classList.contains('light') && !box.classList.contains('dark'));
  await chrome.storage.local.set({ settings: { theme: 'auto' } });
  box = shadow(doc, 'sm-search').querySelector('.box');
  assert.ok(!box.classList.contains('light') && !box.classList.contains('dark'));
});

const ROOM = `<script type="application/ld+json">${JSON.stringify({ name: 'Loft Gràcia', aggregateRating: { ratingValue: '4.8', ratingCount: '55' }, geo: { latitude: 41.4, longitude: 2.16 }, address: { addressLocality: 'Barcelona' } })}</script>
  <div data-testid="book-it-default"><div>200 € pro Nacht</div></div>
  <div data-testid="review-1">Sehr steile Treppen und kein Aufzug. Nachts laut. Sauber war es.</div>`;
const ROOM_URL = 'https://www.airbnb.de/rooms/12345?checkin=2026-05-01&checkout=2026-05-05';

test('Unterkunftsseite: Warnhinweise aus Bewertungen, Preis pro Person, Speicherung', { skip }, async () => {
  const chrome = chromeMock({ trip: TRIP });
  const { doc } = makePage({ body: ROOM, url: ROOM_URL, chrome });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  assert.ok(box);
  assert.match(box.textContent, /Achtung aus den Bewertungen: .*Treppen.*kein Aufzug.*laut/);
  assert.match(box.textContent, /50 € pro Person und Nacht/);
  assert.match(box.textContent, /Viertel Gràcia: 82/);
  assert.ok(chrome.data['l:12345'].hints.includes('⚠️ Treppen'));
});

test('Unterkunftsseite: Alt+Shift+L vergibt 👍, zweiter Druck nimmt zurück, Alt+Shift+N 👎', { skip }, async () => {
  const chrome = chromeMock();
  const { doc, w } = makePage({ body: ROOM, url: ROOM_URL, chrome });
  await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  const press = code => doc.body.dispatchEvent(new w.KeyboardEvent('keydown', { code, altKey: true, shiftKey: true, bubbles: true }));
  press('KeyL'); await until(() => chrome.data['l:12345'].vote === 1);
  assert.equal(chrome.data['l:12345'].vote, 1);
  press('KeyL'); await until(() => chrome.data['l:12345'].vote === 0);
  assert.equal(chrome.data['l:12345'].vote, 0);
  press('KeyN'); await until(() => chrome.data['l:12345'].vote === -1);
  assert.equal(chrome.data['l:12345'].vote, -1);
});

test('Frühere Warnstichworte erscheinen als Warnung auf der Suchseite', { skip }, async () => {
  const chrome = chromeMock({ trip: TRIP, 'l:222': { id: '222', hints: ['⚠️ Treppen'], lastSeen: 1, visits: 1 } });
  const { doc } = makePage({ body: searchBody(), chrome });
  await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  const b = [...doc.querySelectorAll('[data-testid="card-container"]')].find(c => c.querySelector('a[href*="/rooms/222"]')).querySelector('[data-staymatch-badge]');
  assert.match(b.title, /Treppen/);
});

test('Manifest: Version 0.5.0, keine neuen Berechtigungen, alle Skripte vorhanden', () => {
  const m = require('../extension/manifest.json');
  assert.equal(m.version, '0.5.0');
  assert.deepEqual(m.permissions, ['storage']);
  assert.equal(m.host_permissions, undefined);
  const js = m.content_scripts[0].js;
  assert.deepEqual(js, ['core.js', 'parse.js', 'rank.js', 'hints.js', 'pool.js', 'content-common.js', 'content-search.js', 'content-listing.js']);
  for (const f of m.content_scripts.flatMap(c => c.js)) assert.ok(require('node:fs').existsSync(require('node:path').join(__dirname, '..', 'extension', f)), f);
});

test('Plugin lädt keine fremden Adressen nach (kein fetch/XHR/WebSocket im Code)', () => {
  const fs = require('node:fs');
  for (const f of [...D.CONTENT_SCRIPTS, 'popup.js', 'bridge.js']) {
    const s = fs.readFileSync(require('node:path').join(__dirname, '..', 'extension', f), 'utf8');
    assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|chrome\.(tabs|webRequest|scripting|alarms)/.test(s), f);
  }
});

test('Popup: Einstellungen funktionieren ohne vorherigen Import, Merkliste wird kopiert', { skip }, async () => {
  const fs = require('node:fs'), path = require('node:path');
  const chrome = chromeMock({ settings: { showBadges: true }, trip: TRIP, 'l:1': { id: '1', title: 'Loft', vote: 1, rating: 4.8, pricePerNight: 200, url: 'https://www.airbnb.de/rooms/1', locality: 'Gràcia', note: 'Balkon' }, 'l:2': { id: '2', title: 'Nein', vote: -1 } });
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  let copied = null;
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('popup.js'));
  await until(() => w.document.getElementById('optTheme').value === 'auto' && w.document.getElementById('list').children.length);
  const theme = w.document.getElementById('optTheme'); theme.value = 'dark'; theme.dispatchEvent(new w.Event('change'));
  await until(() => chrome.data.settings.theme === 'dark');
  assert.equal(chrome.data.settings.theme, 'dark');
  assert.equal(chrome.data.settings.showBadges, true, 'andere Einstellungen bleiben');
  const cb = w.document.getElementById('optBadges'); cb.checked = false; cb.dispatchEvent(new w.Event('change'));
  await until(() => chrome.data.settings.showBadges === false);
  assert.equal(chrome.data.settings.showBadges, false);
  assert.equal(chrome.data.settings.theme, 'dark');
  w.document.getElementById('share').click();
  await until(() => copied);
  assert.match(copied, /^Unsere Merkliste \(StayMatch\)\n\n1\. Loft – Gràcia · ⭐ 4,8 · 50 € p\. P\.\/Nacht\n {3}Notiz: Balkon\n {3}https:\/\/www\.airbnb\.de\/rooms\/1$/);
  assert.ok(!copied.includes('Nein'), '👎 nicht in der Merkliste');
});

test('Eine Person: „Top 3 für dich“, kein Preis pro Person, Wünsche aus dem Viertel-Finder', { skip }, async () => {
  const solo = { ...TRIP, people: [{ name: 'Du', type: 'sights' }], wishes: ['trusted'], savedAt: 5 };
  const { doc, chrome } = makePage({ body: searchBody(), url: 'https://www.airbnb.de/s/Barcelona/homes?checkin=2026-05-01&checkout=2026-05-05&adults=1', chrome: chromeMock({ trip: solo }) });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.ok(box, 'Panel fehlt');
  assert.match(box.textContent, /Top 3 für dich/);
  assert.match(box.textContent, /1 Person\b/);
  assert.doesNotMatch(box.textContent, /pro Person|für euch|Betten.*für 1/);
  assert.deepEqual(chrome.data.quick.wishes, ['trusted'], 'Wünsche übernommen');
  assert.match(box.textContent, /✓ Superhost oder Gäste-Favorit|Wunsch nicht erfüllt: kein Superhost/, 'Wunsch fließt ins Ranking');
});

test('Popup, eine Person: „Meine Merkliste“ ohne Preis pro Person', { skip }, async () => {
  const fs = require('node:fs'), path = require('node:path');
  const chrome = chromeMock({ settings: { showBadges: true }, trip: { ...TRIP, people: [{ name: 'Du', type: 'sights' }] }, 'l:1': { id: '1', title: 'Loft', vote: 1, rating: 4.8, pricePerNight: 200, url: 'https://www.airbnb.de/rooms/1', locality: 'Gràcia', note: 'Balkon' }, 'l:2': { id: '2', title: 'Nein', vote: -1 } });
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  let copied = null;
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { copied = t; } }, configurable: true });
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('popup.js'));
  await until(() => w.document.getElementById('optTheme').value === 'auto' && w.document.getElementById('list').children.length);
  const theme = w.document.getElementById('optTheme'); theme.value = 'dark'; theme.dispatchEvent(new w.Event('change'));
  await until(() => chrome.data.settings.theme === 'dark');
  assert.equal(chrome.data.settings.theme, 'dark');
  assert.equal(chrome.data.settings.showBadges, true, 'andere Einstellungen bleiben');
  const cb = w.document.getElementById('optBadges'); cb.checked = false; cb.dispatchEvent(new w.Event('change'));
  await until(() => chrome.data.settings.showBadges === false);
  assert.equal(chrome.data.settings.showBadges, false);
  assert.equal(chrome.data.settings.theme, 'dark');
  w.document.getElementById('share').click();
  await until(() => copied);
  assert.match(copied, /^Meine Merkliste \(StayMatch\)\n\n1\. Loft – Gràcia · ⭐ 4,8\n {3}Notiz: Balkon\n {3}https:\/\/www\.airbnb\.de\/rooms\/1$/);
  assert.ok(!copied.includes('Nein'), '👎 nicht in der Merkliste');
});

test('Ohne Reise: Hinweis spricht Einzelreisende an, nicht „Mit Freunden“', { skip }, async () => {
  const { doc } = makePage({ body: searchBody(), chrome: chromeMock({}) });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.ok(box, 'Panel fehlt');
  assert.match(box.textContent, /Tipp: Im Viertel-Finder findest du vorher das Viertel, das zu dir passt/);
  assert.doesNotMatch(box.textContent, /Mit Freunden/);
});
