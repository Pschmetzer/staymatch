// StayMatch – liest Unterkünfte aus der Airbnb-Suchseite, die du geöffnet hast.
// Reine Funktionen ohne chrome.*, damit sie sich direkt in einem Tab testen lassen.
// Alles, was nur auf der echten Airbnb-Seite prüfbar ist, ist mit „ungeprüft live“ markiert.
(function (root) {
  const ROOM_RE = /\/rooms\/(?:[a-z]+\/)?(\d+)/;

  // Zahl: "1.234", "1 234", "12,50", "702"
  const AMT = '(?:\\d{1,3}(?:[.,\\u00a0\\u202f\\u2009 ]\\d{3})+|\\d+)(?:[.,]\\d{1,2})?';
  // Währungen; Dollar-Arten zuerst, damit "US$" nicht als "$" zählt. Wortgrenze per Lookahead (\b geht bei "ł" nicht).
  const CUR = '(?:US\\$|CA\\$|AU\\$|NZ\\$|MX\\$|R\\$|A\\$|C\\$|€|CHF|£|¥|₹|\\$|zł|PLN|Kč|CZK|Ft|HUF|SEK|NOK|DKK|RON|lei|kr)(?![A-Za-z])';
  const CUR_RE = new RegExp(CUR);
  const AMT_CUR = new RegExp(`(${AMT})\\s*(${CUR})|(${CUR})\\s*(${AMT})`);
  // Wörter, die einen Gesamtpreis (statt Preis pro Nacht) anzeigen. Ungeprüft live: welche Wörter Airbnb je Sprache nutzt.
  const TOTAL_RE = /gesamt|insgesamt|total|totaal|totalt|totale|łącznie|razem|celkem|samlet|i alt|yhteensä|összesen|toplam|σύνολο|συνολικ/i;

  const NIGHT_RE = /pro nacht|per night|par nuit|por noche|por noite|a notte|per nacht|za noc|na noc|natt\b|pr\.? nat\b|per nat\b|\/ ?nat\b|\/ ?yö\b|gecelik|gece başına|ανά βράδυ|ανά νύχτα/i;

  function toNumber(s) {
    const m = String(s).match(new RegExp(`^(\\d{1,3}(?:[.,\\u00a0\\u202f\\u2009 ]\\d{3})+|\\d+)(?:[.,](\\d{1,2}))?$`));
    if (!m) return null;
    return +(m[1].replace(/[.,    ]/g, '') + (m[2] ? '.' + m[2] : ''));
  }

  function num(s) {
    // Betrag direkt am Währungszeichen: "4 Nächte: 702 €" → 702, "702 € Gesamtpreis, ursprünglich 896 €" → 702.
    // Ohne Währungszeichen: erste Zahl.
    const str = String(s || '');
    const c = str.match(AMT_CUR);
    if (c) return toNumber(c[1] || c[4]);
    const m = str.match(new RegExp(`(${AMT})`));
    return m ? toNumber(m[1]) : null;
  }

  function currency(s) {
    const str = String(s || '');
    const c = str.match(AMT_CUR);
    if (c) return c[2] || c[3];
    const m = str.match(CUR_RE);
    return m ? m[0] : null;
  }

  const REVIEW_WORD = '(?:Bewertung|review|avis|opini|reseña|recensi|beoordel|ocen|recenz|anmeld|arvost|avalia|αξιολόγ|κριτικ|değerlendir|yorum|omdöm|vurder)';
  function rating(s) {
    // "4,59 (800)" | "4,9 · 12 Bewertungen" | "4.9 (12 reviews)" | "4,92 (1 234)" (NBSP) | "Neu" | undefined
    const str = String(s || '');
    let m = str.match(/(\d)[.,](\d{1,2})\s*\((\d[\d.,    ]*)(?:\s*[A-Za-zÀ-ÿ]+)?\)/);
    if (!m) m = str.match(new RegExp(`(\\d)[.,](\\d{1,2})\\s*(?:[·•|,–-]\\s*)?(\\d[\\d.,\\u00a0\\u202f\\u2009 ]*)\\s*${REVIEW_WORD}`, 'i'));
    return m ? { value: +(m[1] + '.' + m[2]), count: +m[3].replace(/\D/g, '') } : { value: null, count: null };
  }
  // R5-84: Sterne aus dem aria-label („4,92 von 5 Sternen“), wenn die Textzeile nicht lesbar war
  function ratingFromAria(s) {
    const m = String(s || '').match(/(\d)[.,](\d{1,2})\s*(?:von|out of|sur|de|su|van|z|av|af|\/)\s*5/i);
    return m ? +(m[1] + '.' + m[2]) : null;
  }
  // R5-85: „Neu“ ist etwas anderes als „nicht gelesen“
  const isNewLabel = s => /^\s*(?:neu|new|nouveau|nuevo|nuovo|nieuw|novo|nowy|ny|uusi|yeni|νέο)\s*$/i.test(String(s || ''));
  // R5-81: „Nicht verfügbar“ ist kein Mehrfachangebot
  const NOT_AVAIL = /nicht verfügbar|not available|unavailable|indisponible|no disponible|non disponibile|niet beschikbaar|indisponível|niedostępn\w*|ikke tilgængelig/gi;
  const isMultiUnit = t => /verfügbar|available|disponible|beschikbaar|disponibile|disponível|dostępn\w*/i.test(String(t || '').replace(NOT_AVAIL, ''));
  // R5-95: Badge-Art vereinheitlichen, egal in welcher Sprache Airbnb den Text liefert
  const FAV_RE = /Gäste-?Favorit|Guest favou?rite|Coup de c(?:œ|oe)ur|Préféré des voyageurs|Preferito dagli ospiti|Gasten-?favoriet|Favorito (?:dos hóspedes|entre huéspedes)|Ulubione/i;
  function normBadge(b) {
    const t = b?.loggingContext?.badgeType, txt = b?.text || '';
    if (/GUEST_FAVOU?RITE/i.test(t || '') || FAV_RE.test(txt)) return 'Gäste-Favorit';
    if (/SUPERHOST/i.test(t || '') || /superhost|superanfitri/i.test(txt)) return 'Superhost';
    return txt || null;
  }
  // R5-97: nur echte Bild-Adressen speichern, keine Platzhalter oder Data-URIs
  const safeImage = u => (typeof u === 'string' && /^https:\/\//i.test(u) && u.length < 500) ? u : null;
  // R5-80: bei Rabatten steht der durchgestrichene Preis vor dem aktuellen („896 € 702 €“): der niedrigere, spätere gilt
  function priceOf(line) {
    const str = String(line || '');
    const all = [...str.matchAll(new RegExp(`(${AMT})\\s*(${CUR})|(${CUR})\\s*(${AMT})`, 'g'))].map(m => ({ v: toNumber(m[1] || m[4]), c: m[2] || m[3], i: m.index, e: m.index + m[0].length }));
    if (all.length >= 2 && !/urspr|originally|before|avant|antes|prima|oorspr|dawniej|pierwotnie|tidigare/i.test(str)) {
      const [a, b] = all;
      if (a.c === b.c && a.v > b.v && /^[\s ·•|,;/-]*$/.test(str.slice(a.e, b.i))) return { amount: b.v, currency: b.c, discounted: true };
    }
    return { amount: num(str), currency: currency(str), discounted: false };
  }

  // Schlafplätze je Bettart (Doppelbett = 2, Schlafsofa = 1 vorsichtig, Etagenbett = 2).
  // Ungeprüft live: wie Airbnb die Betten in der Karte schreibt.
  const BED_KINDS = [
    { re: /(\d+)\s*(?:Doppelbett(?:en)?|(?:Queen|King)[- ]?size[- ]?Bett(?:en)?|double beds?|queen(?:-size)?(?: beds?)?|king(?:-size)?(?: beds?)?|lits? doubles?|camas? (?:dobles?|matrimoniales?)|letti? matrimoniali?|camas? de casal|dubbelbedden?|łóżk\w* podwójn\w*|dobbeltseng\w*|dubbelsäng\w*)/gi, per: 2 },
    { re: /(\d+)\s*(?:Einzelbett(?:en)?|single beds?|lits? simples?|camas? individuales?|letti? singol[io]|camas? de solteiro|eenpersoonsbedden?|łóżk\w* pojedyncz\w*|enkeltseng\w*|enkelsäng\w*)/gi, per: 1 },
    { re: /(\d+)\s*(?:Schlafsofas?|Sofabett(?:en)?|sofa beds?|couch(?:es)?|canapés?-lits?|sofás? cama)/gi, per: 1 },
    { re: /(\d+)\s*(?:Etagenbett(?:en)?|bunk beds?|lits? superposés?|literas?|letti? a castello)/gi, per: 2 },
  ];
  // R5-87: Kinderbetten zählen weder als Bett noch als Schlafplatz für Erwachsene
  const CRIB_RE = /(\d+)\s*(?:Kinderbett(?:en)?|Babybett(?:en)?|Reisebett(?:en)?|cribs?|baby cots?|cots?|lits? bébé|lits? parapluie|cunas?|culle?)/gi;

  function details(lines) {
    const t = lines.join(' | ').replace(CRIB_RE, '');
    const g = re => { const m = t.match(re); return m ? +m[1] : null; };
    // R5-86: auch „1 gemeinsames Bad“, „1 Privatbad“, „1 shared bath“ und weitere Sprachen
    const bath = t.match(/(\d+(?:[.,]5)?)\s*(?:[\p{L}-]+\s+)?(?:Badezimmer|Bäder|Privatbad|Bad|baths?|bathrooms?|salles? de bains?|salle d'eau|baños?|bagni|bagno|badkamers?|banheiros?|banhos?|łazienk\w*|badeværelser?|badrum|badrom|kylpyhuone\w*|μπάνι\w*|koupeln\w*|banyo)(?![\p{L}])/iu);
    let beds = g(/(\d+)\s*(?:Betten|Bett|beds?|lits?|camas?|letti|letto|bedden|bed|łóżka|łóżko|łóżek|sängar|säng|senge|seng|vuodetta|vuode|κρεβάτια|κρεβάτι|postele|postel|yatak)(?![\p{L}])/iu);
    if (beds == null) { // nur typisierte Betten ("2 Doppelbetten")
      let n = 0, any = false;
      for (const k of BED_KINDS) for (const m of t.matchAll(k.re)) { n += +m[1]; any = true; }
      beds = any ? n : null;
    }
    return {
      bedrooms: g(/(\d+)\s*(?:Schlafzimmer|bedrooms?|chambres?|dormitorios?|habitaciones|camere|slaapkamers?|quartos?|sypialni\w*|soveværelser?|sovrum|soverom|makuuhuonetta|makuuhuone\w*|υπνοδωμάτι\w*|ložnic\w*|yatak odası)/i),
      beds,
      baths: bath ? +bath[1].replace(',', '.') : null,
      pro: /gewerblich|professional host|hôte professionnel|anfitrión profesional/i.test(t),
    };
  }

  // Erweiterte Angaben (eigene Funktion, damit die Form von details() unverändert bleibt)
  function detailsExt(lines) {
    const t = lines.join(' | ').replace(CRIB_RE, '');
    let sleeps = 0, typed = false;
    for (const k of BED_KINDS) for (const m of t.matchAll(k.re)) { sleeps += k.per * +m[1]; typed = true; }
    return { sleeps: typed ? sleeps : null };
  }

  // "Ferienwohnung in Gràcia" → "Gràcia"; nimmt die LETZTE Präposition ("Zimmer im Zentrum in Rom" → "Rom")
  function localityFromTitle(kind) {
    // R5-88: „Wohnung in Gràcia, Barcelona“ → „Gràcia“ (erster Teil vor dem Komma)
    const m = String(kind || '').match(/^.*(?:^|\s)(?:in|im|à|en|a|i|em|ad|bei|dans|nel|nella)\s+(.+?)\s*$/i);
    return m ? m[1].split(',')[0].trim() || null : null;
  }

  // 1) Daten, die Airbnb beim ersten Laden in die Seite schreibt.
  // Der Zustand ist nach Blättern/Kartenverschieben VERALTET (ungeprüft live); parseSearch nutzt ihn deshalb nur
  // für Felder, die DOM nicht liefert (Koordinaten, Details), und Preise kommen vom DOM.
  // JSON nur neu parsen, wenn sich der textContent ändert.
  const stateCache = { text: null, results: [] };
  // R5-89: kein fester Pfad; rekursiv nach „staysSearch“ suchen, in allen data-deferred-state-Blöcken
  function findKey(o, key, depth = 0) {
    if (!o || typeof o !== 'object' || depth > 10) return null;
    if (o[key] && typeof o[key] === 'object') return o[key];
    for (const v of Array.isArray(o) ? o : Object.values(o)) { const r = findKey(v, key, depth + 1); if (r) return r; }
    return null;
  }
  function stateEls(doc) {
    const list = [...(doc.querySelectorAll?.('script[id^="data-deferred-state"]') || [])].filter(e => typeof e?.textContent === 'string');
    if (list.length) return list;
    const one = doc.getElementById?.('data-deferred-state-0');
    return one ? [one] : [];
  }
  function stateResults(doc) {
    const els = stateEls(doc);
    if (!els.length) return [];
    const text = els.map(e => e.textContent).join('\u0001');
    if (text === stateCache.text) return stateCache.results;
    let results = [];
    for (const e of els) {
      try {
        const ss = findKey(JSON.parse(e.textContent), 'staysSearch');
        const r = ss?.results?.searchResults;
        if (Array.isArray(r) && r.length) { results = r; break; }
      } catch {}
    }
    stateCache.text = text; stateCache.results = results;
    return results;
  }
  // R5-90: Base64URL und fehlendes Padding verkraften
  function decodeId(s) {
    try {
      let b = String(s || '').replace(/-/g, '+').replace(/_/g, '/');
      while (b.length % 4) b += '=';
      return atob(b).split(':')[1] || null;
    } catch { return null; }
  }

  function fromState(doc) {
    return stateResults(doc).map(r => {
      const id = decodeId(r.demandStayListing?.id);
      const lines = [...(r.structuredContent?.primaryLine || []), ...(r.structuredContent?.secondaryLine || [])].map(x => x.body).filter(Boolean);
      const pl = r.structuredDisplayPrice?.primaryLine || {};
      const priceLabel = pl.accessibilityLabel || '';
      // R5-80: bei Rabatt gilt discountedPrice, sonst der Betrag aus dem Beschreibungstext
      const disc = pl.discountedPrice ? priceOf(pl.discountedPrice) : null;
      const px = disc && disc.amount != null ? disc : priceOf(priceLabel);
      const coord = r.demandStayListing?.location?.coordinate;
      const rt = rating(r.avgRatingLocalized);
      return {
        id, propertyId: r.propertyId || null,
        title: r.nameLocalized?.localizedStringWithTranslationPreference || r.subtitle || r.title || '',
        kind: r.title || '', locality: r.eyebrowLocation || null,
        rating: rt.value, reviewCount: rt.count, isNew: rt.value == null && isNewLabel(r.avgRatingLocalized),
        totalPrice: px.amount, currency: px.currency || currency(priceLabel),
        isTotal: TOTAL_RE.test(priceLabel), priceWord: TOTAL_RE.test(priceLabel) || NIGHT_RE.test(priceLabel),
        lat: coord?.latitude ?? null, lon: coord?.longitude ?? null,
        multiUnit: lines.some(isMultiUnit),
        ...details(lines), ...detailsExt(lines),
        badges: [...new Set((r.badges || []).map(normBadge).filter(Boolean))],
        image: safeImage(r.contextualPictures?.[0]?.picture),
        source: 'state',
      };
    });
  }

  // 2) Karten im DOM (nach Blättern oder Karte verschieben ist der State veraltet)
  function fromCards(doc) {
    return [...doc.querySelectorAll('[data-testid="card-container"]')].map(card => {
      const a = card.querySelector('a[href*="/rooms/"]');
      const id = a?.getAttribute('href')?.match(ROOM_RE)?.[1] || null;
      const txt = card.innerText || '';
      const lines = txt.split('\n').map(s => s.trim()).filter(Boolean);
      const priceLine = card.querySelector('[data-testid="price-availability-row"]')?.innerText || lines.find(l => CUR_RE.test(l) && /\d/.test(l)) || '';
      let rt = rating(lines.find(l => /^\d[.,]\d{1,2}\s*(?:\(|·|•|[|,–-]\s*\d)/.test(l)));
      // R5-84: Fallback über das aria-label der Sterne; R5-85: „Neu“ getrennt von „nicht gelesen“
      if (rt.value == null) {
        const aria = [...(card.querySelectorAll?.('[aria-label]') || [])].map(e => ratingFromAria(e.getAttribute('aria-label'))).find(v => v != null);
        if (aria != null) rt = { value: aria, count: null };
      }
      const isNew = rt.value == null && lines.some(isNewLabel);
      const px = priceOf(priceLine);
      const kind = card.querySelector('[data-testid="listing-card-title"]')?.innerText || '';
      return {
        id, title: card.querySelector('[data-testid="listing-card-name"]')?.innerText || card.querySelector('[data-testid="listing-card-subtitle"]')?.innerText || kind,
        kind, locality: localityFromTitle(kind),
        rating: rt.value, reviewCount: rt.count, isNew,
        totalPrice: px.amount, currency: px.currency, isTotal: TOTAL_RE.test(priceLine), priceWord: TOTAL_RE.test(priceLine) || NIGHT_RE.test(priceLine),
        lat: null, lon: null, multiUnit: isMultiUnit(txt),
        ...details(lines), ...detailsExt(lines), badges: [FAV_RE.test(txt) && 'Gäste-Favorit', /Superhost|Superanfitri/i.test(txt) && 'Superhost'].filter(Boolean),
        image: safeImage(card.querySelector('img')?.src), source: 'dom',
      };
    }).filter(x => x.id);
  }

  const PRICE_KEYS = ['totalPrice', 'currency', 'isTotal', 'priceWord'];
  // Zusammenführen: State liefert Koordinaten/Details, DOM sagt, was gerade sichtbar ist.
  // Preis: Stimmt der DOM-Betrag mit dem State überein, gilt der State (er kennt "Gesamtpreis" sicher).
  // Weicht er ab (State veraltet, z. B. Seite 2 oder anderer Zeitraum), gilt der DOM-Betrag; "gesamt" nur,
  // wenn die Zeile selbst ein Gesamt- oder Nacht-Wort enthält, sonst bleibt die Einheit des States.
  // Ungeprüft live: ob die sichtbare Preiszeile überhaupt "gesamt" enthält.
  function parseSearch(doc) {
    const state = fromState(doc), cards = fromCards(doc);
    const byId = new Map();
    for (const s of state) { if (s.id) byId.set(s.id, s); if (s.propertyId) byId.set(s.propertyId, s); }
    const out = [];
    for (const c of cards) {
      const s = byId.get(c.id);
      if (!s) { out.push(c); continue; }
      const stale = c.totalPrice != null && s.totalPrice != null && c.totalPrice !== s.totalPrice;
      const skip = stale || (c.totalPrice != null && s.totalPrice == null) ? PRICE_KEYS : [];
      const fromS = Object.fromEntries(Object.entries(s).filter(([k, v]) => v != null && v !== '' && !skip.includes(k)));
      const merged = { ...c, ...fromS, id: c.id, source: 'state+dom', coordsMissing: s.lat == null || s.lon == null, priceFromDom: stale };
      if (stale && !c.priceWord) merged.isTotal = s.isTotal;
      // R5-98: DOM-Preis noch nicht da → der State-Preis kann nach Datumswechsel veraltet sein
      if (c.totalPrice == null && s.totalPrice != null) merged.priceStale = true;
      // R5-85: „Neu“ gilt nur, wenn keiner der beiden Wege eine Note fand
      merged.isNew = merged.rating == null && !!(c.isNew || s.isNew);
      out.push(merged);
    }
    // Sicherheitsnetz: falls keine Karten gefunden wurden, nur State
    return out.length ? out : state.filter(s => s.id);
  }

  // Selbstdiagnose: Warum haben wir (nichts) gefunden? Liefert nur Zahlen und Stichworte, keine Seiteninhalte.
  function diagnose(doc) {
    const d = { stateFound: false, stateCount: 0, stateNote: 'fehlt', cards: 0, roomLinks: 0 };
    const els = stateEls(doc);
    if (els.length) {
      d.stateNote = 'kein gültiges JSON';
      for (const el of els) {
        try {
          const ss = findKey(JSON.parse(el.textContent), 'staysSearch');
          if (ss?.results?.searchResults) { d.stateFound = true; d.stateCount = ss.results.searchResults.length; d.stateNote = 'ok'; break; }
          d.stateNote = 'Struktur anders als erwartet';
        } catch {}
      }
    }
    d.cards = doc.querySelectorAll('[data-testid="card-container"]').length;
    d.roomLinks = new Set([...doc.querySelectorAll('a[href*="/rooms/"]')].map(a => a.getAttribute('href')?.match(ROOM_RE)?.[1]).filter(Boolean)).size;
    return d;
  }
  // Wie vollständig war das Gelesene? (Airbnb ändert gern einzelne Felder)
  function quality(listings) {
    const n = listings.length;
    const miss = f => listings.filter(l => l[f] == null).length;
    return { n, noPrice: miss('totalPrice'), noRating: miss('rating'), noBeds: listings.filter(l => l.beds == null && l.bedrooms == null).length };
  }
  function diagnosisText(d) {
    if (d.cards === 0 && d.roomLinks > 0) return 'Es gibt Links zu Unterkünften, aber keine Karten im bekannten Format. Airbnb hat den Seitenaufbau vermutlich geändert.';
    if (d.cards === 0 && d.stateCount > 0) return 'Airbnb hat Daten geladen, aber die Karten sind nicht im bekannten Format. Seitenaufbau vermutlich geändert.';
    if (d.cards === 0) return 'Keine Unterkünfte gefunden. Vielleicht lädt die Seite noch, die Suche hat keine Treffer, oder der Seitenaufbau ist neu.';
    return 'Karten gefunden, aber keine Unterkunfts-Nummer lesbar. Die Link-Form hat sich vermutlich geändert.';
  }

  function searchParams(url) {
    const q = new URL(url).searchParams;
    const ci = q.get('checkin') || q.get('check_in'), co = q.get('checkout') || q.get('check_out');
    // R5-91: ungültiges Datum ergibt null statt NaN
    const raw = ci && co ? Math.round((new Date(co) - new Date(ci)) / 864e5) : null;
    const nights = raw != null && isFinite(raw) ? Math.max(0, raw) : null;
    const n = k => +(q.get(k) || 0) || null;
    // R5-92: flexible Daten und Monatsmiete: Preise sind dann nicht je Nacht vergleichbar
    const flexible = !!(q.get('date_picker_type') === 'flexible_dates' || q.getAll('flexible_trip_lengths[]').length || q.get('monthly_length') || q.get('monthly_start_date'));
    return { checkin: ci, checkout: co, nights, adults: n('adults'), children: n('children'), infants: n('infants'), pets: n('pets'), flexible };
  }

  // ---- Nr. 6: Sammeln über mehrere Seiten ----
  const PAGING = new Set(['items_offset', 'section_offset', 'pagination_search', 'cursor', 'page', 'federated_search_id', 'tab_id', 'search_type', 'source', 'search_mode', 'screen_size',
    'zoom', 'zoom_level', 'search_by_map', 'map_toggle', 'ne_lat', 'ne_lng', 'sw_lat', 'sw_lng', 'bbox', 'search_mode', '_set_bev_on_new_domain']);
  // Gleiche Suche = gleicher Pfad + gleiche Filter, ohne Seiten- und Kartenparameter
  function searchKey(url) {
    let u; try { u = new URL(url); } catch { return ''; }
    const kv = [...u.searchParams.entries()].filter(([k]) => !PAGING.has(k) && !/^utm_/.test(k)).map(([k, v]) => `${k}=${v}`).sort();
    return u.pathname.replace(/\/+$/, '') + '?' + kv.join('&');
  }
  // prev: {key, items} | null. Andere Suche → neu beginnen. Doppelte Ids werden zusammengelegt (neuer Wert gewinnt, vorhandene Koordinaten bleiben).
  function mergeSearchResults(prev, next, key) {
    const base = prev && prev.key === key ? prev.items : [];
    const map = new Map(base.map(x => [x.id, x]));
    let added = 0;
    for (const n of next || []) {
      if (!n?.id) continue;
      const o = map.get(n.id);
      if (!o) added++;
      map.set(n.id, o ? { ...o, ...Object.fromEntries(Object.entries(n).filter(([, v]) => v != null && v !== '')) } : n);
    }
    return { key, items: [...map.values()], added, reset: !!prev && prev.key !== key };
  }

  // ---- Textfunktionen für die Unterkunftsseite (reiner Text rein, Befund raus) ----
  const has = (t, re) => re.test(t);

  // Nr. 186/408 Hausregeln
  function houseRules(text) {
    const t = String(text || '');
    const q = t.match(/(?:ruhezeit(?:en)?|quiet hours|heures? de silence|horas? de silencio|ore di silenzio)[^0-9]{0,20}(\d{1,2})[:.]?(\d{2})?\s*(?:uhr|h|pm|am)?\s*(?:-|–|bis|to|and|y|à|a|et|e)\s*(\d{1,2})[:.]?(\d{2})?/i);
    return {
      noParties: has(t, /keine?\s+(?:partys?|feiern|veranstaltungen)|no (?:parties|events)|pas de (?:fêtes|soirées)|no (?:se permiten )?fiestas|vietato far feste/i),
      quietHours: q ? { from: +q[1], to: +q[3] } : has(t, /ruhezeit|quiet hours|heures de silence|horas de silencio|ore di silenzio/i) ? true : false,
      noSmoking: has(t, /nichtraucher|rauchen (?:ist )?(?:verboten|nicht erlaubt)|no smoking|non[- ]fumeur|prohibido fumar|vietato fumare/i),
      noPets: has(t, /keine haustiere|haustiere (?:sind )?nicht erlaubt|no pets|animaux non admis|no se admiten mascotas|animali non ammessi/i),
      petsAllowed: has(t, /haustiere (?:sind )?(?:erlaubt|willkommen)|pets allowed|animaux admis|se admiten mascotas|animali ammessi/i),
    };
  }

  // Nr. 182 Ausstattung
  const AMENITIES = {
    wifi: /w-?lan|wifi|wi-fi|internet/i,
    kitchen: /küche|kitchen|cuisine|cocina|cucina/i,
    ac: /klimaanlage|air conditioning|climatisation|aire acondicionado|aria condizionata|\bAC\b/i,
    parking: /parkplatz|parking|stellplatz|garage|aparcamiento|parcheggio/i,
    pool: /\bpool\b|schwimmbad|piscine|piscina|swimming/i,
    washer: /waschmaschine|washer|washing machine|lave-linge|lavadora|lavatrice/i,
    heating: /heizung|heating|chauffage|calefacción|riscaldamento/i,
    elevator: /aufzug|fahrstuhl|elevator|lift|ascenseur|ascensor|ascensore/i,
  };
  function amenities(text) {
    const t = String(text || ''), out = {};
    for (const [k, re] of Object.entries(AMENITIES)) out[k] = re.test(t);
    return out;
  }

  // Nr. 185/409 Stornobedingung
  function cancellation(text) {
    const t = String(text || '');
    if (/nicht erstattungsfähig|non[- ]?refundable|non remboursable|no reembolsable|non rimborsabile/i.test(t)) return { kind: 'nonrefundable', until: null };
    const free = t.match(/(?:kostenlos(?:e)? stornier\w*|free cancell?ation|annulation gratuite|cancelación gratuita|cancellazione gratuita)[^.\n]{0,30}?(?:bis|before|until|avant|antes del?|entro)\s+(\d{1,2}\.?\s+[A-Za-zäéû]+|[A-Za-zäéû]+\s+\d{1,2}|\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?)/i);
    if (free) return { kind: 'free', until: free[1].trim() };
    if (/kostenlos(?:e)? stornier|free cancell?ation|annulation gratuite|cancelación gratuita|cancellazione gratuita/i.test(t)) return { kind: 'free', until: null };
    if (/\bstreng\b|\bstrict\b|\bstricte\b|\bestricta\b|\brigida\b/i.test(t)) return { kind: 'strict', until: null };
    return { kind: null, until: null };
  }

  // Nr. 187 Gastgeber-Infos
  function hostInfo(text) {
    const t = String(text || '');
    const g = re => { const m = t.match(re); return m ? m[1] : null; };
    return {
      superhost: /superhost/i.test(t),
      since: g(/(?:gastgeber(?:in)? seit|hosting since|hôte depuis|anfitrión desde)\s+(?:[A-Za-zäöü]+\s+)?(\d{4})/i),
      years: (g(/(\d+)\s*(?:jahre?|years?|ans|años)\s*(?:als )?(?:gastgeber|hosting|d'hébergement|anfitrión)/i) || null),
      responseRate: g(/(?:antwortrate|response rate|taux de réponse|tasa de respuesta)[:\s]*(\d{1,3})\s*%/i),
      responseTime: /innerhalb (?:von )?(?:einer|1) stunde|within an hour|dans l'heure|en una hora/i.test(t) ? 'hour' : /innerhalb (?:eines )?tages?|within a day|dans la journée|en un día/i.test(t) ? 'day' : null,
      verified: /identität verifiziert|identity verified|identité vérifiée|identidad verificada/i.test(t),
    };
  }

  // Nr. 291 Betrugsmuster: nur Hinweise, KEIN Beweis (ungeprüft live: wo solcher Text auf der Seite steht)
  const SCAM = [
    [/\bwhatsapp\b|\btelegram\b|\bsignal[- ]?(?:app|messenger)\b|\b(?:per|via|über|auf|on|by|through)\s+signal\b/i, 'Kontakt außerhalb der Plattform (Messenger) erwähnt'],
    [/(?:außerhalb|ausserhalb) (?:von )?airbnb|outside (?:of )?airbnb|hors d'airbnb|fuera de airbnb/i, 'Zahlung oder Kontakt „außerhalb von Airbnb“ erwähnt'],
    [/western union|moneygram|bitcoin|krypto|crypto|gift ?card|geschenkkarte/i, 'ungewöhnliche Zahlungsart erwähnt'],
    [/(?:iban|überweisung|bank transfer|virement)[^.\n]{0,40}(?:direkt|direct|vorab|upfront|im voraus)/i, 'Vorabüberweisung direkt an den Gastgeber erwähnt'],
    [/nur (?:heute|jetzt) (?:zum )?(?:buchen|reservieren)|book (?:now|today) (?:only|or lose)|last chance.*(?:pay|deposit)/i, 'starker Zeitdruck im Text'],
  ];
  function scamSignals(text) {
    const t = String(text || '');
    return SCAM.filter(([re]) => re.test(t)).map(([, msg]) => msg);
  }

  // Nr. 293 Touristensteuer
  function touristTax(text) {
    const t = String(text || '');
    const m = t.match(/(?:touristensteuer|kurtaxe|ortstaxe|city tax|tourist tax|occupancy tax|taxe de séjour|tasa turística|impuesto turístico|imposta di soggiorno|tassa di soggiorno|toeristenbelasting)[^.\n]{0,80}/i);
    const excluded = /(?:zzgl|exkl|plus|excl|not included|nicht (?:im preis )?enthalten|à payer sur place|a pagar en destino)[^.\n]{0,40}(?:steuer|tax|taxe|tasa|imposta)/i.test(t);
    return { mentioned: !!m, text: m ? m[0].trim() : null, extraOnSite: excluded };
  }

  root.StayMatchParse = {
    ratingFromAria, isNewLabel, isMultiUnit, normBadge, priceOf, decodeId, findKey,
    diagnose, quality, diagnosisText, parseSearch, fromState, fromCards, searchParams, num, currency, rating, details, detailsExt, localityFromTitle, ROOM_RE,
    searchKey, mergeSearchResults, houseRules, amenities, cancellation, hostInfo, scamSignals, touristTax, TOTAL_RE,
  };
})(typeof window !== 'undefined' ? window : globalThis);
