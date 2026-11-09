const SM = window.StayMatch, C = window.StayMatchCore;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const clone = o => JSON.parse(JSON.stringify(o));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const LABELS = { party: ['🍸', 'Bars/Clubs'], chill: ['🌿', 'Parks/Cafés'], sights: ['🏛️', 'Sehenswürdigkeiten'], food: ['🍝', 'Restaurants'], transit: ['🚇', 'Stationen'], shop: ['🛍️', 'Einkaufen'], sport: ['🏃', 'Sport'], kids: ['🧸', 'Kinderorte'] };
const CORE_CATS = ['party', 'chill', 'sights', 'food', 'transit'];
const CITIES = ['Barcelona', 'Lissabon', 'Rom', 'Wien', 'Berlin', 'Paris', 'Madrid', 'Prag', 'Amsterdam', 'Budapest'];
const TIERS = ['', '€', '€€', '€€€'];

let people = store.get('sm_people', [
  { name: 'Lena', type: 'party' }, { name: 'Mia', type: 'party' },
  { name: 'Jonas', type: 'chill' }, { name: 'Sara', type: 'chill' }, { name: 'Tom', type: 'sights' },
]).map(SM.cleanPerson).filter(Boolean);
let fairness = SM.cleanFairness(store.get('sm_fair', 0.6)); // Gewicht der unzufriedensten Person (Rest: Schnitt)
const openTune = new WeakSet(); // welche Personen haben das Regler-Feld offen
let sortMode = 'fair', shown = 8;

// ---- Rückgängig für Gruppenänderungen (Entfernen, Beispiel, Text, Vorlage) ----
let undoSnap = null, undoTimer = null;
function offerUndo(msg) {
  undoSnap = clone(people); $('undoMsg').textContent = msg; $('undo').hidden = false;
  clearTimeout(undoTimer); undoTimer = setTimeout(() => { $('undo').hidden = true; }, 15000);
}
$('undoBtn').onclick = () => {
  if (!undoSnap) return;
  people = undoSnap.map(SM.cleanPerson).filter(Boolean); undoSnap = null; $('undo').hidden = true;
  save(); renderPeople();
};

// Standard-Zeitraum: in 4 Wochen, 4 Nächte
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const d0 = new Date(Date.now() + 28 * 864e5), d1 = new Date(d0.getTime() + 4 * 864e5);
$('checkin').value = ymd(d0);
$('checkout').value = ymd(d1);
$('checkin').min = ymd(new Date());

// ---- Formular merken (Stadt, Zeitraum, Budget, Umkreis …) ----
function formState() {
  return { c: $('city').value.trim(), i: $('checkin').value, o: $('checkout').value, b: +$('budget').value || 0, bm: $('budgetMode').value,
    r: $('radius').value, mc: $('maxcenter').value, k: +$('kids').value || 0, y: +$('babys').value || 0, bd: $('beds').checked };
}
const saveForm = () => store.set('sm_form', formState());
function applyForm(f, { dates = true } = {}) {
  if (!f || typeof f !== 'object') return;
  const pick = (el, v, ok) => { if (v != null && ok(v)) el.value = v; };
  if (typeof f.c === 'string' && f.c) $('city').value = f.c.slice(0, 80);
  // Gespeicherte Daten nur, wenn sie nicht in der Vergangenheit liegen
  if (dates && /^\d{4}-\d{2}-\d{2}$/.test(f.i) && /^\d{4}-\d{2}-\d{2}$/.test(f.o) && f.i >= ymd(new Date()) && f.o > f.i) { $('checkin').value = f.i; $('checkout').value = f.o; }
  pick($('budget'), f.b, v => Number.isFinite(+v)); pick($('budgetMode'), f.bm, v => [...$('budgetMode').options].some(o => o.value === v));
  pick($('radius'), f.r, v => [...$('radius').options].some(o => o.value === String(v))); pick($('maxcenter'), f.mc, v => [...$('maxcenter').options].some(o => o.value === String(v)));
  pick($('kids'), Math.max(0, Math.min(10, +f.k || 0)), () => true); pick($('babys'), Math.max(0, Math.min(5, +f.y || 0)), () => true);
  $('beds').checked = !!f.bd;
}
applyForm(store.get('sm_form', null));

const wd = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
function updateDates(msg) {
  const a = new Date($('checkin').value), b = new Date($('checkout').value);
  $('dateInfo').className = 'hint' + (msg ? ' warn' : '');
  $('dateInfo').textContent = msg || (isNaN(a) || isNaN(b) ? '' : `${wd.format(a)} → ${wd.format(b)}`);
}
function syncMin(fixed) {
  const c = new Date($('checkin').value);
  if (isNaN(c)) return;
  $('checkout').min = ymd(new Date(c.getTime() + 864e5));
  let msg = '';
  if ($('checkout').value <= $('checkin').value) { $('checkout').value = ymd(new Date(c.getTime() + 864e5)); msg = 'Die Abreise lag nicht nach der Anreise. Wir haben den Folgetag eingesetzt.'; }
  updateDates(fixed ? msg : '');
}
$('checkin').addEventListener('change', () => syncMin(true));
$('checkout').addEventListener('change', () => syncMin(true));
syncMin(false);

