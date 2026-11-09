// StayMatch – bewertet Unterkünfte für dich (oder deine Gruppe). Reine Funktionen, ohne chrome.*.
(function (root) {
  const R = 6371000, toR = Math.PI / 180;
  function distM(a, b) {
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  // Akzente, Satzzeichen und Artikel weg: "l'Eixample" = "Eixample", "Vila de Gràcia" = "Gracia"
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^(vila de|barri de|el barri de|el|la|les|els|l|los|las|le|il|lo|der|die|das)\s+/, '');

  // Viertel-Wert: nächstes Viertel aus dem Viertel-Finder (Koordinaten), sonst Namensabgleich
  function areaFor(listing, areas) {
    if (!areas?.length) return null;
    if (listing.lat != null) {
      let best = null, bd = Infinity;
      for (const a of areas) { const d = distM(listing, a); if (d < bd) { bd = d; best = a; } }
      if (best && bd <= 1500) return { ...best, dist: Math.round(bd) };
    }
    const loc = norm(listing.locality);
    if (loc) {
      const exact = areas.filter(a => norm(a.name) === loc);
      const hits = exact.length ? exact : areas.filter(a => { const n = norm(a.name); return n && (loc.includes(n) || n.includes(loc)); });
      if (hits.length === 1) return { ...hits[0], dist: null };
      if (hits.length > 1) { // mehrere Teil-Viertel: Mittelwert statt bestes, als "ungefähr" markiert
        const avg = k => Math.round(hits.reduce((s, a) => s + a[k], 0) / hits.length);
        return { name: listing.locality, lat: hits[0].lat, lon: hits[0].lon, total: avg('total'), min: avg('min'), minName: null, approx: true, dist: null };
      }
    }
    return null;
  }

  // Bayes-Mittel: 5,0 bei 3 Bewertungen zählt weniger als 4,9 bei 300
  function ratingScore(value, count) {
    if (value == null) return null;
    const m = 20, C = 4.6, n = count || 0;
    const bay = (value * n + C * m) / (n + m);
    return Math.max(0, Math.min(1, (bay - 4.2) / 0.75));
  }

  function priceScore(total, budget) {
    if (total == null || !budget) return null;
    const r = total / budget;
    // stetig: sehr günstig 0,8 (evtl. Haken) → ideal bei 50 % → 0,8 am Budget → drüber schnell schlechter
    if (r <= 0.5) return 0.8 + 0.4 * r;
    if (r <= 1) return 1 - (r - 0.5) * 0.4;
    return Math.max(0, 0.8 - (r - 1) * 2.5);
  }

  function bedScore(l, people) {
    if (!people) return null;
    if (l.beds == null && l.bedrooms == null) return null; // unbekannt, nicht 0
    const beds = l.beds ?? l.bedrooms;
    if (beds >= people) return 1;
    if (beds * 2 >= people) return 0.65; // Doppelbetten teilen
    return 0.25;
  }

  function tasteScore(l, taste) {
    if (!taste || !taste.likedCount) return null;
    let s = 0.5;
    if (taste.avgPricePerNight && l.totalPrice && l.nights) {
      const ppn = l.totalPrice / l.nights, r = ppn / taste.avgPricePerNight;
      s += r < 1.25 && r > 0.6 ? 0.2 : -0.1;
    }
    if (taste.localities?.length && l.locality && taste.localities.some(x => norm(x) === norm(l.locality))) s += 0.2;
    if (taste.minRating && l.rating && l.rating >= taste.minRating) s += 0.1;
    return Math.max(0, Math.min(1, s));
  }

  // Wünsche an die Unterkunft, die sich schon auf der Suchseite prüfen lassen.
  // Liefert je Wunsch true (passt), false (passt nicht) oder null (unbekannt).
  const ROOM_RE = /privatzimmer|\bzimmer in\b|gemeinsam genutzt|geteilt\w* zimmer|hotelzimmer|hostel|schlafsaal|private room|shared room|hotel room|\broom in\b|\bdorm/i;
  const WHOLE_RE = /wohnung|apartment|haus\b|home|loft|studio|villa|ferienwohnung|unterkunft|condo|bungalow|cottage|chalet|townhouse/i;
  const WISHES = {
    whole: { label: 'ganze Unterkunft', check: l => { const t = l.kind || l.title || ''; return ROOM_RE.test(t) ? false : WHOLE_RE.test(t) ? true : null; } /* erst die Art, freier Titel nur ohne Art */, no: 'nur ein Zimmer' },
    private: { label: 'privater Gastgeber', check: l => l.pro === true ? false : null, no: 'gewerblicher Anbieter' /* „privat“ ist nie sicher, nur „gewerblich“ */ },
    trusted: { label: 'Superhost oder Gäste-Favorit', check: l => (l.badges || []).some(b => /favorit|superhost/i.test(b)), no: 'kein Superhost/Gäste-Favorit' },
    reviews: { label: 'mind. 20 Bewertungen', check: l => l.reviewCount == null ? null : l.reviewCount >= 20, no: 'weniger als 20 Bewertungen' },
  };
  function wishScore(l, wishes) {
    const keys = (wishes || []).filter(k => WISHES[k]);
    const hit = [], miss = [];
    for (const k of keys) { const r = WISHES[k].check(l); if (r === true) hit.push(WISHES[k].label); else if (r === false) miss.push(WISHES[k].no); }
    const known = hit.length + miss.length;
    return { value: known ? hit.length / known : null, hit, miss };
  }

  // Wünsche, die sich erst auf der Unterkunftsseite aus den Bewertungen prüfen lassen
  const REVIEW_WISHES = { quiet: ['ruhig', /laut/], clean: ['sauber', /schmutzig|nicht sauber/], wifi: ['gutes WLAN', /WLAN/] };
  function reviewConflicts(hints, wishes) {
    const out = [];
    for (const k of wishes || []) {
      const w = REVIEW_WISHES[k]; if (!w) continue;
      const bad = (hints || []).find(h => h.startsWith('⚠️') && w[1].test(h));
      if (bad) out.push(`passt nicht zu deinem Wunsch „${w[0]}“: ${bad.replace('⚠️ ', '')}`);
    }
    return out;
  }

  const WEIGHTS = { area: 0.3, rating: 0.2, price: 0.2, wishes: 0.2, beds: 0.1, taste: 0.05 };

  // ctx: { people, budget, nights, areas, taste, seen, disliked, wishes }
  function scoreListing(l, ctx) {
    const area = areaFor(l, ctx.areas);
    const wish = wishScore(l, ctx.wishes);
    const solo = ctx.people === 1;
    const parts = {
      area: area ? area.total / 100 : null,
      rating: ratingScore(l.rating, l.reviewCount),
      price: priceScore(l.isTotal ? l.totalPrice : l.totalPrice && ctx.nights ? l.totalPrice * ctx.nights : l.totalPrice, ctx.budget),
      wishes: wish.value,
      beds: solo ? null : bedScore(l, ctx.people),
      taste: tasteScore({ ...l, nights: ctx.nights }, ctx.taste),
    };
    // fehlende Teile weglassen und Gewichte neu verteilen
    let s = 0, w = 0;
    for (const [k, v] of Object.entries(parts)) if (v != null) { s += v * WEIGHTS[k]; w += WEIGHTS[k]; }
    let score = w ? Math.round((s / w) * 100) : 50;
    if (l.badges?.some(b => /favorit|superhost/i.test(b))) score = Math.min(100, score + 3); // kleiner Vertrauensbonus
    if (ctx.disliked?.has(l.id)) score = Math.min(score, 20);

    const why = [], warn = [];
    if (area) why.push(`Viertel ${area.name}: ${area.total}/100 ${solo ? 'für dich' : 'für die Gruppe'}${area.approx ? ' (ungefähr)' : ''}`);
    if (area?.approx) warn.push('Viertel nur ungefähr bestimmt (mehrere Teil-Viertel)');
    if (!solo && area?.minName && area.min < 40) warn.push(`${area.minName} wäre dort eher unzufrieden (${area.min})`);
    for (const x of wish.hit) why.push(`✓ ${x}`);
    for (const x of wish.miss) warn.push(`Wunsch nicht erfüllt: ${x}`);
    if (l.rating != null) (parts.rating >= 0.7 ? why : parts.rating < 0.35 ? warn : why).push(`⭐ ${String(l.rating).replace('.', ',')} bei ${l.reviewCount || 0} Bewertungen`);
    else warn.push('noch keine Bewertungen');
    if (parts.price != null) {
      const pp = ctx.people > 1 ? Math.round(l.totalPrice / ctx.people) : null;
      (parts.price >= 0.75 ? why : warn).push(`${l.totalPrice} ${l.currency || '€'} gesamt${pp ? ` (${pp} pro Person)` : ''}${parts.price < 0.75 ? ' – über Budget' : ''}`);
    }
    if (parts.beds != null) (parts.beds >= 1 ? why : warn).push(`${l.beds ?? '?'} Betten, ${l.bedrooms ?? '?'} Schlafzimmer für ${ctx.people}`);
    if (l.badges?.length) why.push(l.badges.join(' · '));
    if (ctx.seen?.has(l.id)) why.push('schon angesehen');
    if (ctx.disliked?.has(l.id)) warn.push('von dir mit 👎 markiert');
    return { score, parts, area, why, warn };
  }

  function rankListings(listings, ctx) {
    return listings.map(l => ({ ...l, rank: scoreListing(l, ctx) })).sort((a, b) => b.rank.score - a.rank.score);
  }

  root.StayMatchRank = { rankListings, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, wishScore, reviewConflicts, WISHES, REVIEW_WISHES, WEIGHTS };
})(typeof window !== 'undefined' ? window : globalThis);
