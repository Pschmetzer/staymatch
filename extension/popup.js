const APP_URL = 'https://staymatch-tau.vercel.app/app.html';
document.getElementById('app').href = APP_URL;
let tab = 'top', listings = {}, lastSearch = null, trip = null;

const $ = id => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const safeUrl = u => /^https:\/\/www\.airbnb\.[a-z.]+\/rooms\//.test(u || '') ? u : '#';

async function load() {
  const all = await chrome.storage.local.get(null);
  // Umzug vom alten Format (v0.1: ein großes Objekt "listings")
  if (all.listings) {
    const moved = Object.fromEntries(Object.entries(all.listings).map(([id, v]) => ['l:' + id, { ...v, id }]));
    await chrome.storage.local.set(moved); await chrome.storage.local.remove('listings');
    Object.assign(all, moved);
  }
  listings = Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('l:')).map(([, v]) => [v.id, v]));
  lastSearch = all.lastSearch || null; trip = all.trip || null;
  render();
}

function profile(items) {
  const liked = items.filter(i => i.vote === 1);
  if (!liked.length) return ['Markiere Unterkünfte mit 👍, dann lernt StayMatch deinen Geschmack.'];
  const p = avg(liked.map(i => i.pricePerNight).filter(Boolean)), r = avg(liked.map(i => i.rating).filter(Boolean));
  const places = [...new Set(liked.map(i => i.locality).filter(Boolean))].slice(0, 3);
  return [h('b', {}, 'Dein Geschmack'), ` (aus ${liked.length} 👍): `, [p && `≈ ${Math.round(p)} €/Nacht`, r && `⭐ ab ${r.toFixed(2)}`, places.length && `Orte: ${places.join(', ')}`].filter(Boolean).join(' · ')];
}

function itemRow(i) {
  return h('a', { class: 'item', href: safeUrl(i.url), target: '_blank' },
    i.image ? h('img', { src: i.image, alt: '', onerror: e => e.target.style.visibility = 'hidden' }) : h('img', { alt: '' }),
    h('div', {},
      h('div', {}, (i.vote === 1 ? '👍 ' : i.vote === -1 ? '👎 ' : '') + (i.title || 'Unterkunft')),
      h('div', { class: 'muted' }, [i.rating && '⭐ ' + i.rating, i.pricePerNight && i.pricePerNight + ' ' + (i.currency || '€') + '/Nacht', i.locality, (i.visits || 1) + '× angesehen', i.lastSeen && new Date(i.lastSeen).toLocaleDateString('de-DE')].filter(Boolean).join(' · ')),
      i.hints?.length ? h('div', { class: 'muted' }, i.hints.slice(0, 4).join(' · ')) : null,
      i.note ? h('div', { class: 'muted' }, '📝 ' + i.note) : null));
}

function topRow(l, n) {
  return h('a', { class: 'item', href: safeUrl(l.url), target: '_blank', style: 'display:block' },
    h('span', { class: 'score' }, l.score),
    h('div', {}, `${n}. ${l.title || l.kind || 'Unterkunft'}`),
    h('div', { class: 'muted' }, [l.locality, l.rating && '⭐ ' + l.rating, l.totalPrice && `${l.totalPrice} ${l.currency || '€'} gesamt`].filter(Boolean).join(' · ')),
    h('div', { class: 'muted' }, (l.why || []).slice(0, 2).join(' · ')),
    (l.warn || []).length ? h('div', { class: 'muted warn' }, '⚠️ ' + l.warn.slice(0, 2).join(' · ')) : null);
}

function render() {
  const items = Object.values(listings).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  $('profile').replaceChildren(...profile(items));
  $('trip').replaceChildren(trip
    ? `Reise: ${trip.city || '?'} · ${trip.people?.length || '?'} Personen · ${trip.nights || '?'} Nächte · ${trip.budget || '?'} € · ${trip.areas?.length || 0} Viertel bewertet`
    : 'Noch keine Reise verbunden. Öffne den Viertel-Finder und starte eine Suche.');
  let rows;
  if (tab === 'top') {
    rows = lastSearch?.top?.length
      ? [h('div', { class: 'item muted', style: 'display:block' }, `Letzte Suche vom ${new Date(lastSearch.at).toLocaleString('de-DE')}`), ...lastSearch.top.map((l, n) => topRow(l, n + 1))]
      : [h('div', { class: 'item muted' }, 'Öffne im Viertel-Finder „Unterkünfte ansehen“. StayMatch bewertet die Seite automatisch.')];
  } else {
    const shown = items.filter(i => tab === 'all' || (tab === 'liked' ? i.vote === 1 : i.vote === -1));
    rows = shown.length ? shown.map(itemRow) : [h('div', { class: 'item muted' }, 'Noch nichts hier.')];
  }
  $('list').replaceChildren(...rows);
}

document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b); });
  tab = b.dataset.tab; render();
});
function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); a.click();
}
$('export').onclick = () => download('staymatch.json', JSON.stringify({ listings, trip }, null, 2), 'application/json');
$('csv').onclick = () => {
  const cols = ['title', 'locality', 'rating', 'reviewCount', 'pricePerNight', 'currency', 'vote', 'visits', 'note', 'url'];
  const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  download('staymatch.csv', [cols.join(';'), ...Object.values(listings).map(i => cols.map(c => esc(i[c])).join(';'))].join('\n'), 'text/csv');
};
$('import').onclick = () => $('file').click();
$('file').onchange = async e => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    const src = j.listings || j;
    const entries = Object.values(src).filter(v => v && v.id && /^\d+$/.test(String(v.id)));
    await chrome.storage.local.set(Object.fromEntries(entries.map(v => ['l:' + v.id, v])));
    load();
  } catch { alert('Datei konnte nicht gelesen werden.'); }
};
$('wipe').onclick = async () => {
  if (!confirm('Alle gespeicherten Unterkünfte, Likes, Notizen und die Reise löschen? Das kann nicht rückgängig gemacht werden.')) return;
  await chrome.storage.local.clear(); load();
};
load();
