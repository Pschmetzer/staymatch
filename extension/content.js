// StayMatch – läuft auf Airbnb-Seiten, die du selbst öffnest.
// Suchseite: bewertet alle sichtbaren Unterkünfte und zeigt die Top 3.
// Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte.
// Keine eigenen Anfragen an Airbnb, kein Abfangen von Airbnb-Daten, alles lokal.
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank;
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
      minRating: (r => r.length ? Math.min(...r) - 0.05 : null)(liked.map(i => i.rating).filter(Boolean)),
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
    ul { margin: 4px 0 0; padding-left: 16px; } li.warn { color: var(--warn); }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; } .chips button { font-size: 12px; padding: 3px 8px; }
    textarea { width: 100%; box-sizing: border-box; height: 52px; border: 1px solid var(--line); border-radius: 8px; padding: 6px; font: 12px system-ui; background: var(--bg); color: var(--fg); }
    .row { display: flex; gap: 6px; margin: 6px 0; } .row button { flex: 1; }
  `;

  // Geschlossen bleibt geschlossen, bis eine andere Suche bzw. Unterkunft geöffnet wird (nicht bei jedem Nachladen)
  const closed = {};
  const closeKey = () => location.pathname + '|' + new URLSearchParams(location.search).get('checkin');
  const isClosed = id => closed[id] && closed[id] === closeKey();
  // In schmalen Fenstern standardmäßig eingeklappt, damit Airbnbs eigene Leisten frei bleiben
  const defaultMin = stored => stored ?? window.innerWidth < 900;

  function panel(id, title, bodyNodes, { minimized = false } = {}) {
    if (isClosed(id)) return;
    const root = host(id);
    root.replaceChildren();
    const box = h('div', { class: 'box' + (minimized ? ' min' : ''), role: 'dialog', 'aria-label': title });
    const toggle = h('button', { 'aria-label': 'Ein- oder ausklappen', onclick: () => { box.classList.toggle('min'); chrome.storage.local.set({ ['min:' + id]: box.classList.contains('min') }); } }, '–');
    const close = h('button', { 'aria-label': 'Schließen', onclick: () => { closed[id] = closeKey(); document.getElementById(id)?.remove(); } }, '✕');
    box.append(h('style', {}, CSS),
      h('div', { class: 'head' }, h('b', { class: 'brand' }, 'Stay', h('span', {}, 'Match'), ' · ', title), h('div', {}, toggle, ' ', close)),
      h('div', { class: 'body' }, bodyNodes));
    root.append(box);
  }

  // ---------- Suchseite ----------
  const FILTERS = [['rating', '⭐ ab 4,7'], ['budget', '💶 im Budget'], ['beds', '🛏️ genug Betten'], ['fav', '🏅 Favorit/Superhost']];
  let lastSig = '', lastView = null, filters = {}, settings = { showBadges: true };

  function passes(l) {
    if (filters.rating && !(l.rating >= 4.7)) return false;
    // ohne bekanntes Budget kann der Filter nichts aussortieren (sonst bliebe nach einer Suche ohne Reise alles leer)
    if (filters.budget && lastView?.ctx?.budget && !(l.rank.parts.price != null && l.rank.parts.price >= 0.75)) return false;
    if (filters.beds && l.rank.parts.beds != null && l.rank.parts.beds < 1) return false; // unbekannt zählt als ok
    if (filters.fav && !(l.badges || []).some(x => /favorit|superhost/i.test(x))) return false;
    return true;
  }

  async function handleSearch() {
    const listings = P.parseSearch(document);
    if (!listings.length) return;
    const sig = location.href + '|' + listings.map(l => l.id).join(',');
    if (sig === lastSig) { if (lastView) applyBadges(); return; } // Panel nicht neu bauen, aber Plaketten nach Airbnb-Neuaufbau wieder setzen
    lastSig = sig;

    const sp = P.searchParams(location.href);
    // Reise nur nutzen, wenn sie zu dieser Suche passt (gleiches Datum oder Unterkünfte nahe den Vierteln)
    const savedTrip = await getTrip();
    // Gleiches Datum allein reicht nicht (sonst bewertet Barcelona Lissabon): Unterkünfte nahe den Vierteln oder Stadtname in der URL
    const near = savedTrip && listings.some(l => l.lat != null && R.areaFor({ lat: l.lat, lon: l.lon }, savedTrip.areas || []));
    const norm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sameCity = savedTrip?.city && sp.place && norm(sp.place).includes(norm(savedTrip.city));
    const anyCoords = listings.some(l => l.lat != null);
    const trip = savedTrip && (near || (sameCity && !anyCoords) || (sameCity && sp.checkin === savedTrip.checkin)) ? savedTrip : null;
    const items = await allListings();
    const seen = new Set(items.map(i => i.id));
    const disliked = new Set(items.filter(i => i.vote === -1).map(i => i.id));
    const people = sp.adults || trip?.people?.length || null; // Gästezahl auf Airbnb ist aktueller als die Reise
    const nights = sp.nights || trip?.nights || null;
    // Andere Nächte als im Viertel-Finder: Budget pro Nacht hochrechnen
    const budget = trip?.budget ? (trip.nights && nights && nights !== trip.nights ? Math.round(trip.budget / trip.nights * nights) : trip.budget) : null;
    const ctx = { people, nights, budget, areas: trip?.areas || [], taste: tasteFrom(items), seen, disliked, lang: document.documentElement.lang || navigator.language };
    const ranked = R.rankListings(listings, ctx);

    const stored = await chrome.storage.local.get(['filters', 'settings', 'min:sm-search']);
    filters = stored.filters || {};
    settings = { showBadges: true, ...(stored.settings || {}) };
    lastView = { ranked, ctx, disliked, trip, count: listings.length, min: defaultMin(stored['min:sm-search']) };

    // Empfehlungen für das Popup merken (nur die eigene Auswahl, lokal)
    chrome.storage.local.set({ lastSearch: { at: Date.now(), url: location.href, nights, people, top: ranked.slice(0, 10).map(l => ({ id: l.id, title: l.title, kind: l.kind, locality: l.locality, rating: l.rating, reviewCount: l.reviewCount, totalPrice: R.stayTotal(l, nights), perNight: R.perNight(l, nights), currency: l.currency, score: l.rank.score, why: l.rank.why, warn: l.rank.warn, url: `${location.origin}/rooms/${l.id}${location.search}` })) } });

    applyBadges();
    renderSearch();
  }

  function renderSearch() {
    const { ranked, ctx, disliked, trip, count } = lastView;
    const old = document.getElementById('sm-search')?.shadowRoot?.querySelector('.box');
    const minimized = old ? old.classList.contains('min') : lastView.min;
    const top = ranked.filter(l => !disliked.has(l.id) && passes(l)).slice(0, 3);
    const bd = l => [['Viertel', 'area'], ['Sterne', 'rating'], ['Preis', 'price'], ['Betten', 'beds']]
      .filter(([, k]) => l.rank.parts[k] != null).map(([n, k]) => `${n} ${Math.round(l.rank.parts[k] * 100)}`).join(' · ');
    panel('sm-search', 'Top 3 für euch', [
      !trip ? h('div', { class: 'muted' }, 'Tipp: Erst im Viertel-Finder suchen, dann kennt StayMatch eure Gruppe, das Budget und die Viertel.') : null,
      h('div', { class: 'muted' }, `${count} Unterkünfte auf dieser Seite bewertet${ctx.people ? ` · ${ctx.people} Personen` : ''}${ctx.nights ? ` · ${ctx.nights} Nächte` : ''}${ctx.budget ? ` · Budget ${ctx.budget} €${trip?.nights && ctx.nights !== trip.nights ? ` (auf ${ctx.nights} Nächte umgerechnet)` : ''}` : ''}`),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' }, FILTERS.map(([k, label]) => h('button', {
        class: filters[k] ? 'on' : '', 'aria-pressed': String(!!filters[k]),
        ...(k === 'budget' && !ctx.budget ? { disabled: '', title: 'Kein Budget bekannt. Erst den Viertel-Finder nutzen.', style: 'opacity:.5;cursor:not-allowed' } : {}),
        onclick: async () => { filters[k] = !filters[k]; await chrome.storage.local.set({ filters }); applyBadges(); renderSearch(); },
      }, label))),
      top.length ? top.map((l, i) => h('div', { class: 'item' },
        h('span', { class: 'score', title: 'Passt-Wert 0–100' }, l.rank.score),
        h('a', { href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener' }, `${i + 1}. ${l.title || l.kind}`),
        h('div', { class: 'muted' }, [l.kind, l.locality].filter(Boolean).join(' · ')),
        h('ul', {}, l.rank.why.map(w => h('li', {}, w)), l.rank.warn.map(w => h('li', { class: 'warn' }, '⚠️ ' + w))),
        h('div', { class: 'muted' }, 'Zusammensetzung: ' + bd(l))))
        : h('div', { class: 'muted' }, 'Keine Unterkunft auf dieser Seite erfüllt alle Filter. Filter lockern oder weiterblättern.'),
      h('div', { class: 'muted' }, 'Blättern oder Karte verschieben → neue Unterkünfte werden automatisch mitbewertet.'),
    ], { minimized });
  }

  // Punkte direkt an den Karten (abschaltbar im Popup). Markiert, damit der MutationObserver sie ignoriert.
  function applyBadges() {
    if (!lastView) return;
    const byId = new Map(lastView.ranked.map(l => [l.id, l]));
    for (const card of document.querySelectorAll('[data-testid="card-container"]')) {
      const id = card.querySelector('a[href*="/rooms/"]')?.getAttribute('href')?.match(P.ROOM_RE)?.[1];
      const l = id && byId.get(id);
      let b = card.querySelector('[data-staymatch-badge]');
      if (!l || !settings.showBadges) { b?.remove(); if (!settings.showBadges) card.style.opacity = ''; continue; }
      if (!b) {
        b = h('div', { 'data-staymatch-badge': '1', 'data-staymatch': '1' });
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(b);
      }
      const s = l.rank.score;
      const bg = s >= 75 ? '#1f9d6b' : s >= 55 ? '#d68a00' : '#9a9aa0';
      b.style.cssText = `position:absolute;right:52px;top:12px;z-index:3;background:${bg};color:#fff;font:600 12px system-ui;padding:3px 8px;border-radius:999px;pointer-events:none`;
      b.textContent = `StayMatch ${s}`;
      b.setAttribute('role', 'img'); b.setAttribute('aria-label', `StayMatch-Wert ${s} von 100`);
      b.title = [...l.rank.why, ...l.rank.warn].join(' · ');
      card.style.opacity = l.rank.warn.some(w => w.includes('👎')) ? '0.45' : !passes(l) ? '0.35' : '';
    }
  }
  chrome.storage.onChanged?.addListener(ch => { if (ch.settings) { settings = { showBadges: true, ...(ch.settings.newValue || {}) }; applyBadges(); } });

  // ---------- Unterkunftsseite ----------
  function roomData(id) {
    let ld = {};
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { const j = JSON.parse(s.textContent); for (const x of [].concat(j)) if (x.aggregateRating || x.geo) { ld = x; break; } } catch {}
    }
    const meta = n => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content;
    const sp = P.searchParams(location.href);
    // Preis nur aus dem Buchungsbereich, nicht aus "ähnliche Unterkünfte"
    const book = document.querySelector('[data-testid="book-it-default"], [data-section-id="BOOK_IT_SIDEBAR"], [data-plugin-in-point-id="BOOK_IT_SIDEBAR"]');
    const priceText = book?.innerText || '';
    // "120 € pro Nacht" und "$120 night" / "€120 per night"
    const AMT = '(\\d[\\d.,\\s\\u00a0\\u202f]*?)', CUR = '(€|CHF|£|\\$)';
    const priceM = words => { const w = `\\s?(?:${words})`;
      const a = priceText.match(new RegExp(AMT + '\\s?' + CUR + w, 'i')); if (a) return a;
      const b = priceText.match(new RegExp(CUR + '\\s?' + AMT + w, 'i')); return b ? [b[0], b[2], b[1]] : null; };
    const nightM = priceM('pro Nacht|Nacht|per night|a night|night');
    const totalM = priceM('insgesamt|gesamt|total');
    // Selektoren können verschachtelt treffen → nur äußerste Elemente, sonst zählt eine Bewertung doppelt
    const revEls = [...document.querySelectorAll('[data-review-id], [data-testid*="review"], [data-section-id*="REVIEWS"] [role="listitem"]')];
    const reviews = revEls.filter(e => !revEls.some(o => o !== e && o.contains(e))).map(e => e.innerText).join('\n');
    return {
      id, url: location.origin + location.pathname,
      title: ld.name || meta('og:title') || document.title,
      image: meta('og:image') || null,
      rating: ld.aggregateRating?.ratingValue ? +ld.aggregateRating.ratingValue : null,
      reviewCount: +(ld.aggregateRating?.ratingCount || ld.aggregateRating?.reviewCount || 0) || null,
      lat: ld.geo?.latitude ?? null, lon: ld.geo?.longitude ?? null,
      locality: ld.address?.addressLocality || null,
      pricePerNight: nightM ? P.num(nightM[1]) : totalM && sp.nights ? Math.round(P.num(totalM[1]) / sp.nights) : null,
      currency: (nightM || totalM)?.[2] || null,
      checkin: sp.checkin, checkout: sp.checkout,
      hints: reviews ? P.reviewHints(reviews) : [],
    };
  }

  let roomTimer = null;
  async function handleRoom(id) {
    const old = await getListing(id);
    const recent = old && Date.now() - old.lastSeen < 30 * 60 * 1000; // Reload ≠ neuer Besuch
    const data = roomData(id);
    // fehlende Felder nicht mit null überschreiben
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
    // Verlauf pro Reisezeitraum: Mai und August nicht vergleichen
    const period = (data.checkin || '') + '_' + (data.checkout || '');
    const priceHistory = [...(old?.priceHistory || [])];
    const last = priceHistory.filter(x => (x.k || '_') === period).at(-1);
    if (data.pricePerNight && last?.p !== data.pricePerNight) priceHistory.push({ t: Date.now(), p: data.pricePerNight, k: period });
    const item = await saveListing(id, { ...clean, priceHistory: priceHistory.slice(-30), visits: (old?.visits || 0) + (recent ? 0 : 1) });
    const trip = await getTrip();
    const area = trip?.areas?.length ? R.areaFor(item, trip.areas) : null;
    const st = await chrome.storage.local.get('min:sm-room');
    roomPanel(item, area, period, defaultMin(st['min:sm-room']));
  }

  function roomPanel(item, area, period, minimized) {
    const vote = v => async () => {
      const cur = document.getElementById('sm-room')?.shadowRoot?.querySelector('.box')?.classList.contains('min');
      roomPanel(await saveListing(item.id, { vote: item.vote === v ? 0 : v }), area, period, cur ?? minimized); // 2. Klick hebt auf
    };
    const note = h('textarea', { placeholder: 'Notiz: was gefällt / stört?', 'aria-label': 'Notiz' });
    note.value = item.note || ''; // value statt innerHTML → kein Code-Einschleusen
    note.oninput = () => { clearTimeout(roomTimer); roomTimer = setTimeout(() => saveListing(item.id, { note: note.value }), 400); };
    const ph = (item.priceHistory || []).filter(x => (x.k || '_') === period);
    const change = ph.length > 1 ? Math.round((ph.at(-1).p / ph[0].p - 1) * 100) : 0;
    panel('sm-room', item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier', [
      h('div', {}, item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : 'Noch keine Sterne gefunden'),
      area ? h('div', {}, `Viertel ${area.name}: ${area.total}/100 für eure Gruppe`) : null,
      item.hints?.length ? h('div', { class: 'muted' }, 'Aus den Bewertungen: ' + item.hints.join(' · ')) : null,
      change ? h('div', { class: 'muted' }, `Preis seit dem ersten Besuch ${change > 0 ? '+' : ''}${change} %`) : null,
      h('div', { class: 'row' },
        h('button', { class: item.vote === 1 ? 'on' : '', onclick: vote(1) }, '👍 Gefällt mir'),
        h('button', { class: item.vote === -1 ? 'on' : '', onclick: vote(-1) }, '👎 Nein')),
      note,
    ], { minimized });
  }

  // ---------- Router: Airbnb wechselt Seiten ohne Neuladen ----------
  let lastUrl = '', debounce = null;
  function route() {
    const path = location.pathname;
    const roomId = path.match(P.ROOM_RE)?.[1];
    if (location.href !== lastUrl) {
      lastUrl = location.href; lastSig = ''; lastView = null;
      if (!roomId) document.getElementById('sm-room')?.remove();
      if (!/^\/s\//.test(path)) document.getElementById('sm-search')?.remove();
      if (roomId) setTimeout(() => handleRoom(roomId).catch(e => console.debug('StayMatch:', e)), 2000);
    }
    if (/^\/s\//.test(path)) handleSearch().catch(e => console.debug('StayMatch:', e));
  }
  new MutationObserver(muts => {
    // eigene Änderungen ignorieren
    const ours = n => n?.nodeType === 1 && !!n.closest('[data-staymatch]');
    if (muts.every(m => ours(m.target) || (m.addedNodes.length && [...m.addedNodes].every(ours)))) return;
    clearTimeout(debounce); debounce = setTimeout(route, 700);
  }).observe(document.body, { childList: true, subtree: true });
  setInterval(() => { if (location.href !== lastUrl) route(); }, 1000);
  route();
})();
