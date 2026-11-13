# Mitmachen bei StayMatch

Schön, dass du helfen willst! Ideen und offene Punkte stehen in [IDEEN.md](IDEEN.md), das Konzept in [KONZEPT.md](KONZEPT.md). Bitte beachte den [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Lokal testen

Du brauchst nur Node 22 oder neuer. Für die DOM-Tests des Plugins einmal `npm ci --prefix tests` (installiert nur jsdom), sonst kein `npm install`.

```bash
npm test          # Tests (node --test tests/*.test.js)
npm run check     # Syntax, shared/-Kopien, HTML, Manifest-Domains, Größen, Städtedaten, Links, ZIP-Inhalt
npm run build     # Plugin-ZIP nach web/staymatch-plugin.zip
npm run dev       # Web-App auf http://localhost:8765 (Node-Server, setzt die Header aus web/vercel.json)
```

`npm run check:links` prüft lokale Links. Mit `node .github/scripts/check-links.mjs --online` werden auch externe Links geprüft (CI macht das).

## Plugin ausprobieren

1. `chrome://extensions` öffnen, „Entwicklermodus“ einschalten.
2. „Entpackte Erweiterung laden“ → Ordner `extension/` wählen.
3. Eine Airbnb-Suchseite öffnen. Gespeicherte Airbnb-Seiten gehören **nicht** ins Repo (Urheberrecht, persönliche Daten).

## Pull Requests

- Kleine, thematisch getrennte PRs. Bitte die Nummern der Ideen nennen, mit Datei-Präfix, weil sich Nummern zwischen den Dateien wiederholen: `I-123` (IDEEN.md), `R4-`, `R5-`, `R6-` (IDEEN-runde4/5/6), `S-` (IDEEN-startseite.md).
- Keine neuen Abhängigkeiten ohne guten Grund. Neue Fremdhosts nur zusammen mit Anpassung der CSP in `web/vercel.json` und `PRIVACY.md`.
- Keine persönlichen Daten in Code, Tests oder Beschreibungen.
- Mit dem Merge wird nichts veröffentlicht: Die Website wird nicht automatisch ausgeliefert, das erledigt die Projektinhaberin bzw. der Projektinhaber von Hand mit `scripts/deploy.sh`. Dafür musst du nichts tun.

## Städtedaten aktualisieren (für Betreuende)

Die Dateien in `web/data/` (ODbL, siehe [NOTICE](web/data/NOTICE.md)) kommen aus OpenStreetMap. Auffrischen höchstens alle paar Wochen; die Overpass-Server sind freiwillig betrieben, und jeder Lauf vergrößert die Git-Historie um ca. 2 MB.

1. Probelauf ohne Schreiben: `node scripts/prefetch-cities.mjs --dry-run Rom` (eine Stadt, zeigt den Änderungsbericht).
2. Echter Lauf: `node scripts/prefetch-cities.mjs` (alle Städte aus `scripts/cities.json`, eine nach der anderen mit Pausen) oder einzelne Städte als Argument. Neue Städte landen automatisch in `scripts/cities.json`. Vorhandene Städte behalten Suchfläche und Zentrum ihrer Datei; neu bei Nominatim suchen nur mit `--geocode`. Bricht eine Stadt mit „unter 70 %“ ab, war die Antwort vermutlich unvollständig; erst nach Prüfung mit `--force` wiederholen.
3. Nur das Format geändert (Filter, Rundung in `scripts/city-data.mjs`)? Dann ohne Abruf: `npm run data:reprocess`.
4. Stadtseiten neu erzeugen: `node scripts/build-city-pages.mjs`, `web/sitemap.xml` prüfen (neue Stadt → Eintrag ergänzen).
5. `npm test && npm run check` (enthält `check:data`: Schema, Viertel-Typen, Alter, Brotli-Größe).
6. PR mit dem Änderungsbericht aus Schritt 2 in der Beschreibung.

## Releases (für Betreuende)

Version in `extension/manifest.json` und `package.json` erhöhen, in [CHANGELOG.md](CHANGELOG.md) eintragen, dann Tag setzen (`git tag v0.5.1 && git push origin v0.5.1`). Der Release-Workflow baut das ZIP und legt ein Release als **Entwurf** an; veröffentlichen von Hand auf GitHub. Builds zwischen zwei Releases tragen im Manifest `version_name` mit Commit-Kurz-SHA. Der Tag muss zur Manifest-Version passen.

## Begriffe und Datenfluss

- **Viertel**: Stadtteil, den die App nach Orten in der Nähe (Cafés, Haltestellen, Parks …) bewertet.
- **Typ**: Art der Reise bzw. Gewichtung der Orte (z. B. Ruhe, Nachtleben).
- **Direkt-Modus**: Das Plugin bewertet Airbnb-Seiten allein anhand von Budget und Wunsch-Chips, ohne Viertel-Finder.
- **Pool**: Unterkünfte der Suchseiten, die du nacheinander öffnest; sie werden gemeinsam gerankt (`extension/pool.js`).

Datenfluss: Web-App → `bridge.js` (nur auf der StayMatch-Seite) → `chrome.storage.local` → `rank.js` im Plugin. Es gibt keinen Server dazwischen.

English summary: StayMatch is a static web app (`web/`) plus a Chrome extension (`extension/`); shared code lives only in `shared/` and is copied with `node scripts/sync-core.mjs`. Run `npm test` and `npm run check` before opening a pull request. Contributions in German or English are welcome.

## Projektstruktur und Regeln für Mitwirkende

Kein Framework, keine Laufzeit-Abhängigkeiten, kein Server, kein Build-Schritt für Nutzer. Einzige Entwicklungs-Abhängigkeit: `jsdom` für die DOM-Tests des Plugins (`npm ci --prefix tests`; ohne sie werden diese Tests übersprungen).

| Ordner | Inhalt |
|---|---|
| `shared/` | **Einzige Quelle** für gemeinsamen Code: `core.js` (Kategorien, Typen, Entfernung, Text-Normalisierung, Overpass-/Nominatim-Abfragen, Zeilen dekodieren, Viertel erkennen, Konstanten, Domains) und `i18n.js` (`t(key, vars)`, deutsches Wörterbuch, noch ungenutzt, nur ins Plugin kopiert). |
| `web/` | Statische Web-App (Vercel lädt nur diesen Ordner hoch). `scoring.js` = Viertel-Bewertung; Viertel-Finder in `app.js`. |
| `extension/` | Chrome-Erweiterung (MV3, entpackt ladbar). Content-Scripts: `core.js` → `parse.js` → `rank.js` → `content-common.js` → `content-search.js` → `content-listing.js`. |
| `scripts/` | `sync-core.mjs`, `prefetch-cities.mjs` + `city-data.mjs` + `check-data.mjs` (Städtedaten), `build-city-pages.mjs` (Stadtseiten), ZIP-Bau, Deploy. |
| `tests/` | `node --test tests/*.test.js` |

Regeln:

1. **Kern nur in `shared/` ändern.** `web/core.js`, `extension/core.js` und `extension/i18n.js` sind generierte Kopien (Kopfzeile „GENERIERT … nicht bearbeiten“). Sie werden mitcommittet, weil MV3-Content-Scripts keine ES-Module können und Vercel nur `web/` hochlädt.
2. **Danach `node scripts/sync-core.mjs` ausführen** und die Kopien mitcommitten. Die CI prüft das mit `node scripts/sync-core.mjs --check`.
3. **Klassische Skripte, Reihenfolge zählt.** Die Reihenfolge steht in `web/app.html` (`core.js` zuerst, `app.js` zuletzt) und in `extension/manifest.json` (`core.js` zuerst, `content-listing.js` zuletzt, startet den Router). Alle Skripte teilen sich den globalen Bereich: jeden globalen Namen nur einmal deklarieren.
4. **Domains** (Airbnb-Seiten, StayMatch-Herkunft) in `shared/core.js` und `extension/manifest.json` gleich halten; ein Test prüft das.
5. Vor dem Pull Request: `npm test && npm run check` (enthält Syntax, `sync-core --check`, Städtedaten und den ZIP-Bau).
