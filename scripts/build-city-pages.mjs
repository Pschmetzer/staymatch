#!/usr/bin/env node
// Erzeugt aus web/data/*.json statische Stadtseiten web/staedte/<stadt>.html (Top-Viertel je Reisetyp).
// Nutzt web/scoring.js und web/core.js, keine Abhängigkeiten, keine Fremdhosts.
// Aufruf: node scripts/build-city-pages.mjs [--check]   (--check: schreibt nichts, prüft nur, ob die Seiten aktuell sind)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
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
  ['foodie', 'Essen und Trinken', 'Die dichteste Auswahl an Restaurants und Imbissen (Cafés zählen hier nicht mit).'],
];
const TOP = 5;
// „Kurz und einfach“ (R7-742): kurze Sätze, Inhalt nur aus rankCity (Platz 1 je Reisetyp, Anzahl Viertel), nichts erfunden
export function simpleSection(name, r) {
  const items = TYPES.map(([key, label]) => r.top[key][0] ? `<li>Für ${esc(label)}: <b>${esc(r.top[key][0].a.name)}</b>.</li>` : '').filter(Boolean);
  return `<section class="simple" aria-labelledby="kurz"><h2 id="kurz">Kurz und einfach</h2>
<p>Wir haben ${r.areas} Viertel in ${esc(name)} verglichen. Nach unserer Rechnung passen diese am besten:</p>
<ul>
${items.join('\n')}
</ul>
<p>Die Punkte kommen aus Karten-Daten. Sie sagen nichts über Preise oder Unterkünfte.</p>
</section>`;
}
// legal.css wird lange gecacht; die Version im Link ändert sich mit dem Inhalt
const CSS_V = createHash('sha256').update(readFileSync(path.join(web, 'legal.css'))).digest('hex').slice(0, 8);

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = file => file.replace(/\.json$/, '');
// Rechenregeln wie in der App (web/app.js compute): Umkreis, Entfernung zum Zentrum, Abstand der Empfehlungen.
// Umkreis = Standard der App (C.RADIUS.area, 800 m), nicht C.autoRadius: die App stellt den Umkreis nicht automatisch um.
const RADIUS = C.RADIUS.area;
const MAX_CENTER_M = 6000; // Filter „Entfernung zum Zentrum“ der App, hier fest 6 km (Randsiedlungen sind keine Empfehlung für Städtereisen)
const MIN_DIST = Math.max(C.RADIUS.diverse, RADIUS * 1.5); // wie die App: keine zwei Empfehlungen als direkte Nachbarn
const fmtKm = m => (m / 1000).toFixed(1).replace('.', ',');
const fmtDate = ms => new Date(ms).toISOString().slice(0, 10);
const fmtDateDe = ms => fmtDate(ms).split('-').reverse().join('.');
// Airbnb-Suche für ein Viertel: gleicher Deep-Link wie die App (Kartenausschnitt um das Viertel, Radius wie die Wertung)
const airbnb = (a, city) => SM.airbnbUrl({ lat: a.lat, lon: a.lon, name: a.name, city, radius: RADIUS });

export function rankCity(d) {
  // Gleiche Logik wie die Web-App (shared/core.js, web/scoring.js): nur echte Viertel, Plätze zählen als Orte,
  // Viertel mit zu wenig Orten oder zu weit vom Zentrum fallen heraus, Empfehlungen mit Mindestabstand (pickDiverse)
  const { areas, raw } = C.splitRows(C.rowsToTags(d.fields, d.rows), SM.categoriesOf);
  const pois = SM.dedupePois(raw);
  SM.scoreAreas(areas, pois, RADIUS);
  SM.annotateCentre(areas, SM.fromFile(d).geo);
  const out = {};
  let eligible = 0;
  for (const [key] of TYPES) {
    const w = C.PRESETS[key].w, ppl = [{ name: key, type: key, w, veto: [] }];
    const { withData } = SM.eligibleAreas(areas, ppl, MAX_CENTER_M);
    eligible = Math.max(eligible, withData.length);
    const sorted = withData.map(a => ({ a, s: SM.personScore(a.norm, w) }))
      .sort((x, y) => y.s - x.s || x.a.name.localeCompare(y.a.name, 'de'));
    const picked = SM.pickDiverse(sorted.map(x => x.a), TOP, MIN_DIST);
    out[key] = picked.map(a => sorted.find(x => x.a === a));
  }
  return { areas: areas.length, eligible, pois: pois.length, radius: RADIUS, top: out };
}

