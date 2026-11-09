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
    const own = p && cleanWeights(p.custom);
    if (own) return own;
    const a = (PRESETS[p && p.type] || PRESETS.chill).w;
    // Mischtyp: Mittel aus zwei Typen („halb Party, halb Sightseeing“)
    const b = p && p.type2 && p.type2 !== p.type && PRESETS[p.type2] ? PRESETS[p.type2].w : null;
    if (!b) return a;
    return Object.fromEntries(Object.keys(CATEGORIES).map(k => [k, Math.round(((a[k] || 0) + (b[k] || 0)) * 5) / 10]));
  }
  // Eine Person aus gespeicherten oder per Link gelieferten Rohdaten (nie dem Wert trauen)
  function cleanPerson(raw) {
    if (!raw || typeof raw.name !== 'string') return null;
    const p = { name: raw.name.slice(0, 40) || 'Person', type: PRESETS[raw.type] ? raw.type : 'chill' };
    if (PRESETS[raw.type2] && raw.type2 !== p.type) p.type2 = raw.type2;
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

  // Doppelte Orte entfernen: derselbe Ort als Punkt und als Gebäude, oder viele Eingänge eines Bahnhofs
  function dedupePois(pois) {
    const cell = 0.003, grid = new Map(), out = [];
    for (const p of pois) {
      const cx = Math.floor(p.lat / cell), cy = Math.floor(p.lon / cell);
      const lim = p.cat === 'transit' ? 100 : p.name ? 30 : 8; // ÖPNV: alles innerhalb 100 m ist ein Halt
      let dup = false;
      for (let dx = -1; dx <= 1 && !dup; dx++) for (let dy = -1; dy <= 1 && !dup; dy++) {
        for (const q of grid.get(`${cx + dx},${cy + dy}`) || []) {
          if (q.cat !== p.cat) continue;
          if (p.cat !== 'transit' && (q.name || '') !== (p.name || '')) continue;
          if (distM(p, q) < lim) { dup = true; break; }
        }
      }
      if (dup) continue;
      out.push(p);
      const k = `${cx},${cy}`; (grid.get(k) || grid.set(k, []).get(k)).push(p);
    }
    return out;
  }

  // areas: [{name, lat, lon}], pois: [{lat, lon, cat}] -> areas mit counts + normierten Werten (0..1) + nächster Ort je Kategorie
  function scoreAreas(areas, pois, radius = RADIUS.area) {
    const keys = Object.keys(CATEGORIES);
    const zero = () => Object.fromEntries(keys.map(k => [k, 0]));
    // Raster, damit nicht jedes Viertel jeden Ort prüft (Großstadt: 250 × 14 000)
    const lat0 = areas.length ? areas.reduce((x, a) => x + a.lat, 0) / areas.length : 0;
    const cy = radius * 1.2 / 111320, cx = radius * 1.2 / (111320 * Math.cos(lat0 * Math.PI / 180));
    const grid = new Map();
    for (const p of pois) { const k = `${Math.floor(p.lat / cy)},${Math.floor(p.lon / cx)}`; (grid.get(k) || grid.set(k, []).get(k)).push(p); }
    for (const a of areas) {
      a.counts = zero(); a.sums = zero(); a.nearest = Object.fromEntries(keys.map(k => [k, null]));
      const gy = Math.floor(a.lat / cy), gx = Math.floor(a.lon / cx);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const p of grid.get(`${gy + dy},${gx + dx}`) || []) {
          const d = distM(a, p);
          if (d > radius) continue;
          a.counts[p.cat]++;
          a.sums[p.cat] += 1 - 0.5 * (d / radius); // Entfernungsabfall: direkt vor der Tür zählt doppelt so viel wie am Rand
          if (a.nearest[p.cat] === null || d < a.nearest[p.cat]) a.nearest[p.cat] = Math.round(d);
        }
      }
    }
    const max = {};
    for (const k of keys) max[k] = Math.max(1, ...areas.map(a => a.sums[k]));
    for (const a of areas) {
      // Wurzel, damit ein Viertel mit 200 Bars nicht alles andere erschlägt
      a.norm = Object.fromEntries(keys.map(k => [k, Math.sqrt(a.sums[k] / max[k])]));
    }
    return areas;
  }

  // Entfernung zum Zentrum und grobe Preislage (Schätzung aus Lage + Dichte der Sehenswürdigkeiten, keine echten Preise)
  function annotateCentre(areas, centre) {
    const ds = areas.map(a => distM(a, centre)).sort((x, y) => x - y);
    const dmax = Math.max(1000, ds[Math.floor(ds.length * 0.9)] || 1000);
    for (const a of areas) {
      a.centerDist = Math.round(distM(a, centre));
      const s = 0.65 * (1 - Math.min(1, a.centerDist / dmax)) + 0.35 * ((a.norm && a.norm.sights) || 0);
      a.tier = s > 0.6 ? 3 : s > 0.35 ? 2 : 1;
    }
    return areas;
  }
  function median(xs) { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; }
  // Geheimtipp: fast so gut wie die Spitze, aber wenig Sehenswürdigkeiten und abseits vom Zentrum
  function isSecretTip(a, best, medCentre) {
    return a.group.total >= best - 10 && (a.norm.sights || 0) < 0.45 && a.centerDist > medCentre;
  }
  // Durchschnitt der Anzahl je Kategorie über alle bewerteten Viertel
  function cityStats(areas) {
    const keys = Object.keys(CATEGORIES), out = Object.fromEntries(keys.map(k => [k, 0]));
    if (!areas.length) return out;
    for (const a of areas) for (const k of keys) out[k] += a.counts[k] || 0;
    for (const k of keys) out[k] = Math.round(out[k] / areas.length);
    return out;
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

  // Wort zur Zahl
  function verdict(total) { return total >= 80 ? 'sehr gut' : total >= 65 ? 'gut' : total >= 50 ? 'okay' : total >= 35 ? 'schwach' : 'passt kaum'; }

  // Ein Satz, was dieses Viertel für die Gruppe bedeutet
  function summary(a, people) {
    const { scores, min } = a.group;
    if (!people.length) return '';
    if (scores.every(x => x >= 70)) return 'Passt für alle gut.';
    const lowIdx = scores.indexOf(min), low = people[lowIdx];
    const weak = low && min < 60 ? weakness(a.norm, a.counts, low.w || weightsOf(low)) : null;
    if (!weak) return 'Solide für die ganze Gruppe.';
    const who = people.filter((_, i) => scores[i] < 60).length;
    const lead = who > 1 ? `Für ${who} Personen knapp` : 'Gut für die meisten';
    return `${lead}: ${low.name} (${min}) ${weak.kind === 'missing' ? `vermisst ${weak.label}` : `stört sich an viel ${weak.label}`}.`;
  }

  // Wie setzt sich der Wert einer Person zusammen? Punkte je Kategorie (positiv hilft, negativ stört)
  function breakdown(norm, weights) {
    let t = 0;
    for (const w of Object.values(weights)) if (w > 0) t += w;
    const neg = Object.values(weights).reduce((x, w) => x - (w < 0 ? w : 0), 0);
    const den = t || neg || 1;
    return Object.entries(weights).filter(([, w]) => w).map(([k, w]) => ({ key: k, label: CATEGORIES[k].label, pts: Math.round((w * (norm[k] || 0)) / den * 100) }))
      .filter(x => x.pts).sort((x, y) => Math.abs(y.pts) - Math.abs(x.pts));
  }

  // „Ohne Tom wäre …“: für jede Person das beste Viertel, wenn sie nicht dabei wäre (nur wenn es sich ändert)
  function whatIfWithout(areas, people, fairness, bestName) {
    if (people.length < 2 || !areas.length) return [];
    const out = [];
    people.forEach((p, i) => {
      const rest = people.filter((_, j) => j !== i);
      let best = null, bt = -1;
      for (const a of areas) { const t = groupScore(a.norm, rest, fairness).total; if (t > bt) { bt = t; best = a; } }
      if (best && best.name !== bestName) out.push({ name: p.name, area: best.name, total: bt });
    });
    return out;
  }

  // Auszeichnungen je Viertel (Index in ranked → Liste)
  function awards(ranked, people) {
    const out = ranked.map(() => []);
    if (!ranked.length) return out;
    out[0].push('Bester Kompromiss');
    const types = [...new Set(people.map(p => p.type))];
    if (types.length > 1) for (const t of types) {
      const idx = people.map((p, i) => p.type === t ? i : -1).filter(i => i >= 0);
      let bi = 0, bv = -1;
      ranked.forEach((a, i) => { const v = idx.reduce((x, j) => x + a.group.scores[j], 0) / idx.length; if (v > bv) { bv = v; bi = i; } });
      if (bi !== 0 && out[bi].length < 2) out[bi].push(`Beste Wahl für ${(PRESETS[t] || {}).label || t}`);
    }
    let ti = -1, tv = Infinity;
    ranked.forEach((a, i) => { const d = a.nearest && a.nearest.transit; if (d != null && d < tv) { tv = d; ti = i; } });
    if (ti >= 0 && out[ti].length < 2) out[ti].push('Kürzester Weg zur Bahn');
    return out;
  }

  // Sortierung der bewerteten Viertel: fair (Standard), avg, p:<Index> (beste für eine Person), transit, center, cheap
  function sortAreas(areas, mode = 'fair') {
    const byTotal = (a, b) => b.group.total - a.group.total;
    const num = (v, none = Infinity) => v == null ? none : v;
    const cmp = {
      fair: byTotal,
      avg: (a, b) => b.group.avg - a.group.avg || byTotal(a, b),
      transit: (a, b) => num(a.nearest.transit) - num(b.nearest.transit) || byTotal(a, b),
      center: (a, b) => a.centerDist - b.centerDist || byTotal(a, b),
      cheap: (a, b) => a.tier - b.tier || byTotal(a, b),
    }[mode];
    if (cmp) return [...areas].sort(cmp);
    const m = /^p:(\d+)$/.exec(mode);
    if (m) { const i = +m[1]; return [...areas].sort((a, b) => (b.group.scores[i] || 0) - (a.group.scores[i] || 0) || byTotal(a, b)); }
    return [...areas].sort(byTotal);
  }

  // Gruppe aus Text: „Lena Party, Mia Chill“ oder eine Person pro Zeile („Tom: Sightseeing“)
  const TYPE_WORDS = [
    ['party', /party|feier|club|nacht/], ['chill', /chill|ruhe|entspann/], ['sights', /sight|besicht|stadt/], ['foodie', /food|essen|kulinar/],
    ['family', /famil|kind/], ['nature', /natur|wander/], ['shopping', /shop|einkauf/], ['sport', /sport|fitness|lauf/], ['culture', /kultur|museum|theater/],
  ];
  function parseGroup(text) {
    const parts = String(text || '').split(/[\n,;]+|\s+und\s+/i).map(x => x.trim()).filter(Boolean).slice(0, 30);
    const out = [];
    for (const part of parts) {
      const low = part.toLowerCase();
      const hit = TYPE_WORDS.find(([, re]) => re.test(low));
      const name = part.replace(/[:()\-–]/g, ' ').split(/\s+/).filter(w => !hit || !hit[1].test(w.toLowerCase())).join(' ').trim().slice(0, 40);
      out.push({ name: name || `Person ${out.length + 1}`, type: hit ? hit[0] : 'chill' });
    }
    return out;
  }

  function nights(checkin, checkout) {
    if (!checkin || !checkout) return 0;
    return Math.max(0, Math.round((new Date(checkout) - new Date(checkin)) / 86400000));
  }

  // Deep-Link in die Airbnb-Suche (Kartenbereich rund ums Viertel)
  function airbnbUrl({ lat, lon, name, city, checkin, checkout, adults, children, infants, minBedrooms, priceMaxNight, radius = RADIUS.area }) {
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
    const q = new URLSearchParams();
    if (checkin) q.set('checkin', checkin);
    if (checkout) q.set('checkout', checkout);
    if (adults) q.set('adults', adults);
    if (children) q.set('children', children);
    if (infants) q.set('infants', infants);
    if (minBedrooms) q.set('min_bedrooms', minBedrooms);
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

  root.StayMatch = { dedupePois, annotateCentre, isSecretTip, median, cityStats, verdict, summary, breakdown, whatIfWithout, awards, sortAreas, parseGroup, cleanWeights, weightsOf, cleanPerson, cleanFairness, vetoes, thinData, compareAreas, placeChoices, VETO_LIMIT, weakness, pickDiverse, CATEGORIES, PRESETS, categoriesOf, distM, scoreAreas, personScore, groupScore, nights, airbnbUrl };
})(typeof window !== 'undefined' ? window : globalThis);
