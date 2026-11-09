const APP_URL = 'https://staymatch-tau.vercel.app';
document.getElementById('app').href = APP_URL;
let tab = 'all', listings = {};

function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

function profile(items) {
  const liked = items.filter(i => i.vote === 1);
  if (!liked.length) return 'Markiere Unterkünfte mit 👍, dann lernt StayMatch deinen Geschmack.';
  const p = avg(liked.map(i => i.pricePerNight).filter(Boolean)), r = avg(liked.map(i => i.rating).filter(Boolean));
  const hints = {}; liked.flatMap(i => i.hints || []).forEach(h => hints[h] = (hints[h] || 0) + 1);
  const top = Object.entries(hints).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => h);
  const places = [...new Set(liked.map(i => i.locality).filter(Boolean))].slice(0, 3);
  return `<b>Dein Geschmack</b> (aus ${liked.length} 👍): ` + [p && `≈ ${Math.round(p)} €/Nacht`, r && `⭐ ab ${r.toFixed(2)}`, top.length && top.join(', '), places.length && `Orte: ${places.join(', ')}`].filter(Boolean).join(' · ');
}

function render() {
  const items = Object.values(listings).sort((a, b) => b.lastSeen - a.lastSeen);
  document.getElementById('profile').innerHTML = profile(items);
  const shown = items.filter(i => tab === 'all' || (tab === 'liked' ? i.vote === 1 : i.vote === -1));
  document.getElementById('list').innerHTML = shown.length ? shown.map(i => `
    <a class="item" href="${esc(i.url)}" target="_blank">
      ${i.image ? `<img src="${esc(i.image)}" alt="">` : '<img alt="">'}
      <div><div>${i.vote === 1 ? '👍 ' : i.vote === -1 ? '👎 ' : ''}${esc(i.title)}</div>
      <div class="muted">${[i.rating && '⭐ ' + i.rating, i.pricePerNight && i.pricePerNight + ' €/Nacht', i.locality, (i.visits || 1) + '× angesehen', new Date(i.lastSeen).toLocaleDateString('de-DE')].filter(Boolean).map(esc).join(' · ')}</div>
      ${i.note ? `<div class="muted">📝 ${esc(i.note)}</div>` : ''}</div></a>`).join('')
    : '<div class="item muted">Noch nichts hier. Öffne eine Unterkunft auf Airbnb.</div>';
}

document.querySelectorAll('nav button').forEach(b => b.onclick = () => {
  document.querySelectorAll('nav button').forEach(x => x.classList.toggle('on', x === b)); tab = b.dataset.tab; render();
});
document.getElementById('export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(listings, null, 2)], { type: 'application/json' }));
  a.download = 'staymatch-verlauf.json'; a.click();
};
chrome.storage.local.get('listings').then(r => { listings = r.listings || {}; render(); });
