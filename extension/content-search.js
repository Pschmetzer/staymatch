// StayMatch – Suchseite: bewertet alle sichtbaren Unterkünfte, zeigt die Top 3 mit Filtern (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, POOL = window.StayMatchPool, X = window.StayMatchExtras;
  const SMC = window.StayMatchContent;
  const { getTrip, allListings, h, panel, copyText, settings, keys, REPORT_URL } = SMC;

  const FILTERS = [['rating', '⭐ ab 4,7'], ['budget', '💶 im Budget'], ['beds', '🛏️ genug Betten'], ['fav', '🏅 Favorit/Superhost'], ['lux', '✨ nur Luxus'], ['lowFees', '💸 niedrige Gebühren']];
  let lastSig = '', lastView = null, filters = {}, quick = { budgetNight: null, wishes: [] };
  let compareMode = false, flash = '';

  // R7: eine Filterfunktion für Panel und Tests (rank.js); ohne bekanntes Budget sortiert „im Budget“ nichts aus
  const passes = l => R.filterListings([l], { minRating: !!filters.rating, inBudget: !!filters.budget, enoughBeds: !!filters.beds, favorite: !!filters.fav, lux: !!filters.lux, lowFees: !!filters.lowFees }).length === 1;
  const activeFilters = () => FILTERS.filter(([k]) => filters[k]);

  function currentTop() {
    if (!lastView) return [];
    return lastView.ranked.filter(l => !lastView.disliked.has(l.id) && passes(l)).slice(0, 3);
  }

  async function copyTop() {
    const top = currentTop();
    if (!top.length) return;
    const url = l => `${location.origin}/rooms/${l.id}${location.search}`;
    const { ctx } = lastView;
    // R7 E: Kopier-Optionen aus dem Popup (ohne Preise, ohne Emojis, Markdown), Preisstand und Entscheidungsfragen
    const so = settings.share || {};
    const text = R.shareText(top.map(l => ({ ...l, score: l.rank.score, url: url(l) })), {
      title: ctx.people > 1 ? 'Unsere Top 3 (StayMatch)' : 'Meine Top 3 (StayMatch)',
      sub: [ctx.people && `${ctx.people} ${ctx.people === 1 ? 'Person' : 'Personen'}`, ctx.nights && `${ctx.nights} Nächte`, !so.noPrices && ctx.budget && `Budget ${Math.round(R.effectiveBudget(ctx))} €`].filter(Boolean).join(' · '),
      noPrices: !!so.noPrices, noEmoji: !!so.noEmoji, markdown: !!so.markdown, stamp: Date.now(), questions: so.noQuestions ? [] : R.decisionQuestions(top),
    });
    flash = (await copyText(text)) ? 'Kopiert ✓ – jetzt einfügen, wo du willst' : 'Kopieren ging nicht (Seite blockiert die Zwischenablage)';
    renderSearch();
    setTimeout(() => { flash = ''; if (lastView) renderSearch(); }, 3500);
  }

  async function handleSearch() {
    const current = P.parseSearch(document);
    if (!current.length) return; // leeres Ergebnis meldet checkEmpty() nach einer Wartezeit
    // Signatur: auch nachgeladene Preise und Sterne ändern sie, sonst bleibt das Panel veraltet
    // R7: Einheit (isTotal) gehört dazu; pricePerNight gibt es auf der Suchseite nicht
    const sig = SMC.searchKey() + '|' + current.map(l => [l.id, l.totalPrice ?? '', l.isTotal ? 'T' : 'N', l.rating ?? ''].join(':')).join(',');
    if (sig === lastSig) { if (lastView) applyBadges(); return; } // Panel nicht neu bauen, aber Plaketten nach Airbnb-Neuaufbau wieder setzen
    lastSig = sig;
    document.getElementById('sm-error')?.remove();

    const sp = P.searchParams(location.href);
    // Seiten, die du nacheinander öffnest (Blättern), gemeinsam ranken. Nichts wird von selbst geladen.
    // R7: Speicher parallel lesen statt vier-, fünfmal nacheinander
    const [stored, savedTrip, items] = await Promise.all([chrome.storage.local.get(['filters', 'min:sm-search', 'pool', 'quick', 'priceLog', 'tasteIgnore', 'friendLikes', 'stats']), getTrip(), allListings()]);
    const pool = POOL.mergePool(stored.pool, location.href, current);
    chrome.storage.local.set({ pool }).catch?.(() => {});
    const byId = new Map(current.map(l => [l.id, l]));
    const listings = Object.values(pool.items).map(p => byId.get(p.id) || p);

    // Reise nur nutzen, wenn sie zu dieser Suche passt (gleiches Datum oder Unterkünfte nahe den Vierteln)
    const trip = savedTrip && ((sp.checkin && sp.checkin === savedTrip.checkin) ||
      listings.some(l => l.lat != null && R.areaFor({ lat: l.lat, lon: l.lon }, savedTrip.areas || []))) ? savedTrip : null;
    const seen = new Set(items.map(i => i.id));
    const disliked = new Set(items.filter(i => i.vote === -1).map(i => i.id));
    const known = new Map(items.map(i => [i.id, i]));
    // R7 E: Teilnehmer ±1 im Panel (Absage, Plus-Eins) ohne neue Suche
    const basePeople = trip?.people?.length || sp.adults || null;
    const delta = basePeople ? (stored.quick?.peopleDelta || 0) : 0;
    const people = basePeople ? Math.max(1, basePeople + delta) : null;
    const nights = sp.nights || trip?.nights || null;
    // Direkt-Modus: ohne Viertel-Finder gelten Budget pro Nacht und Wünsche aus dem Panel
    quick = { budgetNight: null, wishes: [], ...(stored.quick || {}) };
    // Wünsche aus dem Viertel-Finder übernehmen, sobald dort neu gesucht wurde (danach gelten die Chips im Panel)
    if (Array.isArray(savedTrip?.wishes) && savedTrip.savedAt > (quick.tripAt || 0)) {
      quick = { ...quick, wishes: savedTrip.wishes.filter(k => R.WISHES[k] || R.REVIEW_WISHES[k]), tripAt: savedTrip.savedAt };
      chrome.storage.local.set({ quick });
    }
    // R5-101: Gästezahl der Airbnb-Suche. R5-100: Reise-Budget ist immer in €. R5-92: flexible Daten/Monatsmiete → kein Preisvergleich. R5-102: Median-Profil je Währung
    // R7: tripNights, damit effectiveBudget das Reisebudget auf die Nächte dieser Suche umrechnet (Kopf und Rechnung gleich)
    // R7 E: Geschmack ohne Orte, die du im Popup gestrichen hast
    const ign = new Set((stored.tasteIgnore || []).map(x => String(x).toLowerCase()));
    const tasteItems = ign.size ? items.map(i => ign.has(String(i.locality || '').toLowerCase()) ? { ...i, locality: null } : i) : items;
    const ctx = { ownBed: !!quick.ownBed, people, adults: delta ? people : sp.adults || null, nights, tripNights: trip?.nights || null, budget: trip?.budget || null, budgetCurrency: trip?.budget ? '€' : (quick.budgetCurrency || null), priceUnsure: !!sp.flexible, budgetPerNight: trip?.budget ? null : quick.budgetNight, areas: trip?.areas || [], taste: R.buildTaste(tasteItems), seen, disliked, known, wishes: quick.wishes };
    const ranked = R.rankListings(listings, ctx);
    // R7 E: Merklisten von Freunden („Lena mag das“), nur aus dem, was du im Popup eingefügt hast
    const fl = stored.friendLikes || {};
    for (const l of ranked) if (fl[l.id]?.length) l.rank.info.push(`${fl[l.id].join(', ')} ${fl[l.id].length === 1 ? 'mag' : 'mögen'} das`);
    // R7 E: Zähler „heute bewertet“ fürs Popup (nur Zahlen, nie gesendet)
    if (!(settings.pauseUntil > Date.now())) {
      const day = new Date().toISOString().slice(0, 10), st = stored.stats?.day === day ? stored.stats : { day, rated: 0, opened: 0, ids: [] };
      const fresh = current.filter(l => !st.ids.includes(l.id)).map(l => l.id);
      if (fresh.length) chrome.storage.local.set({ stats: { ...st, rated: st.rated + fresh.length, opened: items.filter(i => i.lastSeen && new Date(i.lastSeen).toISOString().slice(0, 10) === day).length, ids: [...st.ids, ...fresh].slice(-1000) } }).catch?.(() => {});
    }

    filters = stored.filters || {};
    // R7 E: eigener Preisverlauf je Stadt (nur Median, Datum, Nächte; lokal) für „ungewöhnlich teuer“ und Wochenend-Aufschlag
    const anchor = X?.priceAnchor(ranked, ctx);
    const now = anchor && sp.checkin ? { path: location.pathname, ci: sp.checkin, nights, med: Math.round(anchor.median), cur: anchor.currency } : null;
    const log = (stored.priceLog || []).filter(e => e && e.path);
    const history = X && now ? X.priceHistoryNotes(log, now) : [];
    if (now && !log.some(e => e.path === now.path && e.ci === now.ci && e.nights === now.nights)) chrome.storage.local.set({ priceLog: [...log, now].slice(-60) }).catch?.(() => {});
    const booked = items.filter(i => i.booked && sp.checkin && i.booked.checkin === sp.checkin);
    lastView = { ranked, ctx, disliked, trip, count: listings.length, pages: pool.pages.length, quality: P.quality(current), min: !!stored['min:sm-search'], pool, listings, history, booked, basePeople, delta };

    // Empfehlungen für das Popup merken (nur die eigene Auswahl, lokal). R7: dieselbe Auswahl wie im Panel (ohne 👎, mit Filtern), Einheit dabei
    chrome.storage.local.set({ lastSearch: { at: Date.now(), url: location.href, nights, people, top: ranked.filter(l => !disliked.has(l.id) && passes(l)).slice(0, 10).map(l => ({ id: l.id, title: l.title, kind: l.kind, locality: l.locality, rating: l.rating, reviewCount: l.reviewCount, totalPrice: l.totalPrice, currency: l.currency, isTotal: !!l.isTotal, score: l.rank.score, why: l.rank.why, warn: l.rank.warn, stay: l.rank.stay, ppnPerson: l.rank.ppn?.person ?? null, url: `${location.origin}/rooms/${l.id}` })) } });

    applyBadges();
    renderSearch();
  }

  // Nach einer Wartezeit noch keine Unterkünfte gelesen → klare Meldung statt leerem Panel
  function checkEmpty() {
    if (!/^\/s\//.test(location.pathname) || lastView) return;
    if (P.parseSearch(document).length) return handleSearch().catch(() => {}); // R7: erst prüfen, dann (teure) Diagnose
    const d = P.diagnose(document);
    const ver = chrome.runtime?.getManifest?.().version || '?';
    const report = `StayMatch ${ver}\nSeitendaten: ${d.stateNote} (${d.stateCount})\nKarten: ${d.cards}\nLinks: ${d.roomLinks}`; // ohne URL und ohne Seiteninhalt
    panel('sm-error', 'Seite nicht verstanden', [
      h('div', { class: 'err' }, h('b', {}, 'Ich verstehe diese Seite nicht (mehr).'), h('div', {}, P.diagnosisText(d))),
      h('div', { class: 'muted' }, `Daten im Seitenquelltext: ${d.stateNote} · Karten: ${d.cards} · Links zu Unterkünften: ${d.roomLinks}`),
      h('div', { class: 'row' },
        // R7: lädt die Seite nur langsam, hilft ein neuer Versuch ohne auf die nächste DOM-Änderung zu warten
        h('button', { onclick: () => { document.getElementById('sm-error')?.remove(); lastSig = ''; if (P.parseSearch(document).length) handleSearch().catch(() => {}); else checkEmpty(); } }, 'Erneut versuchen'),
        h('button', { onclick: async e => { e.target.textContent = (await copyText(report)) ? 'Kopiert ✓' : 'Nicht möglich'; } }, 'Diagnose kopieren'),
        h('a', { class: 'btn', href: `${REPORT_URL}?title=${encodeURIComponent('Plugin versteht Suchseite nicht')}&body=${encodeURIComponent(report)}`, target: '_blank', rel: 'noopener' }, 'Fehler melden')),
      h('div', { class: 'muted' }, 'Die Diagnose enthält nur Zahlen, keine Adresse und keine Inhalte der Seite. Deine Unterkünfte bleiben unbewertet, bis das Plugin angepasst ist.'),
    ]);
  }

  function renderSearch() {
    const { ctx, trip, count, pages, quality: q } = lastView;
    const old = SMC.rootOf('sm-search')?.querySelector('.box');
    const minimized = old ? old.classList.contains('min') : lastView.min;
    const top = currentTop();
    const M = (v, l) => R.money(v, l.currency); // R7: keine erfundene „€“-Angabe
    // Teilweise erkannt? Dann ehrlich sagen, was fehlt.
    const lacking = q && q.n >= 3 ? [q.noPrice > q.n / 2 && 'Preise', q.noRating > q.n / 2 && 'Sterne', q.noBeds > q.n / 2 && 'Betten', q.noTitle > q.n / 2 && 'Titel'].filter(Boolean) : [];
    const af = activeFilters();
    const resetFilters = async () => { filters = {}; await chrome.storage.local.set({ filters }); applyBadges(); renderSearch(); };
    const cut = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); }; // R7: Emoji nicht zerschneiden
    const chip = label => { const m = String(label).match(/^(\S+)\s(.+)$/); return m && /\p{Extended_Pictographic}/u.test(m[1]) ? [h('span', { 'aria-hidden': 'true' }, m[1]), ' ', m[2]] : label; }; // R7: Emoji nicht vorlesen
    // R7: Punkte aus breakdown (summieren sich zum Grundwert) plus Abzüge, statt Rohwerte der Teile
    const PART_NAMES = { area: 'Viertel', rating: 'Sterne', price: 'Preis', wishes: 'Wünsche', beds: 'Betten', taste: 'Geschmack' };
    const bd = l => [...(l.rank.breakdown || []).map(b => `${PART_NAMES[b.key] || b.key} ${Math.round(b.points)}`),
      l.rank.adjust ? `Abzüge ${l.rank.adjust}` : null].filter(Boolean).join(' · ');
    const eb = R.effectiveBudget(ctx);
    const budgetKnown = !!(R.effectiveBudget(ctx) || ctx.budgetPerNight);
    const setQuick = async patch => { quick = { ...quick, ...patch }; await chrome.storage.local.set({ quick }); lastSig = ''; handleSearch().catch(e => console.debug('StayMatch:', e)); };
    const budgetInput = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: 'z. B. 120', 'aria-label': 'Budget pro Nacht in Euro',
      style: 'width:90px;border:1px solid var(--line);border-radius:8px;padding:3px 6px;background:var(--bg);color:var(--fg);font:12px system-ui' });
    budgetInput.value = quick.budgetNight || '';
    budgetInput.onchange = () => { const v = Math.round(Number(budgetInput.value)); setQuick({ budgetNight: v > 0 ? v : null }); };
    // R7 E: Zusatz-Bereiche (eingeklappt, damit das Panel übersichtlich bleibt)
    const toggleWish = k => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] });
    const XW = X?.EXTRA_WISHES || {};
    const sentence = h('input', { type: 'text', placeholder: 'z. B. ruhige ganze Wohnung mit WLAN unter 120', 'aria-label': 'Wünsche als Satz', style: 'width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:3px 6px;background:var(--bg);color:var(--fg);font:12px system-ui' });
    sentence.onchange = () => { const r = X.wishesFromSentence(sentence.value); setQuick({ wishes: [...new Set([...quick.wishes, ...r.wishes])], ...(r.budgetNight && !trip ? { budgetNight: r.budgetNight } : {}) }); };
    const xwOn = quick.wishes.filter(k => XW[k]).length;
    const moreWishes = X ? h('details', { open: lastView.openWishes ? '' : null, ontoggle: e => { lastView.openWishes = e.target.open; } }, h('summary', {}, `Mehr Wünsche und Gruppe${xwOn ? ` (${xwOn} aktiv)` : ''}`),
      h('div', { class: 'muted' }, 'Ausstattung prüft StayMatch nur bei Unterkünften, deren Seite du geöffnet hast.'),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Wunsch-Profile' }, Object.entries(X.PROFILES).map(([k, p]) => h('button', { title: p.wishes.join(', '), onclick: () => setQuick({ wishes: p.wishes.filter(w => R.WISHES[w] || R.REVIEW_WISHES[w] || XW[w]), profile: k }) }, chip(p.label)))),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Ausstattungs-Wünsche' }, Object.entries(XW).map(([k, w]) => h('button', { class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)), title: `Quelle: ${w.src}`, onclick: () => toggleWish(k) }, chip(w.label)))),
      sentence,
      ctx.people ? h('div', { class: 'row', style: 'align-items:center;gap:6px' },
        h('span', { class: 'muted' }, `Personen: ${ctx.people}${lastView.delta ? ` (Airbnb: ${lastView.basePeople})` : ''}`),
        h('button', { 'aria-label': 'Eine Person weniger', onclick: () => setQuick({ peopleDelta: Math.max(1 - (lastView.basePeople || 1), (quick.peopleDelta || 0) - 1) }) }, '−1'),
        h('button', { 'aria-label': 'Eine Person mehr', onclick: () => setQuick({ peopleDelta: (quick.peopleDelta || 0) + 1 }) }, '+1')) : null,
      h('div', { class: 'chips' },
        h('button', { class: quick.ownBed ? 'on' : '', 'aria-pressed': String(!!quick.ownBed), title: 'Doppelbett zählt dann als ein Bett', onclick: () => setQuick({ ownBed: !quick.ownBed }) }, chip('🛏️ jede Person eigenes Bett')),
        h('button', { class: quick.smoker ? 'on' : '', 'aria-pressed': String(!!quick.smoker), title: 'Prüft auf der Unterkunftsseite Rauchverbot und Außenfläche', onclick: () => setQuick({ smoker: !quick.smoker }) }, chip('🚬 Raucher dabei')))) : null;
    const first = top[0];
    const insights = X ? X.pageInsights(lastView.ranked.filter(l => !l.rank.disliked), top, { ...ctx, ...{ taste: ctx.taste } }, { pool: lastView.pool, history: lastView.history, listings: lastView.listings.length <= 300 ? lastView.listings : null }) : [];
    const shifts = X ? X.shiftLinks(location.href) : [];
    const fsug = X ? X.filterSuggestion(location.href, lastView.ranked, ctx.people) : null;
    const speak = () => { try { const u = new SpeechSynthesisUtterance(top.map((l, i) => `Platz ${i + 1}: ${l.title || l.kind}. ${l.rank.score} Punkte. ${l.rank.why.slice(0, 2).join('. ')}`).join(' ')); u.lang = 'de-DE'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} };
    const morePage = X && (insights.length || shifts.length || fsug) ? h('details', {}, h('summary', {}, `Mehr zu dieser Seite (${insights.length})`),
      h('ul', {}, insights.map(x => h('li', {}, x))),
      shifts.length || fsug ? h('div', { class: 'muted' }, 'Selbst öffnen (StayMatch lädt nichts): ', ...shifts.flatMap(x => [h('a', { href: x.url, target: '_blank', rel: 'noopener' }, x.label), ' · ']), fsug ? h('a', { href: fsug.url, target: '_blank', rel: 'noopener' }, fsug.text) : null) : null,
      typeof speechSynthesis !== 'undefined' && top.length ? h('button', { onclick: speak }, '🔊 Top 3 vorlesen') : null) : null;
    const inBudget = lastView.ranked.filter(l => l.rank.parts.price != null && l.rank.parts.price >= 0.75).length;
    panel('sm-search', trip && ctx.people > 1 ? 'Top 3 für euch' : ctx.people === 1 ? 'Top 3 für dich' : 'Top 3 auf dieser Seite', [
      h('div', { class: 'muted' }, `${count} Unterkünfte${pages > 1 ? ` von ${pages} Seiten, die du geöffnet hast,` : ' auf dieser Seite'} bewertet${ctx.people ? ` · ${ctx.people} ${ctx.people === 1 ? 'Person' : 'Personen'}` : ''}${ctx.nights ? ` · ${ctx.nights} Nächte` : ''}${ctx.budget && eb ? ` · Budget ${Math.round(eb)} €${ctx.nights ? ` für ${ctx.nights} Nächte` : ''}` : ''}`),
      quick.wishes.includes('luxury') ? h('div', { class: 'muted' }, `✨ ${lastView.ranked.filter(l => l.rank.luxury?.state === true).length} von ${count} als Luxus erkannt (Stichwörter im Titel, Preislage, Bäder).${lastView.ranked.some(l => l.rank.luxury?.state === true) ? '' : ' Keine Treffer: Suche nach „Villa“ oder „Penthouse“ verfeinern.'}`) : null,
      lastView.booked?.length ? h('div', { class: 'err', role: 'status' }, h('b', {}, '✅ Für diese Daten hast du schon gebucht: '), lastView.booked.map(b => b.title || 'Unterkunft').join(', '), '. Suchst du aus Versehen weiter?') : null,
      lacking.length ? h('div', { class: 'err muted' }, `⚠️ ${lacking.join(', ')} bei den meisten Karten nicht gelesen. Airbnb hat vermutlich etwas geändert, die Wertung ist ungenauer.`) : null,
      !trip ? h('div', { class: 'row', style: 'align-items:center;gap:8px' }, h('span', { class: 'muted' }, 'Budget pro Nacht (€):'), budgetInput) : null,
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Deine Wünsche' }, Object.entries(R.WISHES).map(([k, w]) => h('button', {
        class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)),
        onclick: () => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] }),
      }, chip(w.label))), Object.entries(R.REVIEW_WISHES).map(([k, w]) => h('button', {
        class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)),
        title: 'Prüft StayMatch auf der Unterkunftsseite anhand der Bewertungen',
        onclick: () => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] }),
      }, chip(`${{ quiet: '🤫', clean: '🧽', wifi: '📶' }[k]} ${w[0]}`)))),
      moreWishes,
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Filter' }, FILTERS.map(([k, label]) => h('button', {
        class: filters[k] ? 'on' : '', 'aria-pressed': String(!!filters[k]),
        // R7: aria-disabled statt disabled: bleibt fokussierbar, die Erklärung ist per aria-describedby erreichbar
        ...(k === 'budget' && !budgetKnown ? { 'aria-disabled': 'true', 'aria-describedby': 'sm-budget-hint', title: 'Kein Budget bekannt. Oben ein Budget pro Nacht eintragen.', style: 'opacity:.5;cursor:not-allowed' } : {}),
        onclick: async () => { if (k === 'budget' && !budgetKnown) return; filters[k] = !filters[k]; await chrome.storage.local.set({ filters }); applyBadges(); renderSearch(); },
      }, chip(label)))),
      !budgetKnown ? h('div', { class: 'muted', id: 'sm-budget-hint' }, 'Filter „im Budget“: erst ein Budget pro Nacht eintragen.') : null,
      // R7: Filter gelten für jede Suche: sichtbar machen und mit einem Klick zurücksetzen
      af.length ? h('div', { class: 'muted' }, `Filter aktiv (gelten auch für neue Suchen): ${af.map(([, x]) => x.replace(/^\S+\s/, '')).join(', ')} `, h('button', { onclick: resetFilters }, 'Filter zurücksetzen')) : null,
      top.length ? h('div', { class: 'row' },
        h('button', { class: compareMode ? 'on' : '', 'aria-pressed': String(compareMode), title: 'Alt+Shift+V', onclick: () => { compareMode = !compareMode; renderSearch(); } }, '⚖️ Vergleich'),
        h('button', { title: 'Alt+Shift+K', onclick: copyTop }, '📋 Top 3 kopieren')) : null,
      flash ? h('div', { class: 'muted', role: 'status' }, flash) : null,
      top.length && compareMode
        ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, ''), top.map((l, i) => h('th', {}, h('a', { href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener', style: 'color:inherit' }, `${i + 1}. ${cut(l.title || l.kind, 28)}`))))),
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
        l.totalPrice != null ? h('div', { class: 'price' }, h('b', {}, M(l.totalPrice, l)), l.isTotal ? ' gesamt' : ' pro Nacht', l.rank.ppn?.person ? ` · ${M(l.rank.ppn.person, l)} p. P./Nacht` : '', l.discounted ? ' · Rabatt' : '') : null,
        h('ul', {}, l.rank.why.map(w => h('li', {}, w)), l.rank.warn.map(w => h('li', { class: 'warn' }, '⚠️ ' + w)), (l.rank.info || []).map(w => h('li', { class: 'muted' }, w)),
          i > 0 && X ? [X.gapToFirst(l, first)].filter(Boolean).map(w => h('li', { class: 'muted' }, w)) : null),
        h('div', { class: 'muted' }, 'Zusammensetzung (Punkte): ' + bd(l))))
        : !top.length ? h('div', { class: 'muted' }, 'Keine Unterkunft erfüllt alle Filter. Filter lockern oder weiterblättern. ', af.length ? h('button', { onclick: resetFilters }, 'Filter zurücksetzen') : null) : null,
      morePage,
      h('div', { class: 'muted' }, 'Blättern oder Karte verschieben → die Seiten, die du öffnest, werden zusammen bewertet. Es wird nichts von selbst nachgeladen.'),
      pages > 1 ? h('div', { class: 'row' }, h('button', { onclick: async () => { await chrome.storage.local.remove('pool'); lastSig = ''; lastView = null; SMC.route?.(); } }, 'Sammlung leeren')) : null,
      h('div', { class: 'muted' }, 'Tasten: Alt+Shift+V Vergleich · K kopieren · M ein-/ausklappen'),
      // R7 E: Kennenlernen beim ersten Panel, danach nie wieder
      !settings.onboarded ? h('div', { class: 'err muted', role: 'note' }, h('b', {}, 'Kurz erklärt: '), 'Die Zahl rechts ist der Passt-Wert (0–100). Chips oben sind deine Wünsche, darunter die Filter. Auf der Unterkunftsseite merkst du mit 👍/👎. ',
        h('button', { onclick: async () => { const { settings: st = {} } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...st, onboarded: true } }); } }, 'Verstanden')) : null,
      !trip ? h('div', { class: 'muted' }, 'Tipp: Im ', h('a', { href: window.StayMatchCore.APP_URL, target: '_blank', rel: 'noopener' }, 'Viertel-Finder'), ' findest du vorher das Viertel, das zu dir passt, auch mit Mitreisenden.') : null,
    ], { minimized, wide: compareMode, announce: top[0] ? `Neu bewertet, Platz 1: ${cut(top[0].title || top[0].kind, 60)}. ${count} Unterkünfte${budgetKnown ? `, ${inBudget} im Budget` : ''}, beste ${top[0].rank.score} Punkte` : 'Neu bewertet, keine Unterkunft erfüllt alle Filter' }); // R7: Ansage für Screenreader
  }

  // Punkte direkt an den Karten (abschaltbar im Popup). Markiert, damit der MutationObserver sie ignoriert.
  function applyBadges() {
    if (!lastView) return;
    const byId = new Map(lastView.ranked.map(l => [l.id, l]));
    const t = lastView.trip || {};
    const privateNames = [...(t.people || []).map(p => p?.name), ...(t.areas || []).map(a => a?.minName)].filter(n => typeof n === 'string' && n.trim().length >= 2).map(n => n.trim());
    for (const card of document.querySelectorAll('[data-testid="card-container"]')) {
      const id = card.querySelector('a[href*="/rooms/"]')?.getAttribute('href')?.match(P.ROOM_RE)?.[1];
      const l = id && byId.get(id);
      let b = card.querySelector('[data-staymatch-badge]');
      if (!l || !settings.showBadges) { b?.remove(); card.style.opacity = ''; continue; } // R7: Abdunkeln auch ohne Wertung zurücksetzen
      if (!b) {
        b = h('div', { 'data-staymatch-badge': '1', 'data-staymatch': '1' });
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(b);
      }
      const s = l.rank.score;
      const bg = s >= 75 ? '#1f9d6b' : s >= 55 ? '#d68a00' : '#9a9aa0';
      b.style.cssText = `position:absolute;right:52px;top:12px;z-index:3;background:${bg};color:#fff;font:600 12px system-ui;padding:3px 8px;border-radius:999px;pointer-events:none`;
      const pp = l.rank.ppn?.person;
      // R7 E: Screenshot-Modus: nur die Punkte, ohne Preis und ohne Tooltip
      b.textContent = settings.scoreOnly ? String(s) : `StayMatch ${s}${pp ? ` · ${R.money(pp, l.currency)} p. P./Nacht` : ''}`;
      // R7: Airbnbs Skripte können das title-Attribut lesen: keine Namen der Mitreisenden hinein
      b.title = settings.scoreOnly ? '' : [...l.rank.why, ...l.rank.warn].filter(x => !privateNames.some(n => x.includes(n) || /mag das|mögen das/.test(x))).join(' · ');
      card.style.opacity = l.rank.disliked ? '0.45' : !passes(l) ? '0.35' : '';
    }
    // R7 E: Blindverkostung: Fotos aller Karten ausblenden (rückgängig, wenn abgeschaltet)
    for (const img of document.querySelectorAll('[data-testid="card-container"] img')) img.style.visibility = settings.blind ? 'hidden' : '';
  }
  SMC.settingsListeners.push(() => { applyBadges(); if (lastView && SMC.rootOf("sm-search")) renderSearch(); });
  // R7: nach ✕ (Panel weg) bauen die Tasten es nicht wieder auf
  const open = () => !P.ROOM_RE.test(location.pathname) && lastView && !!SMC.rootOf('sm-search');
  keys.KeyV = () => { if (open()) { compareMode = !compareMode; renderSearch(); } };
  keys.KeyK = () => { if (open()) copyTop(); };
  // R7: abgelaufene Sammlung (älter als 2 h) beim Start löschen, statt sie dauerhaft liegen zu lassen
  chrome.storage.local.get('pool').then(r => { if (r.pool && !(Date.now() - r.pool.at < POOL.TTL)) chrome.storage.local.remove('pool'); }).catch(() => {});

  window.StayMatchContent.search = { handle: handleSearch, checkEmpty, reset() { lastSig = ''; lastView = null; } };
})();
