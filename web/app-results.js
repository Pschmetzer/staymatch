// StayMatch Viertel-Finder – Daten laden (vorab geladen, Cache, Nominatim, Overpass), bewerten, Ergebnisse zeigen
async function geocode(city) {
  const r = await fetch(C.nominatimUrl(city), { headers: { 'Accept-Language': 'de' } });
  if (!r.ok) throw new Error(`Ortssuche gerade nicht erreichbar (${r.status}) – bitte gleich nochmal versuchen.`);
  const j = await r.json();
  if (!j.length) throw new Error('Stadt nicht gefunden');
  return C.geoFromNominatim(j[0]); // Bbox auf ca. 16 × 16 km um das Zentrum begrenzt
}

// CSV statt JSON: ca. 6x kleiner. Alle Server parallel, der schnellste gewinnt.
async function overpass(bbox) {
  const q = C.overpassQuery(bbox), FIELDS = C.FIELDS;
  // Fair zu den freiwilligen Servern: erst einer, der nächste erst nach 20 s ohne Antwort oder bei Fehler.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 110000);
  let next = Promise.resolve();
  const tries = C.OVERPASS_SERVERS.map((url, i) => {
    const prev = next;
    let release;
    next = new Promise(r => { release = r; });
    return (async () => {
      if (i) await Promise.race([prev, new Promise(r => setTimeout(r, 20000 * i))]);
      try {
        const r = await fetch(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctrl.signal });
        const text = await r.text();
        if (!r.ok || !text.startsWith('@lat')) throw new Error(`${new URL(url).host}: ${r.status}`);
        return text;
      } catch (e) { release(); throw e; }
    })();
  });
  try {
    const text = await Promise.any(tries);
    clearTimeout(timeout); ctrl.abort();
    return text.split('\n').slice(1).filter(Boolean).map(line => {
      const v = line.split('|'), t = {};
      if (v.length !== FIELDS.length) return null; // Name mit | → Zeile verwerfen
      FIELDS.forEach((f, i) => { if (v[i]) t[f] = v[i]; });
      return t;
    }).filter(Boolean);
  } catch (e) {
    clearTimeout(timeout);
    throw new Error('OpenStreetMap-Server gerade überlastet – bitte in einer Minute nochmal versuchen.');
  }
}

// Vorab geladene Städte (scripts/prefetch-cities.mjs → web/data/)
async function prefetched(city) {
  try {
    const idx = await (await fetch('data/index.json')).json();
    const file = idx[C.normCity(city)];
    if (!file) return null;
    const d = await (await fetch('data/' + file)).json();
    const rows = d.rows.map(v => Object.fromEntries(d.fields.map((f, i) => [f, v[i]]).filter(([, x]) => x !== '' && x != null)));
    const [s, w, n, e] = d.bbox;
    return { geo: { name: d.city, bbox: d.bbox, lat: (s + n) / 2, lon: (w + e) / 2 }, rows, at: d.t };
  } catch { return null; }
}

// Ergebnis pro Stadt einen Tag lang im Browser merken (spart die langsame Abfrage)
function cacheGet(k) { try { const c = JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k)); return c && Date.now() - c.t < 864e5 ? c.rows : null; } catch { return null; } }
function cacheSet(k, rows) {
  const v = JSON.stringify({ t: Date.now(), rows });
  for (let i = 0; i < 4; i++) {
    try { localStorage.setItem(k, v); return; } catch {
      // älteste Stadt löschen (sm_trip bleibt), dann erneut versuchen
      let oldest = null, ot = Infinity;
      try { for (const key of Object.keys(localStorage)) if (key.startsWith('sm_osm2_')) { const t = JSON.parse(localStorage.getItem(key)).t; if (t < ot) { ot = t; oldest = key; } } } catch {}
      if (!oldest) break;
      localStorage.removeItem(oldest);
    }
  }
  try { sessionStorage.setItem(k, v); } catch {}
}

// alte Cache-Version (vor CSV/nwr) entfernen
try { Object.keys(localStorage).filter(k => k.startsWith('sm_osm_')).forEach(k => localStorage.removeItem(k)); } catch {}

let lastData = null; // lastData: geladene Viertel + Orte → Neuberechnung ohne Netz
const radius = () => +$('radius').value || C.RADIUS.area;

async function run() {
  if ($('go').disabled) return; // läuft schon (z. B. Enter während der Suche)
  const city = $('city').value.trim();
  if (!city || !people.length) { $('status').textContent = 'Bitte Stadt und mindestens eine Person angeben.'; return; }
  $('go').disabled = true;
  $('results').innerHTML = '';
  try {
    $('status').textContent = 'Suche Stadt …';
    // 1) vorab geladene Stadt (sofort, ohne Anfrage an OpenStreetMap-Server)
    let geo, rows = null;
    const pre = await prefetched(city);
    if (pre) { geo = pre.geo; rows = pre.rows; }
    // 2) sonst: Ort suchen und Daten holen (Tageszwischenspeicher im Browser)
    if (!rows) {
      geo = await geocode(city);
      const cacheKey = 'sm_osm2_' + geo.bbox.map(x => x.toFixed(3)).join(',');
      rows = cacheGet(cacheKey);
      $('status').textContent = rows ? `Nutze gespeicherte Daten für ${geo.name} …` : `Lade Orte in ${geo.name} aus OpenStreetMap (kann bis zu 1 Minute dauern) …`;
      if (!rows) { rows = await overpass(geo.bbox); cacheSet(cacheKey, rows); }
    }

    const areas = [], pois = [];
    for (const t of rows) {
      const lat = +t.lat, lon = +t.lon;
      if (!lat) continue;
      if (t.place && t.name) { if (!areas.some(a => a.name === t.name && SM.distM(a, { lat, lon }) < C.RADIUS.match)) areas.push({ name: t.name, lat, lon }); continue; }
      for (const cat of SM.categoriesOf(t)) pois.push({ lat, lon, cat, name: t.name, tags: t });
    }
    if (areas.length < 2) throw new Error('Keine Viertel in OpenStreetMap gefunden – andere Stadt versuchen.');
    lastData = { areas, pois, geo };
    compute();
  } catch (e) {
    $('status').textContent = 'Fehler: ' + (/fetch|network/i.test(e.message) ? 'Keine Verbindung zum Kartendienst. Internet prüfen und nochmal versuchen.' : e.message);
  } finally { $('go').disabled = false; }
}

