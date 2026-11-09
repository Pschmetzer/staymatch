// StayMatch – bewertet Unterkünfte für die Gruppe. Reine Funktionen, ohne chrome.*.
(function (root) {
  const R = 6371000, toR = Math.PI / 180;
  function distM(a, b) {
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

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
      const hit = areas.find(a => norm(a.name) === loc) || areas.find(a => loc.includes(norm(a.name)) || norm(a.name).includes(loc));
      if (hit) return { ...hit, dist: null };
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
    if (r <= 0.6) return 0.85;           // sehr günstig: gut, aber evtl. Haken
    if (r <= 1) return 1 - (r - 0.6) * 0.5; // im Budget
    return Math.max(0, 0.8 - (r - 1) * 2.5); // drüber: schnell schlechter
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

  const WEIGHTS = { area: 0.35, rating: 0.25, price: 0.2, beds: 0.15, taste: 0.05 };

  // ctx: { people, budget, nights, areas, taste, seen, disliked }
  function scoreListing(l, ctx) {
    const area = areaFor(l, ctx.areas);
    const parts = {
      area: area ? area.total / 100 : null,
      rating: ratingScore(l.rating, l.reviewCount),
      price: priceScore(l.isTotal ? l.totalPrice : l.totalPrice && ctx.nights ? l.totalPrice * ctx.nights : l.totalPrice, ctx.budget),
      beds: bedScore(l, ctx.people),
      taste: tasteScore({ ...l, nights: ctx.nights }, ctx.taste),
    };
    // fehlende Teile weglassen und Gewichte neu verteilen
    let s = 0, w = 0;
    for (const [k, v] of Object.entries(parts)) if (v != null) { s += v * WEIGHTS[k]; w += WEIGHTS[k]; }
    let score = w ? Math.round((s / w) * 100) : 50;
    if (l.badges?.some(b => /favorit|superhost/i.test(b))) score = Math.min(100, score + 3); // kleiner Vertrauensbonus
    if (ctx.disliked?.has(l.id)) score = Math.min(score, 20);

    const why = [], warn = [];
    if (area) why.push(`Viertel ${area.name}: ${area.total}/100 für die Gruppe`);
    if (area?.minName && area.min < 40) warn.push(`${area.minName} wäre dort eher unzufrieden (${area.min})`);
    if (l.rating != null) (parts.rating >= 0.7 ? why : parts.rating < 0.35 ? warn : why).push(`⭐ ${String(l.rating).replace('.', ',')} bei ${l.reviewCount || 0} Bewertungen`);
    else warn.push('noch keine Bewertungen');
    if (parts.price != null) {
      const pp = ctx.people ? Math.round(l.totalPrice / ctx.people) : null;
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

  root.StayMatchRank = { rankListings, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, WEIGHTS };
})(typeof window !== 'undefined' ? window : globalThis);
