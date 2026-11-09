// StayMatch – Bewertungslogik der Viertel (Web-App). Das Plugin bekommt die fertigen Werte über bridge.js.
(function (root) {
  // Kern (Kategorien, Typen, Entfernung) aus core.js: im Browser vorher geladen, in Node per require
  const C = root.StayMatchCore || (typeof require === 'function' ? require('./core.js') : null);
  const { CATEGORIES, PRESETS, RADIUS, distM } = C;

  // Ein Ort kann in mehreren Kategorien zählen (Park mit Sehenswürdigkeit = Chillen UND Sightseeing)
  function categoriesOf(tags) {
    return Object.entries(CATEGORIES).filter(([, cat]) => cat.tags.some(([k, v]) => tags[k] === v)).map(([key]) => key);
  }

  // areas: [{name, lat, lon}], pois: [{lat, lon, cat}] -> areas mit counts + normierten Werten (0..1)
  function scoreAreas(areas, pois, radius = RADIUS.area) {
    for (const a of areas) {
      a.counts = Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, 0]));
      for (const p of pois) if (distM(a, p) <= radius) a.counts[p.cat]++;
    }
    const max = {};
    for (const k of Object.keys(CATEGORIES)) max[k] = Math.max(1, ...areas.map(a => a.counts[k]));
    for (const a of areas) {
      // Wurzel, damit ein Viertel mit 200 Bars nicht alles andere erschlägt
      a.norm = Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, Math.sqrt(a.counts[k] / max[k])]));
    }
    return areas;
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
  function airbnbUrl({ lat, lon, name, city, checkin, checkout, adults, priceMaxNight, radius = RADIUS.area }) {
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
  function pickDiverse(sorted, n = 8, minDist = RADIUS.diverse) {
    const out = [];
    for (const a of sorted) {
      if (out.every(b => distM(a, b) >= minDist)) out.push(a);
      if (out.length >= n) break;
    }
    return out;
  }

  root.StayMatch = { pickDiverse, CATEGORIES, PRESETS, categoriesOf, distM, scoreAreas, personScore, groupScore, nights, airbnbUrl };
})(typeof window !== 'undefined' ? window : globalThis);
