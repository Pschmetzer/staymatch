# Sicherheit

## Sicherheitslücke melden

Bitte **nicht** als öffentliches Issue. Nutze stattdessen die vertrauliche Meldung von GitHub:

👉 https://github.com/Pschmetzer/staymatch/security/advisories/new

(Reiter „Security“ → „Report a vulnerability“, *Private Vulnerability Reporting*.)

Hilfreich sind: betroffener Teil (Web-App oder Plugin), Schritte zum Nachstellen, mögliche Auswirkung. Es ist ein privates Projekt ohne feste Reaktionszeit. Meldungen werden nach bestem Wissen geprüft und bei Bedarf mit Nennung (auf Wunsch anonym) behoben.

## Was zählt

- Plugin: unerwartete Datenabflüsse, Codeausführung durch präparierte Seiten oder importierte Dateien, zu weite Berechtigungen.
- Web-App: Skriptinjektion (XSS) über Teilen-Link oder Eingaben, Lücken in der Content-Security-Policy.

Das Plugin braucht nur die Berechtigung `storage` und sendet keine Daten an eigene Server. Details: [PRIVACY.md](PRIVACY.md).

## Unterstützte Versionen

Nur der aktuelle Stand auf `main` und das neueste Plugin-Release.
