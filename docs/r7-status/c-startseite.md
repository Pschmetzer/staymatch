# R7-C Status (Branch feat/r7-startseite)

Worktree: .claude/worktrees/agent-aac8405dc55aabac1
Commits: 21ddfa1 (Welle 1), ba09b28 (Welle 2), 9519544 (Welle 3), 69da61b (Nachtrag)

## Welle 1 (🔴)
- Live-Seite hängt hinter Repo → übersprungen (harter Stopp: Deploy). Nach Deploy live per curl canonical/robots/sitemap prüfen.
- Alte Vercel-Adresse doppelt (noindex tau) → übersprungen (harter Stopp: kann Bridge der Extension brechen).
- www.staymatch.pro kaputt → übersprungen (harter Stopp: DNS/Vercel-Domains).
- Grün/Orange im Hellmodus < 2,5:1 → umgesetzt (21ddfa1), Test tests/r7-kontrast.test.js.

## Welle 2 (🟠)
- security.txt Canonical → umgesetzt (ba09b28)
- Test gegen Alt-Domain in web/ → umgesetzt (ba09b28, tests/r7-startseite.test.js; core.js bewusst ausgenommen)
- Deploy-Abschluss prüft Host → übersprungen (Deploy-Prozess/scripts/deploy.sh nicht in meinem Dateibereich; harter Stopp Deploy)
- /favicon.ico 404 → umgesetzt (ba09b28, Redirect in vercel.json)
- HSTS includeSubDomains/preload → übersprungen (hängt an www-Reparatur = harter Stopp; preload wäre externe Eintragung)
- Hero-Knopf lädt direkt → umgesetzt (ba09b28)
- „Daten bleiben im Browser“ → umgesetzt (ba09b28, „Kein Tracking“, Leiste umformuliert)
- Beispiel-Panel Platz 2 → umgesetzt (ba09b28)
- „Suchen“ mehrdeutig → umgesetzt (ba09b28, Knopf eigene Zeile wegen Breite)
- EN-JSON-LD inLanguage → umgesetzt (ba09b28)
- operatingSystem → umgesetzt (ba09b28)
- Stadtseiten: Airbnb-Suche je Viertel → umgesetzt (ba09b28; Generator scripts/build-city-pages.mjs geändert, weil Stadtseiten generiert und per --check-Test geprüft werden; Test-Allowlist um www.airbnb.de erweitert) – Abweichung vom Dateibereich, bitte bestätigen
- WebP kaum kleiner → umgesetzt (ba09b28, q72; Ziel <70 KB nicht erreicht, 78–102 KB)
- Eingabefelder kaum sichtbar → umgesetzt (21ddfa1, --line2)
- Ghost-/Theme-Knopf Rand → umgesetzt (21ddfa1)
- Verlaufsüberschrift Hochkontrast → umgesetzt (ba09b28)
- Systemdunkel ignoriert → umgesetzt als Kommentar-Korrektur (ba09b28); Hell als Standard bleibt (bewusst seit #41)
- Markenhinweis → umgesetzt (ba09b28) – gegenlesen
- Deeplink trägt Reisedaten in Query → umgesetzt nur im Datenschutztext (ba09b28; app.js liest location.search und ist tabu) – gegenlesen
- Weitergabe an Airbnb → umgesetzt (ba09b28, Datenschutz) – gegenlesen
- GitHub als Empfänger → umgesetzt (ba09b28, Datenschutz) – gegenlesen

## Welle 3 (🟢 S/M), alle in Commit 9519544 außer wo anders vermerkt
### Live-Stand, Header, Caching
- Kurz-Umleitungen → umgesetzt (/plugin und /download → /#plugin)
- COOP → umgesetzt
- Eine CSP für alle Seiten (eigene CSP je Route) → braucht Entscheidung: Vorrang überlappender header-Regeln bei Vercel lokal nicht prüfbar (dev-server wendet nur /(.*) an); Fehler würde /app oder OSM-Kacheln brechen. Soll ich das splitten und auf einem Preview prüfen?
- CSP upgrade-insecure-requests/frame-src/worker-src/manifest-src → umgesetzt (app.js/app.html nutzen keine Worker, geprüft)
- CSP form-action für Airbnb → umgesetzt (zusammen mit No-JS-Formular)
- Schriften 1 Jahr Cache mit Versionsnamen → übersprungen: web/app.html (tabu) referenziert fonts/inter-latin.woff2, Umbenennen bräche den Viertel-Finder
- legal.css Cache → umgesetzt (?v=sha256-Präfix, max-age 1 Jahr immutable, Test prüft Version)
- Plugin-ZIP Dateiname mit Version → umgesetzt (download="staymatch-0.5.0.zip", Test gegen manifest.json; 69da61b: Hero-Knopf liest Namen aus dem Link)
- ZIP Cache-Verhalten → übersprungen: Datei behält festen Namen, max-age=0 bleibt richtig (Entscheidung hier dokumentiert)
### Hero und Conversion
- Gäste als Erwachsene → umgesetzt (Label „Erwachsene“/„Adults“)
- Schnellsuche ohne JS → umgesetzt (action Airbnb, Feld name=query)
- Eingaben merken → umgesetzt (sessionStorage sm_quick; 69da61b: alte Abreise nicht wiederherstellen) – Datenschutz-Satz ergänzt, gegenlesen
- Wochenend-Schnellwahl → umgesetzt („Nächstes Wochenende“, „Wochenende danach“ statt „In 2 Wochen“)
- Hinweis aufs Plugin nach Suchen → umgesetzt
- Plugin/Erweiterung gemischt → teilweise umgesetzt (Pill „Erweiterung (Plugin)“, Meta-Beschreibung „Chrome-Erweiterung“); restliche Begriffe bewusst gelassen (FAQ/JSON-LD-Texte)
- Zweiter Hero-Knopf kürzer → umgesetzt (auch Schlussabschnitt)
- Pill → umgesetzt („Kostenlose Erweiterung (Plugin) für Chrome, Edge und Brave“)
- Strip-Text → umgesetzt
- Für-wen-Karten mit Aktion → umgesetzt (/app?n=4 nicht möglich: Skript überschreibt data-app-Links mit Schnellsuche-Werten)
- Grenzen mit Ausweg → umgesetzt
- Final-Overlay über hellem Foto → umgesetzt (Original in beiden Modi, wohnung-hell-* gelöscht, wohnung-*.webp q50: 138 KB → 72 KB)
### Texte und Konsistenz
- Park Güell → umgesetzt
- „(2)“ erklärt → umgesetzt (Satz im Gruppen-Text)
- Gruppenbeispiel Typ statt Person → umgesetzt
- og.png Werte/„Beispiel“ → braucht Entscheidung: og.png muss mit scripts/og/ neu erzeugt werden (nicht in meinem Dateibereich)
- og.png-Logo ≠ Favicon → braucht Entscheidung (wie oben, plus Markenfarbe)
- Zwei Rottöne / Airbnb-„Rausch“ #ff385c → braucht Entscheidung: neue Markenfarbe? (betrifft auch App, Plugin, og.png)
- Datenschutz-Stand mit Version → umgesetzt (gegenlesen)
- „Kopiert ✓“ ansagen → umgesetzt (role=status)
- Kopier-Fehler still → umgesetzt (Text markieren, „Strg+C drücken“)
### DE/EN-Parität
- EN-Stadtkacheln Sprachhinweis → übersprungen: EN-Intro sagt bereits „The city pages are in German.“
- Sprachumschalter behält Position → umgesetzt (Hash oder aktiver Abschnitt)
- Sprachhinweis für fremdsprachige Browser → umgesetzt (beide Richtungen, Test)
- EN Privacy-Kurzfassung → umgesetzt (EN-FAQ „What happens to my data?“ mit Ankern; gegenlesen)
- EN „in German“ dreimal → umgesetzt (Plugin-Meta gekürzt)
- Parität der Zahlen → umgesetzt (Test)
- Parität head-Metadaten → umgesetzt (Test)
### SEO
- Rich-Result-Erwartung prüfen → übersprungen: externer Rich-Results-Test, keine Codeänderung; keine Bewertungen erfunden
- JSON-LD ans Ende von body → umgesetzt
- og:image:type, twitter:image:alt → umgesetzt
- max-image-preview:large → umgesetzt
- FAQ-Anker → umgesetzt (ids faq-*, öffnen per Hash, Test)
- Datenschutz-Anker → umgesetzt (FAQ verlinkt #viertel-finder)
- Meta-Beschreibung mit Chrome-Erweiterung → umgesetzt
- Datenschutz aus Sitemap → umgesetzt
- Stadtseiten „So rechnen wir“ → umgesetzt („Wie StayMatch rechnet“ → /#rechnen)
- Breadcrumb → umgesetzt
- Stadtseiten Plugin-Link → umgesetzt
- Stadtseiten Punkte erklärt → umgesetzt (Formulierung aus scoring.js abgeleitet: Normierung auf Stadt-Maximum je Kategorie)
- Stadtseiten theme-color/apple-touch-icon → umgesetzt
- Stadtseiten-Fußzeile gegliedert → umgesetzt
- Stadtseiten ohne Weg zu Unterkünften im Viertel → siehe Welle 2 (🟠, ba09b28)
### Performance und Medien
- Hintergrundbild q45 → umgesetzt (q50)
- Stadtkacheln zweite Größe → teilweise: Budget-Test (<900 KB, heute 808 KB) in tests/ statt check-size.mjs (.github/scripts nicht in meinem Bereich); zweite Größe nicht erzeugt
- content-visibility:auto → übersprungen: kann Ankersprünge und Scroll-Spy verschieben, lokal nicht zuverlässig prüfbar
- backdrop-filter unter 700 px → umgesetzt
- overflow-x clip → umgesetzt
- Glow nur Desktop → umgesetzt (unter 700 px aus)
- Puls endlos → umgesetzt (3 Durchläufe)
- Theme-Fotos nur im Viewport tauschen → übersprungen: lazy-Bilder laden beim Attributwechsel erst in Viewport-Nähe; das Schlussbild wird nicht mehr getauscht
- qnote innerHTML → umgesetzt (replaceChildren nur bei Änderung)
- Schrift-Preload auf Rechts-/Stadtseiten → umgesetzt
### Barrierefreiheit
- Kopieren-Knopf Größe → umgesetzt
- Navigationslinks Klickfläche → umgesetzt
- Sprachknopf Name → umgesetzt (title statt aria-label)
- h1 → h3 → umgesetzt (unsichtbare h2)
- aria-current location → umgesetzt
- FAQ-Plus → umgesetzt
- aria-describedby am Suchknopf → umgesetzt
- Datumsfehler sichtbar → umgesetzt (aria-invalid + Meldung, Test)
- Theme-Knopf title → umgesetzt
- Fokus Stadtkacheln → umgesetzt
- Token-Kontrasttest → umgesetzt (21ddfa1)
### Dark und Light
- Favicon Dunkel-Variante → übersprungen: kein konkreter Mangel (gefüllter Kreis ist auf hellen und dunklen Leisten sichtbar); hängt an der Markenfarben-Entscheidung
- theme-color zwei Werte per media → übersprungen: Seite startet bewusst Hell unabhängig vom System, Systemwert wäre falsch
- Rechtsseiten Umschalter → umgesetzt (Rechtsseiten/404 lesen sm_theme; Stadtseiten dürfen kein Skript haben → immer Hell wie Startseite-Standard)
### Mobile
- Handy-Hinweis unter die Knöpfe → umgesetzt
- Chips über Kartenrand → umgesetzt
- Datumsfelder iOS → umgesetzt (min-height 44 px; nicht auf echtem iOS geprüft)
- inputmode/type=number → umgesetzt
### Rechtliches (alle gegenlesen)
- Startseite/Stadtseiten im Datenschutz → umgesetzt – gegenlesen
- Speicherdauer Server-Protokolle → braucht Entscheidung: Vercel-Aufbewahrung je Plan nachsehen, nicht erfunden
- ZIP-HEAD im Datenschutz → umgesetzt – gegenlesen
- Impressum TMG → DDG → umgesetzt – gegenlesen
- MStV-Verantwortlicher → umgesetzt als Platzhalter „TODO Nutzer“ – gegenlesen/ausfüllen
- Stadtseiten Impressum-Link → umgesetzt
- 404 Impressum/Datenschutz → umgesetzt
- Haftungshinweis Punktwerte → umgesetzt (Impressum) – gegenlesen
- KI-Bild-Hinweis im Footer → umgesetzt (Link auf web/media/NOTICE.md auf GitHub)
- „keine Cookies“ präzisiert → umgesetzt – gegenlesen
- Referrer-Policy strenger → braucht Entscheidung (wie CSP-Split: Routen-Header bei Vercel lokal nicht prüfbar)
### 404
- „Meintest du …?“ → umgesetzt (Levenshtein + EN-Aliasse)
- Englische Stadtnamen → umgesetzt (Redirects lisbon/prague/rome/vienna)
- 404 Farb-Token → umgesetzt (404 nutzt legal.css)
### Impressum/Datenschutz Form
- Inhaltsverzeichnis → umgesetzt
- Code-Namen aufklappbar → umgesetzt – gegenlesen
- Impressum meta description → umgesetzt
- Datenschutz og-Tags → umgesetzt
- Drucklayout → umgesetzt
### Tests
- FAQ-Test per jsdom → umgesetzt (alter Regex-Test ersetzt)
- Hell-Varianten-Test → umgesetzt
- Stadtseiten-Fußzeilen-Test → umgesetzt
- CSP gegen Code-Hosts → umgesetzt
- Header-Test → umgesetzt
- noopener-Test → umgesetzt
- width/height-Test → umgesetzt
- data-app-Links-Test (jsdom) → umgesetzt
- EN-hreflang-Test → umgesetzt
### Inhalte und Vertrauen
- Letzter Commit beim Build → übersprungen: Startseite hat keinen Build-Schritt; bräuchte neues Skript außerhalb meines Bereichs
- Kontakt außer GitHub (E-Mail) → braucht Entscheidung: E-Mail-Adresse vom Nutzer
- Formel in Klartext → übersprungen: Liste „Wie wir rechnen“ erklärt es schon in Klartext; genaue Gewichte stehen in core.js und würden doppelt gepflegt
- Plugin-Bild weglassen → umgesetzt (plugin-*.jpg/webp gelöscht, per grep unbenutzt)
- Familie unter „Für wen?“ → braucht Entscheidung: fünfte Karte (Bild fehlt) oder eine Karte tauschen?
- Final-Abschnitt Schnellsuche → umgesetzt (Link „Oder direkt auf Airbnb suchen ↑“)

## Weitere Hinweise
- Zählung: 138 Einträge = 115 umgesetzt (davon 2 teilweise: Plugin/Erweiterung-Begriffe, Stadtkacheln nur Budget-Test) + 15 übersprungen (davon 3 harte Stopps) + 8 braucht Entscheidung.
- Abweichung Dateibereich: scripts/build-city-pages.mjs (nur Vorlage, nicht die Rangberechnung) und tests/r5-stadtseiten.test.js (Allowlist www.airbnb.de), weil die Stadtseiten generiert und per --check getestet werden.
- PRIVACY.md (nicht in meinem Bereich) ist jetzt hinter datenschutz.html; Datenschutz-Kopf sagt nun „Grundlage ist PRIVACY.md“ statt „dieselbe Fassung“. Bitte nachziehen.
- LUMINA-PROMPTS.md/NOTICE.md erwähnen evtl. noch wohnung-hell/plugin-Bilder (nur Doku).
- Rote Tests: 3 Fälle in tests/plugin-dom.test.js (Extension, nicht berührt), auf origin/main-Snapshot nachgeprüft: dort ebenfalls rot. Alle übrigen 208 Tests und check-html/links/size/domains grün.
- Nachtrag-Commit 69da61b: Download-Name aus Link, alte Abreise nicht wiederherstellen.
- COOP geprüft: weder app.js noch Extension nutzen window.opener/postMessage zwischen Fenstern; /app lokal mit neuen Headern getestet (Berlin, Kacheln, keine CSP-Meldung).
