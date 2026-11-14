// Leaflet (150 KB) erst bei der ersten Eingabe oder im Leerlauf laden, nicht im kritischen Pfad. Danach die Karte neu zeichnen lassen,
// falls schon Ergebnisse da sind (app.js zeichnet sie bei Änderung von #mapWho neu). Service Worker: App-Shell und Städte offline.
(function () {
  let started = false;
  function loadMap() {
    if (started) return; started = true;
    const css = new Promise((ok) => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = '/vendor/leaflet/leaflet.css'; l.onload = l.onerror = ok; document.head.appendChild(l); });
    const js = new Promise((ok) => { const s = document.createElement('script'); s.src = '/vendor/leaflet/leaflet.js'; s.onload = s.onerror = ok; document.head.appendChild(s); });
    Promise.all([css, js]).then(() => { const w = document.getElementById('mapWho'); if (window.L && w) w.dispatchEvent(new Event('change')); });
  }
  ['pointerdown', 'keydown', 'touchstart'].forEach((t) => addEventListener(t, loadMap, { once: true, passive: true }));
  addEventListener('load', () => { if (window.requestIdleCallback) requestIdleCallback(loadMap, { timeout: 4000 }); else setTimeout(loadMap, 3000); });
  if ('serviceWorker' in navigator) addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: /^\/en\//.test(location.pathname) ? '/en/app' : '/app' }).then(() => navigator.serviceWorker.ready)
      .then((r) => setTimeout(() => r.active && r.active.postMessage('warm'), 3000)).catch(() => {});
  });
})();
