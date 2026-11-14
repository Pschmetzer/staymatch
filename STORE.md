# Chrome Web Store: Vorbereitung (Deutsch, English below)

Sprachen: Die Erweiterung erscheint auf Deutsch (Airbnb .de/.at/.ch bzw. deutsche Browsersprache) und sonst auf Englisch; in den Optionen lässt sich die Sprache festlegen. Name und Kurzbeschreibung kommen aus `extension/_locales/{de,en}/messages.json` (`default_locale: de`). Store-Texte: unten DE, danach EN (beide im Entwicklerkonto als eigene Sprachversionen eintragen).

Einreichen musst du selbst (Entwicklerkonto, einmalig 5 USD): https://chrome.google.com/webstore/devconsole

**Name:** StayMatch – Unterkunfts-Merkzettel (wie `name` in manifest.json; ohne „für Airbnb“ im Titel; im Text „funktioniert auf Airbnb-Seiten“, damit keine Herkunft nahegelegt wird)
**Kurzbeschreibung (max. 132 Zeichen, steht auch in manifest.json):** Bewertet jede Unterkunft auf der Suchseite nach Budget, Sternen und Wünschen und zeigt die Top 3. Alles lokal.
**Single Purpose (Pflichtfeld im Store):** Hilft bei der Auswahl einer Unterkunft: Bewertet die Unterkünfte auf der geöffneten Airbnb-Suchseite nach deinem Budget und deinen Wünschen, zeigt die besten drei mit Begründung und merkt sich auf Unterkunftsseiten deine Auswahl (👍/👎, Notizen) als lokalen Merkzettel.
**Kategorie:** Reisen / Produktivität
**Datenschutz-URL:** https://staymatch.pro/datenschutz (falls die Seite dort live ist, sonst https://github.com/Pschmetzer/staymatch/blob/main/PRIVACY.md; vor dem Einreichen prüfen)

