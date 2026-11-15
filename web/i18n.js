// StayMatch – Übersetzung der Viertel-Finder-Texte (DE im Code, EN im Wörterbuch).
// Der deutsche Text IST der Schlüssel: t('Platz {n} von {m}', { n, m }). Auf /en/app (<html lang="en">) schlägt t() den Schlüssel im
// englischen Wörterbuch nach (i18n-en-*.js rufen StayMatchI18n.add('en', {…}) auf). Fehlt ein Eintrag, erscheint der deutsche Text und
// der Schlüssel landet in StayMatchI18n.missing (Tests prüfen, dass das leer bleibt). Platzhalter: {name}, Werte kommen unverändert hinein.
// Mehrzahl: zwei Schlüssel und im Code wählen (n === 1 ? t('…') : t('…')), keine Pluralregeln im Wörterbuch.
(function (root) {
  const dict = { en: {} }, missing = new Set();
  const lang = () => (root.SM_LANG === 'en' || (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang === 'en')) ? 'en' : 'de';
  const fill = (s, p) => p ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.hasOwn(p, k) ? String(p[k]) : m)) : s;
  function t(s, p) {
    if (lang() !== 'en') return fill(s, p);
    if (Object.hasOwn(dict.en, s)) return fill(dict.en[s], p);
    missing.add(s);
    return fill(s, p);
  }
  function add(l, o) { dict[l] = Object.assign(dict[l] || {}, o); }
  // Zahl und Datum in der Sprache der Seite
  const locale = () => lang() === 'en' ? 'en-GB' : 'de';
  const api = { t, add, lang, dict, missing, locale, fill };
  root.StayMatchI18n = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
