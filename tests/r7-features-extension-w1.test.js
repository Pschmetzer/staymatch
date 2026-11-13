// Runde 7 E, Welle 1: Zusatz-Hinweise der Unterkunftsseite und Bewertungs-Analyse. Synthetische Texte (keine Airbnb-Kopien).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/parse.js');
require('../extension/rank.js');
require('../extension/hints.js');
require('../extension/extras.js');
const { StayMatchExtras: X, StayMatchHints: H } = globalThis;
const D = require('./helpers/dom.js');
const skip = !D.JSDOM && 'jsdom nicht installiert (npm install --prefix tests)';
const { makePage, chromeMock, shadow, until } = D;
test.after(D.closeAll);

test('R7E Preise: Kaution, Zusatzgast, Vor-Ort-Kosten, Bettwäsche, Gebühren-Anteil, Parken', () => {
  assert.deepEqual(X.deposit('Wir verlangen eine Kaution von 300 € bei Ankunft.'), { amount: 300, currency: '€' });
  assert.equal(X.deposit('Kaution nach Absprache.'), null);
  const f = X.extraGuestFee('Ab 3 Gästen 20 € pro Person und Nacht.');
  assert.deepEqual(f, { amount: 20, currency: '€', included: 2, perNight: true });
  assert.equal(X.extraGuestCost(f, 4, 3), 120);
  assert.equal(X.extraGuestCost(f, 2, 3), 0);
  assert.equal(X.extraGuestFee('$25 per extra guest after 4 guests').included, 4);
  assert.deepEqual(X.onSiteCosts('Strom nach Verbrauch. Kurtaxe bar vor Ort. Bettwäsche gegen Gebühr.'), ['Strom nach Verbrauch', 'Kurtaxe vor Ort', 'Bettwäsche/Handtücher gegen Gebühr']);
  const fees = X.fees('Reinigungsgebühr 80 €\nServicegebühr 40 €\nGesamt 400 €');
  assert.deepEqual(fees, { cleaning: 80, service: 40, currency: '€' });
  assert.equal(X.feeShare(fees, 400), 0.3);
  assert.equal(X.parkingInfo('Parkplatz gegen Gebühr, 25 € pro Tag').amount, 25);
  assert.equal(X.parkingInfo('Tiefgarage im Haus').garage, true);
  assert.deepEqual(X.checkoutChores('Vor der Abreise: Spülmaschine anstellen, Müll rausbringen, Betten abziehen.'), ['Geschirr', 'Betten abziehen', 'Müll']);
});

test('R7E Räume: Durchgangszimmer, Esstisch, Geschirr, Bettbreite, Fläche, Etage, Hochbett', () => {
  const x = X.roomExtras({ desc: 'Offener Schlafbereich. Esstisch für 4. Geschirr für 4. Doppelbett 140 cm. 38 m² im 4. Stock. Hochbett für Kinder. Wir wohnen im Erdgeschoss.', amen: 'WLAN' });
  assert.equal(x.passRoom, true);
  assert.equal(x.seats, 4);
  assert.equal(x.dishes, 4);
  assert.equal(x.bedWidth, 140);
  assert.equal(x.area, 38);
  assert.deepEqual(x.floor, { ground: false, floor: 4 });
  assert.equal(x.loft, true);
  assert.equal(x.hostNear, true);
  const n = X.roomNotes(x, { people: 6 });
  assert.ok(n.warn.some(w => /Esstisch für 4, ihr seid 6/.test(w)));
  assert.ok(n.warn.some(w => /Geschirr für 4/.test(w)));
  assert.ok(n.warn.some(w => /Durchgangszimmer/.test(w)));
  assert.ok(n.warn.some(w => /6,3 m² pro Person|6 m² pro Person/.test(w)));
  assert.ok(n.info.some(w => /4\. Stock, kein Aufzug/.test(w)));
  const two = X.roomNotes(x, { people: 2 });
  assert.ok(two.info.some(w => /140 cm breit/.test(w)));
});

