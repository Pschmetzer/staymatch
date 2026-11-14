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
  const cats = {};
  for (const p of pois) cats[p.cat] = (cats[p.cat] || 0) + 1;
  return { areas: areas.length, eligible, pois: pois.length, cats, radius: RADIUS, top: out };
}


// ---- Ausbau der Stadtseiten (R10): alles aus den Daten, nichts erfunden ----
const L10N = {
  de: {
    cat: { party: 'Bars, Pubs und Clubs', food: 'Restaurants und Imbisse', chill: 'Cafés, Parks und Gärten', sights: 'Sehenswürdigkeiten', transit: 'Haltestellen und Bahnhöfe', shop: 'Einkaufsorte', sport: 'Sportorte', kids: 'Spielplätze und Kinderorte' },
    catUse: ['party', 'food', 'chill', 'sights', 'transit', 'kids'], km: v => fmtKm(v), and: ' und ',
  },
  en: {
    cat: { party: 'bars, pubs and clubs', food: 'restaurants and takeaways', chill: 'cafés, parks and gardens', sights: 'sights', transit: 'stops and stations', shop: 'shopping places', sport: 'sports places', kids: 'playgrounds and kids’ places' },
    catUse: ['party', 'food', 'chill', 'sights', 'transit', 'kids'], km: v => fmtKmEn(v), and: ' and ',
  },
};
const EN_CAT = { party: 'Party', chill: 'Relax', sights: 'Sights', food: 'Food', transit: 'Transit', shop: 'Shopping', sport: 'Sport', kids: 'Kids' };
const nf = (n, lang) => n.toLocaleString(lang === 'de' ? 'de-DE' : 'en-US');
// Zahlen je Kategorie aus den Daten (dedupePois-Ergebnis)
function catList(r, lang) {
  const L = L10N[lang];
  return L.catUse.filter(k => r.cats[k]).map(k => `${nf(r.cats[k], lang)} ${L.cat[k]}`);
}
// Nachbarstädte: die drei Städte mit dem nächsten Zentrum (Luftlinie), nur aus den Datenzentren
function neighbours(key, ctx) {
  const me = (ctx.cities || []).find(c => c.slug === key);
  if (!me || !me.center) return [];
  return (ctx.cities || []).filter(c => c.slug !== key && c.center)
    .map(c => ({ c, km: Math.round(C.distM({ lat: me.center[0], lon: me.center[1] }, { lat: c.center[0], lon: c.center[1] }) / 1000) }))
    .sort((x, y) => x.km - y.km).slice(0, 3);
}
// Statisches SVG: Balken je Viertel (Punkte von 0 bis 100). Farben über CSS-Variablen der Seite, daher auch im Dunkelmodus lesbar.
function barsSvg(items, label) {
  const W = 560, LBL = 230, BAR = 250, ROW = 28, H = items.length * ROW + 8;
  const cut = t => (t.length > 30 ? t.slice(0, 29) + '…' : t);
  const rows = items.map(({ a, s }, i) => {
    const y = 4 + i * ROW, w = Math.max(2, Math.round(BAR * s / 100));
    return `<text class="sl" x="0" y="${y + 17}">${esc(cut(a.name))}</text><rect class="sb" x="${LBL}" y="${y + 4}" width="${w}" height="16" rx="4"/><text class="sv" x="${LBL + w + 6}" y="${y + 17}">${s}</text>`;
  }).join('');
  return `<svg class="bars" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(label)}"><title>${esc(label)}</title>${rows}</svg>`;
}
const SVG_CSS = '.bars{display:block;max-width:100%;height:auto;margin:10px 0}.bars .sl,.bars .sv{fill:var(--text);font:13px Inter,system-ui,sans-serif}.bars .sb{fill:var(--accent)}';
// Rechenweg: Gewichte je Reisetyp stammen aus C.PRESETS, Zahlen aus den Konstanten dieser Datei
function weightsTable(lang) {
  const L = L10N[lang], types = lang === 'de' ? TYPES : TYPES_EN;
  const cats = Object.keys(C.CATEGORIES);
  const head = `<tr><th scope="col">${lang === 'de' ? 'Reisetyp' : 'Trip type'}</th>${cats.map(k => `<th scope="col">${esc(lang === 'de' ? C.CATEGORIES[k].label : EN_CAT[k])}</th>`).join('')}</tr>`;
  const body = types.map(([k, label]) => `<tr><th scope="row">${esc(label)}</th>${cats.map(c => `<td>${C.PRESETS[k].w[c] ?? 0}</td>`).join('')}</tr>`).join('');
  return `<div class="tw"><table><caption>${lang === 'de' ? 'Gewichte je Reisetyp (negativ = stört)' : 'Weights per trip type (negative = a drawback)'}</caption>${head}${body}</table></div>`;
}
const TABLE_CSS = '.tw{overflow-x:auto;margin:10px 0}.tw table{border-collapse:collapse;font-size:14px}.tw caption{text-align:left;color:var(--muted);padding-bottom:4px}.tw th,.tw td{border:1px solid var(--line);padding:4px 8px;text-align:left;color:var(--text)}.tw td{text-align:right}';
// Dataset-JSON-LD: bewusst ohne distribution/contentUrl, weil /data/ in robots.txt gesperrt ist; Lizenz und Quelle stehen drin
function datasetLd(d, name, url, lang, r) {
  return { '@type': 'Dataset', '@id': url + '#daten', name: lang === 'de' ? `Viertel-Wertungen ${name}` : `Neighborhood scores ${name}`,
    description: lang === 'de' ? `${r.areas} Viertel in ${name} mit Orten je Kategorie, bewertet für fünf Reisetypen. Grundlage: OpenStreetMap, Stand ${fmtDate(d.t)}.` : `${r.areas} neighborhoods in ${name} with places per category, scored for five trip types. Based on OpenStreetMap, as of ${fmtDate(d.t)}.`,
    url, inLanguage: lang, license: 'https://opendatacommons.org/licenses/odbl/1-0/', isAccessibleForFree: true,
    isBasedOn: 'https://www.openstreetmap.org/copyright', citation: d.attribution || '© OpenStreetMap-Mitwirkende', dateModified: fmtDate(d.t),
    spatialCoverage: { '@type': 'Place', name, geo: { '@type': 'GeoCoordinates', latitude: d.center[0], longitude: d.center[1] } },
    creator: { '@type': 'Organization', name: 'StayMatch', url: BASE } };
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


// Steckbrief: nur Zahlen und Rangplätze aus rankCity
function steckbrief(name, r, lang) {
  const L = L10N[lang], list = catList(r, lang), top = k => r.top[k][0];
  const join = a => (a.length > 1 ? a.slice(0, -1).join(', ') + L.and + a[a.length - 1] : a[0] || '');
  const best = lang === 'de'
    ? [['party', 'Party'], ['family', 'Familien'], ['chill', 'Ruhe'], ['sights', 'Sightseeing'], ['foodie', 'Essen']]
    : [['party', 'party'], ['family', 'families'], ['chill', 'quiet'], ['sights', 'sightseeing'], ['foodie', 'food']];
  const picks = best.filter(([k]) => top(k)).map(([k, l]) => `${l}: ${top(k).a.name} (${top(k).s})`);
  const close = ['party', 'family', 'chill', 'sights', 'foodie'].filter(k => top(k)).map(k => top(k).a.centerDist);
  const nearest = close.length ? Math.min(...close) : null, farthest = close.length ? Math.max(...close) : null;
  if (lang === 'de') {
    return `${esc(name)} hat in den Daten ${r.areas} Viertel und ${nf(r.pois, 'de')} Orte, darunter ${esc(join(list))}. ${r.eligible} Viertel haben genug Orte und liegen höchstens ${MAX_CENTER_M / 1000} km vom Zentrum. Vorn liegen ${esc(join(picks))}.${nearest != null ? ` Die Spitzenreiter liegen ${fmtKm(nearest)} bis ${fmtKm(farthest)} km vom Zentrum entfernt.` : ''}`;
  }
  return `${esc(name)} has ${r.areas} neighborhoods and ${nf(r.pois, 'en')} places in the data, including ${esc(join(list))}. ${r.eligible} neighborhoods have enough places and lie within ${MAX_CENTER_M / 1000} km of the center. In front: ${esc(join(picks))}.${nearest != null ? ` The leaders are ${fmtKmEn(nearest)} to ${fmtKmEn(farthest)} km from the center.` : ''}`;
}
function nbHtml(key, ctx, lang) {
  const nb = neighbours(key, ctx);
  if (!nb.length) return '';
  const de = lang === 'de';
  return `<section id="nachbarn"><h2>${de ? 'Städte in der Nähe' : 'Nearby cities'}</h2>
<ul>${nb.map(({ c, km }) => `<li><a href="${de ? `/staedte/${c.slug}` : `/en/cities/${c.enSlug}`}">${esc(de ? c.name : c.enName)}</a> (${de ? `etwa ${km} km Luftlinie` : `about ${km} km as the crow flies`})</li>`).join('')}</ul>
<p>${de ? '<a href="/vergleich">Städte vergleichen</a>: welche Stadt passt zu deiner Gruppe?' : '<a href="/en/compare">Compare cities</a>: which city fits your group?'}</p></section>`;
}

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
${barsSvg(r.top[k], `${label}: ${r.top[k].map(({ a, s }) => `${a.name} ${s}`).join(', ')}`)}
<ol>
${r.top[k].map(({ a, s }) => `<li><b>${esc(a.name)}</b> <span class="pts">${s} von 100 · ${fmtKm(a.centerDist)} km zum Zentrum</span> <a class="bnb" href="${esc(airbnb(a, name))}" target="_blank" rel="noopener">Unterkünfte auf Airbnb <span aria-hidden="true">↗</span></a></li>`).join('\n')}
</ol>
</section>`).join('\n');
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'StayMatch', item: `${BASE}/` },
      { '@type': 'ListItem', position: 2, name: 'Städte', item: `${BASE}/staedte` },
      { '@type': 'ListItem', position: 3, name, item: url }] },
    { '@type': 'WebPage', '@id': url, url, name: title, inLanguage: 'de', dateModified: date },
    datasetLd(d, name, url, 'de', r),
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
<script src="/theme-legal.js"></script>
<style>${SVG_CSS}${TABLE_CSS}.pts{color:var(--muted);font-size:14px;margin-left:6px}ol{padding-left:22px}.bnb{display:block;width:fit-content;font-size:14px;color:var(--muted)}.ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.cta{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none}.cta.alt{background:none;color:var(--text);border:1px solid var(--muted)}.simple{border:1px solid var(--muted);border-radius:12px;padding:4px 16px;margin:20px 0}.jump{display:flex;flex-wrap:wrap;gap:6px 16px;list-style:none;padding:0;margin:16px 0}.jump li{margin:0}.sticky{display:none}@media(max-width:700px){main{padding-bottom:96px}.sticky{display:block;position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--line);text-align:center;z-index:5}.sticky .cta{display:block}}</style>
<script type="application/ld+json">${ld}</script>
</head><body><main>
<nav class="crumbs" aria-label="Brotkrümel"><a href="/">StayMatch</a> › <a href="/staedte">Städte</a> › <span aria-current="page">${esc(name)}</span></nav>
<h1>Wo übernachten in ${esc(name)}? Beste Viertel</h1>
<p class="stand">Stand der Daten: ${dateDe}. Bewertet werden Bars, Restaurants, Sehenswürdigkeiten, Bahnhöfe, Parks und mehr im Umkreis von ${r.radius} m um jedes Viertel (${r.areas} Viertel in den Daten, ${r.eligible} davon mit genug Orten und höchstens ${MAX_CENTER_M / 1000} km vom Zentrum; ${r.pois} Orte).</p>
<p class="stand">Punkte von 0 bis 100: 100 hieße, dass ein Viertel in allen für diesen Reisetyp wichtigen Kategorien die dichteste Auswahl der Stadt hat. <a href="#gerechnet">So wurde gerechnet</a></p>
<section id="steckbrief"><h2>${esc(name)} im Überblick</h2>
<p>${steckbrief(name, r, 'de')}</p></section>
${ctaTop}
<ul class="jump" aria-label="Sprungmarken"><li><a href="#kurz">Kurz und einfach</a></li>${TYPES.map(([k, label]) => `<li><a href="#${k}">${esc(label)}</a></li>`).join('')}<li><a href="#gerechnet">So wurde gerechnet</a></li><li><a href="#daten">Datenquelle</a></li><li><a href="#staedte">Weitere Städte</a></li></ul>
${simpleSection(name, r)}
${sections}
<p class="ctas"><a class="cta" href="${esc(appUrl)}">Eigene Gruppe in ${esc(name)} vergleichen</a><a class="cta alt" href="/#plugin">Unterkünfte dort bewerten: Plugin holen</a></p>
<section id="gerechnet"><h2>So wurde gerechnet</h2>
<ol>
<li>Daten: OpenStreetMap, abgerufen am ${dateDe}${d.source ? ` über die Overpass-API (${esc(d.source)})` : ''}; ${nf(r.pois, 'de')} Orte nach dem Entfernen von Dubletten.</li>
<li>Viertel: Einträge, die in OpenStreetMap als Stadtteil, Quartier oder Nachbarschaft stehen (${r.areas} in dieser Stadt).</li>
<li>Zählen: Für jedes Viertel zählen die Orte je Kategorie im Umkreis von ${r.radius} m. Fast Food zählt nur zu einem Drittel wie ein Restaurant.</li>
<li>Gewichten: Jeder Reisetyp gewichtet die Kategorien anders (Tabelle). Das Ergebnis wird auf 0 bis 100 umgerechnet, bezogen auf die dichteste Auswahl der Stadt.</li>
<li>Filtern: Viertel mit zu wenig Orten und Viertel weiter als ${MAX_CENTER_M / 1000} km vom Zentrum fallen heraus (${r.eligible} bleiben). Zwei Empfehlungen liegen mindestens ${fmtKm(MIN_DIST)} km auseinander.</li>
</ol>
${weightsTable('de')}
<p>Dieselbe Rechnung nutzt der <a href="/app?c=${encodeURIComponent(name)}">Viertel-Finder</a>; mit Gruppe und eigenen Wünschen. Mehrere Städte nebeneinander: <a href="/vergleich">Städte vergleichen</a>.</p></section>
<section id="daten"><h2>Datenquelle und Grenzen</h2>
<p>Quelle: © OpenStreetMap-Mitwirkende (ODbL 1.0), abgerufen am ${dateDe}${d.source ? ` über die Overpass-API (${esc(d.source)})` : ''}. Als Viertel zählt, was in OpenStreetMap als Stadtteil, Quartier oder Nachbarschaft eingetragen ist; wie fein das unterteilt ist, unterscheidet sich je Stadt.${note}</p></section>
${nbHtml(key, ctx, 'de')}
<nav id="staedte" aria-label="Weitere Städte"><h2>Weitere Städte</h2>
<p><a href="/staedte">Alle Städte im Überblick</a></p>
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
${barsSvg(r.top[k], `${label}: ${r.top[k].map(({ a, s }) => `${a.name} ${s}`).join(', ')}`)}
<ol>
${r.top[k].map(({ a, s }) => `<li><b>${esc(a.name)}</b> <span class="pts">${s} of 100 · ${fmtKmEn(a.centerDist)} km to the center</span> <a class="bnb" href="${esc(airbnb(a, name))}" target="_blank" rel="noopener">Stays on Airbnb <span aria-hidden="true">↗</span></a></li>`).join('\n')}
</ol>
</section>`).join('\n');
  const simple = TYPES_EN.map(([k, label]) => r.top[k][0] ? `<li>For ${esc(label.toLowerCase())}: <b>${esc(r.top[k][0].a.name)}</b>.</li>` : '').filter(Boolean).join('\n');
  const jsonLd = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'StayMatch', item: `${BASE}/en` },
      { '@type': 'ListItem', position: 2, name: 'Cities', item: `${BASE}/en/cities` },
      { '@type': 'ListItem', position: 3, name, item: url }] },
    { '@type': 'WebPage', '@id': url, url, name: title, inLanguage: 'en', dateModified: date },
    datasetLd(d, name, url, 'en', r),
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
<script src="/theme-legal.js"></script>
<style>${SVG_CSS}${TABLE_CSS}.pts{color:var(--muted);font-size:14px;margin-left:6px}ol{padding-left:22px}.bnb{display:block;width:fit-content;font-size:14px;color:var(--muted)}.ctas{display:flex;flex-wrap:wrap;gap:10px;margin-top:24px}.cta{display:inline-block;padding:10px 18px;border-radius:999px;background:var(--accent);color:#fff;text-decoration:none}.cta.alt{background:none;color:var(--text);border:1px solid var(--muted)}.simple{border:1px solid var(--muted);border-radius:12px;padding:4px 16px;margin:20px 0}.jump{display:flex;flex-wrap:wrap;gap:6px 16px;list-style:none;padding:0;margin:16px 0}.jump li{margin:0}.sticky{display:none}@media(max-width:700px){main{padding-bottom:96px}.sticky{display:block;position:fixed;left:0;right:0;bottom:0;padding:10px 16px calc(10px + env(safe-area-inset-bottom));background:var(--bg);border-top:1px solid var(--line);text-align:center;z-index:5}.sticky .cta{display:block}}</style>
<script type="application/ld+json">${ld}</script>
</head><body><main>
<nav class="crumbs" aria-label="Breadcrumb"><a href="/en">StayMatch</a> › <a href="/en/cities">Cities</a> › <span aria-current="page">${esc(name)}</span></nav>
<h1>Where to stay in ${esc(name)}? Best neighborhoods</h1>
<p class="stand">Data from ${date}. We score bars, restaurants, sights, stations, parks and more within ${r.radius} m of each neighborhood (${r.areas} neighborhoods in the data, ${r.eligible} of them with enough places and at most ${MAX_CENTER_M / 1000} km from the center; ${r.pois} places).</p>
<p class="stand">Points from 0 to 100: 100 would mean a neighborhood has the densest choice in the city in every category that matters for this kind of trip. <a href="#gerechnet">How this was calculated</a></p>
<section id="steckbrief"><h2>${esc(name)} at a glance</h2>
<p>${steckbrief(name, r, 'en')}</p></section>
${cta}
<ul class="jump" aria-label="Jump to"><li><a href="#kurz">In short</a></li>${TYPES_EN.map(([k, label]) => `<li><a href="#${k}">${esc(label)}</a></li>`).join('')}<li><a href="#gerechnet">How it was calculated</a></li><li><a href="#daten">Data source</a></li><li><a href="#staedte">More cities</a></li></ul>
<section class="simple" aria-labelledby="kurz"><h2 id="kurz">In short</h2>
<p>We compared ${r.areas} neighborhoods in ${esc(name)}. By our calculation these fit best:</p>
<ul>
${simple}
</ul>
<p>The points come from map data. They say nothing about prices or listings.</p>
</section>
${sections}
<p class="ctas"><a class="cta" href="${esc(appUrl)}" hreflang="de">Compare your own group in ${esc(name)}</a><a class="cta alt" href="/en#plugin">Rate listings there: get the plugin</a></p>
<section id="gerechnet"><h2>How this was calculated</h2>
<ol>
<li>Data: OpenStreetMap, retrieved on ${date}${d.source ? ` via the Overpass API (${esc(d.source)})` : ''}; ${nf(r.pois, 'en')} places after removing duplicates.</li>
<li>Neighborhoods: entries that OpenStreetMap lists as a suburb, quarter or neighbourhood (${r.areas} in this city).</li>
<li>Counting: for each neighborhood we count the places per category within ${r.radius} m. Fast food counts one third as much as a restaurant.</li>
<li>Weighting: each trip type weighs the categories differently (table). The result is scaled to 0 to 100, relative to the densest choice in the city.</li>
<li>Filtering: neighborhoods with too few places and those further than ${MAX_CENTER_M / 1000} km from the center drop out (${r.eligible} remain). Two recommendations are at least ${fmtKmEn(MIN_DIST)} km apart.</li>
</ol>
${weightsTable('en')}
<p>The same calculation powers the <a href="/app?c=${encodeURIComponent(name)}" hreflang="de">neighborhood finder</a>, with a group and your own wishes. To weigh several cities side by side: <a href="/en/compare">compare cities</a>.</p></section>
<section id="daten"><h2>Data source and limits</h2>
<p>Source: © OpenStreetMap contributors (ODbL 1.0), retrieved on ${date}${d.source ? ` via the Overpass API (${esc(d.source)})` : ''}. A neighborhood is whatever OpenStreetMap lists as a suburb, quarter or neighbourhood; how finely that is split differs from city to city.${reduced} <a href="${deUrl}" hreflang="de">Diese Seite auf Deutsch</a>.</p></section>
${nbHtml(key, ctx, 'en')}
<nav id="staedte" aria-label="More cities"><h2>More cities</h2>
<p><a href="/en/cities">All cities at a glance</a></p>
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


// Übersichtsseite aller Städte (/staedte und /en/cities) mit Typ-Filter (web/staedte-filter.js; ohne JS bleibt alles sichtbar)
export function renderOverview(lang, items) {
  const de = lang === 'de', types = de ? TYPES : TYPES_EN;
  const url = de ? `${BASE}/staedte` : `${BASE}/en/cities`, alt = de ? `${BASE}/en/cities` : `${BASE}/staedte`;
  const title = de ? 'Städte im Überblick: beste Viertel je Reisetyp · StayMatch' : 'Cities at a glance: best neighborhoods per trip type · StayMatch';
  const desc = de ? `${items.length} Städte mit den besten Vierteln für Party, Familien, Ruhe, Sightseeing und Essen, aus OpenStreetMap-Daten berechnet.`
    : `${items.length} cities with the best neighborhoods for party, families, quiet, sightseeing and food, calculated from OpenStreetMap data.`;
  const newest = items.map(i => i.date).sort().pop();
  const cards = items.map(({ c, r }) => {
    const href = de ? `/staedte/${c.slug}` : `/en/cities/${c.enSlug}`, name = de ? c.name : c.enName;
    const sc = types.map(([k]) => r.top[k][0] ? ` data-s${k}="${r.top[k][0].s}"` : '').join('');
    const lis = types.filter(([k]) => r.top[k][0]).map(([k, label]) => `<li data-type="${k}">${esc(label)}: <b>${esc(r.top[k][0].a.name)}</b> <span class="pts">${r.top[k][0].s}</span></li>`).join('');
    return `<article class="card"${sc}><h2><a href="${href}">${esc(name)}</a></h2><p class="meta">${de ? `${r.eligible} Viertel verglichen, Stand ${fmtDateDe(Date.parse(c.date))}` : `${r.eligible} neighborhoods compared, as of ${c.date}`}</p><ul class="picks">${lis}</ul></article>`;
  }).join('\n');
  const radios = [['all', de ? 'Alle' : 'All'], ...types.map(([k, l]) => [k, l])].map(([k, l], i) => `<label><input type="radio" name="t" value="${k}"${i === 0 ? ' checked' : ''}> ${esc(l)}</label>`).join(' ');
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'StayMatch', item: de ? `${BASE}/` : `${BASE}/en` }, { '@type': 'ListItem', position: 2, name: de ? 'Städte' : 'Cities', item: url }] },
    { '@type': 'CollectionPage', '@id': url, url, name: title, inLanguage: lang, dateModified: newest },
    { '@type': 'ItemList', numberOfItems: items.length, itemListElement: items.map(({ c }, i) => ({ '@type': 'ListItem', position: i + 1, name: de ? c.name : c.enName, url: de ? `${BASE}/staedte/${c.slug}` : `${BASE}/en/cities/${c.enSlug}` })) },
  ] }).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="${lang}" href="${url}">
