# Lumina: Bild- und Videoplätze

Platzhalter-Struktur. Die Landingpage hat im Hero einen Platz für ein Bild oder ein kurzes Video. **Solange keine Datei freigeschaltet ist, bleibt der Platz unsichtbar** und es gibt keine Anfrage und kein kaputtes Bild.

## Freischalten
1. Dateien in `web/media/` ablegen:
   - `lumina-hero.webp` und `lumina-hero.jpg` (16:9, 1280×720, je unter 150 KB)
   - optional `lumina-hero.mp4` (15–20 s, ohne Ton, unter 2 MB; wird bei „reduzierte Bewegung“ nicht abgespielt)
2. In `web/index.html` `<meta name="sm-lumina" content="off">` auf `on` setzen.
3. Lokal prüfen (`python3 -m http.server 8765 -d web`), hell und dunkel, Handy-Breite.

Alles wird selbst gehostet (keine externe Quelle). Das Bild ist Schmuck (`alt=""`). Wird es ein echter Screenshot, mit „Beispiel“ kennzeichnen und eine Beschreibung ergänzen.

## Regeln für alle Prompts
- Kein Airbnb-Logo, keine Marken, keine erkennbaren Personen, keine Schrift im Bild.
- Keine Zahlen, Zitate oder Nutzerstimmen im Bild.
- Farben passend zur Seite: Rot `#e0475b`, Orange `#ff8a5c`, dunkler Grund `#0b0b0d`.

## Prompts (Entwurf, vom Nutzer zu prüfen)
| Platz | Datei | Prompt |
|---|---|---|
| Hero | `lumina-hero.webp/.jpg` | TODO Nutzer: Prompt eintragen. Vorschlag: „Abstrakte Stadtkarte von oben mit weichen farbigen Kreisen (Viertel), fünf kleine Punkte in drei Farben, dunkler Hintergrund, rot-oranger Schein, ohne Schrift, 16:9“ |
| Hero-Video | `lumina-hero.mp4` | TODO Nutzer: Prompt eintragen. Vorschlag: „Langsamer Zoom auf eine abstrakte Stadtkarte, ein Kreis leuchtet auf, 15 Sekunden, ohne Schrift, nahtlose Schleife“ |

## Eingebaute Bilder (10.11.2026, Lumina, GPT Image 2.5 Sunburst, 16:9)
Reine Stimmungsbilder, KI-generiert, `alt=""`. Der Laptop-Bildschirm zeigt keine echte App-Oberfläche. Je 1280 und 640 px breit als WebP und JPG, jede Datei unter 150 KB.

| Platz | Datei | Prompt |
|---|---|---|
| „So geht's“ (Band über den Schritten) | `media/laptop-*` | „Open laptop on a wooden table by a window in a cozy holiday apartment, the screen shows an abstract dark city map with glowing soft red and orange circles and small colourful dots, no readable text on screen, a coffee cup and a passport next to it, evening city lights outside, cinematic travel photography, 35mm, shallow depth of field, no people, no text, no logos“ |
| „Auch für Gruppen“ (unter dem Text) | `media/gepaeck-*` | „Four colourful suitcases and backpacks standing together in the sunny entrance hall of a stylish holiday apartment, keys on a small wooden table, view into a living room with a big dining table for a group of friends, warm coral and orange afternoon light, editorial travel photography, 35mm, no people, no text, no logos“ |
| Schluss-Abschnitt (Hintergrund mit dunklem Verlauf) | `media/wohnung-*` | „Bright, airy holiday apartment in a European old town at golden hour, wide view from the living room through open French balcony doors onto terracotta rooftops and a distant river, linen sofa, wooden floor, plants, warm coral and orange sunset light, editorial travel photography, 35mm, shallow depth of field, no people, no text, no logos“ |

Der Hero-Platz (`sm-lumina`) bleibt aus: dort würde ein Bild die Knöpfe nach unten schieben.
