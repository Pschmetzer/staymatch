// Kopiert den gemeinsamen Code aus shared/ nach web/ und extension/ (mit Kopfzeile).
// Aufruf: node scripts/sync-core.mjs          → Kopien schreiben
//         node scripts/sync-core.mjs --check  → Fehler, wenn eine Kopie fehlt oder abweicht (CI)
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url);
// Datei → Ziele. i18n.js nur ins Plugin: die Website lädt es (noch) nicht, sonst würde totes Gepäck ausgeliefert.
const FILES = { 'core.js': ['web', 'extension'], 'i18n.js': ['extension'] };
const check = process.argv.includes('--check');

// Der Hinweis steht in der ersten Kommentarzeile, damit Zeilennummern (Stacktraces, Abdeckung) zu shared/ passen
const withHeader = (f, src) => {
  const head = `// GENERIERT aus shared/${f} – nicht bearbeiten! Änderungen in shared/${f}, dann: node scripts/sync-core.mjs`;
  return src.startsWith('// ') ? `${head} | ${src.slice(3)}` : `${head}\n${src}`;
};

let bad = 0;
for (const [f, targets] of Object.entries(FILES)) {
  const src = await readFile(new URL(`shared/${f}`, ROOT), 'utf8');
  const want = withHeader(f, src);
  for (const t of targets) {
    const dest = new URL(`${t}/${f}`, ROOT);
    const have = await readFile(dest, 'utf8').catch(() => null);
    if (have === want) continue;
    if (check) { console.error(`✗ ${t}/${f} weicht von shared/${f} ab – node scripts/sync-core.mjs ausführen`); bad++; }
    else { await writeFile(dest, want); console.log(`→ ${t}/${f}`); }
  }
}
if (bad) process.exit(1);
if (check) console.log('✓ Kopien aktuell');
