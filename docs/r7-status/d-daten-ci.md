# R7-D Status (Branch feat/r7-daten-ci, nicht gepusht)

Worktree: .claude/worktrees/agent-a90b5a4cdebadf44b
Commits: a6e8e24 (W1), 81e7207 (W2), 8751f34 (Stadtseiten zurück auf main), 9fc9f3b (W3), 3d8807d (Daten-Korrektur: 5 Stellen, keine Sortierung), 23139b9 (Datenlauf mit shop, out center qt).
Tests: 194, 190 grün, 1 todo, 3 rot = bekannte DOM-Tests in plugin-dom.test.js. „Stadtseiten sind aktuell“ ist auf dem Branch rot, weil web/staedte bewusst nicht committet ist (lokal nach `node scripts/build-city-pages.mjs` grün). Alle .github/scripts-Checks, check:data, ZIP grün.
Status: U = umgesetzt, Ü = übersprungen, H = harte Stopp, E = braucht Entscheidung, F = Folgeänderung, G = umgesetzt, bitte gegenlesen.

## Datenqualität (10)
1. 🔴 Plätze als Viertel — U (core isArea/splitRows, build-city-pages.rankCity, Daten: place nur PLACE_TYPES). Live-Overpass: F app.js:428 → `C.splitRows(C.rowsToTags(...), SM.categoriesOf)`.
2. 🟠 Platz-Zeilen verlieren POI — U (Test Platz + tourism=attraction). Live: F app.js:428.
3. 🟠 bbox-Mitte statt Zentrum — U (Feld `center` je Stadt; Budapest aus der beschnittenen bbox). App: F app.js:308 (laut Leitung im Viertel-Branch schon gelesen).
4. 🟠 Unbenannte Gärten — E: zählen als chill; Wegwerfen ändert Wertungen und macht Vorab-/Live-Städte ungleich.
5. 🟢 Namen trim — U. Zusätzlich: CSV-Anführungszeichen von Overpass („"Amstelveen, Busstation"“) entfernt `C.parseOverpassCsv`; Live: F app.js overpass().
6. 🟢 Punkte außerhalb bbox — U (± 0,01°, Testtoleranz 0).
7. 🟢 bbox-Rauschen — U.
8. 🟢 Gemischte Datenstände — U (queryHash, check:data warnt; nach Datenlauf alle 10 auf aktueller Abfrage, alle mit shop).
9. 🟢 Aliase — U.
10. 🟢 Lange Namen — U (Warnung > 80).

## Dateigröße (7)
11. 🟠 4 Nachkommastellen — Ü: ändert Wertungen (dedupePois 8 m), gemessen; 5 Stellen.
12. 🟢 wikidata-Merker — U.
13. 🟢 Sortieren — Ü: ändert Wertungen (erste Zeile gewinnt), bis 21 abweichende Top-Einträge je Stadt.
14. 🟢 −28 % gesamt — Ü (folgt aus 4, 11, 13).
15. 🟢 Brotli-Budget — U (check:data, 400 KB je Datei, 2,5 MB gesamt; heute 1,8 MB mit shop).
16. 🟢 Eine Zeile pro Datensatz — U.
17. 🟢 Git-Historie — E (Release-Asset oder seltener auffrischen). Branch enthält 3 Daten-Stände → Squash-Merge empfohlen.

## Pipeline (11)
18. 🟠 Relative Mindestzeilen — U. 19. 🟠 Atomar — U. 20. 🟠 Ortsauswahl wie App — U (limit 5 + placeChoices; vorhandene Städte behalten bbox/center, --geocode).
21.–28. 🟢 r.ok, cities.json-Ergänzung, Änderungsbericht, --dry-run, verworfene Zeilen, v, source/ms, check:data — U (8).

## Lizenz (7)
29. 🟠 ODbL-Methode — U (NOTICE). 30. license/attribution — U. 31. Abruftabelle — U. 32. NOTICE verlinkt — U. 33. Stadtseiten in THIRD_PARTY — U.
34. 🟢 Herkunft Icons/og.png/favicon — E (im Repo nicht belegt).
35. 🟢 NOTICE englisch — U.

