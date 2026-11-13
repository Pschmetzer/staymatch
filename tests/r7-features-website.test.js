// R7 E: neue Funktionen der Startseite (DE/EN), 404 und Datenschutz. Prüft Verhalten im DOM (jsdom) und Gleichstand mit dem echten Code.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../extension/rank.js');
require('../web/scoring.js');
const R = globalThis.StayMatchRank, SM = globalThis.StayMatch;
const Core = require('../shared/core.js');

const web = path.join(__dirname, '..', 'web');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');
const pages = { de: 'index.html', en: 'en.html' };
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch {}
const skip = !JSDOM && 'jsdom fehlt';

function load(file, { url = 'https://staymatch.pro/', lang = 'de-DE', session = null, share = undefined } = {}) {
  const opened = [], printed = [];
  const w = new JSDOM(read(file), {
    url, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.fetch = () => Promise.reject(new Error('offline'));
      Object.defineProperty(w.navigator, 'language', { value: lang });
      if (share !== undefined) Object.defineProperty(w.navigator, 'share', { value: share });
      Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async (t) => { opened.push('clip:' + t); } } });
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.HTMLAnchorElement.prototype.click = function () { opened.push(this.href); };
      w.print = () => printed.push(w.document.documentElement.className);
      if (session) w.sessionStorage.setItem('sm_quick', JSON.stringify(session));
    },
  }).window;
  return { w, d: w.document, opened, printed };
}
const fire = (w, el, type = 'input') => el.dispatchEvent(new w.Event(type, { bubbles: true }));

