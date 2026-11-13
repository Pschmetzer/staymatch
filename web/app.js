const SM = window.StayMatch, C = window.StayMatchCore;
// Unerwarteter Fehler: Hinweis statt toter Seite, mit Weg zum Zurücksetzen der gespeicherten Eingaben
const crash = e => {
  console.error(e); const el = document.getElementById('crash'); if (!el || !el.hidden) return; el.hidden = false;
  el.querySelector('button').onclick = () => { try { Object.keys(localStorage).filter(k => k.startsWith('sm_')).forEach(k => localStorage.removeItem(k)); } catch {} location.reload(); };
};
addEventListener('error', e => crash(e.error || e.message)); addEventListener('unhandledrejection', e => crash(e.reason));
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { if (!store.warned) { store.warned = 1; const m = document.getElementById('shareMsg'); if (m) m.textContent = 'Dein Browser speichert gerade nichts (privater Modus?). Nutze den Teilen-Link, um deine Eingaben zu behalten.'; } } },
};
const clone = o => JSON.parse(JSON.stringify(o));
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const { escapeHtml } = SM;

// Standard: eine Person (du). Mitreisende sind optional.
const arr = (v, n = 30) => Array.isArray(v) ? v.slice(0, n) : []; // gespeicherte Listen nie blind benutzen
let people = arr(store.get('sm_people', null)).map(SM.cleanPerson).filter(Boolean);
if (!people.length) people = [{ name: 'Du', type: 'sights' }];
const solo = () => people.length === 1;
// Wünsche an die Unterkunft (Schlüssel wie extension/rank.js: WISHES und REVIEW_WISHES)
const WISH_KEYS = ['whole', 'luxury', 'private', 'trusted', 'reviews', 'quiet', 'clean', 'wifi'];
const cleanWishes = w => Array.isArray(w) ? WISH_KEYS.filter(k => w.includes(k)) : [];
let wishes = cleanWishes(store.get('sm_wishes', ['whole']));
function renderWishes() {
  document.querySelectorAll('#wishes input[type=checkbox]').forEach(cb => {
    cb.checked = wishes.includes(cb.value);
    cb.onchange = () => { wishes = WISH_KEYS.filter(k => document.querySelector(`#wishes input[value="${k}"]`)?.checked); store.set('sm_wishes', wishes); if (lastView) saveTrip(lastData.geo, lastView.byTotal, lastView.ppl); };
  });
}
let fairness = SM.cleanFairness(store.get('sm_fair', 0.6)); // Gewicht der unzufriedensten Person (Rest: Schnitt)
const openTune = new WeakSet(); // welche Personen haben das Regler-Feld offen
let sortMode = 'fair', shown = 8;

// ---- Rückgängig für Gruppenänderungen (Entfernen, Beispiel, Text, Vorlage) ----
let undoSnap = null, undoTimer = null, undoSticky = false;
// full: auch Wünsche, Fairness und Formular sichern (Teilen-Link); bleibt dann bis zur nächsten eigenen Änderung
function offerUndo(msg, full) {
  undoSnap = { people: clone(people), ...(full && { wishes: [...wishes], fairness, form: formState() }) };
  undoSticky = !!full; $('undoMsg').textContent = msg; $('undo').hidden = false;
  armUndo();
}
// Eigene Eingabe irgendwo im Formular beendet das dauerhafte Rückgängig nach einem Teilen-Link
const endSticky = () => { if (undoSticky) { undoSticky = false; armUndo(); } };
$('f').addEventListener('input', endSticky); $('f').addEventListener('change', endSticky);
const armUndo = () => { clearTimeout(undoTimer); if (!undoSticky) undoTimer = setTimeout(() => { $('undo').hidden = true; }, 15000); };
// Toast bleibt, solange Maus oder Fokus darauf liegen (WCAG 2.2.1)
$('undo').addEventListener('mouseenter', () => clearTimeout(undoTimer)); $('undo').addEventListener('focusin', () => clearTimeout(undoTimer));
$('undo').addEventListener('mouseleave', armUndo); $('undo').addEventListener('focusout', armUndo);
$('undoBtn').onclick = () => {
  if (!undoSnap) return;
  const u = undoSnap; undoSnap = null; undoSticky = false; $('undo').hidden = true;
  people = u.people.map(SM.cleanPerson).filter(Boolean);
  if (u.form) {
    wishes = u.wishes; store.set('sm_wishes', wishes); renderWishes();
    fairness = u.fairness; store.set('sm_fair', fairness); updateFair();
    applyForm(u.form); syncMin(false); saveForm(); updateBudget();
  }
  save(); renderPeople();
};

// Standard-Zeitraum: in 4 Wochen, 4 Nächte
const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const d0 = new Date(Date.now() + 28 * 864e5), d1 = new Date(d0.getTime() + 4 * 864e5);
$('checkin').value = ymd(d0);
$('checkout').value = ymd(d1);
$('checkin').min = ymd(new Date());

// ---- Formular merken (Stadt, Zeitraum, Budget, Umkreis …) ----
// Kinder und Babys überall gleich begrenzen (Formular, Kopfzeile, Airbnb-Link)
const guests = () => ({ k: Math.max(0, Math.min(10, Math.floor(+$('kids').value || 0))), y: Math.max(0, Math.min(5, Math.floor(+$('babys').value || 0))) });
['kids', 'babys'].forEach(id => $(id).addEventListener('change', () => { const g = guests(); $('kids').value = g.k; $('babys').value = g.y; }));
function formState() {
  return { c: $('city').value.trim(), i: $('checkin').value, o: $('checkout').value, b: +$('budget').value || 0, bm: $('budgetMode').value,
    r: $('radius').value, mc: $('maxcenter').value, ...guests(), bd: $('beds').checked, mh: $('mapWrap').hidden };
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
  if (typeof f.mh === 'boolean') setMapHidden(f.mh); // „Karte ausblenden“ merken
}
applyForm(store.get('sm_form', null));

const LANG = document.documentElement.lang || 'de'; // Formate und Ortsnamen in der Sprache der Seite
const wd = new Intl.DateTimeFormat(LANG, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }); // new Date('YYYY-MM-DD') ist UTC
function updateDates(msg) {
  const a = new Date($('checkin').value), b = new Date($('checkout').value);
  $('dateInfo').className = 'hint' + (msg ? ' warn' : '');
  $('dateInfo').textContent = msg || (isNaN(a) || isNaN(b) ? '' : `${wd.format(a)} → ${wd.format(b)}`);
}
let stayN = 1; // zuletzt gültige Aufenthaltsdauer: bleibt erhalten, wenn die Anreise verschoben wird
const addDays = (s, n) => ymd(new Date(new Date(s + 'T12:00:00').getTime() + n * 864e5));
function syncMin(fixed) {
  const c = new Date($('checkin').value);
  if (isNaN(c)) return;
  let msg = '';
  if ($('checkin').value < ymd(new Date())) { // per Tastatur eingetippt: min greift nur im Kalender
    const n = Math.max(1, SM.nights($('checkin').value, $('checkout').value) || stayN);
    $('checkin').value = ymd(new Date()); $('checkout').value = addDays($('checkin').value, n);
    msg = 'Die Anreise lag in der Vergangenheit. Wir haben heute eingesetzt.';
  }
  $('checkout').min = addDays($('checkin').value, 1);
  if ($('checkout').value <= $('checkin').value) { $('checkout').value = addDays($('checkin').value, fixed ? stayN : 1); msg += ` Die Abreise lag nicht nach der Anreise. Wir haben ${fixed && stayN > 1 ? `${stayN} Nächte` : 'den Folgetag'} eingesetzt.`; }
  stayN = Math.max(1, SM.nights($('checkin').value, $('checkout').value) || 1);
  updateDates(fixed ? msg.trim() : '');
}
$('checkin').addEventListener('change', () => syncMin(true));
$('checkout').addEventListener('change', () => syncMin(true));
syncMin(false);

