// R4 H3: Speicher: Schemaversion und Migrationen (l:*, settings), Speicher-voll-Meldung, Import gegen bösartige Dateien.
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('./helpers/dom.js');
const I = (() => { const g = {}; new Function('window', D.src('i18n.js') + '\n' + D.src('strings.js') + '\n' + D.src('import.js'))(g); return g.StayMatchImport; })();
const skip = !D.JSDOM && 'jsdom nicht installiert';
test.after(D.closeAll);

const LEGACY = [
  { id: '1' }, { id: '2', visits: 'x', priceHistory: 'kaputt', hints: { a: 1 } }, { id: '3', visits: 5, priceHistory: [{ t: 1, p: 10 }], tags: ['<b>A</b>', 'A', '', 5, 'x'.repeat(40)] },
  { id: '4', schema: 99, extra: 'neu', visits: 'bleibt' },
];

test('migrateListing: alter Eintrag → Schema 2, Datenmüll repariert, Zukunftsschema unangetastet, idempotent', () => {
  const m = LEGACY.map(I.migrateListing);
  assert.equal(m[0].schema, I.SCHEMA); assert.equal(m[0].visits, 1);
  assert.equal(m[1].visits, 1); assert.ok(!('priceHistory' in m[1]) && !('hints' in m[1]));
  assert.equal(m[2].visits, 5); assert.equal(m[2].priceHistory.length, 1);
  assert.deepEqual(m[2].tags, ['bA/b', 'A', 'x'.repeat(20)], 'Etiketten: Sonderzeichen raus, 20 Zeichen, Nicht-Text raus');
  assert.ok(!m[2].tags.some(t => /[<>]/.test(t)) && m[2].tags.length <= 5);
  assert.deepEqual(m[3], LEGACY[3], 'neueres Schema wird nicht angefasst');
  for (const x of m) assert.deepEqual(I.migrateListing(x), x, 'idempotent');
  assert.equal(I.migrateListing(null), null); assert.equal(I.migrateListing('x'), 'x');
  assert.equal(LEGACY[1].visits, 'x', 'Original bleibt unverändert');
});

test('migrateSettings: leer, kaputt, alt, neu', () => {
  assert.deepEqual(I.migrateSettings(undefined), { schema: 2 });
  for (const bad of [null, 'x', 7, [], true]) assert.deepEqual(I.migrateSettings(bad), { schema: 2 });
  assert.deepEqual(I.migrateSettings({ theme: 'dark', share: 'kaputt' }), { theme: 'dark', schema: 2 });
  assert.deepEqual(I.migrateSettings({ share: { noPrices: true } }), { share: { noPrices: true }, schema: 2 });
  assert.deepEqual(I.migrateSettings({ schema: 7, share: 'bleibt' }), { schema: 7, share: 'bleibt' });
});

test('Content-Skript: gleiche Migration wie import.js (Kopie darf nicht abweichen)', { skip }, () => {
  const { w } = D.makePage({ body: '<main></main>' });
  const C = w.StayMatchContent;
  for (const v of LEGACY.filter(x => !x.tags)) assert.deepEqual(JSON.parse(JSON.stringify(C.migrateListing(v))), I.migrateListing(v), JSON.stringify(v));
  assert.equal(C.SCHEMA, I.SCHEMA);
});

test('Unterkunftsseite: alter l:*-Eintrag wird beim Speichern auf Schema 2 gehoben', { skip }, async () => {
  const chrome = D.chromeMock({ 'l:4242': { id: '4242', visits: 'x', priceHistory: 'kaputt', note: 'bleibt' } });
  D.makePage({ body: `<script type="application/ld+json">${JSON.stringify({ name: 'Loft', aggregateRating: { ratingValue: '4.8', ratingCount: '55' } })}</script>`, url: 'https://www.airbnb.com/rooms/4242?checkin=2026-05-01&checkout=2026-05-05', chrome });
  await D.until(() => chrome.data['l:4242']?.schema === 2);
  const v = chrome.data['l:4242'];
  assert.equal(v.note, 'bleibt'); assert.ok(v.visits >= 1 && Number.isFinite(v.visits)); assert.ok(!Array.isArray(v.priceHistory) || v.priceHistory.every(e => e && typeof e === 'object'));
});

test('Speicher voll: sichtbare Meldung statt stillem Verlust', { skip }, async () => {
  const chrome = D.chromeMock();
  const real = chrome.storage.local.set;
  chrome.storage.local.set = async o => { if (Object.keys(o).some(k => k.startsWith('l:'))) throw new Error('QUOTA_BYTES quota exceeded'); return real(o); };
  const { doc } = D.makePage({ body: `<script type="application/ld+json">${JSON.stringify({ name: 'Loft' })}</script>`, url: 'https://www.airbnb.com/rooms/4242', chrome });
  const box = await D.until(() => D.shadow(doc, 'sm-storage')?.querySelector('.err'));
  assert.ok(box, 'Warnung sichtbar'); assert.match(box.textContent, /nicht gespeichert/); assert.match(D.shadow(doc, 'sm-storage').textContent, /Speicher voll/);
  assert.equal(box.getAttribute('role'), 'alert');
});

