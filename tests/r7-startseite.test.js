// R7: Startseite (DE/EN), Rechtsseiten, Stadtseiten, vercel.json: Regeln, die sonst nur Konvention wären.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
const htmlFiles = () => walk(web).filter((f) => f.endsWith('.html')).map((f) => path.relative(web, f));
const pages = { de: 'index.html', en: 'en.html' };
const vercel = JSON.parse(read('vercel.json'));
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch {}

test('Keine Alt-Domain staymatch-tau in Seiten, Texten und XML unter web/', () => {
  // Bewusste Ausnahme: web/core.js (Kopie von shared/core.js) hält APP_URL und Bridge-Origins der Extension.
  const files = walk(web).filter((f) => /\.(html|txt|xml|json)$/.test(f) && !f.includes(`${path.sep}data${path.sep}`));
  for (const f of files) assert.ok(!fs.readFileSync(f, 'utf8').includes('staymatch-tau'), `${path.relative(root, f)} nennt noch staymatch-tau`);
});

test('security.txt: Canonical zeigt auf staymatch.pro', () => {
  assert.match(read('.well-known/security.txt'), /^Canonical: https:\/\/staymatch\.pro\/\.well-known\/security\.txt$/m);
});

test('Jeder Link mit target="_blank" hat rel="noopener"', () => {
  for (const f of htmlFiles()) {
    for (const m of read(f).matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) assert.match(m[0], /rel="[^"]*noopener/, `${f}: ${m[0]}`);
  }
});

for (const file of Object.values(pages)) {
  test(`${file}: jedes <img> hat width und height (kein Layoutsprung)`, () => {
    for (const m of read(file).matchAll(/<img\b[^>]*>/g)) assert.ok(/\bwidth="\d+"/.test(m[0]) && /\bheight="\d+"/.test(m[0]), `${file}: ${m[0].slice(0, 90)}`);
  });

  test(`${file}: helle Fotovarianten (media/*-hell-*) existieren für alle getauschten Bilder`, () => {
    const html = read(file);
    // dieselbe Regel wie im Skript der Seite: laptop und gepaeck bekommen im Hellmodus -hell-
    const rx = /media\/(laptop|gepaeck)-(\d+)\.(webp|jpg)/g;
    const refs = new Set([...html.matchAll(rx)].map((m) => `media/${m[1]}-hell-${m[2]}.${m[3]}`));
    assert.ok(refs.size >= 4, 'keine tauschbaren Fotos gefunden');
    for (const r of refs) assert.ok(fs.existsSync(path.join(web, r)), `${file}: ${r} fehlt`);
    assert.match(html, /\(laptop\|gepaeck\)-hell-/, 'Tausch-Regel im Skript geändert, Test anpassen');
  });

  test(`${file}: Plugin-Download heißt wie die Manifest-Version`, () => {
    const v = JSON.parse(fs.readFileSync(path.join(root, 'extension', 'manifest.json'), 'utf8')).version;
    const names = [...read(file).matchAll(/download="([^"]*)"/g)].map((m) => m[1]);
    assert.ok(names.length >= 2);
    for (const n of names) assert.equal(n, `staymatch-${v}.zip`);
  });
}

test('en.html: Links auf deutschsprachige Ziele tragen hreflang="de"', () => {
  for (const m of read('en.html').matchAll(/<a\b[^>]*href="(\/(?:datenschutz|impressum|app|staedte)[^"]*)"[^>]*>/g)) {
    assert.match(m[0], /hreflang="de"/, m[0]);
  }
});

test('index.html und en.html: gleiche Kopf-Metadaten (Art und Anzahl)', () => {
  const keys = (h) => [...h.slice(0, h.indexOf('</head>')).matchAll(/<(meta|link)\b[^>]*?\b(property|name|rel)="([^"]+)"/g)].map((m) => `${m[1]}:${m[3]}`).sort();
  assert.deepEqual(keys(read('en.html')), keys(read('index.html')));
});

