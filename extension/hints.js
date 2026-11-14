// StayMatch – Stichworte aus Bewertungstexten, die DU auf der Unterkunftsseite geöffnet hast.
// Reine Funktion ohne chrome.* und ohne DOM, damit sie sich testen lässt.
(function (root) {
  // R7: \b ist in JS nur ASCII („zu heiß“, „Überteuert“ fielen durch). Daher echte Unicode-Wortgrenze.
  const WB = '(?:(?<![\\p{L}\\p{N}])(?=[\\p{L}\\p{N}])|(?<=[\\p{L}\\p{N}])(?![\\p{L}\\p{N}]))';
  const U = re => new RegExp(re.source.replace(/\\b/g, WB), 'iu');
  // [Label, Muster, positiv?, Verneinung umdrehen?, Label bei Verneinung (sonst „nicht <Label>“)]
  // Negative Muster, die selbst schon "kein/ohne" enthalten, werden nicht umgedreht.
  const HINTS = [
    ['sauber', /\b(sauber|blitzsauber|spotless|very clean|super clean|so clean)\b/, true, true],
    ['Lage', /\b(tolle|super|perfekte|zentrale) lage\b|\b(great|perfect|excellent) location\b/, true, true, 'Lage enttäuschend'],
    ['Gastgeber', /\bgastgeber\w*\b[^.]{0,40}\b(nett|freundlich|hilfsbereit)\b|\bhost was (great|helpful|friendly|amazing)\b/, true, true, 'Gastgeber unfreundlich'],
    // R7: „laut“ als Präposition („Laut Beschreibung …“) ist kein Lärm
    ['laut', /\b((?<!klimaanlage\s+(?:war\s+)?(?:sehr\s+)?)laut(?!\s+(?:der|dem|den|des|einer?|eigenen?|beschreibung|inserat|anzeige|gastgeber\w*|airbnb|bewertung\w*|website|foto\w*))|lärm|lärmig|noisy|noise)\b/, false, true],
    ['hellhörig', /\b(hellhörig|dünne wände|thin walls|paper[- ]thin)\b/, false, false],
    ['Baustelle', /\b(baustelle|baulärm|construction (site|work|noise))\b/, false, true, 'keine Baustelle'],
    ['schmutzig', /\b(schmutzig|dreckig|dirty|unclean)\b/, false, true],
    ['Ungeziefer', /\b(kakerlake\w*|ungeziefer|bettwanzen|cockroach\w*|bed ?bugs?|ameisen|mäuse|mice)\b/, false, true, 'kein Ungeziefer'],
    ['Bett unbequem', /\b(unbequem\w*|uncomfortable)\b/, false, true, 'Bett bequem'],
    ['WLAN', /\b(wlan|wifi|wi-fi)\b[^.]{0,30}\b(schlecht|langsam|bad|slow|poor)\b/, false, true, 'WLAN ok'],
    ['Treppen', /\b(viele|steile|steilen|enge|engen|\d+)\s+(treppen|stufen|stockwerke|stairs|flights)\b|\b(steile|steilen)\s+treppe\w*|\b(steep|narrow|many|lots of) stairs\b|\bwalk[- ]?up\b|\bohne aufzug\b/, false, true, 'wenig Treppen'],
    ['kein Aufzug', /\b(kein|keinen|ohne)\s+(aufzug|fahrstuhl|lift)\b|\bno (elevator|lift)\b/, false, false],
    ['Reinigungsgebühr hoch', /\b(hohe|hohen|teure|teuren|überteuerte|high|expensive|steep)\s+(reinigungsgebühr\w*|endreinigung|putzgebühr\w*|cleaning fee)|\b(reinigungsgebühr\w*|endreinigung|putzgebühr\w*|cleaning fee)\b[^.]{0,40}\b(hoch|teuer|überteuert|zu viel|high|expensive|steep)\b/, false, false],
    ['ohne Klimaanlage', /\b(kein\w*|ohne)\s+klima\w*|\bno (air ?conditioning|a\/c)\b|\b(zu heiß|too hot)\b/, false, false],
    ['anders als im Inserat', /\b(anders als (auf )?(den )?(fotos|bildern)|nicht wie (auf )?(den )?(fotos|bildern)|not as (pictured|described)|misleading (photos|pictures))\b/, false, false],
    // R7 E: weitere Kategorien (Runde 7 E, Bewertungs-Analyse)
    ['Matratze schlecht', /\b(matratze\w*\s+(war\s+)?(durchgelegen|alt|weich|hart|kaputt)|durchgelegen\w*|schlafsofa\s+(war\s+)?(hart|unbequem)|(saggy|old|worn|lumpy|hard)\s+mattress\w*|mattress\s+(was\s+)?(saggy|old|worn|lumpy|hard))\b/, false, false],
    ['Warmwasser', /\b(kein\w*\s+warm(es)?\s*wasser|warmwasser\s+(war\s+)?(knapp|kalt|aus)|boiler\s+(zu\s+)?klein|wenig\s+wasserdruck|wasserdruck\s+(war\s+)?(schwach|gering)|no hot water|(low|poor|weak) water pressure|hot water ran out)\b/, false, false],
    ['Geruch/Feuchtigkeit', /\b(schimmel\w*|muffig\w*|modrig\w*|feucht\w*|rauchgeruch|roch nach (rauch|zigaretten)|mou?ld\w*|musty|damp|mildew|smelled of smoke|smell of smoke)\b/, false, true, 'kein Geruch'],
    ['Nachbarn-Ärger', /\b(nachbarn?\s+(haben\s+sich\s+)?beschwer\w*|hausverwaltung\s+kam|neighbou?rs?\s+complained|building manager came)\b/, false, false],
    ['sichere Gegend', /\b(nachts\s+sicher|sichere\w*\s+(gegend|viertel|nachbarschaft)|felt (very )?safe|safe (area|neighbou?rhood))\b/, true, true, 'Gegend unsicher'],
    ['unsicher', /\b(unsichere\w*\s+(gegend|viertel|straße)|(fühlte\w*)\s+(mich|uns)\s+(nachts\s+)?unsicher|dunkle\w*\s+hinterhof|dunkle\w*\s+gasse|felt unsafe|unsafe (area|neighbou?rhood)|sketchy)\b/, false, false],
    ['Gastgeber löst Probleme', /\b(sofort\s+(reagiert|repariert|gekümmert)|schnell\s+(repariert|behoben|gelöst)|innerhalb\s+(einer|1)\s+stunde\s+(repariert|behoben|da)|fixed (it )?(right away|immediately|quickly)|responded immediately|resolved (it )?quickly)\b/, true, false],
    ['Gäste kamen wieder', /\b(zum\s+(zweiten|dritten|vierten|\d+\.)\s+mal|kommen\s+(gerne\s+)?wieder|wiederkommen|stayed here (again|before)|(second|third|fourth) (time|stay)|will (definitely )?(be back|come back|return))\b/, true, true, 'würden nicht wiederkommen'],
    ['Gastgeber hat storniert', /\b(gastgeber\w*\s+hat\s+[^.]{0,40}storniert|host canceled|host cancelled|l'hôte a annulé|el anfitrión canceló)\b/, false, false],
    ['Ohrstöpsel nötig', /\b((ohrstöpsel|oropax)\s+(waren\s+|sind\s+)?(nötig|notwendig|gebraucht|benötigt|empfehlenswert|ein muss|mitnehmen)|brauchten\s+(\w+\s+)?(ohrstöpsel|oropax)|(needed|bring|recommend)\s+earplugs|earplugs\s+(are\s+|were\s+)?(a must|needed|necessary|recommended))\b/, false, true, 'keine Ohrstöpsel nötig'],
    ['Klimaanlage laut', /\b(klimaanlage\s+(war\s+)?(sehr\s+)?laut|laute\s+klimaanlage|(ac|air conditioning|air conditioner)\s+(was\s+)?(very\s+)?(loud|noisy)|noisy (ac|air conditioning))\b/, false, false],
    ['hell', /\b(lichtdurchflutet\w*|sehr\s+hell(?!hörig)\w*|viel\s+(tages)?licht|bright and|so bright|lots of (natural )?light|flooded with light)\b/, true, false],
    ['dunkel', /\b((wohnung|zimmer|apartment|room)\s+(war\s+|was\s+)?(sehr\s+|very\s+)?dunkel|wenig\s+(tages)?licht|kaum\s+licht|(dark|gloomy) (apartment|room|flat)|not much (natural )?light)\b/, false, false],
    ['mit Rollstuhl/Rollator', /\b(mit\s+(dem\s+|meinem\s+|unserem\s+)?(rollstuhl|rollator)|(in|with) a wheelchair|wheelchair user|with (my |our )?walker)\b/, true, false],
    ['mit Hund da', /\b(mit\s+(unserem|meinem|dem)\s+hund|with (our|my) dog|hundefreundlich|dog[- ]friendly)\b/, true, false],
    ['ruhig', /\b(schlafzimmer\s+zum\s+hof|schallisoliert\w*|sehr\s+ruhig|absolut\s+ruhig|very quiet|super quiet|soundproof\w*)\b/, true, false],
  ].map(([label, re, pos, flip, negLabel]) => [label, U(re), pos, flip, negLabel]);
  const NEG = U(/\b(nicht|kein|keine|keinen|nie|not|never|no|wasn't|isn't)\b/);
  // R7: „nicht nur sauber, sondern …“ ist keine Verneinung
  const NOT_ONLY = U(/\b(nicht nur|not only|not just|non solo|pas seulement|no solo)\b/g);
  const NOT_ONLY_G = new RegExp(NOT_ONLY.source, 'giu'); // R8: einmal bauen, nicht je Satz

  // → ["👍 sauber", "⚠️ laut (2×)", …], häufigste zuerst
  function reviewHints(text) {
    const sentences = String(text || '').split(/(?<=[.!?\n])\s+/);
    const counts = {};
    for (const raw of sentences) {
      NOT_ONLY_G.lastIndex = 0;
      const s = raw.replace(NOT_ONLY_G, ' ');
      for (const [label, re, pos, flip, negLabel] of HINTS) {
        const m = s.match(re);
        if (!m) continue;
        const before = s.slice(Math.max(0, m.index - 30), m.index);
        // R7: Verneinung auch im Treffer selbst („Gastgeber war nicht freundlich“, „WLAN war nicht schlecht“)
        const negated = flip && (NEG.test(before) || NEG.test(m[0]));
        const isPos = negated ? !pos : pos;
        const key = (isPos ? '👍 ' : '⚠️ ') + (negated ? negLabel || 'nicht ' + label : label);
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => n > 1 ? `${k} (${n}×)` : k);
  }

  const warnings = hints => (hints || []).filter(x => String(x).startsWith('⚠️'));

  // ---------- R7 E: Auswertungen über einzelne Bewertungen (reviewTexts: je Bewertung ein Text) ----------
  // R8: je Text nur einmal rechnen (criticalShare, hostReplies fragen denselben Text mehrfach)
  const CRIT_CACHE = new Map();
  const critical = t => {
    const k = String(t || '');
    let v = CRIT_CACHE.get(k);
    if (v === undefined) {
      v = reviewHints(k).some(x => x.startsWith('⚠️'));
      if (CRIT_CACHE.size > 500) CRIT_CACHE.clear();
      CRIT_CACHE.set(k, v);
    }
    return v;
  };
  // „4 von 30 Bewertungen kritisch“; ein Kritiker unter vielen Lobenden ist ein Einzelfall
  function criticalShare(texts) {
    const list = (texts || []).filter(Boolean);
    if (list.length < 5) return null;
    const n = list.filter(critical).length;
    return { critical: n, total: list.length, single: n === 1 && list.length >= 15 };
  }
  // Wann ist es laut? Uhrzeiten in Sätzen mit Lärm-Wörtern
  const NOISE = U(/\b(laut(?!\s+(?:der|dem|den|des|beschreibung))|lärm\w*|noisy|noise|müllabfuhr|garbage truck|party|feiern|bars?)\b/);
  function noiseTimes(texts) {
    let night = 0, morning = 0;
    for (const s of String((texts || []).join('\n')).split(/(?<=[.!?\n])\s+/)) {
      if (!NOISE.test(s)) continue;
      // R8: „am“/„pm“ nur als eigenes Wort („2 amazing nights“ ist keine Uhrzeit)
      for (const m of s.matchAll(/(?<![\d:.,])\b(\d{1,2})(?:[:.](\d{2}))?\s*(uhr\b|h\b|(?:am|pm)(?![\p{L}])|a\.m\.|p\.m\.)/giu)) {
        let h = +m[1]; const ap = m[3].toLowerCase();
        if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0;
        if (h >= 22 || h <= 4) night++; else if (h >= 5 && h <= 9) morning++;
      }
      if (/nachts|in der nacht|at night|all night|bis spät/i.test(s)) night++;
      if (/morgens|früh am morgen|in the morning|early morning/i.test(s)) morning++;
    }
    if (!night && !morning) return null;
    return night >= morning ? 'meist nachts' : 'meist morgens';
  }
  // Gästemix: wer war dort?
  const MIX = [['Paare', /\b(mein(e|em|er)? (freund|freundin|partner\w*|mann|frau)|wir (beide|zwei)|romantisch\w*|my (husband|wife|partner|boyfriend|girlfriend)|couple|honeymoon)\b/], ['Familien', /\b(kinder|kids|familie|family|baby|tochter|sohn|daughter|son)\b/], ['Dienstreisen', /\b(dienstreise|geschäftsreise|business trip|work trip|arbeiten|homeoffice|remote work)\b/], ['Freunde', /\b(freunde\w*|freundesgruppe|mädelstrip|jungs|friends|group of)\b/]].map(([l, re]) => [l, U(re)]);
  function guestMix(texts) {
    const c = {}; let n = 0;
    for (const t of texts || []) { const hit = MIX.filter(([, re]) => re.test(t)); if (hit.length) n++; for (const [l] of hit) c[l] = (c[l] || 0) + 1; }
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top && n >= 4 && top[1] / n >= 0.5 ? { top: top[0], share: top[1] / n, n } : null;
  }
  // Sprachen der Bewertungen über häufige Füllwörter (grob, nur Hinweis)
  const LANGS = { de: /\b(und|nicht|sehr|wir|war)\b/i, en: /\b(the|and|was|very|we)\b/i, fr: /\b(et|très|nous|était|le|la)\b/i, es: /\b(muy|y|el|la|nosotros|fue)\b/i, it: /\b(molto|e|era|abbiamo|il)\b/i, nl: /\b(het|en|zeer|was|wij|erg)\b/i, pt: /\b(muito|e|foi|nós|o)\b/i };
  function languages(texts) {
    const seen = new Set();
    for (const t of texts || []) { let best = null, bs = 0; for (const [k, re] of Object.entries(LANGS)) { const n = (String(t).match(new RegExp(re.source, 'gi')) || []).length; if (n > bs) { bs = n; best = k; } } if (best && bs >= 2) seen.add(best); }
    return seen.size;
  }
  // Konkrete Zahlen aus Bewertungen („10 Minuten zur Metro“, „3. Stock ohne Aufzug“)
  function numberFacts(texts) {
    const out = [];
    const re = /\b\d{1,2}\s*(?:min(?:uten|\.)?|minutes?)\s+(?:zu[mr]?|bis zu[mr]?|to the|from the|walk to)\s+[\p{L}-]{3,20}|\b\d{1,2}\.\s*(?:stock|etage)\s+ohne\s+(?:aufzug|lift)|\b\d{1,2}(?:st|nd|rd|th)\s+floor\s+(?:without|no)\s+(?:elevator|lift)/giu;
    for (const t of texts || []) for (const m of String(t).matchAll(re)) { const s = m[0].trim(); if (!out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s); if (out.length >= 4) return out; }
    return out;
  }
  // Renovierung: „neu renoviert“, „neue Matratzen“ in den jüngsten Bewertungen
  const RENOV = U(/\b(neu\s+renoviert|frisch\s+renoviert|renovier\w*|neue\s+matratze\w*|newly renovated|just renovated|new mattress\w*)\b/);
  // R8: „jüngste“ stimmt nur, wenn die Texte neueste zuerst kommen. Airbnb sortiert standardmäßig nach Relevanz:
  // ohne opts.newestFirst (der Aufrufer muss die Sortierung kennen) gibt es keine Aussage über „zuletzt“.
  const renovated = (texts, recent = 5, opts = {}) => !!opts?.newestFirst && (texts || []).slice(0, recent).some(t => RENOV.test(t));
  // Stichwort-Trend: Lob „sauber“ in den neuesten 10 gegen ältere (Reihenfolge wie auf der Seite: neueste zuerst)
  function keywordTrend(texts, label = 'sauber', opts = {}) {
    if (!opts?.newestFirst) return null; // R8: Reihenfolge unbekannt (Relevanz-Sortierung) → kein Trend behaupten
    const list = texts || []; if (list.length < 16) return null;
    const rate = a => a.filter(t => reviewHints(t).some(x => x.startsWith('👍 ' + label))).length / a.length;
    const neu = rate(list.slice(0, 10)), alt = rate(list.slice(10));
    if (alt >= 0.3 && neu <= alt / 2) return `„${label}“ früher oft gelobt, zuletzt selten`;
    return null;
  }
  // Gastgeber antwortet auf Kritik? Kritische Bewertungen mit Antwort, lösungsorientiert („behoben“, „ersetzt“)
  function hostReplies(texts) {
    const crit = (texts || []).filter(critical);
    if (crit.length < 2) return null;
    const RE = /antwort (?:des|vom|von) gastgeber|response from|réponse de l'hôte|respuesta del anfitrión/i;
    const replied = crit.filter(t => RE.test(t));
    const fix = replied.filter(t => /behoben|repariert|ersetzt|ausgetauscht|neu gekauft|fixed|replaced|repaired|resolved|réparé|remplacé/i.test(t));
    return { critical: crit.length, replied: replied.length, fixing: fix.length };
  }

  root.StayMatchHints = { reviewHints, warnings, HINTS, criticalShare, noiseTimes, guestMix, languages, numberFacts, renovated, keywordTrend, hostReplies };
})(typeof window !== 'undefined' ? window : globalThis);
