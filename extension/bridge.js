// StayMatch – Brücke: übernimmt Wünsche, Personen, Budget und Viertel-Wertungen aus dem Viertel-Finder ins Plugin.
// Läuft nur auf der StayMatch-Website. Liest dort localStorage (gleiche Herkunft) und speichert lokal im Plugin.
// Nur bekannte Felder mit begrenzter Länge werden übernommen (kein blindes Kopieren der ganzen Seite).
(() => {
  const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : undefined;
  // R7: nur Zahl oder Zahl-Text (true wäre sonst 1)
  const num = (v, lo, hi) => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(+v) && +v >= lo && +v <= hi ? +v : undefined;
  const list = (v, max, fn) => Array.isArray(v) ? v.slice(0, max).map(fn).filter(x => x !== undefined) : undefined;
  function clean(t) {
    if (!t || typeof t !== 'object' || !num(t.savedAt, 1, 1e14)) return null;
    const out = {
      savedAt: +t.savedAt, city: str(t.city, 80), checkin: /^\d{4}-\d{2}-\d{2}$/.test(t.checkin || '') ? t.checkin : undefined,
      nights: num(t.nights, 1, 365), budget: num(t.budget, 0, 1e6),
      checkout: /^\d{4}-\d{2}-\d{2}$/.test(t.checkout || '') ? t.checkout : undefined,
      people: list(t.people, 30, p => p && typeof p === 'object' ? { name: str(p.name, 40) || '', type: str(p.type, 20) || '' } : typeof p === 'string' ? { name: p.slice(0, 40), type: '' } : undefined),
      wishes: list(t.wishes, 30, w => typeof w === 'string' ? w.slice(0, 40) : undefined),
      // R7: ohne Wert (total) ist ein Viertel nutzlos und machte den Passt-Wert NaN
      areas: list(t.areas, 300, a => a && typeof a === 'object' && num(a.total, 0, 100) !== undefined ? Object.fromEntries(Object.entries({
        name: str(a.name, 80), lat: num(a.lat, -90, 90), lon: num(a.lon, -180, 180),
        total: num(a.total, 0, 100), min: num(a.min, 0, 100), minName: str(a.minName, 40),
      }).filter(([, v]) => v !== undefined)) : undefined),
    };
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v !== undefined));
  }
  function sync() {
    try {
      const trip = clean(JSON.parse(localStorage.getItem('sm_trip') || 'null'));
      if (trip) chrome.storage.local.set({ trip });
    } catch {}
  }
  sync();
  window.addEventListener('staymatch:trip', sync); // Web-App feuert das nach jeder Suche
  // R7: in einem anderen Tab der Web-App gerechnet → kommt als storage-Event an
  window.addEventListener('storage', e => { if (!e || e.key === 'sm_trip' || e.key === null) sync(); });
  document.documentElement.dataset.staymatchExtension = '1'; // Web-App kann anzeigen: Plugin verbunden
})();