test('R7E Ausstattung: „Nicht verfügbar“ zählt nicht, Küche in Stufen, Kaffee, Sicherheit, Baby, Barrierefreiheit', () => {
  const f = X.features('Badewanne\nSchreibtisch\nNicht verfügbar: Rauchmelder\nKein Feuerlöscher\nKohlenmonoxidmelder\nNespresso-Maschine\nStufenloser Zugang\nHaltegriffe\nKinderbett');
  assert.equal(f.bathtub, true);
  assert.equal(f.workspace, true);
  assert.equal(f.smoke, undefined);
  assert.equal(f.extinguisher, undefined);
  assert.equal(f.co, true);
  assert.equal(X.coffee('Nespresso-Maschine'), 'Kapselmaschine');
  assert.equal(X.kitchenLevel(X.features('Backofen, Herd, Spülmaschine'), ''), 'full');
  assert.equal(X.kitchenLevel(X.features('Kochnische mit Mikrowelle'), ''), 'basic');
  const x = X.roomExtras({ amen: 'Badewanne\nNicht verfügbar: Rauchmelder\nKinderbett\nStufenloser Zugang\nHaltegriffe\nAußenkamera' });
  const n = X.roomNotes(x, { people: 3, infants: 1 });
  assert.ok(n.info.some(w => /Nicht angegeben: Rauchmelder, CO-Melder, Feuerlöscher/.test(w)));
  assert.ok(n.info.some(w => /Baby an Bord: ✓ Kinderbett · fehlt: Hochstuhl/.test(w)));
  assert.ok(n.plus.some(w => /stufenlos, Haltegriffe/.test(w)));
  assert.ok(n.info.some(w => /Außenkamera/.test(w)));
});

test('R7E Hausregeln: Kinder, Mindestalter, Besucher, Haustiere, Allergie, Regel-Dichte, Rauchen', () => {
  const x = X.roomExtras({ rules: 'Nicht für Kinder geeignet.\nMindestalter 25.\nKeine Besucher.\nNur kleine Hunde, max. 1 Haustier.\nRauchen ist erlaubt.', desc: 'Unsere Katze lebt hier mit. Teppichboden im Schlafzimmer. Haustiergebühr 30 €.' });
  assert.equal(x.notForKids, true);
  assert.equal(x.minAge, 25);
  assert.equal(x.noVisitors, true);
  assert.deepEqual(x.petLimits, ['nur kleine Tiere', 'höchstens 1 Tier']);
  assert.deepEqual(x.allergy, ['Katze lebt in der Unterkunft', 'Teppichboden']);
  assert.equal(x.petFee.amount, 30);
  assert.equal(x.smokingOk, true);
  const n = X.roomNotes(x, { people: 3, children: 1, pets: 1, wishes: ['petFree'] });
  assert.ok(n.warn.some(w => /nicht für Kinder/.test(w)));
  assert.ok(n.warn.some(w => /Haustiere: nur kleine Tiere/.test(w)));
  assert.ok(n.warn.some(w => /Allergiker/.test(w)));
  assert.equal(X.ruleCount('a: Regel eins\nb: Regel zwei\nc: Regel drei'), 3);
  assert.ok(X.roomNotes(X.roomExtras({}), { pets: 1, noPets: true }).info.some(w => /Assistenztiere/.test(w)));
  assert.ok(X.roomNotes(X.roomExtras({}), { smoker: true, noSmoking: true }).warn.some(w => /Rauchverbot/.test(w)));
});

test('R7E Gastgeber, Lizenz, Selbstauskunft, Werbewörter, Tageslicht, Saison, Silvester, 28 Nächte', () => {
  const hx = X.hostExtra('Lebt in Lissabon\nSpricht Deutsch, Englisch und Portugiesisch\n48 Unterkünfte\nIdentität nicht verifiziert');
  assert.equal(hx.livesIn, 'Lissabon');
  assert.deepEqual(hx.languages, ['Deutsch', 'Englisch', 'Portugiesisch']);
  assert.equal(hx.listings, 48);
  assert.equal(hx.notVerified, true);
  assert.equal(X.license('Registriernummer: HUTB-012345'), 'HUTB-012345');
  assert.equal(X.license('Lizenz: beantragt'), null);
  assert.deepEqual(X.greenClaims('Ökostrom und Solar auf dem Dach'), ['Ökostrom', 'Solar']);
  assert.ok(X.superlatives('Atemberaubend, einzigartig, eine Oase, traumhaft schön.').count >= 4);
  const oslo = X.dayLength(59.9, '2026-12-21');
  assert.ok(oslo > 5.5 && oslo < 6.5, String(oslo));
  assert.ok(Math.abs(X.dayLength(0, '2026-03-20') - 12.1) < 0.3);
  const x = X.roomExtras({ amen: 'Pool', rules: 'Kaution 500 €', desc: 'Kaution 500 €' });
  const n = X.roomNotes({ ...x, host: hx }, { people: 4, checkin: '2026-12-30', nights: 3, noParties: true, lat: 41 });
  assert.ok(n.warn.some(w => /Silvester: Partyverbot, Kaution 500 €/.test(w)));
  assert.ok(n.info.some(w => /Außenpool/.test(w)));
  assert.ok(n.warn.some(w => /Identität/.test(w)));
  assert.ok(X.roomNotes(x, { nights: 30 }).info.some(w => /28 Nächten/.test(w)));
  const soon = X.roomNotes(x, { checkin: '2026-05-02', responseTime: 'day', now: Date.parse('2026-05-01') });
  assert.ok(soon.warn.some(w => /Sofortbuchung/.test(w)));
  assert.ok(X.roomNotes(X.roomExtras({ amen: 'WLAN' }), { checkin: '2026-07-20', lat: 41, text: 'Dachgeschoss mit Blick' }).warn.some(w => /Dachgeschoss/.test(w)));
});