function renderPeople() {
  $('people').innerHTML = '';
  $('peopleLabel').textContent = solo() ? 'Was ist dir in der Gegend wichtig?' : `Wer reist mit? (${people.length} Personen)`;
  $('addPerson').textContent = solo() ? '+ Mitreisende hinzufügen' : '+ Person hinzufügen';
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
    row.children[3].onclick = () => { offerUndo(`${p.name} entfernt.`); removePerson(i); };
    if (solo()) { row.classList.add('solo'); row.children[0].hidden = row.children[3].hidden = true; }
    box.appendChild(row);
    if (openTune.has(p)) box.appendChild(tunePanel(p, i));
    $('people').appendChild(box);
  });
  updateBudget();
}
// Airbnb: höchstens 16 Gäste (Erwachsene + Kinder) pro Unterkunft
function guestWarn() {
  const g = people.length + guests().k;
  $('peopleWarn').textContent = g > 16 ? `${g} Gäste: Airbnb erlaubt meist nur 16 pro Unterkunft. Sucht dann zwei Unterkünfte nebeneinander.` : '';
}
// Indizes hinter der gelöschten Person rücken nach: „Beste für Lena“ und „Karte zeigt: Lena“ bleiben bei Lena
function removePerson(i) {
  const shift = v => v === i ? null : v > i ? v - 1 : v;
  const m = /^p:(\d+)$/.exec(sortMode); if (m) { const k = shift(+m[1]); sortMode = k == null ? 'fair' : `p:${k}`; }
  const mw = $('mapWho'), k = /^\d+$/.test(mw.value) ? shift(+mw.value) : null;
  if (/^\d+$/.test(mw.value)) mw.innerHTML = `<option value="${k == null ? 'g' : k}"></option>`; // buildMapBar übernimmt den Wert
  people.splice(i, 1); save(); renderPeople();
  const xs = $('people').querySelectorAll('.person button[aria-label$="entfernen"]:not([hidden])');
  (xs[Math.min(i, xs.length - 1)] || $('addPerson')).focus();
}
// Schieberegler pro Person (-10..+10 je Kategorie) und „auf keinen Fall“ (Veto)
const vt = v => `${Math.round(v)} von 10: ${v > 0 ? 'wichtig' : v < 0 ? 'stört' : 'egal'}`;
function tunePanel(p, n) {
  const w = SM.weightsOf(p);
  const el = document.createElement('div');
  el.className = 'tune';
  el.innerHTML = `<p class="muted">Was ist ${escapeHtml(p.name)} wichtig? Rechts = wichtig, links = stört. „Nie“ schließt Viertel mit viel davon ganz aus.<span data-cust ${p.custom ? '' : 'hidden'}> <b>Eigene Werte</b> (Typ und Mischtyp gelten nicht mehr). <button type="button" class="link" data-reset>Auf Typ zurücksetzen</button></span></p><p class="warn" data-warn role="status"></p>
    <div class="trow mix"><label for="mix-${n}">Mischtyp</label>
    <select id="mix-${n}" data-mix><option value="">kein zweiter Typ</option>${Object.entries(SM.PRESETS).filter(([k]) => k !== p.type).map(([k, v]) => `<option value="${k}" ${k === p.type2 ? 'selected' : ''}>halb ${v.label}</option>`).join('')}</select></div>` +
    Object.entries(SM.CATEGORIES).map(([k, c]) => `<div class="trow">
      <label for="t-${k}-${n}">${c.label}</label>
      <input type="range" id="t-${k}-${n}" data-k="${k}" min="-10" max="10" step="1" value="${Math.round(w[k] * 10)}" aria-valuetext="${vt(w[k] * 10)}">
      <output>${Math.round(w[k] * 10)}</output>
      <label class="veto"><input type="checkbox" data-veto="${k}" aria-label="Nie ${c.label} für ${escapeHtml(p.name)}" ${(p.veto || []).includes(k) ? 'checked' : ''}> Nie</label>
    </div>`).join('');
  el.querySelector('[data-mix]').onchange = e => { e.target.value ? p.type2 = e.target.value : delete p.type2; delete p.custom; save(); renderPeople(); };
  const warn = () => { const w2 = SM.weightsOf(p); el.querySelector('[data-warn]').textContent = (p.veto || []).filter(k => w2[k] > 0).map(k => `${SM.CATEGORIES[k].label} ist wichtig und zugleich „Nie“: Das „Nie“ gewinnt.`).join(' '); };
  el.querySelectorAll('input[type=range]').forEach(r => {
    r.oninput = () => {
      el.querySelector('[data-cust]').hidden = false;
      p.custom = SM.cleanWeights(Object.fromEntries([...el.querySelectorAll('input[type=range]')].map(x => [x.dataset.k, +x.value / 10])));
      r.nextElementSibling.textContent = r.value; r.setAttribute('aria-valuetext', vt(+r.value));
      warn(); save();
    };
  });
  el.querySelectorAll('input[data-veto]').forEach(c => {
    c.onchange = () => {
      const set = new Set(p.veto || []); c.checked ? set.add(c.dataset.veto) : set.delete(c.dataset.veto);
      p.veto = [...set]; if (!p.veto.length) delete p.veto;
      warn(); save();
    };
  });
  const reset = el.querySelector('[data-reset]');
  if (reset) reset.onclick = () => { delete p.custom; save(); renderPeople(); };
  warn();
  return el;
}
function save(own = true) {
  if (own) endSticky();
  store.set('sm_people', people);
  rescore();
  // Änderungen gelten ab jetzt: alten Teilen-Link aus der Adresszeile nehmen, sonst überschreibt ein Neuladen die Eingaben
  if (own && location.hash.startsWith('#t=')) history.replaceState(null, '', location.pathname + location.search);
}

