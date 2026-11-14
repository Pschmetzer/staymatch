// Runde 7 E, Welle 5: fehlende Einzelprüfungen, Spuren-Pause auf der Suchseite, ±1 nur für dieselbe Suche, Löschen „diese reise“.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path');
require('../extension/core.js');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
require('../extension/extras.js');
const { StayMatchExtras: X, StayMatchHints: H } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, searchBody, shadow, until } = D;
test.after(D.closeAll);

test('R7E Ausstattungs-Merkmale einzeln (Aussicht, Schloss, Ladestation, Fahrrad, Verdunkelung, Strand, Ski, Grill, Grundausstattung, Monitor, Minikühlschrank)', () => {
  const cases = { view: 'Meerblick', lock: 'Schloss an der Schlafzimmertür', ev: 'Wallbox in der Garage', bike: 'Fahrradkeller', blackout: 'Verdunkelungsvorhänge', beach: 'Strandtücher und Sonnenschirm',
    ski: 'Skiraum im Keller', grill: 'Grill auf der Terrasse', basics: 'Öl, Salz, Gewürze', monitor: 'Monitor am Schreibtisch', miniFridge: 'Minikühlschrank', fireplace: 'Kamin', sauna: 'Sauna' };
  for (const [k, t] of Object.entries(cases)) assert.equal(X.features(t)[k], true, k);
  for (const k of Object.keys(cases)) if (X.EXTRA_WISHES[k]) assert.equal(X.EXTRA_WISHES[k].check(X.roomExtras({ amen: cases[k] })), true, 'Wunsch ' + k);
  const mini = X.roomNotes(X.roomExtras({ amen: 'Minikühlschrank' }), { people: 4 });
  assert.ok(mini.warn.includes('Nur Minikühlschrank'));
  assert.ok(X.roomNotes(X.roomExtras({ amen: 'Öl, Salz, Gewürze' }), {}).plus.some(x => /Grundausstattung/.test(x)));
});

test('R7E Hinweise: neues Konto mit vielen Inseraten, hell/dunkel, Ohrstöpsel ohne Fehlalarm, Klimaanlage nicht doppelt, Silvester-Grenze', () => {
  const x = X.roomExtras({ host: '15 Unterkünfte' });
  const year = String(new Date().getFullYear());
  assert.ok(X.roomNotes(x, { hostSince: year }).warn.some(w => /Neues Gastgeber-Konto mit 15/.test(w)));
  assert.ok(!X.roomNotes(x, { hostSince: '2015' }).warn.some(w => /Neues Gastgeber-Konto/.test(w)));
  assert.deepEqual(H.reviewHints('Lichtdurchflutete Wohnung.'), ['👍 hell']);
  assert.deepEqual(H.reviewHints('Das Zimmer war sehr dunkel.'), ['⚠️ dunkel']);
  assert.deepEqual(H.reviewHints('Ohrstöpsel liegen bereit.'), []);
  assert.deepEqual(H.reviewHints('Ohrstöpsel waren nötig.'), ['⚠️ Ohrstöpsel nötig']);
  assert.deepEqual(H.reviewHints('Die Klimaanlage war sehr laut.'), ['⚠️ Klimaanlage laut']);
  const dep = X.roomExtras({ desc: 'Kaution 200 €' });
  assert.ok(!X.roomNotes(dep, { checkin: '2026-12-29', nights: 2, noParties: true }).warn.some(w => /Silvester/.test(w)), 'Abreise am 31.12.');
  assert.ok(X.roomNotes(dep, { checkin: '2026-12-30', nights: 2, noParties: true }).warn.some(w => /Silvester/.test(w)));
});

