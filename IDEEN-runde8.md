# Ideen Runde 8

Aus der Code-Prüfung von `origin/main` (Stand 6c76f4b, 2026-11-14) abgeleitet. Die Funde stammen aus dem Prüfauftrag und sind hier je Abschnitt festgehalten. Abgeglichen gegen [IDEEN-runde7.md](IDEEN-runde7.md).

Legende:
- **[BUG]**: echter Fehler oder Datenschutz-/Sicherheitsproblem mit Wirkung auf Nutzer oder Ergebnisse.
- **in Arbeit (PR folgt)**: Eine der parallelen Sessions bearbeitet den Punkt (Zuordnung nach Bereich, siehe Hinweis am Ende).
- **offen**: noch niemand zugeordnet.
- Datei:Zeile steht nur, wo der Prüfauftrag eine Angabe macht. Sonst ist es mit „—“ markiert.

## A. Neue Features für Nutzer

1. **A1** Panel verschiebbar und andockbar, dazu Top-5-Ansicht. Datei:Zeile —. offen.
2. **A2** „Seit deinem letzten Besuch“: neue Karten, gesunkene Preise, verschwundene Treffer aus dem Pool-Vergleich. Datei:Zeile —. offen.
3. **A3** Preisverlauf je Stadt als Median mit Zeitstempel. Datei:Zeile —. offen.
4. **A4** Erinnerung vor Ablauf der kostenlosen Stornierung (`cancellation.until`, `chrome.alarms`) plus .ics-Export. Datei:Zeile —. offen.
5. **A5** Tags und Etiketten je Unterkunft („Plan A/B“). Datei:Zeile —. offen.
6. **A6** Toolbar-Badge mit Zahl. Datei:Zeile —. in Arbeit (PR folgt)
7. **A7** Options-Seite (`options_ui`) für Import, Export, Löschen und Panel-Position. Datei:Zeile —. in Arbeit (PR folgt)
8. **A8** Optionale Sync der Einstellungen per `chrome.storage.sync`. Datei:Zeile —. in Arbeit (PR folgt)
9. **A9** Entfernung zum Viertelzentrum und Top-POI je Viertel im Panel. Die Bridge liefert nur total, min und minName. Datei:Zeile —. offen.
10. **A10** Zufriedenheit je Mitreisendem statt nur der schlechtesten. Datei:Zeile —. in Arbeit (PR folgt)
11. **A11** Währung des Reisebudgets aus der Seite übernehmen statt fest „€“. Datei:Zeile —. offen.
12. **A12** Datenlage am Passt-Wert anzeigen („auf 3 von 6 Teilen“). Datei:Zeile —. in Arbeit (PR folgt)
13. **A13** Preis manuell korrigieren. Datei:Zeile —. in Arbeit (PR folgt)
14. **A14** Eigene Gewichte als Regler (`weightTweak` existiert bereits). Datei:Zeile —. in Arbeit (PR folgt)
15. **A15** Gesamtpreis aus dem Nachtpreis berechnen, mit sichtbarer Annahme. Datei:Zeile —. in Arbeit (PR folgt)
16. **A16** Vergleichstabelle um Bäder, Storno-Art, Viertelabstand und freie Auswahl von 2 bis 4 Unterkünften erweitern. Datei:Zeile —. offen.
17. **A17** „Warum nicht Platz 1?“ beim Anklicken. Datei:Zeile —. offen.
18. **A18** Panel-Statusfeld im Popup. Datei:Zeile —. in Arbeit (PR folgt)
19. **A19** Export der Top 3 als Bild oder druckbare Seite. Datei:Zeile —. offen.
20. **A20** Notizvorlagen. Datei:Zeile —. offen.
21. **A21** Wunschliste-Herz lesen und `/wishlists/<id>` unterstützen. Datei:Zeile —. offen.
22. **A22** Top-3-Karten auf der Airbnb-Seite hervorheben und per Klick dorthin scrollen. Datei:Zeile —. offen.
23. **A23** „Schon angesehen“-Marker und Filter. Datei:Zeile —. offen.
24. **A24** Bei Grenzlage „zwischen Gràcia (82) und Eixample (64)“ anzeigen. Datei:Zeile —. in Arbeit (PR folgt)
25. **A25** „Platz 4 von 38“ auf der Unterkunftsseite. Datei:Zeile —. offen.
26. **A26** Hinweis „aus 6 von 212 Bewertungen“. Datei:Zeile —. in Arbeit (PR folgt)
27. **A27** Hinweise für FR, ES, IT, NL, PL. HINTS gibt es nur für DE und EN, obwohl 24 Domains unterstützt werden. Datei:Zeile —. in Arbeit (PR folgt)
28. **A28** JSON-LD `containsPlace` für Betten und Ausstattung nutzen. Datei:Zeile —. in Arbeit (PR folgt)
29. **A29** Parser-Rückfälle gegen Airbnb-DOM-Änderungen: `a[href*="/rooms/"]`, Titel aus den ersten Zeilen, `application/json`-Skripte. Datei:Zeile —. in Arbeit (PR folgt)