function budgetNums() {
  return SM.budgetSplit(Math.max(0, +$('budget').value || 0), $('budgetMode').value, SM.nights($('checkin').value, $('checkout').value), people.length);
}
function updateBudget() {
  guestWarn();
  const b = budgetNums(), { k: kids, y: babys } = guests();
  const warn = !b.n ? '' : b.total === 0 ? 'Budget 0: In der Airbnb-Suche wird dann kein Preisfilter gesetzt.'
    : b.perPersonNight < 25 ? '⚠ Unter 25 € pro Person und Nacht wird es in den meisten Städten knapp.' : '';
  $('budgetInfo').innerHTML = (b.n
    ? `${b.n} ${b.n === 1 ? 'Nacht' : 'Nächte'} · ${Math.round(b.perNight)} € pro Nacht${solo() ? '' : ` · ${Math.round(b.perPerson)} € pro Person · ${Math.round(b.perPersonNight)} € pro Person und Nacht`}`
    : 'Zeitraum wählen') + (warn ? `<div class="warn">${warn}</div>` : '') + '<div>Das Budget filtert nur die Airbnb-Suche, die Viertel-Wertung ändert es nicht.</div>';
  $('bedsLabel').textContent = `Mindestens ${Math.max(1, Math.ceil(people.length / 2))} Schlafzimmer in die Airbnb-Suche übernehmen` + (kids + babys ? ` (${kids + babys} Kind${kids + babys > 1 ? 'er' : ''} zählen als Gäste auf Airbnb mit)` : '');
}
// Nur Links und Kopfzeile neu setzen, wenn sich Budget/Zeitraum/Gäste ändern (die Wertung bleibt gleich)
// Nur Airbnb-Links tauschen: offene Aufschlüsselung und Fokus bleiben erhalten
function refreshLinks() {
  updateBudget(); saveForm(); updateDates();
  if (!lastView) return;
  saveTrip(lastData.geo, lastView.byTotal, lastView.ppl); renderHead();
  lastView.ranked.forEach((a, i) => { const l = document.querySelector(`#area-${i} a.btn`); if (l) l.href = airbnbFor(a); });
}
let linkTimer = null;
['checkin', 'checkout', 'budget', 'kids', 'babys'].forEach(id => $(id).addEventListener('input', () => { updateBudget(); clearTimeout(linkTimer); linkTimer = setTimeout(refreshLinks, 300); }));
// Fokussiertes Zahlenfeld ändert sich sonst beim Scrollen mit dem Mausrad
document.querySelectorAll('input[type=number]').forEach(el => el.addEventListener('wheel', () => el.blur(), { passive: true }));
let bmPrev = $('budgetMode').value;
$('budgetMode').addEventListener('change', () => {
  const v = +$('budget').value || 0, to = $('budgetMode').value;
  if (v) $('budget').value = SM.convertBudget(v, bmPrev, to, SM.nights($('checkin').value, $('checkout').value), people.length);
  bmPrev = to; refreshLinks();
  if (v) $('budgetInfo').insertAdjacentHTML('afterbegin', `<div class="warn">Umgerechnet: ${v} € → ${$('budget').value} € (${$('budgetMode').selectedOptions[0].text}).</div>`);
});
$('beds').addEventListener('change', refreshLinks);
$('radius').addEventListener('change', () => { saveForm(); rescore(); });
$('maxcenter').addEventListener('change', () => { saveForm(); shown = 8; rescore(); });
function updateFair() { const f = Math.round(fairness * 100); $('fairOut').textContent = `${f} % unzufriedenste Person · ${100 - f} % Schnitt`; $('fair').value = f; $('fair').setAttribute('aria-valuetext', $('fairOut').textContent); }
$('fair').addEventListener('input', () => { fairness = SM.cleanFairness(+$('fair').value / 100); updateFair(); store.set('sm_fair', fairness); rescore(); });
updateFair();
function addPerson() {
  people.push({ name: `Person ${people.length + 1}`, type: 'chill' });
  save(); renderPeople();
  const inputs = $('people').querySelectorAll('.person input'); const last = inputs[inputs.length - 1];
  if (last) { last.focus(); last.select(); }
}
$('addPerson').onclick = addPerson;
$('example').onclick = () => {
  offerUndo('Beispiel geladen.');
  people = [{ name: 'Party 1', type: 'party' }, { name: 'Party 2', type: 'party' }, { name: 'Chill 1', type: 'chill' }, { name: 'Chill 2', type: 'chill' }, { name: 'Sights', type: 'sights' }];
  save(); renderPeople();
};
$('pasteGo').onclick = () => {
  const list = SM.parseGroup($('paste').value).map(SM.cleanPerson).filter(Boolean);
  if (!list.length) { $('pasteMsg').textContent = 'Kein Name erkannt. Beispiel: Lena Party, Tom Chill'; return; }
  $('pasteMsg').textContent = '';
  offerUndo(`${list.length} Personen aus dem Text übernommen.`); people = list; $('paste').value = ''; save(); renderPeople();
};
// ---- Gespeicherte Gruppen ----
// Gespeicherte Vorlagen nie blind benutzen: kaputte Einträge verwerfen, sonst steht die ganze App
const groups = () => arr(store.get('sm_groups', []), 8).filter(g => g && typeof g.name === 'string' && Array.isArray(g.people) && g.people.some(SM.cleanPerson));
function renderTpl() {
  $('tpl').innerHTML = '<option value="">Auswahl …</option>' + groups().map((g, i) => `<option value="${i}">${escapeHtml(g.name)} (${g.people.length})</option>`).join('');
}
let tplLast = null;
const tplUnsure = () => { delete $('tplDel').dataset.sure; $('tplDel').textContent = 'Auswahl löschen'; };
$('tpl').onchange = () => {
  tplUnsure();
  const g = groups()[+$('tpl').value];
  if (!g) return;
  const list = (g.people || []).map(SM.cleanPerson).filter(Boolean);
  if (!list.length) return;
  offerUndo(`Auswahl „${g.name}“ geladen.`); people = list; save(); renderPeople();
  tplLast = g.name; $('tpl').value = ''; // dieselbe Auswahl lässt sich gleich nochmal laden; Löschen merkt sich den Namen
};
$('tplSave').onclick = () => {
  // Eingabefeld statt prompt(): In-App-Browser (Instagram, WhatsApp) unterdrücken Dialoge
  tplUnsure();
  const name = ($('tplName').value.trim() || people.slice(0, 3).map(p => p.name).join(', ')).slice(0, 40);
  const l = groups(), same = l.findIndex(g => g.name === name);
  if (same >= 0) l.splice(same, 1); // gleicher Name: ersetzen statt doppelt anlegen
  store.set('sm_groups', [...l, { name, people: clone(people) }].slice(-8)); renderTpl();
  $('tplName').value = ''; $('tplMsg').textContent = `„${name}“ ${same >= 0 ? 'ersetzt' : 'gespeichert'}.`;
};
$('tplDel').onclick = () => {
  // Ohne confirm(): erster Klick fragt nach, zweiter löscht die zuletzt geladene Auswahl
  const b = $('tplDel'), l = groups(), g = l.find(x => x.name === tplLast);
  if (!g) { $('tplMsg').textContent = l.length ? 'Erst eine Auswahl laden, dann löschen.' : 'Noch nichts gespeichert.'; return; }
  if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = `„${g.name}“ wirklich löschen?`; return; }
  store.set('sm_groups', l.filter(x => x !== g)); renderTpl(); tplLast = null;
  delete b.dataset.sure; b.textContent = 'Auswahl löschen'; $('tplMsg').textContent = `„${g.name}“ gelöscht.`;
};
renderTpl();
// Kurzbeschreibung der Typen (aus den Gewichten erzeugt, damit sie nie von der Wertung abweicht)
$('typeInfo').innerHTML = '<ul>' + SM.typeSummary().map(([l, t]) => `<li><b>${l}</b>: ${t}</li>`).join('') + '</ul><p>Mit ⚙️ an jeder Person stellst du alles einzeln ein oder mischst zwei Typen.</p>';
// Schnellwahl beliebter Ziele
// Städte stehen einmal in app.html (Kacheln), die Schnellwahl entsteht daraus
$('cityChips').innerHTML = [...document.querySelectorAll('#destGrid .dcard')].map(b => `<button type="button">${escapeHtml(b.dataset.city)}</button>`).join('');
$('destGrid').onclick = e => { const b = e.target.closest('.dcard'); if (b) { $('city').value = b.dataset.city; saveForm(); window.scrollTo({ top: 0, behavior: 'smooth' }); run(); } };
$('cityChips').onclick = e => { const b = e.target.closest('button'); if (b) { $('city').value = b.textContent; saveForm(); run(); } };

