// Runde 8: Popup, Speicher, Datenschutz (import.js, popup.js, content-common.js, content-listing.js, bridge.js). Synthetische Seiten, kein echtes Airbnb.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until, sleep } = D;
test.after(D.closeAll);

vm.runInThisContext(D.src('import.js'));
const I = globalThis.StayMatchImport;

// ---------- import.js (reine Funktionen) ----------
test('Import: Kennung und Version werden geprüft', () => {
  assert.throws(() => I.parseImport('kaputt'), /JSON/);
  assert.throws(() => I.parseImport(JSON.stringify({ format: 'anderes', listings: {} })), /keine StayMatch-Merkliste/);
  assert.throws(() => I.parseImport(JSON.stringify({ format: 'staymatch-merkliste', version: 99, listings: {} })), /neueren/);
  assert.throws(() => I.parseImport(JSON.stringify({ format: 'staymatch-merkliste', version: 1 })), /Liste/);
  const ok = I.parseImport(JSON.stringify({ format: 'staymatch-merkliste', version: 1, listings: { a: { id: '5', title: 'X' }, b: { id: 'x' } } }));
  assert.equal(ok.entries.length, 1); assert.equal(ok.skipped, 1);
  assert.equal(ok.entries[0].schema, I.SCHEMA);
  // ältere Datei ohne Kennung bleibt lesbar
  assert.equal(I.parseImport(JSON.stringify({ a: { id: '7' } })).entries.length, 1);
});

test('Import: Merge behält Notiz, Stimme und Besuche, neuerer Stand gewinnt', () => {
  const have = { id: '1', title: 'Alt', note: 'Balkon', vote: 1, visits: 5, firstSeen: 100, lastSeen: 1000, priceHistory: [{ t: 1, p: 90 }] };
  const inc = { id: '1', title: 'Neu', rating: 4.9, visits: 2, firstSeen: 50, lastSeen: 2000, priceHistory: [{ t: 2, p: 95 }] };
  const m = I.mergeListing(have, inc);
  assert.equal(m.title, 'Neu'); assert.equal(m.rating, 4.9);
  assert.equal(m.note, 'Balkon'); assert.equal(m.vote, 1);
  assert.equal(m.visits, 5); assert.equal(m.firstSeen, 50); assert.equal(m.lastSeen, 2000);
  assert.deepEqual(m.priceHistory.map(e => e.p), [90, 95]);
  // ältere Datei überschreibt Neueres nicht
  const m2 = I.mergeListing({ ...inc, note: 'jetzt' }, { id: '1', title: 'Alt', note: 'früher', lastSeen: 10 });
  assert.equal(m2.title, 'Neu'); assert.equal(m2.note, 'jetzt');
});

test('Import: applyImport schreibt zusammengeführt und zählt', async () => {
  const c = chromeMock({ 'l:1': { id: '1', note: 'bleibt', lastSeen: 5 } });
  const r = await I.applyImport(c.storage.local, [{ id: '1', title: 'T', lastSeen: 9 }, { id: '2', title: 'N' }]);
  assert.deepEqual(r, { added: 1, merged: 1 });
  assert.equal(c.data['l:1'].note, 'bleibt'); assert.equal(c.data['l:1'].title, 'T');
  assert.equal(c.data['l:2'].title, 'N');
});

test('Teilen-Export: nichts Persönliches bleibt übrig', () => {
  const l = { 1: { id: '1', title: 'Loft', note: 'geheim', hostId: '99', priceHistory: [{ t: 1, p: 5, ci: '2026-05-01' }], booked: { at: 1, checkin: '2026-05-01' }, checkin: '2026-05-01', checkout: '2026-05-05', visits: 3, lastSeen: 5, reviewTexts: ['x'], rating: 4.8, url: 'https://www.airbnb.de/rooms/1' } };
  const s = JSON.stringify(I.sanitizeListings(l));
  for (const w of ['geheim', '99', 'priceHistory', 'booked', '2026-05', 'reviewTexts', 'visits']) assert.ok(!s.includes(w), w);
  assert.ok(s.includes('Loft') && s.includes('4.8'));
  const t = I.sanitizeTrip({ city: 'X', checkin: '2026-05-01', savedAt: 1, people: [{ name: 'Lena', type: 'adult' }], areas: [{ name: 'A', minName: 'Lena' }] });
  assert.ok(!JSON.stringify(t).includes('Lena') && !JSON.stringify(t).includes('2026'));
});

