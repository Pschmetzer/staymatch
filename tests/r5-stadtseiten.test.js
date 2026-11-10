// R5-166: Generator scripts/build-city-pages.mjs
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const gen = path.join(root, 'scripts', 'build-city-pages.mjs');

test('Stadtseiten sind aktuell (node scripts/build-city-pages.mjs --check)', () => {
  execFileSync(process.execPath, [gen, '--check'], { stdio: 'pipe' });
});

test('Stadtseite: Titel, canonical, ODbL-Hinweis, keine Fremdhosts außer OSM-Lizenzlinks', () => {
  const dir = path.join(root, 'web', 'staedte');
  const pages = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  assert.ok(pages.length >= 9);
  for (const f of pages) {
    const h = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.match(h, /<title>Beste Viertel in .+<\/title>/);
    assert.ok(h.includes(`rel="canonical" href="https://staymatch-tau.vercel.app/staedte/${f.replace('.html', '')}"`), f);
    assert.ok(h.includes('OpenStreetMap') && h.includes('ODbL'), f + ' ohne Quellenangabe');
    assert.equal((h.match(/<li><b>/g) || []).length, 25, f + ': 5 Typen × 5 Viertel');
    assert.ok(!/<script/i.test(h), f + ' ohne Skripte');
    const hosts = new Set([...h.matchAll(/https?:\/\/([^/"' ]+)/g)].map(m => m[1]));
    for (const x of hosts) assert.ok(['staymatch-tau.vercel.app', 'opendatacommons.org', 'www.openstreetmap.org'].includes(x), `${f}: Fremdhost ${x}`);
  }
});
