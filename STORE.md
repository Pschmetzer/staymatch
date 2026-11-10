# Chrome Web Store: Vorbereitung

Einreichen musst du selbst (Entwicklerkonto, einmalig 5 USD): https://chrome.google.com/webstore/devconsole

**Name:** StayMatch – Unterkunfts-Merkzettel (wie `name` in manifest.json; ohne „für Airbnb“ im Titel; im Text „funktioniert auf Airbnb-Seiten“, damit keine Herkunft nahegelegt wird)
**Kurzbeschreibung (max. 132 Zeichen, steht auch in manifest.json):** Bewertet jede Unterkunft auf der Suchseite nach Budget, Sternen und Wünschen und zeigt die Top 3. Alles lokal.
**Single Purpose (Pflichtfeld im Store):** Hilft bei der Auswahl einer Unterkunft: Bewertet die Unterkünfte auf der geöffneten Airbnb-Suchseite nach deinem Budget und deinen Wünschen, zeigt die besten drei mit Begründung und merkt sich auf Unterkunftsseiten deine Auswahl (👍/👎, Notizen) als lokalen Merkzettel.
**Kategorie:** Reisen / Produktivität
**Datenschutz-URL:** https://staymatch-tau.vercel.app/datenschutz (falls die Seite dort live ist, sonst https://github.com/Pschmetzer/staymatch/blob/main/PRIVACY.md; vor dem Einreichen prüfen)

**Beschreibung:**
Finde schneller die passende Unterkunft, statt 40 Inserate einzeln anzuklicken. Öffne eine normale Airbnb-Suche, und StayMatch bewertet jede Unterkunft auf der Seite: Sterne mit Gewichtung nach Anzahl der Bewertungen, Gesamtpreis gegen dein Budget pro Nacht, Betten und deine Wünsche (ganze Unterkunft, Superhost/Gäste-Favorit, viele Bewertungen, kein gewerblicher Anbieter). Die besten drei erscheinen mit Begründung, jede Karte bekommt einen Punktwert.
Optional: Der Viertel-Finder (https://staymatch-tau.vercel.app/app) sucht vorher das Stadtviertel, das zu dir passt (mit Freunden: in dem alle zufrieden sind), und übergibt Wünsche, Budget und Viertel ans Plugin.
Dazu: Verlauf, 👍/👎, Notizen, Preisverlauf, Export.
Kein Konto, keine Server, kein Tracking. Das Plugin liest nur Seiten, die du selbst öffnest. Unabhängig, nicht mit Airbnb verbunden. Open Source (MIT).

**Begründung der Berechtigungen (Formular):**
- `storage`: speichert Verlauf, Likes, Notizen und die Reise lokal im Browser (`chrome.storage.local`). Es wird nichts gesendet.
- Zugriff auf airbnb-Seiten: liest die geöffnete Such- und Unterkunftsseite, um Preise, Bewertungen und Lage zu bewerten.
- Zugriff auf staymatch-tau.vercel.app: übernimmt Gruppe, Budget und Viertel-Wertungen aus dem Viertel-Finder.

**Datennutzung (Formular):** Es werden keine Nutzerdaten gesammelt, übertragen oder verkauft. Gespeichert wird nur lokal (`chrome.storage.local`): besuchte Unterkünfte, Likes, Notizen, Einstellungen, Reise aus dem Viertel-Finder. Alle drei Zusicherungen (kein Verkauf, keine Nutzung außerhalb des Zwecks, keine Kreditwürdigkeits-Nutzung) ankreuzen.
**Remote Code:** Nein. Das Plugin lädt und führt keinen Code von außen aus; alle Skripte liegen im Paket. Es gibt keine eigenen Netzwerkanfragen.
**Inkognito:** Das Plugin ist im Inkognito-Fenster nicht aktiv (`incognito: not_allowed`), dort entsteht kein Verlauf.
**Testanleitung für Prüfer:** Plugin installieren, eine normale Airbnb-Suche öffnen (z. B. Stadt, Datum, Gäste), Panel unten rechts erscheint mit Top 3 und Punkten an den Karten. Eine Unterkunft öffnen: Panel mit 👍/👎 und Notiz. Popup (Symbol in der Leiste): Verlauf, Export. Kein Konto nötig.
**Bilder:** Das Popup lädt keine Bilder; es werden keine Anfragen an Airbnb oder Dritte gestellt.
**Ausgeschlossene Seiten:** Buchung, Kontoeinstellungen, Gastgeber-Bereich, Nachrichten und Zahlungen (`exclude_matches` im Manifest).

**Hinweise zum Markennamen:** „Airbnb“ nicht im Namen, im Symbol oder in Screenshots als Logo verwenden. In der Beschreibung nur beschreibend („für die Airbnb-Suche“) und mit „nicht mit Airbnb verbunden“.

**Vor dem Einreichen:**
1. Plugin auf echten Airbnb-Seiten laden und testen (Suchseite UND Unterkunftsseite).
2. Bilder: Screenshots 1280×800 (Panel auf Suchseite, Popup, Viertel-Finder), kleine Werbekachel 440×280 (Pflicht) und optional große Kachel 1400×560. Echte Screenshots mit „Beispiel“ kennzeichnen.
3. Länderliste (24 Domains) in `extension/manifest.json` auf getestete Domains kürzen und `localhost:8765` für den Store-Build entfernen.
4. `./scripts/build-plugin-zip.sh` → ZIP hochladen.