test('Schema: Migration ist idempotent und setzt Mindestwerte', () => {
  const a = I.migrateListing({ id: '1', visits: 0, priceHistory: 'x' });
  assert.equal(a.schema, I.SCHEMA); assert.equal(a.visits, 1); assert.equal(a.priceHistory, undefined);
  assert.deepEqual(I.migrateListing(a), a);
  assert.equal(I.migrateSettings({ theme: 'dark' }).schema, I.SCHEMA);
});

test('Lokales Datum statt UTC', () => {
  assert.equal(I.localDay(new Date(2026, 10, 14, 0, 30)), '2026-11-14'); // 00:30 Ortszeit bleibt am 14.
  assert.equal(I.localDay(new Date(2026, 0, 2, 23, 59)), '2026-01-02');
});

// ---------- Popup ----------
function popup(data) {
  const chrome = chromeMock(data);
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  for (const f of ['core.js', 'rank.js', 'extras.js', 'import.js', 'popup.js']) w.eval(D.src(f));
  return { w, chrome, doc: w.document };
}
const click = (doc, id) => doc.getElementById(id).click();

test('Popup: „verlauf“ löscht auch Freundes-Listen, Preis-Mediane, Statistik und Geschmack; Rückgängig stellt her', { skip }, async () => {
  const { w, chrome, doc } = popup({ settings: { theme: 'dark' }, trip: { savedAt: 1 }, 'l:1': { id: '1' }, priceLog: [{ path: 'barcelona' }], friendLikes: { 5: ['Lena'] }, stats: { day: 'x' }, tasteIgnore: ['Gràcia'], lastSearch: { at: 1 } });
  await until(() => doc.getElementById('list').children.length);
  w.prompt = () => 'verlauf'; w.confirm = () => false; click(doc, 'wipe');
  await until(() => !chrome.data['l:1']);
  for (const k of ['l:1', 'priceLog', 'friendLikes', 'stats', 'tasteIgnore']) assert.ok(!(k in chrome.data), k);
  assert.ok(chrome.data.settings && chrome.data.trip && chrome.data.lastSearch);
  const undo = await until(() => [...doc.querySelectorAll('#list button')].find(b => b.textContent === 'Rückgängig'));
  undo.click();
  await until(() => chrome.data['l:1']);
  assert.ok(chrome.data['l:1'] && chrome.data.friendLikes);
});

test('Popup: „zwischenspeicher“ räumt die Preis-Mediane (Stadtpfad + Reisedaten) weg', { skip }, async () => {
  const { w, chrome, doc } = popup({ 'l:1': { id: '1' }, priceLog: [{ path: 'barcelona', ci: '2026-05-01' }], pool: { pages: [] } });
  await until(() => doc.getElementById('list').children.length);
  w.prompt = () => 'zwischenspeicher'; click(doc, 'wipe');
  await until(() => !chrome.data.priceLog);
  assert.ok(!chrome.data.priceLog && chrome.data['l:1']);
});

test('Popup: „alles“ bietet vorher die Sicherung an', { skip }, async () => {
  const { w, chrome, doc } = popup({ 'l:1': { id: '1', note: 'n' }, friendLikes: { 5: ['Lena'] } });
  await until(() => doc.getElementById('list').children.length);
  let blob = null, asked = 0; w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; w.HTMLAnchorElement.prototype.click = () => {};
  w.prompt = () => 'alles'; w.confirm = m => { asked++; return /Sicherung/.test(m); };
  click(doc, 'wipe');
  await until(() => !chrome.data['l:1']);
  assert.equal(asked, 1); assert.ok(blob);
  const text = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blob); });
  assert.match(text, /"note": "n"/); assert.match(text, /Lena/);
});

