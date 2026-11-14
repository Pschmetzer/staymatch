#!/bin/sh
# Prüft, baut das Plugin-ZIP und lädt web/ nach Vercel hoch (Auto-Deploy ist bewusst aus).
# Benötigt: Node, vercel-CLI (angemeldet). Optional: VERCEL_SCOPE=<team> für Team-Projekte,
# SITE_URL=<Adresse> für den Smoke-Test (Standard: https://staymatch.pro).
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

# CI dieses Commits muss grün sein (lokal fehlen oft die DOM-Tests). Nur im Notfall: SKIP_CI_CHECK=1
if [ -z "$SKIP_CI_CHECK" ]; then
  if command -v gh >/dev/null 2>&1; then
    ci=$(gh run list --workflow CI --commit "$(git rev-parse HEAD)" --json status,conclusion \
      --jq '[.[] | select(.status == "completed")][0].conclusion // ""' 2>/dev/null || true)
    if [ "$ci" != success ]; then
      echo "Abbruch: CI für $(git rev-parse --short HEAD) ist nicht grün (${ci:-kein abgeschlossener Lauf}). CI abwarten oder SKIP_CI_CHECK=1." >&2; exit 1
    fi
  else
    echo "Hinweis: gh fehlt, CI-Status des Commits nicht geprüft." >&2
  fi
fi

echo "→ Tests und Prüfungen"
npm test
npm run check
SITE="${SITE_URL:-https://staymatch.pro}"
cd web
if [ -n "$VERCEL_SCOPE" ]; then vercel deploy --prod --yes --scope "$VERCEL_SCOPE"; else vercel deploy --prod --yes; fi
cd ..

# Bei jedem Fehler unten: Der Deploy ist schon live. Rollback: `vercel rollback` (Vorgänger-Deployment) im Projektordner web/
fail() {
  echo "Fehler im Smoke-Test: $1" >&2
  echo "Der Deploy ist bereits live. Rollback: cd web && vercel rollback  (oder im Vercel-Dashboard das vorherige Deployment promoten)." >&2
  exit 1
}

echo "→ Smoke-Test $SITE"
for p in / /en /app /datenschutz /impressum /staedte/rom /sitemap.xml /robots.txt /staymatch-plugin.zip.sha256; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE$p") || code=000
  [ "$code" = 200 ] || fail "$p liefert $code (erwartet 200)"
done
code=$(curl -s -o /dev/null -w '%{http_code}' "$SITE/diese-seite-gibt-es-nicht") || code=000
[ "$code" = 404 ] || fail "unbekannte Seite liefert $code (erwartet 404)"

# Header: nosniff überall, CSP je Route (nur /app darf Fremddienste, Startseite nicht)
hdr() { curl -sI "$SITE$1" | tr -d '\r' | grep -i "^$2:" || true; }
for p in / /en /app /staedte/rom; do
  hdr "$p" x-content-type-options | grep -qi nosniff || fail "$p: X-Content-Type-Options: nosniff fehlt"
  hdr "$p" content-security-policy | grep -q "default-src 'self'" || fail "$p: Content-Security-Policy fehlt"
done
hdr /app content-security-policy | grep -q nominatim || fail "/app: CSP erlaubt Nominatim nicht (Viertel-Finder wäre kaputt)"
for p in / /en /staedte/rom; do
  hdr "$p" content-security-policy | grep -Eq 'nominatim|overpass' && fail "$p: CSP ist zu weit (Fremddienste nur für /app)"
done

want=$(node -p "require('./extension/manifest.json').version")
zip=$(mktemp); trap 'rm -f "$zip"' EXIT # unzip braucht eine Datei, keine Pipe
curl -s -o "$zip" "$SITE/staymatch-plugin.zip"
got=$(unzip -p "$zip" manifest.json 2>/dev/null | node -p "JSON.parse(require('fs').readFileSync(0,'utf8')).version" 2>/dev/null || echo "?")
[ "$got" = "$want" ] || fail "ZIP hat Version $got, erwartet $want"
echo "Deploy ok (Plugin $want)"