function renderPeople() {
  $('people').innerHTML = '';
  people.forEach((p, i) => {
    const box = document.createElement('div');
    box.className = 'pbox';
    const row = document.createElement('div');
    row.className = 'person';
    row.innerHTML = `<input value="${escapeHtml(p.name)}" maxlength="40" autocomplete="off" aria-label="Name Person ${i + 1}">
      <select aria-label="Typ von ${escapeHtml(p.name)}">${Object.entries(SM.PRESETS).map(([k, v]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <button type="button" class="tunebtn" aria-expanded="${openTune.has(p)}" aria-label="Wünsche von ${escapeHtml(p.name)} feinjustieren" title="Wünsche feinjustieren">⚙️</button>
      <button type="button" title="Entfernen" aria-label="${escapeHtml(p.name)} entfernen">✕</button>`;
    row.children[0].oninput = e => { p.name = e.target.value; save(); };
    // Enter im Namensfeld: neue Person darunter, Fokus dorthin
    row.children[0].onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addPerson(); } };
    row.children[1].onchange = e => { p.type = e.target.value; if (p.type2 === p.type) delete p.type2; delete p.custom; save(); renderPeople(); };
    row.children[2].onclick = () => { openTune.has(p) ? openTune.delete(p) : openTune.add(p); renderPeople(); };
    row.children[3].onclick = () => { offerUndo(`${p.name} entfernt.`); people.splice(i, 1); save(); renderPeople(); };
    box.appendChild(row);
    if (openTune.has(p)) box.appendChild(tunePanel(p, i));
    $('people').appendChild(box);
  });
  updateBudget();
}
// Schieberegler pro Person (-10..+10 je Kategorie) und „auf keinen Fall“ (Veto)
function tunePanel(p, n) {
  const w = SM.weightsOf(p);
  const el = document.createElement('div');
  el.className = 'tune';
  el.innerHTML = `<p class="muted">Was ist ${escapeHtml(p.name)} wichtig? Rechts = wichtig, links = stört. „Nie“ schließt Viertel mit viel davon ganz aus.${p.custom ? ' <b>Eigene Werte.</b> <button type="button" class="link" data-reset>Auf Typ zurücksetzen</button>' : ''}</p>
    <div class="trow" style="grid-template-columns:86px 1fr"><label for="mix-${n}">Mischtyp</label>
    <select id="mix-${n}" data-mix><option value="">kein zweiter Typ</option>${Object.entries(SM.PRESETS).filter(([k]) => k !== p.type).map(([k, v]) => `<option value="${k}" ${k === p.type2 ? 'selected' : ''}>halb ${v.label}</option>`).join('')}</select></div>` +
    Object.entries(SM.CATEGORIES).map(([k, c]) => `<div class="trow">
      <label for="t-${k}-${n}">${c.label}</label>
      <input type="range" id="t-${k}-${n}" data-k="${k}" min="-10" max="10" step="1" value="${Math.round(w[k] * 10)}" aria-valuetext="${Math.round(w[k] * 10)} von 10">
      <output>${Math.round(w[k] * 10)}</output>
      <label class="veto"><input type="checkbox" data-veto="${k}" ${(p.veto || []).includes(k) ? 'checked' : ''}> Nie</label>
    </div>`).join('');
  el.querySelector('[data-mix]').onchange = e => { e.target.value ? p.type2 = e.target.value : delete p.type2; delete p.custom; save(); renderPeople(); };
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
  const v = Math.max(0, +$('budget').value || 0), m = $('budgetMode').value, g = people.length;
  const total = m === 'pp' ? v * g : m === 'night' ? v * n : v;
  return { n, total, perNight: n ? total / n : 0, perPerson: g ? total / g : 0, perPersonNight: n && g ? total / n / g : 0 };
}
function updateBudget() {
  const b = budgetNums(), kids = Math.max(0, +$('kids').value || 0), babys = Math.max(0, +$('babys').value || 0);
  const warn = !b.n ? '' : b.total === 0 ? 'Budget 0: In der Airbnb-Suche wird dann kein Preisfilter gesetzt.'
    : b.perPersonNight < 25 ? '⚠ Unter 25 € pro Person und Nacht wird es in den meisten Städten knapp.' : '';
  $('budgetInfo').innerHTML = (b.n
    ? `${b.n} Nächte · ${Math.round(b.perNight)} € pro Nacht · ${Math.round(b.perPerson)} € pro Person · ${Math.round(b.perPersonNight)} € pro Person und Nacht`
    : 'Zeitraum wählen') + (warn ? `<div class="warn">${warn}</div>` : '') + '<div>Das Budget filtert nur die Airbnb-Suche, die Viertel-Wertung ändert es nicht.</div>';
  $('bedsLabel').textContent = `Mindestens ${Math.max(1, Math.ceil(people.length / 2))} Schlafzimmer in die Airbnb-Suche übernehmen` + (kids + babys ? ` (${kids + babys} Kind${kids + babys > 1 ? 'er' : ''} zählen als Gäste auf Airbnb mit)` : '');
}
// Nur Links und Kopfzeile neu setzen, wenn sich Budget/Zeitraum/Gäste ändern (die Wertung bleibt gleich)
function refreshLinks() {
  updateBudget(); saveForm(); updateDates();
  if (lastView) { saveTrip(lastData.geo, lastView.byTotal, lastView.ppl); renderResults(); renderHead(); }
}
['checkin', 'checkout', 'budget', 'kids', 'babys'].forEach(id => $(id).addEventListener('input', refreshLinks));
['budgetMode', 'beds'].forEach(id => $(id).addEventListener('change', refreshLinks));
$('radius').addEventListener('change', () => { saveForm(); rescore(); });
$('maxcenter').addEventListener('change', () => { saveForm(); shown = 8; rescore(); });
function updateFair() { const f = Math.round(fairness * 100); $('fairOut').textContent = `${f} % unzufriedenste Person · ${100 - f} % Schnitt`; $('fair').value = f; }
$('fair').addEventListener('input', () => { fairness = SM.cleanFairness(+$('fair').value / 100); updateFair(); store.set('sm_fair', fairness); rescore(); });
updateFair();
function addPerson() {
  people.push({ name: `Person ${people.length + 1}`, type: 'chill' });
  if (people.length > 16) $('shareMsg').textContent = 'Mehr als 16 Gäste: Airbnb erlaubt meist nur 16 pro Unterkunft. Sucht dann zwei Unterkünfte nebeneinander.';
  save(); renderPeople();
  const inputs = $('people').querySelectorAll('.person input'); const last = inputs[inputs.length - 1];
  if (last) { last.focus(); last.select(); }
}
$('addPerson').onclick = addPerson;
$('example').onclick = () => {
  offerUndo('Beispielgruppe geladen.');
  people = [{ name: 'Party 1', type: 'party' }, { name: 'Party 2', type: 'party' }, { name: 'Chill 1', type: 'chill' }, { name: 'Chill 2', type: 'chill' }, { name: 'Sights', type: 'sights' }];
  save(); renderPeople();
};
$('pasteGo').onclick = () => {
  const list = SM.parseGroup($('paste').value).map(SM.cleanPerson).filter(Boolean);
  if (!list.length) return;
  offerUndo(`${list.length} Personen aus dem Text übernommen.`); people = list; $('paste').value = ''; save(); renderPeople();
};
// ---- Gespeicherte Gruppen ----
function renderTpl() {
  const l = store.get('sm_groups', []);
  $('tpl').innerHTML = '<option value="">Gruppe wählen …</option>' + l.map((g, i) => `<option value="${i}">${escapeHtml(g.name)} (${g.people.length})</option>`).join('');
}
$('tpl').onchange = () => {
  const g = store.get('sm_groups', [])[+$('tpl').value];
  if (!g) return;
  const list = (g.people || []).map(SM.cleanPerson).filter(Boolean);
  if (!list.length) return;
  offerUndo(`Gruppe „${g.name}“ geladen.`); people = list; save(); renderPeople();
};
$('tplSave').onclick = () => {
  const name = (prompt('Name der Gruppe?', people.slice(0, 3).map(p => p.name).join(', ')) || '').trim().slice(0, 40);
  if (!name) return;
  store.set('sm_groups', [...store.get('sm_groups', []), { name, people: clone(people) }].slice(-8)); renderTpl();
};
$('tplDel').onclick = () => {
  const i = +$('tpl').value; const l = store.get('sm_groups', []);
  if ($('tpl').value === '' || !l[i]) return;
  l.splice(i, 1); store.set('sm_groups', l); renderTpl();
};
renderTpl();
// Kurzbeschreibung der Typen (aus den Gewichten erzeugt, damit sie nie von der Wertung abweicht)
$('typeInfo').innerHTML = '<ul>' + Object.values(SM.PRESETS).map(v => {
  const pos = Object.entries(v.w).filter(([, x]) => x >= 0.5).map(([k]) => SM.CATEGORIES[k].label), neg = Object.entries(v.w).filter(([, x]) => x <= -0.3).map(([k]) => SM.CATEGORIES[k].label);
  return `<li><b>${v.label}</b>: wichtig ${pos.join(', ')}${neg.length ? `; stört ${neg.join(', ')}` : ''}</li>`;
}).join('') + '</ul><p>Mit ⚙️ an jeder Person stellst du alles einzeln ein oder mischst zwei Typen.</p>';
// Schnellwahl beliebter Ziele
$('cityChips').innerHTML = CITIES.map(c => `<button type="button">${c}</button>`).join('');
$('cityChips').onclick = e => { const b = e.target.closest('button'); if (b) { $('city').value = b.textContent; saveForm(); run(); } };

