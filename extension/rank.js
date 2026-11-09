// StayMatch – bewertet Unterkünfte für die Gruppe. Reine Funktionen, ohne chrome.*.
// Schnittstelle nur erweitert: alle bisherigen Felder von scoreListing/rankListings bleiben.
(function (root) {
  // Kern aus core.js: im Plugin vorher geladen (manifest.json), in Node per require
  const C = root.StayMatchCore || (typeof require === 'function' ? require('./core.js') : null);
  const { distM, RADIUS } = C;
  // Wie core.norm, zusätzlich Artikel weg: "l'Eixample" = "Eixample", "Vila de Gràcia" = "Gracia"
  const norm = s => C.norm(s).replace(/^(vila de|barri de|el barri de|el|la|les|els|l|los|las|le|il|lo|der|die|das)\s+/, '');

  // Viertel-Wert: nächstes Viertel aus dem Viertel-Finder (Koordinaten), sonst Namensabgleich.
  // Namensabgleich: genau gleicher Name zuerst; Teilnamen nur als ganze Wörter und nur mit ≥ 4 Zeichen
  // ("sant" trifft nicht "santa"). Ein Teilname-Treffer zählt direkt, mehrere gelten als "ungefähr" (Mittelwert).
  function areaFor(listing, areas) {
    if (!areas?.length) return null;
    if (listing.lat != null) {
      let best = null, bd = Infinity;
      for (const a of areas) { const d = distM(listing, a); if (d < bd) { bd = d; best = a; } }
      if (best && bd <= RADIUS.match) return { ...best, dist: Math.round(bd) };
    }
    const loc = norm(listing.locality);
    if (loc) {
      const exact = areas.filter(a => norm(a.name) === loc);
      const word = (hay, needle) => needle.length >= 4 && ` ${hay} `.includes(` ${needle} `);
      const hits = exact.length ? exact : areas.filter(a => { const n = norm(a.name); return n && (word(loc, n) || word(n, loc)); });
      if (hits.length === 1) return { ...hits[0], dist: null };
      if (hits.length > 1) {
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

  // Nr. 189: neuere Bewertungen zählen stärker (Halbwertszeit 18 Monate).
  // reviews: [{ date: 'YYYY-MM-DD' | Date, rating: 1..5 }] – kommt nur von der Unterkunftsseite (ungeprüft live).
  function weightedRecentRating(reviews, now = Date.now(), halfLifeDays = 540) {
    let s = 0, w = 0;
    for (const r of reviews || []) {
      const t = +new Date(r.date), v = +r.rating;
      if (!isFinite(t) || !isFinite(v)) continue;
      const age = Math.max(0, (now - t) / 864e5), wt = Math.pow(0.5, age / halfLifeDays);
      s += v * wt; w += wt;
    }
    return w ? { value: s / w, n: (reviews || []).length } : null;
  }

  // Hat die Unterkunft einzelne Bewertungen mit Datum (l.reviews, nur von der Unterkunftsseite), zählt der
  // Mittelwert aus Gesamtnote und zeitgewichteter Note.
  function effectiveRating(l) {
    if (l.rating == null || !Array.isArray(l.reviews) || l.reviews.length < 5) return l.rating;
    const wr = weightedRecentRating(l.reviews);
    return wr ? (l.rating + wr.value) / 2 : l.rating;
  }

  // Nr. 201: grobe Heuristik, KEIN Beweis. Nur ein Hinweis zum Gegenprüfen.
  function fakeReviewHint(l) {
    if (l.rating == null) return null;
    const n = l.reviewCount || 0;
    if (l.rating >= 4.95 && n > 0 && n < 8) return `Nur Bestnoten bei ${n} Bewertungen: noch wenig aussagekräftig`;
    if (Array.isArray(l.reviewTexts) && l.reviewTexts.length >= 6) {
      const norm2 = l.reviewTexts.map(x => norm(x));
      const dup = norm2.length - new Set(norm2).size;
      if (dup / norm2.length >= 0.3) return 'Auffällig viele gleichlautende Bewertungstexte (nur ein Hinweis, kein Beweis)';
    }
    return null;
  }

  // Nr. 291: Betrugsmuster als vorsichtige Warnung; erwartet die Funktion scamSignals aus parse.js oder eigene Liste
  function scamWarnings(l) {
    return (l.scamSignals || []).map(s => `Hinweis (kein Beweis): ${s}`);
  }

  function priceScore(total, budget) {
    if (total == null || !budget) return null;
    const r = total / budget;
    // stetig: sehr günstig 0,8 (evtl. Haken) → ideal bei 50 % → 0,8 am Budget → drüber schnell schlechter
    if (r <= 0.5) return 0.8 + 0.4 * r;
    if (r <= 1) return 1 - (r - 0.5) * 0.4;
    return Math.max(0, 0.8 - (r - 1) * 2.5);
  }

  // Schlafplätze: getypte Betten (Doppelbett = 2) wenn bekannt, sonst Bettenzahl. Schlafzimmer zählen NICHT als Betten.
  function bedScore(l, people) {
    if (!people) return null;
    if (l.sleeps != null) {
      if (l.sleeps >= people) return 1;
      return l.sleeps * 1.5 >= people ? 0.65 : 0.25;
    }
    if (l.beds == null) return null; // unbekannt (auch wenn nur Schlafzimmer bekannt), nicht 0
    if (l.beds >= people) return 1;
    if (l.beds * 2 >= people) return 0.65; // Doppelbetten teilen
    return 0.25;
  }

  // Preis pro Nacht der Unterkunft (aus Gesamtpreis oder Nachtpreis), null wenn nicht bestimmbar
  function perNight(l, nights) {
    if (l.totalPrice == null) return null;
    if (!l.isTotal) return l.totalPrice;
    return nights ? l.totalPrice / nights : null;
  }
  // Gesamtpreis für die Reise, null wenn nicht bestimmbar (Nachtpreis ohne Nächtezahl)
  function tripTotal(l, nights) {
    if (l.totalPrice == null) return null;
    if (l.isTotal) return l.totalPrice;
    return nights ? l.totalPrice * nights : null;
  }

  // Budget für die aktuelle Suche: pro Nacht × aktuelle Nächte; sonst Gesamtbudget, auf die aktuelle
  // Nächtezahl umgerechnet, falls die Reise andere Nächte hatte (ctx.tripNights).
  function effectiveBudget(ctx) {
    if (ctx.budgetPerNight && ctx.nights) return ctx.budgetPerNight * ctx.nights;
    if (ctx.budget && ctx.tripNights && ctx.nights && ctx.tripNights !== ctx.nights) return ctx.budget / ctx.tripNights * ctx.nights;
    return ctx.budget || null;
  }

  // Personenzahl: Wert auf der Airbnb-Seite (ctx.adults) hat Vorrang vor der Gruppe, Abweichung wird gemeldet
  function resolvePeople(ctx) {
    const trip = ctx.people || null, adults = ctx.adults || null;
    if (adults && trip && adults !== trip) return { people: adults, source: 'airbnb', mismatch: { trip, airbnb: adults } };
    return { people: adults || trip || null, source: adults ? 'airbnb' : trip ? 'trip' : null, mismatch: null };
  }

  // Geschmacksprofil aus bewerteten Unterkünften. Median statt Minimum (ein 👍 bei 4,2 senkt sonst alles).
  // items: [{ vote, rating, locality, pricePerNight, currency }]. Profil je Währung.
  function buildTaste(items) {
    const liked = (items || []).filter(i => i.vote === 1);
    if (!liked.length) return null;
    const median = a => { const s = a.filter(x => x != null && isFinite(x)).sort((x, y) => x - y); if (!s.length) return null; const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
    const byCurrency = {};
    for (const cur of new Set(liked.map(i => i.currency || '€'))) {
      const m = median(liked.filter(i => (i.currency || '€') === cur).map(i => i.pricePerNight).filter(Boolean));
      if (m) byCurrency[cur] = m;
    }
    const mr = median(liked.map(i => i.rating).filter(Boolean));
    return {
      likedCount: liked.length,
      avgPricePerNightByCurrency: byCurrency,
      avgPricePerNight: Object.values(byCurrency)[0] ?? null,
      minRating: mr != null ? mr - 0.05 : null,
      localities: [...new Set(liked.map(i => i.locality).filter(Boolean))],
    };
  }

  // Preisanteil: Nachtpreis vergleichen, nicht doppelt durch Nächte teilen; je Währung
  function tasteScore(l, taste) {
    if (!taste || !taste.likedCount) return null;
    let s = 0.5;
    const cur = l.currency || '€';
    const ref = taste.avgPricePerNightByCurrency ? taste.avgPricePerNightByCurrency[cur] : taste.avgPricePerNight;
    const ppn = perNight(l, l.nights);
    if (ref && ppn) { const r = ppn / ref; s += r < 1.25 && r > 0.6 ? 0.2 : -0.1; }
    if (taste.localities?.length && l.locality && taste.localities.some(x => norm(x) === norm(l.locality))) s += 0.2;
    if (taste.minRating && l.rating && l.rating >= taste.minRating) s += 0.1;
    return Math.max(0, Math.min(1, s));
  }

  // Basisgewichte. Geschmack 5 % → 10 %: Die Landingpage verspricht, dass das Plugin den Geschmack lernt;
  // bei 5 % bewegte er die Wertung höchstens ±2,5 Punkte (Nr. 547). Jetzt bis ca. ±5.
  const WEIGHTS = { area: 0.35, rating: 0.25, price: 0.2, beds: 0.15, taste: 0.10 };
  // Nr. 653: Bei großen Gruppen zählen Betten mehr, bei Paaren/Solo weniger. Summe wird ohnehin neu normiert.
  function weightsFor(people) {
    const w = { ...WEIGHTS };
    if (people >= 6) w.beds = 0.25; else if (people >= 4) w.beds = 0.18; else if (people && people <= 2) w.beds = 0.08;
    return w;
  }

  const PRIVATE_ROOM = /privatzimmer|private room|chambre privée|habitación privada|camera privata|kamer/i;
  const SHARED_ROOM = /gemeinsch|geteilt\w* zimmer|shared room|chambre partagée|habitación compartida|camera condivisa|hostel|schlafsaal|dorm/i;
  const sepNum = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');

  // ctx: { people, adults?, budget, budgetPerNight?, tripNights?, nights, areas, taste, seen, disliked }
  function scoreListing(l, ctx) {
    const pe = resolvePeople(ctx), people = pe.people;
    const area = areaFor(l, ctx.areas);
    const budget = effectiveBudget(ctx);
    const total = tripTotal(l, ctx.nights);
    const parts = {
      area: area ? area.total / 100 : null,
      rating: ratingScore(effectiveRating(l), l.reviewCount),
      price: priceScore(total, budget), // ohne Nächtezahl bei Nachtpreis: kein Preis-Teil
      beds: bedScore(l, people),
      taste: tasteScore({ ...l, nights: ctx.nights }, ctx.taste),
    };
    const weights = weightsFor(people);
    // fehlende Teile weglassen und Gewichte neu verteilen
    let s = 0, w = 0;
    for (const [k, v] of Object.entries(parts)) if (v != null) { s += v * weights[k]; w += weights[k]; }
    const base = w ? (s / w) * 100 : 50;
    // Nr. 402: Anteile je Teil (Punkte summieren sich auf den Grundwert vor den Zu-/Abschlägen)
    const breakdown = Object.entries(parts).filter(([, v]) => v != null).map(([k, v]) => ({
      key: k, value: v, share: +(weights[k] / w).toFixed(3), points: +((v * weights[k] / w) * 100).toFixed(1),
    }));

    const why = [], warn = [], unsuitableReasons = [], short = { why: [], warn: [] };
    let adjust = 0;
    const disliked = !!ctx.disliked?.has(l.id);

    if (area) { why.push(`Viertel ${area.name}: ${area.total}/100 für die Gruppe${area.approx ? ' (ungefähr)' : ''}`); short.why.push(`Viertel ${area.total}`); }
    if (area?.approx) warn.push('Viertel nur ungefähr bestimmt (mehrere Teil-Viertel)');
    if (area?.minName && area.min < 40) warn.push(`${area.minName} wäre dort eher unzufrieden (${area.min})`);
    if (l.rating != null) {
      const txt = `⭐ ${sepNum(l.rating, 2)} bei ${l.reviewCount || 0} Bewertungen`;
      (parts.rating >= 0.7 ? why : parts.rating < 0.35 ? warn : why).push(txt);
      (parts.rating < 0.35 ? short.warn : short.why).push(`⭐ ${sepNum(l.rating, 2)}`);
    } else { warn.push('noch keine Bewertungen'); short.warn.push('keine Bewertungen'); }
    const fake = fakeReviewHint(l);
    if (fake) warn.push(fake);
    warn.push(...scamWarnings(l));

    // Preis: Beschriftung je nach Gesamt- oder Nachtpreis; Pro-Kopf immer auf die Reisesumme bezogen
    if (l.totalPrice != null) {
      const cur = l.currency || '€', pp = people && total != null ? Math.round(total / people) : null;
      const unsure = l.multiUnit ? ' (ab-Preis, je nach Wohnung)' : '';
      if (parts.price != null) {
        const ok = parts.price >= 0.75;
        const label = l.isTotal ? `${l.totalPrice} ${cur} gesamt` : `${l.totalPrice} ${cur} pro Nacht (${Math.round(total)} ${cur} gesamt)`;
        (ok ? why : warn).push(`${label}${pp ? ` (${pp} pro Person)` : ''}${ok ? '' : ' – über Budget'}${unsure}`);
        (ok ? short.why : short.warn).push(`${Math.round(total)} ${cur}`);
        if (parts.price < 0.3) unsuitableReasons.push('deutlich über Budget');
      } else if (l.isTotal) {
        why.push(`${l.totalPrice} ${cur} gesamt${pp ? ` (${pp} pro Person)` : ''}${unsure}`);
      } else {
        warn.push(`${l.totalPrice} ${cur} pro Nacht${ctx.nights ? '' : ' (Nächtezahl fehlt, Preis nicht bewertet)'}${unsure}`);
      }
      if (l.multiUnit) warn.push('Mehrere Unterkünfte im Angebot: Preis ist ein „ab“-Preis und kann höher sein');
    }

    // Betten
    if (parts.beds != null) {
      const cap = l.sleeps != null ? `${l.sleeps} Schlafplätze` : `${l.beds} Betten`;
      (parts.beds >= 1 ? why : warn).push(`${cap}${l.bedrooms != null ? `, ${l.bedrooms} Schlafzimmer` : ''} für ${people}`);
      if (parts.beds < 1) short.warn.push(`${l.sleeps ?? l.beds} Betten für ${people}`);
      if (parts.beds <= 0.25) unsuitableReasons.push(`zu wenige Betten für ${people}`);
    } else if (people && l.bedrooms != null && l.bedrooms * 3 < people) {
      warn.push(`Nur ${l.bedrooms} Schlafzimmer für ${people} (Betten unbekannt)`);
    }

    // Bäder, Unterkunftsart, gewerblicher Gastgeber (Nr. 573–575). Kleine Abzüge, keine Teile der Gewichtung.
    if (people && l.baths != null && people / l.baths > 4) { warn.push(`${sepNum(l.baths)} Bad für ${people} Personen`); short.warn.push('wenig Bäder'); adjust -= 4; }
    const kind = String(l.kind || '');
    if (SHARED_ROOM.test(kind)) { warn.push('Geteilter Raum / Schlafsaal'); short.warn.push('geteilter Raum'); adjust -= 10; if (people >= 2) unsuitableReasons.push('geteilter Raum'); }
    else if (PRIVATE_ROOM.test(kind) && people >= 3) { warn.push(`Nur ein Privatzimmer für ${people} Personen`); short.warn.push('nur Privatzimmer'); adjust -= 8; unsuitableReasons.push(`Privatzimmer für ${people}`); }
    if (l.pro) { warn.push('Gewerblicher Gastgeber'); adjust -= 2; }

    if (l.badges?.length) why.push(l.badges.join(' · '));
    if (ctx.seen?.has(l.id)) why.push('schon angesehen');
    if (disliked) warn.push('von dir mit 👎 markiert');
    if (pe.mismatch) warn.push(`Airbnb zeigt ${pe.mismatch.airbnb} Gäste, deine Gruppe hat ${pe.mismatch.trip}: bewertet mit ${pe.mismatch.airbnb}`);

    let score = Math.round(base) + adjust;
    if (l.badges?.some(b => /favorit|superhost/i.test(b))) score += 3; // kleiner Vertrauensbonus
    score = Math.max(0, Math.min(100, score));
    if (disliked) score = Math.min(score, 20);

    const unsuitable = disliked || unsuitableReasons.length > 0;
    const badgeReason = disliked ? '👎 von dir markiert' : (unsuitableReasons[0] ? unsuitableReasons[0] : (short.warn[0] || short.why.slice(0, 2).join(' · ')));
    return {
      score, parts, area, why, warn,
      disliked, unsuitable, unsuitableReasons, badgeReason,
      breakdown, adjust, people, peopleMismatch: pe.mismatch,
      budgetKnown: !!budget, tripTotal: total, priceUncertain: !!l.multiUnit,
    };
  }

  function rankListings(listings, ctx) {
    return listings.map(l => ({ ...l, rank: scoreListing(l, ctx) })).sort((a, b) => b.rank.score - a.rank.score);
  }

  // Nr. 399: Filter. minRating: Zahl oder true (= 4,7). Reihenfolge der Liste bleibt.
  function filterListings(list, f = {}) {
    const min = f.minRating === true ? 4.7 : f.minRating;
    return list.filter(l => {
      if (min && !(l.rating >= min)) return false;
      // ohne bekanntes Budget kann der Filter nichts aussortieren
      if (f.inBudget && l.rank?.budgetKnown && !(l.rank.parts.price != null && l.rank.parts.price >= 0.75)) return false;
      if (f.enoughBeds && l.rank?.parts.beds != null && l.rank.parts.beds < 1) return false; // unbekannt zählt als ok
      if (f.favorite && !(l.badges || []).some(x => /favorit|superhost/i.test(x))) return false;
      return true;
    });
  }

  root.StayMatchRank = {
    rankListings, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, WEIGHTS,
    weightsFor, buildTaste, effectiveBudget, resolvePeople, tripTotal, perNight, weightedRecentRating, fakeReviewHint, filterListings,
  };
})(typeof window !== 'undefined' ? window : globalThis);
