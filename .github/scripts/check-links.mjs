// Prüft Links in den Markdown-Dateien im Repo-Wurzelordner.
// Immer: relative Dateien und #Anker. Mit --online zusätzlich externe Links (nur 404/410 zählen als Fehler).
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const online = process.argv.includes('--online');
const files = readdirSync('.').filter((f) => f.endsWith('.md'));
const slug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const anchors = (file) => new Set([...readFileSync(file, 'utf8').matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map((m) => slug(m[1].replace(/[`*_]/g, ''))));
const errors = [];
const external = new Map();

for (const f of files) {
  const text = readFileSync(f, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  const urls = [...text.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
  urls.push(...[...text.matchAll(/(?<![("<])\bhttps?:\/\/[^\s<>)\]]+/g)].map((m) => m[0].replace(/[.,;:]+$/, '')));
  for (const u of urls) {
    if (/^https?:\/\//.test(u)) {
      // Eigene Website: gegen web/ prüfen (neue Seiten sind vor dem Deploy noch nicht live; cleanUrls: /x → web/x.html)
      const own = /^https:\/\/(?:staymatch-tau\.vercel\.app|staymatch\.pro)(\/[^?#]*)?/.exec(u);
      if (own) {
        const p = (own[1] || '/').replace(/\/$/, '') || '/index';
        if (p.endsWith('.zip')) continue; // Zip entsteht erst beim Build (siehe .gitignore)
        if (![`web${p}`, `web${p}.html`, `web${p}/index.html`].some((x) => existsSync(x))) errors.push(`${f}: Seite fehlt in web/: ${u}`);
      } else if (!/^https?:\/\/(localhost|127\.0\.0\.1)/.test(u)) external.set(u, f);
    } else if (!/^(mailto:|tel:)/.test(u)) {
      const [path, hash] = u.split('#');
      const target = path ? resolve(dirname(f), decodeURIComponent(path)) : resolve(f);
      if (!existsSync(target)) errors.push(`${f}: Datei nicht gefunden: ${u}`);
      else if (hash && target.endsWith('.md') && !anchors(target).has(decodeURIComponent(hash).toLowerCase())) errors.push(`${f}: Anker nicht gefunden: ${u}`);
    }
  }
}

if (online) {
  const probe = async (url, method) => fetch(url, { method, redirect: 'follow', signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'staymatch-linkcheck' } });
  for (const [url, file] of external) {
    let status = 0;
    for (let i = 0; i < 2 && !status; i++) {
      try {
        let r = await probe(url, 'HEAD');
        if (r.status >= 400) r = await probe(url, 'GET');
        status = r.status;
      } catch { /* zweiter Versuch */ }
    }
    if (status === 404 || status === 410) errors.push(`${file}: toter Link (${status}): ${url}`);
    else if (!status || status >= 400) console.warn(`Warnung: ${url} nicht prüfbar (${status || 'keine Antwort'})`);
  }
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Links ok (${files.length} Dateien, ${external.size} externe${online ? ' geprüft' : ' nicht geprüft'})`);
