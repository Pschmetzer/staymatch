# Städtedaten

Die JSON-Dateien in diesem Ordner enthalten Orte (Cafés, Haltestellen, Parks usw.) und Viertel aus OpenStreetMap.

© OpenStreetMap-Mitwirkende, Open Database License (ODbL) 1.0.
https://www.openstreetmap.org/copyright · https://opendatacommons.org/licenses/odbl/1-0/

**Share-Alike:** Die Dateien sind eine abgeleitete Datenbank. Wer sie verändert und weitergibt, muss sie ebenfalls unter ODbL stellen und OpenStreetMap nennen. Der Code des Projekts (MIT) bleibt davon getrennt. Die Stadtseiten in `web/staedte/` sind daraus erzeugte Werke (Produced Works) und nennen die Quelle selbst.

## Wie die Daten entstehen (ODbL 4.6)

Erzeugt mit [`scripts/prefetch-cities.mjs`](../../scripts/prefetch-cities.mjs) (Städteliste: [`scripts/cities.json`](../../scripts/cities.json)), aufbereitet mit [`scripts/city-data.mjs`](../../scripts/city-data.mjs):

1. **Ort:** Nominatim-Suche nach dem Stadtnamen, erster passender Treffer. Suchfläche um das Zentrum auf ca. 16 × 16 km begrenzt (`geoFromNominatim` in [`shared/core.js`](../../shared/core.js)).
2. **Abfrage:** eine Overpass-Abfrage (`overpassQuery` in `shared/core.js`): Viertel (`place=suburb|neighbourhood|quarter`) und Orte der Kategorien in `CATEGORIES` (Bars, Cafés, Parks, Sehenswürdigkeiten, ÖPNV, Einkaufen, Sport, Kinder). Spalten: Feld `fields`.
3. **Aufbereitung:** Koordinaten auf 5 Nachkommastellen gerundet, Punkte mehr als 0,01° außerhalb der Suchfläche verworfen, Namen von Rand- und Mehrfach-Leerzeichen befreit, `place` nur für echte Viertel behalten, Wikidata-Nummer durch den Merker `1` ersetzt, Zeilen ohne Viertel und ohne Kategorie verworfen; die Reihenfolge der Overpass-Antwort bleibt erhalten. Die Anführungszeichen, die Overpass in CSV um Namen mit Komma setzt, werden entfernt. Antworten mit weniger als 200 Zeilen oder unter 70 % der bisherigen Zeilen werden nicht übernommen.

Felder jeder Datei: `v` (Schema-Version), `t` (Abrufzeitpunkt, ms), `city`, `center` (Zentrum laut Nominatim; bei den ersten zehn Städten am 13.11.2026 nachgetragen), `bbox` ([Süd, West, Nord, Ost]), `fields`, `license`, `attribution`, `source` (Overpass-Server), `ms` (Abrufdauer), `queryHash` (Version der Abfrage), `rows`.

## Abrufdaten je Stadt

<!-- staedte:start -->
| Stadt | Datei | Abruf | Zeilen |
| --- | --- | --- | --- |
| Amsterdam | `amsterdam.json` | 2026-11-13 | 18060 |
| Barcelona | `barcelona.json` | 2026-11-13 | 16571 |
| Berlin | `berlin.json` | 2026-11-13 | 20570 |
| Budapest | `budapest.json` | 2026-11-13 | 9323 |
| Lissabon | `lissabon.json` | 2026-11-13 | 7881 |
| Madrid | `madrid.json` | 2026-11-13 | 26978 |
| Paris | `paris.json` | 2026-11-13 | 28222 |
| Prag | `prag.json` | 2026-11-13 | 13494 |
| Rom | `rom.json` | 2026-11-13 | 10641 |
| Wien | `wien.json` | 2026-11-13 | 13814 |
<!-- staedte:end -->

## English

The JSON files in this folder contain places and neighbourhoods from OpenStreetMap. © OpenStreetMap contributors, available under the Open Database License (ODbL) 1.0. They are a derivative database: if you change and share them, you must share them under the ODbL and credit OpenStreetMap. The project code (MIT) is separate. They are built with `scripts/prefetch-cities.mjs` and `scripts/city-data.mjs` as described above (one Nominatim lookup, one Overpass query per city, coordinates rounded to 5 digits, points outside the search box dropped, `place` kept only for real neighbourhoods). The table above lists the retrieval date per city.
