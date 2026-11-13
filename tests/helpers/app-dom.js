// Lädt web/app.html mit core.js, scoring.js und app.js in jsdom (ohne Leaflet, ohne Netz).
// fetch liefert nur Dateien aus web/ (data/index.json, data/*.json); alles andere schlägt fehl, außer ein eigener Handler fängt es ab.
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..', '..', 'web');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch {}

function bootApp({ storage = {}, url = 'http://localhost/app', fetch: own, beforeScripts } = {}) {
  const html = fs.readFileSync(path.join(web, 'app.html'), 'utf8');
  const dom = new JSDOM(html, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  for (const [k, v] of Object.entries(storage)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  w.requests = [];
  const local = async u => {
    const p = path.join(web, String(u).replace(/^https?:\/\/localhost\//, ''));
    if (!/^(https?:\/\/localhost\/)?data\//.test(String(u)) || !fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    const body = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
  };
  w.fetch = async (u, opt = {}) => {
    w.requests.push(String(u));
    if (opt.signal && opt.signal.aborted) throw new w.DOMException('Abgebrochen', 'AbortError');
    if (own) { const r = await own(String(u), opt, local); if (r !== undefined) return r; }
    if (/^https?:/.test(String(u)) && !String(u).startsWith('http://localhost/')) throw new TypeError('Failed to fetch (Test: kein Netz)');
    return local(u);
  };
  w.console.debug = () => {}; w.console.warn = () => {};
  w.errors = [];
  w.addEventListener('error', e => w.errors.push(e.error || e.message));
  if (beforeScripts) beforeScripts(w);
  for (const f of ['core.js', 'scoring.js', 'app.js']) w.eval(fs.readFileSync(path.join(web, f), 'utf8') + `\n//# sourceURL=${f}`);
  return w;
}

const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (fn()) return true; await tick(20); }
  throw new Error('Zeitüberschreitung beim Warten');
}
// Stadt suchen und warten, bis Ergebnisse oder eine Meldung da sind
async function search(w, city) {
  const $ = id => w.document.getElementById(id);
  $('city').value = city;
  $('f').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await until(() => !$('go').disabled);
  await tick(5);
}

module.exports = { bootApp, until, tick, search, hasDom: !!JSDOM, web };
