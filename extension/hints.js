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
    ['laut', /\b(laut(?!\s+(?:der|dem|den|des|einer?|eigenen?|beschreibung|inserat|anzeige|gastgeber\w*|airbnb|bewertung\w*|website|foto\w*))|lärm|lärmig|noisy|noise)\b/, false, true],
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
  ].map(([label, re, pos, flip, negLabel]) => [label, U(re), pos, flip, negLabel]);
  const NEG = U(/\b(nicht|kein|keine|keinen|nie|not|never|no|wasn't|isn't)\b/);
  // R7: „nicht nur sauber, sondern …“ ist keine Verneinung
  const NOT_ONLY = U(/\b(nicht nur|not only|not just|non solo|pas seulement|no solo)\b/g);

  // → ["👍 sauber", "⚠️ laut (2×)", …], häufigste zuerst
  function reviewHints(text) {
    const sentences = String(text || '').split(/(?<=[.!?\n])\s+/);
    const counts = {};
    for (const raw of sentences) {
      const s = raw.replace(new RegExp(NOT_ONLY.source, 'giu'), ' ');
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

  root.StayMatchHints = { reviewHints, warnings, HINTS };
})(typeof window !== 'undefined' ? window : globalThis);
