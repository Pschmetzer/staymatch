// Seitenskripte (web/theme-*.js, home-*.js, app-boot.js, app-ui.js, page404.js) stehen wegen der CSP (script-src 'self', ohne
// 'unsafe-inline') in eigenen Dateien. Tests, die Seiten wie früher mit Inline-Skript prüfen oder in jsdom ausführen, setzen sie hier wieder ein.
const fs = require('node:fs');
const path = require('node:path');
const web = path.join(__dirname, '..', '..', 'web');
const PAGE_SCRIPT = /<script src="\/?((?:theme-[a-z]+|home-[a-z]+|app-boot|app-ui|page404)\.js)(?:\?v=[0-9a-f]+)?"><\/script>/g;
const inlineScripts = (html) => html.replace(PAGE_SCRIPT, (_, f) => `<script>\n${fs.readFileSync(path.join(web, f), 'utf8')}</script>`);
module.exports = { inlineScripts, web };
