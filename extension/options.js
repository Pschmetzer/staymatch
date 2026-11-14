// StayMatch – Optionen (eigener Tab): Panel-Position, Import, Export, Löschen. Alles lokal, keine Anfragen.
// Manifest: "options_ui": { "page": "options.html", "open_in_tab": true }
const { AIRBNB_DOMAINS } = window.StayMatchCore, I = window.StayMatchImport;
const host = u => { try { return new URL(String(u || '')); } catch { return null; } };
const roomOk = u => { const x = host(u); return !!x && x.protocol === 'https:' && AIRBNB_DOMAINS.some(d => x.hostname === d || x.hostname === 'www.' + d) && x.pathname.startsWith('/rooms/'); };
const cdnOk = u => { const x = host(u); return !!x && x.protocol === 'https:' && (x.hostname === 'muscache.com' || x.hostname.endsWith('.muscache.com')); };
const $ = id => document.getElementById(id);
const I18n = window.StayMatchI18n;
const t = (k, v) => I18n.t(k, v);
// Sprache aus den Einstellungen ('auto' = Browser), statische Texte per data-i18n
function applyLang(l) { I18n.setLang(l); I18n.apply(document); document.documentElement.lang = I18n.lang(); }
const langReady = chrome.storage.local.get('settings').then(r => { applyLang(r.settings?.lang); $('lang').value = ['de', 'en'].includes(r.settings?.lang) ? r.settings.lang : 'auto'; }).catch(() => {});
const out = $('out');

// Einstellungen nacheinander schreiben, direkt vor dem Schreiben frisch lesen
let q = Promise.resolve();
const setSetting = patch => (q = q.then(async () => {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const next = { ...I.migrateSettings(settings), ...patch };
  for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
  await chrome.storage.local.set({ settings: next });
}));

chrome.storage.local.get('settings').then(r => { $('badge').checked = r.settings?.badge !== false; $('remind').checked = r.settings?.remind === true; $('side').value = r.settings?.panelSide === 'left' ? 'left' : 'right'; });
$('side').onchange = async e => { await setSetting({ panelSide: e.target.value === 'left' ? 'left' : undefined, panelPos: undefined }); $('panelInfo').textContent = t('opts.saved'); };
$('resetPos').onclick = async () => { await setSetting({ panelPos: undefined, panelSide: undefined }); $('side').value = 'right'; $('panelInfo').textContent = t('opts.posReset'); };

$('badge').onchange = e => setSetting({ badge: e.target.checked ? undefined : false });
$('lang').onchange = async e => {
  const v = e.target.value;
  await setSetting({ lang: v === 'de' || v === 'en' ? v : undefined });
  applyLang(v);
  for (const id of ['panelInfo', 'remInfo', 'wipeOut', 'out']) $(id).textContent = '';
};
$('file').onchange = async e => {
  try {
    const parsed = I.parseImport(await I.readFileText(e.target.files[0]), { isRoomUrl: roomOk, isCdnImage: cdnOk });
    const { entries, skipped } = parsed;
    const r = await I.applyImport(chrome.storage.local, entries);
    await I.applyExtras(chrome.storage.local, parsed);
    out.textContent = t('opts.imported', { n: entries.length, skipped, added: r.added, merged: r.merged });
  } catch (err) { out.textContent = err?.message || t('opts.readFail'); }
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
  $('wipeOut').textContent = withPrivate ? t('opts.backupDone') : t('opts.cleanDone');
}
$('exportFull').onclick = () => exportJson(true);
$('exportClean').onclick = () => exportJson(false);

$('wipe').onclick = async () => {
  const k = $('wipeKind').value;
  const pick = { verlauf: I.WIPE.verlauf, zwischenspeicher: I.WIPE.zwischenspeicher, reise: I.WIPE.reise, alles: x => x !== 'settings' }[k];
  const del = Object.keys(await chrome.storage.local.get(null)).filter(pick);
  if (!del.length) { $('wipeOut').textContent = t('opts.nothing'); return; }
  if (!confirm(t('opts.confirm', { n: del.length, kind: t('opts.kind.' + k) }))) return;
  await chrome.storage.local.remove(del);
  $('wipeOut').textContent = t('opts.deleted', { n: del.length });
};

// Erinnerung (Opt-in): Berechtigung „notifications“ erst jetzt anfragen, beim Klick
$('remind').onchange = async e => {
  const on = e.target.checked;
  if (on) {
    let ok = false;
    try { ok = await chrome.permissions.request({ permissions: ['alarms', 'notifications'] }); } catch {}
    if (!ok) { e.target.checked = false; $('remInfo').textContent = t('opts.rem.denied'); return; }
  }
  await setSetting({ remind: on ? true : undefined });
  $('remInfo').textContent = on ? t('opts.rem.on') : t('opts.rem.off');
};
$('icsBtn').onclick = async () => {
  const { listings } = await readAll();
  const text = window.StayMatchReminders.ics(listings);
  if (!text) { $('remInfo').textContent = t('opts.ics.none'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' })); a.download = 'staymatch-etappen.ics'; a.click();
  $('remInfo').textContent = t('opts.ics.saved');
};

// Erinnerung steht auf „an“, aber die Erlaubnis fehlt (z. B. nach dem Update, nach Entzug in Chrome): Schalter ehrlich zurücksetzen
langReady.then(() => chrome.permissions?.contains?.({ permissions: ['alarms', 'notifications'] })).then(async ok => {
  if (ok !== false || !$('remind').checked) return;
  $('remind').checked = false; await setSetting({ remind: undefined });
  $('remInfo').textContent = t('opts.rem.missing');
}).catch(() => {});
