// Runde 12: web/app.js läuft auf /en/app komplett englisch (und auf /app weiter deutsch). Eigener Boot, i18n.js VOR scoring.js.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch {}
const web = path.join(__dirname, '..', 'web');
const skip = !JSDOM && 'jsdom fehlt';
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await tick(20); } throw new Error('Zeitüberschreitung beim Warten'); }

function bootApp(lang, { url, storage = {} } = {}) {
  let html = fs.readFileSync(path.join(web, 'app.html'), 'utf8');
  html = html.replace(/<html([^>]*?)\slang="[^"]*"/, `<html$1 lang="${lang}"`);
  if (!/<html[^>]*\slang=/.test(html)) html = html.replace('<html', `<html lang="${lang}"`);
  const dom = new JSDOM(html, { url: url || (lang === 'en' ? 'http://localhost/en/app' : 'http://localhost/app'), runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  w.requests = [];
  const local = async u => {
    const p = path.join(web, String(u).replace(/^(https?:\/\/localhost)?\//, ''));
    if (!/^((https?:\/\/localhost)?\/)?data\//.test(String(u)) || !fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    const body = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
  };
  w.fetch = async (u, opt = {}) => {
    w.requests.push(String(u));
    if (/^https?:/.test(String(u)) && !String(u).startsWith('http://localhost/')) throw new TypeError('Failed to fetch (Test: kein Netz)');
    return local(u);
  };
  w.console.debug = () => {}; w.console.warn = () => {};
  w.errors = [];
  w.addEventListener('error', e => w.errors.push(e.error || e.message));
  const files = ['core.js', 'i18n.js', ...fs.readdirSync(web).filter(f => /^i18n-en-.*\.js$/.test(f)), 'scoring.js', 'app.js'];
  for (const f of files) w.eval(fs.readFileSync(path.join(web, f), 'utf8') + `\n//# sourceURL=${f}`);
  return w;
}
async function search(w, city) {
  const $ = id => w.document.getElementById(id);
  $('city').value = city;
  $('f').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await until(() => !$('go').disabled);
  await tick(5);
}
const GERMAN = /[äöüß]|\b(Viertel|Nächte|Personen|Gruppe|Fehler|Stadt|für|nicht|und)\b/;

test('app.js auf EN: Suche, Kopfzeile, Optionen, Airbnb-Link englisch, keine {platzhalter}', { skip }, async () => {
  const w = bootApp('en'), $ = id => w.document.getElementById(id);
  await search(w, 'Berlin');
  assert.match($('status').textContent, /^Scored \d+ neighbourhoods and \d+ places\. The best for you:$/);
  assert.match($('resSummary').textContent, /^For 1 person, \d+ nights, €\d+ per night\. OpenStreetMap data, /);
  assert.match($('resSummary').textContent, /loaded today|as of \d\d\/\d\d\/\d{4}/);
  const opts = [...$('sort').options].map(o => o.textContent);
  assert.deepEqual(opts.slice(0, 1), ['Best score (default)']);
  assert.ok(opts.includes('Nearest train') && opts.includes('Close to the centre'));
  assert.match($('more').textContent, /^Show \d+ more \(\d+ left\)$/);
  assert.equal($('addPerson').textContent, '+ Add travel companions');
  const href = w.document.querySelector('#results a.btn').href;
  assert.match(href, /^https:\/\/www\.airbnb\.com\/s\//);
  assert.match($('bedsLabel').textContent, /^Add at least 1 bedrooms? to the Airbnb search/);
  assert.match($('budgetInfo').textContent, /per night|Choose dates/);
  for (const id of ['status', 'resSummary', 'more', 'peopleLabel', 'addPerson', 'budgetInfo', 'bedsLabel', 'fairOut', 'typeInfo']) {
    assert.doesNotMatch($(id).textContent, /\{\w+\}/, id);
    assert.doesNotMatch($(id).textContent, GERMAN, id);
  }
  assert.deepEqual(w.errors, []);
});

test('app.js auf EN: Gruppe, Typen, Regler, Rückgängig, Vergleich, Kartenleiste', { skip }, async () => {
  const w = bootApp('en'), $ = id => w.document.getElementById(id);
  $('addPerson').click();
  assert.equal($('peopleLabel').textContent, "Who's travelling? (2 people)");
  assert.equal($('addPerson').textContent, '+ Add person');
  assert.equal($('people').querySelectorAll('select')[0].selectedOptions[0].textContent, '🏛️ Sightseeing');
  assert.ok([...$('people').querySelector('select').options].some(o => o.textContent === '🤫 Quiet'));
  $('people').querySelectorAll('.tunebtn')[0].click();
  const tune = $('people').textContent;
  assert.match(tune, /What matters to You\? Right = important, left = annoying\./);
  assert.match(tune, /Nightlife/);
  assert.doesNotMatch(tune, /\{\w+\}/);
  // Entfernen (aria-Label englisch) + Rückgängig
  assert.match($('people').querySelector('.person button[title="Remove"]').getAttribute('aria-label'), /^Remove /);
  $('people').querySelectorAll('.person button[title="Remove"]')[1].click();
  assert.match($('undoMsg').textContent, /^Person 2 removed\.$/);
  $('undoBtn').click();
  assert.equal($('people').querySelectorAll('.person').length, 2);
  $('example').click();
  assert.equal($('undoMsg').textContent, 'Example loaded.');
  // Suche mit Gruppe, Vergleich
  await search(w, 'Berlin');
  assert.match($('status').textContent, /The best for your group:$/);
  const cb = [...w.document.querySelectorAll('#results input[data-k]')];
  cb[0].checked = true; cb[0].dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal($('compare').textContent.trim(), 'Pick a second neighbourhood to compare.');
  cb[1].checked = true; cb[1].dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.match($('compare').textContent, /Comparison: .+ vs .+/);
  assert.match($('compare').textContent, /Group score/);
  assert.match($('compare').textContent, /Close comparison/);
  assert.doesNotMatch($('compare').textContent, /\{\w+\}/);
  $('mapToggle').click(); assert.equal($('mapToggle').textContent, 'Show map');
  $('mapToggle').click(); assert.equal($('mapToggle').textContent, 'Hide map');
  const sorts = [...$('sort').options].map(o => o.textContent);
  assert.ok(sorts.includes('Fairest choice (default)') && sorts.includes('Highest average') && sorts.some(s => /^Best for /.test(s)));
});

test('app.js auf EN: Fehler und Statusmeldungen, Fehlerseite ohne Wiederholen, Teilen-Link bleibt unter /en/app', { skip }, async () => {
  const w = bootApp('en', { url: 'http://localhost/en/app' }), $ = id => w.document.getElementById(id);
  $('city').value = '';
  $('f').dispatchEvent(new w.Event('submit', { cancelable: true }));
  assert.equal($('status').textContent, 'Please enter a city and at least one person.');
  // unbekannte Stadt: kein Netz → Verbindungsfehler mit „Error:“
  await search(w, 'Nirgendwostadt');
  assert.match($('status').textContent, /^Error: /);
  assert.doesNotMatch($('status').textContent, GERMAN);
  // Teilen-Link
  let copied = null;
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async u => { copied = u; } }, configurable: true });
  $('share').click(); await tick(10);
  assert.match(copied, /^http:\/\/localhost\/en\/app#t=/);
  assert.match($('shareMsg').textContent, /^✅ Link copied\./);
  assert.match(w.location.pathname, /^\/en\/app$/);
  // kaputter Link
  w.location.hash = '#t=kaputt'; await tick(20);
  assert.equal($('status').textContent, 'The link is damaged or too old.');
  assert.equal(w.location.pathname, '/en/app');
});

test('app.js auf DE: bleibt deutsch (Gegenprobe)', { skip }, async () => {
  const w = bootApp('de'), $ = id => w.document.getElementById(id);
  await search(w, 'Berlin');
  assert.match($('status').textContent, /^\d+ Viertel und \d+ Orte ausgewertet\. Die besten für dich:$/);
  assert.match($('resSummary').textContent, /^Für 1 Person, \d+ Nächte, \d+ € pro Nacht\. OpenStreetMap-Daten, /);
  assert.match(w.document.querySelector('#results a.btn').href, /^https:\/\/www\.airbnb\.de\/s\//);
  assert.equal($('addPerson').textContent, '+ Mitreisende hinzufügen');
});

test('app.js auf EN: kein fehlender Schlüssel aus app.js', { skip }, async () => {
  const w = bootApp('en'), $ = id => w.document.getElementById(id);
  await search(w, 'Berlin');
  $('addPerson').click(); $('example').click();
  const src = fs.readFileSync(path.join(web, 'app.js'), 'utf8');
  const mine = [...w.StayMatchI18n.missing].filter(k => src.includes(k.replace(/'/g, "\\'")) || src.includes(k));
  assert.deepEqual(mine, []);
});
