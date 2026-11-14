// Runde 12, Teil extra: app-extra.js und gruppe.js liefern Deutsch UND Englisch, ohne sichtbare {platzhalter} und ohne fehlende Wörterbucheinträge
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const web = path.join(__dirname, '..', 'web');
let JSDOM = null;
try { ({ JSDOM } = require('jsdom')); } catch {}
const dom = { skip: !JSDOM && 'jsdom fehlt (npm ci --prefix tests)' };
const own = require('../web/i18n-en-extra.js');
const I = require('../web/i18n.js');

// Eigener Start (i18n.js VOR scoring.js), damit der Test nicht von tests/helpers/app-dom.js abhängt
function boot(lang) {
  const html = fs.readFileSync(path.join(web, 'app.html'), 'utf8').replace(/<html lang="\w+"/, `<html lang="${lang}"`);
  const d = new JSDOM(html, { url: 'http://localhost/app', runScripts: 'outside-only', pretendToBeVisual: true }), w = d.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  w.HTMLElement.prototype.scrollIntoView = () => {}; w.scrollTo = () => {};
  w.fetch = async u => {
    const p = path.join(web, String(u).replace(/^(https?:\/\/localhost)?\//, ''));
    if (!/^((https?:\/\/localhost)?\/)?data\//.test(String(u)) || !fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
    const body = fs.readFileSync(p, 'utf8');
    return { ok: true, status: 200, json: async () => JSON.parse(body), text: async () => body };
  };
  w.console.debug = () => {}; w.console.warn = () => {};
  for (const f of ['core.js', 'i18n.js', 'i18n-en-extra.js', 'scoring.js', 'app.js', 'app-extra.js', 'gruppe.js']) w.eval(fs.readFileSync(path.join(web, f), 'utf8') + `\n//# sourceURL=${f}`);
  return w;
}
const tick = (ms = 0) => new Promise(r => setTimeout(r, ms));
async function until(fn, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn()) return true; await tick(20); } throw new Error('Zeitüberschreitung'); }
async function run(lang) {
  const w = boot(lang), $ = id => w.document.getElementById(id);
  $('city').value = 'Rom'; $('f').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await until(() => !$('go').disabled && $('extra') && $('extra').children.length && $('giveup'));
  await tick(20);
  const click = id => { $(id).dispatchEvent(new w.MouseEvent('click', { bubbles: true })); };
  const out = {};
  out.extra = $('extra').textContent;
  out.card = [...w.document.querySelectorAll('.xcard')].map(e => e.textContent).join('\n');
  out.tools = $('xformTools').textContent; out.mine = $('dataInfo').textContent + $('voteBox').textContent + $('extra').querySelector('.xtools').textContent;
  out.grp = $('grp').textContent;
  out.fsAria = $('fsUp').getAttribute('aria-label');
  $('wishText').value = 'xyzzy'; click('wishGo'); out.wishMsg = $('wishMsg').textContent;
  click('duelGo'); out.duel = $('duelBox').textContent; click('duelSkip'); click('duelEnd');
  click('legAdd'); out.leg = $('xMsg').textContent; out.legList = $('extra').textContent;
  $('grpIn').value = 'nix'; click('grpGo'); out.grpMsg = $('grpMsg').textContent;
  $('grpIn').value = 'https://x/app#p=' + w.StayMatchGroup.encodePerson({ name: 'Zoe', type: 'party' }) + '.kaputt!'; click('grpGo'); out.grpOk = $('grpMsg').textContent;
  await until(() => $('giveup').textContent); out.giveup = $('giveup').textContent;
  out.all = Object.values(out).join('\n');
  out.w = w;
  return out;
}

test('app-extra/gruppe: Deutsch bleibt deutsch, kein {platzhalter} sichtbar', dom, async () => {
  const o = await run('de');
  assert.match(o.extra, /Datenstand .* Viertel/); assert.match(o.extra, /Abstimmung in der Gruppe/);
  assert.match(o.tools, /Wünsche als Satz eingeben/); assert.match(o.fsAria, /Schrift größer \(jetzt 100 %\)/);
  assert.match(o.wishMsg, /Nichts erkannt/); assert.match(o.duel, /Runde 1 von/); assert.match(o.leg, /Etappe Rom gemerkt/);
  assert.match(o.grpMsg, /Kein Wunsch-Link gefunden/); assert.match(o.grpOk, /Neu: Zoe\./);
  assert.match(o.grpOk, /1 kaputter Link übersprungen/);
  assert.match(o.giveup, /Wer steckt zurück\?/);
  assert.doesNotMatch(o.all, /\{\w+\}/);
});

test('app-extra/gruppe: Englisch, kein {platzhalter}, keine fehlenden Einträge aus diesem Teil', dom, async () => {
  I.missing.clear(); // Node-Instanz; die Seite hat ihre eigene
  const o = await run('en'), w = o.w;
  assert.match(o.extra, /Data as of .* neighbourhoods/); assert.match(o.extra, /Group vote/); assert.match(o.extra, /Terms explained briefly/);
  assert.match(o.tools, /Enter wishes as a sentence/); assert.match(o.tools, /Import your own places/); assert.equal(o.fsAria, 'Larger text (now 100 %)');
  assert.match(o.wishMsg, /Nothing recognised/); assert.match(o.duel, /Round 1 of/); assert.match(o.leg, /Leg Rome saved|Leg Rom saved/);
  assert.match(o.legList, /Legs \(1\)/);
  assert.match(o.grp, /Vote as a group via link/); assert.match(o.grpMsg, /No wish link found/);
  assert.match(o.grpOk, /New: Zoe\./); assert.match(o.grpOk, /1 broken link skipped/);
  assert.match(o.giveup, /Who gives up the most\?/);
  assert.doesNotMatch(o.all, /\{\w+\}/);
  assert.doesNotMatch(o.mine + o.tools + o.grp + o.grpMsg + o.grpOk + o.duel + o.leg, /Datenstand|Abstimmung|Wunsch-Link|Etappe|Viertel/);
  const mine = new Set(own.keys), miss = [...w.StayMatchI18n.missing].filter(k => mine.has(k));
  assert.deepEqual(miss, []);
  // alle Schlüssel dieses Teils, die zur Laufzeit gefragt wurden, sind im Wörterbuch: Rest (andere Teile) wird hier nicht geprüft
});

test('gruppe.giveUpText: DE bytegleich, EN übersetzt, Mehrzahl', () => {
  const G = require('../web/gruppe.js');
  const rows = [{ name: 'Ann', best: 90, at: 60, loss: 30 }, { name: 'Bo', best: 80, at: 60, loss: 20 }, { name: 'Cy', best: 70, at: 69, loss: 1 }];
  assert.equal(G.giveUpText(rows), 'Ann steckt am meisten zurück: 60 statt 90 Punkte (−30). Auch eine weitere Person verzichten spürbar.');
  assert.equal(G.giveUpText([rows[0], rows[1], { ...rows[1], name: 'D' }]), 'Ann steckt am meisten zurück: 60 statt 90 Punkte (−30). Auch 2 weitere Personen verzichten spürbar.');
  assert.equal(G.giveUpText([rows[2]]), 'Niemand muss hier groß zurückstecken: Jede Person liegt nah an ihrem besten Wert.');
  globalThis.SM_LANG = 'en';
  try {
    assert.equal(G.giveUpText(rows), 'Ann gives up the most: 60 instead of 90 points (−30). One other person also gives up a noticeable amount.');
    assert.match(G.giveUpText([rows[0], rows[1], { ...rows[1], name: 'D' }]), /2 other people also/);
    assert.match(G.giveUpText([rows[2]]), /^Nobody has to give up much/);
    assert.deepEqual([...I.missing].filter(k => new Set(own.keys).has(k)), []);
  } finally { delete globalThis.SM_LANG; }
});
