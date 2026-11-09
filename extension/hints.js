// StayMatch – Stichworte aus Bewertungstexten, die DU auf der Unterkunftsseite geöffnet hast.
// Reine Funktion ohne chrome.* und ohne DOM, damit sie sich testen lässt.
(function (root) {
  // [Label, Muster, positiv?, Verneinung umdrehen?]
  // Negative Muster, die selbst schon "kein/ohne" enthalten, werden nicht umgedreht.
  const HINTS = [
    ['sauber', /\b(sauber|blitzsauber|spotless|very clean|super clean|so clean)\b/i, true, true],
    ['Lage', /\b(tolle|super|perfekte|zentrale) lage\b|\b(great|perfect|excellent) location\b/i, true, true],
    ['Gastgeber', /\bgastgeber\w*\b[^.]{0,40}\b(nett|freundlich|hilfsbereit)\b|\bhost was (great|helpful|friendly|amazing)\b/i, true, true],
    ['laut', /\b(laut|lärm|lärmig|noisy|noise)\b/i, false, true],
    ['hellhörig', /\b(hellhörig|dünne wände|thin walls|paper[- ]thin)\b/i, false, false],
    ['Baustelle', /\b(baustelle|baulärm|construction (site|work|noise))\b/i, false, true],
    ['schmutzig', /\b(schmutzig|dreckig|dirty|unclean)\b/i, false, true],
    ['Ungeziefer', /\b(kakerlake\w*|ungeziefer|bettwanzen|cockroach\w*|bed ?bugs?|ameisen|mäuse|mice)\b/i, false, true],
    ['Bett unbequem', /\b(unbequem\w*|uncomfortable)\b/i, false, true],
    ['WLAN', /\b(wlan|wifi|wi-fi)\b[^.]{0,30}\b(schlecht|langsam|bad|slow|poor)\b/i, false, true],
    ['Treppen', /\b(viele|steile|steilen|enge|engen|\d+)\s+(treppen|stufen|stockwerke|stairs|flights)\b|\b(steile|steilen)\s+treppe\w*|\b(steep|narrow|many|lots of) stairs\b|\bwalk[- ]?up\b|\bohne aufzug\b/i, false, true],
    ['kein Aufzug', /\b(kein|keinen|ohne)\s+(aufzug|fahrstuhl|lift)\b|\bno (elevator|lift)\b/i, false, false],
    ['Reinigungsgebühr hoch', /\b(hohe|hohen|teure|teuren|überteuerte|high|expensive|steep)\s+(reinigungsgebühr\w*|endreinigung|putzgebühr\w*|cleaning fee)|\b(reinigungsgebühr\w*|endreinigung|putzgebühr\w*|cleaning fee)\b[^.]{0,40}\b(hoch|teuer|überteuert|zu viel|high|expensive|steep)\b/i, false, false],
    ['ohne Klimaanlage', /\b(kein\w*|ohne)\s+klima\w*|\bno (air ?conditioning|a\/c)\b|\b(zu heiß|too hot)\b/i, false, false],
    ['anders als im Inserat', /\b(anders als (auf )?(den )?(fotos|bildern)|nicht wie (auf )?(den )?(fotos|bildern)|not as (pictured|described)|misleading (photos|pictures))\b/i, false, false],
  ];
  const NEG = /\b(nicht|kein|keine|keinen|nie|not|never|no|wasn't|isn't)\b/i;

  // → ["👍 sauber", "⚠️ laut (2×)", …], häufigste zuerst
  function reviewHints(text) {
    const sentences = String(text || '').split(/(?<=[.!?\n])\s+/);
    const counts = {};
    for (const s of sentences) for (const [label, re, pos, flip] of HINTS) {
      const m = s.match(re);
      if (!m) continue;
      const before = s.slice(Math.max(0, m.index - 30), m.index);
      const negated = flip && NEG.test(before);
      const isPos = negated ? !pos : pos;
      const key = (isPos ? '👍 ' : '⚠️ ') + (negated ? 'nicht ' + label : label);
      counts[key] = (counts[key] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => n > 1 ? `${k} (${n}×)` : k);
  }

  const warnings = hints => (hints || []).filter(x => String(x).startsWith('⚠️'));

  root.StayMatchHints = { reviewHints, warnings, HINTS };
})(typeof window !== 'undefined' ? window : globalThis);
