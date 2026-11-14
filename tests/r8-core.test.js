// Kern: Namensvergleich, Dubletten, Nominatim ohne Box, Nachbargemeinden, Fast Food, Chill-Preset
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../shared/core.js');
require('../web/scoring.js');
const SM = globalThis.StayMatch;

test('norm: Buchstaben aller Schriften bleiben, Sonderbuchstaben werden gefaltet', () => {
  assert.equal(C.norm('Østerbro'), 'osterbro');
  assert.equal(C.norm('Łódź'), 'lodz');
  assert.equal(C.norm('Straße'), 'strasse');
  assert.equal(C.norm('Đurđevac'), 'durdevac');
  assert.equal(C.norm('Æblegade'), 'aeblegade');
  assert.equal(C.norm('Пласа'), 'пласа');
  assert.equal(C.norm('Πλάκα'), 'πλακα');
  assert.equal(C.norm('el Raval'), 'raval');
  assert.equal(C.norm('la Vila de Gràcia'), 'gracia');
  assert.equal(C.norm('Gràcia'), 'gracia');
  assert.equal(C.norm('La'), 'la', 'Artikel allein bleibt');
  assert.equal(C.norm(null), '');
});

const row = (place, name, lat, lon) => ({ lat, lon, place, name });

test('splitRows: „Raval“ = „el Raval“, „Gràcia“ = „la Vila de Gràcia“; gleicher Name weit entfernt bleibt', () => {
  const { areas } = C.splitRows([
    row('suburb', 'Raval', 41.380, 2.168), row('suburb', 'el Raval', 41.381, 2.169),
    row('suburb', 'Gràcia', 41.403, 2.157), row('suburb', 'la Vila de Gràcia', 41.404, 2.158),
    row('suburb', 'Raval', 41.50, 2.30), // anderer Ort gleichen Namens, > 1500 m
  ], SM.categoriesOf);
  assert.deepEqual(areas.map(a => a.name), ['Raval', 'Gràcia', 'Raval']);
  assert.deepEqual(Object.keys(areas[0]).sort(), ['lat', 'lon', 'name']);
});

test('splitRows mit Zentrum und filterAreas: Nachbargemeinden fallen weg', () => {
  const centre = { lat: 52.3731, lon: 4.8922 };
  const tags = [row('suburb', 'Jordaan', 52.375, 4.88), row('suburb', 'Diemen', 52.3417, 5.0106)]; // ≈ 11 km
  assert.deepEqual(C.splitRows(tags, SM.categoriesOf, centre).areas.map(a => a.name), ['Jordaan']);
  assert.equal(C.splitRows(tags, SM.categoriesOf).areas.length, 2, 'ohne Zentrum bleibt alles');
  assert.equal(C.filterAreas(tags, { lat: NaN, lon: 1 }).length, 2);
  assert.ok(C.distM(tags[1], centre) > C.MAX_AREA_DIST);
});

test('Fast Food zählt nur etwa ein Drittel wie Restaurants', () => {
  const mk = (amenity, i) => ({ lat: 50 + i * 1e-4, lon: 10, amenity, name: amenity + i });
  const tags = [...Array.from({ length: 90 }, (_, i) => mk('fast_food', i)), ...Array.from({ length: 30 }, (_, i) => mk('restaurant', i + 100))];
  const { raw } = C.splitRows(tags, SM.categoriesOf);
  assert.equal(raw.filter(p => p.tags.amenity === 'fast_food').length, 30);
  assert.equal(raw.filter(p => p.tags.amenity === 'restaurant').length, 30);
});

test('geoFromNominatim: ohne boundingbox oder display_name kein TypeError', () => {
  const g = C.geoFromNominatim({ lat: '48.85', lon: '2.35', display_name: 'Paris, Frankreich' });
  assert.equal(g.name, 'Paris');
  assert.ok(g.bbox[0] < 48.85 && g.bbox[2] > 48.85 && g.bbox[1] < 2.35 && g.bbox[3] > 2.35);
  assert.equal(C.geoFromNominatim({ lat: '1', lon: '2', boundingbox: ['x'] }).name, '');
  assert.equal(C.geoFromNominatim({ lat: 'x', lon: '2' }), null);
  assert.equal(C.geoFromNominatim(null), null);
  assert.equal(C.geoFromNominatim({ lat: '48.85', lon: '2.35', boundingbox: ['48.8', '48.9', '2.2', '2.5'], display_name: 'Paris' }).name, 'Paris');
});

test('Domain: staymatch.pro ist App-Adresse und erste Brücken-Herkunft, tau bleibt als Übergang', () => {
  assert.equal(C.APP_URL, 'https://staymatch.pro/app');
  assert.deepEqual(C.STAYMATCH_ORIGINS.slice(0, 2), ['https://staymatch.pro', 'https://staymatch-tau.vercel.app']);
});

test('Chill: Platz 1 ist in keiner vorab geladenen Stadt das lauteste Viertel', () => {
  const dir = path.join(__dirname, '..', 'web', 'data');
  assert.equal(C.PRESETS.chill.w.party, -1);
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'index.json')) {
    const { geo, rows } = SM.fromFile(JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
    const { areas, pois } = SM.buildData(rows);
    const sc = SM.annotateCentre(SM.scoreAreas(C.filterAreas(areas, geo), pois, C.RADIUS.area), geo);
    const { withData } = SM.eligibleAreas(sc, [{ w: C.PRESETS.chill.w }]);
    const best = withData.map(a => ({ a, t: SM.groupScore(a.norm, [{ w: C.PRESETS.chill.w }]).total })).sort((x, y) => y.t - x.t || x.a.counts.party - y.a.counts.party)[0].a;
    const loudest = [...withData].sort((x, y) => y.counts.party - x.counts.party)[0];
    assert.notEqual(best.name, loudest.name, `${f}: Chill-Sieger ${best.name} ist das lauteste Viertel`);
  }
});
