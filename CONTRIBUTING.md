# Mitmachen

Schön, dass du helfen willst! Ideen und offene Punkte stehen in [IDEEN.md](IDEEN.md), das Konzept in [KONZEPT.md](KONZEPT.md). Bitte beachte den [Verhaltenskodex](CODE_OF_CONDUCT.md).

## Lokal testen

Du brauchst nur Node 22 oder neuer. Es gibt keine Abhängigkeiten, kein `npm install`.

```bash
npm test          # Tests (node --test tests/*.test.js)
npm run check     # Syntax, HTML, Manifest-Domains, Größen, Links, ZIP-Inhalt
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
