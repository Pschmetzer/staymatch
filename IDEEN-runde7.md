# Ideen Runde 7

Aus dem Code abgeleitet (Stand `origin/main` 8c4930b, 2026-11-13), gegen alle Titel aus Runde 1 bis 6 abgeglichen. 🔴 Fehler/Risiko, 🟠 deutliche Verbesserung, 🟢 nett, 💡 neues Feature. Aufwand: S klein, M mittel, L groß. Umsetzungsstand steht in den Branches `feat/r7-*`.

## Browser-Extension

Stand: origin/main `8c4930b`. Abgeglichen mit `prior-ideas.txt` (Runde 1 bis 6). Mit „geprüft“ markierte Punkte habe ich per Node gegen den echten Code nachgestellt.

### Parser Suchseite (parse.js)

1. **R7-1** 🔴 **Indische Tausendergruppen** (`extension/parse.js:8`) „₹1,23,456 total“ wird zu 1,23 gelesen (geprüft), weil `AMT` nur Dreiergruppen kennt. Bei ₹ zusätzlich `\d{1,2}(?:,\d{2})+,\d{3}` zulassen. (S)
2. **R7-2** 🟠 **Nachtwort ohne „pro“** (`extension/parse.js:16`) `NIGHT_RE` kennt „per night“, aber nicht die kurze Form „$120 night“ oder „80 € Nacht“ (geprüft: `priceWord` false). Solche Preise fallen aus dem Median und gelten als unsichere Einheit. `\bnight\b|\bnacht\b|\bnuit\b|\bnoche\b` ergänzen. (S)
3. **R7-3** 🟢 **„lei“ im Fließtext als Währung** (`extension/parse.js:10`) `currency('Una casa per lei')` liefert „lei“ (geprüft), es gibt nur einen Lookahead, keinen Lookbehind. `(?<!\p{L})` davor setzen und „lei“/„kr“ nur mit Betrag gelten lassen. (S)
4. **R7-4** 🟠 **Mehrfachangebot zu breit erkannt** (`extension/parse.js:59`) `isMultiUnit` trifft jedes „available/verfügbar“, auch „Self check-in available“ oder „Sofort verfügbar“ (geprüft). Eine Zahl davor verlangen („3 Wohnungen verfügbar“). (S)
5. **R7-5** 🟢 **Fremde Badge-Texte ungekürzt gespeichert** (`extension/parse.js:66`) `normBadge` gibt beliebigen Badge-Text zurück, der in Pool, Vergleich und Plakette landet. Auf 40 Zeichen kürzen, Steuerzeichen entfernen. (S)
6. **R7-6** 🟠 **Schlafzimmer im Singular (ES/IT)** (`extension/parse.js:104`) „1 habitación“ und „1 camera da letto“ ergeben `bedrooms: null` (geprüft), gelistet sind nur `habitaciones` und `camere`. `habitaci(?:ón|ones)|camer[ae]` aufnehmen. (S)
7. **R7-7** 🟢 **Gewerblicher Gastgeber nur in 4 Sprachen** (`extension/parse.js:107`) „host professionista“, „professionele host“, „anfitrião profissional“ fehlen, obwohl die Domains im Manifest stehen. Liste wie bei den Betten ausbauen. (S)
8. **R7-8** 🟠 **Viertel aus Titel: w, v, am, auf fehlen** (`extension/parse.js:122`) „Apartament w Krakowie“ und „Byt v Praze“ liefern null (geprüft), ebenso „Ferienhaus am Gardasee“ oder „auf Mallorca“. `w|v|am|auf|σε|στο|στη` in die Präpositionsliste. (S)
9. **R7-9** 🟠 **Leere State-Werte überschreiben DOM-Treffer** (`extension/parse.js:242`) Der Filter `v != null && v !== ''` lässt `badges: []`, `multiUnit: false` und `pro: false` durch. Ein im DOM erkannter Superhost verschwindet so. Leere Arrays und `false` aus dem State nur übernehmen, wenn der DOM-Wert fehlt. (S)
10. **R7-10** 🟠 **Nur-State-Rückfall ohne Veraltet-Hinweis** (`extension/parse.js:252`) Findet `fromCards` nichts (Selektor kaputt), gelten alle State-Preise ohne `priceStale`, obwohl sie nach Blättern oder Datumswechsel alt sein können. Im Rückfall `priceStale: true` setzen und im Panel sagen. (S)
11. **R7-11** 🟢 **Listing-Id und propertyId in einer Map** (`extension/parse.js:235`) Zwei verschiedene Id-Räume teilen sich `byId`. Eine zufällig gleiche Zahl ordnet fremde Daten zu. Zwei Maps verwenden. (S)
12. **R7-12** 🟢 **diagnose parst alles JSON noch einmal** (`extension/parse.js:263`) `diagnose` wiederholt `JSON.parse` aller State-Blöcke, obwohl `stateResults` sie gerade gecacht hat. `stateNote`/`stateCount` beim Cachen mitschreiben. (S)
13. **R7-13** 🟢 **Rabatt erkannt, aber verworfen** (`extension/parse.js:76`) `priceOf` liefert `discounted: true`, `fromState`/`fromCards` übernehmen das Feld nicht. Mitnehmen und im Panel als „Rabatt“ zeigen. (S)
14. **R7-14** 🟢 **Sterne aus beliebigem aria-label** (`extension/parse.js:208`) Alle `[aria-label]` der Karte werden durchsucht, auch Bildzähler und Preislabels. Auf Elemente mit `role="img"` oder Stern-Kontext begrenzen. (S)
15. **R7-15** 🟢 **Titel-Rückfall unbemerkt** (`extension/parse.js:215`, `extension/parse.js:277`) Bricht `listing-card-name`, heißen alle Karten wie ihre Art („Wohnung in Berlin“), auch im Teilen-Text. `quality()` soll `noTitle` zählen und im Panel melden. (S)

### Parser Unterkunftsseite (content-listing.js und Textfunktionen)

16. **R7-16** 🔴 **Preis mit Währung vorn wird nicht gelesen** (`extension/content-listing.js:19-20`) `nightM`/`totalM` verlangen „Zahl, dann Währung“. „$120 night“, „£95 night“, „CHF 140“ ergeben auf .com, .co.uk und .ch gar keinen Preis. `P.priceOf` und `AMT_CUR` statt eigener Regex nutzen. (S)
17. **R7-17** 🟠 **Eigene Mini-Währungsliste und Rabattfalle** (`extension/content-listing.js:19`) Nur €, CHF, £, $; zł, kr, R$, ¥ aus parse.js fehlen, und der erste (durchgestrichene) Preis gewinnt. Auf `P.priceOf`, `P.TOTAL_RE` und `NIGHT_RE` umstellen. (S)
18. **R7-18** 🟠 **Bewertungen doppelt gezählt** (`extension/content-listing.js:21`) `[data-review-id]` und `[data-section-id*="REVIEWS"] [role="listitem"]` treffen oft verschachtelte Knoten derselben Bewertung, Stichworte erscheinen als „(2×)“ und drücken die Wertung doppelt. Nur äußerste Treffer behalten. (S)
19. **R7-19** 🔴 **„Nicht erstattungsfähig“ schlägt kostenlose Frist** (`extension/parse.js:357`) „Kostenlose Stornierung vor dem 12. Mai. Danach nicht erstattungsfähig.“ ergibt `nonrefundable` (geprüft). Erst die kostenlose Frist suchen, dann den Rest. (S)
20. **R7-20** 🔴 **„streng verboten“ wird strenge Stornierung** (`extension/parse.js:361`, `extension/content-listing.js:24`) `rulesText` enthält Hausregeln, „Rauchen ist streng verboten“ ergibt `strict` (geprüft). Storno nur aus dem CANCELLATION-Abschnitt lesen und „streng“ an „Stornierung/Richtlinie“ koppeln. (S)
21. **R7-21** 🟠 **Ruhezeit „10 pm to 8 am“ ergibt 10 bis 8 Uhr** (`extension/parse.js:327`) am/pm wird erkannt, aber nicht umgerechnet (geprüft `from: 10`). pm-Gruppe fangen und 12 addieren. (S)
22. **R7-22** 🔴 **Geschirrspüler zählt als Waschmaschine** (`extension/parse.js:344`) `washer` ohne Grenze trifft „Dishwasher“ (geprüft). `(?<!dish)washer` und „Geschirrspüler/lave-vaisselle“ als eigenes Merkmal. (S)
23. **R7-23** 🟠 **„lift“ und „pool“ ohne Kontext** (`extension/parse.js:343`, `extension/parse.js:346`) „Skilift nearby“ ergibt Aufzug, „Pool table“ ergibt Pool (geprüft). Wortgrenzen und Ausschlüsse („pool table“, „Billard“, „Skilift“). (S)
24. **R7-24** 🟢 **Superhost aus jedem Vorkommen des Worts** (`extension/parse.js:370`) Auch „Was ist ein Superhost?“ setzt `superhost: true` (ungeprüft live, ob der Text dort steht). An „ist Superhost“ oder das Badge-Element binden. (S)
25. **R7-25** 🟢 **Kurtaxe-Ausschluss trifft „Plus“** (`extension/parse.js:396`) `plus` mit „tax“ in 40 Zeichen markiert jede Erwähnung als „vor Ort zu zahlen“. `plus` nur mit Zahl oder Währung danach. (S)
26. **R7-26** 🟢 **JSON-LD mit `@graph` übersehen** (`extension/content-listing.js:12`) Nur oberste Objekte oder Arrays werden durchsucht, und ein späteres Skript überschreibt den ersten Treffer. `[].concat(j, j['@graph'] || [])` und nach erstem Fund ganz abbrechen. (S)
27. **R7-27** 🟢 **Note aus JSON-LD ungeprüft** (`extension/content-listing.js:44`) `+ratingValue` wird bei „4,9“ zu NaN und so gespeichert, denn der Leerwert-Filter lässt NaN durch. `Number.isFinite` prüfen, Komma ersetzen. (S)
28. **R7-28** 🟠 **Ort auf der Unterkunftsseite ist die Stadt** (`extension/content-listing.js:47`) `addressLocality` ist meist „Barcelona“, auf der Suchseite steht „Gràcia“. Geschmack (`localities`) und Namensabgleich passen so nie. `city` und `locality` trennen, Viertel aus Titel oder Brotkrumen lesen. (S)
29. **R7-29** 🟢 **og:image ohne Prüfung** (`extension/content-listing.js:43`) Anders als in parse.js läuft kein `safeImage`. Funktion exportieren und hier nutzen. (S)
30. **R7-30** 🟠 **Preisverlauf vergleicht verschiedene Reisen** (`extension/content-listing.js:64`, `extension/content-listing.js:84`) `priceHistory` speichert nur `p`, ohne Währung, Datum und Nächte; „Preis seit dem ersten Besuch +40 %“ vergleicht dann Juli mit November. `checkin`, `nights`, `currency` je Eintrag speichern und nur Gleiches vergleichen. (S)
31. **R7-31** 🟢 **Zeitgewichtete Bewertung ist nie aktiv** (`extension/rank.js:58`, `extension/content-listing.js:21`) `effectiveRating` braucht `l.reviews` mit Datum und Note, `roomData` füllt das Feld nie. Datum je Bewertung lesen oder Funktion samt Test streichen. (M)

### Stichworte aus Bewertungen (hints.js)

32. **R7-32** 🔴 **Wortgrenze an Umlauten** (`extension/hints.js:19-20`) `\b` vor „ü“ und nach „ß“ greift in JS nicht: „zu heiß“, „Überteuerte Reinigungsgebühr“ und „Gebühr war überteuert“ ergeben nichts (geprüft). Unicode-Grenzen `(?<!\p{L})…(?!\p{L})` mit Flag `u`. (S)
33. **R7-33** 🔴 **Verneinung innerhalb des Treffers** (`extension/hints.js:9`, `extension/hints.js:16`, `extension/hints.js:32`) „Der Gastgeber war nicht freundlich“ ergibt „👍 Gastgeber“ (geprüft), weil `NEG` nur die 30 Zeichen davor prüft. Gleiches bei „WLAN war nicht schlecht“. Auch `m[0]` auf Verneinung prüfen. (S)
34. **R7-34** 🟠 **„laut“ als Präposition** (`extension/hints.js:10`) „Laut Beschreibung gibt es WLAN“ ergibt „⚠️ laut“ (geprüft) und kostet Punkte. „laut“ vor Artikel oder Substantiv („laut der“, „laut Beschreibung“) ausschließen. (S)
35. **R7-35** 🟠 **„Nicht nur sauber“ wird Warnung** (`extension/hints.js:23`, `extension/hints.js:33`) ergibt „⚠️ nicht sauber“ (geprüft). „nicht nur“, „not only“, „non solo“ vor dem Verneinungstest entfernen. (S)
36. **R7-36** 🟢 **Holprige Verneinungs-Labels** (`extension/hints.js:35`) Es entstehen „⚠️ nicht Lage“ oder „⚠️ nicht Gastgeber“. Je Muster ein eigenes Gegenlabel („Lage enttäuschend“, „Gastgeber unfreundlich“). (S)

### Ranking (rank.js)

37. **R7-37** 🔴 **Viertel ohne `total` macht den Passt-Wert NaN** (`extension/rank.js:288`, `extension/bridge.js:18`) Die Brücke lässt Viertel ohne `total` durch, `area.total / 100` wird NaN und damit der ganze Score (geprüft). In der Brücke `total` Pflicht machen, in `areaFor` und im Mittel (Zeile 27) nur Viertel mit Zahl nutzen. (S)
38. **R7-38** 🟠 **Geschmack übersieht Währungs-Aliase** (`extension/rank.js:140`, `extension/rank.js:158`) `buildTaste` und `tasteScore` vergleichen roh: Profil in „€“, Angebot in „EUR“ gibt keinen Preisbonus (geprüft 0,5 statt 0,7). Beide Seiten durch `normCur`. (S)
39. **R7-39** 🟠 **„bei 0 Bewertungen“ bei unbekannter Anzahl** (`extension/rank.js:317`) Kommt die Note aus dem aria-label, ist `reviewCount` null und der Text sagt „⭐ 4,9 bei 0 Bewertungen“ (geprüft). Bei null „Anzahl unbekannt“. (S)
40. **R7-40** 🟠 **Normaler Nachtpreis steht unter Warnungen** (`extension/rank.js:341`) Ohne Budget, aber mit bekannten Nächten, landet „80 € pro Nacht“ als ⚠️ (geprüft), ein Gesamtpreis im selben Fall dagegen unter Gründen. Neutral zeigen, Warnung nur bei fehlender Nächtezahl. (S)
41. **R7-41** 🟠 **Fallback-Währung „€“ überall** (`extension/rank.js:330`, `extension/rank.js:425-427`, `extension/content-search.js:110`, `extension/content-search.js:186`) Ohne gelesene Währung zeigen Panel, Plakette und Vergleich „€“, auch auf airbnb.com in USD. Leer lassen oder aus der Domain ableiten. (S)
42. **R7-42** 🟢 **Preise roh ausgegeben** (`extension/rank.js:334`, `extension/content-search.js:157`) `${l.totalPrice}` zeigt „1234.5 €“ ohne Rundung und Gruppierung. Eine Formatfunktion (`Intl.NumberFormat`) für alle Preisstellen. (S)
43. **R7-43** 🟢 **Luxus entscheidet Gleichstände immer** (`extension/rank.js:403`) Bei gleichem Score gewinnt die „luxuriösere“ Unterkunft, auch wenn niemand Luxus will. Diesen Tiebreak nur mit Wunsch `luxury`, sonst günstiger zuerst. (S)
44. **R7-44** 🟢 **„schon angesehen“ als Vorzug** (`extension/rank.js:371`) Steht in `why` wie ein Pluspunkt. Als neutrale Info führen. (S)
45. **R7-45** 🟢 **Vergleichszeile „Gastgeber“ zeigt Gäste-Favorit** (`extension/rank.js:431`) „Gäste-Favorit“ ist keine Gastgeber-Eigenschaft. Zeile „Auszeichnung“ nennen. (S)
46. **R7-46** 🟢 **Notizen gehen ungefragt in den Gruppenchat** (`extension/rank.js:448`, `extension/popup.js:142`) `shareText` hängt jede private Notiz an die Merkliste. Notizen nur auf Wunsch mitnehmen. (S)
47. **R7-47** 🟢 **Teilviertel-Mittel mit Koordinate des ersten** (`extension/rank.js:28`) Bei mehreren Namenstreffern stehen lat/lon des ersten Teilviertels. Schwerpunkt der Treffer oder null. (S)
48. **R7-48** 🟢 **`avgPricePerNight` nimmt irgendeine Währung** (`extension/rank.js:148`) Erste Währung gewinnt, ein Altpfad in `tasteScore` (Zeile 159) vergleicht dann falsch. Feld streichen, nur `ByCurrency`. (S)
49. **R7-49** 🟠 **Zusammensetzung ohne Gewichte und Abzüge** (`extension/content-search.js:113-114`, `extension/rank.js:302`) Das Panel zeigt Rohwerte der Teile („Preis 80“), nicht die Punkte aus `breakdown`, und `adjust` (Bad −4, Zimmer −8, Hinweise −8) fehlt ganz. Punkte plus Zeile „Abzüge“ zeigen, dann geht die Summe auf. (S)
50. **R7-50** 🟢 **Jede Bewertungswarnung kostet gleich** (`extension/rank.js:307`, `extension/rank.js:376`) Einmal „laut“ unter 30 Bewertungen zieht so viel ab wie zehnmal. Abzug nach der ×-Zahl staffeln. (S)
51. **R7-51** 🟢 **Fester Bayes-Prior 4,6** (`extension/rank.js:37`) Je Stadt liegt der Schnitt anders; in Märkten mit Median 4,85 wird fast jede Unterkunft gleich bewertet. Prior aus dem Notenmedian der Seite ableiten. (S)

### Panel Suchseite (content-search.js)

52. **R7-52** 🔴 **Popup empfiehlt abgelehnte Unterkünfte** (`extension/content-search.js:82`) `lastSearch.top` speichert `ranked.slice(0, 10)` ohne 👎- und Filterprüfung. Dieselbe Auswahl wie `currentTop` speichern. (S)
53. **R7-53** 🟠 **Budget im Kopf passt nicht zur Rechnung** (`extension/content-search.js:122`) Kopf zeigt `trip.budget` roh, gerechnet wird mit `effectiveBudget` (auf andere Nächte umgerechnet). Den genutzten Wert und die Nächte zeigen. (S)
54. **R7-54** 🟢 **Gekürzte Titel zerbrechen Emoji** (`extension/content-search.js:144`) `.slice(0, 28)` schneidet UTF-16-Paare, es entstehen „�“. `Array.from(t).slice(0, 28)` oder CSS `text-overflow`. (S)
55. **R7-55** 🟢 **Abdunkeln bleibt hängen** (`extension/content-search.js:176`) Wird eine Karte nicht mehr gerankt (`!l`), behält sie ihre alte `opacity`. Auch in diesem Zweig zurücksetzen. (S)
56. **R7-56** 🟢 **Kein „Filter zurücksetzen“** (`extension/content-search.js:160`) Bei „Keine Unterkunft erfüllt alle Filter“ fehlt ein Knopf, der alle Filter löscht. (S)
57. **R7-57** 🟢 **Filter gelten still für jede neue Suche** (`extension/content-search.js:78`) `filters` liegt global im Speicher; wer gestern „nur Luxus“ setzte, sieht heute in einer anderen Stadt fast nichts. Filter je Suche speichern oder beim Suchwechsel darauf hinweisen. (S)
58. **R7-58** 🟢 **Toter Signaturteil `pricePerNight`** (`extension/content-search.js:44`) Suchdaten haben kein `pricePerNight`, der Teil ist immer leer; ein Wechsel der Einheit (`isTotal`) ändert die Signatur nicht. `isTotal` statt dessen aufnehmen. (S)
59. **R7-59** 🟢 **Unbehandelte Promise** (`extension/content-search.js:116`) `handleSearch()` in `setQuick` ohne `.catch`, Fehler erscheinen als „Uncaught (in promise)“ in Airbnbs Konsole. (S)
60. **R7-60** 🟢 **„Staat“ im Diagnosebericht** (`extension/content-search.js:94`) Gemeint ist der Seitenzustand. „Seitendaten:“ wie in Zeile 97. (S)
61. **R7-61** 🟢 **checkEmpty diagnostiziert vor dem Prüfen** (`extension/content-search.js:91-92`) Das teure `diagnose` läuft, obwohl gleich danach `parseSearch` Treffer findet. Reihenfolge tauschen. (S)
62. **R7-62** 🟢 **Fehlerpanel ohne „Erneut versuchen“** (`extension/content-search.js:95-102`) Lädt die Seite nur langsam, bleibt die Meldung bis zur nächsten DOM-Änderung. Knopf, der `handleSearch` neu startet. (S)
63. **R7-63** 🟢 **Fehler melden nur mit GitHub-Konto** (`extension/content-search.js:100`) Wer kein Konto hat, kann nicht melden. Zweiten Weg anbieten (Formular oder Mail mit vorbefülltem Bericht). (S)
64. **R7-64** 🟢 **Budgetfeld mit `step="10"`** (`extension/content-search.js:117`) 125 gilt als ungültig, die Pfeiltasten springen in Zehnern. `step="1"` oder `any`. (S)
65. **R7-65** 🟢 **Alt+Shift+V öffnet ein geschlossenes Panel wieder** (`extension/content-search.js:192`) Nach ✕ baut `renderSearch` das Panel sofort neu. Geschlossen-Zustand merken und Tasten dann ignorieren. (S)
66. **R7-66** 🟢 **Fünf Speicherzugriffe nacheinander** (`extension/content-search.js:51`, `extension/content-search.js:58`, `extension/content-search.js:61`, `extension/content-search.js:68`) Jeder Lauf wartet auf vier bis fünf getrennte `get`. Ein gemeinsamer Lesevorgang oder `Promise.all`. (S)

### Panel Unterkunftsseite (content-listing.js)

67. **R7-67** 🔴 **Betrugshinweise fehlen dort, wo man bucht** (`extension/content-listing.js:36`, `extension/content-listing.js:85-98`) `scamSignals` werden gelesen und gespeichert, aber nur auf der Suchseite gezeigt. Als deutliche Zeile oben ins Unterkunfts-Panel. (S)
68. **R7-68** 🟠 **Hausregeln, Gastgeber, Kurtaxe nie gezeigt** (`extension/content-listing.js:31-35`) `houseRules`, `hostInfo`, `touristTax` landen nur im Speicher. Kompakte Zeile („Keine Partys · Ruhe ab 22 Uhr · Kurtaxe vor Ort“) oder gar nicht erst lesen. (S)
69. **R7-69** 🟠 **Passt-Wert der Suche fehlt hier** (`extension/content-listing.js:85`) Wer aus den Top 3 klickt, sieht weder Score noch Gründe, obwohl `lastSearch`/`pool` sie kennen. Wert und zwei Gründe übernehmen. (S)
70. **R7-70** 🟢 **Personenzahl ohne Airbnb-Gäste** (`extension/content-listing.js:69`, `extension/content-listing.js:79`) Hier zählt nur `trip.people`, auf der Suchseite haben `adults` Vorrang; ohne Reise heißt es „für dich“ auch bei `adults=4`. `R.resolvePeople` mit `sp.adults` nutzen. (S)
71. **R7-71** 🟢 **Panelname ohne Unterkunft** (`extension/content-listing.js:85`) Der Dialog heißt „schon 3× angesehen“, Screenreader erfahren nicht, worum es geht. Kurztitel als `aria-label`, Besuchszahl im Text. (S)

### Router und gemeinsame Teile (content-common.js)

72. **R7-72** 🟢 **Zwei Routen-Aufrufe bei Zurück** (`extension/content-common.js:185`, `extension/content-common.js:187`) `navigatesuccess` und `popstate` feuern beide, `route()` läuft doppelt. Mit Navigation API `popstate` weglassen. (S)
73. **R7-73** 🟢 **Toter Intervall-Rückfall** (`extension/content-common.js:186`) Mit `minimum_chrome_version: 110` gibt es die Navigation API immer. Zweig entfernen. (S)
74. **R7-74** 🟢 **CSS bei jedem Neuaufbau neu geparst** (`extension/content-common.js:135`) Jeder `panel()`-Aufruf erzeugt ein neues `<style>` mit rund 40 Regeln. Einmal `new CSSStyleSheet()` und `adoptedStyleSheets`. (S)
75. **R7-75** 🟢 **Fokus nach Kopier-Rückfall weg** (`extension/content-common.js:72-74`) Das Hilfs-Textfeld nimmt den Fokus und gibt ihn nicht zurück. Vorheriges Fokusziel merken und wiederherstellen. (S)
76. **R7-76** 🟢 **Fehlendes Modul bricht stumm** (`extension/content-common.js:157`, `extension/content-common.js:167`) Lädt `content-search.js` nicht (Syntaxfehler, Update), wirft `SMC.search.reset()` in jedem `route()`. Beim Start prüfen, ob `search` und `room` registriert sind, sonst Diagnosepanel. (S)

### Speicher und Sammeln (pool.js)

77. **R7-77** 🟠 **Überlauf wirft kleine Ids weg, nicht alte Seiten** (`extension/pool.js:33-36`) `Object.keys` stellt Ids unter 2³² numerisch sortiert vor alle anderen, „älteste zuerst“ stimmt daher nicht; alte Inserate mit kurzer Nummer fliegen immer zuerst. Nach Position von `item.page` in `pages` verwerfen. (S)
78. **R7-78** 🟢 **Abgelaufener Pool bleibt liegen** (`extension/pool.js:29`) Nach 2 h wird der Pool nur bei der nächsten Suche ersetzt, sonst bleiben bis zu 300 Titel mit Preisen dauerhaft im Speicher. Beim Start abgelaufene Pools löschen. (S)
79. **R7-79** 🟠 **Pool in `storage.session`** (`extension/content-search.js:51-53`) Der Pool ist nur 2 h gültig, wird aber auf die Platte geschrieben. `chrome.storage.session` (Zugriff für Content-Scripts per `setAccessLevel` im Service Worker) leert sich beim Schließen des Browsers. (M)
80. **R7-80** 🟢 **Altformat-Umzug nur im Popup** (`extension/popup.js:25-29`) Die alten `listings` werden erst umgezogen, wenn jemand das Popup öffnet; bis dahin sehen Such- und Unterkunftsseite alte Likes nicht. In `runtime.onInstalled` verschieben. (M)

### Brücke zur Web-App (bridge.js)

81. **R7-81** 🟠 **Zweiter Tab der Web-App wird nicht übernommen** (`extension/bridge.js:30`) Nur das eigene Event zählt; rechnet man in einem anderen Tab, kommt die Reise erst nach Neuladen an. Zusätzlich `storage`-Event auf `sm_trip` hören. (S)
82. **R7-82** 🟠 **Nur die ersten 60 Viertel** (`extension/bridge.js:16`) Die Web-App schreibt deutlich mehr Viertel, die Brücke nimmt die ersten 60. Unterkünfte in den übrigen bekommen ein entfernteres oder gar kein Viertel. Grenze anheben oder nach Lage statt Reihenfolge auswählen. (S)
83. **R7-83** 🟢 **`num` akzeptiert `true`** (`extension/bridge.js:6`) `+true` ist 1, `nights: true` würde 1 Nacht. Nur Zahl oder String zulassen. (S)
84. **R7-84** 🟢 **Wünsche und Typen ungeprüft** (`extension/bridge.js:14-15`) Beliebige Strings werden gespeichert, erst content-search filtert. Gleich gegen die Schlüssel von `WISHES` und `PRESETS` prüfen. (S)

### Popup

