const { APP_URL } = window.StayMatchCore;
document.getElementById('app').href = APP_URL;
let tab = 'top', listings = {}, lastSearch = null, trip = null, query = '', extraKeys = {}, sortBy = 'seen', onlyBooked = false;
const I = window.StayMatchImport;
const X = window.StayMatchExtras || null; // R7 E: Popup-Werkzeuge (in alten Tests nicht geladen)
const LIMIT = 100, STALE_MS = 24 * 3600 * 1000;
// R7: gleiche Hostprüfung wie isRoomUrl (Regex ließ „www.airbnb.evil.com“ durch)
const safeSearchUrl = u => { const x = parseUrl(u); const d = StayMatchCore.AIRBNB_DOMAINS; return x && x.protocol === 'https:' && d.some(h => x.hostname === h || x.hostname === 'www.' + h) && x.pathname.startsWith('/s/') ? u : null; };

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

// R7: nur die nötigen Schlüssel lesen (nicht Pool, Bewertungstexte usw.), wenn der Browser getKeys kennt (Chrome 130+)
async function readStore() {
  const s = chrome.storage.local;
  if (typeof s.getKeys !== 'function') return s.get(null);
  const keys = (await s.getKeys()).filter(k => k.startsWith('l:') || ['listings', 'lastSearch', 'trip', 'settings', 'stats', 'tasteIgnore', 'friendLikes'].includes(k));
  return keys.length ? s.get(keys) : {};
}
// Tab, Sortierung und Scrollposition merken (Sitzungsspeicher, sonst lokal); das Popup schließt sich bei jedem Klick daneben
const uiStore = () => chrome.storage.session || chrome.storage.local;
let uiRestored = false, savedScroll = 0;
async function restoreUi() {
  try {
    const u = (await uiStore().get('popupUi')).popupUi || {};
    if (['top', 'all', 'liked', 'disliked'].includes(u.tab)) tab = u.tab;
    if (['seen', 'price', 'rating', 'booked'].includes(u.sort)) sortBy = u.sort;
    onlyBooked = !!u.onlyBooked; savedScroll = +u.scroll || 0;
    const b = tabs.find(x => x.dataset.tab === tab);
    if (b) tabs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
    if (b) $('list').setAttribute('aria-labelledby', b.id);
    $('sort').value = sortBy; $('onlyBooked').checked = onlyBooked;
  } catch {}
}
function restoreScroll() { if (savedScroll) $('list').scrollTop = savedScroll; }
let saveUiT = null;
function saveUi() {
  clearTimeout(saveUiT);
  saveUiT = setTimeout(() => { try { Promise.resolve(uiStore().set({ popupUi: { tab, sort: sortBy, onlyBooked, scroll: $('list').scrollTop } })).catch(() => {}); } catch {} }, 150);
}
async function load() {
  const all = await readStore();
  // Umzug vom alten Format (v0.1: ein großes Objekt "listings")
  if (all.listings) {
    const moved = Object.fromEntries(Object.entries(all.listings).map(([id, v]) => ['l:' + id, { ...v, id }]));
    await chrome.storage.local.set(moved); await chrome.storage.local.remove('listings');
    Object.assign(all, moved);
  }
  listings = Object.fromEntries(Object.entries(all).filter(([k, v]) => k.startsWith('l:') && v && v.id).map(([, v]) => [v.id, I.migrateListing(v)]));
  lastSearch = all.lastSearch || null; trip = all.trip || null;
  extraKeys = { settings: all.settings || {}, stats: all.stats || null, tasteIgnore: all.tasteIgnore || [], friendLikes: all.friendLikes || {} };
  if (!uiRestored) await restoreUi();
  render();
  if (!uiRestored) { uiRestored = true; restoreScroll(); }
}

