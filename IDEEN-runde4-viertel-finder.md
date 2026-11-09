# Runde 4: Nur der Viertel-Finder (`web/app.html`, `web/app.js`, `web/scoring.js`)

Stand: 10.11.2026. Gelesen: `app.html`, `app.js`, `scoring.js`, dazu Abgleich mit `IDEEN.md` und `IDEEN-runde3.md` (Nr. 1–852). Hier steht nur, was dort noch nicht vorkommt. Nummern ab 901.
Legende: 🔴 Fehler im Code belegt · 🟠 Verbesserung · 🟢 neues Feature · 🎨 Optik · ♿ Zugänglichkeit. Aufwand: S / M / L.

---

## A. Fehler und Ungereimtheiten im heutigen Code 🔴

901. 🔴 `app.js:315` + `app.js:303`: Ändert man das Stadtfeld nach einer Suche und dann Gruppe oder Umkreis, rechnet `rescore()` mit den alten Daten (`lastData`) weiter. Im Feld steht „Rom“, die Ergebnisse sind von Barcelona. Bei neuem Stadttext Ergebnis als „veraltet“ markieren oder leeren. (S)
902. 🔴 `app.js:295`: `run()` leert `#results` sofort. Schlägt die Suche fehl (Overpass überlastet), sind auch die alten guten Ergebnisse weg. Alte Karten stehen lassen, bis neue da sind, und bei Fehler behalten. (S)
903. 🔴 `app.js:375` vs. `app.js:352`: Auf der Karte ist der Kreis `0,75 × r` groß, die Wertung zählt `r`, der Airbnb-Kartenausschnitt ist ein Quadrat mit ±`r`. Drei verschiedene „Viertel-Größen“. Kreis = Wertungsradius zeigen, oder die Zahl im Text nennen. (S)
904. 🔴 `scoring.js:3` + `app.js:218`: `railway=subway_entrance` zählt jeden Eingang einzeln, dazu die Station selbst. Ein großer Knoten mit 6 Eingängen zählt 7-mal. Eingänge in 100 m um eine Station zusammenfassen. (S)
905. 🔴 `app.js:211` (`nwr`): Ist ein Ort als Gebäude (way) und zusätzlich als Punkt (node) eingetragen, zählt er doppelt. Duplikate nach Name + 30 m zusammenlegen. (M)
906. 🔴 `app.js:183`: Budget-, Datum- und Umkreisfeld lösen `rescore()` aus, obwohl das Budget die Wertung gar nicht ändert. Es wird neu gerechnet und die Karte neu gezeichnet, nur um die Links zu aktualisieren. Nur die Links neu setzen. (S)
907. 🔴 Das Budget hat auf die Rangfolge keinen Einfluss (nur `price_max` im Link). Das Eingabefeld wirkt wichtiger, als es ist. Entweder Text „wirkt nur auf die Airbnb-Suche“ oder Budget in die Wertung (siehe 960). (S)
908. 🔴 `app.js:293`: Entfernt man die letzte Person, zeigt `rescore()` trotzdem Ergebnisse mit lauter 0. Stattdessen Hinweis „Mindestens eine Person nötig“ und Ergebnisse ausblenden. (S)
909. 🔴 `app.js:136`: `✕` löscht ohne Rückfrage und ohne Rückgängig-Toast. Bei 5 Personen ein Fehlklick und der Eintrag ist weg. (S)
910. 🔴 Kein `<form>`, keine `enterkeyhint`/`inputmode`-Attribute: Auf dem Handy zeigt die Tastatur kein „Suchen“, das Budgetfeld öffnet keine Zahlentastatur. `type="search"`, `enterkeyhint="search"`, `inputmode="numeric"`. (S)
911. 🔴 `app.js:398`: Der Teilen-Link enthält den Umkreis nicht (`shareState`). Wer 2 km einstellt und teilt, bekommt beim Empfänger 800 m und andere Ergebnisse. `r` ins Fragment. (S)
912. 🔴 `app.js:421`: Ein geöffneter Teilen-Link füllt nur das Formular. Die Person muss noch selbst „Beste Viertel finden“ drücken, obwohl alles da ist. Bei Link automatisch suchen (mit sichtbarem Hinweis). (S)
913. 🔴 `app.js:140-143`: Stadt, Daten, Budget und Umkreis werden nie gespeichert, nur die Gruppe. Nach Neuladen steht wieder „Barcelona“ und 2000 €. Alle Felder in `localStorage` (mit Ablauf bei vergangenem Datum). (S)
914. 🔴 `app.js:196`: Gibt man ein Viertel ein („Gràcia, Barcelona“), ist die Bounding-Box winzig und es kommt „Keine Viertel gefunden“. Bei kleiner Box auf mindestens ca. 6 km um den Punkt aufweiten und sagen „Wir suchen in ganz Barcelona“. (S)
915. 🔴 `app.js:348-355`: Die Chips unterscheiden gut/schlecht nur durch Farbe (`low`/`high`). Für Farbenblinde ohne Aussage. Zusätzlich ▲/▼ oder Wort („passt“/„knapp“). ♿ (S)
916. 🔴 `app.js:363`: Die Überschriften der Karten sind `h3`, die Seite hat aber kein `h2`. Screenreader-Gliederung springt. Ergebnisliste mit `h2` „Die besten Viertel“. ♿ (S)
917. 🔴 `.score` (Zahl ohne Beschriftung): Screenreader liest nur „82“. `aria-label="Gruppenwert 82 von 100"`. ♿ (S)
918. 🔴 `app.js:335`: Die Schwelle „mindestens 10 Orte“ zählt auch Restaurants und Stationen. Ein Viertel mit 10 Haltestellen, aber ohne Bar, Park oder Sehenswürdigkeit bleibt drin. Schwelle nur auf die vom Typ der Gruppe gewünschten Kategorien. (S)
919. 🔴 `app.js:346-352`: „In der Nähe“ sortiert nur nach Wikidata ja/nein, danach nach Zufall der Reihenfolge. Das kann der Ort am Rand des Umkreises sein. Nach Entfernung sortieren. (S)
920. 🔴 `app.js:350`: „In der Nähe“ zeigt für eine Party-Gruppe auch Museen und umgekehrt. Nach den Wünschen der Gruppe filtern (Kategorien mit positivem Gewicht). (S)

