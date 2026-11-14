// Findet deutsche Wörter in String- und Template-Literalen (Kommentare und Regex-Literale werden übersprungen).
const GERMAN = /[äöüÄÖÜß]|\b(und|nicht|mit|für|oder|ohne|bitte|noch|kein|keine|wenn|nur|bis|pro|Unterkunft|Unterkünfte|Nacht|Nächte|Seite|gesamt|Preis|Gast|Gäste|Personen|Wunsch|Wünsche|Suche|Fehler|Datei|Klick|Notiz|Lage|Viertel|Sterne|Bewertung|Bewertungen)\b/;

function literals(src) {
  const out = []; let i = 0, line = 1, prev = '', prevWord = '';
  const REGEX_AFTER = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === '\n') { line++; i++; continue; }
    if (c === '/' && n === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && n === '*') { const e = src.indexOf('*/', i + 2); const body = src.slice(i, e < 0 ? src.length : e + 2); line += (body.match(/\n/g) || []).length; i += body.length; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1; while (j < src.length && src[j] !== c && src[j] !== '\n') { if (src[j] === '\\') j++; j++; }
      out.push({ text: src.slice(i + 1, j), line }); i = j + 1; prev = 'x'; prevWord = ''; continue;
    }
    if (c === '`') {
      let j = i + 1, depth = 0, startLine = line;
      while (j < src.length) {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '\n') line++;
        if (depth === 0 && src[j] === '`') break;
        if (src[j] === '$' && src[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && src[j] === '{') depth++;
        if (depth > 0 && src[j] === '}') depth--;
        j++;
      }
      out.push({ text: src.slice(i + 1, j), line: startLine }); i = j + 1; prev = 'x'; prevWord = ''; continue;
    }
    if (c === '/') {
      const isRegex = REGEX_AFTER.has(prev) || ['return', 'typeof', 'case', 'in', 'of'].includes(prevWord);
      if (isRegex) { // Regex-Literal überspringen
        let j = i + 1, cls = false;
        while (j < src.length && src[j] !== '\n') { if (src[j] === '\\') { j += 2; continue; } if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false; else if (src[j] === '/' && !cls) break; j++; }
        i = j + 1; while (/[a-z]/i.test(src[i] || '')) i++; prev = 'x'; prevWord = ''; continue;
      }
    }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (/[\w$]/.test(src[j] || '')) j++; prevWord = src.slice(i, j); prev = 'x'; i = j; continue; }
    if (/\s/.test(c)) { i++; continue; }
    prev = c; prevWord = ''; i++;
  }
  return out;
}
// Einzelne ASCII-Wörter ohne Leerzeichen (Adressen, Dateinamen, Schlüssel wie "pro" oder "x@staymatch.pro") sind keine Oberflächentexte
const TECH = /^[\x21-\x7e]+$/;
function findGerman(src) { return literals(src).filter(l => GERMAN.test(l.text) && !TECH.test(l.text)); }
module.exports = { literals, findGerman, GERMAN };
