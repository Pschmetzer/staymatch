// Runde 11: Gruppen-Abstimmung per Wunsch-Link (#p=), Import und Fairness-Anzeige
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../web/scoring.js');
const G = require('../web/gruppe.js');
const SM = globalThis.StayMatch;
const { bootApp, search, tick, hasDom, web } = require('./helpers/app-dom.js');
const dom = { skip: !hasDom && 'jsdom fehlt (npm ci --prefix tests)' };

test('Wunsch-Link: Person hin und zurück, ohne Reisedaten', () => {
  const p = { name: 'Lena', type: 'party', type2: 'food', veto: ['kids'] };
  const tok = G.encodePerson(p);
  assert.match(tok, /^[A-Za-z0-9_-]+$/); // passt hinter ein „#p=“
  assert.deepEqual(G.decodePerson(tok), SM.cleanPerson(p));
  const custom = { name: 'Tom', type: 'chill', custom: { party: -1, chill: 1, sights: 0.4, food: 0, transit: 0.3, shop: 0, sport: 0.2, kids: 0 } };
  const back = G.decodePerson(G.encodePerson(custom));
  assert.deepEqual(back.custom, SM.cleanPerson(custom).custom);
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(tok, 'base64url'))).sort(), ['c', 'n', 't', 't2', 'v'], 'nur Name, Typ, Regler, Vetos im Link: keine Reisedaten');
});

test('Wunsch-Link: kaputte, riesige und feindliche Texte werden verworfen', () => {
  const evil = [null, undefined, 42, '', 'abc', '!!!', 'a'.repeat(5000), Buffer.from('[1,2]').toString('base64url'), Buffer.from('{"n":5}').toString('base64url'),
    Buffer.from('null').toString('base64url'), Buffer.from('{"n":"x","t":"__proto__","c":[1],"v":"kids"}').toString('base64url')];
  for (const e of evil) { const r = G.decodePerson(e); assert.ok(r === null || (typeof r.name === 'string' && r.type === 'chill' && !r.custom && !r.veto), String(e).slice(0, 20)); }
  const rough = G.decodePerson(Buffer.from(JSON.stringify({ n: '<img src=x onerror=1>'.repeat(10), t: 'party', c: Array(8).fill(99), v: ['nope', 'party', 'party'] })).toString('base64url'));
  assert.ok(rough.name.length <= 40);
  assert.ok(Object.values(rough.custom).every(v => v <= 1)); // Regler auf −1…1 begrenzt
  assert.deepEqual(rough.veto, ['party']);
  // Fuzz: nie eine Ausnahme
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 300; i++) { const s = Array.from({ length: Math.floor(rnd() * 80) }, () => 'AZaz09_-=+/.'[Math.floor(rnd() * 12)]).join(''); assert.doesNotThrow(() => G.decodePerson(s)); assert.doesNotThrow(() => G.tokensFrom(s)); }
});

test('tokensFrom: ganze Links, mehrere in einem Link, nackte Texte, Doppelte', () => {
  const a = G.encodePerson({ name: 'Lena', type: 'party' }), b = G.encodePerson({ name: 'Mia', type: 'chill' });
  assert.deepEqual(G.tokensFrom(`Lena: https://staymatch.pro/app#p=${a}\nMia: https://staymatch.pro/app#p=${b}`), [a, b]);
  assert.deepEqual(G.tokensFrom(`/app#p=${a}.${b}`), [a, b]);
  assert.deepEqual(G.tokensFrom(`${a} ${a}, ${b}`), [a, b]);
  assert.deepEqual(G.tokensFrom('hallo zusammen'), []);
  assert.deepEqual(G.tokensFrom(''), []);
  assert.equal(G.tokensFrom(Array.from({ length: 50 }, (_, i) => `#p=aaaaaaa${i}`).join(' ')).length, G.MAX_PEOPLE);
});

test('mergePeople: neu, aktualisiert, kaputt, voll', () => {
  const cur = [{ name: 'Du', type: 'sights' }, { name: 'Mia', type: 'chill' }];
  const r = G.mergePeople(cur, [G.encodePerson({ name: 'lena', type: 'party' }), G.encodePerson({ name: 'MIA', type: 'family' }), 'kaputt!']);
  assert.deepEqual(r.added, ['lena']); assert.deepEqual(r.updated, ['MIA']); assert.equal(r.bad, 1);
  assert.deepEqual(r.people.map(p => p.name + ':' + p.type), ['Du:sights', 'MIA:family', 'lena:party']);
  assert.equal(cur[1].type, 'chill'); // Eingabe bleibt unverändert
  const big = Array.from({ length: 30 }, (_, i) => ({ name: 'P' + i, type: 'chill' }));
  const f = G.mergePeople(big, [G.encodePerson({ name: 'Neu', type: 'party' })]);
  assert.equal(f.people.length, 30); assert.equal(f.full, 1);
});

const rank = (areas, ppl, f = 0.6) => { for (const a of areas) a.group = SM.groupScore(a.norm, ppl, f); return areas.filter(a => Object.values(a.counts).reduce((x, y) => x + y, 0) >= 10).sort((a, b) => b.group.total - a.group.total); };
const load = city => {
  const d = SM.fromFile(JSON.parse(fs.readFileSync(path.join(web, 'data', city + '.json'), 'utf8')));
  const { areas, pois } = SM.buildData(d.rows); SM.scoreAreas(areas, pois, 800); SM.annotateCentre(areas, d.geo); return areas;
};