test('Import: Prototyp-Verschmutzung wird entfernt, Object.prototype bleibt sauber', async () => {
  const text = `{"format":"staymatch-merkliste","version":1,"listings":{"a":{"id":"1","title":"X","__proto__":{"polluted":"ja"},"constructor":{"prototype":{"polluted2":"ja"}},"nested":{"__proto__":{"p3":1},"ok":1}}},"friendLikes":{"__proto__":{"p4":1},"5":["A"]},"trip":{"__proto__":{"p5":1},"savedAt":1,"city":"X"}}`;
  const parsed = I.parseImport(text);
  assert.equal(parsed.entries.length, 1);
  const e = parsed.entries[0];
  assert.equal(Object.getPrototypeOf(e), Object.prototype); assert.ok(!Object.keys(e).includes('__proto__') && !Object.keys(e).includes('constructor'));
  assert.deepEqual(e.nested, { ok: 1 });
  assert.ok(!Object.keys(parsed.friendLikes).includes('__proto__')); assert.ok(!Object.keys(parsed.trip).includes('__proto__'));
  const store = {}, local = { get: async () => ({}), set: async o => Object.assign(store, JSON.parse(JSON.stringify(o))) };
  await I.applyImport(local, parsed.entries); await I.applyExtras({ ...local, get: async () => ({}) }, parsed);
  for (const k of ['polluted', 'polluted2', 'p3', 'p4', 'p5']) assert.equal({}[k], undefined, k);
  // mergeListing mit Rohdaten, die __proto__ als eigenen Schlüssel tragen
  const raw = JSON.parse('{"id":"1","lastSeen":9,"__proto__":{"polluted":"ja"}}');
  const merged = I.mergeListing({ id: '1', lastSeen: 1 }, raw);
  assert.equal(merged.polluted, undefined); assert.equal(Object.getPrototypeOf(merged), Object.prototype);
});

test('Import: riesige oder tief verschachtelte Dateien werden begrenzt', async () => {
  assert.throws(() => I.parseImport('x'.repeat(I.MAX_FILE_BYTES + 1)), /zu groß/);
  await assert.rejects(I.readFileText({ size: I.MAX_FILE_BYTES + 1, text: async () => { throw new Error('darf nicht gelesen werden'); } }), /zu groß/);
  await assert.rejects(I.readFileText(undefined), /Keine Datei/);
  const many = Object.fromEntries(Array.from({ length: I.MAX_ENTRIES + 1 }, (_, i) => [i, { id: String(i + 1) }]));
  assert.throws(() => I.parseImport(JSON.stringify({ listings: many })), /zu viele/);
  const deep = '['.repeat(3000) + ']'.repeat(3000);
  const p = I.parseImport(`{"listings":{"a":{"id":"1","deep":${deep},"long":"${'y'.repeat(100000)}","list":${JSON.stringify(Array(1000).fill(1))}}}}`);
  const e = p.entries[0];
  assert.ok(JSON.stringify(e.deep ?? []).length < 200, 'Tiefe begrenzt'); assert.equal(e.long.length, 5000); assert.equal(e.list.length, 200);
  assert.deepEqual(I.sanitizeDeep({ a: NaN, b: Infinity, c: () => 1, d: undefined, e: 1n === 1n ? 'ok' : 0 }), { e: 'ok' });
});

test('Import: ungültige Dateien → deutsche Meldung, nichts geschrieben', async () => {
  for (const [txt, re] of [['nicht json', /kein gültiges JSON/], ['[]', /StayMatch-Format/], ['{"format":"x"}', /keine StayMatch-Merkliste/], ['{"format":"staymatch-merkliste","version":99,"listings":{}}', /neueren/], ['{"format":"staymatch-merkliste","version":-1,"listings":{}}', /Versionsnummer/], ['{"format":"staymatch-merkliste","version":1}', /fehlt die Liste/]])
    assert.throws(() => I.parseImport(txt), re, txt);
  const p = I.parseImport('{"listings":{"a":{"id":"abc"},"b":5,"c":null,"d":{"id":"12"}}}');
  assert.equal(p.entries.length, 1); assert.equal(p.skipped, 3);
});

test('Import: Speicher voll → verständliche Meldung', async () => {
  const local = { get: async () => ({}), set: async () => { throw new Error('QUOTA_BYTES quota exceeded'); } };
  await assert.rejects(I.applyImport(local, [{ id: '1' }]), /Speicher der Erweiterung ist voll/);
  await assert.rejects(I.applyExtras({ get: async () => ({}), set: local.set }, { friendLikes: { 1: ['A'] } }), /voll/);
  await assert.rejects(I.safeSet({ set: async () => { throw new Error('anderer Fehler') } }, { a: 1 }), /Speichern fehlgeschlagen: anderer Fehler/);
  assert.ok(I.isQuotaError(new DOMException('x', 'QuotaExceededError')));
});
