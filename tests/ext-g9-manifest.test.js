// Feature 9: Das Plugin läuft nicht auf Anmelde-, Konto-, Reservierungs- und Reiseseiten.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mf = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'extension', 'manifest.json'), 'utf8'));
const cs = mf.content_scripts.find(c => (c.js || []).includes('content-common.js'));

test('Manifest schließt Anmelde-, Konto-, Reservierungs- und Reiseseiten aus', () => {
  for (const p of ['login', 'signup', 'account', 'reservation', 'trips']) assert.ok(cs.exclude_matches.some(m => m.startsWith(`https://*/${p}`)), p);
  assert.ok(cs.exclude_matches.every(m => m.startsWith('https://*/')), 'alle Ausschlüsse gelten für jede Domain');
});

test('Ausschlüsse treffen nicht die Suchseite oder Unterkunftsseiten', () => {
  const re = m => new RegExp('^' + m.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
  for (const url of ['https://www.airbnb.de/s/Barcelona/homes', 'https://www.airbnb.de/rooms/123', 'https://www.airbnb.de/wishlists/9'])
    assert.ok(!cs.exclude_matches.some(m => re(m).test(url)), url);
  for (const url of ['https://www.airbnb.de/login', 'https://www.airbnb.de/signup_login', 'https://www.airbnb.de/account/payments', 'https://www.airbnb.de/reservations/1', 'https://www.airbnb.de/trips/v1'])
    assert.ok(cs.exclude_matches.some(m => re(m).test(url)), url);
});
