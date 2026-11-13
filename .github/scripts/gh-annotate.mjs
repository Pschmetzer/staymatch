// Test-Reporter für GitHub Actions: jeder fehlgeschlagene Test wird als Fehler-Annotation an Datei und Zeile gezeigt.
// Nutzung: node --test --test-reporter=spec --test-reporter-destination=stdout \
//            --test-reporter=./.github/scripts/gh-annotate.mjs --test-reporter-destination=stdout tests/*.test.js
import path from 'node:path';

const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escProp = (s) => esc(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

export default async function* annotate(source) {
  for await (const { type, data } of source) {
    if (type !== 'test:fail' || !data.file || data.todo) continue; // todo-Tests dürfen scheitern
    const err = data.details && data.details.error;
    // Nur Blätter melden (Unter-Tests tragen den Fehler), keine Fehlschläge nur wegen fehlgeschlagener Kinder
    if (err && err.failureType === 'subtestsFailed') continue;
    const cause = (err && (err.cause || err)) || {};
    const msg = (cause.message || String(cause)).split('\n').slice(0, 6).join('\n');
    const file = path.relative(process.cwd(), data.file);
    yield `::error file=${escProp(file)},line=${data.line || 1},title=${escProp(data.name)}::${esc(msg)}\n`;
  }
}
