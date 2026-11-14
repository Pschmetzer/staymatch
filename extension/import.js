// StayMatch – Import, Merge, Teilen-Export und Schema-Migration (reine Funktionen, kein chrome.*).
// Genutzt von popup.js und options.js. Die Schemaversion steht auch in content-common.js (dort als Kopie, weil Content-Skripte diese Datei nicht laden).
(function (root) {
  const SCHEMA = 2;
  const FORMAT = 'staymatch-merkliste', EXPORT_VERSION = 1;
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  // Grenzen für Importdateien (Schutz vor riesigen oder bösartigen Dateien)
  const MAX_FILE_BYTES = 5 * 1024 * 1024, MAX_ENTRIES = 5000, MAX_STR = 5000, MAX_ARR = 200, MAX_KEYS = 200, MAX_DEPTH = 6;
  const BAD_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
  // Fremde Daten auf reines JSON-Gut zurechtstutzen: keine Prototyp-Schlüssel, begrenzte Tiefe, Länge und Anzahl. Liefert undefined, wenn nichts übrig bleibt.
  function sanitizeDeep(v, depth = 0) {
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
    if (typeof v === 'string') return v.slice(0, MAX_STR);
    if (depth >= MAX_DEPTH) return undefined;
    if (Array.isArray(v)) return v.slice(0, MAX_ARR).map(x => sanitizeDeep(x, depth + 1)).filter(x => x !== undefined);
    if (isObj(v)) {
      const o = {};
      for (const k of Object.keys(v).slice(0, MAX_KEYS)) { if (BAD_KEYS.has(k)) continue; const x = sanitizeDeep(v[k], depth + 1); if (x !== undefined) o[k] = x; }
      return o;
    }
    return undefined;
  }
  // Datei vor dem Lesen auf Größe prüfen (File.size), dann Text liefern
  async function readFileText(file) {
    if (!file) throw new Error('Keine Datei gewählt.');
    if (file.size > MAX_FILE_BYTES) throw new Error(`Datei ist zu groß (über ${MAX_FILE_BYTES / 1048576} MB). Eine StayMatch-Sicherung ist deutlich kleiner.`);
    return file.text();
  }
  // Speicher voll? Chrome meldet „QUOTA_BYTES quota exceeded“ bzw. QuotaExceededError
  const isQuotaError = e => /quota/i.test(String(e?.message || '') + ' ' + String(e?.name || '') + ' ' + (typeof e === 'string' ? e : ''));
  const QUOTA_MSG = 'Der Speicher der Erweiterung ist voll. Lösche im Popup alte Einträge („Löschen…“) und versuche es erneut.';
  async function safeSet(local, obj) {
    try { await local.set(obj); } catch (e) { throw new Error(isQuotaError(e) ? QUOTA_MSG : 'Speichern fehlgeschlagen: ' + String(e?.message || e).slice(0, 120)); }
  }

  // Alte Einträge (ohne schema) auf den aktuellen Stand heben. Idempotent, verändert das Original nicht.
  // Etiketten („Plan A“): höchstens 5, je 1–20 Zeichen, nur Text, ohne Doppelte
  const cleanTags = t => Array.isArray(t) ? [...new Set(t.filter(x => typeof x === 'string').map(x => x.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20)).filter(Boolean))].slice(0, 5) : [];
  function migrateListing(v) {
    if (!isObj(v)) return v;
    if (v.tags != null) { const t = cleanTags(v.tags); v = t.length ? { ...v, tags: t } : (({ tags, ...r }) => r)(v); }
    if (v.schema >= SCHEMA) return v;
    const o = { ...v, schema: SCHEMA };
    o.visits = Number.isFinite(+o.visits) && +o.visits > 0 ? +o.visits : 1;
    if (o.priceHistory != null && !Array.isArray(o.priceHistory)) delete o.priceHistory;
    if (o.hints != null && !Array.isArray(o.hints)) delete o.hints;
    return o;
  }
  function migrateSettings(s) {
    const o = isObj(s) ? { ...s } : {};
    if (o.schema >= SCHEMA) return o;
    o.schema = SCHEMA;
    if (o.share != null && !isObj(o.share)) delete o.share;
    return o;
  }

  // Datei lesen und prüfen: Kennung und Version, nur gültige Einträge. Wirft Error mit deutscher Meldung.
  function parseImport(text, { isRoomUrl = () => true, isCdnImage = () => true } = {}) {
    let j;
    if (typeof text !== 'string' || text.length > MAX_FILE_BYTES) throw new Error('Datei ist zu groß oder kein Text.');
    try { j = JSON.parse(text); } catch { throw new Error('Datei ist kein gültiges JSON.'); }
    if (!isObj(j)) throw new Error('Datei hat nicht das StayMatch-Format.');
    if (j.format !== undefined && j.format !== FORMAT) throw new Error('Das ist keine StayMatch-Merkliste (Kennung „' + String(j.format).slice(0, 30) + '“).');
    if (j.version !== undefined && !(Number.isInteger(j.version) && j.version >= 1)) throw new Error('Ungültige Versionsnummer in der Datei.');
    if (j.version > EXPORT_VERSION) throw new Error(`Die Datei stammt aus einer neueren StayMatch-Version (${j.version}). Bitte das Plugin aktualisieren.`);
    const src = j.format ? j.listings : (j.listings || j); // ältere Dateien ohne Kennung: Objekt direkt mit Einträgen
    if (!isObj(src)) throw new Error('In der Datei fehlt die Liste der Unterkünfte.');
    const all = Object.values(src);
    if (all.length > MAX_ENTRIES) throw new Error(`Die Datei enthält zu viele Einträge (über ${MAX_ENTRIES}).`);
    const entries = all.filter(v => isObj(v) && /^\d{1,20}$/.test(String(v.id ?? '')))
      .map(v => migrateListing({ ...sanitizeDeep(v), id: String(v.id), image: isCdnImage(v.image) ? v.image : undefined, url: isRoomUrl(v.url) ? v.url : undefined }));
    return { entries, skipped: all.length - entries.length, friendLikes: isObj(j.friendLikes) ? sanitizeDeep(j.friendLikes) : null, trip: isObj(j.trip) ? sanitizeDeep(j.trip) : null };
  }

  // Zwei Stände derselben Unterkunft zusammenführen: der Eintrag mit neuerem lastSeen liefert die Felder,
  // Notiz, Stimme, Gebucht-Status fehlen dort? Dann zählt der andere. Besuche: Maximum, Preisverlauf: Vereinigung.
  function mergeListing(a, b) {
    if (!a) return b; if (!b) return a;
    const [old, cur] = (a.lastSeen || 0) > (b.lastSeen || 0) ? [b, a] : [a, b]; // cur = neuer
    const out = { ...old };
    for (const [k, v] of Object.entries(cur)) if (!BAD_KEYS.has(k) && v !== undefined && v !== null && !(Array.isArray(v) && !v.length)) out[k] = v;
    for (const k of ['note', 'booked']) if (!cur[k] && old[k]) out[k] = old[k];
    if (!cur.vote && old.vote) out.vote = old.vote; // 0/fehlt = keine Stimme
    out.visits = Math.max(+a.visits || 0, +b.visits || 0) || 1;
    out.firstSeen = Math.min(...[a.firstSeen, b.firstSeen].filter(Boolean)) || cur.firstSeen || old.firstSeen;
    out.lastSeen = Math.max(a.lastSeen || 0, b.lastSeen || 0) || undefined;
    const ph = new Map();
    for (const e of [...(a.priceHistory || []), ...(b.priceHistory || [])]) if (e && Number.isFinite(e.t)) ph.set(e.t + '|' + e.p, e);
    const hist = [...ph.values()].sort((x, y) => x.t - y.t).slice(-30);
    if (hist.length) out.priceHistory = hist; else delete out.priceHistory;
    for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
    return out;
  }

  // Einträge mit vorhandenen zusammenführen und in den Speicher schreiben (local = chrome.storage.local)
  async function applyImport(local, entries) {
    const keys = entries.map(v => 'l:' + v.id);
    const have = keys.length ? await local.get(keys) : {};
    let merged = 0, added = 0;
    const out = {};
    for (const v of entries) {
      const k = 'l:' + v.id, ex = have[k] ? migrateListing(have[k]) : null;
      if (ex) merged++; else added++;
      out[k] = migrateListing(mergeListing(ex, v));
    }
    if (keys.length) await safeSet(local, out);
    return { added, merged };
  }
  // Volle Sicherung (JSON mit Persönlichem): Freundes-Listen zusammenführen, Reise nur übernehmen, wenn keine gespeichert ist
  async function applyExtras(local, parsed) {
    const out = {};
    const cur = await local.get(['friendLikes', 'trip']);
    if (parsed.friendLikes) {
      const fl = { ...(cur.friendLikes || {}) };
      for (const [id, names] of Object.entries(parsed.friendLikes).slice(0, 5000)) if (/^\d{1,20}$/.test(id) && Array.isArray(names)) fl[id] = [...new Set([...(fl[id] || []), ...names.filter(n => typeof n === 'string').map(n => n.slice(0, 30))])];
      out.friendLikes = fl;
    }
    if (parsed.trip && !cur.trip && Number.isFinite(+parsed.trip.savedAt)) out.trip = parsed.trip;
    if (Object.keys(out).length) await safeSet(local, out);
    return Object.keys(out);
  }

  // Teilen-Export: alles Persönliche raus (Notiz, Gastgeber-Kennung, Preisverlauf mit Reisedaten, Buchung,
  // Reisedaten, Besuchsspuren, fremde Bewertungstexte).
  const PRIVATE_FIELDS = ['note', 'hostId', 'priceHistory', 'booked', 'checkin', 'checkout', 'firstSeen', 'lastSeen', 'visits', 'reviewTexts', 'friendLikes', 'stayTotal', 'wasPrice', 'tags'];
  function sanitizeListings(ls) {
    return Object.fromEntries(Object.entries(ls || {}).map(([k, v]) => [k, Object.fromEntries(Object.entries(v || {}).filter(([f]) => !PRIVATE_FIELDS.includes(f)))]));
  }
  function sanitizeTrip(t) {
    if (!t) return t;
    const { checkin, checkout, savedAt, ...rest } = t;
    return { ...rest, people: (t.people || []).map(p => ({ type: p?.type })), areas: (t.areas || []).map(({ minName, ...a }) => a) };
  }

  // Lokales Datum (nicht UTC): Tagesgrenze um Mitternacht des Nutzers
  const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Welche Schlüssel gehören zu welcher Löschart? (persönliche Spuren vollständig)
  const WIPE = {
    verlauf: x => x.startsWith('l:') || ['listings', 'friendLikes', 'stats', 'tasteIgnore', 'priceLog', 'visits', 'remindDone', 'pageStatus'].includes(x),
    zwischenspeicher: x => ['lastSearch', 'pageStatus', 'printTop', 'pool', 'quick', 'filters', 'priceLog', 'visits'].includes(x) || x.startsWith('min:'),
    reise: x => x === 'trip',
  };

  root.StayMatchImport = { MAX_FILE_BYTES, MAX_ENTRIES, sanitizeDeep, readFileText, isQuotaError, QUOTA_MSG, safeSet, cleanTags, SCHEMA, FORMAT, EXPORT_VERSION, migrateListing, migrateSettings, parseImport, mergeListing, applyImport, applyExtras, sanitizeListings, sanitizeTrip, localDay, WIPE, PRIVATE_FIELDS };
})(typeof window !== 'undefined' ? window : globalThis);
