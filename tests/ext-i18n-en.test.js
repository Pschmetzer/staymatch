// i18n: Panel, Unterkunftsseite, Fehlerseite, Popup und Optionen auf Englisch (jsdom): kein Deutsch, richtige Sprache, Formate.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const D = require('./helpers/dom.js');
const { GERMAN } = require('./helpers/german-scan.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

const textOf = root => [...root.querySelectorAll('*')].flatMap(e => [e.childNodes.length ? [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ') : '', ...['aria-label', 'title', 'placeholder', 'alt'].map(a => e.getAttribute(a) || '')]).join('\n');
const noGerman = (txt, what) => { const hit = txt.split('\n').filter(l => GERMAN.test(l)); assert.deepEqual(hit.slice(0, 5), [], what + ': deutscher Text auf Englisch'); };
const EN_URL = 'https://www.airbnb.com/s/Barcelona/homes?checkin=2026-05-01&checkout=2026-05-05&adults=4';

test('Suchseite auf airbnb.com ohne lang: Panel auf Englisch, html lang en, kein Deutsch', { skip }, async () => {
  const { doc, w } = D.makePage({ body: D.searchBody(), url: EN_URL, lang: '', chrome: D.chromeMock() });
  const root = await D.until(() => D.shadow(doc, 'sm-search')?.querySelector('.item.hotel') && D.shadow(doc, 'sm-search'));
  assert.ok(root, 'Panel da');
  assert.equal(w.StayMatchI18n.lang(), 'en'); assert.equal(root.querySelector('.box').getAttribute('lang'), 'en');
  noGerman(textOf(root), 'Panel');
  for (const b of doc.querySelectorAll('[data-staymatch-badge]')) assert.ok(!GERMAN.test(b.textContent + (b.title || '')), 'Plakette: ' + b.textContent);
});

test('Einstellung lang=de schlägt die Domain; lang=en schlägt html lang de', { skip }, async () => {
  const a = D.makePage({ body: D.searchBody(), url: EN_URL, lang: '', chrome: D.chromeMock({ settings: { lang: 'de' } }) });
  await D.until(() => D.shadow(a.doc, 'sm-search')?.querySelector('.item.hotel'));
  assert.match(textOf(D.shadow(a.doc, 'sm-search')), /Top 3/); assert.ok(GERMAN.test(textOf(D.shadow(a.doc, 'sm-search'))), 'Deutsch trotz .com');
  const b = D.makePage({ body: D.searchBody(), lang: 'de', chrome: D.chromeMock({ settings: { lang: 'en' } }) });
  await D.until(() => D.shadow(b.doc, 'sm-search')?.querySelector('.item.hotel'));
  noGerman(textOf(D.shadow(b.doc, 'sm-search')), 'lang=en trotz .de');
});

test('Suchseite ohne lesbare Karten: Fehlerseite auf Englisch', { skip }, async () => {
  const { doc } = D.makePage({ body: '<main></main>', url: EN_URL, lang: '', chrome: D.chromeMock() });
  const root = await D.until(() => D.shadow(doc, 'sm-error'));
  assert.ok(root); noGerman(textOf(root), 'Fehlerseite');
});

test('Unterkunftsseite auf Englisch: Panel mit Notiz-Feld ohne Deutsch', { skip }, async () => {
  const body = `<script type="application/ld+json">${JSON.stringify({ name: 'Loft', aggregateRating: { ratingValue: '4.8', ratingCount: '55' } })}</script><div data-testid="book-it-default"><div>$150 $120 night</div></div><div data-section-id="DESCRIPTION_DEFAULT">Please contact me on WhatsApp, we arrange payment in advance.</div>`;
  const { doc } = D.makePage({ body, url: 'https://www.airbnb.com/rooms/4242?checkin=2026-05-01&checkout=2026-05-05', lang: '', chrome: D.chromeMock() });
  const root = await D.until(() => D.shadow(doc, 'sm-room')?.querySelector('.box') && D.shadow(doc, 'sm-room'));
  assert.ok(root); noGerman(textOf(root), 'Unterkunftsseite');
});

test('Speicher voll auf Englisch', { skip }, async () => {
  const chrome = D.chromeMock(); const real = chrome.storage.local.set;
  chrome.storage.local.set = async o => { if (Object.keys(o).some(k => k.startsWith('l:'))) throw new Error('QUOTA_BYTES quota exceeded'); return real(o); };
  const { doc } = D.makePage({ body: `<script type="application/ld+json">${JSON.stringify({ name: 'Loft' })}</script>`, url: 'https://www.airbnb.com/rooms/4242', lang: '', chrome });
  const root = await D.until(() => D.shadow(doc, 'sm-storage'));
  assert.ok(root); noGerman(textOf(root), 'Speicher-voll');
});

async function extPage(file, scripts, chrome) {
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, file), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/' + file });
  const w = dom.window; w.chrome = chrome; D.track(w);
  for (const f of scripts) w.eval(D.src(f));
  await D.sleep(250); return w;
}
test('Popup auf Englisch (Browsersprache en): kein Deutsch, lang en', { skip }, async () => {
  const chrome = D.chromeMock({ trip: { savedAt: 1, city: 'Rome', people: [{ name: 'A', type: 'adult' }], nights: 4, budget: 300, areas: [] }, 'l:1': { id: '1', title: 'Loft', vote: 1, rating: 4.8, pricePerNight: 200, currency: '€', url: 'https://www.airbnb.com/rooms/1', lastSeen: Date.now(), visits: 1, schema: 2 } });
  chrome.i18n.getUILanguage = () => 'en-US';
  const w = await extPage('popup.html', ['core.js', 'rank.js', 'extras.js', 'import.js', 'reminders.js', 'popup.js'], chrome);
  assert.equal(w.document.documentElement.lang, 'en'); noGerman(textOf(w.document.body), 'Popup');
});
test('Optionen auf Englisch: kein Deutsch; Sprachwahl speichert settings.lang', { skip }, async () => {
  const chrome = D.chromeMock(); chrome.i18n.getUILanguage = () => 'en-US';
  const w = await extPage('options.html', ['core.js', 'reminders.js', 'import.js', 'options.js'], chrome);
  assert.equal(w.document.documentElement.lang, 'en'); noGerman(textOf(w.document.body), 'Optionen');
  const sel = w.document.getElementById('lang'); assert.ok(sel, 'Sprachwahl (#lang)');
  sel.value = 'de'; sel.dispatchEvent(new w.Event('change')); await D.until(() => chrome.data.settings?.lang === 'de'); assert.equal(chrome.data.settings.lang, 'de');
});