for (const file of Object.values(pages)) {
  test(`${file}: Schnellsuche gibt Kinder und Budget pro Nacht (Euro) an Airbnb weiter`, { skip }, () => {
    const { w, d, opened } = load(file), f = d.getElementById('quick');
    f.elements.query.value = 'Lissabon'; f.elements.adults.value = '2';
    f.elements.children.value = '2'; f.elements.price_max.value = '140';
    f.requestSubmit();
    const u = new URL(opened[0]);
    assert.equal(u.searchParams.get('adults'), '2');
    assert.equal(u.searchParams.get('children'), '2');
    assert.equal(u.searchParams.get('price_max'), '140');
    assert.equal(u.searchParams.get('currency'), 'EUR');
  });

  test(`${file}: ohne Budget kein price_max, Kinder höchstens bis 16 Gäste`, { skip }, () => {
    const { d, opened } = load(file), f = d.getElementById('quick');
    f.elements.query.value = 'Rom'; f.elements.adults.value = '15'; f.elements.children.value = '5';
    f.requestSubmit();
    const u = new URL(opened[0]);
    assert.equal(u.searchParams.get('children'), '1');
    assert.equal(u.searchParams.get('price_max'), null);
    assert.equal(u.searchParams.get('currency'), null);
  });

  test(`${file}: Kinder und Budget bleiben im Tab gespeichert und öffnen den Zusatzbereich`, { skip }, () => {
    const { w, d } = load(file, { session: { c: 'Wien', n: '2', k: '1', b: '90' } }), f = d.getElementById('quick');
    assert.equal(f.elements.children.value, '1');
    assert.equal(f.elements.price_max.value, '90');
    assert.equal(d.querySelector('.qmore').open, true);
    f.elements.price_max.value = '120'; fire(w, f.elements.price_max);
    assert.equal(JSON.parse(w.sessionStorage.getItem('sm_quick')).b, '120');
    // Viertel-Finder-Deeplink bleibt bei c/i/o/n (app.js liest nur diese)
    assert.ok(!/[?&](k|b|price_max)=/.test(d.querySelector('a[data-app]').getAttribute('href')));
  });

  test(`${file}: Sterne-Regler rechnet wie ratingScore im Plugin`, { skip }, () => {
    const { w, d } = load(file), v = d.getElementById('sd-star'), n = d.getElementById('sd-n');
    for (const s of [3, 4.2, 4.5, 4.75, 4.9, 5]) for (const c of [0, 1, 3, 20, 120, 500]) {
      v.value = String(s); n.value = String(c); fire(w, v);
      const want = Math.round(R.ratingScore(s, c, 4.6) * 100);
      const got = Number(/→ (\d+)/.exec(d.getElementById('sd-out').textContent)[1]);
      assert.equal(got, want, `${s} Sterne, ${c} Bewertungen`);
    }
  });

  test(`${file}: Fairness-Regler rechnet wie groupScore im Viertel-Finder`, { skip }, () => {
    const { w, d } = load(file), ins = [...d.querySelectorAll('#fair-demo input')];
    assert.equal(ins.length, 3);
    const keys = Object.keys(SM.CATEGORIES).slice(0, 3);
    for (const vals of [[90, 70, 30], [0, 0, 0], [100, 100, 100], [55, 12, 99], [1, 2, 4], [33, 66, 67]]) {
      vals.forEach((x, i) => { ins[i].value = String(x); });
      fire(w, ins[0]);
      const norm = Object.fromEntries(keys.map((k, i) => [k, vals[i] / 100]));
      const want = SM.groupScore(norm, keys.map((k) => ({ w: { [k]: 1 } })), 0.6).total;
      assert.match(d.getElementById('fd-out').textContent, new RegExp(`= ${want}$`), vals.join(','));
      assert.equal(ins[1].nextElementSibling.textContent, String(vals[1]));
    }
  });

  test(`${file}: Checkliste hat 10 Fragen mit Häkchen, Zähler und Drucken nur der Liste`, { skip }, () => {
    const { w, d, printed } = load(file), boxes = [...d.querySelectorAll('#checkliste input[type=checkbox]')];
    assert.equal(boxes.length, 10);
    assert.ok(boxes.every((b) => b.closest('label').textContent.trim().length > 10));
    assert.match(d.getElementById('ck-out').textContent, /^0\D+10\D/);
    boxes[0].click(); boxes[3].click();
    assert.match(d.getElementById('ck-out').textContent, /^2\D+10\D/);
    d.getElementById('ck-print').click();
    assert.equal(printed.length, 1); assert.ok(printed[0].split(' ').includes('pc'));
    w.dispatchEvent(new w.Event('afterprint'));
    assert.equal(d.documentElement.classList.contains('pc'), false);
  });

  test(`${file}: Link-Prüfung erkennt echte Airbnb-Adressen und Nachbauten`, { skip }, () => {
    const { w, d } = load(file), inp = d.getElementById('lc-in'), out = d.getElementById('lc-out');
    const check = (v) => { inp.value = v; fire(w, inp); return out.className; };
    for (const ok of ['https://www.airbnb.de/rooms/123', 'airbnb.com', 'de.airbnb.ch/x', 'https://www.airbnb.co.uk', 'WWW.AIRBNB.COM.BR']) assert.equal(check(ok), 'ok', ok);
    for (const bad of ['https://airbnb-secure-pay.com/pay', 'airbnb.de.evil.com', 'https://xairbnb.de', 'airbnb.co', 'https://www.airbnb.de@evil.com/']) assert.equal(check(bad), 'warn', bad);
    check('kein link'); assert.ok(out.textContent.length > 5);
    check(''); assert.equal(out.textContent, '');
  });

  test(`${file}: „Seite teilen“ nutzt das Teilen-Menü, sonst Zwischenablage, mit kanonischer Adresse`, { skip }, async () => {
    const canon = file === 'en.html' ? 'https://staymatch.pro/en' : 'https://staymatch.pro/';
    let shared = null;
    const a = load(file, { share: async (x) => { shared = x; } });
    a.d.getElementById('share').click(); await new Promise((r) => setTimeout(r, 0));
    assert.equal(shared.url, canon);
    const b = load(file);
    b.d.getElementById('share').click(); await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual(b.opened, ['clip:' + canon]);
    assert.ok(b.d.getElementById('share-out').textContent.length > 0);
  });
}

