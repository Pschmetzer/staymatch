// Hilfen für DOM-Tests: synthetische, selbst gebaute Airbnb-ähnliche Seiten (kein echtes Airbnb-HTML, nichts kopiert).
// Ohne jsdom (npm install --prefix tests) werden die DOM-Tests übersprungen.
const fs = require('node:fs');
const path = require('node:path');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch {}
const EXT = path.join(__dirname, '..', '..', 'extension');
const src = f => fs.readFileSync(path.join(EXT, f), 'utf8');

const b64 = s => Buffer.from(s).toString('base64');

// Eine Karte so, wie das Plugin sie liest: testid-Attribute, Link, Texte in eigenen Zeilen
function cardHtml(c) {
  return `<div data-testid="card-container"><a href="/rooms/${c.id}?adults=4"><img src="https://a0.muscache.com/${c.id}.jpg"></a>
    <div data-testid="listing-card-title">${c.kind || 'Wohnung in Gràcia'}</div>
    <div data-testid="listing-card-name">${c.title || 'Titel ' + c.id}</div>
    <div>${c.bedrooms ?? 2} Schlafzimmer</div><div>${c.beds ?? 4} Betten</div>
    ${c.rating ? `<div>${c.rating} (${c.count || 50})</div>` : '<div>Neu</div>'}
    ${c.noPrice ? '' : `<div data-testid="price-availability-row">${c.price} € ${c.night ? 'pro Nacht' : 'Gesamtpreis'}</div>`}
    ${c.fav ? '<div>Gäste-Favorit</div>' : ''}</div>`;
}

function statePage(cards) {
  const results = cards.map(c => ({
    propertyId: c.id, demandStayListing: { id: b64('DemandStayListing:' + c.id), location: { coordinate: { latitude: c.lat ?? 41.4, longitude: c.lon ?? 2.16 } } },
    nameLocalized: { localizedStringWithTranslationPreference: c.title || 'Titel ' + c.id },
    title: c.kind || 'Wohnung in Gràcia', eyebrowLocation: 'Gràcia', avgRatingLocalized: c.rating ? `${c.rating} (${c.count || 50})` : 'Neu',
    structuredDisplayPrice: { primaryLine: { accessibilityLabel: `${c.price} € Gesamtpreis` } },
    structuredContent: { primaryLine: [{ body: `${c.bedrooms ?? 2} Schlafzimmer` }], secondaryLine: [{ body: `${c.beds ?? 4} Betten` }] },
  }));
  return `<script id="data-deferred-state-0" type="application/json">${JSON.stringify({ niobeClientData: [[0, { data: { presentation: { staysSearch: { results: { searchResults: results } } } } }]] })}</script>`;
}

const DEFAULT = [
  { id: '111', price: 600, rating: '4.92', count: 210, beds: 5, fav: true },
  { id: '222', price: 450, rating: '4.80', count: 80, beds: 4 },
  { id: '333', price: 900, rating: '4.50', count: 12, beds: 2, bedrooms: 1 },
  { id: '444', price: 500, rating: '4.85', count: 150, beds: 4 },
];

// Chrome-API-Ersatz mit Speicher im Arbeitsspeicher
function chromeMock(initial = {}) {
  const data = { ...initial }, listeners = [];
  const pick = k => k == null ? { ...data } : Object.fromEntries([].concat(typeof k === 'object' && !Array.isArray(k) ? Object.keys(k) : k).filter(x => x in data).map(x => [x, data[x]]));
  return {
    data,
    storage: {
      local: {
        get: async k => JSON.parse(JSON.stringify(pick(k))),
        set: async o => { const ch = {}; for (const [k, v] of Object.entries(o)) { ch[k] = { oldValue: data[k], newValue: v }; data[k] = JSON.parse(JSON.stringify(v)); } listeners.forEach(f => f(ch)); },
        remove: async k => { for (const x of [].concat(k)) delete data[x]; },
        clear: async () => { for (const k of Object.keys(data)) delete data[k]; },
      },
      onChanged: { addListener: f => listeners.push(f) },
    },
    runtime: { getManifest: () => ({ version: JSON.parse(src('manifest.json')).version }) },
  };
}

// innerText gibt es in jsdom nicht: Block-Elemente trennen Zeilen, wie im Browser
function polyfillInnerText(win) {
  const BLOCK = /^(DIV|P|LI|UL|TR|H[1-6]|SECTION|ARTICLE|BR)$/;
  const walk = n => n.nodeType === 3 ? n.textContent : n.nodeType === 1 && !/^(SCRIPT|STYLE)$/.test(n.tagName)
    ? (BLOCK.test(n.tagName) ? '\n' : '') + [...n.childNodes].map(walk).join('') + (BLOCK.test(n.tagName) ? '\n' : '') : '';
  Object.defineProperty(win.HTMLElement.prototype, 'innerText', { get() { return walk(this).replace(/\n+/g, '\n').trim(); }, configurable: true });
}

// body: HTML der Seite, url: Adresse (bestimmt Pfad/Parameter), scripts: welche Plugin-Dateien laufen
const open = [];
function closeAll() { for (const w of open.splice(0)) try { w.close(); } catch {} } // content.js startet einen Intervall-Timer

function makePage({ body = '', url = 'https://www.airbnb.de/s/Barcelona/homes?checkin=2026-05-01&checkout=2026-05-05&adults=4', chrome = chromeMock(), scripts = ['parse.js', 'rank.js', 'hints.js', 'pool.js', 'content.js'], test = {} } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, { url, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  open.push(w);
  polyfillInnerText(w);
  w.chrome = chrome;
  w.__STAYMATCH_TEST__ = { diagDelay: 30, debounce: 5, roomDelay: 5, noteDelay: 5, ...test };
  for (const f of scripts) w.eval(src(f));
  return { dom, w, doc: w.document, chrome, api: w.__STAYMATCH_TEST__.api };
}

const searchBody = (cards = DEFAULT, state = true) => (state ? statePage(cards) : '') + `<main>${cards.map(cardHtml).join('')}</main>`;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shadow = (doc, id) => doc.getElementById(id)?.shadowRoot;
async function until(fn, ms = 1500) { const t = Date.now(); while (Date.now() - t < ms) { const v = fn(); if (v) return v; await sleep(10); } return fn(); }

module.exports = { track: w => open.push(w), closeAll, JSDOM, makePage, chromeMock, searchBody, cardHtml, statePage, DEFAULT, sleep, shadow, until, EXT, src };
