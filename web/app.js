const SM = window.StayMatch;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let people = store.get('sm_people', [
  { name: 'Lena', type: 'party' }, { name: 'Mia', type: 'party' },
  { name: 'Jonas', type: 'chill' }, { name: 'Sara', type: 'chill' }, { name: 'Tom', type: 'sights' },
]).map(SM.cleanPerson).filter(Boolean);
let fairness = SM.cleanFairness(store.get('sm_fair', 0.6)); // Gewicht der unzufriedensten Person (Rest: Schnitt)
const openTune = new WeakSet(); // welche Personen haben das Regler-Feld offen

// Standard-Zeitraum: in 4 Wochen, 4 Nächte
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const d0 = new Date(Date.now() + 28 * 864e5), d1 = new Date(d0.getTime() + 4 * 864e5);
$('checkin').value = ymd(d0);
$('checkout').value = ymd(d1);
// #38 keine Vergangenheit, Abreise nach Anreise
$('checkin').min = ymd(new Date());
const syncMin = () => { const c = new Date($('checkin').value); if (!isNaN(c)) { $('checkout').min = ymd(new Date(c.getTime() + 864e5)); if ($('checkout').value <= $('checkin').value) $('checkout').value = ymd(new Date(c.getTime() + 864e5)); } };
$('checkin').addEventListener('change', syncMin); syncMin();

function renderPeople() {
  $('people').innerHTML = '';
  people.forEach((p, i) => {
    const box = document.createElement('div');
    box.className = 'pbox';
    const row = document.createElement('div');
    row.className = 'person';
    row.innerHTML = `<input value="${escapeHtml(p.name)}" aria-label="Name Person ${i + 1}">
      <select aria-label="Typ von ${escapeHtml(p.name)}">${Object.entries(SM.PRESETS).map(([k, v]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <button class="tunebtn" aria-expanded="${openTune.has(p)}" aria-label="Wünsche von ${escapeHtml(p.name)} feinjustieren" title="Wünsche feinjustieren">⚙️</button>
      <button title="Entfernen" aria-label="${escapeHtml(p.name)} entfernen">✕</button>`;
    row.children[0].oninput = e => { p.name = e.target.value; save(); };
    row.children[1].onchange = e => { p.type = e.target.value; delete p.custom; save(); renderPeople(); };
    row.children[2].onclick = () => { openTune.has(p) ? openTune.delete(p) : openTune.add(p); renderPeople(); };
    row.children[3].onclick = () => { people.splice(i, 1); save(); renderPeople(); };
    box.appendChild(row);
    if (openTune.has(p)) box.appendChild(tunePanel(p));
    $('people').appendChild(box);
  });
  updateBudget();
}
// Schieberegler pro Person (-10..+10 je Kategorie) und „auf keinen Fall“ (Veto)
function tunePanel(p) {
  const w = SM.weightsOf(p);
  const el = document.createElement('div');
  el.className = 'tune';
  el.innerHTML = `<p class="muted">Was ist ${escapeHtml(p.name)} wichtig? Rechts = wichtig, links = stört. „Nie“ schließt Viertel mit viel davon ganz aus.${p.custom ? ' <b>Eigene Werte.</b> <button class="link" data-reset>Auf Typ zurücksetzen</button>' : ''}</p>` +
    Object.entries(SM.CATEGORIES).map(([k, c]) => `<div class="trow">
      <label for="t-${k}-${escapeHtml(p.name)}">${c.label}</label>
      <input type="range" id="t-${k}-${escapeHtml(p.name)}" data-k="${k}" min="-10" max="10" step="1" value="${Math.round(w[k] * 10)}" aria-valuetext="${Math.round(w[k] * 10)} von 10">
      <output>${Math.round(w[k] * 10)}</output>
      <label class="veto"><input type="checkbox" data-veto="${k}" ${(p.veto || []).includes(k) ? 'checked' : ''}> Nie</label>
    </div>`).join('');
  el.querySelectorAll('input[type=range]').forEach(r => {
    r.oninput = () => {
      p.custom = SM.cleanWeights(Object.fromEntries([...el.querySelectorAll('input[type=range]')].map(x => [x.dataset.k, +x.value / 10])));
      r.nextElementSibling.textContent = r.value; r.setAttribute('aria-valuetext', `${r.value} von 10`);
      save();
    };
  });
  el.querySelectorAll('input[data-veto]').forEach(c => {
    c.onchange = () => {
      const set = new Set(p.veto || []); c.checked ? set.add(c.dataset.veto) : set.delete(c.dataset.veto);
      p.veto = [...set]; if (!p.veto.length) delete p.veto;
      save();
    };
  });
  const reset = el.querySelector('[data-reset]');
  if (reset) reset.onclick = () => { delete p.custom; save(); renderPeople(); };
  return el;
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
    ? `${b.n} Nächte · ${Math.round(b.perNight)} € pro Nacht · ${Math.round(b.perPerson)} € pro Person`
    : 'Zeitraum wählen';
}
['checkin', 'checkout', 'budget'].forEach(id => $(id).addEventListener('input', () => { updateBudget(); rescore(); }));
$('radius').addEventListener('change', () => rescore());
function updateFair() { const f = Math.round(fairness * 100); $('fairOut').textContent = `${f} % unzufriedenste Person · ${100 - f} % Schnitt`; $('fair').value = f; }
$('fair').addEventListener('input', () => { fairness = SM.cleanFairness(+$('fair').value / 100); updateFair(); store.set('sm_fair', fairness); rescore(); });
updateFair();
$('addPerson').onclick = () => { people.push({ name: `Person ${people.length + 1}`, type: 'chill' }); if (people.length > 16) $('shareMsg').textContent = 'Mehr als 16 Gäste: Airbnb erlaubt meist nur 16 pro Unterkunft. Sucht dann zwei Unterkünfte nebeneinander.'; save(); renderPeople(); };
$('example').onclick = () => {
  people = [{ name: 'Party 1', type: 'party' }, { name: 'Party 2', type: 'party' }, { name: 'Chill 1', type: 'chill' }, { name: 'Chill 2', type: 'chill' }, { name: 'Sights', type: 'sights' }];
  save(); renderPeople();
};

