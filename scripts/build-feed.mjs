#!/usr/bin/env node
// Erzeugt web/feed.xml (Atom) aus CHANGELOG.md: ein Eintrag je Abschnitt „## [Version] - JJJJ-MM-TT“.
// Kein Tracking (keine Parameter in Links), keine Abhängigkeiten, deterministisch: Datum nur aus den Überschriften,
// nie aus der Uhr oder aus git, damit --check auf jedem Rechner dasselbe Ergebnis liefert.
// Aufruf: node scripts/build-feed.mjs [--check]   (--check: schreibt nichts, prüft nur, ob web/feed.xml aktuell ist)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'https://staymatch.pro';
const SOURCE = 'https://github.com/Pschmetzer/staymatch/blob/main/CHANGELOG.md';
const OUT = path.join(root, 'web', 'feed.xml');

const xml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]));
const html = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Inline-Markdown: nur `Code` und **fett**; alles andere bleibt Text
const inline = s => html(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');

// Kleines Markdown → HTML für Abschnitte des CHANGELOG (### Überschrift, - Liste, Absatz)
export function mdToHtml(md) {
  const out = []; let list = false, para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push('</ul>'); list = false; } };
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (!t) { flushPara(); closeList(); continue; }
    const h = /^###\s+(.*)$/.exec(t);
    if (h) { flushPara(); closeList(); out.push(`<h3>${inline(h[1])}</h3>`); continue; }
    const li = /^[-*]\s+(.*)$/.exec(t);
    if (li) { flushPara(); if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); continue; }
    if (list && /^\s+/.test(line)) { out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ` ${inline(t)}</li>`); continue; } // Fortsetzungszeile
    closeList(); para.push(t);
  }
  flushPara(); closeList();
  return out.join('\n');
}

// Abschnitte „## [Name] - Datum“ bis zur nächsten Überschrift zweiter Ebene; Link-Definitionen am Ende zählen nicht dazu
export function parseChangelog(text) {
  const entries = [], errors = [];
  const parts = text.split(/^## /m).slice(1);
  for (const part of parts) {
    const [head, ...rest] = part.split('\n');
    const m = /^\[([^\]]+)\](?:\s+-\s+(\d{4}-\d{2}-\d{2}))?\s*$/.exec(head.trim());
    if (!m) { errors.push(`Überschrift nicht verstanden: „## ${head.trim()}“`); continue; }
    if (!m[2]) { errors.push(`Abschnitt „${m[1]}“ ohne Datum (Format: ## [${m[1]}] - JJJJ-MM-TT)`); continue; }
    const body = rest.filter(l => !/^\[[^\]]+\]:\s*\S+/.test(l)).join('\n').trim();
    entries.push({ name: m[1], date: m[2], body });
  }
  return { entries, errors };
}

export function renderFeed(text) {
  const { entries, errors } = parseChangelog(text);
  if (errors.length) throw new Error(errors.join('\n'));
  if (!entries.length) throw new Error('CHANGELOG.md hat keine Abschnitte');
  const stamp = d => `${d}T00:00:00Z`;
  const updated = entries.map(e => e.date).sort().at(-1);
  const slug = n => n.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '');
  const title = e => /^\d/.test(e.name) ? `StayMatch ${e.name}` : `StayMatch: ${e.name} (Stand ${e.date})`;
  const items = entries.map(e => `  <entry>
    <title>${xml(title(e))}</title>
    <id>tag:staymatch.pro,2026:changelog:${xml(slug(e.name))}</id>
    <updated>${stamp(e.date)}</updated>
    <link rel="alternate" type="text/html" href="${xml(SOURCE)}"/>
    <content type="html">${xml(mdToHtml(e.body))}</content>
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!-- GENERIERT aus CHANGELOG.md – nicht bearbeiten! Neu erzeugen: node scripts/build-feed.mjs -->
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="de">
  <title>StayMatch: Änderungen</title>
  <subtitle>Neue Funktionen und Korrekturen an Plugin, Viertel-Finder und Website</subtitle>
  <id>tag:staymatch.pro,2026:changelog</id>
  <updated>${stamp(updated)}</updated>
  <link rel="self" type="application/atom+xml" href="${BASE}/feed.xml"/>
  <link rel="alternate" type="text/html" href="${BASE}/"/>
  <author><name>StayMatch</name></author>
  <icon>${BASE}/favicon.svg</icon>
${items}
</feed>
`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes('--check');
  let feed;
  try { feed = renderFeed(readFileSync(path.join(root, 'CHANGELOG.md'), 'utf8')); }
  catch (e) { console.error(e.message); process.exit(1); }
  if (check) {
    if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== feed) { console.error('web/feed.xml veraltet (node scripts/build-feed.mjs)'); process.exit(1); }
    console.log('web/feed.xml aktuell');
  } else { writeFileSync(OUT, feed); console.log('web/feed.xml erzeugt'); }
}
