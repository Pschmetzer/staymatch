# Mitmachen bei StayMatch

Schön, dass du helfen willst! Ideen und offene Punkte stehen in [IDEEN.md](IDEEN.md), das Konzept in [KONZEPT.md](KONZEPT.md). Bitte beachte den [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Lokal testen

Du brauchst nur Node 22 oder neuer. Für die DOM-Tests des Plugins einmal `npm ci --prefix tests` (installiert nur jsdom), sonst kein `npm install`.

```bash
npm test          # Tests (node --test tests/*.test.js)
npm run check     # Syntax, shared/-Kopien, HTML, Manifest-Domains, Größen, Links, ZIP-Inhalt
npm run build     # Plugin-ZIP nach web/staymatch-plugin.zip
npm run dev       # Web-App auf http://localhost:8765 (braucht python3)
```

`npm run check:links` prüft lokale Links. Mit `node .github/scripts/check-links.mjs --online` werden auch externe Links geprüft (CI macht das).

## Plugin ausprobieren

1. `chrome://extensions` öffnen, „Entwicklermodus“ einschalten.
2. „Entpackte Erweiterung laden“ → Ordner `extension/` wählen.
3. Eine Airbnb-Suchseite öffnen. Gespeicherte Airbnb-Seiten gehören **nicht** ins Repo (Urheberrecht, persönliche Daten).

## Pull Requests

- Kleine, thematisch getrennte PRs. Bitte die Nummern aus IDEEN.md nennen.
- Keine neuen Abhängigkeiten ohne guten Grund. Neue Fremdhosts nur zusammen mit Anpassung der CSP in `web/vercel.json` und `PRIVACY.md`.
- Keine persönlichen Daten in Code, Tests oder Beschreibungen.
- Vercel-Auto-Deploy ist absichtlich aus. Deployt wird nur manuell mit `scripts/deploy.sh` durch die Projektinhaberin bzw. den Projektinhaber.

## Releases (für Betreuende)

Version in `extension/manifest.json` und `package.json` erhöhen, in [CHANGELOG.md](CHANGELOG.md) eintragen, dann Tag setzen (`git tag v0.3.1 && git push origin v0.3.1`). Der Release-Workflow baut das ZIP und hängt es an das Release. Der Tag muss zur Manifest-Version passen.

## Projektstruktur und Regeln für Mitwirkende

Kein Framework, keine Laufzeit-Abhängigkeiten, kein Server, kein Build-Schritt für Nutzer. Einzige Entwicklungs-Abhängigkeit: `jsdom` für die DOM-Tests des Plugins (`npm ci --prefix tests`; ohne sie werden diese Tests übersprungen).

| Ordner | Inhalt |
|---|---|
| `shared/` | **Einzige Quelle** für gemeinsamen Code: `core.js` (Kategorien, Typen, Entfernung, Text-Normalisierung, Overpass-/Nominatim-Abfragen, Konstanten, Domains) und `i18n.js` (`t(key, vars)`, deutsches Wörterbuch, noch ungenutzt). |
| `web/` | Statische Web-App (Vercel lädt nur diesen Ordner hoch). `scoring.js` = Viertel-Bewertung; Viertel-Finder in `app.js`. |
| `extension/` | Chrome-Erweiterung (MV3, entpackt ladbar). Content-Scripts: `core.js` → `parse.js` → `rank.js` → `content-common.js` → `content-search.js` → `content-listing.js`. |
| `scripts/` | `sync-core.mjs`, `prefetch-cities.mjs` (nutzt `shared/core.js` per `createRequire`), ZIP-Bau, Deploy. |
| `tests/` | `node --test tests/*.test.js` |

Regeln:

1. **Kern nur in `shared/` ändern.** `web/core.js`, `web/i18n.js`, `extension/core.js` und `extension/i18n.js` sind generierte Kopien (Kopfzeile „GENERIERT … nicht bearbeiten“). Sie werden mitcommittet, weil MV3-Content-Scripts keine ES-Module können und Vercel nur `web/` hochlädt.
2. **Danach `node scripts/sync-core.mjs` ausführen** und die Kopien mitcommitten. Die CI prüft das mit `node scripts/sync-core.mjs --check`.
3. **Klassische Skripte, Reihenfolge zählt.** Die Reihenfolge steht in `web/app.html` (`core.js` zuerst, `app.js` zuletzt) und in `extension/manifest.json` (`core.js` zuerst, `content-listing.js` zuletzt, startet den Router). Alle Skripte teilen sich den globalen Bereich: jeden globalen Namen nur einmal deklarieren.
4. **Domains** (Airbnb-Seiten, StayMatch-Herkunft) in `shared/core.js` und `extension/manifest.json` gleich halten; ein Test prüft das.
5. Vor dem Pull Request: `node --test tests/*.test.js`, `node scripts/sync-core.mjs --check`, `./scripts/build-plugin-zip.sh`.
