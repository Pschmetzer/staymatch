# Sicherheit melden

Du hast eine Sicherheitslücke in StayMatch (Webseite oder Chrome-Erweiterung) gefunden? Danke, bitte melde sie zuerst nicht öffentlich.

1. Auf GitHub: **Security → Report a vulnerability** im Repository https://github.com/Pschmetzer/staymatch (private Meldung), falls diese Funktion dort sichtbar ist.
2. Sonst: ein Issue ohne technische Details öffnen („Sicherheitsmeldung, bitte privaten Weg nennen“). Die Details folgen dann privat.

> **TODO Nutzer:** E-Mail-Adresse für Sicherheitsmeldungen eintragen und prüfen, ob „Private vulnerability reporting“ in den Repository-Einstellungen eingeschaltet ist. Beides wird hier nicht erfunden.

## Geltungsbereich
- `web/` (Landingpage, Viertel-Finder) und `extension/` (Chrome-Erweiterung).
- Es gibt kein Konto und keinen eigenen Server mit Daten. Relevant sind vor allem Skript-Einschleusung, unsichere Links (z. B. aus importierten Dateien) und zu weite Berechtigungen der Erweiterung.

## Was du erwarten kannst
Es ist ein privates Projekt ohne feste Reaktionszeit. Meldungen werden nach bestem Wissen geprüft und bei Bedarf mit Nennung (auf Wunsch anonym) behoben.
