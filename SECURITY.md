# Sicherheit

## Sicherheitslücke melden

Bitte **nicht** als öffentliches Issue. Nutze stattdessen die vertrauliche Meldung von GitHub:

👉 https://github.com/Pschmetzer/staymatch/security/advisories/new

(Reiter „Security“ → „Report a vulnerability“, *Private Vulnerability Reporting*.)

Hilfreich sind: betroffener Teil (Web-App oder Plugin), Schritte zum Nachstellen, mögliche Auswirkung. Es ist ein Open-Source-Projekt (MIT) in der Freizeit, ohne Vertrag. Ziel: Eingangsbestätigung binnen 7 Tagen, eine Einschätzung binnen 30 Tagen. Bitte gib uns 90 Tage bis zur Veröffentlichung, bei Bedarf stimmen wir eine Verlängerung ab. Gemeldetes wird bei Bedarf mit Nennung (auf Wunsch anonym) behoben. Maschinenlesbar: [security.txt](https://staymatch-tau.vercel.app/.well-known/security.txt).

## Was zählt

- Plugin: unerwartete Datenabflüsse, Codeausführung durch präparierte Seiten oder importierte Dateien, zu weite Berechtigungen.
- Web-App: Skriptinjektion (XSS) über Teilen-Link oder Eingaben, Lücken in der Content-Security-Policy.

Das Plugin nutzt die Berechtigung `storage` und Zugriff auf Airbnb-Seiten (24 Länder-Domains, zum Lesen der geöffneten Seite) sowie auf die StayMatch-Website (Reise übernehmen); siehe `content_scripts` in `extension/manifest.json`. Es sendet keine Daten an eigene Server. Details: [PRIVACY.md](PRIVACY.md).

## Unterstützte Versionen

Nur der aktuelle Stand auf `main` und das neueste Plugin-Release.
