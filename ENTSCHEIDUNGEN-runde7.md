# Runde 7: Offene Entscheidungen

Stand Branch `feat/r7-alles` (2026-11-13). Alles andere aus [IDEEN-runde7.md](IDEEN-runde7.md) ist gebaut, übersprungen (mit Grund) oder gehört zu einem der Punkte unten.

## Bitte selbst erledigen (Konten, nicht im Code)
1. **Deploy**: staymatch.pro hängt hinter dem Repo (canonical, robots, sitemap, Stadtseiten zeigen noch auf staymatch-tau.vercel.app). Danach live prüfen, ob die Extension die Reise noch übernimmt (neue Sicherheits-Header gelten auch für /app).
2. **www.staymatch.pro**: TLS-Fehler, DNS zeigt auf Porkbun-Parkserver. Bei Porkbun auf Vercel umstellen. Erst danach HSTS mit preload.
3. **staymatch-tau.vercel.app**: liefert doppelten Inhalt. Nur noindex per Host, kein Redirect (Extension-Bridge hängt daran).
4. **GitHub**: Ruleset für `main` mit Pflicht-Checks `check (22)`, `check (24)`, `check (26)`, `dependency-review`; Secret-Scanning und Push-Schutz an; Repo-Homepage auf https://staymatch.pro.

## Bitte gegenlesen (Rechtstexte, nichts erfunden, Lücken als „TODO Nutzer“)
5. Impressum: DDG statt TMG, Platzhalter Verantwortlicher nach § 18 MStV.
6. Datenschutz (`web/datenschutz.html`) und `PRIVACY.md`: Schnellstart-Daten in der Airbnb-Adresse, GitHub (USA) als Empfänger, Bilder vom Airbnb-CDN im Panel, neue localStorage-Schlüssel, Speicherdauer der Vercel-Protokolle (vom Plan abhängig, bitte nachsehen).
7. `STORE.md`: Store-Text sagt bisher „keine Anfragen an Dritte“, stimmt seit den Panel-Fotos nicht mehr.
8. Markenhinweis Airbnb/Chrome im Footer.
9. **Kontakt-E-Mail** für Footer, Datenschutz und Barrierefreiheitserklärung: welche Adresse?

## Produkt-Entscheidungen
10. **Neue Rechte im Plugin** (Web-Store-Neuprüfung): `alarms` (Nachschau-Erinnerung), `sidePanel` (Seitenleiste), `activeTab` (fremde Unterkunft merken), `optional_host_permissions` für weitere Airbnb-Domains, Service Worker für Tastenkürzel und Datenumzug.
11. **Chrome Built-in AI**: Bewertungs-Zusammenfassung usw. ohne Server möglich, aber Modell-Download mehrerer GB. Bisher nur Erkennung im Popup gebaut.
12. **Fehler melden ohne GitHub-Konto**: Empfänger und Datenschutztext?
13. **Übersetzung des Plugins**: Texte als Schlüssel in `i18n.js`, Speicherformat ändert sich (Umzug alter Merklisten nötig). Englische Store-Texte festlegen.
14. **sm_trip nur mit Plugin**: Viertel-Finder schreibt `sm_trip` nur noch, wenn das Plugin erkannt wird. Behalten?
15. **Veto „Nie“ im Viertel-Finder**: feste Grenze (z. B. ab 15 Bars) statt relativ zur lautesten Ecke? 15 heißt: Wien 70 statt 31 Viertel weg, Barcelona 135 statt 54.
16. **Unbenannte Gärten** in den Städtedaten weglassen? Ändert die Wertung „Chillen“.
17. **Datenhistorie**: Städtedaten (ca. 1,8 MB) als Release-Asset statt im Git? Ab ca. Mai 2027 blockiert die Altersprüfung Releases, bis neu geladen wird.
18. **Neue OSM-Felder** für weitere Viertel-Features (Öffnungszeiten, Bibliothek, Uni, Ufer, Autobahn, Startbahn …): Daten werden größer.
19. **Größengrenzen**: `app.js` 59,3 von 60 KB, `index.html` fast 80 KB. Glossar, Arbeitsblatt Gruppen und Familien-Checkliste brauchen eigene Seiten (plus sitemap, vercel.json).
20. **Familie unter „Für wen?“**: fünfte Karte (Bild fehlt) oder bestehende tauschen?
21. **Stadtseiten immer hell**, weil ohne Skript. In Ordnung?
22. **og.png / Markenfarbe**: Vorschaubild weicht von der Seite ab, `#ff385c` ist Airbnbs Markenfarbe. Neu erzeugen?
23. **Herkunft von Icons, og.png, favicon** im Repo nicht belegt (für THIRD_PARTY.md).
24. **Zeitgewichtete Bewertung** (`effectiveRating`) ist nie aktiv: Datum je Bewertung live lesen oder streichen?
25. **Leitungswasser-Tabelle je Land**: Gesundheitsaussage, Quelle und Haftung?
26. **Andere Plattformen und Browser**: Booking-Preisvergleich, Bookmarklet, Userscript, Orion/Safari, Firefox.
27. **Monetarisierung und Projekt** (R7-747 bis R7-754): Spenden, Partnerlinks usw. Berührt das Versprechen „kostenlos, ohne Werbung“.
28. **Inhalte mit echten Belegen**: Transparenz-Bericht, Fallstudie, Werkzeugvergleich, Fediverse, Kurzvideos, Stadt-Paten.

## Bekannte Restpunkte
- Nur an selbst gebauten Testseiten geprüft, nicht am echten Airbnb: Preis mit Währung vorn, Stornoabschnitt, Viertel aus og:title, Stern-Labels, Zusatz-Hinweise der Unterkunftsseite. Nach dem Laden der ZIP einmal auf airbnb.de und airbnb.com testen.
- Der Leistungstest in `r5-scoring-property` scheitert gelegentlich unter Last (läuft allein in 0,4 s).
- Neue Plugin-Texte stehen noch lokal in den Modulen, nicht in `i18n.js` (hängt an Punkt 13).
- `CHANGELOG.md` ist noch nicht für Runde 7 nachgetragen.