## B. Bedienung des Formulars 🟠

921. 🟠 Auf dem Screenshot (1080 px Höhe) liegt „Beste Viertel finden“ weit unter dem Falz, bei 5 Personen sogar mehrere Bildschirme tiefer. Knopf unten fest anheften (`position: sticky; bottom: 0`) oder oben neben die Überschrift. (S)
922. 🟠 Personenzeilen kompakter: Typ als Chips/Icons statt `select`, eine Zeile pro Person halb so hoch. Spart 40 % Höhe. (M)
923. 🟠 Rechts neben dem Formular ist bis zur ersten Suche eine große leere Fläche mit zwei Sätzen. Dort Beispielergebnis (klar als Beispiel gekennzeichnet) oder die Stadtkarte zeigen. (S)
924. 🟠 Der Tipp „Plugin für Chrome“ steht schon vor der Suche und konkurriert mit der Statuszeile. Erst nach den Ergebnissen anzeigen, nicht auf Handy/Safari. (S)
925. 🟠 Pro Typ eine Kurzbeschreibung unter dem Auswahlfeld („Party: Bars, Clubs; stört nichts“). Bisher muss man raten, was „Foodie“ zählt. (S)
926. 🟠 Gewichte pro Typ als kleines Info-Fenster („Warum bekommt Chill −0,5 für Party?“). Transparenz zu `PRESETS`. (S)
927. 🟠 Budget als Umschalter: gesamt / pro Person / pro Nacht. Heute muss man im Kopf rechnen. (S)
928. 🟠 Anzeige „€ pro Person und Nacht“ zusätzlich zu „pro Nacht“ und „pro Person“ (Reisende denken in diesem Wert). (S)
929. 🟠 Warnung bei unrealistischem Budget (z. B. unter 25 € pro Person und Nacht in einer Großstadt) und bei Budget 0. (S)
930. 🟠 Wochentage neben den Daten anzeigen („Di 08.12. → Sa 12.12.“) und bei Abreise vor Anreise rot markieren, statt still zu korrigieren. (S)
931. 🟠 Ein Datumsbereichs-Feld statt zwei Felder (Kalender mit zwei Klicks). (M)
932. 🟠 „Flexible Daten“-Schalter („irgendwann im Januar“): Airbnb-Link mit `flexible_trip_dates`. (M)
933. 🟠 Gästeanzahl getrennt von Personenliste: Kinder und Babys zählen auf Airbnb anders (`children`, `infants`). Heute geht jede Person als Erwachsener in den Link. (S)
934. 🟠 Hinweis zur Zimmerzahl: „5 Personen brauchen etwa 3 Schlafzimmer“ und `min_bedrooms` an den Link hängen. (S)
935. 🟠 Namensfeld: `maxlength`, `autocomplete="off"`, Vorschläge aus früheren Gruppen. (S)
936. 🟠 Person per Tastatur hinzufügen: Enter im letzten Namensfeld legt neue Zeile an und setzt den Fokus dorthin. Heute landet der Fokus nirgends. (S)
937. 🟠 Nach „+ Person hinzufügen“ Fokus auf das neue Namensfeld und Namen markieren. (S)
938. 🟠 Beispiel-Knopf: Text „Beispiel: 2 Party, 2 Chill, 1 Sightseeing“ ist lang. Als „Beispielgruppe laden“ mit Rückgängig. (S)
939. 🟠 Gruppe als Vorlage speichern („Mädelswochenende“, „Junggesellenabschied“) und wieder laden. (M)
940. 🟠 Gruppe per Text einfügen: „Lena Party, Mia Party, Jonas Chill“ → Zeilen. Praktisch aus dem WhatsApp-Chat. (M)
941. 🟠 Beim Tippen im Stadtfeld Vorschläge (Name + Land), damit „Paris“ nicht Texas ist. Fehlt als Auswahl, nicht nur als Autovervollständigung (Nr. 93). (S)
942. 🟠 Suchfeld mit „Aktueller Ort“-Knopf (Geolocation) für Reisen in der Nähe. (S)
943. 🟠 Beliebte Städte als Schnellwahl-Chips unter dem Feld (Barcelona, Lissabon, Rom, Wien …). Starter ohne Tippen. (S)
944. 🟠 Umkreis-Auswahl als Segment-Knöpfe mit kurzer Wirkung („500 m: alles zu Fuß“) statt `select`. (S)
945. 🟠 Umkreis „automatisch“: nimmt 2 km in Städten mit U-Bahn, 800 m sonst. (M)
946. 🟠 Erweiterte Einstellungen einklappen (Umkreis, Fairness, Entfernung zum Zentrum). Das Formular wirkt sonst überladen. (S)
947. 🟠 Datenschutz-Absatz unter dem Formular (`hint`) ist ein langer Textblock. Auf zwei Zeilen kürzen, Rest hinter „Mehr erfahren“. (S)
948. 🟠 Teilen-Text vor dem Klick (langer Satz im `hint`) ist bei jedem Besuch sichtbar. Erst nach Klick oder in einem Tooltip. (S)
949. 🟠 Ergebnisse bei Handy: Formular nach der Suche einklappen („Gruppe ändern“), damit die Karten sofort sichtbar sind. (S)
950. 🟠 Beim Ändern einer Person (Name/Typ) die Rangliste animiert umsortieren, damit man sieht, was sich geändert hat. (M)