function profile(items) {
  const liked = items.filter(i => i.vote === 1);
  if (!liked.length) return ['Markiere Unterkünfte mit 👍, dann lernt StayMatch deinen Geschmack.'];
  // R7: Preis je Währung (wie im Ranking), nicht € und $ gemischt
  const byCur = window.StayMatchRank.buildTaste(items)?.avgPricePerNightByCurrency || {};
  const prices = Object.entries(byCur).map(([c, v]) => `≈ ${Math.round(v)} ${c}/Nacht`);
  // Ab welcher Note das Ranking 👍 erwartet: Median minus 0,05 (rank.js buildTaste), nicht der Durchschnitt
  const r = window.StayMatchRank.buildTaste(items)?.minRating;
  // R7 E: Geschmack korrigieren: Orte einzeln streichen (zählen dann nicht mehr für den Geschmack)
  const ign = new Set((extraKeys.tasteIgnore || []).map(x => String(x).toLowerCase()));
  const places = [...new Set(liked.map(i => i.locality).filter(Boolean))].filter(p => !ign.has(p.toLowerCase())).slice(0, 4);
  const drop = p => async () => { const t = [...(extraKeys.tasteIgnore || []), p]; await chrome.storage.local.set({ tasteIgnore: t }); extraKeys.tasteIgnore = t; render(); };
  return [h('b', {}, 'Dein Geschmack'), ` (aus ${liked.length} 👍): `, [...prices, r != null && `⭐ ab ${r.toFixed(2).replace('.', ',')}`].filter(Boolean).join(' · '),
    places.length ? [' · Orte: ', ...places.flatMap((p, i) => [i ? ', ' : '', p, h('button', { title: `${p} nicht mehr als Vorliebe zählen`, 'aria-label': `${p} aus dem Geschmack streichen`, onclick: drop(p) }, '✕')])] : null,
    ign.size ? h('div', { class: 'muted' }, `Gestrichen: ${[...ign].join(', ')} `, h('button', { onclick: async () => { await chrome.storage.local.set({ tasteIgnore: [] }); extraKeys.tasteIgnore = []; render(); } }, 'zurücksetzen')) : null];
}

// R7: gemerkte Reisedaten an den Link hängen (Preis und Verfügbarkeit gleich sichtbar), nur gültige, nicht vergangene Daten
const DATE = /^\d{4}-\d{2}-\d{2}$/;
function roomLink(i) {
  const u = safeUrl(i.url);
  if (u === '#' || !DATE.test(i.checkin || '') || !DATE.test(i.checkout || '') || i.checkout <= i.checkin || i.checkin < I.localDay()) return u;
  const x = new URL(u); x.searchParams.set('check_in', i.checkin); x.searchParams.set('check_out', i.checkout);
  return x.href;
}