// Hinweise zur Viertel-Ebene je Stadt (OSM trägt je Stadt unterschiedlich feine Ebenen ein; siehe web/data/NOTICE.md)
const LEVEL_NOTES = {
  barcelona: 'Der Eixample ist in OpenStreetMap in mehrere Teilviertel zerlegt (Dreta, Antiga und Nova Esquerra); sie können nebeneinander in einer Liste stehen.',
  budapest: 'Ein großer Teil der Einträge sind Wohnsiedlungen (Lakótelep) und Stadtteile am Rand, die kaum Orte für Reisende haben.',
  lissabon: 'Lissabon ist in OpenStreetMap sehr fein in kleine Freguesias unterteilt; eine Gegend kann daher mehrfach auftauchen.',
};
// Englische Seiten: Name und Adresse je Stadt (die Daten selbst sind sprachneutral). Schlüssel = Dateiname in web/data.
export const EN = {
  lissabon: ['Lisbon', 'lisbon'], prag: ['Prague', 'prague'], rom: ['Rome', 'rome'], wien: ['Vienna', 'vienna'],
  warschau: ['Warsaw', 'warsaw'], brussel: ['Brussels', 'brussels'], zurich: ['Zurich', 'zurich'], antwerpen: ['Antwerp', 'antwerp'], malaga: ['Málaga', 'malaga'],
};
export const enName = (key, d) => (EN[key] ? EN[key][0] : d.city);
export const enSlug = key => (EN[key] ? EN[key][1] : key);
const enUrl = key => `${BASE}/en/cities/${enSlug(key)}`;
// Stadtbild für Vorschauen (og:image), falls vorhanden
const hasImage = key => existsSync(path.join(web, 'media', 'staedte', `${key}.webp`));

