// Größengrenzen, damit die Seite schlank bleibt (Bytes, unkomprimiert). Anpassen nur mit Begründung im PR.
import { readdirSync, statSync, existsSync, appendFileSync } from 'node:fs';

const LIMITS = { 'web/index.html': 90_000, 'web/en.html': 90_000, // DE/EN: beide über 97 % der alten 80 KB (unkomprimiert, ausgeliefert mit Brotli)
   'web/app.html': 40_000, 'web/404.html': 10_000, 'web/datenschutz.html': 20_000, 'web/impressum.html': 10_000, city: 20_000, jsEach: 60_000, jsTotal: 170_000 }; // R7: app-extra.js (Viertel-Features) kam dazu; unkomprimiert gemessen, ausgeliefert mit Brotli
const errors = [];
const warnings = [];
const WARN_AT = 0.9; // Frühwarnung ab 90 % der Grenze
const size = (f) => statSync(f).size;
const pages = Object.keys(LIMITS).filter((f) => f.startsWith('web/'));
const cityPages = readdirSync('web/staedte').filter((f) => f.endsWith('.html')).map((f) => `web/staedte/${f}`);
for (const f of [...pages, ...cityPages]) {
  const max = LIMITS[f] ?? LIMITS.city;
  if (size(f) > max) errors.push(`${f}: ${size(f)} > ${max} Bytes`);
  else if (size(f) > max * WARN_AT) warnings.push(`${f}: ${size(f)} Bytes, über 90 % der Grenze ${max}`);
}
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
// In GitHub Actions: Größen ins Job-Summary, damit Wachstum je PR sichtbar wird
if (process.env.GITHUB_STEP_SUMMARY) {
  const rows = [...js, ...pages, ...cityPages].map((f) => `| ${f} | ${size(f)} | ${f.endsWith('.js') ? LIMITS.jsEach : LIMITS[f] ?? LIMITS.city} |`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Größen (Bytes, unkomprimiert)\n\n| Datei | Größe | Grenze |\n| --- | ---: | ---: |\n${rows.join('\n')}\n| web/*.js zusammen | ${total} | ${LIMITS.jsTotal} |\n\n`);
}
for (const w of warnings) console.warn('Warnung: ' + w);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Größen ok (web/*.js zusammen ${total} Bytes)`);