test('Link-Prüfung nutzt genau die Airbnb-Domains aus shared/core.js', () => {
  for (const file of Object.values(pages)) {
    const m = /const D = '([^']+)'\.split\(' '\)\.map\(t => 'airbnb\.' \+ t\)/.exec(read(file));
    assert.ok(m, `${file}: Domainliste nicht gefunden`);
    assert.deepEqual(m[1].split(' ').map((t) => 'airbnb.' + t), Core.AIRBNB_DOMAINS, file);
  }
});

test('DE und EN: Skript außer den Texten (T) und CSS sind identisch', () => {
  const script = (h) => h.slice(h.lastIndexOf('<script>\n  // Texte'), h.indexOf('</script>', h.lastIndexOf('<script>\n  // Texte')))
    .replace(/const T = \{[\s\S]*?\};\n/, '');
  const css = (h) => h.slice(h.indexOf('<style>'), h.indexOf('</style>'));
  const de = read('index.html'), en = read('en.html');
  assert.ok(script(de).length > 5000);
  assert.equal(script(en), script(de));
  assert.equal(css(en), css(de));
});

test('DE und EN: dieselben IDs, Formularfelder und Anker', () => {
  const ids = (h) => [...h.matchAll(/\b(?:id|name)="([\w-]+)"|href="#([\w-]+)"/g)].map((m) => m[0]).sort();
  assert.deepEqual(ids(read('en.html')), ids(read('index.html')));
});

test('DE und EN: T hat dieselben Schlüssel', () => {
  const keys = (h) => [.../const T = \{([\s\S]*?)\};\n/.exec(h)[1].matchAll(/(?:^|[,{]\s*)(\w+):/g)].map((m) => m[1]).sort();
  assert.deepEqual(keys(read('en.html')), keys(read('index.html')));
});

test('Startseite: neue Werkzeuge wecken keine Erwartungen an Dienste Dritter', () => {
  for (const file of Object.values(pages)) {
    const h = read(file);
    assert.ok(!/whatsapp|twitter\.com\/intent|facebook\.com\/sharer|t\.me\/share|mailto:/i.test(h), `${file}: Teilen-Link zu Drittdienst`);
    assert.ok(!/localStorage\.setItem\('sm_check/.test(h), `${file}: Checkliste soll nichts speichern`);
    assert.match(h, /@media print \{ \.pc nav\.top, \.pc footer, \.pc main > :not\(#vorbereiten\)/, `${file}: Druck blendet den Rest aus (keine Leerseiten)`);
  }
});

test('404: englischer Text für nicht-deutsche Browser und /en-Pfade, sonst deutsch', { skip }, () => {
  const run = (url, lang) => new JSDOM(read('404.html'), {
    url, runScripts: 'dangerously',
    beforeParse(w) { Object.defineProperty(w.navigator, 'language', { value: lang }); },
  }).window.document;
  const en = run('https://staymatch.pro/staedte/lisbon', 'en-US');
  assert.equal(en.documentElement.lang, 'en');
  assert.equal(en.getElementById('home').getAttribute('href'), '/en');
  assert.match(en.getElementById('guess').textContent, /^Did you mean Lissabon\?$/);
  const enPath = run('https://staymatch.pro/en/xyz', 'de-DE');
  assert.equal(enPath.documentElement.lang, 'en');
  assert.equal(run('https://staymatch.pro/entdecken', 'de-DE').documentElement.lang, 'de');
  const de = run('https://staymatch.pro/staedte/lisbon', 'de-DE');
  assert.equal(de.documentElement.lang, 'de');
  assert.equal(de.getElementById('home').getAttribute('href'), '/');
  assert.match(de.getElementById('guess').textContent, /^Meintest du Lissabon\?$/);
});

test('Datenschutz: Selbst-nachprüfen-Abschnitt, neue Schnellsuch-Felder und Startseiten-Werkzeuge genannt', () => {
  const h = read('datenschutz.html');
  assert.match(h, /<h2 id="nachpruefen">/);
  assert.match(h, /href="#nachpruefen"/);
  assert.match(h, /Kinderzahl und Preisgrenze/);
  assert.match(h, /Checkliste/);
  assert.match(h, /Seite teilen/);
});