// ctx.cities: alle Stadtseiten [{ slug, name }] für die Querverlinkung
export function renderPage(file, d, ctx = {}) {
  const key = slug(file), name = d.city, url = `${BASE}/staedte/${key}`;
  const r = rankCity(d);
  const date = fmtDate(d.t), dateDe = fmtDateDe(d.t);
  const title = `Wo übernachten in ${name}? Beste Viertel (Stand ${dateDe}) · StayMatch`;
  const picks = [['party', 'Party'], ['family', 'Familien'], ['chill', 'Ruhe']].filter(([k]) => r.top[k][0]).map(([k, l]) => `${l}: ${r.top[k][0].a.name}`);
  const desc = `Wo übernachten in ${name}? ${picks.join(', ')}. ${r.eligible} Viertel aus OpenStreetMap-Daten verglichen, Stand ${dateDe}.`;
  const appUrl = `/app?c=${encodeURIComponent(name)}`;
  const img = hasImage(key) ? `${BASE}/media/staedte/${key}.webp` : `${BASE}/og.png`;
  const others = (ctx.cities || []).filter(c => c.slug !== key);
  const sections = TYPES.map(([k, label, text]) => `<section id="${k}">
<h2>${esc(label)}</h2>
<p>${esc(text)}</p>
<ol>
${r.top[k].map(({ a, s }) => `<li><b>${esc(a.name)}</b> <span class="pts">${s} von 100 · ${fmtKm(a.centerDist)} km zum Zentrum</span> <a class="bnb" href="${esc(airbnb(a, name))}" target="_blank" rel="noopener">Unterkünfte auf Airbnb <span aria-hidden="true">↗</span></a></li>`).join('\n')}
</ol>
</section>`).join('\n');
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'StayMatch', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Städte', item: `${BASE}/#staedte` },
      { '@type': 'ListItem', position: 3, name, item: url }] },
    { '@type': 'WebPage', '@id': url, url, name: title, inLanguage: 'de', dateModified: date },
    ...TYPES.map(([k, label]) => ({ '@type': 'ItemList', name: `Beste Viertel in ${name} für ${label}`, itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: r.top[k].length,
      itemListElement: r.top[k].map(({ a }, i) => ({ '@type': 'ListItem', position: i + 1, name: a.name })) })),
  ] };
  const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  const ctaTop = `<p class="ctas"><a class="cta" href="${esc(appUrl)}">Eigene Gruppe in ${esc(name)} vergleichen</a></p>`;
  const note = (LEVEL_NOTES[key] ? ` ${esc(LEVEL_NOTES[key])}` : '') + (d.reduced && d.reduced.includes('unnamedGarden') ? ' Unbenannte Gärten (meist private) sind in den Daten dieser Stadt nicht enthalten.' : '');
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="de" href="${url}">
<link rel="alternate" hreflang="en" href="${enUrl(key)}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta property="og:type" content="article"><meta property="og:site_name" content="StayMatch"><meta property="og:locale" content="de_DE">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${img}"><meta property="og:image:alt" content="${esc(name)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#fbfaf8">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/legal.css?v=${CSS_V}">
<style>.pts{color:var(--muted);font-size:14px;margin-left:6px}ol{padding-left:22px}.bnb{display:block;width:fit-content;font-size:14px;color:var(--muted)}.ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.cta{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none}.cta.alt{background:none;color:var(--text);border:1px solid var(--muted)}.simple{border:1px solid var(--muted);border-radius:12px;padding:4px 16px;margin:20px 0}.jump{display:flex;flex-wrap:wrap;gap:6px 16px;list-style:none;padding:0;margin:16px 0}.jump li{margin:0}.sticky{display:none}@media(max-width:700px){main{padding-bottom:96px}.sticky{display:block;position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--line);text-align:center;z-index:5}.sticky .cta{display:block}}</style>
<script type="application/ld+json">${ld}</script>
</head><body><main>
<nav class="crumbs" aria-label="Brotkrümel"><a href="/">StayMatch</a> › <a href="/#staedte">Städte</a> › <span aria-current="page">${esc(name)}</span></nav>
<h1>Wo übernachten in ${esc(name)}? Beste Viertel</h1>
<p class="stand">Stand der Daten: ${dateDe}. Bewertet werden Bars, Restaurants, Sehenswürdigkeiten, Bahnhöfe, Parks und mehr im Umkreis von ${r.radius} m um jedes Viertel (${r.areas} Viertel in den Daten, ${r.eligible} davon mit genug Orten und höchstens ${MAX_CENTER_M / 1000} km vom Zentrum; ${r.pois} Orte).</p>
<p class="stand">Punkte von 0 bis 100: 100 hieße, dass ein Viertel in allen für diesen Reisetyp wichtigen Kategorien die dichteste Auswahl der Stadt hat. <a href="/#rechnen">Wie StayMatch rechnet</a></p>
${ctaTop}
<ul class="jump" aria-label="Sprungmarken"><li><a href="#kurz">Kurz und einfach</a></li>${TYPES.map(([k, label]) => `<li><a href="#${k}">${esc(label)}</a></li>`).join('')}<li><a href="#daten">Datenquelle</a></li><li><a href="#staedte">Weitere Städte</a></li></ul>
${simpleSection(name, r)}
${sections}
<p class="ctas"><a class="cta" href="${esc(appUrl)}">Eigene Gruppe in ${esc(name)} vergleichen</a><a class="cta alt" href="/#plugin">Unterkünfte dort bewerten: Plugin holen</a></p>
<section id="daten"><h2>Datenquelle und Grenzen</h2>
<p>Quelle: © OpenStreetMap-Mitwirkende (ODbL 1.0), abgerufen am ${dateDe}${d.source ? ` über die Overpass-API (${esc(d.source)})` : ''}. Als Viertel zählt, was in OpenStreetMap als Stadtteil, Quartier oder Nachbarschaft eingetragen ist; wie fein das unterteilt ist, unterscheidet sich je Stadt.${note}</p></section>
<nav id="staedte" aria-label="Weitere Städte"><h2>Weitere Städte</h2>
<ul class="jump">${others.map(c => `<li><a href="/staedte/${c.slug}">${esc(c.name)}</a></li>`).join('')}</ul></nav>
<footer>
<p>Daten: © OpenStreetMap-Mitwirkende, <a href="https://opendatacommons.org/licenses/odbl/1-0/" rel="noopener">Open Database License (ODbL) 1.0</a>, <a href="https://www.openstreetmap.org/copyright" rel="noopener">Quelle</a>.</p>
<p>Die Werte sind eine Schätzung aus Kartendaten, keine Preise und keine Bewertungen. Nicht mit Airbnb verbunden; Airbnb ist eine Marke der Airbnb, Inc.</p>
<ul class="nav"><li><a href="/">Startseite</a></li><li><a href="/datenschutz">Datenschutz</a></li><li><a href="/impressum">Impressum</a></li></ul>
</footer>
</main>
<div class="sticky"><a class="cta" href="${esc(appUrl)}">Gruppe in ${esc(name)} vergleichen</a></div>
</body></html>
`;
}

// Englische Stadtseite web/en/cities/<slug>.html (gleiche Daten und Rangfolge wie die deutsche Seite)
const TYPES_EN = [
  ['party', 'Party and nightlife', 'Lots of bars and clubs nearby, good transport links.'],
  ['family', 'Families', 'Quiet, plenty for kids, parks and shopping within reach.'],
  ['chill', 'Quiet and relaxation', 'Little partying, but cafés, green space and short distances.'],
  ['sights', 'Sightseeing', 'Close to sights, rail and restaurants.'],
  ['foodie', 'Food and drink', 'The densest choice of restaurants and takeaways (cafés do not count here).'],
];
const fmtKmEn = m => (m / 1000).toFixed(1);
export function renderPageEn(file, d, ctx = {}) {
  const key = slug(file), name = enName(key, d), url = enUrl(key), deUrl = `${BASE}/staedte/${key}`;
  const r = rankCity(d);
  const date = fmtDate(d.t);
  const title = `Where to stay in ${name}? Best neighborhoods (data from ${date}) · StayMatch`;
  const picks = [['party', 'Party'], ['family', 'Families'], ['chill', 'Quiet']].filter(([k]) => r.top[k][0]).map(([k, l]) => `${l}: ${r.top[k][0].a.name}`);
  const desc = `Where to stay in ${name}? ${picks.join(', ')}. ${r.eligible} neighborhoods compared from OpenStreetMap data, as of ${date}.`;
  const appUrl = `/app?c=${encodeURIComponent(name)}`;
  const img = hasImage(key) ? `${BASE}/media/staedte/${key}.webp` : `${BASE}/og.png`;
  const others = (ctx.cities || []).filter(c => c.slug !== key);
  const sections = TYPES_EN.map(([k, label, text]) => `<section id="${k}">