**Beschreibung:**
Finde schneller die passende Unterkunft, statt 40 Inserate einzeln anzuklicken. Öffne eine normale Airbnb-Suche, und StayMatch bewertet jede Unterkunft auf der Seite: Sterne mit Gewichtung nach Anzahl der Bewertungen, Gesamtpreis gegen dein Budget pro Nacht, Betten und deine Wünsche (ganze Unterkunft, Superhost/Gäste-Favorit, viele Bewertungen, kein gewerblicher Anbieter). Die besten drei erscheinen mit Begründung, jede Karte bekommt einen Punktwert.
Optional: Der Viertel-Finder (https://staymatch.pro/app) sucht vorher das Stadtviertel, das zu dir passt (mit Freunden: in dem alle zufrieden sind), und übergibt Wünsche, Budget und Viertel ans Plugin.
Dazu: Verlauf, 👍/👎, Notizen, Preisverlauf, Export (Sicherung, bereinigte Datei, Kalender), Optionen-Seite (Panel-Position, Badge mit Zahl der Unterkünfte, Erinnerung vor Ablauf der kostenlosen Stornierung als Opt-in), Druckseite der Top 3 und eine Seitendiagnose im Popup.
Kein Konto, keine Server, kein Tracking. Das Plugin liest nur Seiten, die du selbst öffnest. Unabhängig, nicht mit Airbnb verbunden. Open Source (MIT).

**Begründung der Berechtigungen (Formular):**
- `storage`: speichert Verlauf, Likes, Notizen und die Reise lokal im Browser (`chrome.storage.local`). Es wird nichts gesendet.
- `alarms` (optional, erst auf Klick bei „Erinnerung“ in den Optionen): ein lokaler Wecker für die Erinnerung vor Ablauf der kostenlosen Stornierung einer gebuchten Unterkunft.
- `notifications` (optional, gleicher Klick): zeigt diese Erinnerung als Benachrichtigung. Ohne Erlaubnis gibt es keine Erinnerung.
- Zugriff auf airbnb-Seiten: liest die geöffnete Such- und Unterkunftsseite, um Preise, Bewertungen und Lage zu bewerten.
- Zugriff auf staymatch.pro: übernimmt Gruppe, Budget und Viertel-Wertungen aus dem Viertel-Finder.

**Datennutzung (Formular):** Es werden keine Nutzerdaten gesammelt, übertragen oder verkauft. Gespeichert wird nur lokal (`chrome.storage.local`): besuchte Unterkünfte, Likes, Notizen, Einstellungen, Reise aus dem Viertel-Finder. Alle drei Zusicherungen (kein Verkauf, keine Nutzung außerhalb des Zwecks, keine Kreditwürdigkeits-Nutzung) ankreuzen.
**Remote Code:** Nein. Das Plugin lädt und führt keinen Code von außen aus; alle Skripte liegen im Paket. Einzige Netzwerkanfragen: Vorschaubilder der Top-3-Unterkünfte im Panel, geladen vom Bild-Server von Airbnb (Adresse stammt von der Airbnb-Seite, ohne Referrer).
**Inkognito:** Das Plugin ist im Inkognito-Fenster nicht aktiv (`incognito: not_allowed`), dort entsteht kein Verlauf.
**Testanleitung für Prüfer:** Plugin installieren, eine normale Airbnb-Suche öffnen (z. B. Stadt, Datum, Gäste), Panel unten rechts erscheint mit Top 3 und Punkten an den Karten. Eine Unterkunft öffnen: Panel mit 👍/👎 und Notiz. Popup (Symbol in der Leiste): Verlauf, Export. Kein Konto nötig.
**Bilder:** Das Popup lädt keine Bilder. Das Panel auf der Suchseite zeigt Vorschaubilder der Top 3; der Browser lädt sie vom Bild-Server von Airbnb (wie die Seite selbst, ohne Referrer), auch für Unterkünfte früher gesammelter Suchseiten. Anfragen an Dritte außer Airbnb gibt es nicht.
**Ausgeschlossene Seiten:** Buchung, Kontoeinstellungen, Gastgeber-Bereich, Nachrichten und Zahlungen (`exclude_matches` im Manifest).

**Hinweise zum Markennamen:** „Airbnb“ nicht im Namen, im Symbol oder in Screenshots als Logo verwenden. In der Beschreibung nur beschreibend („für die Airbnb-Suche“) und mit „nicht mit Airbnb verbunden“.

**Vor dem Einreichen:**
1. Plugin auf echten Airbnb-Seiten laden und testen (Suchseite UND Unterkunftsseite).
2. Bilder: Screenshots 1280×800 (Panel auf Suchseite, Popup, Viertel-Finder), kleine Werbekachel 440×280 (Pflicht) und optional große Kachel 1400×560. Echte Screenshots mit „Beispiel“ kennzeichnen.
3. Länderliste (24 Domains) in `extension/manifest.json` auf getestete Domains kürzen und `localhost:8765` für den Store-Build entfernen.
4. `./scripts/build-plugin-zip.sh` → ZIP hochladen.

---

# Chrome Web Store: preparation (English)

You have to submit it yourself (developer account, one-time USD 5): https://chrome.google.com/webstore/devconsole. Add this block as the English listing; the German block above is the default listing.

**Name:** StayMatch – Stay Shortlist (same as `extName` in `_locales/en/messages.json`; no "for Airbnb" in the title; the text says "works on Airbnb pages" so no affiliation is implied)
**Short description (max 132 characters, also in `_locales/en`):** Scores every listing on the search page by budget, stars and your wishes and shows the top 3. Everything stays local.
**Single purpose (required field):** Helps you choose a place to stay: scores the listings on the Airbnb search page you have open by your budget and wishes, shows the best three with reasons, and keeps your picks (thumbs up/down, notes) on listing pages as a local shortlist.
**Category:** Travel / Productivity
**Privacy policy URL:** https://staymatch.pro/datenschutz (German; check before submitting)

**Description:**
Find the right place faster instead of clicking through 40 listings one by one. Open a normal Airbnb search and StayMatch scores every listing on the page: stars weighted by number of reviews, total price against your budget per night, beds and your wishes (entire place, Superhost/guest favourite, many reviews, not a commercial host). The best three appear in a panel with reasons and warnings; every card gets a score badge.
Optional: the neighbourhood finder (https://staymatch.pro/app) first finds the area that suits you (with friends: the one everybody is happy with) and hands wishes, budget and areas to the extension.
Also: history, thumbs up/down, notes, price history, export (backup, cleaned file, calendar), an options page (panel position, badge with the number of listings, reminder before free cancellation ends as an opt-in), a printable top 3 page and a page diagnosis in the popup.
No account, no servers, no tracking. The extension only reads pages you open yourself. Independent, not affiliated with Airbnb. Open source (MIT).

**Permission justifications (form):**
- `storage`: keeps history, likes, notes and the trip locally in the browser (`chrome.storage.local`). Nothing is sent.
- `alarms` (optional, only on your click on "Reminder" in the options): a local alarm for the reminder before the free cancellation of a booked stay ends.
- `notifications` (optional, same click): shows that reminder as a notification. Without your permission there is no reminder.
- Access to airbnb pages: reads the open search and listing page to score prices, ratings and location.
- Access to staymatch.pro: takes over group, budget and area scores from the neighbourhood finder.

**Data usage (form):** No user data is collected, transmitted or sold. Only local storage (`chrome.storage.local`): visited listings, likes, notes, settings, trip from the neighbourhood finder. Tick all three assurances (no sale, no use beyond the purpose, no creditworthiness use).
**Remote code:** No. The extension neither loads nor runs code from outside; all scripts are in the package. The only network requests: preview images of the top 3 listings in the panel, loaded from Airbnb's image server (address taken from the Airbnb page, no referrer).
**Incognito:** The extension is not active in incognito windows (`incognito: not_allowed`), so no history is created there.
**Test instructions for reviewers:** Install, open a normal Airbnb search (city, dates, guests); the panel appears bottom right with the top 3 and scores on the cards. Open a listing: panel with thumbs up/down and a note. Popup (toolbar icon): history, export. No account needed. To see the English interface use airbnb.com (or set Language to English in the options).
**Excluded pages:** booking, account settings, hosting area, messages and payments (`exclude_matches` in the manifest).
