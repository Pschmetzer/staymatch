#!/bin/sh
# Packt extension/ als ZIP für den Download auf der Website (web/staymatch-plugin.zip).
set -e
cd "$(dirname "$0")/.."
rm -f web/staymatch-plugin.zip
(cd extension && zip -qr -X ../web/staymatch-plugin.zip . -x '.*')
echo "web/staymatch-plugin.zip ($(wc -c < web/staymatch-plugin.zip) Bytes)"
