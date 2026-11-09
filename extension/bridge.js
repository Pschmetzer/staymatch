// StayMatch – Brücke: übernimmt Gruppe, Budget und Viertel-Wertungen aus dem Viertel-Finder ins Plugin.
// Läuft nur auf der StayMatch-Website. Liest dort localStorage (gleiche Herkunft) und speichert lokal im Plugin.
(() => {
  function sync() {
    try {
      const trip = JSON.parse(localStorage.getItem('sm_trip') || 'null');
      if (trip && trip.savedAt) chrome.storage.local.set({ trip });
    } catch {}
  }
  sync();
  window.addEventListener('staymatch:trip', sync); // Web-App feuert das nach jeder Suche
  document.documentElement.dataset.staymatchExtension = '1'; // Web-App kann anzeigen: Plugin verbunden
  window.dispatchEvent(new Event('staymatch:extension'));
})();
