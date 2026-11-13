// StayMatch – Suchseite: bewertet alle sichtbaren Unterkünfte, zeigt die Top 3 mit Filtern (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, POOL = window.StayMatchPool;
  const SMC = window.StayMatchContent;
  const { getTrip, allListings, h, panel, copyText, settings, keys, REPORT_URL } = SMC;

  const FILTERS = [['rating', '⭐ ab 4,7'], ['budget', '💶 im Budget'], ['beds', '🛏️ genug Betten'], ['fav', '🏅 Favorit/Superhost'], ['lux', '✨ nur Luxus']];
  let lastSig = '', lastView = null, filters = {}, quick = { budgetNight: null, wishes: [] };
  let compareMode = false, flash = '';

  function passes(l) {
    if (filters.rating && !(l.rating >= 4.7)) return false;
    // ohne bekanntes Budget kann der Filter nichts aussortieren (sonst bliebe nach einer Suche ohne Reise alles leer)
    if (filters.budget && l.rank.budgetKnown && !(l.rank.parts.price != null && l.rank.parts.price >= 0.75)) return false;
    if (filters.beds && l.rank.parts.beds != null && l.rank.parts.beds < 1) return false; // unbekannt zählt als ok
    if (filters.lux && l.rank.luxury?.state !== true) return false;
    if (filters.fav && !(l.badges || []).some(x => /favorit|superhost/i.test(x))) return false;
    return true;
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
      title: ctx.people > 1 ? 'Unsere Top 3 (StayMatch)' : 'Meine Top 3 (StayMatch)',
      sub: [ctx.people && `${ctx.people} ${ctx.people === 1 ? 'Person' : 'Personen'}`, ctx.nights && `${ctx.nights} Nächte`, ctx.budget && `Budget ${ctx.budget} €`].filter(Boolean).join(' · '),
    });
    flash = (await copyText(text)) ? 'Kopiert ✓ – jetzt einfügen, wo du willst' : 'Kopieren ging nicht (Seite blockiert die Zwischenablage)';
    renderSearch();
    setTimeout(() => { flash = ''; if (lastView) renderSearch(); }, 3500);
  }

  async function handleSearch() {
    const current = P.parseSearch(document);
    if (!current.length) return; // leeres Ergebnis meldet checkEmpty() nach einer Wartezeit
    // Signatur: auch nachgeladene Preise und Sterne ändern sie, sonst bleibt das Panel veraltet
    const sig = SMC.searchKey() + '|' + current.map(l => [l.id, l.totalPrice ?? l.pricePerNight ?? '', l.rating ?? ''].join(':')).join(',');
    if (sig === lastSig) { if (lastView) applyBadges(); return; } // Panel nicht neu bauen, aber Plaketten nach Airbnb-Neuaufbau wieder setzen
    lastSig = sig;
    document.getElementById('sm-error')?.remove();

    const sp = P.searchParams(location.href);
    // Seiten, die du nacheinander öffnest (Blättern), gemeinsam ranken. Nichts wird von selbst geladen.
    const stored = await chrome.storage.local.get(['filters', 'min:sm-search', 'pool']);
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
    // Direkt-Modus: ohne Viertel-Finder gelten Budget pro Nacht und Wünsche aus dem Panel
    quick = { budgetNight: null, wishes: [], ...((await chrome.storage.local.get('quick')).quick || {}) };
    // Wünsche aus dem Viertel-Finder übernehmen, sobald dort neu gesucht wurde (danach gelten die Chips im Panel)
    if (Array.isArray(savedTrip?.wishes) && savedTrip.savedAt > (quick.tripAt || 0)) {
      quick = { ...quick, wishes: savedTrip.wishes.filter(k => R.WISHES[k] || R.REVIEW_WISHES[k]), tripAt: savedTrip.savedAt };
      chrome.storage.local.set({ quick });
    }
    // R5-101: Gästezahl der Airbnb-Suche. R5-100: Reise-Budget ist immer in €. R5-92: flexible Daten/Monatsmiete → kein Preisvergleich. R5-102: Median-Profil je Währung
    const ctx = { people, adults: sp.adults || null, nights, budget: trip?.budget || null, budgetCurrency: trip?.budget ? '€' : (quick.budgetCurrency || null), priceUnsure: !!sp.flexible, budgetPerNight: trip?.budget ? null : quick.budgetNight, areas: trip?.areas || [], taste: R.buildTaste(items), seen, disliked, known, wishes: quick.wishes };
    const ranked = R.rankListings(listings, ctx);

    filters = stored.filters || {};
    lastView = { ranked, ctx, disliked, trip, count: listings.length, pages: pool.pages.length, quality: P.quality(current), min: !!stored['min:sm-search'] };

    // Empfehlungen für das Popup merken (nur die eigene Auswahl, lokal). R7: dieselbe Auswahl wie im Panel (ohne 👎, mit Filtern), Einheit dabei
    chrome.storage.local.set({ lastSearch: { at: Date.now(), url: location.href, nights, people, top: ranked.filter(l => !disliked.has(l.id) && passes(l)).slice(0, 10).map(l => ({ id: l.id, title: l.title, kind: l.kind, locality: l.locality, rating: l.rating, reviewCount: l.reviewCount, totalPrice: l.totalPrice, currency: l.currency, isTotal: !!l.isTotal, score: l.rank.score, why: l.rank.why, warn: l.rank.warn, stay: l.rank.stay, ppnPerson: l.rank.ppn?.person ?? null, url: `${location.origin}/rooms/${l.id}` })) } });

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
    const { ctx, trip, count, pages, quality: q } = lastView;
    const old = document.getElementById('sm-search')?.shadowRoot?.querySelector('.box');
    const minimized = old ? old.classList.contains('min') : lastView.min;
    const top = currentTop();
    const cur = l => l.currency || '€';
    // Teilweise erkannt? Dann ehrlich sagen, was fehlt.
    const lacking = q && q.n >= 3 ? [q.noPrice > q.n / 2 && 'Preise', q.noRating > q.n / 2 && 'Sterne', q.noBeds > q.n / 2 && 'Betten'].filter(Boolean) : [];
    const bd = l => [['Viertel', 'area'], ['Sterne', 'rating'], ['Preis', 'price'], ['Wünsche', 'wishes'], ['Betten', 'beds']]
      .filter(([, k]) => l.rank.parts[k] != null).map(([n, k]) => `${n} ${Math.round(l.rank.parts[k] * 100)}`).join(' · ');
    const budgetKnown = !!(R.effectiveBudget(ctx) || ctx.budgetPerNight);
    const setQuick = async patch => { quick = { ...quick, ...patch }; await chrome.storage.local.set({ quick }); lastSig = ''; handleSearch(); };
    const budgetInput = h('input', { type: 'number', min: '0', step: '10', inputmode: 'numeric', placeholder: 'z. B. 120', 'aria-label': 'Budget pro Nacht in Euro',
      style: 'width:90px;border:1px solid var(--line);border-radius:8px;padding:3px 6px;background:var(--bg);color:var(--fg);font:12px system-ui' });
    budgetInput.value = quick.budgetNight || '';
    budgetInput.onchange = () => { const v = Math.round(Number(budgetInput.value)); setQuick({ budgetNight: v > 0 ? v : null }); };
    panel('sm-search', trip && ctx.people > 1 ? 'Top 3 für euch' : ctx.people === 1 ? 'Top 3 für dich' : 'Top 3 auf dieser Seite', [
      h('div', { class: 'muted' }, `${count} Unterkünfte${pages > 1 ? ` von ${pages} Seiten, die du geöffnet hast,` : ' auf dieser Seite'} bewertet${ctx.people ? ` · ${ctx.people} ${ctx.people === 1 ? 'Person' : 'Personen'}` : ''}${ctx.nights ? ` · ${ctx.nights} Nächte` : ''}${ctx.budget ? ` · Budget ${ctx.budget} €` : ''}`),
      quick.wishes.includes('luxury') ? h('div', { class: 'muted' }, `✨ ${lastView.ranked.filter(l => l.rank.luxury?.state === true).length} von ${count} als Luxus erkannt (Stichwörter im Titel, Preislage, Bäder).${lastView.ranked.some(l => l.rank.luxury?.state === true) ? '' : ' Keine Treffer: Suche nach „Villa“ oder „Penthouse“ verfeinern.'}`) : null,
      lacking.length ? h('div', { class: 'err muted' }, `⚠️ ${lacking.join(', ')} bei den meisten Karten nicht gelesen. Airbnb hat vermutlich etwas geändert, die Wertung ist ungenauer.`) : null,
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
      top.length ? h('div', { class: 'row' },
        h('button', { class: compareMode ? 'on' : '', 'aria-pressed': String(compareMode), title: 'Alt+Shift+V', onclick: () => { compareMode = !compareMode; renderSearch(); } }, '⚖️ Vergleich'),
        h('button', { title: 'Alt+Shift+K', onclick: copyTop }, '📋 Top 3 kopieren')) : null,
      flash ? h('div', { class: 'muted', role: 'status' }, flash) : null,
      top.length && compareMode
        ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, ''), top.map((l, i) => h('th', {}, h('a', { href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener', style: 'color:inherit' }, `${i + 1}. ${(l.title || l.kind || '').slice(0, 28)}`))))),
          h('tbody', {}, R.compareRows(top, ctx).map(r => h('tr', {}, h('th', {}, r.label), r.cells.map(c => h('td', {}, c))))))
        : null,
      top.length && !compareMode ? top.map((l, i) => h('div', { class: 'item hotel' },
        h('div', { class: 'ph' },
          l.image ? h('img', { src: l.image, alt: l.title || l.kind || '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
          h('span', { class: 'rank' }, `${i + 1}`),
          h('span', { class: 'score', title: 'Passt-Wert 0–100' }, l.rank.score),
          l.rank.luxury?.state === true ? h('span', { class: 'lux', title: l.rank.luxury.words.join(', ') }, `✨ Luxus${l.rank.luxury.words[0] ? ' · ' + l.rank.luxury.words[0] : ''}`) : null),
        h('div', { class: 'meta' },
          h('a', { class: 'name', href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener' }, l.title || l.kind),
          l.rating != null ? h('span', { class: 'stars' }, `★ ${String(l.rating).replace('.', ',')}${l.reviewCount ? ` (${l.reviewCount})` : ''}`) : null),
        h('div', { class: 'muted' }, [l.kind, l.locality].filter(Boolean).join(' · ')),
        l.totalPrice != null ? h('div', { class: 'price' }, h('b', {}, `${l.totalPrice} ${cur(l)}`), l.isTotal ? ' gesamt' : ' pro Nacht', l.rank.ppn?.person ? ` · ${l.rank.ppn.person} ${cur(l)} p. P./Nacht` : '') : null,
        h('ul', {}, l.rank.why.map(w => h('li', {}, w)), l.rank.warn.map(w => h('li', { class: 'warn' }, '⚠️ ' + w))),
        h('div', { class: 'muted' }, 'Zusammensetzung: ' + bd(l))))
        : !top.length ? h('div', { class: 'muted' }, 'Keine Unterkunft erfüllt alle Filter. Filter lockern oder weiterblättern.') : null,
      h('div', { class: 'muted' }, 'Blättern oder Karte verschieben → die Seiten, die du öffnest, werden zusammen bewertet. Es wird nichts von selbst nachgeladen.'),
      pages > 1 ? h('div', { class: 'row' }, h('button', { onclick: async () => { await chrome.storage.local.remove('pool'); lastSig = ''; lastView = null; SMC.route?.(); } }, 'Sammlung leeren')) : null,
      h('div', { class: 'muted' }, 'Tasten: Alt+Shift+V Vergleich · K kopieren · M ein-/ausklappen'),
      !trip ? h('div', { class: 'muted' }, 'Tipp: Im ', h('a', { href: window.StayMatchCore.APP_URL, target: '_blank', rel: 'noopener' }, 'Viertel-Finder'), ' findest du vorher das Viertel, das zu dir passt, auch mit Mitreisenden.') : null,
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
      card.style.opacity = l.rank.disliked ? '0.45' : !passes(l) ? '0.35' : '';
    }
  }
  SMC.settingsListeners.push(() => applyBadges());
  keys.KeyV = () => { if (!P.ROOM_RE.test(location.pathname) && lastView) { compareMode = !compareMode; renderSearch(); } };
  keys.KeyK = () => { if (!P.ROOM_RE.test(location.pathname) && lastView) copyTop(); };

  window.StayMatchContent.search = { handle: handleSearch, checkEmpty, reset() { lastSig = ''; lastView = null; } };
})();
