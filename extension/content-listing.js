// StayMatch – Unterkunftsseite: merkt sich den Besuch, 👍/👎, Notiz, Bewertungs-Stichworte (Teil von content-*.js, siehe content-common.js).
(() => {
  const P = window.StayMatchParse, R = window.StayMatchRank, C = window.StayMatchCore;
  const { getListing, saveListing, getTrip, h, panel } = window.StayMatchContent;

  const HINTS = [
    // [Label, Muster, positiv?]
    ['sauber', /\b(sauber|blitzsauber|spotless|very clean|super clean|so clean)\b/i, true],
    ['Lage', /\b(tolle|super|perfekte|zentrale) lage\b|\b(great|perfect|excellent) location\b/i, true],
    ['Gastgeber', /\bgastgeber\w*\b[^.]{0,40}\b(nett|freundlich|hilfsbereit)\b|\bhost was (great|helpful|friendly|amazing)\b/i, true],
    ['laut', /\b(laut|lärm|lärmig|noisy|noise)\b/i, false],
    ['schmutzig', /\b(schmutzig|dreckig|dirty|unclean)\b/i, false],
    ['Bett', /\b(unbequem\w*|uncomfortable)\b/i, false],
    ['WLAN', /\b(wlan|wifi|wi-fi)\b[^.]{0,30}\b(schlecht|langsam|bad|slow|poor)\b/i, false],
  ];
  const NEG = /\b(nicht|kein|keine|nie|not|never|no|wasn't|isn't)\b/i;

  function reviewHints(text) {
    const sentences = text.split(/(?<=[.!?\n])\s+/);
    const counts = {};
    for (const s of sentences) for (const [label, re, pos] of HINTS) {
      const m = s.match(re);
      if (!m) continue;
      const before = s.slice(Math.max(0, m.index - 30), m.index);
      const negated = NEG.test(before);
      const isPos = negated ? !pos : pos;
      const key = (isPos ? '👍 ' : '⚠️ ') + (negated && pos ? 'nicht ' + label : label);
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => n > 1 ? `${k} (${n}×)` : k);
  }

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

  let roomTimer = null;
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
    const ctx = { solo: !trip || trip.people?.length === 1, wishes: quick.wishes || trip?.wishes || [] };
    roomPanel(item, area, ctx);
  }

  function roomPanel(item, area, ctx = {}) {
    const vote = v => async () => roomPanel(await saveListing(item.id, { vote: item.vote === v ? 0 : v }), area, ctx); // 2. Klick hebt auf
    const conflicts = R.reviewConflicts(item.hints, ctx.wishes);
    const note = h('textarea', { placeholder: 'Notiz: was gefällt / stört?', 'aria-label': 'Notiz' });
    note.value = item.note || ''; // value statt innerHTML → kein Code-Einschleusen
    note.oninput = () => { clearTimeout(roomTimer); roomTimer = setTimeout(() => saveListing(item.id, { note: note.value }), 400); };
    const ph = item.priceHistory || [];
    const change = ph.length > 1 ? Math.round((ph.at(-1).p / ph[0].p - 1) * 100) : 0;
    panel('sm-room', item.visits > 1 ? `schon ${item.visits}× angesehen` : 'zum ersten Mal hier', [
      h('div', {}, item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : 'Noch keine Sterne gefunden'),
      area ? h('div', {}, `Viertel ${area.name}: ${area.total}/100 ${ctx.solo ? 'für dich' : 'für eure Gruppe'}`) : null,
      ...conflicts.map(c => h('div', { class: 'warn' }, '⚠️ ' + c)),
      item.hints?.length ? h('div', { class: 'muted' }, 'Aus den Bewertungen: ' + item.hints.join(' · ')) : null,
      change ? h('div', { class: 'muted' }, `Preis seit dem ersten Besuch ${change > 0 ? '+' : ''}${change} %`) : null,
      h('div', { class: 'row' },
        h('button', { class: item.vote === 1 ? 'on' : '', onclick: vote(1) }, '👍 Gefällt mir'),
        h('button', { class: item.vote === -1 ? 'on' : '', onclick: vote(-1) }, '👎 Nein')),
      note,
    ]);
  }

  window.StayMatchContent.room = { handle: handleRoom };
  window.StayMatchContent.start(); // letzte content-*.js-Datei: jetzt sind alle Module da
})();
