// Kopiert den gemeinsamen Code aus shared/ nach web/ und extension/ (mit Kopfzeile).
// Aufruf: node scripts/sync-core.mjs          → Kopien schreiben
//         node scripts/sync-core.mjs --check  → Fehler, wenn eine Kopie fehlt oder abweicht (CI)
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
const FILES = ['core.js', 'i18n.js'];
const TARGETS = ['web', 'extension'];
const check = process.argv.includes('--check');

let bad = 0;
for (const f of FILES) {
  const src = await readFile(new URL(`shared/${f}`, ROOT), 'utf8');
  const want = `// GENERIERT aus shared/${f} – nicht bearbeiten! Änderungen in shared/${f}, dann: node scripts/sync-core.mjs\n${src}`;
  for (const t of TARGETS) {
    const dest = new URL(`${t}/${f}`, ROOT);
    const have = await readFile(dest, 'utf8').catch(() => null);
    if (have === want) continue;
    if (check) { console.error(`✗ ${t}/${f} weicht von shared/${f} ab – node scripts/sync-core.mjs ausführen`); bad++; }
    else { await writeFile(dest, want); console.log(`→ ${t}/${f}`); }
  }
}
if (bad) process.exit(1);
if (check) console.log('✓ Kopien aktuell');