85. **R7-85** 🔴 **„gesamt“ auch bei Nachtpreisen** (`extension/popup.js:57`) `topRow` schreibt immer „… gesamt“, `lastSearch` speichert `isTotal` nicht. Das schon gespeicherte `stay` zeigen oder `isTotal` mitschreiben. (S)
86. **R7-86** 🟠 **Geschmack mittelt über Währungen** (`extension/popup.js:38`, `extension/popup.js:40`) Likes in € und $ werden gemittelt und als „€/Nacht“ gezeigt. `R.buildTaste` (ist geladen) je Währung nutzen. (S)
87. **R7-87** 🟠 **Unterkunft ohne gemerkte Daten öffnen** (`extension/popup.js:44`) `checkin`/`checkout` sind gespeichert (`content-listing.js:50`), der Link öffnet nur `/rooms/ID` ohne Preis und Verfügbarkeit. Daten als Parameter anhängen. (S)
88. **R7-88** 🟢 **Gleiche Datei nicht zweimal importierbar** (`extension/popup.js:117`) `file.value` bleibt gesetzt, ein zweites `change` kommt nicht. Danach `e.target.value = ''`. (S)
89. **R7-89** 🟢 **Import ohne Rückmeldung** (`extension/popup.js:123-124`) Nur die Liste ändert sich. „12 übernommen, 3 übersprungen“ anzeigen. (S)
90. **R7-90** 🟢 **CSV fragt nicht nach Notizen** (`extension/popup.js:112`) JSON fragt „mit Notizen?“, CSV nimmt sie immer mit. Gleiche Abfrage. (S)
91. **R7-91** 🟢 **CSV ohne Datum und Art** (`extension/popup.js:112`) `lastSeen`, `kind`, `checkin` fehlen. Spalten mit ISO-Datum ergänzen. (S)
92. **R7-92** 🟢 **Zwei widersprüchliche Einstiegstexte** (`extension/popup.js:67`, `extension/popup.js:73`) Kopf sagt „Öffne einfach eine Airbnb-Suche“, der leere Tab „Öffne im Viertel-Finder …“. Ein Text, Direktweg zuerst. (S)
93. **R7-93** 🟢 **`safeSearchUrl` nur per Regex** (`extension/popup.js:5`) Erlaubt `https://www.airbnb.evil.com/s/…`, während `isRoomUrl` gegen `AIRBNB_DOMAINS` prüft. Gleiche Hostprüfung nutzen. (S)
94. **R7-94** 🟢 **Popup lädt den ganzen Speicher** (`extension/popup.js:23`) `get(null)` zieht auch `reviewTexts`, Pool und `lastSearch`. Schlüssel zuerst holen (`getKeys`) und nur `l:*` lesen. (M)
95. **R7-95** 🟢 **„zwischenspeicher“ lässt Einklapp-Zustand stehen** (`extension/popup.js:154`) `min:sm-search`/`min:sm-room` bleiben, das Panel bleibt nach Zurücksetzen eingeklappt. In die Liste aufnehmen. (S)

### Sicherheit und Datenschutz

96. **R7-96** 🟠 **Offener Shadow Root** (`extension/content-common.js:82`) `mode: 'open'` erlaubt Airbnbs Skripten, Notiz, Budget und Gründe über `el.shadowRoot` zu lesen. `mode: 'closed'`, Referenz intern halten, Tests über `T`. (S)
97. **R7-97** 🟠 **Namen der Mitreisenden im Airbnb-DOM** (`extension/content-search.js:187`, `extension/rank.js:315`) Das `title`-Attribut der Plakette enthält alle `why`/`warn`, also z. B. „Lena wäre dort eher unzufrieden“. Seitenskripte können das lesen. Im `title` nur Score und Preis, Details im Shadow-Panel. (S)
98. **R7-98** 🟢 **Kopier-Rückfall legt Text in Airbnbs DOM** (`extension/content-common.js:72`) Das Textfeld hängt an `document.body`, Seitenskripte sehen den kopierten Text samt Notizen. Im eigenen Shadow Root anlegen. (S)
99. **R7-99** 🟠 **Keine eigene CSP für Erweiterungsseiten** (`extension/manifest.json:1-81`) Eine strenge `content_security_policy.extension_pages` mit `img-src 'self'; connect-src 'none'; object-src 'none'` würde „lädt nichts nach“ für das Popup technisch erzwingen. (S)

### MV3 und Manifest

100. **R7-100** 🟠 **Tastenkürzel über `chrome.commands`** (`extension/content-common.js:144-152`) Die eigene Alt+Shift-Abfrage ist nicht änderbar und kollidiert mit Tastaturbelegungen. `commands` erscheinen unter chrome://extensions/shortcuts und lassen sich frei belegen (braucht kleinen Service Worker zum Weiterreichen). (M)
101. **R7-101** 🟠 **Panel in Chromes Seitenleiste** (`extension/content-common.js:90`) Die `sidePanel`-API zeigt Top 3 und Vergleich neben der Seite, ohne Karten, Kalender oder Galerie zu verdecken. Overlay als Option behalten. (L)
102. **R7-102** 🟠 **Weitere Domains per optionaler Berechtigung** (`extension/manifest.json:21-46`) Jede neue Airbnb-Domain braucht heute ein Release. `optional_host_permissions` plus `chrome.scripting.registerContentScripts` erlauben „Auf dieser Seite aktivieren“. (M)
103. **R7-103** 🟢 **Icon 32 px fehlt** (`extension/manifest.json:14-17`) Für Retina und Windows-HiDPI rechnet Chrome 48 px herunter, das wirkt unscharf. `"32"` ergänzen. (S)
104. **R7-104** 🟢 **Kein `_locales`** (`extension/manifest.json:3`, `extension/manifest.json:5`) Name und Beschreibung sind nur deutsch, auch im Store auf .com und .fr. `__MSG_name__` mit `_locales/de` und `en`. (S)

### Barrierefreiheit

105. **R7-105** 🟠 **Panel ohne `lang`** (`extension/content-common.js:132`) Auf airbnb.com ist `html lang="en"`, das deutsche Panel wird mit englischer Stimme vorgelesen. `lang="de"` an `.box`. (S)
106. **R7-106** 🟢 **Neubewertung ohne Ansage** (`extension/content-search.js:121`) Nach Blättern, Filter oder Budget baut sich die Liste neu, ohne Meldung. Unsichtbare Live-Region „Neu bewertet, Platz 1: …“. (S)
107. **R7-107** 🟢 **Gesperrter Budgetfilter nur per `title` erklärt** (`extension/content-search.js:136`) `disabled` ist nicht fokussierbar, die Erklärung unerreichbar. `aria-disabled` plus `aria-describedby`. (S)
108. **R7-108** 🟢 **Emoji in Chip-Namen** (`extension/content-search.js:126-133`) „🏠 ganze Unterkunft“ wird „Haus ganze Unterkunft“ vorgelesen. Emoji in `aria-hidden`-Span. (S)
109. **R7-109** 🟢 **Budgetfeld ohne eigene Fokusmarkierung** (`extension/content-common.js:107`) Die Fokusregel nennt `button`, `a`, `textarea`, nicht `input`. `input:focus-visible` ergänzen. (S)
110. **R7-110** 🟢 **Popup-Tabpanel nicht fokussierbar** (`extension/popup.html:21`) Bei leerem Tab springt Tab direkt in den Footer. `tabindex="0"` am Tabpanel (APG-Muster). (S)

### Sprachen (i18n)

111. **R7-111** 🟠 **rank.js liefert fertige deutsche Sätze** (`extension/rank.js:313-375`) `why`/`warn` sind Texte statt Codes, Übersetzen und Umformulieren geht nur im Rechenkern. `{code, params}` zurückgeben und im UI per `t()` rendern. (M)
112. **R7-112** 🟠 **Emoji und deutsche Wörter als Datenkennung** (`extension/hints.js:35`, `extension/hints.js:41`, `extension/rank.js:200`, `extension/rank.js:178`) Warnungen erkennt man an `startsWith('⚠️')`, Badges an `/favorit/` auf dem deutschen Wort „Gäste-Favorit“. Jede Übersetzung bricht das Ranking. Struktur `{key, positive}` speichern, Anzeige getrennt. (M)
113. **R7-113** 🟢 **Diagnose- und Betrugstexte fest deutsch** (`extension/parse.js:280-283`, `extension/parse.js:381-385`) Auch parse.js gibt deutsche Sätze zurück. In Schlüssel für `i18n.js` überführen. (S)
114. **R7-114** 🟢 **Popup-HTML komplett deutsch** (`extension/popup.html:2`, `extension/popup.html:16-27`) Tabs, Optionen, Footer und `lang="de"` fest. `data-i18n`-Attribute und `chrome.i18n.getMessage`. (S)

### Performance

115. **R7-115** 🟢 **Luxus dreimal je Unterkunft gerechnet** (`extension/rank.js:181`, `extension/rank.js:188`, `extension/rank.js:403`) `luxuryInfo` läuft in `check`, `ok` und `rankListings`, `hits()` baut jedes Mal neue RegExp. Einmal je Listing rechnen und weiterreichen. (S)

### Codequalität

116. **R7-116** 🟢 **Toter Sammelpfad in parse.js** (`extension/parse.js:302-319`) `searchKey` und `mergeSearchResults` nutzt kein Plugin-Code mehr, seit `pool.js` sammelt; nur Tests halten sie am Leben. Entfernen. (S)
117. **R7-117** 🟢 **`filterListings` doppelt zu `passes`** (`extension/rank.js:407`, `extension/content-search.js:11`) Zwei Filterfunktionen; nur die zweite kennt `lux`, nur die erste ist getestet. `passes` durch `R.filterListings` ersetzen. (S)
118. **R7-118** 🟢 **Favoriten-Regex an drei Stellen** (`extension/rank.js:178`, `extension/rank.js:414`, `extension/content-search.js:17`) `/favorit|superhost/i` dreimal. Eine Funktion `isTrusted(l)`. (S)
119. **R7-119** 🟢 **`median` zweimal in rank.js** (`extension/rank.js:138`, `extension/rank.js:246`) Lokale Kopie in `buildTaste` streichen. (S)
120. **R7-120** 🟢 **Artikel-Entfernung doppelt** (`extension/rank.js:8`, `extension/core.js:64-65`) `core.norm` entfernt die Artikel schon, rank.js wendet dieselbe Regex erneut an. Wrapper streichen. (S)
121. **R7-121** 🟢 **Zwei `h()`-Helfer** (`extension/content-common.js:42`, `extension/popup.js:8`) Die Popup-Fassung kennt `class` und `false`, die Panel-Fassung nicht. Eine gemeinsame Datei. (S)
122. **R7-122** 🟢 **Ungenutzte Merge-Felder** (`extension/parse.js:243`) `coordsMissing`, `priceFromDom`, `propertyId` liest niemand. Entfernen oder in `quality()` zählen („12 ohne Koordinaten“). (S)

### Tests

123. **R7-123** 🟠 **Umlaut-Grenzen und Verneinung im Treffer** (`tests/plugin.test.js`, `extension/hints.js:19`, `extension/hints.js:32`) Fälle „zu heiß“, „überteuert“, „Gastgeber war nicht freundlich“, „Laut Beschreibung“, „nicht nur sauber“ fehlen; alle schlagen heute fehl. (S)
124. **R7-124** 🟠 **Stornoreihenfolge** (`tests/p1-parse.test.js:124-127`) Kein Text mit kostenloser Frist und späterer Nicht-Erstattung, kein „streng verboten“ als Negativfall. (S)
125. **R7-125** 🟠 **Unterkunftspreis mit Währung vorn** (`tests/plugin-dom.test.js:145`) Die Unterkunftsseite wird nur mit „€ hinten“ geprüft; „$120 night“ und „£95 night“ fehlen. (S)
126. **R7-126** 🟠 **Viertel ohne `total`** (`tests/r5-plugin.test.js:24`, `extension/rank.js:288`) Brücke und Ranking mit einem Viertel ohne Wert; der Score muss eine Zahl bleiben. (S)
127. **R7-127** 🟢 **Merge überschreibt DOM-Badges** (`tests/p1-parse.test.js`, `extension/parse.js:242`) Karte mit Superhost im DOM, State mit `badges: []`. (S)
128. **R7-128** 🟢 **Pool-Überlauf mit gemischten Id-Längen** (`tests/plugin.test.js`, `extension/pool.js:33`) Ids `12345` und `1234567890123456789` mischen und prüfen, dass die älteste Seite fliegt. (S)
129. **R7-129** 🟢 **Popup-Empfehlung: Einheit und 👎** (`tests/r5-plugin.test.js:76`, `extension/popup.js:57`) Prüft nicht, ob „gesamt“ stimmt und ob abgelehnte fehlen. (S)
130. **R7-130** 🟢 **Zufallstest für Preiszeilen** (`tests/r5-parser.test.js`, `extension/parse.js:71`) Generator aus Betrag × Währung × Reihenfolge × Trennzeichen (NBSP, ’, Punkt, indische Gruppen) gegen Sollwert. (M)
131. **R7-131** 🟢 **Ausstattungs-Fehltreffer** (`tests/p1-parse.test.js:119`) „Dishwasher“, „Skilift“, „Pool table“ als Negativfälle. (S)
132. **R7-132** 🟢 **Keine Personennamen im Airbnb-DOM** (`tests/plugin-dom.test.js:12`) Reise mit `minName` laden und prüfen, dass außerhalb des Shadow kein Name steht. (S)
133. **R7-133** 🟢 **Unterkunftsfelder im DOM-Pfad** (`tests/plugin-dom.test.js:145-153`) `houseRules`, `cancellation`, `scamSignals` über `roomData` ungetestet, nur die reinen Funktionen. (S)
134. **R7-134** 🟢 **Ruhezeit mit am/pm** (`tests/r5-parser.test.js:92-93`) Nur 24-Stunden-Formate geprüft. (S)
135. **R7-135** 🟢 **Singular-Schlafzimmer und w/v im Titel** (`tests/r5-parser.test.js`, `extension/parse.js:104`, `extension/parse.js:122`) „1 habitación“, „1 camera da letto“, „Apartament w Krakowie“ als Fälle. (S)

## Viertel-Finder (Web-App)

Stand: origin/main `8c4930b`. Geprüft gegen alle Titel aus Runde 1 bis 6. Hinweis: `web/core.js` und `web/i18n.js` sind generiert, Änderungen dort gehören nach `shared/` und dann `node scripts/sync-core.mjs`.

### A. Echte Fehler mit Wirkung auf Ergebnisse

136. **R7-136** 🔴 **Typ „Shopping“ allein ergibt in 9 von 10 Vorab-Städten null Viertel** (`web/app.js:480`) `relevant` enthält für Shopping nur `shop` (Essen und ÖPNV sind ausgenommen), die Vorab-Dateien haben aber keine Spalte `shop`. Nachgerechnet: Wien 0 von 229, Lissabon 0 von 180, nur Rom 79 von 164 Vierteln bleiben, die App meldet „Keine passenden Viertel“. Fehlende Kategorien aus `relevant` streichen, wenn die Stadt dort 0 Orte hat, und einen Hinweis zeigen. (S)
137. **R7-137** 🔴 **Zentrum der Vorab-Städte ist die Mitte der Bounding-Box, nicht das Stadtzentrum** (`web/app.js:308`) Die beschnittene Box ist nicht symmetrisch; die Mitte liegt in Lissabon rund 3 km, in Barcelona und Paris rund 1,5 km neben dem Nominatim-Zentrum. Das verfälscht „km zum Zentrum“, den Filter „höchstens 2 km“, Preislage und Geheimtipp. `lat`/`lon` des Zentrums beim Vorladen in die Datei schreiben und hier verwenden. (S)
138. **R7-138** 🔴 **Sortierung „Beste für Lena“ wechselt nach dem Löschen still die Person** (`web/app.js:488`) `sortMode = 'p:1'` wird nur zurückgesetzt, wenn der Index zu groß ist. Löscht man Person 0, zeigt die Liste „Beste für Tom“, ohne dass jemand das gewählt hat. Beim Entfernen (`app.js:114`) Index nachziehen oder auf `fair` zurücksetzen. (S)
139. **R7-139** 🔴 **Karten-Auswahl „Karte zeigt: Lena“ springt beim Löschen auf eine andere Person** (`web/app.js:665`) `keep` ist der alte Index, nach `splice` gehört er jemand anderem. Wert an Personen-Objekt oder Namen statt Index binden. (S)
140. **R7-140** 🔴 **Defekte gespeicherte Vorlage legt die ganze App lahm** (`web/app.js:212`) `g.people.length` wirft, wenn ein Eintrag in `sm_groups` kein `people` hat oder `null` ist. `renderTpl()` läuft auf oberster Ebene (`app.js:231`), danach fehlen Submit-Handler, Teilen und Personenliste. Einträge vorher mit `cleanPerson` prüfen und Müll verwerfen. (S)
141. **R7-141** 🔴 **Leaflet-Canvas wächst bei jedem Neuzeichnen** (`web/app.js:747`) `L.canvas()` wird pro `renderMap` neu erzeugt. Entfernte Punkte nehmen den Renderer nicht mit, jede Änderung legt ein weiteres `<canvas>` in die Kartenebene, Verschieben und Zoomen wird langsamer. Einen Renderer einmal anlegen und wiederverwenden. (S)
142. **R7-142** 🔴 **Budget in Franken oder Pfund gemeint** (`web/scoring.js:304`) `price_max` gilt auf Airbnb in der Kontowährung der Person. Wer in CHF oder GBP eingestellt ist, bekommt die Euro-Zahl als Franken- oder Pfundgrenze. `currency=EUR` an den Link hängen. (S)
143. **R7-143** 🔴 **„Automatisch“ beim Umkreis ist praktisch immer 1,2 km** (`web/app.js:335`) Gezählt werden alle Stationen der ganzen Stadt, Schwelle 60. Nach Dedupe haben selbst Lissabon (107) und Rom (129) mehr. Pro Viertel entscheiden (Bahn im 800-m-Kreis ja/nein) oder die Option streichen. (S)
144. **R7-144** 🔴 **„Keine Bahn im Umkreis“, obwohl die Station 600 m entfernt ist** (`web/app.js:583`) `nearest.transit` wird nur innerhalb des Wertungsradius gesucht (`scoring.js:122`). Bei 500 m Umkreis heißt das schnell „keine Bahn“. Nächste Station unabhängig vom Radius im 3×3-Raster suchen. (S)
145. **R7-145** 🔴 **Auszeichnung „Bester Kompromiss“ auch für eine einzelne Person** (`web/scoring.js:240`) Ohne Mitreisende gibt es keinen Kompromiss. Bei `people.length === 1` „Beste Wahl für dich“ verwenden. (S)
146. **R7-146** 🔴 **Geheimtipp verspricht „ruhiger“, prüft aber keine Ruhe** (`web/app.js:575`) `isSecretTip` (`scoring.js:149`) schaut nur auf Sehenswürdigkeiten und Zentrumsabstand. Ein Kneipenviertel am Rand bekommt das grüne Abzeichen samt Tooltip „ruhiger“. Party-Wert mit in die Bedingung nehmen oder den Text ändern; außerdem nie Platz 1 selbst auszeichnen. (S)
147. **R7-147** 🔴 **Veto-Schwelle ist relativ zur lautesten Ecke der Stadt** (`web/scoring.js:42`) `norm >= 0.5` hängt vom Maximum der Stadt ab. In Rom fallen mit „Nie Party“ 41 von 164 Vierteln weg, in einer ruhigeren Stadt mit gleicher Kneipendichte weniger. Absolute Grenze je Radius („ab 15 Bars im Umkreis“) und diese Zahl im ⚙️-Feld neben „Nie“ anzeigen. (M)
148. **R7-148** 🔴 **Anreise in der Vergangenheit per Tastatur möglich** (`web/app.js:83`) `min` wirkt nur im Kalender, das Formular hat `novalidate`. Eingetippte alte Daten landen im Airbnb-Link. In `syncMin` gegen heute prüfen und wie bei „Abreise vor Anreise“ korrigieren. (S)
149. **R7-149** 🔴 **Budget-Modus umstellen ändert still die Bedeutung der Zahl** (`web/app.js:185`) Aus 800 € gesamt werden beim Wechsel auf „pro Nacht“ 800 € pro Nacht, die Airbnb-Grenze verfünffacht sich. Beim Umschalten den Betrag umrechnen (`budgetNums`) und kurz melden. (S)
150. **R7-150** 🔴 **Fehler 400 oder 403 heißt in der App „Zeitüberschreitung“** (`web/app.js:291`) Alles, was nicht 429/503/504 ist, bekommt den Zeitüberschreitungs-Text. Eine fehlerhafte Abfrage sieht dann wie Überlastung aus. Dritten Text „Abfrage abgelehnt (Code)“ für 4xx. (S)
151. **R7-151** 🔴 **Nach Wechsel der Karte auf „ausgeblendet“ stimmt der Ausschnitt nie wieder** (`web/app.js:678`) Läuft eine Suche bei verborgener Karte, rechnet `fitBounds` mit 0×0 Pixeln. Beim Einblenden nur `invalidateSize`, kein neues Einpassen. `renderMap.key = null` setzen und neu einpassen. (S)
152. **R7-152** 🔴 **Abgebrochene oder fehlgeschlagene Suche lässt die neue Stadt als Rahmen stehen** (`web/app.js:415`) `previewMap` ersetzt den Auswertungsrahmen schon vor dem Laden. Scheitert die Suche, zeigt die Karte den Rahmen von Stadt B über den Kreisen von Stadt A. Im `catch` den alten Rahmen und Ausschnitt wiederherstellen. (S)
153. **R7-153** 🔴 **Link `?c=Lissabon` gewinnt bei jedem Neuladen** (`web/app.js:812`) Der Suchparameter bleibt in der Adresse. Wer danach auf Rom wechselt und neu lädt, steht wieder bei Lissabon, und `n=` erzeugt wieder „Person 2..n“. Nach dem Übernehmen mit `history.replaceState` entfernen. (S)
154. **R7-154** 🔴 **Zweiter Teilen-Link im selben Tab wird ignoriert** (`web/app.js:817`) Es gibt keinen `hashchange`-Listener. Fügt man einen neuen `#t=`-Link in die Adresszeile des offenen Tabs ein, passiert nichts. Auf `hashchange` hören und `applyShared` erneut aufrufen. (S)
155. **R7-155** 🔴 **Teilen-Link überschreibt Wünsche, Fairness und Formular ohne Rückweg** (`web/app.js:779`) `offerUndo` sichert nur `people`. Wünsche, Fairness, Stadt, Budget und Daten werden sofort dauerhaft gespeichert (`app.js:787-792`), der Text „nicht verloren“ stimmt nur halb und gilt nur 15 Sekunden. Kompletten Zustand sichern und den Rückweg bis zum nächsten eigenen Ändern anbieten. (S)
156. **R7-156** 🔴 **Vorab-Index merkt sich einen Ladefehler für die ganze Sitzung** (`web/app.js:302`) Schlägt `index.json` einmal fehl (kurz offline), bleibt `indexPromise` bei `{}`, jede Stadt läuft danach über die langsame Live-Abfrage. Bei Fehler `indexPromise = null` setzen; außerdem `r.ok` prüfen. (S)
157. **R7-157** 🔴 **„Barcelona, Spanien“ findet die Vorab-Datei nicht** (`web/app.js:303`) `normCity` lässt Zusätze nach dem Komma stehen. Wer die Stadt so eintippt oder aus Google kopiert, wartet bis zu 2 Minuten. Vor dem Nachschlagen den Teil nach dem ersten Komma probeweise abschneiden. (S)
158. **R7-158** 🔴 **Abbrechen stoppt den Download der Vorab-Datei nicht** (`web/app.js:305`) `fetch('data/' + file)` bekommt kein `signal`. Bei Paris (1,7 MB) auf langsamem Netz läuft der Download weiter, und `run()` rechnet danach trotzdem. `signal` durchreichen. (S)
159. **R7-159** 🔴 **Hinweis „Mehr als 16 Gäste“ landet im Teilen-Feld und bleibt stehen** (`web/app.js:193`) Die Meldung überschreibt `#shareMsg` und verschwindet nicht, wenn man wieder unter 16 Personen ist. Eigene Zeile unter der Personenliste, die `renderPeople` aktualisiert. (S)
160. **R7-160** 🔴 **Schieberegler zeigen „Eigene Werte“ und „Auf Typ zurücksetzen“ erst nach dem nächsten Neuaufbau** (`web/app.js:139`) `oninput` setzt `p.custom`, ruft aber kein `renderPeople`. Der Mischtyp bleibt sichtbar gewählt, obwohl er ab jetzt keine Wirkung mehr hat. Hinweis direkt einblenden und Mischtyp-Feld als „überschrieben“ kennzeichnen. (S)
161. **R7-161** 🔴 **„Nie Party“ bei Party-Gewicht +10 wird ohne Hinweis angenommen** (`web/app.js:145`) Veto und starkes positives Gewicht widersprechen sich. Beim Setzen warnen oder das Gewicht automatisch auf ≤ 0 setzen. (S)
162. **R7-162** 🔴 **Namen aus Leerzeichen bleiben erhalten** (`web/scoring.js:29`) `cleanPerson` kürzt, aber trimmt nicht. „   “ ergibt Chips wie „   : 55“ und leere Sortier-Einträge. `trim()` vor der Längenprüfung. (S)
163. **R7-163** 🔴 **`nights()` liefert bei ungültigem Datum `NaN`** (`web/scoring.js:290`) `Math.max(0, NaN)` ist `NaN`; das wandert als `null` in `sm_trip.nights` zum Plugin. `Number.isFinite`-Prüfung, sonst 0. (S)
164. **R7-164** 🔴 **Gäste über 16 insgesamt im Airbnb-Link** (`web/scoring.js:300`) Erwachsene werden auf 16 und Kinder auf 15 getrennt begrenzt; 16 Personen plus 3 Kinder ergeben 19 Gäste, mehr als Airbnb zulässt. Summe aus `adults + children` auf 16 kappen und den Hinweis aus `app.js:193` darauf beziehen. (S)

### B. Daten laden und Zwischenspeicher

165. **R7-165** 🟠 **Tages-Cache speichert Objekte statt CSV-Text** (`web/app.js:316`) `JSON.stringify` der geparsten Zeilen wiederholt jeden Feldnamen; das ist etwa doppelt so groß wie die Overpass-CSV. Rohtext speichern und beim Lesen parsen, dann passen mehr Städte in `localStorage`. (S)
166. **R7-166** 🟢 **Abgelaufene Stadt-Caches bleiben liegen** (`web/app.js:314`) `cacheGet` ignoriert alte Einträge, löscht sie aber nicht; geräumt wird erst bei vollem Speicher. Beim Start alle `sm_osm3_` älter als 1 Tag entfernen. (S)
167. **R7-167** 🟢 **Ladefehler der Vorab-Datei verschwinden spurlos** (`web/app.js:309`) `catch { return null; }` fällt still auf Live zurück. Wenigstens `console.warn` und in der Ladeanzeige „Vorab-Daten nicht lesbar, lade live“. (S)
168. **R7-168** 🟢 **Dritter Overpass-Server bekommt nur rund 70 s** (`web/app.js:260`) Gesamtzeit 110 s, Start nach 40 s, Abfrage hat `[timeout:90]`. Er kann kaum gewinnen. Gesamtzeit pro Server rechnen oder nur zwei Server staffeln. (S)
169. **R7-169** 🟢 **Overpass-Ausgabe mit `qt` sortieren** (`web/core.js:82`) `out center qt;` spart dem Server das Sortieren nach ID, bei 25 000 Zeilen merklich. Reihenfolge ist der App egal (Dedupe ist ortsbasiert). Eingefrorene Abfrage im Test mit anpassen. (S)
170. **R7-170** 🟢 **Empfangene Datenmenge statt geschätzter Zeit zeigen** (`web/app.js:270`) `r.text()` wartet blind. Mit `r.body.getReader()` mitzählen und „3,4 MB empfangen“ anzeigen; das ist ehrlicher als der Kreis mit Exponentialkurve (`app.js:371`). (M)
171. **R7-171** 🟢 **Nominatim-Adresse doppelt gepflegt** (`web/app.js:246`) Die App baut die URL selbst (`limit=5`), `C.nominatimUrl` (`core.js:86`) kennt nur `limit=1`. Parameter `limit` ergänzen und überall den Kern nutzen. (S)
172. **R7-172** 🟢 **Städteliste dreifach gepflegt** (`web/app.js:11`) `CITIES`, `DEST_SUB` und `data/index.json` bzw. `scripts/cities.json` müssen von Hand gleich bleiben. Schnellwahl und Kacheln aus einer Quelle erzeugen. (S)
173. **R7-173** 🟢 **Status „Schritt 2 von 3“ wird per Regex aus deutschem Text gelesen** (`web/app.js:358`) `setBusy.set` erkennt Schritt und „aus OpenStreetMap“ im Satz. Jede Textänderung oder Übersetzung bricht die Ladeanzeige. Schritt und Art als Parameter übergeben. (S)
174. **R7-174** 🟢 **`outer`-Abort-Listener wird nie entfernt** (`web/app.js:261`) Bei Erfolg hängt der Listener weiter am Signal. Nach Erfolg `removeEventListener` oder `AbortSignal.any([outer, timeout])`. (S)
175. **R7-175** 🟠 **Kein globaler Fehlerfang** (`web/app.js:1`) Wirft `app.js` beim Start (siehe „Defekte Vorlage“) oder in einem Handler, bleibt eine tote Seite ohne Meldung. `window.addEventListener('error'/'unhandledrejection')` mit Hinweis „Etwas ging schief, Seite neu laden“ und Link zum Zurücksetzen der gespeicherten Daten. (S)
176. **R7-176** 🟢 **Alte Ergebnisse bleiben während der Suche klickbar** (`web/app.js:351`) Die Liste wird nur abgeblendet; wer währenddessen auf „Auf Airbnb ansehen“ tippt, landet in der alten Stadt. `inert` auf `#results` setzen, solange `dim` aktiv ist. (S)

