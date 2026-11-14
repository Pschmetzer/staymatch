// Runde 9: Parser-Rückfälle gegen Änderungen am Airbnb-Seitenaufbau (synthetische jsdom-Seiten, nichts kopiert).
const test = require('node:test');
const assert = require('node:assert/strict');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch {}
const skip = !JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
require('../extension/parse.js');
require('../extension/rank.js');
const P = globalThis.StayMatchParse, R = globalThis.StayMatchRank;

function page(body) {
  const win = new JSDOM(`<!doctype html><body>${body}</body>`, { url: 'https://www.airbnb.de/s/x/homes' }).window;
  const BLOCK = /^(DIV|P|LI|UL|TR|H[1-6]|SECTION|ARTICLE|BR)$/;
  const walk = n => n.nodeType === 3 ? n.textContent : n.nodeType === 1 && !/^(SCRIPT|STYLE)$/.test(n.tagName)
    ? (BLOCK.test(n.tagName) ? '\n' : '') + [...n.childNodes].map(walk).join('') + (BLOCK.test(n.tagName) ? '\n' : '') : '';
  Object.defineProperty(win.HTMLElement.prototype, 'innerText', { get() { return walk(this).replace(/\n+/g, '\n').trim(); }, configurable: true });
  return win.document;
}
// Karte ohne data-testid: nur Links, Textzeilen und aria-labelledby
const card = (id, o = {}) => `<div class="c1"><div class="c2"><a href="/rooms/${id}?adults=2" aria-labelledby="t${id}"><img src="https://a0.muscache.com/${id}.jpg"></a>
  ${o.noTitle ? '' : `<div id="t${id}">${o.kind || 'Wohnung in Gràcia'}</div>`}<div>${o.bed || '2 Schlafzimmer'}</div>
  <div>${o.rating === null ? 'Neu' : (o.rating || '4,85') + ' (' + (o.count || 40) + ')'}</div><div>${o.price || '120 € pro Nacht'}</div>
  <a href="/rooms/${id}?adults=2">Details</a></div></div>`;

test('Karten über /rooms/-Links ohne card-container, je Karte genau einmal', { skip }, () => {
  const doc = page(`<main>${card('11')}${card('22', { price: '90 € pro Nacht', rating: '4,50' })}${card('33', { rating: null })}</main>`);
  assert.equal(doc.querySelectorAll('[data-testid="card-container"]').length, 0);
  const l = P.parseSearch(doc);
  assert.deepEqual(l.map(x => x.id), ['11', '22', '33']);
  assert.equal(l[0].totalPrice, 120); assert.equal(l[0].rating, 4.85); assert.equal(l[0].reviewCount, 40);
  assert.equal(l[1].totalPrice, 90); assert.equal(l[2].isNew, true);
  assert.equal(l[0].source, 'dom');
});

test('Kein Vorfahr über mehrere Unterkünfte hinaus', { skip }, () => {
  const doc = page(`<main><section>${card('11')}${card('22')}</section></main>`);
  const els = P.fromCards(doc);
  assert.equal(els.length, 2);
  assert.notEqual(els[0].totalPrice, null);
});

test('Titel/Art aus aria-labelledby, sonst aus der ersten Textzeile', { skip }, () => {
  const [a] = P.parseSearch(page(`<main>${card('11', { kind: 'Ganze Unterkunft: Loft in Gràcia' })}</main>`));
  assert.equal(a.kind, 'Ganze Unterkunft: Loft in Gràcia');
  const body = `<div><div><a href="/rooms/77"><img src="https://a0.muscache.com/7.jpg"></a><div>Gäste-Favorit</div><div>Loft in Raval</div><div>★ 4,9 (12)</div><div>100 € pro Nacht</div></div></div>`;
  const [b] = P.parseSearch(page(body));
  assert.equal(b.kind, 'Loft in Raval'); assert.equal(b.id, '77'); assert.equal(b.rating, 4.9);
  assert.equal(R.WISHES.whole.check(b), true);
});

test('Mit card-container bleibt alles beim Alten (kein Rückfall)', { skip }, () => {
  const doc = page(`<div data-testid="card-container"><a href="/rooms/5"></a><div data-testid="listing-card-title">Zimmer in Bonn</div><div>4,8 (9)</div><div>50 € pro Nacht</div></div>${card('99')}`);
  const l = P.fromCards(doc);
  assert.deepEqual(l.map(x => x.id), ['5']); assert.equal(l[0].kind, 'Zimmer in Bonn');
  assert.notEqual(P.diagnose(doc).cardsFallback, true);
});

