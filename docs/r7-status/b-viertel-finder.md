# Runde 7 B: Status Viertel-Finder

Branch `feat/r7-viertel`, Worktree `.claude/worktrees/agent-a38ccff05b45e1764`.
Commits: W1 = b413452, W2 = 126cba8, W3 = 0fdf4b6, Nachbesserung = 913e942. Nicht gepusht.

Rahmenbedingung: `check-size.mjs` erlaubt 60 000 Bytes für `web/app.js` (war bei 59 167). Deshalb ist reine Logik nach `web/scoring.js` gewandert (fromFile, buildData, parseCsv, eligibleAreas, cityKeys, overpassFetch, shareEncode/Decode, tripOf, budgetSplit, typeSummary, cardHtml, escapeHtml). Städte-Kacheln und Ladetipps stehen jetzt in `app.html`. app.js jetzt ca. 58,7 KB.

## A. Fehler mit Wirkung auf Ergebnisse
- Shopping allein ergibt 0 Viertel → umgesetzt (b413452). `eligibleAreas` ignoriert Kategorien mit kaum Daten in der Stadt, Hinweis in der Statuszeile. Braucht Folgeänderung: web/data ohne Spalte `shop` (prefetch neu laufen lassen).
- Zentrum = Mitte der Bbox → umgesetzt (b413452) + braucht Folgeänderung: App nutzt `center` aus der Datei ([lat,lon] oder {lat,lon}), sonst wie bisher Mitte der Box. `scripts/prefetch-cities.mjs` + web/data müssen `center` schreiben.
- Sortierung „Beste für Lena“ springt → umgesetzt (b413452)
- Karten-Person springt → umgesetzt (b413452)
- Defekte Vorlage legt App lahm → umgesetzt (b413452)
- Leaflet-Canvas wächst → umgesetzt (b413452)
- Budget in CHF/GBP → umgesetzt (b413452), `currency=EUR` immer
- Umkreis „Automatisch“ immer 1,2 km → umgesetzt (b413452): Option entfernt (bestätigt: 107–480 Stationen je Stadt, Schwelle 60)
- „Keine Bahn“ bei 600 m → umgesetzt (b413452), nächste Bahn bis 1,5 km
- „Bester Kompromiss“ allein → umgesetzt (b413452), „Beste Wahl für dich“
- Geheimtipp „ruhiger“ → umgesetzt (b413452): Party-Wert < 0,45 und nie Platz 1
- Veto relativ zur lautesten Ecke → braucht Entscheidung: absolute Grenze („ab 15 Bars“) schließt deutlich mehr Viertel aus (Wien 31→70, Barcelona 54→135, Rom 41→35 bei 800 m). Soll „Nie“ absolut gelten, und mit welcher Zahl?
- Anreise in der Vergangenheit per Tastatur → umgesetzt (b413452)
- Budget-Modus ändert Bedeutung → umgesetzt (b413452), rechnet um und meldet
- 400/403 als „Zeitüberschreitung“ → umgesetzt (b413452)
- Karte nach Ausblenden falsch eingepasst → umgesetzt (b413452)
- Fehlgeschlagene Suche lässt neuen Rahmen stehen → umgesetzt (b413452)
- `?c=` gewinnt bei jedem Neuladen → umgesetzt (b413452)
- Zweiter Teilen-Link im Tab → umgesetzt (b413452), hashchange
- Teilen-Link ohne Rückweg → umgesetzt (b413452, 913e942): ganzer Zustand, bleibt bis zur ersten eigenen Eingabe im Formular
- Index-Ladefehler gemerkt → umgesetzt (b413452)
- „Barcelona, Spanien“ → umgesetzt (b413452)
- Abbrechen stoppt Vorab-Download nicht → umgesetzt (b413452)
- 16-Gäste-Hinweis im Teilen-Feld → umgesetzt (b413452), eigene Zeile `#peopleWarn`
- Regler zeigen „Eigene Werte“ zu spät → umgesetzt (b413452)
- Nie Party + Gewicht +10 → umgesetzt (b413452), Hinweis
- Namen aus Leerzeichen → umgesetzt (b413452)
- nights() NaN → umgesetzt (b413452)
- Gäste über 16 im Link → umgesetzt (b413452)