test('R7E Wünsche aus der Ausstattung, Profile, Wünsche aus einem Satz', () => {
  const x = X.roomExtras({ amen: 'Badewanne\nSchreibtisch' });
  assert.equal(X.EXTRA_WISHES.bathtub.check(x), true);
  assert.equal(X.EXTRA_WISHES.washer.check(x), false); // Ausstattung gelesen, keine Waschmaschine
  assert.equal(X.EXTRA_WISHES.washer.check(null), null); // nichts gelesen = unbekannt
  assert.equal(X.EXTRA_WISHES.hostOnSite.check(null, { kind: 'Privatzimmer in Gràcia' }), true);
  assert.ok(X.PROFILES.work.wishes.includes('workspace'));
  assert.deepEqual(X.wishesFromSentence('ruhige ganze Wohnung mit WLAN unter 120'), { wishes: ['quiet', 'wifi', 'whole'], budgetNight: 120 });
  assert.equal(X.advanceText(1240, 5, '€', { kind: 'free', until: '3. Mai' }), 'Ich zahle die Unterkunft: 1.240 €. Bitte je 248 € an mich (5 Personen). Kostenlos stornierbar bis 3. Mai.');
});

test('R7E Bewertungen: neue Kategorien mit Verneinung', () => {
  const h = H.reviewHints('Die Matratze war durchgelegen. Es roch muffig. Kein warmes Wasser am Morgen. Die Nachbarn haben sich beschwert. Nachts sicher. Der Gastgeber hat sofort reagiert. Wir kommen gerne wieder! Ohrstöpsel waren nötig. Mit unserem Hund problemlos. Mit dem Rollator ging alles.');
  for (const k of ['⚠️ Matratze schlecht', '⚠️ Geruch/Feuchtigkeit', '⚠️ Warmwasser', '⚠️ Nachbarn-Ärger', '👍 sichere Gegend', '👍 Gastgeber löst Probleme', '👍 Gäste kamen wieder', '⚠️ Ohrstöpsel nötig', '👍 mit Hund da', '👍 mit Rollstuhl/Rollator']) assert.ok(h.includes(k), k);
  assert.ok(H.reviewHints('Der Gastgeber hat die Buchung 3 Tage vor Ankunft storniert.').includes('⚠️ Gastgeber hat storniert'));
  assert.deepEqual(H.reviewHints('Wir würden nicht wiederkommen.'), ['⚠️ würden nicht wiederkommen']);
  assert.deepEqual(H.reviewHints('Sehr hellhörig.'), ['⚠️ hellhörig']);
  assert.deepEqual(H.reviewHints('Kein Schimmel, alles gut.'), ['👍 kein Geruch']);
  assert.deepEqual(H.reviewHints('Ich war unsicher, ob es klappt.'), []);
});

test('R7E Bewertungen gesamt: Kritik-Quote, Einzelfall, Lärmzeit, Gästemix, Sprachen, Zahlen, Renovierung, Trend, Höflichkeit', () => {
  const good = Array.from({ length: 19 }, (_, i) => `Sehr sauber und tolle Lage ${i}.`);
  assert.deepEqual(H.criticalShare([...good, 'Leider schmutzig.']), { critical: 1, total: 20, single: true });
  assert.equal(H.criticalShare(['a', 'b']), null);
  assert.equal(H.noiseTimes(['Ab 2 Uhr laut von der Bar.', 'Nachts Lärm.']), 'meist nachts');
  assert.equal(H.noiseTimes(['Um 6 Uhr Müllabfuhr, sehr laut.', 'Morgens laut.']), 'meist morgens');
  assert.equal(H.guestMix(['Mit meinem Mann hier.', 'Romantisch!', 'Mit meiner Frau.', 'Wir beide fanden es toll.']).top, 'Paare');
  assert.equal(H.languages(['Es war sehr schön und wir waren froh.', 'The place was very nice and we loved it.', 'Nous avons adoré, très bien et le lit était top.']), 3);
  assert.deepEqual(H.numberFacts(['Nur 10 Minuten zur Metro.', '3. Stock ohne Aufzug, aber ok.']), ['10 Minuten zur Metro', '3. Stock ohne Aufzug']);
  assert.equal(H.renovated(['Neu renoviert, top!', 'alt']), true);
  const trend = [...Array.from({ length: 10 }, () => 'Okay.'), ...Array.from({ length: 10 }, () => 'Sehr sauber.')];
  assert.match(H.keywordTrend(trend), /früher oft gelobt/);
  assert.equal(H.politeFives([{ rating: 5, text: 'Leider schmutzig, sonst nett.' }, { rating: 5, text: 'Toll.' }]), 1);
});

