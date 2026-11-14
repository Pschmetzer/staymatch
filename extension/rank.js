// StayMatch – bewertet Unterkünfte für dich (oder deine Gruppe). Reine Funktionen, ohne chrome.*.
// Schnittstelle nur erweitert: alle bisherigen Felder von scoreListing/rankListings bleiben.
(function (root) {
  // Kern aus core.js: im Plugin vorher geladen (manifest.json), in Node per require
  const C = root.StayMatchCore || (typeof require === 'function' ? require('./core.js') : null);
  const { distM, RADIUS } = C;
  const I18n = root.StayMatchI18n || (typeof require === 'function' ? require('./i18n.js') : null);
  const t = (k, v) => I18n.t(k, v);
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
    if (l.rating >= 4.95 && n > 0 && n < 8) return t('rank.fake.top', { n });
    if (Array.isArray(l.reviewTexts) && l.reviewTexts.length >= 6) {
      const norm2 = l.reviewTexts.map(x => norm(x));
      const dup = norm2.length - new Set(norm2).size;
      if (dup / norm2.length >= 0.3) return t('rank.fake.dup');
    }
    return null;
  }

  // Nr. 291: Betrugsmuster als vorsichtige Warnung; erwartet die Funktion scamSignals aus parse.js oder eigene Liste
  function scamWarnings(l) {
    return (l.scamSignals || []).map(s => t('rank.scam', { s }));
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
      // R8: Schlafsofa zählt überall halb (wie realSleeps)
      const n = l.bedKinds ? Object.entries(l.bedKinds).reduce((s, [k, v]) => s + (k === 'bunk' ? 2 : k === 'sofa' ? 0.5 : 1) * v, 0) : l.beds;
      if (n == null) return null;
      return n >= people ? 1 : n * 1.5 >= people ? 0.65 : 0.25;
    }
    // R5-106: ein Paar teilt sich ein Bett
    // R8: nur ohne bekannte Bettarten; „1 Einzelbett“ für zwei ist kein volles Bett
    const sl = l.bedKinds ? realSleeps(l) : l.sleeps;
    if (people <= 2 && sl == null && l.beds >= 1) return 1;
    if (sl != null) {
      if (sl >= people) return 1;
      return sl * 1.5 >= people ? 0.65 : 0.25;
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
  // Labels als Getter: Sprache gilt erst zur Anzeigezeit (nicht beim Laden des Moduls)
  const WISHES = {
    whole: { get label() { return t('rank.wish.whole.label'); }, get ok() { return t('rank.wish.whole.ok'); }, get no() { return t('rank.wish.whole.no'); }, check: l => {
      const k = l.kind || l.title || ''; // erst die Art, freier Titel nur ohne Art („2 Schlafzimmer in …“)
      return PRIVATE_ROOM.test(k) || SHARED_ROOM.test(k) || ROOM_ONLY.test(k) ? false : WHOLE_PLACE.test(k) ? true : null;
    } },
    trusted: { get label() { return t('rank.wish.trusted.label'); }, get ok() { return t('rank.wish.trusted.ok'); }, get no() { return t('rank.wish.trusted.no'); }, check: l => isTrusted(l) },
    reviews: { get label() { return t('rank.wish.reviews.label'); }, get ok() { return t('rank.wish.reviews.ok'); }, get no() { return t('rank.wish.reviews.no'); }, check: l => l.reviewCount == null ? null : l.reviewCount >= 20 },
    luxury: { get label() { return t('rank.wish.luxury.label'); }, ok: (l, ctx) => { const w = luxuryInfo(l, ctx).words; return w.length ? t('rank.wish.luxury.okWords', { w: w.slice(0, 3).join(', ') }) : t('rank.wish.luxury.ok'); }, get no() { return t('rank.wish.luxury.no'); },
      check: (l, ctx) => luxuryInfo(l, ctx).state },
    private: { get label() { return t('rank.wish.private.label'); }, ok: null, get no() { return t('rank.wish.private.no'); }, check: l => l.pro === true ? false : null }, // „privat“ ist nie sicher
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
  // [Anzeigename, Muster]: Index 0 ist ein Getter (Sprache zur Anzeigezeit)
  const reviewWish = (key, re) => { const a = [null, re]; Object.defineProperty(a, 0, { get: () => t(key), enumerable: true }); return a; };
  const REVIEW_WISHES = { quiet: reviewWish('rank.rw.quiet', /laut|hellhörig|Baustelle/), clean: reviewWish('rank.rw.clean', /schmutzig|nicht sauber/), wifi: reviewWish('rank.rw.wifi', /WLAN/) };
  function reviewConflicts(hints, wishes) {
    const out = [];
    for (const k of wishes || []) {
      const w = REVIEW_WISHES[k]; if (!w) continue;
      const bad = (hints || []).find(h => h.startsWith('⚠️') && w[1].test(h));
      if (bad) out.push(t('rank.rw.conflict', { w: w[0], bad: bad.replace('⚠️ ', '') }));
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
  // Plakette zur Anzeige: „Gäste-Favorit“ ist die interne Kennung, angezeigt wird sie in der Sprache der Oberfläche
  const badgeLabel = b => (/^g[äa]ste-?favorit$/i.test(String(b)) ? t('rank.badge.fav') : b);
  const isTrusted = l => (l.badges || []).some(b => /favorit|superhost/i.test(b));
  const GLOBAL_RE = new Map(); // R7: globale Fassung je Muster nur einmal bauen
  const hits = (re, txt) => { let g = GLOBAL_RE.get(re); if (!g) GLOBAL_RE.set(re, g = new RegExp(re.source, 'gi')); g.lastIndex = 0; const out = []; for (const m of txt.matchAll(g)) { const w = m[0].trim(); if (w && !out.some(x => x.toLowerCase() === w.toLowerCase())) out.push(w); } return out; };
  // state: true = Luxus erkannt, false = klar kein Luxus (Zimmer), null = unbekannt (nie geraten)
  // R7: je Unterkunft und Kontext nur einmal rechnen (check, ok und rankListings fragen alle)
  // R8: Schlüssel = Kontext + Id (scoreListing rechnet mit einer Kopie von l: Objekt-Schlüssel griff daneben)
  const LUX_MEMO = new WeakMap();
  function luxuryInfo(l, ctx) {
    if (!ctx || typeof ctx !== 'object') return luxuryCalc(l, ctx);
    let byId = LUX_MEMO.get(ctx);
    if (!byId) LUX_MEMO.set(ctx, byId = { ids: new Map(), objs: new WeakMap() });
    const hit = l.id != null ? byId.ids.get(l.id) : byId.objs.get(l);
    if (hit && hit.k === `${l.kind}|${l.title}|${(l.badges || []).join()}|${l.totalPrice}|${l.isTotal}`) return hit.v;
    const v = luxuryCalc(l, ctx);
    const rec = { k: `${l.kind}|${l.title}|${(l.badges || []).join()}|${l.totalPrice}|${l.isTotal}`, v };
    if (l.id != null) byId.ids.set(l.id, rec); else byId.objs.set(l, rec);
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
    const words = [...(badge ? [t('rank.lux.luxe')] : []), ...strong, ...weak, ...soft];
    if (pricey) words.push(t('rank.lux.pricey'));
    if (bath) words.push(t('rank.lux.baths', { b: sepNum(l.baths) }));
    // Stufe 0–1: stark 1, sonst Summe aus schwachen Hinweisen
    const level = badge || strong.length ? 1 : Math.min(1, weak.length * 0.45 + soft.length * 0.2 + (pricey ? 0.35 : 0) + (bath ? 0.25 : 0));
    return { state: level >= 0.7 ? true : null, words, level };
  }
  const ROOM_ONLY = /^\s*(?:chambre|habitaci[oó]n|camera|stanza|pok[oó]j|quarto|slaapkamer)\b|\b(?:chambre|camera|stanza|quarto)\s+(?:dans|chez|in|presso|em|no|na)\b|\bpok[oó]j\s+(?:w|u)\b|chambres? d'hôtes?|\bzimmer in\b|hotelzimmer|\broom in\b|hotel room|chambre d'hôtel|habitación en|stanza in/i;
  const WHOLE_PLACE = /inteir[oa]s?\b|entière?s?\b|cał[aey]\b|całą|\bgîte\b|dépendance|cabaña|mieszkanie|domek|\bwoning\b|\bhuis\b|casa vacanze|wohnung|apartment|appartement|apartamento|appartamento|entire|entero|logement entier|intero|hele |ganze|alojamento inteiro|cały|haus\b|\bpiso\b|vivienda|\bflat\b|\bcabin\b|h[üu]tte|\bhome\b|\bhouse\b|loft|studio|villa|ferienwohnung|condo|bungalow|cottage|chalet|townhouse|casa|maison/i;
  const PRIVATE_ROOM = /pok[oó]j prywatny|prywatny pok[oó]j|quarto privado|privat(?:e)? (?:værelse|rum|rom|soverom)|privatrum|yksityinen huone|soukrom[a-zà-ž]* pokoj|privatzimmer|private room|chambre privée|habitación privada|camera privata|\bkamer\b/i;
  const SHARED_ROOM = /wspólny pok[oó]j|współdzielon[a-zà-ž]*|pok[oó]j wieloosobowy|quarto (?:compartilhado|partilhado)|delt (?:værelse|rom)|delat rum|jaettu huone|sdílen[a-zà-ž]* pokoj|gedeelde kamer|gemeinsch|geteilt\w* zimmer|shared room|chambre partagée|habitación compartida|camera condivisa|hostel|schlafsaal|\bdorm\b|dormitory/i;
  const sepNum = (n, d = 1) => I18n.dec(Math.round(n * 10 ** d) / 10 ** d);

  // R5-100: Währungen vergleichbar machen („€“ = „EUR“)
  const CUR_ALIAS = { EUR: '€', GBP: '£', USD: '$', 'US$': '$', PLN: 'zł', CZK: 'Kč', HUF: 'Ft', INR: '₹', TRY: '₺', RON: 'lei', JPY: '¥', AUD: 'A$', CAD: 'CA$', NZD: 'NZ$', MXN: 'MX$', BRL: 'R$' };
  const normCur = c => (c ? CUR_ALIAS[String(c).trim().toUpperCase()] || String(c).trim() : null);
  // R7: Betrag mit Währung; ohne gelesene Währung nur die Zahl (nicht still „€“)
  // R7: Zahlen gerundet und gruppiert („1.235“ statt „1234.5“)
  const fmtNum = v => (typeof v === 'number' && Number.isFinite(v) ? I18n.num(Math.round(v)) : String(v));
  const money = (v, c) => (c ? `${fmtNum(v)} ${c}` : fmtNum(v));

  const median = a => { const x = a.filter(v => v != null && isFinite(v)).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };

  // Preis von Hand korrigieren oder ausschließen (fixes: { 'id|anreise|abreise': { price } | { exclude: true } }). Nur Nachtpreise, höchstens 200 Einträge.
  function applyPriceFixes(listings, fixes, scope = '') {
    if (!fixes || typeof fixes !== 'object') return listings;
    return listings.map(l => {
      const k = `${l.id}|${scope}`, f = Object.prototype.hasOwnProperty.call(fixes, k) ? fixes[k] : null;
      if (!f || typeof f !== 'object') return l;
      if (f.exclude) return { ...l, priceImplausible: true, priceExcluded: true };
      const p = Number(f.price);
      if (!Number.isFinite(p) || p <= 0) return l;
      const { nightPrice, allTotal, unitGuessed, priceStale, multiUnit, ...rest } = l;
      return { ...rest, totalPrice: p, isTotal: false, priceWord: true, priceFixed: true, priceImplausible: false, discounted: false };
    });
  }

  // R5-83 / R5-110: Einheit und Plausibilität gegen den Median der Seite prüfen.
  // Fehlt in der Preiszeile jedes Wort für „gesamt“ / „pro Nacht“ (priceWord === false), wird sie als Nachtpreis
  // geraten. Liegt der Betrag aber etwa bei Nächte × Median, ist es wohl ein Gesamtpreis.
  // Preise unter 20 % des Medians sind eher ein Lesefehler als ein Schnäppchen.
  function normalizePrices(listings, ctx) {
    const nights = ctx.nights;
    const per = l => (l.totalPrice == null ? null : l.isTotal ? (nights ? l.totalPrice / nights : null) : l.totalPrice);
    const byCur = {};
    for (const l of listings) {
      if (l.priceWord === false || l.priceExcluded) continue; // unsichere Einheit zählt nicht für den Median
      const v = per(l); if (v == null) continue;
      (byCur[normCur(l.currency) || '€'] ||= []).push(v);
    }
    const med = {};
    for (const [c, v] of Object.entries(byCur)) if (v.length >= 3) med[c] = median(v);
    return listings.map(l => {
      const m = med[normCur(l.currency) || '€'];
      if (!m || l.totalPrice == null || l.priceFixed || l.priceExcluded) return l; // von Hand gesetzt: nichts raten
      let out = l;
      if (l.priceWord === false && !l.isTotal && nights >= 2 && l.totalPrice >= m * nights * 0.6 && l.totalPrice >= m * 1.8) out = { ...out, isTotal: true, unitGuessed: true };
      const v = per(out);
      if (v != null && v < m * 0.2) out = { ...out, priceImplausible: true };
      return out;
    });
  }

  // Eigene Gewichte: nur bekannte Teile, endliche Zahlen, begrenzt auf 0,25 bis 3 (1 = unverändert)
  function cleanTweak(t) {
    const out = {};
    if (t && typeof t === 'object') for (const k of Object.keys(WEIGHTS)) { const f = Number(t[k]); if (Number.isFinite(f) && f !== 1) out[k] = Math.max(0.25, Math.min(3, f)); }
    return out;
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
    // Gesamtpreis aus dem Nachtpreis: Nächte der Suche × Nachtpreis, dazu der Gebührenanteil, den andere Karten dieser Seite zeigen (Median).
    // Die Annahme steht sichtbar in info/assumption; ohne Gebührenwerte der Seite bleibt es bei Nächte × Preis.
    const total0 = tripTotal(l, ctx.nights);
    const estimate = total0 != null && !l.isTotal && l.allTotal == null && ctx.feeMedian ? total0 / (1 - ctx.feeMedian) : null;
    const total = estimate ?? total0;
    const assumption = total0 != null && !l.isTotal && l.totalPrice != null
      ? (estimate != null ? t('rank.assume.fees', { n: ctx.nights, price: money(l.totalPrice, l.currency), pct: Math.round(ctx.feeMedian * 100) }) : t('rank.assume.nofees', { n: ctx.nights, price: money(l.totalPrice, l.currency) }))
      : null;
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
    // und mit den Reglern aus dem Panel (ctx.weightTweak, je Teil 0,25 bis 3)
    for (const [k, f] of Object.entries(cleanTweak(ctx.weightTweak))) if (weights[k] != null) weights[k] *= f;
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

    if (area) { why.push(t('rank.area.why', { name: area.name, total: area.total, who: t(solo ? 'rank.area.you' : 'rank.area.group'), approx: area.approx ? t('rank.area.approxSuffix') : '' })); short.why.push(t('rank.area.short', { total: area.total })); }
    if (area?.approx) warn.push(t('rank.area.approx'));
    else if (area?.nearBorder) info.push(t('rank.area.border'));
    if (!solo && area?.minName && area.min < 40) warn.push(t('rank.area.minName', { name: area.minName, min: area.min }));
    if (l.rating != null) {
      // R7: Note aus dem aria-label hat keine Anzahl: nicht „bei 0 Bewertungen“
      const txt = l.reviewCount != null ? t('rank.rating.count', { r: sepNum(l.rating, 2), n: l.reviewCount }) : t('rank.rating.nocount', { r: sepNum(l.rating, 2) });
      (parts.rating >= 0.7 ? why : parts.rating < 0.35 ? warn : why).push(txt);
      (parts.rating < 0.35 ? short.warn : short.why).push(`⭐ ${sepNum(l.rating, 2)}`);
    } else if (l.isNew) { warn.push(t('rank.rating.new')); short.warn.push(t('rank.rating.newShort')); }
    else { warn.push(t('rank.rating.unread')); short.warn.push(t('rank.rating.unreadShort')); }
    for (const x of wish.hit) why.push(`✓ ${x}`);
    for (const x of wish.miss) { warn.push(t('rank.wish.miss', { x })); short.warn.push(x); }
    const fake = fakeReviewHint(l);
    if (fake) warn.push(fake);
    warn.push(...scamWarnings(l));

    // Preis: Beschriftung je nach Gesamt- oder Nachtpreis; Pro-Kopf immer auf die Reisesumme bezogen
    if (l.totalPrice != null) {
      // R7: ohne gelesene Währung keine erfundene „€“-Angabe
      const M = v => money(v, l.currency), pp = people > 1 && total != null ? Math.round(total / people) : null;
      const unsure = l.multiUnit ? t('rank.price.unsure') : '';
      const nightLabel = total != null ? t('rank.price.nightTotal', { p: M(l.totalPrice), approx: estimate != null ? '≈ ' : '', t: M(Math.round(total)) }) : t('rank.price.night', { p: M(l.totalPrice) });
      if (parts.price != null) {
        const ok = parts.price >= 0.75;
        const label = l.isTotal ? t('rank.price.total', { p: M(l.totalPrice) }) : nightLabel;
        (ok ? why : warn).push(`${label}${pp ? t('rank.price.pp', { pp }) : ''}${ok ? '' : t('rank.price.over')}${unsure}`);
        (ok ? short.why : short.warn).push(`${M(Math.round(total ?? l.totalPrice))}${total == null ? t('rank.price.nightShort') : ''}`);
        if (parts.price < 0.3) unsuitableReasons.push(t('rank.price.wayOver'));
      } else if (l.isTotal) {
        why.push(`${t('rank.price.total', { p: M(l.totalPrice) })}${pp ? t('rank.price.pp', { pp }) : ''}${unsure}`);
      } else if (ctx.nights) {
        // R7: normaler Nachtpreis ohne Budget ist keine Warnung
        why.push(`${nightLabel}${pp ? t('rank.price.pp', { pp }) : ''}${unsure}`);
      } else {
        warn.push(t('rank.price.noNights', { p: M(l.totalPrice), unsure }));
      }
      if (curMismatch) warn.push(t('rank.price.curMismatch', { a: l.currency, b: ctx.budgetCurrency }));
      if (ctx.priceUnsure) warn.push(t('rank.price.flex'));
      if (l.priceExcluded) warn.push(t('rank.price.excluded'));
      else if (l.priceImplausible) warn.push(t('rank.price.implausible'));
      if (l.priceFixed) info.push(t('rank.price.fixed', { p: money(l.totalPrice, l.currency) }));
      if (l.unitGuessed) warn.push(t('rank.price.unitGuessed'));
      if (l.priceStale) warn.push(t('rank.price.stale'));
      if (l.multiUnit) warn.push(t('rank.price.multi'));
    }

    // Betten
    if (parts.beds != null) {
      const cap = l.sleeps != null ? t('rank.beds.sleeps', { n: l.sleeps }) : t('rank.beds.beds', { n: l.beds });
      (parts.beds >= 1 ? why : warn).push(t('rank.beds.line', { cap, br: l.bedrooms != null ? t('rank.beds.bedrooms', { n: l.bedrooms }) : '', people }));
      if (parts.beds < 1) short.warn.push(t('rank.beds.short', { n: l.sleeps ?? l.beds, people }));
      if (parts.beds <= 0.25) unsuitableReasons.push(t('rank.beds.unsuitable', { people }));
    } else if (!solo && people && l.bedrooms != null && l.bedrooms * 3 < people) {
      warn.push(t('rank.beds.bedroomsOnly', { n: l.bedrooms, people }));
    }

    // Bäder, Unterkunftsart, gewerblicher Gastgeber (Nr. 573–575). Kleine Abzüge, keine Teile der Gewichtung.
    if (people && l.baths != null && people / l.baths > 4) { warn.push(t('rank.baths.few', { n: l.baths, b: sepNum(l.baths), people })); short.warn.push(t('rank.baths.fewShort')); adjust -= 4; }
    const kind = String(l.kind || '');
    // Bei einer Person bleiben Hinweise zur Art, aber „Privatzimmer für 1“ ist kein Mangel

    if (SHARED_ROOM.test(kind)) { warn.push(t('rank.room.shared')); short.warn.push(t('rank.room.sharedShort')); adjust -= 10; if (people >= 2) unsuitableReasons.push(t('rank.room.sharedShort')); }
    else if (PRIVATE_ROOM.test(kind) && people >= 3) { warn.push(t('rank.room.privOnly', { people })); short.warn.push(t('rank.room.privShort')); adjust -= 8; unsuitableReasons.push(t('rank.room.privReason', { people })); }
    if (l.pro) { warn.push(t('rank.proHost')); adjust -= 2; }

    if (l.badges?.length) why.push(l.badges.map(badgeLabel).join(' · '));
    // R7: neutrale Infos (kein Vorzug, keine Warnung)
    // (info steht oben bei why/warn)
    // R7 E: Lockpreis (Nacht billig, gesamt teuer), Gebühren-Anteil, Sterne relativ zur Seite, nur Einzelbetten für ein Paar
    const fees = feeShareOf(l, ctx.nights);
    const med = ctx.medianNight?.[normCur(l.currency) || '€'];
    if (med && l.nightPrice != null && ctx.nights && l.allTotal != null && l.nightPrice < med && l.allTotal / ctx.nights > med * 1.05) { warn.push(t('rank.lure')); short.warn.push(t('rank.lureShort')); }
    else if (fees != null && fees >= 0.25) warn.push(t('rank.fees', { pct: Math.round(fees * 100) }));
    if (ctx.ratingMedian && l.rating != null && (l.reviewCount || 0) >= 5 && l.rating < ctx.ratingMedian - 0.1) info.push(t('rank.rating.below', { r: sepNum(l.rating, 2), m: sepNum(ctx.ratingMedian, 2) }));
    if (people === 2 && l.bedKinds && !l.bedKinds.double && (l.bedKinds.single || 0) >= 2) { warn.push(t('rank.singles')); short.warn.push(t('rank.singlesShort')); }
    if (assumption) info.push(assumption);
    if (ctx.seen?.has(l.id)) info.push(t('rank.seen'));
    if (disliked) warn.push(t('rank.disliked'));
    if (pe.mismatch) warn.push(t('rank.people', { airbnb: pe.mismatch.airbnb, trip: pe.mismatch.trip }));

    for (const x of hintWarn) warn.push(t('rank.hintWarn', { x }));
    // R7: nach Häufigkeit staffeln: einmal 3 Punkte, „(4×)“ bis 6 Punkte; zusammen höchstens 10
    const hintCost = x => 3 + Math.min(3, (+(String(x).match(/\((\d+)×\)\s*$/)?.[1] || 1)) - 1);
    if (hintWarn.length) adjust -= Math.min(10, hintWarn.reduce((s, x) => s + hintCost(x), 0));

    let score = Math.round(base) + adjust;
    // R5-107: kein Extra-Bonus für Favorit/Superhost: steckt schon in der Note und würde doppelt zählen
    score = Math.max(0, Math.min(100, score));
    if (disliked) score = Math.min(score, 20);

    const unsuitable = disliked || unsuitableReasons.length > 0;
    const badgeReason = disliked ? t('rank.dislikedReason') : (unsuitableReasons[0] ? unsuitableReasons[0] : (short.warn[0] || short.why.slice(0, 2).join(' · ')));
    // Preis pro Nacht und (nur bei mehreren Personen) pro Person und Nacht, für Panel, Plaketten und Vergleich
    const night = perNight(l, ctx.nights);
    const ppn = { night: night == null ? null : Math.round(night), person: night != null && people > 1 ? Math.round(night / people) : null };
    return {
      score, parts, area, why, warn, info, ppn, stay: total == null ? null : Math.round(total), stayEstimated: estimate != null, assumption,
      disliked, unsuitable, unsuitableReasons, badgeReason,
      breakdown, adjust, people, peopleMismatch: pe.mismatch,
      // Datenlage: auf wie vielen Teilen der Passt-Wert beruht (eine Person: Betten zählen nicht mit)
      coverage: { have: breakdown.length, of: solo ? 5 : 6 },
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
    // Gebührenanteil der Seite: Median über Karten, die Nacht- und Gesamtpreis zeigen (ab 3 Karten)
    const fs = ctx.nights ? norm.map(l => feeShareOf(l, ctx.nights)).filter(v => v != null) : [];
    const feeMedian = ctx.feeMedian ?? (fs.length >= 3 ? median(fs) : null);
    const ctx2 = { ...ctx, feeMedian, medianNight, ratingPrior, ratingMedian: ratings.length >= 5 ? median(ratings) : null };
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
      // R8: unbekannter Preis fliegt nicht still raus (wie bei Betten: unbekannt zählt als ok)
      if (f.inBudget && l.rank?.budgetKnown && l.rank.parts.price != null && l.rank.parts.price < 0.75) return false;
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
      [t('rank.cmp.score'), l => `${l.rank.score}/100`],
      [t('rank.cmp.area'), l => l.rank.area ? `${l.rank.area.name} (${l.rank.area.total})` : (l.locality || '–')],
      [t('rank.cmp.total'), l => l.rank.stay == null ? '–' : `${l.rank.stayEstimated ? '≈ ' : ''}${money(l.rank.stay, l.currency)}`],
      [t('rank.cmp.night'), l => l.rank.ppn?.night == null ? '–' : money(l.rank.ppn.night, l.currency)],
      ...(ctx.people > 1 ? [[t('rank.cmp.person'), l => l.rank.ppn?.person == null ? '–' : money(l.rank.ppn.person, l.currency)]] : []),
      [t('rank.cmp.stars'), l => l.rating == null ? t('rank.cmp.new') : `${I18n.dec(String(l.rating))} (${l.reviewCount || 0})`],
      [t('rank.cmp.beds'), l => fmt(l.beds)],
      [t('rank.cmp.baths'), l => l.baths == null ? '–' : I18n.dec(String(l.baths))],
      [t('rank.cmp.bedrooms'), l => fmt(l.bedrooms)],
      ...(ctx.people > 2 ? [[t('rank.cmp.perBed'), l => { const n = realSleeps(l); return n && l.rank.stay != null ? money(l.rank.stay / n, l.currency) : '–'; }]] : []),
      // Storno kennt StayMatch nur nach einem Besuch der Unterkunftsseite
      [t('rank.cmp.cancel'), l => { const c = ctx.known?.get?.(l.id)?.cancellation; return !c || !c.kind ? '–' : c.kind === 'free' ? (c.until ? t('rank.cmp.freeUntil', { d: c.until }) : t('rank.cmp.free')) : c.kind === 'nonrefundable' ? t('rank.cmp.nonref') : t('rank.cmp.strict'); }],
      [t('rank.cmp.dist'), l => l.rank.area?.dist == null ? '–' : l.rank.area.dist >= 1000 ? `${I18n.dec((l.rank.area.dist / 1000).toFixed(1))} km` : `${l.rank.area.dist} m`],
      [t('rank.cmp.wish'), l => l.wishlisted === true ? t('rank.cmp.yes') : l.wishlisted === false ? t('rank.cmp.no') : '–'], // Herz auf der Karte, nur gelesen
      [t('rank.cmp.badge'), l => (l.badges || []).map(badgeLabel).join(', ') || '–'], // R7: „Gäste-Favorit“ ist keine Gastgeber-Eigenschaft
      [t('rank.cmp.warn'), l => l.rank.warn.length ? String(l.rank.warn.length) + ': ' + l.rank.warn.slice(0, 2).join('; ') : t('rank.cmp.none')],
    ];
    return rows.map(([label, f]) => ({ label, cells: top.map(f) }));
  }

  // Text für den Gruppenchat. Nur Titel, Eckdaten und der Link, den die Gruppe selbst öffnet.
  // R7 E: meta.noPrices (ohne Beträge), meta.noEmoji (für Screenreader), meta.markdown (Tabelle), meta.stamp (Preisstand), meta.questions
  const stripEmoji = t => String(t).replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, '').replace(/ {2,}/g, ' ').trim();
  // Hosttitel können Zeilenumbrüche enthalten: im Kopiertext in eine Zeile zwingen (sonst täuscht ein Titel weitere Plätze vor)
  const one = v => String(v ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ');
  function shareText(items, meta = {}) {
    const head = meta.title || t('rank.share.title');
    const star = meta.noEmoji ? t('rank.share.starPlain') : '⭐ ';
    const price = l => meta.noPrices ? [] : [
      (l.rank?.stay ?? l.stay) != null && t('rank.price.total', { p: money(l.rank?.stay ?? l.stay, l.currency) }),
      (l.rank?.ppn?.person ?? l.ppnPerson) != null && t('rank.share.pp', { p: money(l.rank?.ppn?.person ?? l.ppnPerson, l.currency) })].filter(Boolean);
    const stamp = meta.stamp && !meta.noPrices ? t('rank.share.stamp', { d: I18n.dateTime(meta.stamp, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) }) : null;
    let out;
    if (meta.markdown) {
      // R8: auch Markdown-Zeichen maskieren, sonst wird ein Hosttitel „[x](https://…)“ im Chat zum Link
      const esc = v => String(v ?? '–').replace(/[\r\n]+/g, ' ').replace(/[\\|[\]()<>*_`~]/g, '\\$&');
      const safeUrl = u => String(u).replace(/[()<>\s]/g, c => encodeURIComponent(c));
      const cols = ['#', t('rank.share.place'), t('rank.share.colPlace'), t('rank.share.colStars'), t('rank.share.colScore'), ...(meta.noPrices ? [] : [t('rank.share.colPrice')]), 'Link'];
      const rows = items.map((l, i) => [i + 1, l.title || l.kind || t('rank.share.place'), l.locality || '–', l.rating != null ? I18n.dec(String(l.rating)) : t('rank.cmp.new'), l.score != null ? `${l.score}/100` : '–', ...(meta.noPrices ? [] : [price(l).join(', ') || '–'])].map(esc).concat(l.url ? `[${t('rank.share.open')}](${safeUrl(l.url)})` : '–'));
      out = [`**${esc(head)}**`, meta.sub ? `_${esc(meta.sub)}_` : null, '', `| ${cols.join(' | ')} |`, `|${cols.map(() => ' --- ').join('|')}|`, ...rows.map(r => `| ${r.join(' | ')} |`), stamp ? `\n_${stamp}_` : null].filter(x => x != null).join('\n');
    } else {
      const lines = [head];
      if (meta.sub) lines.push(meta.sub);
      items.forEach((l, i) => {
        const bits = [l.locality && one(l.locality), l.rating != null && `${star}${I18n.dec(String(l.rating))}`, l.score != null && `${l.score}/100`, ...price(l)].filter(Boolean);
        lines.push('', `${i + 1}. ${one(l.title || l.kind || t('rank.share.place'))}${bits.length ? ' – ' + bits.join(' · ') : ''}`);
        if (l.note && meta.notes) lines.push(`   ${t('rank.share.note', { note: l.note })}`); // R7: private Notizen nur auf Wunsch
        if (l.url) lines.push(`   ${l.url}`);
      });
      if (stamp) lines.push('', stamp);
      if (meta.questions?.length) lines.push('', t('rank.share.decide'), ...meta.questions.map(q => `- ${q}`));
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
    if (pa != null && pb != null && Math.abs(pa - pb) / Math.min(pa, pb) >= 0.15) q.push(t('rank.q.price', { rank: pa > pb ? '1' : '2', amount: money(Math.abs(pa - pb), a.currency) }));
    if (a.rank?.area && b.rank?.area && a.rank.area.name !== b.rank.area.name) q.push(t('rank.q.area', { a: a.rank.area.name, b: b.rank.area.name }));
    if (a.rating != null && b.rating != null && Math.abs(a.rating - b.rating) >= 0.15) q.push(t('rank.q.rating', { d: sepNum(Math.abs(a.rating - b.rating), 2) }));
    if (a.bedrooms != null && b.bedrooms != null && a.bedrooms !== b.bedrooms) q.push(t('rank.q.bedrooms', { max: Math.max(a.bedrooms, b.bedrooms), min: Math.min(a.bedrooms, b.bedrooms) }));
    return q.slice(0, 2);
  }

  root.StayMatchRank = {
    rankListings, cleanTweak, applyPriceFixes, scoreListing, areaFor, ratingScore, priceScore, bedScore, tasteScore, WEIGHTS, WISHES, wishScore, luxuryInfo, reviewConflicts, REVIEW_WISHES,
    weightsFor, buildTaste, effectiveBudget, feeShareOf, realSleeps, decisionQuestions, resolvePeople, tripTotal, perNight, weightedRecentRating, fakeReviewHint, filterListings, compareRows, shareText, normalizePrices, normCur, money, isTrusted, badgeLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
