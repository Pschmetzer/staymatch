// P1: Parser. Alle Eingaben selbst gebaut (keine Airbnb-Kopien). Live-Verhalten von Airbnb ist hier NICHT geprüft.
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/parse.js');
const P = globalThis.StayMatchParse;

test('num nimmt die Zahl am Währungszeichen', () => {
  assert.equal(P.num('4 Nächte: 702 €'), 702);
  assert.equal(P.num('702 € Gesamtpreis, ursprünglich 896 €'), 702);
  assert.equal(P.num('€1,234'), 1234);
  assert.equal(P.num('120 zł'), 120);
  assert.equal(P.num('nur Text'), null);
});

test('Währungen: Dollar-Arten, zł, kr', () => {
  assert.equal(P.currency('US$ 99'), 'US$');
  assert.equal(P.currency('A$ 99'), 'A$');
  assert.equal(P.currency('C$ 99'), 'C$');
  assert.equal(P.currency('$99'), '$');
  assert.equal(P.currency('120 zł'), 'zł');
  assert.equal(P.currency('900 kr'), 'kr');
});

test('Gesamtpreis-Wörter', () => {
  for (const w of ['totaal', 'łącznie', 'total', 'totalt', 'celkem', 'Gesamtpreis']) assert.ok(P.TOTAL_RE.test(`120 € ${w}`), w);
  assert.ok(!P.TOTAL_RE.test('120 € pro Nacht'));
});

test('Sterne in mehreren Formaten', () => {
  assert.deepEqual(P.rating('4,9 · 12 Bewertungen'), { value: 4.9, count: 12 });
  assert.deepEqual(P.rating('4.9 (12 reviews)'), { value: 4.9, count: 12 });
  assert.deepEqual(P.rating('4,59 (800)'), { value: 4.59, count: 800 });
  assert.deepEqual(P.rating('4,5 Sterne 3 Betten'), { value: null, count: null });
});

test('Betten: Doppelbetten und Schlafsofa zählen als Schlafplätze', () => {
  assert.equal(P.details(['2 Doppelbetten']).beds, 2);
  assert.equal(P.detailsExt(['2 Doppelbetten', '1 Schlafsofa']).sleeps, 5);
  assert.equal(P.detailsExt(['3 Betten']).sleeps, null);
  assert.equal(P.details(['1 Schlafzimmer']).beds, null, 'Schlafzimmer sind keine Betten');
  assert.equal(P.details(['1,5 Bäder']).baths, 1.5);
  assert.deepEqual(Object.keys(P.details([])), ['bedrooms', 'beds', 'baths', 'pro'], 'Form von details() bleibt');
});

test('Viertel aus dem Titel: letzte Präposition, mehrere Sprachen', () => {
  assert.equal(P.localityFromTitle('Wohnung in Gràcia'), 'Gràcia');
  assert.equal(P.localityFromTitle('Appartement à Montmartre'), 'Montmartre');
  assert.equal(P.localityFromTitle('Piso en Gràcia'), 'Gràcia');
  assert.equal(P.localityFromTitle('Appartamento a Trastevere'), 'Trastevere');
  assert.equal(P.localityFromTitle('Zimmer im Zentrum in Rom'), 'Rom');
  assert.equal(P.localityFromTitle(''), null);
});

// kleiner Dokument-Ersatz, nur mit dem, was fromState braucht
function fakeDoc(json, cards = []) {
  let reads = 0;
  const el = { get textContent() { reads++; return json; } };
  return { reads: () => reads, getElementById: id => id === 'data-deferred-state-0' ? el : null, querySelectorAll: () => cards };
}
const stateJson = (rows) => JSON.stringify({ niobeClientData: [[0, { data: { presentation: { staysSearch: { results: { searchResults: rows } } } } }]] });
const row = (id, label, lat) => ({ demandStayListing: { id: Buffer.from('DemandStayListing:' + id).toString('base64'), location: { coordinate: { latitude: lat, longitude: 2 } } },
  structuredDisplayPrice: { primaryLine: { accessibilityLabel: label } }, avgRatingLocalized: '4,8 (30)', title: 'Wohnung in Gràcia', structuredContent: { primaryLine: [{ body: '2 Doppelbetten' }] } });
globalThis.atob = globalThis.atob || (s => Buffer.from(s, 'base64').toString());

test('fromState: JSON wird nur bei geändertem textContent neu geparst', () => {
  const d1 = fakeDoc(stateJson([row('11', '4 Nächte: 702 € Gesamtpreis', 41.4)]));
  const a = P.fromState(d1);
  assert.equal(a[0].totalPrice, 702); assert.equal(a[0].isTotal, true); assert.equal(a[0].sleeps, 4);
  const origParse = JSON.parse; let calls = 0; JSON.parse = (...x) => { calls++; return origParse(...x); };
  try {
    P.fromState(d1); P.fromState(d1);
    assert.equal(calls, 0, 'gleicher Text: kein neues JSON.parse');
    P.fromState(fakeDoc(stateJson([row('12', '90 €', 41.5)])));
    assert.equal(calls, 1);
  } finally { JSON.parse = origParse; }
});

