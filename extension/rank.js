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
      let best = null, bd = Infinity, second = Infinity;
      for (const a of areas) { const d = distM(listing, a); if (d < bd) { second = bd; bd = d; best = a; } else if (d < second) second = d; }
      // R7 E: Airbnb zeigt die Lage nur ungefähr (±500 m): liegt ein zweites Viertel kaum weiter weg, ist der Viertelwert unscharf
      if (best && bd <= RADIUS.match) return { ...best, dist: Math.round(bd), ...(second - bd < 250 ? { nearBorder: true } : {}) };
    }
    const loc = norm(listing.locality);
    if (loc) {
      const exact = areas.filter(a => norm(a.name) === loc);
      const word = (hay, needle) => needle.length >= 4 && ` ${hay} `.includes(` ${needle} `);
      const hits = exact.length ? exact : areas.filter(a => { const n = norm(a.name); return n && (word(loc, n) || word(n, loc)); });
      if (hits.length === 1) return { ...hits[0], dist: null };
      if (hits.length > 1) {
        const avg = k => { const v = hits.map(a => a[k]).filter(Number.isFinite); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
        // R7: Koordinate = Schwerpunkt der Teilviertel (nicht die des ersten), sonst null
        const ctr = k => { const v = hits.map(a => a[k]).filter(Number.isFinite); return v.length === hits.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
        return { name: listing.locality, lat: ctr('lat'), lon: ctr('lon'), total: avg('total'), min: avg('min'), minName: null, approx: true, dist: null };
      }
    }
    return null;
  }

  // Bayes-Mittel: 5,0 bei 3 Bewertungen zählt weniger als 4,9 bei 300
  // R7: Prior = Notenmedian der Seite (rankListings), sonst 4,6
  function ratingScore(value, count, prior = 4.6) {
    if (value == null) return null;
    const m = 20, C = prior, n = count || 0;
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
  // R7 E: ownBed = jede Person will ein eigenes Bett (Freundesgruppen): dann zählt die Bettenzahl, Doppelbett = 1
  function bedScore(l, people, ownBed) {
    if (!people) return null;
    if (ownBed && people >= 2) {
      const n = l.bedKinds ? Object.entries(l.bedKinds).reduce((s, [k, v]) => s + (k === 'bunk' ? 2 : 1) * v, 0) : l.beds;
      if (n == null) return null;
      return n >= people ? 1 : n * 1.5 >= people ? 0.65 : 0.25;
    }
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
    const byCurrency = {};
    const ck = i => normCur(i.currency) || '€'; // R7: „EUR“ = „€“
    for (const cur of new Set(liked.map(ck))) {
      const m = median(liked.filter(i => ck(i) === cur).map(i => i.pricePerNight).filter(Boolean));
      if (m) byCurrency[cur] = m;
    }
    const mr = median(liked.map(i => i.rating).filter(Boolean));
    return {
      likedCount: liked.length,
      avgPricePerNightByCurrency: byCurrency, // R7: nur noch je Währung (das alte Feld nahm irgendeine)
      minRating: mr != null ? mr - 0.05 : null,
      localities: [...new Set(liked.map(i => i.locality).filter(Boolean))],
    };
  }

  // Preisanteil: Nachtpreis vergleichen, nicht doppelt durch Nächte teilen; je Währung
  function tasteScore(l, taste) {
    if (!taste || !taste.likedCount) return null;
    let s = 0.5;
    const cur = normCur(l.currency) || '€';
    const ref = taste.avgPricePerNightByCurrency?.[cur];
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
    trusted: { label: '🏅 Superhost/Favorit', ok: 'Superhost oder Gäste-Favorit', no: 'kein Superhost/Gäste-Favorit', check: l => isTrusted(l) },
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
    // R7 E: Ausstattungs-Wünsche (extras.js) zählen nur für Unterkünfte, deren Seite du geöffnet hast
    const XW = root.StayMatchExtras?.EXTRA_WISHES || {};
    for (const k of (wishes || []).filter(k => XW[k] && !WISHES[k])) {
      const x = ctx?.known?.get?.(l.id)?.extra;
      const r = XW[k].check(x, l);
      if (r === true) hit.push(XW[k].ok); else if (r === false && XW[k].no) miss.push(XW[k].no);
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
  // R7: eine Stelle für „Superhost oder Gäste-Favorit“ (vorher dreimal dieselbe Regex)
  const isTrusted = l => (l.badges || []).some(b => /favorit|superhost/i.test(b));
  const GLOBAL_RE = new Map(); // R7: globale Fassung je Muster nur einmal bauen
  const hits = (re, txt) => { let g = GLOBAL_RE.get(re); if (!g) GLOBAL_RE.set(re, g = new RegExp(re.source, 'gi')); g.lastIndex = 0; const out = []; for (const m of txt.matchAll(g)) { const w = m[0].trim(); if (w && !out.some(x => x.toLowerCase() === w.toLowerCase())) out.push(w); } return out; };
  // state: true = Luxus erkannt, false = klar kein Luxus (Zimmer), null = unbekannt (nie geraten)
  // R7: je Unterkunft und Kontext nur einmal rechnen (check, ok und rankListings fragen alle)
  const LUX_MEMO = new WeakMap();
  function luxuryInfo(l, ctx) {
    const m = LUX_MEMO.get(l);
    if (m && m.ctx === ctx) return m.v;
    const v = luxuryCalc(l, ctx);
    LUX_MEMO.set(l, { ctx, v });
    return v;
  }
  function luxuryCalc(l, ctx) {
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
  // R7: Betrag mit Währung; ohne gelesene Währung nur die Zahl (nicht still „€“)
  // R7: Zahlen gerundet und gruppiert („1.235“ statt „1234.5“)
  const fmtNum = v => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v).toLocaleString('de-DE') : String(v));
  const money = (v, c) => (c ? `${fmtNum(v)} ${c}` : fmtNum(v));

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
      rating: ratingScore(effectiveRating(l), l.reviewCount, ctx.ratingPrior ?? 4.6),
      // ohne Nächtezahl bei Nachtpreis: nur mit Budget pro Nacht vergleichbar (Direkt-Modus), sonst kein Preis-Teil
      price: priceBlocked ? null : total != null ? priceScore(total, budget) : (!l.isTotal && ctx.budgetPerNight ? priceScore(l.totalPrice, ctx.budgetPerNight) : null),
      wishes: wish.value,
      beds: solo ? null : bedScore(l, people, ctx.ownBed), // eine Person: keine Betten-Wertung
      taste: tasteScore({ ...l, nights: ctx.nights }, ctx.taste),
    };
    const weights = weightsFor(people, ctx.wishes);
    // R7 E: Stabilitätsprüfung rechnet mit leicht geänderten Gewichten
    if (ctx.weightTweak) for (const [k, f] of Object.entries(ctx.weightTweak)) if (weights[k] != null) weights[k] *= f;
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

    const why = [], warn = [], info = [], unsuitableReasons = [], short = { why: [], warn: [] };
    let adjust = 0;
    const disliked = !!ctx.disliked?.has(l.id);

    if (area) { why.push(`Viertel ${area.name}: ${area.total}/100 ${solo ? 'für dich' : 'für die Gruppe'}${area.approx ? ' (ungefähr)' : ''}`); short.why.push(`Viertel ${area.total}`); }
    if (area?.approx) warn.push('Viertel nur ungefähr bestimmt (mehrere Teil-Viertel)');
    else if (area?.nearBorder) info.push('Lage laut Airbnb nur ±500 m genau, nahe einer Viertelgrenze: Viertelwert unscharf');
    if (!solo && area?.minName && area.min < 40) warn.push(`${area.minName} wäre dort eher unzufrieden (${area.min})`);
    if (l.rating != null) {
      // R7: Note aus dem aria-label hat keine Anzahl: nicht „bei 0 Bewertungen“
      const txt = l.reviewCount != null ? `⭐ ${sepNum(l.rating, 2)} bei ${l.reviewCount} Bewertungen` : `⭐ ${sepNum(l.rating, 2)} (Anzahl unbekannt)`;
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
      // R7: ohne gelesene Währung keine erfundene „€“-Angabe
      const M = v => money(v, l.currency), pp = people > 1 && total != null ? Math.round(total / people) : null;
      const unsure = l.multiUnit ? ' (ab-Preis, je nach Wohnung)' : '';
      const nightLabel = `${M(l.totalPrice)} pro Nacht${total != null ? ` (${M(Math.round(total))} gesamt)` : ''}`;
      if (parts.price != null) {
        const ok = parts.price >= 0.75;
        const label = l.isTotal ? `${M(l.totalPrice)} gesamt` : nightLabel;
        (ok ? why : warn).push(`${label}${pp ? ` (${pp} pro Person)` : ''}${ok ? '' : ' – über Budget'}${unsure}`);
        (ok ? short.why : short.warn).push(`${M(Math.round(total ?? l.totalPrice))}${total == null ? '/Nacht' : ''}`);
        if (parts.price < 0.3) unsuitableReasons.push('deutlich über Budget');
      } else if (l.isTotal) {
        why.push(`${M(l.totalPrice)} gesamt${pp ? ` (${pp} pro Person)` : ''}${unsure}`);
      } else if (ctx.nights) {
        // R7: normaler Nachtpreis ohne Budget ist keine Warnung
        why.push(`${nightLabel}${pp ? ` (${pp} pro Person)` : ''}${unsure}`);
      } else {
        warn.push(`${M(l.totalPrice)} pro Nacht (Nächtezahl fehlt, Preis nicht bewertet)${unsure}`);
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
    // R7: neutrale Infos (kein Vorzug, keine Warnung)
    // (info steht oben bei why/warn)
    // R7 E: Lockpreis (Nacht billig, gesamt teuer), Gebühren-Anteil, Sterne relativ zur Seite, nur Einzelbetten für ein Paar
    const fees = feeShareOf(l, ctx.nights);
    const med = ctx.medianNight?.[normCur(l.currency) || '€'];
    if (med && l.nightPrice != null && ctx.nights && l.allTotal != null && l.nightPrice < med && l.allTotal / ctx.nights > med * 1.05) { warn.push('Lockpreis: Nacht billig, gesamt teuer (hohe Gebühren)'); short.warn.push('Lockpreis'); }
    else if (fees != null && fees >= 0.25) warn.push(`Gebühren machen ${Math.round(fees * 100)} % des Gesamtpreises aus`);
    if (ctx.ratingMedian && l.rating != null && (l.reviewCount || 0) >= 5 && l.rating < ctx.ratingMedian - 0.1) info.push(`⭐ ${sepNum(l.rating, 2)} liegt unter dem Seitenmedian ${sepNum(ctx.ratingMedian, 2)}`);
    if (people === 2 && l.bedKinds && !l.bedKinds.double && (l.bedKinds.single || 0) >= 2) { warn.push('Nur Einzelbetten angegeben, kein Doppelbett'); short.warn.push('Einzelbetten'); }
    if (ctx.seen?.has(l.id)) info.push('schon angesehen');
    if (disliked) warn.push('von dir mit 👎 markiert');
    if (pe.mismatch) warn.push(`Airbnb zeigt ${pe.mismatch.airbnb} Gäste, in deiner Reise stehen ${pe.mismatch.trip}: bewertet mit ${pe.mismatch.airbnb}`);

    for (const x of hintWarn) warn.push(`Bewertungen: ${x} (aus deinem Besuch)`);
    // R7: nach Häufigkeit staffeln: einmal 3 Punkte, „(4×)“ bis 6 Punkte; zusammen höchstens 10
    const hintCost = x => 3 + Math.min(3, (+(String(x).match(/\((\d+)×\)\s*$/)?.[1] || 1)) - 1);
    if (hintWarn.length) adjust -= Math.min(10, hintWarn.reduce((s, x) => s + hintCost(x), 0));

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
      score, parts, area, why, warn, info, ppn, stay: total == null ? null : Math.round(total),
      disliked, unsuitable, unsuitableReasons, badgeReason,
      breakdown, adjust, people, peopleMismatch: pe.mismatch,
      budgetKnown: !!(budget || ctx.budgetPerNight), tripTotal: total, priceUncertain: !!l.multiUnit, feeShare: fees,
    };
  }

  // R7 E: Anteil der Gebühren, wenn die Karte Nacht- und Gesamtpreis zeigt
  function feeShareOf(l, nights) {
    if (l.nightPrice == null || l.allTotal == null || !nights) return null;
    const f = (l.allTotal - l.nightPrice * nights) / l.allTotal;
    return f > 0 && f < 0.9 ? f : null;
  }
  // R7 E: echte Schlafplätze (Schlafsofa halb), für „Preis pro Schlafplatz“
  function realSleeps(l) {
    const k = l.bedKinds;
    if (!k) return null;
    const n = (k.double || 0) * 2 + (k.single || 0) + (k.sofa || 0) * 0.5 + (k.bunk || 0) * 2;
    return n > 0 ? n : null;
  }

  function rankListings(listings, ctx) {
    const norm = normalizePrices(listings, ctx);
    const byCur = {};
    for (const l of norm) { const v = l.priceImplausible ? null : perNight(l, ctx.nights); if (v) (byCur[normCur(l.currency) || '€'] ||= []).push(v); }
    const medianNight = {};
    for (const [c, v] of Object.entries(byCur)) if (v.length >= 5) medianNight[c] = median(v);
    // R7: Bayes-Prior aus dem Notenmedian der Seite (ab 5 Noten, begrenzt auf 4,4–4,9)
    const ratings = norm.map(l => l.rating).filter(v => v != null && isFinite(v));
    const ratingPrior = ctx.ratingPrior ?? (ratings.length >= 5 ? Math.max(4.4, Math.min(4.9, median(ratings))) : 4.6);
    const ctx2 = { ...ctx, medianNight, ratingPrior, ratingMedian: ratings.length >= 5 ? median(ratings) : null };
    // R7: Gleichstand: mit Wunsch „Luxus“ die luxuriösere, sonst die günstigere zuerst (unbekannter Preis zuletzt)
    const wantsLux = (ctx.wishes || []).includes('luxury');
    const pn = l => { const v = perNight(l, ctx.nights); return v == null ? Infinity : v; };
    return norm.map(l => ({ ...l, rank: { ...scoreListing(l, ctx2), luxury: luxuryInfo(l, ctx2) } }))
      .sort((a, b) => b.rank.score - a.rank.score || (wantsLux ? b.rank.luxury.level - a.rank.luxury.level : pn(a) - pn(b)));
  }

  // Nr. 399: Filter. minRating: Zahl oder true (= 4,7). Reihenfolge der Liste bleibt.
  // R7: einzige Filterfunktion (auch fürs Panel), kennt jetzt auch „nur Luxus“
  function filterListings(list, f = {}) {
    const min = f.minRating === true ? 4.7 : f.minRating;
    return list.filter(l => {
      if (min && !(l.rating >= min)) return false;
      // ohne bekanntes Budget kann der Filter nichts aussortieren
      if (f.inBudget && l.rank?.budgetKnown && !(l.rank.parts.price != null && l.rank.parts.price >= 0.75)) return false;
      if (f.enoughBeds && l.rank?.parts.beds != null && l.rank.parts.beds < 1) return false; // unbekannt zählt als ok
      if (f.lux && l.rank?.luxury?.state !== true) return false;
      if (f.favorite && !isTrusted(l)) return false;
      if (f.lowFees && l.rank?.feeShare != null && l.rank.feeShare > 0.25) return false; // R7 E: unbekannte Gebühren bleiben drin
      return true;
    });
  }

  // Vergleichstabelle: Zeilen mit je einer Zelle pro Unterkunft (nur reine Texte, kein HTML)
  function compareRows(top, ctx = {}) {
    const fmt = (v, u = '') => v == null ? '–' : `${v}${u}`;
    const rows = [
      ['Passt-Wert', l => `${l.rank.score}/100`],
      ['Viertel', l => l.rank.area ? `${l.rank.area.name} (${l.rank.area.total})` : (l.locality || '–')],
      ['Gesamtpreis', l => l.rank.stay == null ? '–' : money(l.rank.stay, l.currency)],
      ['pro Nacht', l => l.rank.ppn?.night == null ? '–' : money(l.rank.ppn.night, l.currency)],
      ...(ctx.people > 1 ? [['pro Person/Nacht', l => l.rank.ppn?.person == null ? '–' : money(l.rank.ppn.person, l.currency)]] : []),
      ['Sterne', l => l.rating == null ? 'neu' : `${String(l.rating).replace('.', ',')} (${l.reviewCount || 0})`],
      ['Betten', l => fmt(l.beds)],
      ['Schlafzimmer', l => fmt(l.bedrooms)],
      ...(ctx.people > 2 ? [['pro Schlafplatz', l => { const n = realSleeps(l); return n && l.rank.stay != null ? money(l.rank.stay / n, l.currency) : '–'; }]] : []),
      ['Auszeichnung', l => (l.badges || []).join(', ') || '–'], // R7: „Gäste-Favorit“ ist keine Gastgeber-Eigenschaft
      ['Warnungen', l => l.rank.warn.length ? String(l.rank.warn.length) + ': ' + l.rank.warn.slice(0, 2).join('; ') : 'keine'],
    ];
    return rows.map(([label, f]) => ({ label, cells: top.map(f) }));
  }

  // Text für den Gruppenchat. Nur Titel, Eckdaten und der Link, den die Gruppe selbst öffnet.
  // R7 E: meta.noPrices (ohne Beträge), meta.noEmoji (für Screenreader), meta.markdown (Tabelle), meta.stamp (Preisstand), meta.questions
  const stripEmoji = t => String(t).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/ {2,}/g, ' ').trim();
  function shareText(items, meta = {}) {
    const head = meta.title || 'Meine Auswahl (StayMatch)';
    const star = meta.noEmoji ? 'Sterne ' : '⭐ ';
    const price = l => meta.noPrices ? [] : [
      (l.rank?.stay ?? l.stay) != null && `${money(l.rank?.stay ?? l.stay, l.currency)} gesamt`,
      (l.rank?.ppn?.person ?? l.ppnPerson) != null && `${money(l.rank?.ppn?.person ?? l.ppnPerson, l.currency)} p. P./Nacht`].filter(Boolean);
    const stamp = meta.stamp && !meta.noPrices ? `Preise Stand ${new Date(meta.stamp).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}, können sich ändern` : null;
    let out;
    if (meta.markdown) {
      const esc = v => String(v ?? '–').replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const cols = ['#', 'Unterkunft', 'Ort', 'Sterne', 'Wert', ...(meta.noPrices ? [] : ['Preis']), 'Link'];
      const rows = items.map((l, i) => [i + 1, l.title || l.kind || 'Unterkunft', l.locality || '–', l.rating != null ? String(l.rating).replace('.', ',') : 'neu', l.score != null ? `${l.score}/100` : '–', ...(meta.noPrices ? [] : [price(l).join(', ') || '–']), l.url ? `[öffnen](${l.url})` : '–']);
      out = [`**${head}**`, meta.sub ? `_${meta.sub}_` : null, '', `| ${cols.join(' | ')} |`, `|${cols.map(() => ' --- ').join('|')}|`, ...rows.map(r => `| ${r.map(esc).join(' | ')} |`), stamp ? `\n_${stamp}_` : null].filter(x => x != null).join('\n');
    } else {
      const lines = [head];
      if (meta.sub) lines.push(meta.sub);
      items.forEach((l, i) => {
        const bits = [l.locality, l.rating != null && `${star}${String(l.rating).replace('.', ',')}`, l.score != null && `${l.score}/100`, ...price(l)].filter(Boolean);
        lines.push('', `${i + 1}. ${l.title || l.kind || 'Unterkunft'}${bits.length ? ' – ' + bits.join(' · ') : ''}`);
        if (l.note && meta.notes) lines.push(`   Notiz: ${l.note}`); // R7: private Notizen nur auf Wunsch
        if (l.url) lines.push(`   ${l.url}`);
      });
      if (stamp) lines.push('', stamp);
      if (meta.questions?.length) lines.push('', 'Zum Entscheiden:', ...meta.questions.map(q => `- ${q}`));
      out = lines.join('\n');
    }
    return meta.noEmoji ? out.split('\n').map(stripEmoji).join('\n') : out;
  }
  // R7 E: zwei Fragen aus dem größten Unterschied der Top 3 (Preis, Lage, Sterne, Größe)
  function decisionQuestions(top) {
    if (!top || top.length < 2) return [];
    const q = [];
    const [a, b] = top;
    const pa = a.rank?.stay, pb = b.rank?.stay;
    if (pa != null && pb != null && Math.abs(pa - pb) / Math.min(pa, pb) >= 0.15) q.push(`${pa > pb ? '1' : '2'} kostet ${money(Math.abs(pa - pb), a.currency)} mehr: ist es das wert?`);
    if (a.rank?.area && b.rank?.area && a.rank.area.name !== b.rank.area.name) q.push(`Lieber ${a.rank.area.name} oder ${b.rank.area.name}?`);
    if (a.rating != null && b.rating != null && Math.abs(a.rating - b.rating) >= 0.15) q.push(`Sind uns ${sepNum(Math.abs(a.rating - b.rating), 2)} Sterne Unterschied wichtig?`);
    if (a.bedrooms != null && b.bedrooms != null && a.bedrooms !== b.bedrooms) q.push(`Brauchen wir ${Math.max(a.bedrooms, b.bedrooms)} Schlafzimmer oder reichen ${Math.min(a.bedrooms, b.bedrooms)}?`);
    return q.slice(0, 2);
  }

  root.StayMatchRank = {
    rankListings, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, WEIGHTS, WISHES, wishScore, luxuryInfo, reviewConflicts, REVIEW_WISHES,
    weightsFor, buildTaste, effectiveBudget, feeShareOf, realSleeps, decisionQuestions, resolvePeople, tripTotal, perNight, weightedRecentRating, fakeReviewHint, filterListings, compareRows, shareText, normalizePrices, normCur, money, isTrusted,
  };
})(typeof window !== 'undefined' ? window : globalThis);
