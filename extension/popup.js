const { APP_URL } = window.StayMatchCore;
document.getElementById('app').href = APP_URL;
let tab = 'top', listings = {}, lastSearch = null, trip = null, query = '';
const LIMIT = 100, STALE_MS = 24 * 3600 * 1000;
const safeSearchUrl = u => /^https:\/\/www\.airbnb\.[a-z.]+\/s\//.test(u || '') ? u : null;

const $ = id => document.getElementById(id);
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v); }
  for (const k of kids.flat(Infinity)) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k));
  return e;
}
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
const parseUrl = u => { try { return new URL(String(u || '')); } catch { return null; } };
// Nur echte Airbnb-Unterkunftsseiten (Host exakt aus der Domainliste, nicht per Regex)
const isRoomUrl = u => { const x = parseUrl(u); const d = StayMatchCore.AIRBNB_DOMAINS; return !!x && x.protocol === 'https:' && d.some(h => x.hostname === h || x.hostname === 'www.' + h) && x.pathname.startsWith('/rooms/'); };
const safeUrl = u => isRoomUrl(u) ? u : '#';
// Bilder nur vom Airbnb-CDN (verhindert Tracking-Pixel über importierte Dateien)
const isCdnImage = u => { const x = parseUrl(u); return !!x && x.protocol === 'https:' && (x.hostname === 'muscache.com' || x.hostname.endsWith('.muscache.com')); };

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
  // R7: Preis je Währung (wie im Ranking), nicht € und $ gemischt
  const byCur = window.StayMatchRank.buildTaste(items)?.avgPricePerNightByCurrency || {};
  const prices = Object.entries(byCur).map(([c, v]) => `≈ ${Math.round(v)} ${c}/Nacht`);
  const r = avg(liked.map(i => i.rating).filter(Boolean));
  const places = [...new Set(liked.map(i => i.locality).filter(Boolean))].slice(0, 3);
  return [h('b', {}, 'Dein Geschmack'), ` (aus ${liked.length} 👍): `, [...prices, r && `⭐ ab ${r.toFixed(2)}`, places.length && `Orte: ${places.join(', ')}`].filter(Boolean).join(' · ')];
}

// R7: gemerkte Reisedaten an den Link hängen (Preis und Verfügbarkeit gleich sichtbar), nur gültige, nicht vergangene Daten
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function roomLink(i) {
  const u = safeUrl(i.url);
  if (u === '#' || !DATE.test(i.checkin || '') || !DATE.test(i.checkout || '') || i.checkout <= i.checkin || i.checkin < new Date().toISOString().slice(0, 10)) return u;
  const x = new URL(u); x.searchParams.set('check_in', i.checkin); x.searchParams.set('check_out', i.checkout);
  return x.href;
}

function itemRow(i) {
  return h('a', { class: 'item', href: roomLink(i), target: '_blank' },
    h('div', {},
      h('div', {}, (i.vote === 1 ? '👍 ' : i.vote === -1 ? '👎 ' : '') + (i.title || 'Unterkunft')),
      h('div', { class: 'muted' }, [i.rating && '⭐ ' + i.rating, i.pricePerNight && window.StayMatchRank.money(i.pricePerNight, i.currency) + '/Nacht', i.locality, (i.visits || 1) + '× angesehen', i.lastSeen && new Date(i.lastSeen).toLocaleDateString('de-DE')].filter(Boolean).join(' · ')),
      i.lastSeen && Date.now() - i.lastSeen > STALE_MS && i.pricePerNight ? h('div', { class: 'muted warn' }, 'Preis älter als 24 h, auf der Seite neu prüfen') : null,
      i.hints?.length ? h('div', { class: 'muted' }, i.hints.slice(0, 4).join(' · ')) : null,
      i.note ? h('div', { class: 'muted' }, '📝 ' + i.note) : null));
}

// R7: Einheit aus der Suche; ältere Einträge ohne isTotal: Reisesumme (stay) falls bekannt, sonst ohne Einheit
function topPrice(l) {
  const M = v => window.StayMatchRank.money(v, l.currency);
  if (l.isTotal === true) return `${M(l.totalPrice)} gesamt`;
  if (l.isTotal === false) return `${M(l.totalPrice)} pro Nacht`;
  return l.stay != null ? `${M(l.stay)} gesamt` : M(l.totalPrice);
}