test('parseSearch: veralteter State liefert Koordinaten, aber nie den Preis', () => {
  const card = { querySelector: s => s.includes('rooms') ? { getAttribute: () => '/rooms/11' } : s.includes('price') ? { innerText: '500 € gesamt' } : null, innerText: '4,8 (30)\n500 € gesamt' };
  const doc = fakeDoc(stateJson([row('11', '702 € Gesamtpreis', 41.4)]), [card]);
  const [l] = P.parseSearch(doc);
  assert.equal(l.totalPrice, 500, 'abweichender DOM-Preis gewinnt (State veraltet)');
  assert.equal(l.isTotal, true);
  assert.equal(l.lat, 41.4);
  assert.equal(l.coordsMissing, false);
  const noCoord = fakeDoc(stateJson([{ ...row('11', '1 €', 0), demandStayListing: { id: row('11', '', 0).demandStayListing.id } }]), [card]);
  assert.equal(P.parseSearch(noCoord)[0].coordsMissing, true);
});

test('Fallback-Preiszeile der Karten kennt zł und kr', () => {
  const mk = txt => ({ querySelector: s => s.includes('rooms') ? { getAttribute: () => '/rooms/5' } : null, innerText: txt });
  const l = P.fromCards({ querySelectorAll: () => [mk('Wohnung\n4,9 (12)\n640 zł łącznie')] })[0];
  assert.equal(l.totalPrice, 640); assert.equal(l.currency, 'zł'); assert.equal(l.isTotal, true);
  const k = P.fromCards({ querySelectorAll: () => [mk('Lejlighed\n900 kr')] })[0];
  assert.equal(k.currency, 'kr');
});

test('Hausregeln', () => {
  const r = P.houseRules('Keine Partys oder Veranstaltungen. Ruhezeiten 22:00 bis 08:00. Nichtraucher.');
  assert.equal(r.noParties, true); assert.deepEqual(r.quietHours, { from: 22, to: 8 }); assert.equal(r.noSmoking, true);
  assert.equal(P.houseRules('No parties. Quiet hours.').quietHours, true);
  assert.equal(P.houseRules('Alles erlaubt').noParties, false);
});

test('Ausstattung', () => {
  const a = P.amenities('WLAN, Küche, Klimaanlage, kostenloser Parkplatz, Waschmaschine');
  assert.deepEqual([a.wifi, a.kitchen, a.ac, a.parking, a.washer, a.pool], [true, true, true, true, true, false]);
});

test('Stornobedingung', () => {
  assert.deepEqual(P.cancellation('Kostenlose Stornierung bis 5. Dezember'), { kind: 'free', until: '5. Dezember' });
  assert.equal(P.cancellation('Nicht erstattungsfähig').kind, 'nonrefundable');
  assert.equal(P.cancellation('Streng').kind, 'strict');
  assert.equal(P.cancellation('nichts').kind, null);
});

test('Gastgeber-Infos', () => {
  const h = P.hostInfo('Superhost. Gastgeber seit 2016. Antwortrate: 100 %. Antwortet innerhalb eines Tages. Identität verifiziert');
  assert.equal(h.superhost, true); assert.equal(h.since, '2016'); assert.equal(h.responseRate, '100'); assert.equal(h.responseTime, 'day'); assert.equal(h.verified, true);
});

test('Betrugsmuster: nur Hinweise', () => {
  assert.equal(P.scamSignals('Schreib mir auf WhatsApp, Zahlung außerhalb von Airbnb').length, 2);
  assert.deepEqual(P.scamSignals('Schöne Wohnung am Park'), []);
});

test('Touristensteuer', () => {
  const t = P.touristTax('Zzgl. Touristensteuer von 2 € pro Nacht, vor Ort zu zahlen.');
  assert.equal(t.mentioned, true); assert.match(t.text, /Touristensteuer/);
  assert.equal(P.touristTax('Nichts').mentioned, false);
});

test('parseSearch: frischer State bleibt maßgeblich, "gesamt" geht nicht verloren', () => {
  // Karte zeigt nur "702 €" (ohne Wort), State sagt Gesamtpreis → bleibt Gesamtpreis (ungeprüft live: was die Karte zeigt)
  const mk = txt => ({ querySelector: s => s.includes('rooms') ? { getAttribute: () => '/rooms/11' } : s.includes('price') ? { innerText: txt } : null, innerText: txt });
  const [l] = P.parseSearch(fakeDoc(stateJson([row('11', '702 € Gesamtpreis', 41.4)]), [mk('702 €')]));
  assert.equal(l.totalPrice, 702); assert.equal(l.isTotal, true);
  // veralteter State, Karte ohne Wort: Betrag vom DOM, Einheit vom State
  const stale = P.parseSearch(fakeDoc(stateJson([row('11', '999 € Gesamtpreis', 41.4)]), [mk('702 €')]))[0];
  assert.equal(stale.totalPrice, 702); assert.equal(stale.isTotal, true); assert.equal(stale.priceFromDom, true);
  // Karte sagt ausdrücklich "pro Nacht": das gilt
  assert.equal(P.parseSearch(fakeDoc(stateJson([row('11', '999 € Gesamtpreis', 41.4)]), [mk('90 € pro Nacht')]))[0].isTotal, false);
});
