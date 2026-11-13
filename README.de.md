# StayMatch

🇬🇧 [English](README.md) · 🇩🇪 Deutsch

Dein Helfer, um schneller ein passendes Airbnb zu finden. Die Chrome-Erweiterung bewertet jede Unterkunft auf der Airbnb-Suchseite nach Budget, ehrlichen Sternen und deinen Wünschen (ganze Unterkunft, Superhost, ruhig …) und zeigt die **Top 3 mit Begründung**. Optional sucht der Viertel-Finder vorher das Viertel, das zu dir passt. Dazu kommen Verlauf, 👍/👎, Notizen und Bewertungs-Stichworte. Gruppen gehen auch: Dann zählt die am wenigsten zufriedene Person mit.

**Live:** https://staymatch-tau.vercel.app · Konzept und Roadmap: [KONZEPT.md](KONZEPT.md)

## So funktioniert's
1. **Direkt:** Airbnb-Suche öffnen, im StayMatch-Panel Budget pro Nacht und Wünsche wählen (ganze Unterkunft, kein Gewerbe, Superhost, ab 20 Bewertungen, ruhig/sauber/WLAN).
2. **Optional vorher:** Im Viertel-Finder Stadt, Zeitraum, Budget, Interessen und Wünsche eingeben → passende Viertel. „Unterkünfte hier ansehen“ öffnet die Suche mit Datum, Gästen, Preisgrenze und Kartenausschnitt; Wünsche und Budget gehen ans Plugin.
3. Das Plugin bewertet alle Unterkünfte auf der Seite (Sterne mit Bayes-Mittel, Preis vs. Budget, deine Wünsche, falls bekannt Viertel, bei Gruppen Betten) und zeigt die **Top 3 mit Begründung**. Auf der Unterkunftsseite warnt es, wenn Bewertungen deinen Wünschen widersprechen. Beim Blättern sammelt das Plugin die Unterkünfte aller Seiten, die Top 3 gelten für alles, was du gesehen hast; Vergleichstabelle und „Top 3 kopieren“ helfen bei der Entscheidung. Das Plugin gibt es nur für Chrome-Browser am Computer, der Viertel-Finder läuft auch auf dem Handy.

## Web-App (`web/`)
Statisch, ohne Backend und ohne API-Keys.
```bash
python3 -m http.server 8765 -d web
```
Dann http://localhost:8765 öffnen (Landingpage) bzw. http://localhost:8765/app.html (Viertel-Finder). Seiten für Recht: `impressum.html` (Platzhalter, `TODO Nutzer`) und `datenschutz.html`. Hero-Bild oder -Video: siehe [LUMINA-PROMPTS.md](LUMINA-PROMPTS.md).

## Chrome-Erweiterung (`extension/`)
Download als ZIP: https://staymatch-tau.vercel.app/staymatch-plugin.zip (wird beim Deploy gebaut, lokal mit `./scripts/build-plugin-zip.sh`).

1. `chrome://extensions` öffnen
2. Oben rechts den **Entwicklermodus** einschalten
3. **Entpackte Erweiterung laden** → Ordner `extension/` wählen

Alle Daten bleiben lokal in `chrome.storage.local`. Das Plugin liest nur Seiten, die du selbst öffnest: kein Abrufen von Airbnb-Seiten oder -Daten, kein Hintergrund-Crawling, kein Abfangen von Netzwerkdaten. Einzige Netzwerkanfragen: die Vorschaubilder der Top 3 im Panel, geladen vom Bild-Server von Airbnb ohne Referrer.

## Daten und Hinweise
- Orte und Viertel: © [OpenStreetMap](https://www.openstreetmap.org/copyright)-Mitwirkende (ODbL), über Nominatim und Overpass. Vorab geladene Städtedaten und ihre Entstehung: [web/data/NOTICE.md](web/data/NOTICE.md).
- Kein offizielles Produkt und nicht mit Airbnb verbunden. Die Erweiterung liest nur Seiten, die du selbst öffnest.

Lizenz: Code MIT, Kartendaten ODbL (siehe [THIRD_PARTY.md](THIRD_PARTY.md))

## Entwickeln
```bash
npm ci --prefix tests              # einmalig: jsdom für die DOM-Tests (sonst werden sie übersprungen)
npm test                             # Tests
npm run check                        # alle Prüfungen (Syntax, HTML, Größen, Städtedaten, Links, ZIP)
node scripts/sync-core.mjs           # shared/ nach web/ und extension/ kopieren (nach Änderungen am Kern)
./scripts/deploy.sh                  # ZIP bauen + nach Vercel hochladen (VERCEL_SCOPE=<team> optional)
node scripts/prefetch-cities.mjs [Stadt ...]   # Stadtdaten vorab laden (web/data/), Ablauf in CONTRIBUTING.md
```
Mitmachen: [CONTRIBUTING.md](CONTRIBUTING.md) · Datenschutz: [PRIVACY.md](PRIVACY.md) · Chrome Web Store: [STORE.md](STORE.md) · Sicherheit: [SECURITY.md](SECURITY.md)
