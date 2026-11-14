// Typ-Filter der Städteübersicht (/staedte, /en/cities). Ohne JavaScript bleibt alles sichtbar, die Auswahl ist dann verborgen.
(function () {
  var box = document.getElementById('filter'), list = document.getElementById('cities');
  if (!box || !list) return;
  box.hidden = false;
  var cards = Array.prototype.slice.call(list.children);
  cards.forEach(function (c, i) { c.dataset.i = i; });
  box.addEventListener('change', function (e) {
    var t = e.target && e.target.value;
    if (!t) return;
    list.dataset.f = t === 'all' ? '' : t;
    cards.sort(function (a, b) {
      return t === 'all' ? a.dataset.i - b.dataset.i : (b.dataset['s' + t] || 0) - (a.dataset['s' + t] || 0) || a.dataset.i - b.dataset.i;
    }).forEach(function (c) { list.appendChild(c); });
  });
})();
