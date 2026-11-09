// StayMatch Viertel-Finder – Reise per Link teilen (alles steht im Teil nach #, wird nie an einen Server geschickt)
const b64 = {
  enc: o => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: s => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))),
};
function shareState() {
  return { c: $('city').value.trim(), i: $('checkin').value, o: $('checkout').value, b: +$('budget').value || 0, p: people.map(p => [p.name, p.type]) };
}
function applyShared(h) {
  try {
    const s = b64.dec(h);
    const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';
    const day = v => /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : '';
    if (!Array.isArray(s.p) || !s.p.length || s.p.length > 30) return false;
    people = s.p.map(([n, t]) => ({ name: str(n, 40) || 'Person', type: SM.PRESETS[t] ? t : 'chill' }));
    $('city').value = str(s.c, 80);
    if (day(s.i)) $('checkin').value = s.i;
    if (day(s.o)) $('checkout').value = s.o;
    $('budget').value = Math.max(0, Math.min(1e6, +s.b || 0));
    save(); renderPeople(); updateBudget();
    return true;
  } catch { return false; }
}
$('share').onclick = async () => {
  const url = location.origin + location.pathname + '#t=' + b64.enc(shareState());
  try { await navigator.clipboard.writeText(url); $('shareMsg').textContent = '✅ Link kopiert. Schick ihn in den Gruppenchat.'; }
  catch { $('shareMsg').textContent = 'Kopieren nicht möglich. Kopiere den Link aus der Adresszeile.'; }
  history.replaceState(null, '', url);
};
if (location.hash.startsWith('#t=')) {
  if (applyShared(location.hash.slice(3))) { $('status').textContent = 'Reise aus dem Link geladen. Trag dich ein oder starte die Suche.'; }
  else { $('status').textContent = 'Der Link ist beschädigt oder zu alt.'; }
}
