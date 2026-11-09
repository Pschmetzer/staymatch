// StayMatch – läuft auf Airbnb-Seiten, die du selbst öffnest.
// Suchseite: bewertet alle sichtbaren Unterkünfte und zeigt die Top 3.
// Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte.
// Keine eigenen Anfragen an Airbnb, kein Abfangen von Airbnb-Daten, alles lokal.
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, H = window.StayMatchHints, POOL = window.StayMatchPool;
  const T = window.__STAYMATCH_TEST__ || {}; // nur in Tests gesetzt (Zeiten kürzen, Funktionen erreichen)
  const REPORT_URL = 'https://github.com/pschmetzer/staymatch/issues/new';
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

  // Panel-Design: automatisch (System), hell oder dunkel – einstellbar im Popup
  const themeClass = () => settings.theme === 'dark' ? ' dark' : settings.theme === 'light' ? ' light' : '';
  function applyTheme() {
    for (const id of ['sm-search', 'sm-room']) {
      const box = document.getElementById(id)?.shadowRoot?.querySelector('.box');
      if (box) { box.classList.toggle('dark', settings.theme === 'dark'); box.classList.toggle('light', settings.theme === 'light'); }
    }
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

  function panel(id, title, bodyNodes, opts = {}) {
    const { minimized = false } = opts;
    const root = host(id);
    root.replaceChildren();
    const box = h('div', { class: 'box' + (minimized ? ' min' : '') + themeClass() + (opts.wide ? ' wide' : ''), role: 'dialog', 'aria-label': title });
    const toggle = h('button', { 'aria-label': 'Ein- oder ausklappen', onclick: () => { box.classList.toggle('min'); chrome.storage.local.set({ ['min:' + id]: box.classList.contains('min') }); } }, '–');
    const close = h('button', { 'aria-label': 'Schließen', onclick: () => document.getElementById(id)?.remove() }, '✕');
    box.append(h('style', {}, CSS),
      h('div', { class: 'head' }, h('b', { class: 'brand' }, 'Stay', h('span', {}, 'Match'), ' · ', title), h('div', {}, toggle, ' ', close)),
      h('div', { class: 'body' }, bodyNodes));
    root.append(box);
  }

  // ---------- Suchseite ----------
  const FILTERS = [['rating', '⭐ ab 4,7'], ['budget', '💶 im Budget'], ['beds', '🛏️ genug Betten'], ['fav', '🏅 Favorit/Superhost']];
  let lastSig = '', lastView = null, filters = {}, settings = { showBadges: true, theme: 'auto' };
  let compareMode = false, flash = '';

  function passes(l) {
    if (filters.rating && !(l.rating >= 4.7)) return false;
    // ohne bekanntes Budget kann der Filter nichts aussortieren (sonst bliebe nach einer Suche ohne Reise alles leer)
    if (filters.budget && lastView?.ctx?.budget && !(l.rank.parts.price != null && l.rank.parts.price >= 0.75)) return false;
    if (filters.beds && l.rank.parts.beds != null && l.rank.parts.beds < 1) return false; // unbekannt zählt als ok
    if (filters.fav && !(l.badges || []).some(x => /favorit|superhost/i.test(x))) return false;
    return true;
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch {}
    try { // Rückfall, falls die Seite die Zwischenablage-Schnittstelle sperrt
      const ta = h('textarea', { 'data-staymatch': '1', style: 'position:fixed;left:-999px;top:0' });
      ta.value = text; document.body.append(ta); ta.select();
      const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }

  function currentTop() {
    if (!lastView) return [];
    return lastView.ranked.filter(l => !lastView.disliked.has(l.id) && passes(l)).slice(0, 3);
  }

  async function copyTop() {
    const top = currentTop();
    if (!top.length) return;
    const url = l => `${location.origin}/rooms/${l.id}${location.search}`;
    const { ctx } = lastView;
    const text = R.shareText(top.map(l => ({ ...l, score: l.rank.score, url: url(l) })), {
      title: 'Unsere Top 3 (StayMatch)',
      sub: [ctx.people && `${ctx.people} Personen`, ctx.nights && `${ctx.nights} Nächte`, ctx.budget && `Budget ${ctx.budget} €`].filter(Boolean).join(' · '),
    });
    flash = (await copyText(text)) ? 'Kopiert ✓ – jetzt in den Gruppenchat einfügen' : 'Kopieren ging nicht (Seite blockiert die Zwischenablage)';
    renderSearch();
    setTimeout(() => { flash = ''; if (lastView) renderSearch(); }, 3500);
  }

  async function handleSearch() {
    const current = P.parseSearch(document);
    if (!current.length) return; // leeres Ergebnis meldet checkEmpty() nach einer Wartezeit
    const sig = location.href + '|' + current.map(l => l.id).join(',');
    if (sig === lastSig) { if (lastView) applyBadges(); return; } // Panel nicht neu bauen, aber Plaketten nach Airbnb-Neuaufbau wieder setzen
    lastSig = sig;
    document.getElementById('sm-error')?.remove();

    const sp = P.searchParams(location.href);
    // Seiten, die du nacheinander öffnest (Blättern), gemeinsam ranken. Nichts wird von selbst geladen.
    const stored = await chrome.storage.local.get(['filters', 'settings', 'min:sm-search', 'pool']);
    const pool = POOL.mergePool(stored.pool, location.href, current);
    chrome.storage.local.set({ pool }).catch?.(() => {});
    const byId = new Map(current.map(l => [l.id, l]));
    const listings = Object.values(pool.items).map(p => byId.get(p.id) || p);

    // Reise nur nutzen, wenn sie zu dieser Suche passt (gleiches Datum oder Unterkünfte nahe den Vierteln)
    const savedTrip = await getTrip();
    const trip = savedTrip && ((sp.checkin && sp.checkin === savedTrip.checkin) ||
      listings.some(l => l.lat != null && R.areaFor({ lat: l.lat, lon: l.lon }, savedTrip.areas || []))) ? savedTrip : null;
    const items = await allListings();
    const seen = new Set(items.map(i => i.id));
    const disliked = new Set(items.filter(i => i.vote === -1).map(i => i.id));
    const known = new Map(items.map(i => [i.id, i]));
    const people = trip?.people?.length || sp.adults || null;
    const nights = sp.nights || trip?.nights || null;
    const ctx = { people, nights, budget: trip?.budget || null, areas: trip?.areas || [], taste: tasteFrom(items), seen, disliked, known };
    const ranked = R.rankListings(listings, ctx);

    filters = stored.filters || {};
    settings = { showBadges: true, theme: 'auto', ...(stored.settings || {}) };
    lastView = { ranked, ctx, disliked, trip, count: listings.length, pages: pool.pages.length, quality: P.quality(current), min: !!stored['min:sm-search'] };

    // Empfehlungen für das Popup merken (nur die eigene Auswahl, lokal)
    chrome.storage.local.set({ lastSearch: { at: Date.now(), url: location.href, nights, people, top: ranked.slice(0, 10).map(l => ({ id: l.id, title: l.title, kind: l.kind, locality: l.locality, rating: l.rating, reviewCount: l.reviewCount, totalPrice: l.totalPrice, currency: l.currency, score: l.rank.score, why: l.rank.why, warn: l.rank.warn, stay: l.rank.stay, ppnPerson: l.rank.ppn?.person ?? null, url: `${location.origin}/rooms/${l.id}` })) } });

    applyBadges();
    renderSearch();
  }

  // Nach einer Wartezeit noch keine Unterkünfte gelesen → klare Meldung statt leerem Panel
  function checkEmpty() {
    if (!/^\/s\//.test(location.pathname) || lastView) return;
    const d = P.diagnose(document);
    if (P.parseSearch(document).length) return handleSearch().catch(() => {});
    const ver = chrome.runtime?.getManifest?.().version || '?';
    const report = `StayMatch ${ver}\nStaat: ${d.stateNote} (${d.stateCount})\nKarten: ${d.cards}\nLinks: ${d.roomLinks}`; // ohne URL und ohne Seiteninhalt
    panel('sm-error', 'Seite nicht verstanden', [
      h('div', { class: 'err' }, h('b', {}, 'Ich verstehe diese Seite nicht (mehr).'), h('div', {}, P.diagnosisText(d))),
      h('div', { class: 'muted' }, `Daten im Seitenquelltext: ${d.stateNote} · Karten: ${d.cards} · Links zu Unterkünften: ${d.roomLinks}`),
      h('div', { class: 'row' },
        h('button', { onclick: async e => { e.target.textContent = (await copyText(report)) ? 'Kopiert ✓' : 'Nicht möglich'; } }, 'Diagnose kopieren'),
        h('a', { class: 'btn', href: `${REPORT_URL}?title=${encodeURIComponent('Plugin versteht Suchseite nicht')}&body=${encodeURIComponent(report)}`, target: '_blank', rel: 'noopener' }, 'Fehler melden')),
      h('div', { class: 'muted' }, 'Die Diagnose enthält nur Zahlen, keine Adresse und keine Inhalte der Seite. Deine Unterkünfte bleiben unbewertet, bis das Plugin angepasst ist.'),
    ]);
  }

  function renderSearch() {
    const { ranked, ctx, disliked, trip, count, pages, quality: q } = lastView;
    const old = document.getElementById('sm-search')?.shadowRoot?.querySelector('.box');
    const minimized = old ? old.classList.contains('min') : lastView.min;
    const top = currentTop();
    const bd = l => [['Viertel', 'area'], ['Sterne', 'rating'], ['Preis', 'price'], ['Betten', 'beds']]
      .filter(([, k]) => l.rank.parts[k] != null).map(([n, k]) => `${n} ${Math.round(l.rank.parts[k] * 100)}`).join(' · ');
    const cur = l => l.currency || '€';
    // Teilweise erkannt? Dann ehrlich sagen, was fehlt.
    const lacking = q && q.n >= 3 ? [q.noPrice > q.n / 2 && 'Preise', q.noRating > q.n / 2 && 'Sterne', q.noBeds > q.n / 2 && 'Betten'].filter(Boolean) : [];
    panel('sm-search', 'Top 3 für euch', [
      !trip ? h('div', { class: 'muted' }, 'Tipp: Erst im Viertel-Finder suchen, dann kennt StayMatch eure Gruppe, das Budget und die Viertel.') : null,
      h('div', { class: 'muted' }, `${count} Unterkünfte${pages > 1 ? ` von ${pages} Seiten, die du geöffnet hast,` : ' auf dieser Seite'} bewertet${ctx.people ? ` · ${ctx.people} Personen` : ''}${ctx.nights ? ` · ${ctx.nights} Nächte` : ''}${ctx.budget ? ` · Budget ${ctx.budget} €` : ''}`),
      lacking.length ? h('div', { class: 'err muted' }, `⚠️ ${lacking.join(', ')} bei den meisten Karten nicht gelesen. Airbnb hat vermutlich etwas geändert, die Wertung ist ungenauer.`) : null,
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' }, FILTERS.map(([k, label]) => h('button', {
        class: filters[k] ? 'on' : '', 'aria-pressed': String(!!filters[k]),
        ...(k === 'budget' && !ctx.budget ? { disabled: '', title: 'Kein Budget bekannt. Erst den Viertel-Finder nutzen.', style: 'opacity:.5;cursor:not-allowed' } : {}),
        onclick: async () => { filters[k] = !filters[k]; await chrome.storage.local.set({ filters }); applyBadges(); renderSearch(); },
      }, label))),
      top.length ? h('div', { class: 'row' },
        h('button', { class: compareMode ? 'on' : '', 'aria-pressed': String(compareMode), title: 'Alt+Shift+V', onclick: () => { compareMode = !compareMode; renderSearch(); } }, '⚖️ Vergleich'),
        h('button', { title: 'Alt+Shift+K', onclick: copyTop }, '📋 Top 3 kopieren')) : null,
      flash ? h('div', { class: 'muted', role: 'status' }, flash) : null,
      top.length && compareMode
        ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, ''), top.map((l, i) => h('th', {}, h('a', { href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener', style: 'color:inherit' }, `${i + 1}. ${(l.title || l.kind || '').slice(0, 28)}`))))),
          h('tbody', {}, R.compareRows(top, ctx).map(r => h('tr', {}, h('th', {}, r.label), r.cells.map(c => h('td', {}, c))))))
        : null,
      top.length && !compareMode ? top.map((l, i) => h('div', { class: 'item' },
        h('span', { class: 'score', title: 'Passt-Wert 0–100' }, l.rank.score),
        h('a', { href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener' }, `${i + 1}. ${l.title || l.kind}`),
        h('div', { class: 'muted' }, [l.kind, l.locality].filter(Boolean).join(' · ')),
        l.rank.ppn?.person ? h('div', {}, h('b', {}, `${l.rank.ppn.person} ${cur(l)}`), ' pro Person und Nacht') : null,
        h('ul', {}, l.rank.why.map(w => h('li', {}, w)), l.rank.warn.map(w => h('li', { class: 'warn' }, '⚠️ ' + w))),
        h('div', { class: 'muted' }, 'Zusammensetzung: ' + bd(l))))
        : !top.length ? h('div', { class: 'muted' }, 'Keine Unterkunft erfüllt alle Filter. Filter lockern oder weiterblättern.') : null,
      h('div', { class: 'muted' }, 'Blättern oder Karte verschieben → die Seiten, die du öffnest, werden zusammen bewertet. Es wird nichts von selbst nachgeladen.'),
      pages > 1 ? h('div', { class: 'row' }, h('button', { onclick: async () => { await chrome.storage.local.remove('pool'); lastSig = ''; lastView = null; route(); } }, 'Sammlung leeren')) : null,
      h('div', { class: 'muted' }, 'Tasten: Alt+Shift+V Vergleich · K kopieren · M ein-/ausklappen'),
    ], { minimized, wide: compareMode });
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
      const pp = l.rank.ppn?.person;
      b.textContent = `StayMatch ${s}${pp ? ` · ${pp} ${l.currency || '€'} p. P./Nacht` : ''}`;
      b.title = [...l.rank.why, ...l.rank.warn].join(' · ');
      card.style.opacity = l.rank.warn.some(w => w.includes('👎')) ? '0.45' : !passes(l) ? '0.35' : '';
    }
  }
  chrome.storage.onChanged?.addListener(ch => {
    if (ch.settings) { settings = { showBadges: true, theme: 'auto', ...(ch.settings.newValue || {}) }; applyBadges(); applyTheme(); }
  });
  chrome.storage.local.get('settings').then(r => { settings = { showBadges: true, theme: 'auto', ...(r.settings || {}) }; applyTheme(); }).catch(() => {});

  // ---------- Unterkunftsseite ----------
  const reviewHints = H.reviewHints;

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
    const nightM = priceText.match(/(\d[\d.,  ]*)\s?(€|CHF|£|\$)\s?(?:pro Nacht|Nacht|night)/i);
    const totalM = priceText.match(/(\d[\d.,  ]*)\s?(€|CHF|£|\$)\s?(?:insgesamt|gesamt|total)/i);
    const reviews = [...document.querySelectorAll('[data-review-id], [data-testid*="review"], [data-section-id*="REVIEWS"] [role="listitem"]')].map(e => e.innerText).join('\n');
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
      hints: reviews ? reviewHints(reviews) : [],
    };
  }

  const roomTimers = new Map(); // ein Timer pro Unterkunft
  let currentRoom = null;
  async function handleRoom(id) {
    const old = await getListing(id);
    const recent = old && Date.now() - old.lastSeen < 30 * 60 * 1000; // Reload ≠ neuer Besuch
    const data = roomData(id);
    // fehlende Felder nicht mit null überschreiben
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
    const priceHistory = [...(old?.priceHistory || [])];
    if (data.pricePerNight && priceHistory.at(-1)?.p !== data.pricePerNight) priceHistory.push({ t: Date.now(), p: data.pricePerNight });
    const item = await saveListing(id, { ...clean, priceHistory: priceHistory.slice(-30), visits: (old?.visits || 0) + (recent ? 0 : 1) });
    const trip = await getTrip();
    const area = trip?.areas?.length ? R.areaFor(item, trip.areas) : null;
    roomPanel(item, area, trip);
  }

  function roomPanel(item, area, trip) {
    currentRoom = { item, area, trip };
    const setVote = async v => roomPanel(await saveListing(item.id, { vote: item.vote === v ? 0 : v }), area, trip); // 2. Klick hebt auf
    currentRoom.setVote = setVote;
    const note = h('textarea', { placeholder: 'Notiz: was gefällt / stört?', 'aria-label': 'Notiz' });
    note.value = item.note || ''; // value statt innerHTML → kein Code-Einschleusen
    note.oninput = () => { clearTimeout(roomTimers.get(item.id)); roomTimers.set(item.id, setTimeout(() => saveListing(item.id, { note: note.value }), T.noteDelay ?? 400)); };
    const ph = item.priceHistory || [];
    const change = ph.length > 1 ? Math.round((ph.at(-1).p / ph[0].p - 1) * 100) : 0;
    const people = trip?.people?.length || null;
    const ppn = item.pricePerNight && people ? Math.round(item.pricePerNight / people) : null;
    const warns = H.warnings(item.hints);
    panel('sm-room', item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier', [
      h('div', {}, item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : 'Noch keine Sterne gefunden'),
      area ? h('div', {}, `Viertel ${area.name}: ${area.total}/100 für eure Gruppe`) : null,
      ppn ? h('div', {}, h('b', {}, `${ppn} ${item.currency || '€'}`), ' pro Person und Nacht') : null,
      warns.length ? h('div', { class: 'err' }, h('b', {}, 'Achtung aus den Bewertungen: '), warns.map(x => x.replace(/^⚠️\s*/, '')).join(' · ')) : null,
      item.hints?.length ? h('div', { class: 'muted' }, 'Aus den Bewertungen: ' + item.hints.join(' · ')) : null,
      change ? h('div', { class: 'muted' }, `Preis seit dem ersten Besuch ${change > 0 ? '+' : ''}${change} %`) : null,
      h('div', { class: 'row' },
        h('button', { class: item.vote === 1 ? 'on' : '', title: 'Alt+Shift+L', onclick: () => setVote(1) }, '👍 Gefällt mir'),
        h('button', { class: item.vote === -1 ? 'on' : '', title: 'Alt+Shift+N', onclick: () => setVote(-1) }, '👎 Nein')),
      note,
      h('div', { class: 'muted' }, 'Tasten: Alt+Shift+L 👍 · N 👎 · M ein-/ausklappen'),
    ]);
  }

  // ---------- Tastenkürzel (Alt+Shift+Buchstabe, nicht beim Tippen in Feldern) ----------
  function onKey(e) {
    if (!e.altKey || !e.shiftKey || e.ctrlKey || e.metaKey) return;
    const t = e.composedPath?.()[0] || e.target;
    if (t?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t?.tagName || '')) return;
    const roomPage = P.ROOM_RE.test(location.pathname);
    const act = {
      KeyL: () => roomPage && currentRoom?.setVote(1),
      KeyN: () => roomPage && currentRoom?.setVote(-1),
      KeyV: () => { if (!roomPage && lastView) { compareMode = !compareMode; renderSearch(); } },
      KeyK: () => { if (!roomPage && lastView) copyTop(); },
      KeyM: () => { for (const id of ['sm-search', 'sm-room']) document.getElementById(id)?.shadowRoot?.querySelector('.box')?.classList.toggle('min'); },
    }[e.code];
    if (act) { e.preventDefault(); act(); }
  }
  document.addEventListener('keydown', onKey, true);

  // ---------- Router: Airbnb wechselt Seiten ohne Neuladen ----------
  let lastUrl = '', debounce = null, emptyTimer = null;
  function route() {
    const path = location.pathname;
    const roomId = path.match(P.ROOM_RE)?.[1];
    if (location.href !== lastUrl) {
      lastUrl = location.href; lastSig = ''; lastView = null;
      clearTimeout(emptyTimer);
      if (!roomId) document.getElementById('sm-room')?.remove();
      if (!/^\/s\//.test(path)) { document.getElementById('sm-search')?.remove(); document.getElementById('sm-error')?.remove(); }
      if (roomId) setTimeout(() => handleRoom(roomId).catch(e => console.debug('StayMatch:', e)), T.roomDelay ?? 2000);
      else if (/^\/s\//.test(path)) emptyTimer = setTimeout(checkEmpty, T.diagDelay ?? 9000);
    }
    if (/^\/s\//.test(path)) handleSearch().catch(e => console.debug('StayMatch:', e));
  }
  new MutationObserver(muts => {
    // eigene Änderungen ignorieren
    const ours = n => n?.nodeType === 1 && !!n.closest('[data-staymatch]');
    if (muts.every(m => ours(m.target) || (m.addedNodes.length && [...m.addedNodes].every(ours)))) return;
    clearTimeout(debounce); debounce = setTimeout(route, T.debounce ?? 700);
  }).observe(document.body, { childList: true, subtree: true });
  setInterval(() => { if (location.href !== lastUrl) route(); }, 1000);
  T.api = { route, handleSearch, handleRoom, checkEmpty, onKey };
  route();
})();
