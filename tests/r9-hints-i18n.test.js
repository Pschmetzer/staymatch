// Runde 9: Hinweise aus Bewertungen in FR, ES, IT, NL, PL (nur synthetische Beispieltexte).
const test = require('node:test');
const assert = require('node:assert/strict');
require('../extension/hints.js');
const H = globalThis.StayMatchHints;
const has = (t, x) => H.reviewHints(t).some(h => h.includes(x));

// [Sprache, Treffer-Sätze: [Text, erwartetes Label]]
const HITS = {
  fr: [['Appartement très propre.', '👍 sauber'], ['Quartier très calme.', '👍 ruhig'], ['Le wifi était lent.', '⚠️ WLAN'],
    ['Beaucoup de bruit la nuit.', '⚠️ laut'], ['Murs très fins.', '⚠️ hellhörig'], ['Il y avait des cafards.', '⚠️ Ungeziefer'],
    ['Logement sans ascenseur.', '⚠️ kein Aufzug'], ['Un hôte très gentil.', '👍 Gastgeber'], ['Emplacement idéal.', '👍 Lage'],
    ['Pas de chauffage.', '⚠️ Heizung defekt'], ['Il y avait de la moisissure.', '⚠️ Geruch'], ['Trop chaud, pas de climatisation.', '⚠️ ohne Klimaanlage'],
    ['Pas d\'eau chaude.', '⚠️ Warmwasser'], ['Le matelas était dur.', '⚠️ Matratze'], ['Un chantier à côté.', '⚠️ Baustelle'], ['Appartement sale.', '⚠️ schmutzig']].filter(x => x[0] !== 'Appartement sale.').concat([['Il était très sale.', '⚠️ schmutzig']]),
  es: [['Todo muy limpio.', '👍 sauber'], ['Zona muy tranquila.', '👍 ruhig'], ['El wifi era lento.', '⚠️ WLAN'], ['Había mucho ruido.', '⚠️ laut'],
    ['Paredes muy finas.', '⚠️ hellhörig'], ['Había cucarachas.', '⚠️ Ungeziefer'], ['Sin ascensor.', '⚠️ kein Aufzug'], ['El anfitrión fue muy amable.', '👍 Gastgeber'],
    ['Ubicación perfecta.', '👍 Lage'], ['No había calefacción.', '⚠️ Heizung defekt'], ['Olor a humedad.', '⚠️ Geruch'], ['Sin aire acondicionado.', '⚠️ ohne Klimaanlage'],
    ['No había agua caliente.', '⚠️ Warmwasser'], ['El colchón estaba duro.', '⚠️ Matratze'], ['Obras en la calle.', '⚠️ Baustelle'], ['Estaba sucio.', '⚠️ schmutzig']],
  it: [['Tutto molto pulito.', '👍 sauber'], ['Zona molto tranquilla.', '👍 ruhig'], ['Il wifi era lento.', '⚠️ WLAN'], ['Troppo rumore di notte.', '⚠️ laut'],
    ['Pareti sottili.', '⚠️ hellhörig'], ['C\'erano scarafaggi.', '⚠️ Ungeziefer'], ['Senza ascensore.', '⚠️ kein Aufzug'], ['L\'host era gentilissimo.', '👍 Gastgeber'],
    ['Posizione ottima.', '👍 Lage'], ['Non c\'era riscaldamento.', '⚠️ Heizung defekt'], ['Odore di muffa.', '⚠️ Geruch'], ['Troppo caldo.', '⚠️ ohne Klimaanlage'],
    ['Non c\'era acqua calda.', '⚠️ Warmwasser'], ['Il materasso era duro.', '⚠️ Matratze'], ['Un cantiere vicino.', '⚠️ Baustelle'], ['Era sporco.', '⚠️ schmutzig']],
  nl: [['Alles erg schoon.', '👍 sauber'], ['Rustige buurt.', '👍 ruhig'], ['De wifi was traag.', '⚠️ WLAN'], ['Veel lawaai \'s nachts.', '⚠️ laut'],
    ['Dunne muren.', '⚠️ hellhörig'], ['Er waren kakkerlakken.', '⚠️ Ungeziefer'], ['Geen lift.', '⚠️ kein Aufzug'], ['De gastheer was erg vriendelijk.', '👍 Gastgeber'],
    ['Perfecte locatie.', '👍 Lage'], ['Geen verwarming.', '⚠️ Heizung defekt'], ['Het rook muf.', '⚠️ Geruch'], ['Het was te warm.', '⚠️ ohne Klimaanlage'],
    ['Geen warm water.', '⚠️ Warmwasser'], ['De matras was hard.', '⚠️ Matratze'], ['Bouwwerkzaamheden naast het huis.', '⚠️ Baustelle'], ['Het was vies.', '⚠️ schmutzig']],
  pl: [['Wszystko bardzo czyste, czysto.', '👍 sauber'], ['Bardzo cicha okolica.', '👍 ruhig'], ['Wifi było słabe.', '⚠️ WLAN'], ['Było głośno w nocy.', '⚠️ laut'],
    ['Cienkie ściany.', '⚠️ hellhörig'], ['Były karaluchy.', '⚠️ Ungeziefer'], ['Bez windy.', '⚠️ kein Aufzug'], ['Gospodarz był bardzo miły.', '👍 Gastgeber'],
    ['Świetna lokalizacja.', '👍 Lage'], ['Brak ogrzewania.', '⚠️ Heizung defekt'], ['Czuć było pleśń.', '⚠️ Geruch'], ['Brak klimatyzacji.', '⚠️ ohne Klimaanlage'],
    ['Nie było ciepłej wody.', '⚠️ Warmwasser'], ['Materac był twardy.', '⚠️ Matratze'], ['Budowa obok.', '⚠️ Baustelle'], ['Było brudno.', '⚠️ schmutzig']],
};
for (const [lang, list] of Object.entries(HITS)) {
  test(`Hinweise ${lang}: Treffer`, () => {
    for (const [text, want] of list) assert.ok(has(text, want), `${lang}: „${text}“ → ${want}, war ${JSON.stringify(H.reviewHints(text))}`);
  });
}

