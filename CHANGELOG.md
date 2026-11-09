# Änderungen

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/). Versionsschema: `x.y.z` wie in `extension/manifest.json` (Plugin). Die Web-App wird laufend ausgeliefert und hat keine eigene Version.

## [Unveröffentlicht]

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
