// StayMatch – liest Unterkünfte aus der Airbnb-Suchseite, die du geöffnet hast.
// Reine Funktionen ohne chrome.*, damit sie sich direkt in einem Tab testen lassen.
(function (root) {
  const ROOM_RE = /\/rooms\/(?:[a-z]+\/)?(\d+)/;

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
    const g = re => { const m = t.match(re); return m ? +m[1] : null; };
    return {
      bedrooms: g(/(\d+)\s*(?:Schlafzimmer|bedrooms?)/i),
      beds: g(/(\d+)\s*(?:Betten|Bett|beds?)\b/i),
      baths: g(/(\d+(?:[.,]5)?)\s*(?:Badezimmer|Bäder|baths?|bathrooms?)/i),
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
        isTotal: /gesamt|total/i.test(priceLabel),
        lat: coord?.latitude ?? null, lon: coord?.longitude ?? null,
        multiUnit: lines.some(l => /verfügbar|available/i.test(l)),
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
        kind, locality: (kind.match(/\b(?:in|im)\s+(.+)$/) || [])[1] || null,
        rating: rt.value, reviewCount: rt.count,
        totalPrice: num(priceLine), currency: currency(priceLine), isTotal: /gesamt|total/i.test(priceLine),
        lat: null, lon: null, multiUnit: /verfügbar|available/i.test(txt),
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

  // Selbstdiagnose: Warum haben wir (nichts) gefunden? Liefert nur Zahlen und Stichworte, keine Seiteninhalte.
  function diagnose(doc) {
    const d = { stateFound: false, stateCount: 0, stateNote: 'fehlt', cards: 0, roomLinks: 0 };
    const el = doc.getElementById('data-deferred-state-0');
    if (el) {
      d.stateNote = 'kein gültiges JSON';
      try {
        const ss = JSON.parse(el.textContent)?.niobeClientData?.[0]?.[1]?.data?.presentation?.staysSearch;
        if (ss?.results?.searchResults) { d.stateFound = true; d.stateCount = ss.results.searchResults.length; d.stateNote = 'ok'; }
        else d.stateNote = 'Struktur anders als erwartet';
      } catch {}
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
    const nights = ci && co ? Math.max(0, Math.round((new Date(co) - new Date(ci)) / 864e5)) : null;
    return { checkin: ci, checkout: co, nights, adults: +(q.get('adults') || 0) || null };
  }

  root.StayMatchParse = { diagnose, quality, diagnosisText, parseSearch, fromState, fromCards, searchParams, num, rating, details, ROOM_RE };
})(typeof window !== 'undefined' ? window : globalThis);
