// PWA: Manifest, Service Worker (nur gleiche Herkunft), CSP nur für /app, Registrierung in app.html
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..', 'web');
const { inlineScripts } = require('./helpers/web.js');
const read = (f) => inlineScripts(fs.readFileSync(path.join(web, f), 'utf8'));
const vercel = JSON.parse(read('vercel.json'));
const csp = (src) => vercel.headers.find((r) => r.source === src).headers[0].value;

test('Manifest: Start und Geltungsbereich /app, Symbole vorhanden, in app.html verlinkt', () => {
  const m = JSON.parse(read('manifest.webmanifest'));
  assert.equal(m.start_url, '/app'); assert.equal(m.scope, '/app'); assert.equal(m.display, 'standalone');
  for (const i of m.icons) assert.ok(fs.existsSync(path.join(web, i.src)), i.src);
  assert.ok(read('app.html').includes('<link rel="manifest" href="manifest.webmanifest">'));
});

test('CSP: worker-src und manifest-src nur auf /app, sonst weiter zu', () => {
  assert.match(csp('/app'), /worker-src 'self'; manifest-src 'self'/);
  assert.match(csp('/((?!app$).*)'), /worker-src 'none'/);
  assert.ok(!csp('/((?!app$).*)').includes('manifest-src'));
});

test('Service Worker: fasst nur gleiche Herkunft und GET an, nie Fremddienste', () => {
  const sw = read('sw.js');
  assert.ok(sw.includes("url.origin !== self.location.origin") && sw.includes("req.method !== 'GET'"));
  assert.ok(!/nominatim|overpass|openstreetmap|airbnb/i.test(sw), 'keine Fremddienste im Worker');
  assert.ok(sw.includes("/*BUILD*/'dev'") && sw.includes('/*SHELL*/[]'), 'Platzhalter für den Build');
  const h = (s) => vercel.headers.find((r) => r.source.includes(s)).headers[0].value;
  assert.match(h('sw\\.js'), /must-revalidate/);
});

test('app.html: Service Worker nur für /app registriert, Leaflet nicht mehr fest eingebunden', () => {
  const html = read('app.html');
  assert.ok(html.includes("register('/sw.js', { scope: '/app' })") && html.includes("'serviceWorker' in navigator"));
  assert.ok(!/<script src="vendor\/leaflet/.test(html) && !/<link rel="stylesheet" href="vendor\/leaflet/.test(html));
  assert.ok(html.includes("vendor/leaflet/leaflet.js") && html.includes("vendor/leaflet/leaflet.css"));
});
