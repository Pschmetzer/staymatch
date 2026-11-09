// StayMatch Viertel-Finder – Karte (Leaflet)
let map, layer;
function renderMap(ranked, geo, r = C.RADIUS.area) {
  if (!window.L) return;
  $('map').hidden = false;
  if (!map) {
    map = L.map('map');
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(map);
  }
  map.invalidateSize();
  // Ausschnitt nur ändern, wenn sich die Auswahl ändert (sonst springt die Karte bei jeder Änderung zurück)
  const key = ranked.map(a => a.name).join('|');
  if (key !== renderMap.key) { renderMap.key = key; map.fitBounds(L.latLngBounds(ranked.map(a => [a.lat, a.lon])).pad(0.3)); }
  if (layer) layer.remove();
  layer = L.layerGroup(ranked.map((a, i) => L.circle([a.lat, a.lon], { radius: Math.round(r * 0.75), color: i === 0 ? '#e0475b' : '#888', weight: 2, fillOpacity: 0.12 })
    .bindTooltip(`${i + 1}. ${a.name} (${a.group.total})`, { permanent: i < 3 }))).addTo(map);
}
