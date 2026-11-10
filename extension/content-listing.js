// StayMatch – Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, C = window.StayMatchCore;
  const SMC = window.StayMatchContent, H = window.StayMatchHints;
  const { getListing, saveListing, getTrip, h, panel, keys, T } = SMC;

  const reviewHints = window.StayMatchHints.reviewHints; // einzige Quelle: hints.js

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
    const nightM = priceText.match(/(\d[\d.,  ]*)\s?(€|CHF|£|\$)\s?(?:pro Nacht|Nacht|night)/i);
    const totalM = priceText.match(/(\d[\d.,  ]*)\s?(€|CHF|£|\$)\s?(?:insgesamt|gesamt|total)/i);
    const reviews = [...document.querySelectorAll('[data-review-id], [data-testid*="review"], [data-section-id*="REVIEWS"] [role="listitem"]')].map(e => e.innerText).join('\n');
    // R5-99: fertige Textparser aus parse.js anwenden (ungeprüft live: wo diese Abschnitte im echten Seitenaufbau stehen)
    const sec = sel => [...document.querySelectorAll(sel)].map(e => e.innerText || '').join('\n').slice(0, 20000);
    const rulesText = sec('[data-section-id*="POLICIES"], [data-section-id*="HOUSE_RULES"], [data-section-id*="CANCELLATION"]');
    const descText = sec('[data-section-id*="DESCRIPTION"]');
    const amenText = sec('[data-section-id*="AMENITIES"]');
    const hostText = sec('[data-section-id*="MEET_YOUR_HOST"], [data-section-id*="HOST_PROFILE"]');
    const all = (descText + '\n' + rulesText);
    const reviewTexts = [...document.querySelectorAll('[data-review-id], [data-section-id*="REVIEWS"] [role="listitem"]')].map(e => (e.innerText || '').slice(0, 600)).filter(Boolean).slice(0, 30);
    const found = {
      houseRules: rulesText ? P.houseRules(rulesText) : null,
      amenities: amenText ? P.amenities(amenText) : null,
      cancellation: rulesText ? P.cancellation(rulesText) : null,
      hostInfo: hostText ? P.hostInfo(hostText) : null,
      touristTax: all.trim() ? P.touristTax(all) : null,
      scamSignals: descText ? P.scamSignals(descText) : null,
      reviewTexts: reviewTexts.length ? reviewTexts : null,
    };
    return {
      ...found,
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
    const recent = old && Date.now() - old.lastSeen < C.VISIT_WINDOW_MS; // Reload ≠ neuer Besuch
    const data = roomData(id);
    // fehlende Felder nicht mit null überschreiben
    const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
    const priceHistory = [...(old?.priceHistory || [])];
    if (data.pricePerNight && priceHistory.at(-1)?.p !== data.pricePerNight) priceHistory.push({ t: Date.now(), p: data.pricePerNight });
    const item = await saveListing(id, { ...clean, priceHistory: priceHistory.slice(-30), visits: (old?.visits || 0) + (recent ? 0 : 1) });
    const trip = await getTrip();
    const area = trip?.areas?.length ? R.areaFor(item, trip.areas) : null;
    const quick = (await chrome.storage.local.get('quick')).quick || {};
    const ctx = { solo: !trip || trip.people?.length === 1, people: trip?.people?.length || null, wishes: quick.wishes || trip?.wishes || [] };
    roomPanel(item, area, ctx);
  }

  function roomPanel(item, area, ctx = {}) {
    const setVote = async v => roomPanel(await saveListing(item.id, { vote: item.vote === v ? 0 : v }), area, ctx); // 2. Klick hebt auf
    currentRoom = { item, setVote };
    const conflicts = R.reviewConflicts(item.hints, ctx.wishes);
    // Warnungen, die schon als Konflikt mit deinen Wünschen genannt sind, nicht doppelt zeigen
    const warns = H.warnings(item.hints).filter(w => !conflicts.some(c => c.endsWith(w.replace(/^⚠️\s*/, ''))));
    const ppn = item.pricePerNight && ctx.people > 1 ? Math.round(item.pricePerNight / ctx.people) : null;
    const note = h('textarea', { placeholder: 'Notiz: was gefällt / stört?', 'aria-label': 'Notiz' });
    note.value = item.note || ''; // value statt innerHTML → kein Code-Einschleusen
    note.oninput = () => { clearTimeout(roomTimers.get(item.id)); roomTimers.set(item.id, setTimeout(() => saveListing(item.id, { note: note.value }), T.noteDelay ?? 400)); };
    const ph = item.priceHistory || [];
    const change = ph.length > 1 ? Math.round((ph.at(-1).p / ph[0].p - 1) * 100) : 0;
    panel('sm-room', item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier', [
      h('div', {}, item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : 'Noch keine Sterne gefunden'),
      area ? h('div', {}, `Viertel ${area.name}: ${area.total}/100 ${ctx.solo ? 'für dich' : 'für eure Gruppe'}`) : null,
      ppn ? h('div', {}, h('b', {}, `${ppn} ${item.currency || '€'}`), ' pro Person und Nacht') : null,
      ...conflicts.map(c => h('div', { class: 'warn' }, '⚠️ ' + c)),
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

  keys.KeyL = () => { if (P.ROOM_RE.test(location.pathname)) currentRoom?.setVote(1); };
  keys.KeyN = () => { if (P.ROOM_RE.test(location.pathname)) currentRoom?.setVote(-1); };
  window.StayMatchContent.room = { handle: handleRoom };
  window.StayMatchContent.start(); // letzte content-*.js-Datei: jetzt sind alle Module da
})();
