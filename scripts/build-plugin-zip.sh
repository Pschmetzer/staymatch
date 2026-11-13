#!/bin/sh
# Packt extension/ als ZIP für den Download auf der Website (web/staymatch-plugin.zip).
# Optional: Zieldatei als erstes Argument (z. B. fürs Release). Benötigt das Programm "zip".
set -e
cd "$(dirname "$0")/.."

if ! command -v zip >/dev/null 2>&1; then
  echo "Fehler: 'zip' ist nicht installiert." >&2
  echo "  macOS:         ist vorinstalliert (sonst: brew install zip)" >&2
  echo "  Debian/Ubuntu: sudo apt-get install zip" >&2
  echo "  Windows:       WSL oder Git Bash verwenden" >&2
  exit 1
fi

OUT="${1:-web/staymatch-plugin.zip}"
case "$OUT" in /*) ABS="$OUT" ;; *) ABS="$PWD/$OUT" ;; esac
rm -f "$ABS"
# Aus einer Kopie bauen: extension/manifest.json bleibt unverändert.
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
cp -R extension/. "$TMP/"
# Bau zwischen zwei Releases: version_name mit Commit-Kurz-SHA, damit Fehlerberichte den Stand zeigen.
# Bei einem Tag-Bau (Release) bleibt die reine Versionsnummer.
VERSION=$(node -p "require('./extension/manifest.json').version")
SHA=$(git rev-parse --short HEAD 2>/dev/null || true)
TAGGED=$(git tag --points-at HEAD 2>/dev/null | grep -x "v$VERSION" || true)
if [ -n "$SHA" ] && [ -z "$TAGGED" ] && [ "${GITHUB_REF_TYPE:-}" != "tag" ]; then
  node -e '
    const fs = require("fs"), f = process.argv[1], m = JSON.parse(fs.readFileSync(f, "utf8"));
    m.version_name = `${m.version} (${process.argv[2]})`;
    fs.writeFileSync(f, JSON.stringify(m, null, 2) + "\n");
  ' "$TMP/manifest.json" "$SHA"
fi
# Versteckte Dateien (.DS_Store, .git*) auf jeder Ebene sowie Tests und Editor-Reste ausschließen.
(cd "$TMP" && zip -qr -X "$ABS" . \
  -x '.*' -x '*/.*' -x '__MACOSX/*' -x '*.test.js' -x '*.map' -x '*~' -x '*.swp')
# SHA-256 neben das ZIP schreiben (Prüfsumme für Nutzer und Release)
if command -v sha256sum >/dev/null 2>&1; then SUM=$(sha256sum "$ABS" | cut -d' ' -f1); else SUM=$(shasum -a 256 "$ABS" | cut -d' ' -f1); fi
echo "$SUM  $(basename "$ABS")" > "$ABS.sha256"
echo "$OUT ($(wc -c < "$ABS") Bytes, SHA-256 $SUM)"