### C. Formular und Gruppe

177. **R7-177** 🟠 **Vorlagen per `prompt()` und `confirm()`** (`web/app.js:222`) In In-App-Browsern (Instagram, WhatsApp, manche Android-WebViews) sind die Dialoge unterdrückt, Speichern geht dann nicht. Kleines Eingabefeld im `details`-Block. (S)
178. **R7-178** 🟢 **Vorlage mit gleichem Namen wird doppelt angelegt** (`web/app.js:224`) Kein Überschreiben, die Liste füllt sich mit Dubletten bis zum stillen Verdrängen. Bei gleichem Namen ersetzen. (S)
179. **R7-179** 🟢 **Dieselbe Vorlage lässt sich nicht zweimal laden** (`web/app.js:214`) Die Auswahl bleibt gesetzt, erneutes Wählen löst kein `change` aus. Nach dem Laden auf „Auswahl …“ zurückstellen. (S)
180. **R7-180** 🟢 **„Übernehmen“ ohne erkannten Namen tut nichts** (`web/app.js:206`) Leeres Ergebnis endet still. Hinweis „Kein Name erkannt, Beispiel: Lena Party, Tom Chill“. (S)
181. **R7-181** 🟢 **Text einfügen kennt keine Mengen** (`web/scoring.js:276`) „3 Party, 2 Chill“ ergibt Personen namens „3“ und „2“. Führende Zahl als Anzahl lesen und „Party 1..3“ anlegen. (S)
182. **R7-182** 🟢 **Text einfügen trennt nur bei „und“** (`web/scoring.js:277`) „Lena & Tom“, „Lena and Tom“ und „Lena + Tom“ bleiben eine Person. `&`, `+`, `and` als Trenner. (S)
183. **R7-183** 🟢 **Kinderzahl wird an vier Stellen verschieden begrenzt** (`web/app.js:551`) `formState` begrenzt auf 10/5, `renderResults` und `renderHead` nur auf ≥ 0. Wer 14 eintippt, sieht 14 im Kopf und schickt 14 an Airbnb. Eine Funktion `guests()` und Feld beim Verlassen korrigieren. (S)
184. **R7-184** 🟢 **Zahlenfelder ändern sich beim Scrollen mit dem Mausrad** (`web/app.html:226`) Fokussiertes `type=number` reagiert in Chrome auf das Rad, das Budget springt um 50. `type=text` mit `inputmode=numeric` oder `wheel` abfangen. (S)
185. **R7-185** 🟢 **Fairness-Regler ohne sprechenden Wert** (`web/app.html:288`) Screenreader sagen „60“. `aria-valuetext` „60 % unzufriedenste Person, 40 % Schnitt“ in `updateFair` setzen. (S)
186. **R7-186** 🟢 **Personen-Labels in 10 px Großbuchstaben** (`web/app.html:153`) „WOHIN?“, „ANREISE“ in 10 px sind am Handy schwer lesbar. Mindestens 12 px. (S)
187. **R7-187** 🟢 **Speichern im privaten Modus scheitert still** (`web/app.js:5`) `store.set` schluckt jeden Fehler. Einmalig melden „Dein Browser speichert nichts, nutze den Teilen-Link“. (S)
188. **R7-188** 🟢 **Namensfelder nach Löschen: Fokus springt immer auf „+ Person“** (`web/app.js:114`) Bei langen Listen verliert man die Stelle. Fokus auf das ✕ der nächsten Zeile oder den vorherigen Namen. (S)

### D. Ergebnisse und Erklärung

189. **R7-189** 🟠 **Neu rechnen bei jedem Tastendruck im Budget** (`web/app.js:184`) `refreshLinks` hängt ohne Entprellung an `input` und baut alle Karten neu. Offene Aufschlüsselung (`bd-i`) klappt zu, Fokus geht verloren. Entprellen und nur die Airbnb-Links austauschen statt `renderResults`. (S)
190. **R7-190** 🟢 **Stadtdurchschnitt „Ø“ hängt an Filtern und Vetos** (`web/app.js:497`) `cityStats(okAreas)` ändert sich, wenn man „höchstens 2 km“ wählt; der Vergleichswert wandert mit. Über alle Viertel mit Daten rechnen. (S)
191. **R7-191** 🟢 **Sortieroptionen „Beste für Du“ und „Höchster Schnitt“ allein sinnlos** (`web/app.js:530`) Für eine Person sind fair, avg und p:0 gleich. Bei `solo()` ausblenden. (S)
192. **R7-192** 🟢 **Chip „Du: 82“ wiederholt den Gesamtwert** (`web/app.js:562`) Allein ist die Person gleich dem Gesamtwert. Aufschlüsselung direkt zeigen statt Chip. (S)
193. **R7-193** 🟢 **„Gehört zur selben Gegend“ ist reiner Text** (`web/app.js:599`) Die Nachbarviertel lassen sich nicht ansehen. Als Knöpfe, die das Viertel als Karte nachladen oder auf der Karte zeigen. (S)
194. **R7-194** 🟢 **Vergleich zeigt Kategorien, die niemand gewählt hat** (`web/scoring.js:57`) Einkaufen, Sport, Kinder stehen mit 0 gegen 0 in der Tabelle. Nur Kategorien mit Gewicht ≠ 0 zeigen. (S)
195. **R7-195** 🟢 **„Ohne Tom wäre …“ vergleicht nur Namen** (`web/scoring.js:230`) Zwei Viertel gleichen Namens (über 1,5 km auseinander) gelten als gleich. Mit `areaKey` vergleichen. (S)
196. **R7-196** 🟢 **„Mehr Viertel anzeigen“ zoomt die Karte neu** (`web/app.js:711`) Der Schlüssel ändert sich mit jeder neuen Karte, die Ansicht springt weg. Bei „Mehr“ Ausschnitt behalten. (S)
197. **R7-197** 🟢 **Knopf „Mehr“ nennt keine Anzahl** (`web/app.html:352`) „8 weitere Viertel anzeigen (24 übrig)“ hilft beim Entscheiden. (S)
198. **R7-198** 🟢 **Preislage und Geheimtipp nur per `title`** (`web/app.js:583`) Am Handy und für Tastatur nicht erreichbar. Kurzer Text oder aufklappbarer Hinweis. (S)
199. **R7-199** 🟢 **Platzwechsel ▲2 ohne Text** (`web/app.js:576`) Screenreader lesen „schwarzes Dreieck 2“. Unsichtbarer Text „2 Plätze besser als vorher“. (S)
200. **R7-200** 🟢 **Auswahl „Mehrere Orte gefunden“ ohne Ausweg** (`web/app.js:456`) Es gibt nur die Treffer, kein „Keiner davon, Suchbegriff ändern“. Knopf ergänzen, der das Stadtfeld fokussiert und markiert. (S)
201. **R7-201** 🟢 **Escape schließt weder Aufschlüsselung noch Vergleich** (`web/app.js:629`) Tastaturnutzer müssen den Chip erneut finden. `keydown` Escape schließt offene `.breakdown` und gibt den Fokus an den Chip zurück. (S)

### E. Karte

202. **R7-202** 🟠 **Mausrad zoomt die Karte statt die Seite zu scrollen** (`web/app.js:683`) `L.map('map')` mit Standard `scrollWheelZoom`. Wer die Ergebnisliste herunterscrollt, bleibt in der Karte hängen. Zoom per Rad erst nach Klick in die Karte oder mit Strg. (S)
203. **R7-203** 🟢 **Knopf „Ausschnitt zurücksetzen“ fehlt** (`web/app.js:716`) Nach Verschieben kommt man nur durch eine neue Rechnung zurück. Kleiner Leaflet-Knopf, der `fitBounds` der Top-Liste wiederholt. (S)
204. **R7-204** 🟢 **Legende passt nicht zum Personen-Modus** (`web/app.html:339`) In „Karte zeigt: Lena“ sind Kreise grün, orange und grau (`app.js:722`), die Legende erklärt nur Gruppe. Text je Modus umschalten. (S)
205. **R7-205** 🟢 **Doppelte Tooltips an Kreis und Nummer** (`web/app.js:728`) Kreis und Pin tragen fast denselben Text, beim Überfahren erscheinen zwei. Nur am Pin. (S)
206. **R7-206** 🟢 **Gesperrte Kacheln ergeben eine graue Fläche ohne Hinweis** (`web/app.js:684`) Bei `tileerror` (OSM-Sperre, offline) zeigt die Karte nichts. Einmal „Kartenbild nicht verfügbar, Liste unten gilt“ einblenden. (S)
207. **R7-207** 🟢 **Kartenfarben fest im Code statt aus dem Theme** (`web/app.js:662`) Kreis Platz 1 ist `#e0475b`, das helle Theme nutzt `#d70466`. Farben aus `getComputedStyle` lesen. (S)
208. **R7-208** 🟢 **Orte-Punkte rechnen jede Entfernung neu** (`web/app.js:751`) Für 25 000 Orte × 8 Viertel Haversine bei jedem Umschalten. Raster aus `scoreAreas` mitgeben oder `counts`-Zuordnung speichern. (S)
209. **R7-209** 🟢 **„Karte ausblenden“ wird nicht gemerkt** (`web/app.js:675`) Wer die Karte am Handy ausblendet, bekommt sie bei jeder Suche wieder. Zustand in `sm_form` mitspeichern. (S)

### F. Barrierefreiheit

210. **R7-210** 🔴 **`aria-label` auf `<span class="score">` wird ignoriert** (`web/app.js:588`) Auf generischen Elementen ist `aria-label` laut ARIA 1.2 nicht erlaubt, NVDA und VoiceOver lesen nur „82“. Unsichtbaren Text „Gesamtwert 82 von 100“ statt `aria-label`. (S)
211. **R7-211** 🔴 **Mini-Balken für Screenreader stumm** (`web/app.js:595`) `aria-label` auf einem `div` ohne Rolle, die Balken sind `aria-hidden`. Die Stärke je Kategorie fehlt ganz. Werte als unsichtbaren Text („Party 80 %“) oder Liste. (S)
212. **R7-212** 🔴 **Statuszeile wird jede Sekunde neu gesetzt** (`web/app.js:365`) Auch ohne neue Sekunde wird `textContent` mit gleichem Text überschrieben; manche Screenreader melden jede Änderung. Nur schreiben, wenn sich der Text ändert. (S)
213. **R7-213** 🔴 **`#compare` liest bei jedem Neurechnen die ganze Tabelle vor** (`web/app.html:349`) `aria-live` auf dem Vergleich, `renderCompare` läuft bei jedem `compute` (auch beim Tippen eines Namens). `aria-live` entfernen und nur beim Öffnen des Vergleichs eine kurze Meldung geben. (S)
214. **R7-214** 🟠 **Überschrift jeder Karte enthält Knopf, Pfeil und Wert** (`web/app.js:587`) Die `h3` liest sich als „1. Gràcia Gràcia als Favorit merken ▲2 82 /100 sehr gut“. Herz, Delta und Wert aus der Überschrift nehmen. (S)
215. **R7-215** 🟠 **Fokusrahmen im Windows-Kontrastmodus unsichtbar** (`web/app.html:154`) Eingaben haben `outline:none`, der Fokus ist nur `box-shadow` (`web/app.html:156`), den `forced-colors` entfernt. `@media (forced-colors: active)` mit `outline`. (S)
216. **R7-216** 🟢 **Sprunglink zielt auf nicht fokussierbares Element** (`web/app.html:202`) `#status` ist ein `<p>` ohne `tabindex`; Fokus bleibt in Safari oben. `tabindex="-1"` setzen. (S)
217. **R7-217** 🟢 **Theme-Knopf ohne Zustand** (`web/app.html:209`) „Hell/Dunkel umschalten“ sagt nicht, was gerade aktiv ist. `aria-pressed` oder Text „Dunkles Design an“. (S)
218. **R7-218** 🟢 **Sichtbarer Text fehlt im zugänglichen Namen** (`web/app.html:345`) „Sortieren“ sichtbar, `aria-label="Sortierung"`; Airbnb-Knopf „Unterkünfte hier …“ vs. „Unterkünfte in Gràcia …“ (`app.js:600`). Sprachsteuerung findet die Knöpfe nicht (WCAG 2.5.3). Sichtbaren Text an den Anfang des Namens. (S)
219. **R7-219** 🟢 **Vergleich wirft still das älteste Häkchen raus** (`web/app.js:616`) Beim dritten Häkchen verschwindet ein anderes ohne Meldung. Kurze Status-Meldung „Gràcia aus dem Vergleich genommen“. (S)
220. **R7-220** 🟢 **Emoji in Zähl- und Lagezeilen werden vorgelesen** (`web/app.js:581`) „🚇 🍸 📍“ klingen als „U-Bahn, Cocktailglas, Reißzwecke“. In `<span aria-hidden="true">` packen. (S)
221. **R7-221** 🟢 **Links „In der Nähe“ öffnen neue Tabs ohne Hinweis** (`web/app.js:598`) Anders als der Airbnb-Knopf fehlt „(neuer Tab)“. Unsichtbaren Zusatz ergänzen. (S)

### G. Teilen, Adresse, Speicher

222. **R7-222** 🟢 **Teilen-Link entfernt sich beim Öffnen sofort aus der Adresse** (`web/app.js:792`) `applyShared` ruft `save()`, das den `#t=`-Hash löscht. Lesezeichen auf die geöffnete Seite enthalten den Link nicht mehr. Hash erst bei der ersten eigenen Änderung entfernen. (S)
223. **R7-223** 🟢 **`sm_trip` mit Namen wird auch ohne Plugin gespeichert** (`web/app.js:511`) Namen der Mitreisenden liegen dauerhaft im Browser, obwohl kein Plugin sie liest. Nur speichern, wenn `data-staymatch-extension` gesetzt ist, sonst beim Erkennen nachholen. (S)
224. **R7-224** 🟢 **Plugin-Hinweis schließt Edge und Opera aus** (`web/app.js:510`) `Edg|OPR` werden herausgefiltert, beide installieren Chrome-Erweiterungen. Nur Mobilgeräte und Firefox/Safari ausschließen. (S)
225. **R7-225** 🟢 **Teilen-Link enthält Kartenzustand nicht** (`web/app.js:769`) Gewählte Orte-Schichten und „Karte zeigt: Person“ gehen verloren. Zwei kurze Felder ergänzen. (S)

### H. Seite, Recht, Datenschutz, Sicherheit

226. **R7-226** 🔴 **App-Fußzeile ohne Impressum und Datenschutz** (`web/app.html:356`) Nur GitHub und OSM; die Pflichtlinks müssen von jeder Seite direkt erreichbar sein. `/impressum` und `/datenschutz` in den Footer. (S)
227. **R7-227** 🔴 **Datenschutz-Link der App zeigt noch auf GitHub** (`web/app.html:300`) Auf der Startseite ist das behoben, hier geht `PRIVACY.md` auf GitHub statt `/datenschutz`. Intern verlinken. (S)
228. **R7-228** 🟠 **App-Seite ohne `og:image`** (`web/app.html:10`) Geteilte `#t=`-Links zeigen in WhatsApp nur Text, `twitter:card` ist `summary` ohne Bild. `og:image`, `og:url` und `twitter:image` wie auf der Startseite. (S)
229. **R7-229** 🟢 **Lint-Test für `innerHTML`-Vorlagen** (`web/app.js:554`) Die App setzt an rund 20 Stellen HTML aus Vorlagen; heute ist alles mit `escapeHtml` versehen, ein neuer Platzhalter ohne Escape fiele nicht auf. Test, der jede `${…name…}`-Stelle in `innerHTML`-Vorlagen auf `escapeHtml(` prüft. (S)

### I. Englische App und Sprache

230. **R7-230** 🟠 **EN-Startseite schickt auf die deutsche App** (`web/en.html`, 5× `href="/app"`; `web/i18n.js:6`) `i18n.js` liegt in `web/`, wird von `app.html` aber nicht geladen, alle Texte stehen fest in `app.js`. Erster Schritt: `t()` laden, `?lang=en` bzw. `/en/app` erkennen und die rund 40 Statusmeldungen aus `app.js` in das Wörterbuch ziehen. (L)
231. **R7-231** 🟢 **Datums- und Zahlformate fest auf Deutsch** (`web/app.js:75`) `de-DE` in `wd`, `toLocaleDateString('de-DE')` (`app.js:528`) und `replace('.', ',')` (`app.js:582`). Über `Intl` mit der Seitensprache. (S)
232. **R7-232** 🟢 **Ortssuche fest mit `Accept-Language: de`** (`web/app.js:246`) Englische Nutzer bekommen „Rom“, „Lissabon“ als Stadtname im Airbnb-Link. Sprache der Seite übergeben. (S)
233. **R7-233** 🟢 **Plural von Hand** (`web/app.js:175`) „Nacht/Nächte“, „Kind/Kinder“ (`app.js:177`, `529`) sind Einzelfälle. `Intl.PluralRules` im Wörterbuch (`i18n.js:13`) unterstützen. (S)
234. **R7-234** 🟢 **Typ- und Kategorienamen im Kern fest Deutsch** (`web/core.js:9`) `label` in `CATEGORIES` und `PRESETS` ist Anzeigetext. Schlüssel behalten, Texte über `t('cat.party')` holen. (M)
235. **R7-235** 🟢 **`lang="de"` und Titel fest** (`web/app.html:2`) Für eine EN-Fassung braucht es eigenes `lang`, `<title>`, `description` und `hreflang`-Paar zur DE-App. (S)

### J. Bewertungslogik

236. **R7-236** 🟢 **Dedupe hängt von der Reihenfolge ab** (`web/scoring.js:84`) Kette A–B 25 m, B–C 25 m, A–C 50 m: Reihenfolge A,B,C behält A und C, Reihenfolge B,A,C nur B. Vor dem Dedupe nach Wichtigkeit (Name, Wikidata) sortieren, dann ist das Ergebnis stabil. (S)
237. **R7-237** 🟢 **Schwellen der Viertel-Auswahl stehen in `app.js`** (`web/app.js:480`) „10 Orte“, „2 relevante“, „Gewicht ≥ 0,3“ sind ungetestet und nur im UI-Code. Als `eligibleAreas()` nach `scoring.js` ziehen, dann sind Fehler wie beim Shopping-Typ testbar. (S)
238. **R7-238** 🟢 **Leere Kategorie zählt in `relevant` mit** (`web/app.js:480`) Allgemeiner Fall des Shopping-Fehlers: Hat die Stadt in einer Kategorie 0 Orte (Sport in Lissabon live meist nur wenige), sollte sie nicht über das Ausblenden entscheiden. Nur Kategorien mit Stadtsumme > 0 nehmen. (S)
239. **R7-239** 🟢 **Gleichstand-Hinweis nur bei fairer Sortierung** (`web/app.js:578`) Bei „Höchster Schnitt“ oder „Beste für Lena“ fehlt „fast gleichauf“. Auf den jeweiligen Sortierwert anwenden. (S)
240. **R7-240** 🟢 **Preislage in Vorab-Städten verschoben** (`web/scoring.js:141`) `tier` hängt zu 65 % an `centerDist`; mit dem Zentrumsfehler der Vorab-Städte ist „€“/„€€€“ in Vorab-Städten verschoben. Nach dem Fix einen Test mit bekannter Altstadt (Barri Gòtic = €€€). (S)

### K. Code-Qualität

241. **R7-241** 🟢 **Zwei Wege, die Ergebnisse zu leeren** (`web/app.js:466`) `clearResults` und der Leer-Zweig in `compute` (`app.js:500-502`) räumen Unterschiedliches (einer entfernt Kartenebenen, der andere nicht). Eine Funktion. (S)
242. **R7-242** 🟢 **Gemeinsamer Zustand als lose Variablen** (`web/app.js:332`) `map, layer, poiLayer, circles, cmp, lastData, lastView, sortMode, shown` werden von überall geändert. Ein Zustandsobjekt mit `setState` erleichtert Tests und Teilen-Link. (M)
243. **R7-243** 🟢 **`renderResults` liest das Formular direkt** (`web/app.js:551`) Ergebnis hängt an DOM-Werten statt an `lastView`; so kann Budget-Tippen und Rechnung auseinanderlaufen. Gäste und Budget in `lastView` übernehmen. (S)
244. **R7-244** 🟢 **Inline-Stile in JS-Vorlagen** (`web/app.js:129`) `style="grid-template-columns:86px 1fr"` in `tunePanel`. Klasse `.trow.mix`. (S)

### L. Tests

245. **R7-245** 🟠 **Veralteter `todo`-Test zu Rom** (`tests/r5-daten.test.js:55`) `rom.json` und der Index-Eintrag existieren, der Test würde bestehen, läuft aber als `todo` und schützt nichts. `todo` entfernen. (S)
246. **R7-246** 🟠 **Test: App startet mit kaputtem `localStorage`** (`web/app.js:16`) jsdom ist schon Abhängigkeit (`tests/package.json`). `app.html` mit `sm_groups = [{"name":"x"}]`, `sm_people = "abc"`, `sm_form = 5` laden und prüfen, dass Submit-Handler und Personenliste stehen. Fängt den Vorlagen-Absturz. (M)
247. **R7-247** 🟠 **Test: jede Vorab-Stadt liefert für jeden Typ allein Ergebnisse** (`web/app.js:482`) Schleife über `data/*.json` × `PRESETS`, Erwartung ≥ 5 Viertel. Hätte den Shopping-Fehler sofort gezeigt. (S)
248. **R7-248** 🟢 **Leistungstest kopiert App-Code** (`tests/r5-scoring-property.test.js:57`) Das Zeilen-Parsen ist ein Nachbau von `app.js:306` und `425-430`; ändert sich die App, misst der Test etwas anderes. Gemeinsame Funktion (`rowsToData`) in `scoring.js` und hier aufrufen. (S)
249. **R7-249** 🟢 **Leistungsgrenze 5 s ist zu weich** (`tests/r5-scoring-property.test.js:67`) Paris braucht lokal deutlich unter einer Sekunde; Rückschritte um das Dreifache fallen nicht auf. Grenze relativ zu einer Referenzschleife oder 1,5 s mit Wiederholung. (S)
250. **R7-250** 🟢 **Eigenschaftstest für `pickDiverse`** (`web/scoring.js:312`) Zufallsviertel erzeugen und prüfen: alle Paare ≥ `minDist`, Ergebnis ist Präfix-stabil bei wachsendem `n`. (S)
251. **R7-251** 🟢 **Eigenschaftstest für `dedupePois`** (`web/scoring.js:84`) Idempotenz (`dedupe(dedupe(x)) = dedupe(x)`) und Anzahl unabhängig von der Reihenfolge; deckt die Reihenfolge-Abhängigkeit auf. (S)
252. **R7-252** 🟢 **Test für Auszeichnungen und Satz bei einer Person** (`tests/viertel.test.js:77`) `awards` und `summary` mit genau einer Person: kein „Kompromiss“, Ansprache mit „dir“. Fängt den „Kompromiss“ bei einer Person. (S)
253. **R7-253** 🟢 **Test: Zentrum der Vorab-Datei liegt nahe am Nominatim-Zentrum** (`tests/r5-daten.test.js:25`) Nach dem Zentrums-Fix: Feld `center` vorhanden und innerhalb der Box. (S)
254. **R7-254** 🟢 **Test: Airbnb-Link setzt Währung** (`tests/viertel.test.js:107`) Nach dem Währungs-Fix: `currency=EUR` immer gesetzt, `price_max` ganzzahlig. (S)
255. **R7-255** 🟢 **Test für `nights` mit Müll** (`tests/core.test.js:28`) `nights('x','y')`, leere Strings, gleiche Tage: immer endliche Zahl ≥ 0. (S)
256. **R7-256** 🟢 **Test für `cleanPerson` mit Leerzeichen-Namen** (`tests/round4.test.js:22`) `'   '` wird zu „Person“. (S)
257. **R7-257** 🟢 **Test für `normCity` mit Länderzusatz** (`tests/core.test.js:92`) „Barcelona, Spanien“, „Wien (Österreich)“, „ROM “ finden die Vorab-Datei. (S)
258. **R7-258** 🟢 **Test für Sortierung nach Personen-Index nach Löschen** (`web/scoring.js:255`) Zusammen mit dem Lösch-Fix: `sortAreas` per Personen-ID statt Index, Test mit gelöschter Person. (S)
259. **R7-259** 🟢 **i18n-Test prüft ungenutzten Code** (`tests/core.test.js:111`) Der Test hält `t()` am Leben, obwohl die App es nicht lädt. Mit der EN-App verbinden: Test, dass jeder Schlüssel in DE und EN existiert. (S)

### M. Vendor und Auslieferung

260. **R7-260** 🟢 **Leaflet-Bilder und Ebenen-Steuerung ungenutzt** (`web/vendor/leaflet/images`) Marker-Icons und `layers.png` werden nie geladen (nur `divIcon`). Aus dem Repo nehmen oder im NOTICE vermerken, dass sie Teil des Pakets bleiben. (S)
261. **R7-261** 🟢 **Leaflet und App-Skripte blockierend am Seitenende ohne `defer`** (`web/app.html:358`) Vier klassische Skripte nacheinander. `defer` auf alle vier erhält die Reihenfolge und lässt den Parser weiterlaufen. (S)
262. **R7-262** 🟢 **Vorab-Dateien ohne Inhalts-Hash im Namen** (`web/data/index.json:2`) `index.json` und `*.json` können bis 1 h + 1 Tag auseinanderlaufen (`vercel.json` `max-age=3600, swr=86400`). Dateinamen mit Datum (`wien-20261110.json`), dann sind beide immer stimmig. (S)
1. Shopping-Typ ergibt in 9 von 10 Vorab-Städten keine Ergebnisse.
2. Zentrum der Vorab-Städte liegt 1,5 bis 3 km daneben (Filter, Preislage, Geheimtipp falsch).
3. Eine kaputte Vorlage in `sm_groups` legt die ganze App lahm.
4. Sortierung und Karten-Person springen nach dem Löschen auf eine andere Person.
5. Leaflet-Canvas wächst bei jeder Änderung (Karte wird immer langsamer).

## Startseite, Stadtseiten, SEO, Recht

Abgeglichen mit prior-ideas.txt (Runde 1 bis 6, IDEEN-startseite). Live-Befunde per curl.

### Live-Stand und Domain

