# StayMatch-Startseite: 100 Verbesserungen

Stand 10.11.2026: ✅ umgesetzt in diesem Branch, ⏭️ nicht umgesetzt (Grund dahinter).

Grundlage: `web/index.html` auf `origin/main` (10.11.2026), dazu `sitemap.xml`, `vercel.json`, `staedte/`, `LUMINA-PROMPTS.md`.
🔴 = Fehler/Widerspruch · 🟠 = deutlicher Gewinn · ⚪ = Feinschliff

## A. Fehler und Widersprüche im Code
1. ✅🔴 `canonical`, `og:url`, `og:image`, `twitter:image` und JSON-LD `url` zeigen auf `staymatch-tau.vercel.app`, die Seite läuft aber auf `staymatch.pro`. Google wertet sonst die falsche Domain.
2. ✅🔴 `sitemap.xml` und alle `staedte/*.html` (canonical) nutzen ebenfalls `staymatch-tau.vercel.app`.
3. ✅🔴 Hero-Bild: Das Top-3-Panel verdeckt bei ca. 1400 px Breite das Label „Gràcia · 84“ (im Screenshot nur „(“ sichtbar). Panel tiefer/rechter setzen oder Zone `z1` nach links oben schieben.
4. ✅🔴 Grenzen-FAQ „Keine Airbnb-Schnittstelle“: „StayMatch sucht Viertel, die Unterkünfte siehst du auf Airbnb selbst“ widerspricht dem Plugin, das Unterkünfte bewertet. Text neu fassen.
5. ✅🔴 Schnellstart aktualisiert nur den ersten Link `a[href="/app"]`; der „Viertel finden“-Knopf im Schluss-Abschnitt bekommt Stadt/Datum nicht mit. `querySelectorAll` nutzen.
6. ✅🔴 Nach der ersten Eingabe hat der Hero-Link nicht mehr `href="/app"`, das Selektor-Muster ist zerbrechlich. Per `id` ansprechen.
7. ✅🔴 „Für wen?“ hat 4 Karten in einem 3-Spalten-Raster: eine Karte steht allein in Zeile 2. Raster auf 2×2 oder 4 Spalten.
8. ⏭️🔴 `staymatch-plugin.zip` ist nicht im Repo (wird per `scripts/build-plugin-zip.sh` gebaut). Prüfen, dass jeder Deploy die Datei enthält, sonst 404 auf dem Haupt-CTA. Am besten Test/Check im Deploy-Skript. _(Nicht umgesetzt: schon abgesichert: deploy.sh baut das ZIP, `npm run check:zip` prüft es)_
9. ✅🔴 Hero-Chip „🤫 Ruhig“ wird im Panel nicht begründet (kein „✓ ruhig laut Bewertungen“). Begründung ergänzen, sonst wirkt das Beispiel unstimmig.
10. ✅🔴 `twitter:description` („Der Kompromiss für eure Reisegruppe…“) passt nicht mehr zur heutigen Botschaft (Top 3 für dich). Angleichen.
11. ✅🟠 FAQ-Link „Datenschutz“ führt auf GitHub `PRIVACY.md`, obwohl es `/datenschutz` auf der Seite gibt. Intern verlinken.
12. ⏭️🟠 Schnellstart öffnet immer `airbnb.de`. Für die englische Seite `airbnb.com`, sonst nach `navigator.language`. _(Nicht umgesetzt: en.html nutzt bereits airbnb.com)_
13. ✅🟠 `scroll-margin-top: 80px` reicht auf dem Handy nicht: die Navigation bricht dort zweizeilig um (~110 px), Überschriften rutschen unter die Leiste.
14. ✅⚪ CSS für `.strip h3` ist ungenutzt (Leiste nutzt `<p><strong>`). Entweder echte `h3` verwenden (besser für Gliederung) oder CSS löschen.
15. ✅⚪ Lumina-Hero-Platz (`#lumina`, `sm-lumina`, ca. 25 Zeilen) ist toter Code laut `LUMINA-PROMPTS.md` („bleibt aus“). Entfernen oder anders nutzen.
16. ✅⚪ CSS-Block `.cmp` steht mitten im Hero-Panel-Bereich. Aufräumen.
17. ✅⚪ Viele Inline-Styles (`style="padding-top:0"` 7×, Bars-`h4`, Intro-Abstände). Durch Klassen ersetzen.
18. ✅⚪ `theme-color` ändert sich beim Umschalten Hell/Dunkel nicht. Im Klick-Handler mitsetzen.

## B. Hero (erster Eindruck)
19. ✅🟠 Drei konkurrierende Aktionen (Plugin holen, Viertel finden, Suchen). Eine klare Hauptaktion festlegen, Schnellstart optisch als „oder direkt suchen“ absetzen.
20. ✅🟠 Der Hinweis „Kostenlos · Open Source · ohne Anmeldung“ liegt bei 1080p unter dem Falz. Direkt unter die Knöpfe als kleine Häkchen-Zeile.
21. ✅🟠 Lead-Text kürzen (aktuell 2 lange Sätze + 1). Vorschlag: „StayMatch bewertet jede Unterkunft auf deiner Airbnb-Suche und zeigt sofort die drei besten mit Begründung.“
22. ✅🟠 Datumsfelder zeigen nur „tt.mm.jjjj“. Sichtbare Mini-Labels „Anreise / Abreise / Gäste“ darüber.
23. ✅🟠 Abreise automatisch auf Anreise + 3 Nächte vorschlagen, Nächte anzeigen („4 Nächte“).
24. ✅🟠 Stadtfeld mit `<datalist>` der 9 Städte-Seiten (Lissabon, Paris, …) als Vorschläge.
25. ⏭️🟠 Budget-Feld (€/Nacht) im Schnellstart ergänzen und als `price_max` mitgeben, passt zum Kernversprechen. _(Nicht umgesetzt: `price_max` ist kein bestätigter Airbnb-Parameter)_
26. ✅🟠 Bei leerer Stadt Hinweistext statt stillem `return`.
27. ✅⚪ Panel-Zeile „⭐ 4,86 bei 212“ klarer: „⭐ 4,86 (212 Bewertungen)“.
28. ⏭️⚪ Hero-Bild leicht animieren: Punktwerte zählen hoch, Top 3 sortieren sich einmal ein (mit `prefers-reduced-motion`-Aus). _(Nicht umgesetzt: bewusst weggelassen, Hero bleibt ruhig)_
29. ✅⚪ Hero-Bühne auf dem Handy ist 430–470 px hoch und schiebt alles nach unten. Auf ~360 px reduzieren oder unter den CTA-Bereich kompakter.
30. ✅⚪ Pill-Text kürzen: „Plugin für die Airbnb-Suche · kostenlos“.
31. ⏭️⚪ „In 2 Minuten“ ist eine Behauptung ohne Beleg. Entweder im „So geht's“ zeigen (Schritt-Zeiten) oder vorsichtiger formulieren. _(Nicht umgesetzt: Werbeaussage, Entscheidung des Betreibers)_
32. ⏭️⚪ Rechtliches: „Das passende Airbnb“ nutzt die Marke als Gattungsbegriff. Prüfen lassen bzw. Alternative „Die passende Unterkunft auf Airbnb“ bereithalten. _(Nicht umgesetzt: rechtliche Prüfung nötig)_

## C. Vertrauen und Beweis
33. ⏭️🟠 Echter Screenshot des Plugin-Panels auf einer Airbnb-Suchseite (mit „Beispiel“ markiert). Aktuell gibt es kein einziges Bild des echten Produkts. _(Nicht umgesetzt: braucht eine echte Aufnahme des Plugins)_
34. ⏭️🟠 Kurzes stummes Video/GIF (10–15 s): Suche öffnen → Panel → Top 3 erscheinen. _(Nicht umgesetzt: braucht eine echte Aufnahme des Plugins)_
35. ⏭️🟠 GitHub-Sterne / letzte Version / Datum als kleine Leiste („v1.x · aktualisiert am …“), ohne Fremd-Badge-Server (CSP), beim Build einsetzen. _(Nicht umgesetzt: bräuchte Build-Schritt oder Fremd-Badge (CSP))_
36. ✅🟠 „Datenschutz in einem Satz“-Kasten mit Schloss-Symbol: „Kein Konto, kein StayMatch-Server, alles im Browser.“
37. ✅🟠 Hinweis „Code prüfen“ mit Link auf die Content-Script-Datei auf GitHub für Skeptiker beim Entwicklermodus.
38. ✅⚪ Abschnitt „Wie wir rechnen“ mit der Punkte-Formel (Sterne gewichtet, Preis, Wünsche) als aufklappbares Detail.
39. ✅⚪ Bei Gruppen die Formel klein zeigen: „0,6 × schlechtester + 0,4 × Schnitt“ (die Beispielzahlen 52 und 76 stimmen, gerechnet geprüft).
40. ⏭️⚪ Echte Nutzerstimmen sammeln (z. B. GitHub Discussions) und erst dann zeigen; bis dahin bleibt der ehrliche „Szenarien“-Hinweis. _(Nicht umgesetzt: es gibt noch keine echten Stimmen)_

## D. Plugin-Installation (größte Hürde)
41. ⏭️🟠 Chrome Web Store als Ziel Nr. 1: Entwicklermodus schreckt die meisten ab. Bis dahin ein „Benachrichtige mich“-Weg (z. B. GitHub „Watch → Releases“). _(Nicht umgesetzt: externer Prozess (Chrome Web Store))_
42. ⏭️🟠 Zu jedem der 5 Schritte ein kleines Bild/GIF (Entwicklermodus-Schalter, „Entpackt laden“). _(Nicht umgesetzt: braucht echte Screenshots der Erweiterungs-Seite)_
43. ✅🟠 Kopier-Knopf neben `chrome://extensions` (Link darauf ist nicht möglich).
44. ✅🟠 Edge (`edge://extensions`) und Brave (`brave://extensions`) eigens nennen bzw. per Browser-Erkennung den richtigen Pfad zeigen.
45. ✅🟠 Dateigröße und Version am Download-Knopf: „Plugin herunterladen (ZIP, 120 KB, v1.4)“.
46. ✅⚪ Nach Klick auf Download die Schrittliste hervorheben/hineinscrollen.
47. ✅⚪ Hinweis „Mac: ZIP wird oft automatisch entpackt“.
48. ✅⚪ Browser-Hinweis erkennt Opera/Vivaldi/Arc nicht als geeignet, obwohl dort Chrome-Erweiterungen laufen. Liste erweitern.
49. ✅⚪ „Nur Chrome, Edge und Brave am Computer“ steht 4× auf der Seite. Einmal prominent reicht.
50. ✅⚪ Fehlerhilfe: „Plugin erscheint nicht?“ als eigener FAQ-Punkt (Seite neu laden, Airbnb-Domain, Erweiterung aktiv).

## E. Inhalte und Texte
51. ✅🟠 Wiederholungen streichen: „Ehrliche Sterne“ kommt in Leiste, Funktionen und Vergleich vor; „40 Tabs/Inserate“ dreimal.
52. ✅🟠 FAQ zusammenlegen: „Ist das Plugin von Airbnb erlaubt?“, „Durchsucht das Plugin Airbnb im Hintergrund?“ und Grenzen-Punkt 1 sagen dasselbe.
53. ✅🟠 FAQ von 13 auf ~8 Fragen kürzen, Rest auf eine Hilfe-Seite.
54. ✅🟠 „Warum nur Airbnb?“ Antwort klingt technisch („Suche per Link“). Nutzerorientiert: „Weil dort die meisten Ferienwohnungen sind; Booking.com ist eine Idee für später.“
55. ✅⚪ Neuer Abschnitt „Beliebte Städte“ mit Links auf die 9 vorhandenen `staedte/`-Seiten (heute von der Startseite nicht verlinkt; gut für SEO und Nutzer).
56. ⏭️⚪ Funktionen-Karte „Merkt sich, was du gesehen hast“ mit Mini-Beispiel „Preis −12 € seit Montag“. _(Nicht umgesetzt: offen, klein)_
57. ✅⚪ Gruppen-Beispiel heißt „Altstadt“, Hero zeigt Barcelona: „Gòtic“ verwenden, damit es eine Geschichte ist.
58. ✅⚪ Schluss-Abschnitt: „Weniger klicken, schneller buchen.“ ok, Unterzeile wiederholt den Hero. Lieber konkreter Nutzen.
59. ⏭️⚪ Eyebrow „Warum nicht einfach sortieren?“ in die Navigation aufnehmen oder als Vergleichstabelle (3 Zeilen ✓/✗) kompakter. _(Nicht umgesetzt: offen, Vergleich bleibt als zwei Karten)_
60. ✅⚪ Einheitliches Du/Ihr: Gruppen-Texte wechseln zwischen „du“ und „eure“ (twitter:description).
61. ⏭️⚪ „Workation“-Szenario: WLAN-Warnung mit Beispiel-Stichwort („‚WLAN langsam‘ in 3 Bewertungen“). _(Nicht umgesetzt: offen, klein)_
62. ⏭️⚪ Kleiner Abschnitt „Was ist neu“ (letzte 3 Einträge aus `CHANGELOG.md`). _(Nicht umgesetzt: offen)_

## F. Navigation und Aufbau
63. ✅🟠 Viertel-Finder (`/app`) fehlt in der Navigation. Als zweiten Knopf oder Link ergänzen.
64. ✅🟠 Sprachumschalter DE/EN (läuft in eigener Sitzung).
65. ✅⚪ Aktiver Navigationspunkt beim Scrollen hervorheben (IntersectionObserver).
66. ✅⚪ Handy: horizontale Link-Leiste zeigt nicht, dass sie scrollt. Verlauf am Rand oder Menü-Knopf.
67. ⏭️⚪ „Grenzen“ in die FAQ-Navigation oder unter FAQ als Teil davon. _(Nicht umgesetzt: Grenzen bleiben eigener Abschnitt direkt nach der FAQ)_
68. ⏭️⚪ „Nach oben“-Knopf auf langen Handy-Seiten. _(Nicht umgesetzt: offen)_
69. ✅⚪ Abschnittsreihenfolge testen: Plugin-Installation steht erst an Position 7; direkt nach „So geht's“ wäre näher am Handeln.

## G. Barrierefreiheit
70. ✅🟠 Theme-Knopf: `aria-pressed` bzw. dynamisches Label („Zu Hell wechseln“).
71. ✅🟠 Emoji-Icons (✅💬⭐💶🗺️🧠) sehen je System anders aus und werden teils vorgelesen. SVG-Icons im Stil des Logos.
72. ✅⚪ Chips in der Hero-Grafik sind Text in `role="img"`; Beschreibung in `aria-label` ist gut, aber die Zahlen „91/86/79“ fehlen dort.
73. ✅⚪ `.mobile-hint` erscheint auf Touch-Laptops (Windows) fälschlich; UA-Erkennung wie beim Browser-Hinweis nutzen.
74. ✅⚪ Fehlende `autocomplete`-Werte bei Datum/Gäste unproblematisch, aber `inputmode="numeric"` für Gäste.
75. ✅⚪ Link-Unterstreichung im Footer nur über Farbe unterscheidbar bei `--dim`/`--muted`.
76. ✅⚪ Fokus-Reihenfolge prüfen: Schnellstart-Knopf „Suchen“ öffnet neues Fenster ohne Ankündigung („öffnet Airbnb in neuem Tab“).

## H. SEO und Teilen
77. ✅🟠 FAQ als `FAQPage`-JSON-LD auszeichnen.
78. ✅🟠 JSON-LD erweitern: `downloadUrl`, `softwareVersion`, `browserRequirements`, `screenshot`.
79. ✅🟠 `hreflang` de/en/x-default (mit EN-Version).
80. ⏭️⚪ Neues `og.png` mit dem echten Panel-Screenshot statt reiner Schrift. _(Nicht umgesetzt: og.png braucht Gestaltung mit Schrift, nicht per KI)_
81. ✅⚪ `sitemap.xml` um die Städte-Seiten und `lastmod` ergänzen.
82. ⏭️⚪ Title testen: „StayMatch – Top 3 Airbnbs automatisch finden (kostenloses Chrome-Plugin)“ enthält Suchbegriffe. _(Nicht umgesetzt: Titel ist Werbeaussage, Entscheidung des Betreibers)_
83. ✅⚪ Überschriften-Gliederung: Leiste ohne Überschriften, Bars nutzen `h4` direkt nach `h2` (h3 fehlt).

## I. Technik, Tempo, Sicherheit
84. ⏭️🟠 Inline-Skripte in eine Datei auslagern, dann kann `script-src 'unsafe-inline'` aus der CSP. _(Nicht umgesetzt: eine CSP gilt für alle Seiten, App und Stadtseiten nutzen Inline-Skripte)_
85. ⏭️🟠 Fotos (alle über 100 KB als JPG) zusätzlich als AVIF; spart ~40 %. _(Nicht umgesetzt: kein AVIF-Encoder auf dem Rechner)_
86. ⏭️⚪ Das Schluss-Hintergrundbild lädt `loading="lazy"` ✓; das „So geht's“-Bild ist groß (21:8) und knapp unter dem Falz: `fetchpriority="low"` setzen. _(Nicht umgesetzt: Bilder laden schon `lazy`)_
87. ⏭️⚪ Theme dreistufig (System/Hell/Dunkel) statt nur Umschalten, damit man zur Systemeinstellung zurückkommt. _(Nicht umgesetzt: offen)_
88. ⏭️⚪ Inter-Schrift: `latin-ext` nicht vorladen ✓; prüfen, ob Unicode-Bereich `€` (U+20AC) in `latin` liegt ✓. OK, nur bei EN-Seite Subset prüfen. _(Nicht umgesetzt: nichts zu tun)_
89. ✅⚪ `window.open` ohne Rückmeldung; bei Pop-up-Blocker Fallback `location.href` anbieten.
90. ✅⚪ Kleiner Smoke-Test in `tests/`: alle internen Links und `staymatch-plugin.zip` antworten mit 200.
91. ⏭️⚪ Datenschutzfreundliche Reichweitenmessung (z. B. Vercel Web Analytics ohne Cookies), um zu sehen, ob „Plugin herunterladen“ geklickt wird. Vorher Datenschutzerklärung anpassen. _(Nicht umgesetzt: Datenschutzerklärung und Entscheidung des Betreibers nötig)_

## J. Bilder (neu generieren mit Lumina)
Regeln aus `LUMINA-PROMPTS.md`: keine Marken, keine erkennbaren Personen, keine Schrift, Farben `#e0475b`/`#ff8a5c`/`#0b0b0d`, 16:9, unter 150 KB als WebP+JPG.
92. ✅🟠 Funktionen-Band: Hände halten Notizbuch mit Häkchenliste neben Stadtplan und Kaffee (Wünsche).
93. ✅🟠 „Für wen?“: vier kleine Szenen-Bilder statt reiner Textkarten: Einzelreisende mit Rucksack von hinten an Straßenbahn · Frühstück für zwei auf Balkon · Laptop-Arbeitsplatz mit Pflanze und Fensterblick · lange Tafel mit Gläsern ohne Gesichter.
94. ✅🟠 Plugin-Abschnitt: Laptop von schräg oben, Bildschirm zeigt abstrakte Kartenliste mit drei hervorgehobenen Karten (keine lesbare Schrift).
95. ✅⚪ Vergleich „Nur Airbnb vs. StayMatch“: Bildschirm mit vielen offenen Tabs (abstrakt, chaotisch) vs. aufgeräumter Schreibtisch.
96. ✅⚪ Ehrliche Sterne: Makro von goldenen Sternen/Plaketten auf Holz mit Tiefenschärfe.
97. ⏭️⚪ FAQ/Grenzen: ruhige Detailaufnahme Schlüssel mit Anhänger auf Fensterbank. _(Nicht umgesetzt: nicht nötig, FAQ bleibt ohne Bild)_
98. ✅⚪ Städte-Abschnitt: 9 quadratische Stadtstimmungen (Dächer Lissabon, Kanäle Amsterdam …), ohne Wahrzeichen-Logos/Schrift.
99. ⏭️⚪ Neues `og.png` (1200×630) als Komposition aus Stimmungsfoto + Logo-Farbverlauf (Schrift danach im Code/Grafik setzen, nicht von der KI). _(Nicht umgesetzt: siehe 80)_
100. ⏭️⚪ Hell-Modus-Varianten: die drei vorhandenen Fotos sind eher abendlich; für Hell-Modus hellere Tag-Versionen per `<source media="(prefers-color-scheme: light)">`. _(Nicht umgesetzt: offen)_
