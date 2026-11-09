// StayMatch – Bewertungslogik der Viertel (Web-App). Das Plugin bekommt die fertigen Werte über bridge.js.
(function (root) {
  const CATEGORIES = {
    party: { label: 'Party', tags: [['amenity', 'bar'], ['amenity', 'pub'], ['amenity', 'nightclub'], ['amenity', 'biergarten']] },
    chill: { label: 'Chillen', tags: [['leisure', 'park'], ['amenity', 'cafe'], ['leisure', 'garden'], ['natural', 'beach'], ['leisure', 'spa']] },
    sights: { label: 'Sightseeing', tags: [['tourism', 'attraction'], ['tourism', 'museum'], ['tourism', 'viewpoint'], ['historic', 'monument'], ['tourism', 'gallery']] },
    food: { label: 'Essen', tags: [['amenity', 'restaurant'], ['amenity', 'fast_food']] },
    transit: { label: 'ÖPNV', tags: [['railway', 'station'], ['railway', 'subway_entrance'], ['public_transport', 'station']] },
  };

  // Gewichte je Typ: positiv = wichtig, negativ = stört. Jeder Typ will etwas Essen und ÖPNV.
  const PRESETS = {
    party: { label: '🎉 Party', w: { party: 1, chill: 0.1, sights: 0.1, food: 0.4, transit: 0.4 } },
    chill: { label: '🌿 Chill', w: { party: -0.5, chill: 1, sights: 0.2, food: 0.5, transit: 0.2 } },
    sights: { label: '🏛️ Sightseeing', w: { party: 0.1, chill: 0.2, sights: 1, food: 0.4, transit: 0.7 } },
    foodie: { label: '🍝 Foodie', w: { party: 0.2, chill: 0.2, sights: 0.2, food: 1, transit: 0.3 } },
    family: { label: '👨‍👩‍👧 Familie', w: { party: -0.8, chill: 1, sights: 0.6, food: 0.6, transit: 0.5 } },
    nature: { label: '🌲 Natur', w: { party: -0.3, chill: 1, sights: 0.4, food: 0.3, transit: 0.2 } },
  };

  // Ein Ort kann in mehreren Kategorien zählen (Park mit Sehenswürdigkeit = Chillen UND Sightseeing)
  function categoriesOf(tags) {
    return Object.entries(CATEGORIES).filter(([, cat]) => cat.tags.some(([k, v]) => tags[k] === v)).map(([key]) => key);
  }

  function distM(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // areas: [{name, lat, lon}], pois: [{lat, lon, cat}] -> areas mit counts + normierten Werten (0..1)
  function scoreAreas(areas, pois, radius = 800) {
    const zero = () => Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, 0]));
    for (const a of areas) {
      a.counts = zero(); a.sums = zero();
      for (const p of pois) {
        const d = distM(a, p);
        if (d > radius) continue;
        a.counts[p.cat]++;
        a.sums[p.cat] += 1 - 0.5 * (d / radius); // Entfernungsabfall: direkt vor der Tür zählt doppelt so viel wie am Rand
      }
    }
    const max = {};
    for (const k of Object.keys(CATEGORIES)) max[k] = Math.max(1, ...areas.map(a => a.sums[k]));
    for (const a of areas) {
      // Wurzel, damit ein Viertel mit 200 Bars nicht alles andere erschlägt
      a.norm = Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, Math.sqrt(a.sums[k] / max[k])]));
    }
    return areas;
  }

  // Woran liegt es, dass eine Person unzufrieden ist? Größte Lücke bei Wichtigem oder größter Störfaktor.
  function weakness(norm, counts, weights) {
    let best = null;
    for (const [k, w] of Object.entries(weights)) {
      const gap = w > 0 ? w * (1 - (norm[k] || 0)) : -w * (norm[k] || 0);
      if (gap > 0 && (!best || gap > best.gap)) best = { gap, kind: w > 0 ? 'missing' : 'toomuch', label: CATEGORIES[k].label, count: counts[k] };
    }
    return best;
  }

  // Zufriedenheit einer Person (0..100)
  function personScore(norm, weights) {
    // Negative Gewichte = stört (z. B. Chill-Typ und Partymeile)
    let s = 0, t = 0;
    for (const [k, w] of Object.entries(weights)) { s += w * (norm[k] || 0); if (w > 0) t += w; }
    return t ? Math.max(0, Math.min(100, Math.round((s / t) * 100))) : 0;
  }

  // Fairness: 60 % schwächste Person (Maximin) + 40 % Durchschnitt
  function groupScore(norm, people) {
    const scores = people.map(p => personScore(norm, p.w));
    if (!scores.length) return { total: 0, scores, min: 0, avg: 0 };
    const min = Math.min(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { total: Math.round(0.6 * min + 0.4 * avg), scores, min, avg: Math.round(avg) };
  }

  function nights(checkin, checkout) {
    if (!checkin || !checkout) return 0;
    return Math.max(0, Math.round((new Date(checkout) - new Date(checkin)) / 86400000));
  }

  // Deep-Link in die Airbnb-Suche (Kartenbereich rund ums Viertel)
  function airbnbUrl({ lat, lon, name, city, checkin, checkout, adults, priceMaxNight, radius = 800 }) {
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
    const q = new URLSearchParams();
    if (checkin) q.set('checkin', checkin);
    if (checkout) q.set('checkout', checkout);
    if (adults) q.set('adults', adults);
    if (priceMaxNight) q.set('price_max', Math.round(priceMaxNight));
    q.set('ne_lat', (lat + dLat).toFixed(5)); q.set('ne_lng', (lon + dLon).toFixed(5));
    q.set('sw_lat', (lat - dLat).toFixed(5)); q.set('sw_lng', (lon - dLon).toFixed(5));
    q.set('search_by_map', 'true');
    return `https://www.airbnb.de/s/${encodeURIComponent(`${name}, ${city}`)}/homes?${q}`;
  }

  // Beste Viertel, aber keine zwei Nachbarn im Umkreis von minDist (sonst 5× dieselbe Gegend)
  function pickDiverse(sorted, n = 8, minDist = 1200) {
    const out = [];
    for (const a of sorted) {
      if (out.every(b => distM(a, b) >= minDist)) out.push(a);
      if (out.length >= n) break;
    }
    return out;
  }

  root.StayMatch = { weakness, pickDiverse, CATEGORIES, PRESETS, categoriesOf, distM, scoreAreas, personScore, groupScore, nights, airbnbUrl };
})(typeof window !== 'undefined' ? window : globalThis);
