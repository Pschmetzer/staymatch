// Größengrenzen, damit die Seite schlank bleibt (Bytes, unkomprimiert). Anpassen nur mit Begründung im PR.
import { readdirSync, statSync, existsSync } from 'node:fs';

const LIMITS = { 'web/index.html': 80_000, 'web/app.html': 40_000, jsEach: 60_000, jsTotal: 150_000 };
const errors = [];
const warnings = [];
const WARN_AT = 0.9; // Frühwarnung ab 90 % der Grenze
const size = (f) => statSync(f).size;
for (const f of ['web/index.html', 'web/app.html']) if (size(f) > LIMITS[f]) errors.push(`${f}: ${size(f)} > ${LIMITS[f]} Bytes`);
const js = readdirSync('web').filter((f) => f.endsWith('.js')).map((f) => `web/${f}`);
let total = 0;
for (const f of js) {
  total += size(f);
  if (size(f) > LIMITS.jsEach) errors.push(`${f}: ${size(f)} > ${LIMITS.jsEach} Bytes`);
  else if (size(f) > LIMITS.jsEach * WARN_AT) warnings.push(`${f}: ${size(f)} Bytes, über 90 % der Grenze ${LIMITS.jsEach}`);
}
// Städtedaten und Bilder: Grenzen je Datei (Bytes)
const walk = (dir) => existsSync(dir) ? readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(`${dir}/${d.name}`) : [`${dir}/${d.name}`]) : [];
for (const f of walk('web/data').filter((f) => f.endsWith('.json'))) if (size(f) > 2_500_000) errors.push(`${f}: ${size(f)} > 2500000 Bytes`);
for (const f of [...walk('web'), ].filter((f) => /\.(png|jpe?g|webp)$/.test(f) && !f.includes('/data/'))) if (size(f) > 400_000) errors.push(`${f}: ${size(f)} > 400000 Bytes`);
if (total > LIMITS.jsTotal) errors.push(`web/*.js zusammen: ${total} > ${LIMITS.jsTotal} Bytes`);
for (const w of warnings) console.warn('Warnung: ' + w);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Größen ok (web/*.js zusammen ${total} Bytes)`);
