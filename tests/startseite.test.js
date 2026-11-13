// Startseite (index.html, en.html): gleiche Struktur, FAQ-Auszeichnung passt zu den sichtbaren Fragen, alle Bilder vorhanden.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..', 'web');
const pages = { de: 'index.html', en: 'en.html' };
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');

for (const [lang, file] of Object.entries(pages)) {
  const html = read(file);

  // FAQPage-JSON-LD gegen sichtbare Fragen: per DOM in tests/r7-startseite.test.js

  test(`${file}: alle eingebundenen Bilder liegen in web/`, () => {
    const refs = new Set([...html.matchAll(/(?:src|srcset)="([^"]+)"/g)].flatMap((m) => m[1].split(',').map((s) => s.trim().split(' ')[0])));
    for (const r of refs) if (!/^(https?:|data:)/.test(r)) assert.ok(fs.existsSync(path.join(web, r.replace(/^\//, ''))), `${file}: ${r} fehlt`);
  });

  test(`${file}: Städte-Links zeigen auf vorhandene Stadtseiten`, () => {
    for (const m of html.matchAll(/href="\/staedte\/([a-z-]+)"/g)) assert.ok(fs.existsSync(path.join(web, 'staedte', m[1] + '.html')), m[1]);
  });
}

test('index.html und en.html haben dieselben Abschnitte und Ziele', () => {
  const ids = (h) => [...h.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const anchors = (h) => [...h.matchAll(/href="(#[^"]+|\/staedte\/[^"]+|staymatch-plugin\.zip|\/app)"/g)].map((m) => m[1]);
  const de = read(pages.de), en = read(pages.en);
  assert.deepEqual(ids(en), ids(de));
  assert.deepEqual(anchors(en), anchors(de));
});