async function geocode(city, signal) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(city)}`, { headers: { 'Accept-Language': 'de' }, signal });
  if (!r.ok) throw new Error(`Ortssuche gerade nicht erreichbar (${r.status}) – bitte gleich nochmal versuchen.`);
  const choices = SM.placeChoices(await r.json());
  if (!choices.length) throw new Error('Stadt nicht gefunden');
  return choices;
}
// Zentrum und Suchfläche: Logik und Mindestgröße stehen in shared/core.js
const geoFrom = res => C.geoFromNominatim(res);

// CSV statt JSON: ca. 6x kleiner. Abfrage und Spalten kommen aus dem gemeinsamen Kern (gleich wie beim Vorladen der Städte).
async function overpass(bbox, outer) {
  const FIELDS = C.FIELDS, q = C.overpassQuery(bbox);
  // Fair zu den freiwilligen Servern: erst einer, der nächste erst nach 20 s ohne Antwort oder bei Fehler.
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), 110000);
  if (outer) outer.addEventListener('abort', () => ctrl.abort(), { once: true });
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
    if (outer && outer.aborted) throw new DOMException('Abgebrochen', 'AbortError');
    const codes = (e.errors || []).map(x => String(x.message).split(': ').pop());
    const busy = codes.some(c => c === '429' || c === '504' || c === '503');
    throw new Error(busy
      ? 'Die kostenlosen OpenStreetMap-Server sind gerade überlastet (Fehler 429/504). Das passiert zu Stoßzeiten. Meist klappt es nach 1–2 Minuten.'
      : 'Die OpenStreetMap-Server haben nicht rechtzeitig geantwortet (Zeitüberschreitung nach ca. 2 Minuten). Bitte nochmal versuchen. Große Städte brauchen länger.');
  }
}

// Vorab geladene Städte (scripts/prefetch-cities.mjs → web/data/). Der Index wird nur einmal geladen.
const normCity = C.normCity;
let indexPromise = null;
async function prefetched(city) {
  try {
    indexPromise = indexPromise || fetch('data/index.json').then(r => r.json()).catch(() => ({}));
    const file = (await indexPromise)[normCity(city)];
    if (!file) return null;
    const d = await (await fetch('data/' + file)).json();
    const rows = d.rows.map(v => Object.fromEntries(d.fields.map((f, i) => [f, v[i]]).filter(([, x]) => x !== '' && x != null)));
    const [s, w, n, e] = d.bbox;
    return { geo: { name: d.city, bbox: d.bbox, lat: (s + n) / 2, lon: (w + e) / 2 }, rows, at: d.t };
  } catch { return null; }
}

// Ergebnis pro Stadt einen Tag lang im Browser merken (spart die langsame Abfrage)
const CACHE = 'sm_osm3_'; // Version 3: neue Spalten (Einkaufen, Sport, Kinder)
function cacheGet(k) { try { const c = JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k)); return c && Date.now() - c.t < 864e5 ? c : null; } catch { return null; } }
function cacheSet(k, rows) {
  const v = JSON.stringify({ t: Date.now(), rows });
  for (let i = 0; i < 4; i++) {
    try { localStorage.setItem(k, v); return; } catch {
      // älteste Stadt löschen (sm_trip bleibt), dann erneut versuchen
      let oldest = null, ot = Infinity;
      try { for (const key of Object.keys(localStorage)) if (key.startsWith(CACHE)) { const t = JSON.parse(localStorage.getItem(key)).t; if (t < ot) { ot = t; oldest = key; } } } catch {}
      if (!oldest) break;
      localStorage.removeItem(oldest);
    }
  }
  try { sessionStorage.setItem(k, v); } catch {}
}

// alte Cache-Versionen entfernen
try { Object.keys(localStorage).filter(k => k.startsWith('sm_osm_') || k.startsWith('sm_osm2_')).forEach(k => localStorage.removeItem(k)); } catch {}

let map, layer, poiLayer, bboxLayer, circles = [], cmp = [], lastData = null, lastView = null; // lastData: geladene Viertel + Orte → Neuberechnung ohne Netz
function radius() {
  const v = $('radius').value;
  if (v === 'auto') return lastData && lastData.pois.filter(p => p.cat === 'transit').length >= 60 ? 1200 : 800;
  return +v || 800;
}

let runCtrl = null, tick = null;
function setBusy(on, msg) {
  $('go').disabled = on; $('cancel').hidden = !on; clearInterval(tick);
  $('results').setAttribute('aria-busy', String(on)); $('results').classList.toggle('dim', on && !!$('results').innerHTML);
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
  saveForm();
  runCtrl = new AbortController();
  const signal = runCtrl.signal;
  setBusy(true, 'Schritt 1 von 3: Suche Stadt');
  // Alte Ergebnisse bleiben stehen, bis neue da sind (bei einem Fehler gehen sie nicht verloren)
  try {
    // 1) vorab geladene Stadt (sofort, ohne Anfrage an OpenStreetMap-Server)
    let geo, rows = null, at = Date.now();
    const pre = pick ? null : await prefetched(city);
    if (pre) { geo = pre.geo; rows = pre.rows; at = pre.at || at; }
    // 2) sonst: Ort suchen (bei mehreren gleich wichtigen Treffern nachfragen) und Daten holen (Tageszwischenspeicher im Browser)
    if (!rows) {
      let res = pick;
      if (!res) {
        const choices = await geocode(city, signal);
        if (choices.length > 1) { showChoices(choices); return; }
        res = choices[0];
      }
      geo = geoFrom(res);
      previewMap(geo); // Karte zeigt schon die Stadt, während die Orte laden
      const cacheKey = CACHE + geo.bbox.map(x => x.toFixed(3)).join(',');
      const hit = cacheGet(cacheKey);
      rows = hit && hit.rows; if (hit) at = hit.t;
      setBusy.set(rows ? `Schritt 2 von 3: Nutze gespeicherte Daten für ${geo.name}` : `Schritt 2 von 3: Lade Orte in ${geo.name} aus OpenStreetMap, kann bis zu 2 Minuten dauern`);
      if (!rows) { rows = await overpass(geo.bbox, signal); cacheSet(cacheKey, rows); at = Date.now(); }
    }

    setBusy.set('Schritt 3 von 3: Bewerte Viertel');
    const areas = [], raw = [];
    for (const t of rows) {
      const lat = +t.lat, lon = +t.lon;
      if (!lat) continue;
      if (t.place && t.name) { if (!areas.some(a => a.name === t.name && SM.distM(a, { lat, lon }) < 1500)) areas.push({ name: t.name, lat, lon }); continue; }
      for (const cat of SM.categoriesOf(t)) raw.push({ lat, lon, cat, name: t.name, tags: t });
    }
    if (areas.length < 2) throw new Error('Keine Viertel in OpenStreetMap gefunden – andere Stadt versuchen.');
    const pois = SM.dedupePois(raw); // dieselben Orte als Punkt und Gebäude, Bahnhofseingänge: nur einmal zählen
    lastData = { areas, pois, geo, q: normCity(city), at };
    cmp = []; lastView = null; shown = 8; renderMap.key = null;
    $('stale').hidden = true;
    compute();
    // Auf dem Handy liegt das Ergebnis unter dem Formular: Formular einklappen und dorthin scrollen
    if (matchMedia('(max-width:900px)').matches && lastView) {
      $('formBody').classList.add('collapsed'); $('formToggle').classList.add('on'); $('formToggle').setAttribute('aria-expanded', 'false');
      $('status').scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
    }
  } catch (e) {
    if (e.name === 'AbortError' || signal.aborted) $('status').textContent = 'Suche abgebrochen. Du kannst es jederzeit nochmal starten.';
    else if (!navigator.onLine) showError('Du bist offline. Internet prüfen und nochmal versuchen.');
    else showError(/fetch|network|load failed/i.test(e.message) ? 'Keine Verbindung zum Kartendienst. Internet prüfen und nochmal versuchen.' : e.message, !/nicht gefunden|Keine Viertel/.test(e.message));
  } finally { setBusy(false); runCtrl = null; }
}
$('formToggle').onclick = () => {
  const c = $('formBody').classList.toggle('collapsed');
  $('formToggle').setAttribute('aria-expanded', String(!c)); $('formToggle').textContent = c ? 'Gruppe und Einstellungen ändern' : 'Einstellungen einklappen';
};
// Mehrdeutiger Ortsname („Paris“): Person wählt
function showChoices(choices) {
  $('status').textContent = 'Mehrere Orte gefunden. Welcher ist gemeint?';
  const box = $('choices'); box.hidden = false;
  box.innerHTML = choices.map((c, i) => `<button type="button" data-i="${i}">${escapeHtml(c.display_name.split(',').map(x => x.trim()).filter((_, j, a) => j === 0 || j >= a.length - 2).join(', '))}</button>`).join('');
  box.onclick = e => { const b = e.target.closest('button'); if (b) { box.hidden = true; run(choices[+b.dataset.i]); } };
  box.querySelector('button').focus();
}
$('retry').onclick = () => run();

// Wertung neu rechnen, wenn Gruppe, Umkreis, Fairness oder Sortierung sich ändern (kein neuer Abruf nötig)
const areaKey = a => `${a.name}@${a.lat.toFixed(4)}`;
const favStore = () => store.get('sm_fav', {});
const favSet = () => new Set((favStore()[lastData && lastData.q] || []));
function clearResults(msg) {
  $('results').innerHTML = ''; $('compare').innerHTML = ''; $('whatif').innerHTML = ''; $('reshead').hidden = true; $('more').hidden = true;
  lastView = null; if (msg) $('status').textContent = msg;
}
function compute() {
  if (!lastData) return;
  const { areas, pois, geo } = lastData;
  if (!people.length) { clearResults('Mindestens eine Person nötig. Füge links jemanden hinzu.'); return; }
  const r = radius();
  SM.scoreAreas(areas, pois, r);
  SM.annotateCentre(areas, geo);
  const ppl = people.map(p => ({ ...p, w: SM.weightsOf(p) }));
  for (const a of areas) { a.group = SM.groupScore(a.norm, ppl, fairness); a.vetoes = SM.vetoes(a.norm, ppl); }
  // Viertel ohne nennenswerte Infrastruktur ausblenden, auch ohne die Orte, die die Gruppe sucht. Viertel mit Veto und zu weit vom Zentrum ebenso.
  const relevant = Object.keys(SM.CATEGORIES).filter(k => k !== 'transit' && k !== 'food' && ppl.some(p => p.w[k] >= 0.5));
  const maxC = (+$('maxcenter').value || 0) * 1000;
  const withData = areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10
    && (!relevant.length || relevant.reduce((x, k) => x + a.counts[k], 0) >= 2) && (!maxC || a.centerDist <= maxC));
  const okAreas = withData.filter(a => !a.vetoes.length);
  const vetoed = withData.length - okAreas.length;
  const vetoNote = vetoed ? ` ${vetoed} Viertel ausgeschlossen (${[...new Set(withData.flatMap(a => a.vetoes.map(v => `${v.name}: nie ${v.label}`)))].slice(0, 3).join(', ')}).` : '';
  const byTotal = SM.sortAreas(okAreas, 'fair');
  if (/^p:(\d+)$/.test(sortMode) && +sortMode.slice(2) >= ppl.length) sortMode = 'fair';
  const sorted = SM.sortAreas(okAreas, sortMode);
  const favs = favSet(), onlyFav = $('onlyFav').checked;
  const pool = onlyFav ? sorted.filter(a => favs.has(areaKey(a))) : sorted;
  const minDist = Math.max(1200, r * 1.5);
  const ranked = SM.pickDiverse(pool, shown, minDist);
  // Platzwechsel gegenüber der letzten Rechnung (nur bei gleichen Daten)
  const prev = lastView && lastView.data === lastData && lastView.sortMode === sortMode ? new Map(lastView.ranked.map((a, i) => [areaKey(a), i])) : null;
  ranked.forEach((a, i) => { a.delta = prev && prev.has(areaKey(a)) ? prev.get(areaKey(a)) - i : null; });
  lastView = { data: lastData, sortMode, ranked, pool, okAreas, byTotal, ppl, r, pois, geo, minDist, stats: SM.cityStats(okAreas), medCentre: SM.median(okAreas.map(a => a.centerDist)),
    awards: SM.awards(ranked, ppl), relevant };
  if (!ranked.length) {
    $('results').innerHTML = ''; $('compare').innerHTML = ''; $('whatif').innerHTML = ''; $('more').hidden = true; $('reshead').hidden = false; renderHead();
    $('status').textContent = onlyFav ? 'Noch keine Favoriten. Markiere Viertel mit dem Herz.'
      : vetoed ? `Alle Viertel sind durch ein Veto ausgeschlossen.${vetoNote} Nimm ein „Nie“ heraus.`
      : 'Keine passenden Viertel mit genug Orten gefunden. Versuche eine größere Stadt, einen größeren Umkreis, weniger strenge Entfernung zum Zentrum oder einen anderen Ortsnamen.';
    return;
  }
  $('status').textContent = `${okAreas.length} Viertel und ${pois.length} Orte ausgewertet.${vetoNote} Die besten für eure Gruppe:`;
  $('intro').hidden = true;
  if (/Chrome\//.test(navigator.userAgent) && !/Edg|OPR|Mobile|Android/.test(navigator.userAgent)) $('extHint').hidden = false;
  saveTrip(geo, byTotal, ppl);
  renderHead();
  renderWhatIf(byTotal, ppl);
  renderResults();
  $('more').hidden = !(ranked.length >= shown && pool.length > ranked.length);
  renderCompare();
  renderMap(ranked, geo, r, pois);
}
let rescoreTimer = null;
const rescore = () => { clearTimeout(rescoreTimer); rescoreTimer = setTimeout(() => { try { compute(); } catch (e) { console.debug(e); } }, 250); };
$('more').onclick = () => { shown += 8; compute(); };
$('onlyFav').addEventListener('change', () => { shown = 8; compute(); });

// Kopfzeile: was wurde berechnet, Sortierung, Datenstand
function renderHead() {
  const b = budgetNums(), kids = +$('kids').value || 0, babys = +$('babys').value || 0, g = people.length;
  const at = lastData && lastData.at ? new Date(lastData.at) : null;
  const stamp = at ? (at.toDateString() === new Date().toDateString() ? 'heute geladen' : `Stand ${at.toLocaleDateString('de-DE')}`) : '';
  $('resSummary').textContent = `Für ${g} ${g === 1 ? 'Person' : 'Personen'}${kids + babys ? ` + ${kids + babys} Kind${kids + babys > 1 ? 'er' : ''}` : ''}, ${b.n || '?'} Nächte${b.perNight ? `, ${Math.round(b.perNight)} € pro Nacht` : ''}. OpenStreetMap-Daten, ${stamp}.`;
  const opts = [['fair', 'Fairste Wahl (Standard)'], ['avg', 'Höchster Schnitt'], ...people.map((p, i) => [`p:${i}`, `Beste für ${p.name}`]), ['transit', 'Nächste Bahn'], ['center', 'Nah am Zentrum'], ['cheap', 'Günstigere Lage (Schätzung)']];
  const sel = $('sort');
  if (sel.dataset.sig !== JSON.stringify(opts)) { sel.innerHTML = opts.map(([v, l]) => `<option value="${v}">${escapeHtml(l)}</option>`).join(''); sel.dataset.sig = JSON.stringify(opts); }
  sel.value = sortMode;
  $('favCount').textContent = String(favSet().size);
  $('reshead').hidden = false;
}
$('sort').addEventListener('change', () => { sortMode = $('sort').value; shown = 8; compute(); });

// „Ohne Tom wäre …“: zeigt, wo der Kompromiss steckt
function renderWhatIf(byTotal, ppl) {
  const el = $('whatif');
  if (ppl.length < 3 || !byTotal.length) { el.innerHTML = ''; return; }
  const list = SM.whatIfWithout(byTotal.slice(0, 250), ppl, fairness, byTotal[0].name).slice(0, 3);
  el.innerHTML = list.length ? '💡 ' + list.map(x => `Ohne <b>${escapeHtml(x.name)}</b> wäre <b>${escapeHtml(x.area)}</b> Platz 1.`).join(' ') : '💡 Das beste Viertel ändert sich nicht, wenn eine einzelne Person fehlt. Die Wahl ist stabil.';
}

function renderResults() {
  if (!lastView) return;
  const { ranked, pois, ppl, geo, r, pool, stats, medCentre, awards, minDist, relevant } = lastView;
  const b = budgetNums(), best = lastView.byTotal[0] ? lastView.byTotal[0].group.total : 0, favs = favSet();
  const kids = Math.max(0, +$('kids').value || 0), babys = Math.max(0, +$('babys').value || 0);
  const usedCats = Object.keys(SM.CATEGORIES).filter(k => ppl.some(p => p.w[k]));
  const hlCats = relevant.length ? relevant : usedCats.filter(k => k !== 'transit' && k !== 'food');
  $('results').innerHTML = ranked.map((a, i) => {
    const near = pois.filter(p => p.name && hlCats.includes(p.cat) && SM.distM(a, p) < r)
      .sort((x, y) => (y.tags.wikidata ? 1 : 0) - (x.tags.wikidata ? 1 : 0) || SM.distM(a, x) - SM.distM(a, y));
    const seen = new Set(), hl = [];
    for (const p of near) { if (seen.has(p.name)) continue; seen.add(p.name); hl.push(p); if (hl.length >= 5) break; }
    const url = SM.airbnbUrl({ lat: a.lat, lon: a.lon, name: a.name, city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value, adults: ppl.length,
      children: kids, infants: babys, minBedrooms: $('beds').checked ? Math.max(1, Math.ceil(ppl.length / 2)) : 0, priceMaxNight: b.perNight, radius: r });
    // Chips nicht nur über Farbe: Symbol dazu. Anklicken zeigt, woraus der Wert besteht.
    const chips = ppl.map((p, j) => {
      const s = a.group.scores[j];
      return `<button type="button" class="chip btn2 ${s < 40 ? 'low' : s >= 70 ? 'high' : ''}" data-i="${i}" data-p="${j}" aria-expanded="false" aria-controls="bd-${i}">${s < 40 ? '⚠ ' : s >= 70 ? '✓ ' : ''}${escapeHtml(p.name)}: ${s}</button>`;
    }).join('');
    const c = a.counts;
    // Alle Personen unter 60 erklären, nicht nur die schwächste
    const whys = ppl.map((p, j) => ({ p, s: a.group.scores[j] })).filter(x => x.s < 60).sort((x, y) => x.s - y.s).slice(0, 3).map(({ p, s }) => {
      const weak = SM.weakness(a.norm, a.counts, p.w);
      return weak ? `<div class="muted">⚠️ ${escapeHtml(p.name)} (${s}) ${weak.kind === 'missing' ? `vermisst hier: ${weak.label} (nur ${weak.count} im Umkreis)` : `stört: viel ${weak.label} (${weak.count} im Umkreis)`}</div>` : '';
    }).join('');
    const thin = SM.thinData(c) ? `<div class="muted">ℹ️ Wenig Daten in OpenStreetMap für dieses Viertel (${Object.values(c).reduce((x, y) => x + y, 0)} Orte im Umkreis). Die Wertung ist hier unsicher.</div>` : '';
    const k = areaKey(a), isFav = favs.has(k);
    const tip = SM.isSecretTip(a, best, medCentre);
    const badges = [...awards[i].map(t => `<span class="badge">${escapeHtml(t)}</span>`), tip ? '<span class="badge tip" title="Fast so gut wie die Spitze, aber ruhiger und weiter vom Zentrum">Geheimtipp</span>' : ''].join('');
    const delta = a.delta ? `<span class="delta ${a.delta > 0 ? 'up' : 'down'}" title="Platzwechsel gegenüber vorher">${a.delta > 0 ? '▲' : '▼'}${Math.abs(a.delta)}</span>` : '';
    const next = ranked[i + 1];
    const tie = sortMode === 'fair' && next && a.group.total - next.group.total <= 1 ? `<div class="muted">≈ Fast gleichauf mit Platz ${i + 2} (${escapeHtml(next.name)}). Der Unterschied ist kleiner als die Genauigkeit der Daten.</div>` : '';
    const mini = usedCats.map(kk => `<div><span>${LABELS[kk][1]}</span><span class="bar" aria-hidden="true"><i style="width:${Math.round(a.norm[kk] * 100)}%"></i></span></div>`).join('');
    const countsLine = Object.keys(SM.CATEGORIES).filter(kk => CORE_CATS.includes(kk) || usedCats.includes(kk))
      .map(kk => `${LABELS[kk][0]} ${c[kk]} ${LABELS[kk][1]}${stats[kk] ? ` (Ø ${stats[kk]})` : ''}`).join(' · ');
    const tr = a.nearest.transit, km = (a.centerDist / 1000).toFixed(1).replace('.', ',');
    const where = `${tr != null ? `🚇 Bahn ${tr} m` : '🚇 keine Bahn im Umkreis'} · 📍 ${km} km zum Zentrum · <span title="Grobe Schätzung aus Lage und Sehenswürdigkeiten, keine echten Preise">Preislage (Schätzung): ${TIERS[a.tier]}</span>`;
    const neigh = pool.filter(x => x !== a && !ranked.includes(x) && SM.distM(a, x) < minDist).slice(0, 3).map(x => `${escapeHtml(x.name)} (${x.group.total})`);
    const osm = `https://www.openstreetmap.org/?mlat=${a.lat.toFixed(5)}&mlon=${a.lon.toFixed(5)}#map=16/${a.lat.toFixed(5)}/${a.lon.toFixed(5)}`;
    return `<article class="card result" id="area-${i}" data-i="${i}" tabindex="-1" aria-labelledby="areah-${i}">
      <h3 id="areah-${i}"><span class="rank-num">${i + 1}. ${escapeHtml(a.name)} <button type="button" class="fav" data-fav="${escapeHtml(k)}" aria-pressed="${isFav}" aria-label="${escapeHtml(a.name)} als Favorit ${isFav ? 'entfernen' : 'merken'}">${isFav ? '♥' : '♡'}</button>${delta}</span>
        <span><span class="score" aria-label="Gruppenwert ${a.group.total} von 100, ${SM.verdict(a.group.total)}">${a.group.total}</span><span class="verdict">/100 · ${SM.verdict(a.group.total)}</span></span></h3>
      ${badges ? `<div class="badges">${badges}</div>` : ''}
      <div class="bar" aria-hidden="true"><i style="width:${a.group.total}%"></i></div>
      <div>${escapeHtml(SM.summary(a, ppl))}</div>${tie}
      <div class="chips" role="group" aria-label="Zufriedenheit je Person. Anklicken zeigt die Zusammensetzung.">${chips}</div>
      <div class="breakdown" id="bd-${i}" hidden></div>
      ${whys}${thin}
      <div class="mini" aria-label="Wie stark ist jede Kategorie hier">${mini}</div>
      <div class="muted">${countsLine}</div>
      <div class="muted">${where}</div>
      ${hl.length ? `<div class="muted">In der Nähe: ${hl.map(p => `<a class="sub2" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a>`).join(', ')}</div>` : ''}
      ${neigh.length ? `<div class="muted">Gehört zur selben Gegend: ${neigh.join(', ')}</div>` : ''}
      <div class="actions"><a class="btn" href="${url}" target="_blank" rel="noopener">Unterkünfte hier auf Airbnb ansehen →</a>
      <a class="sub2" href="${osm}" target="_blank" rel="noopener">Auf Karte ansehen</a>
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
resultsEl.addEventListener('click', e => {
  const fav = e.target.closest('button[data-fav]');
  if (fav) {
    const all = favStore(), q = lastData.q, set = new Set(all[q] || []);
    set.has(fav.dataset.fav) ? set.delete(fav.dataset.fav) : set.add(fav.dataset.fav);
    all[q] = [...set]; store.set('sm_fav', all);
    if ($('onlyFav').checked) compute(); else { fav.setAttribute('aria-pressed', String(set.has(fav.dataset.fav))); fav.textContent = set.has(fav.dataset.fav) ? '♥' : '♡'; $('favCount').textContent = String(set.size); }
    return;
  }
  const chip = e.target.closest('button.chip[data-p]');
  if (chip && lastView) {
    const i = +chip.dataset.i, j = +chip.dataset.p, box = $('bd-' + i), open = chip.getAttribute('aria-expanded') === 'true';
    box.parentElement.querySelectorAll('button.chip').forEach(x => x.setAttribute('aria-expanded', 'false'));
    if (open) { box.hidden = true; return; }
    chip.setAttribute('aria-expanded', 'true');
    const a = lastView.ranked[i], p = lastView.ppl[j];
    const parts = SM.breakdown(a.norm, p.w);
    box.innerHTML = `<b>${escapeHtml(p.name)}: ${a.group.scores[j]} von 100.</b> ` + (parts.length
      ? parts.map(x => `${x.label} <b class="${x.pts > 0 ? 'pos' : 'neg'}">${x.pts > 0 ? '+' : ''}${x.pts}</b>`).join(' · ') : 'Hier gibt es nichts, was diese Person sucht oder stört.');
    box.hidden = false;
  }
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
    <button type="button" class="link" id="cmpClose">Vergleich schließen</button></div>`;
  $('cmpClose').onclick = () => { cmp = []; resultsEl.querySelectorAll('input[data-k]').forEach(x => { x.checked = false; }); renderCompare(); };
}

