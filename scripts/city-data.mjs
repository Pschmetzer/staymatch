// Format und Aufbereitung der vorab geladenen Städtedaten (web/data/*.json). Reine Funktionen, ohne Netz.
// Genutzt von scripts/prefetch-cities.mjs (neue Abrufe und --reprocess), scripts/check-data.mjs und Tests.
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const C = createRequire(import.meta.url)('../shared/core.js');

export const VERSION = 1; // Feld v: Schema der Datei
export const MIN_ROWS = 200; // darunter gilt eine Antwort als Teilergebnis
export const MIN_SHARE = 0.7; // neue Datei braucht mindestens 70 % der Zeilen der alten (sonst --force)
// 5 Nachkommastellen ≈ 1 m. 4 Stellen wären kleiner, verschmelzen aber unbenannte Orte in dedupePois (8 m) und ändern Wertungen.
export const COORD_DIGITS = 5;
export const BBOX_DIGITS = 6;
export const BBOX_MARGIN = 0.01; // Overpass-Mittelpunkte großer Flächen dürfen so weit über den Rand ragen
export const NAME_WARN = 80; // längere Namen brechen in Popups und Stadtseiten um
export const LICENSE = 'ODbL-1.0';
export const ATTRIBUTION = '© OpenStreetMap-Mitwirkende';

const round = (x, d) => +(+x).toFixed(d);

// Hash der Abfrage-Vorlage und Spalten: ändert sich, wenn core.js andere Orte oder Spalten abfragt
export function queryHash() {
  return createHash('sha256').update(C.overpassQuery([0, 0, 0, 0]) + '\n' + C.FIELDS.join(',')).digest('hex').slice(0, 12);
}

// CSV-Anführungszeichen entfernt schon C.parseOverpassCsv; hier nicht noch einmal, sonst ist --reprocess nicht wiederholbar
const cleanName = s => String(s).replace(/\s+/g, ' ').trim();

// Zeilen (Arrays in fields-Reihenfolge) aufbereiten. Gibt { rows, stats } zurück.
// - place nur behalten, wenn es ein echtes Viertel ist (C.PLACE_TYPES); sonst zählt die Zeile über ihre anderen Tags
// - Namen: Rand- und Mehrfach-Leerzeichen weg
// - Koordinaten auf COORD_DIGITS, Punkte außerhalb bbox ± BBOX_MARGIN verwerfen
// - wikidata nur als Merker 1 (die App nutzt nur „hat Wikidata“)
// - Zeilen ohne Viertel und ohne Kategorie verwerfen (zählen nirgends)
export function normalizeRows(fields, rows, bbox) {
  const I = Object.fromEntries(fields.map((f, i) => [f, i]));
  const tagCols = fields.map((f, i) => i).filter(i => i > 1 && fields[i] !== 'name' && fields[i] !== 'wikidata');
  const known = new Set(Object.values(C.CATEGORIES).flatMap(c => c.tags.map(([k, v]) => `${k}=${v}`)));
  const [s, w, n, e] = bbox, m = BBOX_MARGIN;
  const stats = { in: rows.length, outside: 0, empty: 0, placeCleared: 0, longNames: [] };
  const out = [];
  for (const r0 of rows) {
    if (r0.length !== fields.length) { stats.empty++; continue; }
    const r = r0.map(x => (x == null ? '' : x));
    const lat = round(r[0], COORD_DIGITS), lon = round(r[1], COORD_DIGITS);
    if (!(lat >= s - m && lat <= n + m && lon >= w - m && lon <= e + m)) { stats.outside++; continue; }
    r[0] = lat; r[1] = lon;
    if ('name' in I) r[I.name] = cleanName(r[I.name]);
    if ('place' in I && r[I.place] && !C.PLACE_TYPES.includes(r[I.place])) { r[I.place] = ''; stats.placeCleared++; }
    if ('wikidata' in I) r[I.wikidata] = r[I.wikidata] ? 1 : '';
    const isArea = 'place' in I && r[I.place] && r[I.name];
    const hasCat = tagCols.some(i => fields[i] !== 'place' && r[i] && known.has(`${fields[i]}=${r[i]}`));
    if (!isArea && !hasCat) { stats.empty++; continue; }
    if (r[I.name] && r[I.name].length > NAME_WARN) stats.longNames.push(r[I.name]);
    out.push(r);
  }
  // Reihenfolge bleibt wie von Overpass geliefert: splitRows und dedupePois behalten bei Dubletten die erste Zeile,
  // Sortieren würde Viertel-Orte und Zählungen verschieben (gemessen: bis zu 21 abweichende Top-Einträge je Stadt).
  stats.out = out.length;
  return { rows: out, stats };
}

// Ganze Datei bauen. meta: { t, city, center: [lat, lon], bbox, source, ms, queryHash }
export function buildCity(meta, fields, rows) {
  const bbox = meta.bbox.map(x => round(x, BBOX_DIGITS));
  const { rows: clean, stats } = normalizeRows(fields, rows, bbox);
  const d = {
    v: VERSION, t: meta.t, city: meta.city,
    center: meta.center ? meta.center.map(x => round(x, COORD_DIGITS)) : null,
    bbox, fields: [...fields], license: LICENSE, attribution: ATTRIBUTION,
    source: meta.source || null, ms: meta.ms ?? null, queryHash: meta.queryHash || null,
    rows: clean,
  };
  return { data: d, stats };
}

// Eine Datenzeile pro Textzeile: Diffs eines Datenlaufs bleiben lesbar
export function serialize(d) {
  const { rows, ...head } = d;
  const h = JSON.stringify(head);
  return h.slice(0, -1) + ',"rows":[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n]}\n';
}

// Kurzbericht alt/neu je Stadt (für die PR-Beschreibung)
export function summary(d) {
  const iP = d.fields.indexOf('place'), iN = d.fields.indexOf('name');
  const areas = new Set(d.rows.filter(r => r[iP] && r[iN]).map(r => r[iN])).size;
  return { rows: d.rows.length, areas, kb: Math.round(Buffer.byteLength(serialize(d)) / 1024) };
}

// Zentrum aus Nominatim-Treffer und gespeicherter bbox: ist eine Achse auf beiden Seiten auf BBOX_HALF beschnitten,
// liegt das Zentrum der damaligen Abfrage genau in der Mitte (Nominatim kann sich seitdem verschoben haben).
export function centreFor(bbox, hit) {
  const [s, w, n, e] = bbox, h = C.BBOX_HALF;
  const midLat = (s + n) / 2, hl = h / Math.cos(midLat * Math.PI / 180);
  const lat = Math.abs(n - s - 2 * h) < 1e-6 ? midLat : hit[0];
  const lon = Math.abs(e - w - 2 * hl) < 1e-4 ? (w + e) / 2 : hit[1];
  return [lat, lon];
}