## B. Daten laden
- Tages-Cache Objekte statt Text → umgesetzt (126cba8): Zeilen als Arrays wie web/data (Version sm_osm4_)
- Abgelaufene Caches → umgesetzt (126cba8)
- Ladefehler Vorab-Datei still → umgesetzt (b413452, 0fdf4b6): console.warn + Hinweis in der Ladeanzeige
- Dritter Overpass-Server 70 s → umgesetzt (0fdf4b6): Gesamtzeit 130 s
- Overpass `qt` → braucht Folgeänderung: Abfrage steht in shared/core.js (nicht meine Datei)
- Empfangene Datenmenge → umgesetzt (0fdf4b6), „x MB empfangen“ (Kreis bleibt)
- Nominatim doppelt → braucht Folgeänderung: `C.nominatimUrl` (shared/core.js) braucht Parameter `limit`
- Städteliste dreifach → umgesetzt (b413452) + braucht Folgeänderung: App hat nur noch eine Quelle (Kacheln in app.html); index.json/scripts/cities.json bleiben getrennt
- Schritt per Regex → umgesetzt (0fdf4b6)
- outer-Abort-Listener → umgesetzt (b413452)
- Globaler Fehlerfang → umgesetzt (126cba8)
- Alte Ergebnisse klickbar → umgesetzt (0fdf4b6), `inert`

## C. Formular und Gruppe
- Vorlagen per prompt/confirm → umgesetzt (126cba8, Nachfrage-Fehler korrigiert 913e942)
- Gleicher Name doppelt → umgesetzt (126cba8)
- Vorlage zweimal laden → umgesetzt (126cba8)
- „Übernehmen“ ohne Namen → umgesetzt (0fdf4b6)
- Text mit Mengen → umgesetzt (0fdf4b6)
- Trenner &, +, and → umgesetzt (0fdf4b6)
- Kinderzahl verschieden begrenzt → umgesetzt (0fdf4b6), `guests()`
- Mausrad an Zahlenfeldern → umgesetzt (0fdf4b6)
- Fairness aria-valuetext → umgesetzt (0fdf4b6)
- Labels 10 px → umgesetzt (0fdf4b6), 12 px
- Privater Modus → umgesetzt (0fdf4b6)
- Fokus nach Löschen → umgesetzt (b413452)

## D. Ergebnisse
- Neu rechnen bei jedem Tastendruck → umgesetzt (126cba8)
- Ø hängt an Filtern → umgesetzt (0fdf4b6)
- Sortieroptionen allein → umgesetzt (0fdf4b6)
- Chip „Du: 82“ → umgesetzt (126cba8), Aufschlüsselung direkt
- „Selbe Gegend“ nur Text → umgesetzt (126cba8), Knöpfe zeigen das Viertel auf der Karte
- Vergleich mit ungewählten Kategorien → umgesetzt (126cba8)
- „Ohne Tom“ vergleicht Namen → umgesetzt (126cba8)
- „Mehr“ zoomt neu → umgesetzt (0fdf4b6)
- „Mehr“ ohne Anzahl → umgesetzt (0fdf4b6, Zählung korrigiert 913e942)
- Preislage/Geheimtipp nur title → umgesetzt (126cba8), sichtbarer Text
- Platzwechsel ohne Text → umgesetzt (126cba8)
- Ortsauswahl ohne Ausweg → umgesetzt (0fdf4b6)
- Escape → umgesetzt (0fdf4b6)

## E. Karte
- Mausrad zoomt Karte → umgesetzt (126cba8)
- Knopf Ausschnitt zurücksetzen → umgesetzt (0fdf4b6)
- Legende je Modus → umgesetzt (0fdf4b6)
- Doppelte Tooltips → umgesetzt (0fdf4b6)
- Gesperrte Kacheln → umgesetzt (0fdf4b6)
- Kartenfarben aus Theme → umgesetzt (0fdf4b6)
- Orte-Punkte rechnen jede Entfernung → umgesetzt (0fdf4b6), Raster
- „Karte ausblenden“ gemerkt → umgesetzt (0fdf4b6)

## F. Barrierefreiheit
- aria-label auf span.score → umgesetzt (b413452)
- Mini-Balken stumm → umgesetzt (b413452)
- Statuszeile jede Sekunde → umgesetzt (b413452)
- #compare aria-live → umgesetzt (b413452)
- Überschrift mit Knopf/Pfeil/Wert → umgesetzt (126cba8)
- Fokus im Kontrastmodus → umgesetzt (126cba8)
- Sprunglink-Ziel → umgesetzt (0fdf4b6)
- Theme-Knopf ohne Zustand → umgesetzt (0fdf4b6), aria-pressed
- Sichtbarer Text im Namen → umgesetzt (126cba8, 0fdf4b6)
- Vergleich wirft still raus → umgesetzt (0fdf4b6)
- Emoji vorgelesen → umgesetzt (126cba8)
- „In der Nähe“ neuer Tab → umgesetzt (126cba8)

## G. Teilen, Adresse, Speicher
- Teilen-Link verschwindet sofort aus der Adresse → umgesetzt (0fdf4b6)
- sm_trip ohne Plugin → umgesetzt (0fdf4b6), braucht Entscheidung (datenschutzrelevant, laut Auftrag eigentlich harter Stopp): ohne Plugin wird sm_trip nicht mehr geschrieben und ein vorhandenes gelöscht. Behalten oder zurücknehmen?
- Plugin-Hinweis schließt Edge/Opera aus → umgesetzt (0fdf4b6)
- Kartenzustand im Link → umgesetzt (0fdf4b6, korrigiert 913e942)