function itemRow(i) {
  return h('a', { class: 'item', href: roomLink(i), target: '_blank' },
    h('div', {},
      h('div', {}, (i.booked ? '✅ ' : '') + (i.vote === 1 ? '👍 ' : i.vote === -1 ? '👎 ' : '') + (i.title || 'Unterkunft')),
      h('div', { class: 'muted' }, [i.rating && '⭐ ' + i.rating, i.pricePerNight && window.StayMatchRank.money(i.pricePerNight, i.currency) + '/Nacht', i.locality, (i.visits || 1) + '× angesehen', i.lastSeen && new Date(i.lastSeen).toLocaleDateString('de-DE')].filter(Boolean).join(' · ')),
      i.lastSeen && Date.now() - i.lastSeen > STALE_MS && i.pricePerNight ? h('div', { class: 'muted warn' }, `Preis vom ${new Date(i.lastSeen).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}, auf der Seite neu prüfen`) : null,
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

// R7: ein Einstiegstext, Direktweg zuerst
const START_TEXT = 'Öffne einfach eine Airbnb-Suche: StayMatch bewertet die Unterkünfte direkt. Budget und Wünsche stellst du im Panel ein. Optional findet der Viertel-Finder vorher das passende Viertel, auch für Gruppen.';
function render() {
  const items = Object.values(listings).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0));
  $('profile').replaceChildren(h('span', {}, profile(items)));
  $('trip').replaceChildren(trip
    ? `Reise: ${trip.city || '?'} · ${trip.people?.length || '?'} ${trip.people?.length === 1 ? 'Person' : 'Personen'} · ${trip.nights || '?'} Nächte · ${trip.budget || '?'} € · ${trip.areas?.length || 0} Viertel bewertet`
    : START_TEXT);
  let rows;
  if (tab === 'top') {
    rows = lastSearch?.top?.length
      ? [h('div', { class: 'item muted', style: 'display:block' }, `Letzte Suche vom ${new Date(lastSearch.at).toLocaleString('de-DE')}`,
          safeSearchUrl(lastSearch.url) ? [' · ', h('a', { href: safeSearchUrl(lastSearch.url), target: '_blank', rel: 'noopener' }, 'Suche wieder öffnen')] : null), ...lastSearch.top.map((l, n) => topRow(l, n + 1))]
      : [h('div', { class: 'item muted' }, trip ? START_TEXT : 'Noch keine Suche bewertet.')];
  } else {
    const q = query.trim().toLowerCase();
    const SORTS = { seen: (a, b) => (b.lastSeen || 0) - (a.lastSeen || 0), price: (a, b) => (a.pricePerNight ?? Infinity) - (b.pricePerNight ?? Infinity), rating: (a, b) => (b.rating || 0) - (a.rating || 0), booked: (a, b) => (b.booked?.at || 0) - (a.booked?.at || 0) };
    const shown = items.filter(i => (tab === 'all' || (tab === 'liked' ? i.vote === 1 : i.vote === -1)) && (!onlyBooked || i.booked) &&
      (!q || [i.title, i.locality, i.note].some(t => (t || '').toLowerCase().includes(q)))).sort(SORTS[sortBy] || SORTS.seen);
    rows = shown.length ? shown.slice(0, LIMIT).map(itemRow) : [h('div', { class: 'item muted' }, 'Noch nichts hier.')];
    if (shown.length > LIMIT) rows.push(h('div', { class: 'item muted' }, `${shown.length - LIMIT} weitere, Suche verfeinern`));
  }
  $('search').hidden = tab === 'top'; $('sortbar').hidden = tab === 'top';
  $('list').replaceChildren(...rows);
  renderExtras(items);
  renderFriends();
}
// R7 E: Backup-Erinnerung (alle 3 Monate, ab 5 Einträgen) und Zähler „heute bewertet“
const BACKUP_MS = 90 * 864e5;
function renderExtras(items) {
  const st = extraKeys.settings || {};
  const due = items.length >= 5 && Date.now() - (st.lastBackup || st.firstUse || 0) > BACKUP_MS && st.firstUse;
  $('backup').hidden = !due;
  if (due) $('backup').replaceChildren('Deine Daten liegen nur hier. Sichern? ', h('button', { class: 'lnk', onclick: () => $('export').click() }, 'Jetzt als Datei sichern'));
  if (!st.firstUse) setSetting({ firstUse: Date.now() });
  const today = I.localDay(), stt = extraKeys.stats;
  $('stats').textContent = stt?.day === today && stt.rated ? `Heute hat StayMatch ${stt.rated} Unterkünfte für dich bewertet, du hast ${stt.opened || 0} davon geöffnet.` : '';
  const pu = st.pauseUntil || 0;
  $('pauseInfo').textContent = pu > Date.now() ? `aktiv bis ${new Date(pu).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}` : '';
  $('pause').textContent = pu > Date.now() ? 'Spuren-Pause beenden' : 'Spuren-Pause: 1 Stunde ohne Verlauf';
}

const tabs = [...document.querySelectorAll('nav button')];
function selectTab(b, focus) {
  tabs.forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); x.tabIndex = x === b ? 0 : -1; });
  $('list').setAttribute('aria-labelledby', b.id);
  tab = b.dataset.tab; render(); saveUi(); if (focus) b.focus();
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
$('sort').onchange = e => { sortBy = e.target.value; render(); saveUi(); };
$('onlyBooked').onchange = e => { onlyBooked = e.target.checked; render(); saveUi(); };
$('list').addEventListener('scroll', saveUi, { passive: true });
function download(name, text, type) {
  const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); a.click();
}
$('export').onclick = () => exportJson(confirm('Persönliche Angaben mit exportieren (Notizen, Namen der Mitreisenden, Reisedaten, Preisverlauf, Buchungen, Gastgeber)?\n\nOK = alles (Sicherung), Abbrechen = bereinigt (gut zum Teilen).'));
// Notizen, Namen, Reisedaten, Preisverlauf, Buchungen und Gastgeber-Kennungen sind persönlich: nur auf Wunsch mitnehmen
function exportJson(withPrivate) {
  const ls = withPrivate ? listings : I.sanitizeListings(listings);
  const t = withPrivate ? trip : I.sanitizeTrip(trip);
  // R7 E: offenes Format mit Kennung und Version, damit andere Werkzeuge die Datei lesen können
  download('staymatch.json', JSON.stringify({ format: I.FORMAT, version: I.EXPORT_VERSION, exportedAt: new Date().toISOString(), listings: ls, trip: t, ...(withPrivate ? { friendLikes: extraKeys.friendLikes || {} } : {}) }, null, 2), 'application/json');
  setSetting({ lastBackup: Date.now() });
};
$('csv').onclick = () => {
  // R7: wie beim JSON-Export nach Notizen fragen; Datum und Art als eigene Spalten (ISO-Datum)
  const withNotes = confirm('Notizen mit exportieren?\n\nOK = mit, Abbrechen = ohne (gut zum Teilen).');
  const iso = t => t ? I.localDay(new Date(t)) : '';
  const cols = ['title', 'kind', 'locality', 'rating', 'reviewCount', 'pricePerNight', 'currency', 'checkin', 'checkout', 'lastSeen', 'vote', 'visits', ...(withNotes ? ['note'] : []), 'url'];
  const esc = v => { let t = String(v ?? ''); if (/^[=+\-@\t\r]/.test(t)) t = "'" + t; return `"${t.replace(/"/g, '""')}"`; };
  const val = (i, c) => c === 'lastSeen' ? iso(i.lastSeen) : i[c];
  download('staymatch.csv', '\ufeff' + [cols.join(';'), ...Object.values(listings).map(i => cols.map(c => esc(val(i, c))).join(';'))].join('\n'), 'text/csv;charset=utf-8');
};
// Chrome schließt das Popup oft, sobald der Dateidialog aufgeht: Import läuft in einem eigenen Tab (options.html).
$('import').onclick = () => {
  const url = chrome.runtime?.getURL?.('options.html');
  if (url) window.open(url, '_blank'); else $('file').click(); // window.open: keine zusätzliche Berechtigung nötig
};
$('file').onchange = async e => {
  try {
    const { entries, skipped } = I.parseImport(await e.target.files[0].text(), { isRoomUrl, isCdnImage });
    const r = await I.applyImport(chrome.storage.local, entries);
    await load();
    // R7: Rückmeldung, was übernommen wurde (neue und zusammengeführte Einträge)
    $('list').prepend(h('div', { class: 'item muted', role: 'status' }, `${entries.length} übernommen, ${skipped} übersprungen (${r.added} neu, ${r.merged} mit vorhandenen zusammengeführt)`));
  } catch (err) { alert(err?.message || 'Datei konnte nicht gelesen werden.'); }
  e.target.value = ''; // R7: dieselbe Datei lässt sich erneut wählen
};
chrome.storage.local.get('settings').then(r => {
  const st = r.settings || {};
  $('optBadges').checked = st.showBadges !== false;
  $('optTheme').value = st.theme || 'auto';
  $('optScale').value = String(st.fontScale || 1);
  $('optScoreOnly').checked = !!st.scoreOnly;
  $('optBlind').checked = !!st.blind;
  $('optNoPrices').checked = !!st.share?.noPrices;
  $('optNoEmoji').checked = !!st.share?.noEmoji;
  $('optMarkdown').checked = !!st.share?.markdown;
});
// Schreibzugriffe auf „settings“ nacheinander und direkt vor dem Schreiben frisch lesen, damit zwei schnelle Klicks sich nicht überschreiben
let settingsQueue = Promise.resolve();
function setSetting(patch) {
  const run = async () => {
    const { settings = {} } = await chrome.storage.local.get('settings');
    const next = { ...I.migrateSettings(settings), ...patch };
    await chrome.storage.local.set({ settings: next });
    extraKeys.settings = next;
  };
  return (settingsQueue = settingsQueue.then(run, run));
}
$('optBadges').onchange = e => setSetting({ showBadges: e.target.checked });
$('optTheme').onchange = e => setSetting({ theme: e.target.value });
$('optScale').onchange = e => setSetting({ fontScale: +e.target.value || 1 });
$('optScoreOnly').onchange = e => setSetting({ scoreOnly: e.target.checked });
$('optBlind').onchange = e => setSetting({ blind: e.target.checked });
const shareOpts = () => ({ noPrices: $('optNoPrices').checked, noEmoji: $('optNoEmoji').checked, markdown: $('optMarkdown').checked });
for (const id of ['optNoPrices', 'optNoEmoji', 'optMarkdown']) $(id).onchange = () => setSetting({ share: shareOpts() });
$('pause').onclick = async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const pu = settings.pauseUntil > Date.now() ? 0 : Date.now() + 3600e3;
  await setSetting({ pauseUntil: pu }); render();
};
$('linkCheck').oninput = e => {
  const v = e.target.value.trim(), r = v && X ? X.linkCheck(v, StayMatchCore.AIRBNB_DOMAINS) : null;
  // Nachbau-Verdacht: Hilfe auf der Startseite verlinken (nur ein Link, nichts wird geladen)
  const help = r && /KEINE Airbnb-Adresse/.test(r.text) ? [' ', h('a', { href: 'https://staymatch.pro/#verdacht', target: '_blank', rel: 'noopener' }, 'Verdacht auf Betrug? So reagierst du')] : [];
  $('linkResult').replaceChildren(r ? r.text : '', ...help);
};
$('friendAdd').onclick = async () => {
  const ids = X ? X.friendIds($('friendText').value) : [];
  if (!ids.length) { $('friendInfo').textContent = 'Keine Airbnb-Links gefunden.'; return; }
  const name = (prompt('Von wem ist die Liste? (Name bleibt nur hier)', '') || 'Freund').trim().slice(0, 30);
  const { friendLikes = {} } = await chrome.storage.local.get('friendLikes');
  for (const id of ids) friendLikes[id] = [...new Set([...(friendLikes[id] || []), name])];
  await chrome.storage.local.set({ friendLikes }); extraKeys.friendLikes = friendLikes; renderFriends();
  $('friendInfo').textContent = `${ids.length} Unterkünfte von ${name} übernommen. Auf der Suchseite steht dann „${name} mag das“.`;
  $('friendText').value = '';
};
// Namen und Listen der Freunde ansehen und einzeln entfernen
function renderFriends() {
  const fl = extraKeys.friendLikes || {}, by = {};
  for (const [id, names] of Object.entries(fl)) for (const n of [].concat(names)) (by[n] ||= []).push(id);
  const box = $('friendList'); if (!box) return;
  box.replaceChildren(...Object.entries(by).map(([n, ids]) => h('div', {}, `${n}: ${ids.length} Unterkünfte `,
    h('button', { class: 'lnk', 'aria-label': `Liste von ${n} löschen`, onclick: async () => {
      const cur = (await chrome.storage.local.get('friendLikes')).friendLikes || {};
      for (const k of Object.keys(cur)) { cur[k] = [].concat(cur[k]).filter(x => x !== n); if (!cur[k].length) delete cur[k]; }
      if (Object.keys(cur).length) await chrome.storage.local.set({ friendLikes: cur }); else await chrome.storage.local.remove('friendLikes');
      extraKeys.friendLikes = cur; renderFriends();
    } }, 'löschen'))));
}
$('trips').onclick = async () => {
  const text = X ? X.tripsText(Object.values(listings)) : '';
  if (!text) { $('trips').textContent = 'Noch nichts als gebucht markiert'; return; }
  try { await navigator.clipboard.writeText(text); $('trips').textContent = 'Kopiert ✓'; } catch { $('trips').textContent = 'Nicht möglich'; }
  setTimeout(() => { $('trips').textContent = 'Gebuchte Etappen kopieren'; }, 2500);
};
$('dataInfo').onclick = async () => { const all = await chrome.storage.local.get(null); $('dataOut').replaceChildren(...(X ? X.storageSummary(all) : []).map(t => h('div', {}, t))); };
// Merkliste (👍) als Text zum Teilen (Preis pro Person nur, wenn mehrere reisen)
$('share').onclick = async () => {
  const liked = Object.values(listings).filter(i => i.vote === 1).sort((a, b) => (b.rating || 0) - (a.rating || 0));
  if (!liked.length) { $('share').textContent = 'Erst 👍 vergeben'; return; }
  const n = trip?.people?.length || 0;
  // R7: private Notizen gehen nur auf Wunsch in den Gruppenchat
  const notes = liked.some(i => i.note) && !!confirm('Deine Notizen mit in den Text nehmen?\n\nOK = mit, Abbrechen = ohne.');
  const text = window.StayMatchRank.shareText(liked.map(i => ({ ...i, stay: null, ppnPerson: n > 1 && i.pricePerNight ? Math.round(i.pricePerNight / n) : null })), { title: n > 1 ? 'Unsere Merkliste (StayMatch)' : 'Meine Merkliste (StayMatch)', notes, ...(extraKeys.settings?.share || {}) });
  try { await navigator.clipboard.writeText(text); $('share').textContent = 'Kopiert ✓'; } catch { $('share').textContent = 'Nicht möglich'; }
  setTimeout(() => { $('share').textContent = 'Merkliste kopieren'; }, 2500);
};
// Löschen getrennt nach Art; Einstellungen bleiben immer erhalten
// Vor „verlauf“ und „alles“ Sicherung anbieten; danach ein Rückgängig-Knopf, solange das Popup offen ist
let undoSnap = null;
$('wipe').onclick = async () => {
  const kind = prompt('Was löschen? Tippe: verlauf (Unterkünfte, Likes, Notizen, Freundes-Listen, Preis-Mediane, Statistik), zwischenspeicher (letzte Suche, gesammelte Seiten, Preis-Mediane), reise, diese reise (Reise samt Unterkünften mit ihrem Anreisedatum) oder alles (auch Reise und Zwischenspeicher).', 'verlauf');
  if (!kind) return;
  const k = kind.trim().toLowerCase();
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all);
  const pick = {
    verlauf: I.WIPE.verlauf,
    zwischenspeicher: I.WIPE.zwischenspeicher,
    reise: I.WIPE.reise,
    // R7 E: „Reise vergessen“: Reise, Sammlung und die Unterkünfte mit diesem Anreisedatum; der Rest bleibt
    'diese reise': x => x === 'trip' || x === 'pool' || x === 'lastSearch' || x === 'priceLog' || (x.startsWith('l:') && !!trip?.checkin && listings[x.slice(2)]?.checkin === trip.checkin),
    alles: x => x !== 'settings',
  }[k];
  if (!pick) { alert('Nichts gelöscht: bitte verlauf, zwischenspeicher, reise, diese reise oder alles eingeben.'); return; }
  const del = keys.filter(pick);
  if (!del.length) return;
  if ((k === 'verlauf' || k === 'alles') && confirm('Vorher eine Sicherung als Datei speichern?\n\nOK = Sicherung laden, Abbrechen = ohne.')) exportJson(true);
  undoSnap = Object.fromEntries(del.map(x => [x, all[x]]));
  await chrome.storage.local.remove(del); await load();
  $('list').prepend(h('div', { class: 'item muted', role: 'status' }, `${del.length} Einträge gelöscht. `, h('button', { class: 'lnk', onclick: async () => { if (undoSnap) { await chrome.storage.local.set(undoSnap); undoSnap = null; await load(); } } }, 'Rückgängig')));
};
// R7 E: ehrlich anzeigen, ob Chromes eingebaute KI-Schnittstellen hier vorhanden sind (nur Erkennung, kein Download; StayMatch nutzt sie nicht)
function aiStatus(g) {
  const apis = ['LanguageModel', 'Summarizer', 'Translator', 'LanguageDetector'].filter(k => k in g);
  return apis.length ? `Chrome-KI auf diesem Gerät: ${apis.join(', ')} vorhanden. StayMatch nutzt sie (noch) nicht, alles läuft mit festen Regeln.` : 'Chrome-KI auf diesem Gerät nicht verfügbar. StayMatch braucht sie nicht, alles läuft mit festen Regeln.';
}
$('aiInfo').textContent = aiStatus(self);
// R7-597: Wunsch-Profile Arbeit und Urlaub. Ein Klick setzt das Arbeits-Profil (WLAN, Arbeitsplatz, ruhig, Self-Check-in),
// der nächste wechselt zu Urlaub und wieder zurück. Schreibt in „quick“ wie die Profil-Chips im Panel (Budget bleibt erhalten),
// nur Wünsche, die das Plugin kennt. Die offene Suchseite übernimmt es bei der nächsten Bewertung (kein Doppel-Durchlauf).
const R = window.StayMatchRank || null;
const PROFILE_CYCLE = ['work', 'holiday'];
const knownWish = w => !!(R?.WISHES?.[w] || R?.REVIEW_WISHES?.[w] || X?.EXTRA_WISHES?.[w]);
async function renderWishProfile(note) {
  if (!X?.PROFILES || !R) return;
  const { quick = {} } = await chrome.storage.local.get('quick');
  const cur = PROFILE_CYCLE.includes(quick.profile) ? quick.profile : null;
  const next = PROFILE_CYCLE[(PROFILE_CYCLE.indexOf(cur) + 1) % PROFILE_CYCLE.length];
  const b = $('profileBtn');
  b.textContent = cur ? `Profil ${X.PROFILES[cur].label} aktiv · wechseln zu ${X.PROFILES[next].label}` : `Wunsch-Profil ${X.PROFILES.work.label} setzen`;
  b.setAttribute('aria-pressed', String(!!cur));
  b.title = X.PROFILES[next].wishes.filter(knownWish).join(', ');
  b.onclick = async () => {
    const { quick: q = {} } = await chrome.storage.local.get('quick');
    await chrome.storage.local.set({ quick: { budgetNight: null, ...q, wishes: X.PROFILES[next].wishes.filter(knownWish), profile: next } });
    renderWishProfile('Gilt ab der nächsten Bewertung der Airbnb-Suche.');
  };
  $('profileInfo').textContent = note || '';
  $('wishProfile').hidden = false;
}
renderWishProfile();
load();
