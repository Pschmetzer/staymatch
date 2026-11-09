#!/bin/sh
# Packt extension/ als ZIP für den Download auf der Website (web/staymatch-plugin.zip).
set -e
cd "$(dirname "$0")/.."
rm -f web/staymatch-plugin.zip
# Gleicher Inhalt → gleiche ZIP (feste Zeitstempel, feste Reihenfolge), versteckte Dateien in allen Ordnern raus
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
(cd extension && find . -type f ! -name '.*' ! -path '*/.*' | LC_ALL=C sort > "$TMP/list")
(cd extension && while read -r f; do mkdir -p "$TMP/x/$(dirname "$f")"; cp "$f" "$TMP/x/$f"; done < "$TMP/list")
# Veröffentlichte ZIP ohne localhost-Brücke (nur für die Entwicklung, fremde lokale Seiten könnten sonst eine Reise einspielen)
node -e "const f=process.argv[1],fs=require('fs'),m=JSON.parse(fs.readFileSync(f));for(const c of m.content_scripts)c.matches=c.matches.filter(x=>!x.startsWith('http://localhost'));fs.writeFileSync(f,JSON.stringify(m,null,2))" "$TMP/x/manifest.json"
TZ=UTC find "$TMP/x" -exec touch -t 202601010000 {} +
(cd "$TMP/x" && sed 's|^\./||' "$TMP/list" | TZ=UTC zip -qX -@ "$OLDPWD/web/staymatch-plugin.zip")
echo "web/staymatch-plugin.zip ($(wc -c < web/staymatch-plugin.zip) Bytes)"
