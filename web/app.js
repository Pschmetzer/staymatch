const SM = window.StayMatch;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const DEFAULT_PEOPLE = [
  { name: 'Lena', type: 'party' }, { name: 'Mia', type: 'party' },
  { name: 'Jonas', type: 'chill' }, { name: 'Sara', type: 'chill' }, { name: 'Tom', type: 'sights' },
];
let people = (a => Array.isArray(a) ? a : DEFAULT_PEOPLE)(store.get('sm_people', DEFAULT_PEOPLE))
  .filter(p => p && typeof p.name === 'string').map(p => ({ ...p, type: SM.PRESETS[p.type] ? p.type : 'chill' }));
// Nächste freie Nummer, damit nach Löschen nicht zweimal "Person 3" entsteht
const freeName = () => { let n = people.length + 1; while (people.some(p => p.name.trim() === `Person ${n}`)) n++; return `Person ${n}`; };
const DOMAIN = SM.airbnbDomain(navigator.language), CUR = SM.currencyFor(DOMAIN), DE = /^de/i.test(navigator.language || 'de');

// Standard-Zeitraum: in 4 Wochen, 4 Nächte
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const d0 = new Date(Date.now() + 28 * 864e5), d1 = new Date(d0.getTime() + 4 * 864e5);
$('checkin').value = ymd(d0);
$('checkout').value = ymd(d1);
// #38 keine Vergangenheit, Abreise nach Anreise
$('checkin').min = ymd(new Date());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const syncMin = () => { const c = SM.parseDay($('checkin').value); if (c) { $('checkout').min = ymd(addDays(c, 1)); if ($('checkout').value <= $('checkin').value) $('checkout').value = ymd(addDays(c, 1)); } };
$('checkin').addEventListener('change', syncMin); syncMin();
// Datum ungültig (Abreise vor Anreise per Hand getippt)? Dann nicht still ohne Preisgrenze suchen
const dateError = () => {
  const a = SM.parseDay($('checkin').value), b = SM.parseDay($('checkout').value);
  if (!a || !b) return 'Bitte An- und Abreise wählen.';
  if (b <= a) return 'Die Abreise muss nach der Anreise liegen.';
  return null;
};
const checkDates = () => { const e = dateError(); $('checkout').setCustomValidity(e || ''); if (e) $('status').textContent = e; };
['change', 'input'].forEach(ev => { $('checkout').addEventListener(ev, checkDates); $('checkin').addEventListener(ev, checkDates); });