// Wertung neu rechnen, wenn Gruppe, Umkreis, Budget oder Datum sich ändern (kein neuer Abruf nötig)
function compute() {
  if (!lastData) return;
  const { areas, pois, geo } = lastData;
  const r = radius();
  SM.scoreAreas(areas, pois, r);
  const ppl = people.map(p => ({ ...p, w: SM.PRESETS[p.type].w }));
  for (const a of areas) a.group = SM.groupScore(a.norm, ppl);
  // Viertel ohne nennenswerte Infrastruktur ausblenden
  const sorted = areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10)
    .sort((a, b) => b.group.total - a.group.total);
  const ranked = SM.pickDiverse(sorted, 8, Math.max(C.RADIUS.diverse, r * 1.5));
  if (!ranked.length) { $('results').innerHTML = ''; $('status').textContent = 'Keine passenden Viertel mit genug Orten gefunden. Versuche eine größere Stadt, einen größeren Umkreis oder einen anderen Ortsnamen.'; return; }
  $('status').textContent = `${sorted.length} Viertel und ${pois.length} Orte ausgewertet. Die besten für eure Gruppe:`;
  saveTrip(geo, sorted, ppl);
  renderResults(ranked, pois, ppl, geo, r);
  renderMap(ranked, geo, r);
}
let rescoreTimer = null;
const rescore = () => { clearTimeout(rescoreTimer); rescoreTimer = setTimeout(() => { try { compute(); } catch (e) { console.debug(e); } }, 250); };

function renderResults(ranked, pois, ppl, geo, r) {
  const b = budgetNums();
  $('results').innerHTML = ranked.map((a, i) => {
    const highlights = [...new Set(pois.filter(p => p.name && p.cat !== 'transit' && p.cat !== 'food' && SM.distM(a, p) < r)
      .sort((x, y) => (y.tags.wikidata ? 1 : 0) - (x.tags.wikidata ? 1 : 0)).map(p => p.name))].slice(0, 5);
    const url = SM.airbnbUrl({ lat: a.lat, lon: a.lon, name: a.name, city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value, adults: ppl.length, priceMaxNight: b.perNight, radius: r });
    const chips = ppl.map((p, j) => {
      const s = a.group.scores[j];
      return `<span class="chip ${s < 40 ? 'low' : s >= 70 ? 'high' : ''}">${escapeHtml(p.name)}: ${s}</span>`;
    }).join('');
    const c = a.counts;
    // Wer ist am wenigsten zufrieden und warum?
    const lowIdx = a.group.scores.indexOf(a.group.min), low = ppl[lowIdx];
    const weak = low && a.group.min < 60 ? SM.weakness(a.norm, a.counts, low.w) : null;
    const why = weak ? `<div class="muted">⚠️ ${escapeHtml(low.name)} (${a.group.min}) ${weak.kind === 'missing' ? `vermisst hier: ${weak.label} (nur ${weak.count} im Umkreis)` : `stört: viel ${weak.label} (${weak.count} im Umkreis)`}</div>` : '';
    return `<article class="card result">
      <h3><span>${i + 1}. ${escapeHtml(a.name)}</span><span class="score">${a.group.total}</span></h3>
      <div class="bar"><i style="width:${a.group.total}%"></i></div>
      <div class="chips">${chips}</div>
      ${why}
      <div class="muted">🍸 ${c.party} Bars/Clubs · 🌿 ${c.chill} Parks/Cafés · 🏛️ ${c.sights} Sehenswürdigkeiten · 🍝 ${c.food} Restaurants · 🚇 ${c.transit} Stationen</div>
      ${highlights.length ? `<div class="muted">In der Nähe: ${highlights.map(escapeHtml).join(', ')}</div>` : ''}
      <div><a class="btn" href="${url}" target="_blank" rel="noopener">Unterkünfte hier auf Airbnb ansehen →</a></div>
    </article>`;
  }).join('');
}

// Brücke zum Plugin: alle bewerteten Viertel + Gruppe speichern, Plugin übernimmt sie
function saveTrip(geo, areas, ppl) {
  const b = budgetNums();
  const trip = {
    savedAt: Date.now(), city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value,
    nights: b.n, budget: b.total, people: ppl.map(p => ({ name: p.name, type: p.type })),
    areas: areas.map(a => {
      const j = a.group.scores.indexOf(a.group.min);
      return { name: a.name, lat: +a.lat.toFixed(5), lon: +a.lon.toFixed(5), total: a.group.total, min: a.group.min, minName: ppl[j]?.name || null };
    }),
  };
  const v = JSON.stringify(trip);
  try { localStorage.setItem('sm_trip', v); }
  catch { // Speicher voll: alte Stadt-Caches löschen und nochmal
    try { Object.keys(localStorage).filter(k => k.startsWith('sm_osm')).forEach(k => localStorage.removeItem(k)); localStorage.setItem('sm_trip', v); } catch {}
  }
  window.dispatchEvent(new Event('staymatch:trip'));
}
