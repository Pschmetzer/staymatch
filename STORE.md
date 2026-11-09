# Chrome Web Store: Vorbereitung

Einreichen musst du selbst (Entwicklerkonto, einmalig 5 USD): https://chrome.google.com/webstore/devconsole

**Name:** StayMatch (ohne „für Airbnb“ im Titel; im Text „funktioniert auf Airbnb-Seiten“, damit keine Herkunft nahegelegt wird)
**Kurzbeschreibung (max. 132 Zeichen, steht auch in manifest.json):** Bewertet jede Unterkunft auf der Suchseite nach Budget, Sternen und Wünschen und zeigt die Top 3. Alles lokal.
**Single Purpose (Pflichtfeld im Store):** Bewertet die Unterkünfte auf der geöffneten Airbnb-Suchseite nach deinem Budget und deinen Wünschen und zeigt die besten drei mit Begründung.
**Kategorie:** Reisen / Produktivität
**Datenschutz-URL:** https://github.com/Pschmetzer/staymatch/blob/main/PRIVACY.md

**Beschreibung:**
Finde schneller die passende Unterkunft, statt 40 Inserate einzeln anzuklicken. Öffne eine normale Airbnb-Suche, und StayMatch bewertet jede Unterkunft auf der Seite: Sterne mit Gewichtung nach Anzahl der Bewertungen, Gesamtpreis gegen dein Budget pro Nacht, Betten und deine Wünsche (ganze Unterkunft, Superhost/Gäste-Favorit, viele Bewertungen, kein gewerblicher Anbieter). Die besten drei erscheinen mit Begründung, jede Karte bekommt einen Punktwert.
Optional: Der Viertel-Finder (https://staymatch-tau.vercel.app/app) sucht vorher das Stadtviertel, das zu dir passt (mit Freunden: in dem alle zufrieden sind), und übergibt Wünsche, Budget und Viertel ans Plugin.
Dazu: Verlauf, 👍/👎, Notizen, Preisverlauf, Export.
Kein Konto, keine Server, kein Tracking. Das Plugin liest nur Seiten, die du selbst öffnest. Unabhängig, nicht mit Airbnb verbunden. Open Source (MIT).

**Begründung der Berechtigungen (Formular):**
- `storage`: speichert Verlauf, Likes, Notizen und die Reise lokal im Browser (`chrome.storage.local`). Es wird nichts gesendet.
- Zugriff auf airbnb-Seiten: liest die geöffnete Such- und Unterkunftsseite, um Preise, Bewertungen und Lage zu bewerten.
- Zugriff auf staymatch-tau.vercel.app: übernimmt Gruppe, Budget und Viertel-Wertungen aus dem Viertel-Finder.

**Hinweise zum Markennamen:** „Airbnb“ nicht im Namen, im Symbol oder in Screenshots als Logo verwenden. In der Beschreibung nur beschreibend („für die Airbnb-Suche“) und mit „nicht mit Airbnb verbunden“.

**Vor dem Einreichen:**
1. Plugin auf echten Airbnb-Seiten laden und testen (Suchseite UND Unterkunftsseite).
2. Bilder: Screenshots 1280×800 (Panel auf Suchseite, Popup, Viertel-Finder), kleine Werbekachel 440×280 (Pflicht) und optional große Kachel 1400×560. Echte Screenshots mit „Beispiel“ kennzeichnen.
3. Länderliste in `extension/manifest.json` auf getestete Domains kürzen.
4. `./scripts/build-plugin-zip.sh` → ZIP hochladen.
