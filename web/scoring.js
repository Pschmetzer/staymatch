// StayMatch – Bewertungslogik der Viertel (Web-App). Das Plugin bekommt die fertigen Werte über bridge.js.
(function (root) {
  // Kern (Kategorien, Typen, Entfernung) aus core.js: im Browser vorher geladen, in Node per require
  const C = root.StayMatchCore || (typeof require === 'function' ? require('./core.js') : null);
  const { CATEGORIES, PRESETS, RADIUS, distM } = C;

  // Gewichte einer Person: eigene Schieberegler (custom) gehen vor dem Typ. Unbekanntes wird verworfen, Werte auf -1..1 begrenzt.
  function cleanWeights(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Object.keys(CATEGORIES).some(k => k in raw)) return null; // {} oder [] = nicht gesetzt
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
    const p = { name: raw.name.trim().slice(0, 40) || 'Person', type: PRESETS[raw.type] ? raw.type : 'chill' };
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
  const VETO_MIN = 5; // mindestens so viele Orte, sonst ist „viel“ nur relativ zu einer ruhigen Stadt
  function vetoes(norm, people, counts) {
    const out = [];
    for (const p of people) for (const k of (p.veto || [])) if ((norm[k] || 0) >= VETO_LIMIT && (!counts || (counts[k] || 0) >= VETO_MIN)) out.push({ name: p.name, cat: k, label: CATEGORIES[k].label });
    return out;
  }
  // Viertel mit sehr wenigen OSM-Orten: Wertung wackelig
  function thinData(counts, min = 30) {
    return Object.values(counts).reduce((x, y) => x + y, 0) < min;
  }
  // Zwei Viertel nebeneinander: je Kategorie Anzahl und wer vorn liegt
  function compareAreas(a, b, people) {
    // Wer insgesamt etwas nicht will (Summe der Gewichte < 0), für den ist weniger davon der Sieg
    const sign = k => people.reduce((x, p) => x + ((p.w || weightsOf(p))[k] || 0), 0) < 0 ? -1 : 1;
    const cats = Object.keys(CATEGORIES).filter(k => people.some(p => (p.w || weightsOf(p))[k])).map(k => { const d = ((a.counts[k] || 0) - (b.counts[k] || 0)) * sign(k); return { key: k, label: CATEGORIES[k].label, a: a.counts[k], b: b.counts[k], win: d === 0 ? 0 : d > 0 ? 1 : 2 }; });
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
    const grid = new Map(), tgrid = new Map(), TR = 1500, ty = TR / 111320, tx = TR / (111320 * Math.cos(lat0 * Math.PI / 180));
    const put = (g, k, p) => (g.get(k) || g.set(k, []).get(k)).push(p);
    for (const p of pois) {
      put(grid, `${Math.floor(p.lat / cy)},${Math.floor(p.lon / cx)}`, p);
      if (p.cat === 'transit') put(tgrid, `${Math.floor(p.lat / ty)},${Math.floor(p.lon / tx)}`, p);
    }
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
      // Nächste Bahn auch außerhalb des Wertungsradius (bis 1,5 km), sonst heißt es bei 500 m schnell „keine Bahn“
      const ty0 = Math.floor(a.lat / ty), tx0 = Math.floor(a.lon / tx);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const p of tgrid.get(`${ty0 + dy},${tx0 + dx}`) || []) {
          const d = distM(a, p);
          if (d <= TR && (a.nearest.transit === null || d < a.nearest.transit)) a.nearest.transit = Math.round(d);
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
  // „ruhiger“ heißt auch: wenig Bars (sonst bekäme ein Kneipenviertel am Rand das Abzeichen)
  function isSecretTip(a, best, medCentre) {
    return a.group.total < best && a.group.total >= best - 10 && (a.norm.sights || 0) < 0.45 && (a.norm.party || 0) < 0.45 && a.centerDist > medCentre;
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
    if (!t) return neg ? Math.max(0, Math.min(100, Math.round(100 + (s / neg) * 100))) : 0; // nichts gewählt = kein Treffer
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
    if (people.every(p => !Object.values(p.w || weightsOf(p)).some(Boolean))) return 'Nichts gewählt: Wähle Wünsche, damit die Wertung etwas aussagt.';
    if (people.length === 1) { // eine Person: direkt ansprechen
      if (min >= 70) return 'Passt gut zu dir.';
      const w = min < 60 ? weakness(a.norm, a.counts, people[0].w || weightsOf(people[0])) : null;
      return !w ? 'Solide für dich.' : w.kind === 'missing' ? `Dir fehlt hier etwas ${w.label}.` : `Hier gibt es dir zu viel ${w.label}.`;
    }
    if (scores.every(x => x >= 70)) return 'Passt für alle gut.';
    const lowIdx = scores.indexOf(min), low = people[lowIdx];
    const weak = low && min < 60 ? weakness(a.norm, a.counts, low.w || weightsOf(low)) : null;
    if (!weak) return 'Solide für die ganze Gruppe.';
    const who = people.filter((_, i) => scores[i] < 60).length;
    const lead = who > 1 ? `Für ${who} Personen knapp` : people.length > 2 ? 'Gut für die meisten' : 'Nicht für beide ideal';
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
      if (best && (typeof bestName === 'object' ? best !== bestName : best.name !== bestName)) out.push({ name: p.name, area: best.name, total: bt });
    });
    return out;
  }

  // Auszeichnungen je Viertel (Index in ranked → Liste)
  function awards(ranked, people) {
    const out = ranked.map(() => []);
    if (!ranked.length) return out;
    let b0 = 0; ranked.forEach((a, i) => { if (a.group.total > ranked[b0].group.total) b0 = i; });
    out[b0].push(people.length === 1 ? 'Beste Wahl für dich' : 'Bester Kompromiss');
    const types = [...new Set(people.map(p => p.type))];
    if (types.length > 1) for (const t of types) {
      const idx = people.map((p, i) => p.type === t ? i : -1).filter(i => i >= 0);
      let bi = 0, bv = -1;
      ranked.forEach((a, i) => { const v = idx.reduce((x, j) => x + a.group.scores[j], 0) / idx.length; if (v > bv) { bv = v; bi = i; } });
      if (bi !== b0 && out[bi].length < 2) out[bi].push(`Beste Wahl für ${(PRESETS[t] || {}).label || t}`);
    }
    let ti = -1, tv = Infinity;
    ranked.forEach((a, i) => { const d = a.nearest && a.nearest.transit; if (d != null && d < tv) { tv = d; ti = i; } });
    if (ti >= 0 && tv <= 300 && out[ti].length < 2) out[ti].push('Kürzester Weg zur Bahn');
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
    ['party', /^(party|feier|club|nacht)/], ['chill', /^(chill|ruhe|entspann)/], ['sights', /^(sight|besicht|stadt)/], ['foodie', /^(food|essen|kulinar)/],
    ['family', /^(famil|kind)/], ['nature', /^(natur|wander)/], ['shopping', /^(shop|einkauf)/], ['sport', /^(sport|fitness|lauf)/], ['culture', /^(kultur|museum|theater)/],
  ]; // am Wortanfang verankert: „Jessen“ ist kein Foodie
  function parseGroup(text) {
    const parts = String(text || '').split(/[\n,;]+|\s+und\s+/i).map(x => x.trim()).filter(Boolean).slice(0, 30);
    const out = [];
    for (const part of parts) {
      const words = part.replace(/[:()–]|\s-\s/g, ' ').split(/\s+/).filter(Boolean); // Bindestrich im Namen bleibt („Hans-Peter“)
      const hit = TYPE_WORDS.find(([, re]) => words.some(w => re.test(w.toLowerCase())));
      const name = words.filter(w => !hit || !hit[1].test(w.toLowerCase())).join(' ').trim().slice(0, 40);
      out.push({ name: name || `Person ${out.length + 1}`, type: hit ? hit[0] : 'chill' });
    }
    return out;
  }

  function nights(checkin, checkout) {
    if (!checkin || !checkout) return 0;
    const n = Math.round((new Date(checkout) - new Date(checkin)) / 86400000);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  // Deep-Link in die Airbnb-Suche (Kartenbereich rund ums Viertel)
  function airbnbUrl({ lat, lon, name, city, checkin, checkout, adults, children, infants, minBedrooms, priceMaxNight, radius = RADIUS.area }) {
    const dLat = radius / 111320, dLon = radius / (111320 * Math.cos(lat * Math.PI / 180));
    const q = new URLSearchParams();
    if (checkin) q.set('checkin', checkin);
    if (checkout) q.set('checkout', checkout);
    const cap = (v, max) => Math.max(0, Math.min(max, Math.floor(+v) || 0));
    const ad = cap(adults, 16), ch = Math.min(cap(children, 15), 16 - ad); // Airbnb: höchstens 16 Gäste (Erwachsene + Kinder), Babys ≤ 5
    if (ad) q.set('adults', ad);
    if (ch) q.set('children', ch);
    if (cap(infants, 5)) q.set('infants', cap(infants, 5));
    if (minBedrooms) q.set('min_bedrooms', minBedrooms);
    if (priceMaxNight) q.set('price_max', Math.round(priceMaxNight));
    q.set('currency', 'EUR'); // Budget ist in Euro: sonst gilt price_max in der Kontowährung (CHF, GBP …)
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

  // ---- Hilfen der Web-App ohne DOM (testbar in Node) ----
  // Welche Viertel kommen in die Liste? Genug Orte, genug von dem, was die Gruppe sucht, nicht zu weit vom Zentrum.
  // Kategorien, für die die Stadt kaum Daten hat (z. B. Einkaufen in älteren Vorab-Dateien), entscheiden nicht mit.
  function eligibleAreas(areas, ppl, maxC = 0) {
    const want = Object.keys(CATEGORIES).filter(k => k !== 'transit' && k !== 'food' && ppl.some(p => (p.w || weightsOf(p))[k] >= 0.3));
    const empty = want.filter(k => areas.filter(a => a.counts[k] >= 2).length < Math.max(5, areas.length * 0.1)); // zu wenig Daten in der Stadt
    const relevant = want.filter(k => !empty.includes(k));
    const withData = areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10
      && (!relevant.length || relevant.reduce((x, k) => x + a.counts[k], 0) >= 2) && (!maxC || a.centerDist <= maxC));
    return { withData, relevant, empty };
  }
  // Schlüssel für den Index der Vorab-Städte: „Barcelona, Spanien“, „Wien (Österreich)“ und „ROM “ finden die Datei
  function cityKeys(s) {
    const n = C.normCity, full = String(s || '');
    return [...new Set([n(full), n(full.split(',')[0]), n(full.replace(/\(.*?\)/g, '').split(',')[0])])].filter(Boolean);
  }
  // Overpass-CSV (Kopfzeile + |-getrennte Zeilen) → Objekte
  function parseCsv(text, fields = C.FIELDS) {
    return String(text).split('\n').slice(1).filter(Boolean).map(line => {
      const v = line.split('|'), t = {};
      if (v.length !== fields.length) return null; // Name mit | → Zeile verwerfen
      fields.forEach((f, i) => { if (v[i]) t[f] = v[i]; });
      return t;
    }).filter(Boolean);
  }
  // Vorab-Datei (web/data/*.json) → Zeilen und Stadtzentrum. Zentrum aus der Datei, sonst Mitte der Box (ungenau).
  function fromFile(d) {
    const rows = d.rows.map(v => Object.fromEntries(d.fields.map((f, i) => [f, v[i]]).filter(([, x]) => x !== '' && x != null)));
    const [s, w, n, e] = d.bbox, c = Array.isArray(d.center) ? { lat: +d.center[0], lon: +d.center[1] } : d.center || {};
    const ok = Number.isFinite(+c.lat) && Number.isFinite(+c.lon) && +c.lat >= s && +c.lat <= n && +c.lon >= w && +c.lon <= e;
    return { geo: { name: d.city, bbox: d.bbox, lat: ok ? +c.lat : (s + n) / 2, lon: ok ? +c.lon : (w + e) / 2 }, rows, at: d.t };
  }
  // Zeilen → Viertel (benannte Orte) und Orte je Kategorie (ohne Doppelte)
  function buildData(rows) {
    const areas = [], raw = [];
    for (const t of rows) {
      const lat = +t.lat, lon = +t.lon;
      if (!lat) continue;
      if (t.place && t.name) { if (!areas.some(a => a.name === t.name && distM(a, { lat, lon }) < 1500)) areas.push({ name: t.name, lat, lon }); continue; }
      for (const cat of categoriesOf(t)) raw.push({ lat, lon, cat, name: t.name, tags: t });
    }
    return { areas, pois: dedupePois(raw) };
  }
  // Budget aufteilen: gesamt, pro Nacht, pro Person (v in Euro, m = total | pp | night)
  function budgetSplit(v, m, n, g) {
    const total = m === 'pp' ? v * g : m === 'night' ? v * n : v;
    return { n, total, perNight: n ? total / n : 0, perPerson: g ? total / g : 0, perPersonNight: n && g ? total / n / g : 0 };
  }
  // Kurzbeschreibung der Typen aus den Gewichten (weicht so nie von der Wertung ab): [[Label, Text], …]
  function typeSummary() {
    return Object.values(PRESETS).map(v => {
      const pos = Object.entries(v.w).filter(([, x]) => x >= 0.5).map(([k]) => CATEGORIES[k].label), neg = Object.entries(v.w).filter(([, x]) => x <= -0.3).map(([k]) => CATEGORIES[k].label);
      return [v.label, `wichtig ${pos.join(', ')}${neg.length ? `; stört ${neg.join(', ')}` : ''}`];
    });
  }
  // Budget beim Umstellen des Modus umrechnen (gleiche Gesamtsumme, andere Bedeutung der Zahl)
  function convertBudget(v, from, to, nights, people) {
    const n = nights || 1, g = people || 1, total = from === 'pp' ? v * g : from === 'night' ? v * n : v;
    return Math.round(to === 'pp' ? total / g : to === 'night' ? total / n : total);
  }

  // ---- Teilen-Link: Zustand ↔ Text nach #t= (Base64url aus JSON, alles bleibt im Link) ----
  const b64 = {
    enc: o => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))),
  };
  function shareEncode(st) {
    const { c, i, o, b, bm, r, mc, k, y, bd } = st;
    return b64.enc({ c, i, o, b, bm, r, mc, k, y, bd, f: Math.round(st.fairness * 100),
      p: st.people.map(p => [p.name, p.type, p.custom ? Object.keys(CATEGORIES).map(k => Math.round(p.custom[k] * 10)) : 0, p.veto || 0, p.type2 || 0]), w: st.wishes });
  }
  // Nie dem Link trauen: alles prüfen und begrenzen. null = kaputt.
  function shareDecode(h) {
    try {
      const s = b64.dec(h);
      const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
      const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
      if (!s || !Array.isArray(s.p) || !s.p.length || s.p.length > 30) return null;
      const keys = Object.keys(CATEGORIES);
      const people = s.p.filter(Array.isArray).map(([n, t, c, v, t2]) => cleanPerson({
        name: str(n, 40) || 'Person', type: t, type2: t2 || undefined,
        custom: Array.isArray(c) ? Object.fromEntries(keys.map((k, i) => [k, (+c[i] || 0) / 10])) : undefined,
        veto: v || undefined,
      })).filter(Boolean);
      if (!people.length) return null;
      return { people, wishes: Array.isArray(s.w) ? s.w : null, fairness: s.f != null ? cleanFairness(+s.f / 100) : null,
        form: { c: str(s.c, 80), i: day(s.i), o: day(s.o), b: Math.max(0, Math.min(1e6, +s.b || 0)), bm: s.bm, r: s.r, mc: s.mc, k: s.k, y: s.y, bd: s.bd } };
    } catch { return null; }
  }

  // ---- Overpass: CSV statt JSON (ca. 6x kleiner). Abfrage und Spalten aus dem Kern (gleich wie beim Vorladen der Städte). ----
  // Fair zu den freiwilligen Servern: erst einer, der nächste erst nach `stagger` ms ohne Antwort oder bei Fehler.
  async function overpassFetch(bbox, outer, onTry, { f = (...a) => fetch(...a), stagger = 20000, total = 110000 } = {}) {
    const q = C.overpassQuery(bbox);
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), total);
    const stop = () => ctrl.abort();
    if (outer) outer.addEventListener('abort', stop, { once: true });
    let next = Promise.resolve();
    const tries = C.OVERPASS_SERVERS.map((url, i) => {
      const prev = next;
      let release;
      next = new Promise(r => { release = r; });
      return (async () => {
        if (i) { await Promise.race([prev, new Promise(r => setTimeout(r, stagger * i))]); if (ctrl.signal.aborted) throw new Error('abgebrochen'); if (onTry) onTry(i); }
        try {
          const r = await f(url, { method: 'POST', body: 'data=' + encodeURIComponent(q), signal: ctrl.signal });
          const text = await r.text();
          if (!r.ok || !text.startsWith('@lat')) throw new Error(`${new URL(url).host}: ${r.status}`);
          return text;
        } catch (e) { release(); throw e; }
      })();
    });
    try {
      const text = await Promise.any(tries);
      return parseCsv(text);
    } catch (e) {
      if (outer && outer.aborted) throw new DOMException('Abgebrochen', 'AbortError');
      const codes = (e.errors || []).map(x => String(x.message).split(': ').pop());
      const busy = codes.some(c => c === '429' || c === '504' || c === '503'), bad = codes.find(c => /^4\d\d$/.test(c) && c !== '429');
      throw new Error(busy ? 'Die kostenlosen OpenStreetMap-Server sind gerade überlastet (Fehler 429/504). Das passiert zu Stoßzeiten. Meist klappt es nach 1–2 Minuten.'
        : bad ? `Die OpenStreetMap-Server haben die Abfrage abgelehnt (Fehler ${bad}). Bitte später nochmal versuchen oder eine andere Stadt wählen.`
        : 'Die OpenStreetMap-Server haben nicht rechtzeitig geantwortet (Zeitüberschreitung nach ca. 2 Minuten). Bitte nochmal versuchen. Große Städte brauchen länger.');
    } finally {
      clearTimeout(timeout); ctrl.abort();
      if (outer) outer.removeEventListener('abort', stop); // sonst hängt der Listener nach Erfolg weiter am Signal
    }
  }
  // Brücke zum Plugin: alle bewerteten Viertel + Gruppe (mit type2, custom, veto: Plugin bewertet dieselbe Person wie die App)
  function tripOf({ city, checkin, checkout, nights, budget, ppl, wishes, areas }) {
    return { savedAt: Date.now(), city, checkin, checkout, nights, budget, people: ppl.map(p => cleanPerson(p)), wishes,
      areas: areas.map(a => {
        const j = a.group.scores.indexOf(a.group.min);
        return { name: a.name, lat: +a.lat.toFixed(5), lon: +a.lon.toFixed(5), total: a.group.total, min: a.group.min, minName: (ppl[j] && ppl[j].name) || null };
      }) };
  }

  // ---- Ergebnis-Karte (HTML aus Vorlagen; jeder Text aus Daten geht durch escapeHtml) ----
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const LABELS = { party: ['🍸', 'Bars/Clubs'], chill: ['🌿', 'Parks/Cafés'], sights: ['🏛️', 'Sehenswürdigkeiten'], food: ['🍝', 'Restaurants'], transit: ['🚇', 'Stationen'], shop: ['🛍️', 'Einkaufen'], sport: ['🏃', 'Sport'], kids: ['🧸', 'Kinderorte'] };
  const CORE_CATS = ['party', 'chill', 'sights', 'food', 'transit'], TIERS = ['', '€', '€€', '€€€'];
  const ico = e => `<span aria-hidden="true">${e}</span>`; // Emoji nicht vorlesen
  const dec = (v, d = 1) => v.toFixed(d).replace('.', ',');
  // Wert, nach dem gerade sortiert wird (für „fast gleichauf“); null = Sortierung ohne Wert
  const sortValue = (a, mode) => mode === 'fair' ? a.group.total : mode === 'avg' ? a.group.avg : /^p:\d+$/.test(mode) ? a.group.scores[+mode.slice(2)] : null;
  // v: Ansicht (ranked, pois, ppl, r, pool, stats, medCentre, awards, minDist, relevant, byTotal); o: { url, key, fav, cmp, sortMode }
  function cardHtml(a, i, v, o) {
    const { ranked, pois, ppl, r, pool, stats, medCentre, awards, minDist, relevant } = v, solo = ppl.length === 1;
    const best = v.byTotal[0] ? v.byTotal[0].group.total : 0;
    const usedCats = Object.keys(CATEGORIES).filter(k => ppl.some(p => p.w[k]));
    const hlCats = relevant.length ? relevant : usedCats.filter(k => k !== 'transit' && k !== 'food');
    const near = pois.filter(p => p.name && hlCats.includes(p.cat) && distM(a, p) < r)
      .sort((x, y) => (y.tags.wikidata ? 1 : 0) - (x.tags.wikidata ? 1 : 0) || distM(a, x) - distM(a, y));
    const seen = new Set(), hl = [];
    for (const p of near) { if (seen.has(p.name)) continue; seen.add(p.name); hl.push(p); if (hl.length >= 5) break; }
    // Chips nicht nur über Farbe: Symbol dazu. Anklicken zeigt, woraus der Wert besteht. Allein: Aufschlüsselung direkt.
    const chips = solo ? '' : ppl.map((p, j) => {
      const s = a.group.scores[j];
      return `<button type="button" class="chip btn2 ${s < 40 ? 'low' : s >= 70 ? 'high' : ''}" data-i="${i}" data-p="${j}" aria-expanded="false" aria-controls="bd-${i}">${s < 40 ? '⚠ ' : s >= 70 ? '✓ ' : ''}${escapeHtml(p.name)}: ${s}</button>`;
    }).join('');
    const parts = solo ? breakdown(a.norm, ppl[0].w) : [];
    const solobd = solo && parts.length ? `<div class="muted">So setzt sich der Wert zusammen: ${parts.map(x => `${escapeHtml(x.label)} <b class="${x.pts > 0 ? 'pos' : 'neg'}">${x.pts > 0 ? '+' : ''}${x.pts}</b>`).join(' · ')}</div>` : '';
    const c = a.counts;
    // Alle Personen unter 60 erklären, nicht nur die schwächste
    const whys = ppl.map((p, j) => ({ p, s: a.group.scores[j] })).filter(x => x.s < 60).sort((x, y) => x.s - y.s).slice(0, 3).map(({ p, s }) => {
      const weak = weakness(a.norm, a.counts, p.w);
      return weak ? `<div class="muted">${ico('⚠️')} ${escapeHtml(p.name)} (${s}) ${weak.kind === 'missing' ? `vermisst hier: ${weak.label} (nur ${weak.count} im Umkreis)` : `stört: viel ${weak.label} (${weak.count} im Umkreis)`}</div>` : '';
    }).join('');
    const thin = thinData(c) ? `<div class="muted">${ico('ℹ️')} Wenig Daten in OpenStreetMap für dieses Viertel (${Object.values(c).reduce((x, y) => x + y, 0)} Orte im Umkreis). Die Wertung ist hier unsicher.</div>` : '';
    const k = escapeHtml(o.key), name = escapeHtml(a.name);
    const tip = i > 0 && isSecretTip(a, best, medCentre);
    const badges = [...awards[i].map(t => `<span class="badge">${escapeHtml(t)}</span>`), tip ? '<span class="badge tip">Geheimtipp</span>' : ''].join('');
    const delta = a.delta ? `<span class="delta ${a.delta > 0 ? 'up' : 'down'}"><span aria-hidden="true">${a.delta > 0 ? '▲' : '▼'}${Math.abs(a.delta)}</span><span class="sr">${Math.abs(a.delta)} ${Math.abs(a.delta) === 1 ? 'Platz' : 'Plätze'} ${a.delta > 0 ? 'besser' : 'schlechter'} als vorher</span></span>` : '';
    const next = ranked[i + 1], sv = sortValue(a, o.sortMode);
    const tie = sv != null && next && sv - sortValue(next, o.sortMode) <= 1 ? `<div class="muted">≈ Fast gleichauf mit Platz ${i + 2} (${escapeHtml(next.name)}). Der Unterschied ist kleiner als die Genauigkeit der Daten.</div>` : '';
    const mini = usedCats.map(kk => `<div><span>${LABELS[kk][1]}<span class="sr">: ${Math.round(a.norm[kk] * 100)} %</span></span><span class="bar" aria-hidden="true"><i style="width:${Math.round(a.norm[kk] * 100)}%"></i></span></div>`).join('');
    const countsLine = Object.keys(CATEGORIES).filter(kk => CORE_CATS.includes(kk) || usedCats.includes(kk))
      .map(kk => `${ico(LABELS[kk][0])} ${c[kk]} ${LABELS[kk][1]}${stats[kk] ? ` (Ø ${stats[kk]})` : ''}`).join(' · ');
    const tr = a.nearest.transit;
    const where = `${ico('🚇')} ${tr != null ? `Bahn ${tr} m` : 'keine Bahn im Umkreis von 1,5 km'} · ${ico('📍')} ${dec(a.centerDist / 1000)} km zum Zentrum · Preislage ${TIERS[a.tier]} (grobe Schätzung aus Lage und Sehenswürdigkeiten, keine echten Preise)`;
    const neigh = pool.filter(x => x !== a && !ranked.includes(x) && distM(a, x) < minDist).slice(0, 3)
      .map(x => `<button type="button" class="link" data-ll="${x.lat},${x.lon}" aria-label="${escapeHtml(x.name)} (${x.group.total}) auf der Karte zeigen">${escapeHtml(x.name)} (${x.group.total})</button>`);
    const osm = `https://www.openstreetmap.org/?mlat=${a.lat.toFixed(5)}&mlon=${a.lon.toFixed(5)}#map=16/${a.lat.toFixed(5)}/${a.lon.toFixed(5)}`;
    return `<article class="card result" id="area-${i}" data-i="${i}" tabindex="-1" aria-labelledby="areah-${i}">
      <div class="rh"><span class="rank-num"><h3 id="areah-${i}">${i + 1}. ${name}</h3> <button type="button" class="fav" data-fav="${k}" aria-pressed="${o.fav}" aria-label="${name} als Favorit ${o.fav ? 'entfernen' : 'merken'}">${o.fav ? '♥' : '♡'}</button>${delta}</span>
        <span><span class="sr">Gesamtwert ${a.group.total} von 100, ${verdict(a.group.total)}</span><span class="score" aria-hidden="true">${a.group.total}</span><span class="verdict" aria-hidden="true">/100 · ${verdict(a.group.total)}</span></span></div>
      ${badges ? `<div class="badges">${badges}</div>` : ''}${tip ? '<div class="muted">Geheimtipp: fast so gut wie die Spitze, mit weniger Bars und Sehenswürdigkeiten, weiter vom Zentrum.</div>' : ''}
      <div class="bar" aria-hidden="true"><i style="width:${a.group.total}%"></i></div>
      <div>${escapeHtml(summary(a, ppl))}</div>${tie}
      ${chips ? `<div class="chips" role="group" aria-label="Zufriedenheit je Person. Anklicken zeigt die Zusammensetzung.">${chips}</div>` : ''}${solobd}
      <div class="breakdown" id="bd-${i}" hidden></div>
      ${whys}${thin}
      <div class="mini"><span class="sr">Stärke je Kategorie:</span>${mini}</div>
      <div class="muted">${countsLine}</div>
      <div class="muted">${where}</div>
      ${hl.length ? `<div class="muted">In der Nähe: ${hl.map(p => `<a class="sub2" href="https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lon}#map=18/${p.lat}/${p.lon}" target="_blank" rel="noopener">${escapeHtml(p.name)}<span class="sr"> (neuer Tab)</span></a>`).join(', ')}</div>` : ''}
      ${neigh.length ? `<div class="muted">Gehört zur selben Gegend: ${neigh.join(', ')}</div>` : ''}
      <div class="actions"><a class="btn" href="${o.url}" target="_blank" rel="noopener" aria-label="Unterkünfte hier auf Airbnb ansehen: ${name} (neuer Tab)">Unterkünfte hier auf Airbnb ansehen →</a>
      <a class="sub2" href="${osm}" target="_blank" rel="noopener" aria-label="Auf Karte ansehen: ${name} (neuer Tab)">Auf Karte ansehen</a>
      <label class="cmp"><input type="checkbox" data-k="${k}" ${o.cmp ? 'checked' : ''}> Vergleichen</label></div>
    </article>`;
  }

  root.StayMatch = { escapeHtml, LABELS, cardHtml, budgetSplit, typeSummary, overpassFetch, tripOf, shareEncode, shareDecode, eligibleAreas, cityKeys, parseCsv, fromFile, buildData, convertBudget, dedupePois, annotateCentre, isSecretTip, median, cityStats, verdict, summary, breakdown, whatIfWithout, awards, sortAreas, parseGroup, cleanWeights, weightsOf, cleanPerson, cleanFairness, vetoes, thinData, compareAreas, placeChoices, VETO_LIMIT, weakness, pickDiverse, CATEGORIES, PRESETS, categoriesOf, distM, scoreAreas, personScore, groupScore, nights, airbnbUrl };
})(typeof window !== 'undefined' ? window : globalThis);
