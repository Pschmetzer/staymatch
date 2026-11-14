  // Texte dieser Sprachversion (index.html und en.html teilen sonst dasselbe Skript)
  const T = { nights: n => n === 1 ? '1 night' : n + ' nights', newTab: 'Opens the regular Airbnb search in a new tab.', toLight: 'Switch to light mode', toDark: 'Switch to dark mode', copy: 'Copy', copied: 'Copied ✓', copyKey: 'Selected: press Ctrl+C', badDates: 'Check-out must be after check-in.', afterSearch: 'With the extension you see the top 3 right there.', getPlugin: 'Get the extension ↓', airbnb: 'https://www.airbnb.com', dec: '.',
    stars: (b, p) => `Weighted: ${b} stars → ${p} of 100 star points`, fair: (m, a, t) => `0.6 × ${m} (lowest) + 0.4 × ${a} (average) = ${t}`,
    done: (n, of) => `${n} of ${of} done`, lcOk: h => `✓ ${h} is an Airbnb address.`, lcWarn: h => `⚠ ${h} is not an Airbnb address.`, lcBad: "That doesn't look like a link.", linkCopied: 'Link copied ✓' };
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Hell/Dunkel: eigene Wahl merken, Beschriftung, Browserleisten-Farbe und Fotos mitziehen
  (() => {
    const root = document.documentElement, btn = $('#theme');
    const cur = () => root.dataset.theme || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
    const paint = () => {
      const t = cur();
      btn.setAttribute('aria-label', t === 'light' ? T.toDark : T.toLight); btn.title = btn.getAttribute('aria-label');
      $$('meta[name="theme-color"]').forEach(m => { m.content = t === 'light' ? '#ffffff' : '#0b0b0d'; });
      // Helle Seite: helle Fotos (media/*-hell-*), dunkle Seite: die abendlichen Originale.
      // Das Schlussbild liegt unter einem dunklen Overlay und bleibt in beiden Modi das Original.
      $$('picture.photo').forEach(pic => $$('source, img', pic).forEach(el => {
        for (const a of ['srcset', 'src']) {
          const v = el.getAttribute(a); if (!v) continue;
          const plain = v.replace(/media\/(laptop|gepaeck)-hell-/g, 'media/$1-');
          el.setAttribute(a, t === 'light' ? plain.replace(/media\/(laptop|gepaeck)-/g, 'media/$1-hell-') : plain);
        }
      }));
    };
    btn.addEventListener('click', () => {
      root.dataset.theme = cur() === 'light' ? 'dark' : 'light';
      try { localStorage.setItem('sm_theme', root.dataset.theme); } catch {}
      paint();
    });
    paint();
  })();

  // Schnellstart: öffnet die normale Airbnb-Suche (URL-Format nicht offiziell dokumentiert)
  // und gibt die Eingaben an alle Viertel-Finder-Links weiter (Deeplink /app?c=…&i=…&o=…&n=…&k=…&b=…).
  (() => {
    const form = $('#quick'), ci = $('#qci'), co = $('#qco'), out = $('#qnights'), city = form.elements.query, ad = form.elements.adults;
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    const today = iso(new Date());
    ci.min = today; co.min = today;
    // Eingaben nur für diesen Tab merken (zurück vom Airbnb-Tab, Neuladen)
    try {
      const s = JSON.parse(sessionStorage.getItem('sm_quick') || '{}');
      if (s.c) city.value = s.c;
      if (s.i >= today) ci.value = s.i;
      if (s.o > (ci.value || today)) co.value = s.o;
      if (s.n) ad.value = s.n;
      if (s.k) form.elements.children.value = s.k;
      if (s.b) form.elements.price_max.value = s.b;
      if (s.k || s.b) $('.qmore').open = true;
    } catch {}
    const plusDays = (v, n) => { const d = new Date(v + 'T12:00'); d.setDate(d.getDate() + n); return iso(d); };
    ci.addEventListener('change', () => {
      if (ci.value && (!co.value || co.value <= ci.value)) co.value = plusDays(ci.value, 3);
    });
    // Schnellwahl: Freitag bis Sonntag. Ist heute Freitag, gilt bewusst der Freitag in einer Woche (Anreise am selben Tag ist selten buchbar). „Wochenende danach“ = eine Woche später.
    $$('[data-wknd]').forEach(b => b.addEventListener('click', () => {
      const d = new Date(today + 'T12:00'); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7) + 7 * Number(b.dataset.wknd));
      ci.value = iso(d); co.value = plusDays(ci.value, 2); sync();
    }));
    let shown = null;
    const say = (key, ...parts) => { if (key !== shown) { shown = key; out.replaceChildren(...parts); } };
    const sync = () => {
      if (ci.value) co.min = ci.value;
      const bad = !!(co.value && ci.value && co.value <= ci.value);
      co.toggleAttribute('aria-invalid', bad); if (bad) co.setAttribute('aria-invalid', 'true');
      const n = ci.value && co.value && !bad ? Math.round((new Date(co.value) - new Date(ci.value)) / 864e5) : 0;
      if (bad) say('bad', T.badDates);
      else if (n > 0) say(n, Object.assign(document.createElement('b'), { textContent: T.nights(n) }), ' · ' + T.newTab);
      else say(0, T.newTab);
      const q = new URLSearchParams(), c = city.value.trim();
      const known = $$('#cities option').some(o => o.value.toLowerCase() === c.toLowerCase());
      $('#qcityhint').hidden = !c || known;
      if (c) q.set('c', c);
      if (ci.value) q.set('i', ci.value);
      if (co.value && !bad) q.set('o', co.value);
      if (Number(ad.value) > 1) q.set('n', String(ad.value));
      const kn = Math.floor(form.elements.children.value), bn = Math.floor(form.elements.price_max.value);
      if (kn > 0) q.set('k', kn); if (bn > 0) q.set('b', bn); // Kinder, Budget pro Nacht (Übernahme in app-extra.js)
      $$('a[data-app]').forEach(a => { a.href = '/app' + (q.size ? '?' + q : ''); });
      try { sessionStorage.setItem('sm_quick', JSON.stringify({ c, i: ci.value, o: bad ? '' : co.value, n: ad.value, k: form.elements.children.value, b: form.elements.price_max.value })); } catch {}
    };
    form.addEventListener('input', sync);
    form.addEventListener('change', sync);
    form.addEventListener('submit', e => {
      e.preventDefault();
      const f = new FormData(form), q = new URLSearchParams();
      const city = String(f.get('query') || '').trim(); if (!city) return;
      const ad = Math.max(1, Math.min(16, Number(f.get('adults')) || 1));
      if (ci.value) q.set('checkin', ci.value);
      if (co.value && (!ci.value || co.value > ci.value)) q.set('checkout', co.value);
      q.set('adults', ad);
      // wie airbnbUrl (scoring.js): max. 16 Gäste, Budget in Euro
      const kids = Math.max(0, Math.min(16 - ad, Math.floor(Number(f.get('children'))) || 0)), max = Math.min(99999, Math.floor(Number(f.get('price_max'))) || 0);
      if (kids) q.set('children', kids);
      if (max > 0) { q.set('price_max', max); q.set('currency', 'EUR'); }
      // Link statt window.open: wird von Pop-up-Blockern nicht abgefangen
      const a = Object.assign(document.createElement('a'), { href: `${T.airbnb}/s/${encodeURIComponent(city)}/homes?${q}`, target: '_blank', rel: 'noopener' });
      a.click();
      // Wer ohne Plugin auf Airbnb landet, sieht dort keine Top 3: kurzer Hinweis
      shown = 'sent';
      out.replaceChildren(T.afterSearch + ' ', Object.assign(document.createElement('a'), { href: '#plugin', textContent: T.getPlugin }));
    });
    sync();
  })();

  // Plugin: passender Erweiterungs-Pfad je Browser, Kopier-Knopf, Schritte nach dem Download hervorheben
  (() => {
    const ua = navigator.userAgent, mobile = /Mobile|Android|iPhone|iPad|CriOS|FxiOS/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const chromium = /Chrome|Chromium|Edg\//.test(ua) && !mobile;
    if (!chromium) { const h = $('#browserhint'); if (h) h.hidden = false; }
    // Chromium am Computer: Hero-Knopf lädt direkt herunter und springt danach zu den Schritten
    if (chromium) $$('.hero .ctas a[href="#plugin"]').forEach(a => { a.href = 'staymatch-plugin.zip'; a.setAttribute('download', $('a[download]').getAttribute('download')); });
    if (chromium) $$('.dlhint').forEach(h => { h.hidden = false; });
    if (mobile) {
      $$('.mobile-hint, .sendlink').forEach(h => { h.hidden = false; });
      // Web-Share (Teilen-Menü: Mail, Nachrichten, AirDrop), sonst greift der mailto-Link
      const sl = $('#sendlink');
      if (navigator.share) sl.addEventListener('click', ev => { ev.preventDefault(); navigator.share({ title: sl.dataset.shareTitle, url: location.origin + location.pathname }).catch(() => {}); });
    }
    const b = /Edg\//.test(ua) ? ['Edge', 'edge://extensions'] : navigator.brave ? ['Brave', 'brave://extensions'] : /OPR\//.test(ua) ? ['Opera', 'opera://extensions'] : /Vivaldi/.test(ua) ? ['Vivaldi', 'vivaldi://extensions'] : null;
    if (b && chromium) { $('#extbrowser').textContent = b[0]; $('#extpath').textContent = b[1]; $('#extcopy').dataset.copy = b[1]; }
    const status = $('#copystatus');
    $$('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(btn.dataset.copy);
        btn.textContent = T.copied; status.textContent = T.copied;
      } catch {
        // Ohne Zwischenablage-Recht: Text markieren und zum Kopieren per Tastatur auffordern
        const r = document.createRange(); r.selectNodeContents($('#extpath'));
        getSelection().removeAllRanges(); getSelection().addRange(r);
        btn.textContent = T.copyKey; status.textContent = T.copyKey;
      }
      setTimeout(() => { btn.textContent = T.copy; status.textContent = ''; }, 2400);
    }));
    const steps = $('#steps');
    $$('a[download]').forEach(a => a.addEventListener('click', () => {
      setTimeout(() => {
        steps.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
        steps.classList.remove('flash'); void steps.offsetWidth; steps.classList.add('flash');
      }, 300);
    }));
  })();

  // Demos: Sterne = ratingScore (extension/rank.js), Fairness = groupScore (web/scoring.js)
  {
    const live = (els, f) => { els.forEach(e => e.addEventListener('input', f)); f(); };
    live([$('#sd-star'), $('#sd-n')], () => {
      const s = +$('#sd-star').value, c = +$('#sd-n').value, bay = (s * c + 4.6 * 20) / (c + 20), f = x => x.toFixed(2).replace('.', T.dec);
      $('#sd-v').textContent = f(s); $('#sd-nv').textContent = c;
      $('#sd-out').textContent = T.stars(f(bay), Math.round(Math.max(0, Math.min(1, (bay - 4.2) / .75)) * 100));
    });
    const fd = $$('#fair-demo input');
    live(fd, () => {
      const s = fd.map(i => (i.nextElementSibling.textContent = i.value, +i.value)), m = Math.min(...s), a = s.reduce((x, y) => x + y) / s.length;
      $('#fd-out').textContent = T.fair(m, Math.round(a), Math.round(.6 * m + .4 * a));
    });
    // Checkliste: Häkchen nicht gespeichert, Drucken nur der Liste
    const ck = $$('#checkliste li').map(li => {
      const l = document.createElement('label'), b = l.appendChild(document.createElement('input'));
      b.type = 'checkbox'; l.append(Object.assign(document.createElement('span'), { textContent: li.textContent })); li.replaceChildren(l); return b;
    });
    live(ck, () => { $('#ck-out').textContent = T.done(ck.filter(b => b.checked).length, ck.length); });
    $('#ck-print').addEventListener('click', () => { document.documentElement.classList.add('pc'); print(); });
    addEventListener('afterprint', () => document.documentElement.classList.remove('pc'));
    // Link-Prüfung lokal gegen AIRBNB_DOMAINS (shared/core.js), nichts wird gesendet
    const D = 'de com at ch co.uk fr es it nl pt pl be dk se no fi ie gr cz com.au ca co.nz mx com.br'.split(' ').map(t => 'airbnb.' + t), lc = $('#lc-out');
    $('#lc-in').addEventListener('input', e => {
      const v = e.target.value.trim(); let h = '';
      try { h = new URL(/^[a-z][\w+.-]*:\/\//i.test(v) ? v : 'https://' + v).hostname; } catch {}
      const ok = D.some(d => h === d || h.endsWith('.' + d));
      lc.textContent = !v ? '' : !h.includes('.') ? T.lcBad : ok ? T.lcOk(h) : T.lcWarn(h); lc.className = ok ? 'ok' : 'warn';
    });
    // Teilen: Menü des Geräts, sonst Link kopieren
    $('#share').addEventListener('click', async () => {
      const url = $('link[rel=canonical]').href;
      try { if (navigator.share) return await navigator.share({ title: document.title, url }); await navigator.clipboard.writeText(url); $('#share-out').textContent = T.linkCopied; }
      catch (e) { if (e?.name !== 'AbortError') $('#share-out').textContent = url; }
    });
  }

  // FAQ-Fragen sind verlinkbar: passender Anker öffnet die Frage
  (() => {
    const open = () => { const d = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1))); if (d && d.tagName === 'DETAILS') d.open = true; };
    open(); addEventListener('hashchange', open);
  })();

  // Sprachhinweis: dezent, keine Umleitung. DE-Seite für nicht-deutsche Browser, EN-Seite für deutsche.
  (() => {
    const de = /^de\b/i.test(navigator.language || '');
    if (de !== (document.documentElement.lang === 'de')) $$('.langhint').forEach(h => { h.hidden = false; });
  })();

  // Navigation: aktiven Abschnitt markieren; Balken füllen sich beim Scrollen; Sprachumschalter behält den Abschnitt
  let section = '';
  $$('a.lang').forEach(a => a.addEventListener('click', () => {
    const id = location.hash.slice(1) || section;
    if (id && id !== 'top') a.href = a.getAttribute('href').split('#')[0] + '#' + id;
  }));
  (() => {
    if (!('IntersectionObserver' in window)) { $$('.bars').forEach(b => b.classList.add('in')); return; }
    const links = new Map($$('.links a[href^="#"]').map(a => [a.getAttribute('href').slice(1), a]));
    const spy = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return;
      section = e.target.id;
      links.forEach(a => { a.classList.remove('on'); a.removeAttribute('aria-current'); });
      const a = links.get(e.target.id); if (a) { a.classList.add('on'); a.setAttribute('aria-current', 'location'); }
    }), { rootMargin: '-45% 0px -50% 0px' });
    $$('main [id]').forEach(s => { if (s.tagName === 'SECTION' || s.tagName === 'HEADER') spy.observe(s); });
    const bars = $$('.bars');
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { bars.forEach(b => b.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .35 });
    bars.forEach(b => io.observe(b));
  })();