## B. Neue Features Web-App und Daten

1. **B1** Viertel als Polygone statt Kreise. Datei:Zeile —. offen.
2. **B2** Einbettbares Widget für Reiseblogs. Datei:Zeile —. offen.
3. **B3** Sensitivitätsanzeige „bleibt vorn, solange Party ≥ 0,4“. Datei:Zeile —. in Arbeit (PR folgt)
4. **B4** Konfidenz je Viertel aus der Datendichte. Datei:Zeile —. in Arbeit (PR folgt)
5. **B5** Gehzeit-Näherung mit Faktor 1,3 und Warnung bei Flüssen und Bahntrassen. Datei:Zeile —. in Arbeit (PR folgt)
6. **B6** Share-Karte als Bild je Viertel. Datei:Zeile —. in Arbeit (PR folgt)
7. **B7** Eigener Ruhe-Typ mit Lärmproxy (highway primary/trunk, railway, Bars bis 300 m). Datei:Zeile —. in Arbeit (PR folgt)
8. **B8** Offline-App per Service Worker mit den 10 Datendateien und `manifest.webmanifest`. Datei:Zeile —. offen.
9. **B9** Stadt-Steckbrief als erzählender Absatz aus den Zahlen. Datei:Zeile —. offen.
10. **B10** Daten-Transparenz je Stadt: Quelle, Abrufdatum, verworfene Zeilen. Datei:Zeile —. offen.
11. **B11** „Fehlt ein Viertel?“-Knopf mit Link zum OSM-Editor. Datei:Zeile —. offen.
12. **B12** Inside-Airbnb-Preisdaten für echte €/€€/€€€-Stufen. Datei:Zeile —. offen.
13. **B13** Supermärkte, Apotheken und Bushaltestellen als Kategorien. Datei:Zeile —. offen.
14. **B14** Kirchen, Burgen und Paläste für Sightseeing (`place_of_worship`). Datei:Zeile —. offen.
15. **B15** Zusatzviertel-Datei `scripts/areas-extra.json`. Datei:Zeile —. offen.

## C. Neue Städte

1. **C1** Neue Städte: Brüssel, Antwerpen, Zürich, Salzburg, Warschau, Bratislava, Ljubljana, Zagreb, Tallinn, Riga, Helsinki, Palma, Málaga, Nizza, Bologna, Dubrovnik/Split, Marrakesch. Datei:Zeile —. offen.
2. **C2** Hinweis zum Budget: Das Brotli-Budget liegt bei 1843 von 2500 KB. Es reicht für etwa 3 Städte. Danach ist R7-414 (Datenreduktion) nötig. Datei:Zeile —. offen.

## D. Datenqualität

