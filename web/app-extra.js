// StayMatch Viertel-Finder: Zusatzfunktionen (Runde 7). Eigenes Modul, weil app.js an der Größengrenze liegt.
// Rechnung in scoring.js, Zugriff auf den App-Zustand nur über window.SMApp (app.js). Kein Netz, alles bleibt im Browser.
(function () {
  const SM = window.StayMatch, A = window.SMApp, C = window.StayMatchCore;
  if (!SM || !A || !document.getElementById('results')) return;
  const I = window.StayMatchI18n || { t: (s, p) => s.replace(/\{(\w+)\}/g, (m, k) => (p && k in p ? String(p[k]) : m)), locale: () => 'de' };
  const { t } = I, isEn = () => I.locale() !== 'de';
  const $ = id => document.getElementById(id), esc = SM.escapeHtml, st = A.store;
  const el = (tag, attrs = {}, html = '') => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); e.innerHTML = html; return e; };
  const pct = n => `${Math.round(n)}`;


  // ---------- Textgröße (100 / 115 / 130 %), Karte bleibt unverändert ----------
  const FS = [1, 1.15, 1.3];
  let fs = FS.includes(st.get('sm_fs', 1)) ? st.get('sm_fs', 1) : 1;
  const applyFs = () => {
    document.documentElement.style.fontSize = fs === 1 ? '' : `${fs * 100}%`; // Schrift in rem: skaliert mit, ohne das Layout zu zoomen (Karte bleibt unverändert)
    $('fsUp').disabled = fs === FS[FS.length - 1]; $('fsDown').disabled = fs === FS[0];
    $('fsUp').setAttribute('aria-label', t('Schrift größer (jetzt {p} %)', { p: pct(fs * 100) }));
  };
  const fsBtn = (id, txt, d) => { const b = el('button', { type: 'button', class: 'xfs', id }, txt); b.onclick = () => { fs = FS[Math.max(0, Math.min(FS.length - 1, FS.indexOf(fs) + d))]; st.set('sm_fs', fs); applyFs(); }; return b; };
  const theme = $('theme');
  if (theme) { theme.before(fsBtn('fsDown', 'A−', -1), fsBtn('fsUp', 'A+', 1)); $('fsDown').setAttribute('aria-label', t('Schrift kleiner')); applyFs(); }

  // ---------- Startseite → Viertel-Finder: Kinder und Budget aus der Schnellsuche (?k=…&b=…) ----------
  // app.js räumt die Adresse vorher auf und merkt sich die Parameter in window.SMDeepLink. Ein geteilter Link (#t=) hat Vorrang.
  const deep = window.SMDeepLink;
  if (deep && !location.hash.startsWith('#t=')) {
    const k = Math.floor(+deep.get('k')), b = Math.floor(+deep.get('b'));
    const fire = (id, ev) => $(id).dispatchEvent(new Event(ev));
    if (k > 0) { $('kids').value = Math.min(10, k); fire('kids', 'change'); fire('kids', 'input'); }
    if (b > 0 && b <= 99999) { // wie wishGo: erst 0, dann Modus, dann Betrag, sonst rechnet der Modus-Wechsel um
      $('budget').value = 0; $('budgetMode').value = 'night'; fire('budgetMode', 'change');
      $('budget').value = b; fire('budget', 'input');
    }
  }

  // ---------- Formular: Wünsche aus einem Satz, Interessen in eigenen Worten, eigene Orte ----------
  const wishBox = $('wishes');
  const L = { // Texte vorab übersetzen (und für Attribute escapen), damit das Template unten ohne Sprachtext auskommt
    wishSum: t('Wünsche als Satz eingeben'), wishAria: esc(t('Wünsche als Satz')), wishPh: esc(t('ruhige ganze Wohnung mit WLAN unter 120 € pro Nacht')), take: t('Übernehmen'),
    intSum: t('Interessen in eigenen Worten'), intWho: esc(t('Für wen')), intPh: esc(t('Jazzbars und Flohmarkt, keine Clubs')),
    intHint: t('Erkannt werden Wörter wie Bars, Parks, Museen, Restaurants, Bahn, Shopping, Sport und Spielplatz. „keine“ davor zählt als „stört“.'),
    plSum: t('Eigene Orte importieren'), plHint: t('GeoJSON oder KML mit Punkten, zum Beispiel aus einer gespeicherten Kartenliste. Die Datei bleibt in deinem Browser. Viertel nahe vieler eigener Orte bekommen einen Hinweis.'),
    plAria: esc(t('Datei mit eigenen Orten')), plDel: t('Orte entfernen'),
  };
  const tools = el('div', { id: 'xformTools' }, `
    <details><summary>${L.wishSum}</summary><div class="body">
      <div class="xform"><input type="text" id="wishText" maxlength="300" aria-label="${L.wishAria}" placeholder="${L.wishPh}"><button type="button" class="link" id="wishGo">${L.take}</button></div>
      <p class="hint" id="wishMsg" role="status"></p></div></details>
    <details><summary>${L.intSum}</summary><div class="body">
      <div class="xform"><select id="intWho" aria-label="${L.intWho}"></select><input type="text" id="intText" maxlength="300" aria-label="${L.intSum}" placeholder="${L.intPh}"><button type="button" class="link" id="intGo">${L.take}</button></div>
      <p class="hint" id="intMsg" role="status">${L.intHint}</p></div></details>
    <details><summary>${L.plSum}</summary><div class="body">
      <p class="hint">${L.plHint}</p>
      <div class="xform"><input type="file" id="placesFile" accept=".geojson,.json,.kml,application/geo+json,application/vnd.google-earth.kml+xml" aria-label="${L.plAria}"><button type="button" class="link" id="placesDel" hidden>${L.plDel}</button></div>
      <p class="hint" id="placesMsg" role="status"></p></div></details>`);
  if (wishBox) wishBox.after(tools);

  const fillWho = () => { const s = $('intWho'), keep = s.value; s.innerHTML = A.people().map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join(''); if ([...s.options].some(o => o.value === keep)) s.value = keep; };
  $('intWho').addEventListener('focus', fillWho); fillWho();

  $('wishGo').onclick = () => {
    const r = SM.parseWishes($('wishText').value);
    if (!r.wishes.length && r.budget == null) { $('wishMsg').textContent = t('Nichts erkannt. Beispiel: ruhige ganze Wohnung mit WLAN unter 120 € pro Nacht'); return; }
    A.offerUndo(t('Wünsche aus dem Satz übernommen.'));
    if (r.wishes.length) A.setWishes(r.wishes);
    if (r.budget != null) { // erst 0, dann Modus, dann Betrag: sonst rechnet der Modus-Wechsel den alten Betrag um
      $('budget').value = 0; $('budgetMode').value = r.mode; $('budgetMode').dispatchEvent(new Event('change'));
      $('budget').value = r.budget; $('budget').dispatchEvent(new Event('input'));
    }
    const names = r.wishes.map(k => document.querySelector(`#wishes input[value="${k}"]`)?.parentElement.textContent.trim().split('(')[0].trim()).filter(Boolean);
    const bud = r.budget != null ? t('Budget {b} € {mode}', { b: r.budget, mode: $('budgetMode').selectedOptions[0].text }) : '';
    $('wishMsg').textContent = t('Übernommen: {list}.', { list: [...names, bud].filter(Boolean).join(', ') });
  };
  $('intGo').onclick = () => {
    fillWho();
    const r = SM.interestsToWeights($('intText').value), i = +$('intWho').value || 0;
    if (!r) { $('intMsg').textContent = t('Keine Interessen erkannt. Beispiel: Jazzbars und Flohmarkt, keine Clubs'); return; }
    A.offerUndo(t('Interessen übernommen.'));
    A.setPeople(A.people().map((p, j) => j === i ? { ...p, custom: r.w } : p));
    $('intMsg').textContent = t('Für {name} übernommen: {hits}. Feinjustieren kannst du über ⚙️.', { name: A.people()[i].name, hits: r.hits.join(', ') });
  };

  let places = SM.parsePlaces(JSON.stringify({ type: 'FeatureCollection', features: (st.get('sm_places', []) || []).slice(0, 500).map(p => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lon, p.lat] }, properties: { name: p.name } })) }));
  const placesUi = () => { $('placesDel').hidden = !places.length; $('placesMsg').textContent = places.length ? t('{n} eigene Orte geladen.', { n: places.length }) : ''; };
  placesUi();
  $('placesFile').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (f.size > 5e6) { $('placesMsg').textContent = t('Datei zu groß (höchstens 5 MB).'); return; }
    const list = SM.parsePlaces(await f.text());
    if (!list.length) { $('placesMsg').textContent = t('Keine Punkte gefunden. Erwartet: GeoJSON oder KML mit Punkten.'); return; }
    places = list; st.set('sm_places', places); placesUi(); A.rescore();
  });
  $('placesDel').onclick = () => { places = []; try { localStorage.removeItem('sm_places'); } catch {} $('placesFile').value = ''; placesUi(); A.rescore(); };

  // ---------- Gruppen-Abstimmung per Link: Favoriten (♥) sind deine Stimmen, der Teilen-Link nimmt alle Stimmen mit ----------
  const qNow = () => (A.data() && A.data().q) || A.cityId($('city').value);
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
    const q = A.cityId(s.form.c), all = allVotes(), cur = SM.cleanVotes(all[q]);
    for (const [n, ks] of Object.entries(s.votes)) if (n !== st.get('sm_me', '')) cur[n] = ks;
    all[q] = cur; const keys = Object.keys(all); if (keys.length > 20) delete all[keys[0]];
    st.set('sm_votes', all);
  }
  takeVotes(); addEventListener('hashchange', takeVotes);

  // ---------- Panel unter den Ergebnissen ----------
  const box = el('div', { id: 'extra', class: 'xbox', 'aria-live': 'off' });
  $('whatif').after(box);
  let duel = null, plainOn = !!st.get('sm_plain', false);

  const cfCache = new WeakMap(); // hängt nicht von den Gewichten ab: einmal je Viertel rechnen
  const cfOf = (a, v) => { let c = cfCache.get(a); if (!c || c.r !== v.r) cfCache.set(a, c = { r: v.r, val: SM.confidence(a, v.pois, v.r) }); return c.val; };
  function cardDecor(v) {
    const best = v.byTotal[0], kidsWanted = v.ppl.some(p => (p.w.kids || 0) > 0) || +$('kids').value > 0 || +$('babys').value > 0;
    const tally = new Map(SM.tallyVotes(votesFor(qNow())).map(x => [x.key, x.names]));
    const sens = SM.sensitivityText(SM.sensitivity(v.okAreas, v.ppl, A.fair()));
    v.ranked.forEach((a, i) => {
      const art = $('area-' + i); if (!art) return;
      art.querySelector('.xcard')?.remove();
      const rows = [];
      if (plainOn) rows.push(`<div class="xplain">${esc(SM.plainText(a, v.ppl))}</div>`);
      const g = SM.gapToFirst(a, best, v.ppl); if (g) rows.push(`<div class="muted">${esc(SM.gapText(g))}</div>`);
      const names = tally.get(A.areaKey(a)); if (names && names.length) rows.push(`<div>👍 <b>${names.length} ${names.length === 1 ? t('Stimme') : t('Stimmen')}</b>: ${esc(names.join(', '))}</div>`);
      if (places.length) {
        const near = SM.placesNear(a, places, v.r), nearTxt = t('{n} deiner Orte im Umkreis', { n: near.length });
        if (near.length) rows.push(`<div>📌 ${nearTxt}${near.some(p => p.name) ? `: ${esc(near.filter(p => p.name).slice(0, 3).map(p => p.name).join(', '))}` : ''}</div>`);
      }
      const f = SM.familySpots(a, v.pois, v.r);
      if (kidsWanted && f.pairs) { const fam = f.pairs === 1 ? t('{n} Spielplatz mit Café daneben', { n: f.pairs }) : t('{n} Spielplätze mit Café daneben', { n: f.pairs }); rows.push(`<div>🛝 ${fam}</div>`); }
      if (f.market) { const mk = t('Markt {d} m{name}, Öffnungstage bitte vor Ort prüfen', { d: f.market.d, name: f.market.name ? ` (${esc(f.market.name)})` : '' }); rows.push(`<div class="muted">🧺 ${mk}</div>`); }
      if (i === 0 && sens && sens.startsWith(a.name)) rows.push(`<div>🎚️ ${esc(sens)}</div>`); // nur wenn Platz 1 der Karte auch Platz 1 der Wertung ist (andere Sortierung)
      const cf = cfOf(a, v); rows.push(`<div class="muted">${cf.level === 'low' ? '⚠️' : '📊'} ${esc(cf.text)}</div>`);
      if (v.sortMode === 'quiet' || v.ppl.some(SM.isQuiet)) {
        const quiet = t('Ruhe-Schätzung {q}/100 aus Bars und Clubs im Umkreis und Nähe zum Zentrum. Straßen- und Bahnlärm kennen wir nicht.', { q: SM.quietScore(a) }), q35 = v.ppl.some(SM.isQuiet) ? ' ' + t('Beim Ruhig-Typ zählt sie zu 35 % in den Wert.') : '';
        rows.push(`<div class="muted">🤫 ${quiet}${q35}</div>`);
      }
      const rail = a.nearest.transit != null ? t('Bahn ≈ {m} Min.', { m: SM.walkMin(a.nearest.transit) }) + ', ' : '', walk = t('Zentrum ≈ {m} Min. zu Fuß (Luftlinie × 1,3; Flüsse und Bahntrassen nicht berücksichtigt)', { m: SM.walkMin(a.centerDist) });
      rows.push(`<div class="muted">🚶 ${rail}${walk}</div>`);
      const imgBtn = t('🖼️ Bild für den Gruppenchat'), osmLnk = t('Fehlt ein Viertel? Im OSM-Editor ergänzen'), newTab = t('(neuer Tab)');
      rows.push(`<div class="xrow"><button type="button" class="link" data-xcard="${i}">${imgBtn}</button> <a class="sub2" href="${SM.osmEditUrl(a.lat, a.lon)}" target="_blank" rel="noopener">${osmLnk}<span class="sr"> ${newTab}</span></a></div>`);
      if (rows.length) art.querySelector('.actions')?.before(el('div', { class: 'xcard' }, rows.join('')));
    });
  }

  // Datenstand und Quelle der Stadt (Vorabdatei oder live)
  function dataLine(d) {
    const loc = I.locale(), m = d.meta, day = d.at ? new Date(d.at).toLocaleDateString(loc) : t('heute');
    const attr = m && m.attr && m.attr !== '© OpenStreetMap-Mitwirkende' ? m.attr : t('© OpenStreetMap-Mitwirkende');
    const src = m ? t('Quelle: {attr} ({lic}), abgerufen über {src}, {n} Zeilen', { attr, lic: m.lic || 'ODbL', src: m.src || 'Overpass', n: m.n.toLocaleString(loc) }) : t('Quelle: © OpenStreetMap-Mitwirkende (ODbL), live abgerufen');
    return t('Datenstand {day} · {areas} Viertel, {pois} Orte (alle Viertel) · {src}.', { day, areas: d.areas.length, pois: d.pois.length.toLocaleString(loc), src });
  }
  // Bildkarte (Canvas) für den Gruppenchat: Teilen-Dialog, sonst Download
  function cardImage(i) {
    const v = A.view(), d = A.data(), a = v && v.ranked[i]; if (!a) return;
    const cv = document.createElement('canvas'), g = cv.getContext && cv.getContext('2d');
    if (!g) { msg(t('Bild nicht möglich in diesem Browser.')); return; }
    const D = SM.shareCardData(a, i, d.geo.name, v.ppl), css = getComputedStyle(document.documentElement), col = (k, f) => css.getPropertyValue('--' + k).trim() || f;
    cv.width = 1080; cv.height = 648;
    g.fillStyle = col('bg', '#fff'); g.fillRect(0, 0, 1080, 648);
    g.fillStyle = col('accent', '#0a7'); g.fillRect(0, 0, 1080, 14);
    g.fillStyle = col('text', '#111'); g.font = '700 56px system-ui,sans-serif'; g.fillText(D.title, 48, 100, 984);
    g.font = '500 32px system-ui,sans-serif'; g.fillText(D.sub, 48, 150, 984);
    D.bars.forEach(([l, p], j) => { const y = 200 + j * 56; g.font = '28px system-ui,sans-serif'; g.fillStyle = col('text', '#111'); g.fillText(l, 48, y + 26, 300); g.fillStyle = col('line', '#ddd'); g.fillRect(360, y + 4, 600, 26); g.fillStyle = col('accent', '#0a7'); g.fillRect(360, y + 4, 6 * p, 26); });
    g.fillStyle = col('muted', '#666'); g.font = '26px system-ui,sans-serif'; g.fillText(D.line, 48, 560, 984); g.fillText(D.foot, 48, 610);
    cv.toBlob(async b => {
      if (!b) { msg(t('Bild nicht möglich in diesem Browser.')); return; }
      const f = new File([b], `staymatch-${a.name.replace(/[^\w-]+/g, '_')}.png`, { type: 'image/png' });
      try { if (navigator.canShare && navigator.canShare({ files: [f] })) { await navigator.share({ files: [f], title: a.name }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
      const u = URL.createObjectURL(b), l = el('a', { href: u, download: f.name }); l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); msg(t('Bild gespeichert. Schick es in den Gruppenchat.'));
    }, 'image/png');
  }
  $('results').addEventListener('click', e => { const b = e.target.closest('button[data-xcard]'); if (b) cardImage(+b.dataset.xcard); });

  function render() {
    const v = A.view(), d = A.data();
    if (!v || !d || !v.ranked.length || !$('results').children.length) { box.innerHTML = ''; return; }
    const ppl = v.ppl, best = v.byTotal[0], info = [];
    const sn = SM.stayNote(A.nights()); if (sn) info.push(esc(sn));
    const dl = SM.daylightText(d.geo.lat, $('checkin').value); if (dl) info.push(esc(dl)); const su = SM.sundayNote($('checkin').value); if (su) info.push(esc(su));
    for (const c of SM.groupConflicts(ppl)) info.push('↔️ ' + esc(c.text));
    const rb = SM.robustText(SM.robustness(v.okAreas, ppl, A.fair())); if (rb) info.push(esc(rb));
    // Fairness-Konto: wer kam bei der letzten Reise dieser Gruppe zu kurz?
    let fairHint = '';
    if (!st.get('sm_fairmem_off', false)) {
      const r = SM.fairMemory(st.get('sm_fairmem', {}), ppl, d.geo.name, best);
      st.set('sm_fairmem', r.mem);
      if (r.hint && A.fair() < 1) {
        const last = t('Bei der letzten Reise ({city}) war <b>{name}</b> am wenigsten zufrieden ({score} von 100).', { city: esc(r.hint.city), name: esc(r.hint.name), score: r.hint.score }), up = t('Unzufriedenste stärker gewichten'), off = t('Nicht mehr merken');
        fairHint = `<li>⚖️ ${last} <button type="button" class="link" id="fairUp">${up}</button> <button type="button" class="link" id="fairOff">${off}</button></li>`;
      }
    }
    const odd = SM.oddOneOut(v.okAreas, best, v.minDist);
    if (odd) info.push('🎲 ' + t('Mal was anderes: <b>{name}</b> ({total}/100) hat deutlich mehr {label} als Platz 1.', { name: esc(odd.area.name), total: odd.area.group.total, label: esc(odd.label) }));
    const worst = v.okAreas.length > 10 ? SM.worstAreas(v.okAreas, ppl) : [];
    const tally = SM.tallyVotes(votesFor(d.q)), nv = tally.reduce((x, e) => x + e.names.length, 0);
    const legs = SM.cleanLegs(st.get('sm_legs', []));
    const issues = SM.legIssues(legs);
    const dmy = x => x.split('-').reverse().join(isEn() ? '/' : '.');
    const votesLbl = nv ? ` (${nv} ${nv === 1 ? t('Stimme') : t('Stimmen')})` : '';
    const legRows = legs.map((l, i) => {
      const range = l.a ? t('{c}, {from} bis {to}: {a} ({score}/100)', { c: esc(l.c), from: dmy(l.i), to: dmy(l.o), a: esc(l.a), score: l.t }) : t('{c}, {from} bis {to}', { c: esc(l.c), from: dmy(l.i), to: dmy(l.o) });
      return `<li>${range} <button type="button" class="link" data-leg="${i}" aria-label="${esc(t('Etappe {n} entfernen', { n: i + 1 }))}">✕</button></li>`;
    }).join('');
    const worstRows = worst.map(w => `<li><b>${esc(w.name)}</b> (${w.total}/100): ${esc(w.reason)}</li>`).join('');
    const pleaseSel = t('Bitte wählen'), noVotes = t('Noch keine Stimmen.'), clearVotes = t('Fremde Stimmen für diese Stadt löschen');
    const meOpts = (me() ? '' : `<option value="" selected>${pleaseSel}</option>`) + A.people().map(p => `<option${p.name === me() ? ' selected' : ''}>${esc(p.name)}</option>`).join('');
    const tallyHtml = tally.length ? `<ol>${tally.slice(0, 8).map(e => `<li><b>${esc(e.name)}</b>: ${e.names.length} (${esc(e.names.join(', '))})</li>`).join('')}</ol><button type="button" class="link" id="voteClear">${clearVotes}</button>` : `<p class="muted">${noVotes}</p>`;
    const legsHtml = legs.length ? `<details open><summary>${t('Etappen ({n})', { n: legs.length })}</summary><ol>${legRows}</ol>
        ${issues.length ? `<p class="warn">${issues.map(esc).join(' ')}</p>` : ''}<button type="button" class="link" id="legCopy">${t('📋 Etappen kopieren')}</button></details>` : '';
    const G = { // Begriffe: Name und Erklärung
      fair: t('Fairste Wahl'), fairD: t('Zählt die am wenigsten zufriedene Person stärker als den Schnitt. Der Regler „Fairness“ legt fest, wie stark.'),
      val: t('Wert von 100'), valD: t('Wie gut das Viertel zu euren Wünschen passt, gezählt aus Orten in OpenStreetMap im Umkreis. Kein Preis, keine Sicherheitsbewertung.'),
      veto: t('Veto „Nie“'), vetoD: t('Ein Viertel mit viel von dem, was jemand nie will, fällt ganz heraus.'),
      gem: t('Geheimtipp'), gemD: t('Fast so gut wie die Spitze, aber ruhiger und weiter vom Zentrum.'),
      price: t('Preislage'), priceD: t('Grobe Schätzung aus Lage und Sehenswürdigkeiten. Echte Preise siehst du erst auf Airbnb.'),
    };
    const X = { // übrige Beschriftungen
      worst: t('Diese Viertel passen nicht'), vote: t('Abstimmung in der Gruppe'), voteHint: t('Markiere deine Favoriten mit ♥ und kopiere dann den Teilen-Link: Deine Stimmen reisen im Link mit. Wer den Link öffnet, stimmt genauso ab und schickt ihn weiter.'),
      iAm: t('Ich bin'), copyAs: t('Kopieren als'), list: t('Liste'), md: t('Markdown-Tabelle'), noEmoji: t('ohne Symbole'), cpGo: t('📋 Beste Viertel kopieren'), speak: t('🔊 Top 3 vorlesen'),
      plain: t('Einfache Sprache'), typeLink: t('🔗 Link mit Stadt und Typ'), legAdd: t('🧳 Als Etappe merken'), duelGo: t('🥊 Geschmack per Duell finden'), cpAria: esc(t('Text zum Kopieren')), terms: t('Begriffe kurz erklärt'),
    };
    box.innerHTML = `<div class="card">
      <p id="story">${esc(SM.cityStory(d.geo.name, d.areas, d.pois))}</p><p class="hint" id="dataInfo">${esc(dataLine(d))}</p>
      <ul class="xinfo">${info.map(x => `<li>${x}</li>`).join('')}${fairHint}</ul>
      ${worst.length ? `<details><summary>${X.worst}</summary><ul>${worstRows}</ul></details>` : ''}
      <details id="voteBox"${tally.length ? ' open' : ''}><summary>${X.vote}${votesLbl}</summary>
        <p class="hint">${X.voteHint}</p>
        <div class="xform"><label for="meSel">${X.iAm}</label><select id="meSel">${meOpts}</select></div>
        ${tallyHtml}
      </details>
      <div class="xtools">
        <label>${X.copyAs} <select id="cpFmt"><option value="list">${X.list}</option><option value="md">${X.md}</option></select></label>
        <label><input type="checkbox" id="cpNoEmoji"${st.get('sm_noemoji', false) ? ' checked' : ''}> ${X.noEmoji}</label>
        <button type="button" class="link" id="cpGo">${X.cpGo}</button>
        <button type="button" class="link" id="speak">${X.speak}</button>
        <label><input type="checkbox" id="plain"${plainOn ? ' checked' : ''}> ${X.plain}</label>
        <button type="button" class="link" id="typeLink">${X.typeLink}</button>
        <button type="button" class="link" id="legAdd">${X.legAdd}</button>
        <button type="button" class="link" id="duelGo">${X.duelGo}</button>
      </div>
      <p class="hint" id="xMsg" role="status" aria-live="polite"></p>
      <textarea id="cpOut" aria-label="${X.cpAria}" rows="6" style="width:100%" hidden readonly></textarea>
      <div id="duelBox"></div>
      ${legsHtml}
      <details><summary>${X.terms}</summary><dl>
        <dt>${G.fair}</dt><dd>${G.fairD}</dd>
        <dt>${G.val}</dt><dd>${G.valD}</dd>
        <dt>${G.veto}</dt><dd>${G.vetoD}</dd>
        <dt>${G.gem}</dt><dd>${G.gemD}</dd>
        <dt>${G.price}</dt><dd>${G.priceD}</dd>
      </dl></details></div>`;
    if (duel) renderDuel();
    cardDecor(v);
  }
  addEventListener('staymatch:render', () => { try { render(); } catch (e) { console.debug(e); } });
  ['checkin', 'checkout'].forEach(id => $(id).addEventListener('change', () => { if (A.view()) render(); }));
  // Herz geklickt: Stimmen neu zählen (app.js zeichnet die Karten dabei nicht neu)
  $('results').addEventListener('click', e => { if (e.target.closest('button[data-fav]')) setTimeout(() => { try { render(); } catch {} }, 0); });

  const msg = txt => { $('xMsg').textContent = txt; };
  async function copy(text, ok) {
    try { await navigator.clipboard.writeText(text); msg(ok); $('cpOut').hidden = true; }
    catch { const o = $('cpOut'); o.value = text; o.hidden = false; o.select(); msg(t('Kopieren nicht möglich. Markiere den Text unten und kopiere ihn selbst.')); }
  }
  box.addEventListener('change', e => {
    if (e.target.id === 'plain') { plainOn = e.target.checked; st.set('sm_plain', plainOn); cardDecor(A.view()); }
    if (e.target.id === 'cpNoEmoji') st.set('sm_noemoji', e.target.checked);
    if (e.target.id === 'meSel' && e.target.value) { st.set('sm_me', e.target.value); render(); }
  });
  box.addEventListener('click', e => {
    const btn = e.target.closest('button'); if (!btn) return;
    const v = A.view(), d = A.data();
    if (btn.id === 'cpGo') {
      const at = d.at ? new Date(d.at).toLocaleDateString(I.locale()) : '';
      copy(SM.areasText(v.ranked, { city: d.geo.name, ppl: v.ppl, md: $('cpFmt').value === 'md', emoji: !$('cpNoEmoji').checked, stamp: at }), '✅ ' + t('Text kopiert. Füge ihn in den Gruppenchat oder deine Notizen ein.'));
    } else if (btn.id === 'speak') speak(v);
    else if (btn.id === 'typeLink') { const p = A.people()[0], ty = SM.isQuiet(p) ? 'quiet' : p.custom ? '' : p.type; copy(SM.deepLink({ c: d.geo.name, t: ty, i: $('checkin').value, o: $('checkout').value }), '✅ ' + (ty ? t('Link kopiert: öffnet die App mit Stadt, Reisedaten und Typ.') : t('Link kopiert (ohne Typ: eigene Regler stehen nur im Teilen-Link).'))); }
    else if (btn.id === 'fairUp') { A.setFair(Math.min(1, A.fair() + 0.2)); }
    else if (btn.id === 'fairOff') { st.set('sm_fairmem_off', true); try { localStorage.removeItem('sm_fairmem'); } catch {} render(); }
    else if (btn.id === 'voteClear') { const all = allVotes(); delete all[d.q]; st.set('sm_votes', all); render(); }
    else if (btn.id === 'legAdd') {
      const fav = new Set(st.get('sm_fav', {})[d.q] || []), pick = v.ranked.find(a => fav.has(A.areaKey(a))) || v.ranked[0];
      const leg = { c: d.geo.name, i: $('checkin').value, o: $('checkout').value, a: pick.name, t: pick.group.total };
      const legs = SM.cleanLegs(st.get('sm_legs', [])).filter(l => !(l.c === leg.c && l.i === leg.i));
      if (legs.length >= 12) { msg(t('Höchstens 12 Etappen. Entferne zuerst eine.')); return; }
      st.set('sm_legs', SM.cleanLegs([...legs, leg])); render(); msg(t('Etappe {city} gemerkt (Viertel {area}). Suche jetzt die nächste Stadt.', { city: leg.c, area: leg.a }));
    } else if (btn.dataset.leg != null) { const legs = SM.cleanLegs(st.get('sm_legs', [])); legs.splice(+btn.dataset.leg, 1); st.set('sm_legs', legs); render(); }
    else if (btn.id === 'legCopy') copy(SM.legsText(st.get('sm_legs', []), { emoji: !$('cpNoEmoji').checked }), '✅ ' + t('Etappen kopiert.'));
    else if (btn.id === 'duelGo') { const pairs = SM.duelPairs(v.okAreas); if (pairs.length < 3) { msg(t('Zu wenige unterschiedliche Viertel für ein Duell.')); return; } duel = { pairs, n: 0, picks: [] }; renderDuel(); $('duelBox').querySelector('button')?.focus(); }
    else if (btn.dataset.duel != null) { const [a, b] = duel.pairs[duel.n]; duel.picks.push(btn.dataset.duel === '0' ? { win: a, lose: b } : { win: b, lose: a }); duel.n++; renderDuel(); $('duelBox').querySelector('button')?.focus(); }
    else if (btn.id === 'duelSkip') { duel.n++; renderDuel(); }
    else if (btn.id === 'duelUse') {
      const w = SM.duelWeights(duel.picks), i = +$('duelWho').value || 0;
      A.offerUndo(t('Geschmack aus dem Duell übernommen.')); duel = null;
      A.setPeople(A.people().map((p, j) => j === i ? { ...p, custom: w } : p));
    } else if (btn.id === 'duelEnd') { duel = null; $('duelBox').innerHTML = ''; }
  });

  // ---------- Paarweises Duell: aus Entscheidungen zwischen zwei Vierteln die Wünsche schätzen ----------
  const profile = a => Object.keys(SM.CATEGORIES).filter(k => k !== 'transit').sort((x, y) => (a.norm[y] || 0) - (a.norm[x] || 0)).slice(0, 3).map(k => `${a.counts[k]} ${t(SM.CATEGORIES[k].label)}`).join(' · ');
  function renderDuel() {
    const b = $('duelBox'); if (!b || !duel) return;
    if (duel.n < duel.pairs.length) {
      const [x, y] = duel.pairs[duel.n];
      const round = t('<b>Runde {n} von {m}:</b> Wo würdest du lieber wohnen? Nur nach Bauchgefühl.', { n: duel.n + 1, m: duel.pairs.length }), skip = t('Weiß nicht'), cancel = t('Abbrechen');
      b.innerHTML = `<p>${round}</p>
        <div class="xduel">${[x, y].map((a, i) => `<button type="button" data-duel="${i}"><b>${esc(a.name)}</b><small>${esc(profile(a))}</small></button>`).join('')}</div>
        <button type="button" class="link" id="duelSkip">${skip}</button> <button type="button" class="link" id="duelEnd">${cancel}</button>`;
      return;
    }
    const w = SM.duelWeights(duel.picks);
    if (!w) { const few = t('Zu wenige Antworten für eine Schätzung.'), close = t('Schließen'); b.innerHTML = `<p class="muted">${few}</p><button type="button" class="link" id="duelEnd">${close}</button>`; return; }
    const top = Object.entries(w).filter(([, x]) => x).sort((p, q) => Math.abs(q[1]) - Math.abs(p[1])).slice(0, 4).map(([k, x]) => x > 0 ? t('{label} wichtig', { label: t(SM.CATEGORIES[k].label) }) : t('{label} stört', { label: t(SM.CATEGORIES[k].label) }));
    const taste = t('<b>Dein Geschmack laut Duell:</b> {top}.', { top: esc(top.join(', ') || t('keine klare Richtung')) }), forWho = t('Übernehmen für'), take = t('Übernehmen'), drop = t('Verwerfen');
    b.innerHTML = `<p>${taste}</p>
      <div class="xform"><label for="duelWho">${forWho}</label><select id="duelWho">${A.people().map((p, i) => `<option value="${i}">${esc(p.name)}</option>`).join('')}</select>
      <button type="button" class="link" id="duelUse">${take}</button> <button type="button" class="link" id="duelEnd">${drop}</button></div>`;
  }

  // ---------- Vorlesen der Top 3 (nur Stimmen auf dem Gerät, damit kein Text an einen Sprachdienst geht) ----------
  function speak(v) {
    const ss = window.speechSynthesis;
    if (!ss || !window.SpeechSynthesisUtterance) { msg(t('Vorlesen wird von diesem Browser nicht unterstützt.')); return; }
    if (ss.speaking) { ss.cancel(); msg(t('Vorlesen beendet.')); return; }
    const voice = ss.getVoices().find(x => x.localService && (isEn() ? /^en/i : /^de/i).test(x.lang));
    if (!voice) { msg(t('Keine deutsche Stimme auf diesem Gerät. Vorlesen ist nur mit lokaler Stimme möglich, damit kein Text das Gerät verlässt.')); return; }
    const u = new SpeechSynthesisUtterance(v.ranked.slice(0, 3).map((a, i) => t('Platz {n}: {name}, {total} von 100, {verdict}. {summary}', { n: i + 1, name: a.name, total: a.group.total, verdict: SM.verdict(a.group.total), summary: SM.summary(a, v.ppl) })).join(' '));
    u.voice = voice; u.lang = voice.lang; ss.speak(u); msg(t('Lese vor … Nochmal klicken beendet.'));
  }
})();
