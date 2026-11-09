// Läuft mit: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/parse.js');
const P = globalThis.StayMatchParse;

test('Parser: Preise, Sterne, Details', () => {
  assert.equal(P.num('702 € Gesamtpreis, ursprünglich 896 €'), 702);
  assert.equal(P.num('1.234 €'), 1234);
  assert.deepEqual(P.rating('4,59 (800)'), { value: 4.59, count: 800 });
  assert.deepEqual(P.rating('Neu'), { value: null, count: null });
  assert.deepEqual(P.details(['4 Schlafzimmer', '5 Betten', '2 Badezimmer']), { bedrooms: 4, beds: 5, baths: 2, pro: false });
  assert.equal('/rooms/plus/123?x=1'.match(P.ROOM_RE)[1], '123');
});

test('Parser: Suchparameter', () => {
  const sp = P.searchParams('https://www.airbnb.de/s/x/homes?checkin=2026-12-07&checkout=2026-12-11&adults=5');
  assert.deepEqual(sp, { checkin: '2026-12-07', checkout: '2026-12-11', nights: 4, adults: 5 });
});
