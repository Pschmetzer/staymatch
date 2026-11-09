# StayMatch – Konzept

**Problem:** Wer ein Airbnb sucht, klickt sich durch Dutzende Unterkünfte, vergleicht Lage, Bewertungen und Preis per Hand und weiß am Ende trotzdem nicht, ob die Gegend zu einem passt. Airbnb sortiert nach Preis oder Sternen, aber nicht nach **dir**.

**Lösung:** Vorher kurz abfragen, was dir wichtig ist (Budget, Wünsche an die Unterkunft, optional Interessen für die Gegend) und jede Unterkunft auf der Suchseite danach bewerten: **Top 3 mit Begründung**. Zwei Wege: **Direkt-Modus** (Plugin auf jeder Airbnb-Suche, Budget pro Nacht und Wunsch-Chips im Panel) oder erst der **Viertel-Finder**, der das passende Viertel sucht und Wünsche, Budget und Viertel ans Plugin übergibt. Dazu ein Merkzettel, der sich merkt, was du gesehen hast und was dir gefallen hat.

**Zielgruppe:** zuerst einzelne Reisende und Paare, die schneller das passende Airbnb finden wollen. Gruppen sind ein Zusatz: Mit Mitreisenden zählt die am wenigsten zufriedene Person mit (Fairness-Wertung).

## Teile

### 1. Web-App „Viertel-Finder“ (`web/`)
- Stadt, Zeitraum, Gesamtbudget und Interessen eingeben (Typen: Party, Chill, Sightseeing, Foodie, Familie, Natur). Standard ist eine Person, Mitreisende sind optional.
- Wünsche an die Unterkunft: ganze Unterkunft, kein gewerblicher Anbieter, Superhost/Gäste-Favorit, mind. 20 Bewertungen (prüft das Plugin auf der Suchseite) sowie ruhig, sauber, gutes WLAN (prüft das Plugin auf der Unterkunftsseite anhand der Bewertungs-Stichworte).
- Die App holt aus OpenStreetMap alle Viertel und Orte der Stadt (Bars, Clubs, Parks, Cafés, Sehenswürdigkeiten, Restaurants, ÖPNV).
- Jedes Viertel bekommt pro Person einen Wert von 0 bis 100. Bei Gruppen setzt sich die Wertung zu **60 % aus der am wenigsten zufriedenen Person** und zu 40 % aus dem Schnitt zusammen. So gewinnt nicht einfach die Mehrheit.
- Budget wird umgerechnet: pro Nacht und pro Person.
- Für jedes Top-Viertel gibt es einen Link in die Unterkunftssuche mit Datum, Personenzahl, Preisgrenze und Kartenausschnitt.
- Karte mit den Top-Vierteln und Highlights in der Nähe.

### 2. Chrome-Erweiterung (`extension/`)
- **Suchseite:** bewertet alle Unterkünfte der geöffneten Suchseite nach Sternen, Preis, deinen Wünschen und, falls bekannt, dem Viertel (bei Gruppen auch Betten) und zeigt die Top 3 mit Begründung. Ohne Viertel-Finder gelten Budget pro Nacht und Wunsch-Chips aus dem Panel; nach einer Suche im Viertel-Finder werden dessen Wünsche übernommen (`bridge.js`).
- **Unterkunftsseite:** warnt, wenn Bewertungs-Stichworte deinen Wünschen widersprechen (z. B. Wunsch „ruhig“, Gäste schreiben „laut“).
- Liest nur Unterkunftsseiten, die du selbst öffnest. Es gibt kein Scraping und keinen Server.
- **Verlauf:** wo du schon warst, wie oft, wann.
- **Gefällt mir / Nein** plus Notiz pro Unterkunft.
- **Bewertungen:** Sterne, Anzahl und erkannte Stichworte aus den Rezensionen (sauber, Lage, laut, WLAN …).
- **Dein Geschmack:** Preis, Bewertung, Stichworte und Orte aus deinen 👍-Unterkünften.
- Export als JSON. Alles bleibt in `chrome.storage.local`.

## Die Wünsche und wo sie umgesetzt sind
| Wunsch | Umsetzung |
|---|---|
| Nach Zeitraum filtern | An- und Abreise in der Web-App, wird an die Suche übergeben |
| Budget festlegen | Gesamtbudget → pro Nacht und pro Person, Preisgrenze im Suchlink |
| Sehen, wo ich vorher war und was gefallen hat | Verlauf, 👍/👎 und Geschmacksprofil in der Erweiterung |
| Bewertungen suchen | Sterne und Stichworte aus Rezensionen im Overlay |
| Google-Chrome-Plugin | `extension/` (Manifest V3) |
| Location eingeben → beste Gegend, Aktivitäten-Match, Gruppe zufriedenstellen | Viertel-Finder mit Fairness-Wertung |

## Grenzen (ehrlich)
- Airbnb hat **keine öffentliche API**. Server-Scraping verstößt gegen die Nutzungsbedingungen und wird gesperrt. Deshalb sucht die App Viertel, und die Unterkünfte siehst du auf der Airbnb-Seite selbst.
- Die Suchlink-Parameter (`checkin`, `checkout`, `adults`, `price_max`, Kartenbereich) sind nicht offiziell dokumentiert und können sich ändern. Ob `price_max` pro Nacht oder gesamt gilt, ist nicht bestätigt.
- Die Seitenstruktur von Airbnb ändert sich oft. Die Erweiterung nutzt deshalb zuerst die URL und strukturierte Daten (JSON-LD) und lässt fehlende Felder weg.
- Die öffentlichen OpenStreetMap-Server (Overpass) sind manchmal langsam (bis ca. 1 Minute). Ergebnisse werden einen Tag im Browser zwischengespeichert.

## Ideen von bestehenden Tools
- **CompareBNB:** Unterkünfte nebeneinander vergleichen, Gesamtpreis pro Person.
- **Add to Sheets:** Export in eine Tabelle, die die Gruppe gemeinsam kommentiert.
- **Geteilte Wunschlisten:** Abstimmen mit Ranking.
- **Lücke im Markt:** Airbnb sortiert nach Preis und Sternen, aber nicht danach, ob Gegend und Unterkunft zu dir passen. Genau das ist der Kern von StayMatch.

## Roadmap
**Als Nächstes für Einzelreisende:**
- Mehrere Interessen pro Person mit Schiebereglern statt eines Typs.
- Weitere Wünsche, sobald die Daten sie sicher hergeben: Küche, Arbeitsplatz, Self-Check-in, Haustiere (Ausstattung steht erst auf der Unterkunftsseite).
- Wünsche direkt im Plugin-Popup ändern, ohne zurück auf die Website.
- Vergleichsansicht der gemerkten 👍-Unterkünfte nebeneinander.
- Preisalarm: Hinweis, wenn eine gemerkte Unterkunft günstiger wird (Preisverlauf ist schon da).

**Gruppen (Zusatz):**
1. **Gruppen-Link:** Jeder füllt seine Vorlieben selbst aus, statt dass einer für alle wählt (geteilte Daten, kein Login).
2. **Live-Voting:** Die Gruppe stimmt über Top-Viertel und gemerkte Unterkünfte ab.
3. **Viertel-Overlay in der Erweiterung:** Auf der Unterkunftsseite steht direkt der Gruppen-Score des Viertels.
4. **Feinere Typen:** eigene Gewichte pro Person (Schieberegler), Aktivitäten wie Surfen, Karaoke, Shopping, Wandern.
5. **Weitere Portale:** Booking.com, Vrbo.
6. **Konto und Sync:** Verlauf über mehrere Geräte.
