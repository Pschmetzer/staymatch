// StayMatch – Brücke: übernimmt Gruppe, Budget und Viertel-Wertungen aus dem Viertel-Finder ins Plugin.
// Läuft nur auf der StayMatch-Website. Liest dort localStorage (gleiche Herkunft) und speichert lokal im Plugin.
(() => {
  function sync() {
    try {
      const raw = localStorage.getItem('sm_trip') || 'null';
      if (raw.length > 500000) return; // unplausibel groß
      const t = JSON.parse(raw);
      if (!t || typeof t !== 'object' || !t.savedAt || !Array.isArray(t.areas) || !Array.isArray(t.people)) return;
      const num = (v, max) => (typeof v === 'number' && isFinite(v) && v >= 0 && v <= max ? v : null);
      const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);
      const day = v => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
      // nur bekannte Felder mit passenden Typen übernehmen
      const trip = {
        savedAt: num(t.savedAt, 1e14), city: str(t.city, 80), checkin: day(t.checkin), checkout: day(t.checkout),
        nights: num(t.nights, 365), budget: num(t.budget, 1e7),
        people: t.people.slice(0, 30).map(p => ({ name: str(p?.name, 40) || 'Person', type: str(p?.type, 20) })),
        areas: t.areas.slice(0, 1000).filter(a => a && num(a.lat + 90, 180) != null && num(a.lon + 180, 360) != null).map(a => ({
          name: str(a.name, 80) || '?', alt: Array.isArray(a.alt) ? a.alt.slice(0, 4).map(x => str(x, 80)).filter(Boolean) : undefined,
          lat: a.lat, lon: a.lon, total: num(a.total, 100) ?? 0, min: num(a.min, 100) ?? 0, minName: str(a.minName, 40),
        })),
      };
      chrome.storage.local.set({ trip });
    } catch {}
  }
  sync();
  window.addEventListener('staymatch:trip', sync); // Web-App feuert das nach jeder Suche
  document.documentElement.dataset.staymatchExtension = '1'; // Web-App kann anzeigen: Plugin verbunden
  window.dispatchEvent(new Event('staymatch:extension'));
})();