1. **D1** [BUG] Barcelona Eixample hat 5 Namen. Datei:Zeile —. in Arbeit (PR folgt)
2. **D2** [BUG] Barcelona Poblenou hat 5 Namen. Datei:Zeile —. in Arbeit (PR folgt)
3. **D3** [BUG] Paris mischt Arrondissements, Quartiers und Vororte. Datei:Zeile —. in Arbeit (PR folgt)
4. **D4** [BUG] Paris: Quartier Latin und Canal Saint-Martin fehlen. Datei:Zeile —. in Arbeit (PR folgt)
5. **D5** [BUG] Lissabon: Mikro-Freguesias. Datei:Zeile —. in Arbeit (PR folgt)
6. **D6** [BUG] Lissabon: Príncipe Real, Belém und Alcântara fehlen. Datei:Zeile —. in Arbeit (PR folgt)
7. **D7** [BUG] Budapest: 155 von 260 Vierteln sind `suburb`. Datei:Zeile —. in Arbeit (PR folgt)
8. **D8** [BUG] Budapest: Lakótelep-Siedlungen als Viertel. Datei:Zeile —. in Arbeit (PR folgt)
9. **D9** [BUG] Budapest: „Pest“ als ganze Ostseite. Datei:Zeile —. in Arbeit (PR folgt)
10. **D10** [BUG] Amsterdam: Gebäudenamen als Viertel (Verdi, Gershwin, Mahler u. a.). Datei:Zeile —. in Arbeit (PR folgt)
11. **D11** [BUG] Wien: historische Mikro-Viertel. Datei:Zeile —. in Arbeit (PR folgt)
12. **D12** [BUG] Rom: 149 Viertel inklusive Vororte. Datei:Zeile —. in Arbeit (PR folgt)
13. **D13** [BUG] Rom: Rioni-Ebene fehlt. Datei:Zeile —. in Arbeit (PR folgt)
14. **D14** [BUG] Amsterdam: 10.146 von 10.222 Gärten sind unbenannt. Datei:Zeile —. in Arbeit (PR folgt)
15. **D15** [BUG] Spielplätze sind überwiegend unbenannte Teilflächen. Datei:Zeile —. in Arbeit (PR folgt)
16. **D16** [BUG] Generische Namen wie „Gartenstadt“, „Centre-Ville“, „Bellevue“. Datei:Zeile —. in Arbeit (PR folgt)
17. **D17** [BUG] Namen nur in der Ortssprache. Datei:Zeile —. in Arbeit (PR folgt)

## E. Sicherheit und Datenschutz

1. **E1** CSP mit `unsafe-inline` durch eine Hash-basierte CSP ersetzen, per Build-Skript erzeugt. Datei:Zeile —. in Arbeit (PR folgt)
2. **E2** [BUG] Markdown-Export-Injection im Gruppenchat. Datei:Zeile —. in Arbeit (PR folgt)
3. **E3** [BUG] Export „ohne Notizen“ gibt `hostId`, `priceHistory` und `booked` weiter. Datei:Zeile —. in Arbeit (PR folgt)
4. **E4** [BUG] Teilen-Link mit Namen in der Adresszeile. Datei:Zeile —. in Arbeit (PR folgt)
5. **E5** [BUG] Manifest ohne Ausschluss für `/login`, `/signup`, `/account*`, `/reservation*`, `/trips*`. Datei:Zeile —. offen.
6. **E6** [BUG] Hinweis „Agentur oder Fake?“ unterstellt Betrug. Datei:Zeile —. offen.
7. **E7** Tag-Release außerhalb von `main`. Datei:Zeile —. in Arbeit (PR folgt)

## F. Tests und CI

1. **F1** Playwright-Smoke mit CSP-Prüfung und axe-core. Datei:Zeile —. in Arbeit (PR folgt)
2. **F2** Snapshot-Test „Ruhe-Platz-1 ist nicht das lauteste Viertel“. Datei:Zeile —. offen.
3. **F3** Datenplausibilität in `check-data`. Datei:Zeile —. in Arbeit (PR folgt)

## Meine Top 15 (optionale Reihenfolge)

1. D1 bis D3 und D7 (Stadtdaten mit falschen Namen und Zuordnungen)
2. E2 und E3 (Injection und Datenabfluss)
3. E4 (Namen im Teilen-Link)
4. A4 (Erinnerung vor Ablauf der Stornierung)
5. A2 („Seit deinem letzten Besuch“)
6. A9 (Entfernung und Top-POI im Panel)
7. A29 (Parser-Rückfälle gegen DOM-Änderungen)
8. A27 (Hinweise für weitere Sprachen)
9. B8 (Offline-App)
10. B4 (Konfidenz je Viertel)
11. C1 (neue Städte, mit Hinweis aus C2)
12. E5 (Manifest-Ausschluss)
13. F1 (Playwright-Smoke mit CSP)
14. A5 (Tags je Unterkunft)
15. B3 (Sensitivitätsanzeige)

## Hinweis zur Zuordnung „in Arbeit“

Die Zuordnung leitet sich aus den Bereichen der parallelen Sessions ab (Core/Domain, extras.js, parse/rank/hints, Popup/Speicher, Web-App, Stadtseiten, Infra/CI, Landingpage). Ich habe die Bereiche auf die Punkte abgebildet, ohne die Code-Änderungen der Sessions zu sehen. Die Einordnung kann bei den Sessions abweichen.
