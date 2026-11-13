// StayMatch – bewertet Unterkünfte für dich (oder deine Gruppe). Reine Funktionen, ohne chrome.*.
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
  function areaFor(listing, allAreas) {
    // R7: Viertel ohne Wert (total) würden den Passt-Wert zu NaN machen
    const areas = (allAreas || []).filter(a => a && Number.isFinite(a.total));
    if (!areas.length) return null;
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
        const avg = k => { const v = hits.map(a => a[k]).filter(Number.isFinite); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
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
    // R5-106: ein Paar teilt sich ein Bett
    if (people <= 2 && (l.sleeps >= 1 || l.beds >= 1)) return 1;
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
  const WEIGHTS = { area: 0.3, rating: 0.2, price: 0.2, wishes: 0.2, beds: 0.12, taste: 0.10 };

  // Direkt-Modus: Wünsche an die Unterkunft, die sich schon auf der Suchseite prüfen lassen.
  // check liefert true (passt), false (passt nicht) oder null (unbekannt).
  const WISHES = {
    whole: { label: '🏠 ganze Unterkunft', ok: 'ganze Unterkunft', no: 'nur ein Zimmer', check: l => {
      const k = l.kind || l.title || ''; // erst die Art, freier Titel nur ohne Art („2 Schlafzimmer in …“)
      return PRIVATE_ROOM.test(k) || SHARED_ROOM.test(k) || ROOM_ONLY.test(k) ? false : WHOLE_PLACE.test(k) ? true : null;
    } },
    trusted: { label: '🏅 Superhost/Favorit', ok: 'Superhost oder Gäste-Favorit', no: 'kein Superhost/Gäste-Favorit', check: l => (l.badges || []).some(b => /favorit|superhost/i.test(b)) },
    reviews: { label: '💬 ab 20 Bewertungen', ok: 'viele Bewertungen', no: 'weniger als 20 Bewertungen', check: l => l.reviewCount == null ? null : l.reviewCount >= 20 },
    luxury: { label: '✨ Luxus', ok: (l, ctx) => { const w = luxuryInfo(l, ctx).words; return `Luxus-Unterkunft${w.length ? ` (${w.slice(0, 3).join(', ')})` : ''}`; }, no: 'eher einfache Unterkunft',
      check: (l, ctx) => luxuryInfo(l, ctx).state },
    private: { label: '🙋 kein Gewerbe', ok: null, no: 'gewerblicher Anbieter', check: l => l.pro === true ? false : null }, // „privat“ ist nie sicher
  };
  function wishScore(l, wishes, ctx) {
    const hit = [], miss = [];
    for (const k of (wishes || []).filter(k => WISHES[k])) {
      const r = WISHES[k].check(l, ctx);
      const ok = typeof WISHES[k].ok === 'function' ? WISHES[k].ok(l, ctx) : WISHES[k].ok;
      if (r === true && ok) hit.push(ok); else if (r === false) miss.push(WISHES[k].no);
    }
    const known = hit.length + miss.length;
    return { value: known ? hit.length / known : null, hit, miss };
  }
  // Wünsche, die sich erst auf der Unterkunftsseite aus Bewertungs-Stichworten prüfen lassen
  const REVIEW_WISHES = { quiet: ['ruhig', /laut|hellhörig|Baustelle/], clean: ['sauber', /schmutzig|nicht sauber/], wifi: ['gutes WLAN', /WLAN/] };
  function reviewConflicts(hints, wishes) {
    const out = [];
    for (const k of wishes || []) {
      const w = REVIEW_WISHES[k]; if (!w) continue;
      const bad = (hints || []).find(h => h.startsWith('⚠️') && w[1].test(h));
      if (bad) out.push(`passt nicht zu deinem Wunsch „${w[0]}“: ${bad.replace('⚠️ ', '')}`);
    }
    return out;
  }
  // Nr. 653: Bei großen Gruppen zählen Betten mehr, bei Paaren/Solo weniger. Summe wird ohnehin neu normiert.
  function weightsFor(people, wishes) {
    const w = { ...WEIGHTS };
    if ((wishes || []).includes('luxury')) w.wishes = 0.3; // wer Luxus will, soll ihn in der Wertung merken
    if (people >= 6) w.beds = 0.22; else if (people >= 4) w.beds = 0.15; else if (people && people <= 2) w.beds = 0.08;
    return w;
  }

  // Luxus: starke Stichwörter genügen allein, schwache zählen erst zu zweit oder mit hoher Preislage
  const LUX_STRONG = /luxus|luxur|lujo|lusso|luxueux|penthouse|\bvilla\b|mansion|manoir|herrenhaus|riad|palazzo|schloss|ch[aâ]teau|yacht|boutique[- ]?hotel|resort|infinity|rooftop|dachterrasse|privatpool|private pool|piscine priv|whirlpool|jacuzzi|butler|concierge|5[- ]?sterne|f[üu]nf[- ]?sterne|5[- ]?stars?\b|5\s?\*|beachfront|oceanfront|seafront|strandnah|meerblick|seeblick|sea view|ocean view|[áa]tico|attico/i;
  const LUX_WEAK = /\bsuite\b|\bspa\b|sauna|\bpool\b|duplex|maisonette/i;
  const LUX_SOFT = /premium|designer|exklusiv|exclusive|prestige|skyline|panorama|k[üu]stenlage|waterfront/i; // Werbewörter, auch bei billigen Zimmern
  // Treffer-Wörter für die Anzeige, ohne Doppelungen und in Originalschreibweise des Titels
  const hits = (re, txt) => { const g = new RegExp(re.source, 'gi'); const out = []; for (const m of txt.matchAll(g)) { const w = m[0].trim(); if (w && !out.some(x => x.toLowerCase() === w.toLowerCase())) out.push(w); } return out; };
  // state: true = Luxus erkannt, false = klar kein Luxus (Zimmer), null = unbekannt (nie geraten)
  function luxuryInfo(l, ctx) {
    const txt = `${l.kind || ''} ${l.title || ''}`;
    if (PRIVATE_ROOM.test(txt) || SHARED_ROOM.test(txt)) return { state: false, words: [], level: 0 };
    const soft = hits(LUX_SOFT, txt), strong = hits(LUX_STRONG, txt), weak = hits(LUX_WEAK, txt).filter(w => !strong.some(x => x.toLowerCase() === w.toLowerCase()));
    const badge = (l.badges || []).some(b => /luxe|luxury|luxus/i.test(b));
    const med = ctx?.medianNight?.[normCur(l.currency) || '€'];
    const pn = perNight(l, ctx?.nights ?? l.nights);
    const pricey = !!(med && pn && pn >= med * 1.8);
    const bath = l.baths != null && l.baths >= 3 && l.bedrooms != null && l.baths >= l.bedrooms;
    const words = [...(badge ? ['Luxe'] : []), ...strong, ...weak, ...soft];
    if (pricey) words.push('hohe Preislage');
    if (bath) words.push(`${sepNum(l.baths)} Bäder`);
    // Stufe 0–1: stark 1, sonst Summe aus schwachen Hinweisen
    const level = badge || strong.length ? 1 : Math.min(1, weak.length * 0.45 + soft.length * 0.2 + (pricey ? 0.35 : 0) + (bath ? 0.25 : 0));
    return { state: level >= 0.7 ? true : null, words, level };
  }
  const ROOM_ONLY = /\bzimmer in\b|hotelzimmer|\broom in\b|hotel room|chambre d'hôtel|habitación en|stanza in/i;
  const WHOLE_PLACE = /wohnung|apartment|appartement|apartamento|appartamento|entire|logement entier|intero|hele |ganze|alojamento inteiro|cały|\bhaus\b|\bhome\b|\bhouse\b|loft|studio|villa|ferienwohnung|condo|bungalow|cottage|chalet|townhouse|casa|maison/i;
  const PRIVATE_ROOM = /privatzimmer|private room|chambre privée|habitación privada|camera privata|\bkamer\b/i;
  const SHARED_ROOM = /gemeinsch|geteilt\w* zimmer|shared room|chambre partagée|habitación compartida|camera condivisa|hostel|schlafsaal|\bdorm\b|dormitory/i;
  const sepNum = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');

  // R5-100: Währungen vergleichbar machen („€“ = „EUR“)
  const CUR_ALIAS = { EUR: '€', GBP: '£', USD: '$', 'US$': '$' };
  const normCur = c => (c ? CUR_ALIAS[String(c).trim().toUpperCase()] || String(c).trim() : null);

  const median = a => { const x = a.filter(v => v != null && isFinite(v)).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };

  // R5-83 / R5-110: Einheit und Plausibilität gegen den Median der Seite prüfen.
  // Fehlt in der Preiszeile jedes Wort für „gesamt“ / „pro Nacht“ (priceWord === false), wird sie als Nachtpreis
  // geraten. Liegt der Betrag aber etwa bei Nächte × Median, ist es wohl ein Gesamtpreis.
  // Preise unter 20 % des Medians sind eher ein Lesefehler als ein Schnäppchen.
  function normalizePrices(listings, ctx) {
    const nights = ctx.nights;
    const per = l => (l.totalPrice == null ? null : l.isTotal ? (nights ? l.totalPrice / nights : null) : l.totalPrice);
    const byCur = {};
    for (const l of listings) {
      if (l.priceWord === false) continue; // unsichere Einheit zählt nicht für den Median
      const v = per(l); if (v == null) continue;
      (byCur[normCur(l.currency) || '€'] ||= []).push(v);
    }
    const med = {};
    for (const [c, v] of Object.entries(byCur)) if (v.length >= 3) med[c] = median(v);
    return listings.map(l => {
      const m = med[normCur(l.currency) || '€'];
      if (!m || l.totalPrice == null) return l;
      let out = l;
      if (l.priceWord === false && !l.isTotal && nights >= 2 && l.totalPrice >= m * nights * 0.6 && l.totalPrice >= m * 1.8) out = { ...out, isTotal: true, unitGuessed: true };
      const v = per(out);
      if (v != null && v < m * 0.2) out = { ...out, priceImplausible: true };
      return out;
    });
  }

  // ctx: { people, adults?, budget, budgetPerNight?, tripNights?, nights, areas, taste, seen, disliked, wishes? }
  function scoreListing(l, ctx) {
    const pe = resolvePeople(ctx), people = pe.people, solo = people === 1;
    // R5-99: Befunde von der Unterkunftsseite (Betrugs-Signale, Bewertungstexte, datierte Bewertungen) gelten auch in der Suche
    const kn = ctx.known?.get?.(l.id);
    if (kn) l = { ...l, scamSignals: l.scamSignals || kn.scamSignals, reviewTexts: l.reviewTexts || kn.reviewTexts, reviews: l.reviews || kn.reviews };
    const wish = wishScore(l, ctx.wishes, ctx);
    const area = areaFor(l, ctx.areas);
    const budget = effectiveBudget(ctx);
    const total = tripTotal(l, ctx.nights);
    // R5-100: Budget und Preis nur vergleichen, wenn die Währung stimmt. R5-92: nicht bei flexiblen Daten / Monatsmiete.
    const curMismatch = !!(ctx.budgetCurrency && l.currency && normCur(l.currency) !== normCur(ctx.budgetCurrency));
    const priceBlocked = curMismatch || !!ctx.priceUnsure || !!l.priceImplausible;
    const parts = {
      area: area ? area.total / 100 : null,
      rating: ratingScore(effectiveRating(l), l.reviewCount),
      // ohne Nächtezahl bei Nachtpreis: nur mit Budget pro Nacht vergleichbar (Direkt-Modus), sonst kein Preis-Teil
      price: priceBlocked ? null : total != null ? priceScore(total, budget) : (!l.isTotal && ctx.budgetPerNight ? priceScore(l.totalPrice, ctx.budgetPerNight) : null),
      wishes: wish.value,
      beds: solo ? null : bedScore(l, people), // eine Person: keine Betten-Wertung
      taste: tasteScore({ ...l, nights: ctx.nights }, ctx.taste),
    };
    const weights = weightsFor(people, ctx.wishes);
    // fehlende Teile weglassen und Gewichte neu verteilen
    let s = 0, w = 0;
    for (const [k, v] of Object.entries(parts)) if (v != null) { s += v * weights[k]; w += weights[k]; }
    const base = w ? (s / w) * 100 : 50;
    // Nr. 402: Anteile je Teil (Punkte summieren sich auf den Grundwert vor den Zu-/Abschlägen)
    const breakdown = Object.entries(parts).filter(([, v]) => v != null).map(([k, v]) => ({
      key: k, value: v, share: +(weights[k] / w).toFixed(3), points: +((v * weights[k] / w) * 100).toFixed(1),
    }));
    // Nr. 10: Warnungen aus Bewertungen, die du auf der Unterkunftsseite schon gesehen hast (⚠️ …), drücken die Wertung leicht
    const known = ctx.known?.get?.(l.id);
    const hintWarn = (known?.hints || []).filter(x => String(x).startsWith('⚠️')).map(x => String(x).replace(/^⚠️\s*/, ''));

    const why = [], warn = [], unsuitableReasons = [], short = { why: [], warn: [] };
    let adjust = 0;
    const disliked = !!ctx.disliked?.has(l.id);

    if (area) { why.push(`Viertel ${area.name}: ${area.total}/100 ${solo ? 'für dich' : 'für die Gruppe'}${area.approx ? ' (ungefähr)' : ''}`); short.why.push(`Viertel ${area.total}`); }
    if (area?.approx) warn.push('Viertel nur ungefähr bestimmt (mehrere Teil-Viertel)');
    if (!solo && area?.minName && area.min < 40) warn.push(`${area.minName} wäre dort eher unzufrieden (${area.min})`);
    if (l.rating != null) {
      const txt = `⭐ ${sepNum(l.rating, 2)} bei ${l.reviewCount || 0} Bewertungen`;
      (parts.rating >= 0.7 ? why : parts.rating < 0.35 ? warn : why).push(txt);
      (parts.rating < 0.35 ? short.warn : short.why).push(`⭐ ${sepNum(l.rating, 2)}`);
    } else if (l.isNew) { warn.push('neu, noch keine Bewertungen'); short.warn.push('neu'); }
    else { warn.push('Bewertung nicht gelesen'); short.warn.push('Bewertung unklar'); }
    for (const x of wish.hit) why.push(`✓ ${x}`);
    for (const x of wish.miss) { warn.push(`Wunsch nicht erfüllt: ${x}`); short.warn.push(x); }
    const fake = fakeReviewHint(l);
    if (fake) warn.push(fake);
    warn.push(...scamWarnings(l));

    // Preis: Beschriftung je nach Gesamt- oder Nachtpreis; Pro-Kopf immer auf die Reisesumme bezogen
    if (l.totalPrice != null) {
      const cur = l.currency || '€', pp = people > 1 && total != null ? Math.round(total / people) : null;
      const unsure = l.multiUnit ? ' (ab-Preis, je nach Wohnung)' : '';
      if (parts.price != null) {
        const ok = parts.price >= 0.75;
        const label = l.isTotal ? `${l.totalPrice} ${cur} gesamt` : `${l.totalPrice} ${cur} pro Nacht${total != null ? ` (${Math.round(total)} ${cur} gesamt)` : ''}`;
        (ok ? why : warn).push(`${label}${pp ? ` (${pp} pro Person)` : ''}${ok ? '' : ' – über Budget'}${unsure}`);
        (ok ? short.why : short.warn).push(`${Math.round(total ?? l.totalPrice)} ${cur}${total == null ? '/Nacht' : ''}`);
        if (parts.price < 0.3) unsuitableReasons.push('deutlich über Budget');
      } else if (l.isTotal) {
        why.push(`${l.totalPrice} ${cur} gesamt${pp ? ` (${pp} pro Person)` : ''}${unsure}`);
      } else {
        warn.push(`${l.totalPrice} ${cur} pro Nacht${ctx.nights ? '' : ' (Nächtezahl fehlt, Preis nicht bewertet)'}${unsure}`);
      }
      if (curMismatch) warn.push(`Preis in ${l.currency}, Budget in ${ctx.budgetCurrency}: Preis nicht bewertet`);
      if (ctx.priceUnsure) warn.push('Flexible Daten oder Monatsmiete: Preis nicht bewertet');
      if (l.priceImplausible) warn.push('Preis auffällig niedrig, vermutlich falsch gelesen: nicht bewertet');
      if (l.unitGuessed) warn.push('Einheit des Preises geraten: als Gesamtpreis gedeutet');
      if (l.priceStale) warn.push('Preis aus den Seitendaten, kann nach Datumswechsel veraltet sein');
      if (l.multiUnit) warn.push('Mehrere Unterkünfte im Angebot: Preis ist ein „ab“-Preis und kann höher sein');
    }

    // Betten
    if (parts.beds != null) {
      const cap = l.sleeps != null ? `${l.sleeps} ${l.sleeps === 1 ? 'Schlafplatz' : 'Schlafplätze'}` : `${l.beds} ${l.beds === 1 ? 'Bett' : 'Betten'}`;
      (parts.beds >= 1 ? why : warn).push(`${cap}${l.bedrooms != null ? `, ${l.bedrooms} Schlafzimmer` : ''} für ${people}`);
      if (parts.beds < 1) short.warn.push(`${l.sleeps ?? l.beds} ${(l.sleeps ?? l.beds) === 1 ? 'Bett' : 'Betten'} für ${people}`);
      if (parts.beds <= 0.25) unsuitableReasons.push(`zu wenige Betten für ${people}`);
    } else if (!solo && people && l.bedrooms != null && l.bedrooms * 3 < people) {
      warn.push(`Nur ${l.bedrooms} Schlafzimmer für ${people} (Betten unbekannt)`);
    }

    // Bäder, Unterkunftsart, gewerblicher Gastgeber (Nr. 573–575). Kleine Abzüge, keine Teile der Gewichtung.
    if (people && l.baths != null && people / l.baths > 4) { warn.push(`${sepNum(l.baths)} Bad für ${people} Personen`); short.warn.push('wenig Bäder'); adjust -= 4; }
    const kind = String(l.kind || '');
    // Bei einer Person bleiben Hinweise zur Art, aber „Privatzimmer für 1“ ist kein Mangel

    if (SHARED_ROOM.test(kind)) { warn.push('Geteilter Raum / Schlafsaal'); short.warn.push('geteilter Raum'); adjust -= 10; if (people >= 2) unsuitableReasons.push('geteilter Raum'); }
    else if (PRIVATE_ROOM.test(kind) && people >= 3) { warn.push(`Nur ein Privatzimmer für ${people} Personen`); short.warn.push('nur Privatzimmer'); adjust -= 8; unsuitableReasons.push(`Privatzimmer für ${people}`); }
    if (l.pro) { warn.push('Gewerblicher Gastgeber'); adjust -= 2; }

    if (l.badges?.length) why.push(l.badges.join(' · '));
    if (ctx.seen?.has(l.id)) why.push('schon angesehen');
    if (disliked) warn.push('von dir mit 👎 markiert');
    if (pe.mismatch) warn.push(`Airbnb zeigt ${pe.mismatch.airbnb} Gäste, in deiner Reise stehen ${pe.mismatch.trip}: bewertet mit ${pe.mismatch.airbnb}`);

    for (const x of hintWarn) warn.push(`Bewertungen: ${x} (aus deinem Besuch)`);
    if (hintWarn.length) adjust -= Math.min(8, 4 * hintWarn.length);

    let score = Math.round(base) + adjust;
    // R5-107: kein Extra-Bonus für Favorit/Superhost: steckt schon in der Note und würde doppelt zählen
    score = Math.max(0, Math.min(100, score));
    if (disliked) score = Math.min(score, 20);

    const unsuitable = disliked || unsuitableReasons.length > 0;
    const badgeReason = disliked ? '👎 von dir markiert' : (unsuitableReasons[0] ? unsuitableReasons[0] : (short.warn[0] || short.why.slice(0, 2).join(' · ')));
    // Preis pro Nacht und (nur bei mehreren Personen) pro Person und Nacht, für Panel, Plaketten und Vergleich
    const night = perNight(l, ctx.nights);
    const ppn = { night: night == null ? null : Math.round(night), person: night != null && people > 1 ? Math.round(night / people) : null };
    return {
      score, parts, area, why, warn, ppn, stay: total == null ? null : Math.round(total),
      disliked, unsuitable, unsuitableReasons, badgeReason,
      breakdown, adjust, people, peopleMismatch: pe.mismatch,
      budgetKnown: !!(budget || ctx.budgetPerNight), tripTotal: total, priceUncertain: !!l.multiUnit,
    };
  }

  function rankListings(listings, ctx) {
    const norm = normalizePrices(listings, ctx);
    const byCur = {};
    for (const l of norm) { const v = l.priceImplausible ? null : perNight(l, ctx.nights); if (v) (byCur[normCur(l.currency) || '€'] ||= []).push(v); }
    const medianNight = {};
    for (const [c, v] of Object.entries(byCur)) if (v.length >= 5) medianNight[c] = median(v);
    const ctx2 = { ...ctx, medianNight };
    return norm.map(l => ({ ...l, rank: { ...scoreListing(l, ctx2), luxury: luxuryInfo(l, ctx2) } })).sort((a, b) => b.rank.score - a.rank.score || b.rank.luxury.level - a.rank.luxury.level);
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

  // Vergleichstabelle: Zeilen mit je einer Zelle pro Unterkunft (nur reine Texte, kein HTML)
  function compareRows(top, ctx = {}) {
    const fmt = (v, u = '') => v == null ? '–' : `${v}${u}`;
    const rows = [
      ['Passt-Wert', l => `${l.rank.score}/100`],
      ['Viertel', l => l.rank.area ? `${l.rank.area.name} (${l.rank.area.total})` : (l.locality || '–')],
      ['Gesamtpreis', l => l.rank.stay == null ? '–' : `${l.rank.stay} ${l.currency || '€'}`],
      ['pro Nacht', l => l.rank.ppn?.night == null ? '–' : `${l.rank.ppn.night} ${l.currency || '€'}`],
      ...(ctx.people > 1 ? [['pro Person/Nacht', l => l.rank.ppn?.person == null ? '–' : `${l.rank.ppn.person} ${l.currency || '€'}`]] : []),
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
    const head = meta.title || 'Meine Auswahl (StayMatch)';
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

  root.StayMatchRank = {
    rankListings, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, WEIGHTS, WISHES, wishScore, luxuryInfo, reviewConflicts, REVIEW_WISHES,
    weightsFor, buildTaste, effectiveBudget, resolvePeople, tripTotal, perNight, weightedRecentRating, fakeReviewHint, filterListings, compareRows, shareText, normalizePrices, normCur,
  };
})(typeof window !== 'undefined' ? window : globalThis);
