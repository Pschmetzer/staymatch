// Einfache HTML-Prüfung ohne Abhängigkeiten (kein html-validate nötig).
// Prüft: Doctype, lang, title, charset, viewport, richtig geschachtelte Tags, doppelte IDs, <img alt>.
// Aufruf: node .github/scripts/check-html.mjs [Datei ...]   (Standard: web/**/*.html ohne vendor/data/media und extension/popup.html)
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const VOID = new Set('area base br col embed hr img input link meta source track wbr'.split(' '));
const OPTIONAL_END = new Set('p li dt dd tr td th thead tbody tfoot option optgroup colgroup caption'.split(' '));
const RAW = new Set(['script', 'style', 'textarea', 'title']);

function check(file) {
  const src = readFileSync(file, 'utf8');
  const errors = [];
  const line = (i) => src.slice(0, i).split('\n').length;
  const err = (i, msg) => errors.push(`${file}:${line(i)}: ${msg}`);

  if (!/^\s*<!doctype html>/i.test(src)) err(0, 'Doctype <!doctype html> fehlt am Anfang');
  const stack = [];
  const ids = new Map();
  let hasTitle = false, hasCharset = false, hasViewport = false, hasLang = false;
  const re = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:"[^"]*"|'[^']*'|[^'">])*)>/g;
  let m;
  while ((m = re.exec(src))) {
    if (m[0].startsWith('<!--')) continue;
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    const attrs = m[3];
    if (!closing) {
      if (name === 'html' && /\blang\s*=\s*["']?[a-z]/i.test(attrs)) hasLang = true;
      if (name === 'meta' && /\bcharset\b/i.test(attrs)) hasCharset = true;
      if (name === 'meta' && /name\s*=\s*["']?viewport/i.test(attrs)) hasViewport = true;
      if (name === 'img' && !/\balt\s*=/i.test(attrs)) err(m.index, '<img> ohne alt-Attribut');
      const id = /\bid\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
      if (id) {
        const v = id[1] ?? id[2] ?? id[3];
        if (ids.has(v)) err(m.index, `doppelte id="${v}" (erste in Zeile ${ids.get(v)})`);
        else ids.set(v, line(m.index));
      }
      if (VOID.has(name) || /\/\s*$/.test(attrs) && !RAW.has(name)) continue;
      if (RAW.has(name)) {
        const end = src.toLowerCase().indexOf(`</${name}`, re.lastIndex);
        if (end < 0) { err(m.index, `<${name}> wird nie geschlossen`); break; }
        if (name === 'title') hasTitle = src.slice(re.lastIndex, end).trim().length > 0;
        re.lastIndex = end; // schließendes Tag regulär verarbeiten
        stack.push({ name, at: m.index });
        continue;
      }
      stack.push({ name, at: m.index });
    } else {
      if (VOID.has(name)) { err(m.index, `</${name}> ist ein Void-Element`); continue; }
      let i = stack.length - 1;
      while (i >= 0 && stack[i].name !== name && OPTIONAL_END.has(stack[i].name)) i--;
      if (i < 0 || stack[i].name !== name) {
        const top = stack[stack.length - 1];
        err(m.index, `</${name}> passt nicht zu offenem <${top ? top.name : '–'}>${top ? ` (Zeile ${line(top.at)})` : ''}`);
        const j = stack.map((s) => s.name).lastIndexOf(name);
        if (j >= 0) stack.length = j;
      } else stack.length = i;
    }
  }
  for (const s of stack) if (!OPTIONAL_END.has(s.name)) err(s.at, `<${s.name}> wird nie geschlossen`);
  if (!hasLang) err(0, '<html lang="…"> fehlt');
  if (!hasTitle && !file.endsWith('popup.html')) err(0, '<title> fehlt oder ist leer');
  if (!hasCharset) err(0, '<meta charset> fehlt');
  if (!hasViewport && !file.endsWith('popup.html')) err(0, '<meta name="viewport"> fehlt');
  errors.push(...links(file, src, ids, err));
  return errors;
}

// Interne Anker (#id, /seite#id) und lokale Bildpfade (src, srcset, og:image) müssen existieren
const idCache = new Map();
function idsOf(f) {
  if (!idCache.has(f)) idCache.set(f, new Set([...readFileSync(f, 'utf8').matchAll(/\bid\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1])));
  return idCache.get(f);
}
function pageFile(p) { // cleanUrls: /x → web/x.html, / → web/index.html
  const q = p.replace(/^\//, '').replace(/\/$/, '') || 'index';
  return [`web/${q}`, `web/${q}.html`].find((x) => existsSync(x) && !x.endsWith('/'));
}
function links(file, src, ids, err) {
  const bare = src.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, (m) => m.replace(/[^\n]/g, ' '));
  const at = (re, fn) => { for (const m of bare.matchAll(re)) fn(m[1], m.index); };
    const localErrors = [];
  const e = (i, msg) => localErrors.push(`${file}:${src.slice(0, i).split('\n').length}: ${msg}`);
  at(/\bhref\s*=\s*["']([^"']+)["']/gi, (u, i) => {
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(u)) return;
    const [path, hash] = [u.split('#')[0].split('?')[0], u.includes('#') ? u.split('#')[1] : ''];
    if (!path && hash) { if (!ids.has(hash)) e(i, `Anker #${hash} hat kein Ziel auf der Seite`); return; }
    if (!path.startsWith('/')) return;
    if (/\.(css|svg|zip|xml|png|ico|txt|sha256)$/.test(path)) return;
    const pf = pageFile(path);
    if (!pf) { if (!/^\/(staymatch-plugin|\.well-known)/.test(path)) e(i, `Link ${u}: Seite fehlt in web/`); return; }
    if (hash && !idsOf(pf).has(hash)) e(i, `Link ${u}: #${hash} fehlt in ${pf}`);
  });
  const img = (u, i) => {
    if (!u || /^(https?:|data:)/i.test(u)) return;
    const f = u.startsWith('/') ? `web${u.split('?')[0]}` : `${file.replace(/[^/]*$/, '')}${u.split('?')[0]}`;
    if (!existsSync(f)) e(i, `Bild ${u} fehlt`);
  };
  at(/<(?:img|source)\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi, img);
  for (const m of bare.matchAll(/\bsrcset\s*=\s*["']([^"']+)["']/gi)) for (const part of m[1].split(',')) img(part.trim().split(/\s+/)[0], m.index);
  at(/<meta[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']https:\/\/staymatch\.pro(\/[^"']+)["']/gi, (u, i) => img(u, i));
  return localErrors;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    if (d.isDirectory()) return ['vendor', 'data', 'media'].includes(d.name) ? [] : walk(`${dir}/${d.name}`);
    return [`${dir}/${d.name}`];
  });
}
const files = process.argv.length > 2
  ? process.argv.slice(2)
  : [...walk('web').filter((f) => f.endsWith('.html')), 'extension/popup.html'];
const errors = files.flatMap(check);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`HTML ok (${files.length} Dateien)`);
