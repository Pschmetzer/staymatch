// Größengrenzen, damit die Seite schlank bleibt (Bytes, unkomprimiert). Anpassen nur mit Begründung im PR.
import { readdirSync, statSync } from 'node:fs';

const LIMITS = { 'web/index.html': 80_000, 'web/app.html': 40_000, jsEach: 60_000, jsTotal: 150_000 };
const errors = [];
const size = (f) => statSync(f).size;
for (const f of ['web/index.html', 'web/app.html']) if (size(f) > LIMITS[f]) errors.push(`${f}: ${size(f)} > ${LIMITS[f]} Bytes`);
const js = readdirSync('web').filter((f) => f.endsWith('.js')).map((f) => `web/${f}`);
let total = 0;
for (const f of js) {
  total += size(f);
  if (size(f) > LIMITS.jsEach) errors.push(`${f}: ${size(f)} > ${LIMITS.jsEach} Bytes`);
}
if (total > LIMITS.jsTotal) errors.push(`web/*.js zusammen: ${total} > ${LIMITS.jsTotal} Bytes`);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Größen ok (web/*.js zusammen ${total} Bytes)`);