## C. Ergebnisse und Erklärung 🟠

951. 🟠 Zahl „82“ ohne Skala. „82 / 100“ und ein Wort („sehr gut“, „gut“, „geht so“). (S)
952. 🟠 Ein-Satz-Fazit pro Viertel, automatisch erzeugt: „Gut für alle, nur Tom (58) vermisst Sehenswürdigkeiten.“ (S)
953. 🟠 Plätze, die fast gleichauf liegen, kennzeichnen: „Platz 1 und 2 trennt 1 Punkt“. Verhindert falsche Genauigkeit. (S)
954. 🟠 Kleine Auszeichnungen: „Bester Kompromiss“, „Beste Wahl für die Party-Fraktion“, „Ruhigste Nacht“, „Kürzester Weg zur Bahn“. (M)
955. 🟠 Alle Personen mit Wert unter 60 erklären, nicht nur die schwächste (`app.js:359` nimmt nur eine). (S)
956. 🟠 Chips anklicken: Aufschlüsselung „Lena 82 = Bars 40 + Cafés 20 …“. (M)
957. 🟠 Sortierung umschaltbar: „fairste Wahl“, „höchster Durchschnitt“, „Beste für [Person]“, „Beste für Budget“. Heute nur eine Sortierung. (S)
958. 🟠 „Mehr anzeigen“ unter den acht Karten (fest `pickDiverse(…, 8)`); nach Umkreisfilterung bleiben oft weniger als 8. (S)
959. 🟠 „Weitere Viertel in der Nähe“ je Karte: Die von `pickDiverse` unterdrückten Nachbarn sind nicht sichtbar, ihr Verschwinden wirkt wie ein Fehler. (M)
960. 🟠 Preis-Indikator je Viertel ohne echte Daten: Entfernung zum Zentrum und Dichte der Sehenswürdigkeiten ergeben „€ / €€ / €€€“. Grobe Näherung, klar so beschriftet. (M)
961. 🟠 „Geheimtipp“-Markierung: hoher Gruppenwert, aber wenig Sehenswürdigkeiten und weit vom Zentrum (meist billiger, ruhiger). (M)
962. 🟠 „Was wäre wenn“: „Ohne Tom wäre Eixample Platz 1“ oder „Wenn Jonas Party wählt, gewinnt Raval“. Zeigt, wo der Kompromiss steckt. (M)
963. 🟠 Wertung pro Kategorie als Mini-Balken je Karte (Party, Chill, Sehenswürdigkeiten, Essen, ÖPNV). Heute nur Zahlen im Text. (S)
964. 🟠 Absolute Zahlen mit Maßstab: „23 Bars, Stadtdurchschnitt 11“. Heute weiß man nicht, ob 23 viel ist. (S)
965. 🟠 Entfernung zur nächsten Bahnstation in Metern anzeigen („Metro 180 m“). Eine Zahl, die Gruppen wirklich nutzen. (S)
966. 🟠 Entfernung zum Zentrum/Hauptbahnhof pro Viertel („1,2 km zur Altstadt“). (S)
967. 🟠 Highlights anklickbar: Link zu OSM oder Google Maps, aber ohne Namen an einen dritten Dienst zu schicken (nur OSM-Link). (S)
968. 🟠 Hinweis bei Städten mit wenigen Daten („Nur 40 Orte erfasst, Ergebnis unsicher“). (S)
969. 🟠 Datenstand anzeigen („OpenStreetMap-Daten von heute / vom 3.11.“). Wichtig, sobald vorberechnete Städte laufen. (S)
970. 🟠 Beim Neuberechnen nach einer Änderung kurz hervorheben, welche Plätze sich verändert haben (+2, −1). (M)
971. 🟠 Ergebnis-Kopf: „Für 5 Personen, 4 Nächte, 500 € pro Nacht“ oberhalb der Karten als Bestätigung, was berechnet wurde. (S)
972. 🟠 Link „Karte öffnen“ je Viertel (OSM, Kreis bei diesem Viertel). (S)
973. 🟠 „Als Favorit merken“ je Viertel (Herz) und eigener Filter. Gruppen vergleichen oft zwei oder drei Kandidaten. (M)