function renderPeople(focusIdx) {
  $('people').innerHTML = '';
  people.forEach((p, i) => {
    const row = document.createElement('div');
    row.className = 'person';
    row.innerHTML = `<input value="${escapeHtml(p.name)}" aria-label="Name">
      <select aria-label="Typ">${Object.entries(SM.PRESETS).map(([k, v]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <button title="Entfernen" aria-label="Entfernen">✕</button>`;
    row.children[0].oninput = e => { p.name = e.target.value; save(); };
    row.children[0].onblur = e => { if (!p.name.trim()) { p.name = freeName(); e.target.value = p.name; save(); } };
    row.children[1].onchange = e => { p.type = e.target.value; save(); };
    row.children[2].onclick = () => { people.splice(i, 1); save(); renderPeople(Math.min(i, people.length - 1)); };
    row.children[2].setAttribute('aria-label', `${p.name || 'Person'} entfernen`);
    $('people').appendChild(row);
  });
  // Fokus nach dem Neuaufbau nicht ins Nichts fallen lassen
  if (focusIdx != null) ($('people').children[focusIdx]?.querySelector('input') || $('addPerson')).focus();
  updateBudget();
}
function save() {
  store.set('sm_people', people);
  rescore();
  // Änderungen gelten ab jetzt: alten Teilen-Link aus der Adresszeile nehmen, sonst überschreibt ein Neuladen die Eingaben
  if (location.hash.startsWith('#t=')) history.replaceState(null, '', location.pathname + location.search);
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function budgetNums() {
  const n = SM.nights($('checkin').value, $('checkout').value);
  const total = Math.max(0, +$('budget').value || 0);
  return { n, total, perNight: n ? total / n : 0, perPerson: people.length ? total / people.length : 0 };
}
function updateBudget() {
  const b = budgetNums();
  $('budgetInfo').textContent = b.n
    ? `${b.n} Nächte · ${Math.round(b.perNight)} ${CUR} pro Nacht · ${Math.round(b.perPerson)} ${CUR} pro Person · ≈ ${Math.round(people.length ? b.perNight / people.length : 0)} ${CUR} pro Nacht und Person`
    : 'Zeitraum wählen';
}
['checkin', 'checkout', 'budget'].forEach(id => $(id).addEventListener('input', () => { updateBudget(); rescore(); }));
$('radius').addEventListener('change', () => rescore());
$('addPerson').onclick = () => { people.push({ name: freeName(), type: 'chill' }); save(); renderPeople(people.length - 1); };
$('example').onclick = () => {
  people = [{ name: 'Party 1', type: 'party' }, { name: 'Party 2', type: 'party' }, { name: 'Chill 1', type: 'chill' }, { name: 'Chill 2', type: 'chill' }, { name: 'Sights', type: 'sights' }];
  save(); renderPeople();
};

async function geocode(city) {
  const gk = 'sm_geo_' + city.toLowerCase();
  try { const c = JSON.parse(localStorage.getItem(gk)); if (c && Date.now() - c.t < 30 * 864e5) return c.v; } catch {}
  const v = await geocodeFresh(city);
  try { localStorage.setItem(gk, JSON.stringify({ t: Date.now(), v })); } catch {}
  return v;
}
async function geocodeFresh(city) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(city)}`, { headers: { 'Accept-Language': 'de' } });
  if (!r.ok) throw new Error(`Ortssuche gerade nicht erreichbar (${r.status}) – bitte gleich nochmal versuchen.`);
  const j = await r.json();
  if (!j.length) throw new Error('Stadt nicht gefunden');
  let [s, n, w, e] = j[0].boundingbox.map(Number);
  const lat = +j[0].lat, lon = +j[0].lon;
  // Große Städte auf ca. 16 × 16 km um das Zentrum begrenzen (Overpass-Last)
  const h = 0.075;
  s = Math.max(s, lat - h); n = Math.min(n, lat + h);
  const hl = h / Math.cos(lat * Math.PI / 180);
  w = Math.max(w, lon - hl); e = Math.min(e, lon + hl);
  // Ort statt Stadt ("Sagrada Família"): Box mindestens ca. 6 × 6 km, sonst gibt es kaum Viertel
  const m = 0.027, ml = m / Math.cos(lat * Math.PI / 180);
  s = Math.min(s, lat - m); n = Math.max(n, lat + m); w = Math.min(w, lon - ml); e = Math.max(e, lon + ml);
  return { lat, lon, bbox: [s, w, n, e], name: j[0].display_name.split(',')[0] };
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const FIELDS = ['lat', 'lon', 'place', 'name', 'amenity', 'leisure', 'tourism', 'historic', 'natural', 'railway', 'public_transport', 'wikidata', 'name:de', 'alt_name'];
// CSV statt JSON: ca. 6x kleiner. Alle Server parallel, der schnellste gewinnt.
async function overpass(bbox) {
  // Orte ca. 900 m über den Rand hinaus laden, damit Randviertel nicht unterschätzt werden (Viertel nur innerhalb)
  const b = bbox.map(x => x.toFixed(4)).join(',');
  const [bs, bw, bn, be] = bbox, pad = 0.008, padl = pad / Math.cos((bs + bn) / 2 * Math.PI / 180);
  const bo = [bs - pad, bw - padl, bn + pad, be + padl].map(x => x.toFixed(4)).join(',');
  const q = `[out:csv(::lat,::lon,${FIELDS.slice(2).join(',')};true;"|")][timeout:90];(
    nwr["place"~"^(suburb|neighbourhood|quarter)$"](${b});
    nwr["amenity"~"^(bar|pub|nightclub|biergarten|cafe|restaurant|fast_food)$"](${bo});
    nwr["leisure"~"^(park|garden|spa)$"](${bo});
    nwr["tourism"~"^(attraction|museum|viewpoint|gallery)$"](${bo});
    nwr["historic"~"^(monument|castle|memorial|ruins|church|cathedral)$"](${bo});
    nwr["natural"="beach"](${bo});
    node["railway"~"^(station|subway_entrance|tram_stop)$"](${bo});
    node["public_transport"="station"](${bo});
  );out center;`;
  // Fair zu den freiwilligen Servern: erst einer, der nächste erst nach 20 s ohne Antwort oder bei Fehler.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 110000);
  let next = Promise.resolve();
  const tries = OVERPASS.map((url, i) => {
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
    if (!navigator.onLine) throw new Error('Du bist offline. Internet prüfen und nochmal versuchen.');
    const errs = e.errors || [e];
    if (errs.some(x => /: (429|502|503|504)$/.test(x.message))) throw new Error('OpenStreetMap-Server gerade überlastet – bitte in einer Minute nochmal versuchen.');
    if (errs.some(x => x.name === 'AbortError')) throw new Error('OpenStreetMap hat nicht rechtzeitig geantwortet. Kleinere Stadt oder später nochmal versuchen.');
    throw new Error('OpenStreetMap-Daten konnten nicht geladen werden (' + errs.map(x => x.message).join(', ') + '). Bitte gleich nochmal versuchen.');
  }
}

// Vorab geladene Städte (scripts/prefetch-cities.mjs → web/data/)
const normCity = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
async function prefetched(city) {
  try {
    const idx = await (await fetch('data/index.json')).json();
    const file = idx[normCity(city)];
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
      for (const key of Object.keys(localStorage)) if (key.startsWith('sm_osm2_')) {
        let t = 0; try { t = JSON.parse(localStorage.getItem(key)).t || 0; } catch {} // kaputter Eintrag = ältester
        if (t < ot) { ot = t; oldest = key; }
      }
      if (!oldest) break;
      localStorage.removeItem(oldest);
    }
  }
  try { sessionStorage.setItem(k, v); } catch {}
}

// alte Cache-Version (vor CSV/nwr) entfernen
try { Object.keys(localStorage).filter(k => k.startsWith('sm_osm_')).forEach(k => localStorage.removeItem(k)); } catch {}

let map, layer, lastData = null; // lastData: geladene Viertel + Orte → Neuberechnung ohne Netz
const radius = () => +$('radius').value || 800;

async function run() {
  if ($('go').disabled) return; // läuft schon (z. B. Enter während der Suche)
  const city = $('city').value.trim();
  if (!city || !people.length) { $('status').textContent = 'Bitte Stadt und mindestens eine Person angeben.'; return; }
  const de = dateError();
  if (de) { $('status').textContent = de; $('checkout').focus(); return; }
  $('go').disabled = true;
  $('results').setAttribute('aria-busy', 'true');
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
      // Sehr wenige Zeilen deuten auf eine abgebrochene Antwort hin → nicht einen Tag lang merken
      if (!rows) { rows = await overpass(geo.bbox); if (rows.length >= 50) cacheSet(cacheKey, rows); }
    }

    const areas = [], pois = [];
    for (const t of rows) {
      const lat = +t.lat, lon = +t.lon;
      if (!lat) continue;
      if (t.place && t.name) {
        // deutscher Name zur Anzeige (wenn Browser deutsch), Originalname bleibt für Airbnb-Suche und Plugin-Abgleich
        const shown = DE && t['name:de'] ? t['name:de'] : t.name;
        const alt = [t.name, t['name:de'], ...(t.alt_name || '').split(';')].map(x => (x || '').trim()).filter(x => x && x !== shown);
        if (!areas.some(a => a.orig === t.name && SM.distM(a, { lat, lon }) < 1500)) areas.push({ name: shown, orig: t.name, alt: [...new Set(alt)], lat, lon });
        continue;
      }
      for (const cat of SM.categoriesOf(t)) pois.push({ lat, lon, cat, name: t.name, tags: t, w: t.amenity === 'fast_food' ? 0.3 : 1 });
    }
    if (areas.length < 2) throw new Error('Keine Viertel in OpenStreetMap gefunden – andere Stadt versuchen.');
    lastData = { areas, pois, geo, query: city };
    compute();
  } catch (e) {
    $('status').textContent = 'Fehler: ' + (/failed to fetch|networkerror|load failed/i.test(e.message) ? 'Keine Verbindung zum Kartendienst. Internet prüfen und nochmal versuchen.' : e.message);
    // Alte Ergebnisse gehören zu einer anderen Suche: ausblenden statt als neue ausgeben
    if (lastData && normCity(lastData.query || '') !== normCity(city)) { $('results').innerHTML = ''; $('map').hidden = true; }
  } finally { $('go').disabled = false; $('results').removeAttribute('aria-busy'); }
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
    // Gleichstand: kleinere Spanne zwischen den Personen, dann mehr ÖPNV
    .sort((a, b) => b.group.total - a.group.total || (Math.max(...a.group.scores) - a.group.min) - (Math.max(...b.group.scores) - b.group.min) || b.counts.transit - a.counts.transit);
  const ranked = SM.pickDiverse(sorted, 8, Math.max(1200, r * 1.5));
  if (!ranked.length) { $('results').innerHTML = ''; $('map').hidden = true; $('status').textContent = 'Keine passenden Viertel mit genug Orten gefunden. Versuche eine größere Stadt, einen größeren Umkreis oder einen anderen Ortsnamen.'; return; }
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
    const url = SM.airbnbUrl({ lat: a.lat, lon: a.lon, name: a.orig || a.name, city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value, adults: ppl.length, priceMaxNight: b.perNight, radius: r, lang: navigator.language });
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
      <h3><span>${i + 1}. ${escapeHtml(a.name)}${a.orig && a.orig !== a.name ? ` <small class="muted">${escapeHtml(a.orig)}</small>` : ''}</span><span class="score" aria-label="${a.group.total} von 100">${a.group.total}</span></h3>
      <div class="bar"><i style="width:${a.group.total}%"></i></div>
      <div class="chips">${chips}</div>
      ${why}
      <div class="muted">🍸 ${c.party} Bars/Clubs · 🌿 ${c.chill} Parks/Cafés · 🏛️ ${c.sights} Sehenswürdigkeiten · 🍝 ${c.food} Restaurants · 🚇 ${c.transit} Stationen</div>
      ${highlights.length ? `<div class="muted">In der Nähe: ${highlights.map(escapeHtml).join(', ')}</div>` : ''}
      <div><a class="btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">Unterkünfte hier auf Airbnb ansehen →</a></div>
    </article>`;
  }).join('');
}

