// Runde 11: „Welche Stadt passt zu uns?“ (/vergleich, /en/compare): gemeinsamer Maßstab, Rangliste, Begründung, App-Link, Seite
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../web/scoring.js');
const G = require('../web/gruppe.js');
const V = require('../web/vergleich.js');
const SM = globalThis.StayMatch;
let JSDOM = null; try { ({ JSDOM } = require('jsdom')); } catch {}
const web = path.join(__dirname, '..', 'web');
const dom = { skip: !JSDOM && 'jsdom fehlt (npm ci --prefix tests)' };

const localFetch = async u => {
  const p = path.join(web, String(u).replace(/^https?:\/\/localhost/, ''));
  if (!/\/data\//.test(String(u)) || !fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
  const body = fs.readFileSync(p, 'utf8');
  return { ok: true, status: 200, json: async () => JSON.parse(body) };
};
let all = null;
const cities = async () => all || (all = await V.loadCities(localFetch, '/data/'));
const P = (t, name = 'A') => ({ name, type: t });

test('loadCities: alle Vorab-Städte, einheitlicher Maßstab (Normwerte 0..1, Spitze erreicht 1)', async () => {
  const { cities: cs, failed } = await cities();
  assert.deepEqual(failed, []);
  assert.ok(cs.length >= 18);
  for (const c of cs) { assert.ok(c.id && c.name && c.areas.length > 5, c.id); }
  const norms = cs.flatMap(c => c.areas.map(a => a.pnorm));
  assert.ok(norms.every(n => Object.values(n).every(v => v >= 0 && v <= 1)));
  for (const k of Object.keys(SM.CATEGORIES)) if (k !== 'shop') assert.ok(Math.max(...norms.map(n => n[k])) > 0.99, k + ' erreicht die gemeinsame Spitze');
  // gleicher Maßstab: Paris hat mehr Party-Orte als Salzburg, also höhere Normwerte
  const top = id => Math.max(...cs.find(c => c.id === id).areas.map(a => a.pnorm.party));
  assert.ok(top('paris') > top('salzburg'));
  assert.equal(typeof norms[0].quiet, 'number'); // Ruhe-Wert (nicht aufzählbar) bleibt vorhanden
  assert.ok(!Object.keys(norms[0]).includes('quiet'));
});

test('Bestes Viertel je Stadt = Platz 1 der App-Rechnung (Normwerte je Stadt), nicht das des gemeinsamen Maßstabs', async () => {
  const { cities: cs } = await cities();
  const groups = [[P('party')], [P('family')], [P('sights')], [P('chill')], [P('party', 'L'), P('chill', 'M'), P('family', 'T')], [{ name: 'V', type: 'chill', veto: ['party'] }]];
  let n = 0;
  for (const g of groups) {
    const ppl = g.map(p => ({ ...p, w: SM.weightsOf(p) }));
    for (const r of V.rankCities(cs, g, { fairness: 0.6 })) {
      if (r.empty) continue;
      const areas = cs.find(c => c.id === r.id).areas;
      for (const a of areas) { a.group = SM.groupScore(a.norm, ppl, 0.6); a.vetoes = SM.vetoes(a.norm, ppl, a.counts); } // so rechnet app.js: a.norm je Stadt
      const ok = SM.eligibleAreas(areas, ppl, 6000).withData.filter(a => !a.vetoes.length);
      const app = SM.pickDiverse(SM.sortAreas(ok, 'fair'), 1, 1200)[0];
      assert.equal(r.best.name, app.name, `${r.id}: ${JSON.stringify(g.map(p => p.type))}`);
      assert.equal(r.best.total, app.group.total); // gleiche Punkte wie in der App
      n++;
    }
  }
  assert.ok(n >= 90);
});

test('loadCities: kaputte Antworten und feindliche Einträge im Index', async () => {
  const fake = async u => {
    if (u.endsWith('index.json')) return { ok: true, json: async () => ({ rom: 'rom.json', evil: '../../etc/passwd.json', x: 'a/b.json', n: 5, salz: 'salzburg.json', kaputt: 'kaputt.json', fehlt: 'fehlt.json' }) };
    if (u.endsWith('kaputt.json')) return { ok: true, json: async () => { throw new SyntaxError('x'); } };
    if (u.endsWith('fehlt.json')) return { ok: false, status: 404 };
    return localFetch(u);
  };
  const progress = [];
  const r = await V.loadCities(fake, '/data/', (n, t) => progress.push([n, t]));
  assert.deepEqual(r.cities.map(c => c.id), ['rom', 'salzburg']);
  assert.deepEqual(r.failed.sort(), ['fehlt.json', 'kaputt.json']);
  assert.deepEqual(progress.at(-1), [4, 4]); // nur gültige Dateinamen wurden angefragt
});

test('rankCities: sortiert, 0..100, Begründung und bestes Viertel je Stadt', async () => {
  const { cities: cs } = await cities();
  for (const t of ['party', 'family', 'sights', 'nature']) {
    const r = V.rankCities(cs, [P(t)], { fairness: 0.6 });
    assert.equal(r.length, cs.length);
    for (let i = 0; i < r.length; i++) {
      assert.ok(r[i].score >= 0 && r[i].score <= 100, t);
      if (i) assert.ok(r[i - 1].score >= r[i].score, 'absteigend');
      if (!r[i].empty) { assert.ok(r[i].best.name && r[i].best.total >= 0); assert.ok(V.explain(r, i, 'de').length >= 1); }
    }
    assert.ok(r[0].score > r[r.length - 1].score, t + ': Städte unterscheiden sich');
  }
  const party = V.rankCities(cs, [P('party')]), calm = V.rankCities(cs, [P('chill')]);
  assert.notDeepEqual(party.slice(0, 5).map(x => x.id), calm.slice(0, 5).map(x => x.id)); // andere Wünsche, andere Städte
  assert.deepEqual(V.rankCities(cs, []), []);
  assert.doesNotThrow(() => V.rankCities(cs, [{ name: 5 }, null, P('__proto__')]));
});

test('rankCities: gleiche Personen = eine Person; Fairness und Preislage wirken', async () => {
  const { cities: cs } = await cities();
  const one = V.rankCities(cs, [P('party', 'A')]), twins = V.rankCities(cs, [P('party', 'A'), P('party', 'B')]);
  assert.deepEqual(twins.map(x => [x.id, x.score]), one.map(x => [x.id, x.score]));
  const mix = [P('party', 'Lena'), P('family', 'Tom')];
  const f0 = V.rankCities(cs, mix, { fairness: 0 }), f1 = V.rankCities(cs, mix, { fairness: 1 });
  assert.ok(f0.some((x, i) => x.score !== f1[i].score || x.id !== f1[i].id), 'Fairness verändert die Wertung');
  assert.ok(f1.find(x => !x.empty).weakest && /^(Lena|Tom)$/.test(f1[0].weakest.name));
  const cheap = V.rankCities(cs, [P('sights')], { maxTier: 1 });
  for (const x of cheap) if (!x.empty) assert.ok(x.best.tier <= 1 || x.relaxed, x.id);
  assert.ok(cheap.some(x => x.relaxed) || cheap.every(x => x.best.tier <= 1));
  assert.ok(V.rankCities(cs, [P('sights')], { maxTier: 9 })[0].score === V.rankCities(cs, [P('sights')], { maxTier: 3 })[0].score); // ungültige Stufe = egal
});

test('rankCities: Veto schließt Viertel aus, ohne Viertel steht die Stadt hinten mit Hinweis', async () => {
  const { cities: cs } = await cities();
  const r = V.rankCities(cs, [{ name: 'A', type: 'chill', veto: ['party'] }]);
  const withVeto = r.filter(x => x.empty);
  for (const x of r.filter(y => !y.empty)) assert.ok(x.best.name);
  for (const x of withVeto) assert.equal(x.score, 0);
  if (withVeto.length) assert.equal(r.at(-1).empty, true);
});

test('explain: Deutsch und Englisch, keine leeren Platzhalter, Vorsprung nach Platz', async () => {
  const { cities: cs } = await cities();
  const r = V.rankCities(cs, [P('party', 'Lena'), P('chill', 'Mia'), P('family', 'Tom')]);
  for (const lang of ['de', 'en']) for (let i = 0; i < r.length; i++) {
    const t = V.explain(r, i, lang).join(' ');
    assert.ok(t.length > 10 && !/undefined|NaN|\[object/.test(t), `${lang} ${i}: ${t}`);
  }
  assert.match(V.explain(r, 0, 'de').join(' '), /(Punkte vor|[Gg]leichauf mit) /);
  assert.match(V.explain(r, 1, 'de').join(' '), /(Punkte hinter|[Gg]leichauf mit) /);
  assert.match(V.explain(r, 0, 'en').join(' '), /(points ahead of|Level with) /);
  assert.equal(V.nameOf('en', { id: 'rom', name: 'Rom' }), 'Rome');
  assert.equal(V.nameOf('de', { id: 'brussel', name: 'Bruxelles - Brussel' }), 'Brüssel');
  assert.equal(V.verdictOf(V.TX.de, 85), 'sehr gut'); assert.equal(V.verdictOf(V.TX.en, 10), 'hardly fits');
});

test('appLink: /app?c=<Stadt>&t=<Typ>, Gruppe im Fragment (nie in der Query)', () => {
  assert.equal(V.appLink('Rom', [P('party')]), '/app?c=Rom&t=party');
  assert.equal(V.appLink('Zürich', [{ name: 'A', ...SM.typePerson('quiet') }]), '/app?c=Z%C3%BCrich&t=quiet');
  assert.equal(V.appLink('Rom', [{ name: 'A', type: 'chill', custom: { party: 1, chill: 0, sights: 0, food: 0, transit: 0, shop: 0, sport: 0, kids: 0 } }]), '/app?c=Rom');
  const l = V.appLink('Lissabon', [P('party', 'Lena'), P('chill', 'Mia'), P('family', 'Tom')]);
  const [path_, hash] = l.split('#');
  assert.equal(path_, '/app?c=Lissabon&t=party');
  assert.deepEqual(G.tokensFrom('#' + hash).map(t => G.decodePerson(t).name), ['Mia', 'Tom']);
  assert.ok(!/Mia|Tom/.test(path_));
});

const bootPage = async (file, extra = {}) => {
  const html = fs.readFileSync(path.join(web, file), 'utf8');
  const dom_ = new JSDOM(html, { url: 'http://localhost/' + file.replace(/\.html$/, ''), runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom_.window; w.errors = []; w.addEventListener('error', e => w.errors.push(e.error || e.message));
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.fetch = async u => localFetch(String(u));
  for (const [k, v] of Object.entries(extra)) w.localStorage.setItem(k, JSON.stringify(v));
  for (const f of ['core.js', 'i18n.js', 'scoring.js', 'gruppe.js', 'vergleich.js']) w.eval(fs.readFileSync(path.join(web, f), 'utf8') + `\n//# sourceURL=${f}`);
  return w;
};
const until = async (fn, ms = 60000) => { const t = Date.now(); while (!fn()) { if (Date.now() - t > ms) throw new Error('Zeitüberschreitung'); await new Promise(r => setTimeout(r, 20)); } };

for (const [file, lang] of [['vergleich.html', 'de'], ['en/compare.html', 'en']]) {
  test(`Seite ${file}: Formular, Rangliste, Gruppe aus der App, Fairness live`, dom, async () => {
    const w = await bootPage(file, { sm_people: [{ name: 'Lena', type: 'party' }, { name: 'Mia', type: 'chill' }] }), $ = id => w.document.getElementById(id);
    assert.equal(w.document.documentElement.lang, lang);
    assert.equal($('rows').querySelectorAll('.prow').length, 2); // Gruppe aus dem Viertel-Finder
    for (const el of w.document.querySelectorAll('#rows input, #rows select, #fair, #tier')) assert.ok(w.document.querySelector(`label[for="${el.id}"]`), 'Label für ' + el.id);
    assert.equal($('out').hidden, true);
    $('cmp').dispatchEvent(new w.Event('submit', { cancelable: true }));
    await until(() => !$('out').hidden && $('go').disabled === false);
    const items = [...$('out').querySelectorAll('li')];
    assert.ok(items.length >= 18);
    assert.match(items[0].textContent, /\d+\/100/);
    const href = items[0].querySelector('a').getAttribute('href');
    assert.match(href, /^\/app\?c=[^&#]+&t=party#p=/);
    assert.ok(items[0].querySelector('h2') && $('out').getAttribute('aria-label'));
    // Fairness live ändern: Liste wird neu geschrieben (ohne neues Laden)
    const before = items.map(li => li.textContent).join();
    $('fair').value = '0'; $('fair').dispatchEvent(new w.Event('input', { bubbles: true }));
    await until(() => [...$('out').querySelectorAll('li')].map(li => li.textContent).join() !== before, 5000);
    // Person entfernen und hinzufügen
    $('rows').querySelector('[data-del="1"]').click();
    assert.equal($('rows').querySelectorAll('.prow').length, 1);
    $('add').click(); assert.equal($('rows').querySelectorAll('.prow').length, 2);
    assert.equal(w.errors.length, 0);
    // Es wird nichts gesendet: nur /data/* angefragt (kein Aufruf mit Nutzerdaten)
  });
}

test('Seite: Dark Mode teilt sich mit der App (sm_theme als reiner Text), Link in die App nimmt die Gruppe mit', dom, async () => {
  const w = await bootPage('vergleich.html', { sm_people: [{ name: 'Lena', type: 'party' }, { name: 'Mia', type: 'chill' }] }), $ = id => w.document.getElementById(id);
  w.localStorage.setItem('sm_theme', 'dark');
  w.eval(fs.readFileSync(path.join(web, 'vergleich.js'), 'utf8')); // Init liest die gespeicherte Wahl der App noch einmal
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  $('theme').click();
  assert.equal(w.localStorage.getItem('sm_theme'), 'light'); // nicht "\"light\"": app.html vergleicht den reinen Text
  assert.equal(w.document.documentElement.dataset.theme, 'light');
  $('cmp').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await until(() => !$('out').hidden && $('go').disabled === false);
  $('rows').querySelector('[data-del="1"]').click(); // Mia weg, Lena in „Foodie“ umbenannt
  const n = $('pn0'); n.value = 'Lena K.'; n.dispatchEvent(new w.Event('input', { bubbles: true }));
  const a = $('out').querySelector('a'); a.addEventListener('click', e => e.preventDefault()); a.click();
  const saved = JSON.parse(w.localStorage.getItem('sm_people'));
  assert.deepEqual(saved.map(p => p.name), ['Lena K.']);
  assert.equal(JSON.parse(w.localStorage.getItem('sm_fair')), 0.6);
});

test('Seite: nur Dateien aus /data/ werden angefragt, Namen landen nie in einer Adresse', dom, async () => {
  const w = await bootPage('vergleich.html', { sm_people: [{ name: 'Geheim', type: 'party' }] }), $ = id => w.document.getElementById(id);
  const urls = []; w.fetch = async u => { urls.push(String(u)); return localFetch(String(u)); };
  $('cmp').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await until(() => !$('out').hidden && $('go').disabled === false);
  assert.ok(urls.length >= 18 && urls.every(u => /^\/data\/[\w-]+\.json$|^\/data\/index\.json$/.test(u)), urls.join());
  assert.ok(!urls.some(u => /Geheim/.test(u)));
});

test('HTML: Seiten verlinkt, Sitemap, kein Inline-Skript, Sprachlinks', () => {
  for (const [f, canon, other] of [['vergleich.html', 'https://staymatch.pro/vergleich', '/en/compare'], ['en/compare.html', 'https://staymatch.pro/en/compare', '/vergleich']]) {
    const h = fs.readFileSync(path.join(web, f), 'utf8');
    assert.ok(h.includes(`rel="canonical" href="${canon}"`));
    assert.ok(h.includes(`href="${other}"`));
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(h), 'kein Inline-Skript (CSP-Härtung)');
    assert.ok(!/ style="/.test(h));
  }
  const sm = fs.readFileSync(path.join(web, 'sitemap.xml'), 'utf8');
  assert.ok(sm.includes('<loc>https://staymatch.pro/vergleich</loc>') && sm.includes('<loc>https://staymatch.pro/en/compare</loc>'));
  assert.ok(fs.readFileSync(path.join(web, 'index.html'), 'utf8').includes('href="/vergleich"'));
  assert.ok(fs.readFileSync(path.join(web, 'en.html'), 'utf8').includes('href="/en/compare"'));
  assert.ok(fs.readFileSync(path.join(web, 'app.html'), 'utf8').includes('href="/vergleich"'));
  assert.ok(fs.readFileSync(path.join(web, 'app.html'), 'utf8').includes('<script src="gruppe.js" defer>'));
});