test('Popup: Teilen-Export entfernt Gastgeber, Preisverlauf, Buchung, Reisedaten', { skip }, async () => {
  const { w, doc } = popup({ 'l:1': { id: '1', title: 'Loft', note: 'geheim', hostId: '4711', priceHistory: [{ t: 1, p: 5 }], booked: { at: 1 }, checkin: '2026-05-01' } });
  await until(() => doc.getElementById('list').children.length);
  let blob = null; w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; w.HTMLAnchorElement.prototype.click = () => {};
  w.confirm = () => false; click(doc, 'export');
  const text = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blob); });
  for (const x of ['geheim', '4711', 'priceHistory', 'booked', '2026-05-01']) assert.ok(!text.includes(x), x);
  assert.match(text, /Loft/);
});

test('Popup: Freundes-Listen sind sichtbar und einzeln löschbar', { skip }, async () => {
  const { chrome, doc } = popup({ friendLikes: { 5: ['Lena'], 6: ['Lena', 'Tom'] }, 'l:1': { id: '1' } });
  await until(() => doc.getElementById('friendList').children.length);
  assert.match(doc.getElementById('friendList').textContent, /Lena: 2 Unterkünfte/);
  assert.match(doc.getElementById('friendList').textContent, /Tom: 1 Unterkünfte/);
  [...doc.querySelectorAll('#friendList button')][0].click();
  await until(() => !chrome.data.friendLikes[5]);
  assert.deepEqual(chrome.data.friendLikes, { 6: ['Tom'] });
});

test('Popup: Import führt zusammen, prüft Format, Datei mit neuerer Version wird abgelehnt', { skip }, async () => {
  const { w, chrome, doc } = popup({ 'l:5': { id: '5', title: 'Alt', note: 'bleibt', vote: 1, lastSeen: 5 } });
  await until(() => doc.getElementById('list').children.length);
  const input = doc.getElementById('file');
  const feed = async obj => { Object.defineProperty(input, 'files', { value: [{ text: async () => JSON.stringify(obj) }], configurable: true }); await input.onchange({ target: input }); };
  const alerts = []; w.alert = m => alerts.push(m);
  await feed({ format: 'staymatch-merkliste', version: 1, listings: { a: { id: '5', title: 'Neu', lastSeen: 9 } } });
  assert.equal(chrome.data['l:5'].note, 'bleibt'); assert.equal(chrome.data['l:5'].title, 'Neu'); assert.equal(chrome.data['l:5'].vote, 1);
  assert.match(doc.getElementById('list').textContent, /1 mit vorhandenen zusammengeführt/);
  await feed({ format: 'staymatch-merkliste', version: 7, listings: {} });
  assert.match(alerts.at(-1), /neueren/);
});

test('Popup: Import-Knopf öffnet die Optionsseite in einem Tab', { skip }, async () => {
  const { w, chrome, doc } = popup({});
  chrome.runtime.getURL = p => 'chrome-extension://x/' + p;
  await until(() => doc.getElementById('list').children.length);
  let opened = null; w.open = u => { opened = u; };
  click(doc, 'import');
  assert.equal(opened, 'chrome-extension://x/options.html');
});

test('Popup: Geschmack zeigt die Mindestnote (Median − 0,05), nicht den Durchschnitt', { skip }, async () => {
  const { doc } = popup({ 'l:1': { id: '1', vote: 1, rating: 5 }, 'l:2': { id: '2', vote: 1, rating: 4.9 }, 'l:3': { id: '3', vote: 1, rating: 4.5 } });
  await until(() => doc.getElementById('profile').textContent.includes('Geschmack'));
  assert.match(doc.getElementById('profile').textContent, /⭐ ab 4,85/); // Median 4,9 − 0,05; Durchschnitt wäre 4,80
});

test('Popup: Preisalter nennt das Datum', { skip }, async () => {
  const t = new Date(2025, 10, 12, 12).getTime();
  const { doc } = popup({ 'l:1': { id: '1', title: 'Loft', pricePerNight: 100, lastSeen: t, vote: 1 } });
  doc.querySelector('#tab-all').click();
  await until(() => doc.querySelector('#list a.item'));
  assert.match(doc.getElementById('list').textContent, /Preis vom 12\.11\./);
  assert.ok(!doc.getElementById('list').textContent.includes('24 h'));
});