<link rel="alternate" hreflang="${de ? 'en' : 'de'}" href="${alt}">
<link rel="alternate" hreflang="x-default" href="${de ? url : alt}">
<meta property="og:type" content="website"><meta property="og:site_name" content="StayMatch"><meta property="og:locale" content="${de ? 'de_DE' : 'en_US'}">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}/og.png"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#fbfaf8">
<link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/legal.css?v=${CSS_V}">
<script src="/theme-legal.js"></script>
<style>.pts{color:var(--muted);font-size:14px;margin-left:6px}#filter{border:1px solid var(--line);border-radius:12px;padding:8px 14px;margin:18px 0}#filter legend{padding:0 6px;color:var(--muted);font-size:14px}#filter label{display:inline-block;margin:4px 14px 4px 0;color:var(--text);cursor:pointer}.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:14px;margin:18px 0}.card{border:1px solid var(--line);border-radius:14px;padding:4px 16px 8px;background:var(--bg2)}.card h2{margin:10px 0 0}.card .meta{font-size:13px;margin:2px 0 6px}.picks{list-style:none;padding:0;margin:0}.picks li{margin:3px 0;font-size:14px}.cards[data-f="party"] li:not([data-type="party"]),.cards[data-f="family"] li:not([data-type="family"]),.cards[data-f="chill"] li:not([data-type="chill"]),.cards[data-f="sights"] li:not([data-type="sights"]),.cards[data-f="foodie"] li:not([data-type="foodie"]){display:none}main{max-width:1000px}</style>
<script type="application/ld+json">${ld}</script>
</head><body><main>
<nav class="crumbs" aria-label="${de ? 'Brotkrümel' : 'Breadcrumb'}"><a href="${de ? '/' : '/en'}">StayMatch</a> › <span aria-current="page">${de ? 'Städte' : 'Cities'}</span></nav>
<h1>${de ? 'Städte im Überblick' : 'Cities at a glance'}</h1>
<p class="stand">${de ? `${items.length} Städte, je Reisetyp das bestplatzierte Viertel. Alles aus OpenStreetMap-Daten berechnet; die Punkte (0 bis 100) sind eine Schätzung, keine Preise und keine Bewertungen. Wähle einen Reisetyp, um die Städte danach zu ordnen.` : `${items.length} cities, the top neighborhood for each trip type. Everything is calculated from OpenStreetMap data; the points (0 to 100) are an estimate, not prices and not reviews. Pick a trip type to sort the cities by it. The city pages are available in English and German.`}</p>
<fieldset id="filter" hidden><legend>${de ? 'Reisetyp' : 'Trip type'}</legend>${radios}</fieldset>
<div class="cards" id="cities">
${cards}
</div>
<p><a href="${de ? '/vergleich' : '/en/compare'}">${de ? 'Mehrere Städte nach deinen Wünschen vergleichen' : 'Compare cities by your own wishes'}</a> · <a href="/app" hreflang="de">${de ? 'Viertel-Finder' : 'Neighborhood finder'}</a></p>
<footer>
<p>${de ? 'Daten: © OpenStreetMap-Mitwirkende' : 'Data: © OpenStreetMap contributors'}, <a href="https://opendatacommons.org/licenses/odbl/1-0/" rel="noopener">Open Database License (ODbL) 1.0</a>, <a href="https://www.openstreetmap.org/copyright" rel="noopener">${de ? 'Quelle' : 'source'}</a>.</p>
<ul class="nav"><li><a href="${de ? '/' : '/en'}">${de ? 'Startseite' : 'Home'}</a></li><li><a href="/datenschutz"${de ? '' : ' hreflang="de"'}>Datenschutz</a></li><li><a href="/impressum"${de ? '' : ' hreflang="de"'}>Impressum</a></li></ul>
</footer>
</main>
<script src="/staedte-filter.js" defer></script>
</body></html>
`;
}

// Sitemap mit lastmod der Stadtseiten (= Datenstand der Stadt)
export function renderSitemap(cities) {
  const fixed = ['', 'en', 'app', 'staedte', 'en/cities'].map(p => `  <url><loc>${BASE}/${p}</loc></url>`);
  // Städtevergleich (von Hand gepflegte Seiten DE/EN), gegenseitig per hreflang verbunden
  const cmpAlt = `\n    <xhtml:link rel="alternate" hreflang="de" href="${BASE}/vergleich"/>\n    <xhtml:link rel="alternate" hreflang="en" href="${BASE}/en/compare"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${BASE}/vergleich"/>\n  `;
  for (const p of ['vergleich', 'en/compare']) fixed.push(`  <url><loc>${BASE}/${p}</loc>${cmpAlt}</url>`);
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
  const cities = data.map(([f, d]) => ({ slug: slug(f), center: d.center, name: d.city, enName: enName(slug(f), d), enSlug: enSlug(slug(f)), date: fmtDate(d.t) }));
  const stale = [];
  const put = (target, text, label) => {
    if (check) { if (!existsSync(target) || readFileSync(target, 'utf8') !== text) stale.push(label); }
    else writeFileSync(target, text);
  };
  const enDir = path.join(web, 'en', 'cities');
  if (!check) { mkdirSync(outDir, { recursive: true }); mkdirSync(enDir, { recursive: true }); }
  for (const [f, d] of data) put(path.join(outDir, slug(f) + '.html'), renderPage(f, d, { cities }), slug(f));
  for (const [f, d] of data) put(path.join(enDir, enSlug(slug(f)) + '.html'), renderPageEn(f, d, { cities }), 'en/' + slug(f));
  const items = data.map(([f, d], i) => ({ c: cities[i], r: rankCity(d), date: cities[i].date }));
  put(path.join(web, 'staedte.html'), renderOverview('de', items), 'staedte.html');
  put(path.join(web, 'en', 'cities.html'), renderOverview('en', items.slice().sort((a, b) => a.c.enName.localeCompare(b.c.enName))), 'en/cities.html');
  put(path.join(web, 'sitemap.xml'), renderSitemap(cities), 'sitemap.xml');
  return { files: files.length, stale };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const { files, stale } = build({ check });
  if (check && stale.length) { console.error('Stadtseiten veraltet: ' + stale.join(', ') + ' (node scripts/build-city-pages.mjs)'); process.exit(1); }
  console.log(check ? `${files} Stadtseiten aktuell` : `${files} Stadtseiten in web/staedte/ erzeugt`);
}