function topRow(l, n) {
  return h('a', { class: 'item', href: safeUrl(l.url), target: '_blank', style: 'display:block' },
    h('span', { class: 'score' }, l.score),
    h('div', {}, `${n}. ${l.title || l.kind || 'Unterkunft'}`),
    h('div', { class: 'muted' }, [l.locality, l.rating && '⭐ ' + l.rating, l.totalPrice && topPrice(l)].filter(Boolean).join(' · ')),
    h('div', { class: 'muted' }, (l.why || []).slice(0, 2).join(' · ')),
    (l.warn || []).length ? h('div', { class: 'muted warn' }, '⚠️ ' + l.warn.slice(0, 2).join(' · ')) : null);
}

function render() {
  const items = Object.values(listings).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  $('profile').replaceChildren(...profile(items));
  $('trip').replaceChildren(trip
    ? `Reise: ${trip.city || '?'} · ${trip.people?.length || '?'} ${trip.people?.length === 1 ? 'Person' : 'Personen'} · ${trip.nights || '?'} Nächte · ${trip.budget || '?'} € · ${trip.areas?.length || 0} Viertel bewertet`
    : 'Öffne einfach eine Airbnb-Suche: StayMatch bewertet die Unterkünfte direkt. Budget und Wünsche stellst du im Panel ein. Optional findet der Viertel-Finder vorher das passende Viertel, auch für Gruppen.');
  let rows;
  if (tab === 'top') {
    rows = lastSearch?.top?.length
      ? [h('div', { class: 'item muted', style: 'display:block' }, `Letzte Suche vom ${new Date(lastSearch.at).toLocaleString('de-DE')}`,
          safeSearchUrl(lastSearch.url) ? [' · ', h('a', { href: safeSearchUrl(lastSearch.url), target: '_blank', rel: 'noopener' }, 'Suche wieder öffnen')] : null), ...lastSearch.top.map((l, n) => topRow(l, n + 1))]
      : [h('div', { class: 'item muted' }, 'Öffne im Viertel-Finder „Unterkünfte ansehen“. StayMatch bewertet die Seite automatisch.')];
  } else {
    const q = query.trim().toLowerCase();
    const shown = items.filter(i => (tab === 'all' || (tab === 'liked' ? i.vote === 1 : i.vote === -1)) &&
      (!q || [i.title, i.locality, i.note].some(t => (t || '').toLowerCase().includes(q))));
    rows = shown.length ? shown.slice(0, LIMIT).map(itemRow) : [h('div', { class: 'item muted' }, 'Noch nichts hier.')];
    if (shown.length > LIMIT) rows.push(h('div', { class: 'item muted' }, `${shown.length - LIMIT} weitere, Suche verfeinern`));
  }
  $('search').hidden = tab === 'top';
  $('list').replaceChildren(...rows);
}