test('Popup: Verlauf sortierbar und nach „gebucht“ filterbar; Tab und Sortierung bleiben', { skip }, async () => {
  const now = Date.now();
  const { chrome, doc } = popup({ 'l:1': { id: '1', title: 'Teuer', pricePerNight: 300, lastSeen: now }, 'l:2': { id: '2', title: 'Günstig', pricePerNight: 80, lastSeen: now - 5, booked: { at: now } } });
  doc.querySelector('#tab-all').click();
  await until(() => doc.querySelectorAll('#list .item').length === 2);
  const names = () => [...doc.querySelectorAll('#list .item')].map(a => a.textContent);
  assert.match(names()[0], /Teuer/);
  const sort = doc.getElementById('sort'); sort.value = 'price'; sort.onchange({ target: sort });
  assert.match(names()[0], /Günstig/);
  const ob = doc.getElementById('onlyBooked'); ob.checked = true; ob.onchange({ target: ob });
  assert.equal(doc.querySelectorAll('#list .item').length, 1);
  await until(() => chrome.data.popupUi);
  assert.equal(chrome.data.popupUi.tab, 'all'); assert.equal(chrome.data.popupUi.sort, 'price');
  // neues Popup merkt sich beides
  const p2 = popup({ popupUi: chrome.data.popupUi, 'l:1': { id: '1', title: 'Teuer', lastSeen: now } });
  await until(() => p2.doc.querySelector('#tab-all').classList.contains('on'));
  assert.equal(p2.doc.getElementById('sort').value, 'price');
});

test('Popup: schnelle Einstellungs-Klicks überschreiben sich nicht', { skip }, async () => {
  const { chrome, doc } = popup({ settings: { theme: 'auto' } });
  await until(() => doc.getElementById('list').children.length);
  const a = doc.getElementById('optScoreOnly'), b = doc.getElementById('optBlind');
  a.checked = true; a.onchange({ target: a }); b.checked = true; b.onchange({ target: b });
  await until(() => chrome.data.settings.scoreOnly && chrome.data.settings.blind);
  assert.ok(chrome.data.settings.scoreOnly && chrome.data.settings.blind && chrome.data.settings.schema === I.SCHEMA);
});

// ---------- Unterkunftsseite ----------
const ROOM = `<main><script type="application/ld+json">{"name":"Loft","aggregateRating":{"ratingValue":"4.9","ratingCount":212}}</script>
<h2 data-testid="review-title">212 Bewertungen und viele weitere Wörter</h2>
<div data-section-id="REVIEWS_DEFAULT"><div data-review-id="r1">Sehr ruhig und sauber, tolle Lage, aber viele Treppen und kein Aufzug.</div><div data-review-id="r2">Alles wunderbar, würden wir wieder buchen jederzeit.</div></div>
<div data-testid="book-it-default">100 € pro Nacht</div></main>`;
const ROOM_URL = 'https://www.airbnb.de/rooms/12345?checkin=2026-05-01&checkout=2026-05-05';
const press = (doc, w, code, extra = {}) => doc.body.dispatchEvent(new w.KeyboardEvent('keydown', { code, altKey: true, shiftKey: true, bubbles: true, ...extra }));

test('Tasten: gehaltene Taste (repeat) toggelt nicht; Alt+Shift+M speichert den Einklapp-Zustand', { skip }, async () => {
  const chrome = chromeMock();
  const { doc, w } = makePage({ body: ROOM, url: ROOM_URL, chrome });
  await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  press(doc, w, 'KeyL'); await until(() => chrome.data['l:12345']?.vote === 1);
  press(doc, w, 'KeyL', { repeat: true }); press(doc, w, 'KeyL', { repeat: true });
  await sleep(40);
  assert.equal(chrome.data['l:12345'].vote, 1);
  press(doc, w, 'KeyM');
  await until(() => chrome.data['min:sm-room'] === true);
  assert.equal(chrome.data['min:sm-room'], true);
});