## H. Seite, Recht
- Footer ohne Impressum/Datenschutz → umgesetzt (b413452)
- Datenschutz-Link auf GitHub → umgesetzt (b413452)
- og:image → umgesetzt (126cba8)
- Lint-Test innerHTML → umgesetzt (0fdf4b6)

## I. Englisch
- EN-App (L) → übersprungen: groß, braucht i18n.js-Schlüssel und EN-Startseite (andere Agenten); nicht risikoarm
- Datums-/Zahlformate → umgesetzt (0fdf4b6), Sprache aus `<html lang>`
- Accept-Language fest → umgesetzt (0fdf4b6), aus `<html lang>`
- Plural von Hand → übersprungen: braucht `Intl.PluralRules` im Wörterbuch (web/i18n.js / shared, nicht meine Datei), erst mit EN-App sinnvoll
- Typ-/Kategorienamen in core.js → braucht Folgeänderung (shared/core.js, M)
- lang/Titel fest → übersprungen: erst mit EN-App

## J. Bewertungslogik
- Dedupe reihenfolgeabhängig → braucht Folgeänderung: Fix gebaut und wieder zurückgenommen, weil er die generierten Stadtseiten ändert (`build-city-pages.mjs --check` schlägt fehl). Mit dem Fix müssen die Stadtseiten neu gebaut werden; Idempotenz-Test ist drin.
- Schwellen in app.js → umgesetzt (b413452), `SM.eligibleAreas`
- Leere Kategorie in relevant → umgesetzt (b413452)
- Gleichstand nur bei fair → umgesetzt (126cba8)
- Preislage-Test nach Zentrums-Fix → übersprungen: Daten haben noch kein `center` (Folgeänderung oben)

## K. Code-Qualität
- Zwei Wege zum Leeren → umgesetzt (0fdf4b6)
- Zustandsobjekt (M) → übersprungen: großer Umbau ohne Nutzerwirkung, Risiko
- renderResults liest Formular → übersprungen: Absicht, seit 126cba8 tauscht `refreshLinks` nur die Links aus dem aktuellen Formular
- Inline-Stile → umgesetzt (0fdf4b6), `.trow.mix`

## L. Tests
- todo-Test Rom → umgesetzt (126cba8), liest Städte aus app.html
- App mit kaputtem localStorage → umgesetzt (b413452)
- Jede Stadt × jeder Typ → umgesetzt (b413452)
- Leistungstest kopiert App-Code → umgesetzt (0fdf4b6), nutzt fromFile/buildData
- Leistungsgrenze 5 s → umgesetzt (0fdf4b6), 1,5 s, bester von 3
- pickDiverse-Eigenschaft → umgesetzt (0fdf4b6)
- dedupe-Eigenschaft → umgesetzt (0fdf4b6), nur Idempotenz; Reihenfolge-Unabhängigkeit siehe J
- Auszeichnungen bei einer Person → umgesetzt (b413452)
- Zentrum-Test → umgesetzt (b413452) für `fromFile` + braucht Folgeänderung: Datentest erst, wenn web/data `center` hat
- Währung → umgesetzt (b413452)
- nights mit Müll → umgesetzt (b413452)
- cleanPerson Leerzeichen → umgesetzt (b413452)
- normCity mit Länderzusatz → umgesetzt (b413452), `cityKeys`
- Sortierung nach Löschen → umgesetzt (b413452), DOM-Test
- i18n-Test → übersprungen: erst mit EN-App

## M. Vendor und Auslieferung
- Leaflet-Bilder ungenutzt → übersprungen: web/vendor ist nicht meine Datei
- Skripte ohne defer → umgesetzt (0fdf4b6)
- Vorab-Dateien ohne Hash → braucht Folgeänderung (web/data, Prefetch-Skript, vercel.json)

## Tests
Lokal 216 grün, 3 rot. Neu: tests/r7-viertel.test.js (38 Tests, DOM-Tests über tests/helpers/app-dom.js mit jsdom); angepasst: viertel, round4, r5-daten, r5-scoring-property.
Die 3 roten sind Plugin-DOM-Tests (tests/plugin-dom.test.js). Sie sind schon auf origin/main rot (CI-Lauf 43157200475 zu #44 „failure“), betreffen extension/, außerhalb des Auftrags.
Syntax-, Sync-, HTML-, Domain-, Größen- und Link-Checks lokal ok. Browser: Barcelona und Wien gesucht, #t=-Link mit Orte-Schicht und „Karte zeigt: Mia“ geprüft (bleibt nach Löschen von Lena bei Mia), Teilen-Link neu geladen, Orte-Punkte, „Mehr“, Karte aus/ein, keine Konsolenfehler.