263. **R7-263** 🔴 **Live-Seite hängt hinter dem Repo, Google sieht tau als kanonisch** (`https://staymatch.pro/`, `web/index.html:9`) Live liefern canonical, hreflang, og:url, `robots.txt`, `sitemap.xml` und `/staedte/berlin` noch `staymatch-tau.vercel.app` (Last-Modified 10.11.), das Repo schon staymatch.pro. Sofort `deploys vercel deploy` und danach live per curl gegenprüfen. (S)
264. **R7-264** 🔴 **Alte Vercel-Adresse liefert doppelten Inhalt mit 200** (`https://staymatch-tau.vercel.app/`, `web/vercel.json:1`) Ohne Umleitung konkurriert tau mit pro. Zwischenlösung: für Host `staymatch-tau.vercel.app` `X-Robots-Tag: noindex` per `headers` mit `has: [{type:"host"}]`; volle 308-Umleitung erst, wenn Bridge und `APP_URL` umgezogen sind (`shared/core.js:41`, `:46`, `extension/manifest.json:68`, siehe R6-354). (S)
265. **R7-265** 🔴 **www.staymatch.pro ist kaputt** (`https://www.staymatch.pro`, DNS CNAME `pixie.porkbun.com`) HTTPS scheitert im TLS-Handshake, HTTP leitet über den Porkbun-Parkserver auf `http://staymatch.pro` (zwei Sprünge, Klartext dazwischen). `www` als Domain in Vercel hinzufügen und per 308 auf `https://staymatch.pro` leiten. (S)
266. **R7-266** 🟠 **security.txt nennt die falsche kanonische Adresse** (`web/.well-known/security.txt:4`) `Canonical:` muss laut RFC 9116 die tatsächlich ausgelieferte URL sein, heute tau. Auf `https://staymatch.pro/.well-known/security.txt` ändern. (S)
267. **R7-267** 🟠 **Kein Test gegen Alt-Domain in web/** (`web/.well-known/security.txt:4`, `web/core.js:42`) Ein Test, der `staymatch-tau` in `web/**/*.html|txt|xml` verbietet (Bridge-Konstanten ausgenommen und markiert), hätte security.txt gefangen. (S)
268. **R7-268** 🟠 **Deploy-Abschluss prüft den Host im Live-HTML nicht** (`https://staymatch.pro/robots.txt`) Nach dem Deploy `curl -s / | grep 'canonical" href="https://staymatch.pro/'` und dasselbe für robots/sitemap als harte Bedingung, damit ein veralteter Stand nicht drei Tage unbemerkt live bleibt. (S)
269. **R7-269** 🟠 **/favicon.ico liefert 404** (`https://staymatch.pro/favicon.ico`, `web/index.html:28`) Browser, RSS-Leser und manche Crawler fragen es blind ab und loggen 404. Ein 32×32-ICO ablegen oder per `redirects` auf `/favicon.svg` leiten. (S)
270. **R7-270** 🟢 **Keine Kurz-Umleitungen für typische Adressen** (`web/vercel.json:1-28`) `/de`, `/english`, `/privacy`, `/imprint`, `/datenschutzerklaerung`, `/plugin`, `/download` als 308 einrichten; billig und fängt Tippfehler und EN-Erwartungen ab. (S)

### Sicherheitsheader und Caching

271. **R7-271** 🟠 **HSTS ohne includeSubDomains und preload** (`https://staymatch.pro/` Header `strict-transport-security: max-age=63072000`, `web/vercel.json:6-12`) Nach der www-Reparatur eigenen Header `max-age=63072000; includeSubDomains; preload` setzen und bei hstspreload.org eintragen. (S)
272. **R7-272** 🟢 **Cross-Origin-Opener-Policy fehlt** (`web/vercel.json:7-12`) `Cross-Origin-Opener-Policy: same-origin` isoliert das Fenster gegen Tabnabbing und Spectre-Seitenkanäle; die Seite öffnet Airbnb nur mit `noopener`, also kein Bruch. (S)
273. **R7-273** 🟢 **Eine CSP für alle Seiten** (`web/vercel.json:12`) Startseite, Stadtseiten und Rechtsseiten brauchen weder OSM-Kacheln noch Overpass. Für `/` , `/en`, `/staedte/*`, `/impressum`, `/datenschutz` eigene CSP mit `connect-src 'self'; img-src 'self' data:`, die weite nur für `/app`. (S)
274. **R7-274** 🟢 **CSP ohne upgrade-insecure-requests und frame-src** (`web/vercel.json:12`) `upgrade-insecure-requests; frame-src 'none'; worker-src 'none'; manifest-src 'self'` ergänzen, damit kein Fallback auf `default-src` gebraucht wird und Mixed Content nie durchkommt. (S)
275. **R7-275** 🟢 **CSP würde ein No-JS-Formular zu Airbnb blockieren** (`web/vercel.json:12` `form-action 'self'`, `web/index.html:325`) Falls die Schnellsuche ein `action` bekommt (siehe unten), muss `form-action` `https://www.airbnb.de https://www.airbnb.com` erlauben. (S)
276. **R7-276** 🟢 **Schriften nur 1 Tag im Cache** (`web/vercel.json:15-17`, live `/fonts/inter-latin.woff2` `max-age=86400`) Schriftdateien ändern sich praktisch nie. Dateinamen mit Version (`inter-4.0-latin.woff2`) und `max-age=31536000, immutable`; R6-424 nennt nur Bilder, og.png und Stadtseiten. (S)
277. **R7-277** 🟢 **legal.css ohne Cache-Regel** (`web/vercel.json:1-28`, `web/legal.css`) Wird von 12 Seiten geteilt, aber mit `max-age=0` ausgeliefert. Mit Hash im Namen oder `?v=` und langem Cache ausliefern. (S)
278. **R7-278** 🟢 **Plugin-ZIP ohne Dateiname mit Version** (`web/index.html:395`, `:572` `download`) Jeder neue Download heißt `staymatch-plugin (1).zip`; beim Update lädt man leicht den alten Ordner. `download="staymatch-0.5.0.zip"` oder `Content-Disposition` per Header. (S)
279. **R7-279** 🟢 **ZIP ohne eigenes Cache-Verhalten** (`https://staymatch.pro/staymatch-plugin.zip`) `max-age=0, must-revalidate` ist richtig für die Datei mit festem Namen; bei versioniertem Namen (oben) dann `immutable`. Entscheidung dokumentieren. (S)

### Hero und Conversion

280. **R7-280** 🟠 **Hero-Knopf „Plugin holen“ springt nur** (`web/index.html:318`) Auf Chromium am Computer lädt ein Klick erst nach Scrollen; direkt herunterladen und gleichzeitig zu `#steps` springen spart einen Schritt. Auf anderen Geräten weiter Sprung. (S)
281. **R7-281** 🟠 **„Daten bleiben im Browser“ stimmt so nicht** (`web/index.html:322`, `:369`, `web/en.html:321`) Der Viertel-Finder schickt Ortsname und IP an OSM-Dienste (eigene FAQ `index.html:539`). Ehrlicher: „Kein Konto, kein Tracking“ bzw. „Keine StayMatch-Datenbank“. (S)
282. **R7-282** 🟠 **Beispiel-Panel Platz 2 erfüllt die Wünsche nicht sichtbar** (`web/index.html:357`, `web/en.html:358`) Gewünscht sind Superhost und ruhig, Platz 2 zeigt dazu weder ✓ noch ⚠, Platz 3 schon. Ergänzen („⚠ ruhig unbekannt“), sonst wirkt die Begründung lückenhaft. (S)
283. **R7-283** 🟠 **Hauptknopf „Suchen“ ist mehrdeutig** (`web/index.html:330`, `web/en.html:330`) Er sucht auf Airbnb, nicht in StayMatch. „Auf Airbnb suchen ↗“ mit Symbol für neuen Tab. (S)
284. **R7-284** 🟢 **„Gäste“ wird als Erwachsene übergeben** (`web/index.html:329`, `:648`) Kinder und Babys zählen auf Airbnb anders; Feld „Erwachsene“ nennen oder ein Kinder-Feld ergänzen (die App-Variante ist R6-60/933, die Startseite nicht). (S)
285. **R7-285** 🟢 **Schnellsuche ohne JavaScript tot** (`web/index.html:325`) Das Formular hat kein `action`; ohne JS lädt es nur die Startseite neu. `action="https://www.airbnb.de/s/homes" target="_blank"` mit `name="query"` als Rückfall (CSP siehe oben). (S)
286. **R7-286** 🟢 **Schnellsuche verliert Eingaben beim Zurückkommen** (`web/index.html:619-654`) Stadt und Daten werden nicht gemerkt; wer vom Airbnb-Tab zurückkommt oder neu lädt, tippt neu. In `sessionStorage` halten. (S)
287. **R7-287** 🟢 **Kein Wochenend-Schnellwahl** (`web/index.html:327-328`) Zwei Datumsfelder sind auf dem Handy mühsam. Chips „Nächstes Wochenende“, „In 2 Wochen“ füllen beide Felder. (S)
288. **R7-288** 🟢 **Nach „Suchen“ kein Hinweis aufs Plugin** (`web/index.html:641-652`) Wer ohne Plugin auf Airbnb landet, sieht keine Top 3. Nach dem Absenden in `#qnights` kurz: „Mit Plugin siehst du dort die Top 3, Plugin holen ↓“. (S)
289. **R7-289** 🟢 **Begriffe Plugin und Erweiterung gemischt** (`web/index.html:318`, `:406`, `:538`) Chrome spricht von Erweiterung, die Seite meist von Plugin, Schritt 4 und FAQ von Erweiterung. Einheitlich „Erweiterung (Plugin)“ beim ersten Vorkommen, dann eins davon; „Chrome-Erweiterung“ ist zudem das gängigere Suchwort. (S)
290. **R7-290** 🟢 **Zweiter Hero-Knopf sehr lang** (`web/index.html:319`) „Erst das passende Viertel finden →“ bricht auf 360 px zweizeilig. Kürzer „Erst Viertel finden →“. (S)
291. **R7-291** 🟢 **Pill wiederholt die Zielgruppen statt Nutzen** (`web/index.html:314`) „allein, zu zweit oder als Gruppe“ steht auch im Für-wen-Teil. „Kostenlos“ oder „für Chrome, Edge, Brave“ ist an dieser Stelle die entscheidendere Info. (S)
292. **R7-292** 🟢 **Strip-Text „Das Plugin bewertet jede Unterkunft auf deiner Suchseite“ doppelt den Lead** (`web/index.html:366`, `:316`) Lieber konkret: „Statt 40 Tabs: drei Kandidaten mit Gründen“. (S)
293. **R7-293** 🟢 **Für-wen-Karten ohne Aktion** (`web/index.html:501-504`) Jede Szene könnte den passenden Einstieg verlinken (Mit Freunden → `/app?n=4`, Workation → Plugin). (S)
294. **R7-294** 🟢 **Grenzen ohne Ausweg** (`web/index.html:550-561`) Nach „Was StayMatch nicht kann“ fehlt der Weg zurück zur Aktion. Kurzer Satz plus Link „Fehler melden auf GitHub“ bzw. „Plugin trotzdem testen“. (S)
295. **R7-295** 🟢 **Final-Abschnitt: dunkles Overlay über hellem Foto** (`web/index.html:197`, `:604-605`) Im Hell-Modus wird `wohnung-hell` geladen und dann zu 62 bis 86 % schwarz überdeckt; man sieht kaum Unterschied, lädt aber 138 KB statt 96 KB. Im Hell-Modus das Original lassen oder ein helles Overlay nutzen. (S)

### Texte und Konsistenz

296. **R7-296** 🟢 **„Parc Güell“ in DE, „Park Güell“ in EN** (`web/index.html:357`, `web/en.html:358`) Einheitlich die offizielle Schreibung „Park Güell“. (S)
297. **R7-297** 🟢 **Gruppen-Balken: „(2)“ unerklärt** (`web/index.html:479-480`, `:486-487`) Dass zwei Personen Party wählen, steht nirgends. „Party (2 Personen)“ oder Legende. (S)
298. **R7-298** 🟢 **Gruppenbeispiel nennt nur Typen, nicht Personen** (`web/index.html:473`, `:478`) „wem es am schlechtesten ginge“ ist pro Person gemeint, die Balken zeigen aber Typen. Satz anpassen: „welcher Typ am schlechtesten wegkommt“. (S)
299. **R7-299** 🟢 **og.png zeigt andere Werte und kein „Beispiel“** (`web/og.png`) Vorschau zeigt 94/88/85, Hero 91/86/79, ohne Kennzeichnung als Beispiel; der Satz „Sag uns … Wir zeigen dir“ klingt nach Dienst mit Server. Werte angleichen, „Beispiel“ einblenden. (S)
300. **R7-300** 🟢 **og.png-Logo weicht vom Favicon ab** (`web/og.png`, `web/favicon.svg:1`) Vorschau: eckiges Feld ohne Haus, Favicon: Kreis mit Haus in `#e0475b`, Navigation: `#ff385c` (`index.html:76`). Ein Logo, eine Farbe. (S)
301. **R7-301** 🟢 **Zwei Rottöne als Markenfarbe** (`web/index.html:42`, `:47`, `:76`, `web/favicon.svg:1`) Dunkel `#e0475b`, hell `#d70466`/`#ff385c`, Logo immer `#ff385c`. `#ff385c` ist zudem Airbnbs Markenfarbe „Rausch“; eigene Farbe wählen, um keine Nähe zu Airbnb zu suggerieren. (M)
302. **R7-302** 🟢 **„Stand“ der Datenschutzerklärung ohne Bezug zur Version** (`web/datenschutz.html:11`) Neben dem Datum die Plugin-Version nennen, für die der Text gilt (0.5.0). (S)
303. **R7-303** 🟢 **„Kopiert ✓“ wird nicht angesagt** (`web/index.html:665`) Der Knopftext wechselt, aber ohne Live-Region hört ein Screenreader nichts. `aria-live="polite"` am Knopf oder versteckte Statuszeile. (S)
304. **R7-304** 🟢 **Kopier-Fehler still** (`web/index.html:665` `catch {}`) Ohne Clipboard-Rechte passiert nichts. Im Fehlerfall Text markieren (`Selection`) und „Strg+C drücken“ zeigen. (S)

### DE/EN-Parität

305. **R7-305** 🟠 **EN-JSON-LD behauptet Englisch für das Produkt** (`web/en.html:31` `"inLanguage":"en"`) Panel und Viertel-Finder sind deutsch (eigene FAQ `en.html:536`). `inLanguage: ["de"]` am SoftwareApplication, Englisch nur für die Seite selbst. (S)
306. **R7-306** 🟢 **EN-Stadtkacheln ohne Sprachhinweis** (`web/en.html:516-525`) Footer sagt „(German)“, die zehn Kacheln führen ohne Hinweis auf deutsche Seiten. Kleine Zeile „City guides currently in German“ unter der Überschrift. (S)
307. **R7-307** 🟢 **Sprachumschalter verliert die Position** (`web/index.html:303`, `web/en.html:303`) Wer bei `#faq` auf EN klickt, landet oben. Per Skript `location.hash` an den Link hängen (die IDs sind identisch, Test sichert das). (S)
308. **R7-308** 🟢 **Kein Sprachhinweis für englische Browser auf DE** (`web/index.html:303`) Bei `navigator.language` ≠ de dezenter Hinweis „English version available“, keine Zwangsumleitung. (S)
309. **R7-309** 🟢 **EN „Privacy policy (German)“ ohne Kurzfassung** (`web/en.html:584`) Bis R6-399 umgesetzt ist: drei englische Sätze im EN-FAQ „What happens to my data?“ verlinken mit Anker auf die deutschen Abschnitte. (S)
310. **R7-310** 🟢 **EN-Hinweis „in German“ dreimal** (`web/en.html:335`, `:399`, `:536`) Hero-Notiz, Plugin-Meta und FAQ sagen dasselbe. Hero und FAQ reichen. (S)
311. **R7-311** 🟢 **Parität der Zahlen nicht getestet** (`tests/startseite.test.js:35-41`) Ein Test, der alle Ziffernfolgen im sichtbaren Text von DE und EN vergleicht (91, 86, 79, 140, 0,6/0.6), fängt vergessene Änderungen an einem Beispiel. (S)
312. **R7-312** 🟢 **Kein Parität-Test für head-Metadaten** (`web/index.html:6-29`, `web/en.html:6-29`) Gleiche Anzahl und Art an `meta property`, `og:image:*`, `twitter:*` prüfen. (S)

### SEO und strukturierte Daten

313. **R7-313** 🟠 **JSON-LD `operatingSystem` nennt Browser** (`web/index.html:31`, `web/en.html:31`) „Web, Chrome, Edge, Brave“ ist kein Betriebssystem. `operatingSystem: "Windows, macOS, Linux, ChromeOS"`, Browser bleiben in `browserRequirements`. (S)
314. **R7-314** 🟢 **Rich-Result-Erwartung prüfen** (`web/index.html:31`, `:34`) Nach meinem Stand zeigt Google FAQ-Rich-Results seit 2023 kaum noch und SoftwareApplication-Snippets nur mit Bewertung. Im Rich-Results-Test prüfen; FAQPage trotzdem behalten (nützt KI-Suchen), keine Bewertungen erfinden. (S)
315. **R7-315** 🟢 **JSON-LD im head vor dem CSS** (`web/index.html:30-35`) Rund 6 KB JSON-LD stehen vor dem kritischen CSS und verbrauchen das erste TCP-Fenster. Ans Ende von `<body>` verschieben. (S)
316. **R7-316** 🟢 **`og:image:type` und `twitter:image:alt` fehlen** (`web/index.html:20-27`, `web/en.html:20-27`) Ergänzen; einige Messenger nutzen den Typ, Screenreader in X/Mastodon den Alt-Text. (S)
317. **R7-317** 🟢 **Kein `max-image-preview:large`** (`web/index.html:4-29`) `<meta name="robots" content="max-image-preview:large">` erlaubt große Bildvorschauen in Discover und KI-Suchen. (S)
318. **R7-318** 🟢 **FAQ-Fragen nicht direkt verlinkbar** (`web/index.html:534-545`) `<details>` ohne `id`; man kann „Ist StayMatch von Airbnb?“ nicht teilen. IDs setzen und per Skript bei passendem Hash öffnen. (S)
319. **R7-319** 🟢 **Datenschutz-Abschnitte ohne Anker** (`web/datenschutz.html:14`, `:24`, `:39`) FAQ verlinkt nur die ganze Seite. `id="plugin"`, `id="viertel-finder"` an die `h2`, FAQ direkt dorthin. (S)
320. **R7-320** 🟢 **Meta-Beschreibung ohne „Chrome-Erweiterung“** (`web/index.html:7`, `web/en.html:7`) Die Beschreibung nennt weder Chrome noch Erweiterung, genau die Wörter, mit denen Leute „Airbnb Chrome Erweiterung“ suchen. Einbauen; der Titel-Test #82 bleibt getrennt. (S)
321. **R7-321** 🟢 **Datenschutzseite in der Sitemap** (`web/sitemap.xml:6`) `/datenschutz` steht in der Sitemap, ist aber kein Suchziel. Rausnehmen (bleibt indexierbar), Sitemap nur mit Seiten, die ranken sollen. (S)
322. **R7-322** 🟢 **Stadtseiten verlinken die Rechenweise nicht** (`web/staedte/berlin.html:10`) Stadtseiten verlinken nur „← StayMatch“; Link „So rechnen wir“ auf `/#rechnen` gibt Kontext zu den Punktwerten. (S)
323. **R7-323** 🟢 **Breadcrumb sichtbar fehlt** (`web/staedte/berlin.html:10`) Sichtbare Zeile „StayMatch › Städte › Berlin“ statt „← StayMatch“ hilft Nutzern und passt zur geplanten Übersichtsseite (R6-362). (S)
324. **R7-324** 🟢 **Stadtseiten verlinken das Plugin nicht** (`scripts/build-city-pages.mjs:78`, `web/staedte/berlin.html:58`) Einziger Aufruf ist der Viertel-Finder, das Hauptprodukt fehlt. Zweiter Knopf „Unterkünfte dort bewerten: Plugin holen“ auf `/#plugin`. (S)
325. **R7-325** 🟠 **Stadtseiten ohne Weg zu Unterkünften im Viertel** (`scripts/build-city-pages.mjs:63`) Jedes gelistete Viertel könnte direkt die Airbnb-Suche „Spandauer Vorstadt, Berlin“ öffnen (gleiches Format wie Schnellsuche), mit Hinweis „öffnet Airbnb“. Das ist der kürzeste Weg zur Buchung. (S)
326. **R7-326** 🟢 **Stadtseiten: Punkte ohne Erklärung** (`web/staedte/berlin.html:16`) „91 von 100“ ohne Satz, was 100 bedeutet. Ein Satz unter der h1: „100 = dichteste Auswahl dieser Art in der Stadt“ (die Methodikseite ist R6-376). (S)
327. **R7-327** 🟢 **Stadtseiten ohne theme-color und apple-touch-icon** (`scripts/build-city-pages.mjs:66-71`) Beim Teilen oder Ablegen auf dem Homescreen fehlt das Icon. Wie auf der Startseite ergänzen. (S)
328. **R7-328** 🟢 **Stadtseiten-Fußzeile lang in einem Satz** (`web/staedte/berlin.html:59`) Lizenz, Hinweis und Navigation in einer Zeile. Lizenz als eigener Absatz, Navigation als Liste. (S)

### Performance und Medien

329. **R7-329** 🟠 **WebP kaum kleiner als JPG** (`web/media/zuzweit-1280.webp` 131 KB vs. JPG 142 KB, `allein-1280.webp` 124 vs. 139 KB, `workation-1280.webp` 116 vs. 141 KB) Die WebP sind mit zu hoher Qualität kodiert. Mit `cwebp -q 72` neu erzeugen, Ziel unter 70 KB je 1280er. (S)
330. **R7-330** 🟢 **Hintergrundbild unter 80 % Overlay in voller Qualität** (`web/media/wohnung-hell-1280.webp` 138 KB, `web/index.html:565-566`) Hinter dem dunklen Verlauf reicht `-q 45` oder 960 px Breite; spart über 80 KB. (S)
331. **R7-331** 🟢 **Stadtkacheln auf Handy zu groß** (`web/index.html:515-524`) Kacheln 680 px für 170 px Anzeige; R6-425 fordert zweite Größe. Ergänzend: Gesamtbudget aller zehn (820 KB) als Wert in check-size. (S)
332. **R7-332** 🟢 **`content-visibility: auto` für Abschnitte unter dem Falz** (`web/index.html:155`) Die zehn Abschnitte nach dem Hero mit `content-visibility:auto; contain-intrinsic-size: auto 900px` rendern erst beim Scrollen; R6-231 betrifft nur die App-Ergebnisse. (S)
333. **R7-333** 🟢 **backdrop-filter auf der festen Navigation** (`web/index.html:73`) `blur(14px)` auf einer Sticky-Leiste kostet auf schwachen Handys Scroll-Bilder. Unter 700 px ohne Blur mit deckendem Hintergrund. (S)
334. **R7-334** 🟢 **`overflow-x: hidden` am body** (`web/index.html:61`) Kann `position: sticky` in Safari stören und versteckt echte Überläufe. `overflow-x: clip` wie beim Hero (`:94`). (S)
335. **R7-335** 🟢 **Großer Glow per radial-gradient** (`web/index.html:95`) 820×820 px Verlauf hinter dem Hero wird bei jedem Scroll neu gemalt (wegen Sticky-Blur). `will-change` vermeiden, stattdessen als kleines WebP oder nur auf Desktop. (S)
336. **R7-336** 🟢 **Puls-Animation läuft endlos** (`web/index.html:124`) `pulse` animiert `box-shadow` dauerhaft, das zwingt zu ständigem Neuzeichnen. Nach 3 Durchläufen stoppen (`animation-iteration-count: 3`). (S)
337. **R7-337** 🟢 **Theme-Fotos per Regex auch für nie sichtbare Bilder** (`web/index.html:601-607`) Ergänzend zu R6-427: das Bild hinter `aria-hidden` und alle `loading=lazy` werden bei jedem Umschalten neu gesetzt; nur Bilder im Viewport sofort tauschen. (S)
338. **R7-338** 🟢 **`qnote` per innerHTML bei jeder Taste** (`web/index.html:631`) Baut DOM bei jedem Tastendruck neu und triggert die Live-Region. Nur bei geänderter Nächtezahl `textContent` setzen. (S)
339. **R7-339** 🟢 **Preload der Schrift auch auf den Rechtsseiten** (`web/legal.css:3`, `web/impressum.html:7`) 404 lädt vor, Impressum/Datenschutz/Stadtseiten nicht; Text springt beim Laden. `<link rel="preload">` im Generator und den Rechtsseiten. (S)

### Barrierefreiheit

340. **R7-340** 🔴 **Grün und Orange im Hellmodus unter 2,5:1** (`web/index.html:46`, `:51` überschreiben `--good`/`--warn` nicht) `#2fbf85` auf `#f7f7f7` = 2,2:1, `#e6a23c` = 2,0:1 für `.why`, `.why.w`, `.sc` (`:136-138`) und die Häkchen. Helle Varianten `--good:#0a7a50; --warn:#8a5a00` setzen (legal.css nutzt den Warn-Ton schon). (S)
341. **R7-341** 🟠 **Eingabefelder der Schnellsuche kaum sichtbar** (`web/index.html:106` `border: var(--line)`) Rahmen `#ebebeb` auf Weiß = 1,19:1, dunkel `#26262d` auf `#121216` = 1,24:1; WCAG 1.4.11 verlangt 3:1. `--line2` mit dunklerem Wert für Formularrahmen. (S)
342. **R7-342** 🟠 **Ghost-Knöpfe und Theme-Knopf mit zu schwachem Rand** (`web/index.html:82-83`, `:90`) `--line2 #b0b0b0` auf Weiß = 2,17:1. Für Bedienelemente `#8a8a8a` oder dunkler. (S)
343. **R7-343** 🟠 **Verlaufsüberschrift verschwindet im Hochkontrastmodus** (`web/index.html:101` `color: transparent` mit `background-clip:text`) „In 2 Minuten.“ ist bei `forced-colors: active` unsichtbar; R6-308 betrifft nur die App. `@media (forced-colors: active) { h1 em { color: CanvasText; background: none } }`. (S)
344. **R7-344** 🟢 **Kopieren-Knopf zu klein** (`web/index.html:266`) Rund 20 px hoch, WCAG 2.5.8 verlangt 24 px Zielgröße. `padding: 4px 10px; min-height: 28px`. (S)
345. **R7-345** 🟢 **Navigationslinks ohne Klickfläche** (`web/index.html:79`) Reiner Text ohne Padding, auf dem Handy in einer Scroll-Leiste schwer zu treffen. `padding: 8px 4px`. (S)
346. **R7-346** 🟢 **Sprachknopf: Name passt nicht zur Beschriftung** (`web/index.html:303`, `web/en.html:303`) Sichtbar „EN“, Name „English version“; Sprachsteuerung („klick EN“) findet ihn nicht (WCAG 2.5.3). `aria-label` weglassen und `title` nutzen oder Name mit „EN“ beginnen. (S)
347. **R7-347** 🟢 **Überschriftensprung h1 → h3** (`web/index.html:366-369`) Die Leiste nutzt `h3` direkt nach der `h1`. Als `p` mit `strong` oder unsichtbare `h2` „Auf einen Blick“ davor. (S)
348. **R7-348** 🟢 **`aria-current="true"` statt „location“** (`web/index.html:687`) Für Sprungmarken innerhalb der Seite ist `aria-current="location"` der passende Wert. (S)
349. **R7-349** 🟢 **FAQ-Plus wird vorgelesen** (`web/index.html:217`) `summary::after { content: "+" }` lesen manche Screenreader als „plus“. `content: "+" / ""` (alternativer Text leer). (S)
350. **R7-350** 🟢 **Schnellsuche: Hinweis nicht mit Feldern verknüpft** (`web/index.html:333`) „Öffnet … in neuem Tab“ gehört zum Knopf. `aria-describedby="qnights"` an den Submit-Knopf. (S)
351. **R7-351** 🟢 **Datumsfelder ohne Fehlermeldung** (`web/index.html:629`) Abreise vor Anreise wird still geleert. Statt Leeren eine sichtbare Meldung („Abreise muss nach der Anreise liegen“) mit `aria-invalid`. (S)
352. **R7-352** 🟢 **Theme-Knopf hat keinen sichtbaren Text** (`web/index.html:304`) Nur Symbol; Maus-Nutzer sehen den dynamischen Namen nicht. `title` mit demselben Text. (S)
353. **R7-353** 🟢 **Fokus auf Bildkacheln kaum sichtbar** (`web/index.html:65`, `:262`) Outline in Akzentfarbe auf Foto mit `overflow:hidden` wird teils abgeschnitten. `outline-offset: -3px` oder `box-shadow` innen für `.city`. (S)
354. **R7-354** 🟢 **Kein Token-Kontrasttest für die Startseite** (`web/index.html:41-53`) R6-173 deckt das Plugin ab. Gleicher Test für die vier Themenblöcke der Startseite und `legal.css` (Text, Rahmen 3:1). (S)

