// Englische Viertel-Finder-Seite web/en/app.html: Generat aktuell, vollständig übersetzt, gleiche ids wie die DE-Seite, Verweise vorhanden
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
const de = fs.readFileSync(path.join(web, 'app.html'), 'utf8');
const en = fs.readFileSync(path.join(web, 'en', 'app.html'), 'utf8');
const DICTS = new Set(['i18n-en-scoring.js', 'i18n-en-app.js', 'i18n-en-extra.js']);

const ids = h => [...h.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]).sort();
const tags = h => h.match(/<[a-z][^>]*>/gi) || [];
const attr = (tag, n) => { const m = new RegExp('\\s' + n + '="([^"]*)"').exec(tag); return m ? m[1] : null; };

// Sichtbarer Text: ohne style/script/Kommentare, Tags entfernt, Links mit hreflang="de" (Datenschutz/Impressum) ausgenommen
function visibleText(h) {
  return h.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>|<!--[\s\S]*?-->/g, ' ')
    .replace(/<a\b[^>]*hreflang="de"[^>]*>[\s\S]*?<\/a>/g, ' ')
    .replace(/<[^>]*>/g, ' ').replace(/&[#\w]+;/g, ' ');
}
const attrTexts = h => tags(h).flatMap(t => ['title', 'alt', 'placeholder'].map(a => attr(t, a)).filter(Boolean)
  .concat(/^<meta\b/.test(t) && /(?:name|property)="(?:description|og:title|og:description|twitter:\w+)"/.test(t) && !/twitter:card|twitter:image/.test(t) ? [attr(t, 'content') || ''] : []));

test('Generat ist aktuell (--check)', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-app-en.mjs'), '--check'], { encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr + r.stdout);
});

test('<html lang="en">, canonical, og:url und og:locale', () => {
  assert.match(en, /<html lang="en">/);
  assert.match(en, /<link rel="canonical" href="https:\/\/staymatch\.pro\/en\/app">/);
  assert.match(en, /<meta property="og:url" content="https:\/\/staymatch\.pro\/en\/app">/);
  assert.match(en, /<meta property="og:locale" content="en_US">/);
  assert.match(de, /<link rel="canonical" href="https:\/\/staymatch\.pro\/app">/);
});

test('keine deutschen Wörter oder Umlaute im sichtbaren Text', () => {
  const text = visibleText(en) + ' ' + attrTexts(en).join(' ') + ' ' + tags(en).map(t => attr(t, 'aria-label')).filter(Boolean).join(' ');
  assert.doesNotMatch(text, /[äöüßÄÖÜ]/, 'Umlaut im englischen Text');
  const words = /\b(?:und|oder|nicht|der|die|das|dein|deine|ist|mit|für|wird|Viertel|Karte|Suche|Reise\w*|Unterkunft|Unterkünfte|Stadt|Städte|bitte|noch|alle|wichtig|Wünsche|Daten)\b/g;
  assert.deepStrictEqual(text.match(words) || [], []);
});

test('ids der EN-Seite == ids der DE-Seite', () => {
  assert.deepStrictEqual(ids(en), ids(de));
});

test('Skripte, Stylesheets, Bilder und Verweise zeigen auf existierende Dateien', () => {
  const scripts = [...en.matchAll(/<script\b[^>]*\ssrc="([^"]+)"/g)].map(m => m[1]);
  const expectOrder = ['/core.js', '/i18n.js', '/i18n-en-scoring.js', '/i18n-en-app.js', '/i18n-en-extra.js', '/scoring.js', '/app.js', '/app-extra.js', '/gruppe.js'];
  const deferred = scripts.filter(s => expectOrder.includes(s));
  assert.deepStrictEqual(deferred, expectOrder);
  for (const t of ['/theme-app.js', '/app-boot.js', '/app-ui.js']) assert.ok(scripts.includes(t), t);
  const refs = [];
  for (const t of tags(en)) {
    for (const a of ['src', 'href']) {
      const v = attr(t, a);
      if (v == null || /^(?:[a-z][a-z0-9+.-]*:|#)/i.test(v)) continue;
      refs.push([t, v]);
    }
  }
  for (const m of en.matchAll(/url\(([^)]+)\)/g)) refs.push(['css', m[1]]);
  for (const [t, v] of refs) {
    assert.ok(v.startsWith('/'), 'relative Adresse: ' + v);
    const p = v.split(/[?#]/)[0];
    if (DICTS.has(p.slice(1))) continue;
    const isPage = /^<a\b/.test(t);
    const candidates = [p, p + '.html', p + '/index.html'].map(x => path.join(web, x));
    if (isPage && (p === '/' || p === '/en')) continue; // Startseiten (Rewrites in vercel.json)
    assert.ok(candidates.some(f => fs.existsSync(f) && fs.statSync(f).isFile()) || (isPage && (p === '/app' || p === '/vergleich')), 'fehlt: ' + v);
  }
});

test('Seitenkopf-Verweise zeigen auf die englischen Seiten, Rechtstexte bleiben deutsch', () => {
  const nav = en.slice(en.indexOf('<nav'), en.indexOf('</nav>'));
  assert.match(nav, /<a class="logo" href="\/en">/);
  assert.match(nav, /href="\/en\/compare"/);
  assert.match(nav, /href="\/en#plugin"/);
  assert.match(nav, /<a class="lang" href="\/app" hreflang="de" lang="de" aria-label="[^"]+">DE<\/a>/);
  assert.match(de, /<a class="lang" href="\/en\/app" hreflang="en" lang="en" aria-label="English version">EN<\/a>/);
  for (const p of ['/datenschutz', '/impressum']) assert.match(en, new RegExp('<a hreflang="de" href="' + p + '"'));
});

test('hreflang-Paare stehen in DE und EN gleich und gegenseitig', () => {
  const alt = h => tags(h).filter(t => /rel="alternate"/.test(t)).map(t => attr(t, 'hreflang') + ' ' + attr(t, 'href')).sort();
  const expected = ['de https://staymatch.pro/app', 'en https://staymatch.pro/en/app', 'x-default https://staymatch.pro/app'];
  assert.deepStrictEqual(alt(de), expected);
  assert.deepStrictEqual(alt(en), expected);
});

test('DE-Quelle bleibt unter dem Größenlimit', () => {
  assert.ok(fs.statSync(path.join(web, 'app.html')).size <= 40000);
});