test('Pause: nichts gespeichert, Besuch nicht gezählt, Panel sagt es; Klicks auf 👍 gehen trotzdem durch', { skip }, async () => {
  const chrome = chromeMock({ settings: { pauseUntil: Date.now() + 3600e3 } });
  const { doc, w } = makePage({ body: ROOM, url: ROOM_URL, chrome });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  assert.match(box.textContent, /Pause aktiv, nichts wird gespeichert/);
  assert.ok(!chrome.data['l:12345']);
  press(doc, w, 'KeyL'); await until(() => chrome.data['l:12345']?.vote === 1);
  assert.equal(chrome.data['l:12345'].vote, 1);
});

test('Pause gilt schon vor dem Eintreffen der Einstellungen (kein Schreiben mit Standardwerten)', { skip }, async () => {
  const chrome = chromeMock({ settings: { pauseUntil: Date.now() + 3600e3 } });
  const get = chrome.storage.local.get;
  chrome.storage.local.get = async k => { if (k === 'settings') await sleep(60); return get(k); }; // Einstellungen kommen spät
  const { doc } = makePage({ body: ROOM, url: ROOM_URL, chrome });
  await sleep(150);
  assert.ok(!chrome.data['l:12345'], 'trotz Pause geschrieben');
  assert.ok(shadow(doc, 'sm-room'));
});

test('Bewertungs-Selektor: Überschrift zählt nicht; Panel nennt „2 gelesen von 212“; Hinweise werden bei leerem Ergebnis ersetzt', { skip }, async () => {
  const chrome = chromeMock({ 'l:12345': { id: '12345', hints: ['⚠️ Treppen'], lastSeen: 1, visits: 1 } });
  const body = ROOM.replace(/Sehr ruhig[^<]*/, 'Alles gut und die Gastgeber sind freundlich gewesen').replace(/Alles wunderbar[^<]*/, 'Sehr schöne Wohnung und genau wie auf den Fotos');
  const { doc } = makePage({ body, url: ROOM_URL, chrome });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  assert.match(box.textContent, /Aus den Bewertungen \(2 gelesen von 212\)/);
  assert.equal(chrome.data['l:12345'].reviewsRead, 2);
  assert.ok(!(chrome.data['l:12345'].hints || []).includes('⚠️ Treppen'), 'alter Hinweis blieb stehen');
});

test('Unterkunftsseite: zweiter Leseversuch, wenn beim ersten der Preis fehlte', { skip }, async () => {
  const chrome = chromeMock();
  const noPrice = ROOM.replace('<div data-testid="book-it-default">100 € pro Nacht</div>', '<div data-testid="book-it-default"></div>');
  const { doc } = makePage({ body: noPrice, url: ROOM_URL, chrome, test: { roomRetry: 30 } });
  await until(() => chrome.data['l:12345']);
  doc.querySelector('[data-testid="book-it-default"]').textContent = '100 € pro Nacht';
  await until(() => chrome.data['l:12345'].pricePerNight);
  assert.equal(chrome.data['l:12345'].pricePerNight, 100);
});

test('Panel: Tasten-Hinweise, aria-pressed, forced-colors-Regel, geteiltes Stylesheet', { skip }, async () => {
  const { doc } = makePage({ body: ROOM, url: ROOM_URL, chrome: chromeMock() });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  const like = [...box.querySelectorAll('button')].find(b => b.textContent.includes('Gefällt'));
  assert.equal(like.getAttribute('aria-keyshortcuts'), 'Alt+Shift+L');
  assert.equal(like.getAttribute('aria-pressed'), 'false');
  assert.match(D.src('content-common.js'), /forced-colors: active/);
  assert.match(D.src('content-common.js'), /adoptedStyleSheets/);
});

test('Schema: alter Eintrag ohne schema wird beim Speichern migriert', { skip }, async () => {
  const chrome = chromeMock({ 'l:12345': { id: '12345', visits: 0, lastSeen: 1 } });
  makePage({ body: ROOM, url: ROOM_URL, chrome });
  await until(() => chrome.data['l:12345'].schema);
  assert.equal(chrome.data['l:12345'].schema, 2);
});

