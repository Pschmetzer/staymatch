// Feature 2: Toolbar-Badge (Service Worker, nur lokal).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
require('../extension/badge.js');
const { badgeState } = globalThis.StayMatchBadge;
const EXT = path.join(__dirname, '..', 'extension');

test('Badge: Zahl nur bei frischer Suche, Obergrenze 99, abschaltbar', () => {
  const now = 1e12, top = n => Array.from({ length: n }, (_, i) => ({ id: String(i) }));
  assert.equal(badgeState({ lastSearch: { at: now - 1000, top: top(7) } }, now).text, '7');
  assert.equal(badgeState({ lastSearch: { at: now - 1000, top: top(150) } }, now).text, '99');
  assert.equal(badgeState({ lastSearch: { at: now - 7 * 3600e3, top: top(3) } }, now).text, '', 'veraltet');
  assert.equal(badgeState({ lastSearch: { at: now, top: [] } }, now).text, '');
  assert.equal(badgeState({ lastSearch: { at: now, top: top(3) }, settings: { badge: false } }, now).text, '');
  assert.equal(badgeState({}, now).text, '');
});

test('Service Worker setzt Badge-Text aus dem Speicher und hört auf Änderungen', async () => {
  const calls = []; let listener;
  const store = { lastSearch: { at: Date.now(), top: [{}, {}] } };
  const chrome = {
    storage: { local: { get: async () => store }, onChanged: { addListener: f => { listener = f; } } },
    runtime: { onStartup: { addListener() {} }, onInstalled: { addListener() {} } },
    action: { setBadgeText: async o => calls.push(o.text), setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
  };
  const ctx = vm.createContext({ chrome, importScripts: (...names) => names.forEach(n => vm.runInContext(fs.readFileSync(path.join(EXT, n), 'utf8'), ctx)) });
  ctx.self = ctx;
  vm.runInContext(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8'), ctx);
  await new Promise(r => setTimeout(r, 20));
  assert.deepEqual(calls, ['2']);
  store.lastSearch.top.push({}); listener({ lastSearch: {} });
  await new Promise(r => setTimeout(r, 20));
  assert.equal(calls.at(-1), '3');
});

test('Manifest: Service Worker eingetragen, keine neue Berechtigung für das Badge', () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert.equal(m.background.service_worker, 'background.js');
  assert.ok(fs.existsSync(path.join(EXT, 'badge.js')));
  assert.ok(!/\bfetch\s*\(|XMLHttpRequest|WebSocket/.test(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8')));
});
