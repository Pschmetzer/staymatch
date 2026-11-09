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

  // Gesamtpreis des Aufenthalts, wenn er sich ehrlich bestimmen lässt (sonst null).
  // Airbnb zeigt je nach Seite "Gesamtpreis" oder "pro Nacht".
  function stayTotal(l, ctx) {
    if (l.totalPrice == null) return null;
    if (l.isTotal) return l.totalPrice;
    return ctx.nights ? l.totalPrice * ctx.nights : null; // pro Nacht ohne bekannte Nächte: kein Vergleich mit dem Gesamtbudget
  }
  // { night, person }: Preis pro Nacht und pro Person und Nacht (jeweils gerundet oder null)
  function perNight(l, ctx) {
    if (l.totalPrice == null) return { night: null, person: null };
    const night = l.isTotal ? (ctx.nights ? l.totalPrice / ctx.nights : null) : l.totalPrice;
    return { night: night == null ? null : Math.round(night), person: night != null && ctx.people ? Math.round(night / ctx.people) : null };
  }

  const WEIGHTS = { area: 0.35, rating: 0.25, price: 0.2, beds: 0.15, taste: 0.05 };

  // ctx: { people, budget, nights, areas, taste, seen, disliked }
  function scoreListing(l, ctx) {
    const area = areaFor(l, ctx.areas);
    const parts = {
      area: area ? area.total / 100 : null,
      rating: ratingScore(l.rating, l.reviewCount),
      price: priceScore(stayTotal(l, ctx), ctx.budget),
      beds: bedScore(l, ctx.people),
      taste: tasteScore({ ...l, nights: ctx.nights }, ctx.taste),
    };
    // fehlende Teile weglassen und Gewichte neu verteilen
    let s = 0, w = 0;
    for (const [k, v] of Object.entries(parts)) if (v != null) { s += v * WEIGHTS[k]; w += WEIGHTS[k]; }
    let score = w ? Math.round((s / w) * 100) : 50;
    // Stichworte aus Bewertungen, die du auf der Unterkunftsseite schon gesehen hast (⚠️ …)
    const known = ctx.known?.get?.(l.id);
    const hintWarn = (known?.hints || []).filter(x => String(x).startsWith('⚠️')).map(x => String(x).replace(/^⚠️\s*/, ''));
    if (hintWarn.length) score = Math.max(0, score - Math.min(8, 4 * hintWarn.length));
    if (l.badges?.some(b => /favorit|superhost/i.test(b))) score = Math.min(100, score + 3); // kleiner Vertrauensbonus
    if (ctx.disliked?.has(l.id)) score = Math.min(score, 20);

    const why = [], warn = [];
    if (area) why.push(`Viertel ${area.name}: ${area.total}/100 für die Gruppe${area.approx ? ' (ungefähr)' : ''}`);
    if (area?.approx) warn.push('Viertel nur ungefähr bestimmt (mehrere Teil-Viertel)');
    if (area?.minName && area.min < 40) warn.push(`${area.minName} wäre dort eher unzufrieden (${area.min})`);
    if (l.rating != null) (parts.rating >= 0.7 ? why : parts.rating < 0.35 ? warn : why).push(`⭐ ${String(l.rating).replace('.', ',')} bei ${l.reviewCount || 0} Bewertungen`);
    else warn.push('noch keine Bewertungen');
    const ppn = perNight(l, ctx), cur = l.currency || '€', stay = stayTotal(l, ctx);
    if (parts.price != null) {
      (parts.price >= 0.75 ? why : warn).push(`${stay} ${cur} gesamt${ppn.person ? ` (${ppn.person} ${cur} pro Person und Nacht)` : ''}${parts.price < 0.75 ? ' – über Budget' : ''}`);
    } else if (ppn.person) why.push(`${ppn.person} ${cur} pro Person und Nacht`);
    else if (ppn.night) why.push(`${ppn.night} ${cur} pro Nacht`);
    if (parts.beds != null) (parts.beds >= 1 ? why : warn).push(`${l.beds ?? '?'} Betten, ${l.bedrooms ?? '?'} Schlafzimmer für ${ctx.people}`);
    if (l.badges?.length) why.push(l.badges.join(' · '));
    if (ctx.seen?.has(l.id)) why.push('schon angesehen');
    if (ctx.disliked?.has(l.id)) warn.push('von dir mit 👎 markiert');
    for (const x of hintWarn) warn.push(`Bewertungen: ${x} (aus deinem Besuch)`);
    return { score, parts, area, why, warn, ppn, stay };
  }

  function rankListings(listings, ctx) {
    return listings.map(l => ({ ...l, rank: scoreListing(l, ctx) })).sort((a, b) => b.rank.score - a.rank.score);
  }

  // Vergleichstabelle: Zeilen mit je einer Zelle pro Unterkunft (nur reine Texte, kein HTML)
  function compareRows(top, ctx = {}) {
    const fmt = (v, u = '') => v == null ? '–' : `${v}${u}`;
    const rows = [
      ['Passt-Wert', l => `${l.rank.score}/100`],
      ['Viertel', l => l.rank.area ? `${l.rank.area.name} (${l.rank.area.total})` : (l.locality || '–')],
      ['Gesamtpreis', l => l.rank.stay == null ? '–' : `${l.rank.stay} ${l.currency || '€'}`],
      ['pro Person/Nacht', l => l.rank.ppn?.person == null ? '–' : `${l.rank.ppn.person} ${l.currency || '€'}`],
      ['Sterne', l => l.rating == null ? 'neu' : `${String(l.rating).replace('.', ',')} (${l.reviewCount || 0})`],
      ['Betten', l => fmt(l.beds)],
      ['Schlafzimmer', l => fmt(l.bedrooms)],
      ['Gastgeber', l => (l.badges || []).join(', ') || '–'],
      ['Warnungen', l => l.rank.warn.length ? String(l.rank.warn.length) + ': ' + l.rank.warn.slice(0, 2).join('; ') : 'keine'],
    ];
    return rows.map(([label, f]) => ({ label, cells: top.map(f) }));
  }

  // Text für den Gruppenchat. Nur Titel, Eckdaten und der Link, den die Gruppe selbst öffnet.
  function shareText(items, meta = {}) {
    const head = meta.title || 'Unsere Auswahl (StayMatch)';
    const lines = [head];
    if (meta.sub) lines.push(meta.sub);
    items.forEach((l, i) => {
      const bits = [l.locality, l.rating != null && `⭐ ${String(l.rating).replace('.', ',')}`,
        l.score != null && `${l.score}/100`,
        (l.rank?.stay ?? l.stay) != null && `${l.rank?.stay ?? l.stay} ${l.currency || '€'} gesamt`,
        (l.rank?.ppn?.person ?? l.ppnPerson) != null && `${l.rank?.ppn?.person ?? l.ppnPerson} ${l.currency || '€'} p. P./Nacht`].filter(Boolean);
      lines.push('', `${i + 1}. ${l.title || l.kind || 'Unterkunft'}${bits.length ? ' – ' + bits.join(' · ') : ''}`);
      if (l.note) lines.push(`   Notiz: ${l.note}`);
      if (l.url) lines.push(`   ${l.url}`);
    });
    return lines.join('\n');
  }

  root.StayMatchRank = { compareRows, shareText, stayTotal, perNight, rankListings, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, WEIGHTS };
})(typeof window !== 'undefined' ? window : globalThis);
