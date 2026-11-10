#!/bin/sh
# Prüft, baut das Plugin-ZIP und lädt web/ nach Vercel hoch (Auto-Deploy ist bewusst aus).
# Benötigt: Node, vercel-CLI (angemeldet). Optional: VERCEL_SCOPE=<team> für Team-Projekte,
# SITE_URL=<Adresse> für den Smoke-Test (Standard: https://staymatch-tau.vercel.app).
set -e
cd "$(dirname "$0")/.."

# Nur sauberer Stand, der nicht hinter origin/main liegt
if [ -n "$(git status --porcelain)" ]; then
  echo "Abbruch: ungesicherte Änderungen. Erst committen oder verwerfen." >&2; exit 1
fi
git fetch -q origin
if [ "$(git rev-list --count HEAD..origin/main)" -gt 0 ]; then
  echo "Abbruch: dieser Stand liegt hinter origin/main. Erst aktualisieren." >&2; exit 1
fi

echo "→ Tests und Prüfungen"
npm test
npm run check
SITE="${SITE_URL:-https://staymatch-tau.vercel.app}"
cd web
if [ -n "$VERCEL_SCOPE" ]; then vercel deploy --prod --yes --scope "$VERCEL_SCOPE"; else vercel deploy --prod --yes; fi
cd ..

echo "→ Smoke-Test $SITE"
for p in / /app /datenschutz /staymatch-plugin.zip.sha256; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE$p") || code=000
  [ "$code" = 200 ] || { echo "Fehler: $p liefert $code" >&2; exit 1; }
done
want=$(node -p "require('./extension/manifest.json').version")
got=$(curl -s "$SITE/staymatch-plugin.zip" | unzip -p /dev/stdin manifest.json 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version" 2>/dev/null || echo "?")
[ "$got" = "$want" ] || { echo "Fehler: ZIP hat Version $got, erwartet $want" >&2; exit 1; }
echo "Deploy ok (Plugin $want)"