const POI_COLORS = { party: '#e0475b', chill: '#2fbf85', sights: '#7c6cf0', food: '#e6a23c', transit: '#4aa3df', shop: '#d36bd0', sport: '#3fb6b2', kids: '#f2c230' };
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

function ensureMap() {
  if (!window.L || map) return !!map;
  map = L.map('map');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  return true;
}
// Ausgewertete Fläche als gestrichelter Rahmen
function drawBBox(geo) {
  if (bboxLayer) bboxLayer.remove();
  const [s, w, n, e] = geo.bbox;
  bboxLayer = L.rectangle([[s, w], [n, e]], { color: '#888', weight: 1, dashArray: '6 6', fill: false, interactive: false }).addTo(map);
}
// Schon während des Ladens die Stadt zeigen (die Orte brauchen bis zu 2 Minuten)
function previewMap(geo) {
  if (!window.L) return;
  $('mapSection').hidden = false;
  if (!ensureMap()) return;
  map.invalidateSize(); drawBBox(geo);
  map.fitBounds([[geo.bbox[0], geo.bbox[1]], [geo.bbox[2], geo.bbox[3]]]);
}

function renderMap(ranked, geo, r = 800, pois = []) {
  if (!window.L) return;
  $('mapSection').hidden = false;
  buildMapBar(lastView ? lastView.ppl : []);
  ensureMap();
  map.invalidateSize();
  drawBBox(geo);
  // Ausschnitt nur ändern, wenn sich die Auswahl ändert (sonst springt die Karte bei jeder Änderung zurück)
  const key = ranked.map(a => a.name).join('|');
  if (key !== renderMap.key) {
    renderMap.key = key;
    let bounds = L.latLngBounds(ranked.map(a => [a.lat, a.lon]));
    // Weit gestreut: auf die Top 3 zoomen
    if (ranked.length > 3 && bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 12000) bounds = L.latLngBounds(ranked.slice(0, 3).map(a => [a.lat, a.lon]));
    map.fitBounds(bounds.pad(0.3));
  }
  if (layer) layer.remove();
  if (poiLayer) poiLayer.remove();
  const who = $('mapWho').value, pi = who === 'g' ? -1 : +who;
  const score = a => pi < 0 ? a.group.total : a.group.scores[pi];
  const color = (a, i) => pi < 0 ? (i === 0 ? '#e0475b' : '#888') : (score(a) >= 70 ? '#2fbf85' : score(a) < 40 ? '#e6a23c' : '#888');
  const goto = i => { const el = $('area-' + i); if (el) { el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }); } };
  const mark = (i, on) => { const el = $('area-' + i); if (el) el.classList.toggle('hl', on); };
  // Kreis = Wertungsradius (gleich wie in der Wertung und im Airbnb-Ausschnitt)
  circles = ranked.map((a, i) => {
    const c = L.circle([a.lat, a.lon], { radius: r, color: color(a, i), weight: 2, fillOpacity: 0.12 })
      .bindTooltip(`${i + 1}. ${a.name} (${pi < 0 ? '' : lastView.ppl[pi].name + ': '}${score(a)})`);
    c.on('click', () => goto(i)); c.on('mouseover', () => mark(i, true)); c.on('mouseout', () => mark(i, false));
    return c;
  });
  const pins = ranked.map((a, i) => {
    const m = L.marker([a.lat, a.lon], { icon: L.divIcon({ className: '', html: `<div class="numpin ${i ? 'n' : ''}">${i + 1}</div>`, iconSize: [24, 24] }), keyboard: false })
      .bindTooltip(`${i + 1}. ${a.name} (${score(a)})`);
    m.on('click', () => goto(i)); return m;
  });
  // Weitere bewertete Viertel als kleine Punkte (grün gut, rot schwach)
  const others = (lastView ? lastView.okAreas : []).filter(a => !ranked.includes(a)).slice(0, 150).map(a =>
    L.circleMarker([a.lat, a.lon], { radius: 5, weight: 1, color: `hsl(${Math.round(Math.max(0, Math.min(100, score(a))) * 1.2)},65%,45%)`, fillOpacity: 0.7 }).bindTooltip(`${a.name} (${score(a)})`));
  // Suchausschnitt der Airbnb-Suche für Platz 1
  const a0 = ranked[0], dLat = r / 111320, dLon = r / (111320 * Math.cos(a0.lat * Math.PI / 180));
  const box = L.rectangle([[a0.lat - dLat, a0.lon - dLon], [a0.lat + dLat, a0.lon + dLon]], { color: '#e0475b', weight: 1, dashArray: '4 4', fill: false, interactive: false }).bindTooltip('Airbnb-Suchausschnitt für Platz 1');
  layer = L.layerGroup([...others, ...circles, box, ...pins]).addTo(map);
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

