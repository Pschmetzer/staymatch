// StayMatch – Gruppen-Abstimmung ohne Server: Wunsch-Links (#p=) einzelner Personen zusammenführen, Fairness sichtbar machen.
// Reine Funktionen (StayMatchGroup, auch in Node testbar) und eine kleine Oberfläche in der App. Nichts wird gesendet:
// die Wünsche stehen im URL-Fragment (nach dem #), das der Browser nie an einen Server schickt.
(function (root) {
  if (!root.StayMatch && typeof require === 'function') require('./scoring.js');
  const { t } = root.StayMatchI18n || require('./i18n.js');
  const SM = root.StayMatch, KEYS = Object.keys(SM.CATEGORIES);
  const MAX_PEOPLE = 30, MAX_TOKEN = 3000;
  const b64 = {
    enc: o => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
    dec: s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))),
  };

  // Eine Person → kurzer Text für den Link (nur Name, Typ(en), eigene Regler, Vetos; keine Reisedaten, keine Stadt)
  function encodePerson(p) {
    const q = SM.cleanPerson(p); if (!q) return '';
    return b64.enc({ n: q.name, t: q.type, t2: q.type2 || 0, c: q.custom ? KEYS.map(k => Math.round(q.custom[k] * 10)) : 0, v: q.veto || 0 });
  }
  // Nie dem Link trauen: Länge begrenzen, alles prüfen (cleanPerson). null = kaputt.
  function decodePerson(tok) {
    if (typeof tok !== 'string' || !tok || tok.length > MAX_TOKEN || !/^[A-Za-z0-9_-]+$/.test(tok)) return null;
    try {
      const s = b64.dec(tok);
      if (!s || typeof s !== 'object' || Array.isArray(s) || typeof s.n !== 'string') return null;
      const c = Array.isArray(s.c) && s.c.length === KEYS.length ? Object.fromEntries(KEYS.map((k, i) => [k, (+s.c[i] || 0) / 10])) : undefined;
      return SM.cleanPerson({ name: s.n, type: s.t, type2: s.t2 || undefined, custom: c, veto: Array.isArray(s.v) ? s.v : undefined });
    } catch { return null; }
  }
  // Alle Wunsch-Texte aus eingefügtem Text finden: ganze Links (…#p=abc), mehrere in einem Link (#p=abc.def) oder nackte Texte
  function tokensFrom(text) {
    const s = String(text || ''), out = [], re = /[#&]p=([A-Za-z0-9_.-]+)/g;
    let m;
    while ((m = re.exec(s))) for (const t of m[1].split('.')) if (t) out.push(t);
    if (!out.length) for (const t of s.split(/[\s,;]+/)) if (/^[A-Za-z0-9_-]{8,}$/.test(t) && decodePerson(t)) out.push(t);
    return [...new Set(out)].slice(0, MAX_PEOPLE);
  }
  // Zur Gruppe hinzufügen. Gleicher Name (ohne Groß/Klein) = neuer Stand dieser Person, sonst neue Person.
  function mergePeople(current, tokens) {
    const people = current.map(p => ({ ...p })), added = [], updated = [];
    let bad = 0, full = 0;
    for (const tok of tokens) {
      const p = decodePerson(tok);
      if (!p) { bad++; continue; }
      const i = people.findIndex(x => x.name.toLowerCase() === p.name.toLowerCase());
      if (i >= 0) { people[i] = p; updated.push(p.name); } else if (people.length < MAX_PEOPLE) { people.push(p); added.push(p.name); } else full++;
    }
    return { people, added, updated, bad, full };
  }

  // Wer steckt zurück? Je Person: bester möglicher Wert in dieser Stadt gegen den Wert im gewählten Viertel (Platz 1).
  // Grundlage ist personScore (a.group.scores), also dieselbe Rechnung wie die Gruppenwertung.
  function giveUp(areas, ppl, pick) {
    if (!pick || !pick.group || !areas.length || ppl.length < 2) return [];
    return ppl.map((p, i) => {
      const best = Math.max(...areas.map(a => a.group.scores[i] || 0)), at = pick.group.scores[i] || 0;
      return { name: p.name, best, at, loss: Math.max(0, best - at) };
    }).sort((a, b) => b.loss - a.loss || a.name.localeCompare(b.name));
  }
  const SMALL = 8; // bis zu diesem Verlust gilt es als „kaum Verzicht“
  function giveUpText(rows) {
    if (!rows.length) return '';
    const top = rows[0];
    if (top.loss <= SMALL) return t('Niemand muss hier groß zurückstecken: Jede Person liegt nah an ihrem besten Wert.');
    const more = rows.filter(r => r.loss > SMALL && r !== top).length;
    const main = t('{name} steckt am meisten zurück: {at} statt {best} Punkte (−{loss}).', { name: top.name, at: top.at, best: top.best, loss: top.loss });
    const also = !more ? '' : more === 1 ? t('Auch eine weitere Person verzichten spürbar.') : t('Auch {n} weitere Personen verzichten spürbar.', { n: more });
    return also ? main + ' ' + also : main;
  }

  root.StayMatchGroup = { encodePerson, decodePerson, tokensFrom, mergePeople, giveUp, giveUpText, MAX_PEOPLE };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.StayMatchGroup;

  // ---------- Oberfläche (nur in der App) ----------
  if (typeof document === 'undefined' || !root.SMApp || !document.getElementById('paste')) return;
  const A = root.SMApp, $ = id => document.getElementById(id), esc = SM.escapeHtml;
  const grp = document.createElement('details');
  grp.id = 'grp';
  const L = {
    sum: t('Gruppe per Link abstimmen'), hint: t('Jede Person öffnet die App, wählt ihre Wünsche und schickt dir ihren Wunsch-Link. Die Wünsche stehen im Link hinter dem „#“, sie verlassen deinen Browser nicht. So geht es: Link kopieren, im Chat verteilen, die Links der anderen unten einfügen.'),
    whoLbl: t('Wessen Wünsche teilen?'), copy: t('Wunsch-Link kopieren'), urlAria: esc(t('Wunsch-Link zum Kopieren')), inLbl: t('Links der anderen einfügen'), go: t('Gruppe importieren'),
  };
  grp.innerHTML = `<summary>${L.sum}</summary><div class="body">
    <p class="hint">${L.hint}</p>
    <label for="grpWho">${L.whoLbl}</label> <select id="grpWho"></select>
    <button type="button" class="link" id="grpCopy">${L.copy}</button>
    <input id="grpUrl" readonly hidden aria-label="${L.urlAria}">
    <label for="grpIn">${L.inLbl}</label>
    <textarea id="grpIn" placeholder="https://staymatch.pro/app#p=…"></textarea>
    <button type="button" class="link" id="grpGo">${L.go}</button>
    <p class="hint" id="grpMsg" role="status" aria-live="polite"></p></div>`;
  $('paste').closest('details').before(grp);
  const who = $('grpWho'), msg = $('grpMsg');
  const fillWho = () => { const keep = who.value; who.innerHTML = A.people().map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join(''); if (keep && +keep < A.people().length) who.value = keep; };
  fillWho(); grp.addEventListener('toggle', fillWho); grp.addEventListener('focusin', fillWho);

  $('grpCopy').onclick = async () => {
    const p = A.people()[+who.value] || A.people()[0], url = location.origin + location.pathname + '#p=' + encodePerson(p);
    const box = $('grpUrl'); box.hidden = false; box.value = url;
    try { await navigator.clipboard.writeText(url); msg.textContent = '✅ ' + t('Link von {name} kopiert. Schick ihn an die Person, die die Gruppe zusammenführt.', { name: p.name }); }
    catch { box.select(); msg.textContent = t('Kopieren nicht möglich. Kopiere den Link aus dem Feld.'); }
  };
  function importTokens(tokens) {
    if (!tokens.length) { msg.textContent = t('Kein Wunsch-Link gefunden. Er enthält „#p=“ und danach Buchstaben und Zahlen.'); return false; }
    const r = mergePeople(A.people(), tokens);
    if (!r.added.length && !r.updated.length) { msg.textContent = r.bad ? t('Dieser Link ist kaputt oder unvollständig und wurde nicht übernommen.') : t('Die Gruppe ist schon voll.'); return false; }
    const nTaken = r.added.length + r.updated.length;
    A.offerUndo(nTaken === 1 ? t('1 Wunsch-Link übernommen') : t('{n} Wunsch-Links übernommen', { n: nTaken }));
    A.setPeople(r.people);
    fillWho();
    const parts = [r.added.length && t('Neu: {names}', { names: r.added.join(', ') }), r.updated.length && t('Aktualisiert: {names}', { names: r.updated.join(', ') })].filter(Boolean).join('. ');
    const bad = !r.bad ? '' : ' ' + (r.bad === 1 ? t('1 kaputter Link übersprungen.') : t('{n} kaputte Links übersprungen.', { n: r.bad }));
    const full = !r.full ? '' : ' ' + t('{n} passten nicht mehr in die Gruppe (höchstens {max}).', { n: r.full, max: MAX_PEOPLE });
    msg.textContent = `✅ ${parts}.${bad}${full}`;
    return true;
  }
  $('grpGo').onclick = () => { if (importTokens(tokensFrom($('grpIn').value))) $('grpIn').value = ''; };
  function fromHash() { // geöffneter Wunsch-Link: Person übernehmen, Fragment danach entfernen (sonst käme sie bei jedem Neuladen wieder)
    if (!/^#p=/.test(location.hash)) return;
    const toks = tokensFrom(location.hash);
    history.replaceState(null, '', location.pathname + location.search);
    grp.open = true;
    importTokens(toks);
  }
  fromHash(); addEventListener('hashchange', fromHash);

  // Panel „Wer steckt zurück?“ unter den Ergebnissen
  const box = document.createElement('div');
  box.id = 'giveup'; box.className = 'xbox'; box.hidden = true;
  $('whatif').before(box);
  function render() {
    const v = A.view();
    const rows = v ? giveUp(v.okAreas, v.ppl, v.ranked[0]) : [];
    box.hidden = !rows.length;
    if (!rows.length) { box.innerHTML = ''; return; }
    const head = t('Wer steckt zurück?'), note = t('Verglichen wird Platz 1 mit dem besten Viertel dieser Stadt für die jeweilige Person. Der Schieber „Fairness“ verschiebt, wie stark die Unzufriedensten zählen.');
    const items = rows.map(r => {
      const line = t('{name}: <b>{at}</b> von {best} möglichen Punkten', { name: esc(r.name), at: r.at, best: r.best });
      return `<li>${line}${r.loss > SMALL ? ` <span class="muted">(−${r.loss})</span>` : ''}</li>`;
    }).join('');
    box.innerHTML = `<h3>${head}</h3><p>${esc(giveUpText(rows))}</p><ul>${items}</ul>
      <p class="hint">${note}</p>`;
  }
  addEventListener('staymatch:render', () => { try { render(); } catch (e) { console.debug(e); } });
  render();
})(typeof window !== 'undefined' ? window : globalThis);