<h2>${esc(label)}</h2>
<p>${esc(text)}</p>
<ol>
${r.top[k].map(({ a, s }) => `<li><b>${esc(a.name)}</b> <span class="pts">${s} of 100 · ${fmtKmEn(a.centerDist)} km to the center</span> <a class="bnb" href="${esc(airbnb(a, name))}" target="_blank" rel="noopener">Stays on Airbnb <span aria-hidden="true">↗</span></a></li>`).join('\n')}
</ol>
</section>`).join('\n');
  const simple = TYPES_EN.map(([k, label]) => r.top[k][0] ? `<li>For ${esc(label.toLowerCase())}: <b>${esc(r.top[k][0].a.name)}</b>.</li>` : '').filter(Boolean).join('\n');
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'StayMatch', item: `${BASE}/en` },
      { '@type': 'ListItem', position: 2, name: 'Cities', item: `${BASE}/en#staedte` },
      { '@type': 'ListItem', position: 3, name, item: url }] },
    { '@type': 'WebPage', '@id': url, url, name: title, inLanguage: 'en', dateModified: date },
    ...TYPES_EN.map(([k, label]) => ({ '@type': 'ItemList', name: `Best neighborhoods in ${name} for ${label.toLowerCase()}`, itemListOrder: 'https://schema.org/ItemListOrderDescending', numberOfItems: r.top[k].length,
      itemListElement: r.top[k].map(({ a }, i) => ({ '@type': 'ListItem', position: i + 1, name: a.name })) })),
  ] };
  const ld = JSON.stringify(jsonLd).replace(/</g, '\\u003c');
  const cta = `<p class="ctas"><a class="cta" href="${esc(appUrl)}" hreflang="de">Compare your own group in ${esc(name)}</a></p>`;
  const reduced = d.reduced && d.reduced.includes('unnamedGarden') ? ' Unnamed gardens (mostly private ones) are not part of this city’s data.' : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${url}">
