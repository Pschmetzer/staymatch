# Content-Security-Policy (web/)

- `script-src 'self'`: kein `unsafe-inline`. Seitenskripte liegen in `web/theme-*.js`, `home-de.js`, `home-en.js`, `app-boot.js`, `app-ui.js`, `page404.js`
  (der Build minifiziert sie und hängt `?v=Hash` an). Ein Test in `tests/infra.test.js` schlägt an, wenn eine Seite wieder ein Inline-Skript
  oder ein Ereignisattribut (`onclick=…`) bekommt; JSON-LD (`type="application/ld+json"`) ist Daten und nicht betroffen.
  Hashes in `vercel.json` waren nicht nötig, weil es so keine Inline-Skripte mehr gibt (Hashes pro Route hätten die Header-Regeln vervielfacht).
- `style-src 'self' 'unsafe-inline'` bleibt bewusst: Die Seiten nutzen Inline-`style="…"`-Attribute (Startseite, `/app`) und je ein `<style>`-Block
  (Stadtseiten, `/app`). Stilinjektion ist deutlich weniger gefährlich als Skriptinjektion; `default-src 'self'`, `object-src 'none'`,
  `base-uri 'self'` und `form-action` sind gesetzt. Nächster Schritt wäre, die Blöcke in CSS-Dateien zu verschieben und die Attribute durch Klassen zu ersetzen.
- Report-Only-Phase: nicht nötig und nicht eingerichtet. Der Rauchtest (`.github/scripts/e2e-smoke.mjs`) lädt die Seiten mit den echten
  Headern und schlägt bei jedem `securitypolicyviolation` fehl; ein `Reporting-Endpoints`-Endpunkt wäre zusätzlicher Dienst mit Datenschutzfolgen.
