# Drittanbieter

| Bestandteil | Lizenz / Regeln | Wo |
|---|---|---|
| Inter (Schrift) | SIL Open Font License 1.1 | `web/fonts/` |
| Leaflet (Karten-Bibliothek) | BSD-2-Clause | `web/vendor/` |
| OpenStreetMap-Daten | ODbL 1.0, © OpenStreetMap-Mitwirkende; Erzeugung und Share-Alike: [web/data/NOTICE.md](web/data/NOTICE.md) | `web/data/` (abgeleitete Datenbank), `web/staedte/*.html` (daraus erzeugte Werke mit eigener Quellenangabe), Live-Abfragen |
| OpenStreetMap-Kartenkacheln | [Tile Usage Policy](https://operations.osmfoundation.org/policies/tiles/) | `tile.openstreetmap.org` |
| Nominatim | [Nutzungsregeln](https://operations.osmfoundation.org/policies/nominatim/): höchstens 1 Anfrage pro Sekunde, kenntlicher User-Agent, Ergebnisse zwischenspeichern | `nominatim.openstreetmap.org` |
| Overpass-API | Fair-Use der freiwilligen Server, Pausen zwischen Abfragen | `overpass-api.de` u. a. |
| jsdom (nur Tests) | MIT | `tests/package.json` |

Lizenztexte: Inter in [`web/fonts/OFL.txt`](web/fonts/OFL.txt), Leaflet in [`web/vendor/leaflet/LICENSE`](web/vendor/leaflet/LICENSE), jsdom im npm-Paket. Dieses Projekt ist nicht mit Airbnb verbunden.