function renderMap(ranked, geo, r = 800) {
  if (!window.L) return;
  $('map').hidden = false;
  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  }
  map.invalidateSize();
  // Ausschnitt nur ändern, wenn sich die Auswahl ändert (sonst springt die Karte bei jeder Änderung zurück)
  const key = ranked.map(a => a.name).join('|');
  if (key !== renderMap.key) { renderMap.key = key; map.fitBounds(L.latLngBounds(ranked.map(a => [a.lat, a.lon])).pad(0.3)); }
  if (layer) layer.remove();
  layer = L.layerGroup(ranked.map((a, i) => L.circle([a.lat, a.lon], { radius: Math.round(r * 0.75), color: i === 0 ? '#e0475b' : '#888', weight: 2, fillOpacity: 0.12 })
    .bindTooltip(`${i + 1}. ${escapeHtml(a.name)} (${a.group.total})`, { permanent: i < 3 }))).addTo(map);
}

$('go').onclick = run;

// ---- Reise per Link teilen (alles steht im Teil nach #, wird nie an einen Server geschickt) ----
const b64 = {
  enc: o => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))),
};
function shareState() {
  return { c: $('city').value.trim(), i: $('checkin').value, o: $('checkout').value, b: +$('budget').value || 0, p: people.map(p => [p.name, p.type]) };
}
function applyShared(h) {
  try {
    const s = b64.dec(h);
    const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
    const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    if (!Array.isArray(s.p) || !s.p.length || s.p.length > 30) return false;
    people = s.p.map(([n, t]) => ({ name: str(n, 40) || 'Person', type: SM.PRESETS[t] ? t : 'chill' }));
    $('city').value = str(s.c, 80);
    if (day(s.i)) $('checkin').value = s.i;
    if (day(s.o)) $('checkout').value = s.o;
    $('budget').value = Math.max(0, Math.min(1e6, +s.b || 0));
    save(); renderPeople(); updateBudget();
    return true;
  } catch { return false; }
}
$('share').onclick = async () => {
  const url = location.origin + location.pathname + '#t=' + b64.enc(shareState());
  try { await navigator.clipboard.writeText(url); $('shareMsg').textContent = '✅ Link kopiert. Schick ihn in den Gruppenchat.'; }
  catch { $('shareMsg').textContent = 'Kopieren nicht möglich. Kopiere den Link aus der Adresszeile.'; }
  history.replaceState(null, '', url);
};
if (location.hash.startsWith('#t=')) {
  if (applyShared(location.hash.slice(3))) { $('status').textContent = 'Reise aus dem Link geladen. Trag dich ein oder starte die Suche.'; }
  else { $('status').textContent = 'Der Link ist beschädigt oder zu alt.'; }
}
$('city').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });

