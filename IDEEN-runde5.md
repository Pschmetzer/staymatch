# Runde 5: Durchsicht des ganzen Repos (Web-App, Plugin, Tests/CI/Doku)

Stand: 10.11.2026, Basis `origin/main` (7e1a760). Drei Lesedurchgänge: `web/` + `scripts/`, `extension/` + `shared/`, `tests/` + `.github/` + Doku. Abgleich mit `IDEEN.md` und `IDEEN-runde4-viertel-finder.md` nur über Überschriften und Stichwortsuche, einzelne Dubletten sind möglich.

Nummern tragen den Präfix `R5-`, damit sie nicht mit den alten Nummern kollidieren.
Legende: 🔴 Fehler im Code gelesen · 🟠 Verbesserung · 🟢 neues Feature · 🔒 Sicherheit/Datenschutz · ♿ Zugänglichkeit.
**Nichts davon wurde gegen die echte Airbnb-Seite oder im Browser ausgeführt.** Stellen zu Airbnb-Selektoren, Labels und Domains sind aus dem Code abgeleitet. Fünf Punkte (R5-1, R5-2, R5-8, R5-26, R5-41) wurden zusätzlich per grep bestätigt.

Dateipfade: `ext/` = `extension/`.

---

## A. Sicherheit und Datenschutz 🔒

- R5-1 🔒 `web/app.js:674,680,685,699`: `bindTooltip` bekommt OSM-Namen als HTML-String. Ein Name wie `<img onerror=…>` läuft, weil die CSP `unsafe-inline` erlaubt. Namen escapen oder als DOM-Text setzen.
- R5-2 🔒 `ext/popup.js:13`: `safeUrl` mit `[a-z.]+` lässt `https://www.airbnb.evil.com/rooms/1` zu. Gegen `AIRBNB_DOMAINS` aus `core.js` prüfen.
- R5-3 🔒 `ext/popup.js:38,91-92`: Importierte `image`-URLs werden ungeprüft als `<img src>` gesetzt (Tracking-Pixel per Importdatei). Nur Airbnb-CDN zulassen, Typen und Längen prüfen.
- R5-4 🔒 `ext/popup.js:81-85`: CSV-Export ohne Schutz vor Formeln. Titel und Notizen, die mit `=`, `+`, `-`, `@` beginnen, bekommen ein `'` davor. UTF-8-BOM für Umlaute.
- R5-5 🔒 `ext/popup.js:38`: Das Popup lädt Bilder vom Airbnb-CDN. Das widerspricht `PRIVACY.md` („keine eigenen Anfragen an Airbnb“) und dem Popup-Text. Miniaturen beim Besuch lokal ablegen, oder Text ändern.
- R5-6 🔒 `ext/bridge.js:6-7`: Die Bridge kopiert `sm_trip` komplett, auch Namen der Mitreisenden, ohne Schema- oder Größenprüfung. Felder whitelisten, Längen begrenzen, Zahlen prüfen.
- R5-7 🔒 `ext/manifest.json`: kein `incognito`-Eintrag. Im Inkognito-Fenster entsteht trotzdem ein Besuchsverlauf. Dort nichts speichern.
- R5-8 🔒 `web/vercel.json:12`: `script-src 'unsafe-inline'` wegen zwei Inline-Skripten in `app.html`. Auslagern, dann streichen. Dazu `upgrade-insecure-requests`, `frame-src 'none'`, `worker-src`, `manifest-src`, `Cross-Origin-Opener-Policy`.
- R5-9 🔒 `web/datenschutz.html`, `PRIVACY.md`: „Vorab geladene Städte: noch nicht aktiv“ stimmt nicht mehr, `web/data/` hat 10 Städte. Für diese Städte entfallen Nominatim und Overpass.
- R5-10 🔒 `web/app.html`: Footer der App ohne Datenschutz- und Impressum-Link, obwohl die App Dienste Dritter anfragt. Der Datenschutz-Link zeigt auf `PRIVACY.md` bei GitHub statt auf `/datenschutz`.
- R5-11 🔒 `web/app.js:630`: OSM-Kacheln laden bei der ersten Suche, die IP geht an die OSM-Stiftung. Karte erst nach Klick laden.
- R5-12 🔒 `PRIVACY.md`: Es fehlen `lastSearch` (volle Such-URL), `quick`, `filters`, `settings`, `min:*` in der Liste der gespeicherten Felder. Die Pool-Frist „bis 2 Stunden“ stimmt nicht, `at` wird bei jedem Merge erneuert (`ext/pool.js:27,38`).
- R5-13 🔒 `web/app.html`: Es gibt keinen Knopf „Alle lokalen Daten löschen“ (das Plugin hat einen). Im localStorage stehen Namen Dritter (`sm_people`, `sm_groups`, `sm_trip`).
- R5-14 🔒 `web/app.js:713-717`: Teilen-Link enthält Klarnamen. Option „nur Initialen“.
- R5-15 🔒 `sm_trip` läuft nie ab. Nach dem Abreisedatum löschen.
- R5-16 🔒 Automatische Löschfrist für den Plugin-Verlauf (z. B. 6 oder 12 Monate nach `lastSeen`, 👍 ausgenommen).
- R5-17 🔒 `ext/popup.js:80`: JSON-Export enthält Notizen und die Reise samt Namen. Export-Dialog „ohne Namen/ohne Notizen“.
- R5-18 🔒 `/.well-known/security.txt` fehlt trotz `SECURITY.md`.
- R5-19 🔒 `ext/manifest.json`: `exclude_matches` für `/book/*`, `/account-settings/*`, `/hosting/*`, `/messaging/*`. Alle 8 Skripte laufen heute auf jeder Airbnb-Seite.
- R5-20 🔒 `PRIVACY.md:29`: offenes „TODO Nutzer“ (E-Mail, verantwortliche Stelle). Der Store verlangt eine Kontaktadresse.
- R5-21 🔒 Die ZIP-Datei trägt keine Prüfsumme auf der Seite. SHA-256 neben dem Download und im Build mitschreiben, dazu Provenance-Attestierung im Release.
- R5-22 🔒 `ext/content-common.js:11` schreibt `pschmetzer`, PRIVACY und STORE schreiben `Pschmetzer`. Vereinheitlichen.