## D. Karte 🟠🎨

974. 🎨 Im dunklen Modus bleibt die Karte hell und blendet. Kacheln per CSS-Filter (`invert` + `hue-rotate`) abdunkeln. (S)
975. 🟠 Die Kreise zeigen nur die Top 8. Alle gewerteten Viertel zeigen, eingefärbt nach Gruppenwert (Heatmap-Gefühl). (M)
976. 🟠 Nummerierte Marker statt Dauer-Tooltips: Bei drei Dauer-Tooltips (`permanent: i < 3`) überlappen sich Namen in dichten Gebieten. (S)
977. 🟠 Hover auf Karte hebt die Karte in der Liste hervor und umgekehrt (Karte ↔ Liste, ohne Nr. 96 doppelt: dort nur Scrollen). (S)
978. 🟠 Beim Laden schon die Stadtkarte zeigen (Geocoding ist nach 2 s fertig, Overpass braucht bis zu 60 s). Wartezeit wirkt kürzer. (S)
979. 🟠 Ausschnitt der ausgewerteten Fläche als Rahmen zeichnen („Nur dieser Bereich wurde bewertet“). Zu Nr. 670. (S)
980. 🟠 Schalter „Bars / Parks / Sehenswürdigkeiten / Bahn anzeigen“ (Nr. 100) mit Zähler. (S)
981. ♿ Karte hat kein `aria-label`/`role` und ist per Tastatur nicht nutzbar. Hinweis „Liste unten enthält dieselben Infos“. (S)
982. 🟠 Zoom-Standard auf die Top 3 statt auf alle 8, wenn Streuung groß ist. (S)
983. 🟠 Kartenkreise zeichnen den Airbnb-Suchausschnitt (Rechteck) mit, damit klar ist, was der Link zeigt. (S)

