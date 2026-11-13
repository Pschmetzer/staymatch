# Änderungen

Format nach [Keep a Changelog](https://keepachangelog.com/de/1.1.0/). Versionsschema: `x.y.z` wie in `extension/manifest.json` (Plugin). Die Web-App wird laufend ausgeliefert und hat keine eigene Version. Das Datum hinter einer Version ist der Tag, an dem sie im Repo stand; bei „Unveröffentlicht“ der Stand des Abschnitts. Aus dieser Datei entsteht `web/feed.xml` (`node scripts/build-feed.mjs`).

## [Unveröffentlicht] - 2026-11-13

### Hinzugefügt (Runde 7)
- Plugin, Unterkunftsseite: Zusatz-Hinweise (Kaution, Zusatzgast- und Vor-Ort-Kosten, Gebühren-Anteil, Hausregeln, Sicherheitsausstattung, Kamera/Lärmsensor, Gastgeber-Angaben, Lizenznummer, Saison und Silvester), Bewertungs-Analyse (Kritik-Quote, Lärmzeit, Gästemix, Trend), wichtige Hinweise sichtbar und Rest unter „Mehr Hinweise“, Gebucht-Status mit Entscheidungsnotiz, Gastgeber-Gedächtnis, Beschreibung gegen Bewertungen. Neues Modul `extension/extras.js`.
- Plugin, Suchseite: Lockpreis- und Gebühren-Warnungen, Sterne relativ zur Seite, Einzelbetten-Warnung, „jede Person eigenes Bett“, Wunsch-Profile und Wünsche aus einem Satz, ±1 Person, Seiten-Auswertungen („Mehr zu dieser Seite“), Abstand zu Platz 1, Vorlesen, Kopiertext ohne Preise/Emojis oder als Markdown.
- Plugin, weitere Hinweise: Rabatt-Ehrlichkeit mit eigenem Preisverlauf, Last-Minute/Frühbucher, Airbnb-Teilnoten, Warnung beim Kopieren von Telefonnummer oder Mail, Storno-Preis-Abwägung in den Top 3, Vorjahresvergleich, Quellen an den Wunsch-Chips.
- Plugin, Popup: Textgröße, Screenshot-Modus, Blindverkostung, Kopier-Optionen, Spuren-Pause, gebuchte Etappen kopieren, Link-Prüfung gegen Nachbauten, Merkliste eines Freundes, Datenauskunft, Geschmack korrigieren, Backup-Erinnerung, Zähler „heute bewertet“; Wunsch-Profile Arbeiten/Urlaub per Knopf (R7-597).
- Plugin: Betrugshinweise verlinken die Hilfe auf `https://staymatch.pro/#verdacht`; „Fehler melden“ öffnet die Issue-Vorlage „Plugin erkennt die Seite nicht“ mit vorausgefüllten Feldern.
- Viertel-Finder: neues Modul `web/app-extra.js` mit Tageslicht am Anreisetag, Abstand zu Platz 1, robuster Empfehlung, „Mal was anderes“, einfacher Sprache, Wünschen aus einem Satz, Interessen als Text, eigenen Orten (GeoJSON/KML), Gruppen-Abstimmung per Link, Etappen, Kopiertext, Vorlesen mit lokaler Stimme, Textgröße, Duell, Fairness-Konto; Hinweis bei Anreise am Sonntag. Übernimmt Kinder und Budget pro Nacht aus der Schnellsuche der Startseite.
- Startseite (DE und EN): Kinder und Max. € pro Nacht in der Schnellsuche, Sterne- und Fairness-Regler zum Ausprobieren, Checkliste vor der Buchung, Abschnitt „Verdacht auf Betrug?“ mit Link-Prüfung, „Seite teilen“, Wochenend-Schnellwahl; 404 auf Englisch für `/en`.
- Stadtseiten: je Viertel Link zur Airbnb-Suche, Brotkrümel, Abschnitt „Kurz und einfach“ (R7-742).
- Atom-Feed `web/feed.xml` aus diesem CHANGELOG (`scripts/build-feed.mjs`, in CI geprüft), verlinkt auf beiden Startseiten (R7-731).
- Tests: DOM-Tests des Viertel-Finders mit jsdom, Kontrast-Test, `r7-*`-Tests für alle Wellen.

### Geändert (Runde 7)
- Startseite: Kontrast von Grün/Orange und Bedienelement-Rändern im Hellmodus, Schnellsuche funktioniert ohne JS und merkt Eingaben im Tab, Barrierefreiheit (Live-Regionen, Klickflächen, Fokus), FAQ-Anker, Vertrauenszeile „Kein Tracking“, Markenhinweis im Footer, Download heißt `staymatch-0.5.0.zip`.
- Rechts- und Stadtseiten: `legal.css` mit Hell als Standard und Druckansicht, Datenschutz mit Inhaltsverzeichnis, Impressum nach DDG (beides bitte gegenlesen).
- `vercel.json`: Kurz-Umleitungen, englische Stadtnamen, COOP, strengere CSP. `security.txt` mit `Canonical` auf staymatch.pro.
- Live-Städte im Viertel-Finder nutzen dieselben Kern-Helfer wie die vorab geladenen (`shared/core.js`); Städtedaten mit shop-Spalte und echtem Zentrum neu erzeugt.
- Plugin: geschlossener Shadow Root, strenge CSP fürs Popup, Spuren-Pause schreibt auf der Suchseite nichts, Seiten-Auswertung einmal je Suche.
- CI: Actions per Commit-SHA gepinnt, Rechte minimiert, Größenbudget für `web/*.js` auf 170 KB; Leistungstest misst CPU-Zeit statt Wanduhr. Dependabot wartet 7 Tage auf neue Versionen.

### Behoben (Runde 7)
- Plugin: Preise mit indischen Tausendergruppen und Rabatt, Storno-Fristen, Geschirrspüler ist keine Waschmaschine, Stichworte mit Verneinung, kein NaN-Score bei Vierteln ohne Wert, Nachtpreis konnte zum Gesamtpreis werden, freier Inseratsname wurde als Ort gespeichert, weitere Parser-Fehler (Währung aus Fließtext, Sterne nur aus Stern-Labels).
- Viertel-Finder: Shopping-Typ ohne Daten, Personen-Index nach Löschen, kaputte Vorlagen, EUR im Airbnb-Link, Gäste-Grenze, Anreise in der Vergangenheit, Budget-Modus rechnet um, Kartenzustand aus dem Teilen-Link, globaler Fehlerfang mit Zurücksetzen.

### Hinzugefügt
- Startseite auf Englisch (`/en`) mit Sprachumschalter DE/EN, hreflang und englischem Schnellstart auf airbnb.com (#36).
- Plugin-Panel: Foto-Karten im Hotel-Stil, Wunsch „Luxus“ in Plugin und Viertel-Finder mit Filter „nur Luxus“ (#44).
- Startseite (DE und EN): Abschnitte „Wie wir rechnen“ und „Beliebte Städte“ (Links auf die Stadtseiten), acht neue Stimmungsbilder, Szenario-Karten mit Bild, FAQ-Auszeichnung (`FAQPage`), Kopier-Knopf und browserabhängiger Erweiterungs-Pfad bei der Installation, ZIP-Größe am Download-Knopf, Nächte-Anzeige im Schnellstart, aktiver Navigationspunkt. Test `tests/startseite.test.js`.
- `/.well-known/security.txt`, SHA-256-Prüfsumme neben dem Plugin-ZIP, Herkunftsnachweis (Provenance) im Release-Workflow.
- `scripts/cities.json` (Städteliste), `scripts/check-syntax.mjs`, `scripts/dev-server.mjs` (setzt die Header aus `web/vercel.json`), `.nvmrc`, `.editorconfig`, `.githooks/`, `THIRD_PARTY.md`.

### Geändert
- Weiß als Standard, Lade-Karte mit Countdown und Schritten im Viertel-Finder, helle Varianten der Startseiten-Fotos (#41).
- Website-Adresse in canonical, Open Graph, hreflang, Sitemap, `robots.txt` und Stadtseiten ist jetzt `https://staymatch.pro` (das Plugin nutzt weiter die alte Vercel-Adresse). Sitemap enthält die Stadtseiten.
- Startseite: Plugin-Abschnitt direkt nach „So geht's“, Schnellstart mit sichtbaren Feldnamen und Städte-Vorschlägen, FAQ zusammengelegt, Hero-Beispiel ohne verdecktes Viertel-Label, Navigation auf dem Handy kompakter. Hero-Platzhalter `sm-lumina` entfernt.
- CI: Online-Linkcheck nur wöchentlich, Zeitlimits, npm-Cache, jsdom-Prüfung. Release-Workflow führt `npm run check` aus und nimmt den CHANGELOG-Abschnitt als Release-Text. Dependabot beobachtet `tests/`.
- `deploy.sh` prüft Stand und alle Checks und testet nach dem Deploy. `prefetch-cities.mjs` bricht bei Fehlern mit Exit-Code 1 ab und überschreibt keine Datei mit einer Teilantwort.
- Datenschutz-Texte: gespeicherte Felder des Plugins vollständig, vorab geladene Städte als aktiv beschrieben.
- Cache-Header für `/data`, `/fonts`, `/vendor`; `robots.txt` sperrt `/data/`.

## [0.5.0] - 2026-11-10

Die Tags `v0.4.0` und `v0.5.0` gibt es noch nicht, die Vergleichslinks am Ende gelten erst nach dem Taggen.

### Geändert
- Neue Ausrichtung: StayMatch ist zuerst ein Helfer für eine Person, die schneller ihr passendes Airbnb findet. Gruppen sind ein Zusatz.
- Direkt-Modus: Das Plugin funktioniert auf jeder Airbnb-Suche mit Budget pro Nacht und Wunsch-Chips, der Viertel-Finder ist optional.
- Viertel-Finder startet mit einer Person („Du“), Einzahl-Texte, kein „pro Person“.

### Hinzugefügt
- Wünsche an die Unterkunft: ganze Unterkunft, kein Gewerbe, Superhost/Favorit, ab 20 Bewertungen; ruhig, sauber, WLAN als Warnung auf der Unterkunftsseite.
- Gemeinsamer Kern in `shared/`, Runde 4 im Viertel-Finder, vorab geladene Städtedaten.

## [0.4.0] - 2026-11-09

### Hinzugefügt
- CI: Node 22 und 24, HTML-Prüfung, Domain-Abgleich Manifest/`bridge.js`/`APP_URL`, Größengrenzen, ZIP-Inhaltsprüfung, Link-Prüfung.
- Release-Workflow: Bei Tag `v*` wird das Plugin-ZIP gebaut und angehängt.
- `package.json` mit `test`, `check`, `build`, `dev`.
- Issue- und PR-Vorlagen, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, Dependabot.

### Geändert
- `build-plugin-zip.sh` schließt versteckte Dateien auf jeder Ebene aus und meldet fehlendes `zip`.
- `deploy.sh` führt vorher die Tests aus.

## [0.3.0] - 2026-11-09
- Runde 3: Entfernungsabfall, Umkreis, neue Orttypen, Neuberechnung ohne Netz, Plugin-Filter.

## [0.2.1] - 2026-11-09
- Runde 2: Datenschutz-Texte, Fehlerkorrekturen, Teilen-Link, Tests, CI.

## [0.2.0] - 2026-11-09
- Landingpage, Viertel-Finder, Plugin-ZIP zum Download.

[Unveröffentlicht]: https://github.com/Pschmetzer/staymatch/compare/main...HEAD
[0.5.0]: https://github.com/Pschmetzer/staymatch/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Pschmetzer/staymatch/compare/v0.3.0...v0.4.0
