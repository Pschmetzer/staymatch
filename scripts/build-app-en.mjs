#!/usr/bin/env node
// Erzeugt aus web/app.html (deutsche Quelle) die englische Seite web/en/app.html.
// Übersetzt Textsegmente und sichtbare Attribute mit scripts/i18n-html-en.json; bricht ab, wenn ein sichtbares Segment fehlt.
// Aufruf: node scripts/build-app-en.mjs [--check]   (--check: schreibt nichts, prüft nur, ob die Datei aktuell ist)
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'web', 'app.html');
const DICT = path.join(root, 'scripts', 'i18n-html-en.json');
const OUT = path.join(root, 'web', 'en', 'app.html');
const BASE = 'https://staymatch.pro';
const INLINE = new Set(['a', 'span', 'b', 'strong', 'em', 'small', 'code', 'br']);
const TEXT_ATTRS = ['title', 'alt', 'placeholder', 'aria-label', 'aria-description'];
const META_TEXT = new Set(['description', 'og:title', 'og:description', 'og:site_name', 'twitter:title', 'twitter:description']);
const TOKEN = /<!--[\s\S]*?-->|<(script|style)\b(?:"[^"]*"|'[^']*'|[^>"'])*>[\s\S]*?<\/\1\s*>|<\/?[a-zA-Z](?:"[^"]*"|'[^']*'|[^>"'])*>|[^<]+|</g;

const tokenize = html => html.match(TOKEN) || [];
const tagName = tok => { const m = /^<\/?([a-zA-Z][\w-]*)/.exec(tok); return m ? m[1].toLowerCase() : null; };
const isTag = tok => tok[0] === '<' && /^<\/?[a-zA-Z]/.test(tok) && !/^<(script|style)\b/i.test(tok);
const plain = s => s.replace(/<[^>]*>/g, '').replace(/&[#\w]+;/g, ' ');
const letters = s => (plain(s).match(/\p{L}/gu) || []).length;
const collapse = s => s.replace(/\s+/g, ' ').trim();
const attr = (tag, name) => { const m = new RegExp('\\s' + name + '=(?:"([^"]*)"|\'([^\']*)\')', 'i').exec(tag); return m ? (m[1] ?? m[2]) : null; };
const setAttr = (tag, name, val) => tag.replace(new RegExp('(\\s' + name + '=)(?:"[^"]*"|\'[^\']*\')', 'i'), (m, p) => p + '"' + val + '"');

export function buildEn(srcHtml, dict) {
  const map = dict.map || {}, keep = new Set(dict.keep || []);
  const used = new Set(), missing = new Set();
  const lookup = (key, label) => {
    if (Object.hasOwn(map, key)) { used.add(key); return map[key]; }
    if (keep.has(key) || keep.has(collapse(plain(key)))) { used.add(key); return null; }
    missing.add(label + ': ' + key);
    return null;
  };

  // Pass 1: Textsegmente. Inline-Tags (a, b, small …) gehören zum Segment, wenn sie mitten im Fließtext stehen.
  const toks = tokenize(srcHtml);
  const isBoundaryTok = tok => /^<!--/.test(tok) || /^<(script|style)\b/i.test(tok) || (isTag(tok) && !INLINE.has(tagName(tok)));
  // Läufe aus Text und Inline-Tags: steht im Lauf außerhalb der Inline-Elemente kein Text (z. B. Reihe von Links), ist jedes
  // Element ein eigenes Segment; sonst ist der ganze Lauf (Fließtext mit <b>, <a> …) ein Segment.
  const solo = new Set();
  const runs = []; let run = [];
  toks.forEach((tok, i) => { if (isBoundaryTok(tok)) { runs.push(run); run = []; } else run.push(i); });
  runs.push(run);
  for (const r of runs) {
    let depth = 0, topText = false;
    for (const i of r) {
      const tok = toks[i];
      if (!isTag(tok)) { if (depth === 0 && letters(tok) >= 2) topText = true; continue; }
      const n = tagName(tok);
      if (n === 'br') continue;
      if (tok.startsWith('</')) depth = Math.max(0, depth - 1); else depth++;
    }
    if (!topText) for (const i of r) if (isTag(toks[i])) solo.add(i);
  }
  const out = toks.slice();
  let seg = [];
  const flush = () => {
    // unpaarige Inline-Tags am Rand (z. B. </a> nach einem Icon) bleiben außerhalb des Segments
    while (seg.length && isTag(toks[seg[0]]) && toks[seg[0]].startsWith('</')) seg.shift();
    while (seg.length && isTag(toks[seg[seg.length - 1]]) && !toks[seg[seg.length - 1]].startsWith('</') && tagName(toks[seg[seg.length - 1]]) !== 'br') seg.pop();
    if (seg.length) {
      const raw = seg.map(i => toks[i]).join('');
      if (letters(raw) >= 2) {
        const key = collapse(raw);
        const tr = lookup(key, 'Text');
        if (tr != null) {
          out[seg[0]] = raw.match(/^\s*/)[0] + tr + raw.match(/\s*$/)[0];
          for (const i of seg.slice(1)) out[i] = '';
        }
      }
    }
    seg = [];
  };
  toks.forEach((tok, i) => {
    if (isBoundaryTok(tok) || solo.has(i)) flush(); else seg.push(i);
  });
  flush();
  let html = out.join('');

  // Pass 2: Attribute und Adressen je Tag
  const SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/|#)/i;
  const abs = v => (v === '' || SCHEME.test(v)) ? v : '/' + v;
  const NAV = { '/': '/en', '/#plugin': '/en#plugin', '/vergleich': '/en/compare' };
  html = tokenize(html).map(tok => {
    if (/^<style\b/i.test(tok)) return tok.replace(/url\((['"]?)([^)'"]*)\1\)/g, (m, q, u) => 'url(' + q + abs(u) + q + ')');
    if (/^<script\b/i.test(tok)) return tok.replace(/^<script\b(?:"[^"]*"|'[^']*'|[^>"'])*>/i, o => { const v = attr(o, 'src'); return v == null ? o : setAttr(o, 'src', abs(v)); });
    if (!isTag(tok) || tok.startsWith('</')) return tok;
    const n = tagName(tok);
    if (n === 'a' && /\sclass="lang"/.test(tok)) return '<a class="lang" href="/app" hreflang="de" lang="de" aria-label="German version">';
    for (const a of ['src', 'href']) {
      const v = attr(tok, a);
      if (v == null || (n === 'link' && attr(tok, 'rel') === 'alternate')) continue;
      if (n === 'link' && attr(tok, 'rel') === 'canonical') continue;
      let nv = abs(v);
      if (a === 'href' && n === 'a' && Object.hasOwn(NAV, v)) nv = NAV[v];
      if (nv !== v) tok = setAttr(tok, a, nv);
    }
    if (n === 'a' && /\shref="\/(?:datenschutz|impressum)"/.test(tok) && attr(tok, 'hreflang') == null) tok = tok.replace(/^<a/, '<a hreflang="de"');
    for (const a of TEXT_ATTRS) {
      const v = attr(tok, a);
      if (v == null || letters(v) < 2) continue;
      const tr = lookup(collapse(v), 'Attribut ' + a);
      if (tr != null) tok = setAttr(tok, a, tr);
    }
    if (n === 'meta') {
      const key = attr(tok, 'name') || attr(tok, 'property');
      const c = attr(tok, 'content');
      if (META_TEXT.has(key) && c != null) {
        const tr = lookup(collapse(c), 'meta ' + key);
        if (tr != null) tok = setAttr(tok, 'content', tr);
      }
      if (key === 'og:url') tok += '\n<meta property="og:locale" content="en_US">';
    }
    if (n === 'link' && attr(tok, 'rel') === 'canonical') tok = setAttr(tok, 'href', BASE + '/en/app');
    if (n === 'meta' && attr(tok, 'property') === 'og:url') tok = setAttr(tok, 'content', BASE + '/en/app');
    if (n === 'html') tok = setAttr(tok, 'lang', 'en');
    return tok;
  }).join('');

  // Wörterbücher für die englischen Texte der Skripte direkt nach i18n.js laden
  const i18nTag = '<script src="/i18n.js" defer></script>';
  if (!html.includes(i18nTag)) missing.add('Skript: ' + i18nTag + ' fehlt in web/app.html');
  html = html.replace(i18nTag, i18nTag + ['scoring', 'app', 'extra'].map(p => `\n<script src="/i18n-en-${p}.js" defer></script>`).join(''));
  if (!/<link rel="alternate" hreflang="en"/.test(html)) missing.add('hreflang-Links fehlen in web/app.html');
  if (!/class="lang"/.test(html)) missing.add('Sprachumschalter (class="lang") fehlt in web/app.html');
  const unused = Object.keys(map).filter(k => !used.has(k));
  return { html, missing: [...missing], unused };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  const dict = JSON.parse(readFileSync(DICT, 'utf8'));
  const { html, missing, unused } = buildEn(readFileSync(SRC, 'utf8'), dict);
  if (missing.length) {
    console.error('Nicht übersetzt (in scripts/i18n-html-en.json unter "map" oder "keep" ergänzen):\n  ' + missing.join('\n  '));
    process.exit(1);
  }
  if (unused.length) console.warn('Hinweis: ungenutzte Wörterbuch-Einträge: ' + unused.join(' | '));
  if (check) {
    if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== html) { console.error('web/en/app.html veraltet (node scripts/build-app-en.mjs)'); process.exit(1); }
    console.log('web/en/app.html aktuell');
  } else {
    mkdirSync(path.dirname(OUT), { recursive: true });
    writeFileSync(OUT, html);
    console.log('web/en/app.html erzeugt (' + html.length + ' Zeichen)');
  }
}
