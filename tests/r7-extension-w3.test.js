// Runde 7, Welle 3: Extension. Synthetische Eingaben (keine Airbnb-Kopien). Live-Verhalten von Airbnb ist hier NICHT geprüft.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs'), path = require('node:path');
require('../extension/parse.js');
require('../extension/rank.js');
const { StayMatchParse: P, StayMatchRank: R } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until, sleep } = D;
test.after(D.closeAll);

test('R7: Parser: „lei“ im Text, Badge gekürzt, gewerbliche Gastgeber, Superhost-Frage, Kurtaxe „plus“', () => {
  assert.equal(P.currency('Una casa per lei'), null);
  assert.equal(P.currency('120 lei'), 'lei');
  assert.equal(P.currency('Preis in kr'), null);
  assert.equal(P.normBadge({ text: 'x'.repeat(80) + '\u0007' }).length, 40);
  assert.equal(P.normBadge({ text: 'Gäste-Favorit' }), 'Gäste-Favorit');
  for (const t of ['host professionista', 'professionele host', 'anfitrião profissional']) assert.equal(P.details([t]).pro, true, t);
  assert.equal(P.hostInfo('Was ist ein Superhost?').superhost, false);
  assert.equal(P.hostInfo('Anna ist Superhost.').superhost, true);
  assert.equal(P.touristTax('City tax applies. Plus a lovely tax-free shop nearby.').extraOnSite, false);
  assert.equal(P.touristTax('Plus 3 € Kurtaxe pro Nacht').extraOnSite, true);
});

test('R7: Zufallstest Preiszeilen: Betrag × Währung × Reihenfolge × Trennzeichen', () => {
  const CURS = ['€', '$', '£', 'CHF', 'zł', 'kr', 'R$', 'US$', '₹'];
  const SEPS = [{ th: '.', dec: ',' }, { th: ',', dec: '.' }, { th: ' ', dec: ',' }, { th: ' ', dec: ',' }];
  let seed = 7; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  const group = (n, th, indian) => {
    const s = String(n);
    if (indian && s.length > 3) { const last = s.slice(-3); let rest = s.slice(0, -3); const parts = []; while (rest.length > 2) { parts.unshift(rest.slice(-2)); rest = rest.slice(0, -2); } parts.unshift(rest); return parts.join(',') + ',' + last; }
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, th);
  };
  for (let i = 0; i < 400; i++) {
    const amount = 1 + rnd(2000000), cur = CURS[rnd(CURS.length)], sep = SEPS[rnd(SEPS.length)];
    const indian = cur === '₹' && rnd(2) === 0;
    const num = group(amount, indian ? ',' : sep.th, indian);
    const line = rnd(2) ? `${num} ${cur} total` : `${cur}${num} total`;
    const p = P.priceOf(line);
    assert.equal(p.amount, amount, line);
    assert.equal(p.currency, cur, line);
  }
});

test('R7: Merge: propertyId und Listing-Id getrennt, Rabatt bleibt, fehlender Titel wird gezählt', () => {
  const b64 = s => Buffer.from(s).toString('base64');
  const card = c => ({ innerText: c.text, querySelector: sel => sel.includes('/rooms/') ? { getAttribute: () => `/rooms/${c.id}` } : sel.includes('price-availability-row') ? { innerText: c.price } : sel.includes('listing-card-title') ? { innerText: 'Wohnung in X' } : null, querySelectorAll: () => [] });
  const doc = (state, cards) => ({ querySelectorAll: sel => sel.includes('data-deferred-state') ? [{ textContent: JSON.stringify({ staysSearch: { results: { searchResults: state } } }) }] : sel.includes('card-container') ? cards.map(card) : [], getElementById: () => null });
  // State-Eintrag 7 hat zufällig propertyId 8; Karte 8 ist eine andere Unterkunft mit eigenem State-Eintrag
  const state = [
    { demandStayListing: { id: b64('DemandStayListing:7') }, propertyId: '8', nameLocalized: { localizedStringWithTranslationPreference: 'Sieben' } },
    { demandStayListing: { id: b64('DemandStayListing:8') }, nameLocalized: { localizedStringWithTranslationPreference: 'Acht' } },
  ];
  const out = P.parseSearch(doc(state, [{ id: '8', text: 'x', price: '896 € 702 € gesamt' }]));
  assert.equal(out[0].title, 'Acht');
  assert.equal(out[0].discounted, true);
  // gleicher Betrag: State-Einheit (pro Nacht) gilt weiter, auch wenn die DOM-Zeile ein Gesamt-Wort enthält
  const night = P.parseSearch(doc([{ demandStayListing: { id: b64('DemandStayListing:3') }, structuredDisplayPrice: { primaryLine: { accessibilityLabel: '120 € pro Nacht' } } }],
    [{ id: '3', text: 'x', price: '120 € pro Nacht · 480 € gesamt' }]));
  assert.equal(night[0].isTotal, false);
  const lone = P.parseSearch(doc([], [{ id: '9', text: 'x', price: '100 € gesamt' }]));
  assert.equal(P.quality(lone).noTitle, 1);
});

