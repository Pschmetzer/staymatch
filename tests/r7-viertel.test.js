// Runde 7: Viertel-Finder (web/app.html, app.js, scoring.js)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../web/scoring.js');
const SM = globalThis.StayMatch;
const { bootApp, until, tick, search, hasDom, web } = require('./helpers/app-dom.js');

const dataDir = path.join(web, 'data');
const index = JSON.parse(fs.readFileSync(path.join(dataDir, 'index.json'), 'utf8'));
const files = [...new Set(Object.values(index))];
const load = f => SM.fromFile(JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8')));
const withW = ppl => ppl.map(p => ({ ...p, w: SM.weightsOf(p) }));
const dom = { skip: !hasDom && 'jsdom fehlt (npm ci --prefix tests)' };

// ---------- A. Ergebnisse ----------
test('Jede Vorab-Stadt liefert für jeden Typ allein mindestens 5 Viertel (Shopping-Fehler)', () => {
  for (const f of files) {
    const d = load(f), { areas, pois } = SM.buildData(d.rows);
    SM.scoreAreas(areas, pois, 800); SM.annotateCentre(areas, d.geo);
    for (const type of Object.keys(SM.PRESETS)) {
      const { withData } = SM.eligibleAreas(areas, withW([{ name: 'x', type }]));
      assert.ok(withData.length >= 5, `${f} / ${type}: nur ${withData.length} Viertel`);
    }
  }
});

test('eligibleAreas: Kategorie ohne Daten in der Stadt entscheidet nicht mit und wird gemeldet', () => {
  const mk = (n, shop) => Array.from({ length: n }, (_, i) => ({ counts: { party: 5, chill: 5, sights: 5, food: 5, transit: 1, shop: i < shop ? 3 : 0, sport: 0, kids: 0 }, centerDist: 0 }));
  const ppl = withW([{ name: 'x', type: 'shopping' }]);
  const none = SM.eligibleAreas(mk(20, 0), ppl);
  assert.deepEqual(none.empty, ['shop']); assert.equal(none.withData.length, 20);
  const some = SM.eligibleAreas(mk(20, 10), ppl);
  assert.deepEqual(some.empty, []); assert.equal(some.withData.length, 10, 'mit Daten filtert Einkaufen weiter');
});

test('fromFile: Zentrum aus der Datei, sonst Mitte der Box; Zentrum außerhalb der Box wird ignoriert', () => {
  const base = { city: 'X', t: 1, fields: ['lat', 'lon'], rows: [], bbox: [41, 2, 42, 3] };
  assert.deepEqual([SM.fromFile(base).geo.lat, SM.fromFile(base).geo.lon], [41.5, 2.5]);
  assert.deepEqual([SM.fromFile({ ...base, center: [41.2, 2.1] }).geo.lat, SM.fromFile({ ...base, center: [41.2, 2.1] }).geo.lon], [41.2, 2.1]);
  assert.equal(SM.fromFile({ ...base, center: { lat: 41.3, lon: 2.4 } }).geo.lat, 41.3);
  assert.equal(SM.fromFile({ ...base, center: [50, 9] }).geo.lat, 41.5);
});

test('cityKeys: „Barcelona, Spanien“, „Wien (Österreich)“, „ROM “ finden die Vorab-Datei', () => {
  for (const [q, f] of [['Barcelona, Spanien', 'barcelona.json'], ['Wien (Österreich)', 'wien.json'], ['ROM ', 'rom.json'], ['Lisboa, Portugal', 'lissabon.json']]) {
    assert.equal(SM.cityKeys(q).map(k => index[k]).find(Boolean), f, q);
  }
});

test('cleanPerson: Name aus Leerzeichen wird „Person“, Ränder werden getrimmt', () => {
  assert.equal(SM.cleanPerson({ name: '   ', type: 'party' }).name, 'Person');
  assert.equal(SM.cleanPerson({ name: '  Lena ', type: 'party' }).name, 'Lena');
});

test('nights: Müll ergibt immer eine endliche Zahl ≥ 0', () => {
  for (const [a, b] of [['x', 'y'], ['', ''], ['2026-05-01', '2026-05-01'], ['2026-05-03', '2026-05-01'], ['2026-05-01', 'kaputt'], [null, undefined]]) {
    const n = SM.nights(a, b);
    assert.ok(Number.isFinite(n) && n >= 0, `${a} → ${b}: ${n}`);
  }
  assert.equal(SM.nights('2026-05-01', '2026-05-05'), 4);
});

test('airbnbUrl: Währung immer EUR, price_max ganzzahlig, höchstens 16 Gäste zusammen', () => {
  const u = new URL(SM.airbnbUrl({ lat: 41.4, lon: 2.16, name: 'Gràcia', city: 'Barcelona', adults: 16, children: 3, infants: 9, priceMaxNight: 123.6 }));
  assert.equal(u.searchParams.get('currency'), 'EUR');
  assert.equal(u.searchParams.get('price_max'), '124');
  assert.equal(+u.searchParams.get('adults') + +(u.searchParams.get('children') || 0), 16);
  assert.equal(u.searchParams.get('infants'), '5');
  const v = new URL(SM.airbnbUrl({ lat: 41.4, lon: 2.16, name: 'G', city: 'B', adults: 4, children: 3 }));
  assert.equal(v.searchParams.get('children'), '3'); assert.equal(v.searchParams.get('currency'), 'EUR');
});

const area = (name, total, extra = {}) => ({ name, lat: 41.4, lon: 2.16, group: { total, scores: [total], min: total, avg: total }, norm: { sights: 0.1, party: 0.1 }, nearest: { transit: 500 }, centerDist: 5000, ...extra });

test('awards und summary mit genau einer Person: kein „Kompromiss“, Ansprache mit „dir“', () => {
  const ppl = withW([{ name: 'Du', type: 'sights' }]);
  const aw = SM.awards([area('A', 80), area('B', 70)], ppl);
  assert.deepEqual(aw[0], ['Beste Wahl für dich']);
  assert.ok(!aw.flat().some(t => /Kompromiss/.test(t)));
  const a = area('A', 80); a.counts = {}; a.norm = { sights: 1 };
  assert.match(SM.summary(a, ppl), /dir/);
  assert.match(SM.awards([area('A', 80)], withW([{ name: 'a', type: 'party' }, { name: 'b', type: 'party' }]))[0][0], /Kompromiss/);
});

test('isSecretTip: nie für die Spitze selbst, nie für ein Kneipenviertel', () => {
  assert.equal(SM.isSecretTip(area('A', 80), 80, 1000), false, 'Platz 1 ist kein Geheimtipp');
  assert.equal(SM.isSecretTip(area('B', 75), 80, 1000), true);
  assert.equal(SM.isSecretTip(area('C', 75, { norm: { sights: 0.1, party: 0.9 } }), 80, 1000), false, 'viele Bars sind nicht „ruhiger“');
});

test('scoreAreas: nächste Bahn auch außerhalb des Wertungsradius (bis 1,5 km)', () => {
  const a = SM.scoreAreas([{ name: 'A', lat: 41.4, lon: 2.16 }], [{ lat: 41.4054, lon: 2.16, cat: 'transit' }], 500)[0];
  assert.equal(a.counts.transit, 0, 'zählt nicht in die Wertung');
  assert.ok(a.nearest.transit > 500 && a.nearest.transit < 700, String(a.nearest.transit));
  const far = SM.scoreAreas([{ name: 'A', lat: 41.4, lon: 2.16 }], [{ lat: 41.42, lon: 2.16, cat: 'transit' }], 500)[0];
  assert.equal(far.nearest.transit, null, 'über 1,5 km: keine Bahn');
});

test('convertBudget: gleiche Gesamtsumme in anderem Modus', () => {
  assert.equal(SM.convertBudget(800, 'total', 'night', 4, 2), 200);
  assert.equal(SM.convertBudget(200, 'night', 'pp', 4, 2), 400);
  assert.equal(SM.convertBudget(400, 'pp', 'total', 4, 2), 800);
  assert.equal(SM.convertBudget(800, 'total', 'night', 0, 2), 800, 'ohne Nächte keine Division durch 0');
});

test('Teilen-Link: hin und zurück, Müll ergibt null', () => {
  const st = { c: 'Wien', i: '2026-05-01', o: '2026-05-04', b: 900, bm: 'total', r: '800', mc: '0', k: 1, y: 0, bd: false, fairness: 0.7,
    people: [{ name: 'Lena', type: 'party', veto: ['kids'] }, { name: 'Tom', type: 'chill', custom: { ...SM.PRESETS.chill.w, party: -1 } }], wishes: ['whole'] };
  const back = SM.shareDecode(SM.shareEncode(st));
  assert.equal(back.form.c, 'Wien'); assert.equal(back.fairness, 0.7); assert.deepEqual(back.wishes, ['whole']);
  assert.deepEqual(back.people.map(p => p.name), ['Lena', 'Tom']); assert.equal(back.people[1].custom.party, -1);
  assert.deepEqual(back.people[0].veto, ['kids']);
  for (const bad of ['', 'xxx', SM.shareEncode({ ...st, people: [] })]) assert.equal(SM.shareDecode(bad), null);
});

test('overpassFetch: 400 heißt „abgelehnt“, 429 „überlastet“; Abbruch-Listener wird entfernt', async () => {
  const resp = status => async () => ({ ok: false, status, text: async () => '' });
  await assert.rejects(SM.overpassFetch([1, 2, 3, 4], null, null, { f: resp(400), stagger: 1 }), /abgelehnt \(Fehler 400\)/);
  await assert.rejects(SM.overpassFetch([1, 2, 3, 4], null, null, { f: resp(429), stagger: 1 }), /überlastet/);
  const outer = new AbortController(); let added = 0, removed = 0;
  const sig = outer.signal, add = sig.addEventListener.bind(sig), rem = sig.removeEventListener.bind(sig);
  sig.addEventListener = (...a) => { added++; add(...a); }; sig.removeEventListener = (...a) => { removed++; rem(...a); };
  const rows = await SM.overpassFetch([1, 2, 3, 4], sig, null, { f: async () => ({ ok: true, status: 200, text: async () => '@lat|x\n' }), stagger: 1 });
  assert.deepEqual(rows, []); assert.equal(added, 1); assert.equal(removed, 1);
});

// ---------- DOM: App im Browser (jsdom) ----------
test('App startet mit kaputtem localStorage (Vorlagen, Personen, Formular)', dom, async () => {
  const w = bootApp({ storage: { sm_groups: '[{"name":"x"},null,{"name":"ok","people":[{"name":"A","type":"party"}]}]', sm_people: '"abc"', sm_form: '5', sm_fair: '"x"' } });
  const $ = id => w.document.getElementById(id);
  assert.equal($('people').querySelectorAll('.person').length, 1, 'Personenliste steht');
  assert.deepEqual([...$('tpl').options].map(o => o.textContent), ['Auswahl …', 'ok (1)']);
  assert.ok($('cityChips').children.length >= 10, 'Schnellwahl aus den Kacheln');
  await search(w, 'Wien');
  assert.ok($('results').children.length > 0, $('status').textContent);
  assert.deepEqual(w.errors, []);
});

test('Shopping allein in Wien zeigt Viertel und einen Hinweis zu fehlenden Daten', dom, async () => {
  const w = bootApp({ storage: { sm_people: [{ name: 'Du', type: 'shopping' }] } });
  await search(w, 'Wien');
  const $ = id => w.document.getElementById(id);
  assert.ok($('results').children.length >= 5, $('status').textContent);
  assert.match($('status').textContent, /Einkaufen hat OpenStreetMap hier kaum Daten/);
});

test('„Barcelona, Spanien“ nutzt die Vorab-Datei; ein Index-Fehler wird nicht gemerkt', dom, async () => {
  let fail = true;
  const w = bootApp({ fetch: async u => { if (u.endsWith('index.json') && fail) { fail = false; return { ok: false, status: 503, json: async () => ({}) }; } } });
  await search(w, 'Barcelona, Spanien'); // erster Versuch: Index kaputt → live (im Test: kein Netz)
  assert.match(w.document.getElementById('status').textContent, /Fehler/);
  await search(w, 'Barcelona, Spanien');
  assert.ok(w.document.getElementById('results').children.length > 0, w.document.getElementById('status').textContent);
  assert.ok(w.requests.includes('data/barcelona.json'));
});

test('Person löschen: Sortierung „Beste für …“ und Karten-Person bleiben bei derselben Person', dom, async () => {
  const w = bootApp({ storage: { sm_people: [{ name: 'Lena', type: 'party' }, { name: 'Tom', type: 'chill' }, { name: 'Mia', type: 'sights' }] } });
  const $ = id => w.document.getElementById(id);
  await search(w, 'Wien');
  $('sort').value = 'p:2'; $('sort').dispatchEvent(new w.Event('change'));
  const del = i => $('people').querySelectorAll('.person')[i].querySelector('button[aria-label$="entfernen"]').click();
  del(0); await tick(400);
  assert.equal($('sort').selectedOptions[0].textContent, 'Beste für Mia');
  del(1); await tick(400); // Mia weg → zurück auf fair
  assert.equal($('sort').value, 'fair');
});

test('Teilen-Link: zweiter Link im selben Tab wird übernommen, Rückgängig holt alles zurück', dom, async () => {
  const w = bootApp({ storage: { sm_people: [{ name: 'Ich', type: 'party' }], sm_wishes: ['wifi'], sm_fair: 0.3 } });
  const $ = id => w.document.getElementById(id);
  const st = { c: 'Wien', i: '', o: '', b: 500, bm: 'total', r: '800', mc: '0', k: 0, y: 0, bd: false, fairness: 0.9, people: [{ name: 'Gast', type: 'chill' }], wishes: ['quiet'] };
  w.location.hash = '#t=' + SM.shareEncode(st);
  await until(() => $('people').querySelector('input').value === 'Gast');
  await until(() => !$('go').disabled && $('results').children.length > 0);
  assert.equal($('fair').value, '90');
  assert.equal($('undo').hidden, false);
  await tick(50);
  $('undoBtn').click();
  assert.equal($('people').querySelector('input').value, 'Ich');
  assert.equal($('fair').value, '30');
  assert.ok(w.document.querySelector('#wishes input[value="wifi"]').checked);
});

test('Deeplink ?c= wird übernommen und danach aus der Adresse genommen', dom, async () => {
  const w = bootApp({ url: 'http://localhost/app?c=Lissabon&n=3' });
  assert.equal(w.document.getElementById('city').value, 'Lissabon');
  assert.equal(w.location.search, '');
  assert.equal(w.document.getElementById('people').querySelectorAll('.person').length, 3);
  assert.equal(JSON.parse(w.localStorage.getItem('sm_form')).c, 'Lissabon');
});

test('Formular: Anreise in der Vergangenheit, Budget-Modus rechnet um, Gäste-Hinweis eigene Zeile', dom, async () => {
  const w = bootApp();
  const $ = id => w.document.getElementById(id);
  $('checkin').value = '2020-01-01'; $('checkin').dispatchEvent(new w.Event('change'));
  assert.ok($('checkin').value >= new Date().toISOString().slice(0, 10), $('checkin').value);
  assert.match($('dateInfo').textContent, /Vergangenheit/);
  $('budget').value = '800'; $('budgetMode').value = 'night'; $('budgetMode').dispatchEvent(new w.Event('change'));
  assert.equal(+$('budget').value, Math.round(800 / SM.nights($('checkin').value, $('checkout').value)));
  for (let i = 0; i < 16; i++) $('addPerson').click();
  assert.match($('peopleWarn').textContent, /17 Gäste/);
  assert.doesNotMatch($('shareMsg').textContent, /16/);
  while ($('people').querySelectorAll('.person').length > 15) $('people').querySelector('button[aria-label$="entfernen"]').click();
  assert.equal($('peopleWarn').textContent, '');
});

test('Regler: „Eigene Werte“ erscheint sofort, Widerspruch Nie + wichtig wird gemeldet', dom, () => {
  const w = bootApp({ storage: { sm_people: [{ name: 'Du', type: 'party' }] } });
  const $ = id => w.document.getElementById(id);
  $('people').querySelector('.tunebtn').click();
  const cust = $('people').querySelector('[data-cust]');
  assert.equal(cust.hidden, true);
  const r = $('people').querySelector('input[type=range]'); r.value = '3'; r.dispatchEvent(new w.Event('input'));
  assert.equal(cust.hidden, false);
  const v = $('people').querySelector('input[data-veto="party"]'); v.checked = true; v.dispatchEvent(new w.Event('change'));
  assert.match($('people').querySelector('[data-warn]').textContent, /Party ist wichtig und zugleich „Nie“/);
});

test('Ergebnisse: Wert und Balken für Screenreader als Text, Vergleich ohne aria-live, Pflichtlinks im Fuß', dom, async () => {
  const w = bootApp();
  const $ = id => w.document.getElementById(id);
  await search(w, 'Wien');
  const card = $('results').querySelector('article');
  assert.match(card.querySelector('.sr').textContent, /Gesamtwert \d+ von 100/);
  assert.equal(card.querySelector('.score').getAttribute('aria-label'), null);
  assert.match(card.querySelector('.mini').textContent, /\d+ %/);
  assert.equal($('compare').getAttribute('aria-live'), null);
  const foot = w.document.querySelector('footer').innerHTML;
  assert.match(foot, /href="\/impressum"/); assert.match(foot, /href="\/datenschutz"/);
  assert.doesNotMatch(w.document.body.innerHTML, /PRIVACY\.md/);
  assert.equal([...$('radius').options].some(o => o.value === 'auto'), false);
});
