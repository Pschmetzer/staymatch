// i18n: Wörterbuch vollständig und stimmig (de/en gleiche Schlüssel und Platzhalter, jeder benutzte Schlüssel vorhanden, Englisch ohne Deutsch).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const I = require('../extension/i18n.js');
const { GERMAN } = require('./helpers/german-scan.js');
const EXT = path.join(__dirname, '..', 'extension');
const de = I.DICT.de, en = I.DICT.en;
const ph = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
// Einträge, die auf Englisch dem Deutschen gleichen dürfen (Eigennamen, Symbole, Kürzel)
const SAME_OK = /^(?!x)$/; // (wird bei Bedarf gefüllt)

test('de und en haben genau dieselben Schlüssel und Platzhalter', () => {
  assert.ok(Object.keys(de).length > 100, 'Wörterbuch gefüllt (' + Object.keys(de).length + ')');
  assert.deepEqual(Object.keys(de).filter(k => !(k in en)), [], 'fehlt auf Englisch');
  assert.deepEqual(Object.keys(en).filter(k => !(k in de)), [], 'fehlt auf Deutsch');
  assert.deepEqual(Object.keys(de).filter(k => ph(de[k]) !== ph(en[k])), [], 'Platzhalter weichen ab');
  assert.deepEqual(Object.keys(de).filter(k => /\.(one|other)$/.test(k) && !(k.replace(/\.(one|other)$/, m => m === '.one' ? '.other' : '.one') in de)), [], 'one ohne other (oder umgekehrt)');
});

test('Englisch enthält kein Deutsch und ist nicht bloß kopiert', () => {
  const bad = [], same = [];
  for (const [k, v] of Object.entries(en)) {
    if (GERMAN.test(v)) bad.push(`${k}: ${v.slice(0, 60)}`);
    if (v === de[k] && /[A-Za-z]{4,}/.test(v.replace(/\{\w+\}/g, '')) && !SAME_OK.test(k)) same.push(`${k}: ${v.slice(0, 40)}`);
  }
  assert.deepEqual(bad, [], 'deutsche Wörter im Englischen');
  assert.deepEqual(same, [], 'unübersetzt (gleich wie Deutsch)');
});

test('Jeder im Code benutzte Schlüssel existiert (de und en)', () => {
  const used = new Map();
  for (const f of fs.readdirSync(EXT).filter(f => /\.(js|html)$/.test(f) && f !== 'strings.js' && f !== 'i18n.js')) {
    const s = fs.readFileSync(path.join(EXT, f), 'utf8');
    for (const m of s.matchAll(/\bt\(\s*['"`]([\w.\-]+)['"`]/g)) used.set(m[1], f);
    for (const m of s.matchAll(/data-i18n="([\w.\-]+)"/g)) used.set(m[1], f);
    for (const m of s.matchAll(/data-i18n-attr="([^"]+)"/g)) for (const p of m[1].split(';')) { const k = p.split(':')[1]?.trim(); if (k) used.set(k, f); }
  }
  const missing = [...used].filter(([k]) => !(k in de || k + '.other' in de) || !(k in en || k + '.other' in en)).map(([k, f]) => `${f}: ${k}`);
  assert.deepEqual(missing, []);
  assert.ok(used.size > 100, 'Schlüssel gefunden: ' + used.size);
});

test('t(): Mehrzahl, Platzhalter, Sprachwahl und Rückfall', () => {
  I.add('de', { 'zz.p.one': '{n} Nacht', 'zz.p.other': '{n} Nächte', 'zz.only': 'nur de' }); I.add('en', { 'zz.p.one': '{n} night', 'zz.p.other': '{n} nights' });
  I.setLang('de'); assert.equal(I.t('zz.p', { n: 1 }), '1 Nacht'); assert.equal(I.t('zz.p', { n: 3 }), '3 Nächte');
  I.setLang('en'); assert.equal(I.t('zz.p', { n: 1 }), '1 night'); assert.equal(I.t('zz.p', { n: 0 }), '0 nights'); assert.equal(I.t('zz.only'), 'nur de', 'fehlt Englisch: Rückfall Deutsch');
  assert.equal(I.dec('4.9'), '4.9'); assert.equal(I.locale(), 'en-GB'); I.setLang('de'); assert.equal(I.dec('4.9'), '4,9'); assert.equal(I.locale(), 'de-DE');
  I.setLang('auto'); assert.equal(I.lang(), 'de', 'Node ohne Beleg: Deutsch');
  delete de['zz.p.one']; delete de['zz.p.other']; delete de['zz.only']; delete en['zz.p.one']; delete en['zz.p.other'];
});

test('Spracherkennung: html lang vor Domain; Domain; UI-Sprache; Rückfall Deutsch', () => {
  const D = require('./helpers/dom.js'); if (!D.JSDOM) return;
  const det = (url, lang, ui) => { const { JSDOM } = D; const dom = new JSDOM(`<html${lang ? ` lang="${lang}"` : ''}></html>`, { url, runScripts: 'outside-only' }); const w = dom.window; if (ui) w.chrome = { i18n: { getUILanguage: () => ui } }; w.eval(D.src('core.js')); const r = w.StayMatchI18n.lang(); w.close(); return r; };
  assert.equal(det('https://www.airbnb.com/s/x', ''), 'en'); assert.equal(det('https://www.airbnb.de/s/x', ''), 'de'); assert.equal(det('https://www.airbnb.at/s/x', ''), 'de'); assert.equal(det('https://www.airbnb.ch/s/x', ''), 'de');
  assert.equal(det('https://www.airbnb.fr/s/x', ''), 'en'); assert.equal(det('https://www.airbnb.com/s/x', 'de'), 'de', 'html lang schlägt Domain'); assert.equal(det('https://www.airbnb.de/s/x', 'en-GB'), 'en');
  assert.equal(det('chrome-extension://x/popup.html', '', 'en-US'), 'en'); assert.equal(det('chrome-extension://x/popup.html', '', 'de'), 'de'); assert.equal(det('chrome-extension://x/popup.html', '', null), 'de');
});

test('_locales: de und en mit Name und Kurzbeschreibung (max. 132 Zeichen); Manifest verweist darauf', () => {
  const mf = JSON.parse(fs.readFileSync(path.join(EXT, 'manifest.json'), 'utf8'));
  assert.equal(mf.default_locale, 'de'); assert.equal(mf.name, '__MSG_extName__'); assert.equal(mf.description, '__MSG_extDesc__');
  for (const l of ['de', 'en']) {
    const m = JSON.parse(fs.readFileSync(path.join(EXT, '_locales', l, 'messages.json'), 'utf8'));
    assert.ok(m.extName.message.length > 3 && m.extName.message.length <= 75); assert.ok(m.extDesc.message.length > 20 && m.extDesc.message.length <= 132, l);
  }
  assert.doesNotMatch(JSON.parse(fs.readFileSync(path.join(EXT, '_locales/en/messages.json'), 'utf8')).extDesc.message, GERMAN);
});
