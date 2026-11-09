// Lädt die OpenStreetMap-Daten beliebter Städte vorab und schreibt sie nach web/data/.
// Die Web-App nutzt diese Dateien zuerst und fragt Overpass nur für andere Städte.
// Aufruf: node scripts/prefetch-cities.mjs [Stadt ...]   (ohne Argumente: Standardliste)
// Rücksicht auf die freiwilligen Server: eine Stadt nach der anderen, Pause dazwischen.
import { writeFile, readFile, mkdir } from 'node:fs/promises';

const OUT = new URL('../web/data/', import.meta.url);
const FIELDS = ['lat', 'lon', 'place', 'name', 'amenity', 'leisure', 'tourism', 'historic', 'natural', 'railway', 'public_transport', 'wikidata', 'name:de', 'alt_name'];
const SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const UA = 'StayMatch-prefetch (+https://github.com/Pschmetzer/staymatch)';

// Name in der App-Suche (kleingeschrieben, ohne Akzente) → Datei
const DEFAULT = {
  barcelona: ['barcelona'], lissabon: ['lissabon', 'lisboa', 'lisbon'], berlin: ['berlin'], prag: ['prag', 'praha', 'prague'],
  amsterdam: ['amsterdam'], rom: ['rom', 'roma', 'rome'], wien: ['wien', 'vienna'], paris: ['paris'], madrid: ['madrid'], budapest: ['budapest'],
};
const norm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(city) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=de&q=${encodeURIComponent(city)}`, { headers: { 'User-Agent': UA } });
  const j = await r.json();
  if (!j.length) throw new Error('nicht gefunden: ' + city);
  let [s, n, w, e] = j[0].boundingbox.map(Number);
  const lat = +j[0].lat, lon = +j[0].lon, h = 0.075, hl = h / Math.cos(lat * Math.PI / 180);
  s = Math.max(s, lat - h); n = Math.min(n, lat + h); w = Math.max(w, lon - hl); e = Math.min(e, lon + hl);
  return { lat, lon, bbox: [s, w, n, e], name: j[0].display_name.split(',')[0] };
}

// gleiche Abfrage wie in web/app.js
function query(bbox) {
  const b = bbox.map(x => x.toFixed(4)).join(',');
  return `[out:csv(::lat,::lon,${FIELDS.slice(2).map(f => `"${f}"`).join(',')};true;"|")][timeout:90];(
    nwr["place"~"^(suburb|neighbourhood|quarter)$"](${b});
    nwr["amenity"~"^(bar|pub|nightclub|biergarten|cafe|restaurant|fast_food)$"](${b});
    nwr["leisure"~"^(park|garden|spa)$"](${b});
    nwr["tourism"~"^(attraction|museum|viewpoint|gallery)$"](${b});
    nwr["historic"~"^(monument|castle|memorial|ruins|church|cathedral)$"](${b});
    nwr["natural"="beach"](${b});
    node["railway"~"^(station|subway_entrance|tram_stop)$"](${b});
    node["public_transport"="station"](${b});
  );out center;`;
}

async function overpass(bbox) {
  let last;
  for (let round = 0; round < 2; round++) for (const url of SERVERS) {
    try {
      const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(query(bbox)), headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(120000) });
      const t = await r.text();
      if (r.ok && t.startsWith('@lat')) return t;
      last = new Error(`${url}: ${r.status}`);
    } catch (e) { last = e; }
    await sleep(15000);
  }
  throw last;
}

const index = JSON.parse(await readFile(new URL('index.json', OUT), 'utf8').catch(() => '{}'));
await mkdir(OUT, { recursive: true });
const wanted = process.argv.slice(2).length ? Object.fromEntries(process.argv.slice(2).map(c => [norm(c), [norm(c)]])) : DEFAULT;

for (const [key, aliases] of Object.entries(wanted)) {
  try {
    console.log('→', key);
    const geo = await geocode(key); await sleep(1500);
    const csv = await overpass(geo.bbox);
    const rows = csv.split('\n').slice(1).filter(Boolean).map(l => l.split('|')).filter(v => v.length === FIELDS.length)
      .map(v => v.map((x, i) => i < 2 ? +(+x).toFixed(5) : x));
    await writeFile(new URL(`${key}.json`, OUT), JSON.stringify({ t: Date.now(), city: geo.name, bbox: geo.bbox, fields: FIELDS, rows }));
    for (const a of [...aliases, norm(geo.name)]) index[a] = `${key}.json`;
    await writeFile(new URL('index.json', OUT), JSON.stringify(index, null, 1));
    console.log('  ok', rows.length, 'Zeilen');
  } catch (e) { console.error('  Fehler', key, e.message); }
  await sleep(30000);
}
