// StayMatch – Erinnerung vor Ablauf der kostenlosen Stornierung und Kalender-Export (.ics). Reine Funktionen, kein chrome.*.
// Genutzt vom Service Worker (background.js), der Optionen-Seite und dem Popup. Alles lokal.
(function (root) {
  const MONTHS = {
    jan: 1, januar: 1, january: 1, janvier: 1, enero: 1, gennaio: 1, feb: 2, februar: 2, february: 2, février: 2, fevrier: 2, febrero: 2, febbraio: 2,
    mär: 3, mar: 3, märz: 3, maerz: 3, march: 3, mars: 3, marzo: 3, apr: 4, april: 4, avril: 4, abril: 4, aprile: 4,
    mai: 5, may: 5, mayo: 5, maggio: 5, jun: 6, juni: 6, june: 6, juin: 6, junio: 6, giugno: 6, jul: 7, juli: 7, july: 7, juillet: 7, julio: 7, luglio: 7,
    aug: 8, august: 8, août: 8, aout: 8, agosto: 8, sep: 9, sept: 9, september: 9, septembre: 9, septiembre: 9, settembre: 9,
    okt: 10, oct: 10, oktober: 10, october: 10, octobre: 10, octubre: 10, ottobre: 10, nov: 11, november: 11, novembre: 11, noviembre: 11,
    dez: 12, dec: 12, dezember: 12, december: 12, décembre: 12, decembre: 12, diciembre: 12, dicembre: 12,
  };
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const valid = (y, m, d) => { const t = new Date(y, m - 1, d); return t.getFullYear() === y && t.getMonth() === m - 1 && t.getDate() === d; };
  const DAY = /^\d{4}-\d{2}-\d{2}$/;

  // „5. Dezember“, „Dec 5“, „05.12.“, „5/12/2026“ → „YYYY-MM-DD“. Ohne Jahr: das Jahr der Anreise, liegt der Tag danach, das Vorjahr.
  function parseCancelDate(text, { checkin, at } = {}) {
    const t = String(text || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!t || t === 'ja') return null;
    let d, m, y;
    let r = t.match(/^(\d{1,2})[./](\d{1,2})(?:[./]\s?(\d{2,4}))?\.?$/);
    if (r) { d = +r[1]; m = +r[2]; y = r[3] ? +r[3] : null; if (y && y < 100) y += 2000; }
    else if ((r = t.match(/^(\d{1,2})\.? ([a-zäéûô]+)\.?(?: (\d{4}))?$/))) { d = +r[1]; m = MONTHS[r[2]]; y = r[3] ? +r[3] : null; }
    else if ((r = t.match(/^([a-zäéûô]+)\.? (\d{1,2})(?:, ?(\d{4}))?$/))) { m = MONTHS[r[1]]; d = +r[2]; y = r[3] ? +r[3] : null; }
    if (!m || !d) return null;
    if (y) return valid(y, m, d) ? iso(y, m, d) : null;
    const ref = DAY.test(checkin || '') ? new Date(checkin + 'T12:00:00') : new Date(at || Date.now());
    let cand = ref.getFullYear();
    if (valid(cand, m, d) && new Date(cand, m - 1, d) > ref) cand -= 1;
    if (!DAY.test(checkin || '') && at) { // ohne Anreise: nächstes Vorkommen nach der Buchung
      cand = new Date(at).getFullYear();
      if (valid(cand, m, d) && new Date(cand, m - 1, d) < new Date(at) - 864e5) cand += 1;
    }
    return valid(cand, m, d) ? iso(cand, m, d) : null;
  }

  // Gebuchte Unterkünfte mit kostenloser Stornierung und gültiger Frist → Erinnerungen. Zeitpunkt: am Vortag 9 Uhr, sonst sofort (Frist noch nicht vorbei).
  function plan(listings, now = Date.now()) {
    const out = [];
    for (const i of Object.values(listings || {})) {
      const b = i?.booked;
      if (!b || !b.cancel) continue;
      const day = parseCancelDate(b.cancel, { checkin: b.checkin, at: b.at });
      if (!day) continue;
      const [y, m, d] = day.split('-').map(Number);
      const deadlineEnd = new Date(y, m - 1, d, 23, 59).getTime();
      if (deadlineEnd < now) continue; // schon vorbei
      const eve9 = new Date(y, m - 1, d - 1, 9, 0).getTime();
      out.push({ id: String(i.id), title: i.title || 'Unterkunft', day, when: eve9 > now ? eve9 : now + 60e3 });
    }
    return out.sort((a, b) => a.when - b.when);
  }
  const alarmName = id => 'sm-cancel:' + id;
  const idOfAlarm = n => String(n || '').startsWith('sm-cancel:') ? String(n).slice(10) : null;

  // ---------- Kalender (RFC 5545) ----------
  const esc = s => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  function fold(line) { // 75 Oktette je Zeile, Fortsetzung mit Leerzeichen; Mehrbyte-Zeichen nicht zerschneiden
    const enc = new TextEncoder(); let out = '', cur = '', len = 0, first = true;
    for (const ch of Array.from(line)) {
      const n = enc.encode(ch).length, max = first ? 75 : 74;
      if (len + n > max) { out += cur + '\r\n '; cur = ''; len = 0; first = false; }
      cur += ch; len += n;
    }
    return out + cur;
  }
  const compact = day => day.replace(/-/g, '');
  const plusDay = day => { const [y, m, d] = day.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d + 1)); return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}`; };
  const stamp = ms => { const t = new Date(ms); return `${t.getUTCFullYear()}${pad(t.getUTCMonth() + 1)}${pad(t.getUTCDate())}T${pad(t.getUTCHours())}${pad(t.getUTCMinutes())}${pad(t.getUTCSeconds())}Z`; };
  function ics(listings, now = Date.now()) {
    const ev = [];
    for (const i of Object.values(listings || {})) {
      const b = i?.booked;
      if (!b || !DAY.test(b.checkin || '')) continue;
      const out = DAY.test(b.checkout || '') && b.checkout > b.checkin ? compact(b.checkout) : plusDay(b.checkin);
      const desc = [i.url, b.people && `${b.people} Personen`, b.total && `${Math.round(b.total)} ${b.currency || ''}`.trim(), i.note].filter(Boolean).join('\n');
      ev.push(['BEGIN:VEVENT', `UID:staymatch-${i.id}@staymatch.pro`, `DTSTAMP:${stamp(now)}`, `DTSTART;VALUE=DATE:${compact(b.checkin)}`, `DTEND;VALUE=DATE:${out}`,
        `SUMMARY:${esc(i.title || 'Unterkunft')}`, ...(i.locality ? [`LOCATION:${esc(i.locality)}`] : []), ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []), 'END:VEVENT']);
      const cd = b.cancel ? parseCancelDate(b.cancel, { checkin: b.checkin, at: b.at }) : null;
      if (cd) ev.push(['BEGIN:VEVENT', `UID:staymatch-${i.id}-storno@staymatch.pro`, `DTSTAMP:${stamp(now)}`, `DTSTART;VALUE=DATE:${compact(cd)}`, `DTEND;VALUE=DATE:${plusDay(cd)}`,
        `SUMMARY:${esc('Kostenlos stornieren bis heute: ' + (i.title || 'Unterkunft'))}`, 'END:VEVENT']);
    }
    if (!ev.length) return '';
    return [...['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//StayMatch//Etappen//DE', 'CALSCALE:GREGORIAN'], ...ev.flat(), 'END:VCALENDAR'].map(fold).join('\r\n') + '\r\n';
  }

  root.StayMatchReminders = { parseCancelDate, plan, alarmName, idOfAlarm, ics };
})(typeof window !== 'undefined' ? window : globalThis);
