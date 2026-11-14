// Web-Build: dist/ ist ein vollständiger Ersatz für web/, minifiziert, mit Hash-Verweisen und lauffähigem JS
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
let hasEsbuild = true;
try { require.resolve('esbuild', { paths: [__dirname] }); } catch { hasEsbuild = false; }
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

test('Build: vollständig, minifiziert, Verweise mit ?v=, Daten-Index gehasht', { skip: !hasEsbuild && 'esbuild fehlt (npm ci --prefix tests)' }, () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-dist-'));
  const r = spawnSync(process.execPath, [path.join(root, 'scripts', 'build-web.mjs'), '--check'], { env: { ...process.env, OUT: out }, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr + r.stdout);
  for (const p of walk(web)) assert.ok(fs.existsSync(path.join(out, path.relative(web, p))), `fehlt: ${path.relative(web, p)}`);
  for (const f of ['app.js', 'scoring.js', 'core.js', 'app-extra.js']) {
    const src = fs.readFileSync(path.join(web, f), 'utf8'), min = fs.readFileSync(path.join(out, f), 'utf8');
    assert.ok(min.length < src.length * 0.85, `${f} nicht kleiner`);
    new vm.Script(min); // parsebar
    assert.ok(/\bfunction \w+\(|\b(let|const|var) \w+/.test(min), `${f}: Top-Level-Namen erhalten`);
  }
  // Jede lokale JS/CSS-Referenz in jeder HTML-Seite trägt ?v=
  for (const f of walk(out).filter((p) => p.endsWith('.html'))) {
    const html = fs.readFileSync(f, 'utf8');
    for (const m of html.matchAll(/\b(?:src|href)="(?!https?:|data:)([^"?]*\.(?:js|css))(\?[^"]*)?"/g)) {
      if (m[1].startsWith('vendor/')) continue;
      assert.match(m[2] || '', /^\?v=[0-9a-f]{10}$/, `${path.relative(out, f)}: ${m[1]} ohne ?v=`);
    }
  }
  const idx = JSON.parse(fs.readFileSync(path.join(out, 'data', 'index.json'), 'utf8'));
  for (const v of Object.values(idx)) assert.ok(fs.existsSync(path.join(out, 'data', v.split('?')[0])) && /\?v=[0-9a-f]{10}$/.test(v), v);
  const sw = fs.readFileSync(path.join(out, 'sw.js'), 'utf8');
  assert.ok(!sw.includes('/*SHELL*/') && !sw.includes("'dev'"), 'sw.js: Platzhalter ersetzt');
  new vm.Script(sw);
  for (const f of ['app.js', 'scoring.js', 'core.js', 'app-extra.js']) assert.match(sw, new RegExp(`/${f.replace('.', '\\.')}\\?v=[0-9a-f]{10}`), `Offline-Liste: ${f}`);
  for (const u of ['/app', '/data/index.json', '/vendor/leaflet/leaflet.js', '/manifest.webmanifest']) assert.ok(sw.includes(`"${u}"`), u);
  fs.rmSync(out, { recursive: true, force: true });
});
