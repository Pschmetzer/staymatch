# StayMatch

Findet das Stadtviertel, in dem eine ganze Reisegruppe zufrieden ist (z. B. 2× Party, 2× Chill, 1× Sightseeing), und öffnet dort direkt die Unterkunftssuche mit Zeitraum, Personenzahl und Budget. Dazu gibt es eine Chrome-Erweiterung als Merkzettel: Verlauf, 👍/👎, Notizen, Bewertungs-Stichworte und ein Geschmacksprofil.

Konzept und Roadmap: [KONZEPT.md](KONZEPT.md)

## Web-App (`web/`)
Statisch, ohne Backend und ohne API-Keys.
```bash
python3 -m http.server 8765 -d web
```
Dann http://localhost:8765 öffnen.

## Chrome-Erweiterung (`extension/`)
1. `chrome://extensions` öffnen
2. Oben rechts den **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → Ordner `extension/` wählen

Alle Daten bleiben lokal in `chrome.storage.local`.

## Daten und Hinweise
- Orte und Viertel: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende (ODbL), über Nominatim und Overpass.
- Kein offizielles Produkt und nicht mit Airbnb verbunden. Die Erweiterung liest nur Seiten, die du selbst öffnest.

Lizenz: MIT
