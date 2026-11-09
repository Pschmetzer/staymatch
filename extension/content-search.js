// StayMatch – Suchseite: bewertet alle sichtbaren Unterkünfte und zeigt die Top 3 (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank;
  const { getTrip, allListings, tasteFrom, h, panel } = window.StayMatchContent;

  let lastSig = '', lastRanked = null;
  async function handleSearch() {
    const listings = P.parseSearch(document);
    if (!listings.length) return;
    const sig = location.href + '|' + listings.map(l => l.id).join(',');
    if (sig === lastSig) { if (lastRanked) badges(lastRanked); return; } // Panel nicht neu bauen, aber Plaketten nach Airbnb-Neuaufbau wieder setzen
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
    const ctx = { people, nights, budget: trip?.budget || null, areas: trip?.areas || [], taste: tasteFrom(items), seen, disliked };
    const ranked = R.rankListings(listings, ctx);
    lastRanked = ranked;

    badges(ranked);

    // Empfehlungen für das Popup merken (nur die eigene Auswahl, lokal)
    chrome.storage.local.set({ lastSearch: { at: Date.now(), url: location.href, nights, people, top: ranked.slice(0, 10).map(l => ({ id: l.id, title: l.title, kind: l.kind, locality: l.locality, rating: l.rating, reviewCount: l.reviewCount, totalPrice: l.totalPrice, currency: l.currency, score: l.rank.score, why: l.rank.why, warn: l.rank.warn, url: `${location.origin}/rooms/${l.id}` })) } });

    const top = ranked.filter(l => !disliked.has(l.id)).slice(0, 3);
    const { ['min:sm-search']: min } = await chrome.storage.local.get('min:sm-search');
    panel('sm-search', 'Top 3 für euch', [
      !trip ? h('div', { class: 'muted' }, 'Tipp: Erst im Viertel-Finder suchen, dann kennt StayMatch eure Gruppe, das Budget und die Viertel.') : null,
      h('div', { class: 'muted' }, `${listings.length} Unterkünfte auf dieser Seite bewertet${people ? ` · ${people} Personen` : ''}${nights ? ` · ${nights} Nächte` : ''}${ctx.budget ? ` · Budget ${ctx.budget} €` : ''}`),
      top.map((l, i) => h('div', { class: 'item' },
        h('span', { class: 'score', title: 'Passt-Wert 0–100' }, l.rank.score),
        h('a', { href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener' }, `${i + 1}. ${l.title || l.kind}`),
        h('div', { class: 'muted' }, [l.kind, l.locality].filter(Boolean).join(' · ')),
        h('ul', {}, l.rank.why.map(w => h('li', {}, w)), l.rank.warn.map(w => h('li', { class: 'warn' }, '⚠️ ' + w))))),
      h('div', { class: 'muted' }, 'Blättern oder Karte verschieben → neue Unterkünfte werden automatisch mitbewertet.'),
    ], { minimized: !!min });
  }

  // Punkte direkt an den Karten. Markiert, damit der MutationObserver sie ignoriert.
  function badges(ranked) {
    const byId = new Map(ranked.map(l => [l.id, l]));
    for (const card of document.querySelectorAll('[data-testid="card-container"]')) {
      const id = card.querySelector('a[href*="/rooms/"]')?.getAttribute('href')?.match(P.ROOM_RE)?.[1];
      const l = id && byId.get(id);
      if (!l) continue;
      let b = card.querySelector('[data-staymatch-badge]');
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
      card.style.opacity = l.rank.warn.some(w => w.includes('👎')) ? '0.45' : '';
    }
  }

  window.StayMatchContent.search = { handle: handleSearch, reset() { lastSig = ''; lastRanked = null; } };
})();
