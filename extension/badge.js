// StayMatch – Toolbar-Badge: reine Funktionen (kein chrome.*), vom Service Worker (background.js) und den Tests genutzt.
// Zahl = Treffer der letzten bewerteten Suche, solange sie frisch ist. Alles lokal, keine Berechtigung nötig.
(function (root) {
  const I18n = root.StayMatchI18n || (typeof require === 'function' ? require('./i18n.js') : null);
  const t = (k, v) => I18n.t(k, v);
  const FRESH_MS = 6 * 3600e3;
  // storage: { lastSearch, settings } → { text, title }
  function badgeState(st, now = Date.now()) {
    const s = st?.settings || {};
    if (s.badge === false) return { text: '', title: 'StayMatch' };
    const ls = st?.lastSearch;
    const n = Array.isArray(ls?.top) ? ls.top.length : 0;
    if (!n || !Number.isFinite(ls.at) || now - ls.at > FRESH_MS) return { text: '', title: 'StayMatch' };
    return { text: String(Math.min(n, 99)), title: t('bg.badge', { n }) };
  }
  root.StayMatchBadge = { badgeState, FRESH_MS };
})(typeof window !== 'undefined' ? window : globalThis);
