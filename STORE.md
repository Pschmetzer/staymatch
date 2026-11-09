# Chrome Web Store: Vorbereitung

Einreichen musst du selbst (Entwicklerkonto, einmalig 5 USD): https://chrome.google.com/webstore/devconsole

**Name:** StayMatch
**Kurzbeschreibung (max. 132 Zeichen):** Bewertet Unterkünfte auf der Airbnb-Suchseite nach deinen Wünschen und zeigt die Top 3. Alles lokal.
**Kategorie:** Reisen / Produktivität
**Datenschutz-URL:** https://github.com/Pschmetzer/staymatch/blob/main/PRIVACY.md

**Beschreibung:**
StayMatch hilft dir, schneller die passende Unterkunft zu finden, allein oder mit Mitreisenden. Öffne die Suche aus dem Viertel-Finder (https://staymatch-tau.vercel.app), und StayMatch bewertet alle Unterkünfte auf der Seite für eure Gruppe: Viertel-Wert, Sterne mit Gewichtung nach Anzahl der Bewertungen, Gesamtpreis gegen Budget, Betten. Die besten drei erscheinen mit Begründung, jede Karte bekommt einen Punktwert. Dazu: Verlauf, 👍/👎, Notizen, Preisverlauf, Export.
Kein Konto, keine Server, kein Tracking. Das Plugin liest nur Seiten, die du selbst öffnest. Unabhängig, nicht mit Airbnb verbunden. Open Source (MIT).

**Begründung der Berechtigungen (Formular):**
- `storage`: speichert Verlauf, Likes, Notizen und die Reise lokal im Browser.
- Zugriff auf airbnb-Seiten: liest die geöffnete Such- und Unterkunftsseite, um Preise, Bewertungen und Lage zu bewerten.
- Zugriff auf staymatch-tau.vercel.app: übernimmt deine Wünsche, Budget, Mitreisende und Viertel-Wertungen aus dem Viertel-Finder.

**Vor dem Einreichen:**
1. Plugin auf echten Airbnb-Seiten laden und testen (Suchseite UND Unterkunftsseite).
2. Screenshots 1280×800 aufnehmen (Panel auf Suchseite, Popup, Viertel-Finder).
3. Länderliste in `extension/manifest.json` auf getestete Domains kürzen.
4. `./scripts/build-plugin-zip.sh` → ZIP hochladen.