async function geocode(city, signal) {
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(city)}`, { headers: { 'Accept-Language': LANG }, signal });
  if (!r.ok) throw new Error(`Ortssuche gerade nicht erreichbar (${r.status}) – bitte gleich nochmal versuchen.`);
  const choices = SM.placeChoices(await r.json());
  if (!choices.length) throw new Error('Stadt nicht gefunden');
  return choices;
}
// Zentrum und Suchfläche: Logik und Mindestgröße stehen in shared/core.js
const geoFrom = res => C.geoFromNominatim(res);

const overpass = (bbox, outer, onTry, onBytes) => SM.overpassFetch(bbox, outer, onTry, { onBytes }); // Logik in scoring.js

// Vorab geladene Städte (scripts/prefetch-cities.mjs → web/data/). Der Index wird nur einmal geladen.
const normCity = C.normCity;
let indexPromise = null;
async function prefetched(city, signal) {
  try {
    indexPromise = indexPromise || fetch('data/index.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
    const idx = await indexPromise.catch(e => { indexPromise = null; throw e; }); // beim nächsten Mal neu versuchen
    const file = SM.cityKeys(city).map(k => idx[k]).find(Boolean);
    if (!file) return null;
    const r = await fetch('data/' + file, { signal });
    if (!r.ok) throw new Error(r.status);
    return SM.fromFile(await r.json());
  } catch (e) {
    if (signal && signal.aborted) throw e;
    console.warn('Vorab-Daten nicht lesbar, lade live', e); if (setBusy.note) setBusy.note('Vorab-Daten nicht lesbar, lade live.'); return null;
  }
}

// Ergebnis pro Stadt einen Tag lang im Browser merken (spart die langsame Abfrage)
const CACHE = 'sm_osm4_'; // Version 4: Zeilen als Arrays wie in web/data (etwa halb so groß wie Objekte)
function cacheGet(k) {
  try {
    const c = JSON.parse(sessionStorage.getItem(k) || localStorage.getItem(k));
    return c && Date.now() - c.t < 864e5 && Array.isArray(c.rows) ? { t: c.t, rows: SM.fromFile({ ...c, bbox: [0, 0, 0, 0] }).rows } : null;
  } catch { return null; }
}
function cacheSet(k, rows) {
  const v = JSON.stringify({ t: Date.now(), fields: C.FIELDS, rows: rows.map(r => C.FIELDS.map(f => r[f] || '')) });
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
// alte Versionen und abgelaufene Städte entfernen (sonst bleiben sie liegen, bis der Speicher voll ist)
try { Object.keys(localStorage).filter(k => /^sm_osm[0-3]?_/.test(k) || (k.startsWith(CACHE) && !cacheGet(k))).forEach(k => localStorage.removeItem(k)); } catch {}

let map, layer, poiLayer, bboxLayer, circles = [], cmp = [], lastData = null, lastView = null; // lastData: geladene Viertel + Orte → Neuberechnung ohne Netz
const radius = () => +$('radius').value || 800;

let runCtrl = null, tick = null, ldShow = null, ldPrev = null;
const LD_TIPS = [...$('ldTips').children].map(li => li.textContent);
const LD_EST = 75; // grobe Schätzung für das Laden aus OpenStreetMap in Sekunden
function setBusy(on, msg) {
  $('go').disabled = on; $('cancel').hidden = !on; clearInterval(tick); clearTimeout(ldShow);
  $('results').setAttribute('aria-busy', String(on)); $('results').classList.toggle('dim', on && !!$('results').innerHTML); $('results').inert = on;
  if (!on) {
    $('loader').hidden = true; $('status').classList.remove('sr');
    if (ldPrev && !$('results').innerHTML.trim()) { $('intro').hidden = ldPrev[0]; $('dest').hidden = ldPrev[1]; }
    ldPrev = null; return;
  }
  const t0 = Date.now(); let base = msg, step = 1, t2 = 0, slow = false, tipI = Math.floor(Math.random() * LD_TIPS.length);
  setBusy.set = (m, n, live) => { base = m; if (n && n !== step) { step = n; if (n === 2) { t2 = Date.now(); slow = !!live; } } draw(); };
  setBusy.note = m => { $('ldNote').textContent = m; };
  $('ldNote').textContent = '';
  const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const draw = () => {
    const s = Math.round((Date.now() - t0) / 1000);
    // Sekunden nur alle 15 s in die Live-Region: Screenreader lesen sonst jede Sekunde vor
    const st = s % 15 === 0 ? `${base} (${s} s)` : base;
    if ($('status').textContent !== st) $('status').textContent = st;
    $('ldTitle').textContent = base.replace(/^Schritt \d von 3: /, '').replace(/, kann bis zu 2 Minuten dauern$/, '');
    [...$('ldSteps').children].forEach((li, i) => { li.className = i + 1 < step ? 'ok' : i + 1 === step ? 'on' : ''; });
    let p, time, unit;
    if (step === 2 && slow) {
      const e = (Date.now() - t2) / 1000;
      p = 12 + 80 * (1 - Math.exp(-e / 35)); // nähert sich an, erreicht 100 % erst, wenn die Daten da sind
      const left = Math.round(LD_EST - e);
      if (left > 0) { time = fmt(left); unit = 'noch ca.'; }
      else { time = 'gleich'; unit = 'dauert länger als sonst'; if (!$('ldNote').textContent) $('ldNote').textContent = 'OpenStreetMap ist gerade gut ausgelastet. Die Daten kommen gleich.'; }
    } else { p = step === 1 ? 6 : step === 2 ? 50 : 95; time = fmt(s); unit = 'vergangen'; }
    $('ldRing').style.strokeDashoffset = String(100 - Math.min(p, 99));
    $('ldTime').textContent = time; $('ldUnit').textContent = unit;
    if (s % 7 === 0) { const el = $('ldTip'); el.textContent = '💡 ' + LD_TIPS[tipI++ % LD_TIPS.length]; }
  };
  draw(); tick = setInterval(draw, 1000);
  // Erst nach kurzer Zeit zeigen: vorgeladene Städte sind sofort fertig und sollen nicht flackern
  ldShow = setTimeout(() => {
    ldPrev = [$('intro').hidden, $('dest').hidden];
    $('intro').hidden = true; $('dest').hidden = true; $('loader').hidden = false; $('status').classList.add('sr');
    $('loader').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 400);
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
    const pre = pick ? null : await prefetched(city, signal);
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
      setBusy.set(rows ? `Schritt 2 von 3: Nutze gespeicherte Daten für ${geo.name}` : `Schritt 2 von 3: Lade Orte in ${geo.name} aus OpenStreetMap, kann bis zu 2 Minuten dauern`, 2, !rows);
      if (!rows) { rows = await overpass(geo.bbox, signal, i => setBusy.note && setBusy.note(`Server ${i} antwortet langsam, frage zusätzlich Server ${i + 1} an.`), n => setBusy.note && setBusy.note(`${(n / 1e6).toLocaleString(LANG, { maximumFractionDigits: 1 })} MB empfangen`)); cacheSet(cacheKey, rows); at = Date.now(); }
    }

    setBusy.set('Schritt 3 von 3: Bewerte Viertel', 3);
    const { areas, pois } = SM.buildData(rows); // dieselben Orte als Punkt und Gebäude, Bahnhofseingänge: nur einmal zählen
    if (areas.length < 2) throw new Error('Keine Viertel in OpenStreetMap gefunden – andere Stadt versuchen.');
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
    restoreMap();
    if (e.name === 'AbortError' || signal.aborted) $('status').textContent = 'Suche abgebrochen. Du kannst es jederzeit nochmal starten.';
    else if (!navigator.onLine) showError('Du bist offline. Internet prüfen und nochmal versuchen.');
    else showError(/fetch|network|load failed/i.test(e.message) ? 'Keine Verbindung zum Kartendienst. Internet prüfen und nochmal versuchen.' : e.message, !/nicht gefunden|Keine Viertel/.test(e.message));
  } finally { setBusy(false); runCtrl = null; }
}
$('formToggle').onclick = () => {
  const c = $('formBody').classList.toggle('collapsed');
  $('formToggle').setAttribute('aria-expanded', String(!c)); $('formToggle').textContent = c ? 'Wünsche und Einstellungen ändern' : 'Einstellungen einklappen';
};
// Mehrdeutiger Ortsname („Paris“): Person wählt
function showChoices(choices) {
  $('status').textContent = 'Mehrere Orte gefunden. Welcher ist gemeint?';
  const box = $('choices'); box.hidden = false;
  box.innerHTML = choices.map((c, i) => `<button type="button" data-i="${i}">${escapeHtml(c.display_name.split(',').map(x => x.trim()).filter((_, j, a) => j === 0 || j >= a.length - 2).join(', '))}</button>`).join('');
  box.insertAdjacentHTML('beforeend', '<button type="button" class="link" data-none>Keiner davon, Suchbegriff ändern</button>');
  box.onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    box.hidden = true;
    if (b.hasAttribute('data-none')) { $('city').focus(); $('city').select(); } else run(choices[+b.dataset.i]);
  };
  box.querySelector('button').focus();
}
$('retry').onclick = () => run();

// Wertung neu rechnen, wenn Gruppe, Umkreis, Fairness oder Sortierung sich ändern (kein neuer Abruf nötig)
const areaKey = a => `${a.name}@${a.lat.toFixed(4)}`;
const favStore = () => store.get('sm_fav', {});
const favSet = () => new Set((favStore()[lastData && lastData.q] || []));
function clearResults(msg, keepHead) {
  $('results').innerHTML = ''; $('compare').innerHTML = ''; $('whatif').innerHTML = ''; $('reshead').hidden = !keepHead; $('more').hidden = true;
  for (const l of [layer, poiLayer]) if (l) l.remove(); // alte Kreise, Pins und Orte weg
  layer = poiLayer = null; circles = []; renderMap.key = null;
  if (!keepHead) lastView = null;
  if (msg) $('status').textContent = msg;
}
function compute() {
  if (!lastData) return;
  const { areas, pois, geo } = lastData;
  if (!people.length) { clearResults('Mindestens eine Person nötig. Füge links jemanden hinzu.'); return; }
  const r = radius();
  SM.scoreAreas(areas, pois, r);
  SM.annotateCentre(areas, geo);
  const ppl = people.map(p => ({ ...p, w: SM.weightsOf(p) }));
  for (const a of areas) { a.group = SM.groupScore(a.norm, ppl, fairness); a.vetoes = SM.vetoes(a.norm, ppl, a.counts); }
  // Viertel ohne nennenswerte Infrastruktur ausblenden, auch ohne die Orte, die die Gruppe sucht. Viertel mit Veto und zu weit vom Zentrum ebenso.
  const { withData, relevant, empty } = SM.eligibleAreas(areas, ppl, (+$('maxcenter').value || 0) * 1000);
  const emptyNote = empty.length ? ` Für ${empty.map(k => SM.CATEGORIES[k].label).join(', ')} hat OpenStreetMap hier kaum Daten; das zählt beim Ausblenden nicht mit.` : '';
  const okAreas = withData.filter(a => !a.vetoes.length);
  const vetoed = withData.length - okAreas.length;
  const vetoNote = vetoed ? ` ${vetoed} Viertel ausgeschlossen (${[...new Set(withData.flatMap(a => a.vetoes.map(v => `${v.name}: nie ${v.label}`)))].slice(0, 3).join(', ')}).` : '';
  const byTotal = SM.sortAreas(okAreas, 'fair');
  if ((/^p:(\d+)$/.test(sortMode) && +sortMode.slice(2) >= ppl.length) || (ppl.length === 1 && /^(avg|p:)/.test(sortMode))) sortMode = 'fair';
  const sorted = SM.sortAreas(okAreas, sortMode);
  const favs = favSet(), onlyFav = $('onlyFav').checked;
  const pool = onlyFav ? sorted.filter(a => favs.has(areaKey(a))) : sorted;
  const minDist = Math.max(1200, r * 1.5);
  const ranked = onlyFav ? pool.slice(0, shown) : SM.pickDiverse(pool, shown, minDist); // Favoriten nicht zusammenfassen
  // Platzwechsel gegenüber der letzten Rechnung (nur bei gleichen Daten)
  const prev = lastView && lastView.data === lastData && lastView.sortMode === sortMode ? new Map(lastView.ranked.map((a, i) => [areaKey(a), i])) : null;
  ranked.forEach((a, i) => { a.delta = prev && prev.has(areaKey(a)) ? prev.get(areaKey(a)) - i : null; });
  lastView = { data: lastData, sortMode, ranked, pool, okAreas, byTotal, ppl, r, pois, geo, minDist, stats: SM.cityStats(areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10)), medCentre: SM.median(okAreas.map(a => a.centerDist)),
    awards: SM.awards(ranked, ppl), relevant };
  if (!ranked.length) {
    clearResults('', true); renderHead();
    $('status').textContent = onlyFav ? 'Noch keine Favoriten. Markiere Viertel mit dem Herz.'
      : vetoed ? `Alle Viertel sind durch ein Veto ausgeschlossen.${vetoNote} Nimm ein „Nie“ heraus.`
      : 'Keine passenden Viertel mit genug Orten gefunden. Versuche eine größere Stadt, einen größeren Umkreis, weniger strenge Entfernung zum Zentrum oder einen anderen Ortsnamen.';
    return;
  }
  $('status').textContent = `${okAreas.length} Viertel und ${pois.length} Orte ausgewertet.${vetoNote}${emptyNote} Die besten ${solo() ? 'für dich' : 'für eure Gruppe'}:`;
  $('intro').hidden = true; $('dest').hidden = true;
  if (/Chrome\//.test(navigator.userAgent) && !/Mobile|Android/.test(navigator.userAgent)) $('extHint').hidden = false; // Edge und Opera installieren Chrome-Erweiterungen
  saveTrip(geo, byTotal, ppl);
  renderHead();
  renderWhatIf(byTotal, ppl);
  renderResults();
  const left = (onlyFav ? pool.length : SM.pickDiverse(pool, Infinity, minDist).length) - ranked.length; // nur, was „Mehr“ wirklich zeigen kann
  $('more').hidden = !(ranked.length >= shown && left > 0);
  $('more').textContent = `${Math.min(8, left)} weitere Viertel anzeigen (${left} übrig)`;
  renderCompare();
  renderMap(ranked, geo, r, pois);
}
let rescoreTimer = null;
const rescore = () => { clearTimeout(rescoreTimer); rescoreTimer = setTimeout(() => { try { compute(); } catch (e) { console.debug(e); } }, 250); };
$('more').onclick = () => { shown += 8; renderMap.keep = true; compute(); }; // Karte springt bei „Mehr“ nicht weg
$('onlyFav').addEventListener('change', () => { shown = 8; compute(); });

// Kopfzeile: was wurde berechnet, Sortierung, Datenstand
function renderHead() {
  const b = budgetNums(), { k: kids, y: babys } = guests(), g = people.length;
  const at = lastData && lastData.at ? new Date(lastData.at) : null;
  const stamp = at ? (at.toDateString() === new Date().toDateString() ? 'heute geladen' : `Stand ${at.toLocaleDateString(LANG)}`) : '';
  $('resSummary').textContent = `Für ${g} ${g === 1 ? 'Person' : 'Personen'}${kids + babys ? ` + ${kids + babys} Kind${kids + babys > 1 ? 'er' : ''}` : ''}, ${b.n || '?'} Nächte${b.perNight ? `, ${Math.round(b.perNight)} € pro Nacht` : ''}. OpenStreetMap-Daten, ${stamp}.`;
  const opts = [['fair', solo() ? 'Beste Wertung (Standard)' : 'Fairste Wahl (Standard)'], ...(solo() ? [] : [['avg', 'Höchster Schnitt'], ...people.map((p, i) => [`p:${i}`, `Beste für ${p.name}`])]), ['transit', 'Nächste Bahn'], ['center', 'Nah am Zentrum'], ['cheap', 'Günstigere Lage (Schätzung)']];
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
  if (ppl.length < 2 || !byTotal.length) { el.innerHTML = ''; return; }
  const list = SM.whatIfWithout(byTotal.slice(0, 250), ppl, fairness, byTotal[0]).slice(0, 3);
  el.innerHTML = list.length ? '💡 ' + list.map(x => `Ohne <b>${escapeHtml(x.name)}</b> wäre <b>${escapeHtml(x.area)}</b> Platz 1.`).join(' ') : '💡 Das beste Viertel ändert sich nicht, wenn eine einzelne Person fehlt. Die Wahl ist stabil.';
}

function airbnbFor(a) {
  const { ppl, geo, r } = lastView, b = budgetNums();
  return SM.airbnbUrl({ lat: a.lat, lon: a.lon, name: a.name, city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value, adults: ppl.length,
    children: guests().k, infants: guests().y, minBedrooms: $('beds').checked ? Math.max(1, Math.ceil(ppl.length / 2)) : 0, priceMaxNight: b.perNight, radius: r });
}
function renderResults() {
  if (!lastView) return;
  const favs = favSet();
  $('results').innerHTML = lastView.ranked.map((a, i) => { const k = areaKey(a); return SM.cardHtml(a, i, lastView, { url: airbnbFor(a), key: k, fav: favs.has(k), cmp: cmp.includes(k), sortMode }); }).join('');
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
  if (c.checked) { cmp.push(c.dataset.k); if (cmp.length > 2) { const old = cmp.shift(); $('cmpMsg').textContent = `${old.split('@')[0]} aus dem Vergleich genommen.`; resultsEl.querySelectorAll('input[data-k]').forEach(x => { if (x.dataset.k === old) x.checked = false; }); } }
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
  const ll = e.target.closest('button[data-ll]'); // Nachbarviertel auf der Karte zeigen
  if (ll && map && !$('mapWrap').hidden) { map.setView(ll.dataset.ll.split(',').map(Number), 15); $('map').scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); return; }
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

resultsEl.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const chip = resultsEl.querySelector('button.chip[aria-expanded="true"]');
  if (chip) { chip.setAttribute('aria-expanded', 'false'); $('bd-' + chip.dataset.i).hidden = true; chip.focus(); }
});
$('compare').addEventListener('keydown', e => { if (e.key === 'Escape' && $('cmpClose')) $('cmpClose').click(); });
// Zwei Viertel nebeneinander
function renderCompare() {
  const el = $('compare');
  if (!lastView || cmp.length !== 2) { el.innerHTML = cmp.length === 1 ? '<p class="muted">Wähle ein zweites Viertel zum Vergleichen.</p>' : ''; return; }
  const { ranked, ppl } = lastView;
  const A = ranked.find(a => areaKey(a) === cmp[0]), B = ranked.find(a => areaKey(a) === cmp[1]);
  if (!A || !B) { cmp = []; el.innerHTML = ''; return; }
  const c = SM.compareAreas(A, B, ppl);
  const msg = `Vergleich ${A.name} gegen ${B.name} geöffnet.`;
  if (renderCompare.last !== msg) { renderCompare.last = msg; $('cmpMsg').textContent = msg; }
  const cell = (v, win, side) => `<td class="${win === side ? 'win' : ''}">${v}${win === side ? ' ✓' : ''}</td>`;
  const row = (label, x) => `<tr><th scope="row">${escapeHtml(label)}</th>${cell(x.a, x.win, 1)}${cell(x.b, x.win, 2)}</tr>`;
  el.innerHTML = `<div class="card"><table class="cmp-table"><caption>Vergleich: ${escapeHtml(A.name)} gegen ${escapeHtml(B.name)}</caption>
    <thead><tr><th scope="col"></th><th scope="col">${escapeHtml(A.name)}</th><th scope="col">${escapeHtml(B.name)}</th></tr></thead>
    <tbody>${row(solo() ? 'Gesamtwert' : 'Gruppenwert', c.total)}
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
  const want = mapPending ? mapPending.mw : keep;
  if ([...sel.options].some(o => o.value === want)) sel.value = want;
  $('mapWhoWrap').hidden = ppl.length < 2; // allein: Auswahl ist sinnlos
  if (!$('poiToggles').children.length) {
    $('poiToggles').innerHTML = Object.entries(SM.CATEGORIES).map(([k, c]) => `<label><input type="checkbox" data-poi="${k}"> <i class="dot" style="background:${POI_COLORS[k]}"></i>${c.label}</label>`).join('');
    $('poiToggles').onchange = () => lastView && renderMap(lastView.ranked, lastData.geo, lastView.r, lastData.pois);
  }
  if (mapPending) $('poiToggles').querySelectorAll('input').forEach(x => { x.checked = mapPending.m.includes(x.dataset.poi); });
  mapPending = null;
}
$('mapWho').addEventListener('change', () => lastView && renderMap(lastView.ranked, lastData.geo, lastView.r, lastData.pois));
function setMapHidden(hide) { // nur DOM: läuft schon beim Start (applyForm), bevor die Karte existiert
  $('mapWrap').hidden = hide;
  $('mapToggle').textContent = hide ? 'Karte einblenden' : 'Karte ausblenden'; $('mapToggle').setAttribute('aria-expanded', String(!hide));
}
$('mapToggle').onclick = () => {
  const hide = !$('mapWrap').hidden; setMapHidden(hide); saveForm();
  if (!hide && map) setTimeout(() => { map.invalidateSize(); renderMap.key = null; if (lastView) renderMap(lastView.ranked, lastData.geo, lastView.r, lastData.pois); }, 0);
};

