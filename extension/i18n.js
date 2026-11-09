// GENERIERT aus shared/i18n.js – nicht bearbeiten! Änderungen in shared/i18n.js, dann: node scripts/sync-core.mjs
// StayMatch – Übersetzungen (Gerüst, noch ungenutzt).
// NUR HIER bearbeiten, danach `node scripts/sync-core.mjs` (kopiert nach web/ und extension/).
// t('key', { n: 3 }) → Text aus dem Wörterbuch, {n} wird ersetzt. Unbekannter Schlüssel → der Schlüssel selbst.
(function (root) {
  const DICT = {
    de: {
      // Beispiel: 'results.count': '{n} Viertel ausgewertet',
    },
  };
  let lang = 'de';

  function t(key, vars) {
    const s = DICT[lang]?.[key] ?? DICT.de[key] ?? key;
    return vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s;
  }
  function setLang(l) { if (DICT[l]) lang = l; return lang; }

  const api = { t, setLang, DICT };
  root.StayMatchI18n = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