test('index.html und en.html: gleiche Zahlen im sichtbaren Text', () => {
  const nums = (h) => {
    const body = h.slice(h.indexOf('<body>'), h.lastIndexOf('<script>'))
      .replace(/<(style|script)[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, ' ');
    return [...body.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => m[0].replace(',', '.')).sort();
  };
  assert.deepEqual(nums(read('en.html')), nums(read('index.html')));
});

test('legal.css: Version im Link passt zum Inhalt (Datei wird ein Jahr gecacht)', () => {
  const v = crypto.createHash('sha256').update(fs.readFileSync(path.join(web, 'legal.css'))).digest('hex').slice(0, 8);
  const users = htmlFiles().filter((f) => read(f).includes('legal.css'));
  assert.ok(users.length >= 13, `nur ${users.length} Seiten mit legal.css`);
  for (const f of users) assert.ok(read(f).includes(`href="/legal.css?v=${v}"`), `${f}: legal.css?v=${v} erwartet (nach Änderung an legal.css Seiten und Stadtseiten-Generator nachziehen)`);
});

test('Stadtseiten: Fußzeile verlinkt Startseite, Datenschutz und Impressum', () => {
  for (const f of fs.readdirSync(path.join(web, 'staedte'))) {
    const foot = /<footer>[\s\S]*<\/footer>/.exec(read(`staedte/${f}`))[0];
    for (const href of ['/', '/datenschutz', '/impressum']) assert.ok(foot.includes(`href="${href}"`), `${f}: ${href} fehlt in der Fußzeile`);
  }
});

test('404 verlinkt Impressum und Datenschutz', () => {
  const h = read('404.html');
  assert.ok(h.includes('href="/impressum"') && h.includes('href="/datenschutz"'));
});

const cspOf = (source) => vercel.headers.find((r) => r.source === source).headers.find((h) => h.key === 'Content-Security-Policy').value;

test('vercel.json: Sicherheitsheader für alle Pfade und von keiner späteren Regel überschrieben', () => {
  const [first, ...rest] = vercel.headers;
  assert.equal(first.source, '/(.*)');
  const need = ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'X-Frame-Options', 'Cross-Origin-Opener-Policy', 'Cross-Origin-Resource-Policy'];
  const keys = first.headers.map((h) => h.key);
  for (const k of need) assert.ok(keys.includes(k), `${k} fehlt`);
  // CSP steht in zwei Regeln, die sich nicht überschneiden: /app (mit Diensten) und alles außer /app
  assert.ok(!keys.includes('Content-Security-Policy'));
  for (const r of rest) for (const h of r.headers) assert.ok(!need.includes(h.key), `${r.source} überschreibt ${h.key}`);
  const csps = rest.filter((r) => r.headers.some((h) => h.key === 'Content-Security-Policy')).map((r) => r.source);
  assert.deepEqual(csps, ['/((?!app$).*)', '/app']);
});

test('CSP: Startseite und Stadtseiten ohne Fremddienste, nur /app mit Nominatim, Overpass und Kacheln', () => {
  const strict = cspOf('/((?!app$).*)');
  assert.ok(!/nominatim|overpass|tile\.openstreetmap/.test(strict), strict);
  assert.ok(!strict.includes('manifest-src'));
  const app = cspOf('/app');
  for (const h of ['nominatim.openstreetmap.org', 'overpass-api.de', 'tile.openstreetmap.org']) assert.ok(app.includes(h), h);
});

test('CSP erlaubt jede Fremdadresse, die Viertel-Finder und Kern abfragen', () => {
  const csp = cspOf('/app');
  const dir = (name) => (new RegExp(`${name} ([^;]+)`).exec(csp) || [, ''])[1].split(' ');
  const allowed = new Set([...dir('connect-src'), ...dir('img-src')]);
  // Nur Linkziele, keine Abfragen: Kartenquelle, Airbnb-Suche, alte App-Adresse der Extension
  const linkOnly = new Set(['https://www.openstreetmap.org', 'https://www.airbnb.de', 'https://staymatch-tau.vercel.app']);
  const src = ['core.js', 'app.js', 'scoring.js'].map(read).join('\n');
  for (const h of new Set(src.match(/https:\/\/[a-z0-9.-]+/g))) if (!linkOnly.has(h)) assert.ok(allowed.has(h), `${h} fehlt in connect-src/img-src`);
});

test('vercel.json: Umleitungen zeigen auf vorhandene Seiten', () => {
  for (const r of vercel.redirects) {
    const p = r.destination.split('#')[0].replace(/^\//, '');
    const f = p === '' ? 'index.html' : fs.existsSync(path.join(web, p)) ? p : p + '.html';
    assert.ok(fs.existsSync(path.join(web, f)), `${r.source} → ${r.destination}: Ziel fehlt`);
    assert.equal(r.permanent, true);
  }
});

test('Stadtkacheln der Startseite zusammen unter 900 KB', () => {
  const dir = path.join(web, 'media', 'staedte');
  const total = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).reduce((s, f) => s + fs.statSync(path.join(dir, f)).size, 0);
  assert.ok(total < 900_000, `${total} Bytes`);
});