// ---------- Brücke ----------
test('Brücke: schreibt nur bei Änderung', async () => {
  const sets = [];
  const store = {};
  const trip = { savedAt: 5, city: 'Rom', nights: 3 };
  const listeners = {};
  const ctx = { localStorage: { getItem: () => JSON.stringify(trip) }, chrome: { storage: { local: { get: async () => ({ trip: store.trip }), set: async o => { sets.push(o); Object.assign(store, o); } } } }, window: { addEventListener: (n, f) => { listeners[n] = f; } }, document: { documentElement: { dataset: {} } } };
  vm.runInNewContext(D.src('bridge.js'), ctx);
  await sleep(10);
  assert.equal(sets.length, 1);
  listeners['staymatch:trip'](); listeners['staymatch:trip'](); await sleep(10);
  assert.equal(sets.length, 1, 'gleiche Reise wurde erneut geschrieben');
});

test('Brücke: gleiche Reise im Speicher (anderer Tab) wird nicht neu geschrieben', async () => {
  const sets = [];
  const trip = { savedAt: 5, city: 'Rom', nights: 3 };
  const ctx = { localStorage: { getItem: () => JSON.stringify(trip) }, chrome: { storage: { local: { get: async () => ({ trip }), set: async o => { sets.push(o); } } } }, window: { addEventListener() {} }, document: { documentElement: { dataset: {} } } };
  vm.runInNewContext(D.src('bridge.js'), ctx);
  await sleep(10);
  assert.equal(sets.length, 0);
});

test('Options-Seite lädt nur lokale Skripte und hat Dateifeld', () => {
  const html = D.src('options.html');
  assert.match(html, /type="file"/);
  assert.ok(!/<script(?![^>]*src=)[^>]*>/.test(html), 'Inline-Skript (MV3-CSP)');
  for (const f of ['core.js', 'import.js', 'options.js']) assert.ok(html.includes(`src="${f}"`), f);
});

test('Pause gilt auch auf der Suchseite, bevor die Einstellungen da sind (Sammlung, letzte Suche, Preis-Mediane, Statistik)', { skip }, async () => {
  const chrome = chromeMock({ settings: { pauseUntil: Date.now() + 3600e3 } });
  const get = chrome.storage.local.get;
  chrome.storage.local.get = async k => { if (k === 'settings') await sleep(80); return get(k); };
  const { doc } = makePage({ body: searchBody(), chrome });
  await until(() => shadow(doc, 'sm-search')?.querySelector('.box'), 2500);
  await sleep(150);
  for (const k of ['pool', 'lastSearch', 'priceLog', 'stats']) assert.ok(!(k in chrome.data), k + ' trotz Pause geschrieben');
});

test('Sperre: Speichern nimmt navigator.locks, wenn vorhanden, und fällt ohne zurück', { skip }, async () => {
  const chrome = chromeMock();
  const names = [];
  const { doc, w } = makePage({ body: ROOM, url: ROOM_URL, chrome });
  await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  assert.ok(chrome.data['l:12345']); // ohne navigator.locks (jsdom) geschrieben
  Object.defineProperty(w.navigator, 'locks', { value: { request: async (n, o, f) => { names.push(n); return f(); } }, configurable: true });
  press(doc, w, 'KeyL'); await until(() => chrome.data['l:12345'].vote === 1);
  assert.deepEqual([...new Set(names)], ['staymatch:l:12345']);
});

test('Import: volle Sicherung bringt Freundes-Listen zurück und Reise nur ohne vorhandene', async () => {
  const c = chromeMock({});
  const p = I.parseImport(JSON.stringify({ format: 'staymatch-merkliste', version: 1, listings: {}, friendLikes: { 5: ['Lena'] }, trip: { savedAt: 9, city: 'Rom' } }));
  await I.applyExtras(c.storage.local, p);
  assert.deepEqual(c.data.friendLikes, { 5: ['Lena'] }); assert.equal(c.data.trip.city, 'Rom');
  const c2 = chromeMock({ trip: { savedAt: 1, city: 'Alt' } });
  await I.applyExtras(c2.storage.local, p);
  assert.equal(c2.data.trip.city, 'Alt');
});
