// StayMatch – läuft auf Airbnb-Seiten, die du selbst öffnest.
// Suchseite: bewertet alle sichtbaren Unterkünfte und zeigt die Top 3.
// Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte.
// Keine eigenen Anfragen an Airbnb, kein Abfangen von Airbnb-Daten, alles lokal.
// Dateien (Reihenfolge in manifest.json): core.js, parse.js, rank.js, hints.js, extras.js, pool.js, content-common.js, content-search.js, content-listing.js.
// content-common.js: Speicher, DOM-Helfer, Panel und Router. Die Seiten-Module tragen sich in window.StayMatchContent ein,
// content-listing.js startet zuletzt den Router.
(() => {
  const P = window.StayMatchParse;
  const T = window.__STAYMATCH_TEST__ || {}; // nur in Tests gesetzt (Zeiten kürzen, Funktionen erreichen)
  const REPORT_URL = 'https://github.com/Pschmetzer/staymatch/issues/new';
  // Betrugsverdacht: Schritt-für-Schritt-Hilfe auf der Startseite (nur ein Link, das Plugin lädt dort nichts)
  const SCAM_HELP_URL = 'https://staymatch.pro/#verdacht';
  const KEY = id => 'l:' + id;

  // ---------- Speicher (ein Schlüssel pro Unterkunft, damit Tabs sich nicht überschreiben) ----------
  // Schemaversion der gespeicherten Einträge (l:*) und der Einstellungen. Gleiche Regeln wie import.js (Kopie: Content-Skripte laden import.js nicht).
  const SCHEMA = 2;
  function migrateListing(v) {
    if (!v || typeof v !== 'object' || v.schema >= SCHEMA) return v;
    const o = { ...v, schema: SCHEMA };
    o.visits = Number.isFinite(+o.visits) && +o.visits > 0 ? +o.visits : 1;
    if (o.priceHistory != null && !Array.isArray(o.priceHistory)) delete o.priceHistory;
    if (o.hints != null && !Array.isArray(o.hints)) delete o.hints;
    return o;
  }
  async function getListing(id) { const v = (await chrome.storage.local.get(KEY(id)))[KEY(id)]; return v ? migrateListing(v) : null; }
  // Schreibzugriffe je Unterkunft nacheinander (zwei schnelle Klicks in einem Tab überschreiben sich nicht);
  // zwischen Tabs wird direkt vor dem Schreiben frisch gelesen.
  const saveQueues = new Map();
  function saveListing(id, patch) {
    const run = () => doSave(id, patch);
    const p = (saveQueues.get(id) || Promise.resolve()).then(run, run);
    saveQueues.set(id, p);
    p.finally(() => { if (saveQueues.get(id) === p) saveQueues.delete(id); }).catch(() => {});
    return p;
  }
  async function doSave(id, patch) {
    await SMC.ready; // Einstellungen (Pause!) sind geladen, bevor irgendetwas geschrieben wird
    const old = (await getListing(id)) || { id, firstSeen: Date.now(), visits: 0 };
    const item = { ...old, ...patch, id, lastSeen: Date.now(), schema: SCHEMA };
    // R7 E: Spuren-Pause (Popup): nichts speichern, also auch kein „schon gesehen“. Ausnahme: was du ausdrücklich klickst (👍/👎, Notiz, gebucht)
    const explicit = patch && ('vote' in patch || 'note' in patch || 'booked' in patch);
    if (isPaused() && !explicit) return { ...old, ...patch, id, paused: true }; // ohne neuen lastSeen
    try { await chrome.storage.local.set({ [KEY(id)]: item }); }
    catch (e) { console.debug('StayMatch: Speichern fehlgeschlagen (Speicher voll?)', e); SMC.saveFailed = true; }
    return item;
  }
  const isPaused = () => settings.pauseUntil > Date.now();
  async function allListings() {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all).filter(([k]) => k.startsWith('l:')).map(([, v]) => migrateListing(v));
  }
  async function getTrip() { return (await chrome.storage.local.get('trip')).trip || null; }

  function tasteFrom(items) {
    const liked = items.filter(i => i.vote === 1);
    if (!liked.length) return null;
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return {
      likedCount: liked.length,
      avgPricePerNight: avg(liked.map(i => i.pricePerNight).filter(Boolean)),
      minRating: Math.min(...liked.map(i => i.rating).filter(Boolean), 5) - 0.05,
      localities: [...new Set(liked.map(i => i.locality).filter(Boolean))],
    };
  }

  // ---------- kleine DOM-Helfer: Airbnb-Texte immer über textContent ----------
  function h(tag, attrs = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v);
    }
    for (const k of kids.flat(Infinity)) if (k != null) e.append(k instanceof Node ? k : String(k));
    return e;
  }

  // Panel-Design: automatisch (System), hell oder dunkel – einstellbar im Popup
  const settings = { showBadges: true, theme: 'auto' };
  const themeClass = () => settings.theme === 'dark' ? ' dark' : settings.theme === 'light' ? ' light' : '';
  function applyTheme() {
    for (const id of ['sm-search', 'sm-room', 'sm-error']) {
      const box = rootOf(id)?.querySelector('.box');
      if (box) { box.classList.toggle('dark', settings.theme === 'dark'); box.classList.toggle('light', settings.theme === 'light'); box.style.setProperty('--sm-scale', String(scale())); }
    }
  }
  // R7 E: Textgröße 100–150 % (Popup)
  const scale = () => Math.min(1.5, Math.max(1, +settings.fontScale || 1));
  const settingsListeners = [];
  function setSettings(v) { Object.assign(settings, { showBadges: true, theme: 'auto' }, v || {}); applyTheme(); settingsListeners.forEach(f => f(settings)); }
  chrome.storage.onChanged?.addListener(ch => {
    if (ch.settings) setSettings(ch.settings.newValue);
    // Neue Reise aus dem Viertel-Finder wirkt sofort, ohne die Airbnb-Seite neu zu laden
    if (ch.trip && SMC.route) { SMC.search?.reset(); SMC.route(); }
  });
  // Erst wenn die Einstellungen da sind, wird geschrieben (sonst gälten kurz die Standardwerte, auch bei aktiver Pause)
  const ready = chrome.storage.local.get('settings').then(r => setSettings(r.settings)).catch(() => {});

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    // Rückfall, falls die Seite die Zwischenablage-Schnittstelle sperrt.
    // R7: Textfeld im eigenen (geschlossenen) Shadow Root statt in Airbnbs DOM; Fokus danach zurückgeben.
    const prev = document.activeElement;
    let tmp = null;
    try {
      const root = host('sm-clip');
      tmp = document.getElementById('sm-clip');
      const ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;left:-999px;top:0' });
      ta.value = text; root.append(ta); ta.select();
      return document.execCommand('copy');
    } catch { return false; }
    finally { tmp?.remove(); try { prev?.focus?.({ preventScroll: true }); } catch {} }
  }

  // R7: geschlossener Shadow Root: Airbnbs Skripte kommen über el.shadowRoot nicht an Notiz, Budget und Gründe.
  // Die Referenz bleibt hier (WeakMap), Tests erreichen sie über T.shadow.
  const roots = new WeakMap();
  function rootOf(id) { const el = document.getElementById(id); return el ? roots.get(el) || null : null; }
  function host(id) {
    let el = document.getElementById(id);
    if (!el || !roots.has(el)) {
      el?.remove();
      el = h('div', { id, 'data-staymatch': '1' });
      roots.set(el, el.attachShadow({ mode: 'closed' }));
      document.documentElement.appendChild(el);
    }
    return roots.get(el);
  }
  T.shadow = rootOf;

  const CSS = `
    :host { all: initial; }
    .box { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 360px; max-height: 80vh; overflow: auto;
      background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px;
      font: 13px/1.45 system-ui, -apple-system, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.18);
      --bg: #fff; --fg: #1d1d1f; --muted: #6b6b70; --line: #e4e2dc; --accent: #e0475b; --good: #1f9d6b; --warn: #b86e00; }
    @media (prefers-color-scheme: dark) { .box:not(.light) { --bg: #1e1e22; --fg: #f2f2f4; --muted: #a0a0a8; --line: #34343a; } }
    .box.dark { --bg: #1e1e22; --fg: #f2f2f4; --muted: #a0a0a8; --line: #34343a; }
    .box.wide { width: min(560px, calc(100vw - 32px)); }
    table { border-collapse: collapse; width: 100%; font-size: 12px; margin: 6px 0; }
    th, td { text-align: left; vertical-align: top; padding: 4px 6px; border-top: 1px solid var(--line); }
    th { color: var(--muted); font-weight: 500; white-space: nowrap; }
    .err { border: 1px solid var(--warn); border-radius: 8px; padding: 8px; margin: 6px 0; }
    a.btn { display: inline-block; font: inherit; color: inherit; border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; text-decoration: none; }
    .box.min .body { display: none; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    b.brand span { color: var(--accent); }
    button { font: inherit; color: inherit; background: none; border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; cursor: pointer; }
    button.on { background: var(--accent); color: #fff; border: 2px solid var(--accent); padding: 4px 7px; font-weight: 600; }
    @media (forced-colors: active) { button.on, button[aria-pressed="true"] { background: Highlight; color: HighlightText; border: 2px solid HighlightText; forced-color-adjust: none; } }
    button:focus-visible, a:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .muted { color: var(--muted); font-size: 12px; }
    .item { border-top: 1px solid var(--line); padding: 8px 0; }
    .item a { color: var(--fg); font-weight: 600; text-decoration: none; }
    .score { float: right; font-weight: 700; font-size: 16px; }
    ul { margin: 4px 0 0; padding-left: 16px; } li.warn, div.warn { color: var(--warn); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; } .chips button { font-size: 12px; padding: 3px 8px; }
    textarea { width: 100%; box-sizing: border-box; height: 52px; border: 1px solid var(--line); border-radius: 8px; padding: 6px; font: 12px system-ui; background: var(--bg); color: var(--fg); }
    .item.hotel { border-top: 0; padding: 0 0 14px; }
    .item.hotel .ph { position: relative; aspect-ratio: 16/10; border-radius: 12px; overflow: hidden; background: var(--line); margin-bottom: 8px; }
    .item.hotel .ph img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .item.hotel .ph .score { position: absolute; top: 8px; right: 8px; float: none; background: rgba(0,0,0,.72); color: #fff; border-radius: 999px; padding: 2px 10px; font-size: 14px; }
    .item.hotel .ph .rank { position: absolute; top: 8px; left: 8px; background: #fff; color: #1d1d1f; border-radius: 999px; padding: 2px 9px; font-weight: 700; font-size: 12px; }
    .item.hotel .ph .lux { position: absolute; left: 8px; bottom: 8px; background: linear-gradient(135deg,#d4af37,#f3dc8a); color: #4a3a00; border-radius: 999px; padding: 2px 9px; font-weight: 700; font-size: 11px; }
    .item.hotel .name { display: block; font-size: 14px; }
    .item.hotel .meta { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; margin-top: 2px; }
    .item.hotel .stars { color: var(--fg); font-weight: 600; white-space: nowrap; }
    .item.hotel .price { margin-top: 2px; }
    .row { display: flex; gap: 6px; margin: 6px 0; } .row button { flex: 1; }
    details { margin: 6px 0; } summary { cursor: pointer; color: var(--muted); font-size: 12px; } details ul { font-size: 12px; }
    .box { font-size: calc(13px * var(--sm-scale, 1)); }
  `;

  let cssSheet;
  function sharedSheet() {
    if (cssSheet === undefined) { try { cssSheet = new CSSStyleSheet(); cssSheet.replaceSync(CSS); } catch { cssSheet = null; } }
    return cssSheet;
  }
  function panel(id, title, bodyNodes, opts = {}) {
    const { minimized = false } = opts;
    const root = host(id);
    // R7: Live-Region bleibt beim Neuaufbau bestehen, sonst sagt der Screenreader die Änderung nicht an
    const live = root.querySelector('.sr-live') || h('div', { class: 'sr-live', role: 'status', 'aria-live': 'polite', style: 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap' });
    root.replaceChildren(live);
    if (opts.announce != null && live.textContent !== opts.announce) setTimeout(() => { live.textContent = opts.announce; }, 50);
    const box = h('div', { class: 'box' + (minimized ? ' min' : '') + themeClass() + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-label': opts.label || title, lang: 'de' }); // R7: Panel ist deutsch, auch auf airbnb.com
    box.style.setProperty('--sm-scale', String(scale()));
    const toggle = h('button', { 'aria-label': 'Ein- oder ausklappen', onclick: () => { box.classList.toggle('min'); chrome.storage.local.set({ ['min:' + id]: box.classList.contains('min') }); } }, '–');
    const close = h('button', { 'aria-label': 'Schließen', onclick: () => document.getElementById(id)?.remove() }, '✕');
    // CSS einmal parsen und an jeden Shadow Root hängen (statt bei jedem Panel-Neubau ein <style> neu zu parsen); Rückfall: <style>
    const sheet = sharedSheet();
    let styled = false;
    if (sheet) { try { root.adoptedStyleSheets = [sheet]; styled = true; } catch {} }
    box.append(...(styled ? [] : [h('style', {}, CSS)]),
      h('div', { class: 'head' }, h('b', { class: 'brand' }, 'Stay', h('span', {}, 'Match'), ' · ', title), h('div', {}, toggle, ' ', close)),
      h('div', { class: 'body' }, bodyNodes));
    root.append(box);
  }

  // ---------- Router: Airbnb wechselt Seiten ohne Neuladen ----------
  // ---------- Tastenkürzel (Alt+Shift+Buchstabe, nicht beim Tippen in Feldern). Module tragen ihre Tasten ein. ----------
  const keys = {};
  function onKey(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
    if (e.repeat) return; // gehaltene Taste toggelt nicht im Dauertakt
    const t = e.composedPath?.()[0] || e.target;
    if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || '')) return;
    const act = keys[e.code];
    if (act) { e.preventDefault(); act(); }
  }
  keys.KeyM = () => { for (const id of ['sm-search', 'sm-room']) { const box = rootOf(id)?.querySelector('.box'); if (box) { box.classList.toggle('min'); chrome.storage.local.set({ ['min:' + id]: box.classList.contains('min') }); } } };
  document.addEventListener('keydown', onKey, true);

    // Kartenverschieben und Zoomen ändert nur diese Parameter; das ist keine neue Suche (Panel und Budgeteingabe bleiben)
  const MAP_PARAMS = ['ne_lat', 'ne_lng', 'sw_lat', 'sw_lng', 'zoom', 'zoom_level', 'center_lat', 'center_lng', 'search_by_map', 'map_toggle', 'viewport_width', 'viewport_height', 'update_selected_filters'];
  const searchKey = () => { const u = new URL(location.href); MAP_PARAMS.forEach(k => u.searchParams.delete(k)); u.hash = ''; return u.href; };
  const SMC = window.StayMatchContent = { ready, isPaused, SCHEMA, migrateListing, rootOf, searchKey, getListing, saveListing, allListings, getTrip, tasteFrom, h, panel, copyText, settings, settingsListeners, keys, T, REPORT_URL, SCAM_HELP_URL, search: null, room: null, start };
  function start() {
    // R7: fehlt ein Seiten-Modul (Syntaxfehler, halbes Update), nicht in jedem route() stumm werfen
    if (!SMC.search || !SMC.room) {
      console.debug('StayMatch: Modul fehlt', { search: !!SMC.search, room: !!SMC.room });
      if (/^\/s\//.test(location.pathname) || P.ROOM_RE.test(location.pathname)) panel('sm-error', 'Plugin unvollständig', [h('div', { class: 'err' }, 'Ein Teil des Plugins wurde nicht geladen. Bitte das Plugin unter chrome://extensions neu laden.')]);
      return;
    }
    let lastUrl = '', lastKey = '', debounce = null, emptyTimer = null;
    const relevant = () => /^\/s\//.test(location.pathname) || P.ROOM_RE.test(location.pathname);
    function route() {
      const path = location.pathname;
      const roomId = path.match(P.ROOM_RE)?.[1];
      if (location.href !== lastUrl) {
        const key = searchKey();
        lastUrl = location.href;
        if (key !== lastKey) { lastKey = key; SMC.search.reset(); } else if (/^\/s\//.test(path)) { SMC.search.handle().catch(e => console.debug('StayMatch:', e)); return; }
        clearTimeout(emptyTimer);
        if (!roomId) document.getElementById('sm-room')?.remove();
        if (!/^\/s\//.test(path)) { document.getElementById('sm-search')?.remove(); document.getElementById('sm-error')?.remove(); }
        if (roomId) setTimeout(() => SMC.room.handle(roomId).catch(e => console.debug('StayMatch:', e)), T.roomDelay ?? 2000);
        else if (/^\/s\//.test(path)) emptyTimer = setTimeout(() => SMC.search.checkEmpty(), T.diagDelay ?? 9000);
      }
      if (/^\/s\//.test(path)) SMC.search.handle().catch(e => console.debug('StayMatch:', e));
    }
    SMC.route = route;
    new MutationObserver(muts => {
      // eigene Änderungen ignorieren
      const ours = n => n?.nodeType === 1 && !!n.closest('[data-staymatch]');
      if (!relevant() && location.href === lastUrl) return; // andere Airbnb-Seiten: nichts tun
      if (muts.every(m => ours(m.target) || (m.addedNodes.length && [...m.addedNodes].every(ours)))) return;
      clearTimeout(debounce); debounce = setTimeout(route, T.debounce ?? 700);
    }).observe(document.body, { childList: true, subtree: true });
    // Seitenwechsel ohne Neuladen: Navigation API (Chrome 102+), sonst Rückfall auf langsames Abfragen
    // R7: mit Navigation API kein zusätzliches popstate (sonst lief route() bei Zurück doppelt)
    if (window.navigation?.addEventListener) window.navigation.addEventListener('navigatesuccess', () => route());
    else { setInterval(() => { if (location.href !== lastUrl) route(); }, 1000); window.addEventListener('popstate', () => route()); }
    T.api = { route, handleSearch: () => SMC.search.handle(), handleRoom: id => SMC.room.handle(id), checkEmpty: () => SMC.search.checkEmpty(), onKey };
    route();
  }
})();
