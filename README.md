# StayMatch

🇬🇧 English · 🇩🇪 [Deutsch](README.de.md)

[![CI](https://github.com/Pschmetzer/staymatch/actions/workflows/ci.yml/badge.svg)](https://github.com/Pschmetzer/staymatch/actions/workflows/ci.yml)
[![License: code MIT, map data ODbL (see [THIRD_PARTY.md](THIRD_PARTY.md))](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Live demo](https://img.shields.io/badge/live-staymatch.pro-000000)](https://staymatch.pro)

Your helper for finding the right Airbnb faster. The Chrome extension scores every listing on the Airbnb search page by budget, honest star ratings and your wishes (entire place, Superhost, quiet …) and shows the **top 3 with reasons**. Optionally, the neighbourhood finder first picks the area that suits you. On top of that you get history, 👍/👎, notes and review keywords. Groups work too: the least satisfied person counts.

**Live:** https://staymatch.pro · Concept and roadmap: [KONZEPT.md](KONZEPT.md) (German)

## How it works
1. **Directly:** Open an Airbnb search and choose your budget per night and wishes in the StayMatch panel (entire place, no commercial hosts, Superhost, 20+ reviews, quiet/clean/Wi-Fi).
2. **Optionally first:** Enter city, dates, budget, interests and wishes in the neighbourhood finder → matching neighbourhoods. “See stays here” opens the search with dates, guests, price limit and map area; your wishes and budget are passed to the extension.
3. The extension scores every listing on the page (stars with a Bayesian average, price vs. budget, your wishes, the neighbourhood if known, beds for groups) and shows the **top 3 with reasons**. On a listing page it warns you when reviews contradict your wishes. When you page through results, listings from all pages are collected and the top 3 cover everything you have seen; a compare table and “copy top 3” help you decide. The extension runs in desktop Chrome only; the neighbourhood finder also works on mobile.

## Features
- **Extension:** options page (panel side, import, export, delete), toolbar badge with the number of matches, “since your last visit” (new, cheaper and vanished results), reminder before free cancellation ends with `.ics` export, a movable and dockable panel, labels per listing (“plan A/B”), a compare table for 2 to 4 listings, wishlist reading, top 3 as a printable page.
- **Neighbourhood finder:** 18 cities prefetched (data from OpenStreetMap), and **offline** afterwards (installable web app with a service worker). Deep link `?t=` for the trip type, confidence per neighbourhood, a note on how stable first place is, a quiet type, walking time, a shareable image card.
- **Group voting:** travel companions send their wishes as a link (in the `#p=` part of the address); there is no server and nothing is uploaded.
- **City comparison:** [staymatch.pro/en/compare](https://staymatch.pro/en/compare) (German: `/vergleich`) scores all prefetched cities with your wishes and shows the best neighbourhood per city.
- **City pages:** [staymatch.pro/en/cities](https://staymatch.pro/en/cities) (German: `/staedte`) with a profile, the best neighbourhoods per trip type and how it was calculated, without tracking.

## Web app (`web/`)
Static, no backend and no API keys.
```bash
npm run dev
```
Then open http://localhost:8765 (landing page) or http://localhost:8765/app (neighbourhood finder). The server sets the same headers as `web/vercel.json`; a plain `python3 -m http.server 8765 -d web` also works but does not know short addresses such as `/app`. Legal pages: `impressum.html` (placeholder, `TODO Nutzer`) and `datenschutz.html`. Hero image or video: see [LUMINA-PROMPTS.md](LUMINA-PROMPTS.md).

## Chrome extension (`extension/`)
Download as ZIP: https://staymatch.pro/staymatch-plugin.zip (built on deploy, locally with `./scripts/build-plugin-zip.sh`).

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → select the `extension/` folder

All data stays local in `chrome.storage.local`. The extension only reads pages you open yourself: no fetching of Airbnb pages or data, no background crawling, no intercepting of network traffic. The only network requests are the preview images of the top 3 in the panel, loaded from Airbnb’s image server without a referrer.

## Data and notes
- Places and neighbourhoods: © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors (ODbL), via Nominatim and Overpass. Prefetched city data and how it is built: [web/data/NOTICE.md](web/data/NOTICE.md).
- Not an official product and not affiliated with Airbnb. The extension only reads pages you open yourself.

License: code MIT, map data ODbL (see [THIRD_PARTY.md](THIRD_PARTY.md))

## Development
```bash
npm ci --prefix tests              # once: jsdom for the extension DOM tests (skipped otherwise)
npm test                             # tests
npm run check                        # all checks (syntax, HTML, sizes, city data, links, ZIP)
node scripts/sync-core.mjs           # copy shared/ to web/ and extension/ (after changing the core)
./scripts/deploy.sh                  # build ZIP + upload to Vercel (VERCEL_SCOPE=<team> optional)
node scripts/prefetch-cities.mjs [city ...]   # prefetch city data (web/data/), see CONTRIBUTING.md
node scripts/build-city-pages.mjs    # regenerate city pages (DE/EN), overviews and sitemap
```
Contributing: [CONTRIBUTING.md](CONTRIBUTING.md) · Privacy: [PRIVACY.md](PRIVACY.md) · Chrome Web Store: [STORE.md](STORE.md) · Security: [SECURITY.md](SECURITY.md)