## E. Wertungslogik 🟢

984. 🟢 Zentrumsentfernung als Filter („maximal 3 km vom Zentrum“) für Gruppen, die nicht weit raus wollen. (S)
985. 🟢 Zentrum/Bahnhof frei wählbar als Ankerpunkt: Entfernung dorthin wird Teil der Wertung. (M)
986. 🟢 Wertung „Ankunftstag“: Entfernung zum Bahnhof oder Flughafen mit Gepäck, als eigener Mini-Wert. (M)
987. 🟢 Ruhe-Wert pro Viertel (Nr. 60 ist der Gedanke, aber dort nur Abzug). Hier: eigener Balken, den Chill-Typen sehen. (M)
988. 🟢 Nachtleben bis spät: Bars mit `opening_hours` bis nach 1 Uhr stärker zählen (Nr. 61 nennt es, hier die Anzeige „Spätbars: 12“). (M)
989. 🟢 Strand-Wert getrennt (Entfernung zum nächsten Strand in Metern), statt ihn in „Chillen“ zu mischen. (S)
990. 🟢 Cafés und Parks getrennt zählen: Heute ergibt dichte Innenstadt mit vielen Cafés sofort hohen Chill-Wert, ohne einen Park. (S)
991. 🟢 Grüne Fläche statt Parkanzahl (m² im Umkreis). Nr. 53 sagt „gewichten“, hier die Anzeige „viel Grün“. (M)
992. 🟢 Typ „Shopping“ (Läden, Einkaufsstraßen, Märkte). (S)
993. 🟢 Typ „Kultur“ (Theater, Konzert, Kino) getrennt von Sehenswürdigkeiten. (S)
994. 🟢 Typ „Sport“ (Fitness, Laufstrecken, Klettern). (S)
995. 🟢 Typ „Arbeiten“ (Coworking, ruhige Cafés mit WLAN) für Workation. (M)
996. 🟢 Typ „Kinder“ (Spielplätze, Zoo) ist als Familie vorhanden, aber ohne Spielplatz-Zählung. `leisure=playground` hinzufügen. (S)
997. 🟢 Typ „Barrierefrei“ (Aufzüge, ebene Wege, Bänke). (M)
998. 🟢 Typ „Vegan/vegetarisch“ (`diet:vegan`). (S)
999. 🟢 Typ „Fotospots“ (`tourism=viewpoint`, Murals). (S)
1000. 🟢 Kombinationen („Party + Foodie“) als Mischtyp, ohne zusätzliche Person. (M)

## F. Technik und Qualität 📦