test('R7: Ranking: Preise gruppiert, Gleichstand ohne Luxus-Wunsch günstiger zuerst, „schon angesehen“ neutral, Notizen nur auf Wunsch', () => {
  assert.equal(R.money(1234.5, '€'), '1.235 €');
  assert.equal(R.money(80, null), '80');
  const a = { id: 'a', title: 'Villa Luxus', totalPrice: 900, isTotal: true }, b = { id: 'b', title: 'Wohnung', totalPrice: 500, isTotal: true };
  assert.deepEqual(R.rankListings([a, b], { nights: 2 }).map(l => l.id), ['b', 'a']);
  const r = R.scoreListing({ id: '1' }, { seen: new Set(['1']) });
  assert.ok(!r.why.includes('schon angesehen'));
  assert.ok(r.info.includes('schon angesehen'));
  assert.ok(!R.shareText([{ title: 'X', note: 'geheim' }]).includes('geheim'));
  assert.ok(R.shareText([{ title: 'X', note: 'geheim' }], { notes: true }).includes('geheim'));
  const area = R.areaFor({ locality: 'Sant Gervasi' }, [{ name: 'Sant Gervasi Galvany', lat: 41.40, lon: 2.14, total: 80 }, { name: 'Sant Gervasi Bonanova', lat: 41.42, lon: 2.12, total: 60 }]);
  assert.ok(Math.abs(area.lat - 41.41) < 1e-9 && Math.abs(area.lon - 2.13) < 1e-9);
  // gestaffelte Abzüge
  const base = { id: '1', rating: 4.8, reviewCount: 50 };
  const s0 = R.scoreListing(base, {}).score;
  const once = R.scoreListing(base, { known: new Map([['1', { hints: ['⚠️ laut'] }]]) }).score;
  const often = R.scoreListing(base, { known: new Map([['1', { hints: ['⚠️ laut (10×)'] }]]) }).score;
  assert.ok(s0 - once < s0 - often);
  // Prior aus der Seite: ein Markt mit Median 4,85
  const many = Array.from({ length: 6 }, (_, i) => ({ id: 'm' + i, rating: 4.85, reviewCount: 100 }));
  const few = { id: 'f', rating: 5.0, reviewCount: 3 };
  const ranked = R.rankListings([...many, few], {});
  assert.ok(ranked.find(l => l.id === 'f').rank.parts.rating > R.ratingScore(5.0, 3));
  // Filter „nur Luxus“ in der gemeinsamen Funktion
  assert.equal(R.filterListings([{ rank: { luxury: { state: null } } }], { lux: true }).length, 0);
});

test('R7: Brücke: true ist keine Zahl', () => {
  const store = {};
  const trip = { savedAt: 5, nights: true, budget: 900 };
  const ctx = { localStorage: { getItem: () => JSON.stringify(trip) }, chrome: { storage: { local: { set: o => Object.assign(store, o) } } }, window: { addEventListener() {} }, document: { documentElement: { dataset: {} } } };
  vm.runInNewContext(D.src('bridge.js'), ctx);
  assert.equal(store.trip.nights, undefined);
  assert.equal(store.trip.budget, 900);
});

function popup(data) {
  const chrome = chromeMock(data);
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('import.js')); w.eval(D.src('popup.js'));
  return { w, chrome, doc: w.document };
}