test('Hinweise: neutrale Sätze in fremden Sprachen geben nichts', () => {
  for (const t of ['Nous avons passé un séjour agréable à Paris.', 'Nos gustó la ciudad y la comida.', 'Abbiamo mangiato bene in centro.',
    'We hebben een leuke vakantie gehad.', 'Pojechaliśmy tam w maju.', 'Il y a un ascenseur.', 'Hay ascensor y aire acondicionado.',
    'Salón con sol, la sale a la terraza.']) assert.deepEqual(H.reviewHints(t), [], t);
});

test('Hinweise: Verneinungen in FR/ES/IT/NL/PL', () => {
  assert.ok(has('Pas très propre.', '⚠️ nicht sauber'));
  assert.ok(has('No estaba limpio.', '⚠️ nicht sauber'));
  assert.ok(has('Non era pulito.', '⚠️ nicht sauber'));
  assert.ok(has('Het was niet schoon.', '⚠️ nicht sauber'));
  assert.ok(has('Nie było czysto.', '⚠️ nicht sauber'));
  assert.ok(has('Sans bruit.', '👍 nicht laut'));
  assert.ok(has('No hay ruido.', '👍 nicht laut'));
  assert.ok(has('Senza rumore.', '👍 nicht laut'));
  assert.ok(has('Geen lawaai.', '👍 nicht laut'));
  assert.ok(has('Bez hałasu.', '👍 nicht laut'));
  assert.ok(has('Pas de cafards.', '👍 kein Ungeziefer'));
  assert.ok(has('Pas inconfortable du tout.', '👍 Bett bequem'));
  assert.ok(has('Pas de moisissure.', '👍 kein Geruch'));
  assert.ok(has('L\'hôte n\'était pas sympa.', '⚠️ Gastgeber unfreundlich'));
  assert.ok(has('Nie wrócimy.', '⚠️ würden nicht wiederkommen'));
});

test('Hinweise: „sans doute“/„sin duda“ verneint nicht, Teilsatzgrenze begrenzt Verneinung', () => {
  assert.ok(has('Sin duda muy limpio.', '👍 sauber'));
  assert.ok(has('Sans aucun doute très propre.', '👍 sauber'));
  assert.ok(has('Kein Lärm, sehr ruhig.', '👍 ruhig'));
  assert.ok(!has('Kein Lärm, sehr ruhig.', 'nicht ruhig'));
  assert.ok(has('Nicht sehr ruhig.', '⚠️ nicht ruhig'));
});

test('Hinweise: Positives „zurückkommen“, Heizung/WLAN-Ausfall in DE/EN', () => {
  assert.ok(has('Nous reviendrons.', '👍 Gäste kamen wieder'));
  assert.ok(has('Volveremos seguro.', '👍 Gäste kamen wieder'));
  assert.ok(has('Torneremo sicuramente.', '👍 Gäste kamen wieder'));
  assert.ok(has('We komen zeker terug.', '👍 Gäste kamen wieder'));
  assert.ok(has('Wrócimy tu.', '👍 Gäste kamen wieder'));
  assert.ok(has('Die Heizung war kaputt.', '⚠️ Heizung defekt'));
  assert.ok(has('The heating did not work.', '⚠️ Heizung defekt'));
  assert.ok(has('Das WLAN funktionierte nicht.', '⚠️ WLAN defekt'));
  assert.ok(has('El wifi no funcionaba.', '⚠️ WLAN defekt'));
  assert.ok(!has('Wifi tout simplement top.', 'WLAN'));
});

test('Hinweise: typografischer Apostroph und Tageszeit des Lärms in anderen Sprachen', () => {
  assert.ok(has('L’hôte n’était pas sympa.', '⚠️ Gastgeber unfreundlich'));
  assert.equal(H.noiseTimes(['Beaucoup de bruit la nuit.', 'Mucho ruido por la noche.']), 'meist nachts');
  assert.equal(H.noiseTimes(['Hałas rano, o 6:30.', 'Lawaai \'s ochtends.']), 'meist morgens');
});

test('Sprachen: sieben Sprachen werden erkannt', () => {
  const pl = 'Mieszkanie jest bardzo ładne, nie było problemu.';
  assert.equal(H.languages([pl, 'Très bien et nous étions contents.', 'Muy bonito y fue genial.']), 3);
});
