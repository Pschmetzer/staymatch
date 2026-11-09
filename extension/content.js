// Liest nur Seiten, die du selbst öffnest. Speichert lokal (chrome.storage.local). Fehlt ein Feld, wird es übersprungen.
(() => {
  const id = (location.pathname.match(/\/rooms\/(\d+)/) || [])[1];
  if (!id) return;

  const REVIEW_HINTS = {
    '👍 sauber': /sauber|clean|spotless/i, '👍 Lage': /tolle lage|great location|zentral|central/i,
    '👍 Gastgeber': /gastgeber.*(nett|freundlich|hilfsbereit)|host was (great|helpful|friendly)/i,
    '⚠️ laut': /\b(laut|lärm|noisy|noise)\b/i, '⚠️ schmutzig': /\b(schmutzig|dreckig|dirty|unclean)\b/i,
    '⚠️ Bett': /unbequem|uncomfortable|bett.*hart/i, '⚠️ WLAN': /wlan.*(schlecht|langsam)|wifi.*(bad|slow|poor)/i,
  };

  function jsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { const j = JSON.parse(s.textContent); const arr = Array.isArray(j) ? j : [j]; for (const x of arr) if (x.aggregateRating || x.name) return x; } catch {}
    }
    return {};
  }
  const meta = n => document.querySelector(`meta[property="${n}"],meta[name="${n}"]`)?.content;

  function extract() {
    const ld = jsonLd();
    const params = new URLSearchParams(location.search);
    const bodyText = document.body.innerText;
    const price = (bodyText.match(/(\d[\d.]*)\s?€\s?(?:pro Nacht|Nacht|night)/i) || bodyText.match(/€\s?(\d[\d.,]*)\s?(?:night|Nacht)/i) || [])[1];
    const reviews = [...document.querySelectorAll('[data-review-id], [data-testid*="review"]')].map(e => e.innerText).join(' '); // nur echte Rezensionen, sonst keine Stichworte
    const hints = !reviews ? [] : Object.entries(REVIEW_HINTS).filter(([, re]) => re.test(reviews)).map(([k]) => k);
    return {
      id, url: location.origin + location.pathname,
      title: ld.name || meta('og:title') || document.title,
      image: meta('og:image'),
      rating: ld.aggregateRating?.ratingValue ? +ld.aggregateRating.ratingValue : null,
      reviewCount: ld.aggregateRating?.ratingCount || ld.aggregateRating?.reviewCount || null,
      lat: ld.geo?.latitude ?? null, lon: ld.geo?.longitude ?? null,
      locality: ld.address?.addressLocality || null,
      pricePerNight: price ? +price.replace(/\./g, '') : null,
      checkin: params.get('check_in') || params.get('checkin'), checkout: params.get('check_out') || params.get('checkout'),
      hints,
    };
  }

  async function save(patch) {
    const { listings = {} } = await chrome.storage.local.get('listings');
    const old = listings[id] || { firstSeen: Date.now(), visits: 0 };
    listings[id] = { ...old, ...patch, lastSeen: Date.now() };
    await chrome.storage.local.set({ listings });
    return listings[id];
  }

  function overlay(item) {
    document.getElementById('staymatch-box')?.remove();
    const box = document.createElement('div');
    box.id = 'staymatch-box';
    box.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:2147483647;background:#fff;color:#1d1d1f;border:1px solid #ddd;border-radius:12px;padding:12px 14px;font:13px system-ui;box-shadow:0 6px 24px rgba(0,0,0,.15);max-width:280px';
    const seen = item.visits > 1 ? `Schon ${item.visits}× angesehen` : 'Zum ersten Mal hier';
    box.innerHTML = `<b>StayMatch</b> <span style="color:#888">· ${seen}</span>
      <div style="margin:6px 0">${item.rating ? `⭐ ${item.rating}${item.reviewCount ? ` (${item.reviewCount})` : ''}` : ''} ${item.hints.join(' · ')}</div>
      <div style="display:flex;gap:6px;margin:6px 0">
        <button data-v="1" style="flex:1;padding:6px;border-radius:8px;border:1px solid #ccc;background:${item.vote === 1 ? '#d7f5e6' : '#fff'};cursor:pointer">👍 Gefällt mir</button>
        <button data-v="-1" style="flex:1;padding:6px;border-radius:8px;border:1px solid #ccc;background:${item.vote === -1 ? '#fde2e2' : '#fff'};cursor:pointer">👎 Nein</button>
      </div>
      <textarea placeholder="Notiz: was gefällt / stört?" style="width:100%;box-sizing:border-box;height:46px;border:1px solid #ccc;border-radius:8px;padding:4px;font:12px system-ui">${item.note || ''}</textarea>
      <a style="font-size:12px;color:#888;cursor:pointer" id="staymatch-x">schließen</a>`;
    box.querySelectorAll('button').forEach(b => b.onclick = async () => overlay(await save({ vote: +b.dataset.v })));
    box.querySelector('textarea').onchange = e => save({ note: e.target.value });
    box.querySelector('#staymatch-x').onclick = () => box.remove();
    document.body.appendChild(box);
  }

  // Airbnb lädt Inhalte nach – kurz warten, dann einmal speichern
  setTimeout(async () => {
    try {
      const { listings = {} } = await chrome.storage.local.get('listings');
      const item = await save({ ...extract(), visits: (listings[id]?.visits || 0) + 1 });
      overlay(item);
    } catch (e) { console.debug('StayMatch:', e); }
  }, 2500);
})();
