// StayMatch – Suchseite: bewertet alle sichtbaren Unterkünfte, zeigt die Top 3 mit Filtern (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank;
  const { getTrip, allListings, tasteFrom, h, panel } = window.StayMatchContent;

  const FILTERS = [['rating', '⭐ ab 4,7'], ['budget', '💶 im Budget'], ['beds', '🛏️ genug Betten'], ['fav', '🏅 Favorit/Superhost']];
  let lastSig = '', lastView = null, filters = {}, settings = { showBadges: true }, quick = { budgetNight: null, wishes: [] };

  function passes(l) {
    if (filters.rating && !(l.rating >= 4.7)) return false;
    // ohne bekanntes Budget kann der Filter nichts aussortieren (sonst bliebe nach einer Suche ohne Reise alles leer)
    if (filters.budget && l.rank.budgetKnown && !(l.rank.parts.price != null && l.rank.parts.price >= 0.75)) return false;
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
    const trip = savedTrip && ((sp.checkin && sp.checkin === savedTrip.checkin) ||
      listings.some(l => l.lat != null && R.areaFor({ lat: l.lat, lon: l.lon }, savedTrip.areas || []))) ? savedTrip : null;
    const items = await allListings();
    const seen = new Set(items.map(i => i.id));
    const disliked = new Set(items.filter(i => i.vote === -1).map(i => i.id));
    const people = trip?.people?.length || sp.adults || null;
    const nights = sp.nights || trip?.nights || null;
    // Direkt-Modus: ohne Viertel-Finder gelten Budget pro Nacht und Wünsche aus dem Panel
    quick = { budgetNight: null, wishes: [], ...((await chrome.storage.local.get('quick')).quick || {}) };
    // Wünsche aus dem Viertel-Finder übernehmen, sobald dort neu gesucht wurde (danach gelten die Chips im Panel)
    if (Array.isArray(savedTrip?.wishes) && savedTrip.savedAt > (quick.tripAt || 0)) {
      quick = { ...quick, wishes: savedTrip.wishes.filter(k => R.WISHES[k] || R.REVIEW_WISHES[k]), tripAt: savedTrip.savedAt };
      chrome.storage.local.set({ quick });
    }
    const ctx = { people, nights, budget: trip?.budget || null, budgetPerNight: trip?.budget ? null : quick.budgetNight, areas: trip?.areas || [], taste: tasteFrom(items), seen, disliked, wishes: quick.wishes };
    const ranked = R.rankListings(listings, ctx);

    const stored = await chrome.storage.local.get(['filters', 'settings', 'min:sm-search']);
    filters = stored.filters || {};
    settings = { showBadges: true, ...(stored.settings || {}) };
    lastView = { ranked, ctx, disliked, trip, count: listings.length, min: !!stored['min:sm-search'] };

    // Empfehlungen für das Popup merken (nur die eigene Auswahl, lokal)
    chrome.storage.local.set({ lastSearch: { at: Date.now(), url: location.href, nights, people, top: ranked.slice(0, 10).map(l => ({ id: l.id, title: l.title, kind: l.kind, locality: l.locality, rating: l.rating, reviewCount: l.reviewCount, totalPrice: l.totalPrice, currency: l.currency, score: l.rank.score, why: l.rank.why, warn: l.rank.warn, url: `${location.origin}/rooms/${l.id}` })) } });

    applyBadges();
    renderSearch();
  }

  function renderSearch() {
    const { ranked, ctx, disliked, trip, count } = lastView;
    const old = document.getElementById('sm-search')?.shadowRoot?.querySelector('.box');
    const minimized = old ? old.classList.contains('min') : lastView.min;
    const top = ranked.filter(l => !disliked.has(l.id) && passes(l)).slice(0, 3);
    const bd = l => [['Viertel', 'area'], ['Sterne', 'rating'], ['Preis', 'price'], ['Wünsche', 'wishes'], ['Betten', 'beds']]
      .filter(([, k]) => l.rank.parts[k] != null).map(([n, k]) => `${n} ${Math.round(l.rank.parts[k] * 100)}`).join(' · ');
    const budgetKnown = !!(R.effectiveBudget(ctx) || ctx.budgetPerNight);
    const setQuick = async patch => { quick = { ...quick, ...patch }; await chrome.storage.local.set({ quick }); lastSig = ''; handleSearch(); };
    const budgetInput = h('input', { type: 'number', min: '0', step: '10', inputmode: 'numeric', placeholder: 'z. B. 120', 'aria-label': 'Budget pro Nacht in Euro',
      style: 'width:90px;border:1px solid var(--line);border-radius:8px;padding:3px 6px;background:var(--bg);color:var(--fg);font:12px system-ui' });
    budgetInput.value = quick.budgetNight || '';
    budgetInput.onchange = () => { const v = Math.round(Number(budgetInput.value)); setQuick({ budgetNight: v > 0 ? v : null }); };
    panel('sm-search', trip && ctx.people > 1 ? 'Top 3 für euch' : ctx.people === 1 ? 'Top 3 für dich' : 'Top 3 auf dieser Seite', [
      h('div', { class: 'muted' }, `${count} Unterkünfte auf dieser Seite bewertet${ctx.people ? ` · ${ctx.people} ${ctx.people === 1 ? 'Person' : 'Personen'}` : ''}${ctx.nights ? ` · ${ctx.nights} Nächte` : ''}${ctx.budget ? ` · Budget ${ctx.budget} €` : ''}`),
      !trip ? h('div', { class: 'row', style: 'align-items:center;gap:8px' }, h('span', { class: 'muted' }, 'Budget pro Nacht (€):'), budgetInput) : null,
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Deine Wünsche' }, Object.entries(R.WISHES).map(([k, w]) => h('button', {
        class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)),
        onclick: () => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] }),
      }, w.label)), Object.entries(R.REVIEW_WISHES).map(([k, w]) => h('button', {
        class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)),
        title: 'Prüft StayMatch auf der Unterkunftsseite anhand der Bewertungen',
        onclick: () => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] }),
      }, `${{ quiet: '🤫', clean: '🧽', wifi: '📶' }[k]} ${w[0]}`))),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' }, FILTERS.map(([k, label]) => h('button', {
        class: filters[k] ? 'on' : '', 'aria-pressed': String(!!filters[k]),
        ...(k === 'budget' && !budgetKnown ? { disabled: '', title: 'Kein Budget bekannt. Oben ein Budget pro Nacht eintragen.', style: 'opacity:.5;cursor:not-allowed' } : {}),
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
      !trip ? h('div', { class: 'muted' }, 'Mit Freunden unterwegs? Im ', h('a', { href: window.StayMatchCore.APP_URL, target: '_blank', rel: 'noopener' }, 'Viertel-Finder'), ' das Viertel finden, in dem alle zufrieden sind.') : null,
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
      b.title = [...l.rank.why, ...l.rank.warn].join(' · ');
      card.style.opacity = l.rank.warn.some(w => w.includes('👎')) ? '0.45' : !passes(l) ? '0.35' : '';
    }
  }
  chrome.storage.onChanged?.addListener(ch => { if (ch.settings) { settings = { showBadges: true, ...(ch.settings.newValue || {}) }; applyBadges(); } });

  window.StayMatchContent.search = { handle: handleSearch, reset() { lastSig = ''; lastView = null; } };
})();
