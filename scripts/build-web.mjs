// Baut die auslieferbare Seite: kopiert web/ nach dist/, minifiziert JS und CSS (esbuild aus tests/node_modules),
// hängt Inhalts-Hashes (?v=) an alle JS/CSS-Verweise und Städtedaten und füllt sw.js (Build-Version, Offline-Liste).
// Quellen in web/ bleiben unverändert und lesbar. Aufruf: node scripts/build-web.mjs [--check]
// Danach liefert scripts/deploy.sh dist/ aus. OUT=<Ordner> ändert das Ziel.
import { cpSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { join, dirname, basename, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(root, 'web');
const OUT = process.env.OUT ? resolve(process.env.OUT) : join(root, 'dist');
const require = createRequire(join(root, 'tests', 'noop.js'));
let esbuild;
try { esbuild = require('esbuild'); } catch { console.error('esbuild fehlt: npm ci --prefix tests --ignore-scripts'); process.exit(1); }

const hash = (buf) => createHash('sha256').update(buf).digest('hex').slice(0, 10);
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((d) => d.isDirectory() ? walk(join(dir, d.name)) : [join(dir, d.name)]);

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, { recursive: true, filter: (p) => basename(p) !== '.DS_Store' });

// 1) Minify. Klassische Skripte teilen sich den globalen Bereich: kein format/bundle, Top-Level-Namen bleiben erhalten.
const versions = {}; // 'app.js' → Hash
const sizes = [];
for (const f of readdirSync(OUT).filter((n) => /\.(js|css)$/.test(n) && n !== 'sw.js')) {
  const p = join(OUT, f);
  const code = readFileSync(p, 'utf8');
  const res = esbuild.transformSync(code, { loader: f.endsWith('.css') ? 'css' : 'js', minify: true, legalComments: 'none' });
  writeFileSync(p, res.code);
  versions[f] = hash(res.code);
  sizes.push([f, Buffer.byteLength(code), Buffer.byteLength(res.code)]);
}

// 2) Städtedaten: index.json verweist auf Dateien mit ?v=Hash (app.js hängt den Wert unverändert an 'data/' an)
const idxPath = join(OUT, 'data', 'index.json');
const dataFiles = [];
if (existsSync(idxPath)) {
  const idx = JSON.parse(readFileSync(idxPath, 'utf8'));
  for (const [k, file] of Object.entries(idx)) {
    if (typeof file !== 'string' || !existsSync(join(OUT, 'data', file))) continue;
    const v = hash(readFileSync(join(OUT, 'data', file)));
    idx[k] = `${file}?v=${v}`;
    if (!dataFiles.includes(idx[k])) dataFiles.push(idx[k]);
  }
  writeFileSync(idxPath, JSON.stringify(idx));
}

// 3) HTML: Verweise auf web/*.js und *.css bekommen ?v=Hash (vorhandenes ?v= wird ersetzt, nie doppelt)
let rewritten = 0;
for (const f of walk(OUT).filter((p) => p.endsWith('.html'))) {
  const html = readFileSync(f, 'utf8').replace(/\b(src|href)="((?:\.\.\/|\/)?)([\w.-]+\.(?:js|css))(?:\?v=[^"]*)?"/g, (m, attr, pre, name) => {
    if (!versions[name]) return m;
    rewritten++;
    return `${attr}="${pre}${name}?v=${versions[name]}"`;
  });
  writeFileSync(f, html);
}

// 4) Service Worker: Offline-Liste aus app.html (alles Lokale, was die App-Shell lädt) + Build-Version
const sw = join(OUT, 'sw.js');
if (existsSync(sw)) {
  const appHtml = readFileSync(join(OUT, 'app.html'), 'utf8');
  const shell = new Set(['/app', '/manifest.webmanifest', '/data/index.json']);
  for (const m of appHtml.matchAll(/\b(?:src|href)="(?!https?:|data:|#|\/\/)([^"]+\.(?:js|css|woff2|svg|png|webmanifest))"/g)) shell.add('/' + m[1].replace(/^\//, ''));
  // Leaflet lädt app.html erst per Skript nach; gehört trotzdem in die Offline-Liste
  for (const l of ['/vendor/leaflet/leaflet.js', '/vendor/leaflet/leaflet.css']) shell.add(l);
  const list = [...shell].sort();
  const build = hash(list.join('\n') + list.filter((u) => u.includes('?v=')).join() + hash(readFileSync(join(OUT, 'app.html'))));
  const src = readFileSync(sw, 'utf8')
    .replace("/*BUILD*/'dev'", JSON.stringify(build))
    .replace('/*SHELL*/[]', JSON.stringify(list));
  if (src.includes('/*BUILD*/') || src.includes('/*SHELL*/')) throw new Error('sw.js: Platzhalter nicht ersetzt');
  writeFileSync(sw, esbuild.transformSync(src, { loader: 'js', minify: true, legalComments: 'none' }).code);
  versions['sw.js'] = build;
}

// Vercel-Projektverknüpfung (nur lokal vorhanden, nicht im Repo) für `vercel deploy dist/`
if (existsSync(join(SRC, '.vercel'))) cpSync(join(SRC, '.vercel'), join(OUT, '.vercel'), { recursive: true });

if (process.argv.includes('--check')) {
  for (const p of walk(SRC)) if (!existsSync(join(OUT, relative(SRC, p)))) { console.error(`Fehlt in dist/: ${relative(SRC, p)}`); process.exit(1); }
}
const MAX_JS = 115_000; // Budget für web/*.js nach Minify (Bytes; ausgeliefert zusätzlich mit Brotli)
const jsTotal = sizes.filter(([f]) => f.endsWith('.js')).reduce((n, [, , b]) => n + b, 0);
if (process.argv.includes('--check') && jsTotal > MAX_JS) { console.error(`Minifizierte JS zusammen ${jsTotal} > ${MAX_JS} Bytes`); process.exit(1); }
const kb = (n) => (n / 1024).toFixed(1);
for (const [f, a, b] of sizes) console.log(`${f.padEnd(14)} ${kb(a).padStart(6)} KB → ${kb(b).padStart(6)} KB`);
console.log(`dist/ fertig: ${Object.keys(versions).length} Dateien mit Hash, ${rewritten} Verweise, ${dataFiles.length} Datendateien`);
