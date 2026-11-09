# Chrome Web Store: Vorbereitung

Einreichen musst du selbst (Entwicklerkonto, einmalig 5 USD): https://chrome.google.com/webstore/devconsole

**Name:** StayMatch (ohne „für Airbnb“ im Titel; im Text „funktioniert auf Airbnb-Seiten“, damit keine Herkunft nahegelegt wird)
**Kurzbeschreibung (max. 132 Zeichen):** Bewertet Unterkünfte auf der Airbnb-Suchseite für deine Reisegruppe und zeigt die Top 3. Alles lokal.
**Single Purpose (Pflichtfeld im Store):** Bewertet die Unterkünfte auf der geöffneten Suchseite für die Reisegruppe aus dem StayMatch-Viertel-Finder und zeigt die besten drei mit Begründung.
**Kategorie:** Reisen / Produktivität
**Datenschutz-URL:** https://github.com/Pschmetzer/staymatch/blob/main/PRIVACY.md

**Beschreibung:**
StayMatch hilft Gruppen, die passende Unterkunft zu finden. Öffne die Suche aus dem Viertel-Finder (https://staymatch-tau.vercel.app), und StayMatch bewertet alle Unterkünfte auf der Seite für eure Gruppe: Viertel-Wert, Sterne mit Gewichtung nach Anzahl der Bewertungen, Gesamtpreis gegen Budget, Betten. Die besten drei erscheinen mit Begründung, jede Karte bekommt einen Punktwert. Dazu: Verlauf, 👍/👎, Notizen, Preisverlauf, Export.
Kein Konto, keine Server, kein Tracking. Das Plugin liest nur Seiten, die du selbst öffnest. Unabhängig, nicht mit Airbnb verbunden. Open Source (MIT).

**Begründung der Berechtigungen (Formular):**
- `storage`: speichert Verlauf, Likes, Notizen und die Reise lokal im Browser (`chrome.storage.local`). Es wird nichts gesendet.
- Zugriff auf airbnb-Seiten: liest die geöffnete Such- und Unterkunftsseite, um Preise, Bewertungen und Lage zu bewerten.
- Zugriff auf staymatch-tau.vercel.app: übernimmt Gruppe, Budget und Viertel-Wertungen aus dem Viertel-Finder.

**Vor dem Einreichen:**
1. Plugin auf echten Airbnb-Seiten laden und testen (Suchseite UND Unterkunftsseite).
2. Bilder: Screenshots 1280×800 (Panel auf Suchseite, Popup, Viertel-Finder), kleine Werbekachel 440×280 (Pflicht) und optional große Kachel 1400×560. Echte Screenshots mit „Beispiel“ kennzeichnen.
3. Länderliste in `extension/manifest.json` auf getestete Domains kürzen.
4. `./scripts/build-plugin-zip.sh` → ZIP hochladen.
