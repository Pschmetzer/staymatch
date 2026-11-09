# Mitmachen bei StayMatch

## Projektstruktur und Regeln für Mitwirkende

Kein Framework, keine npm-Abhängigkeiten, kein Server, kein Build-Schritt für Nutzer.

| Ordner | Inhalt |
|---|---|
| `shared/` | **Einzige Quelle** für gemeinsamen Code: `core.js` (Kategorien, Typen, Entfernung, Text-Normalisierung, Overpass-/Nominatim-Abfragen, Konstanten, Domains) und `i18n.js` (`t(key, vars)`, deutsches Wörterbuch, noch ungenutzt). |
| `web/` | Statische Web-App (Vercel lädt nur diesen Ordner hoch). `scoring.js` = Viertel-Bewertung; Viertel-Finder in `app-form.js` → `app-map.js` → `app-results.js` → `app-share.js` → `app-main.js`. |
| `extension/` | Chrome-Erweiterung (MV3, entpackt ladbar). Content-Scripts: `core.js` → `parse.js` → `rank.js` → `content-common.js` → `content-search.js` → `content-listing.js`. |
| `scripts/` | `sync-core.mjs`, `prefetch-cities.mjs` (nutzt `shared/core.js` per `createRequire`), ZIP-Bau, Deploy. |
| `tests/` | `node --test tests/*.test.js` |

Regeln:

1. **Kern nur in `shared/` ändern.** `web/core.js`, `web/i18n.js`, `extension/core.js` und `extension/i18n.js` sind generierte Kopien (Kopfzeile „GENERIERT … nicht bearbeiten“). Sie werden mitcommittet, weil MV3-Content-Scripts keine ES-Module können und Vercel nur `web/` hochlädt.
2. **Danach `node scripts/sync-core.mjs` ausführen** und die Kopien mitcommitten. Die CI prüft das mit `node scripts/sync-core.mjs --check`.
3. **Klassische Skripte, Reihenfolge zählt.** Die Reihenfolge steht in `web/app.html` (`core.js` zuerst, `app-main.js` zuletzt) und in `extension/manifest.json` (`core.js` zuerst, `content-listing.js` zuletzt, startet den Router). Die `app-*.js`-Dateien teilen sich den globalen Bereich: jeden globalen Namen nur einmal deklarieren.
4. **Domains** (Airbnb-Seiten, StayMatch-Herkunft) in `shared/core.js` und `extension/manifest.json` gleich halten; ein Test prüft das.
5. Vor dem Pull Request: `node --test tests/*.test.js`, `node scripts/sync-core.mjs --check`, `./scripts/build-plugin-zip.sh`.
