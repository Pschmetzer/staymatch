// StayMatch – kleiner Service Worker: (1) Zahl am Toolbar-Symbol, (2) Erinnerung vor Ablauf der kostenlosen Stornierung (Opt-in).
// Lokal, keine Anfragen. Benachrichtigungen nur mit der optionalen Berechtigung „notifications“, die du in den Optionen erteilst.
importScripts('badge.js', 'reminders.js');
async function refresh() {
  try {
    const st = await chrome.storage.local.get(['lastSearch', 'settings']);
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
    const want = on ? R.plan(Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('l:')))) : [];
    const have = await chrome.alarms.getAll();
    const keep = new Set(want.map(w => R.alarmName(w.id)));
    for (const a of have) if (R.idOfAlarm(a.name) && !keep.has(a.name)) await chrome.alarms.clear(a.name);
    for (const w of want) if (!have.some(a => a.name === R.alarmName(w.id) && Math.abs(a.scheduledTime - w.when) < 1000)) await chrome.alarms.create(R.alarmName(w.id), { when: w.when });
  } catch {}
}
chrome.alarms?.onAlarm.addListener(async al => {
  try {
    const R = self.StayMatchReminders, id = R.idOfAlarm(al.name);
    if (!id) return;
    if (!(await chrome.permissions.contains({ permissions: ['notifications'] }))) return;
    const { ['l:' + id]: l } = await chrome.storage.local.get('l:' + id);
    const p = l && R.plan({ [id]: l })[0];
    if (!p) return;
    chrome.notifications.create('sm-cancel-' + id, { type: 'basic', iconUrl: 'icons/128.png', title: 'Kostenlose Stornierung endet bald', message: `${p.title}: bis ${p.day.split('-').reverse().join('.')} kostenlos stornierbar.` });
  } catch {}
});
chrome.storage.onChanged.addListener(ch => {
  if (ch.lastSearch || ch.settings) refresh();
  if (ch.settings || Object.keys(ch).some(k => k.startsWith('l:'))) syncAlarms();
});
chrome.runtime.onStartup.addListener(() => { refresh(); syncAlarms(); });
chrome.runtime.onInstalled.addListener(() => { refresh(); syncAlarms(); });
refresh(); syncAlarms();
