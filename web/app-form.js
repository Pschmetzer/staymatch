// StayMatch Viertel-Finder – Formular: Gruppe, Zeitraum, Budget. Lädt als erstes app-*.js-Skript.
// Die app-*.js-Dateien sind klassische Skripte und teilen sich den globalen Bereich:
// jeder globale Name (SM, C, $, people …) wird nur einmal deklariert.
const SM = window.StayMatch, C = window.StayMatchCore;
const $ = id => document.getElementById(id);
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

let people = store.get('sm_people', [
  { name: 'Lena', type: 'party' }, { name: 'Mia', type: 'party' },
  { name: 'Jonas', type: 'chill' }, { name: 'Sara', type: 'chill' }, { name: 'Tom', type: 'sights' },
]).filter(p => p && typeof p.name === 'string').map(p => ({ ...p, type: SM.PRESETS[p.type] ? p.type : 'chill' }));

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
    const row = document.createElement('div');
    row.className = 'person';
    row.innerHTML = `<input value="${escapeHtml(p.name)}" aria-label="Name">
      <select aria-label="Typ">${Object.entries(SM.PRESETS).map(([k, v]) => `<option value="${k}" ${k === p.type ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
      <button title="Entfernen" aria-label="Entfernen">✕</button>`;
    row.children[0].oninput = e => { p.name = e.target.value; save(); };
    row.children[1].onchange = e => { p.type = e.target.value; save(); };
    row.children[2].onclick = () => { people.splice(i, 1); save(); renderPeople(); };
    $('people').appendChild(row);
  });
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
    ? `${b.n} Nächte · ${Math.round(b.perNight)} € pro Nacht · ${Math.round(b.perPerson)} € pro Person`
    : 'Zeitraum wählen';
}
['checkin', 'checkout', 'budget'].forEach(id => $(id).addEventListener('input', () => { updateBudget(); rescore(); }));
$('radius').addEventListener('change', () => rescore());
$('addPerson').onclick = () => { people.push({ name: `Person ${people.length + 1}`, type: 'chill' }); save(); renderPeople(); };
$('example').onclick = () => {
  people = [{ name: 'Party 1', type: 'party' }, { name: 'Party 2', type: 'party' }, { name: 'Chill 1', type: 'chill' }, { name: 'Chill 2', type: 'chill' }, { name: 'Sights', type: 'sights' }];
  save(); renderPeople();
};
