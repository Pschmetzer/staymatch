// R7: Startseite (DE/EN), Rechtsseiten, Stadtseiten, vercel.json: Regeln, die sonst nur Konvention wären.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
const read = (f) => fs.readFileSync(path.join(web, f), 'utf8');
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);

test('Keine Alt-Domain staymatch-tau in Seiten, Texten und XML unter web/', () => {
  // Bewusste Ausnahme: web/core.js (Kopie von shared/core.js) hält APP_URL und Bridge-Origins der Extension.
  const files = walk(web).filter((f) => /\.(html|txt|xml|json)$/.test(f) && !f.includes(`${path.sep}data${path.sep}`));
  for (const f of files) assert.ok(!fs.readFileSync(f, 'utf8').includes('staymatch-tau'), `${path.relative(root, f)} nennt noch staymatch-tau`);
});

test('security.txt: Canonical zeigt auf staymatch.pro', () => {
  assert.match(read('.well-known/security.txt'), /^Canonical: https:\/\/staymatch\.pro\/\.well-known\/security\.txt$/m);
});

module.exports = { read, walk, web, root };
