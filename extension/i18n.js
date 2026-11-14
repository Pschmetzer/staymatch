// GENERIERT aus shared/i18n.js – nicht bearbeiten! Änderungen in shared/i18n.js, dann: node scripts/sync-core.mjs | StayMatch – Übersetzungen: Motor (Wörterbücher stehen in extension/strings.js).
// NUR HIER bearbeiten, danach `node scripts/sync-core.mjs` (kopiert nach extension/; die Website lädt es noch nicht).
// t('key', { n: 3 }) → Text aus dem Wörterbuch, {n} wird ersetzt. Unbekannter Schlüssel → der Schlüssel selbst.
// Mehrzahl: gibt es 'key.one' / 'key.other' und vars.n, wird nach n gewählt (n === 1 → .one).
// Sprache: einstellbar (setLang('de'|'en'), 'auto' = erkennen). Erkennung nur mit positivem Beleg, sonst Deutsch:
//   Airbnb-Seite: <html lang> (de* → de, sonst en), ohne lang die Domain (.de/.at/.ch → de, sonst en);
//   Erweiterungsseiten und Service Worker: chrome.i18n.getUILanguage(); Node und Tests: de.
(function (root) {
  const DICT = { de: {}, en: {} };
  const LANGS = ['de', 'en'];
  let forced = null;

  function detect() {
    try {
      if (typeof document !== 'undefined' && typeof location !== 'undefined' && /(^|\.)airbnb\./i.test(location.hostname || '')) {
        const l = String(document.documentElement?.getAttribute('lang') || '').trim().toLowerCase();
        if (l) return l.startsWith('de') ? 'de' : 'en';
        return /\.(de|at|ch)$/i.test(location.hostname) ? 'de' : 'en';
      }
      const ui = root.chrome?.i18n?.getUILanguage?.();
      if (ui) return /^de/i.test(ui) ? 'de' : 'en';
    } catch {}
    return 'de';
  }
  const lang = () => forced || detect();
  function setLang(l) { forced = LANGS.includes(l) ? l : null; return lang(); } // 'auto' oder Unbekanntes: erkennen
  function add(l, dict) { if (LANGS.includes(l) && dict) Object.assign(DICT[l], dict); }
  const has = key => key in DICT[lang()] || key in DICT.de;

  function t(key, vars) {
    const L = lang(), d = DICT[L] || DICT.de;
    let k = key;
    if (vars && typeof vars.n === 'number') { const pk = key + (vars.n === 1 ? '.one' : '.other'); if (pk in d || pk in DICT.de) k = pk; }
    const s = d[k] ?? DICT.de[k] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, v) => (v in vars ? String(vars[v]) : m)) : s;
  }
  // Zahlen- und Datumsformate nach Sprache
  const locale = () => (lang() === 'en' ? 'en-GB' : 'de-DE');
  const dec = s => (lang() === 'en' ? String(s) : String(s).replace('.', ',')); // Dezimalzeichen
  const date = (d, opts) => new Date(d).toLocaleDateString(locale(), opts);
  const dateTime = (d, opts) => new Date(d).toLocaleString(locale(), opts);
  const num = (n, opts) => Number(n).toLocaleString(locale(), opts);

  // Statische HTML-Seiten: data-i18n="key" setzt textContent, data-i18n-attr="placeholder:key;aria-label:key2" setzt Attribute (nie innerHTML)
  function apply(rootEl) {
    const doc = rootEl || (typeof document !== 'undefined' ? document : null);
    if (!doc) return;
    for (const el of doc.querySelectorAll('[data-i18n]')) el.textContent = t(el.getAttribute('data-i18n'));
    for (const el of doc.querySelectorAll('[data-i18n-attr]'))
      for (const pair of el.getAttribute('data-i18n-attr').split(';')) { const [a, k] = pair.split(':').map(x => x.trim()); if (a && k) el.setAttribute(a, t(k)); }
    try { if (doc.documentElement) doc.documentElement.lang = lang(); } catch {}
  }

  const api = { apply, t, setLang, lang, add, has, locale, dec, date, dateTime, num, DICT, LANGS };
  root.StayMatchI18n = api;
  if (typeof module === 'object' && module.exports) { module.exports = api; try { require('./strings.js'); } catch {} } // Node: Wörterbücher mitladen
})(typeof window !== 'undefined' ? window : globalThis);