test('R7: Popup: fremde Such-Adresse, Einklapp-Zustand löschen, CSV mit Datum ohne Notiz, Tabpanel fokussierbar', { skip }, async () => {
  const { w, doc, chrome } = popup({ lastSearch: { at: 1, url: 'https://www.airbnb.evil.com/s/x', top: [{ id: '1', title: 'A', score: 1 }] }, 'min:sm-search': true, 'l:1': { id: '1', title: 'Loft', note: 'geheim', kind: 'Wohnung', lastSeen: Date.UTC(2026, 0, 2) } });
  await until(() => doc.getElementById('list').children.length);
  assert.ok(![...doc.querySelectorAll('#list a')].some(a => a.href.includes('evil')));
  assert.equal(doc.getElementById('list').getAttribute('tabindex'), '0');
  let blob = null; w.URL.createObjectURL = b => { blob = b; return 'blob:x'; }; w.HTMLAnchorElement.prototype.click = () => {};
  w.confirm = () => false; doc.getElementById('csv').click();
  const text = await new Promise(r => { const fr = new w.FileReader(); fr.onload = () => r(fr.result); fr.readAsText(blob); });
  assert.ok(!text.includes('geheim'));
  assert.match(text, /"2026-01-02"/);
  assert.match(text, /"Wohnung"/);
  w.prompt = () => 'zwischenspeicher';
  doc.getElementById('wipe').click();
  await until(() => !('min:sm-search' in chrome.data));
  assert.ok(!('min:sm-search' in chrome.data));
});

test('R7: Popup: Import meldet Zahl und lässt dieselbe Datei erneut zu', { skip }, async () => {
  const { w, doc } = popup({});
  await until(() => doc.getElementById('list').children.length);
  const input = doc.getElementById('file');
  const file = { text: async () => JSON.stringify({ listings: { a: { id: '5', title: 'X' }, b: { id: 'kaputt' } } }) };
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  let cleared = false;
  Object.defineProperty(input, 'value', { get: () => '', set: v => { if (v === '') cleared = true; }, configurable: true });
  await input.onchange({ target: input });
  assert.match(doc.getElementById('list').textContent, /1 übernommen, 1 übersprungen/);
  assert.ok(cleared);
  void w;
});

test('R7: Suchseite: Filter-Hinweis mit Zurücksetzen, Budgetfilter aria-disabled, Emoji versteckt, Ansage, Tasten nach ✕', { skip }, async () => {
  const chrome = chromeMock({ filters: { rating: true } });
  const { doc, w } = makePage({ body: searchBody(), chrome });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.match(box.textContent, /Filter aktiv/);
  const bud = [...box.querySelectorAll('button')].find(b => b.textContent.includes('im Budget'));
  assert.equal(bud.getAttribute('aria-disabled'), 'true');
  assert.equal(bud.hasAttribute('disabled'), false);
  assert.ok(bud.querySelector('span[aria-hidden="true"]'));
  await until(() => shadow(doc, 'sm-search').querySelector('.sr-live')?.textContent);
  assert.match(shadow(doc, 'sm-search').querySelector('.sr-live').textContent, /Neu bewertet, Platz 1/);
  [...box.querySelectorAll('button')].find(b => b.textContent === 'Filter zurücksetzen').click();
  await until(() => !chrome.data.filters.rating);
  assert.equal(chrome.data.filters.rating, undefined);
  await sleep(30); // Neuaufbau nach dem Zurücksetzen abwarten
  // ✕ schließt; Alt+Shift+V baut das Panel nicht wieder auf
  shadow(doc, 'sm-search').querySelector('button[aria-label="Schließen"]').click();
  doc.body.dispatchEvent(new w.KeyboardEvent('keydown', { code: 'KeyV', altKey: true, shiftKey: true, bubbles: true }));
  await sleep(30);
  assert.equal(doc.getElementById('sm-search'), null);
});

test('R7: Suchseite: abgelaufene Sammlung wird beim Start gelöscht', { skip }, async () => {
  const chrome = chromeMock({ pool: { key: 'x', at: 1, pages: ['0'], items: { 1: { id: '1', title: 'alt' } } } });
  makePage({ body: '', url: 'https://www.airbnb.de/rooms/1', chrome });
  await until(() => !('pool' in chrome.data));
  assert.ok(!('pool' in chrome.data));
});
