# StayMatch – Konzept

**Problem:** Eine Gruppe (z. B. 5 Leute: 2 wollen feiern, 2 chillen, 1 will Sightseeing) sucht eine Unterkunft. Jeder schaut woanders, am Ende gewinnt die lauteste Person oder die Mehrheit. Unterkunftsportale zeigen Unterkünfte, aber nicht, **welches Viertel** zur Gruppe passt.

**Lösung:** Erst das Viertel finden, in dem *alle* zufrieden sind, dann gezielt dort suchen. Dazu ein Browser-Merkzettel, der sich merkt, was man schon angesehen hat und was gefallen hat.

## Teile

### 1. Web-App „Viertel-Finder“ (`web/`)
- Stadt, Zeitraum, Gesamtbudget und Gruppe eingeben (Typen: Party, Chill, Sightseeing, Foodie).
- Die App holt aus OpenStreetMap alle Viertel und Orte der Stadt (Bars, Clubs, Parks, Cafés, Sehenswürdigkeiten, Restaurants, ÖPNV).
- Jedes Viertel bekommt pro Person einen Wert von 0 bis 100. Die Gruppenwertung setzt sich zu **60 % aus der am wenigsten zufriedenen Person** und zu 40 % aus dem Schnitt zusammen. So gewinnt nicht einfach die Mehrheit.
- Budget wird umgerechnet: pro Nacht und pro Person.
- Für jedes Top-Viertel gibt es einen Link in die Unterkunftssuche mit Datum, Personenzahl, Preisgrenze und Kartenausschnitt.
- Karte mit den Top-Vierteln und Highlights in der Nähe.

### 2. Chrome-Erweiterung (`extension/`)
- **Suchseite:** bewertet alle Unterkünfte der geöffneten Suchseite für die Gruppe und zeigt die Top 3 mit Begründung. Gruppe, Budget und Viertel-Werte kommen aus dem Viertel-Finder: `bridge.js` liest sie von der StayMatch-Seite und legt sie im Plugin-Speicher ab (kein `externally_connectable`).
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
- Das Plugin bewertet je Suchseite. Ein Sammeln über mehrere Seiten gibt es noch nicht, die Top 3 gelten für die geöffnete Seite. Es läuft nur in Chrome-Browsern am Computer, nicht auf dem Handy.
- Das Geschmacksprofil fließt nur mit kleinem Gewicht (5 %) in die Plugin-Wertung ein.
- Die öffentlichen OpenStreetMap-Server (Overpass) sind manchmal langsam (bis ca. 1 Minute). Ergebnisse werden einen Tag im Browser zwischengespeichert.

## Ideen von bestehenden Tools
- **CompareBNB:** Unterkünfte nebeneinander vergleichen, Gesamtpreis pro Person.
- **Add to Sheets:** Export in eine Tabelle, die die Gruppe gemeinsam kommentiert.
- **Geteilte Wunschlisten:** Abstimmen mit Ranking.
- **Lücke im Markt:** Bisher vergleicht kein Tool Stadtviertel für Gruppen. Genau das ist der Kern von StayMatch.

## Roadmap
1. ~~Teilen-Link~~ **umgesetzt:** Gruppe, Reise und Budget stecken im Teil nach `#` der Adresse (kodiert, nicht verschlüsselt, kein Login). **Offen:** Jede Person füllt ihre Vorlieben selbst aus, statt dass einer für alle wählt.
2. **Live-Voting (offen):** Die Gruppe stimmt über Top-Viertel und gemerkte Unterkünfte ab.
3. **Viertel-Overlay in der Erweiterung:** Auf der Unterkunftsseite steht der Gruppen-Score des Viertels und der Verlauf (`sm-room`-Panel). Offen: Qualität auf echten Seiten prüfen.
4. **Feinere Typen:** eigene Gewichte pro Person (Schieberegler), Aktivitäten wie Surfen, Karaoke, Shopping, Wandern.
5. **Weitere Portale:** Booking.com, Vrbo.
6. **Konto und Sync:** Verlauf über mehrere Geräte.
