// Prüft die vorab geladenen Städtedaten (web/data/*.json): Schema, Viertel-Typen, Namen, bbox, Alter, Größe.
// Aufruf: node scripts/check-data.mjs   (npm run check:data; läuft in CI, auch im wöchentlichen Lauf)
// Alter: Warnung ab 90 Tagen, Fehler ab 180 Tagen (sonst veralten Stadtseiten unbemerkt).
import { readFileSync, readdirSync, appendFileSync } from 'node:fs';
import { brotliCompressSync, constants } from 'node:zlib';
import { createRequire } from 'node:module';
import { VERSION, MIN_ROWS, BBOX_MARGIN, NAME_WARN, LICENSE, queryHash } from './city-data.mjs';

const C = createRequire(import.meta.url)('../shared/core.js');
const DIR = new URL('../web/data/', import.meta.url);
const DAY = 864e5, WARN_DAYS = 90, MAX_DAYS = 180;
// Brotli-Budget (Qualität 5 wie bei dynamischer Kompression; ausgeliefert wird eher kleiner)
const BR_EACH = 400_000, BR_TOTAL = 2_500_000; // seit Spalte shop (Nov. 2026): Paris ca. 343 KB

const errors = [], warnings = [];
const index = JSON.parse(readFileSync(new URL('index.json', DIR), 'utf8'));
const list = JSON.parse(readFileSync(new URL('../scripts/cities.json', import.meta.url), 'utf8'));
const files = readdirSync(DIR).filter(f => f.endsWith('.json') && f !== 'index.json').sort();
const hash = queryHash();
const sizes = [];
let brTotal = 0;

for (const [a, f] of Object.entries(index)) {
  if (C.normCity(a) !== a) errors.push(`index.json: Alias „${a}“ nicht in normCity-Form`);
  if (!files.includes(f)) errors.push(`index.json: ${a} → ${f} fehlt`);
}
for (const [k, aliases] of Object.entries(list)) for (const a of aliases) if (index[a] !== `${k}.json`) errors.push(`cities.json: Alias „${a}“ fehlt im Index (node scripts/prefetch-cities.mjs --reprocess)`);

for (const f of files) {
  const buf = readFileSync(new URL(f, DIR));
  const br = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }).length;
  brTotal += br; sizes.push([f, buf.length, br]);
  if (br > BR_EACH) errors.push(`${f}: ${br} Bytes Brotli > ${BR_EACH}`);
  const err = m => errors.push(`${f}: ${m}`), warn = m => warnings.push(`${f}: ${m}`);
  let d;
  try { d = JSON.parse(buf); } catch (e) { err('kein gültiges JSON: ' + e.message); continue; }
  if (!Object.values(index).includes(f)) err('steht nicht in index.json');
  if (d.v !== VERSION) err(`Schema-Version v=${d.v}, erwartet ${VERSION}`);
  if (d.license !== LICENSE || !String(d.attribution).includes('OpenStreetMap')) err('license/attribution fehlt');
  const age = (Date.now() - d.t) / DAY;
  if (!(age >= 0)) err('Feld t ungültig');
  else if (age > MAX_DAYS) err(`Daten ${Math.round(age)} Tage alt (über ${MAX_DAYS}), bitte auffrischen (CONTRIBUTING.md)`);
  else if (age > WARN_DAYS) warn(`Daten ${Math.round(age)} Tage alt`);
  if (d.queryHash !== hash) warn(`queryHash ${d.queryHash} ≠ aktuelle Abfrage ${hash} (Datei stammt aus älterer Abfrage)`);
  const missing = C.FIELDS.filter(x => !d.fields.includes(x));
  if (missing.length) warn(`Spalten fehlen: ${missing.join(', ')}`);
  const [s, w, n, e] = d.bbox || [];
  if (!(s < n && w < e)) { err('bbox ungültig'); continue; }
  if (!Array.isArray(d.center) || !(d.center[0] > s && d.center[0] < n && d.center[1] > w && d.center[1] < e)) err('center fehlt oder liegt außerhalb der bbox');
  if (d.rows.length < MIN_ROWS) err(`nur ${d.rows.length} Zeilen`);
  const iP = d.fields.indexOf('place'), iN = d.fields.indexOf('name');
  let areas = 0, outside = 0, badPlace = 0, badName = 0, long = 0;
  for (const r of d.rows) {
    if (r.length !== d.fields.length) { err(`Zeile mit ${r.length} Spalten`); break; }
    if (!(r[0] >= s - BBOX_MARGIN && r[0] <= n + BBOX_MARGIN && r[1] >= w - BBOX_MARGIN && r[1] <= e + BBOX_MARGIN)) outside++;
    if (r[iP] && !C.PLACE_TYPES.includes(r[iP])) badPlace++;
    if (r[iN] !== String(r[iN]).replace(/\s+/g, ' ').trim()) badName++;
    if (String(r[iN]).length > NAME_WARN) long++;
    if (r[iP] && r[iN]) areas++;
  }
  if (outside) err(`${outside} Punkte außerhalb der bbox`);
  if (badPlace) err(`${badPlace} Zeilen mit place außerhalb von PLACE_TYPES (würden als Viertel zählen)`);
  if (badName) err(`${badName} Namen mit Rand- oder Mehrfach-Leerzeichen`);
  if (long) warn(`${long} Namen über ${NAME_WARN} Zeichen`);
  if (areas < 2) err('weniger als 2 Viertel');
}
if (brTotal > BR_TOTAL) errors.push(`web/data zusammen ${brTotal} Bytes Brotli > ${BR_TOTAL}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Städtedaten\n\n| Datei | roh | Brotli |\n| --- | ---: | ---: |\n${sizes.map(([f, r, b]) => `| ${f} | ${Math.round(r / 1024)} KB | ${Math.round(b / 1024)} KB |`).join('\n')}\n| **zusammen** | | **${Math.round(brTotal / 1024)} KB** |\n\n`);
}
for (const w of warnings) console.warn('Warnung: ' + w);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Städtedaten ok (${files.length} Dateien, ${Math.round(brTotal / 1024)} KB Brotli)`);
