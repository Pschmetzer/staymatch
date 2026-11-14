// StayMatch – kleiner Service Worker: (1) Zahl am Toolbar-Symbol, (2) Erinnerung vor Ablauf der kostenlosen Stornierung (Opt-in).
// Lokal, keine Anfragen. Benachrichtigungen nur mit der optionalen Berechtigung „notifications“, die du in den Optionen erteilst.
importScripts('i18n.js', 'strings.js', 'badge.js', 'reminders.js');
const I18n = self.StayMatchI18n;
async function refresh() {
  try {
    const st = await chrome.storage.local.get(['lastSearch', 'settings']);
    I18n.setLang(st.settings?.lang); // Sprache aus den Optionen, sonst Browsersprache
    const b = self.StayMatchBadge.badgeState(st);
    await chrome.action.setBadgeText({ text: b.text });
    await chrome.action.setBadgeBackgroundColor({ color: '#e0475b' });
    await chrome.action.setTitle({ title: b.title });
  } catch {}
}
// Wecker abgleichen: nur für gebuchte Unterkünfte mit kostenloser Stornierung, nur wenn die Erinnerung eingeschaltet ist
async function syncAlarms() {
  try {
    const R = self.StayMatchReminders, all = await chrome.storage.local.get(null);
    const on = all.settings?.remind === true;
    const want = on ? R.plan(Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('l:'))), Date.now(), all.remindDone) : [];
    const have = await chrome.alarms.getAll();
    const keep = new Set(want.map(w => R.alarmName(w.id)));
    for (const a of have) if (R.idOfAlarm(a.name) && !keep.has(a.name)) await chrome.alarms.clear(a.name);
    for (const w of want) if (!have.some(a => a.name === R.alarmName(w.id) && Math.abs(a.scheduledTime - w.when) < 1000)) await chrome.alarms.create(R.alarmName(w.id), { when: w.when });
  } catch {}
}
// „alarms“ und „notifications“ sind optional (Optionen → Erinnerung). Der Hörer wird gesetzt, sobald die Berechtigung da ist.
let alarmHooked = false;
function hookAlarms() {
  if (alarmHooked || !chrome.alarms?.onAlarm) return;
  alarmHooked = true;
  chrome.alarms.onAlarm.addListener(onAlarm);
}
async function onAlarm(al) {
  try {
    const R = self.StayMatchReminders, id = R.idOfAlarm(al.name);
    if (!id) return;
    if (!(await chrome.permissions.contains({ permissions: ['notifications'] }))) return;
    const st = await chrome.storage.local.get(['l:' + id, 'remindDone', 'settings']);
    I18n.setLang(st.settings?.lang);
    const p = st['l:' + id] && R.plan({ [id]: st['l:' + id] }, Date.now(), st.remindDone)[0];
    if (!p) return;
    // Merken, damit der Wecker für diese Frist nicht neu angelegt wird (Chrome löscht ihn nach dem Klingeln, die Frist läuft aber noch)
    const today = new Date().toISOString().slice(0, 10);
    const done = Object.fromEntries(Object.entries(st.remindDone || {}).filter(([, d]) => d >= today));
    await chrome.storage.local.set({ remindDone: { ...done, [id]: p.day } });
    chrome.notifications.create('sm-cancel-' + id, { type: 'basic', iconUrl: 'icons/128.png', title: I18n.t('rem.title'), message: I18n.t('rem.body', { title: p.title, date: R.fmtDay(p.day) }) });
  } catch {}
}
hookAlarms();
chrome.permissions?.onAdded?.addListener(() => { hookAlarms(); syncAlarms(); });
chrome.permissions?.onRemoved?.addListener(() => { try { chrome.alarms?.clearAll?.(); } catch {} });
// Druckseite der Top 3 öffnen (das Panel auf Airbnb darf keine Erweiterungsseite öffnen)
chrome.runtime.onMessage?.addListener((msg, sender) => {
  if (msg && msg.type === 'sm-print' && sender.id === chrome.runtime.id) chrome.tabs.create({ url: chrome.runtime.getURL('print.html') });
});
chrome.storage.onChanged.addListener(ch => {
  if (ch.lastSearch || ch.settings) refresh();
  if (ch.settings || Object.keys(ch).some(k => k.startsWith('l:'))) syncAlarms();
});
chrome.runtime.onStartup.addListener(() => { refresh(); syncAlarms(); });
chrome.runtime.onInstalled.addListener(() => { refresh(); syncAlarms(); });
refresh(); syncAlarms();