async function geocode(city, signal) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(city)}`, { headers: { 'Accept-Language': 'de' }, signal });
  if (!r.ok) throw new Error(`Ortssuche gerade nicht erreichbar (${r.status}) – bitte gleich nochmal versuchen.`);
  const choices = SM.placeChoices(await r.json());
  if (!choices.length) throw new Error('Stadt nicht gefunden');
  return choices;
}
function geoFrom(res) {
  let [s, n, w, e] = res.boundingbox.map(Number);
  const lat = +res.lat, lon = +res.lon;
  // Große Städte auf ca. 16 × 16 km um das Zentrum begrenzen (Overpass-Last)
  const h = 0.075;
  s = Math.max(s, lat - h); n = Math.min(n, lat + h);
  const hl = h / Math.cos(lat * Math.PI / 180);
  w = Math.max(w, lon - hl); e = Math.min(e, lon + hl);
  return { lat, lon, bbox: [s, w, n, e], name: res.display_name.split(',')[0] };
}

const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const FIELDS = ['lat', 'lon', 'place', 'name', 'amenity', 'leisure', 'tourism', 'historic', 'natural', 'railway', 'public_transport', 'wikidata'];
// CSV statt JSON: ca. 6x kleiner. Alle Server parallel, der schnellste gewinnt.
async function overpass(bbox, outer) {
  const b = bbox.map(x => x.toFixed(4)).join(',');
  const q = `[out:csv(::lat,::lon,${FIELDS.slice(2).join(',')};true;"|")][timeout:90];(
    nwr["place"~"^(suburb|neighbourhood|quarter)$"](${b});
    nwr["amenity"~"^(bar|pub|nightclub|biergarten|cafe|restaurant|fast_food)$"](${b});
    nwr["leisure"~"^(park|garden|spa)$"](${b});
    nwr["tourism"~"^(attraction|museum|viewpoint|gallery)$"](${b});
    node["historic"="monument"](${b});
    nwr["natural"="beach"](${b});
    node["railway"~"^(station|subway_entrance)$"](${b});
    node["public_transport"="station"](${b});
  );out center;`;
  // Fair zu den freiwilligen Servern: erst einer, der nächste erst nach 20 s ohne Antwort oder bei Fehler.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 110000);
  if (outer) outer.addEventListener('abort', () => ctrl.abort(), { once: true });
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
    if (outer && outer.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const codes = (e.errors || []).map(x => String(x.message).split(': ').pop());
    const busy = codes.some(c => c === '429' || c === '504' || c === '503');
    throw new Error(busy
      ? 'Die kostenlosen OpenStreetMap-Server sind gerade überlastet (Fehler 429/504). Das passiert zu Stoßzeiten. Meist klappt es nach 1–2 Minuten.'
      : 'Die OpenStreetMap-Server haben nicht rechtzeitig geantwortet (Zeitüberschreitung nach ca. 2 Minuten). Bitte nochmal versuchen. Große Städte brauchen länger.');
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
      try { for (const key of Object.keys(localStorage)) if (key.startsWith('sm_osm2_')) { const t = JSON.parse(localStorage.getItem(key)).t; if (t < ot) { ot = t; oldest = key; } } } catch {}
      if (!oldest) break;
      localStorage.removeItem(oldest);
    }
  }
  try { sessionStorage.setItem(k, v); } catch {}
}

// alte Cache-Version (vor CSV/nwr) entfernen
try { Object.keys(localStorage).filter(k => k.startsWith('sm_osm_')).forEach(k => localStorage.removeItem(k)); } catch {}

let map, layer, poiLayer, circles = [], cmp = [], lastData = null, lastView = null; // lastData: geladene Viertel + Orte → Neuberechnung ohne Netz
const radius = () => +$('radius').value || 800;

let runCtrl = null, tick = null;
function setBusy(on, msg) {
  $('go').disabled = on; $('cancel').hidden = !on; clearInterval(tick);
  if (on) {
    const t0 = Date.now(); let base = msg;
    setBusy.set = m => { base = m; draw(); };
    const draw = () => { $('status').textContent = `${base} (${Math.round((Date.now() - t0) / 1000)} s)`; };
    draw(); tick = setInterval(draw, 1000);
  }
}
$('cancel').onclick = () => { if (runCtrl) runCtrl.abort(); };
function showError(msg, retry = true) { $('status').textContent = 'Fehler: ' + msg; $('retry').hidden = !retry; }

async function run(pick) {
  if ($('go').disabled) return; // läuft schon (z. B. Enter während der Suche)
  const city = $('city').value.trim();
  $('retry').hidden = true; $('choices').hidden = true; $('choices').innerHTML = '';
  if (!city || !people.length) { $('status').textContent = 'Bitte Stadt und mindestens eine Person angeben.'; return; }
  runCtrl = new AbortController();
  const signal = runCtrl.signal;
  setBusy(true, 'Suche Stadt …');
  $('results').innerHTML = ''; $('compare').innerHTML = '';
  try {
    // 1) vorab geladene Stadt (sofort, ohne Anfrage an OpenStreetMap-Server)
    let geo, rows = null;
    const pre = pick ? null : await prefetched(city);
    if (pre) { geo = pre.geo; rows = pre.rows; }
    // 2) sonst: Ort suchen (bei mehreren gleich wichtigen Treffern nachfragen) und Daten holen (Tageszwischenspeicher im Browser)
    if (!rows) {
      let res = pick;
      if (!res) {
        const choices = await geocode(city, signal);
        if (choices.length > 1) { showChoices(choices); return; }
        res = choices[0];
      }
      geo = geoFrom(res);
      const cacheKey = 'sm_osm2_' + geo.bbox.map(x => x.toFixed(3)).join(',');
      rows = cacheGet(cacheKey);
      setBusy.set(rows ? `Nutze gespeicherte Daten für ${geo.name} …` : `Lade Orte in ${geo.name} aus OpenStreetMap, kann bis zu 2 Minuten dauern`);
      if (!rows) { rows = await overpass(geo.bbox, signal); cacheSet(cacheKey, rows); }
    }

    const areas = [], pois = [];
    for (const t of rows) {
      const lat = +t.lat, lon = +t.lon;
      if (!lat) continue;
      if (t.place && t.name) { if (!areas.some(a => a.name === t.name && SM.distM(a, { lat, lon }) < 1500)) areas.push({ name: t.name, lat, lon }); continue; }
      for (const cat of SM.categoriesOf(t)) pois.push({ lat, lon, cat, name: t.name, tags: t });
    }
    if (areas.length < 2) throw new Error('Keine Viertel in OpenStreetMap gefunden – andere Stadt versuchen.');
    lastData = { areas, pois, geo };
    cmp = [];
    compute();
    // Auf dem Handy liegt das Ergebnis unter dem Formular: dorthin scrollen
    if (matchMedia('(max-width:900px)').matches) $('status').scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  } catch (e) {
    if (e.name === 'AbortError' || signal.aborted) $('status').textContent = 'Suche abgebrochen. Du kannst es jederzeit nochmal starten.';
    else if (!navigator.onLine) showError('Du bist offline. Internet prüfen und nochmal versuchen.');
    else showError(/fetch|network|load failed/i.test(e.message) ? 'Keine Verbindung zum Kartendienst. Internet prüfen und nochmal versuchen.' : e.message, !/nicht gefunden|Keine Viertel/.test(e.message));
  } finally { setBusy(false); runCtrl = null; }
}
// Mehrdeutiger Ortsname („Paris“): Person wählt
function showChoices(choices) {
  $('status').textContent = 'Mehrere Orte gefunden. Welcher ist gemeint?';
  const box = $('choices'); box.hidden = false;
  box.innerHTML = choices.map((c, i) => `<button data-i="${i}">${escapeHtml(c.display_name.split(',').map(x => x.trim()).filter((_, j, a) => j === 0 || j >= a.length - 2).join(', '))}</button>`).join('');
  box.onclick = e => { const b = e.target.closest('button'); if (b) { box.hidden = true; run(choices[+b.dataset.i]); } };
  box.querySelector('button').focus();
}
$('retry').onclick = () => run();

// Wertung neu rechnen, wenn Gruppe, Umkreis, Budget oder Datum sich ändern (kein neuer Abruf nötig)
function compute() {
  if (!lastData) return;
  const { areas, pois, geo } = lastData;
  const r = radius();
  SM.scoreAreas(areas, pois, r);
  const ppl = people.map(p => ({ ...p, w: SM.weightsOf(p) }));
  for (const a of areas) { a.group = SM.groupScore(a.norm, ppl, fairness); a.vetoes = SM.vetoes(a.norm, ppl); }
  // Viertel ohne nennenswerte Infrastruktur ausblenden, Viertel mit Veto ebenso
  const withData = areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10);
  const sorted = withData.filter(a => !a.vetoes.length).sort((a, b) => b.group.total - a.group.total);
  const vetoed = withData.length - sorted.length;
  const vetoNote = vetoed ? ` ${vetoed} Viertel ausgeschlossen (${[...new Set(withData.flatMap(a => a.vetoes.map(v => `${v.name}: nie ${v.label}`)))].slice(0, 3).join(', ')}).` : '';
  const ranked = SM.pickDiverse(sorted, 8, Math.max(1200, r * 1.5));
  lastView = { ranked, ppl, r };
  if (!ranked.length) { $('results').innerHTML = ''; $('compare').innerHTML = ''; $('status').textContent = vetoed ? `Alle Viertel sind durch ein Veto ausgeschlossen.${vetoNote} Nimm ein „Nie“ heraus.` : 'Keine passenden Viertel mit genug Orten gefunden. Versuche eine größere Stadt, einen größeren Umkreis oder einen anderen Ortsnamen.'; return; }
  $('status').textContent = `${sorted.length} Viertel und ${pois.length} Orte ausgewertet.${vetoNote} Die besten für eure Gruppe:`;
  saveTrip(geo, sorted, ppl);
  renderResults(ranked, pois, ppl, geo, r);
  renderCompare();
  renderMap(ranked, geo, r, pois);
}
let rescoreTimer = null;
const rescore = () => { clearTimeout(rescoreTimer); rescoreTimer = setTimeout(() => { try { compute(); } catch (e) { console.debug(e); } }, 250); };
const areaKey = a => `${a.name}@${a.lat.toFixed(4)}`;

function renderResults(ranked, pois, ppl, geo, r) {
  const b = budgetNums();
  $('results').innerHTML = ranked.map((a, i) => {
    const highlights = [...new Set(pois.filter(p => p.name && p.cat !== 'transit' && p.cat !== 'food' && SM.distM(a, p) < r)
      .sort((x, y) => (y.tags.wikidata ? 1 : 0) - (x.tags.wikidata ? 1 : 0)).map(p => p.name))].slice(0, 5);
    const url = SM.airbnbUrl({ lat: a.lat, lon: a.lon, name: a.name, city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value, adults: ppl.length, priceMaxNight: b.perNight, radius: r });
    // Chips nicht nur über Farbe: Symbol dazu
    const chips = ppl.map((p, j) => {
      const s = a.group.scores[j];
      return `<span class="chip ${s < 40 ? 'low' : s >= 70 ? 'high' : ''}">${s < 40 ? '⚠ ' : s >= 70 ? '✓ ' : ''}${escapeHtml(p.name)}: ${s}</span>`;
    }).join('');
    const c = a.counts;
    // Wer ist am wenigsten zufrieden und warum?
    const lowIdx = a.group.scores.indexOf(a.group.min), low = ppl[lowIdx];
    const weak = low && a.group.min < 60 ? SM.weakness(a.norm, a.counts, low.w) : null;
    const why = weak ? `<div class="muted">⚠️ ${escapeHtml(low.name)} (${a.group.min}) ${weak.kind === 'missing' ? `vermisst hier: ${weak.label} (nur ${weak.count} im Umkreis)` : `stört: viel ${weak.label} (${weak.count} im Umkreis)`}</div>` : '';
    const thin = SM.thinData(c) ? `<div class="muted">ℹ️ Wenig Daten in OpenStreetMap für dieses Viertel (${Object.values(c).reduce((x, y) => x + y, 0)} Orte im Umkreis). Die Wertung ist hier unsicher.</div>` : '';
    const k = areaKey(a);
    return `<article class="card result" id="area-${i}" data-i="${i}" tabindex="-1" aria-labelledby="areah-${i}">
      <h3 id="areah-${i}"><span>${i + 1}. ${escapeHtml(a.name)}</span><span class="score" aria-label="Gruppenwert ${a.group.total} von 100">${a.group.total}</span></h3>
      <div class="bar" aria-hidden="true"><i style="width:${a.group.total}%"></i></div>
      <div class="chips" role="list" aria-label="Zufriedenheit je Person">${chips.replace(/<span /g, '<span role="listitem" ')}</div>
      ${why}${thin}
      <div class="muted">🍸 ${c.party} Bars/Clubs · 🌿 ${c.chill} Parks/Cafés · 🏛️ ${c.sights} Sehenswürdigkeiten · 🍝 ${c.food} Restaurants · 🚇 ${c.transit} Stationen</div>
      ${highlights.length ? `<div class="muted">In der Nähe: ${highlights.map(escapeHtml).join(', ')}</div>` : ''}
      <div class="actions"><a class="btn" href="${url}" target="_blank" rel="noopener">Unterkünfte hier auf Airbnb ansehen →</a>
      <label class="cmp"><input type="checkbox" data-k="${escapeHtml(k)}" ${cmp.includes(k) ? 'checked' : ''}> Vergleichen</label></div>
    </article>`;
  }).join('');
}

// Karte ↔ Liste verbinden: Hover/Fokus auf Karte hebt den Kreis hervor, Klick auf Kreis springt zur Karte
const resultsEl = $('results');
const hi = (i, on) => { const c = circles[i]; if (c) c.setStyle({ weight: on ? 5 : 2, fillOpacity: on ? 0.3 : 0.12 }); };
resultsEl.addEventListener('mouseover', e => { const a = e.target.closest('article'); if (a) hi(+a.dataset.i, true); });
resultsEl.addEventListener('mouseout', e => { const a = e.target.closest('article'); if (a) hi(+a.dataset.i, false); });
resultsEl.addEventListener('focusin', e => { const a = e.target.closest('article'); if (a) hi(+a.dataset.i, true); });
resultsEl.addEventListener('focusout', e => { const a = e.target.closest('article'); if (a) hi(+a.dataset.i, false); });
resultsEl.addEventListener('change', e => {
  const c = e.target.closest('input[data-k]'); if (!c) return;
  if (c.checked) { cmp.push(c.dataset.k); if (cmp.length > 2) { const old = cmp.shift(); resultsEl.querySelectorAll('input[data-k]').forEach(x => { if (x.dataset.k === old) x.checked = false; }); } }
  else cmp = cmp.filter(x => x !== c.dataset.k);
  renderCompare();
});

// Zwei Viertel nebeneinander
function renderCompare() {
  const el = $('compare');
  if (!lastView || cmp.length !== 2) { el.innerHTML = cmp.length === 1 ? '<p class="muted">Wähle ein zweites Viertel zum Vergleichen.</p>' : ''; return; }
  const { ranked, ppl } = lastView;
  const A = ranked.find(a => areaKey(a) === cmp[0]), B = ranked.find(a => areaKey(a) === cmp[1]);
  if (!A || !B) { cmp = []; el.innerHTML = ''; return; }
  const c = SM.compareAreas(A, B, ppl);
  const cell = (v, win, side) => `<td class="${win === side ? 'win' : ''}">${v}${win === side ? ' ✓' : ''}</td>`;
  const row = (label, x) => `<tr><th scope="row">${escapeHtml(label)}</th>${cell(x.a, x.win, 1)}${cell(x.b, x.win, 2)}</tr>`;
  el.innerHTML = `<div class="card"><table class="cmp-table"><caption>Vergleich: ${escapeHtml(A.name)} gegen ${escapeHtml(B.name)}</caption>
    <thead><tr><th scope="col"></th><th scope="col">${escapeHtml(A.name)}</th><th scope="col">${escapeHtml(B.name)}</th></tr></thead>
    <tbody>${row('Gruppenwert', c.total)}
    ${c.persons.map(p => row('Zufriedenheit ' + p.name, p)).join('')}
    ${c.cats.map(x => row(x.label + ' (Anzahl)', x)).join('')}</tbody></table>
    <button class="link" id="cmpClose">Vergleich schließen</button></div>`;
  $('cmpClose').onclick = () => { cmp = []; resultsEl.querySelectorAll('input[data-k]').forEach(x => { x.checked = false; }); renderCompare(); };
}

const POI_COLORS = { party: '#e0475b', chill: '#2fbf85', sights: '#7c6cf0', food: '#e6a23c', transit: '#4aa3df' };
// Kartenfilter (Person, Orte) einmal aufbauen
function buildMapBar(ppl) {
  const sel = $('mapWho'), keep = sel.value;
  sel.innerHTML = `<option value="g">Gruppe</option>` + ppl.map((p, i) => `<option value="${i}">${escapeHtml(p.name)}</option>`).join('');
  if ([...sel.options].some(o => o.value === keep)) sel.value = keep;
  if (!$('poiToggles').children.length) {
    $('poiToggles').innerHTML = Object.entries(SM.CATEGORIES).map(([k, c]) => `<label><input type="checkbox" data-poi="${k}"> <i class="dot" style="background:${POI_COLORS[k]}"></i>${c.label}</label>`).join('');
    $('poiToggles').onchange = () => lastView && renderMap(lastView.ranked, lastData.geo, lastView.r, lastData.pois);
  }
}
$('mapWho').addEventListener('change', () => lastView && renderMap(lastView.ranked, lastData.geo, lastView.r, lastData.pois));
$('mapToggle').onclick = () => {
  const hide = !$('mapWrap').hidden; $('mapWrap').hidden = hide;
  $('mapToggle').textContent = hide ? 'Karte einblenden' : 'Karte ausblenden'; $('mapToggle').setAttribute('aria-expanded', String(!hide));
  if (!hide && map) setTimeout(() => map.invalidateSize(), 0);
};

function renderMap(ranked, geo, r = 800, pois = []) {
  if (!window.L) return;
  $('mapSection').hidden = false;
  buildMapBar(lastView ? lastView.ppl : []);
  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  }
  map.invalidateSize();
  // Ausschnitt nur ändern, wenn sich die Auswahl ändert (sonst springt die Karte bei jeder Änderung zurück)
  const key = ranked.map(a => a.name).join('|');
  if (key !== renderMap.key) { renderMap.key = key; map.fitBounds(L.latLngBounds(ranked.map(a => [a.lat, a.lon])).pad(0.3)); }
  if (layer) layer.remove();
  if (poiLayer) poiLayer.remove();
  const who = $('mapWho').value, pi = who === 'g' ? -1 : +who;
  const score = a => pi < 0 ? a.group.total : a.group.scores[pi];
  const color = (a, i) => pi < 0 ? (i === 0 ? '#e0475b' : '#888') : (score(a) >= 70 ? '#2fbf85' : score(a) < 40 ? '#e6a23c' : '#888');
  circles = ranked.map((a, i) => {
    const c = L.circle([a.lat, a.lon], { radius: Math.round(r * 0.75), color: color(a, i), weight: 2, fillOpacity: 0.12 })
      .bindTooltip(`${i + 1}. ${a.name} (${pi < 0 ? '' : lastView.ppl[pi].name + ': '}${score(a)})`, { permanent: i < 3 });
    c.on('click', () => { const el = $('area-' + i); if (el) { el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }); } });
    return c;
  });
  layer = L.layerGroup(circles).addTo(map);
  // Orte als Punkte (nur in den gezeigten Vierteln, höchstens 1500)
  const on = [...$('poiToggles').querySelectorAll('input:checked')].map(x => x.dataset.poi);
  if (on.length) {
    const canvas = L.canvas({ padding: 0.3 });
    const dots = [];
    for (const p of pois) {
      if (!on.includes(p.cat) || dots.length >= 1500) continue;
      if (!ranked.some(a => SM.distM(a, p) <= r)) continue;
      const m = L.circleMarker([p.lat, p.lon], { renderer: canvas, radius: 4, color: POI_COLORS[p.cat], weight: 1, fillOpacity: 0.8 });
      if (p.name) m.bindTooltip(p.name);
      dots.push(m);
    }
    poiLayer = L.layerGroup(dots).addTo(map);
  }
}

$('go').onclick = () => run();

// ---- Reise per Link teilen (alles steht im Teil nach #, wird nie an einen Server geschickt) ----
const b64 = {
  enc: o => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))),
};
function shareState() {
  return { c: $('city').value.trim(), i: $('checkin').value, o: $('checkout').value, b: +$('budget').value || 0, f: Math.round(fairness * 100),
    p: people.map(p => [p.name, p.type, p.custom ? Object.keys(SM.CATEGORIES).map(k => Math.round(p.custom[k] * 10)) : 0, p.veto || 0]) };
}
function applyShared(h) {
  try {
    const s = b64.dec(h);
    const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
    const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    if (!Array.isArray(s.p) || !s.p.length || s.p.length > 30) return false;
    const keys = Object.keys(SM.CATEGORIES);
    people = s.p.filter(Array.isArray).map(([n, t, c, v]) => SM.cleanPerson({
      name: str(n, 40) || 'Person', type: t,
      custom: Array.isArray(c) ? Object.fromEntries(keys.map((k, i) => [k, (+c[i] || 0) / 10])) : undefined,
      veto: v || undefined,
    })).filter(Boolean);
    if (!people.length) return false;
    if (s.f != null) { fairness = SM.cleanFairness(+s.f / 100); store.set('sm_fair', fairness); updateFair(); }
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
$('city').addEventListener('input', () => { $('choices').hidden = true; });

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
// Hinweis, ob das Plugin installiert ist (setzt bridge.js)
setTimeout(() => {
  if (document.documentElement.dataset.staymatchExtension) $('extHint').textContent = '✅ Plugin verbunden: Auf der Airbnb-Seite siehst du direkt die Top 3 für euch.';
}, 800);
renderPeople();
