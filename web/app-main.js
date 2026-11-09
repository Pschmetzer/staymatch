// StayMatch Viertel-Finder – Start: Ereignisse verbinden, erste Darstellung. Lädt als letztes app-*.js-Skript.
$('go').onclick = run;
$('city').addEventListener('keydown', e => { if (e.key === 'Enter') run(); });
// Hinweis, ob das Plugin installiert ist (setzt bridge.js)
setTimeout(() => {
  if (document.documentElement.dataset.staymatchExtension) $('extHint').textContent = '✅ Plugin verbunden: Auf der Airbnb-Seite siehst du direkt die Top 3 für euch.';
}, 800);
renderPeople();