### Dark und Light

355. **R7-355** 🟠 **Systemdunkel wird ignoriert** (`web/index.html:283` `let t = 'light'`) Ohne gespeicherte Wahl bekommt jede Person Hell, obwohl die CSS (`:49-54`) dem System folgen könnte; R6-336 kritisiert nur den Kommentar. Entscheidung treffen: entweder `t` leer lassen und System folgen oder Kommentar und Legal-/Stadtseiten auf Hell angleichen. (S)
356. **R7-356** 🟢 **Favicon ohne Dunkel-Variante** (`web/favicon.svg:1`) SVG-Favicons können `@media (prefers-color-scheme: dark)` enthalten; Kreis bekommt im dunklen Tab-Leiste einen hellen Rand. (S)
357. **R7-357** 🟢 **theme-color nur ein Wert im HTML** (`web/index.html:8`) Zwei Meta-Tags mit `media="(prefers-color-scheme: dark)"` setzen Farbe schon vor JavaScript richtig. (S)
358. **R7-358** 🟢 **Rechtsseiten ohne Umschalter** (`web/legal.css:1-2`) Wer auf der Startseite Dunkel wählt, landet auf Impressum im System-Modus. `sm_theme` per 3-Zeilen-Skript lesen (CSP erlaubt Inline) oder bewusst dokumentieren. (S)

### Mobile

359. **R7-359** 🟢 **Hero-Grafik auf dem Handy vor der Erklärung** (`web/index.html:97`, `:112-114`) Auf schmalen Bildschirmen folgt die 400 px hohe Grafik nach der Schnellsuche; `mobile-hint` steht davor. Hinweis direkt unter die Knöpfe ziehen, bevor jemand „Plugin holen“ tippt. (S)
360. **R7-360** 🟢 **Chips über dem Kartenrand** (`web/index.html:144` `left:-6px; max-width:320px`) Bei 320 px Breite ragen die Chips aus der Bühne und werden von `overflow-x:hidden` abgeschnitten. `max-width: calc(100% - 12px)`. (S)
361. **R7-361** 🟢 **Datumsfelder auf iOS ohne Platzhalter** (`web/index.html:327-328`) Leere `type=date`-Felder erscheinen auf iOS als leere Kästen. `min-height` und Beschriftung im Feld oder vorausgefülltes Wochenende. (S)
362. **R7-362** 🟢 **`inputmode="numeric"` bei type=number überflüssig** (`web/index.html:329`) Lieber `type="text" inputmode="numeric" pattern="[0-9]*"` oder Plus/Minus-Knöpfe, da Zahlfelder auf Handys Scrollen ändern. (S)

### Rechtliches und Datenschutz

363. **R7-363** 🟠 **Markenhinweis fehlt** (`web/index.html:583`, `web/en.html:585`, `web/staedte/berlin.html:59`) Neben „Nicht mit Airbnb verbunden“: „Airbnb ist eine Marke der Airbnb, Inc. Chrome ist eine Marke der Google LLC.“ Gilt auch für Stadtseiten und og.png-Seiten. (S)
364. **R7-364** 🟠 **Deeplink trägt Reisedaten in der Query** (`web/index.html:637` `/app?c=…&i=…&o=…&n=…`, `web/datenschutz.html:26`) Datenschutz sagt, Reisedaten liegen nur im Browser und hinter `#`. Der Schnellstart-Link schickt Stadt, Daten und Personenzahl als Query an Vercel (Server-Log). Auf `#c=…` umstellen oder im Datenschutz nennen. (S)
365. **R7-365** 🟠 **Weitergabe an Airbnb nicht erwähnt** (`web/index.html:641-652`, `web/datenschutz.html:24-37`) Die Schnellsuche öffnet Airbnb mit Stadt, Daten und Gästen; dort gelten Airbnbs Cookies und Datenschutz, der Referrer verrät `staymatch.pro`. Einen Absatz „Startseite: Schnellsuche öffnet Airbnb“ ergänzen. (S)
366. **R7-366** 🟠 **GitHub als Empfänger fehlt** (`web/datenschutz.html:18`, `:43`) „Fehler melden“ und Issues laufen über GitHub (Microsoft, USA). Als Empfänger mit Drittland-Hinweis nennen, nicht nur als Link. (S)
367. **R7-367** 🟢 **Startseite und Stadtseiten nicht beschrieben** (`web/datenschutz.html:12`) Der Text kennt nur Plugin und Viertel-Finder. Ein Satz: „Startseite und Stadtseiten laden nichts von Dritten, speichern nur die Design-Wahl“. (S)
368. **R7-368** 🟢 **Speicherdauer der Server-Protokolle fehlt** (`web/datenschutz.html:36`) „übliche Server-Protokolle“ ohne Frist. Vercel-Aufbewahrung nachsehen und nennen (Plan abhängig); R6-415 betrifft nur Drittland und AV-Vertrag. (S)
369. **R7-369** 🟢 **ZIP-HEAD-Anfrage im Datenschutz unerwähnt** (`web/index.html:667`) Harmlos, aber vollständig: „Die Seite fragt die Größe der Plugin-Datei beim eigenen Server ab.“ Oder die Größe beim Build einsetzen (R6-389) und Satz entfällt. (S)
370. **R7-370** 🟢 **Impressum nennt TMG** (`web/impressum.html:12`) Das TMG ist seit Mai 2024 durch das DDG ersetzt. Nur „§ 5 DDG“ nennen. (S)
371. **R7-371** 🟢 **Verantwortlicher nach MStV fehlt** (`web/impressum.html:14-18`) Stadtseiten, FAQ und Ratgebertexte sind redaktionelle Inhalte; dafür „Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV“ vorsehen. Rechtlich prüfen lassen. (S)
372. **R7-372** 🟢 **Stadtseiten ohne Impressum-Link** (`scripts/build-city-pages.mjs:79`, `web/staedte/berlin.html:59`) Fußzeile hat Datenschutz und Startseite, kein Impressum; „leicht erreichbar von jeder Seite“ verlangt den Link. (S)
373. **R7-373** 🟢 **404 ohne Impressum und Datenschutz** (`web/404.html:18`) Fehlerseite ist eine eigene Seite unter der Domain; kleine Fußzeile mit beiden Links. (S)
374. **R7-374** 🟢 **Haftungshinweis für Punktwerte fehlt** (`web/impressum.html:20-21`) Kurzer Satz: Werte sind automatische Schätzungen ohne Gewähr, keine Buchungsempfehlung; Stadtseiten haben das, Startseite nur „kein Urteil“. (S)
375. **R7-375** 🟢 **KI-Bild-Hinweis nur im Repo** (`web/media/NOTICE.md:1-8`) Ergänzend zu R6-391: `NOTICE.md` ist nicht verlinkt; im Footer „Bilder: KI-generiert“ mit Link auf eine Lizenzseite. (S)
376. **R7-376** 🟢 **Datenschutz sagt „keine Cookies“, Airbnb-Tab setzt welche** (`web/datenschutz.html:40`) Präzisieren: „Diese Seite setzt keine Cookies. Seiten, die du von hier öffnest (Airbnb, GitHub, OSM), haben eigene Regeln.“ (S)
377. **R7-377** 🟢 **Referrer-Policy könnte strenger sein** (`web/vercel.json:9`) `strict-origin-when-cross-origin` schickt `https://staymatch.pro/` an Airbnb und OSM. `no-referrer` für Startseite und Stadtseiten (Viertel-Finder braucht für OSM-Kacheln den Referer laut Tile-Policy, dort lassen). (S)

### 404-Seite

378. **R7-378** 🟢 **404 ohne Suche oder Städte** (`web/404.html:18`) Ergänzend zu R6-401: Häufigster Fehler sind falsch getippte Stadtseiten (`/staedte/lisbon`). Per kleinem Skript Ähnlichkeit zu den zehn Slugs prüfen und „Meintest du Lissabon?“ zeigen. (S)
379. **R7-379** 🟢 **Englische Stadtnamen landen auf 404** (`https://staymatch.pro/staedte/lisbon`) `redirects` für `lisbon, prague, rome, vienna` auf die deutschen Slugs; EN-Nutzer tippen sie. (S)
380. **R7-380** 🟢 **404 nutzt fixes Rot statt Token** (`web/404.html:16`) Ergänzend zu R6-404: Farbe kommt hart kodiert, Hellmodus-Rot `#d70466` der Startseite wird nicht genutzt. Bei Umzug auf legal.css mitziehen. (S)

### Impressum und Datenschutz: Form

381. **R7-381** 🟢 **Datenschutz ohne Inhaltsverzeichnis** (`web/datenschutz.html:10-14`) Vier Abschnitte, aber auf dem Handy lang. Sprungliste oben. (S)
382. **R7-382** 🟢 **Code-Namen im Fließtext** (`web/datenschutz.html:17`) `lastSearch`, `filters`, `quick`, `min:*` sind für Laien unverständlich. In eine aufklappbare Tabelle „Technische Schlüssel“ verschieben. (S)
383. **R7-383** 🟢 **Rechtsseiten ohne `meta description` (Impressum)** (`web/impressum.html:2-7`) Für Konsistenz und Teilen eine Beschreibung ergänzen, auch wenn `noindex`. (S)
384. **R7-384** 🟢 **Rechtsseiten ohne og-Tags** (`web/datenschutz.html:2-7`) Wer die Datenschutzseite teilt (z. B. Store-Prüfung), bekommt keine Vorschau. `og:title`, `og:image`. (S)
385. **R7-385** 🟢 **Drucklayout fehlt** (`web/legal.css:1-16`) Datenschutz wird oft gedruckt oder als PDF gespeichert; `@media print` mit schwarzem Text auf Weiß und sichtbaren Link-URLs. (S)

### Tests

386. **R7-386** 🟢 **FAQ-Test hängt an exaktem Markup** (`tests/startseite.test.js:20-21`) Regex verlangt `<section class="block tight" id="faq">` und `<summary>…</summary><p>`; eine zweite Klasse oder ein zweiter Absatz bricht den Test mit unklarer Meldung. Mit jsdom (ohnehin da) parsen. (S)
387. **R7-387** 🟢 **Bilder-Test prüft die Hell-Varianten nicht** (`tests/startseite.test.js:25-28`) Ergänzend zu R6-497: der Test liest nur `src/srcset`, die per Regex erzeugten `*-hell-*`-Pfade (`index.html:604-605`) werden nie geprüft. Pfadliste aus dem Regex ableiten und Existenz testen. (S)
388. **R7-388** 🟢 **Stadtseiten-Test prüft Fußzeilen-Links nicht** (`tests/r5-stadtseiten.test.js:15-28`) Pflichtlinks Impressum, Datenschutz, Startseite in jeder Stadtseite testen. (S)
389. **R7-389** 🟢 **CSP gegen Code-Hosts nicht getestet** (`web/vercel.json:12`, `shared/core.js:48`, `:86`) Kommt ein vierter Overpass-Spiegel in `core.js`, blockiert die CSP ihn still. Test: jede `https://`-Adresse in `core.js`/`app.js` steht in `connect-src` oder `img-src`. (S)
390. **R7-390** 🟢 **Kein Test für Header auf Rechtsseiten** (`web/vercel.json:5-13`) Ein Test, dass `source: "/(.*)"` die fünf Sicherheitsheader enthält und keine spätere Regel sie überschreibt. (S)
391. **R7-391** 🟢 **Kein Test für `rel="noopener"` bei `target="_blank"`** (`web/index.html:396`, `:462`, `:582`) Heute korrekt; ein Test über alle HTML-Dateien hält es so. (S)
392. **R7-392** 🟢 **Kein Test auf `width`/`height` bei Bildern** (`web/index.html:378`, `:515`) Ergänzt R6-462 als Test statt Skript: jede `<img>` in Startseiten hat beide Attribute (CLS). (S)
393. **R7-393** 🟢 **Kein Test, dass `data-app`-Links aktualisiert werden** (`web/index.html:637`) Ein jsdom-Test tippt Stadt und prüft alle `a[data-app]`; R6-499 prüft den Roundtrip mit der App, nicht die Anzahl der Links. (S)
394. **R7-394** 🟢 **EN-Footer-Links ohne Test** (`web/en.html:584-585`) Dass alle deutschsprachigen Ziele `hreflang="de"` tragen, ist nur Konvention. Test: jeder Link von en.html auf `/datenschutz|/impressum|/app|/staedte` hat `hreflang="de"`. (S)

### Inhalte und Vertrauen

