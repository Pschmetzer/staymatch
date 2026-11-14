// Feature 1: Options-Seite (options_ui), Panel-Seite, Löschen, Export.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
test.after(D.closeAll);

function options(data) {
  const html = require('node:fs').readFileSync(require('node:path').join(D.EXT, 'options.html'), 'utf8').replace(/<script[^>]*><\/script>/g, '');
  const dom = new D.JSDOM(html, { runScripts: 'outside-only', url: 'chrome-extension://x/options.html' });
  const w = dom.window, chrome = D.chromeMock(data); w.chrome = chrome; D.track(w);
  w.URL.createObjectURL = () => 'blob:x';
  w.eval(D.src('core.js')); w.eval(D.src('import.js')); w.eval(D.src('options.js'));
  return { w, doc: w.document, chrome };
}

test('Manifest verweist auf options_ui (Tab) und die Seite existiert', () => {
  const m = JSON.parse(D.src('manifest.json'));
  assert.deepEqual(m.options_ui, { page: 'options.html', open_in_tab: true });
  assert.ok(!(m.permissions || []).some(p => p !== 'storage' && p !== 'alarms' && p !== 'notifications'), 'keine unnötigen Berechtigungen');
});

test('Optionen: Panel-Seite speichern, zurücksetzen, Einstellungen bleiben erhalten', { skip }, async () => {
  const { w, doc, chrome } = options({ settings: { theme: 'dark', panelPos: { x: 5, y: 5 } } });
  const side = doc.getElementById('side'); side.value = 'left'; side.dispatchEvent(new w.Event('change'));
  await D.until(() => chrome.data.settings.panelSide === 'left');
  assert.equal(chrome.data.settings.theme, 'dark');
  assert.equal(chrome.data.settings.panelPos, undefined, 'freie Position wird beim Andocken verworfen');
  doc.getElementById('resetPos').click();
  await D.until(() => chrome.data.settings.panelSide === undefined);
  assert.equal(chrome.data.settings.theme, 'dark');
});

test('Optionen: Löschen (nur Zwischenspeicher) lässt Verlauf und Einstellungen, Export bereinigt', { skip }, async () => {
  const { w, doc, chrome } = options({ settings: { theme: 'dark' }, pool: { a: 1 }, lastSearch: { at: 1 }, 'l:1': { id: '1', title: 'Loft', note: 'geheim', lastSeen: 1 } });
  w.confirm = () => true;
  doc.getElementById('wipeKind').value = 'zwischenspeicher';
  doc.getElementById('wipe').click();
  await D.until(() => !('pool' in chrome.data));
  assert.ok(!('lastSearch' in chrome.data) && chrome.data['l:1'] && chrome.data.settings);
  let blob = null; const OB = w.Blob; w.Blob = function (parts) { blob = parts.join(''); return new OB(parts); };
  w.HTMLAnchorElement.prototype.click = function () {};
  doc.getElementById('exportClean').click();
  await D.until(() => blob);
  assert.ok(!blob.includes('geheim'));
  assert.match(blob, /staymatch-merkliste/);
});
