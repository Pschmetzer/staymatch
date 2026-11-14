// StayMatch – Suchseite: bewertet alle sichtbaren Unterkünfte, zeigt die Top 3 mit Filtern (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, POOL = window.StayMatchPool, X = window.StayMatchExtras;
  const SMC = window.StayMatchContent;
  const { getTrip, allListings, h, panel, copyText, settings, keys, REPORT_URL } = SMC;
  const I18n = window.StayMatchI18n;
  const t = (k, v) => I18n.t(k, v);

  const FILTER_KEYS = ['rating', 'budget', 'beds', 'fav', 'lux', 'lowFees'];
  const filterLabel = k => ({ rating: t('search.filter.rating'), budget: t('search.filter.budget'), beds: t('search.filter.beds'), fav: t('search.filter.fav'), lux: t('search.filter.lux'), lowFees: t('search.filter.lowFees') })[k]; // Labels erst zur Anzeigezeit übersetzen
  let lastPoolJson = '';
  let lastSig = '', lastView = null, filters = {}, quick = { budgetNight: null, wishes: [] };
  let compareMode = false, flash = '';

  // R7: eine Filterfunktion für Panel und Tests (rank.js); ohne bekanntes Budget sortiert „im Budget“ nichts aus
  const passes = l => R.filterListings([l], { minRating: !!filters.rating, inBudget: !!filters.budget, enoughBeds: !!filters.beds, favorite: !!filters.fav, lux: !!filters.lux, lowFees: !!filters.lowFees }).length === 1;
  // R7 E: woran StayMatch einen Wunsch erkennt (Tooltip an den Chips)
  const WISH_SRC = k => ({ whole: () => t('search.wishSrc.whole'), trusted: () => t('search.wishSrc.trusted'), reviews: () => t('search.wishSrc.reviews'), luxury: () => t('search.wishSrc.luxury'), private: () => t('search.wishSrc.private') })[k]?.() || '';
  const activeFilters = () => FILTER_KEYS.filter(k => filters[k]);

  // Vergleich: eigene Auswahl (2 bis 4, auch aus dem Verlauf) oder die Top 3
  const MAX_CMP = 4;
  const fromItem = i => ({ id: i.id, title: i.title, kind: i.kind || null, locality: i.locality || null, rating: i.rating ?? null, reviewCount: i.reviewCount ?? null,
    totalPrice: i.pricePerNight ?? null, isTotal: false, currency: i.currency || null, lat: i.lat ?? null, lon: i.lon ?? null, beds: i.beds ?? null, bedrooms: i.bedrooms ?? null, baths: i.baths ?? null, badges: i.badges || [], image: i.image || null });
  function compareList() {
    const top = currentTop();
    const ids = (quick.compare || []).filter(Boolean);
    if (!lastView || ids.length < 2) return top;
    const out = [];
    for (const id of ids.slice(0, MAX_CMP)) {
      let l = lastView.ranked.find(x => x.id === id);
      if (!l) { const it = lastView.items?.find(x => x.id === id); if (it) l = R.rankListings([fromItem(it)], lastView.ctx)[0]; }
      if (l) out.push(l);
    }
    return out.length >= 2 ? out : top;
  }
  function compareCandidates() {
    const seen = new Set(), out = [];
    for (const l of lastView.ranked.filter(x => !x.rank.disliked).slice(0, 12)) { seen.add(l.id); out.push({ id: l.id, title: l.title || l.kind || t('search.place') }); }
    for (const i of (lastView.items || []).filter(x => (x.visits || 0) > 0 && x.vote !== -1 && !seen.has(x.id)).sort((a, b) => (b.lastSeen || 0) - (a.lastSeen || 0)).slice(0, 12)) out.push({ id: i.id, title: i.title || t('search.place'), history: true });
    return out;
  }

  // Top 3 als druckbare Seite: Stand lokal speichern, den Tab öffnet der Service Worker (keine Anfrage ins Netz)
  async function printTop() {
    const top = currentTop(), v = lastView;
    if (!top.length) return;
    const items = top.map((l, i) => ({ rank: i + 1, title: l.title || l.kind, kind: l.kind || null, locality: l.locality || null, rating: l.rating ?? null, reviewCount: l.reviewCount ?? null, score: l.rank.score,
      price: l.rank.stay != null ? `${l.rank.stayEstimated ? '≈ ' : ''}${R.money(l.rank.stay, l.currency)} ${t('search.unit.total')}` : l.totalPrice != null ? `${R.money(l.totalPrice, l.currency)} ${l.isTotal ? t('search.unit.total') : t('search.unit.night')}` : null,
      why: l.rank.why.slice(0, 4), warn: l.rank.warn.slice(0, 3), url: `${location.origin}/rooms/${l.id}` }));
    await chrome.storage.local.set({ printTop: { at: Date.now(), people: v.ctx.people || null, nights: v.ctx.nights || null, count: v.count, items } });
    try { await chrome.runtime.sendMessage({ type: 'sm-print' }); flash = ''; } catch { flash = t('search.printFailed'); renderSearch(); }
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
    // R7 E: Kopier-Optionen aus dem Popup (ohne Preise, ohne Emojis, Markdown), Preisstand und Entscheidungsfragen
    const so = settings.share || {};
    const text = R.shareText(top.map(l => ({ ...l, score: l.rank.score, url: url(l) })), {
      title: ctx.people > 1 ? t('search.share.titleGroup') : t('search.share.titleSolo'),
      sub: [ctx.people && t('search.people', { n: ctx.people }), ctx.nights && t('search.nights', { n: ctx.nights }), !so.noPrices && ctx.budget && t('search.budgetN', { v: `${Math.round(R.effectiveBudget(ctx))}${ctx.budgetCurrency ? ' ' + ctx.budgetCurrency : ''}` })].filter(Boolean).join(' · '),
      noPrices: !!so.noPrices, noEmoji: !!so.noEmoji, markdown: !!so.markdown, stamp: Date.now(), questions: so.noQuestions ? [] : R.decisionQuestions(top),
    });
    flash = (await copyText(text)) ? t('search.flash.copied') : t('search.flash.copyFailed');
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
    const [stored, savedTrip, items] = await Promise.all([chrome.storage.local.get(['filters', 'min:sm-search', 'pool', 'quick', 'priceLog', 'tasteIgnore', 'friendLikes', 'stats', 'visits']), getTrip(), allListings()]);
    const pool = POOL.mergePool(stored.pool, location.href, current);
    // R7 E: Spuren-Pause: Sammlung, letzte Suche und Preis-Log nur im Speicher, nichts schreiben
    const paused = settings.pauseUntil > Date.now();
    // Schreiblast senken: Sammlung nur schreiben, wenn sie sich wirklich geändert hat
    if (!paused) { try { const j = JSON.stringify(pool); if (j !== lastPoolJson) { lastPoolJson = j; chrome.storage.local.set({ pool }).catch?.(() => {}); } } catch {} }
    const byId = new Map(current.map(l => [l.id, l]));
    // Preis-Korrekturen gelten nur für diese Reisedaten (ein Mai-Preis darf im Dezember nicht weiterrechnen)
    const fixScope = `${sp.checkin || ''}|${sp.checkout || ''}`;
    // Preis-Korrekturen und -Ausschlüsse von Hand (quick.priceFix), gelten für diese Wertung und das Popup
    const listings = R.applyPriceFixes(Object.values(pool.items).map(p => byId.get(p.id) || p), stored.quick?.priceFix, fixScope);

    // Reise nur nutzen, wenn sie zu dieser Suche passt (gleiches Datum oder Unterkünfte nahe den Vierteln)
    // Vergangene Reise (Anreise liegt vor heute) gilt nicht mehr, sonst greift ein altes Budget still
    const tripStale = savedTrip?.checkin && sp.checkin !== savedTrip.checkin && String(savedTrip.checkin) < new Date().toISOString().slice(0, 10);
    const trip = savedTrip && !tripStale && ((sp.checkin && sp.checkin === savedTrip.checkin) ||
      listings.some(l => l.lat != null && R.areaFor({ lat: l.lat, lon: l.lon }, savedTrip.areas || []))) ? savedTrip : null;
    const seen = new Set(items.map(i => i.id));
    const disliked = new Set(items.filter(i => i.vote === -1).map(i => i.id));
    const known = new Map(items.map(i => [i.id, i]));
    // R7 E: Teilnehmer ±1 im Panel (Absage, Plus-Eins) ohne neue Suche
    const basePeople = trip?.people?.length || sp.adults || null;
    // gilt nur für dieselbe Suche (Pfad + Anreise), sonst rechnet eine neue Gruppe still mit der alten Zahl
    const deltaKey = location.pathname + '|' + (sp.checkin || '');
    const delta = basePeople && stored.quick?.deltaKey === deltaKey ? (stored.quick?.peopleDelta || 0) : 0;
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
    const ctx = { ownBed: !!quick.ownBed, people, adults: delta ? people : sp.adults || null, nights, tripNights: trip?.nights || null, budget: trip?.budget || null, budgetCurrency: (trip?.budget || quick.budgetNight) ? (trip?.currency || quick.budgetCurrency || (X ? X.pageCurrency(listings) : null) || null) : null, priceUnsure: !!sp.flexible, budgetPerNight: trip?.budget ? null : quick.budgetNight, areas: trip?.areas || [], weightTweak: R.cleanTweak(quick.weights), taste: R.buildTaste(tasteItems), seen, disliked, known, wishes: quick.wishes };
    const ranked = R.rankListings(listings, ctx);
    // R7 E: Merklisten von Freunden („Lena mag das“), nur aus dem, was du im Popup eingefügt hast
    const fl = stored.friendLikes || {};
    for (const l of ranked) if (fl[l.id]?.length) l.rank.info.push(t('search.friendLikes', { names: fl[l.id].join(', '), n: fl[l.id].length }));
    // R7 E: Zähler „heute bewertet“ fürs Popup (nur Zahlen, nie gesendet)
    if (!(settings.pauseUntil > Date.now())) {
      const day = new Date().toISOString().slice(0, 10), st = stored.stats?.day === day ? stored.stats : { day, rated: 0, opened: 0, ids: [] };
      const seenIds = new Set(st.ids), fresh = current.filter(l => !seenIds.has(l.id)).map(l => l.id);
      if (fresh.length) chrome.storage.local.set({ stats: { ...st, rated: st.rated + fresh.length, opened: items.filter(i => i.lastSeen && new Date(i.lastSeen).toISOString().slice(0, 10) === day).length, ids: [...st.ids, ...fresh].slice(-1000) } }).catch?.(() => {});
    }

    // „Seit deinem letzten Besuch“: Vergleich mit dem Stand dieser Suche beim vorigen Besuch (lokal, bei Pause nichts gespeichert)
    let since = null;
    if (X?.sinceLastVisit) {
      const r = X.sinceLastVisit(stored.visits?.[pool.key], listings, pool.pages.length);
      since = r.diff;
      if (!paused) chrome.storage.local.set({ visits: X.visitStore(stored.visits, pool.key, r.entry) }).catch?.(() => {});
    }

    filters = stored.filters || {};
    // R7 E: eigener Preisverlauf je Stadt (nur Median, Datum, Nächte; lokal) für „ungewöhnlich teuer“ und Wochenend-Aufschlag
    const anchor = X?.priceAnchor(ranked, ctx);
    const now = anchor && sp.checkin ? { path: location.pathname, ci: sp.checkin, nights, med: Math.round(anchor.median), cur: anchor.currency } : null;
    const log = (stored.priceLog || []).filter(e => e && e.path);
    const history = X && now ? X.priceHistoryNotes(log, now) : [];
    if (now && !paused && !log.some(e => e.path === now.path && e.ci === now.ci && e.nights === now.nights)) chrome.storage.local.set({ priceLog: [...log, now].slice(-60) }).catch?.(() => {});
    const booked = items.filter(i => i.booked && sp.checkin && i.booked.checkin === sp.checkin);
    const lastYear = X && anchor ? X.lastYear(items.filter(i => i.booked && i.booked.checkin !== sp.checkin), location.pathname, anchor.median, anchor.currency) : null;
    SMC.reportStatus(P.pageStatus(/^\/wishlists\//.test(location.pathname) ? 'wishlist' : 'search', current.length, null));
    lastView = { since, seenIds: new Set(items.filter(i => (i.visits || 0) > 0).map(i => i.id)), ranked, ctx, disliked, trip, count: listings.length, pages: pool.pages.length, quality: P.quality(current), min: !!stored['min:sm-search'], pool, listings, history, booked, basePeople, delta, deltaKey, lastYear, openWishes: lastView?.openWishes, items, fixScope };
    // R7 E: Seiten-Auswertung einmal je Suche rechnen (nicht bei jedem Chip-Klick)
    const top0 = currentTop();
    lastView.insights = X ? X.pageInsights(ranked.filter(l => !l.rank.disliked), top0, ctx, { pool, history, lastYear, listings: listings.length <= 300 ? listings : null }) : [];

    // Empfehlungen für das Popup merken (nur die eigene Auswahl, lokal). R7: dieselbe Auswahl wie im Panel (ohne 👎, mit Filtern), Einheit dabei
    if (!paused) chrome.storage.local.set({ lastSearch: { at: Date.now(), url: location.href, nights, people, order: ranked.filter(l => !disliked.has(l.id) && passes(l)).slice(0, 300).map(l => l.id), top: ranked.filter(l => !disliked.has(l.id) && passes(l)).slice(0, 10).map(l => ({ id: l.id, title: l.title, kind: l.kind, locality: l.locality, rating: l.rating, reviewCount: l.reviewCount, totalPrice: l.totalPrice, currency: l.currency, isTotal: !!l.isTotal, score: l.rank.score, why: l.rank.why, warn: l.rank.warn, stay: l.rank.stay, ppnPerson: l.rank.ppn?.person ?? null, url: `${location.origin}/rooms/${l.id}` })) } });

    applyBadges();
    renderSearch();
  }

  // Issue-Vorlage „Plugin erkennt die Seite nicht“ mit vorausgefüllten Feldern (Feld-IDs aus .github/ISSUE_TEMPLATE/plugin-erkennt-seite-nicht.yml).
  // GitHub füllt bei Issue-Formularen nur Textfelder über ihre ID, „body“ würde ignoriert. Keine Adresse, keine Seiteninhalte;
  // die Domain trägt die Person selbst ein, die Bestätigung (keine persönlichen Daten) setzt sie auch selbst.
  const reportUrl = (ver, report) => `${REPORT_URL}?` + Object.entries({
    template: 'plugin-erkennt-seite-nicht.yml', title: t('search.report.title'), domain: t('search.report.domain'),
    version: `StayMatch ${ver}`, what: t('search.report.what'), console: report,
  }).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');

  // Nach einer Wartezeit noch keine Unterkünfte gelesen → klare Meldung statt leerem Panel
  function checkEmpty() {
    if (!SMC.isList(location.pathname) || lastView) return;
    if (P.parseSearch(document).length) return handleSearch().catch(() => {}); // R7: erst prüfen, dann (teure) Diagnose
    const d = P.diagnose(document);
    const wish = /^\/wishlists\//.test(location.pathname);
    SMC.reportStatus(P.pageStatus(wish ? 'wishlist' : 'search', 0, d));
    if (wish) return; // Wunschliste (Aufbau ungeprüft): still bleiben statt Fehlerseite, nur im Popup als „nicht erkannt“ vermerkt
    const ver = chrome.runtime?.getManifest?.().version || '?';
    const report = t('search.report.text', { ver, note: d.stateCode || d.stateNote, count: d.stateCount, cards: d.cards, links: d.roomLinks }); // ohne URL und ohne Seiteninhalt
    panel('sm-error', t('search.error.title'), [
      h('div', { class: 'err' }, h('b', {}, t('search.error.head')), h('div', {}, P.diagnosisText(d))),
      h('div', { class: 'muted' }, t('search.error.stats', { note: d.stateNote, cards: d.cards, links: d.roomLinks })),
      h('div', { class: 'row' },
        // R7: lädt die Seite nur langsam, hilft ein neuer Versuch ohne auf die nächste DOM-Änderung zu warten
        h('button', { onclick: () => { document.getElementById('sm-error')?.remove(); lastSig = ''; if (P.parseSearch(document).length) handleSearch().catch(() => {}); else checkEmpty(); } }, t('search.error.retry')),
        h('button', { onclick: async e => { e.target.textContent = (await copyText(report)) ? t('panel.copied') : t('panel.notPossible'); } }, t('search.error.copy')),
        h('a', { class: 'btn', href: reportUrl(ver, report), target: '_blank', rel: 'noopener' }, t('search.error.report'))),
      h('div', { class: 'muted' }, t('search.error.note')),
    ]);
  }

  function renderSearch() {
    const { ctx, trip, count, pages, quality: q } = lastView;
    const old = SMC.rootOf('sm-search')?.querySelector('.box');
    const minimized = old ? old.classList.contains('min') : lastView.min;
    const top = currentTop();
    const M = (v, l) => R.money(v, l.currency); // R7: keine erfundene „€“-Angabe
    // Teilweise erkannt? Dann ehrlich sagen, was fehlt.
    const lacking = q && q.n >= 3 ? [q.noPrice > q.n / 2 && t('search.lack.price'), q.noRating > q.n / 2 && t('search.lack.rating'), q.noBeds > q.n / 2 && t('search.lack.beds'), q.noTitle > q.n / 2 && t('search.lack.title')].filter(Boolean) : [];
    const af = activeFilters();
    const weightWord = (name, f) => f === 1 ? t('search.w.default') : t(f > 1 ? 'search.w.more' : 'search.w.less', { f: I18n.dec(String(f)) });
    const resetFilters = async () => { filters = {}; await chrome.storage.local.set({ filters }); applyBadges(); renderSearch(); };
    const cut = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n).join('') + '…' : a.join(''); }; // R7: Emoji nicht zerschneiden
    const chip = label => { const m = String(label).match(/^(\S+)\s(.+)$/); return m && /\p{Extended_Pictographic}/u.test(m[1]) ? [h('span', { 'aria-hidden': 'true' }, m[1]), ' ', m[2]] : label; }; // R7: Emoji nicht vorlesen
    // R7: Punkte aus breakdown (summieren sich zum Grundwert) plus Abzüge, statt Rohwerte der Teile
    const partName = k => ({ area: t('search.part.area'), rating: t('search.part.rating'), price: t('search.part.price'), wishes: t('search.part.wishes'), beds: t('search.part.beds'), taste: t('search.part.taste') })[k] || k;
    const bd = l => [...(l.rank.breakdown || []).map(b => `${partName(b.key)} ${Math.round(b.points)}`),
      l.rank.adjust ? t('search.deductions', { v: l.rank.adjust }) : null].filter(Boolean).join(' · ');
    // Datenlage: nur sagen, wenn Teile fehlen (dann ist der Passt-Wert weniger belastbar)
    const coverageText = l => { const c = l.rank.coverage; return c && c.have < c.of ? t('search.coverage', { have: c.have, of: c.of }) : ''; };
    const eb = R.effectiveBudget(ctx);
    const budgetKnown = !!(R.effectiveBudget(ctx) || ctx.budgetPerNight);
    const setQuick = async patch => { quick = { ...quick, ...patch }; await chrome.storage.local.set({ quick }); lastSig = ''; handleSearch().catch(e => console.debug('StayMatch:', e)); };
    const pageCur = ctx.budgetCurrency || (X ? X.pageCurrency(lastView.listings) : null); // Währung aus der Seite statt festem „€“
    const budgetInput = h('input', { type: 'number', min: '0', step: '1', inputmode: 'numeric', placeholder: t('search.budget.placeholder'), 'aria-label': pageCur ? t('search.budget.ariaCur', { cur: pageCur }) : t('search.budget.aria'),
      style: 'width:90px;border:1px solid var(--line);border-radius:8px;padding:3px 6px;background:var(--bg);color:var(--fg);font:12px system-ui' });
    budgetInput.value = quick.budgetNight || '';
    budgetInput.onchange = () => { const v = Math.round(Number(budgetInput.value)); setQuick({ budgetNight: v > 0 ? v : null }); };
    // R7 E: Zusatz-Bereiche (eingeklappt, damit das Panel übersichtlich bleibt)
    const toggleWish = k => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] });
    const XW = X?.EXTRA_WISHES || {};
    const sentence = h('input', { type: 'text', placeholder: t('search.sentence.placeholder'), 'aria-label': t('search.sentence.aria'), style: 'width:100%;box-sizing:border-box;border:1px solid var(--line);border-radius:8px;padding:3px 6px;background:var(--bg);color:var(--fg);font:12px system-ui' });
    sentence.onchange = () => { const r = X.wishesFromSentence(sentence.value); setQuick({ wishes: [...new Set([...quick.wishes, ...r.wishes])], ...(r.budgetNight && !trip?.budget ? { budgetNight: r.budgetNight } : {}) }); };
    const xwOn = quick.wishes.filter(k => XW[k]).length;
    // R7 E: Kamin und Sauna nur Oktober bis März (Monat der Anreise, sonst heute)
    const mon = +(P.searchParams(location.href).checkin || new Date().toISOString()).slice(5, 7);
    // Halbkugel: Breite der Unterkünfte, sonst Länderendung der Airbnb-Domain (Südhalbkugel: .com.au, .co.nz, .com.br …); Tropen: nie „Winter“
    const latOf = (lastView?.ranked || []).find(l => l.lat != null)?.lat;
    const hostLat = /\.(?:com\.au|co\.nz|com\.br|co\.za|com\.ar|cl|com\.pe|com\.py|co\.id)$/.test(location.hostname) ? -35 : null;
    const winter = X ? X.isColdSeason(latOf ?? hostLat, mon) : [10, 11, 12, 1, 2, 3].includes(mon);
    // Eigene Gewichte: Regler 0,5 bis 2 (1 = Standard), gespeichert in quick.weights, wirken auf alle Wertungen
    const WLABEL = { price: t('search.part.price'), rating: t('search.part.rating'), area: t('search.part.area'), wishes: t('search.part.wishes'), beds: t('search.part.beds') };
    const weightsUi = h('div', { role: 'group', 'aria-label': t('search.weights.aria') }, h('div', { class: 'muted' }, t('search.weights.hint')),
      Object.entries(WLABEL).map(([k, name]) => {
        const cur = Number(quick.weights?.[k]) || 1;
        const inp = h('input', { type: 'range', min: '0.5', max: '2', step: '0.25', value: String(cur), 'aria-label': t('search.weights.slider', { name }), 'aria-valuetext': weightWord(name, cur), style: 'width:100%' });
        inp.onchange = () => { const v = Number(inp.value); const w = { ...(quick.weights || {}) }; if (v === 1) delete w[k]; else w[k] = v; setQuick({ weights: w }); };
        return h('label', { style: 'display:block' }, h('span', { class: 'muted' }, `${name}: ${weightWord(name, cur)}`), inp);
      }),
      quick.weights && Object.keys(quick.weights).length ? h('button', { onclick: () => setQuick({ weights: {} }) }, t('search.weights.reset')) : null);
    const moreWishes = X ? h('details', { open: lastView.openWishes ? '' : null, ontoggle: e => { lastView.openWishes = e.target.open; } }, h('summary', {}, xwOn || Object.keys(quick.weights || {}).length ? t('search.moreWishesActive', { k: xwOn + Object.keys(quick.weights || {}).length }) : t('search.moreWishes')),
      h('div', { class: 'muted' }, t('search.amenityHint')),
      h('div', { class: 'chips', role: 'group', 'aria-label': t('search.profiles.aria') }, Object.entries(X.PROFILES).map(([k, p]) => h('button', { title: p.wishes.join(', '), onclick: () => setQuick({ wishes: p.wishes.filter(w => R.WISHES[w] || R.REVIEW_WISHES[w] || XW[w]), profile: k }) }, chip(p.label)))),
      h('div', { class: 'chips', role: 'group', 'aria-label': t('search.amenities.aria') }, Object.entries(XW).filter(([k, w]) => w.season !== 'winter' || winter || quick.wishes.includes(k)).map(([k, w]) => h('button', { class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)), title: t('search.source', { src: w.src }), onclick: () => toggleWish(k) }, chip(w.label)))),
      sentence,
      weightsUi,
      ctx.people ? h('div', { class: 'row', style: 'align-items:center;gap:6px' },
        h('span', { class: 'muted' }, lastView.delta ? t('search.guestsAdj', { p: ctx.people, base: lastView.basePeople }) : t('search.guests', { p: ctx.people })),
        h('button', { 'aria-label': t('search.fewer'), onclick: () => setQuick({ deltaKey: lastView.deltaKey, peopleDelta: Math.max(1 - (lastView.basePeople || 1), lastView.delta - 1) }) }, '−1'),
        h('button', { 'aria-label': t('search.more'), onclick: () => setQuick({ deltaKey: lastView.deltaKey, peopleDelta: lastView.delta + 1 }) }, '+1')) : null,
      h('div', { class: 'chips' },
        h('button', { class: quick.ownBed ? 'on' : '', 'aria-pressed': String(!!quick.ownBed), title: t('search.ownBed.title'), onclick: () => setQuick({ ownBed: !quick.ownBed }) }, chip(t('search.ownBed'))),
        h('button', { class: quick.smoker ? 'on' : '', 'aria-pressed': String(!!quick.smoker), title: t('search.smoker.title'), onclick: () => setQuick({ smoker: !quick.smoker }) }, chip(t('search.smoker'))))) : null;
    // Preis von Hand korrigieren (Nachtpreis) oder ausschließen; gespeichert in quick.priceFix, höchstens 200 Einträge
    const setFix = (id, fix) => { const k = `${id}|${lastView.fixScope}`; const f = { ...(quick.priceFix || {}) }; delete f[k]; if (fix) f[k] = fix; setQuick({ priceFix: Object.fromEntries(Object.entries(f).slice(-200)) }); };
    const priceFixUi = l => {
      const fx = (quick.priceFix || {})[`${l.id}|${lastView.fixScope}`];
      const inp = h('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', 'aria-label': t('search.fix.aria', { cur: l.currency || t('search.fix.yourCur'), title: cut(l.title || l.kind, 30) }), style: 'width:80px;font:inherit' });
      inp.value = fx?.price || (l.priceFixed ? l.totalPrice : '');
      const ok = () => { const v = Math.round(Number(inp.value)); if (v > 0) setFix(l.id, { price: v }); };
      inp.onkeydown = e => { if (e.key === 'Enter') ok(); };
      return h('details', { open: l.priceImplausible && !l.priceExcluded ? '' : null }, h('summary', {}, fx ? (fx.exclude ? t('search.fix.excluded') : t('search.fix.corrected')) : t('search.fix.wrong')),
        h('div', { class: 'row', style: 'align-items:center' }, h('span', { class: 'muted' }, t('search.fix.label')), inp, h('button', { onclick: ok }, t('search.fix.apply'))),
        h('div', { class: 'row' }, h('button', { onclick: () => setFix(l.id, { exclude: true }) }, t('search.fix.exclude')), fx ? h('button', { onclick: () => setFix(l.id, null) }, t('search.fix.reset')) : null));
    };
    const cmp = compareMode ? compareList() : top;
    const picked = new Set(quick.compare || []);
    const setCompare = ids => setQuick({ compare: ids });
    const cmpPick = h('details', { open: '' }, h('summary', {}, t(picked.size >= 2 ? 'search.pick.own' : 'search.pick.top', { c: cmp.length })),
      h('div', { class: 'muted' }, t('search.pick.hint', { max: MAX_CMP })),
      compareCandidates().map(c => { const on = picked.has(c.id); const cb = h('input', { type: 'checkbox', checked: on ? '' : null, disabled: !on && picked.size >= MAX_CMP ? '' : null, 'aria-label': t('search.pick.aria', { title: c.title }) });
        cb.onchange = () => { const cur = quick.compare || []; setCompare(cur.includes(c.id) ? cur.filter(x => x !== c.id) : cur.length >= MAX_CMP ? cur : [...cur, c.id]); }; return h('label', { style: 'display:block' }, cb, ` ${c.history ? '👁 ' : ''}${cut(c.title, 40)}`); }),
      picked.size ? h('button', { onclick: () => setCompare([]) }, t('search.pick.back')) : null);
    const first = top[0];
    // „Warum nicht Platz 1?“: nach Klick auf die Plakette einer Karte
    const whyL = lastView.whyId && lastView.ranked.find(x => x.id === lastView.whyId);
    const whyOrder = lastView.ranked.filter(x => !x.rank.disliked && passes(x)).map(x => x.id);
    const whyBox = whyL && X ? h('div', { class: 'item', role: 'status' }, h('b', {}, t('search.why.title', { title: cut(whyL.title || whyL.kind, 34) })),
      h('ul', {}, X.whyNotFirst(whyL, whyOrder[0] && lastView.ranked.find(x => x.id === whyOrder[0]), { rank: whyOrder.indexOf(whyL.id) + 1 || null, of: whyOrder.length }).map(t => h('li', {}, t))),
      h('button', { onclick: () => { lastView.whyId = null; renderSearch(); } }, t('search.close'))) : null;
    const insights = lastView.insights || [];
    const shifts = X ? X.shiftLinks(location.href) : [];
    const fsug = X ? X.filterSuggestion(location.href, lastView.ranked, ctx.people) : null;
    let speaking = false; // Sprache der Ansage = Sprache des Panels
    const stopSpeak = () => { try { speechSynthesis.cancel(); speaking = false; } catch {} };
    const speak = () => { try { const u = new SpeechSynthesisUtterance(top.map((l, i) => t('search.speak.item', { rank: i + 1, title: l.title || l.kind, score: l.rank.score, why: l.rank.why.slice(0, 2).join('. ') })).join(' ')); u.lang = I18n.locale(); u.onend = () => { speaking = false; }; speechSynthesis.cancel(); speaking = true; speechSynthesis.speak(u); } catch {} };
    const morePage = X && (insights.length || shifts.length || fsug) ? h('details', {}, h('summary', {}, t('search.more.summary', { c: insights.length })),
      h('ul', {}, insights.map(x => h('li', {}, x))),
      shifts.length || fsug ? h('div', { class: 'muted' }, t('search.more.open'), ...shifts.flatMap(x => [h('a', { href: x.url, target: '_blank', rel: 'noopener' }, x.label), ' · ']), fsug ? h('a', { href: fsug.url, target: '_blank', rel: 'noopener' }, fsug.text) : null) : null,
      typeof speechSynthesis !== 'undefined' && top.length ? h('span', {}, h('button', { onclick: speak }, t('search.speak.start')), ' ', h('button', { onclick: stopSpeak, 'aria-label': t('search.speak.stop.aria') }, t('search.speak.stop'))) : null) : null;
    const inBudget = lastView.ranked.filter(l => l.rank.parts.price != null && l.rank.parts.price >= 0.75).length;
    panel('sm-search', trip && ctx.people > 1 ? t('search.title.group') : ctx.people === 1 ? t('search.title.solo') : (/^\/wishlists\//.test(location.pathname) ? t('search.title.wishlist') : t('search.title.page')), [
      h('div', { class: 'muted' }, `${pages > 1 ? t('search.status.pages', { count, pages }) : t('search.status.page', { count })}${ctx.people ? ` · ${t('search.people', { n: ctx.people })}${lastView.delta ? t('search.status.adjusted') : ''}` : ''}${ctx.nights ? ` · ${t('search.nights', { n: ctx.nights })}` : ''}${ctx.budget && eb ? ` · ${t('search.budgetN', { v: `${Math.round(eb)}${ctx.budgetCurrency ? ' ' + ctx.budgetCurrency : ''}` })}${ctx.nights ? t('search.forNights', { n: ctx.nights }) : ''}` : ''}`),
      quick.wishes.includes('luxury') ? h('div', { class: 'muted' }, t('search.lux.found', { k: lastView.ranked.filter(l => l.rank.luxury?.state === true).length, count }) + (lastView.ranked.some(l => l.rank.luxury?.state === true) ? '' : t('search.lux.none'))) : null,
      X?.visitText(lastView.since) ? h('div', { class: 'muted', role: 'status' }, X.visitText(lastView.since), (lastView.since.cheaper || []).slice(0, 3).map(c => { const l = lastView.ranked.find(x => x.id === c.id); return l ? h('div', {}, '↓ ', cut(l.title || l.kind, 34), ` ${M(c.from, l)} → ${M(c.to, l)}`) : null; })) : null,
      lastView.booked?.length ? h('div', { class: 'err', role: 'status' }, h('b', {}, t('search.booked.head')), lastView.booked.map(b => b.title || t('search.place')).join(', '), t('search.booked.tail')) : null,
      lacking.length ? h('div', { class: 'err muted' }, t('search.lacking', { list: lacking.join(', ') })) : null,
      !trip?.budget ? h('div', { class: 'row', style: 'align-items:center;gap:8px' }, h('span', { class: 'muted' }, pageCur ? t('search.budget.labelCur', { cur: pageCur }) : t('search.budget.label')), budgetInput) : null,
      h('div', { class: 'chips', role: 'group', 'aria-label': t('search.wishes.aria') }, Object.entries(R.WISHES).map(([k, w]) => h('button', {
        class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)),
        onclick: () => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] }),
        title: WISH_SRC(k),
      }, chip(w.label))), Object.entries(R.REVIEW_WISHES).map(([k, w]) => h('button', {
        class: quick.wishes.includes(k) ? 'on' : '', 'aria-pressed': String(quick.wishes.includes(k)),
        title: t('search.reviewWish.title'),
        onclick: () => setQuick({ wishes: quick.wishes.includes(k) ? quick.wishes.filter(x => x !== k) : [...quick.wishes, k] }),
      }, chip(`${{ quiet: '🤫', clean: '🧽', wifi: '📶' }[k]} ${w[0]}`)))),
      moreWishes,
      h('div', { class: 'chips', role: 'group', 'aria-label': t('search.filters.aria') }, FILTER_KEYS.map(k => h('button', {
        class: filters[k] ? 'on' : '', 'aria-pressed': String(!!filters[k]),
        // R7: aria-disabled statt disabled: bleibt fokussierbar, die Erklärung ist per aria-describedby erreichbar
        ...(k === 'budget' && !budgetKnown ? { 'aria-disabled': 'true', 'aria-describedby': 'sm-budget-hint', title: t('search.filter.noBudget'), style: 'opacity:.5;cursor:not-allowed' } : {}),
        onclick: async () => { if (k === 'budget' && !budgetKnown) return; filters[k] = !filters[k]; await chrome.storage.local.set({ filters }); applyBadges(); renderSearch(); },
      }, chip(filterLabel(k))))),
      !budgetKnown ? h('div', { class: 'muted', id: 'sm-budget-hint' }, t('search.filter.noBudgetHint')) : null,
      // R7: Filter gelten für jede Suche: sichtbar machen und mit einem Klick zurücksetzen
      af.length ? h('div', { class: 'muted' }, t('search.filter.active', { list: af.map(k => filterLabel(k).replace(/^\S+\s/, '')).join(', ') }), h('button', { onclick: resetFilters }, t('search.filter.reset'))) : null,
      top.length ? h('div', { class: 'row' },
        h('button', { class: compareMode ? 'on' : '', 'aria-pressed': String(compareMode), title: 'Alt+Shift+V', 'aria-keyshortcuts': 'Alt+Shift+V', onclick: () => { compareMode = !compareMode; renderSearch(); } }, t('search.compare')),
        h('button', { title: 'Alt+Shift+K', 'aria-keyshortcuts': 'Alt+Shift+K', onclick: copyTop }, t('search.copyTop')),
        h('button', { onclick: printTop }, t('search.printTop'))) : null,
      flash ? h('div', { class: 'muted', role: 'status' }, flash) : null,
      whyBox,
      top.length && compareMode ? cmpPick : null,
      top.length && compareMode
        // scrollbar und per Tastatur fokussierbar: bei 150 % Textgröße läuft die Tabelle sonst aus dem Panel
        ? h('div', { class: 'cmp-scroll', role: 'region', tabindex: '0', 'aria-label': t('search.cmpTable.aria') }, h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, ''), cmp.map((l, i) => h('th', {}, h('a', { href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener', style: 'color:inherit' }, `${i + 1}. ${cut(l.title || l.kind, 28)}`))))),
          h('tbody', {}, R.compareRows(cmp, ctx).map(r => h('tr', {}, h('th', { scope: 'row' }, r.label), r.cells.map(c => h('td', {}, c)))))))
        : null,
      top.length && !compareMode ? top.map((l, i) => h('div', { class: 'item hotel' },
        h('div', { class: 'ph' },
          l.image && !settings.blind ? h('img', { src: l.image, alt: l.title || l.kind || '', loading: 'lazy', referrerpolicy: 'no-referrer' }) : null,
          h('span', { class: 'rank' }, `${i + 1}`),
          h('span', { class: 'score', title: coverageText(l) ? t('search.scoreTitleCov', { cov: coverageText(l) }) : t('search.scoreTitle') }, l.rank.score),
          l.rank.luxury?.state === true ? h('span', { class: 'lux', title: l.rank.luxury.words.join(', ') }, t('search.lux.badge') + (l.rank.luxury.words[0] ? ' · ' + l.rank.luxury.words[0] : '')) : null),
        h('div', { class: 'meta' },
          h('a', { class: 'name', href: `${location.origin}/rooms/${l.id}${location.search}`, target: '_blank', rel: 'noopener' }, l.title || l.kind),
          h('button', { 'aria-label': t('search.showOnPage.aria', { title: l.title || l.kind }), title: t('search.showOnPage.title'), onclick: () => showOnPage(l.id) }, '📍'),
          l.rating != null ? h('span', { class: 'stars' }, `★ ${I18n.dec(String(l.rating))}${l.reviewCount ? ` (${l.reviewCount})` : ''}`) : null),
        h('div', { class: 'muted' }, [l.kind, l.locality].filter(Boolean).join(' · '), l.wishlisted === true ? t('search.wishlisted') : ''),
        l.totalPrice != null ? h('div', { class: 'price' }, h('b', {}, M(l.totalPrice, l)), ' ' + (l.isTotal ? t('search.unit.total') : t('search.unit.night')), l.rank.ppn?.person ? ` · ${t('search.perPerson', { p: M(l.rank.ppn.person, l) })}` : '', l.discounted ? t('search.discount') : '') : null,
        h('ul', {}, l.rank.why.map(w => h('li', {}, w)), l.rank.warn.map(w => h('li', { class: 'warn' }, '⚠️ ' + w)), (l.rank.info || []).map(w => h('li', { class: 'muted' }, w)),
          i > 0 && X ? [X.gapToFirst(l, first)].filter(Boolean).map(w => h('li', { class: 'muted' }, w)) : null),
        priceFixUi(l),
        h('div', { class: 'muted' }, t('search.breakdown', { bd: bd(l) })),
        coverageText(l) ? h('div', { class: 'muted' }, t('search.dataCoverage', { cov: coverageText(l) })) : null))
        : !top.length ? h('div', { class: 'muted' }, t('search.noMatch'), af.length ? h('button', { onclick: resetFilters }, t('search.filter.reset')) : null) : null,
      morePage,
      h('div', { class: 'muted' }, t('search.paging')),
      pages > 1 ? h('div', { class: 'row' }, h('button', { onclick: async () => { await chrome.storage.local.remove('pool'); lastPoolJson = ''; lastSig = ''; lastView = null; SMC.route?.(); } }, t('search.clearPool'))) : null,
      h('div', { class: 'muted' }, t('search.keys')),
      // R7 E: Kennenlernen beim ersten Panel, danach nie wieder
      !settings.onboarded ? h('div', { class: 'err muted', role: 'note' }, h('b', {}, t('search.onboard.head')), t('search.onboard.text'),
        h('button', { onclick: async () => { const { settings: st = {} } = await chrome.storage.local.get('settings'); await chrome.storage.local.set({ settings: { ...st, onboarded: true } }); } }, t('search.onboard.ok'))) : null,
      !trip ? h('div', { class: 'muted' }, t('search.tip.a'), h('a', { href: window.StayMatchCore.APP_URL, target: '_blank', rel: 'noopener' }, t('search.tip.b')), t('search.tip.c')) : null,
    ], { minimized, wide: compareMode, announce: top[0] ? t('search.announce', { title: cut(top[0].title || top[0].kind, 60), count }) + (budgetKnown ? t('search.announce.budget', { k: inBudget }) : '') + t('search.announce.best', { score: top[0].rank.score }) : t('search.announce.none') }); // R7: Ansage für Screenreader
  }

  // Punkte direkt an den Karten (abschaltbar im Popup). Markiert, damit der MutationObserver sie ignoriert.
  // Klick im Panel: zur Karte auf der Airbnb-Seite scrollen (kurz blinken, ohne Bewegung bei „weniger Bewegung“)
  function showOnPage(id) {
    for (const card of document.querySelectorAll('[data-testid="card-container"]')) {
      if (card.querySelector('a[href*="/rooms/"]')?.getAttribute('href')?.match(P.ROOM_RE)?.[1] !== id) continue;
      const calm = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      card.scrollIntoView?.({ block: 'center', behavior: calm ? 'auto' : 'smooth' });
      card.style.boxShadow = '0 0 0 6px rgba(224,71,91,.45)'; setTimeout(() => { card.style.boxShadow = ''; }, 1600);
      return true;
    }
    return false;
  }
  function applyBadges() {
    if (!lastView) return;
    const byId = new Map(lastView.ranked.map(l => [l.id, l]));
    const tr = lastView.trip || {};
    const topIds = new Set(currentTop().map(l => l.id)), seenIds = lastView.seenIds || new Set();
    const privateNames = [...(tr.people || []).map(p => p?.name), ...(tr.areas || []).map(a => a?.minName)].filter(n => typeof n === 'string' && n.trim().length >= 2).map(n => n.trim());
    for (const card of document.querySelectorAll('[data-testid="card-container"]')) {
      const id = card.querySelector('a[href*="/rooms/"]')?.getAttribute('href')?.match(P.ROOM_RE)?.[1];
      const l = id && byId.get(id);
      let b = card.querySelector('[data-staymatch-badge]');
      if (!l || !settings.showBadges) { b?.remove(); card.style.opacity = ''; card.style.outline = ''; continue; } // R7: Abdunkeln auch ohne Wertung zurücksetzen
      if (!b) {
        b = h('div', { 'data-staymatch-badge': '1', 'data-staymatch': '1' });
        if (getComputedStyle(card).position === 'static') card.style.position = 'relative';
        card.appendChild(b);
      }
      const s = l.rank.score;
      const bg = s >= 75 ? '#1f9d6b' : s >= 55 ? '#d68a00' : '#9a9aa0';
      b.style.cssText = `position:absolute;right:52px;top:12px;z-index:3;background:${bg};color:#fff;font:600 12px system-ui;padding:3px 8px;border-radius:999px;${settings.scoreOnly ? 'pointer-events:none' : 'pointer-events:auto;cursor:pointer'}`;
      if (!settings.scoreOnly) b.onclick = e => { e.preventDefault(); e.stopPropagation(); lastView.whyId = l.id; SMC.rootOf('sm-search')?.querySelector('.box')?.classList.remove('min'); chrome.storage.local.set({ 'min:sm-search': false }); renderSearch(); }; // nur Maus-Abkürzung: das Panel zeigt dieselben Infos
      const pp = l.rank.ppn?.person;
      // R7 E: Screenshot-Modus: nur die Punkte, ohne Preis und ohne Tooltip
      b.textContent = settings.scoreOnly ? String(s) : `StayMatch ${s}${pp ? ` · ${t('search.perPerson', { p: R.money(pp, l.currency) })}` : ''}`;
      // R7: Airbnbs Skripte können das title-Attribut lesen: keine Namen der Mitreisenden hinein
      b.title = settings.scoreOnly ? '' : [t('search.badge.click'), ...(l.rank.coverage && l.rank.coverage.have < l.rank.coverage.of ? [t('search.badge.parts', { have: l.rank.coverage.have, of: l.rank.coverage.of })] : []), ...l.rank.why, ...l.rank.warn].filter(x => !privateNames.some(n => x.includes(n) || /mag das|mögen das|likes this|like this/.test(x))).join(' · ');
      // Top-3 hervorgehoben, „schon angesehen“ (du hast die Unterkunftsseite geöffnet) als Zusatz an der Plakette
      const rank = [...topIds].indexOf(l.id);
      card.style.outline = rank >= 0 && !settings.scoreOnly ? '3px solid #e0475b' : '';
      card.style.outlineOffset = rank >= 0 ? '-3px' : '';
      if (rank >= 0) b.dataset.top = String(rank + 1); else delete b.dataset.top;
      if (seenIds.has(l.id) && !settings.scoreOnly) b.textContent += t('search.badge.seen');
      card.style.opacity = l.rank.disliked ? '0.45' : !passes(l) ? '0.35' : '';
    }
    // R7 E: Blindverkostung: Fotos aller Karten ausblenden (rückgängig, wenn abgeschaltet)
    for (const img of document.querySelectorAll('[data-testid="card-container"] img')) img.style.visibility = settings.blind ? 'hidden' : '';
  }
  SMC.settingsListeners.push(() => { applyBadges(); if (lastView && SMC.rootOf("sm-search")) renderSearch(); });
  // R7: nach ✕ (Panel weg) bauen die Tasten es nicht wieder auf
  const open = () => !P.ROOM_RE.test(location.pathname) && lastView && !!SMC.rootOf('sm-search');
  keys.KeyV = () => { if (open()) { compareMode = !compareMode; renderSearch(); SMC.say(compareMode ? t('search.say.compareOn') : t('search.say.compareOff')); } };
  keys.KeyK = () => { if (open()) copyTop().then(() => SMC.say(flash || t('search.say.copied'))).catch(() => {}); };
  // R7: abgelaufene Sammlung (älter als 2 h) beim Start löschen, statt sie dauerhaft liegen zu lassen
  chrome.storage.local.get('pool').then(r => { if (r.pool && !(Date.now() - r.pool.at < POOL.TTL)) chrome.storage.local.remove('pool'); }).catch(() => {});

  window.StayMatchContent.search = { handle: handleSearch, checkEmpty, reset() { lastSig = ''; lastPoolJson = ''; lastView = null; } };
})();