test('diagnose meldet den Karten-Rückfall', { skip }, () => {
  const d = P.diagnose(page(`<main>${card('11')}${card('22')}</main>`));
  assert.equal(d.cards, 2); assert.equal(d.cardsFallback, true); assert.equal(d.roomLinks, 2);
});

const results = ids => ids.map(id => ({ propertyId: id, demandStayListing: { id: Buffer.from('DemandStayListing:' + id).toString('base64') },
  title: 'Wohnung in X', avgRatingLocalized: '4,8 (10)', structuredDisplayPrice: { primaryLine: { accessibilityLabel: '300 € Gesamtpreis' } } }));

test('JSON-Rückfall: anderes Skript-Id, anderer Pfad (searchResults)', { skip }, () => {
  const alt = JSON.stringify({ foo: { bar: { searchResults: results(['501', '502']) } } });
  const l = P.parseSearch(page(`<script type="application/json" id="neu-x">${alt}</script><script type="application/json">{"x":1}</script>`));
  assert.deepEqual(l.map(x => x.id), ['501', '502']); assert.equal(l[0].source, 'state');
  const st = JSON.stringify({ a: [{ staysSearch: { results: { searchResults: results(['601']) } } }] });
  assert.deepEqual(P.parseSearch(page(`<script type="application/json" data-x="1">${st}</script>`)).map(x => x.id), ['601']);
  // staysSearch mit geändertem Zwischenpfad
  const st2 = JSON.stringify({ staysSearch: { data: { searchResults: results(['701']) } } });
  assert.deepEqual(P.parseSearch(page(`<script type="application/json">${st2}</script>`)).map(x => x.id), ['701']);
});

test('JSON-Rückfall: fremdes JSON ohne Stichwort wird nicht gelesen', { skip }, () => {
  assert.deepEqual(P.parseSearch(page('<script type="application/json">{"a":[1,2,3]}</script>')), []);
});

test('Währungen: HUF, INR, TRY, ISO-Codes', () => {
  const cur = s => P.parseSearch({ querySelectorAll: q => q === '[data-testid="card-container"]' ? [{
    querySelector: x => x.includes('/rooms/') ? { getAttribute: () => '/rooms/5' } : x.includes('price') ? { innerText: s } : null,
    querySelectorAll: () => [], innerText: 'Wohnung\n4,8 (10)' }] : [], getElementById: () => null })[0];
  assert.equal(cur('45 000 Ft pro éjszaka').currency, 'Ft');
  assert.equal(cur('₹4,500 per night').currency, '₹'); assert.equal(cur('₹4,500 per night').totalPrice, 4500);
  assert.equal(cur('1.200 ₺ gecelik').currency, '₺');
  assert.equal(cur('INR 4,500 per night').currency, 'INR');
  assert.equal(cur('120 € pro Nacht').currency, '€');
});

test('Wunsch „ganze Unterkunft“ in FR/ES/IT/NL/PL/PT', () => {
  const w = k => R.WISHES.whole.check({ kind: k });
  for (const k of ['Appartement entier à Paris', 'Maison entière à Nice', 'Gîte à Annecy', 'Casa entera en Madrid', 'Apartamento entero en Sevilla', 'Cabaña entera en Tarifa',
    'Appartamento intero a Roma', 'Intero alloggio a Milano', 'Volledig appartement in Gent', 'Hele woning in Utrecht', 'Cały apartament w Krakowie',
    'Całe mieszkanie w Gdańsku', 'Casa inteira em Lisboa', 'Apartamento inteiro em Porto']) assert.equal(w(k), true, k);
  for (const k of ['Chambre privée à Paris', 'Chambre dans un appartement à Lyon', 'Chambre d\'hôtes à Annecy', 'Habitación privada en Madrid', 'Habitación en Barcelona',
    'Camera privata a Roma', 'Camera in appartamento a Torino', 'Stanza in B&B a Firenze', 'Privékamer in Amsterdam', 'Kamer in huis in Utrecht',
    'Pokój prywatny w Warszawie', 'Pokój w mieszkaniu w Łodzi', 'Wspólny pokój w Krakowie', 'Quarto privado em Lisboa', 'Quarto em apartamento no Porto', 'Quarto compartilhado em São Paulo']) assert.equal(w(k), false, k);
  assert.equal(w('Appartement 2 chambres à Paris'), true);
});
