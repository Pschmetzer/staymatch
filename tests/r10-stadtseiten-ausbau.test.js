// Stadtseiten R10: Steckbrief, SVG, Rechenweg, Nachbarn, Dataset-JSON-LD, Übersichtsseiten, eindeutige Titel
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const web = path.join(__dirname, '..', 'web');
const read = f => fs.readFileSync(path.join(web, f), 'utf8');
const de = fs.readdirSync(path.join(web, 'staedte')).filter(f => f.endsWith('.html'));
const en = fs.readdirSync(path.join(web, 'en', 'cities')).filter(f => f.endsWith('.html'));
const ld = h => JSON.parse(h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

test('jede Stadtseite (DE und EN): Steckbrief, 5 SVG, Rechenweg mit Gewichten, Nachbarn, /vergleich', () => {
  assert.equal(de.length, en.length);
  for (const [dir, files, cmp] of [['staedte', de, '/vergleich'], ['en/cities', en, '/en/compare']]) for (const f of files) {
    const h = read(`${dir}/${f}`);
    assert.match(h, /id="steckbrief"/, f);
    assert.equal((h.match(/<svg class="bars"/g) || []).length, 5, f + ': ein SVG je Reisetyp');
    assert.match(h, /id="gerechnet"/, f);
    assert.match(h, /<table>/, f + ': Gewichtstabelle');
    assert.match(h, /id="nachbarn"/, f);
    assert.ok(h.includes(`href="${cmp}"`), f + ': Link zum Städtevergleich');
    assert.ok(!/NaN|undefined/.test(h), f + ': NaN/undefined im Text');
  }
});

test('Titel und Beschreibungen sind je Sprache eindeutig', () => {
  for (const [dir, files] of [['staedte', de], ['en/cities', en]]) {
    const titles = files.map(f => read(`${dir}/${f}`).match(/<title>(.*?)<\/title>/)[1]);
    const descs = files.map(f => read(`${dir}/${f}`).match(/name="description" content="(.*?)"/)[1]);
    assert.equal(new Set(titles).size, files.length, dir + ': Titel');
    assert.equal(new Set(descs).size, files.length, dir + ': Beschreibungen');
  }
});

test('Dataset-JSON-LD: ODbL-Lizenz, OSM als Quelle, kein Download-Link in das gesperrte /data/', () => {
  for (const [dir, files] of [['staedte', de], ['en/cities', en]]) for (const f of files) {
    const h = read(`${dir}/${f}`), ds = ld(h)['@graph'].find(x => x['@type'] === 'Dataset');
    assert.ok(ds, f);
    assert.equal(ds.license, 'https://opendatacommons.org/licenses/odbl/1-0/');
    assert.match(ds.citation, /OpenStreetMap/);
    assert.ok(!('distribution' in ds) && !h.includes('/data/'), f + ': /data/ steht in robots.txt auf Disallow');
  }
  assert.match(read('robots.txt'), /Disallow: \/data\//);
});

test('Übersichtsseiten /staedte und /en/cities: alle Städte, Typ-Filter, hreflang, Sitemap', () => {
  for (const [file, files, prefix, other] of [['staedte.html', de, '/staedte/', '/en/cities'], ['en/cities.html', en, '/en/cities/', '/staedte']]) {
    const h = read(file);
    assert.equal((h.match(/<article class="card"/g) || []).length, files.length, file);
    for (const f of files) assert.ok(h.includes(`href="${prefix}${f.replace('.html', '')}"`), `${file}: ${f}`);
    assert.match(h, /<fieldset id="filter" hidden>/, 'ohne JS bleibt die Auswahl verborgen');
    assert.match(h, /src="\/staedte-filter\.js" defer/);
    assert.ok(h.includes(`hreflang="${file.startsWith('en') ? 'de' : 'en'}" href="https://staymatch.pro${other}"`), file);
    assert.ok(!/<script(?![^>]*(src=|application\/ld\+json))/.test(h), 'kein Inline-Skript (CSP)');
  }
  const sm = read('sitemap.xml');
  for (const u of ['/staedte', '/en/cities']) assert.ok(sm.includes(`<loc>https://staymatch.pro${u}</loc>`), u);
});

test('staedte-filter.js: sortiert die Karten nach dem gewählten Typ (jsdom)', () => {
  let JSDOM; try { ({ JSDOM } = require('jsdom')); } catch { return; }
  const dom = new JSDOM(read('staedte.html'), { runScripts: 'outside-only' });
  dom.window.eval(read('staedte-filter.js'));
  const box = dom.window.document.getElementById('filter');
  assert.equal(box.hidden, false);
  const radio = box.querySelector('input[value="party"]');
  radio.checked = true; radio.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  const list = dom.window.document.getElementById('cities');
  assert.equal(list.dataset.f, 'party');
  const sc = [...list.children].map(c => +c.dataset.sparty);
  assert.deepEqual(sc, [...sc].sort((a, b) => b - a));
});
