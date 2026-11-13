// StayMatch Viertel-Finder: Zusatzfunktionen (Runde 7). Eigenes Modul, weil app.js an der Größengrenze liegt.
// Rechnung in scoring.js, Zugriff auf den App-Zustand nur über window.SMApp (app.js). Kein Netz, alles bleibt im Browser.
(function () {
  const SM = window.StayMatch, A = window.SMApp, C = window.StayMatchCore;
  if (!SM || !A || !document.getElementById('results')) return;
  const $ = id => document.getElementById(id), esc = SM.escapeHtml, st = A.store;
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.innerHTML = html; return e; };
  const pct = n => `${Math.round(n)}`;


  // ---------- Textgröße (100 / 115 / 130 %), Karte bleibt unverändert ----------
  const FS = [1, 1.15, 1.3];
  let fs = FS.includes(st.get('sm_fs', 1)) ? st.get('sm_fs', 1) : 1;
  const applyFs = () => {
    document.querySelectorAll('main form, #reshead, #whatif, #extra, #compare, #results, #status').forEach(x => { x.style.zoom = fs === 1 ? '' : String(fs); });
    $('fsUp').disabled = fs === FS[FS.length - 1]; $('fsDown').disabled = fs === FS[0];
    $('fsUp').setAttribute('aria-label', `Schrift größer (jetzt ${pct(fs * 100)} %)`);
  };
  const fsBtn = (id, txt, d) => { const b = el('button', { type: 'button', class: 'xfs', id }, txt); b.onclick = () => { fs = FS[Math.max(0, Math.min(FS.length - 1, FS.indexOf(fs) + d))]; st.set('sm_fs', fs); applyFs(); }; return b; };
  const theme = $('theme');
  if (theme) { theme.before(fsBtn('fsDown', 'A−', -1), fsBtn('fsUp', 'A+', 1)); $('fsDown').setAttribute('aria-label', 'Schrift kleiner'); applyFs(); }

  // ---------- Formular: Wünsche aus einem Satz, Interessen in eigenen Worten, eigene Orte ----------
  const wishBox = $('wishes');
  const tools = el('div', { id: 'xformTools' }, `
    <details><summary>Wünsche als Satz eingeben</summary><div class="body">
      <div class="xform"><input type="text" id="wishText" maxlength="300" aria-label="Wünsche als Satz" placeholder="ruhige ganze Wohnung mit WLAN unter 120 € pro Nacht"><button type="button" class="link" id="wishGo">Übernehmen</button></div>
      <p class="hint" id="wishMsg" role="status"></p></div></details>
    <details><summary>Interessen in eigenen Worten</summary><div class="body">
      <div class="xform"><select id="intWho" aria-label="Für wen"></select><input type="text" id="intText" maxlength="300" aria-label="Interessen in eigenen Worten" placeholder="Jazzbars und Flohmarkt, keine Clubs"><button type="button" class="link" id="intGo">Übernehmen</button></div>
      <p class="hint" id="intMsg" role="status">Erkannt werden Wörter wie Bars, Parks, Museen, Restaurants, Bahn, Shopping, Sport und Spielplatz. „keine“ davor zählt als „stört“.</p></div></details>
    <details><summary>Eigene Orte importieren</summary><div class="body">
      <p class="hint">GeoJSON oder KML mit Punkten, zum Beispiel aus einer gespeicherten Kartenliste. Die Datei bleibt in deinem Browser. Viertel nahe vieler eigener Orte bekommen einen Hinweis.</p>
      <div class="xform"><input type="file" id="placesFile" accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml" aria-label="Datei mit eigenen Orten"><button type="button" class="link" id="placesDel" hidden>Orte entfernen</button></div>
      <p class="hint" id="placesMsg" role="status"></p></div></details>`);
  if (wishBox) wishBox.after(tools);

  const fillWho = () => { const s = $('intWho'), keep = s.value; s.innerHTML = A.people().map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join(''); if ([...s.options].some(o => o.value === keep)) s.value = keep; };
  $('intWho').addEventListener('focus', fillWho); fillWho();

  $('wishGo').onclick = () => {
    const r = SM.parseWishes($('wishText').value);
    if (!r.wishes.length && r.budget == null) { $('wishMsg').textContent = 'Nichts erkannt. Beispiel: ruhige ganze Wohnung mit WLAN unter 120 € pro Nacht'; return; }
    A.offerUndo('Wünsche aus dem Satz übernommen.');
    if (r.wishes.length) A.setWishes(r.wishes);
    if (r.budget != null) { // erst 0, dann Modus, dann Betrag: sonst rechnet der Modus-Wechsel den alten Betrag um
      $('budget').value = 0; $('budgetMode').value = r.mode; $('budgetMode').dispatchEvent(new Event('change'));
      $('budget').value = r.budget; $('budget').dispatchEvent(new Event('input'));
    }
    const names = r.wishes.map(k => document.querySelector(`#wishes input[value="${k}"]`)?.parentElement.textContent.trim().split('(')[0].trim()).filter(Boolean);
    $('wishMsg').textContent = `Übernommen: ${[...names, r.budget != null ? `Budget ${r.budget} € ${$('budgetMode').selectedOptions[0].text}` : ''].filter(Boolean).join(', ')}.`;
  };
  $('intGo').onclick = () => {
    fillWho();
    const r = SM.interestsToWeights($('intText').value), i = +$('intWho').value || 0;
    if (!r) { $('intMsg').textContent = 'Keine Interessen erkannt. Beispiel: Jazzbars und Flohmarkt, keine Clubs'; return; }
    A.offerUndo('Interessen übernommen.');
    A.setPeople(A.people().map((p, j) => j === i ? { ...p, custom: r.w } : p));
    $('intMsg').textContent = `Für ${A.people()[i].name} übernommen: ${r.hits.join(', ')}. Feinjustieren kannst du über ⚙️.`;
  };

  let places = SM.parsePlaces(JSON.stringify({ type: 'FeatureCollection', features: (st.get('sm_places', []) || []).slice(0, 500).map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { name: p.name } })) }));
  const placesUi = () => { $('placesDel').hidden = !places.length; $('placesMsg').textContent = places.length ? `${places.length} eigene Orte geladen.` : ''; };
  placesUi();
  $('placesFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 5e6) { $('placesMsg').textContent = 'Datei zu groß (höchstens 5 MB).'; return; }
    const list = SM.parsePlaces(await f.text());
    if (!list.length) { $('placesMsg').textContent = 'Keine Punkte gefunden. Erwartet: GeoJSON oder KML mit Punkten.'; return; }
    places = list; st.set('sm_places', places); placesUi(); A.rescore();
  });
  $('placesDel').onclick = () => { places = []; try { localStorage.removeItem('sm_places'); } catch {} $('placesFile').value = ''; placesUi(); A.rescore(); };

  // ---------- Gruppen-Abstimmung per Link: Favoriten (♥) sind deine Stimmen, der Teilen-Link nimmt alle Stimmen mit ----------
  const qNow = () => (A.data() && A.data().q) || C.normCity($('city').value);
  // Wer bin ich? Gespeicherter Name, sonst die erste Person. Liegen fremde Stimmen vor, erst nachfragen, statt eine fremde Stimme zu überschreiben.
  const me = () => { const n = st.get('sm_me', ''), ppl = A.people(); return ppl.some(p => p.name === n) ? n : Object.keys(SM.cleanVotes(allVotes()[qNow()])).length ? '' : ppl[0].name; };
  const allVotes = () => { const v = st.get('sm_votes', {}); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; };
  function votesFor(q) {
    const own = (st.get('sm_fav', {})[q] || []).slice(0, 20), out = { ...SM.cleanVotes(allVotes()[q]) };
    const m = me(); if (m) { delete out[m]; if (own.length) out[m] = own; }
    return SM.cleanVotes(out);
  }
  window.SMExtra = { votes: () => votesFor(qNow()) };
  function takeVotes() { // Stimmen aus einem geöffneten Link übernehmen (eigener Name wird nicht überschrieben)
    if (!location.hash.startsWith('#t=')) return;
    const s = SM.shareDecode(location.hash.slice(3));
    if (!s || !s.votes || !Object.keys(s.votes).length) return;
    const q = C.normCity(s.form.c), all = allVotes(), cur = SM.cleanVotes(all[q]);
    for (const [n, ks] of Object.entries(s.votes)) if (n !== st.get('sm_me', '')) cur[n] = ks;
    all[q] = cur; const keys = Object.keys(all); if (keys.length > 20) delete all[keys[0]];
    st.set('sm_votes', all);
  }
  takeVotes(); addEventListener('hashchange', takeVotes);

  // ---------- Panel unter den Ergebnissen ----------
  const box = el('div', { id: 'extra', class: 'xbox', 'aria-live': 'off' });
  $('whatif').after(box);
  let duel = null, plainOn = !!st.get('sm_plain', false);

  function cardDecor(v) {
    const best = v.byTotal[0], kidsWanted = v.ppl.some(p => (p.w.kids || 0) > 0) || +$('kids').value > 0 || +$('babys').value > 0;
    const tally = new Map(SM.tallyVotes(votesFor(qNow())).map(t => [t.key, t.names]));
    v.ranked.forEach((a, i) => {
      const art = $('area-' + i); if (!art) return;
      art.querySelector('.xcard')?.remove();
      const rows = [];
      if (plainOn) rows.push(`<div class="xplain">${esc(SM.plainText(a, v.ppl))}</div>`);
      const g = SM.gapToFirst(a, best, v.ppl); if (g) rows.push(`<div class="muted">${esc(SM.gapText(g))}</div>`);
      const names = tally.get(A.areaKey(a)); if (names && names.length) rows.push(`<div>👍 <b>${names.length} ${names.length === 1 ? 'Stimme' : 'Stimmen'}</b>: ${esc(names.join(', '))}</div>`);
      if (places.length) { const near = SM.placesNear(a, places, v.r); if (near.length) rows.push(`<div>📌 ${near.length} deiner Orte im Umkreis${near.some(p => p.name) ? `: ${esc(near.filter(p => p.name).slice(0, 3).map(p => p.name).join(', '))}` : ''}</div>`); }
      const f = SM.familySpots(a, v.pois, v.r);
      if (kidsWanted && f.pairs) rows.push(`<div>🛝 ${f.pairs} ${f.pairs === 1 ? 'Spielplatz' : 'Spielplätze'} mit Café daneben</div>`);
      if (f.market) rows.push(`<div class="muted">🧺 Markt ${f.market.d} m${f.market.name ? ` (${esc(f.market.name)})` : ''}, Öffnungstage bitte vor Ort prüfen</div>`);
      if (rows.length) art.querySelector('.actions')?.before(el('div', { class: 'xcard' }, rows.join('')));
    });
  }

  function render() {
    const v = A.view(), d = A.data();
    if (!v || !d || !v.ranked.length || !$('results').children.length) { box.innerHTML = ''; return; }
    const ppl = v.ppl, best = v.byTotal[0], info = [];
    const sn = SM.stayNote(A.nights()); if (sn) info.push(esc(sn));
    const dl = SM.daylightText(d.geo.lat, $('checkin').value); if (dl) info.push(esc(dl));
    for (const c of SM.groupConflicts(ppl)) info.push('↔️ ' + esc(c.text));
    const rb = SM.robustText(SM.robustness(v.okAreas, ppl, A.fair())); if (rb) info.push(esc(rb));
    // Fairness-Konto: wer kam bei der letzten Reise dieser Gruppe zu kurz?
    let fairHint = '';
    if (!st.get('sm_fairmem_off', false)) {
      const r = SM.fairMemory(st.get('sm_fairmem', {}), ppl, d.geo.name, best);
      st.set('sm_fairmem', r.mem);
      if (r.hint && A.fair() < 1) fairHint = `<li>⚖️ Bei der letzten Reise (${esc(r.hint.city)}) war <b>${esc(r.hint.name)}</b> am wenigsten zufrieden (${r.hint.score} von 100). <button type="button" class="link" id="fairUp">Unzufriedenste stärker gewichten</button> <button type="button" class="link" id="fairOff">Nicht mehr merken</button></li>`;
    }
    const odd = SM.oddOneOut(v.okAreas, best, v.minDist);
    if (odd) info.push(`🎲 Mal was anderes: <b>${esc(odd.area.name)}</b> (${odd.area.group.total}/100) hat deutlich mehr ${esc(odd.label)} als Platz 1.`);
    const worst = v.okAreas.length > 10 ? SM.worstAreas(v.okAreas, ppl) : [];
    const tally = SM.tallyVotes(votesFor(d.q)), nv = tally.reduce((x, t) => x + t.names.length, 0);
    const legs = SM.cleanLegs(st.get('sm_legs', []));
    const issues = SM.legIssues(legs);
    box.innerHTML = `<div class="card">
      <ul class="xinfo">${info.map(x => `<li>${x}</li>`).join('')}${fairHint}</ul>
      ${worst.length ? `<details><summary>Diese Viertel passen nicht</summary><ul>${worst.map(w => `<li><b>${esc(w.name)}</b> (${w.total}/100): ${esc(w.reason)}</li>`).join('')}</ul></details>` : ''}
      <details id="voteBox"${tally.length ? ' open' : ''}><summary>Abstimmung in der Gruppe${nv ? ` (${nv} ${nv === 1 ? 'Stimme' : 'Stimmen'})` : ''}</summary>
        <p class="hint">Markiere deine Favoriten mit ♥ und kopiere dann den Teilen-Link: Deine Stimmen reisen im Link mit. Wer den Link öffnet, stimmt genauso ab und schickt ihn weiter.</p>
        <div class="xform"><label for="meSel">Ich bin</label><select id="meSel">${me() ? '' : '<option value="" selected>Bitte wählen</option>'}${A.people().map(p => `<option${p.name === me() ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
        ${tally.length ? `<ol>${tally.slice(0, 8).map(t => `<li><b>${esc(t.name)}</b>: ${t.names.length} (${esc(t.names.join(', '))})</li>`).join('')}</ol><button type="button" class="link" id="voteClear">Fremde Stimmen für diese Stadt löschen</button>` : '<p class="muted">Noch keine Stimmen.</p>'}
      </details>
      <div class="xtools">
        <label>Kopieren als <select id="cpFmt"><option value="list">Liste</option><option value="md">Markdown-Tabelle</option></select></label>
        <label><input type="checkbox" id="cpNoEmoji"${st.get('sm_noemoji', false) ? ' checked' : ''}> ohne Symbole</label>
        <button type="button" class="link" id="cpGo">📋 Beste Viertel kopieren</button>
        <button type="button" class="link" id="speak">🔊 Top 3 vorlesen</button>
        <label><input type="checkbox" id="plain"${plainOn ? ' checked' : ''}> Einfache Sprache</label>
        <button type="button" class="link" id="legAdd">🧳 Als Etappe merken</button>
        <button type="button" class="link" id="duelGo">🥊 Geschmack per Duell finden</button>
      </div>
      <p class="hint" id="xMsg" role="status" aria-live="polite"></p>
      <textarea id="cpOut" aria-label="Text zum Kopieren" rows="6" style="width:100%" hidden readonly></textarea>
      <div id="duelBox"></div>
      ${legs.length ? `<details open><summary>Etappen (${legs.length})</summary><ol>${legs.map((l, i) => `<li>${esc(l.c)}, ${l.i.split('-').reverse().join('.')} bis ${l.o.split('-').reverse().join('.')}${l.a ? `: ${esc(l.a)} (${l.t}/100)` : ''} <button type="button" class="link" data-leg="${i}" aria-label="Etappe ${i + 1} entfernen">✕</button></li>`).join('')}</ol>
        ${issues.length ? `<p class="warn">${issues.map(esc).join(' ')}</p>` : ''}<button type="button" class="link" id="legCopy">📋 Etappen kopieren</button></details>` : ''}
      <details><summary>Begriffe kurz erklärt</summary><dl>
        <dt>Fairste Wahl</dt><dd>Zählt die am wenigsten zufriedene Person stärker als den Schnitt. Der Regler „Fairness“ legt fest, wie stark.</dd>
        <dt>Wert von 100</dt><dd>Wie gut das Viertel zu euren Wünschen passt, gezählt aus Orten in OpenStreetMap im Umkreis. Kein Preis, keine Sicherheitsbewertung.</dd>
        <dt>Veto „Nie“</dt><dd>Ein Viertel mit viel von dem, was jemand nie will, fällt ganz heraus.</dd>
        <dt>Geheimtipp</dt><dd>Fast so gut wie die Spitze, aber ruhiger und weiter vom Zentrum.</dd>
        <dt>Preislage</dt><dd>Grobe Schätzung aus Lage und Sehenswürdigkeiten. Echte Preise siehst du erst auf Airbnb.</dd>
      </dl></details></div>`;
    if (duel) renderDuel();
    cardDecor(v);
  }
  addEventListener('staymatch:render', () => { try { render(); } catch (e) { console.debug(e); } });
  ['checkin', 'checkout'].forEach(id => $(id).addEventListener('change', () => { if (A.view()) render(); }));
  // Herz geklickt: Stimmen neu zählen (app.js zeichnet die Karten dabei nicht neu)
  $('results').addEventListener('click', e => { if (e.target.closest('button[data-fav]')) setTimeout(() => { try { render(); } catch {} }, 0); });

  const msg = t => { $('xMsg').textContent = t; };
  async function copy(text, ok) {
    try { await navigator.clipboard.writeText(text); msg(ok); $('cpOut').hidden = true; }
    catch { const t = $('cpOut'); t.value = text; t.hidden = false; t.select(); msg('Kopieren nicht möglich. Markiere den Text unten und kopiere ihn selbst.'); }
  }
  box.addEventListener('change', e => {
    if (e.target.id === 'plain') { plainOn = e.target.checked; st.set('sm_plain', plainOn); cardDecor(A.view()); }
    if (e.target.id === 'cpNoEmoji') st.set('sm_noemoji', e.target.checked);
    if (e.target.id === 'meSel' && e.target.value) { st.set('sm_me', e.target.value); render(); }
  });
  box.addEventListener('click', e => {
    const t = e.target.closest('button'); if (!t) return;
    const v = A.view(), d = A.data();
    if (t.id === 'cpGo') {
      const at = d.at ? new Date(d.at).toLocaleDateString('de') : '';
      copy(SM.areasText(v.ranked, { city: d.geo.name, ppl: v.ppl, md: $('cpFmt').value === 'md', emoji: !$('cpNoEmoji').checked, stamp: at }), '✅ Text kopiert. Füge ihn in den Gruppenchat oder deine Notizen ein.');
    } else if (t.id === 'speak') speak(v);
    else if (t.id === 'fairUp') { A.setFair(Math.min(1, A.fair() + 0.2)); }
    else if (t.id === 'fairOff') { st.set('sm_fairmem_off', true); try { localStorage.removeItem('sm_fairmem'); } catch {} render(); }
    else if (t.id === 'voteClear') { const all = allVotes(); delete all[d.q]; st.set('sm_votes', all); render(); }
    else if (t.id === 'legAdd') {
      const fav = new Set(st.get('sm_fav', {})[d.q] || []), pick = v.ranked.find(a => fav.has(A.areaKey(a))) || v.ranked[0];
      const leg = { c: d.geo.name, i: $('checkin').value, o: $('checkout').value, a: pick.name, t: pick.group.total };
      const legs = SM.cleanLegs(st.get('sm_legs', [])).filter(l => !(l.c === leg.c && l.i === leg.i));
      if (legs.length >= 12) { msg('Höchstens 12 Etappen. Entferne zuerst eine.'); return; }
      st.set('sm_legs', SM.cleanLegs([...legs, leg])); render(); msg(`Etappe ${leg.c} gemerkt (Viertel ${leg.a}). Suche jetzt die nächste Stadt.`);
    } else if (t.dataset.leg != null) { const legs = SM.cleanLegs(st.get('sm_legs', [])); legs.splice(+t.dataset.leg, 1); st.set('sm_legs', legs); render(); }
    else if (t.id === 'legCopy') copy(SM.legsText(st.get('sm_legs', []), { emoji: !$('cpNoEmoji').checked }), '✅ Etappen kopiert.');
    else if (t.id === 'duelGo') { const pairs = SM.duelPairs(v.okAreas); if (pairs.length < 3) { msg('Zu wenige unterschiedliche Viertel für ein Duell.'); return; } duel = { pairs, n: 0, picks: [] }; renderDuel(); $('duelBox').querySelector('button')?.focus(); }
    else if (t.dataset.duel != null) { const [a, b] = duel.pairs[duel.n]; duel.picks.push(t.dataset.duel === '0' ? { win: a, lose: b } : { win: b, lose: a }); duel.n++; renderDuel(); $('duelBox').querySelector('button')?.focus(); }
    else if (t.id === 'duelSkip') { duel.n++; renderDuel(); }
    else if (t.id === 'duelUse') {
      const w = SM.duelWeights(duel.picks), i = +$('duelWho').value || 0;
      A.offerUndo('Geschmack aus dem Duell übernommen.'); duel = null;
      A.setPeople(A.people().map((p, j) => j === i ? { ...p, custom: w } : p));
    } else if (t.id === 'duelEnd') { duel = null; $('duelBox').innerHTML = ''; }
  });

  // ---------- Paarweises Duell: aus Entscheidungen zwischen zwei Vierteln die Wünsche schätzen ----------
  const profile = a => Object.keys(SM.CATEGORIES).filter(k => k !== 'transit').sort((x, y) => (a.norm[y] || 0) - (a.norm[x] || 0)).slice(0, 3).map(k => `${a.counts[k]} ${SM.CATEGORIES[k].label}`).join(' · ');
  function renderDuel() {
    const b = $('duelBox'); if (!b || !duel) return;
    if (duel.n < duel.pairs.length) {
      const [x, y] = duel.pairs[duel.n];
      b.innerHTML = `<p><b>Runde ${duel.n + 1} von ${duel.pairs.length}:</b> Wo würdest du lieber wohnen? Nur nach Bauchgefühl.</p>
        <div class="xduel">${[x, y].map((a, i) => `<button type="button" data-duel="${i}"><b>${esc(a.name)}</b><small>${esc(profile(a))}</small></button>`).join('')}</div>
        <button type="button" class="link" id="duelSkip">Weiß nicht</button> <button type="button" class="link" id="duelEnd">Abbrechen</button>`;
      return;
    }
    const w = SM.duelWeights(duel.picks);
    if (!w) { b.innerHTML = '<p class="muted">Zu wenige Antworten für eine Schätzung.</p><button type="button" class="link" id="duelEnd">Schließen</button>'; return; }
    const top = Object.entries(w).filter(([, x]) => x).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1])).slice(0, 4).map(([k, x]) => `${SM.CATEGORIES[k].label} ${x > 0 ? 'wichtig' : 'stört'}`);
    b.innerHTML = `<p><b>Dein Geschmack laut Duell:</b> ${esc(top.join(', ') || 'keine klare Richtung')}.</p>
      <div class="xform"><label for="duelWho">Übernehmen für</label><select id="duelWho">${A.people().map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select>
      <button type="button" class="link" id="duelUse">Übernehmen</button> <button type="button" class="link" id="duelEnd">Verwerfen</button></div>`;
  }

  // ---------- Vorlesen der Top 3 (nur Stimmen auf dem Gerät, damit kein Text an einen Sprachdienst geht) ----------
  function speak(v) {
    const ss = window.speechSynthesis;
    if (!ss || !window.SpeechSynthesisUtterance) { msg('Vorlesen wird von diesem Browser nicht unterstützt.'); return; }
    if (ss.speaking) { ss.cancel(); msg('Vorlesen beendet.'); return; }
    const voice = ss.getVoices().find(x => x.localService && /^de/i.test(x.lang));
    if (!voice) { msg('Keine deutsche Stimme auf diesem Gerät. Vorlesen ist nur mit lokaler Stimme möglich, damit kein Text das Gerät verlässt.'); return; }
    const u = new SpeechSynthesisUtterance(v.ranked.slice(0, 3).map((a, i) => `Platz ${i + 1}: ${a.name}, ${a.group.total} von 100, ${SM.verdict(a.group.total)}. ${SM.summary(a, v.ppl)}`).join(' '));
    u.voice = voice; u.lang = voice.lang; ss.speak(u); msg('Lese vor … Nochmal klicken beendet.');
  }
})();