test('Sitemap enthält nur indexierbare Seiten, keine Rechtsseiten', () => {
  const s = read('sitemap.xml');
  assert.ok(!/datenschutz|impressum/.test(s));
  for (const m of s.matchAll(/<loc>https:\/\/staymatch\.pro\/([^<]*)<\/loc>/g)) {
    const p = m[1] || 'index';
    assert.ok(fs.existsSync(path.join(web, p + '.html')), m[1]);
  }
});

// Verhalten der Startseite im DOM (jsdom): Deeplinks, FAQ-Anker, Fehlermeldung bei Daten
function load(file, { url = 'https://staymatch.pro/', lang = 'de-DE' } = {}) {
  const html = read(file);
  return new JSDOM(html, {
    url, runScripts: 'dangerously', pretendToBeVisual: true,
    beforeParse(w) {
      w.matchMedia = () => ({ matches: false, addEventListener() {} });
      w.fetch = () => Promise.reject(new Error('offline'));
      Object.defineProperty(w.navigator, 'language', { value: lang });
      w.HTMLElement.prototype.scrollIntoView = () => {};
    },
  }).window;
}

for (const file of Object.values(pages)) {
  test(`${file}: Schnellsuche gibt Stadt, Daten und Personen an alle Viertel-Finder-Links weiter`, { skip: !JSDOM && 'jsdom fehlt' }, () => {
    const w = load(file), d = w.document, form = d.getElementById('quick');
    const links = [...d.querySelectorAll('a[data-app]')];
    assert.ok(links.length >= 5, `nur ${links.length} Viertel-Finder-Links`);
    form.elements.query.value = 'Lissabon';
    form.elements.checkin.value = '2099-05-01';
    form.elements.checkout.value = '2099-05-04';
    form.elements.adults.value = '3';
    form.dispatchEvent(new w.Event('input', { bubbles: true }));
    for (const a of links) assert.equal(a.getAttribute('href'), '/app?c=Lissabon&i=2099-05-01&o=2099-05-04&n=3');
    assert.match(d.getElementById('qnights').textContent, /3/);
  });

  test(`${file}: Abreise vor Anreise wird gemeldet statt still geleert`, { skip: !JSDOM && 'jsdom fehlt' }, () => {
    const w = load(file), d = w.document, form = d.getElementById('quick');
    form.elements.checkin.value = '2099-05-04';
    form.elements.checkout.value = '2099-05-01';
    form.dispatchEvent(new w.Event('input', { bubbles: true }));
    assert.equal(form.elements.checkout.value, '2099-05-01');
    assert.equal(form.elements.checkout.getAttribute('aria-invalid'), 'true');
    assert.ok(!d.querySelector('a[data-app]').getAttribute('href').includes('o='));
  });

  test(`${file}: FAQ-Anker öffnet die Frage`, { skip: !JSDOM && 'jsdom fehlt' }, () => {
    const w = load(file, { url: 'https://staymatch.pro/#faq-daten' });
    assert.equal(w.document.getElementById('faq-daten').open, true);
  });

  test(`${file}: FAQPage-JSON-LD entspricht den sichtbaren Fragen (DOM statt Regex)`, { skip: !JSDOM && 'jsdom fehlt' }, () => {
    const d = new JSDOM(read(file)).window.document;
    const faq = [...d.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent)).find((x) => x['@type'] === 'FAQPage');
    assert.equal(faq.inLanguage, file === 'en.html' ? 'en' : 'de');
    const visible = [...d.querySelectorAll('#faq details')].map((x) => [x.querySelector('summary').textContent.trim(), x.querySelector('p').textContent.trim()]);
    assert.deepEqual(faq.mainEntity.map((q) => [q.name, q.acceptedAnswer.text]), visible);
  });
}

test('Sprachhinweis: DE-Seite zeigt ihn nur für nicht-deutsche Browser', { skip: !JSDOM && 'jsdom fehlt' }, () => {
  assert.equal(load('index.html', { lang: 'en-US' }).document.querySelector('.langhint').hidden, false);
  assert.equal(load('index.html', { lang: 'de-DE' }).document.querySelector('.langhint').hidden, true);
  assert.equal(load('en.html', { lang: 'de-AT' }).document.querySelector('.langhint').hidden, false);
});
