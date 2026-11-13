#!/usr/bin/env node
// Erzeugt aus web/data/*.json statische Stadtseiten web/staedte/<stadt>.html (Top-Viertel je Reisetyp).
// Nutzt web/scoring.js und web/core.js, keine Abhängigkeiten, keine Fremdhosts.
// Aufruf: node scripts/build-city-pages.mjs [--check]   (--check: schreibt nichts, prüft nur, ob die Seiten aktuell sind)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const web = path.join(root, 'web');
const C = require(path.join(web, 'core.js'));
require(path.join(web, 'scoring.js'));
const SM = globalThis.StayMatch;
// Öffentliche Adresse der Website (Plugin-APP_URL in shared/core.js zeigt noch auf die alte Vercel-Adresse)
const BASE = 'https://staymatch.pro';

// Reisetypen: Schlüssel in core.js PRESETS, Überschrift, Kurzbeschreibung
const TYPES = [
  ['party', 'Party und Nachtleben', 'Viele Bars und Clubs in der Nähe, gute Anbindung.'],
  ['family', 'Familien', 'Ruhig, viel für Kinder, Parks und Einkaufen in Reichweite.'],
  ['chill', 'Ruhe und Erholung', 'Wenig Party, dafür Cafés, Grün und kurze Wege.'],
  ['sights', 'Sightseeing', 'Nah an Sehenswürdigkeiten, Bahn und Restaurants.'],
  ['foodie', 'Essen und Trinken', 'Die dichteste Auswahl an Restaurants und Cafés.'],
];
const TOP = 5;

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = file => file.replace(/\.json$/, '');
// Airbnb-Suche für ein Viertel (gleiches Format wie die Schnellsuche der Startseite, URL nicht offiziell dokumentiert)
const airbnb = (area, city) => `https://www.airbnb.de/s/${encodeURIComponent(`${area}, ${city}`)}/homes`;

export function rankCity(d) {
  const rows = d.rows.map(v => Object.fromEntries(d.fields.map((f, i) => [f, v[i]]).filter(([, x]) => x !== '' && x != null)));
  const areas = [], raw = [];
  for (const t of rows) {
    const lat = +t.lat, lon = +t.lon;
    if (!lat) continue;
    if (t.place && t.name) { if (!areas.some(a => a.name === t.name && SM.distM(a, { lat, lon }) < 1500)) areas.push({ name: t.name, lat, lon }); continue; }
    for (const cat of SM.categoriesOf(t)) raw.push({ lat, lon, cat, name: t.name, tags: t });
  }
  const pois = SM.dedupePois(raw);
  const radius = pois.filter(p => p.cat === 'transit').length >= 60 ? 1200 : 800;
  SM.scoreAreas(areas, pois, radius);
  const out = {};
  for (const [key] of TYPES) {
    const w = C.PRESETS[key].w;
    out[key] = areas.map(a => ({ a, s: SM.personScore(a.norm, w) }))
      .sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name, 'de'))
      .slice(0, TOP);
  }
  return { areas: areas.length, pois: pois.length, radius, top: out };
}

export function renderPage(file, d) {
  const name = d.city, url = `${BASE}/staedte/${slug(file)}`;
  const r = rankCity(d);
  const date = new Date(d.t).toISOString().slice(0, 10);
  const title = `Beste Viertel in ${name} · StayMatch`;
  const desc = `Die besten Viertel in ${name} für Party, Familien, Ruhe, Sightseeing und Essen, berechnet aus OpenStreetMap-Daten (${r.areas} Viertel).`;
  const sections = TYPES.map(([key, label, text]) => `<h2>${esc(label)}</h2>
<p>${esc(text)}</p>
<ol>
${r.top[key].map(({ a, s }) => `<li><b>${esc(a.name)}</b> <span class="pts">${s} von 100</span> <a class="bnb" href="${airbnb(a.name, name)}" target="_blank" rel="noopener">Unterkünfte auf Airbnb <span aria-hidden="true">↗</span></a></li>`).join('\n')}
</ol>`).join('\n');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/legal.css">
<style>.pts{color:var(--muted);font-size:14px;margin-left:6px}ol{padding-left:22px}.bnb{display:block;width:fit-content;font-size:14px;color:var(--muted)}.cta{display:inline-block;margin-top:24px;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none}</style>
</head><body><main>
<a class="back" href="/">← StayMatch</a>
<h1>Beste Viertel in ${esc(name)}</h1>
<p class="stand">Stand der Daten: ${date}. Bewertet werden Bars, Restaurants, Sehenswürdigkeiten, Bahnhöfe, Parks und mehr im Umkreis von ${r.radius} m um jedes Viertel (${r.areas} Viertel, ${r.pois} Orte).</p>
${sections}
<p><a class="cta" href="/app">Eigene Gruppe in ${esc(name)} vergleichen</a></p>
<footer>Daten: © OpenStreetMap-Mitwirkende, <a href="https://opendatacommons.org/licenses/odbl/1-0/" rel="noopener">Open Database License (ODbL) 1.0</a>, <a href="https://www.openstreetmap.org/copyright" rel="noopener">Quelle</a>. Die Werte sind eine Schätzung aus Kartendaten, keine Preise und keine Bewertungen. Nicht mit Airbnb verbunden; Airbnb ist eine Marke der Airbnb, Inc. · <a href="/datenschutz">Datenschutz</a> · <a href="/">Startseite</a></footer>
</main></body></html>
`;
}

export function build({ check = false } = {}) {
  const dir = path.join(web, 'data'), outDir = path.join(web, 'staedte');
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort();
  const stale = [];
  if (!check) mkdirSync(outDir, { recursive: true });
  for (const f of files) {
    const html = renderPage(f, JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
    const target = path.join(outDir, slug(f) + '.html');
    if (check) { if (!existsSync(target) || readFileSync(target, 'utf8') !== html) stale.push(slug(f)); }
    else writeFileSync(target, html);
  }
  return { files: files.length, stale };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { files, stale } = build({ check });
  if (check && stale.length) { console.error('Stadtseiten veraltet: ' + stale.join(', ') + ' (node scripts/build-city-pages.mjs)'); process.exit(1); }
  console.log(check ? `${files} Stadtseiten aktuell` : `${files} Stadtseiten in web/staedte/ erzeugt`);
}
