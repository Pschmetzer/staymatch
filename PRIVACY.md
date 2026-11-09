# Datenschutz bei StayMatch

Stand: 09.11.2026. StayMatch hat kein Konto, keinen eigenen Server mit Datenbank und kein Tracking.

## Plugin (Chrome-Erweiterung)
- Liest nur Airbnb-Seiten, die du selbst öffnest. Es stellt keine eigenen Anfragen an Airbnb und fängt keine Netzwerkdaten ab.
- Gespeichert wird lokal in `chrome.storage.local`: angesehene Unterkünfte (Titel, Preis, Bewertung, Lage, Bild-Adresse), deine 👍/👎, Notizen, Preisverlauf und die Reise (Personen, Wünsche, Budget, bewertete Viertel).
- Nichts davon wird an uns oder Dritte gesendet. Löschen: Popup → „Alles löschen“, oder die Erweiterung entfernen.
- Berechtigungen: `storage` (lokaler Speicher) und Zugriff auf Airbnb-Seiten (zum Lesen der geöffneten Seite) sowie auf die StayMatch-Website (um die Reise zu übernehmen).

## Viertel-Finder (Website)
- Personen, Wünsche, Reisedaten und Budget bleiben im Browser (`localStorage`) und in einem Teilen-Link, den du selbst erzeugst. Der Teil nach `#` wird von Browsern nicht an Server gesendet.
- Der eingegebene Ortsname und deine IP-Adresse gehen an
  - Nominatim (OpenStreetMap Foundation) für die Ortssuche,
  - einen der Overpass-Server (`overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee`) für die Orte,
  - die OpenStreetMap-Kartenkacheln (`tile.openstreetmap.org`) für die Karte. Die Kacheln werden **immer** von dort geladen.
  Deren Datenschutzhinweise gelten dort.
- Optional (noch nicht aktiv): Städte können vorab geladen werden (`web/data/`, Skript `scripts/prefetch-cities.mjs`). Für sie entfallen Nominatim und Overpass, die Kartenkacheln bleiben.
- Schrift (Inter) und Karten-Bibliothek (Leaflet) werden von der eigenen Seite geladen, nicht von Google oder unpkg.
- Hosting: Vercel. Dabei fallen die üblichen Server-Protokolle an (IP-Adresse, Zeitpunkt, abgerufene Datei).
- Keine Cookies. `localStorage` wird nur für eigene Funktionen genutzt (Personen, Wünsche, Design, Zwischenspeicher der Stadtdaten).

## Kontakt
Fragen oder Löschwünsche: Issue im Repository https://github.com/Pschmetzer/staymatch/issues

Hinweis: StayMatch ist ein unabhängiges Projekt und nicht mit Airbnb verbunden.
