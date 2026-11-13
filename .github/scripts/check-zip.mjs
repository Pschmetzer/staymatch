// Prüft den Inhalt des Plugin-ZIPs: Manifest im Wurzelordner, keine versteckten Dateien, keine Tests.
// Aufruf: node .github/scripts/check-zip.mjs [pfad.zip]   (Standard: web/staymatch-plugin.zip; braucht "unzip")
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const zip = process.argv[2] || 'web/staymatch-plugin.zip';
let names;
try {
  names = execFileSync('unzip', ['-Z1', zip], { encoding: 'utf8' }).split('\n').filter(Boolean);
} catch (e) {
  console.error(`ZIP ${zip} nicht lesbar (fehlt oder "unzip" ist nicht installiert): ${e.message}`);
  process.exit(1);
}
const errors = [];
for (const n of names) {
  if (n.split('/').some((p) => p.startsWith('.'))) errors.push(`Versteckte Datei im ZIP: ${n}`);
  if (/(^|\/)(__MACOSX|node_modules|tests?)\//.test(n) || /\.test\.js$/.test(n)) errors.push(`Testdatei oder Ordner im ZIP: ${n}`);
  if (/\.(map|swp)$|~$/.test(n)) errors.push(`Editor-/Build-Rest im ZIP: ${n}`);
  if (n.startsWith('/') || n.includes('..')) errors.push(`Unsauberer Pfad im ZIP: ${n}`);
}
if (!names.includes('manifest.json')) errors.push('manifest.json liegt nicht im Wurzelordner des ZIPs');
else {
  // Manifest aus dem ZIP lesen (nicht von der Platte): ein altes ZIP fällt so auf
  let m;
  try { m = JSON.parse(execFileSync('unzip', ['-p', zip, 'manifest.json'], { encoding: 'utf8' })); } catch (e) { errors.push(`manifest.json im ZIP nicht lesbar: ${e.message}`); m = {}; }
  const disk = JSON.parse(readFileSync('extension/manifest.json', 'utf8'));
  if (m.version !== disk.version) errors.push(`ZIP hat Version ${m.version}, extension/manifest.json ${disk.version}: ZIP neu bauen`);
  const need = [...(m.content_scripts || []).flatMap((s) => s.js || []), m.action?.default_popup, ...Object.values(m.icons || {})];
  for (const f of need.filter(Boolean)) if (!names.includes(f)) errors.push(`Im ZIP fehlt ${f}`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`ZIP ok (${names.filter((n) => !n.endsWith('/')).length} Dateien)`);
