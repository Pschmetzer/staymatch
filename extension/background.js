// StayMatch – kleiner Service Worker: setzt nur die Zahl am Toolbar-Symbol. Lokal, keine Anfragen, keine eigene Berechtigung (chrome.action).
importScripts('badge.js');
async function refresh() {
  try {
    const st = await chrome.storage.local.get(['lastSearch', 'settings']);
    const b = self.StayMatchBadge.badgeState(st);
    await chrome.action.setBadgeText({ text: b.text });
    await chrome.action.setBadgeBackgroundColor({ color: '#e0475b' });
    await chrome.action.setTitle({ title: b.title });
  } catch {}
}
chrome.storage.onChanged.addListener(ch => { if (ch.lastSearch || ch.settings) refresh(); });
chrome.runtime.onStartup.addListener(refresh);
chrome.runtime.onInstalled.addListener(refresh);
refresh();