const tabs = [...document.querySelectorAll('nav button')];
function selectTab(b, focus) {
  tabs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
  $('list').setAttribute('aria-labelledby', b.id);
  tab = b.dataset.tab; render(); if (focus) b.focus();
}
tabs.forEach((b, i) => {
  b.onclick = () => selectTab(b);
  b.onkeydown = e => { // Pfeiltasten wechseln die Tabs
    const d = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (d) { e.preventDefault(); selectTab(tabs[(i + d + tabs.length) % tabs.length], true); }
    else if (e.key === 'Home') { e.preventDefault(); selectTab(tabs[0], true); }
    else if (e.key === 'End') { e.preventDefault(); selectTab(tabs.at(-1), true); }
  };
});
$('search').oninput = e => { query = e.target.value; render(); };
function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); a.click();
}
$('export').onclick = () => {
  // Notizen und Namen der Mitreisenden sind persönlich: nur auf Wunsch mitnehmen
  const withPrivate = confirm('Notizen und Namen der Mitreisenden mit exportieren?\n\nOK = mit, Abbrechen = ohne (gut zum Teilen).');
  const ls = withPrivate ? listings : Object.fromEntries(Object.entries(listings).map(([k, v]) => [k, (({ note, ...r }) => r)(v)]));
  const t = trip && !withPrivate ? { ...trip, people: (trip.people || []).map(p => ({ type: p?.type })), areas: (trip.areas || []).map(a => ({ ...a, minName: undefined })) } : trip;
  download('staymatch.json', JSON.stringify({ listings: ls, trip: t }, null, 2), 'application/json');
};
$('csv').onclick = () => {
  const cols = ['title', 'locality', 'rating', 'reviewCount', 'pricePerNight', 'currency', 'vote', 'visits', 'note', 'url'];
  const esc = v => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
  download('staymatch.csv', '\ufeff' + [cols.join(';'), ...Object.values(listings).map(i => cols.map(c => esc(i[c])).join(';'))].join('\n'), 'text/csv;charset=utf-8');
};
$('import').onclick = () => $('file').click();
$('file').onchange = async e => {
  try {
    const j = JSON.parse(await e.target.files[0].text());
    const src = j.listings || j;
    const entries = Object.values(src).filter(v => v && v.id && /^\d+$/.test(String(v.id)))
      .map(v => ({ ...v, image: isCdnImage(v.image) ? v.image : undefined, url: isRoomUrl(v.url) ? v.url : undefined }));
    await chrome.storage.local.set(Object.fromEntries(entries.map(v => ['l:' + v.id, v])));
    load();
  } catch { alert('Datei konnte nicht gelesen werden.'); }
};
chrome.storage.local.get('settings').then(r => {
  $('optBadges').checked = (r.settings || {}).showBadges !== false;
  $('optTheme').value = (r.settings || {}).theme || 'auto';
});
async function setSetting(patch) {
  const { settings = {} } = await chrome.storage.local.get('settings');
  await chrome.storage.local.set({ settings: { ...settings, ...patch } });
}
$('optBadges').onchange = e => setSetting({ showBadges: e.target.checked });
$('optTheme').onchange = e => setSetting({ theme: e.target.value });
// Merkliste (👍) als Text zum Teilen (Preis pro Person nur, wenn mehrere reisen)
$('share').onclick = async () => {
  const liked = Object.values(listings).filter(i => i.vote === 1).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (!liked.length) { $('share').textContent = 'Erst 👍 vergeben'; return; }
  const n = trip?.people?.length || 0;
  const text = window.StayMatchRank.shareText(liked.map(i => ({ ...i, stay: null, ppnPerson: n > 1 && i.pricePerNight ? Math.round(i.pricePerNight / n) : null })), { title: n > 1 ? 'Unsere Merkliste (StayMatch)' : 'Meine Merkliste (StayMatch)' });
  try { await navigator.clipboard.writeText(text); $('share').textContent = 'Kopiert ✓'; } catch { $('share').textContent = 'Nicht möglich'; }
  setTimeout(() => { $('share').textContent = 'Merkliste kopieren'; }, 2500);
};
// Löschen getrennt nach Art; Einstellungen bleiben immer erhalten
$('wipe').onclick = async () => {
  const kind = prompt('Was löschen? Tippe: verlauf (Unterkünfte, Likes, Notizen), zwischenspeicher (letzte Suche, gesammelte Seiten), reise oder alles. Das kann nicht rückgängig gemacht werden.', 'verlauf');
  if (!kind) return;
  const k = kind.trim().toLowerCase();
  const keys = Object.keys(await chrome.storage.local.get(null));
  const pick = {
    verlauf: x => x.startsWith('l:') || x === 'listings',
    zwischenspeicher: x => ['lastSearch', 'pool', 'quick', 'filters'].includes(x),
    reise: x => x === 'trip',
    alles: x => x !== 'settings',
  }[k];
  if (!pick) { alert('Nichts gelöscht: bitte verlauf, zwischenspeicher, reise oder alles eingeben.'); return; }
  await chrome.storage.local.remove(keys.filter(pick)); load();
};
load();
