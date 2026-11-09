// StayMatch – bewertet Unterkünfte für die Gruppe. Reine Funktionen, ohne chrome.*.
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
      const names = a => [a.name, ...(a.alt || [])].map(norm).filter(Boolean);
      const exact = areas.filter(a => names(a).includes(loc));
      const hits = exact.length ? exact : areas.filter(a => names(a).some(n => loc.includes(n) || n.includes(loc)));
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

  // Preis für den ganzen Aufenthalt bzw. pro Nacht. null, wenn es ohne Nächte nicht bestimmbar ist.
  function stayTotal(l, nights) {
    if (l.totalPrice == null) return null;
    if (l.isTotal) return l.totalPrice;
    return nights ? l.totalPrice * nights : null;
  }
  function perNight(l, nights) {
    if (l.totalPrice == null) return null;
    if (!l.isTotal) return l.totalPrice;
    return nights ? l.totalPrice / nights : null;
  }

  function bedScore(l, people) {
    if (!people) return null;
    if (l.beds == null && l.bedrooms == null) return null; // unbekannt, nicht 0
    const beds = l.beds ?? l.bedrooms * 1.7; // ein Schlafzimmer hat meist mehr als einen Schlafplatz
    if (beds >= people) return 1;
    if (beds * 2 >= people) return 0.65; // Doppelbetten teilen
    return 0.25;
  }

  function tasteScore(l, taste) {
    if (!taste || !taste.likedCount) return null;
    let s = 0.5;
    const ppn = perNight(l, l.nights);
    if (taste.avgPricePerNight && ppn) {
      const r = ppn / taste.avgPricePerNight;
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
    // Abstand zum Viertel-Zentrum: am Rand (1,5 km) bis 15 % weniger als mittendrin
    const parts = {
      area: area ? area.total / 100 * (area.dist != null ? 1 - 0.15 * Math.min(1, area.dist / 1500) : 1) : null,
      rating: ratingScore(l.rating, l.reviewCount),
      price: priceScore(stayTotal(l, ctx.nights), ctx.budget),
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
    if (area) why.push(`Viertel ${area.name}: ${area.total}/100 für die Gruppe${area.approx ? ' (ungefähr)' : ''}${area.dist != null && area.dist > 600 ? `, ${(area.dist / 1000).toFixed(1).replace('.', ',')} km vom Zentrum` : ''}`);
    if (area?.approx) warn.push('Viertel nur ungefähr bestimmt (mehrere Teil-Viertel)');
    if (area?.minName && area.min < 40) warn.push(`${area.minName} wäre dort eher unzufrieden (${area.min})`);
    const fmt = n => Number(n).toLocaleString(ctx.lang || 'de-DE', { maximumFractionDigits: 2 });
    if (l.rating != null) (parts.rating >= 0.7 ? why : parts.rating < 0.35 ? warn : why).push(`⭐ ${fmt(l.rating)} bei ${l.reviewCount || 0} Bewertungen`);
    else warn.push('noch keine Bewertungen');
    const cur = l.currency || '€', total = stayTotal(l, ctx.nights);
    if (parts.price != null) {
      const pp = ctx.people ? Math.round(total / ctx.people) : null;
      (parts.price >= 0.75 ? why : warn).push(`${fmt(Math.round(total))} ${cur} gesamt${pp ? ` (${fmt(pp)} pro Person)` : ''}${parts.price < 0.75 ? ' – über Budget' : ''}`);
    } else if (l.totalPrice != null) {
      why.push(total != null ? `${fmt(Math.round(total))} ${cur} gesamt` : `${fmt(l.totalPrice)} ${cur} pro Nacht`);
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

  root.StayMatchRank = { rankListings, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, stayTotal, perNight, WEIGHTS };
})(typeof window !== 'undefined' ? window : globalThis);
