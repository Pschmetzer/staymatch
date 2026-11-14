// StayMatch – Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, C = window.StayMatchCore;
  const SMC = window.StayMatchContent, H = window.StayMatchHints, X = window.StayMatchExtras;
  const { getListing, saveListing, getTrip, h, panel, keys, T, copyText, SCAM_HELP_URL } = SMC;
  const scamHelp = () => h('a', { href: SCAM_HELP_URL, target: '_blank', rel: 'noopener' }, 'Verdacht auf Betrug? So reagierst du');

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
    const ctx = { solo: !pe.people || pe.people === 1, people: pe.people, wishes: quick.wishes || trip?.wishes || [], fromSearch, sp, smoker: !!quick.smoker, memory: await memoryFor(item, old) };
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
      if (same.some(o => o.vote === -1)) out.warn.push('Andere Unterkunft dieses Gastgebers hast du mit 👎 markiert');
      else if (same.some(o => o.vote === 1)) out.plus.push('Andere Unterkunft dieses Gastgebers hast du mit 👍 markiert');
    }
    if (old?.hostInfo?.superhost && item.hostInfo && !item.hostInfo.superhost) out.info.push(`Superhost-Status ist weg (zuletzt gesehen am ${new Date(old.lastSeen).toLocaleDateString('de-DE')})`);
    const nt = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!item.reviewCount && item.rating == null && nt(item.title).length >= 8) {
      const twin = others.find(o => nt(o.title) === nt(item.title) && o.rating != null && o.rating < 4.6);
      if (twin) out.warn.push(`Gleicher Titel wie eine früher gesehene Unterkunft mit ${String(twin.rating).replace('.', ',')} Sternen: neu eingestellt?`);
    }
    const recent = all.filter(o => o.lastSeen && now - o.lastSeen < 3 * 3600e3).length;
    if (recent >= 40) out.info.push(`Du hast in den letzten Stunden ${recent} Unterkünfte angesehen. Deine Top 3 stehen vermutlich fest – Zeit zu entscheiden?`);
    return out;
  }
  T.memoryOf = memoryOf;

  // R7 E: Bewertungen als Ganzes (Kritik-Quote, Lärmzeit, Gästemix, Sprachen, Zahlen, Trend)
  function reviewNotes(item, people) {
    const t = item.reviewTexts || [], out = { warn: [], info: [] };
    const cs = H.criticalShare?.(t);
    if (cs) out.info.push(cs.single ? `Nur 1 kritische unter ${cs.total} gelesenen Bewertungen: eher ein Einzelfall` : `${cs.critical} von ${cs.total} gelesenen Bewertungen kritisch`);
    const nz = H.noiseTimes?.(t);
    if (nz) out.info.push(`Lärm laut Bewertungen ${nz}`);
    const mix = H.guestMix?.(t);
    if (mix) out.info.push(`Gäste meist ${mix.top}${people >= 4 && mix.top === 'Paare' ? `, ihr seid ${people}` : ''}`);
    const lang = H.languages?.(t);
    if (lang >= 3) out.info.push(`Bewertungen in ${lang} Sprachen (spricht für echte, verschiedene Gäste)`);
    else if (lang === 1 && t.length >= 8 && t.every(x => String(x).length < 80)) out.info.push('Alle Bewertungen kurz und in einer Sprache (nur ein Hinweis)');
    const nf = H.numberFacts?.(t) || [];
    if (nf.length) out.info.push(`Gäste nennen: ${nf.map(x => `„${x}“`).join(', ')}`);
    if (H.renovated?.(t)) out.info.push('Neuere Bewertungen erwähnen Renovierung oder neue Matratzen: ältere Kritik ist evtl. überholt');
    for (const c of X?.claimConflicts(item.extra?.claims, item.hints) || []) out.warn.push(c);
    const hr = H.hostReplies?.(t);
    if (hr) out.info.push(hr.replied ? `Gastgeber hat auf ${hr.replied} von ${hr.critical} kritischen Bewertungen geantwortet${hr.fixing ? `, ${hr.fixing}× mit Lösung („behoben“, „ersetzt“)` : ''}` : `Keine Antwort des Gastgebers auf ${hr.critical} kritische Bewertungen gelesen`);
    const tr = H.keywordTrend?.(t);
    if (tr) out.warn.push(tr);
    return out;
  }
  T.reviewNotes = reviewNotes;

  // R7: Hausregeln, Storno, Gastgeber und Kurtaxe als eine kompakte Zeile
  function factsLine(item) {
    const r = item.houseRules || {}, c = item.cancellation || {}, hi = item.hostInfo || {}, tx = item.touristTax || {};
    return [
      c.kind === 'free' ? `Kostenlos stornierbar${c.until ? ' bis ' + c.until : ''}` : c.kind === 'nonrefundable' ? 'Nicht erstattungsfähig' : c.kind === 'strict' ? 'Strenge Stornierung' : null,
      r.noParties && 'Keine Partys',
      r.quietHours && typeof r.quietHours === 'object' ? `Ruhe ${r.quietHours.from}–${r.quietHours.to} Uhr` : r.quietHours === true ? 'Ruhezeiten' : null,
      r.noSmoking && 'Nichtraucher',
      r.noPets ? 'Keine Haustiere' : r.petsAllowed ? 'Haustiere erlaubt' : null,
      hi.superhost && 'Superhost',
      hi.responseTime === 'hour' ? 'antwortet meist binnen 1 Std.' : null,
      tx.extraOnSite && 'Kurtaxe vor Ort',
    ].filter(Boolean);
  }

  function roomPanel(item, area, ctx = {}) {
    const setVote = async v => { clearTimeout(roomTimers.get(item.id)); roomPanel(await saveListing(item.id, { vote: item.vote === v ? 0 : v, note: note.value }), area, ctx); }; // 2. Klick hebt auf
    currentRoom = { item, setVote, warnContact: () => { if (!ctx.copiedContact) roomPanel(item, area, { ...ctx, copiedContact: true }); } };
    const conflicts = R.reviewConflicts(item.hints, ctx.wishes);
    // Warnungen, die schon als Konflikt mit deinen Wünschen genannt sind, nicht doppelt zeigen
    const warns = H.warnings(item.hints).filter(w => !conflicts.some(c => c.endsWith(w.replace(/^⚠️\s*/, ''))));
    const ppn = item.pricePerNight && ctx.people > 1 ? Math.round(item.pricePerNight / ctx.people) : null;
    const note = h('textarea', { placeholder: 'Notiz: was gefällt / stört?', 'aria-label': 'Notiz' });
    note.value = item.note || ''; // value statt innerHTML → kein Code-Einschleusen
    note.oninput = () => { clearTimeout(roomTimers.get(item.id)); roomTimers.set(item.id, setTimeout(() => { roomTimers.delete(item.id); saveListing(item.id, { note: note.value }); }, T.noteDelay ?? 400)); };
    const ph = item.priceHistory || [];
    const lastP = ph.at(-1), firstSame = lastP && ph.find(e => priceKey(e) === priceKey(lastP));
    const change = firstSame && firstSame !== lastP ? Math.round((lastP.p / firstSame.p - 1) * 100) : 0;
    const facts = factsLine(item), fs = ctx.fromSearch;
    const short = String(item.title || 'Unterkunft').slice(0, 60);
    // R7 E: Zusatz-Hinweise. Wichtiges sichtbar (warn), der Rest gesammelt in „Mehr Hinweise“
    const sp = ctx.sp || {};
    const nights = sp.nights || null;
    const total = item.stayTotal ?? (item.pricePerNight && nights ? item.pricePerNight * nights : null);
    const notes = X ? X.roomNotes(item.extra, { people: ctx.people, children: sp.children, infants: sp.infants, pets: sp.pets, nights, checkin: sp.checkin, lat: item.lat, wishes: ctx.wishes,
      total, currency: item.currency, responseTime: item.hostInfo?.responseTime, hostSince: item.hostInfo?.since, noParties: item.houseRules?.noParties, noPets: item.houseRules?.noPets, noSmoking: item.houseRules?.noSmoking, smoker: ctx.smoker,
      text: `${item.title || ''}` }) : { warn: [], info: [], plus: [] };
    const xw = X ? (ctx.wishes || []).filter(k => X.EXTRA_WISHES[k]).map(k => [X.EXTRA_WISHES[k], X.EXTRA_WISHES[k].check(item.extra, item)]) : [];
    const wishMiss = xw.filter(([w, r]) => r === false && w.no).map(([w]) => `passt nicht zu deinem Wunsch „${w.ok}“: ${w.no}`);
    const wishHit = xw.filter(([, r]) => r === true).map(([w]) => `✓ ${w.ok}`);
    const mem = ctx.memory || { warn: [], info: [], plus: [] };
    const topWarnExtra = [];
    const rv = reviewNotes(item, ctx.people);
    // R7 E: Teilnoten, Rabatt, Last-Minute, Gastgeber-Bilanz, Videocall-Ruhe, Kontaktdaten kopiert
    const sr = X ? X.subRatingNotes(item.subRatings, ctx.wishes) : { warn: [], info: [] };
    rv.warn.push(...sr.warn); rv.info.push(...sr.info);
    if (item.lastMinute) rv.info.push('Last-Minute- oder Frühbucher-Rabatt: gilt nur für diese Daten und kann bei Datumsänderung wegfallen');
    const hist = (item.priceHistory || []).slice(0, -1), cur0 = (item.priceHistory || []).at(-1);
    const dh = X && cur0 ? X.discountHonesty(item.wasPrice, item.pricePerNight, hist, e => priceKey(e) === priceKey(cur0)) : null;
    if (dh) rv.warn.push(dh);
    if (!item.reviewCount && item.hostReviews >= 50) rv.info.push(`Neues Inserat, aber Gastgeber mit ${item.hostReviews} Bewertungen insgesamt: eher erfahren als riskant`);
    if ((ctx.wishes || []).includes('workspace') && (item.hints || []).some(x => /⚠️ (Baustelle|laut)/.test(x))) rv.warn.push('Tagsüber Lärm (Baustelle/Straße) in Bewertungen: schlecht für Videocalls');
    if (ctx.copiedContact) topWarnExtra.push('Du hast Kontaktdaten kopiert: buche und zahle nur über Airbnb, nie per Überweisung oder Messenger');
    const topWarn = [...topWarnExtra, ...wishMiss, ...notes.warn, ...mem.warn, ...rv.warn];
    const more = [...wishHit, ...notes.plus.map(x => '👍 ' + x), ...mem.plus.map(x => '👍 ' + x), ...notes.info, ...mem.info, ...rv.info];
    const booked = item.booked;
    const setBooked = async () => {
      const b = booked ? null : { at: Date.now(), checkin: sp.checkin || null, checkout: sp.checkout || null, nights, people: ctx.people || null, total, currency: item.currency || null,
        why: (fs?.why || []).slice(0, 3), cancel: item.cancellation?.kind === 'free' ? item.cancellation.until || 'ja' : null }; // Entscheidungsnotiz: die drei Hauptgründe aus der Suche
      roomPanel(await saveListing(item.id, { booked: b }), area, ctx);
    };
    const advanceText = () => X?.advanceText?.(total, ctx.people, item.currency, item.cancellation);
    panel('sm-room', item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier', [
      // R7: Betrugshinweise dort, wo gebucht wird, ganz oben
      item.scamSignals?.length ? h('div', { class: 'err', role: 'alert' }, h('b', {}, '⚠️ Vorsicht (Hinweis, kein Beweis): '), item.scamSignals.join(' · '), '. Nur über Airbnb zahlen und schreiben. ', scamHelp()) : null,
      // R7: Passt-Wert aus deiner letzten Suche, wenn du von dort kommst
      fs?.score != null ? h('div', {}, h('b', {}, `Passt-Wert ${fs.score}/100`), ' aus deiner Suche', (fs.why || []).length ? ` · ${fs.why.slice(0, 2).join(' · ')}` : '') : null,
      ctx.paused ? h('div', { class: 'muted', role: 'status' }, '⏸ Pause aktiv, nichts wird gespeichert (außer 👍/👎, Notiz und Gebucht, die du selbst klickst).') : null,
      h('div', {}, item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : 'Noch keine Sterne gefunden'),
      area ? h('div', {}, `Viertel ${area.name}: ${area.total}/100 ${ctx.solo ? 'für dich' : 'für eure Gruppe'}`) : null,
      ppn ? h('div', {}, h('b', {}, R.money(ppn, item.currency)), ' pro Person und Nacht') : null,
      facts.length ? h('div', { class: 'muted' }, facts.join(' · ')) : null,
      booked ? h('div', {}, h('b', {}, '✅ Gebucht'), booked.checkin ? ` · ${booked.checkin}${booked.checkout ? ' bis ' + booked.checkout : ''}` : '', booked.why?.length ? h('div', { class: 'muted' }, 'Warum: ' + booked.why.join(' · ')) : null) : null,
      ...conflicts.map(c => h('div', { class: 'warn' }, '⚠️ ' + c)),
      ...topWarn.map(c => h('div', { class: 'warn' }, '⚠️ ' + c)),
      ctx.copiedContact && !item.scamSignals?.length ? h('div', { class: 'muted' }, scamHelp()) : null,
      warns.length ? h('div', { class: 'err' }, h('b', {}, 'Achtung aus den Bewertungen: '), warns.map(x => x.replace(/^⚠️\s*/, '')).join(' · ')) : null,
      item.hints?.length ? h('div', { class: 'muted' }, `Aus den Bewertungen${item.reviewsRead ? ` (${item.reviewsRead} gelesen${item.reviewCount ? ` von ${item.reviewCount}` : ''})` : ''}: ` + item.hints.join(' · ')) : null,
      change ? h('div', { class: 'muted' }, `Preis seit dem ersten Besuch ${change > 0 ? '+' : ''}${change} %`) : null,
      more.length ? h('details', {}, h('summary', {}, `Mehr Hinweise (${more.length})`), h('ul', {}, more.map(x => h('li', {}, x)))) : null,
      h('div', { class: 'row' },
        h('button', { class: item.vote === 1 ? 'on' : '', 'aria-pressed': String(item.vote === 1), 'aria-keyshortcuts': 'Alt+Shift+L', title: 'Alt+Shift+L', onclick: () => setVote(1) }, '👍 Gefällt mir'),
        h('button', { class: item.vote === -1 ? 'on' : '', 'aria-pressed': String(item.vote === -1), 'aria-keyshortcuts': 'Alt+Shift+N', title: 'Alt+Shift+N', onclick: () => setVote(-1) }, '👎 Nein')),
      h('div', { class: 'row' },
        h('button', { class: booked ? 'on' : '', 'aria-pressed': String(!!booked), onclick: setBooked }, booked ? '✅ Gebucht' : 'Als gebucht markieren'),
        booked && ctx.people > 1 && total ? h('button', { onclick: async e => { e.target.textContent = (await copyText(advanceText())) ? 'Kopiert ✓' : 'Nicht möglich'; } }, '💸 Vorkasse-Text') : null),
      note,
      h('div', { class: 'muted' }, 'Tasten: Alt+Shift+L 👍 · N 👎 · M ein-/ausklappen'),
    ], { label: `StayMatch: ${short}, ${item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier'}` }); // R7: Screenreader erfahren, worum es geht
  }

  // R7 E: Kopier-Warnung, wenn auf der Unterkunftsseite Telefonnummer oder Mailadresse markiert und kopiert wird
  document.addEventListener('copy', () => {
    if (!currentRoom || !P.ROOM_RE.test(location.pathname) || !X) return;
    const sel = String(document.getSelection?.() || '');
    if (X.contactLike(sel)) currentRoom.warnContact();
  }, true);
  keys.KeyL = () => { if (P.ROOM_RE.test(location.pathname)) currentRoom?.setVote(1); };
  keys.KeyN = () => { if (P.ROOM_RE.test(location.pathname)) currentRoom?.setVote(-1); };
  window.StayMatchContent.room = { handle: handleRoom };
  window.StayMatchContent.start(); // letzte content-*.js-Datei: jetzt sind alle Module da
})();
