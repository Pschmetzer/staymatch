# R7 E – Status Plugin-Features (Branch feat/r7-features-extension)

Commits: W1 e10fe7e, W2 c19eee0, W3 1de1446, W4 537a807, W5 24224d5. Neue Texte lokal in extras.js, hints.js, content-*.js, popup.* (später nach i18n.js).

| Nr. | Feature | Status | Detail |
|---|---|---|---|
| R7-496 | Fixkosten-Anteil bei Kurztrips | umgesetzt | e10fe7e – Unterkunftsseite (Reinigung+Service aus dem Buchungsbereich); Suchseite über Nacht+Gesamtpreis der Karte |
| R7-497 | Lockpreis-Warnung | umgesetzt | c19eee0 |
| R7-498 | Gebühren-Filterchip | umgesetzt | c19eee0 |
| R7-499 | Rabattschwelle 7 und 28 Nächte | umgesetzt | c19eee0 |
| R7-500 | Rabatt-Ehrlichkeitscheck | umgesetzt | 537a807 |
| R7-501 | Last-Minute-Rabatt erklären | umgesetzt | 537a807 |
| R7-502 | Budget-Hebel | umgesetzt | c19eee0 |
| R7-503 | Was kostet ein Stern mehr? | umgesetzt | c19eee0 |
| R7-504 | Günstiger Zwilling | umgesetzt | c19eee0 |
| R7-505 | Gesamtpreis-Schalter erkennen | umgesetzt | c19eee0 |
| R7-506 | Verschiebe-Links | umgesetzt | c19eee0 |
| R7-507 | Wochenend-Aufschlag sichtbar | umgesetzt | c19eee0 – aus eigenem Preis-Log |
| R7-508 | Preisanker im Kopf | umgesetzt | c19eee0 |
| R7-509 | Kaution sichtbar machen | umgesetzt | e10fe7e |
| R7-510 | Zusatzgast-Gebühr | umgesetzt | e10fe7e |
| R7-511 | Vor-Ort-Kosten | umgesetzt | e10fe7e |
| R7-512 | Bettwäsche inklusive? | umgesetzt | e10fe7e |
| R7-513 | Putzliste plus Reinigungsgebühr | umgesetzt | e10fe7e |
| R7-514 | Preis pro Schlafplatz | umgesetzt | c19eee0 |
| R7-515 | Budget-Rest | umgesetzt | c19eee0 |
| R7-516 | Storno-Preis-Abwägung | umgesetzt | 537a807 |
| R7-517 | Preisanzeige-Wechsel zwischen Seiten | umgesetzt | c19eee0 |
| R7-518 | Nachschau-Erinnerung statt Preisalarm | braucht Entscheidung | braucht Berechtigung „alarms“ (neue Rechte) |
| R7-519 | Teilbewertungen nutzen | umgesetzt | 537a807 |
| R7-520 | Saisonpassende Bewertungen | übersprungen | Datum je Bewertungstext wird nicht gelesen |
| R7-521 | Wiederkehrer-Signal | umgesetzt | e10fe7e |
| R7-522 | Gastgeber reagiert auf Kritik | umgesetzt | 537a807 |
| R7-523 | Problemlöser-Signal | umgesetzt | e10fe7e |
| R7-524 | Stichwort-Trend | umgesetzt | e10fe7e – Stichwort „sauber“ neueste 10 gegen ältere |
| R7-525 | Beschreibung gegen Bewertungen | umgesetzt | 24224d5 |
| R7-526 | Sterne-Text-Widerspruch | übersprungen | Einzelnoten je Bewertung werden nicht gelesen; nur Hilfsfunktion politeFives vorhanden (537a807), nicht in der Wertung |
| R7-527 | Einzelner Ausreißer | umgesetzt | e10fe7e |
| R7-528 | Bett-Qualität | umgesetzt | e10fe7e |
| R7-529 | Warmwasser und Dusche | umgesetzt | e10fe7e |
| R7-530 | Geruch und Feuchtigkeit | umgesetzt | e10fe7e |
| R7-531 | Nachbarn-Ärger | umgesetzt | e10fe7e |
| R7-532 | Lärm-Zeitfenster | umgesetzt | e10fe7e |
| R7-533 | Konkrete Zahlen zitieren | umgesetzt | e10fe7e |
| R7-534 | Renovierung entwertet alte Kritik | umgesetzt | e10fe7e |
| R7-535 | Gästemix | umgesetzt | e10fe7e |
| R7-536 | Bewertungsdichte | übersprungen | Startdatum des Inserats nicht lesbar |
| R7-537 | Sprachvielfalt als Echtheitszeichen | umgesetzt | e10fe7e |
| R7-538 | Kritik-Quote statt Schnitt | umgesetzt | e10fe7e |
| R7-539 | Sterne relativ zur Seite | umgesetzt | c19eee0 |
| R7-540 | Plakette verloren | umgesetzt | e10fe7e |
| R7-541 | Storno durch Gastgeber | umgesetzt | e10fe7e |
| R7-542 | Neustart nach schlechten Bewertungen | umgesetzt | e10fe7e |
| R7-543 | Link-Echtheit prüfen | umgesetzt | 1de1446 |
| R7-544 | Kopier-Warnung bei Kontaktdaten | umgesetzt | 537a807 – copy-Ereignis auf der Unterkunftsseite |
| R7-545 | Rauchmelder, CO-Melder, Feuerlöscher | umgesetzt | e10fe7e |
| R7-546 | Kamera- und Geräuschmesser-Hinweis | umgesetzt | e10fe7e |
| R7-547 | Identität bestätigt | umgesetzt | e10fe7e |
| R7-548 | Neues Konto, viele Inserate | umgesetzt | e10fe7e – nutzt „seit“-Jahr aus der Gastgeber-Box |
| R7-549 | Gastgeber-Bilanz für neue Inserate | umgesetzt | 537a807 – Gastgeber-Bewertungszahl aus der Gastgeber-Box |
| R7-550 | Lage-Behauptungen nachrechnen | übersprungen | M; braucht Stationsdaten aus dem Viertel-Finder über bridge.js |
| R7-551 | Sicherheitsgefühl aus Bewertungen | umgesetzt | e10fe7e |
| R7-552 | Was tun bei Verdacht? | anderer Bereich | statische Seite auf staymatch.pro (web/) |
| R7-553 | Ungenaue Karte ehrlich sagen | umgesetzt | 537a807 – Hinweis, wenn zweites Viertel <250 m weiter |
| R7-554 | Fairness-Konto über Reisen | anderer Bereich | scoring.js im Viertel-Finder (web/) |
| R7-555 | Merkliste der Freunde einlesen | umgesetzt | 1de1446 |
| R7-556 | Suchergebnisse zusammenlegen | übersprungen | M; Pool-Dateiformat und Import nicht in dieser Runde |
| R7-557 | Durchgangszimmer | umgesetzt | e10fe7e |
| R7-558 | Esstisch für alle | umgesetzt | e10fe7e |
| R7-559 | Teilnehmer-Änderung | umgesetzt | c19eee0 – ±1 im Abschnitt „Mehr Wünsche und Gruppe“ |
| R7-560 | Bett teilen? | umgesetzt | c19eee0 |
| R7-561 | Zwei Wohnungen nebeneinander | umgesetzt | c19eee0 |
| R7-562 | Vorkasse-Text | umgesetzt | e10fe7e |
| R7-563 | Gebucht-Status | umgesetzt | e10fe7e |
| R7-564 | Raucher in der Gruppe | umgesetzt | e10fe7e |
| R7-565 | Mindestalter und Besucherverbot | umgesetzt | e10fe7e |
| R7-566 | Etagen-Verteilung | umgesetzt | e10fe7e |
| R7-567 | Doppelbett-Garantie | umgesetzt | c19eee0 |
| R7-568 | Bettbreite | umgesetzt | e10fe7e |
| R7-569 | Zwei-Paare-Check | übersprungen | Zusammensetzung der Gruppe (Paare) ist im Plugin unbekannt |
| R7-570 | Gastgeber wohnt nebenan | umgesetzt | e10fe7e |
| R7-571 | Badewanne | umgesetzt | c19eee0 |
| R7-572 | Aussicht-Wunsch | umgesetzt | c19eee0 |
| R7-573 | Spuren-Pause | umgesetzt | 1de1446 |
| R7-574 | Paar-Geschmack mischen | übersprungen | M; braucht Import-Format für Partner-Stimmen |
| R7-575 | Wo ihr auseinanderliegt | übersprungen | hängt an R7-574 |
| R7-576 | Baby an Bord | umgesetzt | e10fe7e |
| R7-577 | Kindersicherheit | umgesetzt | e10fe7e – Treppenschutzgitter/Steckdosenschutz, Pool ohne Zaun; „Balkon ohne Gitter“ nicht |
| R7-578 | Hochbett und Leiter | umgesetzt | e10fe7e |
| R7-579 | Kinder teilen Betten | übersprungen | Kinderalter unbekannt, Regel wäre geraten |
| R7-580 | „Nicht für Kinder geeignet“ | umgesetzt | e10fe7e |
| R7-581 | Schulferien zu Hause | anderer Bereich | Ferientabelle in web/data, braucht belegte Quelle |
| R7-582 | Waschmaschine ab 5 Nächten | umgesetzt | e10fe7e |
| R7-583 | Garten oder Innenhof | umgesetzt | e10fe7e |
| R7-584 | Spielplatz neben Café | anderer Bereich | scoring.js im Viertel-Finder (web/) |
| R7-585 | Absperrbares Zimmer | umgesetzt | c19eee0 |
| R7-586 | Solo-Paket | umgesetzt | c19eee0 |
| R7-587 | Allein-Preis-Ehrlichkeit | umgesetzt | c19eee0 |
| R7-588 | Anschluss erwünscht | umgesetzt | c19eee0 |
| R7-589 | Check-in im Dunkeln | übersprungen | Ankunftszeit und Ortszeitzone unbekannt |
| R7-590 | Zeitzonen-Rechner | übersprungen | braucht Zeitzonen-Daten je Ort (nicht im Paket) |
| R7-591 | Arbeitsplatz im Fotorundgang | übersprungen | Fotorundgang wird nicht gelesen; Arbeitsplatz über Ausstattung |
| R7-592 | Videocall-Ruhe | umgesetzt | 537a807 |
| R7-593 | Helle Wohnung | umgesetzt | e10fe7e |
| R7-594 | Echte Küche oder Kochnische | umgesetzt | e10fe7e |
| R7-595 | Ab 28 Nächten andere Regeln | umgesetzt | e10fe7e |
| R7-596 | Beleg für Dienstreisen | übersprungen | Aussage zur Rechnung nicht belegbar |
| R7-597 | Wunsch-Profile Arbeit und Urlaub | umgesetzt | c19eee0 – Profile Arbeiten/Urlaub/Allein/Familie setzen Wünsche; eigener Geschmack je Profil nicht umgesetzt |
| R7-598 | Steckertyp und Spannung | übersprungen | Tabelle braucht belegte Quelle (keine erfundenen Daten) |
| R7-599 | Bibliotheks-Wert | anderer Bereich | core.js/Viertel-Finder (anderer Agent) |
| R7-600 | Airbnb-Barrierefreiheitsmerkmale lesen | umgesetzt | e10fe7e |
| R7-601 | Erdgeschoss-Wunsch | umgesetzt | e10fe7e |
| R7-602 | Bewertungen von Rollstuhlnutzern | umgesetzt | e10fe7e – Bewertungs-Stichwort „mit Rollstuhl/Rollator“ |
| R7-603 | Assistenzhund ist kein Haustier | umgesetzt | e10fe7e |
| R7-604 | Einfache Sprache | übersprungen | M; zweite Textvariante aller Gründe, besser zusammen mit i18n.js |
| R7-605 | Vorlesen der Top 3 | umgesetzt | c19eee0 – speechSynthesis, im Abschnitt „Mehr zu dieser Seite“ |
| R7-606 | Textgröße im Panel | umgesetzt | 1de1446 |
| R7-607 | Lesefreundliche Schrift | übersprungen | braucht Schriftdatei im Paket |
| R7-608 | Seiten-Zusammenfassung für Screenreader | umgesetzt | c19eee0 |
| R7-609 | Kopiertext ohne Emojis | umgesetzt | 1de1446 |
| R7-610 | Haustiergebühr einrechnen | umgesetzt | e10fe7e |
| R7-611 | Größen- und Zahlgrenze | umgesetzt | e10fe7e |
| R7-612 | Bewertungen mit Hund | umgesetzt | e10fe7e |
| R7-613 | Allergie-Warnung | umgesetzt | e10fe7e |
| R7-614 | Eingezäunter Garten | umgesetzt | e10fe7e |
| R7-615 | Rauchfrei für Asthmatiker | umgesetzt | e10fe7e |
| R7-616 | Lizenznummer prüfen | umgesetzt | e10fe7e – Nummer wird angezeigt; Warnung „fehlt in Pflicht-Stadt“ braucht belegte Regeltabelle je Stadt (nicht gebaut) |
| R7-617 | Grüne Selbstauskunft | umgesetzt | e10fe7e |
| R7-618 | Ladestation fürs E-Auto | umgesetzt | c19eee0 |
| R7-619 | Fahrradkeller | umgesetzt | c19eee0 |
| R7-620 | Größe des Vermieters | umgesetzt | e10fe7e |
| R7-621 | Gastgeber lebt vor Ort | umgesetzt | e10fe7e |
| R7-622 | Leitungswasser trinkbar | übersprungen | Tabelle braucht belegte Quelle |
| R7-623 | Umweltzone und ZTL | anderer Bereich | Viertel-Finder / OSM-Daten (web/, core.js) |
| R7-624 | Parken kostet extra | umgesetzt | e10fe7e – Hinweis, nicht in den Endpreis gerechnet |
| R7-625 | Insel- und Fährlage | anderer Bereich | Viertel-Finder / OSM-Daten (web/, core.js) |
| R7-626 | Etappen-Viertel mit Autobahnnähe | anderer Bereich | Viertel-Finder / OSM-Daten (web/, core.js) |
| R7-627 | Gepäck im Auto | umgesetzt | e10fe7e |
| R7-628 | Ankunft am Sonntag | übersprungen | Ländertabelle Sonntagsruhe braucht belegte Quelle |
| R7-629 | Kirchenglocken | anderer Bereich | Viertel-Finder / OSM-Daten (web/, core.js) |
| R7-630 | Flugschneise | anderer Bereich | Viertel-Finder / OSM-Daten (web/, core.js) |
| R7-631 | Ruhe-Indizien in der Beschreibung | umgesetzt | e10fe7e |
| R7-632 | Verdunkelung | umgesetzt | c19eee0 – Ausstattungs-Wunsch; Hinweis bei hellen Nächten |
| R7-633 | Klima-Ausstattung je Reisemonat | übersprungen | Klimatabelle braucht belegte Quelle |
| R7-634 | Tageslicht-Rechner | umgesetzt | e10fe7e – Tageslänge per Standardformel, Anzeige bei <9 h oder >17 h |
| R7-635 | Außenpool-Saison | umgesetzt | e10fe7e |
| R7-636 | Winter-Chips | umgesetzt | 537a807 – Kamin/Sauna-Chips nur Oktober–März |
| R7-637 | Dachwohnung im Hochsommer | umgesetzt | e10fe7e |
| R7-638 | Strandausstattung | umgesetzt | c19eee0 |
| R7-639 | Skikeller und Skibus | umgesetzt | c19eee0 |
| R7-640 | Ungewöhnlich teuer erkannt | umgesetzt | c19eee0 – aus eigenem Preis-Log (nur Stadtpfad, Datum, Median) |
| R7-641 | Silvester und Feiertage | umgesetzt | e10fe7e |
| R7-642 | Budget-Topf über Etappen | übersprungen | M; mehrere Reisen mit gemeinsamem Topf braucht neues Reise-Datenmodell |
| R7-643 | Etappen-Kopiertext | umgesetzt | 1de1446 |
| R7-644 | Wechselkosten bei Roadtrips | umgesetzt | 1de1446 |
| R7-645 | Check-out-Check-in-Kette | übersprungen | Check-in/-out-Zeiten und Fahrzeiten werden nicht gelesen |
| R7-646 | Storno-Kette | umgesetzt | 1de1446 |
| R7-647 | Gastgeber-Gedächtnis | umgesetzt | e10fe7e |
| R7-648 | Vorjahresvergleich | umgesetzt | 537a807 – aus gebuchten Unterkünften derselben Stadt |
| R7-649 | Stammwohnung im Blick | übersprungen | zurückgestellt (weiterer Knopf im Panel) |
| R7-650 | Geschmack korrigieren | umgesetzt | 1de1446 |
| R7-651 | Rate den Preis | übersprungen | Spielmodus, zurückgestellt |
| R7-652 | Blindverkostung | umgesetzt | 1de1446 |
| R7-653 | Paarweises Duell | übersprungen | M; zurückgestellt |
| R7-654 | Grübel-Bremse | umgesetzt | e10fe7e |
| R7-655 | Superlativ-Zähler | umgesetzt | e10fe7e |
| R7-656 | Ausreißer-Vorschlag | umgesetzt | c19eee0 |
| R7-657 | Gesparte Klicks | umgesetzt | 1de1446 – Popup-Zähler „heute bewertet“ |
| R7-658 | Markdown-Tabelle kopieren | umgesetzt | c19eee0 |
| R7-659 | Teilen ohne Preise | umgesetzt | c19eee0 |
| R7-660 | Entscheidungsfragen im Text | umgesetzt | c19eee0 |
| R7-661 | Preisstand im Text | umgesetzt | c19eee0 |
| R7-662 | Screenshot-Modus | umgesetzt | 1de1446 |
| R7-663 | Offenes Merklisten-Format | umgesetzt | 1de1446 – Export mit format/version/exportedAt; Schema-Doku nicht (Doku ausgeschlossen) |
| R7-664 | Quadratmeter pro Person | umgesetzt | e10fe7e |
| R7-665 | Kaffeemaschinen-Art | umgesetzt | e10fe7e |
| R7-666 | Grundausstattung Küche | umgesetzt | e10fe7e |
| R7-667 | Geschirr für alle | umgesetzt | e10fe7e |
| R7-668 | Grill | umgesetzt | c19eee0 |
| R7-669 | Kühlschrank statt Minikühlschrank | umgesetzt | e10fe7e |
| R7-670 | Zweiter Bildschirm | umgesetzt | 537a807 |
| R7-671 | Sprachen des Gastgebers | umgesetzt | e10fe7e – Sprachen werden angezeigt; Abgleich mit Sprachen der Gruppe fehlt (unbekannt) |
| R7-672 | Antwortzeit gegen Anreise | umgesetzt | e10fe7e |
| R7-673 | Regel-Dichte | umgesetzt | e10fe7e |
| R7-674 | Wünsche aus einem Satz | umgesetzt | c19eee0 |
| R7-675 | Weiterblättern lohnt nicht mehr | umgesetzt | c19eee0 |
| R7-676 | Kartenausschnitt-Tipp | umgesetzt | c19eee0 |
| R7-677 | Filter-Vorschlag per Klick | umgesetzt | c19eee0 |
| R7-678 | Karten-Pins färben | übersprungen | M; fremde Karten-Selektoren, hohes Bruchrisiko |
| R7-679 | Robuste Empfehlung | umgesetzt | c19eee0 |
| R7-680 | Entscheidungsnotiz automatisch | umgesetzt | e10fe7e |
| R7-681 | Bewertungen lokal übersetzen | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-682 | Sprache erkennen, dann Muster wählen | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-683 | Panel in jeder Sprache | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-684 | Kopiertext für internationale Gruppen | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-685 | Hausregeln als Felder | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-686 | Frag die Beschreibung | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-687 | Foto-Check lokal | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-688 | Alt-Texte für Fotos | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-689 | Freitext-Interesse zu OSM-Kategorien | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-690 | Widersprüchliche Bewertungen finden | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-691 | Pro und Contra zweier Inserate | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-692 | Begründung natürlich formulieren | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-693 | Lange Beschreibung kürzen | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-694 | Notizen automatisch verschlagworten | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-695 | Neue Warnwörter vorschlagen | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-696 | KI-Kennzeichnung als Regel | braucht Entscheidung | erst sinnvoll, wenn ein KI-Feature freigegeben ist |
| R7-697 | Verfügbarkeit ehrlich anzeigen | umgesetzt | df82a34 – nur Erkennung im Popup, kein Download |
| R7-698 | Prompts offen im Repo | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-699 | Kleines Modell im Paket als Rückfall | braucht Entscheidung | ohne neue Rechte und optional möglich, aber jedes Modell-Feature braucht Fallback-Abgleich und Zustimmung zum Modell-Download (mehrere GB, nur neuere Chrome-Versionen); Freigabe nötig |
| R7-700 | Abstand zu Platz 1 | umgesetzt | c19eee0 |
| R7-701 | Glossar an Ort und Stelle | anderer Bereich | Wörterbuch in shared/ |
| R7-702 | Woran StayMatch etwas erkennt | umgesetzt | 537a807 – Tooltips „Quelle: …“ an allen Wunsch-Chips |
| R7-703 | Quellen-Symbol je Grund | übersprungen | Begründungen haben noch keine Quellenfelder |
| R7-704 | Panel-Kennenlernen | umgesetzt | 1de1446 |
| R7-705 | Bookmarklet für Safari und Handy | braucht Entscheidung | andere Browser/Ausgabeformen |
| R7-706 | Userscript-Ausgabe | braucht Entscheidung | andere Browser/Ausgabeformen |
| R7-707 | Seitenleiste statt Overlay | braucht Entscheidung | braucht Berechtigung „sidePanel“ |
| R7-708 | Gleiche Wohnung, anderer Preis | braucht Entscheidung | andere Plattform (Booking) |
| R7-709 | Orion auf dem iPhone testen | braucht Entscheidung | andere Browser/Ausgabeformen |
| R7-710 | Fremde Unterkunft von Hand merken | braucht Entscheidung | braucht „activeTab“ / Rechte auf fremden Seiten |
| R7-711 | Montags-Falle | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-712 | Sonntag-offen-Wert | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-713 | Wochenmarkt an euren Tagen | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-714 | Spät-Essen-Wert | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-715 | Supermarkt-Preisniveau | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-716 | Eigene Ortsliste importieren | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-717 | Diese Viertel passen nicht | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-718 | Fußgängerzonen-Anteil | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-719 | Ufer-Wert | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-720 | Plätze-Wert | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-721 | Bebauungs-Charakter | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-722 | Gratis-Kultur-Wert | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-723 | Uni-Viertel | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-724 | Wasserspielplatz im Sommer | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-725 | Gewichte nach Aufenthaltsdauer | anderer Bereich | Viertel-Finder (web/, scoring.js, core.js) |
| R7-726 | Datenauskunft auf einen Blick | umgesetzt | 1de1446 |
| R7-727 | Null-Anfragen-Anleitung | umgesetzt | 1de1446 |
| R7-728 | Reise vergessen | umgesetzt | 1de1446 – Löschen-Dialog „diese reise“ |
| R7-729 | Notizen mit Passwort | übersprungen | M; WebCrypto-Notizen mit Passwortverlust-Risiko, zurückgestellt |
| R7-730 | Backup-Erinnerung | umgesetzt | 1de1446 |
| R7-731 | Atom-Feed statt Newsletter | anderer Bereich | Website/Content (web/, Doku) |
| R7-732 | Daten-Tagebuch je Stadt | anderer Bereich | Website/Content (web/, Doku) |
| R7-733 | Stadt-Paten | anderer Bereich | Website/Content (web/, Doku) |
| R7-734 | Transparenz-Bericht | anderer Bereich | Website/Content (web/, Doku) |
| R7-735 | Fediverse statt Tracking-Kanäle | anderer Bereich | Website/Content (web/, Doku) |
| R7-736 | Ehrlicher Werkzeugvergleich | anderer Bereich | Website/Content (web/, Doku) |
| R7-737 | Unterrichtsmaterial Fairness | anderer Bereich | Website/Content (web/, Doku) |
| R7-738 | Fallstudie mit Zahlen | anderer Bereich | Website/Content (web/, Doku) |
| R7-739 | Saison-Kalender je Stadt | anderer Bereich | Website/Content (web/, Doku) |
| R7-740 | Airbnb-Begriffe erklärt | anderer Bereich | Website/Content (web/, Doku) |
| R7-741 | Checkliste vor der Buchung | anderer Bereich | Website/Content (web/, Doku) |
| R7-742 | Stadtseiten in einfacher Sprache | anderer Bereich | Website/Content (web/, Doku) |
| R7-743 | Selbst gehostete Kurzvideos | anderer Bereich | Website/Content (web/, Doku) |
| R7-744 | Sterne-Spielplatz | anderer Bereich | Website/Content (web/, Doku) |
| R7-745 | Gewichtsänderungen ankündigen | anderer Bereich | Website/Content (web/, Doku) |
| R7-746 | Barrierefreiheitserklärung | anderer Bereich | Website/Content (web/, Doku) |
| R7-747 | Förderprogramme beantragen | braucht Entscheidung | Monetarisierung/Projekt-Entscheidung |
| R7-748 | Anteil an OpenStreetMap | braucht Entscheidung | Monetarisierung/Projekt-Entscheidung |
| R7-749 | Spendenbitte erst nach Erfolg | braucht Entscheidung | Monetarisierung/Projekt-Entscheidung |
| R7-750 | Unterstützer-Code ohne Konto | braucht Entscheidung | Monetarisierung/Projekt-Entscheidung |
| R7-751 | Gedrucktes Viertel-Quartett | braucht Entscheidung | Monetarisierung/Projekt-Entscheidung |
| R7-752 | Workshops für Vereine | braucht Entscheidung | Monetarisierung/Projekt-Entscheidung |
| R7-753 | Kernversprechen schriftlich | anderer Bereich | README/Doku |
| R7-754 | Datenpflege durch Städte | braucht Entscheidung | Monetarisierung/Projekt-Entscheidung |

Anzahlen: umgesetzt 157, braucht Entscheidung 32, übersprungen 27, anderer Bereich 43
