// StayMatch – sammelt die Unterkünfte der Suchseiten, die DU nacheinander öffnest (Blättern),
// damit alle Seiten gemeinsam gerankt werden. Es wird keine Seite von selbst geladen.
// Reine Funktionen ohne chrome.*, der Speicher liegt in content-search.js.
(function (root) {
  const TTL = 2 * 3600e3, MAX = 300;
  // Diese Parameter ändern nur Seite oder Kartenausschnitt, nicht die Suche selbst
  const PAGING = ['items_offset', 'cursor', 'pagination_search', 'section_offset', 'federated_search_session_id', 'search_type',
    'ne_lat', 'ne_lng', 'sw_lat', 'sw_lng', 'zoom', 'zoom_level', 'search_by_map', 'map_toggle', 'screen_size',
    // R5-94: gleiche Liste wie in parse.js (searchKey), damit sich der Pool-Schlüssel beim Blättern nicht ändert
    'page', 'federated_search_id', 'tab_id', 'source', 'search_mode', 'bbox', '_set_bev_on_new_domain'];
  const KEEP = ['id', 'title', 'kind', 'locality', 'rating', 'reviewCount', 'totalPrice', 'currency', 'isTotal',
    'lat', 'lon', 'multiUnit', 'beds', 'bedrooms', 'baths', 'badges', 'pro', 'sleeps', 'priceWord', 'isNew', 'priceStale', 'image', 'discounted'];

  function poolKey(url) {
    const u = new URL(url);
    for (const k of PAGING) u.searchParams.delete(k);
    u.searchParams.sort();
    return u.origin + u.pathname + '?' + u.searchParams.toString();
  }
  function pageOf(url) {
    const q = new URL(url).searchParams;
    return q.get('items_offset') || q.get('cursor') || '0';
  }
  const slim = l => Object.fromEntries(KEEP.filter(k => l[k] != null).map(k => [k, l[k]]));

  // pool: { key, at, pages: [..], items: { id: slim } } oder null → neuer Stand
  function mergePool(pool, url, listings, now = Date.now()) {
    const key = poolKey(url), page = pageOf(url);
    let p = pool && pool.key === key && now - pool.at < TTL ? pool : { key, at: now, pages: [], items: {} };
    const items = { ...p.items };
    for (const l of listings) if (l.id) items[l.id] = { ...slim(l), page };
    const pages = p.pages.includes(page) ? p.pages : [...p.pages, page];
    // bei Überlauf die ältesten Seiten zuerst verwerfen. R7: nach Seitenreihenfolge, nicht nach Object.keys
    // (das sortiert kurze, numerische Ids immer nach vorn)
    const ids = Object.keys(items);
    if (ids.length > MAX) {
      const cur = new Set(listings.map(l => l.id));
      const age = i => { const k = pages.indexOf(items[i].page); return k < 0 ? -1 : k; };
      const drop = ids.filter(i => !cur.has(i)).sort((a, b) => age(a) - age(b)).slice(0, ids.length - MAX);
      for (const i of drop) delete items[i];
    }
    return { key, at: now, pages, items };
  }

  root.StayMatchPool = { poolKey, pageOf, mergePool, TTL, MAX };
})(typeof window !== 'undefined' ? window : globalThis);
