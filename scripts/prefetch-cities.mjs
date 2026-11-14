// Lädt die OpenStreetMap-Daten beliebter Städte vorab und schreibt sie nach web/data/.
// Die Web-App nutzt diese Dateien zuerst und fragt Overpass nur für andere Städte.
// Aufruf: node scripts/prefetch-cities.mjs [Optionen] [Stadt ...]   (ohne Städte: Liste aus scripts/cities.json)
//   --dry-run    holen, prüfen, Bericht ausgeben, nichts schreiben
//   --force      auch schreiben, wenn die neue Datei deutlich weniger Zeilen hat als die alte
//   --geocode    vorhandene Städte neu bei Nominatim suchen (sonst bleiben Suchfläche und Zentrum der alten Datei)
//   --resume     nach Abbruch weitermachen: Städte überspringen, die der letzte (abgebrochene) Lauf schon geschrieben hat
//   --reprocess  nichts holen: vorhandene Dateien neu aufbereiten (Format, Filter) und Index/NOTICE neu schreiben
// Rücksicht auf die freiwilligen Server: eine Stadt nach der anderen, Pause dazwischen.
// Ablauf einer Datenauffrischung: CONTRIBUTING.md, Abschnitt „Städtedaten aktualisieren“.
import { writeFile, readFile, rename, mkdir, readdir, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildCity, serialize, summary, queryHash, overpassQueryTab, parseOverpassTsv, MIN_ROWS, MIN_SHARE, NAME_WARN, LICENSE, ATTRIBUTION } from './city-data.mjs';

// gemeinsamer Kern (gleiche Abfrage, gleiche Felder, gleiche Ortsauswahl wie die Web-App)
const require = createRequire(import.meta.url);
const C = require('../shared/core.js');
require('../web/scoring.js');
const SM = globalThis.StayMatch;

const OUT = new URL('../web/data/', import.meta.url);
const LIST = new URL('cities.json', import.meta.url);
const NOTICE = new URL('NOTICE.md', OUT);
const FIELDS = C.FIELDS, SERVERS = C.OVERPASS_SERVERS;
const UA = 'StayMatch-prefetch (+https://github.com/Pschmetzer/staymatch)';
const args = process.argv.slice(2);
const flag = f => args.includes(f);
const DRY = flag('--dry-run'), FORCE = flag('--force'), REPROCESS = flag('--reprocess'), RESUME = flag('--resume'), GEOCODE = flag('--geocode');
const names = args.filter(a => !a.startsWith('--'));

const norm = C.normCity; // muss zur Suche in der Web-App passen
const slug = c => norm(c).replace(/\s+/g, '-');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const readJson = async (u, d) => JSON.parse(await readFile(u, 'utf8').catch(() => JSON.stringify(d)));
// Erst in eine Nachbardatei schreiben, dann umbenennen: ein Abbruch hinterlässt nie halbes JSON
async function writeAtomic(u, text) { const tmp = new URL(u.href + '.tmp'); await writeFile(tmp, text); await rename(tmp, u); }

// Wie die App: bis zu 5 Treffer, StayMatch.placeChoices wählt; Vorabladen nimmt den ersten und warnt bei mehreren
async function geocode(city) {
  for (let i = 0; i < 3; i++) {
    const r = await fetch(C.nominatimUrl(city, 'de', 5), { headers: { 'User-Agent': UA } });
    if (r.ok) {
      const choices = SM.placeChoices(await r.json());
      if (!choices.length) throw new Error('nicht gefunden: ' + city);
      if (choices.length > 1) console.warn(`  Hinweis: ${choices.length} Orte für „${city}“, nehme ${choices[0].display_name}`);
      return C.geoFromNominatim(choices[0]);
    }
    console.warn(`  Nominatim antwortet ${r.status}, neuer Versuch in 10 s`);
    await sleep(10000);
  }
  throw new Error('Nominatim nicht erreichbar (mehrfach Fehlerstatus)');
}

async function overpass(bbox) {
  let last;
  for (let round = 0; round < 2; round++) for (const url of SERVERS) {
    try {
      const t0 = Date.now();
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(overpassQueryTab(bbox)), headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
      const t = await r.text();
      if (r.ok && t.startsWith('@lat')) return { text: t, source: new URL(url).host, ms: Date.now() - t0 };
      last = new Error(`${url}: ${r.status}`);
    } catch (e) { last = e; }
    await sleep(15000);
  }
  throw last;
}

const pct = (a, b) => (b ? `${a >= b ? '+' : ''}${Math.round((a / b - 1) * 100)} %` : 'neu');
const report = [];
function addReport(key, old, d, extra = '') {
  const o = old ? summary(old) : null, s = summary(d);
  report.push(`| ${key} | ${o ? o.rows : '–'} → ${s.rows} (${pct(s.rows, o && o.rows)}) | ${o ? o.areas : '–'} → ${s.areas} | ${o ? o.kb : '–'} → ${s.kb} | ${extra} |`);
}
function logStats(stats) {
  const parts = [`${stats.out} Zeilen`];
  if (stats.empty) parts.push(`${stats.empty} ohne Viertel/Kategorie oder mit falscher Spaltenzahl verworfen`);
  if (stats.outside) parts.push(`${stats.outside} außerhalb der bbox verworfen`);
  if (stats.placeCleared) parts.push(`${stats.placeCleared}× place ohne Viertel-Typ geleert`);
  console.log('  ' + parts.join(', '));
  for (const n of stats.longNames.slice(0, 5)) console.warn(`  Warnung: Name über ${NAME_WARN} Zeichen: ${n}`);
}