const ROOM_URL = 'https://www.airbnb.de/rooms/777?checkin=2026-05-01&checkout=2026-05-03&adults=4';
test('R7E Unterkunftsseite: wichtige Hinweise sichtbar, Rest unter „Mehr Hinweise“, Gebucht-Status mit Gründen', { skip }, async () => {
  const body = `<script type="application/ld+json">${JSON.stringify({ name: 'Loft', aggregateRating: { ratingValue: '4.8', ratingCount: '55' } })}</script>
    <div data-testid="book-it-default"><div>200 € pro Nacht</div><div>Reinigungsgebühr 90 €</div><div>Servicegebühr 50 €</div><div>Gesamt 540 €</div></div>
    <div data-section-id="DESCRIPTION_DEFAULT">Esstisch für 2. Kaution 300 €. Strom nach Verbrauch.</div>
    <div data-section-id="AMENITIES_DEFAULT">WLAN\nBadewanne</div>
    <div data-section-id="MEET_YOUR_HOST"><a href="/users/show/99">Anna</a> Lebt in Barcelona</div>`;
  const chrome = chromeMock({ quick: { wishes: ['washer'] }, lastSearch: { top: [{ id: '777', score: 81, why: ['Viertel 80', '⭐ 4,8'] }] }, 'l:5': { id: '5', hostId: '99', vote: -1, lastSeen: 1 } });
  const { doc, w } = makePage({ body, url: ROOM_URL, chrome });
  const box = await until(() => shadow(doc, 'sm-room')?.querySelector('.box'));
  const t = box.textContent;
  assert.match(t, /Esstisch für 2, ihr seid 4/);
  assert.match(t, /Kommt vor Ort noch dazu: Strom nach Verbrauch/);
  assert.match(t, /Reinigung und Service machen 26 %/);
  assert.match(t, /passt nicht zu deinem Wunsch „Waschmaschine“/);
  assert.match(t, /Gastgebers hast du mit 👎/);
  const det = box.querySelector('details');
  assert.match(det.querySelector('summary').textContent, /Mehr Hinweise \(\d+\)/);
  assert.match(det.textContent, /Kaution 300 €/);
  assert.match(det.textContent, /Gastgeber lebt in Barcelona/);
  assert.equal(chrome.data['l:777'].hostId, '99');
  const btn = [...box.querySelectorAll('button')].find(b => /gebucht/i.test(b.textContent));
  btn.click();
  await until(() => chrome.data['l:777'].booked);
  const b = chrome.data['l:777'].booked;
  assert.equal(b.checkin, '2026-05-01');
  assert.deepEqual(b.why, ['Viertel 80', '⭐ 4,8']);
  assert.equal(b.total, 540);
  const box2 = await until(() => /Vorkasse/.test(shadow(doc, 'sm-room')?.querySelector('.box')?.textContent || '') && shadow(doc, 'sm-room').querySelector('.box'));
  assert.match(box2.textContent, /Warum: Viertel 80/);
  // Gedächtnis: Superhost weg, neu eingestellt?, Grübel-Bremse
  const m = w.__STAYMATCH_TEST__.memoryOf({ id: 'n', title: 'Schöne Wohnung am Park', hostInfo: { superhost: false } }, { hostInfo: { superhost: true }, lastSeen: Date.parse('2026-01-02') },
    [{ id: 'o', title: 'Schöne  Wohnung am Park', rating: 4.1 }, ...Array.from({ length: 40 }, (_, i) => ({ id: 'x' + i, lastSeen: 1000 }))], 2000);
  assert.ok(m.info.some(x => /Superhost-Status ist weg/.test(x)));
  assert.ok(m.warn.some(x => /neu eingestellt/.test(x)));
  assert.ok(m.info.some(x => /Zeit zu entscheiden/.test(x)));
});
