# Runde 7 E: Status Viertel-Finder (Branch feat/r7-features-viertel)

Zählung: anderer Bereich 220, umgesetzt 26, übersprungen 4, braucht Entscheidung 9 (von 259).

Umsetzung: web/app-extra.js (neu, Anzeige), web/scoring.js (Rechnung), Brücke window.SMApp in web/app.js, Tests tests/r7-features-viertel.test.js.
Zusätzlich (nicht in der Liste, vom Auftrag genannt): Gruppen-Abstimmung per Link (♥ = Stimme, Stimmen reisen im Teilen-Link). Fix: lange Viertelnamen verbreiterten die Seite am Handy.

Größen: web/*.js zusammen ca. 148,6 von 150 KB (check-size jsTotal). Wächst core.js/i18n.js im anderen Zweig um mehr als ca. 1,4 KB, schlägt die Gesamtgrenze beim Zusammenführen an: Grenze anheben oder kürzen (Entscheidung).

| ID | Feature | Status | Grund/Notiz |
| --- | --- | --- | --- |
| R7-496 | Fixkosten-Anteil bei Kurztrips | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-497 | Lockpreis-Warnung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-498 | Gebühren-Filterchip | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-499 | Rabattschwelle 7 und 28 Nächte | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-500 | Rabatt-Ehrlichkeitscheck | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-501 | Last-Minute-Rabatt erklären | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-502 | Budget-Hebel | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-503 | Was kostet ein Stern mehr? | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-504 | Günstiger Zwilling | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-505 | Gesamtpreis-Schalter erkennen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-506 | Verschiebe-Links | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-507 | Wochenend-Aufschlag sichtbar | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-508 | Preisanker im Kopf | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-509 | Kaution sichtbar machen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-510 | Zusatzgast-Gebühr | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-511 | Vor-Ort-Kosten | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-512 | Bettwäsche inklusive? | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-513 | Putzliste plus Reinigungsgebühr | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-514 | Preis pro Schlafplatz | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-515 | Budget-Rest | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-516 | Storno-Preis-Abwägung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-517 | Preisanzeige-Wechsel zwischen Seiten | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-518 | Nachschau-Erinnerung statt Preisalarm | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-519 | Teilbewertungen nutzen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-520 | Saisonpassende Bewertungen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-521 | Wiederkehrer-Signal | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-522 | Gastgeber reagiert auf Kritik | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-523 | Problemlöser-Signal | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-524 | Stichwort-Trend | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-525 | Beschreibung gegen Bewertungen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-526 | Sterne-Text-Widerspruch | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-527 | Einzelner Ausreißer | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-528 | Bett-Qualität | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-529 | Warmwasser und Dusche | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-530 | Geruch und Feuchtigkeit | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-531 | Nachbarn-Ärger | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-532 | Lärm-Zeitfenster | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-533 | Konkrete Zahlen zitieren | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-534 | Renovierung entwertet alte Kritik | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-535 | Gästemix | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-536 | Bewertungsdichte | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-537 | Sprachvielfalt als Echtheitszeichen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-538 | Kritik-Quote statt Schnitt | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-539 | Sterne relativ zur Seite | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-540 | Plakette verloren | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-541 | Storno durch Gastgeber | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-542 | Neustart nach schlechten Bewertungen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-543 | Link-Echtheit prüfen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-544 | Kopier-Warnung bei Kontaktdaten | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-545 | Rauchmelder, CO-Melder, Feuerlöscher | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-546 | Kamera- und Geräuschmesser-Hinweis | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-547 | Identität bestätigt | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-548 | Neues Konto, viele Inserate | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-549 | Gastgeber-Bilanz für neue Inserate | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-550 | Lage-Behauptungen nachrechnen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-551 | Sicherheitsgefühl aus Bewertungen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-552 | Was tun bei Verdacht? | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-553 | Ungenaue Karte ehrlich sagen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-554 | Fairness-Konto über Reisen | umgesetzt | merkt lokal die Unzufriedenste der letzten Stadt derselben Gruppe, Knopf „stärker gewichten“, abschaltbar |
| R7-555 | Merkliste der Freunde einlesen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-556 | Suchergebnisse zusammenlegen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-557 | Durchgangszimmer | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-558 | Esstisch für alle | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-559 | Teilnehmer-Änderung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-560 | Bett teilen? | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-561 | Zwei Wohnungen nebeneinander | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-562 | Vorkasse-Text | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-563 | Gebucht-Status | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-564 | Raucher in der Gruppe | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-565 | Mindestalter und Besucherverbot | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-566 | Etagen-Verteilung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-567 | Doppelbett-Garantie | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-568 | Bettbreite | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-569 | Zwei-Paare-Check | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-570 | Gastgeber wohnt nebenan | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-571 | Badewanne | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-572 | Aussicht-Wunsch | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-573 | Spuren-Pause | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-574 | Paar-Geschmack mischen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-575 | Wo ihr auseinanderliegt | umgesetzt | Viertel-Variante: Zeilen „Lena will Party, Tom stört es“ aus den Gewichten der Gruppe |
| R7-576 | Baby an Bord | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-577 | Kindersicherheit | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-578 | Hochbett und Leiter | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-579 | Kinder teilen Betten | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-580 | „Nicht für Kinder geeignet“ | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-581 | Schulferien zu Hause | anderer Bereich | braucht statische Ferientabelle in web/data (gesperrt) |
| R7-582 | Waschmaschine ab 5 Nächten | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-583 | Garten oder Innenhof | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-584 | Spielplatz neben Café | umgesetzt | teilweise: Zeile „N Spielplätze mit Café daneben“ (bis 120 m) für Familien; fließt bewusst nicht in die Punkte |
| R7-585 | Absperrbares Zimmer | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-586 | Solo-Paket | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-587 | Allein-Preis-Ehrlichkeit | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-588 | Anschluss erwünscht | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-589 | Check-in im Dunkeln | umgesetzt | teilweise: Hinweis „früh dunkel, Ankunft im Hellen planen“ in der Tageslicht-Zeile; Ankunftszeit und Schlüsselbox kennt nur das Plugin |
| R7-590 | Zeitzonen-Rechner | übersprungen | Zeitzone der Stadt steht nicht in den Daten; aus dem Längengrad geraten wäre oft falsch |
| R7-591 | Arbeitsplatz im Fotorundgang | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-592 | Videocall-Ruhe | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-593 | Helle Wohnung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-594 | Echte Küche oder Kochnische | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-595 | Ab 28 Nächten andere Regeln | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-596 | Beleg für Dienstreisen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-597 | Wunsch-Profile Arbeit und Urlaub | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-598 | Steckertyp und Spannung | übersprungen | Land der Stadt steht nicht in den Daten (core.js/Daten anderer Bereich) |
| R7-599 | Bibliotheks-Wert | anderer Bereich | neue Kategorie in core.js CATEGORIES und neue Stadtdaten |
| R7-600 | Airbnb-Barrierefreiheitsmerkmale lesen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-601 | Erdgeschoss-Wunsch | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-602 | Bewertungen von Rollstuhlnutzern | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-603 | Assistenzhund ist kein Haustier | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-604 | Einfache Sprache | umgesetzt | Viertel-Finder: Schalter „Einfache Sprache“, kurze Sätze je Viertelkarte |
| R7-605 | Vorlesen der Top 3 | umgesetzt | Top 3 vorlesen, nur mit lokaler deutscher Stimme (sonst Hinweis, kein Text an Sprachdienste) |
| R7-606 | Textgröße im Panel | umgesetzt | Viertel-Finder: A−/A+ in der Kopfzeile (100/115/130 %), Karte bleibt unverändert; Plugin-Panel anderer Bereich |
| R7-607 | Lesefreundliche Schrift | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-608 | Seiten-Zusammenfassung für Screenreader | übersprungen | im Viertel-Finder schon vorhanden (Statuszeile mit role=status); Plugin-Panel anderer Bereich |
| R7-609 | Kopiertext ohne Emojis | umgesetzt | Viertel-Kopiertext und Etappen-Text mit Schalter „ohne Symbole“ |
| R7-610 | Haustiergebühr einrechnen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-611 | Größen- und Zahlgrenze | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-612 | Bewertungen mit Hund | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-613 | Allergie-Warnung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-614 | Eingezäunter Garten | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-615 | Rauchfrei für Asthmatiker | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-616 | Lizenznummer prüfen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-617 | Grüne Selbstauskunft | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-618 | Ladestation fürs E-Auto | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-619 | Fahrradkeller | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-620 | Größe des Vermieters | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-621 | Gastgeber lebt vor Ort | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-622 | Leitungswasser trinkbar | braucht Entscheidung | Länderliste „Leitungswasser trinkbar“ ist eine Gesundheitsaussage; Quelle und Haftung klären |
| R7-623 | Umweltzone und ZTL | anderer Bereich | low_emission_zone nicht geladen (Stadtdaten); Abgleich je Unterkunft wäre Plugin |
| R7-624 | Parken kostet extra | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-625 | Insel- und Fährlage | übersprungen | Wasserflächen und Fährlinien sind nicht in den geladenen Daten |
| R7-626 | Etappen-Viertel mit Autobahnnähe | anderer Bereich | neue Kategorie motorway_junction in core.js und Stadtdaten |
| R7-627 | Gepäck im Auto | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-628 | Ankunft am Sonntag | umgesetzt | Hinweis bei Anreise am Sonntag (allgemein formuliert, das Land der Stadt steht nicht in den Daten) |
| R7-629 | Kirchenglocken | anderer Bereich | place_of_worship/bells nicht geladen (core.js FIELDS) |
| R7-630 | Flugschneise | anderer Bereich | aeroway=runway nicht geladen (core.js, Stadtdaten) |
| R7-631 | Ruhe-Indizien in der Beschreibung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-632 | Verdunkelung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-633 | Klima-Ausstattung je Reisemonat | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-634 | Tageslicht-Rechner | umgesetzt | Tageslicht am Anreisetag (Tageslänge; Uhrzeiten fehlen, weil die Zeitzone der Stadt nicht in den Daten steht) |
| R7-635 | Außenpool-Saison | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-636 | Winter-Chips | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-637 | Dachwohnung im Hochsommer | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-638 | Strandausstattung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-639 | Skikeller und Skibus | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-640 | Ungewöhnlich teuer erkannt | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-641 | Silvester und Feiertage | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-642 | Budget-Topf über Etappen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-643 | Etappen-Kopiertext | umgesetzt | Viertel-Variante: „Als Etappe merken“ (Stadt, Daten, Viertel), Liste, Kopiertext; Gebucht-Status kennt nur das Plugin |
| R7-644 | Wechselkosten bei Roadtrips | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-645 | Check-out-Check-in-Kette | umgesetzt | teilweise: Etappen melden Lücken und Überschneidungen der Daten; Check-in-Zeiten kennt nur das Plugin |
| R7-646 | Storno-Kette | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-647 | Gastgeber-Gedächtnis | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-648 | Vorjahresvergleich | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-649 | Stammwohnung im Blick | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-650 | Geschmack korrigieren | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-651 | Rate den Preis | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-652 | Blindverkostung | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-653 | Paarweises Duell | umgesetzt | Viertel-Variante: 8 Runden je zwei Viertel, daraus Gewichte schätzen und für eine Person übernehmen |
| R7-654 | Grübel-Bremse | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-655 | Superlativ-Zähler | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-656 | Ausreißer-Vorschlag | umgesetzt | Viertel-Variante „Mal was anderes“: gut bewertet, aber anderes Profil als Platz 1 |
| R7-657 | Gesparte Klicks | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-658 | Markdown-Tabelle kopieren | umgesetzt | beste Viertel als Liste oder Markdown-Tabelle kopieren |
| R7-659 | Teilen ohne Preise | anderer Bereich | Plugin (copyTop); der Viertel-Kopiertext enthält ohnehin keine Preise |
| R7-660 | Entscheidungsfragen im Text | umgesetzt | Kopiertext endet mit bis zu zwei Entscheidungsfragen aus dem Unterschied von Platz 1 und 2 |
| R7-661 | Preisstand im Text | umgesetzt | Kopiertext nennt den Stand der OpenStreetMap-Daten |
| R7-662 | Screenshot-Modus | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-663 | Offenes Merklisten-Format | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-664 | Quadratmeter pro Person | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-665 | Kaffeemaschinen-Art | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-666 | Grundausstattung Küche | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-667 | Geschirr für alle | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-668 | Grill | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-669 | Kühlschrank statt Minikühlschrank | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-670 | Zweiter Bildschirm | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-671 | Sprachen des Gastgebers | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-672 | Antwortzeit gegen Anreise | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-673 | Regel-Dichte | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-674 | Wünsche aus einem Satz | umgesetzt | Viertel-Finder: Satz → Wunsch-Häkchen und Budget mit Modus (Nacht/Person/gesamt) |
| R7-675 | Weiterblättern lohnt nicht mehr | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-676 | Kartenausschnitt-Tipp | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-677 | Filter-Vorschlag per Klick | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-678 | Karten-Pins färben | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-679 | Robuste Empfehlung | umgesetzt | Viertel-Variante: Platz 1 unter Fairness ±0,3 und Kategorie-Gewichten ×0,7/×1,3 geprüft, „stabil“ oder „knapp“ |
| R7-680 | Entscheidungsnotiz automatisch | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-681 | Bewertungen lokal übersetzen | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-682 | Sprache erkennen, dann Muster wählen | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-683 | Panel in jeder Sprache | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-684 | Kopiertext für internationale Gruppen | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-685 | Hausregeln als Felder | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-686 | Frag die Beschreibung | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-687 | Foto-Check lokal | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-688 | Alt-Texte für Fotos | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-689 | Freitext-Interesse zu OSM-Kategorien | umgesetzt | ohne KI: Wortliste → eigene Gewichte für eine gewählte Person, „keine …“ zählt negativ |
| R7-690 | Widersprüchliche Bewertungen finden | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-691 | Pro und Contra zweier Inserate | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-692 | Begründung natürlich formulieren | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-693 | Lange Beschreibung kürzen | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-694 | Notizen automatisch verschlagworten | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-695 | Neue Warnwörter vorschlagen | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-696 | KI-Kennzeichnung als Regel | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-697 | Verfügbarkeit ehrlich anzeigen | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-698 | Prompts offen im Repo | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-699 | Kleines Modell im Paket als Rückfall | anderer Bereich | Plugin; dazu Modell-Download im Browser (Entscheidung nötig) |
| R7-700 | Abstand zu Platz 1 | umgesetzt | je Viertelkarte „Bis Platz 1 fehlen N Punkte, vor allem …“ |
| R7-701 | Glossar an Ort und Stelle | umgesetzt | Viertel-Finder: Aufklapper „Begriffe kurz erklärt“ (Fairste Wahl, Wert, Veto, Geheimtipp, Preislage); Plugin-Glossar in shared/ anderer Bereich |
| R7-702 | Woran StayMatch etwas erkennt | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-703 | Quellen-Symbol je Grund | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-704 | Panel-Kennenlernen | anderer Bereich | Plugin (Unterkunftsdaten, rank.js/parse.js/Content-Scripts) |
| R7-705 | Bookmarklet für Safari und Handy | anderer Bereich | Plugin/andere Plattformen |
| R7-706 | Userscript-Ausgabe | anderer Bereich | Plugin/andere Plattformen |
| R7-707 | Seitenleiste statt Overlay | anderer Bereich | Plugin/andere Plattformen |
| R7-708 | Gleiche Wohnung, anderer Preis | anderer Bereich | Plugin/andere Plattformen |
| R7-709 | Orion auf dem iPhone testen | anderer Bereich | Plugin/andere Plattformen |
| R7-710 | Fremde Unterkunft von Hand merken | anderer Bereich | Plugin/andere Plattformen |
| R7-711 | Montags-Falle | anderer Bereich | opening_hours nicht geladen (core.js FIELDS, Stadtdaten) |
| R7-712 | Sonntag-offen-Wert | anderer Bereich | opening_hours nicht geladen (core.js FIELDS, Stadtdaten) |
| R7-713 | Wochenmarkt an euren Tagen | umgesetzt | teilweise: „Markt 300 m (Name)“ je Viertel; Öffnungstage fehlen, opening_hours wird nicht geladen (core.js FIELDS, anderer Bereich) |
| R7-714 | Spät-Essen-Wert | anderer Bereich | opening_hours nicht geladen (core.js FIELDS, Stadtdaten) |
| R7-715 | Supermarkt-Preisniveau | anderer Bereich | brand/Supermärkte nicht geladen (core.js CATEGORIES) |
| R7-716 | Eigene Ortsliste importieren | umgesetzt | GeoJSON/KML-Import (nur Punkte, bleibt im Browser), Zeile „N deiner Orte im Umkreis“ je Viertel; keine Punktwirkung |
| R7-717 | Diese Viertel passen nicht | umgesetzt | Aufklapper „Diese Viertel passen nicht“ mit Grund und Person |
| R7-718 | Fußgängerzonen-Anteil | anderer Bereich | highway=pedestrian nicht geladen (core.js, Stadtdaten) |
| R7-719 | Ufer-Wert | anderer Bereich | Uferwege nicht geladen (core.js, Stadtdaten) |
| R7-720 | Plätze-Wert | anderer Bereich | place=square nicht geladen (core.js, Stadtdaten) |
| R7-721 | Bebauungs-Charakter | anderer Bereich | Gebäudedaten nicht geladen, würden Stadtdaten stark vergrößern |
| R7-722 | Gratis-Kultur-Wert | anderer Bereich | fee=no nicht geladen (core.js FIELDS) |
| R7-723 | Uni-Viertel | anderer Bereich | amenity=university nicht geladen (core.js CATEGORIES) |
| R7-724 | Wasserspielplatz im Sommer | anderer Bereich | Spielplatz-Untertypen nicht geladen (core.js FIELDS) |
| R7-725 | Gewichte nach Aufenthaltsdauer | umgesetzt | stayWeights: bis 2 Nächte Bahn/Sehenswertes mehr, ab 10 Nächten Einkaufen/Ruhe/Sport mehr; eigene Regler unverändert; Hinweiszeile |
| R7-726 | Datenauskunft auf einen Blick | anderer Bereich | Plugin-Popup |
| R7-727 | Null-Anfragen-Anleitung | anderer Bereich | Plugin-Popup |
| R7-728 | Reise vergessen | anderer Bereich | Plugin-Popup |
| R7-729 | Notizen mit Passwort | anderer Bereich | Plugin-Popup |
| R7-730 | Backup-Erinnerung | anderer Bereich | Plugin-Popup |
| R7-731 | Atom-Feed statt Newsletter | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-732 | Daten-Tagebuch je Stadt | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-733 | Stadt-Paten | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-734 | Transparenz-Bericht | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-735 | Fediverse statt Tracking-Kanäle | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-736 | Ehrlicher Werkzeugvergleich | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-737 | Unterrichtsmaterial Fairness | anderer Bereich | Unterrichtsmaterial: Website/Inhalt |
| R7-738 | Fallstudie mit Zahlen | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-739 | Saison-Kalender je Stadt | anderer Bereich | statische Website-Seite, braucht Klimatabelle (web/data) |
| R7-740 | Airbnb-Begriffe erklärt | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-741 | Checkliste vor der Buchung | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-742 | Stadtseiten in einfacher Sprache | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-743 | Selbst gehostete Kurzvideos | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-744 | Sterne-Spielplatz | anderer Bereich | eigene Website-Seite |
| R7-745 | Gewichtsänderungen ankündigen | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-746 | Barrierefreiheitserklärung | anderer Bereich | Website/Projekt, nicht Viertel-Finder |
| R7-747 | Förderprogramme beantragen | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
| R7-748 | Anteil an OpenStreetMap | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
| R7-749 | Spendenbitte erst nach Erfolg | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
| R7-750 | Unterstützer-Code ohne Konto | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
| R7-751 | Gedrucktes Viertel-Quartett | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
| R7-752 | Workshops für Vereine | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
| R7-753 | Kernversprechen schriftlich | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
| R7-754 | Datenpflege durch Städte | braucht Entscheidung | Monetarisierung (laut Auftrag nicht bauen) |
