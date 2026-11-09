// StayMatch – liest Unterkünfte aus der Airbnb-Suchseite, die du geöffnet hast.
// Reine Funktionen ohne chrome.*, damit sie sich direkt in einem Tab testen lassen.
(function (root) {
  const ROOM_RE = /\/rooms\/(?:[a-z]+\/)?(\d+)/;
  // "Gesamtpreis", "total", "totale", "totaal", "łącznie", "insgesamt", "au total"
  const TOTAL_RE = /gesamt|total|totaal|łącznie|i alt|totalt|yhteensä/i;

  function num(s) {
    // erster Betrag: "1.234 €", "702 € Gesamtpreis, ursprünglich 896 €", "€1,234"
    const m = String(s || '').match(/(\d{1,3}(?:[.,   ]\d{3})+|\d+)(?:[.,](\d{1,2}))?/);
    if (!m) return null;
    return +(m[1].replace(/[.,   ]/g, '') + (m[2] ? '.' + m[2] : ''));
  }

  function currency(s) {
    const m = String(s || '').match(/€|CHF|£|\$|zł|kr/);
    return m ? m[0] : null;
  }

  function rating(s) {
    // "4,59 (800)" | "4.59 (800)" | "Neu" | undefined
    const m = String(s || '').match(/(\d)[.,](\d{1,2})\s*\((\d[\d.,]*)\)/);
    return m ? { value: +(m[1] + '.' + m[2]), count: +m[3].replace(/[.,]/g, '') } : { value: null, count: null };
  }

  function details(lines) {
    const t = lines.join(' | ');
    const g = re => { const m = t.match(re); return m ? +m[1].replace(',', '.') : null; };
    return {
      bedrooms: g(/(\d+)\s*(?:Schlafzimmer|bedrooms?|dormitorios?|habitaci[oó]n(?:es)?|chambres?|camer[ae](?: da letto)?|quartos?|slaapkamers?|sypialni\w*)/i),
      // "2 Betten", "2 Doppelbetten", "1 Schlafsofa", "Stockbett", "3 camas", "2 lits", "2 letti", "2 bedden"
      beds: g(/(\d+)\s*(?:[a-zäöü]*bett(?:en)?|schlafsofas?|(?:sofa |double |single |bunk )?beds?|camas?|lits?|lett[oi]|bedden?|łóżk\w*)(?![a-z])/i),
      baths: g(/(\d+(?:[.,]5)?)\s*(?:Badezimmer|Bäder|Bad|baths?|bathrooms?|baños?|salles? de bain|bagni|bagno|casas? de banho|badkamers?)/i),
      pro: /gewerblich|professional host/i.test(t),
    };
  }

  // 1) Daten, die Airbnb beim ersten Laden in die Seite schreibt
  function fromState(doc) {
    const el = doc.getElementById('data-deferred-state-0');
    if (!el) return [];
    let results = [];
    try {
      const j = JSON.parse(el.textContent);
      const ss = j?.niobeClientData?.[0]?.[1]?.data?.presentation?.staysSearch;
      results = ss?.results?.searchResults || [];
    } catch { return []; }
    return results.map(r => {
      let id = null;
      try { id = atob(r.demandStayListing?.id || '').split(':')[1] || null; } catch {}
      const lines = [...(r.structuredContent?.primaryLine || []), ...(r.structuredContent?.secondaryLine || [])].map(x => x.body).filter(Boolean);
      const priceLabel = r.structuredDisplayPrice?.primaryLine?.accessibilityLabel || '';
      const coord = r.demandStayListing?.location?.coordinate;
      const rt = rating(r.avgRatingLocalized);
      return {
        id, propertyId: r.propertyId || null,
        title: r.nameLocalized?.localizedStringWithTranslationPreference || r.subtitle || r.title || '',
        kind: r.title || '', locality: r.eyebrowLocation || null,
        rating: rt.value, reviewCount: rt.count,
        totalPrice: num(priceLabel), currency: currency(priceLabel),
        isTotal: TOTAL_RE.test(priceLabel),
        lat: coord?.latitude ?? null, lon: coord?.longitude ?? null,
        multiUnit: lines.some(l => /\d+\s*(?:Unterkünfte|Einheiten|units?|listings?)\b.*(?:verfügbar|available)/i.test(l)),
        ...details(lines),
        badges: (r.badges || []).map(b => b.text || b.loggingContext?.badgeType).filter(Boolean),
        image: r.contextualPictures?.[0]?.picture || null,
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
      const priceLine = card.querySelector('[data-testid="price-availability-row"]')?.innerText || lines.find(l => /€|\$|£|CHF/.test(l)) || '';
      const rt = rating(lines.find(l => /^\d[.,]\d{1,2}\s*\(/.test(l)));
      const kind = card.querySelector('[data-testid="listing-card-title"]')?.innerText || '';
      return {
        id, title: card.querySelector('[data-testid="listing-card-name"]')?.innerText || card.querySelector('[data-testid="listing-card-subtitle"]')?.innerText || kind,
        kind, locality: (kind.match(/^.*(?:^|\s)(?:in|im|en|à|em|w)\s+(.+)$/) || [])[1] || null,
        rating: rt.value, reviewCount: rt.count,
        totalPrice: num(priceLine), currency: currency(priceLine), isTotal: TOTAL_RE.test(priceLine),
        lat: null, lon: null, multiUnit: /\d+\s*(?:Unterkünfte|Einheiten|units?|listings?)\b.*(?:verfügbar|available)/i.test(txt),
        ...details(lines), badges: [/Gäste-Favorit|Guest favorite/i.test(txt) && 'Gäste-Favorit', /Superhost/i.test(txt) && 'Superhost'].filter(Boolean),
        image: card.querySelector('img')?.src || null, source: 'dom',
      };
    }).filter(x => x.id);
  }

  // Zusammenführen: State liefert Koordinaten, DOM sagt, was gerade sichtbar ist
  function parseSearch(doc) {
    const state = fromState(doc), cards = fromCards(doc);
    const byId = new Map();
    for (const s of state) { if (s.id) byId.set(s.id, s); if (s.propertyId) byId.set(s.propertyId, s); }
    const out = [];
    for (const c of cards) {
      const s = byId.get(c.id);
      out.push(s ? { ...c, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v != null && v !== '')), id: c.id, source: 'state+dom' } : c);
    }
    // Sicherheitsnetz: falls keine Karten gefunden wurden, nur State
    return out.length ? out : state.filter(s => s.id);
  }

  function searchParams(url) {
    const q = new URL(url).searchParams;
    const ci = q.get('checkin') || q.get('check_in'), co = q.get('checkout') || q.get('check_out');
    const nights = ci && co ? Math.max(0, Math.round((new Date(co) - new Date(ci)) / 864e5)) : null;
    // Kinder brauchen auch ein Bett, Kleinkinder (infants) meist nicht
    const guests = (+(q.get('adults') || 0)) + (+(q.get('children') || 0));
    const city = (new URL(url).pathname.match(/^\/s\/([^/]+)/) || [])[1];
    let place = null;
    try { place = city ? decodeURIComponent(city).replace(/--/g, ', ').replace(/-/g, ' ') : null; } catch {}
    return { checkin: ci, checkout: co, nights, adults: guests || null, place };
  }


  // ---------- Stichworte aus Bewertungen ----------
  const HINTS = [
    // [Label, Muster, positiv?, Gegenbegriff bei Verneinung]
    ['sauber', /\b(sauber|blitzsauber|spotless|very clean|super clean|so clean)\b/i, true, 'nicht sauber'],
    ['Lage', /\b(tolle|super|perfekte|zentrale) lage\b|\b(great|perfect|excellent) location\b/i, true, 'Lage nicht ideal'],
    ['Gastgeber', /\bgastgeber\w*\b[^.]{0,40}\b(nett|freundlich|hilfsbereit)\b|\bhost was (great|helpful|friendly|amazing)\b/i, true, 'Gastgeber nicht hilfreich'],
    // "laut" allein heißt oft "gemäß" ("laut Beschreibung") → nur mit Verstärker oder als Lärm
    ['laut', /\b(sehr|zu|ziemlich|recht|extrem|etwas|echt|so|total) laut\b|\blaut(?=[\s,.!]*(?:$|[.!?]))|\b(lärm|lärmig|noisy|noise|loud)\b/i, false, 'ruhig'],
    ['schmutzig', /\b(schmutzig|dreckig|dirty|unclean)\b/i, false, 'sauber'],
    ['Bett', /\b(unbequem\w*|uncomfortable)\b/i, false, 'bequemes Bett'],
    ['WLAN', /\b(wlan|wifi|wi-fi)\b[^.]{0,30}\b(schlecht|langsam|bad|slow|poor)\b/i, false, 'WLAN ok'],
  ];
  const NEG = /\b(nicht|kein|keine|nie|not|never|no|wasn't|isn't)\b/i;
  // feste Wendungen, die trotz "kein"/"no" positiv sind, vorher entfernen
  const PRAISE = /\b(no complaints?|no issues?|no problems?|kein problem|keine probleme|keine beschwerden?|nothing to complain about|nichts zu meckern)\b/gi;

  function reviewHints(text) {
    const sentences = String(text || '').split(/(?<=[.!?\n])\s+/);
    const counts = {};
    for (const raw of sentences) {
      const s = raw.replace(PRAISE, ' ');
      for (const [label, re, pos, opposite] of HINTS) {
        const m = s.match(re);
        if (!m) continue;
        const before = s.slice(Math.max(0, m.index - 30), m.index);
        const negated = NEG.test(before);
        const isPos = negated ? !pos : pos;
        const key = (isPos ? '👍 ' : '⚠️ ') + (negated ? opposite : label);
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => n > 1 ? `${k} (${n}×)` : k);
  }

  root.StayMatchParse = { reviewHints, TOTAL_RE, parseSearch, fromState, fromCards, searchParams, num, rating, details, ROOM_RE };
})(typeof window !== 'undefined' ? window : globalThis);
