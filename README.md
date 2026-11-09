# StayMatch

Findet das Stadtviertel, in dem eine ganze Reisegruppe zufrieden ist (z. B. 2× Party, 2× Chill, 1× Sightseeing), und öffnet dort direkt die Unterkunftssuche mit Zeitraum, Personenzahl und Budget. Dazu gibt es eine Chrome-Erweiterung als Merkzettel: Verlauf, 👍/👎, Notizen, Bewertungs-Stichworte und ein Geschmacksprofil.

**Live:** https://staymatch-tau.vercel.app · Konzept und Roadmap: [KONZEPT.md](KONZEPT.md)

## So funktioniert's
1. Im Viertel-Finder Stadt, Zeitraum, Budget und Gruppe eingeben → beste Viertel.
2. „Unterkünfte hier ansehen“ öffnet die Suche mit Datum, Personenzahl, Preisgrenze und Kartenausschnitt.
3. Das Plugin bewertet alle Unterkünfte auf dieser Seite (Viertel-Wert für die Gruppe, Sterne mit Bayes-Mittel, Gesamtpreis vs. Budget, Betten) und zeigt die **Top 3 mit Begründung**. Jede Karte bekommt einen Punktwert. Blättern bewertet neue Unterkünfte mit.

## Web-App (`web/`)
Statisch, ohne Backend und ohne API-Keys.
```bash
python3 -m http.server 8765 -d web
```
Dann http://localhost:8765 öffnen (Landingpage) bzw. http://localhost:8765/app.html (Viertel-Finder).

## Chrome-Erweiterung (`extension/`)
Download als ZIP: https://staymatch-tau.vercel.app/staymatch-plugin.zip (neu bauen mit `./scripts/build-plugin-zip.sh`).

1. `chrome://extensions` öffnen
2. Oben rechts den **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → Ordner `extension/` wählen

Alle Daten bleiben lokal in `chrome.storage.local`. Das Plugin liest nur Seiten, die du selbst öffnest: keine eigenen Anfragen an Airbnb, kein Hintergrund-Crawling, kein Abfangen von Netzwerkdaten.

## Daten und Hinweise
- Orte und Viertel: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende (ODbL), über Nominatim und Overpass.
- Kein offizielles Produkt und nicht mit Airbnb verbunden. Die Erweiterung liest nur Seiten, die du selbst öffnest.

Lizenz: MIT
