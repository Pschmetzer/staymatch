// Gebündelte Fremdbibliotheken (web/vendor) gegen die aktuelle npm-Version prüfen, weil Dependabot sie nicht sieht.
// Aufruf: node .github/scripts/check-vendor.mjs   (braucht Netz; Exit 1 = neuere Version vorhanden, Exit 0 auch bei Netzfehler)
import { readFileSync } from 'node:fs';

const LIBS = [{ name: 'leaflet', file: 'web/vendor/leaflet/leaflet.js', re: /Leaflet (\d+\.\d+\.\d+)/ }];
const gt = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; };
let stale = 0;
for (const l of LIBS) {
  const have = l.re.exec(readFileSync(l.file, 'utf8'))?.[1];
  if (!have) { console.error(`${l.file}: Version nicht lesbar`); process.exit(1); }
  let latest;
  try {
    const r = await fetch(`https://registry.npmjs.org/${l.name}/latest`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) throw new Error(r.status);
    latest = (await r.json()).version;
  } catch (e) { console.warn(`::warning::${l.name}: npm nicht erreichbar (${e.message}), übersprungen`); continue; }
  if (gt(latest, have)) { console.error(`::error::${l.name} ${have} gebündelt, npm hat ${latest}. Aktualisieren (web/vendor/${l.name}, Lizenz, NOTICE) oder Grund notieren.`); stale++; }
  else console.log(`${l.name} ${have} ist aktuell (npm: ${latest})`);
}
process.exit(stale ? 1 : 0);
