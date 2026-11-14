// StayMatch – Optionen (eigener Tab): Panel-Position, Import, Export, Löschen. Alles lokal, keine Anfragen.
// Manifest: "options_ui": { "page": "options.html", "open_in_tab": true }
const { AIRBNB_DOMAINS } = window.StayMatchCore, I = window.StayMatchImport;
const host = u => { try { return new URL(String(u || '')); } catch { return null; } };
const roomOk = u => { const x = host(u); return !!x && x.protocol === 'https:' && AIRBNB_DOMAINS.some(d => x.hostname === d || x.hostname === 'www.' + d) && x.pathname.startsWith('/rooms/'); };
const cdnOk = u => { const x = host(u); return !!x && x.protocol === 'https:' && (x.hostname === 'muscache.com' || x.hostname.endsWith('.muscache.com')); };
const $ = id => document.getElementById(id);
const out = $('out');

// Einstellungen nacheinander schreiben, direkt vor dem Schreiben frisch lesen
let q = Promise.resolve();
const setSetting = patch => (q = q.then(async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const next = { ...I.migrateSettings(settings), ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  await chrome.storage.local.set({ settings: next });
}));

chrome.storage.local.get('settings').then(r => { $('side').value = r.settings?.panelSide === 'left' ? 'left' : 'right'; });
$('side').onchange = async e => { await setSetting({ panelSide: e.target.value === 'left' ? 'left' : undefined, panelPos: undefined }); $('panelInfo').textContent = 'Gespeichert.'; };
$('resetPos').onclick = async () => { await setSetting({ panelPos: undefined, panelSide: undefined }); $('side').value = 'right'; $('panelInfo').textContent = 'Position zurückgesetzt.'; };

$('file').onchange = async e => {
  try {
    const parsed = I.parseImport(await e.target.files[0].text(), { isRoomUrl: roomOk, isCdnImage: cdnOk });
    const { entries, skipped } = parsed;
    const r = await I.applyImport(chrome.storage.local, entries);
    await I.applyExtras(chrome.storage.local, parsed);
    out.textContent = `${entries.length} übernommen, ${skipped} übersprungen (${r.added} neu, ${r.merged} mit vorhandenen zusammengeführt).`;
  } catch (err) { out.textContent = err?.message || 'Datei konnte nicht gelesen werden.'; }
  e.target.value = '';
};

async function readAll() {
  const all = await chrome.storage.local.get(null);
  const listings = Object.fromEntries(Object.entries(all).filter(([k, v]) => k.startsWith('l:') && v && v.id).map(([, v]) => [v.id, I.migrateListing(v)]));
  return { all, listings };
}
async function exportJson(withPrivate) {
  const { all, listings } = await readAll();
  const body = { format: I.FORMAT, version: I.EXPORT_VERSION, exportedAt: new Date().toISOString(), listings: withPrivate ? listings : I.sanitizeListings(listings), trip: withPrivate ? all.trip || null : I.sanitizeTrip(all.trip || null), ...(withPrivate ? { friendLikes: all.friendLikes || {} } : {}) };
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' })); a.download = 'staymatch.json'; a.click();
  if (withPrivate) await setSetting({ lastBackup: Date.now() });
  $('wipeOut').textContent = withPrivate ? 'Sicherung gespeichert.' : 'Bereinigte Datei gespeichert (ohne Notizen, Reisedaten, Buchungen).';
}
$('exportFull').onclick = () => exportJson(true);
$('exportClean').onclick = () => exportJson(false);

$('wipe').onclick = async () => {
  const k = $('wipeKind').value;
  const pick = { verlauf: I.WIPE.verlauf, zwischenspeicher: I.WIPE.zwischenspeicher, reise: I.WIPE.reise, alles: x => x !== 'settings' }[k];
  const del = Object.keys(await chrome.storage.local.get(null)).filter(pick);
  if (!del.length) { $('wipeOut').textContent = 'Nichts zu löschen.'; return; }
  if (!confirm(`${del.length} Einträge löschen (${k})? Das lässt sich nicht rückgängig machen. Tipp: vorher „Alles sichern“.`)) return;
  await chrome.storage.local.remove(del);
  $('wipeOut').textContent = `${del.length} Einträge gelöscht.`;
};
