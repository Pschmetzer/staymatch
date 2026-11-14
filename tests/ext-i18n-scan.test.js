// i18n: Keine hartkodierten deutschen Texte außerhalb der Übersetzungsdatei (extension/strings.js).
// Regex-Literale (Erkennung von Airbnb-Texten) und Kommentare zählt der Scanner nicht mit; echte Erkennungs-Stichwortlisten stehen in EXCEPT.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { findGerman, GERMAN } = require('./helpers/german-scan.js');
const D = require('./helpers/dom.js');
const EXT = path.join(__dirname, '..', 'extension');

// { datei, text: Teilstring des Literals, grund } – nur Erkennung (liest Airbnb-/Gastgeber-Texte), keine Oberfläche
const EXCEPT = [
  { datei: 'parse.js', text: 'Gäste-Favorit', grund: 'interne Kennung der Plakette in gespeicherten Daten; angezeigt wird sie über rank.badgeLabel()' },
  { datei: 'hints.js', text: 'heizung', grund: 'Erkennungsmuster (String.raw) für deutsche Bewertungstexte, kein Oberflächentext' },
  { datei: 'hints.js', text: 'wlan|wifi', grund: 'Erkennungsmuster (String.raw) für deutsche Bewertungstexte, kein Oberflächentext' },
];
// Generierte oder gemeinsame Dateien: core.js kommt aus shared/core.js (Website und Plugin), i18n.js ist der Motor, strings.js das Wörterbuch.
const SKIP = new Set(['i18n.js', 'strings.js', 'core.js']);

test('JS: keine deutschen String-/Template-Literale außerhalb von strings.js (Ausnahmen begründet)', () => {
  const bad = [];
  for (const f of fs.readdirSync(EXT).filter(f => f.endsWith('.js') && !SKIP.has(f))) {
    for (const l of findGerman(fs.readFileSync(path.join(EXT, f), 'utf8'))) {
      if (EXCEPT.some(e => e.datei === f && l.text.includes(e.text))) continue;
      bad.push(`${f}:${l.line}  ${JSON.stringify(l.text.slice(0, 70))}`);
    }
  }
  assert.deepEqual(bad, [], `${bad.length} deutsche Literale:\n` + bad.slice(0, 40).join('\n'));
});

test('Ausnahmeliste: jeder Eintrag hat einen Grund und trifft noch etwas (keine toten Einträge)', () => {
  for (const e of EXCEPT) {
    assert.ok(e.grund && e.grund.length > 10, 'Grund fehlt: ' + e.text);
    const hit = findGerman(fs.readFileSync(path.join(EXT, e.datei), 'utf8')).some(l => l.text.includes(e.text));
    assert.ok(hit, `toter Eintrag: ${e.datei} „${e.text}“`);
  }
});

test('HTML: deutscher Text nur mit data-i18n / data-i18n-attr (sonst bliebe er auf Englisch deutsch)', { skip: !D.JSDOM && 'jsdom' }, () => {
  const bad = [];
  for (const f of fs.readdirSync(EXT).filter(f => f.endsWith('.html'))) {
    const dom = new D.JSDOM(fs.readFileSync(path.join(EXT, f), 'utf8'));
    const doc = dom.window.document;
    const walker = doc.createTreeWalker(doc.body, 4);
    for (let n; (n = walker.nextNode());) {
      const tx = n.textContent.trim();
      if (!tx || !GERMAN.test(tx)) continue;
      if (n.parentElement.closest('script, style, [data-i18n]')) continue;
      bad.push(`${f}: Text „${tx.slice(0, 50)}“ in <${n.parentElement.localName}>`);
    }
    for (const el of doc.querySelectorAll('[placeholder], [title], [aria-label], [alt]'))
      for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {
        const v = el.getAttribute(a);
        if (v && GERMAN.test(v) && !(el.getAttribute('data-i18n-attr') || '').split(';').some(p => p.trim().startsWith(a + ':'))) bad.push(`${f}: ${a}="${v.slice(0, 40)}" ohne data-i18n-attr`);
      }
    dom.window.close();
  }
  assert.deepEqual(bad, []);
});