// Brücke zum Plugin: alle bewerteten Viertel + Gruppe speichern, Plugin übernimmt sie
function saveTrip(geo, areas, ppl) {
  const b = budgetNums();
  const trip = {
    savedAt: Date.now(), city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value,
    nights: b.n, budget: b.total, people: ppl.map(p => ({ name: p.name, type: p.type })),
    areas: areas.map(a => {
      const j = a.group.scores.indexOf(a.group.min);
      return { name: a.name, alt: a.alt?.length ? a.alt.slice(0, 4) : undefined, lat: +a.lat.toFixed(5), lon: +a.lon.toFixed(5), total: a.group.total, min: a.group.min, minName: ppl[j]?.name || null };
    }),
  };
  const v = JSON.stringify(trip);
  try { localStorage.setItem('sm_trip', v); }
  catch { // Speicher voll: alte Stadt-Caches löschen und nochmal
    try { Object.keys(localStorage).filter(k => k.startsWith('sm_osm')).forEach(k => localStorage.removeItem(k)); localStorage.setItem('sm_trip', v); } catch {}
  }
  window.dispatchEvent(new Event('staymatch:trip'));
}
// Hinweis, ob das Plugin installiert ist (setzt bridge.js)
const extOk = () => { if (document.documentElement.dataset.staymatchExtension) $('extHint').textContent = '✅ Plugin verbunden: Auf der Airbnb-Seite siehst du direkt die Top 3 für euch.'; };
window.addEventListener('staymatch:extension', extOk); // bridge.js meldet sich, auch wenn es später lädt
extOk(); setTimeout(extOk, 800);
document.querySelector('label[for="budget"]').textContent = `Budget gesamt für alle (${CUR})`;
renderPeople();
