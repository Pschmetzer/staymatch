# Datenschutz bei StayMatch

Stand: 09.11.2026 (Webfassung: https://staymatch-tau.vercel.app/datenschutz). StayMatch hat kein Konto, keinen eigenen Server mit Datenbank und kein Tracking.

## Plugin (Chrome-Erweiterung)
- Liest nur Airbnb-Seiten, die du selbst öffnest. Es stellt keine eigenen Anfragen an Airbnb und fängt keine Netzwerkdaten ab.
- Gespeichert wird lokal in `chrome.storage.local`: angesehene Unterkünfte (Titel, Preis, Bewertung, Lage, Bild-Adresse), deine 👍/👎, Notizen, Preisverlauf und die Reise (Gruppe, Budget, bewertete Viertel).
- Nichts davon wird an uns oder Dritte gesendet. Löschen: Popup → „Alles löschen“, oder die Erweiterung entfernen.
- Speicherdauer: Die Daten bleiben, bis du sie löschst. Eine automatische Löschung (z. B. nach 12 Monaten) gibt es noch nicht.
- Berechtigungen: `storage` (lokaler Speicher) und Zugriff auf Airbnb-Seiten (zum Lesen der geöffneten Seite) sowie auf die StayMatch-Website (um die Reise zu übernehmen).

## Viertel-Finder (Website)
- Gruppe, Reisedaten und Budget bleiben im Browser (`localStorage`) und in einem Teilen-Link, den du selbst erzeugst. Der Teil nach `#` wird von Browsern nicht an Server gesendet. Der Link ist nur kodiert (Base64), nicht verschlüsselt: Wer ihn hat, kann Namen und Angaben lesen.
- Der eingegebene Ortsname und deine IP-Adresse gehen an
  - Nominatim (OpenStreetMap Foundation) für die Ortssuche,
  - einen der Overpass-Server (`overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee`) für die Orte,
  - die OpenStreetMap-Kartenkacheln (`tile.openstreetmap.org`) für die Karte. Die Kacheln werden **immer** von dort geladen.
  Deren Datenschutzhinweise gelten dort.
- Optional (noch nicht aktiv): Städte können vorab geladen werden (`web/data/`, Skript `scripts/prefetch-cities.mjs`). Für sie entfallen Nominatim und Overpass, die Kartenkacheln bleiben.
- Schrift (Inter) und Karten-Bibliothek (Leaflet) werden von der eigenen Seite geladen, nicht von Google oder unpkg.
- Hosting: Vercel. Dabei fallen die üblichen Server-Protokolle an (IP-Adresse, Zeitpunkt, abgerufene Datei).
- Keine Cookies. `localStorage` wird nur für eigene Funktionen genutzt (Gruppe, Reise, Design, Zwischenspeicher der Stadtdaten, 24 Stunden). `sessionStorage` hält Stadtdaten bis der Tab schließt, wenn der dauerhafte Speicher voll ist. Beides wird nicht gesendet. Darum ist kein Cookie-Banner nötig.

## Kontakt
Fragen oder Löschwünsche: Issue im Repository https://github.com/Pschmetzer/staymatch/issues (bitte keine persönlichen Daten in öffentliche Issues schreiben).

> **TODO Nutzer:** E-Mail-Adresse für Datenschutzfragen und verantwortliche Stelle eintragen. Beides fehlt absichtlich und wird nicht erfunden.

Hinweis: StayMatch ist ein unabhängiges Projekt und nicht mit Airbnb verbunden.
