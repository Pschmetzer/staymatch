// StayMatch – Bewertungslogik der Viertel (Web-App). Das Plugin bekommt die fertigen Werte über bridge.js.
(function (root) {
  // Kern (Kategorien, Typen, Entfernung) aus core.js: im Browser vorher geladen, in Node per require
  const C = root.StayMatchCore || (typeof require === 'function' ? require('./core.js') : null);
  const { CATEGORIES, PRESETS, RADIUS, distM } = C;

  // Gewichte einer Person: eigene Schieberegler (custom) gehen vor dem Typ. Unbekanntes wird verworfen, Werte auf -1..1 begrenzt.
  function cleanWeights(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const w = {};
    for (const k of Object.keys(CATEGORIES)) {
      const v = Number(raw[k]);
      w[k] = Number.isFinite(v) ? Math.round(Math.max(-1, Math.min(1, v)) * 10) / 10 : 0;
    }
    return w;
  }
  function weightsOf(p) {
    return (p && cleanWeights(p.custom)) || (PRESETS[p && p.type] || PRESETS.chill).w;
  }
  // Eine Person aus gespeicherten oder per Link gelieferten Rohdaten (nie dem Wert trauen)
  function cleanPerson(raw) {
    if (!raw || typeof raw.name !== 'string') return null;
    const p = { name: raw.name.slice(0, 40) || 'Person', type: PRESETS[raw.type] ? raw.type : 'chill' };
    const c = cleanWeights(raw.custom); if (c) p.custom = c;
    const v = Array.isArray(raw.veto) ? [...new Set(raw.veto.filter(k => CATEGORIES[k]))] : [];
    if (v.length) p.veto = v;
    return p;
  }
  // Fairness-Anteil (Gewicht der unzufriedensten Person) auf 0..1, Standard 0,6
  function cleanFairness(v) {
    const n = Number(v);
    return Number.isFinite(n) && v !== '' && v !== null ? Math.max(0, Math.min(1, n)) : 0.6;
  }
  // Harte Grenze („auf keinen Fall Partymeile“): welche Personen legen gegen dieses Viertel ein Veto ein?
  const VETO_LIMIT = 0.5; // normierter Wert ab dem eine Kategorie als „zu viel“ gilt
  function vetoes(norm, people) {
    const out = [];
    for (const p of people) for (const k of (p.veto || [])) if ((norm[k] || 0) >= VETO_LIMIT) out.push({ name: p.name, cat: k, label: CATEGORIES[k].label });
    return out;
  }
  // Viertel mit sehr wenigen OSM-Orten: Wertung wackelig
  function thinData(counts, min = 30) {
    return Object.values(counts).reduce((x, y) => x + y, 0) < min;
  }
  // Zwei Viertel nebeneinander: je Kategorie Anzahl und wer vorn liegt
  function compareAreas(a, b, people) {
    const cats = Object.keys(CATEGORIES).map(k => ({ key: k, label: CATEGORIES[k].label, a: a.counts[k], b: b.counts[k], win: a.counts[k] === b.counts[k] ? 0 : a.counts[k] > b.counts[k] ? 1 : 2 }));
    const persons = people.map((p, i) => { const x = a.group.scores[i], y = b.group.scores[i]; return { name: p.name, a: x, b: y, win: x === y ? 0 : x > y ? 1 : 2 }; });
    const t = a.group.total === b.group.total ? 0 : a.group.total > b.group.total ? 1 : 2;
    return { cats, persons, total: { a: a.group.total, b: b.group.total, win: t } };
  }
  // Nominatim-Treffer → eindeutige, ähnlich wichtige Orte (Paris, Frankreich vs. Paris, Texas). Mehr als einer = nachfragen.
  function placeChoices(results, max = 4) {
    if (!Array.isArray(results)) return [];
    const ok = results.filter(r => r && r.boundingbox && r.display_name && Number.isFinite(+r.lat) && Number.isFinite(+r.lon));
    const top = Math.max(0, ...ok.map(r => +r.importance || 0));
    const seen = new Set(), out = [];
    for (const r of ok) {
      if (top && (+r.importance || 0) < top * 0.5) continue;
      const key = r.display_name.split(',').map(x => x.trim()).filter((_, i, arr) => i === 0 || i >= arr.length - 2).join('|').toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key); out.push(r);
      if (out.length >= max) break;
    }
    return out;
  }

  // Ein Ort kann in mehreren Kategorien zählen (Park mit Sehenswürdigkeit = Chillen UND Sightseeing)
  function categoriesOf(tags) {
    return Object.entries(CATEGORIES).filter(([, cat]) => cat.tags.some(([k, v]) => tags[k] === v)).map(([key]) => key);
  }

  // areas: [{name, lat, lon}], pois: [{lat, lon, cat}] -> areas mit counts + normierten Werten (0..1)
  function scoreAreas(areas, pois, radius = RADIUS.area) {
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
    let s = 0, t = 0, neg = 0;
    for (const [k, w] of Object.entries(weights)) { s += w * (norm[k] || 0); if (w > 0) t += w; else neg -= w; }
    // Nur Abneigungen (Regler alle ≤ 0): 100 = nichts davon in der Nähe, 0 = alles voll davon
    if (!t) return neg ? Math.max(0, Math.min(100, Math.round(100 + (s / neg) * 100))) : 100;
    return Math.max(0, Math.min(100, Math.round((s / t) * 100)));
  }

  // Fairness: 60 % schwächste Person (Maximin) + 40 % Durchschnitt
  function groupScore(norm, people, fairness = 0.6) {
    const f = cleanFairness(fairness);
    const scores = people.map(p => personScore(norm, p.w || weightsOf(p)));
    if (!scores.length) return { total: 0, scores, min: 0, avg: 0 };
    const min = Math.min(...scores);
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    return { total: Math.round(f * min + (1 - f) * avg), scores, min, avg: Math.round(avg) };
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

  root.StayMatch = { cleanWeights, weightsOf, cleanPerson, cleanFairness, vetoes, thinData, compareAreas, placeChoices, VETO_LIMIT, weakness, pickDiverse, CATEGORIES, PRESETS, categoriesOf, distM, scoreAreas, personScore, groupScore, nights, airbnbUrl };
})(typeof window !== 'undefined' ? window : globalThis);