1001. 📦 Funktionen `weakness`, `pickDiverse`, `categoriesOf` im Test (`tests/core.test.js`): Heute deckt der Test vor allem Plugin-Logik ab. Dazu einige Grenzfälle: 0 Personen, nur negative Gewichte, Viertel ohne Orte. (S)
1002. 📦 `index.json` ist `{}` (`web/data/index.json`): Die Vorab-Daten laufen nicht, jede Stadt dauert bis zu 1 Minute. Die 30 häufigsten Reiseziele vorab laden und im Deploy prüfen, dass `index.json` nicht leer ist. (S)
1003. 📦 `app.js` ist eine Datei mit 323 Zeilen. In `geo.js` (Geocoding + Overpass), `ui.js`, `share.js` teilen, damit Tests ohne Browser möglich sind. (M)
1004. 📦 Overpass-Abfrage aus `CATEGORIES` erzeugen (Nr. 540), dabei einen Test, der Abfrage und Kategorien abgleicht. (S)
1005. 📦 `compute()` in einen Web Worker verlegen: Bei Großstädten (14 000 Orte × 250 Viertel) bleibt die Seite sonst beim Tippen kurz hängen. (M)
1006. 📦 Räumliches Raster statt jedes-mit-jedem in `scoreAreas`: Faktor 20 schneller (Nr. 146 benennt das Problem, hier die Lösung mit Zellen von `r`). (M)
1007. 📦 Fehlertexte an einer Stelle sammeln und mit Fehlerklasse (Netz, Server, Leer) trennen, statt Regex auf `e.message`. (S)
1008. 📦 Kleine Telemetrie ohne Personenbezug (nur lokal, anzeigbar): Wie lange dauerte die Suche? Hilft, den Server-Wechsel zu beurteilen. (S)
1009. 📦 Ladeanzeige mit Fortschritt je Schritt („Stadt gefunden → Daten laden → Viertel bewerten“) als Schrittanzeige statt einer Textzeile. (S)
1010. 📦 `aria-busy` auf `#results` während der Suche. ♿ (S)

---

## Meine Top 10 daraus

1. **921** Knopf anheften: Heute ist die Hauptaktion auf dem Screenshot nicht sichtbar.
2. **901 + 902** Veraltete Ergebnisse und Verlust bei Fehler beheben (echte Fehler, keine Kür).
3. **1002** `index.json` füllen: Erste Suche von 60 s auf 1 s.
4. **911 + 912 + 913** Link und Speicher vollständig (Umkreis, Auto-Suche, Felder merken).
5. **903** Einheitlicher Radius (Karte = Wertung = Link).
6. **952 + 953** Ein-Satz-Fazit und „fast gleichauf“.
7. **962** „Ohne Tom wäre …“: Das ist der Kern der Gruppenidee, sichtbar gemacht.
8. **974** Dunkle Karte im Dunkelmodus.
9. **904 + 905** Doppelzählungen (Eingänge, Duplikate) entfernen: Wertung wird ehrlicher.
10. **957 + 958** Sortierung und „Mehr anzeigen“.

---

## Umsetzungsstand (Branch `feat/viertel-finder-runde4`, Basis `feat/airbnb-schneller`)

Die Liste wurde gegen den neueren Code geprüft. **Schon vorher da** (nicht neu gebaut): 915, 916, 917, 968, 977, 980, 981.

**Umgesetzt:** 901–914, 918–921, 923–930, 933–940, 943, 945–949, 951–967, 969–976, 978, 979, 982–984, 992 (Einkaufen), 994 (Sport), 996 (Kinder), 1000 (Mischtyp), 1001, 1004, 1006, 1010. Zusätzlich 910 (`form`, `inputmode`, `enterkeyhint`), 972 (OSM-Link), 973 (Favoriten).

**Nicht umgesetzt, mit Grund:**
- 922 (Typ als Chips), 931 (ein Datumsfeld), 932 (flexible Daten), 944 (Umkreis als Segmentknöpfe), 950 (animierte Umsortierung): reine Optik, bewusst zurückgestellt.
- 941, 942: brauchen einen zusätzlichen Dienst bzw. Standort (Content-Security-Policy und `Permissions-Policy` blockieren das heute).
- 985–991, 993, 995, 997–999: brauchen neue OSM-Felder oder Daten (Öffnungszeiten, Fläche, Barrierefreiheit, Coworking) und eine eigene Prüfung der Datenmenge.
- 1002: `web/data/index.json` bleibt leer. Vorladen belastet die freiwilligen Overpass-Server (10 Städte, je 30 s Pause) und sollte bewusst von Hand laufen: `node scripts/prefetch-cities.mjs`. Hinweis: Die Abfrage hat jetzt eine Spalte mehr (`shop`).
- 1003 (app.js teilen): In einer anderen Arbeit wird `app.js` gerade in `app-*.js` aufgeteilt. Das hier nicht doppelt tun.
- 1005 (Web Worker): Das Raster in `scoreAreas` (1006) bringt den größten Teil des Gewinns.
- 1007, 1008, 1009: nicht nötig bzw. nicht gewollt (keine Telemetrie).