<link rel="alternate" hreflang="de" href="${deUrl}">
<link rel="alternate" hreflang="x-default" href="${deUrl}">
<meta property="og:type" content="article"><meta property="og:site_name" content="StayMatch"><meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${img}"><meta property="og:image:alt" content="${esc(name)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#fbfaf8">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/legal.css?v=${CSS_V}">
<style>.pts{color:var(--muted);font-size:14px;margin-left:6px}ol{padding-left:22px}.bnb{display:block;width:fit-content;font-size:14px;color:var(--muted)}.ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.cta{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none}.cta.alt{background:none;color:var(--text);border:1px solid var(--muted)}.simple{border:1px solid var(--muted);border-radius:12px;padding:4px 16px;margin:20px 0}.jump{display:flex;flex-wrap:wrap;gap:6px 16px;list-style:none;padding:0;margin:16px 0}.jump li{margin:0}.sticky{display:none}@media(max-width:700px){main{padding-bottom:96px}.sticky{display:block;position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--line);text-align:center;z-index:5}.sticky .cta{display:block}}</style>
<script type="application/ld+json">${ld}</script>
</head><body><main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="/en">StayMatch</a> › <a href="/en#staedte">Cities</a> › <span aria-current="page">${esc(name)}</span></nav>
<h1>Where to stay in ${esc(name)}? Best neighborhoods</h1>
<p class="stand">Data from ${date}. We score bars, restaurants, sights, stations, parks and more within ${r.radius} m of each neighborhood (${r.areas} neighborhoods in the data, ${r.eligible} of them with enough places and at most ${MAX_CENTER_M / 1000} km from the center; ${r.pois} places).</p>
<p class="stand">Points from 0 to 100: 100 would mean a neighborhood has the densest choice in the city in every category that matters for this kind of trip. <a href="/en#rechnen">How StayMatch calculates</a></p>
${cta}
<ul class="jump" aria-label="Jump to"><li><a href="#kurz">In short</a></li>${TYPES_EN.map(([k, label]) => `<li><a href="#${k}">${esc(label)}</a></li>`).join('')}<li><a href="#daten">Data source</a></li><li><a href="#staedte">More cities</a></li></ul>
<section class="simple" aria-labelledby="kurz"><h2 id="kurz">In short</h2>
<p>We compared ${r.areas} neighborhoods in ${esc(name)}. By our calculation these fit best:</p>
<ul>
${simple}
</ul>
<p>The points come from map data. They say nothing about prices or listings.</p>
</section>
${sections}
<p class="ctas"><a class="cta" href="${esc(appUrl)}" hreflang="de">Compare your own group in ${esc(name)}</a><a class="cta alt" href="/en#plugin">Rate listings there: get the plugin</a></p>
<section id="daten"><h2>Data source and limits</h2>
<p>Source: © OpenStreetMap contributors (ODbL 1.0), retrieved on ${date}${d.source ? ` via the Overpass API (${esc(d.source)})` : ''}. A neighborhood is whatever OpenStreetMap lists as a suburb, quarter or neighbourhood; how finely that is split differs from city to city.${reduced} <a href="${deUrl}" hreflang="de">Diese Seite auf Deutsch</a>.</p></section>
<nav id="staedte" aria-label="More cities"><h2>More cities</h2>
<ul class="jump">${others.map(c => `<li><a href="/en/cities/${c.enSlug}">${esc(c.enName)}</a></li>`).join('')}</ul></nav>
<footer>
<p>Data: © OpenStreetMap contributors, <a href="https://opendatacommons.org/licenses/odbl/1-0/" rel="noopener">Open Database License (ODbL) 1.0</a>, <a href="https://www.openstreetmap.org/copyright" rel="noopener">source</a>.</p>
<p>The values are an estimate from map data, not prices and not reviews. Not affiliated with Airbnb; Airbnb is a trademark of Airbnb, Inc.</p>
<ul class="nav"><li><a href="/en">Home</a></li><li><a href="/datenschutz" hreflang="de">Datenschutz</a></li><li><a href="/impressum" hreflang="de">Impressum</a></li></ul>
</footer>
</main>
<div class="sticky"><a class="cta" href="${esc(appUrl)}" hreflang="de">Compare a group in ${esc(name)}</a></div>
</body></html>
`;
}

// Sitemap mit lastmod der Stadtseiten (= Datenstand der Stadt)
export function renderSitemap(cities) {
  const fixed = ['', 'en', 'app'].map(p => `  <url><loc>${BASE}/${p}</loc></url>`);
  // Je Stadt deutsche und englische Seite, gegenseitig per hreflang verbunden (Sitemap-Form der Alternativen)
  const alt = c => `\n    <xhtml:link rel="alternate" hreflang="de" href="${BASE}/staedte/${c.slug}"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${BASE}/en/cities/${c.enSlug}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/staedte/${c.slug}"/>\n  `;
  const pages = cities.flatMap(c => [
    `  <url><loc>${BASE}/staedte/${c.slug}</loc><lastmod>${c.date}</lastmod>${alt(c)}</url>`,
    `  <url><loc>${BASE}/en/cities/${c.enSlug}</loc><lastmod>${c.date}</lastmod>${alt(c)}</url>`]);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${[...fixed, ...pages].join('\n')}\n</urlset>\n`;
}

export function build({ check = false } = {}) {
  const dir = path.join(web, 'data'), outDir = path.join(web, 'staedte');
  const files = readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json').sort();
  const data = files.map(f => [f, JSON.parse(readFileSync(path.join(dir, f), 'utf8'))]);
  const cities = data.map(([f, d]) => ({ slug: slug(f), name: d.city, enName: enName(slug(f), d), enSlug: enSlug(slug(f)), date: fmtDate(d.t) }));
  const stale = [];
  const put = (target, text, label) => {
    if (check) { if (!existsSync(target) || readFileSync(target, 'utf8') !== text) stale.push(label); }
    else writeFileSync(target, text);
  };
  const enDir = path.join(web, 'en', 'cities');
  if (!check) { mkdirSync(outDir, { recursive: true }); mkdirSync(enDir, { recursive: true }); }
  for (const [f, d] of data) put(path.join(outDir, slug(f) + '.html'), renderPage(f, d, { cities }), slug(f));
  for (const [f, d] of data) put(path.join(enDir, enSlug(slug(f)) + '.html'), renderPageEn(f, d, { cities }), 'en/' + slug(f));
  put(path.join(web, 'sitemap.xml'), renderSitemap(cities), 'sitemap.xml');
  return { files: files.length, stale };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { files, stale } = build({ check });
  if (check && stale.length) { console.error('Stadtseiten veraltet: ' + stale.join(', ') + ' (node scripts/build-city-pages.mjs)'); process.exit(1); }
  console.log(check ? `${files} Stadtseiten aktuell` : `${files} Stadtseiten in web/staedte/ erzeugt`);
}
