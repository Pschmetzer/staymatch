// StayMatch – „Welche Stadt passt zu uns?“: alle Vorab-Städte mit denselben Wünschen durchrechnen und ordnen.
// Alles läuft im Browser mit den Dateien aus /data/; es wird nichts gesendet. Reine Funktionen (StayMatchCompare) sind in Node testbar.
(function (root) {
  if (!root.StayMatch && typeof require === 'function') require('./scoring.js');
  const SM = root.StayMatch, CATS = SM.CATEGORIES;
  const KEYS = Object.keys(CATS);
  const total = a => Object.values(a.counts).reduce((x, y) => x + y, 0);

  // ---- Städte laden und gemeinsam normieren ----
  // scoreAreas normiert je Stadt auf die eigene Spitze: „100“ hieße in Salzburg und Berlin etwas anderes. Für den Städtevergleich
  // rechnen wir mit EINEM Bezugswert für alle Städte (95. Perzentil über alle Viertel mit genug Orten, gleiche Formel wie scoreAreas).
  function poolNorms(cities) {
    const all = cities.flatMap(c => c.areas.filter(a => total(a) >= 10)), ref = {}, top = {};
    for (const k of KEYS) {
      const v = all.map(a => a.sums[k]).sort((x, y) => x - y);
      top[k] = v.length ? v[v.length - 1] : 0;
      ref[k] = Math.max(1, v.length ? v[Math.min(v.length - 1, Math.ceil(v.length * 0.95) - 1)] : 0);
    }
    for (const c of cities) for (const a of c.areas) {
      a.norm = Object.fromEntries(KEYS.map(k => {
        const x = a.sums[k];
        return [k, x <= ref[k] ? 0.9 * Math.sqrt(x / ref[k]) : top[k] > ref[k] ? 0.9 + 0.1 * (x - ref[k]) / (top[k] - ref[k]) : 0.9];
      }));
      Object.defineProperty(a.norm, 'quiet', { value: SM.quietScore(a) / 100, enumerable: false, configurable: true, writable: true });
    }
    return { ref, top };
  }
  // Eine Vorab-Datei → bewertete Viertel (die Orte selbst werden danach nicht mehr gebraucht)
  function prepare(file, d) {
    const m = SM.fromFile(d), { areas, pois } = SM.buildData(m.rows);
    SM.scoreAreas(areas, pois, 800); SM.annotateCentre(areas, m.geo);
    return { id: String(file).replace(/\?.*$/, '').replace(/\.json$/, ''), name: m.geo.name, areas, nPois: pois.length };
  }
  const idle = () => new Promise(r => setTimeout(r, 0));
  async function loadCities(fetchFn, base, onProgress) {
    const idx = await (await fetchFn(base + 'index.json')).json();
    const files = [...new Set(Object.values(idx).filter(v => typeof v === 'string' && /^[\w-]+\.json(\?v=\w+)?$/.test(v)))];
    const cities = [], failed = [];
    let next = 0, done = 0;
    const worker = async () => {
      while (next < files.length) {
        const f = files[next++];
        try { const r = await fetchFn(base + f); if (!r.ok) throw new Error(r.status); cities.push(prepare(f, await r.json())); } catch (e) { failed.push(f.replace(/\?.*$/, '')); }
        if (onProgress) onProgress(++done, files.length, f);
        await idle(); // Oberfläche atmen lassen
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    poolNorms(cities);
    return { cities: cities.sort((a, b) => a.id.localeCompare(b.id)), failed };
  }

  // ---- Rangliste ----
  const MAX_CENTRE = 6000; // wie in der App: Viertel weiter als 6 km vom Zentrum zählen nicht
  // Preislage-Grenze (Schätzung aus Lage und Sehenswürdigkeiten, a.tier 1 = eher günstig … 3 = zentral/teuer)
  function cityResult(city, ppl, o) {
    const f = SM.cleanFairness(o.fairness), maxTier = [1, 2, 3].includes(+o.maxTier) ? +o.maxTier : 3;
    for (const a of city.areas) { a.group = SM.groupScore(a.norm, ppl, f); a.vetoes = SM.vetoes(a.norm, ppl, a.counts); }
    const ok = SM.eligibleAreas(city.areas, ppl, MAX_CENTRE).withData.filter(a => !a.vetoes.length);
    let pool = ok.filter(a => a.tier <= maxTier), relaxed = false;
    if (!pool.length && ok.length) { pool = ok; relaxed = true; } // nichts in der Preislage: lieber ehrlich ohne Filter zeigen
    const base = { id: city.id, name: city.name, relaxed, areaCount: ok.length };
    if (!pool.length) return { ...base, score: 0, empty: true, vetoed: city.areas.some(a => a.vetoes.length) };
    const picks = SM.pickDiverse(SM.sortAreas(pool, 'fair'), 3, 1200), best = picks[0];
    const score = Math.round(0.7 * best.group.total + 0.3 * (picks.reduce((x, a) => x + a.group.total, 0) / picks.length)); // Spitze zählt, Breite etwas
    const gw = Object.fromEntries(KEYS.map(k => [k, ppl.reduce((x, p) => x + (p.w[k] || 0), 0) / ppl.length]));
    const want = KEYS.filter(k => gw[k] > 0.25).sort((a, b) => gw[b] * best.norm[b] - gw[a] * best.norm[a]).slice(0, 2);
    const calm = KEYS.filter(k => gw[k] <= -0.3 && best.norm[k] < 0.35).sort((a, b) => gw[a] - gw[b]).slice(0, 1);
    const li = best.group.scores.indexOf(best.group.min);
    return { ...base, score, best: { name: best.name, total: best.group.total, tier: best.tier, centerDist: best.centerDist },
      others: picks.slice(1).map(a => ({ name: a.name, total: a.group.total })), want, strong: want.length ? best.norm[want[0]] >= 0.6 : false, calm,
      weakest: ppl.length > 1 ? { name: ppl[li].name, score: best.group.min } : null, thin: ok.length < 8 || city.nPois < 1500 };
  }
  // cities: Ergebnis von loadCities; ppl: [{name, type, custom?, veto?}]; o: { fairness 0..1, maxTier 1..3 }
  function rankCities(cities, people, o = {}) {
    const ppl = people.map(SM.cleanPerson).filter(Boolean).map(p => ({ ...p, w: SM.weightsOf(p) }));
    if (!ppl.length) return [];
    const res = cities.map(c => cityResult(c, ppl, o));
    res.sort((a, b) => b.score - a.score || (a.empty ? 1 : 0) - (b.empty ? 1 : 0) || a.name.localeCompare(b.name));
    return res;
  }
  // Link in die App: Stadt, Typ der ersten Person; weitere Personen reisen als Wunsch-Link im Fragment (nicht in der Query)
  function appLink(name, people) {
    const ps = people.map(SM.cleanPerson).filter(Boolean), p = ps[0], G = root.StayMatchGroup;
    const t = !p ? '' : SM.isQuiet(p) ? 'quiet' : p.custom ? '' : p.type;
    const toks = G && ps.length > 1 ? ps.slice(1, 10).map(G.encodePerson).filter(Boolean) : [];
    return `/app?c=${encodeURIComponent(name)}${t ? '&t=' + t : ''}${toks.length ? '#p=' + toks.join('.') : ''}`;
  }

  // ---- Texte (DE/EN) ----
  const EN_CITY = { lissabon: 'Lisbon', prag: 'Prague', rom: 'Rome', wien: 'Vienna', warschau: 'Warsaw', brussel: 'Brussels', antwerpen: 'Antwerp', zurich: 'Zurich', malaga: 'Málaga' };
  const EN_CAT = { party: 'nightlife', chill: 'parks, cafés', sights: 'sightseeing', food: 'restaurants', transit: 'public transport', shop: 'shopping', sport: 'sports', kids: 'things for kids' };
  const DE_CAT = { party: 'Party', chill: 'Parks, Cafés', sights: 'Sehenswürdigkeiten', food: 'Essen', transit: 'ÖPNV', shop: 'Einkaufen', sport: 'Sport', kids: 'Kinder' };
  const EN_TYPE = { party: 'Party', chill: 'Relaxed', sights: 'Sightseeing', foodie: 'Foodie', family: 'Family', nature: 'Nature', shopping: 'Shopping', sport: 'Sport', culture: 'Culture', quiet: 'Quiet', custom: 'Custom (from the app)' };
  const TX = {
    de: {
      you: 'Du', person: 'Person', remove: 'Person entfernen', add: '+ Person', quiet: 'Ruhig', custom: 'Eigene Regler (aus der App)', verdict: ['passt kaum', 'schwach', 'okay', 'gut', 'sehr gut'],
      loading: (n, t) => `Lade Städtedaten … ${n} von ${t}`, computing: 'Rechne …', done: n => `${n} Städte verglichen. Beste zuerst:`, updated: 'Rangliste aktualisiert.',
      failed: n => `${n} Stadt${n === 1 ? '' : 'e'} konnte${n === 1 ? '' : 'n'} nicht geladen werden und fehlt in der Liste.`, none: 'Keine Städtedaten gefunden. Bitte später erneut versuchen.',
      best: 'Bestes Viertel', also: 'Auch gut', pts: s => `${s} von 100`, open: c => `Viertel in ${c} ansehen`, center: km => `${km} km zum Zentrum`,
      strong: l => `Stark bei ${l}`, solid: l => `Solide bei ${l}`, calm: l => `ohne viel ${l}`, lead: (d, o) => d > 0 ? `${d} Punkte vor ${o}` : `gleichauf mit ${o}`, behind: (d, o) => `${d} Punkte hinter ${o}`,
      weakest: (n, s) => `Am wenigsten passt es für ${n} (${s}).`, thin: 'Hier hat OpenStreetMap wenig Daten, die Wertung ist unsicher.', relaxed: 'Kein Viertel in dieser Preislage: gezeigt ist das beste ohne Preisfilter.',
      empty: 'Kein Viertel passt zu den Wünschen und Ausschlüssen.', and: ' und ', tier: ['', 'eher günstig', 'mittlere Lage', 'zentral und teuer'], tierLbl: 'Preislage',
    },
    en: {
      you: 'You', person: 'Person', remove: 'Remove person', add: '+ Person', quiet: 'Quiet', custom: EN_TYPE.custom, verdict: ['hardly fits', 'weak', 'okay', 'good', 'very good'],
      loading: (n, t) => `Loading city data … ${n} of ${t}`, computing: 'Calculating …', done: n => `${n} cities compared. Best first:`, updated: 'Ranking updated.',
      failed: n => `${n} cit${n === 1 ? 'y' : 'ies'} could not be loaded and ${n === 1 ? 'is' : 'are'} missing from the list.`, none: 'No city data found. Please try again later.',
      best: 'Best area', also: 'Also good', pts: s => `${s} out of 100`, open: c => `See neighbourhoods in ${c}`, center: km => `${km} km to the centre`,
      strong: l => `Strong on ${l}`, solid: l => `Solid on ${l}`, calm: l => `without much ${l}`, lead: (d, o) => d > 0 ? `${d} points ahead of ${o}` : `level with ${o}`, behind: (d, o) => `${d} points behind ${o}`,
      weakest: (n, s) => `It fits ${n} the least (${s}).`, thin: 'OpenStreetMap has little data here, so the score is uncertain.', relaxed: 'No area in this price range: showing the best one without the price filter.',
      empty: 'No area fits the wishes and exclusions.', and: ' and ', tier: ['', 'rather cheap', 'mid-range location', 'central and pricey'], tierLbl: 'Price range',
    },
  };
  const verdictOf = (T, s) => T.verdict[s >= 80 ? 4 : s >= 65 ? 3 : s >= 50 ? 2 : s >= 35 ? 1 : 0];
  const DE_CITY = { brussel: 'Brüssel' }; // Dateiname der Stadt in den Daten ist „Bruxelles - Brussel“
  const nameOf = (lang, r) => (lang === 'en' ? EN_CITY[r.id] : DE_CITY[r.id]) || r.name;
  // Begründung als Sätze; ranked = Ergebnis von rankCities
  function explain(ranked, i, lang = 'de') {
    const T = TX[lang] || TX.de, r = ranked[i], cat = k => (lang === 'en' ? EN_CAT : DE_CAT)[k], out = [];
    if (r.empty) return [T.empty];
    if (r.want.length) out.push(`${(r.strong ? T.strong : T.solid)(r.want.map(cat).join(T.and))}${r.calm.length ? ', ' + T.calm(cat(r.calm[0])) : ''}.`);
    else if (r.calm.length) out.push(`${T.calm(cat(r.calm[0]))[0].toUpperCase()}${T.calm(cat(r.calm[0])).slice(1)}.`);
    const o = i === 0 ? ranked[1] : ranked[0];
    if (o && !o.empty) { const t = i === 0 ? T.lead(r.score - o.score, nameOf(lang, o)) : T.behind(o.score - r.score, nameOf(lang, o)); out.push(`${t[0].toUpperCase()}${t.slice(1)}.`); }
    if (r.weakest && r.weakest.score < 60) out.push(T.weakest(r.weakest.name, r.weakest.score));
    if (r.relaxed) out.push(T.relaxed);
    if (r.thin) out.push(T.thin);
    return out;
  }

  const api = { poolNorms, prepare, loadCities, cityResult, rankCities, appLink, explain, verdictOf, nameOf, TX, EN_CITY, EN_TYPE };
  root.StayMatchCompare = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  // ---------- Seite ----------
  if (typeof document === 'undefined' || !document.getElementById('cmp')) return;
  const $ = id => document.getElementById(id), esc = SM.escapeHtml;
  const lang = document.documentElement.lang === 'en' ? 'en' : 'de', T = TX[lang];
  const store = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };
  { const t = store.get('sm_theme'); if (t === 'dark' || t === 'light') document.documentElement.dataset.theme = t; }
  const themeBtn = $('theme');
  const isDark = () => (document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')) === 'dark';
  themeBtn.setAttribute('aria-pressed', String(isDark()));
  themeBtn.onclick = () => { const next = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = next; store.set('sm_theme', JSON.stringify(next)); themeBtn.setAttribute('aria-pressed', String(next === 'dark')); };

  // Gruppe aus der App übernehmen (gleicher Browser, gleiche Herkunft), sonst eine Person
  let people = (Array.isArray(store.get('sm_people')) ? store.get('sm_people') : []).slice(0, 10).map(SM.cleanPerson).filter(Boolean);
  if (!people.length) people = [{ name: T.you, type: 'sights' }];
  let fairness = SM.cleanFairness(store.get('sm_fair') == null ? 0.6 : store.get('sm_fair'));
  let loaded = null, running = false;

  const emoji = k => (SM.PRESETS[k].label.split(' ')[0]);
  const typeOpts = hasCustom => [...Object.keys(SM.PRESETS).map(k => [k, `${emoji(k)} ${lang === 'en' ? EN_TYPE[k] : SM.PRESETS[k].label.replace(/^\S+\s/, '')}`]), ['quiet', `🤫 ${T.quiet}`], ...(hasCustom ? [['custom', `⚙️ ${T.custom}`]] : [])];
  const typeOf = p => p.custom ? (SM.isQuiet(p) ? 'quiet' : 'custom') : p.type;
  function renderRows(focusLast) {
    $('rows').innerHTML = people.map((p, i) => `<div class="prow">
      <label class="vh" for="pn${i}">${T.person} ${i + 1}</label><input id="pn${i}" data-i="${i}" maxlength="40" autocomplete="off" value="${esc(p.name)}">
      <label class="vh" for="pt${i}">${esc(p.name)}</label><select id="pt${i}" data-i="${i}">${typeOpts(typeOf(p) === 'custom').map(([v, l]) => `<option value="${v}"${v === typeOf(p) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>
      ${people.length > 1 ? `<button type="button" class="x" data-del="${i}" aria-label="${T.remove}: ${esc(p.name)}">✕</button>` : ''}</div>`).join('');
    $('add').hidden = people.length >= 10;
    if (focusLast) $('pn' + (people.length - 1)).focus();
  }
  $('rows').addEventListener('input', e => {
    const i = +e.target.dataset.i; if (!people[i]) return;
    if (e.target.tagName === 'INPUT') { people[i] = { ...people[i], name: e.target.value.slice(0, 40) || `${T.person} ${i + 1}` }; } else {
      const v = e.target.value, p = { name: people[i].name, veto: people[i].veto };
      people[i] = SM.cleanPerson(v === 'quiet' ? { ...p, type: 'chill', custom: SM.QUIET_W } : v === 'custom' ? people[i] : { ...p, type: v }) || people[i];
    }
    refresh();
  });
  $('rows').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (!b) return; people.splice(+b.dataset.del, 1); renderRows(); refresh(); $('add').focus(); });
  $('add').onclick = () => { people.push({ name: `${T.person} ${people.length + 1}`, type: 'chill' }); renderRows(true); refresh(); };
  const fairOut = () => { const f = Math.round(fairness * 100); $('fair').value = f; $('fairOut').textContent = lang === 'en' ? `${f}% least happy person · ${100 - f}% average` : `${f} % unzufriedenste Person · ${100 - f} % Schnitt`; $('fair').setAttribute('aria-valuetext', $('fairOut').textContent); };
  $('fair').addEventListener('input', () => { fairness = SM.cleanFairness(+$('fair').value / 100); fairOut(); refresh(); });
  $('tier').innerHTML = [3, 2, 1].map(t => `<option value="${t}">${lang === 'en' ? ['', 'Rather cheap only', 'Mid-range or cheaper', 'Any'][t] : ['', 'Nur eher günstig', 'Mittel oder günstiger', 'Egal'][t]}</option>`).join('');
  $('tier').addEventListener('change', () => refresh());
  fairOut(); renderRows();

  const status = msg => { $('status').textContent = msg; };
  function show(announce) {
    const ranked = rankCities(loaded.cities, people, { fairness, maxTier: +$('tier').value });
    $('out').innerHTML = ranked.map((r, i) => {
      const nm = esc(nameOf(lang, r));
      if (r.empty) return `<li class="vcity empty"><h2><span class="n">${i + 1}.</span> ${nm}</h2><p>${esc(explain(ranked, i, lang)[0])}</p></li>`;
      const why = explain(ranked, i, lang), km = (r.best.centerDist / 1000).toFixed(1).replace('.', lang === 'en' ? '.' : ',');
      return `<li class="vcity"><h2><span class="n">${i + 1}.</span> ${nm} <span class="score"><b>${r.score}</b>/100 · ${esc(verdictOf(T, r.score))}</span></h2>
        <p class="best">${T.best}: <b>${esc(r.best.name)}</b> (${T.pts(r.best.total)}, ${T.center(km)}, ${T.tier[r.best.tier]})${r.others.length ? `<br><span class="muted">${T.also}: ${r.others.map(o => esc(o.name)).join(', ')}</span>` : ''}</p>
        <p class="why">${why.map(esc).join(' ')}</p>
        <p class="act"><a class="btn small" href="${esc(appLink(r.name, people))}">${esc(T.open(nameOf(lang, r)))}</a></p></li>`;
    }).join('');
    $('out').hidden = false;
    const fail = loaded.failed.length ? ' ' + T.failed(loaded.failed.length) : '';
    status(announce ? T.done(ranked.length) + fail : T.updated + fail);
  }
  let timer = null;
  function refresh() { if (!loaded) return; clearTimeout(timer); timer = setTimeout(() => show(false), 120); }
  $('cmp').addEventListener('submit', async e => {
    e.preventDefault();
    if (running) return;
    if (loaded) { show(true); return; }
    running = true; $('go').disabled = true;
    try {
      const r = await loadCities((u, o) => fetch(u, o), '/data/', (n, t) => status(T.loading(n, t)));
      if (!r.cities.length) { status(T.none); return; }
      status(T.computing); await idle();
      loaded = r; show(true);
    } catch (err) { console.debug(err); status(T.none); }
    finally { running = false; $('go').disabled = false; }
  });
})(typeof window !== 'undefined' ? window : globalThis);
