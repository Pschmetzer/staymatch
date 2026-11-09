// Prüft, dass Manifest, bridge.js und APP_URL (extension/core.js, früher popup.js) zusammenpassen und alle Dateien existieren.
import { readFileSync, existsSync } from 'node:fs';

const errors = [];
const manifest = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
const src = ['extension/core.js', 'extension/popup.js'].filter(existsSync).map((f) => readFileSync(f, 'utf8')).join('\n');
const appUrl = /const APP_URL\s*=\s*'([^']+)'/.exec(src)?.[1];
if (!appUrl) errors.push('APP_URL in extension/core.js oder popup.js nicht gefunden');
const appHost = appUrl ? new URL(appUrl).hostname : null;

const scripts = manifest.content_scripts || [];
const bridge = scripts.find((s) => (s.js || []).includes('bridge.js'));
if (!bridge) errors.push('Kein content_script mit bridge.js im Manifest');
const hostOf = (pattern) => /^https?:\/\/([^/:]+)/.exec(pattern)?.[1];

if (bridge && appHost) {
  const hosts = bridge.matches.map(hostOf);
  if (!hosts.includes(appHost)) errors.push(`bridge.js läuft nicht auf ${appHost} (APP_URL), nur auf: ${hosts.join(', ')}`);
  for (const h of hosts) if (h !== appHost && h !== 'localhost') errors.push(`bridge.js darf nicht auf ${h} laufen (nur APP_URL-Host und localhost)`);
  if (hosts.includes('localhost')) console.warn('Hinweis: localhost steht im Manifest (nur für Entwicklung gedacht, siehe IDEEN Nr. 595).');
}
for (const s of scripts.filter((s) => s !== bridge)) {
  for (const p of s.matches) {
    if (!/^https:\/\/www\.airbnb\.[a-z.]+\/\*$/.test(p)) errors.push(`Unerwartetes Muster für Airbnb-Skripte: ${p}`);
    if (hostOf(p) === appHost) errors.push(`Airbnb-Skripte dürfen nicht auf der App-Domain laufen: ${p}`);
  }
}
const files = [
  ...scripts.flatMap((s) => s.js || []),
  manifest.action?.default_popup,
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
].filter(Boolean);
for (const f of new Set(files)) if (!existsSync(`extension/${f}`)) errors.push(`Im Manifest genannt, fehlt aber: extension/${f}`);
if (!/^\d+\.\d+\.\d+$/.test(manifest.version || '')) errors.push(`Manifest-Version "${manifest.version}" ist nicht x.y.z`);

if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Domains und Dateien ok (App: ${appHost}, Version ${manifest.version})`);