395. **R7-395** 🟢 **„Code auf GitHub“ ohne Stand** (`web/index.html:396`) Neben dem Link Datum des letzten Commits (beim Build eingesetzt), zeigt Pflege. Ergänzt #35 nur als statischer Build-Wert, ohne Fremdanfrage. (S)
396. **R7-396** 🟢 **Keine Kontaktmöglichkeit außer GitHub** (`web/index.html:582`) Für Nicht-Entwickler ist ein GitHub-Konto eine Hürde. Ein einfaches Feedback-Ziel (E-Mail) im Footer, sobald das Impressum steht. (S)
397. **R7-397** 🟢 **„Rechnung im Code ansehen“ für Laien** (`web/index.html:462`) Ergänzt R6-335: Code-Link schreckt ab. Daneben drei Zeilen Formel in Klartext (wie bei Gruppen `:482`). (S)
398. **R7-398** 🟢 **Plugin-Bild zeigt nur Stimmung** (`web/index.html:400`) Direkt neben den Installationsschritten erwartet man das echte Panel. Bis echte Screenshots da sind (#33): Bild hier weglassen, Schritte bekommen mehr Raum. (S)
399. **R7-399** 🟢 **„Für wen?“ ohne Familie** (`web/index.html:501-504`) Familie ist Viertel-Typ und Stadtseiten-Kategorie, fehlt aber unter den vier Szenarien. Workation oder Wochenende tauschen oder fünfte Karte. (S)
400. **R7-400** 🟢 **Final-Abschnitt ohne Schnellsuche** (`web/index.html:563-576`) Wer bis unten liest, will oft sofort suchen. Kompakte Stadt-Eingabe oder Link „Nach oben zur Schnellsuche“. (S)

## Städtedaten, Tests, CI, Doku

Messbasis: `web/data/*.json` mit node ausgewertet (143.130 Zeilen, 9,49 MB roh, 1,87 MB gzip, 1,41 MB Brotli; staymatch.pro liefert Brotli aus). Tests lokal: 182 Tests, 156 grün, 0 rot, 24 übersprungen (jsdom fehlt), 2 todo, ca. 2 s. CI auf `main` (8c4930b) ist rot: 3 DOM-Tests scheitern. Kopien `web/core.js`, `extension/core.js`, `web/i18n.js`, `extension/i18n.js` sind byte-gleich mit `shared/` (nur Kopfzeile); die echte Drift liegt in Logik, die außerhalb von `shared/` doppelt steht (Abschnitt „Geteilter Code“).
Stand älterer Punkte (keine neuen Einträge): R6-195 ist überholt, 0 % der Zeilen sind ohne Kategorie. R6-491 bestätigt: der Rom-todo-Test läuft grün (`tests/r5-daten.test.js:55`). Byte-Drift der Kopien: keine.

### Datenqualität (web/data)

401. **R7-401** 🔴 **Plätze und Inseln landen als „Viertel“ in den Stadtseiten** (`web/app.js:428`, `scripts/build-city-pages.mjs:38`) Jede Zeile mit `place` und `name` wird Viertel, auch `place=square/islet/island/farm/plot/locality/isolated_dwelling` (74 Namen in 10 Städten). 16 davon stehen öffentlich in Top-5-Listen, z. B. Dam, Gendarmenmarkt, Puerta del Sol, Piazza Navona, Heldenplatz, „Széchenyi István tér“ 5× in `web/staedte/budapest.html`. Nur `C.PLACE_TYPES` als Viertel zulassen, in App, Stadtseiten und Prefetch. (S)
402. **R7-402** 🟠 **Platz-Zeilen verlieren ihre POI-Kategorie** (`web/app.js:428` `continue`) Ein Platz mit `tourism=attraction` (Dam, Plaza Mayor) zählt nur als Viertel, nicht als Sehenswürdigkeit. Nach dem Typ-Filter oben fallen diese Zeilen in die POI-Schleife zurück; Test mit einer Zeile `place=square,tourism=attraction`. (S)
403. **R7-403** 🟠 **Stadtmitte vorab geladener Städte ist die bbox-Mitte, nicht das Zentrum** (`web/app.js:308`, `scripts/prefetch-cities.mjs:56`) Prefetch speichert `lat/lon` von Nominatim nicht, die App nimmt die Mitte der beschnittenen bbox. Lissabon: Mitte 38,737/−9,158 statt ca. 38,708/−9,137 (rund 3,5 km), Amsterdam rund 0,9 km. `annotateCentre` (`app.js:476`) rechnet damit falsch; `center` in die Datei schreiben. (S)
404. **R7-404** 🟠 **Unbenannte Gärten sind ein Viertel aller Zeilen** (`web/data/amsterdam.json`, ergänzt R6-190) 37.850 von 143.130 Zeilen sind `leisure=garden` ohne Namen (Amsterdam 65 %, Madrid 46 %, Prag 34 %), 2,13 MB roh. Im Prefetch verwerfen oder in der Overpass-Abfrage `garden` nur mit `name` holen. (S)
405. **R7-405** 🟢 **Namen mit Rand- oder Doppel-Leerzeichen** (`scripts/prefetch-cities.mjs:53`) Lissabon 6, Paris 3, fünf weitere Städte je 1 Zeile. Beim Prefetch `trim()` und `\s+` → ein Leerzeichen; sonst scheitern Namensvergleiche (`app.js:428` `a.name === t.name`). (S)
406. **R7-406** 🟢 **Punkte außerhalb der bbox bleiben drin** (`web/data/madrid.json` 47, `paris.json` 38, `rom.json` 32) Overpass-Flächenmittelpunkte ragen hinaus; der Test toleriert 1 % (`tests/r5-daten.test.js:42`). Im Prefetch auf bbox plus 0,01° beschneiden, dann Toleranz im Test auf 0. (S)
407. **R7-407** 🟢 **bbox mit Gleitkomma-Rauschen** (`web/data/amsterdam.json` `52.298079599999994`, `berlin.json` `52.592388500000006`) Unnötige Stellen, uneinheitlich zur Zeilenrundung. bbox auf 6 Stellen runden (`prefetch-cities.mjs:56`). (S)
408. **R7-408** 🟢 **Gemischte Datenstände** (`web/data/rom.json` `t`=10.11., übrige 09.11.; 13 vs. 12 Spalten) Städte werden einzeln mit verschiedenen Abfrageversionen geholt. Je Datei `queryHash` (Hash von `C.overpassQuery`-Vorlage + `FIELDS`) speichern; Test meldet Dateien mit altem Hash. (S)
409. **R7-409** 🟢 **Aliase nur DE/EN/Landessprache** (`web/data/index.json:1-19`, `scripts/cities.json`) Es fehlen u. a. „praga“, „viena“, „vienne“, „lisbonne“, „barcelone“, „berlino“, „parigi“, „budapeste“. Wer so sucht, wartet auf Overpass statt 1 s Vorabdaten. Aliase aus Wikidata-Labels der Stadt erzeugen oder Liste ergänzen. (S)
410. **R7-410** 🟢 **Lange Namen ungekürzt** (`web/data/lissabon.json`: 121 Zeichen, `madrid.json` 102) Prefetch-Check mit Warnung über 80 Zeichen, damit Karten-Popups und Stadtseiten nicht umbrechen. (S)

### Dateigröße und Format (Messung in Brotli, wie ausgeliefert)

411. **R7-411** 🟠 **Koordinaten auf 4 statt 5 Nachkommastellen** (`scripts/prefetch-cities.mjs:54`) 5 Stellen = 1,1 m, bei 800 m Umkreis unnötig. Brotli gesamt 1,41 → 1,25 MB (−11 %); zugleich passen Koordinaten dann zu den Favoriten-Schlüsseln mit 4 Stellen (R6-207). (S)
412. **R7-412** 🟢 **`wikidata` nur als Ja/Nein genutzt** (`web/app.js:556`) Die Q-Nummer dient nur zum Sortieren. Als `1` speichern spart weitere 2 % Brotli (1,25 → 1,22 MB) und 60 KB roh. (S)
413. **R7-413** 🟢 **Zeilen sortiert schreiben** (`scripts/prefetch-cities.mjs:56`) Nach Tags, dann Koordinate sortiert: Brotli 1,22 → 1,10 MB (−10 %), außerdem stabile Diffs zwischen zwei Läufen. (S)
414. **R7-414** 🟢 **Alle vier Maßnahmen zusammen −28 %** (`web/data/*.json`) 4 Stellen, wikidata-Flag, Sortierung, ohne unbenannte Gärten: 1,41 → 1,01 MB Brotli; Paris einzeln ca. 286 → 205 KB. Vor R6-305 (Spaltenformat) umsetzen, weil ohne App-Änderung. (M)
415. **R7-415** 🟢 **Größenprüfung nur roh je Datei** (`.github/scripts/check-size.mjs:19`) Grenze 2,5 MB roh, Paris liegt bei 1,79 MB. Zusätzlich Brotli-Budget je Datei (z. B. 300 KB) und Gesamtbudget für `web/data/` prüfen, denn das ist die echte Ladezeit. (S)
416. **R7-416** 🟢 **Eine Zeile pro Datei macht Diffs unlesbar** (`scripts/prefetch-cities.mjs:56`) 1,8 MB in einer Zeile; Reviews eines Datenlaufs sind unmöglich. Eine Datenzeile pro Textzeile schreiben (+1,5 % roh, Brotli fast gleich). (S)
417. **R7-417** 🟢 **Jeder Datenlauf wächst die Git-Historie um ca. 2 MB gepackt** (16 Blobs, 9,5 MB unter `web/data` in `git rev-list`) Bei wöchentlicher Auffrischung rund 100 MB pro Jahr. Entweder selten auffrischen oder Daten als Release-Asset bauen und beim Deploy holen. (M)

### Daten-Pipeline (scripts/prefetch-cities.mjs)

418. **R7-418** 🟠 **Absolute Mindestzeilenzahl schützt kaum** (`scripts/prefetch-cities.mjs:17`, `:55`) `MIN_ROWS=200`, Paris hat 25.922 Zeilen; eine Teilantwort mit 5.000 Zeilen überschreibt die gute Datei. Mit der alten Datei vergleichen und unter 70 % abbrechen (Override per `--force`). (S)
419. **R7-419** 🟠 **Nicht atomar geschrieben** (`scripts/prefetch-cities.mjs:56`, `:58`) Abbruch mitten im Schreiben hinterlässt kaputtes JSON, das die App still verwirft (`app.js:309` `catch`). In `*.tmp` schreiben, dann `rename`. (S)
420. **R7-420** 🟠 **Prefetch löst Städte anders auf als die App** (`scripts/prefetch-cities.mjs:27` `j[0]` mit `limit=1`, `web/app.js:246-248` `limit=5` + `SM.placeChoices`) Vorab-Daten und Live-Suche können für denselben Namen verschiedene Orte und bboxen nutzen. Beide über eine gemeinsame Funktion in `shared/core.js` führen. (S)
421. **R7-421** 🟢 **Nominatim-Antwort ohne `r.ok`-Prüfung** (`scripts/prefetch-cities.mjs:24-25`) Bei 429/503 kommt HTML, `r.json()` wirft eine unklare Meldung. Status prüfen und mit klarer Meldung wiederholen. (S)
422. **R7-422** 🟢 **Per Argument geholte Städte gehen beim nächsten Lauf verloren** (`scripts/prefetch-cities.mjs:46`) `node prefetch-cities.mjs Mailand` schreibt Datei und Index, aber nicht `scripts/cities.json`; der Standardlauf frischt sie nie auf. Neue Städte in `cities.json` eintragen oder Warnung ausgeben. (S)
423. **R7-423** 🟢 **Kein Änderungsbericht** (`scripts/prefetch-cities.mjs:59`) Nur „ok N Zeilen“. Tabelle alt/neu je Stadt (Zeilen, Viertel, KB, Δ %) ausgeben, als Text für den PR. (S)
424. **R7-424** 🟢 **Kein Trockenlauf** (`scripts/prefetch-cities.mjs:44-63`) `--dry-run` (holen, prüfen, Bericht, nichts schreiben) erlaubt, eine Abfrageänderung ohne 9 MB Diff zu testen. (S)
425. **R7-425** 🟢 **Verworfene Zeilen werden nicht gezählt** (`scripts/prefetch-cities.mjs:53`) `filter(v => v.length === FIELDS.length)` wirft Zeilen still weg. Anzahl je Stadt ausgeben, damit Abfrage- oder Trennzeichenfehler auffallen. (S)
426. **R7-426** 🟢 **Schema ohne Versionsfeld** (`scripts/prefetch-cities.mjs:56`) Dateien haben `t, city, bbox, fields, rows`, aber kein `v`. `v: 1` setzen, App und Test prüfen die Version, statt Spalten zu raten. (S)
427. **R7-427** 🟢 **Overpass-Server und Abrufdauer nicht festgehalten** (`scripts/prefetch-cities.mjs:36`) Bei Datenfehlern ist unklar, welcher Spiegel geantwortet hat. `source` (Host) und `ms` in die Datei schreiben. (S)
428. **R7-428** 🟢 **Kein `npm`-Skript `check:data`** (`package.json:9-20`) Eine Prüfung für Schema, Typ-Filter, Namen, bbox, Alter, Größe als eigenes Skript, in CI und `deploy.sh` nutzbar; Tests bleiben schlank. (S)

### Lizenz und Attribution (ODbL)

429. **R7-429** 🟠 **Erzeugungsweg nicht beschrieben** (`web/data/NOTICE.md:10`) ODbL 4.6 verlangt bei öffentlich genutzten abgeleiteten Datenbanken die Datenbank oder die Methode der Änderung. NOTICE nennt nur das Skript; Abfrage (`shared/core.js:73-82`), Filter (Rundung, MIN_ROWS) und Spalten kurz beschreiben und verlinken. (S)
430. **R7-430** 🟢 **JSON-Dateien ohne eingebettete Lizenz** (`web/data/*.json`, Schlüssel `t, city, bbox, fields, rows`) Wer eine Datei direkt lädt, sieht keinen Hinweis. Felder `license: "ODbL-1.0"` und `attribution: "© OpenStreetMap-Mitwirkende"` (ca. 70 Byte) ergänzen. (S)
431. **R7-431** 🟢 **NOTICE ohne Abrufdaten je Stadt** (`web/data/NOTICE.md:10`) Nur „Feld t“. Tabelle Stadt, Abrufdatum, Zeilen beim Prefetch automatisch erzeugen. (S)
432. **R7-432** 🟢 **NOTICE nirgends verlinkt** (`README.md:34-38`, `THIRD_PARTY.md:7`) Die Share-Alike-Erklärung liegt versteckt in `web/data/`. Aus THIRD_PARTY.md und README-Abschnitt „Data“ verlinken. (S)
433. **R7-433** 🟢 **Stadtseiten fehlen in THIRD_PARTY** (`THIRD_PARTY.md:7`) „Wo“ nennt `web/data/` und Live-Abfragen, nicht `web/staedte/*.html` (Produced Work mit eigener Attribution). Ergänzen. (S)
434. **R7-434** 🟢 **Herkunft von Icons und og.png nicht dokumentiert** (`THIRD_PARTY.md:3-11`, `extension/icons/*.png`, `web/og.png`, `web/favicon.svg`) Für Store-Prüfung und Lizenzklarheit „selbst erstellt“ oder Quelle nennen. (S)
435. **R7-435** 🟢 **NOTICE nur Deutsch** (`web/data/NOTICE.md:1-10`) Datennutzer sind international. Kurze englische Fassung darunter. (S)

### Tests

436. **R7-436** 🔴 **DOM-Tests auf `main` rot, lokal unsichtbar** (`tests/plugin-dom.test.js:18`, `:33`, `:120`; CI-Lauf 12.11. 04:48) Seit #44 (Foto-Karten) erwarten drei Tests alte Panel-Texte („pro Person und Nacht“, „1. Titel 999“). Ohne jsdom werden sie lokal übersprungen. Tests an das neue Panel anpassen oder Panel-Regression beheben. (S)
437. **R7-437** 🟠 **`web/app.js` (59 KB, 851 Zeilen) von keinem Test geladen** (`tests/r5-daten.test.js:56` liest es nur als Text) Coverage (ohne DOM-Tests) gesamt 94 % Zeilen, aber die größte Datei fehlt ganz. Reine Teile (Daten-Laden, Areas, Cache-Schlüssel) in Module ziehen und testen. (M)
438. **R7-438** 🟠 **Typ-Filter für Viertel ungetestet** (`web/app.js:428`) Test: Zeile mit `place=square` wird kein Viertel, Zeile mit `place=quarter` schon; dazu ein Datentest, dass keine Top-5-Liste einen Nicht-Viertel-Typ enthält. (S)
439. **R7-439** 🟢 **Prefetch-Parser ungetestet** (`scripts/prefetch-cities.mjs:53-54`) CSV-Zerlegung, Rundung, Spaltenzahl. In `shared/core.js` als `parseOverpassCsv` ziehen und mit Fixtures testen (auch „|“ im Namen). (S)
440. **R7-440** 🟢 **Schwellen widersprechen sich** (`tests/r5-daten.test.js:35` `> 100` vs. `scripts/prefetch-cities.mjs:17` `MIN_ROWS = 200`) Eine Konstante exportieren und im Test nutzen. (S)
441. **R7-441** 🟢 **Aliase aus `cities.json` nicht gegen den Index geprüft** (`tests/r5-daten.test.js:62` feste Liste) Jeden Alias aus `scripts/cities.json` laden und auf `index.json` prüfen, statt fünf Paare von Hand. (S)
442. **R7-442** 🟢 **Kein Datenalter-Test** (`web/data/*.json` Feld `t`) Warnung ab 90 Tagen, Fehler ab 180 Tagen, im wöchentlichen CI-Lauf; sonst veralten Stadtseiten unbemerkt. (S)
443. **R7-443** 🟢 **Testdateien nach Runden statt Modulen benannt** (`tests/r5-*.test.js`, `p1-*.test.js`, `round4.test.js`) Wer `parse.js` ändert, findet die Tests in drei Dateien. Umbenennen nach Modul (`parse.test.js`, `rank.test.js`, `data.test.js`). (S)
444. **R7-444** 🟢 **Erwartete Fehler im Testlog** (`tests/r5-plugin.test.js:67`, CI-Log „QUOTA_BYTES quota exceeded“) Der Speicher-voll-Test druckt einen Stacktrace, der bei echten Fehlern verwirrt. `console.error` im Test abfangen und prüfen. (S)
445. **R7-445** 🟢 **check-zip prüft Manifest von der Platte** (`.github/scripts/check-zip.mjs:23`) Ein altes ZIP besteht, solange `extension/manifest.json` passt. Manifest per `unzip -p` aus dem ZIP lesen und Version vergleichen. (S)
446. **R7-446** 🟢 **dev-server stürzt bei kaputter URL ab** (`scripts/dev-server.mjs:15`) `decodeURIComponent('%E0%A4%A')` wirft außerhalb von `try`, der Server beendet sich. In `try` ziehen, 400 antworten; Test dazu. (S)
447. **R7-447** 🟢 **dev-server lauscht im ganzen Netz** (`scripts/dev-server.mjs:31`) `listen(PORT)` bindet an alle Schnittstellen; im Café-WLAN sieht jeder die Dev-Seite. `listen(PORT, '127.0.0.1')`. (S)

### CI (ci.yml)

448. **R7-448** 🔴 **`main` ohne Schutz, rote PRs wurden gemergt** (`gh api .../branches/main/protection` → 404, 0 Rulesets) #44 ging mit roter CI rein. Ruleset: PR Pflicht, Status `check (22)`, `check (24)` Pflicht, kein Force-Push. (S)
449. **R7-449** 🟠 **Actions nur per Tag gepinnt** (`.github/workflows/ci.yml:22-23`, `:56-57`, `release.yml:16-17`, `:57`) `@v7`/`@v4` sind verschiebbar; der Release-Job hat Schreibrechte. Auf Commit-SHA mit Versionskommentar pinnen, Dependabot aktualisiert beides. (S)
450. **R7-450** 🟠 **`npm ci` führt Install-Skripte aus** (`.github/workflows/ci.yml:40`, `release.yml:42`) jsdom und Abhängigkeiten dürfen `postinstall` laufen lassen, im Release mit Schreib-Token. `--ignore-scripts` ergänzen. (S)
451. **R7-451** 🟠 **Kein Dependency-Review für PRs** (`.github/workflows/ci.yml:4`) Dependabot-PRs für `tests/package-lock.json` werden ohne Prüfung auf bekannte Lücken oder Lizenzen gemergt. `actions/dependency-review-action` im PR-Lauf. (S)
452. **R7-452** 🟠 **Wöchentlicher Lauf prüft nur Links** (`.github/workflows/ci.yml:15`, `:52`) Zeitabhängige Fehler (security.txt `Expires`, Datenalter, ablaufende Fremdlinks) fallen ohne Push nicht auf. Im Schedule auch Tests und `check:data` laufen lassen. (S)
453. **R7-453** 🟢 **Concurrency bricht auch `main`-Läufe ab** (`.github/workflows/ci.yml:9-11`) Zwei schnelle Merges canceln den ersten Lauf, dessen Status fehlt dann. `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. (S)
454. **R7-454** 🟢 **CI läuft für reine Ideen-Dateien** (`.github/workflows/ci.yml:2-4`; IDEEN*.md zusammen ca. 295 KB) `paths-ignore: ['IDEEN*.md', 'LUMINA-PROMPTS.md']`, aber nicht für Doku mit Linkprüfung. (S)
455. **R7-455** 🟢 **Node 26 fehlt in der Matrix** (`.github/workflows/ci.yml:20`, `.nvmrc:1` = 22) Lokal läuft Node 26.13, Node 22 endet im April 2027. Matrix `[22, 26]`, `.nvmrc` auf 24 oder 26. (S)
456. **R7-456** 🟢 **ZIP in jedem Matrix-Bein gebaut** (`.github/workflows/ci.yml:45-48`) Zweimal dasselbe; nur in einem Bein bauen und als Artefakt hochladen. (S)
457. **R7-457** 🟢 **Keine Testabdeckung in CI** (`.github/workflows/ci.yml:44`) `node --test --experimental-test-coverage` mit Mindestwert (heute 94 % Zeilen ohne DOM-Tests) und Ausgabe im Job-Summary. (S)
458. **R7-458** 🟢 **Fehler ohne Annotation** (`.github/workflows/ci.yml:44`) Testfehler stehen nur im Log. `--test-reporter=spec --test-reporter-destination=stdout` plus JUnit-Datei, oder einen GitHub-Reporter, damit Fehler an der Zeile im PR erscheinen. (S)
459. **R7-459** 🟢 **Job-Summary ohne Größen** (`.github/scripts/check-size.mjs:24`) Größen (app.js, Daten Brotli, ZIP) nach `$GITHUB_STEP_SUMMARY` schreiben; Wachstum je PR wird sichtbar. (S)
460. **R7-460** 🟢 **Dependabot ohne Abkühlzeit** (`.github/dependabot.yml:5`, `:9`) Frisch veröffentlichte, evtl. kompromittierte Versionen kommen sofort. `cooldown: { default-days: 7 }`. (S)
461. **R7-461** 🟢 **Keine CODEOWNERS** (`.github/`) Für `.github/workflows/`, `shared/`, `web/data/` Pflicht-Review durch die Inhaberin bzw. den Inhaber festlegen (wirkt mit Ruleset). (S)

### Release (release.yml, build-plugin-zip.sh, deploy.sh)

462. **R7-462** 🟠 **Schreibrechte für den ganzen Job** (`.github/workflows/release.yml:7-10`) `contents: write`, `id-token`, `attestations` gelten auch für `npm ci` und Tests. Zwei Jobs: `build` (nur lesen, Artefakt) und `publish` (Schreibrechte, nur Attest + `gh release`). (M)
463. **R7-463** 🟠 **Release sofort öffentlich** (`.github/workflows/release.yml:65`) `gh release create` ohne `--draft`; ein Fehltag veröffentlicht. Als Entwurf anlegen und von Hand freigeben, oder `environment: release` mit Freigabe. (S)
464. **R7-464** 🟠 **Website-ZIP vom ungetaggten `main` trägt dieselbe Version** (`extension/manifest.json:4` = 0.5.0, Tag fehlt; `scripts/build-plugin-zip.sh:19`) Seit 0.5.0 kamen Foto-Karten und Luxus ins Plugin, Nutzer und Fehlerberichte zeigen weiter 0.5.0. Beim Bau `version_name` mit Commit-Kurz-SHA setzen. (S)
465. **R7-465** 🟢 **Prüfsumme doppelt erzeugt** (`.github/workflows/release.yml:55`, `scripts/build-plugin-zip.sh:22-23`) Das Skript schreibt `$ABS.sha256` schon; die Release-Zeile überschreibt sie. Zeile 55 streichen. (S)
466. **R7-466** 🟢 **Keine Concurrency im Release** (`.github/workflows/release.yml:1-11`) Zwei Tags kurz nacheinander laufen parallel. `concurrency: release` ohne Abbruch. (S)
467. **R7-467** 🟢 **`deploy.sh` prüft nicht die CI des Commits** (`scripts/deploy.sh:17-19`) Lokal fehlen oft die DOM-Tests (heute 24 übersprungen), CI ist rot. Vor dem Deploy `gh run list --commit $(git rev-parse HEAD)` auf Erfolg prüfen. (S)
468. **R7-468** 🟢 **ZIP im Release doppelt gebaut** (`.github/workflows/release.yml:48`, `:53`) `npm run check` baut `web/staymatch-plugin.zip`, danach erneut das Release-ZIP. `check:zip` mit Pfadargument nutzen und nur einmal bauen. (S)

### Repo-Einstellungen und Vorlagen

469. **R7-469** 🟠 **Secret-Scanning, Push-Schutz und Dependabot-Sicherheitsupdates aus** (`gh api repos/...` `security_and_analysis`: alle `disabled`) Für öffentliche Repos kostenlos. Einschalten; Vercel- oder Render-Keys in Commits würden sonst nicht gestoppt. (S)
470. **R7-470** 🟠 **Labels der Vorlagen gibt es nicht** (`.github/ISSUE_TEMPLATE/idee.yml:3`, `plugin-erkennt-seite-nicht.yml:3`) `idee` und `plugin` fehlen in der Label-Liste, Issues landen ohne Label. Labels anlegen oder auf `enhancement` umstellen. (S)
471. **R7-471** 🟠 **„Fehler melden“ ohne Vorlage** (`extension/content-common.js:11`, `extension/content-search.js:100`, `.github/ISSUE_TEMPLATE/config.yml:1`) 🔍 Bei `blank_issues_enabled: false` geht `issues/new?title=&body=` vermutlich auf die Auswahl, der Bericht ist weg. Auf `?template=plugin-erkennt-seite-nicht.yml&version=…&console=…` (Feld-IDs) umstellen und prüfen. (S)
472. **R7-472** 🟢 **Repo-Homepage zeigt alte Adresse** (`gh api repos/...` `homepage: staymatch-tau.vercel.app`) In den Repo-Einstellungen auf `https://staymatch.pro` setzen. (S)
473. **R7-473** 🟢 **Ideen-Nummern kollidieren** (`IDEEN.md`, `IDEEN-runde4…6.md`, `IDEEN-startseite.md`) Nummern wie 589 oder 595 gibt es mehrfach, Runde 6 nutzt `R6-`. CONTRIBUTING.md:26 verlangt „Nummern aus IDEEN.md“. Einheitliches Präfix je Datei (`I-`, `R4-`, `R5-`, `S-`) festlegen. (S)

### Geteilter Code: Drift außerhalb von shared/

474. **R7-474** 🟠 **Zeilen-Dekodierung und Viertel-Erkennung doppelt** (`web/app.js:306` = `scripts/build-city-pages.mjs:33`; `web/app.js:428` = `build-city-pages.mjs:38`) Der Platz-Fehler oben steckt in beiden Kopien. `rowsToTags` und `areasFromRows` nach `shared/core.js`, beide Stellen nutzen sie. (S)
475. **R7-475** 🟢 **Radius-Regel doppelt** (`web/app.js:335` = `scripts/build-city-pages.mjs:42`) „≥ 60 ÖPNV-Orte → 1200 m“ steht zweimal. Als `C.autoRadius(pois)` teilen. (S)
476. **R7-476** 🟢 **App baut eigene Nominatim-URL** (`web/app.js:246` vs. `shared/core.js:85-87`) `nominatimUrl` nutzt nur noch das Prefetch-Skript. Parameter `limit` ergänzen und in der App verwenden. (S)
477. **R7-477** 🟢 **`i18n.js` auch in `web/` totes Gepäck** (`web/i18n.js`, von keiner HTML-Datei geladen; ergänzt R6-152) 970 Byte werden ausgeliefert, `DICT.de` ist leer (`shared/i18n.js:6-8`). Bis zur Nutzung aus `TARGETS` für web nehmen (`scripts/sync-core.mjs:8`). (S)
478. **R7-478** 🟢 **Kopfzeile verschiebt Zeilennummern** (`scripts/sync-core.mjs:14`) Coverage und Stacktraces zeigen für `extension/core.js` andere Zeilen als für `shared/core.js` (z. B. 70-100 statt 69-99). Kopfzeile ans Dateiende oder in dieselbe Zeile wie den ersten Kommentar. (S)
479. **R7-479** 🟢 **`check-size` fast am Anschlag** (`.github/scripts/check-size.mjs:4`; `web/app.js` 59.167 von 60.000 Byte = 98,6 %) Die nächste Funktion bricht die CI. Vorher entscheiden: app.js teilen (z. B. Daten-Laden nach `data.js`) oder Grenze mit Begründung anheben. (S)

### Doku und Widersprüche

480. **R7-480** 🟠 **Panel lädt Airbnb-Bilder, Texte sagen „keine Anfragen“** (`extension/content-search.js:149` vs. `STORE.md:23`, `:26`, `PRIVACY.md:10`) Seit #44 lädt das Panel Fotos vom Airbnb-CDN, auch für gesammelte Seiten. STORE.md sagt „keine Anfragen an Airbnb oder Dritte“, PRIVACY.md nennt nur das Popup. Beide Texte anpassen (Bilder kommen vom Airbnb-CDN, ohne Referrer), sonst Risiko bei der Store-Prüfung. (S)
481. **R7-481** 🟠 **Datenschutz verschweigt vier Speicher-Schlüssel** (`web/app.js:211-224` `sm_groups`, `:464` `sm_fav`, `:29` `sm_fair`, `:61` `sm_form` vs. `PRIVACY.md:24`, `web/datenschutz.html:40`) Gespeicherte Gruppen mit Namen (bis 8), Favoriten, Fairness-Regler und Formular fehlen. Ergänzen; Gruppennamen sind personenbezogen. (S)
482. **R7-482** 🟠 **CHANGELOG fehlen drei PRs** (`CHANGELOG.md:5-18`) Nicht erwähnt: EN-Startseite `/en` (#36), Weiß als Standard und Lade-Karte mit Countdown (#41), Foto-Karten im Panel (#44), dazu jsdom 31 und attest v4. Nachtragen, bevor 0.6.0 getaggt wird. (S)
483. **R7-483** 🟢 **KONZEPT nennt 6 Reisetypen, es gibt 9** (`KONZEPT.md:12` vs. `shared/core.js:19-29`) Shopping, Sport, Kultur fehlen. (S)
484. **R7-484** 🟢 **KONZEPT nennt alte Kategorien** (`KONZEPT.md:14` vs. `shared/core.js:7-16`) Einkaufen, Sport, Kinder fehlen in der Aufzählung. (S)
485. **R7-485** 🟢 **KONZEPT: 60 % fest, in der App ein Regler** (`KONZEPT.md:15` vs. `web/app.html:288`, `web/app.js:189`) „Standardmäßig 60 %, einstellbar“ schreiben. (S)
486. **R7-486** 🟢 **KONZEPT: nur JSON-Export** (`KONZEPT.md:28` vs. `extension/popup.js:111`, `:119`) CSV-Export und JSON-Import fehlen. (S)
487. **R7-487** 🟢 **KONZEPT: Zwischenspeicher, aber keine Vorabdaten** (`KONZEPT.md:46`) Für zehn Städte entfällt die Wartezeit ganz (`web/data/`). Satz ergänzen, sonst wirkt die Grenze größer als sie ist. (S)
488. **R7-488** 🟢 **Datenauffrischung nirgends beschrieben** (`CONTRIBUTING.md:31-34`, `README.md:47`) Ablauf fehlt: Prefetch → `build-city-pages.mjs` → Sitemap prüfen → `npm test` → PR mit Änderungsbericht, Rücksicht auf Overpass (eine Stadt, Pausen). Abschnitt „Städtedaten aktualisieren“ in CONTRIBUTING. (S)
489. **R7-489** 🟢 **PR-Checkliste in CONTRIBUTING ohne `npm run check`** (`CONTRIBUTING.md:64` vs. `:11`, `.github/pull_request_template.md:6`) Drei Stellen nennen drei verschiedene Befehlsfolgen. Auf `npm test && npm run check` vereinheitlichen. (S)
490. **R7-490** 🟢 **README DE und EN ungleich** (`README.de.md:19` vs. `README.md:23`) Nur DE nennt das Impressum als Platzhalter und LUMINA-PROMPTS. Abgleichen, am besten beide ohne Hero-Satz (vgl. R6-347). (S)
491. **R7-491** 🟢 **README-Badge zeigt rote CI** (`README.md:5`) Seit 12.11. sehen Besucher „failing“. Erst CI reparieren (siehe Tests), dann Ruleset, damit das nicht wiederkommt. (S)
492. **R7-492** 🟢 **security.txt: `Canonical` auf alter Domain** (`web/.well-known/security.txt:4`) Ausgeliefert unter staymatch.pro, `Canonical` zeigt auf staymatch-tau; RFC 9116 verlangt die tatsächliche Adresse. Auf `https://staymatch.pro/.well-known/security.txt` ändern. (S)
493. **R7-493** 🟢 **SECURITY.md: Berechtigungen zu knapp** (`SECURITY.md:18`) „nur `storage`“ verschweigt Host-Zugriff auf 24 Airbnb-Domains und die StayMatch-Seite (`extension/manifest.json` content_scripts). Wie PRIVACY.md:12 formulieren. (S)
494. **R7-494** 🟢 **KONZEPT-Roadmap: Regler je Person** (`KONZEPT.md:56`, `web/scoring.js:321` `cleanWeights`, `weightsOf`) 🔍 Eigene Gewichte je Person scheinen umgesetzt (R6-211 spricht von „Personen mit eigenen Reglern“). Prüfen und Roadmap-Punkt abhaken oder präzisieren. (S)
495. **R7-495** 🟢 **THIRD_PARTY ohne Hinweis auf Lizenzdateien** (`THIRD_PARTY.md:13`, `web/vendor/leaflet/LICENSE`, `web/fonts/OFL.txt`) „liegen bei den Dateien bzw. Projekten“ ist vage. Pfade der beiden Lizenzdateien nennen. (S)

## Neue Features für Nutzer

Alle Ideen gegen Runde 1 bis 6 abgeglichen. Prinzip: lokal, ohne Konto, ehrlich. Wo eine Idee Netz, Dritte oder Modell-Downloads braucht, steht „Konflikt:“ dabei.

### Preis-Tricks und Gebühren

496. **R7-496** 💡 **Fixkosten-Anteil bei Kurztrips** Bei 1 bis 2 Nächten zeigt das Panel, wie viel Prozent des Gesamtpreises Reinigung und Servicegebühr ausmachen, und hebt Inserate mit kleiner Fixgebühr hervor. Anteil aus Gesamtpreis minus Nächte × Nachtpreis in `normalizePrices` (rank.js). (M)
497. **R7-497** 💡 **Lockpreis-Warnung** Nachtpreis unter dem Seitenmedian, Gesamtpreis darüber: Plakette „Nacht billig, gesamt teuer“. Vergleich beider Werte je Karte in `scoreListing`. (S)
498. **R7-498** 💡 **Gebühren-Filterchip** Chip „niedrige Gebühren“ blendet Inserate mit über 25 % Fixkosten-Anteil aus. Neuer Eintrag in `FILTERS` (content-search.js). (S)
499. **R7-499** 💡 **Rabattschwelle 7 und 28 Nächte** Bei 5 bis 6 Nächten Hinweis „ab 7 Nächten geben viele Gastgeber Wochenrabatt, prüfe eine Nacht mehr“, bei 25 bis 27 Nächten dasselbe für Monatsrabatt. Nächte aus `searchParams` (parse.js). (S)
500. **R7-500** 💡 **Rabatt-Ehrlichkeitscheck** Zeigt ein Inserat einen durchgestrichenen Preis, vergleicht StayMatch mit dem Preis, den du dort früher gesehen hast: „der Normalpreis war letzte Woche schon so niedrig“. Verlauf plus `mergePool` (pool.js). (M)
501. **R7-501** 💡 **Last-Minute-Rabatt erklären** Erkennt das Plugin Airbnbs Hinweis auf Last-Minute- oder Frühbucher-Rabatt, sagt es, ab wann der Rabatt gilt und dass er bei Datumsänderung verschwinden kann. Badge-Text in `fromState` (parse.js). (S)
502. **R7-502** 💡 **Budget-Hebel** „Mit 10 € mehr pro Nacht kämen 4 Superhosts dazu“: zweiter Lauf von `rankListings` mit Budget +10 % und Anzeige, was sich gewinnen ließe. (S)
503. **R7-503** 💡 **Was kostet ein Stern mehr?** Einfache Regression Preis gegen Bayes-Sterne über alle Karten der Seite: „0,1 Sterne mehr kosten hier im Schnitt 9 €“. Rein lokal mit `ratingScore`. (M)
504. **R7-504** 💡 **Günstiger Zwilling** Zu jedem Top-3-Eintrag das billigste Inserat mit höchstens 3 Punkten Abstand: „fast gleich gut, 24 € günstiger“. Nachlauf über die Rangliste aus `rankListings`. (S)
505. **R7-505** 💡 **Gesamtpreis-Schalter erkennen** Ist Airbnbs Anzeige „Gesamtpreis“ aus, erklärt das Panel, dass Gebühren fehlen, und bittet um Einschalten, statt still mit Nachtpreisen zu rechnen. Erkennung über `priceOf` (parse.js). (S)
506. **R7-506** 💡 **Verschiebe-Links** Das Panel bietet dieselbe Suche als Links mit Anreise ±1 Tag an; du öffnest sie selbst, der Pool vergleicht danach die Medianpreise. Kein Hintergrundabruf, Links aus `searchParams`. (S)
507. **R7-507** 💡 **Wochenend-Aufschlag sichtbar** Hast du eine Stadt mit Fr bis So und mit So bis Di gesucht, zeigt StayMatch „Wochenende kostet hier +31 %“. Nur aus eigenen Suchen, Schlüssel `poolKey` (pool.js). (M)
508. **R7-508** 💡 **Preisanker im Kopf** Panel-Kopf zeigt Median, günstigstes Zehntel und teuerstes Zehntel der Seite in einer Zeile, damit der erste Preis nicht zum Maßstab wird. Aus `normalizePrices`. (S)
509. **R7-509** 💡 **Kaution sichtbar machen** Beträge nach „Kaution“, „Sicherheitsleistung“, „security deposit“ auf der Unterkunftsseite lesen und getrennt vom Preis zeigen. Neue Regel neben `houseRules` (parse.js). (S)
510. **R7-510** 💡 **Zusatzgast-Gebühr** Text wie „ab 3 Gästen 20 € pro Person und Nacht“ erkennen und für die echte Gästezahl einrechnen. Ergänzung in `roomData` (content-listing.js). (M)
511. **R7-511** 💡 **Vor-Ort-Kosten** „Strom nach Verbrauch“, „Kurtaxe bar“, „Endreinigung vor Ort“ als eigene Zeile „kommt noch dazu“. Regex neben `touristTax` (parse.js). (S)
512. **R7-512** 💡 **Bettwäsche inklusive?** Steht „Bettwäsche und Handtücher gegen Gebühr“ im Text (häufig bei Ferienwohnungen im DACH-Raum), zeigt StayMatch einen Aufpreis-Hinweis (Regex in `roomData`). (S)
513. **R7-513** 💡 **Putzliste plus Reinigungsgebühr** Hohe Reinigungsgebühr und zugleich lange Check-out-Pflichten (Spülmaschine, Wäsche, Müll): Hinweis „du zahlst fürs Putzen und putzt trotzdem“. `houseRules` plus Gebührenanteil. (S)
514. **R7-514** 💡 **Preis pro Schlafplatz** Für Gruppen zusätzlich „€ pro echtem Bett“, Schlafsofa zählt halb, damit 6 Personen auf 3 Betten nicht billig wirken. `BED_KINDS` (parse.js) und `bedScore` (rank.js). (S)
515. **R7-515** 💡 **Budget-Rest** „Du nutzt 82 % deines Budgets, 140 € pro Person bleiben für Essen“. Aus `effectiveBudget` und `tripTotal` (rank.js). (S)
516. **R7-516** 💡 **Storno-Preis-Abwägung** Bei zwei fast gleichen Inseraten: „8 € mehr für Absage bis 5 Tage vorher“. `cancellation` (parse.js) plus Rangvergleich. (S)
517. **R7-517** 💡 **Preisanzeige-Wechsel zwischen Seiten** Zeigt Airbnb auf Seite 1 Gesamtpreise und auf Seite 3 Nachtpreise, warnt das Panel vor schiefem Vergleich im Pool. Prüfung in `mergeSearchResults` (parse.js). (S)
518. **R7-518** 💡 **Nachschau-Erinnerung statt Preisalarm** Lokale Erinnerung (`chrome.alarms`) „schau morgen nochmal bei Wohnung X“, du öffnest selbst, der Verlauf vergleicht. Kein Hintergrundabruf, nur neue Berechtigung `alarms`. (S)

### Bewertungs-Analyse (Text-Signale)

519. **R7-519** 💡 **Teilbewertungen nutzen** Airbnbs Einzelnoten (Sauberkeit, Lage, Kommunikation, Check-in) lesen; Wunsch „sauber“ fällt bei Sauberkeit unter 4,6 durch. Neue Felder in `roomData`, Anschluss an `reviewConflicts` (rank.js). (M)
520. **R7-520** 💡 **Saisonpassende Bewertungen** Bewertungen aus deinem Reisemonat stärker zeigen: im Januar „kalt“ und „Heizung“, im August „heiß“. Datum je Bewertung wie in `weightedRecentRating`. (S)
521. **R7-521** 💡 **Wiederkehrer-Signal** „zum dritten Mal hier“, „kommen wieder“ zählen und als „3 Gäste kamen wieder“ zeigen, ein schwer fälschbares Lob (Muster in `hints.js`). (S)
522. **R7-522** 💡 **Gastgeber reagiert auf Kritik** Wie viele kritische Bewertungen haben eine Antwort, und klingt sie lösungsorientiert („behoben“, „ersetzt“)? Zählung in `hints.js`. (M)
523. **R7-523** 💡 **Problemlöser-Signal** „Gastgeber hat sofort reagiert“, „innerhalb einer Stunde repariert“ als Plus, wichtig bei Wohnungen mit kleinen Mängeln. `hints.js`. (S)
524. **R7-524** 💡 **Stichwort-Trend** Letzte 10 Bewertungen gegen ältere je Stichwort: „‚sauber‘ früher oft, zuletzt selten“. Ergänzt den Zahlentrend aus `weightedRecentRating` um Text. (M)
525. **R7-525** 💡 **Beschreibung gegen Bewertungen** Verspricht die Beschreibung „ruhig“ oder „schnelles WLAN“ und Gäste schreiben das Gegenteil: Zeile „Inserat sagt X, Gäste sagen Y“. Abgleich Beschreibung mit `hints.js`. (M)
526. **R7-526** 💡 **Sterne-Text-Widerspruch** 5 Sterne, aber der Text nennt Mängel: als „Höflichkeits-Bewertung“ zählen und im Schnitt leicht abwerten. Abgleich je Bewertung, Anschluss `effectiveRating`. (M)
527. **R7-527** 💡 **Einzelner Ausreißer** Eine sehr schlechte unter 80 guten Bewertungen als „Einzelfall“ kennzeichnen, damit sie nicht wie ein Muster wirkt. Zählung in `hints.js`. (S)
528. **R7-528** 💡 **Bett-Qualität** „Matratze durchgelegen“, „Schlafsofa hart“ als eigene Kategorie mit Verneinungslogik. `hints.js`. (S)
529. **R7-529** 💡 **Warmwasser und Dusche** „kein warmes Wasser“, „Boiler zu klein“, „Wasserdruck“ als Kategorie, wichtig bei Gruppen mit einem Boiler. `hints.js`. (S)
530. **R7-530** 💡 **Geruch und Feuchtigkeit** „Schimmel“, „muffig“, „feucht“, „Rauchgeruch“ mit hohem Gewicht, weil Fotos das nie zeigen. `hints.js`. (S)
531. **R7-531** 💡 **Nachbarn-Ärger** „Nachbarn beschwerten sich“, „Hausverwaltung kam“ als Warnung für Gruppen. `hints.js`. (S)
532. **R7-532** 💡 **Lärm-Zeitfenster** Uhrzeiten aus Bewertungen sammeln („ab 2 Uhr laut“, „um 6 Müllabfuhr“) und als „laut meist nachts“ oder „morgens“ zeigen. `hints.js`. (S)
533. **R7-533** 💡 **Konkrete Zahlen zitieren** „10 Minuten zur Metro“, „3. Stock ohne Aufzug“ als kurze Faktenzitate im Panel. Regex Zahl plus Einheit in `hints.js`. (M)
534. **R7-534** 💡 **Renovierung entwertet alte Kritik** „neu renoviert“, „neue Matratzen“ in jüngsten Bewertungen: ältere Warnungen zu diesem Thema abschwächen. `hints.js` plus Datum. (M)
535. **R7-535** 💡 **Gästemix** Grob zählen, wer dort war (Paare, Familien, Dienstreisen, Freunde), und mit deiner Reiseart vergleichen: „meist Paare, ihr seid 6 Freunde“. `hints.js`. (M)
536. **R7-536** 💡 **Bewertungsdichte** Bewertungen pro Monat seit Start: sehr viele heißt beliebt und viel Verschleiß, eine Lücke von 8 Monaten heißt Pause oder Problem. Daten aus `roomData`. (S)
537. **R7-537** 💡 **Sprachvielfalt als Echtheitszeichen** Bewertungen in vielen Sprachen sprechen für echte internationale Gäste; nur eine Sprache plus kurze Texte verstärkt `fakeReviewHint` (rank.js). (S)
538. **R7-538** 💡 **Kritik-Quote statt Schnitt** „4 von 50 Bewertungen kritisch“ neben den Sternen, weil 4,8 sehr Verschiedenes bedeuten kann. Zählung je Bewertung. (S)
539. **R7-539** 💡 **Sterne relativ zur Seite** „4,7 ist auf dieser Seite unterdurchschnittlich, Median 4,85“, weil Airbnb-Sterne fast alle hoch sind. Aus allen Karten der Seite. (S)
540. **R7-540** 💡 **Plakette verloren** War ein Inserat beim letzten Besuch Superhost oder Gäste-Favorit und ist es nicht mehr: „Plakette weg seit 12.10.“. Vergleich gespeicherter `badges` in `saveListing` (content-common.js). (S)

### Sicherheit und Betrugswarnung

541. **R7-541** 💡 **Storno durch Gastgeber** Airbnb setzt automatische Einträge „Der Gastgeber hat 3 Tage vor Ankunft storniert“ in die Bewertungen; StayMatch zählt sie und warnt deutlich (`hints.js`). (S)
542. **R7-542** 💡 **Neustart nach schlechten Bewertungen** Taucht ein Inserat mit gleichem Titel oder Hauptbild wie ein früher gesehenes, schlecht bewertetes auf, nun mit 0 Bewertungen: Hinweis „neu eingestellt?“. Abgleich mit dem Verlauf aus `getListing`. (M)
543. **R7-543** 💡 **Link-Echtheit prüfen** Im Popup einen Link einfügen; StayMatch prüft lokal gegen `AIRBNB_DOMAINS` (core.js) und warnt bei Nachbauten wie „airbnb-secure-pay.com“. (S)
544. **R7-544** 💡 **Kopier-Warnung bei Kontaktdaten** Markierst du im Inserat eine Telefonnummer oder Mailadresse, kommt „buche und zahle nur über die Plattform“. `copy`-Ereignis im Content-Script, Anschluss `scamSignals` (parse.js). (S)
545. **R7-545** 💡 **Rauchmelder, CO-Melder, Feuerlöscher** Fehlen sie in der Ausstattung, Zeile „kein Rauchmelder angegeben“. Neue Einträge in `AMENITIES` (parse.js). (S)
546. **R7-546** 💡 **Kamera- und Geräuschmesser-Hinweis** Airbnb verlangt Angaben zu Außenkameras und Lärmsensoren; StayMatch zeigt sie sichtbar im Panel, für Typ Party als Warnung. Abschnitt „Sicherheit“ in `roomData`. (S)
547. **R7-547** 💡 **Identität bestätigt** Hinweis „Identität des Gastgebers nicht bestätigt“ aus der Gastgeber-Box. `hostInfo` (parse.js). (S)
548. **R7-548** 💡 **Neues Konto, viele Inserate** Gastgeber seit 2 Monaten, aber 15 Inserate: Hinweis auf Agentur oder Fake. Felder aus `hostInfo`. (S)
549. **R7-549** 💡 **Gastgeber-Bilanz für neue Inserate** Neues Inserat ohne Bewertungen, aber Gastgeber mit 900 Bewertungen und 4,9 insgesamt: „neu, Gastgeber erfahren“ statt Risiko (`hostInfo` plus `ratingScore`). (S)
550. **R7-550** 💡 **Lage-Behauptungen nachrechnen** Titel sagt „am Strand“ oder „5 Min. zur Metro“, die Koordinate liegt 3 km entfernt: „Lageangabe prüfen“. Viertel- und Stationsdaten über `bridge.js` (sync). (M)
551. **R7-551** 💡 **Sicherheitsgefühl aus Bewertungen** „nachts sicher“, „dunkler Hinterhof“ als eigene Kategorie, getrennt nach Lage und Wohnung. `hints.js`. (S)
552. **R7-552** 💡 **Was tun bei Verdacht?** Jede Betrugswarnung verlinkt auf eine kurze statische Seite auf staymatch.pro mit Schritten (melden, nicht überweisen). Kein Tracking. (S)
553. **R7-553** 💡 **Ungenaue Karte ehrlich sagen** Airbnb zeigt die Lage nur ungefähr; Panel-Hinweis „Lage ±500 m, Viertelwert unscharf“, wenn die Koordinate nahe einer Viertelgrenze liegt. `areaFor` (rank.js). (S)

### Gruppenreisen

554. **R7-554** 💡 **Fairness-Konto über Reisen** StayMatch merkt lokal, wer bei der letzten Reise am wenigsten zufrieden war, und schlägt vor, diese Person diesmal stärker zu gewichten. Abschaltbar, Anschluss `groupScore` (scoring.js). (M)
555. **R7-555** 💡 **Merkliste der Freunde einlesen** Kopierten Merklisten-Text eines Freundes ins Popup einfügen; auf der Suchseite steht dann „Lena mag das“ an den Karten. Links aus dem Format von `shareText` (rank.js) lesen. (M)
556. **R7-556** 💡 **Suchergebnisse zusammenlegen** Zwei Freunde suchen getrennt (Stadtteil A und B) und tauschen den Pool als Datei; das Plugin rankt beide zusammen. Import in `mergePool` (pool.js). (M)
557. **R7-557** 💡 **Durchgangszimmer** „Zugang über ein Schlafzimmer“, „offener Schlafbereich“ als Hinweis für Gruppen ohne Paare. Regex in `roomData`. (S)
558. **R7-558** 💡 **Esstisch für alle** „Esstisch für 8“ oder Sitzplätze aus Beschreibung lesen und mit der Gästezahl vergleichen. `roomData`. (S)
559. **R7-559** 💡 **Teilnehmer-Änderung** Absage oder Plus-Eins: Knopf ±1 im Panel rechnet Betten, Preis pro Kopf und Top 3 sofort neu. `resolvePeople` (rank.js). (S)
560. **R7-560** 💡 **Bett teilen?** Schalter „jede Person eigenes Bett“ für Freundesgruppen: Doppelbetten zählen dann als 1. `bedScore` (rank.js). (S)
561. **R7-561** 💡 **Zwei Wohnungen nebeneinander** Für große Gruppen prüfen, ob zwei kleinere Inserate auf der Seite nah beieinander (unter 200 m) zusammen günstiger sind als eine große Wohnung. Koordinaten aus `fromState`. (M)
562. **R7-562** 💡 **Vorkasse-Text** Wer bucht, streckt vor: fertiger Text „Ich zahle 1.240 €, bitte je 248 € bis Freitag, kostenlos stornierbar bis 3.5.“, Teilbeträge nach Anwesenheitsnächten. `tripTotal` und `cancellation`. (S)
563. **R7-563** 💡 **Gebucht-Status** Inserat als „gebucht“ markieren: Das Panel hört auf zu ranken, zeigt die Reise und warnt, wenn du aus Versehen weiter suchst. Feld in `saveListing`. (S)
564. **R7-564** 💡 **Raucher in der Gruppe** Rauchverbot in den Hausregeln plus Balkon oder Terrasse: „Rauchen nur draußen möglich“; ohne Außenfläche Warnung. `houseRules` plus `AMENITIES`. (S)
565. **R7-565** 💡 **Mindestalter und Besucherverbot** „Gäste ab 25“ oder „keine Besucher“ erkennen und für junge Gruppen oder Leute, die Freunde treffen, warnen. `houseRules`. (S)
566. **R7-566** 💡 **Etagen-Verteilung** „Schlafzimmer auf zwei Etagen“ oder „Zimmer im Nebengebäude“ erkennen; wichtig für Familien mit Kleinkind und Gruppen mit Großeltern. Regex in `roomData`. (S)

### Paare

567. **R7-567** 💡 **Doppelbett-Garantie** Für 2 Personen prüfen, ob es ein Doppelbett gibt und nicht nur zwei Einzelbetten, sonst Warnung „2 Einzelbetten“ (`BED_KINDS`, parse.js, und `bedScore`). (S)
568. **R7-568** 💡 **Bettbreite** „140 cm“ oder „Queensize“ lesen und bei 140 cm für zwei Erwachsene „eher schmal“ sagen. Regex in `details`. (S)
569. **R7-569** 💡 **Zwei-Paare-Check** Zwei Paare brauchen zwei Doppelbetten in zwei Räumen mit Tür; Prüfung über Schlafzimmerzahl und Bettenarten. `bedScore`. (S)
570. **R7-570** 💡 **Gastgeber wohnt nebenan** Auch bei ganzer Unterkunft: „wir wohnen im Erdgeschoss“, „Einliegerwohnung“, „gemeinsamer Eingang“ als Privatsphäre-Hinweis. `roomData`. (S)
571. **R7-571** 💡 **Badewanne** Wunsch-Chip „Badewanne“ (nicht nur Dusche) aus Ausstattung und Beschreibung, auch für Familien mit Kleinkind. Neuer Eintrag in `AMENITIES` und `WISHES` (rank.js:173). (S)
572. **R7-572** 💡 **Aussicht-Wunsch** Chip „Aussicht“ (Meerblick, Blick über die Stadt, Dachterrasse) getrennt von Luxus, weil auch einfache Wohnungen Aussicht haben. Wörter teils schon in `luxuryInfo`. (S)
573. **R7-573** 💡 **Spuren-Pause** Schalter „1 Stunde ohne Verlauf“ für Überraschungsplanung am geteilten Rechner: kein Verlauf, keine Markierung „schon gesehen“. Flag vor `saveListing`. (S)
574. **R7-574** 💡 **Paar-Geschmack mischen** JSON-Export des Partners importieren und beide 👍-Listen zu einem gemeinsamen Geschmack verbinden, ohne die eigene Liste zu überschreiben. `buildTaste` über beide Listen. (M)
575. **R7-575** 💡 **Wo ihr auseinanderliegt** Vergleich zweier Geschmacksprofile: „sie mag Altbau im Zentrum, er Neubau mit Pool“, als Gesprächsstart. Zwei `buildTaste`-Profile nebeneinander. (S)

### Familien mit Kindern

576. **R7-576** 💡 **Baby an Bord** Ein Chip prüft Kinderbett (`CRIB_RE`, parse.js:90), Hochstuhl, Babybadewanne, Spielzeug und Kinderbücher zusammen und zeigt, was fehlt. (S)
577. **R7-577** 💡 **Kindersicherheit** „Treppenschutzgitter“, „Steckdosenschutz“, „Pool ohne Zaun“, „Balkon ohne Gitter“ aus Ausstattung und Text; Warnung, wenn Kleinkinder mitreisen. (S)
578. **R7-578** 💡 **Hochbett und Leiter** „Hochbett“, „Galerie mit Leiter“, „Mezzanine“ als Hinweis: für Kleinkinder gefährlich, für Großeltern unpraktisch. Regex in `details`. (S)
579. **R7-579** 💡 **Kinder teilen Betten** Bettencheck mit Familienlogik: zwei Kinder unter 10 zählen auf einem Doppelbett, Erwachsene nicht. `bedScore` mit Kinderzahl aus `searchParams`. (S)
580. **R7-580** 💡 **„Nicht für Kinder geeignet“** Steht das in den Hausregeln, harte Warnung, sobald Kinder in der Suche sind. `houseRules` (parse.js:325). (S)
581. **R7-581** 💡 **Schulferien zu Hause** Liegt der Zeitraum in den Ferien deines Bundeslandes: „Ferienzeit, Preise höher, früh entscheiden“. Statische Ferientabelle je Jahr in `web/data`, kein Netz zur Laufzeit. (M)
582. **R7-582** 💡 **Waschmaschine ab 5 Nächten** Bei Familien und langen Aufenthalten den `washer`-Treffer aus `AMENITIES` automatisch als Wunsch zählen. (S)
583. **R7-583** 💡 **Garten oder Innenhof** Wunsch „Außenfläche zum Spielen“ für Familien aus Ausstattung und Text. `AMENITIES`. (S)
584. **R7-584** 💡 **Spielplatz neben Café** Viertel-Finder wertet Spielplatz und Café im selben Block höher (Eltern sitzen, Kinder spielen). Paarnähe zweier Kategorien in `scoreAreas` (scoring.js). (M)

### Allein reisen

585. **R7-585** 💡 **Absperrbares Zimmer** Bei Privatzimmern „Schloss an der Schlafzimmertür“ als Wunsch-Chip. `AMENITIES` und `WISHES`. (S)
586. **R7-586** 💡 **Solo-Paket** Ein Chip bündelt Self-Check-in, „sicher“ in Bewertungen, Station in der Nähe und schnelle Antwortzeit. Bündel aus vorhandenen `WISHES`. (S)
587. **R7-587** 💡 **Allein-Preis-Ehrlichkeit** Eine ganze Wohnung kostet für 1 Person fast so viel wie für 4; Panel zeigt gut bewertete Privatzimmer als Alternative: „Zimmer bei Superhost, 60 % günstiger“. Vergleich über `kind` in `rankListings`. (S)
588. **R7-588** 💡 **Anschluss erwünscht** Gegenteil von Privatsphäre: Wer Kontakt sucht, wählt „Gastgeber vor Ort“ als Plus. Wunsch in `WISHES`. (S)
589. **R7-589** 💡 **Check-in im Dunkeln** Ankunft nach Sonnenuntergang (lokal berechnet) plus Schlüsselbox: Hinweis „Foto der Box und des Eingangs vorher speichern“. (S)

### Remote-Arbeit und Geschäftsreisen

590. **R7-590** 💡 **Zeitzonen-Rechner** „Dein 9-Uhr-Termin zu Hause ist dort 15 Uhr“, lokal mit `Intl.DateTimeFormat`, inklusive Hinweis auf Zeitumstellung im Zeitraum. (S)
591. **R7-591** 💡 **Arbeitsplatz im Fotorundgang** Airbnb ordnet Fotos Räumen zu; findet StayMatch „Arbeitsbereich“ oder „Schreibtisch“, gibt es ein ✓, sonst „kein Arbeitsplatz gezeigt“. Fotodaten in `fromState`. (M)
592. **R7-592** 💡 **Videocall-Ruhe** Mit Wunsch „Arbeiten“ zählen Tageslärm-Stichworte (Baustelle, Straße) mehr als Nachtlärm. Gewichtung in `reviewConflicts`. (S)
593. **R7-593** 💡 **Helle Wohnung** „lichtdurchflutet“ gegen „dunkel“, „Souterrain“ als Stichwort für lange Arbeitstage. `hints.js`. (S)
594. **R7-594** 💡 **Echte Küche oder Kochnische** „Backofen“, „Spülmaschine“ gegen „nur Mikrowelle“, „Kochplatte“: Küche in drei Stufen statt ja oder nein. Regex in `AMENITIES`. (S)
595. **R7-595** 💡 **Ab 28 Nächten andere Regeln** Hinweis auf oft strengere Stornoregeln und mögliche Meldepflichten je Land, als statischer Text. (S)
596. **R7-596** 💡 **Beleg für Dienstreisen** Bei gewerblichem Gastgeber (`pro`) Hinweis „Rechnung mit Steuerausweis eher möglich“, als Plus wählbar. (S)
597. **R7-597** 💡 **Wunsch-Profile Arbeit und Urlaub** Ein Klick setzt WLAN, Arbeitsplatz, ruhig und Self-Check-in, ein zweiter wechselt zu Urlaub, jedes Profil mit eigenem Geschmack aus `buildTaste` (gespeichert über `setSettings`). (S)
598. **R7-598** 💡 **Steckertyp und Spannung** Land der Reise ergibt „Typ G, Adapter nötig“, aus einer kleinen Tabelle im Paket. (S)
599. **R7-599** 💡 **Bibliotheks-Wert** Viertel-Finder zählt öffentliche Bibliotheken (`amenity=library`) als ruhige, kostenlose Arbeitsorte für Remote-Arbeitende. Neuer Schlüssel in `CATEGORIES` (core.js). (S)

### Barrierefreiheit und Mobilität

600. **R7-600** 💡 **Airbnb-Barrierefreiheitsmerkmale lesen** Stufenloser Zugang, Türbreite, Duschsitz, Haltegriffe aus dem eigenen Abschnitt der Unterkunftsseite lesen und gegen einen Wunsch „stufenlos“ prüfen. `roomData` plus `WISHES`. (M)
601. **R7-601** 💡 **Erdgeschoss-Wunsch** „Erdgeschoss“, „ground floor“, „planta baja“ erkennen, sonst Stockwerk aus Text („3. Stock“) mit `AMENITIES.elevator` verbinden. (S)
602. **R7-602** 💡 **Bewertungen von Rollstuhlnutzern** Treffer wie „mit Rollstuhl“, „mit Rollator“ zeigen als Beleg, dass es wirklich geht. `hints.js`. (S)
603. **R7-603** 💡 **Assistenzhund ist kein Haustier** Mit Wunsch „Assistenzhund“ erklärt das Panel mit Link zur Airbnb-Richtlinie, dass Assistenztiere laut dieser auch bei „keine Haustiere“ erlaubt sind, statt zu warnen (Ausnahme in `reviewConflicts`). (S)
604. **R7-604** 💡 **Einfache Sprache** Schalter für kurze Sätze ohne Fachwörter wie „Gute Sterne, etwas teuer, ganze Wohnung“ als zweite Textvariante der Gründe in `scoreListing`. (M)
605. **R7-605** 💡 **Vorlesen der Top 3** Knopf liest Titel, Preis und Gründe per `speechSynthesis` vor, lokal im Browser. (S)
606. **R7-606** 💡 **Textgröße im Panel** Regler 100 bis 150 % für Panel und Plaketten, gespeichert in den Einstellungen. CSS-Variable in `CSS` (content-common.js). (S)
607. **R7-607** 💡 **Lesefreundliche Schrift** Option für eine gut lesbare Schrift bei Leseschwäche, im Paket enthalten, kein Nachladen. `CSS` (content-common.js). (S)
608. **R7-608** 💡 **Seiten-Zusammenfassung für Screenreader** Ein Satz am Panelanfang: „42 Unterkünfte, 9 im Budget, beste 91 Punkte“, einmal angesagt statt vieler Einzelmeldungen. `renderSearch`. (S)
609. **R7-609** 💡 **Kopiertext ohne Emojis** Schalter für Kopiertexte ohne Symbole, damit Screenreader im Gruppenchat nicht „Daumen hoch“ vorlesen. Option in `shareText`. (S)

### Haustiere und Allergien

610. **R7-610** 💡 **Haustiergebühr einrechnen** Gebühr für Tiere aus Beschreibung oder Preisaufschlüsselung lesen und im Endpreis zeigen. `roomData`. (S)
611. **R7-611** 💡 **Größen- und Zahlgrenze** „nur kleine Hunde“, „max. 1 Haustier“, „keine Katzen“ aus den Hausregeln gegen deine Angabe prüfen. `houseRules`. (S)
612. **R7-612** 💡 **Bewertungen mit Hund** „mit unserem Hund“ zählen: Beleg, dass Tiere dort wirklich willkommen sind. `hints.js`. (S)
613. **R7-613** 💡 **Allergie-Warnung** „Katze lebt hier“, „Gastgeber hat Hund“, „Teppichboden“, „Federbetten“ als Warnung für Allergiker, auch ohne eigene Tiere. Wunsch „tierfrei“ in `WISHES`. (S)
614. **R7-614** 💡 **Eingezäunter Garten** Für Hunde zählt „eingezäunt“ mehr als „Garten“. Regex neben `AMENITIES`. (S)
615. **R7-615** 💡 **Rauchfrei für Asthmatiker** „Rauchen erlaubt“ in Hausregeln oder „Rauchgeruch“ in Bewertungen als Warnung. `houseRules` plus `hints.js`. (S)

### Nachhaltigkeit und faire Vermietung

616. **R7-616** 💡 **Lizenznummer prüfen** Viele Städte verlangen eine Registriernummer; StayMatch zeigt die Nummer und warnt, wenn sie in einer Pflicht-Stadt fehlt. Kleine Regeltabelle je Stadt, Text aus `roomData`. (M)
617. **R7-617** 💡 **Grüne Selbstauskunft** Ökostrom, Solar, Wärmepumpe, Mülltrennung als „laut Gastgeber“ zeigen, nie als geprüft. Regex in `roomData`. (S)
618. **R7-618** 💡 **Ladestation fürs E-Auto** „Ladestation“, „EV charger“, „Wallbox“ als Wunsch-Chip. `AMENITIES`. (S)
619. **R7-619** 💡 **Fahrradkeller** „Fahrradabstellraum“, „Fahrräder inklusive“ als Chip für Radreisende. `AMENITIES`. (S)
620. **R7-620** 💡 **Größe des Vermieters** Zahl der Inserate des Gastgebers zeigen („vermietet 48 Wohnungen“), damit man bewusst privat oder Agentur wählen kann. `hostInfo` (parse.js). (S)
621. **R7-621** 💡 **Gastgeber lebt vor Ort** „Lebt in Lissabon“ aus der Gastgeber-Box zeigen, im Gegensatz zu Vermietern aus dem Ausland; neutral als Info (`hostInfo`, parse.js). (S)
622. **R7-622** 💡 **Leitungswasser trinkbar** Kleine Tabelle je Land: „Leitungswasser trinkbar, Flasche mitnehmen“ spart Plastik. Statisch im Paket. (S)

### Anreise, Auto und ÖPNV

623. **R7-623** 💡 **Umweltzone und ZTL** Liegt die Unterkunft in einer Zufahrtsbeschränkung (italienische ZTL, Umweltzone), Warnung mit Bußgeld-Hinweis. OSM `boundary=low_emission_zone` in den Stadtdaten, Abgleich über die Koordinate. (M)
624. **R7-624** 💡 **Parken kostet extra** „Parkplatz gegen Gebühr“, „Parkhaus 25 € pro Tag“ lesen und für Autofahrer in den Endpreis rechnen. Regex neben `AMENITIES.parking`. (S)
625. **R7-625** 💡 **Insel- und Fährlage** Viertel-Finder erkennt, wenn ein Viertel nur per Boot erreichbar ist (Wasser zwischen Viertel und Zentrum, Fähranleger), und sagt das. (M)
626. **R7-626** 💡 **Etappen-Viertel mit Autobahnnähe** Für Roadtrips mit Auto: Viertel mit Parkmöglichkeit und kurzer Strecke zur nächsten Anschlussstelle (`motorway_junction`). Neue Kategorie in `CATEGORIES`. (M)
627. **R7-627** 💡 **Gepäck im Auto** Bei Roadtrips „Garage“ höher werten als „Straßenparkplatz“, weil Koffer im Auto bleiben. Unterscheidung in `AMENITIES.parking`. (S)
628. **R7-628** 💡 **Ankunft am Sonntag** In Ländern mit Sonntagsruhe Hinweis bei Ankunft am Sonntag: „Läden zu, vorher einkaufen“. Aus `checkin` plus Ländertabelle. (S)

### Lärm und Schlaf

629. **R7-629** 💡 **Kirchenglocken** Kirchen im Umkreis 150 m (`amenity=place_of_worship`, Glocken-Tag wie z. B. `bells=*` prüfen) als Hinweis für Langschläfer. Feld in `FIELDS` (core.js). (S)
630. **R7-630** 💡 **Flugschneise** Liegt ein Viertel in Verlängerung einer Startbahn (`aeroway=runway`) unter 10 km, Lärmhinweis. Geometrie in `scoreAreas`. (M)
631. **R7-631** 💡 **Ruhe-Indizien in der Beschreibung** „Schlafzimmer zum Hof“, „schallisolierte Fenster“ als Plus, „Ohrstöpsel“ oder „Klimaanlage laut“ in Bewertungen als starkes Minus. `hints.js`. (S)
632. **R7-632** 💡 **Verdunkelung** „Verdunkelungsvorhänge“, „Rollläden“ als Schlaf-Wunsch, automatisch vorgeschlagen bei Reisen in den hohen Norden im Sommer. `AMENITIES`. (S)

### Wetter, Saison und Tageslicht

633. **R7-633** 💡 **Klima-Ausstattung je Reisemonat** Kleine Klimatabelle je Stadt: im Juli in Sevilla ohne Klimaanlage Warnung, im Januar in Prag ohne Heizung Hinweis. `AMENITIES.ac`/`heating` plus Anreisedatum. (M)
634. **R7-634** 💡 **Tageslicht-Rechner** Sonnenauf- und -untergang für Stadt und Daten lokal berechnet: „Oslo im Dezember: 6 Stunden Licht“. Formel ohne API, Anzeige in `renderHead` (app.js). (S)
635. **R7-635** 💡 **Außenpool-Saison** Außenpool im März: Hinweis „meist kalt oder geschlossen, Gastgeber fragen“. `AMENITIES.pool` plus Monat. (S)
636. **R7-636** 💡 **Winter-Chips** Kamin und Sauna erscheinen als Wunsch-Chips nur von Oktober bis März. Saisonabhängige Chips in `renderSearch`. (S)
637. **R7-637** 💡 **Dachwohnung im Hochsommer** „Dachgeschoss“ plus Juli oder August ohne Klimaanlage: „wird heiß“. Regex in `details`. (S)
638. **R7-638** 💡 **Strandausstattung** „Strandtücher“, „Sonnenschirm“, „Strandstühle“ als Chip für Badeorte. `AMENITIES`. (S)
639. **R7-639** 💡 **Skikeller und Skibus** Für Winterorte „Skiraum“, „Skibus vor der Tür“ als Chips, sichtbar nur in Bergregionen oder im Winter. `AMENITIES`. (S)

### Events und Preisspitzen

640. **R7-640** 💡 **Ungewöhnlich teuer erkannt** Liegt der Seitenmedian deutlich über deinen früheren Suchen in derselben Stadt: „heute 1,8× teurer als bei deiner letzten Suche, vielleicht ein Event“. Pool und Verlauf (pool.js). (M)
641. **R7-641** 💡 **Silvester und Feiertage** Um Silvester Hausregeln strenger lesen (Partyverbot, Kaution, Mindestnächte) und gesammelt zeigen. `houseRules`. (S)

### Mehrere Städte und Roadtrip

642. **R7-642** 💡 **Budget-Topf über Etappen** Gibst du in Etappe 1 weniger aus, steigt das Budget für Etappe 2 im Plugin automatisch. Mehrere Reisen mit gemeinsamem Topf, `effectiveBudget` (rank.js). (M)
643. **R7-643** 💡 **Etappen-Kopiertext** Gebuchte Etappen in Reihenfolge mit Daten, Viertel und Preis pro Kopf als ein Text für den Gruppenchat. Aus Gebucht-Status und `shareText`. (S)
644. **R7-644** 💡 **Wechselkosten bei Roadtrips** Plant ihr 3 Unterkünfte in 5 Tagen, rechnet StayMatch die Reinigungsgebühren jedes Wechsels zusammen: „Wechsel kosten euch 180 €“. (S)
645. **R7-645** 💡 **Check-out-Check-in-Kette** Für aufeinanderfolgende Etappen prüfen, ob Check-out der einen, Fahrzeit und Check-in der nächsten zusammenpassen: „11 Uhr raus, 4 h Fahrt, Check-in erst ab 16 Uhr“ (Zeiten aus `houseRules`). (S)
646. **R7-646** 💡 **Storno-Kette** Zeigt für alle Etappen, welche bis wann kostenlos stornierbar sind, damit eine geplatzte Etappe nicht die ganze Reise teuer macht (`cancellation`, parse.js). (S)

### Wiederkehrende Reisende

647. **R7-647** 💡 **Gastgeber-Gedächtnis** Inserat eines Gastgebers, dessen andere Wohnung du mit 👎 markiert hast: Hinweis; bei 👍 ein kleines Plus. Gastgeber-Kennung aus `hostInfo` speichern. (S)
648. **R7-648** 💡 **Vorjahresvergleich** „Letzten Mai hast du in Lissabon 92 € pro Nacht gezahlt, heute liegt der Median bei 118 €“. Gebucht-Status plus Verlauf. (S)
649. **R7-649** 💡 **Stammwohnung im Blick** Für Pendler: Lieblingswohnung festlegen; erscheint sie, steht sie oben, sonst „heute nicht in den Ergebnissen“. Sonderregel in `rankListings`. (S)
650. **R7-650** 💡 **Geschmack korrigieren** Popup zeigt, was StayMatch gelernt hat („Altbau, Superhost, unter 110 €“), und erlaubt, einzelne Schlüsse zu löschen. `profile` (popup.js). (S)

### Spiel und Spaß

651. **R7-651** 💡 **Rate den Preis** Spielmodus blendet Preise aus, du schätzt, StayMatch zeigt die Abweichung und schult so das Gefühl für den Markt (Ansicht in `applyBadges`). (S)
652. **R7-652** 💡 **Blindverkostung** Fotos ausblenden und nur nach Fakten ranken, dann aufdecken: Wie oft hätten die Fotos dich umgestimmt? CSS-Klasse auf den Karten. (S)
653. **R7-653** 💡 **Paarweises Duell** Zehn Runden lang zwei Inserate nebeneinander; aus deinen Entscheidungen schätzt StayMatch deine Gewichte für Preis, Sterne und Lage. Anpassung von `weightsFor` (rank.js). (M)
654. **R7-654** 💡 **Grübel-Bremse** Nach 40 angesehenen Inseraten kommt „deine Top 3 stehen seit 25 Minuten fest, fertig?“ (Zähler aus dem Verlauf). (S)
655. **R7-655** 💡 **Superlativ-Zähler** Zählt Werbewörter im Inserat („atemberaubend“, „einzigartig“, „Oase“) und zeigt den Anteil mit Augenzwinkern; viele Superlative, wenig Fakten. Regex in `roomData`. (S)
656. **R7-656** 💡 **Ausreißer-Vorschlag** Neben den Top 3 ein bewusst anderes Inserat außerhalb deines Geschmacks („mal was anderes: Hausboot, 4,9 Sterne“), gegen die eigene Filterblase. Auswahl aus `rankListings` mit niedrigem `tasteScore`. (S)
657. **R7-657** 💡 **Gesparte Klicks** Lokaler Zähler „StayMatch hat dir heute 37 Inserate erspart“, nur im Popup, nie gesendet. (S)

### Teilen und Sozial

658. **R7-658** 💡 **Markdown-Tabelle kopieren** Top 3 oder Merkliste als Markdown-Tabelle für Notion, Obsidian oder Issues. Variante in `shareText`. (S)
659. **R7-659** 💡 **Teilen ohne Preise** Kopiertext ohne Beträge, wenn andere nur Lage und Art sehen sollen. Option in `copyTop` (content-search.js). (S)
660. **R7-660** 💡 **Entscheidungsfragen im Text** Kopiertext endet mit zwei konkreten Fragen („Pool oder näher am Zentrum?“), abgeleitet aus dem größten Unterschied der Top 3 in `compareRows`. (S)
661. **R7-661** 💡 **Preisstand im Text** Kopiertext nennt „Preise Stand 13.11., 14:20, können sich ändern“, damit niemand über alte Zahlen streitet. `shareText`. (S)
662. **R7-662** 💡 **Screenshot-Modus** Ein Klick blendet alle StayMatch-Plaketten aus oder nur die Punkte ein, für saubere Screenshots im Gruppenchat. Klasse in `applyBadges`. (S)
663. **R7-663** 💡 **Offenes Merklisten-Format** Merkliste als dokumentiertes JSON-Schema, damit andere Tools und Skripte sie lesen können. Schema neben `download` (popup.js). (S)

### Ausstattung, Küche und Gastgeber

664. **R7-664** 💡 **Quadratmeter pro Person** Steht eine Fläche im Text („45 m²“), rechnet StayMatch m² pro Gast und warnt unter 10 m². Regex in `details`. (S)
665. **R7-665** 💡 **Kaffeemaschinen-Art** Nespresso, Filter, Siebträger oder nur Instant: kleiner Chip für Kaffeemenschen. Regex in `AMENITIES`. (S)
666. **R7-666** 💡 **Grundausstattung Küche** „Öl, Salz, Gewürze“, „Kaffee und Tee“ erkennen; wer selbst kocht, spart den ersten Einkauf. `AMENITIES`. (S)
667. **R7-667** 💡 **Geschirr für alle** „Geschirr für 6“ gegen die Gästezahl prüfen, typischer Ärger bei Gruppen. Regex in `roomData`. (S)
668. **R7-668** 💡 **Grill** Grill als Gruppen-Chip, im Sommer automatisch vorgeschlagen. `AMENITIES`. (S)
669. **R7-669** 💡 **Kühlschrank statt Minikühlschrank** „Minikühlschrank“ gegen „Kühlschrank“ und „Gefrierfach“ unterscheiden, für Gruppen und Selbstversorger wichtig (`AMENITIES`). (S)
670. **R7-670** 💡 **Zweiter Bildschirm** „Monitor“ in der Ausstattung als Chip für Remote-Arbeit. `AMENITIES`. (S)
671. **R7-671** 💡 **Sprachen des Gastgebers** „Spricht Deutsch, Englisch“ lesen und mit den Sprachen der Gruppe vergleichen. `hostInfo` (parse.js). (S)
672. **R7-672** 💡 **Antwortzeit gegen Anreise** Gastgeber antwortet „innerhalb eines Tages“, die Anreise ist morgen: Hinweis, Sofortbuchung bevorzugen. `hostInfo` plus `checkin`. (S)
673. **R7-673** 💡 **Regel-Dichte** Sehr lange Hausregel-Listen als Signal „strenger Gastgeber“ zeigen, neutral formuliert. Länge aus `houseRules`. (S)

### Suchseite klüger

674. **R7-674** 💡 **Wünsche aus einem Satz** „ruhige ganze Wohnung mit WLAN unter 120“ per Regex in Chips und Budget übersetzen, ohne KI. Gegenstück zu `parseGroup` (scoring.js) für Wünsche. (S)
675. **R7-675** 💡 **Weiterblättern lohnt nicht mehr** Bringt die letzte Seite kaum noch Treffer über 70 Punkte, sagt das Panel „hier aufhören, deine Top 3 sind stabil“. Auswertung im Pool (pool.js). (S)
676. **R7-676** 💡 **Kartenausschnitt-Tipp** Liegen die besten Treffer alle in einer Ecke der Karte, Vorschlag „Karte dorthin verschieben“. Koordinaten aus `fromState`. (S)
677. **R7-677** 💡 **Filter-Vorschlag per Klick** „Setze mindestens 2 Schlafzimmer, das entfernt 18 unpassende“: Link mit geändertem Suchparameter, den du selbst öffnest. `searchParams` (parse.js). (S)
678. **R7-678** 💡 **Karten-Pins färben** Airbnbs Preis-Pins auf der Karte bekommen einen farbigen Rand nach StayMatch-Wert. Anschluss an `applyBadges`, Selektoren mit Ersatz. (M)
679. **R7-679** 💡 **Robuste Empfehlung** Prüft, ob die Top 3 gleich bleiben, wenn Preis oder Sterne etwas mehr zählen, und sagt „Empfehlung stabil“ oder „knapp“. Mehrfachlauf von `rankListings` mit leicht geänderten `WEIGHTS`. (S)
680. **R7-680** 💡 **Entscheidungsnotiz automatisch** Beim Gebucht-Status speichert StayMatch die drei Hauptgründe, damit du später weißt, warum du so entschieden hast. Gründe aus `scoreListing`. (S)

### Lokale KI im Browser (Chrome Built-in AI)

Konflikt für alle Punkte dieses Abschnitts: Chrome lädt das Modell beim ersten Mal herunter (mehrere GB), es läuft nur in neueren Chrome-Versionen am Computer; ohne KI bleiben Regex und feste Texte der Rückfall.
681. **R7-681** 💡 **Bewertungen lokal übersetzen** Translator API übersetzt Bewertungs-Ausschnitte und Hausregeln im Gerät in deine Sprache. Angewendet in `roomPanel` (content-listing.js). (M)
682. **R7-682** 💡 **Sprache erkennen, dann Muster wählen** Language Detector API bestimmt die Sprache jeder Bewertung und wählt passende Muster in `hints.js`, statt nur Deutsch und Englisch. (S)
683. **R7-683** 💡 **Panel in jeder Sprache** Fehlt ein übersetzter Text im Wörterbuch, übersetzt die Translator API ihn lokal. Konflikt: Qualität schwankt, feste Übersetzungen haben Vorrang. (S)
684. **R7-684** 💡 **Kopiertext für internationale Gruppen** Kopiertext auf Wunsch lokal in die Sprache der Freunde übersetzen. `shareText` plus Translator API. (S)
685. **R7-685** 💡 **Hausregeln als Felder** Prompt API (Gemini Nano) wandelt freien Hausregel-Text in Felder (Ruhezeit, Partys, Rauchen, Besucher, Mindestalter) als Zusatz zu `houseRules`. Konflikt: Ergebnis als „KI-Vermutung“ markieren. (M)
686. **R7-686** 💡 **Frag die Beschreibung** Feld „Gibt es einen Föhn?“: Prompt API antwortet nur aus dem Seitentext und zeigt das Zitat, sonst „steht nicht drin“. Konflikt: Halluzinationsrisiko, daher Zitatpflicht. (M)
687. **R7-687** 💡 **Foto-Check lokal** Multimodale Prompt API prüft Fotos auf Schreibtisch, Badewanne, Kinderbett und meldet „auf Fotos gesehen“. Nur auf Klick, Bild bleibt im Gerät. (L)
688. **R7-688** 💡 **Alt-Texte für Fotos** Kurze Bildbeschreibungen der Top-3-Fotos für blinde Nutzer. Konflikt: als „automatisch erzeugt“ kennzeichnen. (M)
689. **R7-689** 💡 **Freitext-Interesse zu OSM-Kategorien** Viertel-Finder: „Jazzbars und Flohmarkt“ wird lokal zu Kategorien und Gewichten für `weightsOf` (scoring.js). Sonst Auswahlliste. (M)
690. **R7-690** 💡 **Widersprüchliche Bewertungen finden** Prompt API sucht Bewertungspaare, die sich widersprechen („laut“ und „ruhig“), und zeigt beide nebeneinander. Konflikt: nur als Lesehilfe, keine Punkte. (M)
691. **R7-691** 💡 **Pro und Contra zweier Inserate** Aus `compareRows` formuliert das Modell drei Pro- und Contra-Punkte in ganzen Sätzen, ohne neue Fakten. Konflikt: darf nur vorhandene Daten nutzen. (S)
692. **R7-692** 💡 **Begründung natürlich formulieren** Summarizer API macht aus den Gründen von `scoreListing` einen Satz. Konflikt: nur Umformulierung, Prüftest im Repo. (S)
693. **R7-693** 💡 **Lange Beschreibung kürzen** Summarizer API kürzt die Inseratsbeschreibung auf 3 Stichpunkte zu Lage, Betten und Regeln. Konflikt: Original bleibt einen Klick entfernt. (S)
694. **R7-694** 💡 **Notizen automatisch verschlagworten** Freie Notiz („zu weit vom Strand, Bad alt“) wird lokal zu Schlagworten für Filter im Popup. Konflikt: nur Vorschlag, du bestätigst. (S)
695. **R7-695** 💡 **Neue Warnwörter vorschlagen** Das Modell schlägt aus gelesenen Bewertungen Wörter vor, die noch nicht in `hints.js` stehen; du übernimmst sie per Klick in eine lokale Liste. (M)
696. **R7-696** 💡 **KI-Kennzeichnung als Regel** Alles aus einem Modell bekommt ein eigenes Symbol und fließt nur nach Zustimmung in die Punkte. Schalter in den Einstellungen, Regel in `scoreListing`. (S)
697. **R7-697** 💡 **Verfügbarkeit ehrlich anzeigen** Panel prüft die KI-Schnittstellen und sagt „auf diesem Gerät nicht verfügbar“ statt einer stillen Lücke. (S)
698. **R7-698** 💡 **Prompts offen im Repo** Alle Prompts als Dateien mit Tests auf Beispieltexten, damit jeder sieht, was gefragt wird. (S)
699. **R7-699** 💡 **Kleines Modell im Paket als Rückfall** Für Browser ohne eingebaute KI ein winziges Klassifikationsmodell (z. B. über Transformers.js) nur für Bewertungs-Stichworte. Konflikt: Paketgröße und Store-Prüfung. (L)

### Barrierearme Erklärungen

700. **R7-700** 💡 **Abstand zu Platz 1** Für jede Karte: „bis Platz 1 fehlen 0,1 Sterne und 12 €“. Differenz der Teilwerte aus `scoreListing`. (S)
701. **R7-701** 💡 **Glossar an Ort und Stelle** Kurze Erklärungen für „Bayes-Sterne“, „Gäste-Favorit“, „gewerblicher Gastgeber“, „Fairness-Wertung“ als Tooltip. Wörterbuch in `shared/`. (S)
702. **R7-702** 💡 **Woran StayMatch etwas erkennt** Bei jedem Wunsch-Chip steht die Quelle („Superhost: Plakette auf der Karte“, „ruhig: Bewertungstexte, die du geöffnet hast“). Text an `WISHES`. (S)
703. **R7-703** 💡 **Quellen-Symbol je Grund** Jede Begründungszeile trägt ein kleines Symbol: Suchseite, Unterkunftsseite, deine Notiz, Viertel-Finder. Feld in `scoreListing`. (S)
704. **R7-704** 💡 **Panel-Kennenlernen** Beim ersten Panel drei kurze Hinweise nacheinander (Punkte, Chips, Merken), danach nie wieder. Flag in den Einstellungen. (S)

### Weitere Plattformen und Browser

705. **R7-705** 💡 **Bookmarklet für Safari und Handy** `parse.js` und `rank.js` als Bookmarklet: läuft auf der geöffneten Seite ohne Installation, auch im mobilen Safari. Konflikt: die CSP der Seite kann Code blockieren, erst testen. (M)
706. **R7-706** 💡 **Userscript-Ausgabe** Build-Schritt erzeugt eine `.user.js` für Tampermonkey oder Violentmonkey aus demselben Code. (S)
707. **R7-707** 💡 **Seitenleiste statt Overlay** Chrome Side Panel API: das Panel sitzt in der Browser-Seitenleiste und verdeckt nichts auf der Seite. `chrome.sidePanel`. (M)
708. **R7-708** 💡 **Gleiche Wohnung, anderer Preis** Öffnest du dieselbe Wohnung auf Airbnb und Booking (Titel, Koordinate, Fotos ähnlich), stehen beide Preise nebeneinander, nur aus selbst geöffneten Seiten. Konflikt: braucht zweiten Parser. (L)
709. **R7-709** 💡 **Orion auf dem iPhone testen** Der Orion-Browser unterstützt Web-Erweiterungen; prüfen, ob StayMatch dort läuft, als Weg aufs Handy. Konflikt: Funktionsumfang unklar. (S)
710. **R7-710** 💡 **Fremde Unterkunft von Hand merken** Auf jeder Seite per Popup „Hier merken“ mit Preis von Hand, damit Ferienhaus-Seiten ohne Parser in Merkliste und Vergleich landen. Konflikt: braucht Rechte nur auf Klick (`activeTab`). (M)

### Viertel-Finder-Erweiterungen

711. **R7-711** 💡 **Montags-Falle** Viele Museen haben montags zu: Sehenswürdigkeiten nach `opening_hours` an euren Reisetagen zählen und warnen. (M)
712. **R7-712** 💡 **Sonntag-offen-Wert** Anteil Läden, Bäckereien und Supermärkte mit Sonntagsöffnung im Viertel, wichtig bei Wochenendreisen. `opening_hours` in `FIELDS` (core.js). (M)
713. **R7-713** 💡 **Wochenmarkt an euren Tagen** Märkte und Flohmärkte (`amenity=marketplace`) mit Öffnungstag im Zeitraum als Highlight: „Samstag Markt 300 m“. (S)
714. **R7-714** 💡 **Spät-Essen-Wert** Restaurants mit Küche nach 22 Uhr, für späte Ankunft oder Länder mit späten Essenszeiten. `opening_hours`. (S)
715. **R7-715** 💡 **Supermarkt-Preisniveau** Discounter (`brand=*`) gegen Feinkost als Signal für Selbstversorger mit kleinem Budget. Neue Kategorie in `CATEGORIES`. (S)
716. **R7-716** 💡 **Eigene Ortsliste importieren** GeoJSON oder KML einer gespeicherten Kartenliste laden (bleibt im Browser); Viertel nahe vieler eigener Orte steigen. Anschluss `scoreAreas` (scoring.js). (M)
717. **R7-717** 💡 **Diese Viertel passen nicht** Neben den besten die drei schlechtesten mit Grund („Raval: laut für Chill“), hilft beim Aussortieren von Inseraten. `sortAreas` umgekehrt. (S)
718. **R7-718** 💡 **Fußgängerzonen-Anteil** Anteil `highway=pedestrian` im Umkreis: ruhig und kinderfreundlich, aber schwer mit Auto. (S)
719. **R7-719** 💡 **Ufer-Wert** Fluss- oder Kanalufer mit Weg im Umkreis als Chill-Plus, getrennt vom Strand. (S)
720. **R7-720** 💡 **Plätze-Wert** Öffentliche Plätze (`place=square`) als „Wohnzimmer“ für Gruppen, die draußen sitzen wollen. (S)
721. **R7-721** 💡 **Bebauungs-Charakter** Altbau-Anteil (z. B. `start_date` an Gebäuden) und Gebäudehöhe (`building:levels`) als Zeile „vor allem Altbau, niedrig“; passt zum Geschmack „Altbau“ aus dem Plugin. (M)
722. **R7-722** 💡 **Gratis-Kultur-Wert** Museen und Sehenswürdigkeiten mit `fee=no` zählen extra für Budget-Reisende. (S)
723. **R7-723** 💡 **Uni-Viertel** Hochschulen (`amenity=university`) als Signal für günstiges Essen und junges Publikum, für Erasmus-Gruppen. (S)
724. **R7-724** 💡 **Wasserspielplatz im Sommer** Spielplätze mit Wasser (Tag z. B. `playground=splash_pad`, vor Umsetzung prüfen) zählen für Familien im Juni bis August mehr. (S)
725. **R7-725** 💡 **Gewichte nach Aufenthaltsdauer** Bei 2 Nächten zählt Zentrumsnähe mehr, bei 14 Nächten Supermarkt, Waschsalon und Ruhe. Automatische Anpassung in `weightsOf` aus `nights` (scoring.js). (M)

### Datenschutz als Funktion

726. **R7-726** 💡 **Datenauskunft auf einen Blick** Popup-Seite zeigt in Klartext alles Gespeicherte (Verlauf, Notizen, Reise, Einstellungen) als lesbare Übersicht statt Rohdaten (`load`, popup.js). (S)
727. **R7-727** 💡 **Null-Anfragen-Anleitung** Kurze Anleitung im Popup, wie man in den Entwicklerwerkzeugen selbst prüft, dass die Erweiterung keine eigenen Anfragen stellt. (S)
728. **R7-728** 💡 **Reise vergessen** Ein Knopf löscht alles zu einer Reise (Verlauf, Notizen, Pool) nach der Rückkehr, der Rest bleibt. Filter nach Reise in `load` (popup.js). (S)
729. **R7-729** 💡 **Notizen mit Passwort** Optional verschlüsselte Notizen (WebCrypto, nur lokal) für geteilte Rechner. Konflikt: Passwort vergessen heißt Notizen weg, klar sagen. (M)
730. **R7-730** 💡 **Backup-Erinnerung** Alle drei Monate fragt das Popup, ob du deine Daten als Datei sichern willst, weil nichts in einer Cloud liegt. `download` (popup.js). (S)

### Content und Wachstum

731. **R7-731** 💡 **Atom-Feed statt Newsletter** Feed für Changelog und neue Städte; abonnieren ohne Mailadresse und ohne Tracking. Build-Schritt aus `CHANGELOG.md`. (S)
732. **R7-732** 💡 **Daten-Tagebuch je Stadt** Monatlicher Beitrag „was sich in Barcelona in OSM geändert hat“ (neue Bars, geschlossene Cafés) aus dem Prefetch-Unterschied. (M)
733. **R7-733** 💡 **Stadt-Paten** Freiwillige prüfen die Daten ihrer Stadt und stehen mit Namen auf der Stadtseite. GitHub-Vorlage dafür. (S)
734. **R7-734** 💡 **Transparenz-Bericht** Vierteljährlich: Store-Nutzerzahl, Fehlerberichte, null gesammelte Daten, Spenden und Ausgaben. Statische Seite. (S)
735. **R7-735** 💡 **Fediverse statt Tracking-Kanäle** Projektkonto auf Mastodon für Neuigkeiten, ohne Werbe-Pixel. (S)
736. **R7-736** 💡 **Ehrlicher Werkzeugvergleich** Seite mit anderen Unterkunfts-Erweiterungen: was sie können und was sie laut eigener Angabe sammeln. Konflikt: fair und belegt formulieren. (S)
737. **R7-737** 💡 **Unterrichtsmaterial Fairness** Arbeitsblatt für den Matheunterricht: Maximin am Beispiel Klassenfahrt, mit Link zum Viertel-Finder. (S)
738. **R7-738** 💡 **Fallstudie mit Zahlen** Beitrag „200 Inserate in Lissabon gerankt: so viel machen Gebühren aus“, aus einer eigenen Testsuche. Konflikt: nur Summen, keine Inseratsdaten veröffentlichen. (S)
739. **R7-739** 💡 **Saison-Kalender je Stadt** Statische Seite mit bester Reisezeit aus Klimatabelle und Feiertagen, verlinkt aus den Stadtseiten. (S)
740. **R7-740** 💡 **Airbnb-Begriffe erklärt** Glossar-Seite (Gäste-Favorit, Sofortbuchung, Servicegebühr), gut auffindbar und für KI-Antworten zitierbar. (S)
741. **R7-741** 💡 **Checkliste vor der Buchung** Druckbare Seite mit 10 Fragen (Betten, Gebühren, Storno, Hausregeln), passend zu den Prüfungen des Plugins. (S)
742. **R7-742** 💡 **Stadtseiten in einfacher Sprache** Jede Stadtseite zusätzlich als Kurzfassung in einfacher Sprache. Build-Schritt in `build-city-pages.mjs`. (M)
743. **R7-743** 💡 **Selbst gehostete Kurzvideos** Anleitungsvideos direkt auf staymatch.pro statt über Videoportale mit Tracking. (S)
744. **R7-744** 💡 **Sterne-Spielplatz** Interaktive Seite: Regler für Sterne und Anzahl zeigen live, wie die Bayes-Gewichtung den Wert ändert. Nutzt `ratingScore` im Browser. (S)
745. **R7-745** 💡 **Gewichtsänderungen ankündigen** Jede Änderung an `WEIGHTS` (rank.js) erst als öffentlicher Vorschlag mit Beispielen vorher und nachher, dann im Changelog. Ehrlichkeit über die Rechnung. (S)
746. **R7-746** 💡 **Barrierefreiheitserklärung** Seite, die offen sagt, was barrierefrei ist und was nicht, mit Kontaktweg. (S)

### Monetarisierung ohne Nutzer zu verraten

747. **R7-747** 💡 **Förderprogramme beantragen** Prototype Fund oder NLnet für Open-Source-Arbeit; kein Nutzerbezug, passt zum Prinzip. (S)
748. **R7-748** 💡 **Anteil an OpenStreetMap** Ein fester Teil jeder Spende geht an die OSM Foundation, öffentlich ausgewiesen. (S)
749. **R7-749** 💡 **Spendenbitte erst nach Erfolg** Einmalig nach dem Gebucht-Status ein leiser Hinweis „StayMatch hat geholfen? Hier kannst du unterstützen“, nie wieder danach und rein lokal. (S)
750. **R7-750** 💡 **Unterstützer-Code ohne Konto** Wer spendet, bekommt einen signierten Code, der lokal ein Dankes-Design freischaltet und offline geprüft wird. (M)
751. **R7-751** 💡 **Gedrucktes Viertel-Quartett** Kartenspiel der Städte als Druckprodukt, ohne Nutzerdaten. Konflikt: ODbL-Hinweis auf jeder Karte nötig. (M)
752. **R7-752** 💡 **Workshops für Vereine** Bezahlte Kurzworkshops „Gruppenreisen fair planen“ für Vereine und Schulen, Werkzeug bleibt kostenlos. (S)
753. **R7-753** 💡 **Kernversprechen schriftlich** README und Website versprechen: Ranking bleibt kostenlos, ohne Werbung und ohne bezahlte Platzierung. (S)
754. **R7-754** 💡 **Datenpflege durch Städte** Tourismusämter finanzieren die Datenpflege ihrer Stadtseite. Konflikt: Unabhängigkeit; nur „Daten geprüft mit“, nie Einfluss auf Wertung, offen ausgewiesen. (M)
