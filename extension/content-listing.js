// StayMatch – Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, C = window.StayMatchCore;
  const SMC = window.StayMatchContent, H = window.StayMatchHints;
  const { getListing, saveListing, getTrip, h, panel, keys, T } = SMC;

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
    // Preis nur aus dem Buchungsbereich, nicht aus "ähnliche Unterkünfte"
    const book = document.querySelector('[data-testid="book-it-default"], [data-section-id="BOOK_IT_SIDEBAR"], [data-plugin-in-point-id="BOOK_IT_SIDEBAR"]');
    // R7: Währung vorn oder hinten, alle Währungen aus parse.js, bei Rabatt der aktuelle Preis
    const bp = P.bookPrice(book?.innerText || '');
    // R7: verschachtelte Treffer derselben Bewertung nur einmal (nur die äußersten Elemente)
    const outer = sel => { const els = [...document.querySelectorAll(sel)]; return els.filter(e => !els.some(o => o !== e && o.contains(e))); };
    const reviews = outer('[data-review-id], [data-testid*="review"], [data-section-id*="REVIEWS"] [role="listitem"]').map(e => e.innerText).join('\n');
    // R5-99: fertige Textparser aus parse.js anwenden (ungeprüft live: wo diese Abschnitte im echten Seitenaufbau stehen)
    const sec = sel => [...document.querySelectorAll(sel)].map(e => e.innerText || '').join('\n').slice(0, 20000);
    const rulesText = sec('[data-section-id*="POLICIES"], [data-section-id*="HOUSE_RULES"], [data-section-id*="CANCELLATION"]');
    // R7: Storno nur aus dem Storno-Abschnitt, sonst trifft „streng“ aus den Hausregeln (Rückfall: ganzer Regeltext)
    const cancelText = sec('[data-section-id*="CANCELLATION"]') || rulesText;
    const descText = sec('[data-section-id*="DESCRIPTION"]');
    const amenText = sec('[data-section-id*="AMENITIES"]');
    const hostText = sec('[data-section-id*="MEET_YOUR_HOST"], [data-section-id*="HOST_PROFILE"]');
    const all = (descText + '\n' + rulesText);
    const reviewTexts = outer('[data-review-id], [data-section-id*="REVIEWS"] [role="listitem"]').map(e => (e.innerText || '').slice(0, 600)).filter(Boolean).slice(0, 30);
    const found = {
      houseRules: rulesText ? P.houseRules(rulesText) : null,
      amenities: amenText ? P.amenities(amenText) : null,
      cancellation: cancelText ? P.cancellation(cancelText) : null,
      hostInfo: hostText ? P.hostInfo(hostText) : null,
      touristTax: all.trim() ? P.touristTax(all) : null,
      scamSignals: descText ? P.scamSignals(descText) : null,
      reviewTexts: reviewTexts.length ? reviewTexts : null,
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
      locality: P.localityFromTitle(String(meta('og:title') || '').split(/\s[·•|]\s/)[0]) || ld.address?.addressLocality || null,
      city: ld.address?.addressLocality || null,
      pricePerNight: bp.night != null ? bp.night : bp.total != null && sp.nights ? Math.round(bp.total / sp.nights) : null,
      currency: bp.currency,
      checkin: sp.checkin, checkout: sp.checkout,
      hints: reviews ? reviewHints(reviews) : [],
    };
  }

  const roomTimers = new Map(); // ein Timer pro Unterkunft
  let currentRoom = null;
  async function handleRoom(id) {
    const old = await getListing(id);
    const recent = old && Date.now() - old.lastSeen < C.VISIT_WINDOW_MS; // Reload ≠ neuer Besuch
    const data = roomData(id);
    // fehlende Felder nicht mit null überschreiben
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
    // R7: Preisverlauf je Reise (Anreise, Nächte, Währung), sonst vergleicht er Juli mit November
    const priceHistory = [...(old?.priceHistory || [])];
    const sp = P.searchParams(location.href);
    const entry = { t: Date.now(), p: data.pricePerNight, c: data.currency || null, ci: sp.checkin || null, n: sp.nights || null };
    const last = priceHistory.at(-1);
    if (data.pricePerNight && !(last && last.p === entry.p && priceKey(last) === priceKey(entry))) priceHistory.push(entry);
    const item = await saveListing(id, { ...clean, priceHistory: priceHistory.slice(-30), visits: (old?.visits || 0) + (recent ? 0 : 1) });
    const trip = await getTrip();
    const area = trip?.areas?.length ? R.areaFor(item, trip.areas) : null;
    const { quick = {}, lastSearch } = await chrome.storage.local.get(['quick', 'lastSearch']);
    // R7: Personen wie auf der Suchseite: Gästezahl der Airbnb-Adresse hat Vorrang
    const pe = R.resolvePeople({ people: trip?.people?.length || null, adults: sp.adults || null });
    const fromSearch = (lastSearch?.top || []).find(l => l.id === id) || null;
    const ctx = { solo: !pe.people || pe.people === 1, people: pe.people, wishes: quick.wishes || trip?.wishes || [], fromSearch };
    roomPanel(item, area, ctx);
  }
  const priceKey = e => [e.c || '', e.ci || '', e.n || ''].join('|');

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
    currentRoom = { item, setVote };
    const conflicts = R.reviewConflicts(item.hints, ctx.wishes);
    // Warnungen, die schon als Konflikt mit deinen Wünschen genannt sind, nicht doppelt zeigen
    const warns = H.warnings(item.hints).filter(w => !conflicts.some(c => c.endsWith(w.replace(/^⚠️\s*/, ''))));
    const ppn = item.pricePerNight && ctx.people > 1 ? Math.round(item.pricePerNight / ctx.people) : null;
    const note = h('textarea', { placeholder: 'Notiz: was gefällt / stört?', 'aria-label': 'Notiz' });
    note.value = item.note || ''; // value statt innerHTML → kein Code-Einschleusen
    note.oninput = () => { clearTimeout(roomTimers.get(item.id)); roomTimers.set(item.id, setTimeout(() => saveListing(item.id, { note: note.value }), T.noteDelay ?? 400)); };
    const ph = item.priceHistory || [];
    const lastP = ph.at(-1), firstSame = lastP && ph.find(e => priceKey(e) === priceKey(lastP));
    const change = firstSame && firstSame !== lastP ? Math.round((lastP.p / firstSame.p - 1) * 100) : 0;
    const facts = factsLine(item), fs = ctx.fromSearch;
    const short = String(item.title || 'Unterkunft').slice(0, 60);
    panel('sm-room', item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier', [
      // R7: Betrugshinweise dort, wo gebucht wird, ganz oben
      item.scamSignals?.length ? h('div', { class: 'err', role: 'alert' }, h('b', {}, '⚠️ Vorsicht (Hinweis, kein Beweis): '), item.scamSignals.join(' · '), '. Nur über Airbnb zahlen und schreiben.') : null,
      // R7: Passt-Wert aus deiner letzten Suche, wenn du von dort kommst
      fs?.score != null ? h('div', {}, h('b', {}, `Passt-Wert ${fs.score}/100`), ' aus deiner Suche', (fs.why || []).length ? ` · ${fs.why.slice(0, 2).join(' · ')}` : '') : null,
      h('div', {}, item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : 'Noch keine Sterne gefunden'),
      area ? h('div', {}, `Viertel ${area.name}: ${area.total}/100 ${ctx.solo ? 'für dich' : 'für eure Gruppe'}`) : null,
      ppn ? h('div', {}, h('b', {}, R.money(ppn, item.currency)), ' pro Person und Nacht') : null,
      facts.length ? h('div', { class: 'muted' }, facts.join(' · ')) : null,
      ...conflicts.map(c => h('div', { class: 'warn' }, '⚠️ ' + c)),
      warns.length ? h('div', { class: 'err' }, h('b', {}, 'Achtung aus den Bewertungen: '), warns.map(x => x.replace(/^⚠️\s*/, '')).join(' · ')) : null,
      item.hints?.length ? h('div', { class: 'muted' }, 'Aus den Bewertungen: ' + item.hints.join(' · ')) : null,
      change ? h('div', { class: 'muted' }, `Preis seit dem ersten Besuch ${change > 0 ? '+' : ''}${change} %`) : null,
      h('div', { class: 'row' },
        h('button', { class: item.vote === 1 ? 'on' : '', title: 'Alt+Shift+L', onclick: () => setVote(1) }, '👍 Gefällt mir'),
        h('button', { class: item.vote === -1 ? 'on' : '', title: 'Alt+Shift+N', onclick: () => setVote(-1) }, '👎 Nein')),
      note,
      h('div', { class: 'muted' }, 'Tasten: Alt+Shift+L 👍 · N 👎 · M ein-/ausklappen'),
    ], { label: `StayMatch: ${short}, ${item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier'}` }); // R7: Screenreader erfahren, worum es geht
  }

  keys.KeyL = () => { if (P.ROOM_RE.test(location.pathname)) currentRoom?.setVote(1); };
  keys.KeyN = () => { if (P.ROOM_RE.test(location.pathname)) currentRoom?.setVote(-1); };
  window.StayMatchContent.room = { handle: handleRoom };
  window.StayMatchContent.start(); // letzte content-*.js-Datei: jetzt sind alle Module da
})();
