// Browser-Rauchtest: startet scripts/dev-server.mjs (gleiche Header wie web/vercel.json), lädt Startseite, Stadtseite und /app
// und schlägt fehl bei CSP-Verstößen, Konsolenfehlern oder seitenweiten Skriptfehlern. Playwright wird nur in CI installiert (NODE_PATH).
// Aufruf: node .github/scripts/e2e-smoke.mjs
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const PORT = 18900 + Math.floor(Math.random() * 500);
const srv = spawn(process.execPath, ['scripts/dev-server.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((res, rej) => { srv.stdout.once('data', res); srv.once('exit', rej); });

const problems = [];
const axeSrc = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); // per evaluate eingespielt (umgeht die CSP der Seite nur für die Prüfung)
const browser = await chromium.launch();
try {
  for (const path of ['/', '/en', '/staedte/rom', '/app']) {
    const page = await browser.newPage();
    // Overpass/Nominatim/Kacheln nicht wirklich ansprechen: CSP prüft schon vor dem Netz, wir wollen nur Verstöße sehen
    await page.route(/^https:\/\/(?!staymatch)/, (r) => r.fulfill({ status: 200, body: '{}', contentType: 'application/json' }));
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', (e) => console.error('CSP-Verstoß: ' + e.violatedDirective + ' ' + e.blockedURI)));
    page.on('console', (m) => { if (m.type() === 'error') problems.push(`${path}: Konsole: ${m.text()}`); });
    page.on('pageerror', (e) => problems.push(`${path}: Skriptfehler: ${e.message}`));
    const res = await page.goto(`http://localhost:${PORT}${path}`, { waitUntil: 'networkidle' });
    if (!res || res.status() !== 200) problems.push(`${path}: Status ${res && res.status()}`);
    if (path === '/app' && !(await page.locator('body').innerText()).trim()) problems.push('/app: leere Seite');
    if (path === '/app') { // Viertel-Suche mit Vorabdaten (web/data/rom.json, kein Netz nötig)
      await page.fill('#city', 'Rom');
      await page.click('#go');
      try { await page.waitForSelector('#results article', { timeout: 20000 }); } catch { problems.push('/app: Suche nach Rom lieferte keine Viertel'); }
    }
    if (path === '/' || path === '/app') { // Barrierefreiheit: Fehler ab „serious“
      await page.evaluate(axeSrc);
      const { violations } = await page.evaluate(() => axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] }));
      for (const v of violations.filter((x) => x.impact === 'serious' || x.impact === 'critical'))
        problems.push(`${path}: axe ${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x, z. B. ${v.nodes[0].target.join(' ')})`);
    }
    await page.close();
  }
} finally { await browser.close(); srv.kill(); }
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
console.log('Rauchtest ok');
