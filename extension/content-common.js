// StayMatch – läuft auf Airbnb-Seiten, die du selbst öffnest.
// Suchseite: bewertet alle sichtbaren Unterkünfte und zeigt die Top 3.
// Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte.
// Keine eigenen Anfragen an Airbnb, kein Abfangen von Airbnb-Daten, alles lokal.
// Dateien (Reihenfolge in manifest.json): core.js, parse.js, rank.js, content-common.js, content-search.js, content-listing.js.
// content-common.js: Speicher, DOM-Helfer, Panel und Router. Die Seiten-Module tragen sich in window.StayMatchContent ein,
// content-listing.js startet zuletzt den Router.
(() => {
  const P = window.StayMatchParse;
  const KEY = id => 'l:' + id;

  // ---------- Speicher (ein Schlüssel pro Unterkunft, damit Tabs sich nicht überschreiben) ----------
  async function getListing(id) { return (await chrome.storage.local.get(KEY(id)))[KEY(id)] || null; }
  async function saveListing(id, patch) {
    const old = (await getListing(id)) || { id, firstSeen: Date.now(), visits: 0 };
    const item = { ...old, ...patch, id, lastSeen: Date.now() };
    await chrome.storage.local.set({ [KEY(id)]: item });
    return item;
  }
  async function allListings() {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all).filter(([k]) => k.startsWith('l:')).map(([, v]) => v);
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

  function host(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = h('div', { id, 'data-staymatch': '1' });
      el.attachShadow({ mode: 'open' });
      document.documentElement.appendChild(el);
    }
    return el.shadowRoot;
  }

  const CSS = `
    :host { all: initial; }
    .box { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; width: 320px; max-height: 70vh; overflow: auto;
      background: var(--bg); color: var(--fg); border: 1px solid var(--line); border-radius: 14px; padding: 12px 14px;
      font: 13px/1.45 system-ui, -apple-system, sans-serif; box-shadow: 0 8px 28px rgba(0,0,0,.18);
      --bg: #fff; --fg: #1d1d1f; --muted: #6b6b70; --line: #e4e2dc; --accent: #e0475b; --good: #1f9d6b; --warn: #b86e00; }
    @media (prefers-color-scheme: dark) { .box { --bg: #1e1e22; --fg: #f2f2f4; --muted: #a0a0a8; --line: #34343a; } }
    .box.min .body { display: none; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    b.brand span { color: var(--accent); }
    button { font: inherit; color: inherit; background: none; border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; cursor: pointer; }
    button.on { background: var(--accent); color: #fff; border-color: var(--accent); }
    button:focus-visible, a:focus-visible, textarea:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .muted { color: var(--muted); font-size: 12px; }
    .item { border-top: 1px solid var(--line); padding: 8px 0; }
    .item a { color: var(--fg); font-weight: 600; text-decoration: none; }
    .score { float: right; font-weight: 700; font-size: 16px; }
    ul { margin: 4px 0 0; padding-left: 16px; } li.warn, div.warn { color: var(--warn); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; } .chips button { font-size: 12px; padding: 3px 8px; }
    textarea { width: 100%; box-sizing: border-box; height: 52px; border: 1px solid var(--line); border-radius: 8px; padding: 6px; font: 12px system-ui; background: var(--bg); color: var(--fg); }
    .row { display: flex; gap: 6px; margin: 6px 0; } .row button { flex: 1; }
  `;

  function panel(id, title, bodyNodes, { minimized = false } = {}) {
    const root = host(id);
    root.replaceChildren();
    const box = h('div', { class: 'box' + (minimized ? ' min' : ''), role: 'dialog', 'aria-label': title });
    const toggle = h('button', { 'aria-label': 'Ein- oder ausklappen', onclick: () => { box.classList.toggle('min'); chrome.storage.local.set({ ['min:' + id]: box.classList.contains('min') }); } }, '–');
    const close = h('button', { 'aria-label': 'Schließen', onclick: () => document.getElementById(id)?.remove() }, '✕');
    box.append(h('style', {}, CSS),
      h('div', { class: 'head' }, h('b', { class: 'brand' }, 'Stay', h('span', {}, 'Match'), ' · ', title), h('div', {}, toggle, ' ', close)),
      h('div', { class: 'body' }, bodyNodes));
    root.append(box);
  }

  // ---------- Router: Airbnb wechselt Seiten ohne Neuladen ----------
  const SMC = window.StayMatchContent = { getListing, saveListing, allListings, getTrip, tasteFrom, h, panel, search: null, room: null, start };
  function start() {
    let lastUrl = '', debounce = null;
    function route() {
      const path = location.pathname;
      const roomId = path.match(P.ROOM_RE)?.[1];
      if (location.href !== lastUrl) {
        lastUrl = location.href; SMC.search.reset();
        if (!roomId) document.getElementById('sm-room')?.remove();
        if (!/^\/s\//.test(path)) document.getElementById('sm-search')?.remove();
        if (roomId) setTimeout(() => SMC.room.handle(roomId).catch(e => console.debug('StayMatch:', e)), 2000);
      }
      if (/^\/s\//.test(path)) SMC.search.handle().catch(e => console.debug('StayMatch:', e));
    }
    new MutationObserver(muts => {
      // eigene Änderungen ignorieren
      const ours = n => n?.nodeType === 1 && !!n.closest('[data-staymatch]');
      if (muts.every(m => ours(m.target) || (m.addedNodes.length && [...m.addedNodes].every(ours)))) return;
      clearTimeout(debounce); debounce = setTimeout(route, 700);
    }).observe(document.body, { childList: true, subtree: true });
    setInterval(() => { if (location.href !== lastUrl) route(); }, 1000);
    route();
  }
})();
