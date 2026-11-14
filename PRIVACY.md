# Datenschutz bei StayMatch

Stand: 13.11.2026 (Webfassung: https://staymatch.pro/datenschutz). StayMatch hat kein Konto, keinen eigenen Server mit Datenbank und kein Tracking.

## Plugin (Chrome-Erweiterung)
- Liest nur Airbnb-Seiten, die du selbst öffnest. Es fragt keine Seiten oder Daten bei Airbnb ab und fängt keine Netzwerkdaten ab.
- Bilder im Panel: Die Top-3-Karten zeigen das Vorschaubild der Unterkunft. Die Bild-Adresse stammt von der Airbnb-Seite, das Bild lädt der Browser vom Bild-Server von Airbnb (wie die Seite selbst), auch für Unterkünfte von früher gesammelten Suchseiten. Dabei wird kein Referrer mitgeschickt (`referrerpolicy="no-referrer"`); Airbnb sieht wie bei jedem Bildabruf deine IP-Adresse.
- Gespeichert wird lokal in `chrome.storage.local`: angesehene Unterkünfte (Titel, Preis, Bewertung, Lage, Bild-Adresse), deine 👍/👎, Notizen, Preisverlauf und die Reise (Personen, Wünsche, Budget, bewertete Viertel), die zuletzt geöffnete Such-Adresse (`lastSearch`), Filter (`filters`), Schnellwahl (`quick`), Einstellungen (`settings`) und den Ein-/Ausklapp-Zustand der Box (`min:*`).
- Das Plugin sammelt die Suchseiten, die du nacheinander selbst öffnest, lokal in `chrome.storage.local` (die Frist von 2 Stunden beginnt bei jeder neu gesammelten Seite von vorn), damit alle gemeinsam bewertet werden. Es lädt keine Seite von selbst nach. In die Zwischenablage schreibt es nur, wenn du auf „Kopieren“ klickst. „Fehler melden“ öffnet ein GitHub-Formular mit Versionsnummer und Zählwerten (keine Adresse, keine Seiteninhalte); gesendet wird erst, wenn du es dort selbst abschickst.
- Nichts davon wird an uns oder Dritte gesendet. Löschen: Popup → „Löschen…“ (Verlauf, Zwischenspeicher, Reise oder alles), oder die Erweiterung entfernen.
- Das Popup lädt keine Bilder und stellt keine Netzwerkanfragen. Netzwerkanfragen des Plugins gibt es nur für die genannten Vorschaubilder im Panel. Im Inkognito-Fenster ist das Plugin nicht aktiv, dort wird nichts gespeichert. Auf Buchungs-, Konto-, Gastgeber-, Nachrichten- und Zahlungsseiten läuft es nicht.
- Speicherdauer: Die Daten bleiben, bis du sie löschst. Eine automatische Löschung (z. B. nach 12 Monaten) gibt es noch nicht.
- Berechtigungen: `storage` (lokaler Speicher) und Zugriff auf Airbnb-Seiten (zum Lesen der geöffneten Seite) sowie auf die StayMatch-Website (um die Reise zu übernehmen).

## Viertel-Finder (Website)
- Personen, Wünsche, Reisedaten und Budget bleiben im Browser (`localStorage`) und in einem Teilen-Link, den du selbst erzeugst. Der Teil nach `#` wird von Browsern nicht an Server gesendet. Der Link ist nur kodiert (Base64), nicht verschlüsselt: Wer ihn hat, kann Namen und Angaben lesen.
- Der eingegebene Ortsname und deine IP-Adresse gehen an
  - Nominatim (OpenStreetMap Foundation) für die Ortssuche,
  - einen der Overpass-Server (`overpass-api.de`, `overpass.kumi.systems`, `overpass.private.coffee`) für die Orte,
  - die OpenStreetMap-Kartenkacheln (`tile.openstreetmap.org`) für die Karte. Die Kacheln werden **immer** von dort geladen.
  Deren Datenschutzhinweise gelten dort.
- Vorab geladene Städte (`web/data/`, Skript `scripts/prefetch-cities.mjs`, derzeit zehn): Für sie entfallen Nominatim und Overpass, die Kartenkacheln bleiben.
- Schrift (Inter) und Karten-Bibliothek (Leaflet) werden von der eigenen Seite geladen, nicht von Google oder unpkg.
- Hosting: Vercel. Dabei fallen die üblichen Server-Protokolle an (IP-Adresse, Zeitpunkt, abgerufene Datei).
- Keine Cookies. `localStorage` wird nur für eigene Funktionen genutzt: Personen, Wünsche, Reise, Design, das zuletzt ausgefüllte Formular (`sm_form`), der Fairness-Regler (`sm_fair`), gespeicherte Gruppen mit den Namen der Personen (`sm_groups`, bis zu 8 Gruppen), gemerkte Viertel je Stadt (`sm_fav`) und der Zwischenspeicher der Stadtdaten (24 Stunden). Gruppennamen und Personennamen sind persönliche Angaben; sie bleiben im Browser und lassen sich über die Browser-Einstellungen (Website-Daten löschen) entfernen. `sessionStorage` hält Stadtdaten bis der Tab schließt, wenn der dauerhafte Speicher voll ist. Beides wird nicht gesendet. Darum ist kein Cookie-Banner nötig.

## Kontakt
Fragen oder Löschwünsche: Issue im Repository https://github.com/Pschmetzer/staymatch/issues (bitte keine persönlichen Daten in öffentliche Issues schreiben).

> **Hinweis:** Eine E-Mail-Adresse für Datenschutzfragen und die verantwortliche Stelle sind noch nicht angegeben und werden nicht erfunden. Bis dahin: Issue im Repository (ohne persönliche Daten) oder, für Sicherheitsfragen, die vertrauliche GitHub-Meldung (siehe SECURITY.md).

Hinweis: StayMatch ist ein unabhängiges Projekt und nicht mit Airbnb verbunden.
