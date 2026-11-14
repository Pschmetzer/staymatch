// Runde 12: englischer Viertel-Finder. Jede Textquelle hat DE und EN: kein Schlüssel fehlt, Platzhalter stimmen, kein deutscher Text bleibt ungewrappt.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const web = path.join(__dirname, '..', 'web');
const I = require('../web/i18n.js');

// Quellen mit t('…'): Code, und je ein Wörterbuch (Name der Datei = i18n-en-<teil>.js)
const SOURCES = { scoring: ['scoring.js'], app: ['app.js'], extra: ['app-extra.js', 'gruppe.js'] };
for (const part of Object.keys(SOURCES)) { const f = path.join(web, `i18n-en-${part}.js`); if (fs.existsSync(f)) require(f); }
const read = f => fs.readFileSync(path.join(web, f), 'utf8');
// Kommentare und Zeilenende-Kommentare grob entfernen, Strings dabei nicht anfassen
const strip = src => src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => { let q = null, esc = false; for (let i = 0; i < l.length; i++) { const c = l[i]; if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (q) { if (c === q) q = null; continue; } if (c === '"' || c === "'" || c === '`') { q = c; continue; } if (c === '/' && l[i + 1] === '/' && l[i - 1] !== ':') return l.slice(0, i); } return l; }).join('\n');
// t('…') mit Schlüssel als reinem Zeichenketten-Literal ('…', "…" oder `…` ohne ${})
const CALL = /(?<![\w$.])t\(\s*('((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\$]|\\.|\$(?!\{))*)`)/g;
const unescape_ = s => s.replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
const keysOf = file => { const out = []; for (const m of strip(read(file)).matchAll(CALL)) out.push(unescape_(m[2] ?? m[3] ?? m[4])); return out; };
const holders = s => [...new Set([...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]))].sort().join(',');

for (const [part, files] of Object.entries(SOURCES)) {
  test(`i18n ${part}: Wörterbuch vorhanden, jeder t()-Schlüssel hat EN mit gleichen Platzhaltern`, () => {
    assert.ok(fs.existsSync(path.join(web, `i18n-en-${part}.js`)), `web/i18n-en-${part}.js fehlt`);
    const keys = files.flatMap(keysOf), miss = [], bad = [];
    for (const k of keys) {
      if (!Object.hasOwn(I.dict.en, k)) { miss.push(k); continue; }
      if (holders(k) !== holders(I.dict.en[k])) bad.push(`${k} → ${I.dict.en[k]}`);
      assert.ok(String(I.dict.en[k]).trim(), 'leer: ' + k);
    }
    assert.deepEqual(miss, [], 'fehlende EN-Texte');
    assert.deepEqual(bad, [], 'Platzhalter verschieden');
    assert.ok(keys.length > 0, 'keine t()-Aufrufe gefunden');
  });
  test(`i18n ${part}: Wörterbuch hat keine toten Einträge`, () => {
    const src = Object.fromEntries(Object.entries(SOURCES).map(([p, fs_]) => [p, new Set(fs_.flatMap(keysOf))]));
    const own = require(path.join(web, `i18n-en-${part}.js`));
    const dead = (own && own.keys || []).filter(k => !src[part].has(k));
    assert.deepEqual(dead, []);
  });
  test(`i18n ${part}: kein deutscher Text bleibt ungewrappt`, () => {
    const de = /[äöüÄÖÜß]|\b(und|oder|nicht|für|mit|der|die|das|dein|dir|du|wir|ihr|ist|sind|bitte|noch|kein|keine|Viertel|Stadt|Personen?|Fehler|Gruppe|Wünsche)\b/;
    const bad = [];
    for (const file of files) {
      strip(read(file)).split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        for (const m of line.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g)) {
          const s = m[1] ?? m[2] ?? m[3];
          if (!de.test(s) || /^[\w.#\[\]=:>~ ,*-]+$/.test(s) && !/[äöüÄÖÜß]/.test(s) && s.split(' ').length < 3) continue; // Selektoren, Bezeichner
          const before = line.slice(0, m.index);
          if (/(?<![\w$.])t\(\s*$/.test(before) || /\bt\(\s*$/.test(before)) continue; // Schlüssel selbst
          if (/(StayMatchI18n|I18N)\.|\.add\(/.test(before)) continue;
          if (/(?:console\.\w+|throw new Error|new Error|querySelector\w*|getElementById|require|import)\(\s*$/.test(before)) continue;
          bad.push(`${file}:${i + 1}: ${s.slice(0, 70)}`);
        }
      });
    }
    assert.deepEqual(bad, [], 'deutscher Text ohne t() (oder in die Ausnahmeliste, falls er nie angezeigt wird)');
  });
}
