// Feature 4: Storno-Erinnerung (chrome.alarms nur im Service Worker, Opt-in) und .ics-Export.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
require('../extension/reminders.js');
const R = globalThis.StayMatchReminders;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);
const EXT = path.join(__dirname, '..', 'extension');

test('Fristdatum: deutsch, englisch, numerisch; Jahr aus der Anreise; ungültig → null', () => {
  const o = { checkin: '2026-12-20', at: Date.UTC(2026, 10, 1) };
  assert.equal(R.parseCancelDate('5. Dezember', o), '2026-12-05');
  assert.equal(R.parseCancelDate('Dec 5', o), '2026-12-05');
  assert.equal(R.parseCancelDate('05.12.', o), '2026-12-05');
  assert.equal(R.parseCancelDate('5/12/2026', o), '2026-12-05');
  assert.equal(R.parseCancelDate('28. Dezember', { checkin: '2027-01-03' }), '2026-12-28', 'Frist vor Jahreswechsel');
  assert.equal(R.parseCancelDate('31. Februar', o), null);
  assert.equal(R.parseCancelDate('ja', o), null);
  assert.equal(R.parseCancelDate(null, o), null);
});

test('Plan: Vortag 9 Uhr; abgelaufene und unlesbare Fristen fallen weg; knapp → in 1 Minute', () => {
  const now = new Date(2026, 11, 1, 12, 0).getTime();
  const ls = {
    a: { id: 'a', title: 'Loft', booked: { checkin: '2026-12-20', cancel: '5. Dezember' } },
    b: { id: 'b', booked: { checkin: '2026-12-20', cancel: '1. Dezember' } },
    c: { id: 'c', booked: { checkin: '2026-12-20', cancel: '30. November' } },
    d: { id: 'd', booked: { checkin: '2026-12-20', cancel: 'ja' } },
    e: { id: 'e', booked: { checkin: '2026-12-20', cancel: null } },
  };
  const p = R.plan(ls, now);
  assert.deepEqual(p.map(x => x.id), ['b', 'a']);
  assert.equal(p[0].when, now + 60e3);
  assert.equal(p[1].when, new Date(2026, 11, 4, 9, 0).getTime());
});

test('ICS: gültiges Format, Zeilenumbruch CRLF, Sonderzeichen maskiert, Storno-Termin, Faltung', () => {
  const t = R.ics({ 1: { id: '1', title: 'Loft; "Sol", Gràcia', locality: 'Barcelona', url: 'https://www.airbnb.de/rooms/1', booked: { checkin: '2026-12-20', checkout: '2026-12-23', cancel: '5. Dezember', people: 2, total: 400, currency: '€' } },
    2: { id: '2', booked: { checkin: null } } }, Date.UTC(2026, 10, 1));
  assert.ok(t.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0') && t.endsWith('END:VCALENDAR\r\n'));
  assert.match(t, /DTSTART;VALUE=DATE:20261220\r\nDTEND;VALUE=DATE:20261223/);
  assert.match(t, /SUMMARY:Loft\; "Sol"\\, Gràcia/);
  assert.match(t, /DTSTART;VALUE=DATE:20261205\r\nDTEND;VALUE=DATE:20261206/);
  assert.equal((t.match(/BEGIN:VEVENT/g) || []).length, 2, 'Eintrag ohne Anreise fehlt');
  for (const line of t.split('\r\n')) assert.ok(new TextEncoder().encode(line).length <= 75, line);
  assert.equal(R.ics({}), '');
});

test('Service Worker: Wecker nur mit Opt-in, Benachrichtigung nur mit Berechtigung', async () => {
  const now = Date.now(), future = new Date(now + 10 * 864e5), ymd = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-${String(future.getDate()).padStart(2, '0')}`;
  const store = { settings: { remind: true }, 'l:1': { id: '1', title: 'Loft', booked: { checkin: ymd, cancel: `${future.getDate()}.${future.getMonth() + 1}.${future.getFullYear()}` } } };
  const alarms = new Map(), notes = []; let onAlarm, perm = true;
  const chrome = {
    storage: { local: { get: async k => k == null ? { ...store } : Object.fromEntries([].concat(k).filter(x => x in store).map(x => [x, store[x]])), set: async o => Object.assign(store, JSON.parse(JSON.stringify(o))) }, onChanged: { addListener() {} } },
    runtime: { onStartup: { addListener() {} }, onInstalled: { addListener() {} } },
    action: { setBadgeText: async () => {}, setBadgeBackgroundColor: async () => {}, setTitle: async () => {} },
    alarms: { onAlarm: { addListener: f => { onAlarm = f; } }, getAll: async () => [...alarms.entries()].map(([name, when]) => ({ name, scheduledTime: when })), create: async (n, o) => alarms.set(n, o.when), clear: async n => alarms.delete(n) },
    permissions: { contains: async () => perm },
    notifications: { create: (id, o) => notes.push(o) },
  };
  const ctx = vm.createContext({ chrome, importScripts: (...fs_) => fs_.forEach(f => vm.runInContext(fs.readFileSync(path.join(EXT, f), 'utf8'), ctx)) });
  ctx.self = ctx;
  vm.runInContext(fs.readFileSync(path.join(EXT, 'background.js'), 'utf8'), ctx);
  await new Promise(r => setTimeout(r, 30));
  assert.equal([...alarms.keys()].join(), 'sm-cancel:1');
  await onAlarm({ name: 'sm-cancel:1' });
  assert.equal(notes.length, 1); assert.match(notes[0].message, /Loft/);
  // Chrome löscht den Wecker nach dem Klingeln: er darf nicht neu angelegt werden, die Erinnerung kommt nur einmal
  alarms.delete('sm-cancel:1');
  vm.runInContext('syncAlarms()', ctx); await new Promise(r => setTimeout(r, 30));
  assert.equal(alarms.size, 0, 'kein Wecker im Minutentakt');
  await onAlarm({ name: 'sm-cancel:1' });
  assert.equal(notes.length, 1, 'keine zweite Benachrichtigung für dieselbe Frist');
  perm = false;
  store.settings = {}; // Opt-in zurückgenommen → Wecker weg
  vm.runInContext('syncAlarms()', ctx); await new Promise(r => setTimeout(r, 30));
  assert.equal(alarms.size, 0);
});

test('Manifest: alarms Pflicht, notifications nur optional; Optionen fragen beim Klick', { skip }, async () => {
  const m = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert.deepEqual(m.permissions, ['storage', 'alarms']); assert.deepEqual(m.optional_permissions, ['notifications']);
  const html = fs.readFileSync(path.join(EXT, 'options.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new D.JSDOM(html, { runScripts: 'outside-only', url: 'chrome-extension://x/options.html' });
  const w = dom.window, chrome = D.chromeMock({}); D.track(w);
  let asked = null; chrome.permissions = { request: async p => { asked = p; return false; } }; w.chrome = chrome;
  for (const f of ['core.js', 'reminders.js', 'import.js', 'options.js']) w.eval(D.src(f));
  const cb = w.document.getElementById('remind'); cb.checked = true; cb.dispatchEvent(new w.Event('change'));
  await D.until(() => asked);
  assert.equal(JSON.stringify(asked), '{"permissions":["notifications"]}');
  await D.until(() => !cb.checked);
  assert.equal(chrome.data.settings?.remind, undefined, 'abgelehnt → nicht eingeschaltet');
});
