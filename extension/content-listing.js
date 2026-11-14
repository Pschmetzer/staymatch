// StayMatch – Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, C = window.StayMatchCore;
  const SMC = window.StayMatchContent, H = window.StayMatchHints, X = window.StayMatchExtras;
  const I18n = window.StayMatchI18n;
  const t = (k, v) => I18n.t(k, v);
  const { getListing, saveListing, getTrip, h, panel, keys, T, copyText, SCAM_HELP_URL } = SMC;
  const scamHelp = () => h('a', { href: SCAM_HELP_URL, target: '_blank', rel: 'noopener' }, t('room.scamHelp'));

  const reviewHints = window.StayMatchHints.reviewHints; // einzige Quelle: hints.js

  function roomData(id) {
    // R7: auch Objekte in „@graph“; der erste Treffer gilt (spätere Skripte überschreiben ihn nicht)
    let ld = null;
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { const j = JSON.parse(s.textContent); ld = [].concat(j, j?.['@graph'] || []).find(x => x && (x.aggregateRating || x.geo)) || null; } catch {}
      if (ld) break;
    }
    ld ||= {};
    const ratingVal = parseFloat(String(ld.aggregateRating?.ratingValue ?? '').replace(',', '.')); // R7: „4,9“ wurde NaN
    const meta = n => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content;
    const sp = P.searchParams(location.href);
    const ogParts = String(meta('og:title') || '').split(/\s[·•|]\s/);
    // Preis nur aus dem Buchungsbereich, nicht aus "ähnliche Unterkünfte"
    const book = document.querySelector('[data-testid="book-it-default"], [data-section-id="BOOK_IT_SIDEBAR"], [data-plugin-in-point-id="BOOK_IT_SIDEBAR"]');
    // R7: Währung vorn oder hinten, alle Währungen aus parse.js, bei Rabatt der aktuelle Preis
    const bp = P.bookPrice(book?.innerText || '');
    // R7: verschachtelte Treffer derselben Bewertung nur einmal (nur die äußersten Elemente)
    const outer = sel => { const els = [...document.querySelectorAll(sel)]; return els.filter(e => !els.some(o => o !== e && o.contains(e))); };
    // Nur echte Bewertungs-Blöcke: [data-testid*="review"] traf auch Überschrift, Histogramm und Knöpfe. Darum Tags und Mindestlänge prüfen.
    const isReviewBlock = e => !/^(H[1-6]|BUTTON|A|SVG|INPUT)$/i.test(e.tagName) && !e.closest('button, [role="progressbar"], [role="heading"]') && (e.innerText || '').trim().split(/\s+/).length >= 2;
    const reviewEls = outer('[data-review-id], [data-testid^="review-"], [data-section-id*="REVIEWS"] [role="listitem"]').filter(isReviewBlock);
    const reviews = reviewEls.map(e => e.innerText).join('\n');
    // R5-99: fertige Textparser aus parse.js anwenden (ungeprüft live: wo diese Abschnitte im echten Seitenaufbau stehen)
    const sec = sel => [...document.querySelectorAll(sel)].map(e => e.innerText || '').join('\n').slice(0, 20000);
    const rulesText = sec('[data-section-id*="POLICIES"], [data-section-id*="HOUSE_RULES"], [data-section-id*="CANCELLATION"]');
    // R7: Storno nur aus dem Storno-Abschnitt, sonst trifft „streng“ aus den Hausregeln (Rückfall: ganzer Regeltext)
    const cancelText = sec('[data-section-id*="CANCELLATION"]') || rulesText;
    const descText = sec('[data-section-id*="DESCRIPTION"]');
    const amenText = sec('[data-section-id*="AMENITIES"], [data-section-id*="ACCESSIBILITY"]');
    const hostText = sec('[data-section-id*="MEET_YOUR_HOST"], [data-section-id*="HOST_PROFILE"]');
    const all = (descText + '\n' + rulesText);
    // R7 E: Zusatz-Hinweise aus denselben Abschnitten (Kaution, Gebühren, Betten, Ausstattung, Regeln …)
    const hostLink = document.querySelector('[data-section-id*="MEET_YOUR_HOST"] a[href*="/users/show/"], [data-section-id*="HOST_PROFILE"] a[href*="/users/show/"]');
    const hostId = hostLink?.getAttribute('href')?.match(/\/users\/show\/(\d+)/)?.[1] || null;
    const reviewSec = sec('[data-section-id*="REVIEWS"]');
    const bookText = book?.innerText || '';
    const extra = X ? X.roomExtras({ desc: descText, rules: rulesText, amen: amenText, host: hostText, book: book?.innerText || '' }) : null;
    const reviewTexts = outer('[data-review-id], [data-section-id*="REVIEWS"] [role="listitem"]').map(e => (e.innerText || '').slice(0, 600)).filter(Boolean).slice(0, 30);
    const found = {
      houseRules: rulesText ? P.houseRules(rulesText) : null,
      amenities: amenText ? P.amenities(amenText) : null,
      cancellation: cancelText ? P.cancellation(cancelText) : null,
      hostInfo: hostText ? P.hostInfo(hostText) : null,
      touristTax: all.trim() ? P.touristTax(all) : null,
      scamSignals: descText ? P.scamSignals(descText) : null,
      reviewTexts: reviewTexts.length ? reviewTexts : null,
      extra, hostId,
      // R7 E: Teilnoten, Gastgeber-Bewertungen, Last-Minute-Hinweis, Normalpreis bei Rabatt
      subRatings: X && reviewSec ? X.subRatings(reviewSec) : null,
      hostReviews: X && hostText ? X.hostReviewCount(hostText) : null,
      lastMinute: X ? X.lastMinute(bookText) : null,
      wasPrice: bp.was ?? null,
    };
    return {
      ...found,
      id, url: location.origin + location.pathname,
      title: ld.name || meta('og:title') || document.title,
      image: P.safeImage(meta('og:image')), // R7: wie auf der Suchseite nur echte https-Bilder
      rating: Number.isFinite(ratingVal) ? ratingVal : null,
      reviewCount: +(ld.aggregateRating?.ratingCount || ld.aggregateRating?.reviewCount || 0) || null,
      lat: ld.geo?.latitude ?? null, lon: ld.geo?.longitude ?? null,
      // R7: addressLocality ist meist die Stadt; das Viertel steht eher im Titel („Wohnung in Gràcia · ★4,9“). Ungeprüft live.
      // Nur das strukturierte Format („Art in Ort · ★…“) nutzen, kein freier Inseratsname („Penthouse am Meer“)
      locality: (ogParts.length > 1 && P.localityFromTitle(ogParts[0])) || ld.address?.addressLocality || null,
      city: ld.address?.addressLocality || null,
      pricePerNight: bp.night != null ? bp.night : bp.total != null && sp.nights ? Math.round(bp.total / sp.nights) : null,
      currency: bp.currency, stayTotal: bp.total ?? null,
      checkin: sp.checkin, checkout: sp.checkout,
      hints: reviews ? reviewHints(reviews) : [],
      reviewsRead: reviewEls.length || null, // wie viele Bewertungen auf der Seite gelesen wurden (Airbnb lädt nur einen Teil)
      _readOk: { hints: !!reviews, scamSignals: !!descText }, // Abschnitt war lesbar: leeres Ergebnis darf Altes überschreiben
    };
  }

  const roomTimers = new Map(); // ein Timer pro Unterkunft
  let currentRoom = null;
  async function handleRoom(id, attempt = 0) {
    await SMC.ready; // Pause-Einstellung zuerst laden
    const old = await getListing(id);
    const recent = old && Date.now() - old.lastSeen < C.VISIT_WINDOW_MS; // Reload ≠ neuer Besuch
    const { _readOk, ...data } = roomData(id);
    SMC.reportStatus(P.pageStatus('room', data.title && (data.rating != null || data.image || data.lat != null || data.reviewCount) ? 1 : 0, null));
    // fehlende Felder nicht mit null überschreiben. Ausnahme: war der Abschnitt lesbar und ist das Ergebnis leer, wird das Alte ersetzt
    // (ein verschwundener Hinweis bleibt sonst ewig im Verlauf)
    const clean = Object.fromEntries(Object.entries(data).filter(([k, v]) => (v != null && !(Array.isArray(v) && !v.length)) || (_readOk[k] && Array.isArray(v) && old?.[k]?.length)));
    // R7: Preisverlauf je Reise (Anreise, Nächte, Währung), sonst vergleicht er Juli mit November
    const priceHistory = [...(old?.priceHistory || [])];
    const sp = P.searchParams(location.href);
    const entry = { t: Date.now(), p: data.pricePerNight, c: data.currency || null, ci: sp.checkin || null, n: sp.nights || null };
    const last = priceHistory.at(-1);
    if (data.pricePerNight && !(last && last.p === entry.p && priceKey(last) === priceKey(entry))) priceHistory.push(entry);
    const item = await saveListing(id, { ...clean, priceHistory: priceHistory.slice(-30), visits: (old?.visits || 0) + (recent || SMC.isPaused() ? 0 : 1) });
    const trip = await getTrip();
    const area = trip?.areas?.length ? R.areaFor(item, trip.areas) : null;
    const { quick = {}, lastSearch } = await chrome.storage.local.get(['quick', 'lastSearch']);
    // R7: Personen wie auf der Suchseite: Gästezahl der Airbnb-Adresse hat Vorrang
    const pe = R.resolvePeople({ people: trip?.people?.length || null, adults: sp.adults || null });
    const fromSearch = (lastSearch?.top || []).find(l => l.id === id) || null;
    const pi = (lastSearch?.order || []).indexOf(id), place = pi >= 0 ? { rank: pi + 1, of: lastSearch.order.length } : null;
    const ctx = { place, solo: !pe.people || pe.people === 1, people: pe.people, wishes: quick.wishes || trip?.wishes || [], fromSearch, sp, smoker: !!quick.smoker, memory: await memoryFor(item, old) };
    ctx.paused = SMC.isPaused();
    roomPanel(item, area, ctx);
    // Langsame Leitung: Preis und Hinweise fehlen noch → einmal später nochmal lesen
    // (nicht, solange du gerade eine Notiz tippst: der Neuaufbau würde sie zurücksetzen)
    if (attempt < 1 && (!data.pricePerNight || !data.hints?.length) && P.ROOM_RE.test(location.pathname) && location.pathname.includes(id)) {
      const again = () => {
        if (!location.pathname.includes(id)) return;
        if (roomTimers.has(id) || SMC.rootOf('sm-room')?.activeElement?.tagName === 'TEXTAREA') return setTimeout(again, 1500); // Notiz in Arbeit: später
        handleRoom(id, attempt + 1).catch(e => console.debug('StayMatch:', e));
      };
      setTimeout(again, T.roomRetry ?? 4000);
    }
  }
  const priceKey = e => [e.c || '', e.ci || '', e.n || ''].join('|');

  // R7 E: was StayMatch aus deinem eigenen Verlauf weiß (Gastgeber-Gedächtnis, Plakette weg, neu eingestellt?, Grübel-Bremse)
  async function memoryFor(item, old) {
    const all = await SMC.allListings();
    return memoryOf(item, old, all, Date.now());
  }
  function memoryOf(item, old, all, now) {
    const out = { warn: [], info: [], plus: [] };
    const others = all.filter(o => o.id !== item.id);
    if (item.hostId) {
      const same = others.filter(o => o.hostId === item.hostId);
      if (same.some(o => o.vote === -1)) out.warn.push(t('room.mem.hostDown'));
      else if (same.some(o => o.vote === 1)) out.plus.push(t('room.mem.hostUp'));
    }
    if (old?.hostInfo?.superhost && item.hostInfo && !item.hostInfo.superhost) out.info.push(t('room.mem.superhostGone', { date: I18n.date(old.lastSeen) }));
    const nt = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!item.reviewCount && item.rating == null && nt(item.title).length >= 8) {
      const twin = others.find(o => nt(o.title) === nt(item.title) && o.rating != null && o.rating < 4.6);
      if (twin) out.warn.push(t('room.mem.twin', { r: I18n.dec(String(twin.rating)) }));
    }
    const recent = all.filter(o => o.lastSeen && now - o.lastSeen < 3 * 3600e3).length;
    if (recent >= 40) out.info.push(t('room.mem.many', { k: recent }));
    return out;
  }
  T.memoryOf = memoryOf;

  // R7 E: Bewertungen als Ganzes (Kritik-Quote, Lärmzeit, Gästemix, Sprachen, Zahlen, Trend)
  function reviewNotes(item, people) {
    const rt = item.reviewTexts || [], out = { warn: [], info: [] };
    const cs = H.criticalShare?.(rt);
    if (cs) out.info.push(cs.single ? t('room.rv.single', { total: cs.total }) : t('room.rv.critical', { critical: cs.critical, total: cs.total }));
    const nz = H.noiseTimes?.(rt);
    if (nz) out.info.push(t('room.rv.noise', { when: nz }));
    const mix = H.guestMix?.(rt);
    if (mix) out.info.push(t('room.rv.mix', { top: mix.label || mix.top }) + (people >= 4 && mix.top === 'Paare' ? t('room.rv.mixPeople', { people }) : ''));
    const lang = H.languages?.(rt);
    if (lang >= 3) out.info.push(t('room.rv.langs', { k: lang }));
    else if (lang === 1 && rt.length >= 8 && rt.every(x => String(x).length < 80)) out.info.push(t('room.rv.short'));
    const nf = H.numberFacts?.(rt) || [];
    if (nf.length) out.info.push(t('room.rv.facts', { list: nf.map(x => t('room.rv.quote', { x })).join(', ') }));
    if (H.renovated?.(rt)) out.info.push(t('room.rv.renovated'));
    for (const c of X?.claimConflicts(item.extra?.claims, item.hints) || []) out.warn.push(c);
    const hr = H.hostReplies?.(rt);
    if (hr) out.info.push(hr.replied ? t('room.rv.replied', { replied: hr.replied, critical: hr.critical }) + (hr.fixing ? t('room.rv.fixing', { fixing: hr.fixing }) : '') : t('room.rv.noReply', { critical: hr.critical }));
    const tr = H.keywordTrend?.(rt);
    if (tr) out.warn.push(tr);
    return out;
  }
  T.reviewNotes = reviewNotes;

  // R7: Hausregeln, Storno, Gastgeber und Kurtaxe als eine kompakte Zeile
  function factsLine(item) {
    const r = item.houseRules || {}, c = item.cancellation || {}, hi = item.hostInfo || {}, tx = item.touristTax || {};
    return [
      c.kind === 'free' ? (c.until ? t('room.fact.freeUntil', { until: c.until }) : t('room.fact.free')) : c.kind === 'nonrefundable' ? t('room.fact.nonrefundable') : c.kind === 'strict' ? t('room.fact.strict') : null,
      r.noParties && t('room.fact.noParties'),
      r.quietHours && typeof r.quietHours === 'object' ? t('room.fact.quiet', { from: r.quietHours.from, to: r.quietHours.to }) : r.quietHours === true ? t('room.fact.quietHours') : null,
      r.noSmoking && t('room.fact.noSmoking'),
      r.noPets ? t('room.fact.noPets') : r.petsAllowed ? t('room.fact.pets') : null,
      hi.superhost && 'Superhost',
      hi.responseTime === 'hour' ? t('room.fact.replyHour') : null,
      tx.extraOnSite && t('room.fact.tax'),
    ].filter(Boolean);
  }

  function roomPanel(item, area, ctx = {}) {
    const setVote = async v => { clearTimeout(roomTimers.get(item.id)); roomPanel(await saveListing(item.id, { vote: item.vote === v ? 0 : v, note: note.value }), area, ctx); }; // 2. Klick hebt auf
    currentRoom = { item, setVote, warnContact: () => { if (!ctx.copiedContact) roomPanel(item, area, { ...ctx, copiedContact: true }); } };
    const conflicts = R.reviewConflicts(item.hints, ctx.wishes);
    // Warnungen, die schon als Konflikt mit deinen Wünschen genannt sind, nicht doppelt zeigen
    const warns = H.warnings(item.hints).filter(w => !conflicts.some(c => c.endsWith(w.replace(/^⚠️\s*/, ''))));
    const ppn = item.pricePerNight && ctx.people > 1 ? Math.round(item.pricePerNight / ctx.people) : null;
    const note = h('textarea', { placeholder: t('room.note.placeholder'), 'aria-label': t('room.note.aria') });
    note.value = item.note || ''; // value statt innerHTML → kein Code-Einschleusen
    note.oninput = () => { clearTimeout(roomTimers.get(item.id)); roomTimers.set(item.id, setTimeout(() => { roomTimers.delete(item.id); saveListing(item.id, { note: note.value }); }, T.noteDelay ?? 400)); };
    // Etiketten („Plan A/B“): Schnellwahl plus eigene, bis zu 5; sichtbar und filterbar im Popup
    const tags = item.tags || [];
    const setTags = async next => roomPanel(await saveListing(item.id, { tags: next.slice(0, 5), note: note.value }), area, ctx);
    const tagInput = h('input', { type: 'text', maxlength: '20', placeholder: t('room.tag.placeholder'), 'aria-label': t('room.tag.aria'), style: 'width:110px;font:inherit' });
    tagInput.onkeydown = e => { if (e.key === 'Enter') { const t = tagInput.value.replace(/[<>]/g, '').trim().slice(0, 20); if (t && !tags.includes(t)) setTags([...tags, t]); } };
    const ph = item.priceHistory || [];
    const lastP = ph.at(-1), firstSame = lastP && ph.find(e => priceKey(e) === priceKey(lastP));
    const change = firstSame && firstSame !== lastP ? Math.round((lastP.p / firstSame.p - 1) * 100) : 0;
    const facts = factsLine(item), fs = ctx.fromSearch;
    const short = String(item.title || t('search.place')).slice(0, 60);
    const visitsText = item.visits > 1 ? t('room.visits.many', { n: item.visits }) : t('room.visits.first');
    // R7 E: Zusatz-Hinweise. Wichtiges sichtbar (warn), der Rest gesammelt in „Mehr Hinweise“
    const sp = ctx.sp || {};
    const nights = sp.nights || null;
    const total = item.stayTotal ?? (item.pricePerNight && nights ? item.pricePerNight * nights : null);
    const notes = X ? X.roomNotes(item.extra, { people: ctx.people, children: sp.children, infants: sp.infants, pets: sp.pets, nights, checkin: sp.checkin, lat: item.lat, wishes: ctx.wishes,
      total, currency: item.currency, responseTime: item.hostInfo?.responseTime, hostSince: item.hostInfo?.since, noParties: item.houseRules?.noParties, noPets: item.houseRules?.noPets, noSmoking: item.houseRules?.noSmoking, smoker: ctx.smoker,
      text: `${item.title || ''}` }) : { warn: [], info: [], plus: [] };
    const xw = X ? (ctx.wishes || []).filter(k => X.EXTRA_WISHES[k]).map(k => [X.EXTRA_WISHES[k], X.EXTRA_WISHES[k].check(item.extra, item)]) : [];
    const wishMiss = xw.filter(([w, r]) => r === false && w.no).map(([w]) => t('room.wishMiss', { ok: w.ok, no: w.no }));
    const wishHit = xw.filter(([, r]) => r === true).map(([w]) => `✓ ${w.ok}`);
    const mem = ctx.memory || { warn: [], info: [], plus: [] };
    const topWarnExtra = [];
    const rv = reviewNotes(item, ctx.people);
    // R7 E: Teilnoten, Rabatt, Last-Minute, Gastgeber-Bilanz, Videocall-Ruhe, Kontaktdaten kopiert
    const sr = X ? X.subRatingNotes(item.subRatings, ctx.wishes) : { warn: [], info: [] };
    rv.warn.push(...sr.warn); rv.info.push(...sr.info);
    if (item.lastMinute) rv.info.push(t('room.lastMinute'));
    const hist = (item.priceHistory || []).slice(0, -1), cur0 = (item.priceHistory || []).at(-1);
    const dh = X && cur0 ? X.discountHonesty(item.wasPrice, item.pricePerNight, hist, e => priceKey(e) === priceKey(cur0)) : null;
    if (dh) rv.warn.push(dh);
    if (!item.reviewCount && item.hostReviews >= 50) rv.info.push(t('room.newListing', { k: item.hostReviews }));
    if ((ctx.wishes || []).includes('workspace') && (item.hints || []).some(x => /⚠️ (Baustelle|laut|construction|loud|noisy|noise)/i.test(x))) rv.warn.push(t('room.workspaceNoise'));
    if (ctx.copiedContact) topWarnExtra.push(t('room.copiedContact'));
    const topWarn = [...topWarnExtra, ...wishMiss, ...notes.warn, ...mem.warn, ...rv.warn];
    const more = [...wishHit, ...notes.plus.map(x => '👍 ' + x), ...mem.plus.map(x => '👍 ' + x), ...notes.info, ...mem.info, ...rv.info];
    const booked = item.booked;
    const setBooked = async () => {
      const b = booked ? null : { at: Date.now(), checkin: sp.checkin || null, checkout: sp.checkout || null, nights, people: ctx.people || null, total, currency: item.currency || null,
        why: (fs?.why || []).slice(0, 3), cancel: item.cancellation?.kind === 'free' ? item.cancellation.until || 'ja' : null }; // Entscheidungsnotiz: die drei Hauptgründe aus der Suche
      roomPanel(await saveListing(item.id, { booked: b }), area, ctx);
    };
    const advanceText = () => X?.advanceText?.(total, ctx.people, item.currency, item.cancellation);
    panel('sm-room', visitsText, [
      // R7: Betrugshinweise dort, wo gebucht wird, ganz oben
      item.scamSignals?.length ? h('div', { class: 'err', role: 'alert' }, h('b', {}, t('room.scam.head')), item.scamSignals.join(' · '), t('room.scam.tail'), scamHelp()) : null,
      ctx.place ? h('div', {}, h('b', {}, t('room.place', { rank: ctx.place.rank, of: ctx.place.of })), t('room.place.tail')) : null,
      // R7: Passt-Wert aus deiner letzten Suche, wenn du von dort kommst
      fs?.score != null ? h('div', {}, h('b', {}, t('room.score', { score: fs.score })), t('room.score.tail'), (fs.why || []).length ? ` · ${fs.why.slice(0, 2).join(' · ')}` : '') : null,
      ctx.paused ? h('div', { class: 'muted', role: 'status' }, t('room.paused')) : null,
      h('div', {}, item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : t('room.noStars')),
      area ? h('div', {}, t(ctx.solo ? 'room.area.solo' : 'room.area.group', { name: area.name, total: area.total })) : null,
      ppn ? h('div', {}, h('b', {}, R.money(ppn, item.currency)), t('room.perPersonNight')) : null,
      facts.length ? h('div', { class: 'muted' }, facts.join(' · ')) : null,
      booked ? h('div', {}, h('b', {}, t('room.booked')), booked.checkin ? ` · ${booked.checkin}${booked.checkout ? t('room.booked.to') + booked.checkout : ''}` : '', booked.why?.length ? h('div', { class: 'muted' }, t('room.booked.why') + booked.why.join(' · ')) : null) : null,
      ...conflicts.map(c => h('div', { class: 'warn' }, '⚠️ ' + c)),
      ...topWarn.map(c => h('div', { class: 'warn' }, '⚠️ ' + c)),
      ctx.copiedContact && !item.scamSignals?.length ? h('div', { class: 'muted' }, scamHelp()) : null,
      warns.length ? h('div', { class: 'err' }, h('b', {}, t('room.watchOut')), warns.map(x => x.replace(/^⚠️\s*/, '')).join(' · ')) : null,
      item.hints?.length ? h('div', { class: 'muted' }, (item.reviewsRead ? item.reviewCount ? t('room.fromReviewsReadOf', { read: item.reviewsRead, total: item.reviewCount }) : t('room.fromReviewsRead', { read: item.reviewsRead }) : t('room.fromReviews')) + item.hints.join(' · ')) : null,
      change ? h('div', { class: 'muted' }, t('room.priceChange', { v: (change > 0 ? '+' : '') + change })) : null,
      more.length ? h('details', {}, h('summary', {}, t('room.moreHints', { c: more.length })), h('ul', {}, more.map(x => h('li', {}, x)))) : null,
      h('div', { class: 'row' },
        h('button', { class: item.vote === 1 ? 'on' : '', 'aria-pressed': String(item.vote === 1), 'aria-keyshortcuts': 'Alt+Shift+L', title: 'Alt+Shift+L', onclick: () => setVote(1) }, t('room.like')),
        h('button', { class: item.vote === -1 ? 'on' : '', 'aria-pressed': String(item.vote === -1), 'aria-keyshortcuts': 'Alt+Shift+N', title: 'Alt+Shift+N', onclick: () => setVote(-1) }, t('room.dislike'))),
      h('div', { class: 'row' },
        h('button', { class: booked ? 'on' : '', 'aria-pressed': String(!!booked), onclick: setBooked }, booked ? t('room.booked') : t('room.markBooked')),
        booked && ctx.people > 1 && total ? h('button', { onclick: async e => { e.target.textContent = (await copyText(advanceText())) ? t('panel.copied') : t('panel.notPossible'); } }, t('room.advance')) : null),
      h('div', { class: 'chips', role: 'group', 'aria-label': t('room.labels.aria') }, ...['Plan A', 'Plan B', 'Plan C', ...tags.filter(t => !['Plan A', 'Plan B', 'Plan C'].includes(t))].map(t => h('button', { class: tags.includes(t) ? 'on' : '', 'aria-pressed': String(tags.includes(t)), onclick: () => setTags(tags.includes(t) ? tags.filter(x => x !== t) : [...tags, t]) }, '🏷 ' + t)), tagInput),
      note,
      h('div', { class: 'muted' }, t('room.keys')),
    ], { label: `StayMatch: ${short}, ${visitsText}` }); // R7: Screenreader erfahren, worum es geht
  }

  // R7 E: Kopier-Warnung, wenn auf der Unterkunftsseite Telefonnummer oder Mailadresse markiert und kopiert wird
  document.addEventListener('copy', () => {
    if (!currentRoom || !P.ROOM_RE.test(location.pathname) || !X) return;
    const sel = String(document.getSelection?.() || '');
    if (X.contactLike(sel)) currentRoom.warnContact();
  }, true);
  keys.KeyL = () => { if (P.ROOM_RE.test(location.pathname) && currentRoom) { SMC.say(currentRoom.item.vote === 1 ? t('room.say.likeRemoved') : t('room.say.likeSet')); currentRoom.setVote(1); } };
  keys.KeyN = () => { if (P.ROOM_RE.test(location.pathname) && currentRoom) { SMC.say(currentRoom.item.vote === -1 ? t('room.say.dislikeRemoved') : t('room.say.dislikeSet')); currentRoom.setVote(-1); } };
  window.StayMatchContent.room = { handle: handleRoom };
  window.StayMatchContent.start(); // letzte content-*.js-Datei: jetzt sind alle Module da
})();
