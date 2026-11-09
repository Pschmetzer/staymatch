// GET /api/city?bbox=s,w,n,e  → Orte einer Stadt aus OpenStreetMap, einmal geholt und für alle zwischengespeichert.
// Speicher: Vercel Blob (BLOB_READ_WRITE_TOKEN). Fehlt er, antwortet die Funktion 503 und die App fragt die Mirrors direkt.
// Daten © OpenStreetMap-Mitwirkende, ODbL. Keine personenbezogenen Daten werden gespeichert.
const FIELDS = ['lat', 'lon', 'place', 'name', 'amenity', 'leisure', 'tourism', 'historic', 'natural', 'railway', 'public_transport', 'wikidata'];
const MIRRORS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const UA = 'StayMatch/1.0 (+https://github.com/Pschmetzer/staymatch)';
const VERSION = 'v2';             // bei Änderung der Abfrage hochzählen
const MAX_AGE = 30 * 864e5;       // 30 Tage
const DAILY_MISSES = 300;         // grobe Bremse für Fehltreffer pro Tag (nicht atomar)
const MAX_LAT_SPAN = 0.18, MAX_LON_SPAN = 0.5;
export const config = { maxDuration: 120 };

const snap = (x, up) => (up ? Math.ceil(x * 100) : Math.floor(x * 100)) / 100;

export function parseBbox(raw) {
  const p = String(raw || '').split(',').map(Number);
  if (p.length !== 4 || p.some(x => !Number.isFinite(x))) return null;
  const [s, w, n, e] = p;
  if (s < -90 || n > 90 || w < -180 || e > 180 || s >= n || w >= e) return null;
  const box = [snap(s, false), snap(w, false), snap(n, true), snap(e, true)];
  if (box[2] - box[0] > MAX_LAT_SPAN || box[3] - box[1] > MAX_LON_SPAN) return null;
  return box.map(x => +x.toFixed(2));
}

export function buildQuery(box) {
  const b = box.join(',');
  return `[out:csv(::lat,::lon,${FIELDS.slice(2).join(',')};true;"|")][timeout:90];(
    nwr["place"~"^(suburb|neighbourhood|quarter)$"](${b});
    nwr["amenity"~"^(bar|pub|nightclub|biergarten|cafe|restaurant|fast_food)$"](${b});
    nwr["leisure"~"^(park|garden|spa)$"](${b});
    nwr["tourism"~"^(attraction|museum|viewpoint|gallery)$"](${b});
    node["historic"="monument"](${b});
    nwr["natural"="beach"](${b});
    node["railway"~"^(station|subway_entrance)$"](${b});
    node["public_transport"="station"](${b});
  );out center;`;
}

export function parseCsv(text) {
  return text.split('\n').slice(1).filter(Boolean).map(l => l.split('|')).filter(v => v.length === FIELDS.length);
}

async function fromOverpass(box) {
  const body = 'data=' + encodeURIComponent(buildQuery(box));
  for (const url of MIRRORS) {
    try {
      const r = await fetch(url, { method: 'POST', body, headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(40000) });
      const text = await r.text();
      if (r.ok && text.startsWith('@lat')) return parseCsv(text);
    } catch { /* nächster Mirror */ }
  }
  return null;
}

export default async function handler(req, res) {
  const box = parseBbox(req.query?.bbox);
  if (!box) { res.status(400).json({ error: 'bbox ungültig oder zu groß' }); return; }
  if (!process.env.BLOB_READ_WRITE_TOKEN) { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ error: 'Zwischenspeicher nicht eingerichtet' }); return; }
  const { put, list } = await import('@vercel/blob');
  const key = `osm/${VERSION}/${box.join(',')}.json`;
  try {
    const hit = (await list({ prefix: key, limit: 1 })).blobs[0];
    if (hit && Date.now() - new Date(hit.uploadedAt).getTime() < MAX_AGE) {
      const data = await (await fetch(hit.url)).json();
      res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
      res.status(200).json(data);
      return;
    }
    const day = `osm/budget/${new Date().toISOString().slice(0, 10)}.json`;
    let used = 0;
    const b = (await list({ prefix: day, limit: 1 })).blobs[0];
    if (b) used = (await (await fetch(b.url)).json()).n || 0;
    if (used >= DAILY_MISSES) { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ error: 'Tageslimit erreicht' }); return; }
    await put(day, JSON.stringify({ n: used + 1 }), { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    const rows = await fromOverpass(box);
    if (!rows) { res.setHeader('Cache-Control', 'no-store'); res.status(503).json({ error: 'OpenStreetMap-Server nicht erreichbar' }); return; }
    const data = { t: Date.now(), bbox: box, fields: FIELDS, rows, attribution: '© OpenStreetMap-Mitwirkende, ODbL' };
    const json = JSON.stringify(data);
    if (json.length < 4e6) await put(key, json, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType: 'application/json' });
    res.setHeader('Cache-Control', json.length < 4e6 ? 'public, s-maxage=86400, stale-while-revalidate=604800' : 'no-store');
    res.status(200).send(json);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'Zwischenspeicher gerade nicht verfügbar' });
  }
}