## B. Fehler: Web-App 🔴

- R5-23 🔴 `web/app.js:15,202,413`: `store.get` prüft nicht auf Array. Steht in `sm_people` oder `sm_groups` ein Objekt, wirft `.map` beim Start und die App ist tot. Ohne Obergrenze friert eine manipulierte Liste mit 500 Personen die App ein. `Array.isArray` und `slice(0,30)`.
- R5-24 🔴 `web/app.js:735,752`: Öffnen eines Teilen-Links überschreibt per `save()` sofort Gruppe, Wünsche und Formular des Empfängers. Erst beim Suchen speichern oder Undo anbieten.
- R5-25 🔴 `web/app.js:447-453`: Bei leerer Ergebnisliste bleiben Kreise, Pins und POI-Punkte der letzten Rechnung auf der Karte.
- R5-26 🔴 `web/data/`: `rom.json` fehlt, obwohl Rom als Chip (`app.js:11`) und im Prefetch-`DEFAULT` steht. `scripts/prefetch-cities.mjs:59` meldet Fehler nur per `console.error`, Exit-Code bleibt 0. Rom lädt deshalb live bis zu 2 Minuten.
- R5-27 🔴 `web/app.js:352`: Bei vorab geladenen Städten ist `geo.lat/lon` die Mitte der Bounding-Box, nicht das Nominatim-Zentrum. Zentrumsabstand, „Nah am Zentrum“ und Preislage sind verschoben. `lat/lon` in die JSON schreiben.
- R5-28 🔴 `web/app.js:289`: Der Index-Treffer verlangt exakt `normCity`. „Barcelona, Spanien“ oder doppelte Leerzeichen laufen live statt aus `data/`.
- R5-29 🔴 `web/app.js:229,405`: Die Auswahl „Paris, Texas“ aus `showChoices` landet nicht im Formular oder Teilen-Link, danach ist es wieder Paris, Frankreich.
- R5-30 🔴 `web/app.js:266,301`: `cacheSet` speichert geparste Objekte statt des CSV-Texts, das 5-MB-Limit ist schnell voll. Rohtext cachen. Alter Cache (>24 h) wird auch bei Serverausfall ignoriert. Besser: alte Daten mit Hinweis zeigen.
- R5-31 🔴 `web/app.js:441`: Der Diversitätsfilter wirkt auch bei „Nur Favoriten“, zwei benachbarte Favoriten werden zu einem. „Mehr anzeigen“ (Zeile 461) erscheint fast immer, bringt aber oft nichts.
- R5-32 🔴 `web/scoring.js:236`: „Bester Kompromiss“ geht an `ranked[0]`, also auch bei Sortierung „Nächste Bahn“ oder „Günstig“. An `byTotal[0]` binden.
- R5-33 🔴 `web/scoring.js:244`: „Kürzester Weg zur Bahn“ wird auch bei 900 m vergeben. Schwelle ≤300 m.
- R5-34 🔴 `web/scoring.js:204`: „Gut für die meisten“ erscheint bei 2 Personen, auch wenn eine unter 60 liegt.
- R5-35 🔴 `web/scoring.js:54`: In `compareAreas` bekommt die höhere Zahl ein ✓, auch bei negativem Gewicht (mehr Bars für eine Chill-Gruppe ist kein Sieg).
- R5-36 🔴 `web/scoring.js:8-19`: `custom: {}` oder `[]` gilt als wahr und ergibt lauter Nullgewichte statt Preset.
- R5-37 🔴 `web/scoring.js:173`: Alle Regler auf 0 ergeben überall 100 und „Passt gut zu dir“. Hinweis „Nichts gewählt“.
- R5-38 🔴 `web/scoring.js:271-278`: `parseGroup`-Typwörter sind nicht am Wortanfang verankert. „Jessen“ wird Foodie, „Stadler“ Sightseeing. Bindestrich-Namen werden zerlegt („Hans-Peter“).
- R5-39 🔴 `web/app.js:71`: `new Date('YYYY-MM-DD')` ist UTC, `format` rechnet lokal. Westlich von UTC steht der Wochentag einen Tag zu früh. `timeZone:'UTC'`.
- R5-40 🔴 `web/app.js:80`: Liegt die neue Anreise nach der Abreise, geht die Aufenthaltsdauer verloren (Abreise = +1 Tag). Dauer erhalten.
- R5-41 🔴 `web/core.js:13`: ÖPNV zählt nur `railway=station|subway_entrance` und `public_transport=station`. `railway=tram_stop` fehlt. In Wien, Prag, Amsterdam und Budapest ist der ÖPNV-Wert deshalb zu niedrig.
- R5-42 🔴 `web/core.js:51`: `historic` nur als Node, Burgen, Kirchen und Denkmäler als Fläche fehlen. `nwr` und `castle/memorial/ruins`.
- R5-43 🔴 `web/app.js:161,497`: `kids` und `babys` werden nur nach unten begrenzt (99 oder 1,5 gehen an Airbnb). `scoring.js:289-296`: ab 17 Erwachsenen ungültige URL.
- R5-44 🔴 `web/app.js:764`: `saveTrip` übergibt nur `name/type`, nicht `type2`, `custom`, `veto`. Plugin und Web-App bewerten dieselbe Person dann verschieden.
- R5-45 🔴 `web/app.js:393`: Jeder `TypeError` wird zu „Keine Verbindung zum Kartendienst“. Eine CSP-Blockade (neuer Overpass-Host) sieht aus wie ein Netzfehler.
- R5-46 🔴 `web/app.js:661`: Bei einem einzigen Ergebnis zoomt `fitBounds` bis zur Maximalstufe. `maxZoom:14`.
- R5-47 🔴 `web/app.js:172`: Jeder Tastendruck im Budgetfeld baut alle Karten neu, Fokus und offene Details gehen verloren. Nur die Links aktualisieren.
- R5-48 🔴 `web/app.js:332`: Der Sekundenzähler steht in der aria-live-Region und wird hundertfach vorgelesen.
- R5-49 🔴 `web/app.js:376`: Viertel-Dubletten bei Namensteilen („Eixample“ und „Dreta de l'Eixample“). Ein Ort mit `place` plus POI-Tag wird nie als POI gezählt.
- R5-50 🔴 `web/app.js:212,216-220`: `prompt()` für Gruppennamen (in WebViews oft blockiert), `tplDel` ohne Rückfrage und Undo.
- R5-51 🔴 `web/app.js:778`: Plugin-Erkennung über festes `setTimeout(800)`. Bei langsamem Laden fehlt der Hinweis.
- R5-52 🔴 `web/app.js:60`: Liegen die Daten im Teilen-Link in der Vergangenheit, werden sie still verworfen. Der Empfänger sieht Standarddaten ohne Hinweis.

## C. Bewertungslogik (Viertel-Finder) 🟠

- R5-53 🟠 `scoring.js:123-127`: `max` kommt aus allen Vierteln, auch aus gefilterten und vetoierten. Ein Hotspot drückt alle anderen. Max nach den Filtern bilden.
- R5-54 🟠 `scoring.js:42-45`: `VETO_LIMIT 0,5` ist relativ zum Stadtmaximum. In ruhigen Städten fällt das „lauteste“ Viertel mit 3 Bars raus. Mindestanzahl dazu.
- R5-55 🟠 `scoring.js:42,158`: Gleicher 800-m-Radius für „will ich“ und „stört mich“. Für „stört“ ein kleinerer Radius (~150 m).
- R5-56 🟠 `core.js:12`: `fast_food` zählt wie `restaurant`. Gewicht 0,5 oder getrennte Zählung.
- R5-57 🟠 `scoring.js:138`: Preislage ohne Stadtfaktor, Prag und Paris haben dieselbe €-Verteilung. Städteindex in `index.json`.
- R5-58 🟠 `scoring.js:146`: `isSecretTip` nutzt `best` aus allen Vierteln, `medCentre` nur aus `okAreas`. Gleiche Basis nehmen.
- R5-59 🟠 `scoring.js:219-228`: „Ohne Person X“ erst ab 3 Personen. Bei 2 Personen wäre es am aufschlussreichsten.
- R5-60 🟠 `scoring.js:184`: Mehrfach gerundet (Einzelwerte, `avg`, Endwert). Nur die Ausgabe runden.
- R5-61 🟠 `scoring.js:174`: 100 erreicht nur, wer in jeder Kategorie am Stadtmaximum liegt. Verdict-Schwellen an der echten Verteilung eichen (ungeprüft).
- R5-62 🟠 `app.js:428-431`: „relevant“-Filter mit Schwelle 0,5. Eine Person mit Chill 0,4 und Party 0,4 hat keine relevanten Kategorien. `typeInfo` zeigt ebenfalls nur ≥0,5.
- R5-63 🟠 Datenqualität: Ampel „Daten dünn“ pro Viertel und Stadt. `thinData` existiert schon, aber nur als Text.

## D. Bedienung, Design, Barrierefreiheit 🟠 ♿

- R5-64 ♿ `app.html:15`: Im hellen Theme haben `--dim` (~3,3:1), `--warn` und `--good` (~2,2:1) und `--accent` (~3,9:1) zu wenig Kontrast. `color-scheme` fehlt in `app.html` (Datepicker, Selects, Scrollbars bleiben hell).
- R5-65 ♿ Wichtige Infos (Geheimtipp, Platzwechsel, Preislage, Luftlinie) stehen nur im `title`. Auf Touch unsichtbar.
- R5-66 ♿ Fairness-Regler und Wunsch-Regler ohne Endbeschriftung und ohne sprechendes `aria-valuetext`. Checkbox „Nie“ klingt acht Mal gleich, `aria-label="Nie Party"`.
- R5-67 ♿ Kein Skip-Link in `app.html`. Das ♥ ist unter 24×24 px (WCAG 2.5.8). Wiederholte Linktexte („Unterkünfte hier auf Airbnb ansehen“, „Auf Karte ansehen“) ohne Viertelname im `aria-label`.
- R5-68 ♿ Nach dem Entfernen einer Person geht der Fokus verloren, nach der Suche bleibt er auf dem Knopf. Zusammenfassung („8 Viertel, Platz 1: X“) als Fokusziel.
- R5-69 ♿ Undo-Toast verschwindet nach 15 s ohne Pause bei Fokus oder Hover (WCAG 2.2.1). `#compare` meldet bei jedem Umschalten die ganze Tabelle per aria-live.
- R5-70 ♿ `app.html:125,133`: Theme uneinheitlich (`data-theme` nicht immer gesetzt), Theme-Knopf ohne Zustand.
- R5-71 🟠 `app.html`: kein Canonical, keine OG/Twitter-Tags, kein `theme-color`, kein `<noscript>`. `twitter:title` weicht in `index.html` von `og:title` ab.
- R5-72 🟠 Die Landing-Eingabe (Stadt, Daten, Gäste) wird nicht an `/app` übergeben. Deeplink `?c=Lissabon&n=2`, nützt auch Stadtseiten und QR-Codes.
- R5-73 🟠 `index.html:256-262`: Schnellstart-Formular ohne `min` bei Datumsfeldern, Abreise nicht an Anreise gekoppelt.
- R5-74 🟠 Karte: Mausrad fängt das Seiten-Scrollen ab, Karte nicht sticky, Kartenfilter starten alle aus, kleine Punkte ohne Legende.
- R5-75 🟠 Karten sind ~14 Zeilen hoch, 8 Karten ergeben ~110 Zeilen. Details in `<details>`, dazu Kompaktansicht als Tabelle.
- R5-76 🟠 `scroll-margin-top` fehlt, das Scrollen landet unter der 64-px-Nav. Mobile Tastatur korrigiert Städte (`spellcheck`, `autocapitalize`).
- R5-77 🟠 Wartezeit bis 2 Minuten: Skeleton-Karten und „Server 2 von 3“ statt leerer Fläche.
- R5-78 🟠 Sortier-`select` wird bei Namensänderung neu gebaut, der offene Dropdown schließt. Vergleich auf 2 Viertel begrenzt, der dritte Haken entfernt still den ersten.

## E. Plugin: Parser, Preise, Sprachen 🔴

- R5-79 🔴 `ext/parse.js:10`: `CUR` kennt `R$`, `MX$`, `¥`, `₹`, `SEK/NOK/DKK`, `lei` nicht. Auf .com.br und .mx wird `R$ 350` als `$` gelesen.
- R5-80 🔴 `ext/parse.js:144,117`: Bei Rabatten gewinnt der durchgestrichene Preis („896 € 702 €“). `discountedPrice`/`originalPrice` aus dem State nutzen.
- R5-81 🔴 `ext/parse.js:152`: `/verfügbar|available/` trifft auch „Nicht verfügbar“ und löst `multiUnit` falsch aus.
- R5-82 🔴 `ext/parse.js:14,16,42`: `TOTAL_RE`, `NIGHT_RE`, `REVIEW_WORD` ohne PT, EL, DA, FI, TR. In .com.br und .gr bleibt die Einheit geraten, Rating plus Zahl wird nicht gelesen.
- R5-83 🔴 `ext/parse.js:126,151`: Fehlt die Einheit im Label, gilt der Preis als Nachtpreis. Ein Gesamtpreis wird dann um den Faktor „Nächte“ falsch gewertet (`rank.js:104-113`). Plausibilitätsprüfung gegen den Median der Seite.
- R5-84 🔴 `ext/parse.js:46`: „4,92 (1 234)“ (FR, NBSP) scheitert komplett, auch der Sternewert geht verloren. Fallback über das `aria-label` der Sterne.
- R5-85 🔴 `ext/parse.js:48`: „Neu“ und „Lesefehler“ sind nicht unterscheidbar (beides `null`). `rank.js:253` warnt dann „noch keine Bewertungen“. `isNew` separat.
- R5-86 🔴 `ext/parse.js:63-71`: „1 gemeinsames Bad“, „1 Privatbad“ werden nicht erkannt. `details()` kennt nur DE/EN/FR/ES/IT, für NL, PT, PL, DA, SV, NO, FI, EL, CS bleiben Zimmer, Betten, Bäder `null`.
- R5-87 🔴 `ext/parse.js:54`: „Queensize-Bett“, „Kingsize-Bett“ (DE) nicht erkannt, Kinderbett und Couch zählen nicht als Schlafplatz. Betten und Schlafplätze sauber trennen (`rank.js:280`).
- R5-88 🔴 `ext/parse.js:88`: `localityFromTitle` liefert bei „Wohnung in Gràcia, Barcelona“ `null` (Komma bricht ab). Polnisch „w Krakowie“ passt nicht zu „Kraków“.
- R5-89 🔴 `ext/parse.js:97-105`: Fester Pfad `niobeClientData[0][1]…staysSearch`, nur `data-deferred-state-0`. Rekursive Suche nach `staysSearch` über alle `data-deferred-state-*`.
- R5-90 🔴 `ext/parse.js:115,139`: `atob` ohne Padding/Base64URL-Fix. Karten nur über `[data-testid="card-container"]`, kein Fallback über `a[href*="/rooms/"]`.
- R5-91 🔴 `ext/parse.js:216-217`: Ungültiges Datum ergibt `NaN` bei `nights`. `children`, `infants`, `pets` fehlen, der Bettenbedarf für Familien wird unterschätzt.
- R5-92 🔴 `ext/parse.js:213`: Flexible Daten und Monatsmiete werden nicht erkannt, Preise sind dann pro Monat. Preisbewertung aussetzen.
- R5-93 🔴 `ext/parse.js:213-218`: Filter der Suche (`price_max`, `min_beds`, `room_types[]`, `amenities[]`) werden nicht gelesen. `price_max` als Budget vorschlagen, `Entire home/apt` erfüllt „ganze Unterkunft“ automatisch.
- R5-94 🔴 `ext/parse.js:221` vs `ext/pool.js:7`: Zwei verschiedene Paging-Listen. Ändert sich ein solcher Parameter, wechselt der Pool-Key und die Sammlung wird zurückgesetzt. `searchKey`/`mergeSearchResults` in `parse.js` sind doppelt und ungenutzt.
- R5-95 🔴 `ext/parse.js:129,153`: Badges: State liefert Rohtext, DOM deutsche Fixlabels. Auf `loggingContext.badgeType` (`GUEST_FAVORITE`, `SUPERHOST`) normalisieren. Sonst greift der Favoriten-Bonus in FR/IT/NL/PT nie (`rank.js:176,335`).
- R5-96 🔴 `ext/parse.js:249,296,303`: Ruhezeit-Regex `[-–bisto]+` ist eine Zeichenklasse und frisst „ist“, „to“. Betrugs-Regex `signal\b` und `telegram` lösen bei harmlosen Sätzen aus.
- R5-97 🔴 `ext/parse.js:154`: `card.querySelector('img')?.src` kann ein Platzhalter oder Data-URI sein und landet im Speicher.
- R5-98 🔴 `ext/parse.js:173-177`: Ist der DOM-Preis noch nicht geladen, gewinnt der veraltete State-Preis (nach Datumswechsel falsch). Als „unsicher“ kennzeichnen.

## F. Plugin: Ranking 🟠

- R5-99 🔴 `ext/parse.js:247-320`: `houseRules`, `amenities`, `cancellation`, `hostInfo`, `scamSignals`, `touristTax` werden von keinem Content-Skript aufgerufen. `l.reviews`, `l.reviewTexts`, `l.scamSignals` werden nirgends gesetzt. `effectiveRating`, Duplikat-Hinweis und `scamWarnings` im Ranking sind damit im Plugin wirkungslos. Größter Hebel: einmal in `roomData()` verdrahten.
- R5-100 🔴 `ext/rank.js:224`: `priceScore` prüft `l.currency` nie, ein €-Budget wird mit £, CHF, zł verglichen. Währung beim Budget speichern, bei Abweichung Preisteil aussetzen.
- R5-101 🔴 `ext/content-search.js:63`: `ctx.adults` wird nie gesetzt, `resolvePeople` (Vorrang der Airbnb-Gästezahl, Mismatch-Warnung `rank.js:300`) ist im Plugin tot.
- R5-102 🔴 `ext/content-common.js:28-38`: `tasteFrom` (Mittel, ohne Währung) statt des besseren `R.buildTaste` (Median je Währung) im Einsatz.
- R5-103 🔴 `ext/content-search.js:57-58`: Reise-Zuordnung über gleiches Datum reicht aus, auch bei anderer Stadt. Stadt zusätzlich vergleichen. Wird die Reise verworfen, lautlos: Warnung „Reise passt nicht“ zeigen.
- R5-104 🟠 `ext/rank.js:37`: Bayes-Prior fest `C=4.6`, `m=20`. Prior aus dem Median der Seite oder des Pools. `rank.js:39`: Skala `(bay-4.2)/0.75` drückt alle 4,7–4,95 zusammen, Perzentile der Seite nutzen.
- R5-105 🟠 `ext/rank.js:233`: Ohne bekannte Teile gibt es 50, Konfidenz fehlt. „Datenlage 4/6“ anzeigen und unsichere Scores abwerten.
- R5-106 🟠 `ext/rank.js:98-100,280-282`: 2 Personen und 1 Bett ergibt 0,65 und „1 Betten für 2“. Paare teilen ein Bett, dazu Singular/Plural.
- R5-107 🟠 `ext/rank.js:306,176`: Favoriten/Superhost-Bonus zählt doppelt (steckt schon in der Note).
- R5-108 🟠 `ext/rank.js:172-175,207-210`: `WHOLE_PLACE` kennt „Entire rental unit“, „Logement entier“, „Intero appartamento“ nicht.
- R5-109 🟠 `ext/rank.js:302-303`: Nur besuchte Inserate bekommen Abzüge für Warnungen, unbesuchte nicht. Überlebensverzerrung. Als getrenntes Kennzeichen zeigen.
- R5-110 🟠 `ext/rank.js:81-88`: Preise <20 % des Seitenmedians (Lesefehler) bekommen 0,8. Als unplausibel markieren.
- R5-111 🟠 `ext/rank.js:15-19,20-29,34-40`: Nächstes Viertel bis 1500 m statt Interpolation, Teilnamen-Treffer (`needle.length>=4`, „Mitte“) ohne Stadtbezug.
- R5-112 🟠 `ext/rank.js:328-337` und `ext/content-search.js:11-18`: `filterListings` und `passes` doppelt gepflegt. `compareRows` ohne Hervorhebung des Besten, ohne Bäder, ohne Link.

## G. Plugin: Robustheit, Navigation, Speicher 🟠

- R5-113 🟠 `ext/content-common.js:156-162`: MutationObserver auf `document.body` der ganzen Domain plus `setInterval` alle 1000 ms, nie gestoppt. Auf `/s/*` und `/rooms/*` beschränken, Navigation API oder `popstate` nutzen.
- R5-114 🟠 `ext/content-common.js:146`: Reines Kartenverschieben setzt `SMC.search.reset()`, das Panel flackert, Budgeteingabe geht verloren.
- R5-115 🟠 `ext/content-common.js:15-21`: Lesen-Ändern-Schreiben ohne Sperre, zwei Tabs oder Notiz plus Vote überschreiben sich. Kein `try/catch` bei `storage.local.set`: bei vollem Kontingent schlägt es lautlos fehl.
- R5-116 🟠 `ext/content-common.js:61`: `onChanged` hört nur auf `settings`. Neue Reise aus dem Viertel-Finder wirkt erst nach Neuladen.
- R5-117 🟠 `ext/content-search.js:42`: Panel-Signatur nur `href + ids`, nachgeladene Preise und Sterne ändern sie nicht. Bei jeder Mutation werden `pool`, `lastSearch`, `quick` neu geschrieben.
- R5-118 🟠 `ext/content-search.js:162-179`: `applyBadges` mit `getComputedStyle` je Karte bei jeder Mutation. Dimmen per Textabgleich `w.includes('👎')` statt `l.rank.disliked`. Plakette kann Herz und Pfeile überdecken (`right:52px`).
- R5-119 🟠 `ext/content-listing.js:11-13`: Feste Verzögerung 2000 ms und nur ein `handleRoom` pro URL. Bewertungs-Stichworte (`hints.js`) wirken deshalb fast nie.
- R5-120 🟠 `ext/content-listing.js:19-21`: Preisregex nur DE/EN und Betrag vor Währung. `@graph` in JSON-LD wird nicht aufgelöst, der Review-Selektor `[data-testid*="review"]` ist zu breit.
- R5-121 🟠 `ext/content-listing.js:45-47,66`: Preisverlauf mischt Reisedaten, „seit erstem Besuch“ ist nach `slice(-30)` nicht mehr der erste Besuch. Datum je Preis speichern, nur gleiche Daten vergleichen.
- R5-122 🟠 `ext/content-listing.js:56-64`: Nach 👍/👎 wird das Panel neu gebaut, das Notizfeld geht verloren.
- R5-123 🟠 `ext/pool.js:32-36`: Überlauf-Logik wirft nach Einfügereihenfolge statt Alter weg. `KEEP` lässt Bild und `propertyId` weg.
- R5-124 🟠 `ext/content-common.js:129-135`: Tastenkürzel `Alt+Shift+Buchstabe` kollidiert unter Windows/Linux mit dem Layoutwechsel. Über `chrome.commands` konfigurierbar machen.
- R5-125 🟠 `ext/hints.js:23-34`: Verneinung nur 30 Zeichen davor, „laut, aber nicht schlimm“ zählt als Warnung. Muster nur DE/EN, FR/ES/IT fehlen.

## H. Plugin: Popup und Store 🟠

- R5-126 🟠 `ext/popup.js:87-95`: Import überschreibt Einträge ohne Zusammenführung (`visits`, neuere Notiz gehen verloren), ignoriert `trip`, meldet „N importiert“ nicht.
- R5-127 🟠 `ext/popup.js:56-70`: Verlauf ohne Suche, Sortierung und Limit, jedes Bild lädt. „Suche wieder öffnen“ fehlt, obwohl `lastSearch.url` gespeichert wird. Warnbadge für veraltete Preise (>24 h).
- R5-128 🟠 `ext/popup.js:115-118`: „Alles löschen“ leert auch Einstellungen. Getrennt: Verlauf, Zwischenspeicher, Reise.
- R5-129 ♿ `ext/popup.html:19`: Tabs ohne `tabpanel`, `aria-controls`, Pfeiltasten. Dunkelmodus deckt Buttons, Selects und Rahmen nur teilweise ab. Plakette: `title` nur per Hover, Kontrast `#d68a00` auf Weiß ~2,7:1.
- R5-130 🟠 `ext/manifest.json`: kein `minimum_chrome_version` (Code nutzt `.at`, `matchAll`, Optional Chaining), kein `default_locale`/`_locales`, kein `onInstalled`. Name weicht von `STORE.md` ab. Icons nur 16/48/128 und winzig (144–815 B), Store kann Platzhalter ablehnen. Localhost steht im Store-Build.
- R5-131 🟠 `STORE.md`: Single-Purpose-Text nennt nur die Suchbewertung. Fehlen: Datennutzung-Formular, Satz zu „Remote Code“, Testanleitung für Reviewer, Hinweis, dass das Popup Bilder vom Airbnb-CDN lädt. Länderliste (24) auf getestete Domains kürzen. Datenschutz-URL auf `/datenschutz` statt `PRIVACY.md`.

## I. Tests, CI, Release 🟠

- R5-132 🔴 `.github/workflows/release.yml`: kein `npm ci --prefix tests`. Die 21 DOM-Tests in `plugin-dom.test.js` werden still übersprungen, der Job bleibt grün. In CI bei fehlendem jsdom hart scheitern (`CI=1`).
- R5-133 🟠 `release.yml`: nur Node 22, nur `node --test`, nicht `npm run check`. Kein Abgleich `package.json`-Version gegen `manifest.json`. `--generate-notes` statt CHANGELOG-Abschnitt. Es gibt noch kein Tag, der Workflow wurde nie ausprobiert.
- R5-134 🟠 `ci.yml`: Online-Linkcheck bei jedem Push, kann an fremden 5xx scheitern (besser wöchentlich), kein `timeout-minutes`, kein npm-Cache. Actions nur per Tag, nicht per SHA gepinnt.
- R5-135 🟠 `.github/dependabot.yml`: nur `github-actions`, `tests/` (jsdom) fehlt.
- R5-136 🟠 `.github/scripts/check-size.mjs`: `web/app.js` hat 52 KB bei 60 KB Grenze, Frühwarnung ab 90 %. `web/data/` und Bilder fehlen im Check.
- R5-137 🟠 `tests/`: `web/app.js` (782 Zeilen) wird von keinem Test geladen. Fehlen außerdem: Tests für `web/data/*.json` (Felder, Bounding-Box, `index.json` ohne tote Verweise), Alias-Schlüssel gegen `normCity`, `manifest.json` Hosts gegen Content-Script-Matches, `sitemap.xml` gegen echte Seiten, Round-Trip des Teilen-Links mit Umlauten und manipuliertem Fragment, Sommerzeit bei Nächten, CSP-Hosts gegen `core.js`-Overpass-Liste.
- R5-138 🟠 Fixtures: Es gibt nur 2 Parser-Tests (`plugin-parse`). HTML-Fixtures je Airbnb-Domain und Sprache (de, com, fr, co.uk), datiert, als Frühwarnung. Die „live“-Kommentare in `parse.js` (Zeilen 3, 13, 52, 93, 164) sind ungeprüft.
- R5-139 🟠 Coverage-Schwelle (`--experimental-test-coverage`), Property-Tests für `scoring.js` (Score in [0,100], monoton im Budget), Leistungstest mit der größten Stadtdatei (`paris.json`, 1,7 MB), axe-core in jsdom für `app.html` und `index.html`.
- R5-140 🟠 `scripts/deploy.sh`: führt nur Tests und Build aus, nicht `npm run check`. Kein Abbruch bei ungesichertem Stand oder hinter `origin/main`, kein Smoke-Test nach dem Deploy (`/`, `/app`, ZIP-Version gegen Manifest).
- R5-141 🟠 `package.json`: `check:js` nutzt eine Shell-Schleife (Windows-unfreundlich), `check:zip` baut als Nebenwirkung das ZIP. `build-plugin-zip.sh` bettet Zeitstempel ein, jeder Build ist ein anderes Binary.
- R5-142 🟠 Entwicklung: `.nvmrc`, `.editorconfig`, `.githooks` für `sync-core --check`, Node-Devserver, der die CSP-Header aus `vercel.json` setzt (Python-Server hat sie nicht), `.devcontainer`.

## J. Doku und Lizenzen 🟠

- R5-143 🟠 `CHANGELOG.md`: 0.5.0 mit doppelten Überschriften, Version 0.4.0 fehlt, kein Datum, kein Vergleichslink. `CONTRIBUTING.md`: Beispiel `git tag v0.3.1` bei Version 0.5.0.
- R5-144 🟠 `README.md`: Befehle `node --test` statt `npm test`, jsdom-Hinweis fehlt. Hartkodierte Live-URL in mehr als 8 Dateien, zentrale Konstante mit Check.
- R5-145 🟠 `SECURITY.md`: „privates Projekt“ bei öffentlichem MIT-Repo. Reaktionsziel und Offenlegungsfrist fehlen.
- R5-146 🟠 `web/data/NOTICE.md`: 3 Zeilen, „(falls vorhanden)“ überholt, ODbL Share-Alike fehlt. `THIRD_PARTY.md` für Inter (OFL), Leaflet (BSD-2), OSM-Kacheln und Nominatim-Regeln. README: „Daten ODbL, Code MIT“.
- R5-147 🟠 `LUMINA-PROMPTS.md`: offene „TODO Nutzer“-Prompts, `web/media/` leer, „Lumina“ ist nirgends erklärt. Umsetzen oder entfernen.
- R5-148 🟠 `IDEEN.md` ist über 1000 Nummern lang und wird neu nummeriert. `check-domains.mjs` und die PR-Vorlage verweisen auf Nummern (z. B. 595). Besser Issues als Quelle oder eine kurze `ROADMAP.md` mit ~10 Punkten.
- R5-149 🟠 `CONTRIBUTING.md`: Satz zum Vercel-Auto-Deploy für Außenstehende unverständlich. Glossar (Viertel, Typ, Direkt-Modus, Pool) und Datenflussskizze Web → `bridge.js` → `chrome.storage` → `rank.js`. Englische Fassung für internationale Beiträge.
- R5-150 🟠 `README.md` und `README.de.md` ohne Abgleich der Abschnitte. `shared/i18n.js` ist ein leeres Gerüst, `t()` wird nirgends aufgerufen, wird aber in Web und Plugin mitkopiert.

## K. Daten und Städte 🟢

- R5-151 🟠 `scripts/prefetch-cities.mjs`: Städteliste fest im Skript. Auslagern in `scripts/cities.json` (Name, Aliase, OSM-Relation, Sprachen). `web/app.js` baut die Chips aus `data/index.json`.
- R5-152 🟠 Kein Mindestwert für `rows.length`, eine Teilantwort überschreibt eine gute Datei. Dateiname `norm(c)` ergibt „new york.json“ (Leerzeichen). Pause 30 s je Stadt ohne Wiederaufnahme.
- R5-153 🟠 Die Bounding-Box umfasst bei Paris und Barcelona auch Umland und Meer. Nach Verwaltungsgrenze filtern.
- R5-154 🟠 Daten sind 0,5–1,7 MB je Stadt (zusammen ~10 MB) und liegen im Git. Aggregat je Viertel (wenige 10 KB) oder Auslieferung außerhalb des Repos. `Cache-Control` für `/data/*` fehlt.
- R5-155 🟠 `web/vercel.json`: `immutable` ein Jahr auf `/fonts` und `/vendor` ohne Hash im Dateinamen, ein Leaflet-Update erreicht Stammnutzer nie. `robots.txt` lässt `/data/` crawlen. Kein `preconnect` für Kacheln, Nominatim, Overpass.
- R5-156 🟢 Monatlicher Workflow: Daten neu holen, PR mit Änderung. Frische-Anzeige „Stand der Daten“ in der App, CI-Warnung ab 12 Monaten.
- R5-157 🟢 Weitere Städte: Hamburg, München, Köln, Frankfurt, Leipzig, Dresden, London, Rom, Mailand, Florenz, Venedig, Neapel, Porto, Sevilla, Valencia, Kopenhagen, Stockholm, Krakau, Athen, Istanbul, Dublin, Edinburgh. Ferienregionen (Algarve, Costa Brava, Gardasee, Ostsee, Mallorca) brauchen neue Kategorien (Strand, Hafen).

## L. Neue Features 🟢

Web-App
- R5-158 🟢 Presets: Romantik, Nachteule, Frühaufsteher, Fotografie, Budget-Backpacker (Hostels, Imbiss).
- R5-159 🟢 Gewicht pro Person in der Gruppe (Geburtstagskind ×2), dazu Fairness-Streifen: „Platz 1 bleibt bis 80 %, dann wechselt er zu Y“.
- R5-160 🟢 „Wer verliert am meisten“ beim Platz-1-Viertel und das Gegenspieler-Paar mit dem Viertel, das beide am wenigsten ärgert.
- R5-161 🟢 Punkt-Check: Klick auf einen beliebigen Kartenpunkt bewertet genau diese Stelle (Pseudo-Viertel). Daraus Kompromiss-Heatmap.
- R5-162 🟢 Einzelreisende: Heimweg-Wert (Bars bis zur nächsten Station oder zum Nachtbus), Alltagszeile (Wäscherei, Apotheke, Geldautomat), „Nachtruhe“ als eigener Balken (Bars im 150-m-Nahbereich).
- R5-163 🟢 Stufenfrei zur Bahn (`wheelchair=*`), Hunde und Familie (`dog=yes`, `playground`), Lärmschicht für Städte mit offenen Lärmkarten.
- R5-164 🟢 Exporte: GeoJSON/KML der Top-Viertel, Druckansicht (`@media print`), Kompaktmodus als Tabelle, Reise-Steckbrief als reiner Text.
- R5-165 🟢 Städte per `<datalist>` aus `index.json` vorschlagen (ohne Nominatim-Autocomplete, das verboten ist). Tastaturkürzel (`/`, `J/K`, `F`).
- R5-166 🟢 Statische Stadtseiten `/staedte/barcelona` aus `data/*.json` per Skript („Beste Viertel für Paare/Familien/Party“), `FAQPage`- und `WebApplication`-JSON-LD, `llms.txt`, `lastmod` in `sitemap.xml`.
- R5-167 🟢 Overpass-Zwischenstand: veraltete Daten (`stale-if-error`) mit Hinweis „Stand TT.MM.“ anzeigen, statt nichts.
- R5-168 🟢 „Alle sehen, was drin steckt“: Live-Badge in der App, welche Hosts gerade kontaktiert werden (Nominatim, Overpass, Kacheln).

Plugin
- R5-169 🟢 Airbnb-Liste nach StayMatch-Wert sortieren (CSS `order`), nicht passende Karten wahlweise ausblenden statt abdunkeln.
- R5-170 🟢 Budget aus dem Airbnb-Filter (`price_max`) vorschlagen, Währungswechsel erkennen und Budget umrechnen (festes Kursset, kein Netz).
- R5-171 🟢 „Neu seit letzter Suche“ und „Preis gesunken“ direkt an der Karte, ohne Hintergrundabruf und ohne neue Rechte.
- R5-172 🟢 Entfernung zur Kartenmitte als Lagesignal (Koordinaten aus URL und State), Passt-Wert auch auf der Unterkunftsseite.
- R5-173 🟢 Popup: zwei Merkzettel-Einträge vergleichen, Filter nach Tag, Mini-Karte der Pins ohne Kacheln (SVG).
- R5-174 🟢 Popup-Knopf „Seite prüfen“ mit Ampel je Feld (Preis, Sterne, Betten, Koordinaten) und lokale Parser-Gesundheit (Zähler über Tage, Warnung bei Einbruch, kein Versand).
- R5-175 🟢 Panel: kompakter Modus (Mini-Leiste „Top 1: 87 · 54 €/Pers.“), Gründe zeigen („12 von 40 ausgeschlossen, weil …“), „Zweite Chance“-Liste für 👎 nach 14 Tagen, Dealbreaker als harter Ausschluss.
- R5-176 🟢 Endpreis inklusive Gebühren aus dem Buchungsbereich lesen und für Shortlist-Einträge speichern, in der Suche „Endpreis auf Detailseite prüfen“.
- R5-177 🟢 Mehr Hinweiskategorien (Straße, Nachtclub, Heizung, Check-in spät, Parkplatz) und Hinweise in Fremdsprachen.
- R5-178 🟢 Rückblick nach der Reise („Stimmte der Score?“), lokal gespeichert, speist das Geschmacksprofil.

## M. Wachstum, Geschäft, Marketing 📈

- R5-179 🟢 Open Source: Labels `good first issue` und `help wanted`, Vorlage „Stadt vorschlagen“, Discussions, `docs/ADDING-A-COUNTRY.md` und `docs/ADDING-A-PORTAL.md`, Firefox-Port als Einstiegsprojekt für Externe, `CODEOWNERS` für Manifest, CSP und PRIVACY, CodeQL.
- R5-180 🟢 i18n zuerst für Plugin-Store: `_locales/de|en` für Name und Beschreibung, dann Wörterbuch als JSON je Sprache, CI-Check auf fehlende Schlüssel. Hinweiswörter und Zahlenformate je Sprache testen.
- R5-181 🟢 Monetarisierung ohne Konflikt mit „kein Tracking“: Spendenhinweis, Preisalarm als einmalige Lizenz, Widget für Reiseblogger, Viertel-Daten als Dienst (ODbL verlangt offene Daten). Jede Affiliate-Idee setzt vorher die Anpassung von `PRIVACY.md`, STORE und Impressum voraus, und eine Rechtsprüfung der Airbnb-Bedingungen.
- R5-182 🟢 Launch-Plan als Datei (Reihenfolge: Chrome Web Store, Product Hunt, Reddit, Show HN), Pressekit-Seite, Demo-GIF mit klar als „Beispiel“ markierten Daten, OG-Bilder je Stadt aus `scripts/og/og.html`.

---

## Reihenfolge, die ich vorschlage

1. **Zuerst (klein, hohe Wirkung):** R5-1, R5-2, R5-3, R5-4 (Sicherheit), R5-9 und R5-10 (falscher Datenschutztext, Rechtslinks), R5-132 (Release ohne DOM-Tests), R5-26 (Rom).
2. **Danach:** R5-99 bis R5-102 (fertigen Parser verdrahten, Währung, Gästezahl, `buildTaste`), R5-41 (Tram), R5-32 bis R5-38 (Fehlauszeichnungen), R5-64 (Kontrast).
3. **Vor dem Store-Einreichen:** R5-20, R5-130, R5-131, R5-7, R5-19.
4. **Später:** Features (L), Stadtseiten (R5-166), weitere Städte (R5-157).
