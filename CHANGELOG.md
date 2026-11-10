# Änderungen

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/). Versionsschema: `x.y.z` wie in `extension/manifest.json` (Plugin). Die Web-App wird laufend ausgeliefert und hat keine eigene Version.

## [Unveröffentlicht]

### Hinzugefügt
- `/.well-known/security.txt`, SHA-256-Prüfsumme neben dem Plugin-ZIP, Herkunftsnachweis (Provenance) im Release-Workflow.
- `scripts/cities.json` (Städteliste), `scripts/check-syntax.mjs`, `scripts/dev-server.mjs` (setzt die Header aus `web/vercel.json`), `.nvmrc`, `.editorconfig`, `.githooks/`, `THIRD_PARTY.md`.

### Geändert
- CI: Online-Linkcheck nur wöchentlich, Zeitlimits, npm-Cache, jsdom-Prüfung. Release-Workflow führt `npm run check` aus und nimmt den CHANGELOG-Abschnitt als Release-Text. Dependabot beobachtet `tests/`.
- `deploy.sh` prüft Stand und alle Checks und testet nach dem Deploy. `prefetch-cities.mjs` bricht bei Fehlern mit Exit-Code 1 ab und überschreibt keine Datei mit einer Teilantwort.
- Datenschutz-Texte: gespeicherte Felder des Plugins vollständig, vorab geladene Städte als aktiv beschrieben.
- Cache-Header für `/data`, `/fonts`, `/vendor`; `robots.txt` sperrt `/data/`.

## [0.5.0]

Die Tags `v0.4.0` und `v0.5.0` gibt es noch nicht, die Vergleichslinks am Ende gelten erst nach dem Taggen.

### Geändert
- Neue Ausrichtung: StayMatch ist zuerst ein Helfer für eine Person, die schneller ihr passendes Airbnb findet. Gruppen sind ein Zusatz.
- Direkt-Modus: Das Plugin funktioniert auf jeder Airbnb-Suche mit Budget pro Nacht und Wunsch-Chips, der Viertel-Finder ist optional.
- Viertel-Finder startet mit einer Person („Du“), Einzahl-Texte, kein „pro Person“.

### Hinzugefügt
- Wünsche an die Unterkunft: ganze Unterkunft, kein Gewerbe, Superhost/Favorit, ab 20 Bewertungen; ruhig, sauber, WLAN als Warnung auf der Unterkunftsseite.
- Gemeinsamer Kern in `shared/`, Runde 4 im Viertel-Finder, vorab geladene Städtedaten.

## [0.4.0]

### Hinzugefügt
- CI: Node 22 und 24, HTML-Prüfung, Domain-Abgleich Manifest/`bridge.js`/`APP_URL`, Größengrenzen, ZIP-Inhaltsprüfung, Link-Prüfung.
- Release-Workflow: Bei Tag `v*` wird das Plugin-ZIP gebaut und angehängt.
- `package.json` mit `test`, `check`, `build`, `dev`.
- Issue- und PR-Vorlagen, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, Dependabot.

### Geändert
- `build-plugin-zip.sh` schließt versteckte Dateien auf jeder Ebene aus und meldet fehlendes `zip`.
- `deploy.sh` führt vorher die Tests aus.

## [0.3.0]
- Runde 3: Entfernungsabfall, Umkreis, neue Orttypen, Neuberechnung ohne Netz, Plugin-Filter.

## [0.2.1]
- Runde 2: Datenschutz-Texte, Fehlerkorrekturen, Teilen-Link, Tests, CI.

## [0.2.0]
- Landingpage, Viertel-Finder, Plugin-ZIP zum Download.

[Unveröffentlicht]: https://github.com/Pschmetzer/staymatch/compare/main...HEAD
[0.5.0]: https://github.com/Pschmetzer/staymatch/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Pschmetzer/staymatch/compare/v0.3.0...v0.4.0
