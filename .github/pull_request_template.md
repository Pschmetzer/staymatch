## Was ändert sich und warum?

## Nummern aus IDEEN.md (falls zutreffend)

## Geprüft
Dieselben Befehle wie in `.github/workflows/ci.yml` (Kurzform: `npm test` und `npm run check`):
- [ ] `node scripts/sync-core.mjs --check`
- [ ] `node .github/scripts/check-html.mjs`, `node .github/scripts/check-domains.mjs`, `node .github/scripts/check-size.mjs`
- [ ] `node scripts/check-data.mjs`, `node scripts/build-city-pages.mjs --check`, `node scripts/build-feed.mjs --check`
- [ ] `node --test tests/*.test.js` (vorher einmal `npm ci --prefix tests --ignore-scripts` für jsdom)
- [ ] `./scripts/build-plugin-zip.sh && node .github/scripts/check-zip.mjs`
- [ ] Keine neuen Abhängigkeiten, keine neuen Fremdhosts (sonst CSP in `web/vercel.json` und `PRIVACY.md` angepasst)
- [ ] Keine persönlichen Daten in Code, Tests oder Beschreibung
