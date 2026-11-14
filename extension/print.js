// StayMatch – druckbare Top 3. Liest nur den lokal gespeicherten Stand (printTop) und zeigt ihn als Text; keine Anfragen, kein HTML aus fremden Texten.
(() => {
  const $ = id => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v); for (const k of kids.flat()) if (k != null) e.append(k instanceof Node ? k : String(k)); return e; };
  const safeUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' ? x.href : null; } catch { return null; } };
  function render(p) {
    const list = $('list');
    list.replaceChildren();
    if (!p || !Array.isArray(p.items) || !p.items.length) { $('meta').textContent = 'Keine Top 3 gespeichert. Öffne auf Airbnb eine Suche und klicke im StayMatch-Panel auf „Top 3 drucken“.'; return; }
    $('meta').textContent = [new Date(p.at).toLocaleDateString('de-DE'), p.people ? `${p.people} ${p.people === 1 ? 'Person' : 'Personen'}` : null, p.nights ? `${p.nights} Nächte` : null, p.count ? `${p.count} Unterkünfte bewertet` : null].filter(Boolean).join(' · ');
    for (const it of p.items.slice(0, 3)) {
      const url = safeUrl(it.url);
      list.append(el('article', {},
        el('h2', {}, el('span', { class: 'rank' }, it.rank), it.title || 'Unterkunft', el('span', { class: 'score' }, `${it.score}/100`)),
        el('div', { class: 'muted' }, [it.kind, it.locality, it.rating != null ? `★ ${String(it.rating).replace('.', ',')}${it.reviewCount ? ` (${it.reviewCount})` : ''}` : null, it.price].filter(Boolean).join(' · ')),
        (it.why || []).length || (it.warn || []).length ? el('ul', {}, (it.why || []).map(w => el('li', {}, w)), (it.warn || []).map(w => el('li', { class: 'warn' }, '⚠ ' + w))) : null,
        url ? el('div', { class: 'muted' }, el('a', { href: url, rel: 'noopener' }, url)) : null));
    }
  }
  $('printBtn').onclick = () => window.print();
  chrome.storage.local.get('printTop').then(r => render(r.printTop)).catch(() => render(null));
})();
