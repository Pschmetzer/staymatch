  // Englisch für /en/… und nicht-deutsche Browser (keine Umleitung, nur Text und Startseiten-Link)
  const en = /^\/en(\/|$)/.test(location.pathname) || !/^de\b/i.test(navigator.language || '');
  if (en) {
    document.documentElement.lang = 'en'; document.title = 'Page not found · StayMatch';
    document.getElementById('lead').textContent = 'This neighborhood doesn’t exist here.';
    Object.assign(document.getElementById('home'), { href: '/en', textContent: 'Go to home page' });
    document.getElementById('finder').textContent = 'Neighborhood finder (German)';
  }
  // Falsch getippte Stadtseite (/staedte/lisbon): „Meintest du Lissabon?“
  (() => {
    const m = /^\/staedte\/([^/?#]+)/.exec(location.pathname); if (!m) return;
    const cities = { amsterdam: 'Amsterdam', antwerpen: 'Antwerpen', barcelona: 'Barcelona', berlin: 'Berlin', bologna: 'Bologna', brussel: 'Brüssel', budapest: 'Budapest', lissabon: 'Lissabon', madrid: 'Madrid', malaga: 'Málaga', palma: 'Palma', paris: 'Paris', prag: 'Prag', rom: 'Rom', salzburg: 'Salzburg', warschau: 'Warschau', wien: 'Wien', zurich: 'Zürich' };
    const alias = { lisbon: 'lissabon', lisboa: 'lissabon', prague: 'prag', praha: 'prag', rome: 'rom', roma: 'rom', vienna: 'wien', brussels: 'brussel', bruessel: 'brussel', bruxelles: 'brussel', warsaw: 'warschau', warszawa: 'warschau', antwerp: 'antwerpen', zuerich: 'zurich' };
    const dist = (a, b) => { const d = Array.from({ length: b.length + 1 }, (_, i) => i); for (let i = 1; i <= a.length; i++) { let p = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, p + (a[i - 1] === b[j - 1] ? 0 : 1)); p = t; } } return d[b.length]; };
    const q = decodeURIComponent(m[1]).toLowerCase().replace(/\.html$/, '');
    let best = alias[q], score = 0;
    if (!best) [best, score] = Object.keys(cities).map((k) => [k, dist(q, k)]).sort((x, y) => x[1] - y[1])[0];
    if (score > 3) return;
    const p = document.getElementById('guess'), a = document.createElement('a');
    a.href = '/staedte/' + best; a.textContent = cities[best];
    p.append(en ? 'Did you mean ' : 'Meintest du ', a, '?'); p.hidden = false;
  })();
