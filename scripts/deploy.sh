#!/bin/sh
# Prüft, baut das Plugin-ZIP und lädt web/ nach Vercel hoch (Auto-Deploy ist bewusst aus).
# Benötigt: Node, vercel-CLI (angemeldet). Optional: VERCEL_SCOPE=<team> für Team-Projekte.
set -e
cd "$(dirname "$0")/.."
echo "→ Tests"
node --test tests/*.test.js
./scripts/build-plugin-zip.sh
cd web
if [ -n "$VERCEL_SCOPE" ]; then vercel deploy --prod --yes --scope "$VERCEL_SCOPE"; else vercel deploy --prod --yes; fi
