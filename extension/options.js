// StayMatch – Import-Seite (eigener Tab, weil Chrome das Popup beim Dateidialog oft schließt).
// Einbindung im Manifest (optional, für „Optionen“ unter chrome://extensions): "options_ui": { "page": "options.html", "open_in_tab": true }
const { AIRBNB_DOMAINS } = window.StayMatchCore, I = window.StayMatchImport;
const host = u => { try { return new URL(String(u || '')); } catch { return null; } };
const roomOk = u => { const x = host(u); return !!x && x.protocol === 'https:' && AIRBNB_DOMAINS.some(d => x.hostname === d || x.hostname === 'www.' + d) && x.pathname.startsWith('/rooms/'); };
const cdnOk = u => { const x = host(u); return !!x && x.protocol === 'https:' && (x.hostname === 'muscache.com' || x.hostname.endsWith('.muscache.com')); };
const out = document.getElementById('out');
document.getElementById('file').onchange = async e => {
  try {
    const { entries, skipped } = I.parseImport(await e.target.files[0].text(), { isRoomUrl: roomOk, isCdnImage: cdnOk });
    const r = await I.applyImport(chrome.storage.local, entries);
    out.textContent = `${entries.length} übernommen, ${skipped} übersprungen (${r.added} neu, ${r.merged} mit vorhandenen zusammengeführt).`;
  } catch (err) { out.textContent = err?.message || 'Datei konnte nicht gelesen werden.'; }
  e.target.value = '';
};