test('R7E Suchseite: Profil-Klick, Chip-Quellen, Kamin nur im Winter, Ansage mit Zusammenfassung, Vorlesen-Knopf', { skip }, async () => {
  const chrome = chromeMock({ quick: { budgetNight: 150 } });
  const { doc, w } = makePage({ body: searchBody(), chrome, url: 'https://www.airbnb.de/s/Barcelona/homes?checkin=2026-07-01&checkout=2026-07-05&adults=4' });
  w.speechSynthesis = { cancel() {}, speak(u) { w.__spoken = u.text; } };
  w.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  const btns = [...box.querySelectorAll('button')];
  assert.match(btns.find(b => /Superhost\/Favorit/.test(b.textContent)).title, /Quelle: Plakette/);
  assert.match(btns.find(b => /Badewanne/.test(b.textContent)).title, /Quelle:/);
  assert.ok(!btns.some(b => /Kamin/.test(b.textContent)), 'Kamin im Juli');
  const live = shadow(doc, 'sm-search').querySelector('.sr-live');
  await until(() => /Unterkünfte, \d+ im Budget, beste \d+ Punkte/.test(live.textContent));
  assert.match(live.textContent, /Neu bewertet, Platz 1: .*4 Unterkünfte, \d+ im Budget, beste \d+ Punkte/);
  btns.find(b => /Arbeiten/.test(b.textContent)).click();
  await until(() => chrome.data.quick.profile === 'work');
  assert.deepEqual(chrome.data.quick.wishes, ['wifi', 'workspace', 'quiet', 'selfCheckin']);
  const box2 = await until(() => [...(shadow(doc, 'sm-search')?.querySelectorAll('button') || [])].find(b => /vorlesen/.test(b.textContent)));
  box2.click();
  assert.match(w.__spoken, /^Platz 1: /);
});

test('R7E Kamin-Chip im Winter sichtbar', { skip }, async () => {
  const { doc } = makePage({ body: searchBody(), chrome: chromeMock(), url: 'https://www.airbnb.de/s/Barcelona/homes?checkin=2026-12-01&checkout=2026-12-05&adults=4' });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.ok([...box.querySelectorAll('button')].some(b => /Kamin/.test(b.textContent)));
});

test('R7E Spuren-Pause: Suchseite schreibt weder letzte Suche noch Sammlung noch Preis-Log', { skip }, async () => {
  const chrome = chromeMock({ settings: { pauseUntil: Date.now() + 3600e3 } });
  const { doc } = makePage({ body: searchBody(), chrome });
  await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  await new Promise(r => setTimeout(r, 50));
  for (const k of ['lastSearch', 'pool', 'priceLog', 'stats']) assert.equal(chrome.data[k], undefined, k);
});

test('R7E ±1 Person gilt nur für dieselbe Suche und steht sichtbar im Kopf', { skip }, async () => {
  const chrome = chromeMock({ quick: { peopleDelta: 1, deltaKey: '/s/Barcelona/homes|2026-05-01' } });
  const { doc } = makePage({ body: searchBody(), chrome });
  const box = await until(() => shadow(doc, 'sm-search')?.querySelector('.box'));
  assert.match(box.textContent, /5 Personen \(angepasst\)/);
  D.closeAll();
  const other = chromeMock({ quick: { peopleDelta: 1, deltaKey: '/s/Rom/homes|2026-05-01' } });
  const p2 = makePage({ body: searchBody(), chrome: other });
  const box2 = await until(() => shadow(p2.doc, 'sm-search')?.querySelector('.box'));
  assert.match(box2.textContent, /4 Personen/);
  assert.ok(!/angepasst/.test(box2.textContent));
});

test('R7E Popup: „diese reise“ löscht nur Reise, Sammlung, letzte Suche und Unterkünfte mit diesem Anreisedatum; KI-Status ehrlich', { skip }, async () => {
  const chrome = chromeMock({ trip: { checkin: '2026-05-01', city: 'Rom' }, pool: { x: 1 }, lastSearch: { top: [] }, settings: { theme: 'dark' },
    'l:1': { id: '1', checkin: '2026-05-01' }, 'l:2': { id: '2', checkin: '2026-08-01' }, 'l:3': { id: '3' } });
  const dom = new D.JSDOM(fs.readFileSync(path.join(D.EXT, 'popup.html'), 'utf8').replace(/<script[^>]*><\/script>/g, ''), { runScripts: 'outside-only', url: 'chrome-extension://x/popup.html' });
  const w = dom.window; w.chrome = chrome; D.track(w);
  w.eval(D.src('core.js')); w.eval(D.src('rank.js')); w.eval(D.src('extras.js')); w.eval(D.src('import.js')); w.eval(D.src('popup.js'));
  const doc = w.document;
  assert.match(doc.getElementById('aiInfo').textContent, /nicht verfügbar/);
  assert.match(w.aiStatus({ Summarizer: 1 }), /Summarizer vorhanden/);
  await until(() => doc.getElementById('trip').textContent.includes('Rom'));
  w.prompt = () => 'diese reise';
  doc.getElementById('wipe').click();
  await until(() => !('trip' in chrome.data));
  for (const k of ['trip', 'pool', 'lastSearch', 'l:1']) assert.ok(!(k in chrome.data), k);
  for (const k of ['l:2', 'l:3', 'settings']) assert.ok(k in chrome.data, k);
});
