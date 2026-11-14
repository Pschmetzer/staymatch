// StayMatch – Wörterbücher der Erweiterung (de = Quelltext der Oberfläche, en = Übersetzung).
// Schlüssel: bereich.thema (z. B. 'panel.top3.you'). Platzhalter {name}; Mehrzahl: 'key.one' / 'key.other' mit {n}.
// Das Deutsche muss genau den bisherigen Wortlaut liefern (Tests prüfen ihn). Regeln und Erkennung: shared/i18n.js.
(function (root) {
  const I = root.StayMatchI18n || (typeof require === 'function' ? require('./i18n.js') : null);
  if (!I) return;
  I.add('de', {
    //@@de@@
  });
  I.add('en', {
    //@@en@@
  });
})(typeof window !== 'undefined' ? window : globalThis);