## Tests (12)
36. 🔴 DOM-Tests — Ü (Extension-Agent).
37. 🟠 app.js ungetestet — F app.js.
38. 🟠 Typ-Filter-Test — U.
39.–42. Parser, Schwellen, Aliase aus cities.json, Datenalter — U (4).
43. Testdateien umbenennen — Ü (nicht freigegeben).
44. QUOTA-Stacktrace — F tests/r5-plugin.test.js.
45.–47. check-zip aus ZIP, dev-server 400, dev-server 127.0.0.1 — U (3).

## CI (14)
48. 🔴 main ohne Schutz — H (Ruleset; Pflicht-Checks jetzt check (22)/(24)/(26), dependency-review).
49.–52. 🟠 SHA-Pins, --ignore-scripts, Dependency-Review, Schedule mit Tests/check:data — U (4).
53. Concurrency — U. 54. paths-ignore — Ü (Konflikt mit Pflicht-Checks). 55. Node 26 — U (.nvmrc: F).
56.–59. ZIP einmal, Abdeckung ≥ 90 %, Annotationen, Summary-Größen — U (4).
60. Dependabot cooldown — F .github/dependabot.yml. 61. CODEOWNERS — F.

## Release (7)
62.–68. Rechte getrennt, Entwurf, version_name mit SHA, Prüfsumme einmal, Concurrency, deploy.sh CI-Prüfung, ZIP einmal — U (7). Release-Workflow nicht live getestet.

## Repo (5)
69. Secret-Scanning — H. 70. Labels — U (Vorlagen auf enhancement/bug). 71. „Fehler melden“-URL — F extension. 72. Repo-Homepage — H. 73. Ideen-Nummern — U (Konvention in CONTRIBUTING; PR-Vorlage: F).

## Geteilter Code (6)
74. rowsToTags/Viertel doppelt — U (App: F :306/:428). 75. autoRadius — U (App: F :335). 76. nominatimUrl limit — U (App: F :246). 77. web/i18n.js — U. 78. Kopfzeile — U. 79. check-size am Anschlag — E.

## Doku (16)
80. Airbnb-Bilder — G (PRIVACY, STORE, README DE/EN; Popup rendert keine Bilder, geprüft).
81. Speicher-Schlüssel — G (PRIVACY.md; web/datenschutz.html: F).
82. CHANGELOG — F.
83.–87. KONZEPT Typen, Kategorien, Regler, CSV/Import, Vorabdaten — U (5).
88. Datenauffrischung CONTRIBUTING — U. 89. Befehle vereinheitlicht — U. 90. README DE/EN — U. 91. Badge — Ü. 92. security.txt — F. 93. SECURITY.md — U. 94. KONZEPT Roadmap — U. 95. THIRD_PARTY Lizenzpfade — U.

## Zählung (95)
U 72 · Ü 7 (11, 13, 14, 36, 43, 54, 91) · H 3 (48, 69, 72) · E 4 (4, 17, 34, 79) · F 7 (37, 44, 60, 61, 71, 82, 92) · G 2 (80, 81).

## Zusätzlich auf Wunsch der Leitung (Viertel-Agent)
- Spalte shop in allen 10 Städten (Datenlauf 13.11.2026, Overpass), `center` je Stadt, `out center qt`, `nominatimUrl(q, lang, limit)` — U (23139b9).

## Hinweise
- check:data: Fehler ab 180 Tagen Datenalter, läuft in check:static → blockiert ab ca. Mai 2027 deploy.sh und Releases bis zur Auffrischung.
- shared/core.js + Kopien geändert: beim Merge `node scripts/sync-core.mjs` neu laufen lassen.
- build-city-pages.mjs: nur rankCity (Datenlogik), Vorlage unverändert; web/staedte nach dem Merge neu erzeugen.
- Datenlauf ändert Wertungen (neue OSM-Daten, Einkaufen zählt jetzt): Top-5 der Stadtseiten werden sich verschieben.
- Overpass-CSV: Zeilen mit „|“ im Namen werden weiter verworfen (1–28 je Stadt), Zahl steht im Prefetch-Log.
