// GENERIERT aus shared/core.js – nicht bearbeiten! Änderungen in shared/core.js, dann: node scripts/sync-core.mjs
// StayMatch – gemeinsamer Kern für Web-App, Plugin und Skripte.
// NUR HIER bearbeiten, danach `node scripts/sync-core.mjs` (kopiert nach web/ und extension/).
// Klassisches Skript (MV3-Content-Scripts können keine ES-Module): setzt globalThis.StayMatchCore,
// in Node zusätzlich module.exports.
(function (root) {
  // Kategorien der Orte aus OpenStreetMap: [Schlüssel, Wert]-Paare
  const CATEGORIES = {
    party: { label: 'Party', tags: [['amenity', 'bar'], ['amenity', 'pub'], ['amenity', 'nightclub'], ['amenity', 'biergarten']] },
    chill: { label: 'Chillen', tags: [['leisure', 'park'], ['amenity', 'cafe'], ['leisure', 'garden'], ['natural', 'beach'], ['leisure', 'spa']] },
    sights: { label: 'Sightseeing', tags: [['tourism', 'attraction'], ['tourism', 'museum'], ['tourism', 'viewpoint'], ['historic', 'monument'], ['tourism', 'gallery']] },
    food: { label: 'Essen', tags: [['amenity', 'restaurant'], ['amenity', 'fast_food']] },
    transit: { label: 'ÖPNV', tags: [['railway', 'station'], ['railway', 'subway_entrance'], ['railway', 'tram_stop'], ['public_transport', 'station']] },
    shop: { label: 'Einkaufen', tags: [['shop', 'mall'], ['shop', 'department_store'], ['amenity', 'marketplace']] },
    sport: { label: 'Sport', tags: [['leisure', 'fitness_centre'], ['leisure', 'sports_centre']] },
    kids: { label: 'Kinder', tags: [['leisure', 'playground'], ['tourism', 'zoo'], ['tourism', 'theme_park']] },
  };

  // Gewichte je Typ: positiv = wichtig, negativ = stört. Jeder Typ will etwas Essen und ÖPNV.
  const PRESETS = {
    party: { label: '🎉 Party', w: { party: 1, chill: 0.1, sights: 0.1, food: 0.4, transit: 0.4, shop: 0, sport: 0, kids: 0 } },
    chill: { label: '🌿 Chill', w: { party: -0.5, chill: 1, sights: 0.2, food: 0.5, transit: 0.2, shop: 0.1, sport: 0, kids: 0 } },
    sights: { label: '🏛️ Sightseeing', w: { party: 0.1, chill: 0.2, sights: 1, food: 0.4, transit: 0.7, shop: 0.1, sport: 0, kids: 0 } },
    foodie: { label: '🍝 Foodie', w: { party: 0.2, chill: 0.2, sights: 0.2, food: 1, transit: 0.3, shop: 0, sport: 0, kids: 0 } },
    family: { label: '👨‍👩‍👧 Familie', w: { party: -0.8, chill: 1, sights: 0.6, food: 0.6, transit: 0.5, shop: 0.2, sport: 0.1, kids: 1 } },
    nature: { label: '🌲 Natur', w: { party: -0.3, chill: 1, sights: 0.4, food: 0.3, transit: 0.2, shop: 0, sport: 0.2, kids: 0.2 } },
    shopping: { label: '🛍️ Shopping', w: { party: 0, chill: 0.2, sights: 0.2, food: 0.4, transit: 0.4, shop: 1, sport: 0, kids: 0 } },
    sport: { label: '🏃 Sport', w: { party: -0.2, chill: 0.5, sights: 0.1, food: 0.3, transit: 0.3, shop: 0, sport: 1, kids: 0 } },
    culture: { label: '🎭 Kultur', w: { party: -0.1, chill: 0.3, sights: 1, food: 0.5, transit: 0.6, shop: 0.1, sport: 0, kids: 0 } },
  };

  // Radien in Metern
  const RADIUS = {
    area: 800, // Umkreis eines Viertels (Orte zählen, Airbnb-Kartenausschnitt, Highlights)
    diverse: 1200, // Mindestabstand zwischen zwei empfohlenen Vierteln
    match: 1500, // gleiches Viertel / Unterkunft gehört noch zum Viertel
  };
  const MIN_HALF = 0.04; // Mindestgröße der Suchfläche (Grad, ca. 4,4 km vom Zentrum)
  const BBOX_HALF = 0.075; // Große Städte auf ca. 16 × 16 km um das Zentrum begrenzen (Overpass-Last)
  const VISIT_WINDOW_MS = 30 * 60 * 1000; // Reload innerhalb von 30 Min. ≠ neuer Besuch

  const APP_URL = 'https://staymatch-tau.vercel.app/app';
  // Muss zu extension/manifest.json passen (Test prüft das)
  const AIRBNB_DOMAINS = ['airbnb.de', 'airbnb.com', 'airbnb.at', 'airbnb.ch', 'airbnb.co.uk', 'airbnb.fr', 'airbnb.es', 'airbnb.it', 'airbnb.nl', 'airbnb.pt',
    'airbnb.pl', 'airbnb.be', 'airbnb.dk', 'airbnb.se', 'airbnb.no', 'airbnb.fi', 'airbnb.ie', 'airbnb.gr', 'airbnb.cz', 'airbnb.com.au', 'airbnb.ca',
    'airbnb.co.nz', 'airbnb.mx', 'airbnb.com.br'];
  const STAYMATCH_ORIGINS = ['https://staymatch-tau.vercel.app', 'http://localhost:8765'];

  const OVERPASS_SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
  // OSM-Schlüssel der Abfrage in fester Reihenfolge, mit Elementtyp. Die Werte kommen aus CATEGORIES.
  const OSM_KEYS = [['amenity', 'nwr'], ['leisure', 'nwr'], ['tourism', 'nwr'], ['historic', 'node'], ['natural', 'nwr'], ['railway', 'node'], ['public_transport', 'node'], ['shop', 'nwr']];
  const PLACE_TYPES = ['suburb', 'neighbourhood', 'quarter'];
  // Spalten der CSV-Antwort (und der vorab geladenen Dateien in web/data/)
  const FIELDS = ['lat', 'lon', 'place', 'name', ...OSM_KEYS.map(([k]) => k), 'wikidata'];

  function distM(a, b) {
    const R = 6371000, toR = Math.PI / 180;
    const dLat = (b.lat - a.lat) * toR, dLon = (b.lon - a.lon) * toR;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }

  // Viertel-/Ortsnamen vergleichen (Plugin): Akzente, Satzzeichen und Artikel weg: "l'Eixample" = "Eixample", "Vila de Gràcia" = "Gracia"
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
    .replace(/^(vila de|barri de|el barri de|el|la|les|els|l|los|las|le|il|lo|der|die|das)\s+/, '');
  // Stadtname für den Index der vorab geladenen Städte: klein, ohne Akzente, Satzzeichen bleiben
  const normCity = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  function overpassFilter(type, key, values) {
    return values.length === 1 ? `${type}["${key}"="${values[0]}"]` : `${type}["${key}"~"^(${values.join('|')})$"]`;
  }

  // Overpass-Abfrage (CSV, ca. 6x kleiner als JSON) aus CATEGORIES erzeugt
  function overpassQuery(bbox) {
    const b = bbox.map(x => x.toFixed(4)).join(',');
    const lines = [overpassFilter('nwr', 'place', PLACE_TYPES)];
    for (const [key, type] of OSM_KEYS) {
      const values = [];
      for (const cat of Object.values(CATEGORIES)) for (const [k, v] of cat.tags) if (k === key && !values.includes(v)) values.push(v);
      lines.push(overpassFilter(type, key, values));
    }
    return `[out:csv(::lat,::lon,${FIELDS.slice(2).join(',')};true;"|")][timeout:90];(\n${lines.map(l => `    ${l}(${b});`).join('\n')}\n  );out center;`;
  }

  // Nominatim-Suche. lang: optional als accept-language-Parameter (Browser schickt stattdessen den Header)
  function nominatimUrl(q, lang) {
    return `https://nominatim.openstreetmap.org/search?format=json&limit=1${lang ? `&accept-language=${lang}` : ''}&q=${encodeURIComponent(q)}`;
  }

  // Erster Nominatim-Treffer → Zentrum, begrenzte Bbox [s, w, n, e], Kurzname
  function geoFromNominatim(hit) {
    let [s, n, w, e] = hit.boundingbox.map(Number);
    const lat = +hit.lat, lon = +hit.lon, h = BBOX_HALF, hl = h / Math.cos(lat * Math.PI / 180);
    s = Math.max(s, lat - h); n = Math.min(n, lat + h);
    w = Math.max(w, lon - hl); e = Math.min(e, lon + hl);
    // Winzige Treffer (ein Viertel statt einer Stadt) auf mindestens ca. 9 × 9 km aufweiten, sonst finden wir keine Nachbarviertel
    const m = MIN_HALF, ml = m / Math.cos(lat * Math.PI / 180);
    s = Math.min(s, lat - m); n = Math.max(n, lat + m); w = Math.min(w, lon - ml); e = Math.max(e, lon + ml);
    return { lat, lon, bbox: [s, w, n, e], name: hit.display_name.split(',')[0] };
  }

  const api = {
    CATEGORIES, PRESETS, RADIUS, BBOX_HALF, VISIT_WINDOW_MS, APP_URL, AIRBNB_DOMAINS, STAYMATCH_ORIGINS,
    OVERPASS_SERVERS, OSM_KEYS, PLACE_TYPES, FIELDS,
    distM, norm, normCity, overpassQuery, nominatimUrl, geoFromNominatim,
  };
  root.StayMatchCore = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
