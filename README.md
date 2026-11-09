# StayMatch

Dein Helfer, um schneller ein passendes Airbnb zu finden. Du sagst, was dir wichtig ist (Gegend, Budget, Art der Unterkunft), StayMatch findet das passende Viertel und öffnet dort die Suche. Die Chrome-Erweiterung bewertet jede Unterkunft auf der Suchseite nach deinen Wünschen und zeigt die **Top 3 mit Begründung**. Dazu kommen Verlauf, 👍/👎, Notizen und Bewertungs-Stichworte. Gruppen gehen auch: Dann zählt die am wenigsten zufriedene Person mit.

**Live:** https://staymatch-tau.vercel.app · Konzept und Roadmap: [KONZEPT.md](KONZEPT.md)

## So funktioniert's
1. Stadt, Zeitraum, Budget, Interessen für die Gegend und Wünsche an die Unterkunft eingeben → passende Viertel. Optional Mitreisende hinzufügen.
2. „Unterkünfte hier ansehen“ öffnet die Suche mit Datum, Personenzahl, Preisgrenze und Kartenausschnitt.
3. Das Plugin bewertet alle Unterkünfte auf dieser Seite (Viertel-Wert, Sterne mit Bayes-Mittel, Gesamtpreis vs. Budget, deine Wünsche, bei Gruppen die Betten) und zeigt die **Top 3 mit Begründung**. Jede Karte bekommt einen Punktwert. Blättern bewertet neue Unterkünfte mit.

## Web-App (`web/`)
Statisch, ohne Backend und ohne API-Keys.
```bash
python3 -m http.server 8765 -d web
```
Dann http://localhost:8765 öffnen (Landingpage) bzw. http://localhost:8765/app.html (Viertel-Finder).

## Chrome-Erweiterung (`extension/`)
Download als ZIP: https://staymatch-tau.vercel.app/staymatch-plugin.zip (wird beim Deploy gebaut, lokal mit `./scripts/build-plugin-zip.sh`).

1. `chrome://extensions` öffnen
2. Oben rechts den **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → Ordner `extension/` wählen

Alle Daten bleiben lokal in `chrome.storage.local`. Das Plugin liest nur Seiten, die du selbst öffnest: keine eigenen Anfragen an Airbnb, kein Hintergrund-Crawling, kein Abfangen von Netzwerkdaten.

## Daten und Hinweise
- Orte und Viertel: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende (ODbL), über Nominatim und Overpass.
- Kein offizielles Produkt und nicht mit Airbnb verbunden. Die Erweiterung liest nur Seiten, die du selbst öffnest.

Lizenz: MIT

## Entwickeln
```bash
node --test tests/*.test.js          # Tests
./scripts/deploy.sh         # ZIP bauen + nach Vercel hochladen (VERCEL_SCOPE=<team> optional)
node scripts/prefetch-cities.mjs [Stadt ...]   # Stadtdaten vorab laden (web/data/)
```
Datenschutz: [PRIVACY.md](PRIVACY.md) · Chrome Web Store: [STORE.md](STORE.md)