test('giveUp: Gegensätze verzichten, die Person mit dem größeren Verlust steht oben', () => {
  const areas = load('rom'), ppl = ['party', 'chill', 'family'].map((t, i) => ({ name: 'P' + i, type: t })).map(p => ({ ...p, w: SM.weightsOf(p) }));
  const ok = rank(areas, ppl), rows = G.giveUp(ok, ppl, ok[0]);
  assert.equal(rows.length, 3);
  for (const r of rows) { assert.ok(r.best >= r.at && r.loss === r.best - r.at && r.loss >= 0); }
  assert.ok(rows[0].loss >= rows[1].loss && rows[1].loss >= rows[2].loss);
  assert.ok(rows[0].loss > 8, 'Party gegen Chill/Familie: jemand verzichtet spürbar');
  assert.match(G.giveUpText(rows), new RegExp(`^${rows[0].name} steckt am meisten zurück: ${rows[0].at} statt ${rows[0].best}`));
  // Maximin-Fairness: höheres Fairness-Gewicht hebt den Wert der unzufriedensten Person (oder lässt ihn gleich)
  const hi = rank(areas, ppl, 1), lo = rank(areas, ppl, 0);
  const worst = ok2 => Math.min(...G.giveUp(ok2, ppl, ok2[0]).map(r => r.at));
  assert.ok(worst(hi) >= worst(lo));
});

test('giveUp: Randfälle (eine Person, leer, alle gleich)', () => {
  const areas = load('salzburg'), one = [{ name: 'A', type: 'party', w: SM.weightsOf({ type: 'party' }) }];
  const ok = rank(areas, one);
  assert.deepEqual(G.giveUp(ok, one, ok[0]), []);
  assert.deepEqual(G.giveUp([], one, null), []);
  const twins = [{ name: 'A', type: 'party' }, { name: 'B', type: 'party' }].map(p => ({ ...p, w: SM.weightsOf(p) }));
  const ok2 = rank(areas, twins), rows = G.giveUp(ok2, twins, ok2[0]);
  assert.equal(rows[0].loss, 0);
  assert.match(G.giveUpText(rows), /Niemand muss/);
  assert.equal(G.giveUpText([]), '');
});

const boot = (hash = '', storage) => {
  const w = bootApp({ url: 'http://localhost/app' + hash, storage }); w.eval(fs.readFileSync(path.join(web, 'gruppe.js'), 'utf8') + '\n//# sourceURL=gruppe.js'); return w;
};

test('App: geöffneter Wunsch-Link fügt die Person hinzu, entfernt das Fragment und bietet Rückgängig', dom, () => {
  const tok = G.encodePerson({ name: 'Lena', type: 'party' });
  const w = boot('#p=' + tok);
  const $ = id => w.document.getElementById(id);
  assert.deepEqual([...w.SMApp.people().map(p => p.name)], ['Du', 'Lena']);
  assert.equal(w.location.hash, ''); // kein Wiederholen beim Neuladen
  assert.match($('grpMsg').textContent, /Neu: Lena/);
  assert.equal($('undo').hidden, false);
  assert.equal(w.errors.length, 0);
});

test('App: „Gruppe importieren“ führt mehrere Links zusammen, kaputte werden gemeldet', dom, () => {
  const w = boot(), $ = id => w.document.getElementById(id);
  const a = G.encodePerson({ name: 'Lena', type: 'party' }), b = G.encodePerson({ name: 'Mia', type: 'chill' });
  $('grpIn').value = `x #p=${a}\ny #p=${b} z #p=@@@`; $('grpGo').click();
  assert.deepEqual([...w.SMApp.people().map(p => p.name)], ['Du', 'Lena', 'Mia']);
  assert.equal($('grpIn').value, '');
  $('grpIn').value = 'nichts hier'; $('grpGo').click();
  assert.match($('grpMsg').textContent, /Kein Wunsch-Link/);
  assert.equal(w.SMApp.people().length, 3);
  assert.equal(w.errors.length, 0);
});

test('App: Wunsch-Link kopieren enthält nur das Fragment mit Name und Typ', dom, async () => {
  const w = boot(), $ = id => w.document.getElementById(id);
  let copied = ''; Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { copied = t; } } });
  $('grpCopy').click(); await tick(5);
  assert.match(copied, /^http:\/\/localhost\/app#p=[A-Za-z0-9_-]+$/);
  assert.equal(G.decodePerson(copied.split('#p=')[1]).name, 'Du');
  assert.equal(new URL(copied).search, ''); // nie in der Query (Server-Logs)
});

test('App: nach der Suche zeigt „Wer steckt zurück?“ die Verzichte der Gruppe', dom, async () => {
  const w = boot('', { sm_people: [{ name: 'Lena', type: 'party' }, { name: 'Mia', type: 'chill' }, { name: 'Tom', type: 'family' }] });
  await search(w, 'Rom');
  const box = w.document.getElementById('giveup');
  assert.equal(box.hidden, false);
  assert.match(box.textContent, /steckt am meisten zurück|Niemand muss/);
  assert.equal(box.querySelectorAll('li').length, 3);
  assert.equal(w.errors.length, 0);
});