function ensureMap() {
  if (!window.L || map) return !!map;
  map = L.map('map', { scrollWheelZoom: false }); // Mausrad scrollt die Seite; nach Klick in die Karte zoomt es
  map.on('click', () => map.scrollWheelZoom.enable()); map.on('mouseout', () => map.scrollWheelZoom.disable());
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' })
    .on('tileerror', () => { $('tileMsg').hidden = false; }).on('tileload', () => { $('tileMsg').hidden = true; }).addTo(map);
  // Knopf: Ausschnitt der besten Viertel wiederherstellen
  const Fit = L.Control.extend({ onAdd: () => { const b = L.DomUtil.create('button', 'mapfit'); b.type = 'button'; b.textContent = '⤢'; b.title = b.ariaLabel = 'Ausschnitt zurücksetzen';
    L.DomEvent.disableClickPropagation(b); b.onclick = () => { renderMap.key = null; if (lastView) renderMap(lastView.ranked, lastData.geo, lastView.r, lastData.pois); }; return b; } });
  new Fit({ position: 'topleft' }).addTo(map);
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

// Suche gescheitert oder abgebrochen: Rahmen und Ausschnitt der angezeigten Ergebnisse wiederherstellen
function restoreMap() {
  if (!map) return;
  if (lastView) { renderMap.key = null; renderMap(lastView.ranked, lastData.geo, lastView.r, lastData.pois); }
  else if (bboxLayer) { bboxLayer.remove(); bboxLayer = null; }
}
function renderMap(ranked, geo, r = 800, pois = []) {
  if (!window.L) return;
  $('mapSection').hidden = false;
  buildMapBar(lastView ? lastView.ppl : []);
  ensureMap();
  map.invalidateSize();
  drawBBox(geo);
  // Ausschnitt nur ändern, wenn sich die Auswahl ändert (sonst springt die Karte bei jeder Änderung zurück); verborgen: später einpassen
  const key = ranked.map(a => a.name).join('|');
  if (renderMap.keep && renderMap.key) renderMap.key = key;
  renderMap.keep = false;
  if (key !== renderMap.key && !$('mapWrap').hidden) {
    renderMap.key = key;
    let bounds = L.latLngBounds(ranked.map(a => [a.lat, a.lon]));
    // Weit gestreut: auf die Top 3 zoomen
    if (ranked.length > 3 && bounds.getNorthEast().distanceTo(bounds.getSouthWest()) > 12000) bounds = L.latLngBounds(ranked.slice(0, 3).map(a => [a.lat, a.lon]));
    map.fitBounds(bounds.pad(0.3), { maxZoom: 14 });
  }
  if (layer) layer.remove();
  if (poiLayer) poiLayer.remove();
  const who = $('mapWho').value, pi = who === 'g' ? -1 : +who;
  const score = a => pi < 0 ? a.group.total : a.group.scores[pi];
  const css = getComputedStyle(document.documentElement), col = k => css.getPropertyValue('--' + k).trim() || '#888'; // Farben aus dem Theme
  const color = (a, i) => pi < 0 ? (i === 0 ? col('accent') : '#888') : (score(a) >= 70 ? col('good') : score(a) < 40 ? col('warn') : '#888');
  $('mapLegend').textContent = pi < 0 ? 'Nummern = beste Viertel, Platz 1 farbig. Kleine Punkte = weitere bewertete Viertel (grün gut, rot schwach). Gestrichelt: ausgewertete Fläche.'
    : `Kreise für ${lastView.ppl[pi].name}: grün ab 70, orange unter 40, grau dazwischen. Kleine Punkte = weitere Viertel (grün gut, rot schwach).`;
  const goto = i => { const el = $('area-' + i); if (el) { el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' }); el.focus({ preventScroll: true }); } };
  const mark = (i, on) => { const el = $('area-' + i); if (el) el.classList.toggle('hl', on); };
  // Kreis = Wertungsradius (gleich wie in der Wertung und im Airbnb-Ausschnitt)
  circles = ranked.map((a, i) => {
    const c = L.circle([a.lat, a.lon], { radius: r, color: color(a, i), weight: 2, fillOpacity: 0.12 }); // Tooltip nur am Pin
    c.on('click', () => goto(i)); c.on('mouseover', () => mark(i, true)); c.on('mouseout', () => mark(i, false));
    return c;
  });
  const pins = ranked.map((a, i) => {
    const m = L.marker([a.lat, a.lon], { icon: L.divIcon({ className: '', html: `<div class="numpin ${i ? 'n' : ''}">${i + 1}</div>`, iconSize: [24, 24] }), keyboard: false })
      .bindTooltip(`${i + 1}. ${escapeHtml(a.name)} (${pi < 0 ? '' : escapeHtml(lastView.ppl[pi].name) + ': '}${score(a)})`);
    m.on('click', () => goto(i)); return m;
  });
  // Weitere bewertete Viertel als kleine Punkte (grün gut, rot schwach)
  const others = (lastView ? lastView.okAreas : []).filter(a => !ranked.includes(a)).slice(0, 150).map(a =>
    L.circleMarker([a.lat, a.lon], { radius: 5, weight: 1, color: `hsl(${Math.round(Math.max(0, Math.min(100, score(a))) * 1.2)},65%,45%)`, fillOpacity: 0.7 }).bindTooltip(`${escapeHtml(a.name)} (${score(a)})`));
  // Suchausschnitt der Airbnb-Suche für Platz 1
  const a0 = ranked[0], dLat = r / 111320, dLon = r / (111320 * Math.cos(a0.lat * Math.PI / 180));
  const box = L.rectangle([[a0.lat - dLat, a0.lon - dLon], [a0.lat + dLat, a0.lon + dLon]], { color: col('accent'), weight: 1, dashArray: '4 4', fill: false, interactive: false }).bindTooltip('Airbnb-Suchausschnitt für Platz 1');
  layer = L.layerGroup([...others, ...circles, box, ...pins]).addTo(map);
  // Orte als Punkte (nur in den gezeigten Vierteln, höchstens 1500)
  const on = [...$('poiToggles').querySelectorAll('input:checked')].map(x => x.dataset.poi);
  if (on.length) {
    const canvas = renderMap.canvas = renderMap.canvas || L.canvas({ padding: 0.3 }); // einmal anlegen, sonst wächst die Kartenebene
    const dots = [], cell = r / 111320, idx = new Map(); // Raster der gezeigten Viertel: nicht jede Entfernung neu rechnen
    for (const a of ranked) { const k = `${Math.floor(a.lat / cell)},${Math.floor(a.lon / cell)}`; (idx.get(k) || idx.set(k, []).get(k)).push(a); }
    const near = p => { const y = Math.floor(p.lat / cell), x = Math.floor(p.lon / cell); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (const a of idx.get(`${y + dy},${x + dx}`) || []) if (SM.distM(a, p) <= r) return true; return false; };
    for (const p of pois) {
      if (!on.includes(p.cat) || dots.length >= 1500) continue;
      if (!near(p)) continue;
      const m = L.circleMarker([p.lat, p.lon], { renderer: canvas, radius: 4, color: POI_COLORS[p.cat], weight: 1, fillOpacity: 0.8 });
      if (p.name) m.bindTooltip(escapeHtml(p.name));
      dots.push(m);
    }
    poiLayer = L.layerGroup(dots).addTo(map);
  }
}

$('f').addEventListener('submit', e => { e.preventDefault(); run(); });

// ---- Reise per Link teilen (alles steht im Teil nach #, wird nie an einen Server geschickt) ----
const mapState = () => ({ m: [...$('poiToggles').querySelectorAll('input:checked')].map(x => x.dataset.poi), mw: $('mapWho').value || 'g' });
const shareState = () => ({ ...formState(), ...mapState(), fairness, people, wishes });
let mapPending = null; // Kartenzustand aus einem Teilen-Link, wird beim ersten Zeichnen übernommen
let sharedPast = false;
function applyShared(h) {
  try {
    const s = SM.shareDecode(h);
    if (!s) return false;
    offerUndo('Reise aus dem Link geladen. Deine bisherigen Eingaben kannst du zurückholen.', true); // ganzer Zustand, bis zur nächsten eigenen Änderung
    people = s.people;
    if (s.wishes) { wishes = cleanWishes(s.wishes); store.set('sm_wishes', wishes); renderWishes(); } // alte Links ohne Wünsche bleiben gültig
    if (s.fairness != null) { fairness = s.fairness; store.set('sm_fair', fairness); updateFair(); }
    applyForm(s.form); mapPending = s.map;
    if (s.form.i && s.form.i < ymd(new Date())) sharedPast = true;
    syncMin(false);
    save(false); renderPeople(); updateBudget(); saveForm();
    return true;
  } catch { return false; }
}
$('share').onclick = async () => {
  const url = location.origin + location.pathname + '#t=' + SM.shareEncode(shareState());
  try { await navigator.clipboard.writeText(url); $('shareMsg').textContent = solo() ? '✅ Link kopiert. Damit öffnest du deine Suche auch auf einem anderen Gerät.' : '✅ Link kopiert. Schick ihn in den Gruppenchat.'; }
  catch { $('shareMsg').textContent = 'Kopieren nicht möglich. Kopiere den Link aus der Adresszeile.'; }
  history.replaceState(null, '', url);
};
// Stadt im Feld geändert, Ergebnisse gehören aber zur alten Stadt
$('city').addEventListener('input', () => {
  $('choices').hidden = true; saveForm();
  const stale = lastData && normCity($('city').value) !== lastData.q;
  $('stale').hidden = !stale;
  if (stale) $('stale').textContent = `Die Ergebnisse unten gehören zu „${lastData.geo.name}“. Mit „Passende Viertel finden“ suchst du die neue Stadt.`;
});
// Deeplink von der Startseite: ?c=Lissabon&i=2026-05-01&o=2026-05-05&n=2
{
  const q = new URLSearchParams(location.search), n = Math.floor(+q.get('n'));
  if (!location.hash.startsWith('#t=') && q.get('c')) {
    applyForm({ c: q.get('c'), i: q.get('i'), o: q.get('o') }); syncMin(false);
    if (n > 1 && n <= 16 && people.length === 1) people = Array.from({ length: n }, (_, i) => i ? { name: `Person ${i + 1}`, type: 'chill' } : people[0]);
    saveForm(); store.set('sm_people', people);
  }
  if (location.search) history.replaceState(null, '', location.pathname + location.hash); // sonst gewinnt ?c= bei jedem Neuladen
}
function openShared() {
  if (!location.hash.startsWith('#t=')) return;
  sharedPast = false;
  if (applyShared(location.hash.slice(3))) {
    $('status').textContent = 'Reise aus dem Link geladen. Die Suche startet gleich, du kannst dich danach selbst eintragen.';
    if (sharedPast) $('status').textContent += ' Die Reisedaten im Link lagen in der Vergangenheit, wir haben Standarddaten eingesetzt.';
    if ($('city').value.trim()) setTimeout(() => run(), 0);
  } else { $('status').textContent = 'Der Link ist beschädigt oder zu alt.'; }
}
openShared();
window.addEventListener('hashchange', openShared); // neuer Link in die Adresszeile des offenen Tabs eingefügt

// Brücke zum Plugin: alle bewerteten Viertel + Gruppe speichern, Plugin übernimmt sie
// Namen der Mitreisenden nur speichern, wenn ein Plugin sie liest; sonst alten Stand entfernen
function saveTrip(geo, areas, ppl) {
  if (!document.documentElement.dataset.staymatchExtension) { try { localStorage.removeItem('sm_trip'); } catch {} return; }
  const b = budgetNums();
  const v = JSON.stringify(SM.tripOf({ city: geo.name, checkin: $('checkin').value, checkout: $('checkout').value, nights: b.n, budget: b.total, ppl, wishes, areas }));
  try { localStorage.setItem('sm_trip', v); }
  catch { // Speicher voll: alte Stadt-Caches löschen und nochmal
    try { Object.keys(localStorage).filter(k => k.startsWith('sm_osm')).forEach(k => localStorage.removeItem(k)); localStorage.setItem('sm_trip', v); } catch {}
  }
  window.dispatchEvent(new Event('staymatch:trip'));
}
// Hinweis, ob das Plugin installiert ist (setzt bridge.js)
const extCheck = () => {
  if (document.documentElement.dataset.staymatchExtension) {
    if (lastView && !extCheck.done) { extCheck.done = 1; saveTrip(lastData.geo, lastView.byTotal, lastView.ppl); } // spät erkannt: nachholen
    $('extHint').hidden = false; $('extHint').textContent = `✅ Plugin verbunden: Auf der Airbnb-Seite siehst du direkt die Top 3 ${solo() ? 'für dich' : 'für euch'}.`; }
};
// Nicht auf ein festes Zeitfenster verlassen: auch spätes Setzen des Attributs erkennen
new MutationObserver(extCheck).observe(document.documentElement, { attributes: true, attributeFilter: ['data-staymatch-extension'] });
extCheck(); setTimeout(extCheck, 800);
renderWishes();
renderPeople();