$('f').addEventListener('submit', e => { e.preventDefault(); run(); });

// ---- Reise per Link teilen (alles steht im Teil nach #, wird nie an einen Server geschickt) ----
const b64 = {
  enc: o => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))),
};
function shareState() {
  const f = formState();
  return { c: f.c, i: f.i, o: f.o, b: f.b, bm: f.bm, r: f.r, mc: f.mc, k: f.k, y: f.y, bd: f.bd, f: Math.round(fairness * 100),
    p: people.map(p => [p.name, p.type, p.custom ? Object.keys(SM.CATEGORIES).map(k => Math.round(p.custom[k] * 10)) : 0, p.veto || 0, p.type2 || 0]) };
}
function applyShared(h) {
  try {
    const s = b64.dec(h);
    const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
    const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    if (!Array.isArray(s.p) || !s.p.length || s.p.length > 30) return false;
    const keys = Object.keys(SM.CATEGORIES);
    people = s.p.filter(Array.isArray).map(([n, t, c, v, t2]) => SM.cleanPerson({
      name: str(n, 40) || 'Person', type: t, type2: t2 || undefined,
      custom: Array.isArray(c) ? Object.fromEntries(keys.map((k, i) => [k, (+c[i] || 0) / 10])) : undefined,
      veto: v || undefined,
    })).filter(Boolean);
    if (!people.length) return false;
    if (s.f != null) { fairness = SM.cleanFairness(+s.f / 100); store.set('sm_fair', fairness); updateFair(); }
    applyForm({ c: str(s.c, 80), i: day(s.i), o: day(s.o), b: Math.max(0, Math.min(1e6, +s.b || 0)), bm: s.bm, r: s.r, mc: s.mc, k: s.k, y: s.y, bd: s.bd });
    syncMin(false);
    save(); renderPeople(); updateBudget(); saveForm();
    return true;
  } catch { return false; }
}
$('share').onclick = async () => {
  const url = location.origin + location.pathname + '#t=' + b64.enc(shareState());
  try { await navigator.clipboard.writeText(url); $('shareMsg').textContent = '✅ Link kopiert. Schick ihn in den Gruppenchat.'; }
  catch { $('shareMsg').textContent = 'Kopieren nicht möglich. Kopiere den Link aus der Adresszeile.'; }
  history.replaceState(null, '', url);
};
// Stadt im Feld geändert, Ergebnisse gehören aber zur alten Stadt
$('city').addEventListener('input', () => {
  $('choices').hidden = true; saveForm();
  const stale = lastData && normCity($('city').value) !== lastData.q;
  $('stale').hidden = !stale;
  if (stale) $('stale').textContent = `Die Ergebnisse unten gehören zu „${lastData.geo.name}“. Mit „Beste Viertel finden“ suchst du die neue Stadt.`;
});
if (location.hash.startsWith('#t=')) {
  if (applyShared(location.hash.slice(3))) {
    $('status').textContent = 'Reise aus dem Link geladen. Die Suche startet gleich, du kannst dich danach selbst eintragen.';
    if ($('city').value.trim()) setTimeout(() => run(), 0);
  } else { $('status').textContent = 'Der Link ist beschädigt oder zu alt.'; }
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
// Hinweis, ob das Plugin installiert ist (setzt bridge.js)
setTimeout(() => {
  if (document.documentElement.dataset.staymatchExtension) { $('extHint').hidden = false; $('extHint').textContent = '✅ Plugin verbunden: Auf der Airbnb-Seite siehst du direkt die Top 3 für euch.'; }
}, 800);
renderPeople();
