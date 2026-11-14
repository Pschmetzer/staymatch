// R4 H2: Datenschutz eingefroren. Berechtigungen, Seiten-Zugriff, CSP und „keine Netzwerkanfragen im Code“.
// Wer hier etwas ändert, ändert bewusst die Datenschutz-Zusage: dann PRIVACY.md und STORE.md mit anpassen.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const EXT = path.join(__dirname, '..', 'extension');
const read = f => fs.readFileSync(path.join(EXT, f), 'utf8');
const mf = JSON.parse(read('manifest.json'));
const files = fs.readdirSync(EXT).filter(f => /\.(js|html)$/.test(f));

test('Berechtigungen eingefroren: nur storage fest; alarms und notifications optional', () => {
  assert.deepEqual(mf.permissions, ['storage']);
  assert.deepEqual([...mf.optional_permissions].sort(), ['alarms', 'notifications']);
  for (const k of ['host_permissions', 'optional_host_permissions', 'externally_connectable', 'web_accessible_resources', 'declarative_net_request', 'commands', 'oauth2', 'key'])
    assert.equal(mf[k], undefined, k + ' darf nicht gesetzt sein');
  assert.equal(mf.incognito, 'not_allowed');
});

test('Seiten-Zugriff eingefroren: nur Airbnb-Domains (https) und die StayMatch-Seite für die Reise-Übergabe', () => {
  const [main, bridge] = mf.content_scripts;
  assert.equal(mf.content_scripts.length, 2);
  assert.ok(main.matches.every(m => /^https:\/\/www\.airbnb\.[a-z.]+\/\*$/.test(m)), 'Airbnb nur über https');
  assert.deepEqual(bridge.matches, ['https://staymatch.pro/*', 'https://staymatch-tau.vercel.app/*', 'http://localhost:8765/*']);
  assert.deepEqual(bridge.js, ['bridge.js']);
  assert.equal(main.all_frames, undefined, 'nicht in fremden Frames');
  assert.equal(main.world, undefined, 'nur isolierte Welt (nie MAIN)'); assert.equal(bridge.world, undefined);
});

test('CSP: Erweiterungsseiten ohne Netz, ohne Inline-Skripte, ohne fremde Quellen', () => {
  const csp = mf.content_security_policy.extension_pages;
  assert.match(csp, /script-src 'self'/); assert.match(csp, /connect-src 'none'/); assert.match(csp, /img-src 'self'/);
  assert.doesNotMatch(csp, /unsafe-|https?:|\*|data:|blob:/);
  for (const f of files.filter(f => f.endsWith('.html'))) {
    const s = read(f);
    assert.doesNotMatch(s, /<script(?![^>]*\bsrc=)[^>]*>\s*\S/, f + ': kein Inline-Skript');
    assert.doesNotMatch(s, /\s(src|href)=["']https?:/i, f + ': keine fremden Adressen');
    assert.doesNotMatch(s, /\son[a-z]+=/i, f + ': keine Inline-Handler');
  }
});

test('Code: keine Netzwerkanfragen, kein Nachladen, kein Tracking-Aufbau', () => {
  const BAD = /\bfetch\s*\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|navigator\.connection|new\s+Image\s*\(|\beval\s*\(|new\s+Function\s*\(|importScripts\s*\(\s*['"`]https?:|document\.write|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML|chrome\.(webRequest|cookies|history|bookmarks|identity|scripting|declarativeNetRequest|topSites|management|downloads|webNavigation|tabs\.(executeScript|sendMessage))|\bgtag\b|analytics|google-analytics|sentry/i;
  for (const f of files.filter(f => f.endsWith('.js'))) assert.doesNotMatch(read(f), BAD, f);
});

test('tabs.create nur für die eigene Druckseite (Nachricht des eigenen Plugins)', () => {
  const hits = files.filter(f => f.endsWith('.js')).flatMap(f => (read(f).match(/chrome\.tabs\.\w+/g) || []).map(m => f + ':' + m));
  assert.deepEqual(hits, ['background.js:chrome.tabs.create']);
  assert.match(read('background.js'), /sender\.id === chrome\.runtime\.id/);
});

test('Wecker und Benachrichtigungen werden nur mit Opt-in und erteilter Berechtigung genutzt', () => {
  const opt = read('options.js'), bg = read('background.js');
  assert.match(opt, /permissions\.request\(\{ permissions: \['alarms', 'notifications'\] \}\)/);
  assert.match(bg, /permissions\.contains\(\{ permissions: \['notifications'\] \}\)/);
  assert.match(bg, /settings\?\.remind === true/);
  for (const f of files.filter(f => f.endsWith('.js') && f !== 'background.js' && f !== 'options.js')) assert.doesNotMatch(read(f), /chrome\.(alarms|notifications)/, f);
});

test('Datenschutztext nennt jede Berechtigung und jeden Speicherschlüssel-Bereich', () => {
  const priv = fs.readFileSync(path.join(__dirname, '..', 'PRIVACY.md'), 'utf8'), store = fs.readFileSync(path.join(__dirname, '..', 'STORE.md'), 'utf8');
  for (const doc of [priv, store]) for (const w of ['`storage`', '`alarms`', '`notifications`']) assert.ok(doc.includes(w), w);
  for (const w of ['Optionen', 'Erinnerung', 'Export', 'Badge', 'pageStatus', 'Druck']) assert.ok(priv.includes(w), 'PRIVACY: ' + w);
  for (const w of ['Optionen', 'Erinnerung', 'Export', 'Badge', 'Druck']) assert.ok(store.includes(w), 'STORE: ' + w);
});