// NOTICE.md: Tabelle der Abrufdaten zwischen den Markierungen neu schreiben
async function writeNotice(files) {
  const rows = [];
  for (const f of files.sort()) {
    const d = await readJson(new URL(f, OUT), null);
    if (d && d.rows) rows.push(`| ${d.city} | \`${f}\` | ${new Date(d.t).toISOString().slice(0, 10)} | ${d.rows.length} |`);
  }
  const table = ['| Stadt | Datei | Abruf | Zeilen |', '| --- | --- | --- | --- |', ...rows].join('\n');
  const text = await readFile(NOTICE, 'utf8');
  const next = text.replace(/(<!-- staedte:start -->)[\s\S]*?(<!-- staedte:end -->)/, `$1\n${table}\n$2`);
  if (next !== text) await writeAtomic(NOTICE, next);
}

const list = await readJson(LIST, {});
const index = await readJson(new URL('index.json', OUT), {});
await mkdir(OUT, { recursive: true });
const wanted = names.length ? Object.fromEntries(names.map(c => [slug(c), list[slug(c)] || [norm(c)]])) : list;
let failed = 0, listChanged = false;
// Wiederaufnahme-Marker: erledigte Städte des laufenden Datenlaufs (liegt im Temp-Ordner, nie im Repo)
const STATE = new URL('file://' + path.join(tmpdir(), 'staymatch-prefetch-state.json'));
const state = RESUME ? await readJson(STATE, { done: [] }) : { done: [] };
const todo = Object.keys(wanted).filter(k => !state.done.includes(k));
if (RESUME && state.done.length) console.log(`--resume: übersprungen (schon geholt): ${state.done.filter(k => k in wanted).join(', ') || '–'}`);

for (const key of todo) {
  const aliases = wanted[key];
  const file = new URL(`${key}.json`, OUT);
  const old = await readJson(file, null);
  try {
    console.log('→', key);
    let built;
    if (REPROCESS) {
      if (!old) throw new Error('keine Datei zum Neuaufbereiten');
      built = buildCity({ ...old, queryHash: old.queryHash }, old.fields, old.rows);
    } else {
      // Vorhandene Stadt: gespeicherte Suchfläche und Zentrum behalten (Nominatim verschiebt Treffer mitunter,
      // z. B. Budapest), neu suchen nur mit --geocode
      const geo = old && old.center && old.bbox && !GEOCODE
        ? { name: old.city, lat: old.center[0], lon: old.center[1], bbox: old.bbox }
        : await geocode(key).then(async g => { await sleep(1500); return g; });
      const res = await overpass(geo.bbox);
      const { rows, dropped } = parseOverpassTsv(res.text);
      if (dropped) console.warn(`  ${dropped} Zeilen mit falscher Spaltenzahl (z. B. Tabulator im Namen) verworfen`);
      built = buildCity({ t: Date.now(), city: geo.name, center: [geo.lat, geo.lon], bbox: geo.bbox, source: res.source, ms: res.ms, queryHash: queryHash() }, FIELDS, rows);
    }
    const { data, stats } = built;
    logStats(stats);
    if (data.rows.length < MIN_ROWS) throw new Error(`nur ${data.rows.length} Zeilen (Minimum ${MIN_ROWS}), Datei bleibt unverändert`);
    if (!REPROCESS && old && old.rows && data.rows.length < old.rows.length * MIN_SHARE && !FORCE)
      throw new Error(`nur ${data.rows.length} statt bisher ${old.rows.length} Zeilen (unter ${MIN_SHARE * 100} %), Teilantwort? Mit --force trotzdem schreiben`);
    addReport(key, old, data, data.source ? `${data.source}, ${Math.round(data.ms / 1000)} s` : '');
    if (DRY) continue;
    await writeAtomic(file, serialize(data));
    for (const a of [...aliases, norm(data.city)]) index[a] = `${key}.json`;
    await writeAtomic(new URL('index.json', OUT), JSON.stringify(index, null, 1) + '\n');
    // Per Argument geholte Städte in die Standardliste aufnehmen, sonst frischt sie der nächste Lauf nie auf
    if (!list[key]) { list[key] = aliases; listChanged = true; }
    state.done.push(key);
    if (!REPROCESS) await writeAtomic(STATE, JSON.stringify(state));
  } catch (e) { failed++; console.error('  Fehler', key, e.message); }
  if (!REPROCESS && key !== todo[todo.length - 1]) await sleep(30000); // Pause nur zwischen zwei Städten
}

if (!DRY) {
  if (listChanged) { await writeAtomic(LIST, JSON.stringify(list, null, 1) + '\n'); console.log('scripts/cities.json ergänzt'); }
  await writeNotice((await readdir(OUT)).filter(f => f.endsWith('.json') && f !== 'index.json'));
}
console.log(`\nÄnderungsbericht (${LICENSE}, ${ATTRIBUTION}):\n| Stadt | Zeilen | Viertel | KB | Quelle |\n| --- | --- | --- | --- | --- |\n${report.join('\n')}`);
if (!DRY && !REPROCESS) console.log('\nDanach: node scripts/build-city-pages.mjs && npm test && npm run check:data');
if (!failed && !DRY && !REPROCESS) await rm(STATE, { force: true }); // Lauf vollständig: Marker löschen
if (failed) { console.error(`${failed} Stadt/Städte fehlgeschlagen`); process.exitCode = 1; }
