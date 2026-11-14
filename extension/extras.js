// StayMatch – Zusatz-Hinweise (Runde 7 E). Reine Funktionen ohne chrome.* und ohne DOM.
// Teil 1: Texte der Unterkunftsseite (Beschreibung, Hausregeln, Ausstattung, Gastgeber, Buchungsbereich).
// Teil 2: Auswertungen über alle Karten der Suchseite (Preisanker, Lockpreis, Zwilling, Stabilität …).
// Alle Texte stehen in strings.js (Präfix extras.) und werden zur Aufrufzeit übersetzt. Ungeprüft live: wie Airbnb die Abschnitte genau schreibt.
(function (root) {
  const P = root.StayMatchParse || (typeof require === 'function' ? (require('./parse.js'), globalThis.StayMatchParse) : null);
  const I18n = root.StayMatchI18n || (typeof require === 'function' ? require('./i18n.js') : null);
  const tr = (k, v) => I18n.t(k, v); // (t ist in diesem Modul oft Parametername)
  const jn = a => a.join(', ');
  const R = () => root.StayMatchRank || globalThis.StayMatchRank;
  const S = v => String(v || '');
  const sep = (n, d = 1) => I18n.dec(String(Math.round(n * 10 ** d) / 10 ** d));
  const fmt = v => Math.round(v).toLocaleString(I18n.locale());
  const money = (v, c) => (c ? `${fmt(v)} ${c}` : fmt(v));
  // Betrag mit Währung im Satzstück nach einem Stichwort (ohne Währung kein Betrag: „3 Gäste“ ist kein Preis)
  function amountAfter(t, re, span = 70) {
    const m = S(t).match(re);
    if (!m) return null;
    const s = S(t).slice(m.index, m.index + m[0].length + span).split(/[\n]|\.(?!\d)/)[0];
    const c = P.currency(s);
    const v = c ? P.num(s) : null;
    return v != null ? { amount: v, currency: c } : null;
  }
  const sentences = t => S(t).split(/(?<=[.!?\n])\s+/);

  // ---------- Preise und Gebühren ----------
  // Kaution / Sicherheitsleistung
  const DEPOSIT = /kaution|sicherheitsleistung|sicherheitsdepot|security deposit|damage deposit|dépôt de garantie|caution\b|fianza|deposito cauzionale|cauzione/i;
  const deposit = t => amountAfter(t, DEPOSIT);

  // Zusatzgast-Gebühr: „ab 3 Gästen 20 € pro Person und Nacht“, „€20 per extra guest per night after 2 guests“
  const EXTRA_GUEST = /zusätzlich\w*\s+(?:gast|gäste|person)|weitere\s+(?:gast|gäste|person)|extra guests?|additional guests?|personne supplémentaire|huésped adicional|ospite aggiuntivo|ab\s+\d+\s+(?:gäst\w*|personen)/i;
  function extraGuestFee(t) {
    for (const s of sentences(t)) {
      if (!EXTRA_GUEST.test(s)) continue;
      const c = P.currency(s), v = c ? P.num(s) : null;
      if (v == null) continue;
      const ab = s.match(/\bab\s+(\d+)\s*(?:gäst|person)/i);
      const after = s.match(/(?:after|über|mehr als|more than|beyond|à partir de|a partir de)\s+(\d+)/i);
      const included = ab ? +ab[1] - 1 : after ? +after[1] : null;
      return { amount: v, currency: c, included, perNight: /nacht|night|nuit|noche|notte/i.test(s) };
    }
    return null;
  }
  function extraGuestCost(fee, people, nights) {
    if (!fee || fee.included == null || !people) return null;
    const extra = Math.max(0, people - fee.included);
    return extra ? extra * fee.amount * (fee.perNight ? nights || 1 : 1) : 0;
  }

  // Kosten, die erst vor Ort dazukommen
  const ONSITE = [
    [/strom\s+(?:nach|wird nach)\s+verbrauch|electricity (?:is )?(?:charged|paid) (?:separately|by consumption|on site)|électricité en sus/i, 'extras.onsite.electricity'],
    [/heiz(?:kosten|ung)\s+(?:nach verbrauch|extra|wird extra)|heating (?:is )?(?:charged|extra)/i, 'extras.onsite.heating'],
    [/(?:kurtaxe|ortstaxe|city tax|tourist tax|taxe de séjour|tasa turística|tassa di soggiorno)[^.\n]{0,40}(?:bar|vor ort|in cash|on site|on arrival|sur place|en efectivo|in contanti)/i, 'extras.onsite.tax'],
    [/endreinigung[^.\n]{0,30}vor ort|final cleaning[^.\n]{0,30}(?:on site|on arrival|cash)|ménage final[^.\n]{0,30}sur place/i, 'extras.onsite.cleaning'],
    [/bettwäsche[^.\n]{0,40}(?:gegen gebühr|gegen aufpreis|kostenpflichtig|extra|mieten)|(?:bed )?linens?[^.\n]{0,30}(?:for a fee|extra charge|not included|available for rent)|draps[^.\n]{0,30}(?:en supplément|non fournis)/i, 'extras.onsite.linen'],
  ];
  const onSiteCosts = t => ONSITE.filter(([re]) => re.test(S(t))).map(([, k]) => tr(k));

  // Putzliste beim Check-out
  const CHORES = [
    [/spülmaschine|geschirr\s+(?:spülen|abwaschen)|dishwasher|wash (?:the )?dishes|vaisselle/i, 'extras.chore.dishes'],
    [/bettwäsche\s+abziehen|betten\s+abziehen|strip (?:the )?beds?|enlever les draps/i, 'extras.chore.beds'],
    [/müll|abfall|trash|garbage|rubbish|poubelles?/i, 'extras.chore.trash'],
    [/handtücher\s+(?:sammeln|zusammen)|towels? (?:in|into) (?:a )?pile|gather (?:the )?towels/i, 'extras.chore.towels'],
    [/staubsaugen|fegen|vacuum|sweep/i, 'extras.chore.vacuum'],
    [/waschmaschine\s+(?:anstellen|laufen)|start (?:a |the )?(?:laundry|washing machine)/i, 'extras.chore.laundry'],
  ];
  function checkoutChores(t) {
    const s = S(t);
    const m = s.match(/(?:vor (?:der |deiner )?abreise|beim check-?out|check-?out[- ]?(?:anweisungen|anleitung|instructions)|before you leave|avant de partir)[\s\S]{0,400}/i);
    const part = m ? m[0] : '';
    return CHORES.filter(([re]) => re.test(part)).map(([, k]) => tr(k));
  }

  // Buchungsbereich: Reinigungs- und Servicegebühr. „Reinigungsgebühr 80 €“, „Cleaning fee $80“
  function fees(t) {
    const clean = amountAfter(t, /reinigungsgebühr|endreinigung|cleaning fee|frais de ménage|tarifa de limpieza|costi di pulizia/i, 30);
    const service = amountAfter(t, /servicegebühr|airbnb-servicegebühr|service fee|frais de service|tarifa de servicio|costi del servizio/i, 30);
    return { cleaning: clean?.amount ?? null, service: service?.amount ?? null, currency: clean?.currency || service?.currency || null };
  }
  // Anteil der Fixkosten (Reinigung + Service) am Gesamtpreis
  function feeShare(f, total) {
    if (!f || !total) return null;
    const fix = (f.cleaning || 0) + (f.service || 0);
    return fix > 0 && fix < total ? fix / total : null;
  }

  // Parkplatz gegen Gebühr
  const PARK_FEE = /(?:parkplatz|stellplatz|garage|parkhaus|tiefgarage|parking)[^.\n]{0,40}(?:gegen gebühr|kostenpflichtig|pro tag|per day|par jour|al día|for a fee|paid)/i;
  function parkingInfo(t) {
    const s = S(t);
    const paid = PARK_FEE.test(s);
    const a = paid ? amountAfter(s, /parkplatz|stellplatz|garage|parkhaus|tiefgarage|parking/i, 60) : null;
    return {
      paid, amount: a?.amount ?? null, currency: a?.currency ?? null,
      garage: /\bgarage\b|tiefgarage|parkhaus|garaje|garage privé/i.test(s),
      street: /straßenparkplatz|parken an der straße|street parking|on-street|stationnement dans la rue/i.test(s),
    };
  }

  // ---------- Räume, Betten, Fläche ----------
  const PASS_ROOM = /durchgangszimmer|zugang (?:nur )?über (?:ein |das )?(?:anderes )?schlafzimmer|offene?r? schlafbereich|walk[- ]through (?:bed)?room|access(?:ed)? through (?:another |a )?bedroom|open[- ]plan sleeping|chambre de passage/i;
  const HOST_NEAR = /wir wohnen (?:im|in der|nebenan|oben|unten)|gastgeber wohnt (?:im|nebenan|vor ort|im selben)|einliegerwohnung|gemeinsamer eingang|geteilter eingang|host lives (?:on site|on the property|next door|upstairs|downstairs)|we live (?:upstairs|downstairs|next door|on site|on the property)|shared entrance/i;
  const FLOORS = /(?:schlafzimmer|zimmer) (?:auf|über) (?:zwei|2|drei|3|verschiedenen) (?:etagen|stockwerken|ebenen)|nebengebäude|separate[ns]? (?:gäste)?haus|(?:bedrooms? (?:on|across) (?:two|2|different) (?:floors|levels))|annex|separate (?:building|cottage)/i;
  const LOFT = /hochbett|galerie mit leiter|leiter zum|mezzanin\w*|loft bed|sleeping loft|ladder to|lit mezzanine/i;
  function diningSeats(t) { const m = S(t).match(/(?:esstisch|tisch|dining table|table)\s+(?:für|for|pour)\s+(\d{1,2})|(\d{1,2})\s*(?:sitzplätze|sitzplätzen|seats?|places assises)(?:\s+am (?:ess)?tisch)?/i); return m ? +(m[1] || m[2]) : null; }
  function dishesFor(t) { const m = S(t).match(/(?:geschirr|besteck|tableware|dishes)\s+(?:für|for)\s+(\d{1,2})/i); return m ? +m[1] : null; }
  function bedWidth(t) { const m = S(t).match(/(\d{2,3})\s*(?:x\s*\d{3}\s*)?cm(?:[^.\n]{0,20}(?:bett|bed|matratze|lit|cama))|(?:bett|bed|matratze)[^.\n]{0,20}?(\d{2,3})\s*(?:x\s*\d{3}\s*)?cm/i); const w = m ? +(m[1] || m[2]) : null; return w && w >= 70 && w <= 220 ? w : null; }
  function area(t) {
    const str = S(t), re = /(\d{2,4})\s*(?:m²|m2|qm|quadratmeter|sq\.?\s*m|square met(?:er|re)s?)(?![\p{L}\d])/giu;
    // Grundstück, Garten, plot: Außenfläche ist keine Wohnfläche
    const OUT_BEFORE = /(?:grundst\w*|garten|plot|land|lot|terrain|jardin|garden|yard)[^.\n]{0,15}$/i, OUT_AFTER = /^\s*(?:grund\w*|garten|plot|land|terrain|jardin|garden|yard)/i;
    for (const m of str.matchAll(re)) {
      const before = str.slice(Math.max(0, m.index - 22), m.index), after = str.slice(m.index + m[0].length, m.index + m[0].length + 14);
      if (OUT_BEFORE.test(before) || OUT_AFTER.test(after)) continue;
      const v = +m[1];
      return v >= 8 && v <= 2000 ? v : null;
    }
    return null;
  }
  function sqft(t) { const m = S(t).match(/(\d{3,5})\s*(?:sq\.?\s*ft|square feet)/i); return m ? Math.round(+m[1] * 0.0929) : null; }
  function floorInfo(t) {
    const s = S(t);
    // Zahl zuerst („3. Stock, Fahrräder im Erdgeschoss“), sonst Erdgeschoss
    const m = s.match(/(\d{1,2})\.\s*(?:stock|etage|og|obergeschoss)|(\d{1,2})(?:st|nd|rd|th)\s+floor|(\d{1,2})(?:er|e|ème)\s+étage|(\d{1,2})[ºª°]\s*piso/i);
    if (m) return { ground: false, floor: +(m[1] || m[2] || m[3] || m[4]) };
    return /erdgeschoss|parterre|ground floor|planta baja|rez-de-chaussée|piano terra/i.test(s) ? { ground: true, floor: 0 } : null;
  }

  // ---------- Ausstattung (Wunsch-Merkmale; true nur bei Treffer, sonst unbekannt) ----------
  // „Nicht verfügbar: Rauchmelder“ oder „Kein Rauchmelder“ ist kein Treffer
  const NOT_AVAIL = /(?:nicht verfügbar|nicht vorhanden|unavailable|not included|non disponible|no disponible)\s*:?\s*$/i;
  const NO_WORD = /(?:kein\w*|ohne|no|sans|sin|senza)\s+$/i;
  function present(t, re) {
    const s = S(t);
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    for (const m of s.matchAll(g)) {
      const before = s.slice(Math.max(0, m.index - 30), m.index);
      if (!NOT_AVAIL.test(before) && !NO_WORD.test(before)) return true;
    }
    return false;
  }
  const FEATURES = {
    bathtub: /badewanne|bathtub|baignoire|bañera|vasca da bagno/i,
    view: /meerblick|seeblick|bergblick|stadtblick|aussicht|blick (?:über|auf)|panoramablick|sea view|ocean view|city view|mountain view|lake view|skyline view|vue sur|vista al mar|vista sul/i,
    workspace: /arbeitsplatz|schreibtisch|arbeitsbereich|dedicated workspace|workspace|(?<!front )(?<!reception )(?<!help )(?<!service )(?<!information )desk\b|espace de travail|escritorio|scrivania/i,
    monitor: /\bmonitor\b|zweiter bildschirm|external (?:monitor|screen)|écran externe/i,
    selfCheckin: /self[- ]check[- ]?in|selbst einchecken|schlüsselbox|schlüsselsafe|smart ?lock|keypad|lockbox|key ?safe|boîte à clés|caja de seguridad/i,
    lock: /schloss an der (?:schlaf)?zimmertür|abschließbar\w*|abschließbares zimmer|lock on (?:the )?bedroom door|serrure sur la porte/i,
    ev: /ladestation|wallbox|e-?auto laden|ev charger|electric vehicle charg|borne de recharge|cargador (?:para )?(?:vehículo|coche) eléctrico/i,
    bike: /fahrradkeller|fahrradabstell\w*|fahrradraum|fahrräder (?:inklusive|vorhanden|zur verfügung)|bike storage|bicycles? (?:available|included)|local à vélos/i,
    grill: /\bgrill\b|grillplatz|barbecue|\bbbq\b|barbacoa/i,
    blackout: /verdunkelung\w*|rollläden|rolladen|jalousien|blackout|room[- ]darkening|occultant/i,
    beach: /strandtücher|sonnenschirm|strandstühle|strandliegen|beach towels|beach umbrella|beach chairs|serviettes de plage/i,
    ski: /skiraum|skikeller|skiaufbewahrung|skibus|ski[- ]in|ski storage|ski room|local à skis/i,
    garden: /garten|innenhof|hinterhof|garden|backyard|patio|jardin|jardín|giardino/i,
    fencedGarden: /eingezäunt\w*|umzäunt\w*|fenced|clôturé/i,
    balcony: /balkon|terrasse|balcony|terrace|balcon|terraza|balcone|terrazza/i,
    crib: /kinderbett|babybett|reisebett|\bcrib\b|baby cot|travel cot|lit bébé|cuna/i,
    highchair: /hochstuhl|high ?chair|chaise haute|trona|seggiolone/i,
    babyBath: /babybadewanne|baby ?bath|baignoire bébé/i,
    toys: /spielzeug|kinderbücher|children'?s books|toys|jouets|juguetes/i,
    stairGate: /treppenschutzgitter|treppengitter|baby ?gates?|barrière de sécurité/i,
    outletCovers: /steckdosenschutz|steckdosensicherung|outlet covers|cache-prises/i,
    smoke: /rauchmelder|rauchwarnmelder|smoke (?:alarm|detector)|détecteur de fumée|detector de humo/i,
    co: /kohlenmonoxid|co-?melder|co-?warnmelder|carbon monoxide|monoxyde de carbone|monóxido de carbono/i,
    extinguisher: /feuerlöscher|fire extinguisher|extincteur|extintor/i,
    firstAid: /erste[- ]hilfe|first aid|premiers secours|botiquín/i,
    camera: /(?:außen|überwachungs|sicherheits)kamera\w*|(?:security|exterior|outdoor) cameras?|caméras? de surveillance/i,
    noiseSensor: /lärmmess\w*|lärmsensor\w*|geräuschmess\w*|schallpegel\w*|noise (?:decibel )?monitor\w*|noise sensor|décibelmètre|sonomètre/i,
    washer: /waschmaschine|washing machine|(?<!dish)washer|lave-linge|lavadora|lavatrice/i,
    dryer: /trockner|dryer|sèche-linge|secadora|asciugatrice/i,
    ac: /klimaanlage|air conditioning|climatisation|aire acondicionado|aria condizionata/i,
    heating: /heizung|heating|chauffage|calefacción|riscaldamento/i,
    elevator: /aufzug|fahrstuhl|elevator|(?<![\p{L}])lift(?![\p{L}])|ascenseur|ascensor|ascensore/iu,
    pool: /\bpool\b(?!\s*(?:table|tisch|billard))|schwimmbad|piscine|piscina/i,
    fireplace: /kamin|fireplace|cheminée|chimenea|caminetto/i,
    sauna: /sauna/i,
    fridge: /(?<!mini[- ]?)kühlschrank|refrigerator|(?<!mini[- ]?)fridge|réfrigérateur|frigorífico|nevera|frigorifero/i,
    miniFridge: /minikühlschrank|mini[- ]?(?:fridge|kühlschrank)|minibar|kühlfach/i,
    freezer: /gefrierfach|gefrierschrank|tiefkühl\w*|freezer|congélateur|congelador/i,
    oven: /backofen|ofen\b|\boven\b|\b(?:le|un|du|au|de|d')\s?four\b|\bfour (?:à|électrique|encastrable)|horno|forno/i,
    stove: /\bherd\b|kochfeld|stove|cooktop|cuisinière|plaques? de cuisson|vitrocerámica|fornelli/i,
    dishwasher: /geschirrspüler|spülmaschine|dishwasher|lave-vaisselle|lavavajillas|lavastoviglie/i,
    microwave: /mikrowelle|microwave|micro-ondes|microondas/i,
    kitchenette: /kochnische|kitchenette|pantry|kochplatte|hot ?plate|plaque chauffante/i,
    basics: /öl,? salz|salz und pfeffer|gewürze|cooking basics|kochgrundlagen|oil,? salt|huile,? sel|aceite,? sal/i,
    coffeeTea: /kaffee und tee|tee und kaffee|coffee and tea|tea and coffee|café et thé/i,
    stepFree: /stufenlos\w*|ebenerdig\w*|barrierefrei\w*|step[- ]free|no stairs or steps|rollstuhlgerecht|wheelchair[- ]accessible|accès de plain-pied/i,
    wideDoor: /türbreite|breite tür\w*|wide (?:doorway|entrance|hallway)|(?:doorway|entrance)[^.\n]{0,20}(?:wider than|over) \d+|porte large/i,
    showerSeat: /duschsitz|duschhocker|duschstuhl|shower (?:chair|seat|bench)|siège de douche/i,
    grabBars: /haltegriff\w*|grab bars?|barres d'appui/i,
  };
  const COFFEE = [
    [/nespresso|kapselmaschine|kaffeekapsel|pod coffee|capsule|dolce gusto|tassimo|senseo|keurig/i, 'extras.coffee.capsule'],
    [/siebträger|espressomaschine|espresso machine|machine à expresso|cafetera express/i, 'extras.coffee.espresso'],
    [/vollautomat|kaffeevollautomat|bean[- ]to[- ]cup/i, 'extras.coffee.bean'],
    [/filterkaffee|filtermaschine|kaffeemaschine|drip coffee|coffee maker|cafetière filtre|cafetera de goteo/i, 'extras.coffee.filter'],
    [/french press|stempelkanne|cafetière à piston/i, 'extras.coffee.press'],
    [/moka|herdkanne|espressokocher|bialetti/i, 'extras.coffee.moka'],
    [/instant|löslich\w* kaffee|nescafé/i, 'extras.coffee.instant'],
  ];
  function features(t) {
    const out = {};
    for (const [k, re] of Object.entries(FEATURES)) if (present(t, re)) out[k] = true;
    return out;
  }
  const coffee = t => { const s = S(t); const hit = COFFEE.find(([re]) => re.test(s)); return hit ? tr(hit[1]) : null; };
  // Küche in drei Stufen
  function kitchenLevel(f, t) {
    if (f.oven && (f.stove || f.dishwasher)) return 'full';
    if (f.kitchenette || (f.microwave && !f.stove && !f.oven)) return 'basic';
    if (/nur (?:eine )?mikrowelle|only (?:a )?microwave/i.test(S(t))) return 'basic';
    return f.stove || f.oven ? 'normal' : null;
  }

  // ---------- Hausregeln ----------
  const NOT_FOR_KIDS = /nicht (?:für|geeignet für) (?:kinder|kleinkinder|babys)|(?:kinder|kleinkinder)[^.\n]{0,20}nicht (?:geeignet|erlaubt|gestattet)|keine kinder|not suitable for (?:children|infants|kids)|no (?:children|kids)\b|children not allowed|ne convient pas aux enfants|no apto para niños|non adatto ai bambini/i;
  const NO_VISITORS = /keine (?:besucher|gäste von außen|externen gäste|zusätzlichen gäste)|besuch (?:ist )?nicht (?:erlaubt|gestattet)|no (?:visitors|outside guests|unregistered guests)|visiteurs (?:non autorisés|interdits)|no se permiten visitas/i;
  function minAge(t) { const m = S(t).match(/(?:mindestalter|gäste (?:ab|über)|nur (?:gäste )?(?:ab|über)|minimum age(?: of)?|guests (?:must be )?(?:over|at least|aged)|âge minimum(?: de)?|edad mínima(?: de)?)\s*:?\s*(\d{2})/i); const v = m ? +m[1] : null; return v && v >= 16 && v <= 35 ? v : null; }
  const SMOKING_OK = /rauchen (?:ist )?(?:erlaubt|gestattet)|raucher willkommen|smoking (?:is )?allowed|smoking permitted|fumeurs autorisés|se permite fumar|è consentito fumare/i;
  function petLimits(t) {
    const s = S(t), out = [];
    if (/nur kleine? (?:hunde|haustiere|tiere)|small (?:dogs|pets) only|only small (?:dogs|pets)|petits chiens uniquement/i.test(s)) out.push(tr('extras.pet.small'));
    const m = s.match(/(?:max(?:imal|\.)?|höchstens|up to|maximum(?: of)?)\s*(\d)\s*(?:haustier\w*|hund\w*|tier\w*|pets?|dogs?|animaux)/i);
    if (m) out.push(tr('extras.pet.max', { n: +m[1] }));
    if (/keine katzen|no cats|pas de chats/i.test(s)) out.push(tr('extras.pet.nocats'));
    if (/keine hunde|no dogs|pas de chiens/i.test(s)) out.push(tr('extras.pet.nodogs'));
    return out;
  }
  const petFee = t => amountAfter(t, /haustiergebühr|gebühr für (?:haus)?tiere|tierpauschale|pet fee|pet cleaning fee|frais (?:pour )?animaux|tarifa (?:por )?mascota/i, 40);
  // Allergie: Tiere leben in der Unterkunft, Teppich, Federbetten
  const ALLERGY = [
    [/(?:katze|kater)\s+(?:lebt|wohnt)|(?:unsere?|meine?)\s+katzen?\b|cat lives|resident cat|(?:our|my) cats?\b|chat vit/i, 'extras.allergy.cat'],
    [/(?:hund)\s+(?:lebt|wohnt)|(?:unser|mein)\s+hund\b|dog lives|resident dog|(?:our|my) dogs?\b|chien vit/i, 'extras.allergy.dog'],
    [/teppichboden|teppiche\b|carpet(?:ed|ing)?\b|moquette/i, 'extras.allergy.carpet'],
    [/federbett\w*|daunen\w*|feather (?:duvet|pillows?)|down (?:duvet|comforter|pillows?)|couette en plumes/i, 'extras.allergy.feather'],
  ];
  const allergy = t => ALLERGY.filter(([re]) => re.test(S(t))).map(([, k]) => tr(k));
  // Regel-Dichte: Zeilen bzw. Sätze der Hausregeln
  const ruleCount = t => S(t).split(/\n|(?<=[.!])\s+/).map(x => x.trim()).filter(x => x.length >= 6).length;

  // ---------- Gastgeber ----------
  function hostExtra(t) {
    const s = S(t);
    const listings = s.match(/(\d{1,4})\s*(?:unterkünfte|inserate|listings|annonces|alojamientos|annunci)\b/i);
    const lives = s.match(/(?:lebt in|wohnt in|lives in|vit à|vive en|vive a)\s+([\p{L}][\p{L} .'-]{1,40}?)(?=[\n,.;]|$)/iu);
    const langs = s.match(/(?:spricht|speaks|parle|habla|parla)\s+([\p{L}][\p{L}, ]{1,80}?)(?=[\n.;]|$)/iu);
    return {
      listings: listings ? +listings[1] : null,
      livesIn: lives ? lives[1].trim() : null,
      languages: langs ? langs[1].split(/,|\bund\b|\band\b|\bet\b|\by\b|\be\b/).map(x => x.trim()).filter(x => x.length >= 3).slice(0, 6) : [],
      notVerified: /identität nicht (?:verifiziert|bestätigt)|identity not verified|not (?:yet )?verified|identité non vérifiée/i.test(s),
    };
  }

  // ---------- Sonstiges ----------
  const LICENSE = /(?:registriernummer|registrierungsnummer|lizenz(?:nummer)?|genehmigungsnummer|registration (?:number|no\.?)|licen[cs]e (?:number|no\.?)|policy number|numéro d'enregistrement|número de registro|n(?:úmero)? de licencia|codice identificativo|CIN|CIR)\s*[:#]?\s*([A-Z0-9][A-Z0-9/._-]{3,30})/i;
  const license = t => { const m = S(t).match(LICENSE); return m && /\d/.test(m[1]) ? m[1] : null; };
  const GREEN = [[/ökostrom|grüner strom|green (?:energy|electricity)|renewable energy|énergie verte/i, 'extras.green.power'], [/solar\w*|photovoltaik|solar panels?|panneaux solaires/i, 'extras.green.solar'],
    [/wärmepumpe|heat pump|pompe à chaleur/i, 'extras.green.heatpump'], [/mülltrennung|recycling|tri sélectif|reciclaje/i, 'extras.green.recycling']];
  const greenClaims = t => GREEN.filter(([re]) => re.test(S(t))).map(([, k]) => tr(k));
  const SUPERLATIVE = /atemberaubend\w*|einzigartig\w*|traumhaft\w*|oase|paradies\w*|perle|juwel|unvergesslich\w*|spektakulär\w*|fantastisch\w*|exklusiv\w*|luxuriös\w*|wunderschön\w*|stunning|breathtaking|unique|oasis|paradise|gem\b|unforgettable|spectacular|amazing|gorgeous|magnifique|exceptionnel\w*|impresionante|espectacular/giu;
  function superlatives(t) { const s = S(t); const n = (s.match(SUPERLATIVE) || []).length; const words = s.split(/\s+/).filter(Boolean).length; return { count: n, words, share: words ? n / words : 0 }; }

  // Tageslänge (Sonnenaufgang bis -untergang) aus Breitengrad und Datum, Standardformel mit −0,833° Horizont
  function dayLength(lat, date) {
    const d = new Date(date);
    if (lat == null || !isFinite(lat) || isNaN(d)) return null;
    const start = Date.UTC(d.getUTCFullYear(), 0, 0);
    const N = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - start) / 864e5);
    const rad = Math.PI / 180;
    const decl = 23.44 * rad * Math.sin(2 * Math.PI * (284 + N) / 365);
    const phi = lat * rad;
    const cosH = (Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
    if (cosH <= -1) return 24;
    if (cosH >= 1) return 0;
    return 2 * Math.acos(cosH) / rad / 15;
  }

  // Was die Beschreibung verspricht (für „Inserat sagt X, Gäste sagen Y“)
  const CLAIMS = [['quiet', /\bruhig\w*|quiet|calme|tranquil/i, /⚠️ (laut|hellhörig|Baustelle|Ohrstöpsel|noisy|thin walls|construction|earplugs)/], ['wifi', /schnell\w* (wlan|internet|wifi)|fast (wifi|internet)|glasfaser|fibre|fiber/i, /⚠️ (WLAN|Wi-Fi)/],
    ['clean', /blitzsauber|sehr sauber|spotless|impeccably clean/i, /⚠️ (schmutzig|Geruch|Ungeziefer|dirty|smell|pests)/], ['bright', /lichtdurchflutet|sehr hell|bright|lumineux|luminoso/i, /⚠️ (dunkel|dark)/]];
  const claimLabel = id => tr('extras.claim.' + id);
  const claims = t => CLAIMS.filter(([, re]) => re.test(S(t))).map(([id]) => claimLabel(id));
  // Abgleich mit den Bewertungs-Stichworten
  function claimConflicts(cl, hints) {
    // gespeicherte Labels können in der anderen Sprache entstanden sein: Id oder Label (de/en) erkennen
    const find = l => CLAIMS.find(x => x[0] === l || claimLabel(x[0]) === l || I18n.DICT.de['extras.claim.' + x[0]] === l || I18n.DICT.en['extras.claim.' + x[0]] === l);
    return (cl || []).map(l => { const c = find(l); const bad = c && (hints || []).find(x => c[2].test(x)); return bad ? tr('extras.claimConflict', { claim: l, guests: bad.replace(/^⚠️\s*/, '') }) : null; }).filter(Boolean);
  }

  // ---------- Alles auf einmal für die Unterkunftsseite ----------
  // sec: { desc, rules, amen, host, book }  (reine Texte)
  function roomExtras(sec = {}) {
    const all = [sec.desc, sec.rules, sec.amen].map(S).join('\n');
    const f = features(S(sec.amen) + '\n' + S(sec.desc));
    return {
      features: f, kitchen: kitchenLevel(f, all), coffee: coffee(all),
      deposit: deposit(all), extraGuest: extraGuestFee(all + '\n' + S(sec.book)), onSite: onSiteCosts(all), chores: checkoutChores(S(sec.rules) + '\n' + S(sec.desc)),
      fees: fees(sec.book), parking: parkingInfo(all), passRoom: PASS_ROOM.test(all), hostNear: HOST_NEAR.test(all), floors: FLOORS.test(all), loft: LOFT.test(all),
      seats: diningSeats(all), dishes: dishesFor(all), bedWidth: bedWidth(all), area: area(all) || sqft(all), floor: floorInfo(sec.desc),
      notForKids: NOT_FOR_KIDS.test(S(sec.rules)), noVisitors: NO_VISITORS.test(S(sec.rules)), minAge: minAge(sec.rules), smokingOk: SMOKING_OK.test(S(sec.rules)),
      petLimits: petLimits(sec.rules), petFee: petFee(all), allergy: allergy(S(sec.desc) + '\n' + S(sec.rules)), rules: ruleCount(sec.rules),
      host: hostExtra(sec.host), license: license(all), green: greenClaims(all), superlatives: superlatives(sec.desc),
      amenRead: !!S(sec.amen).trim(), claims: claims(sec.desc),
    };
  }

  const TROPIC_LAT = 30;
  // Kalte Jahreszeit (Kamin, Sauna, Außenpool)? lat: Breitengrad (Vorzeichen = Halbkugel), month 1–12. Tropen: nie.
  function isColdSeason(lat, month) {
    if (!month || lat == null || Math.abs(lat) <= TROPIC_LAT) return lat == null ? [10, 11, 12, 1, 2, 3].includes(month) : false;
    return (lat < 0 ? [4, 5, 6, 7, 8, 9] : [10, 11, 12, 1, 2, 3]).includes(month);
  }
  // Aus den gelesenen Merkmalen werden Hinweise für deine Reise.
  // ctx: { people, children, infants, pets, nights, checkin (YYYY-MM-DD), lat, wishes, total (Reisepreis), currency, pro, superhost, responseTime, ownBed }
  // → { warn: [] (wichtig, sichtbar), info: [] (in „Mehr Hinweise“), plus: [] }
  function roomNotes(x, ctx = {}) {
    const warn = [], info = [], plus = [];
    if (!x) return { warn, info, plus };
    const f = x.features || {};
    const people = ctx.people || 0, kids = (ctx.children || 0) + (ctx.infants || 0);
    const month = ctx.checkin ? +String(ctx.checkin).slice(5, 7) : null;
    const south = ctx.lat != null && ctx.lat < 0;
    // In den Tropen (|Breite| ≤ 30°) gibt es keine „kalte Jahreszeit“ im Sinn des Hinweises
    const seasonal = ctx.lat == null || Math.abs(ctx.lat) > TROPIC_LAT;
    const summer = month && (south ? [12, 1, 2] : [6, 7, 8]).includes(month);
    const winter = seasonal && month && (south ? [5, 6, 7, 8, 9] : [11, 12, 1, 2, 3]).includes(month);
    const cur = ctx.currency || x.fees?.currency || null;
    // Preis
    if (x.deposit) info.push(tr('extras.deposit', { amount: money(x.deposit.amount, x.deposit.currency) }));
    const eg = extraGuestCost(x.extraGuest, people, ctx.nights);
    if (eg) warn.push(tr('extras.eg.warn', { amount: money(eg, x.extraGuest.currency), people, from: x.extraGuest.included + 1, night: x.extraGuest.perNight ? tr('extras.eg.perNight') : '' }));
    else if (x.extraGuest && x.extraGuest.included == null) info.push(tr('extras.eg.info', { amount: money(x.extraGuest.amount, x.extraGuest.currency) }));
    if (x.onSite?.length) warn.push(tr('extras.onsite.warn', { list: jn(x.onSite) }));
    const share = feeShare(x.fees, ctx.total);
    if (share != null && ctx.nights && ctx.nights <= 2) (share >= 0.25 ? warn : info).push(tr('extras.share', { pct: Math.round(share * 100) }));
    if (x.fees?.cleaning && x.chores?.length >= 2) warn.push(tr('extras.cleanChores', { amount: money(x.fees.cleaning, cur), list: jn(x.chores) }));
    else if (x.chores?.length >= 3) info.push(tr('extras.chores', { list: jn(x.chores) }));
    if (x.parking?.paid) info.push(x.parking.amount ? tr('extras.parking.paidAmt', { amount: money(x.parking.amount, x.parking.currency) }) : tr('extras.parking.paid'));
    else if (x.parking?.garage) plus.push(tr('extras.parking.garage'));
    // Räume und Betten
    if (x.passRoom && people >= 3) warn.push(tr('extras.passRoom'));
    if (x.seats && people && x.seats < people) warn.push(tr('extras.seats', { seats: x.seats, people }));
    if (x.dishes && people && x.dishes < people) warn.push(tr('extras.dishes', { n: x.dishes, people }));
    if (x.hostNear) info.push(tr('extras.hostNear'));
    if (x.floors && (kids || people >= 4)) info.push(tr('extras.floors'));
    if (x.loft) (kids ? warn : info).push(tr('extras.loft'));
    if (x.bedWidth && people === 2 && x.bedWidth <= 140) info.push(tr('extras.bedWidth', { w: x.bedWidth }));
    if (x.area && people) { const pp = x.area / people; (pp < 10 ? warn : info).push(tr(pp < 10 ? 'extras.areaTight' : 'extras.area', { area: x.area, pp: sep(pp, 0) })); }
    if (x.floor && !x.floor.ground && x.floor.floor >= 2 && !f.elevator) info.push(tr('extras.floor', { floor: x.floor.floor }));
    if (x.floor?.ground) plus.push(tr('extras.ground'));
    // Hausregeln
    if (x.notForKids && kids) warn.push(tr('extras.notForKids'));
    if (x.minAge) info.push(tr('extras.minAge', { age: x.minAge }));
    if (x.noVisitors) info.push(tr('extras.noVisitors'));
    if (x.smokingOk) info.push(tr('extras.smokingOk'));
    if (ctx.pets && x.petLimits?.length) warn.push(tr('extras.pets', { list: jn(x.petLimits) }));
    if (ctx.pets && x.petFee) info.push(tr('extras.petFee', { amount: money(x.petFee.amount, x.petFee.currency) }));
    if (x.allergy?.length) ((ctx.wishes || []).includes('petFree') ? warn : info).push(tr('extras.allergy', { list: jn(x.allergy) }));
    if (x.rules >= 15) info.push(tr('extras.longRules', { n: x.rules }));
    if (ctx.smoker && ctx.noSmoking) (f.balcony ? info : warn).push(tr(f.balcony ? 'extras.smokeOutside' : 'extras.smokeNoOutdoor'));
    if (ctx.pets && ctx.noPets) info.push(tr('extras.assistance'));
    // Sicherheit (nur wenn die Ausstattung gelesen wurde)
    if (x.amenRead) {
      const miss = [!f.smoke && tr('extras.safety.smoke'), !f.co && tr('extras.safety.co'), !f.extinguisher && tr('extras.safety.extinguisher')].filter(Boolean);
      if (miss.length) info.push(tr('extras.safety.missing', { list: jn(miss) }));
    }
    if (f.camera || f.noiseSensor) info.push(tr('extras.cam.line', { list: [f.camera && tr('extras.cam.camera'), f.noiseSensor && tr('extras.cam.noise')].filter(Boolean).join(tr('extras.and')) }));
    // Familie
    if (kids) {
      const baby = [['crib', tr('extras.baby.crib')], ['highchair', tr('extras.baby.highchair')], ['babyBath', tr('extras.baby.bath')], ['toys', tr('extras.baby.toys')]];
      if (ctx.infants) { const have = baby.filter(([k]) => f[k]).map(([, l]) => l), miss = baby.filter(([k]) => !f[k]).map(([, l]) => l); info.push(tr('extras.baby.line', { have: have.length ? '✓ ' + jn(have) : tr('extras.baby.none'), missing: miss.length && have.length ? tr('extras.baby.missing', { list: jn(miss) }) : '' })); }
      if (f.pool && !f.fencedGarden) info.push(tr('extras.poolFence'));
      if (f.stairGate || f.outletCovers) plus.push(tr('extras.childSafety.line', { list: jn([f.stairGate && tr('extras.childSafety.gate'), f.outletCovers && tr('extras.childSafety.outlet')].filter(Boolean)) }));
      if (f.garden) plus.push(tr(f.fencedGarden ? 'extras.garden.fenced' : 'extras.garden.plain'));
    }
    if (ctx.pets && f.fencedGarden) plus.push(tr('extras.garden.dogs'));
    if ((kids || (ctx.nights || 0) >= 5) && f.washer) plus.push(tr('extras.washer'));
    else if ((ctx.nights || 0) >= 7 && x.amenRead && !f.washer) info.push(tr('extras.noWasher'));
    // Saison
    if (f.pool && winter) info.push(tr('extras.poolWinter'));
    if (summer && !f.ac && /dachgeschoss|dachwohnung|attic|top floor|sous les toits|ático|mansarda/i.test(ctx.text || '')) warn.push(tr('extras.attic'));
    if (month && ctx.checkin) {
      const md = String(ctx.checkin).slice(5, 10), nights = ctx.nights || 1;
      const end = new Date(Date.parse(ctx.checkin) + nights * 864e5).toISOString().slice(5, 10);
      const coversNye = md <= '12-31' && md >= '12-20' && end >= '01-01' && end <= '01-15';
      if (coversNye) { const s = [ctx.noParties && tr('extras.nye.noParties'), x.deposit && tr('extras.depositShort', { amount: money(x.deposit.amount, x.deposit.currency) }), x.noVisitors && tr('extras.nye.noVisitors')].filter(Boolean); if (s.length) warn.push(tr('extras.nye.line', { list: jn(s) })); }
    }
    if ((ctx.nights || 0) >= 28) info.push(tr('extras.longStay'));
    const dl = ctx.lat != null && ctx.checkin ? dayLength(ctx.lat, ctx.checkin) : null;
    if (dl != null && (dl < 9 || dl > 17)) info.push(tr('extras.daylight', { h: sep(dl, 0) }));
    if (dl != null && dl > 17 && !f.blackout && x.amenRead) info.push(tr('extras.brightNights'));
    // Gastgeber
    const hx = x.host || {};
    if (hx.notVerified) warn.push(tr('extras.host.unverified'));
    if (hx.listings != null && hx.listings >= 5) info.push(tr('extras.host.listings', { n: hx.listings }));
    if (hx.listings >= 10 && ctx.hostSince && +ctx.hostSince >= new Date().getFullYear() - 1) warn.push(tr('extras.host.newMany', { n: hx.listings }));
    if (hx.livesIn) info.push(tr('extras.host.livesIn', { place: hx.livesIn }));
    if (hx.languages?.length) info.push(tr('extras.host.speaks', { list: jn(hx.languages) }));
    if (ctx.responseTime === 'day' && ctx.checkin) { const days = (Date.parse(ctx.checkin) - (ctx.now || Date.now())) / 864e5; if (days >= 0 && days < 2) warn.push(tr('extras.host.slow')); }
    // Sonstiges
    if (x.license) info.push(tr('extras.license', { n: x.license }));
    if (x.green?.length) info.push(tr('extras.green', { list: jn(x.green) }));
    if (x.superlatives?.count >= 4 && x.superlatives.share >= 0.03) info.push(tr('extras.superlatives', { n: x.superlatives.count }));
    if (x.kitchen === 'basic') info.push(tr('extras.kitchen.basic'));
    else if (x.kitchen === 'full') plus.push(tr('extras.kitchen.full'));
    if (x.coffee) info.push(tr('extras.coffee.line', { x: x.coffee }));
    if (f.basics || f.coffeeTea) plus.push(tr('extras.basics'));
    if (f.miniFridge && !f.fridge && people >= 3) warn.push(tr('extras.miniFridge'));
    if (f.freezer) plus.push(tr('extras.freezer'));
    const access = [f.stepFree && tr('extras.access.stepFree'), f.wideDoor && tr('extras.access.wideDoor'), f.showerSeat && tr('extras.access.showerSeat'), f.grabBars && tr('extras.access.grabBars')].filter(Boolean);
    if (access.length) plus.push(tr('extras.access.line', { list: jn(access) }));
    return { warn, info, plus };
  }

  // ---------- Wünsche, die erst die Unterkunftsseite prüfen kann (Ausstattung) ----------
  // check(x) bekommt die gespeicherten roomExtras; true/false/null. false nur, wenn die Ausstattung gelesen wurde.
  const has = k => x => (x?.features?.[k] ? true : x?.amenRead ? false : null);
  // Texte (label/ok/no/src) entstehen erst beim Lesen (Getter), damit die Sprache zur Anzeigezeit gilt.
  const wish = (k, o) => ({
    get label() { return tr(`extras.wish.${k}.label`); },
    get ok() { return tr(`extras.wish.${k}.ok`); },
    get no() { return o.noText === false ? null : tr(`extras.wish.${k}.no`); },
    check: o.check,
    get src() { return tr(`extras.src.${o.src}`); },
    ...(o.season ? { season: o.season } : {}),
  });
  const EXTRA_WISHES = {
    workspace: wish('workspace', { check: has('workspace'), src: 'amen' }),
    selfCheckin: wish('selfCheckin', { check: has('selfCheckin'), src: 'amen' }),
    bathtub: wish('bathtub', { check: has('bathtub'), src: 'amenDesc' }),
    view: wish('view', { check: x => (x?.features?.view ? true : null), src: 'amenDesc' }),
    washer: wish('washer', { check: has('washer'), src: 'amen' }),
    ac: wish('ac', { check: has('ac'), src: 'amen' }),
    parking: wish('parking', { check: x => (x?.parking?.garage || x?.parking?.street || x?.parking?.paid ? true : null), src: 'amenDesc' }),
    ev: wish('ev', { check: has('ev'), src: 'amen' }),
    bike: wish('bike', { check: x => (x?.features?.bike ? true : null), src: 'amenDesc' }),
    grill: wish('grill', { check: has('grill'), src: 'amen' }),
    blackout: wish('blackout', { check: has('blackout'), src: 'amen' }),
    garden: wish('garden', { check: has('garden'), src: 'amenDesc' }),
    baby: wish('baby', { check: has('crib'), src: 'amen' }),
    lock: wish('lock', { check: x => (x?.features?.lock ? true : null), src: 'amen' }),
    monitor: wish('monitor', { check: x => (x?.features?.monitor ? true : null), src: 'amen' }),
    fireplace: wish('fireplace', { check: has('fireplace'), src: 'amen', season: 'winter' }),
    sauna: wish('sauna', { check: has('sauna'), src: 'amen', season: 'winter' }),
    stepFree: wish('stepFree', { check: x => (x?.features?.stepFree || x?.floor?.ground ? true : x?.amenRead ? false : null), src: 'access' }),
    beach: wish('beach', { check: x => (x?.features?.beach ? true : null), src: 'amen' }),
    ski: wish('ski', { check: x => (x?.features?.ski ? true : null), src: 'amenDesc' }),
    petFree: wish('petFree', { check: x => (x?.allergy?.length ? false : null), src: 'descRules' }),
    hostOnSite: wish('hostOnSite', { check: (x, l) => (x?.hostNear || /privatzimmer|private room|chambre privée/i.test(S(l?.kind)) ? true : null), src: 'kindDesc', noText: false }),
  };
  // Profile: ein Klick setzt mehrere Wünsche
  const profile = (k, wishes) => ({ get label() { return tr('extras.profile.' + k); }, wishes });
  const PROFILES = {
    work: profile('work', ['wifi', 'workspace', 'quiet', 'selfCheckin']),
    holiday: profile('holiday', ['whole', 'trusted', 'clean']),
    solo: profile('solo', ['selfCheckin', 'trusted', 'reviews']),
    family: profile('family', ['whole', 'baby', 'washer', 'garden']),
  };
  // „ruhige ganze Wohnung mit WLAN unter 120“ → Wünsche und Budget (ohne KI, nur Wortliste)
  const SENTENCE = [
    [/ruhig|quiet/i, 'quiet'], [/sauber|clean/i, 'clean'], [/wlan|wifi|wi-fi|internet/i, 'wifi'], [/ganze|gesamte|eigene wohnung|whole|entire/i, 'whole'],
    [/superhost|favorit/i, 'trusted'], [/luxus|luxur/i, 'luxury'], [/arbeitsplatz|schreibtisch|homeoffice|workspace|desk/i, 'workspace'], [/badewanne|bathtub/i, 'bathtub'],
    [/aussicht|blick|view/i, 'view'], [/waschmaschine|washer/i, 'washer'], [/klima|\bac\b|air ?con/i, 'ac'], [/parkplatz|parken|parking/i, 'parking'],
    [/self[- ]?check|schlüsselbox/i, 'selfCheckin'], [/grill|bbq/i, 'grill'], [/garten|garden/i, 'garden'], [/kinderbett|baby/i, 'baby'], [/stufenlos|rollstuhl|barrierefrei/i, 'stepFree'],
    [/viele bewertungen|many reviews/i, 'reviews'], [/ladestation|e-auto|ev\b/i, 'ev'], [/fahrrad|bike/i, 'bike'], [/tierfrei|allergi/i, 'petFree'], [/kein gewerbe|privat/i, 'private'],
  ];
  function wishesFromSentence(t) {
    const s = S(t);
    const wishes = [...new Set(SENTENCE.filter(([re]) => re.test(s)).map(([, k]) => k))];
    const b = s.match(/(?:unter|bis|max(?:imal)?|höchstens|under|below|up to)\s*(\d{2,5})(?!\d)(?:\s*(?:€|eur|euro)|(?!\s*(?:personen|person|gäste|gästen|gast|min\w*|minutes?|people|guests?|persons?|km|meter|metern|nächte\w*|nights?|tage\w*|days?|betten|beds?|zimmer|rooms?|m²|m2)))/i);
    return { wishes, budgetNight: b ? +b[1] : null };
  }

  // Vorkasse-Text für die Gruppe: wer bucht, streckt vor
  function advanceText(total, people, cur, cancel) {
    if (!total || !people || people < 2) return '';
    const each = Math.ceil(total / people);
    const c = cancel?.kind === 'free' ? (cancel.until ? tr('extras.adv.freeUntil', { until: cancel.until }) : tr('extras.adv.free')) : cancel?.kind === 'nonrefundable' ? tr('extras.adv.nonref') : '';
    return tr('extras.adv.line', { total: money(total, cur), each: money(each, cur), people, c });
  }

  // ================= Teil 2: Suchseite (über alle bewerteten Karten) =================
  const med = a => { const x = a.filter(v => v != null && isFinite(v)).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
  const qt = (a, p) => { const x = a.filter(v => v != null && isFinite(v)).sort((u, v) => u - v); return x.length ? x[Math.min(x.length - 1, Math.max(0, Math.round((x.length - 1) * p)))] : null; };
  const title = l => { const t = String(l.title || l.kind || tr('extras.defaultTitle')); return t.length > 40 ? t.slice(0, 39) + '…' : t; };
  const isTrusted = l => (l.badges || []).some(b => /favorit|superhost/i.test(b));
  const curOf = l => R().normCur(l.currency) || '€';
  // Hauptwährung der Seite (die meisten Karten), damit € und $ nicht gemischt werden
  function mainCurrency(list) { const c = {}; for (const l of list) { const k = curOf(l); c[k] = (c[k] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '€'; }
  // Währung der Seite: die der meisten Karten mit gelesener Währung (kein „€“ erfinden: ohne Karten mit Währung null)
  function pageCurrency(list) { const c = {}; for (const l of list || []) { const k = R().normCur(l.currency); if (k) c[k] = (c[k] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || null; }
  const night = (l, nights) => (l.priceImplausible ? null : R().perNight(l, nights));
  const PRIVATE = /privatzimmer|private room|chambre privée|habitación privada|camera privata/i;

  // Preisanker: günstigstes Zehntel, Median, teuerstes Zehntel pro Nacht
  function priceAnchor(list, ctx = {}) {
    const cur = mainCurrency(list);
    const v = list.filter(l => curOf(l) === cur).map(l => night(l, ctx.nights)).filter(x => x != null);
    if (v.length < 8) return null;
    return { p10: qt(v, 0.1), median: med(v), p90: qt(v, 0.9), currency: cur, text: tr('extras.priceAnchor', { p10: money(qt(v, 0.1), cur), med: money(med(v), cur), p90: money(qt(v, 0.9), cur) }) };
  }
  // Budget-Hebel: was brächten 10 % mehr Budget?
  function budgetLever(list, ctx = {}) {
    const eb = R().effectiveBudget(ctx);
    const bn = ctx.budgetPerNight || (eb && ctx.nights ? eb / ctx.nights : null);
    if (!bn) return null;
    const extra = Math.max(5, Math.round(bn * 0.1));
    const gain = list.filter(l => { const n = night(l, ctx.nights); return n != null && n > bn && n <= bn + extra && isTrusted(l) && (l.rating || 0) >= 4.7; });
    return gain.length ? tr('extras.lever', { extra: money(extra, ctx.budgetCurrency || pageCurrency(list)), n: gain.length }) : null;
  }
  // Günstiger Zwilling: fast gleich gut (höchstens 3 Punkte weniger), deutlich günstiger
  function cheapTwins(top, list) {
    const ids = new Set(top.map(l => l.id)), out = [];
    top.forEach((t, i) => {
      if (t.rank?.stay == null) return;
      const c = list.filter(l => !ids.has(l.id) && !l.rank?.disliked && l.rank?.stay != null && curOf(l) === curOf(t) && l.rank.score >= t.rank.score - 3 && l.rank.stay <= t.rank.stay * 0.95)
        .sort((a, b) => a.rank.stay - b.rank.stay)[0];
      if (c) out.push({ for: i + 1, id: c.id, text: tr('extras.twin', { i: i + 1, title: title(c), score: c.rank.score, diff: money(t.rank.stay - c.rank.stay, c.currency) }) });
    });
    return out;
  }
  // Robuste Empfehlung: bleibt Platz 1, wenn Preis, Sterne oder Viertel etwas mehr zählen?
  function robustness(listings, ctx, topIds) {
    if (!topIds?.length || listings.length < 4) return null;
    const changed = [];
    for (const k of ['price', 'rating', 'area']) {
      const name = partName(k);
      const r = R().rankListings(listings, { ...ctx, weightTweak: { ...ctx.weightTweak, [k]: (Number(ctx.weightTweak?.[k]) || 1) * 1.3 } }).filter(l => !ctx.disliked?.has?.(l.id)).map(l => l.id);
      if (r[0] !== topIds[0]) changed.push(name);
    }
    return changed.length ? { stable: false, text: tr('extras.robust.close', { list: changed.join(tr('extras.or')) }) } : { stable: true, text: tr('extras.robust.stable') };
  }
  // Abstand zu Platz 1: wo fehlen die Punkte?
  const PART_KEYS = ['area', 'rating', 'price', 'wishes', 'beds', 'taste'];
  const partName = k => (PART_KEYS.includes(k) ? tr('extras.part.' + k) : k);
  function gapToFirst(l, first) {
    if (!first || l === first || !l.rank || !first.rank) return null;
    const pts = x => Object.fromEntries((x.rank.breakdown || []).map(b => [b.key, b.points]));
    const a = pts(l), b = pts(first);
    const diff = Object.keys({ ...a, ...b }).map(k => [k, (a[k] || 0) - (b[k] || 0)]).filter(([, d]) => d <= -1).sort((x, y) => x[1] - y[1]).slice(0, 2);
    const gap = first.rank.score - l.rank.score;
    if (gap <= 0) return null;
    return tr('extras.gap', { n: gap, detail: diff.length ? tr('extras.gap.detail', { list: diff.map(([k, d]) => `${partName(k)} ${Math.round(d)}`).join(', ') }) : '' });
  }
  // „Warum nicht Platz 1?“: Rang, Punkteabstand, die Teile mit dem größten Rückstand, Preisunterschied, eigene Warnungen
  function whyNotFirst(l, first, pos = {}) {
    if (!l?.rank) return [];
    const at = pos.rank ? (pos.of ? tr('extras.atOf', { rank: pos.rank, of: pos.of }) : tr('extras.at', { rank: pos.rank })) : null;
    if (!first || l === first || l.id === first.id) return [tr('extras.why.best', { at: at || tr('extras.first'), score: l.rank.score })];
    const out = [`${at ? at + ': ' : ''}${tr('extras.why.behind', { n: first.rank.score - l.rank.score, title: title(first) })}`];
    const pts = x => Object.fromEntries((x.rank.breakdown || []).map(b => [b.key, b.points]));
    const a = pts(l), b = pts(first);
    for (const [k, d] of Object.keys({ ...a, ...b }).map(k => [k, (a[k] || 0) - (b[k] || 0)]).filter(([, d]) => d <= -1).sort((x, y) => x[1] - y[1]).slice(0, 3))
      out.push(tr('extras.why.part', { part: partName(k), a: Math.round(a[k] || 0), b: Math.round(b[k] || 0), d: Math.round(d) }));
    for (const [k, d] of Object.keys({ ...a, ...b }).map(k => [k, (a[k] || 0) - (b[k] || 0)]).filter(([, d]) => d >= 1).slice(0, 1))
      out.push(tr('extras.why.better', { part: partName(k), d: Math.round(d) }));
    if (l.rank.stay != null && first.rank.stay != null && curOf(l) === curOf(first) && Math.abs(l.rank.stay - first.rank.stay) >= 10)
      out.push(tr(l.rank.stay > first.rank.stay ? 'extras.why.dearer' : 'extras.why.cheaper', { diff: money(Math.abs(l.rank.stay - first.rank.stay), l.currency), stay: money(l.rank.stay, l.currency) }));
    for (const w of (l.rank.warn || []).slice(0, 2)) out.push('⚠️ ' + w);
    return out;
  }
  // Rabattschwellen bei 7 und 28 Nächten
  function discountThreshold(nights) {
    if (nights === 5 || nights === 6) return tr('extras.disc.week');
    if (nights >= 25 && nights <= 27) return tr('extras.disc.month');
    return null;
  }
  // Dieselbe Suche mit Anreise ±1 Tag (du öffnest die Links selbst, nichts wird geladen)
  function shiftLinks(url) {
    let u; try { u = new URL(url); } catch { return []; }
    const ciK = u.searchParams.has('checkin') ? 'checkin' : u.searchParams.has('check_in') ? 'check_in' : null;
    const coK = ciK === 'checkin' ? 'checkout' : 'check_out';
    const ci = ciK && u.searchParams.get(ciK), co = u.searchParams.get(coK);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ci || '') || !/^\d{4}-\d{2}-\d{2}$/.test(co || '')) return [];
    const shift = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
    return [-1, 1].map(n => { const x = new URL(u); x.searchParams.set(ciK, shift(ci, n)); x.searchParams.set(coK, shift(co, n)); for (const k of ['items_offset', 'cursor', 'pagination_search']) x.searchParams.delete(k); return { label: tr(n < 0 ? 'extras.shift.earlier' : 'extras.shift.later'), url: x.href }; });
  }
  // Filter-Vorschlag: „Mindestens 2 Schlafzimmer setzen entfernt 18 unpassende“
  function filterSuggestion(url, list, people) {
    if (!people || people < 3) return null;
    const need = Math.ceil(people / 2);
    const bad = list.filter(l => l.bedrooms != null && l.bedrooms < need).length;
    if (bad < 5) return null;
    let u; try { u = new URL(url); } catch { return null; }
    if (+u.searchParams.get('min_bedrooms') >= need) return null;
    u.searchParams.set('min_bedrooms', String(need));
    return { url: u.href, text: tr('extras.filter', { need, bad }) };
  }
  // Allein reisen: gut bewertetes Privatzimmer als günstige Alternative zur ganzen Wohnung
  function soloAlternative(list, top, ctx = {}) {
    if (ctx.people !== 1 || !top[0]) return null;
    const t = top[0], tn = night(t, ctx.nights);
    if (!tn || PRIVATE.test(`${t.kind} ${t.title}`)) return null;
    const c = list.filter(l => PRIVATE.test(String(l.kind)) && isTrusted(l) && (l.rating || 0) >= 4.7 && curOf(l) === curOf(t) && night(l, ctx.nights) != null && night(l, ctx.nights) <= tn * 0.6)
      .sort((a, b) => night(a, ctx.nights) - night(b, ctx.nights))[0];
    return c ? { id: c.id, text: tr('extras.solo', { title: title(c), pct: Math.round((1 - night(c, ctx.nights) / tn) * 100) }) } : null;
  }
  // Ausreißer gegen die eigene Filterblase: sehr gut bewertet, aber anders als dein Geschmack
  function outlierPick(list, top, ctx = {}) {
    if (!ctx.taste) return null;
    const ids = new Set(top.map(l => l.id));
    const c = list.filter(l => !ids.has(l.id) && !l.rank?.disliked && l.rank?.parts?.taste != null && l.rank.parts.taste <= 0.5 && (l.rating || 0) >= 4.9 && (l.reviewCount || 0) >= 20 && l.rank.score >= 55)
      .sort((a, b) => b.rank.score - a.rank.score)[0];
    return c ? { id: c.id, text: tr('extras.outlier', { title: title(c), rating: sep(c.rating, 2), score: c.rank.score }) } : null;
  }
  // Weiterblättern lohnt nicht mehr: die zuletzt geöffnete Seite brachte nichts für die Top 3
  function stopPaging(pool, list, top) {
    if (!pool || (pool.pages || []).length < 3 || top.length < 3) return null;
    const last = pool.pages.at(-1), min = Math.min(...top.map(l => l.rank.score));
    const lastIds = new Set(Object.values(pool.items || {}).filter(i => i.page === last).map(i => i.id));
    if (!lastIds.size) return null;
    const better = list.filter(l => lastIds.has(l.id) && l.rank.score >= Math.max(70, min)).length;
    return better ? null : tr('extras.stopPaging');
  }
  // Kartenausschnitt-Tipp: alle besten Treffer in einer Ecke
  function mapCorner(list, top) {
    const pts = list.filter(l => l.lat != null && l.lon != null);
    const tp = top.filter(l => l.lat != null && l.lon != null);
    if (pts.length < 15 || tp.length < 3) return null;
    const lats = pts.map(l => l.lat), lons = pts.map(l => l.lon);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2, midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const quad = l => (l.lat >= midLat ? 'n' : 's') + (l.lon >= midLon ? 'e' : 'w');
    const qs = new Set(tp.map(quad));
    return qs.size === 1 ? tr('extras.mapCorner', { q: tr('extras.quad.' + [...qs][0]) }) : null;
  }
  // Budget-Rest für Platz 1 (Reisebudget ist in €)
  function budgetRest(first, ctx = {}) {
    const eb = R().effectiveBudget(ctx);
    if (!first || !eb || first.rank?.stay == null || first.rank?.parts?.price == null) return null;
    const share = first.rank.stay / eb;
    if (share > 1) return null;
    const rest = eb - first.rank.stay;
    return tr('extras.rest', { pct: Math.round(share * 100), rest: money(rest, ctx.budgetCurrency || R().normCur(first.currency)), pp: ctx.people > 1 ? tr('extras.rest.pp', { amount: money(rest / ctx.people, ctx.budgetCurrency || R().normCur(first.currency)) }) : '' });
  }
  // Was kostet ein Stern mehr? Lineare Regression Nachtpreis gegen Sterne (ab 10 Karten mit ≥ 5 Bewertungen)
  function starPrice(list, ctx = {}) {
    const cur = mainCurrency(list);
    const pts = list.filter(l => l.rating != null && (l.reviewCount || 0) >= 5 && curOf(l) === cur).map(l => [l.rating, night(l, ctx.nights)]).filter(([, y]) => y != null);
    if (pts.length < 10) return null;
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    const sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0), sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0);
    if (sxx < 0.01) return null;
    const per01 = sxy / sxx * 0.1;
    return per01 >= 1 ? tr('extras.starPrice', { amount: money(per01, cur) }) : null;
  }
  // Gesamtpreis-Schalter: Airbnb zeigt Nachtpreise ohne Gebühren
  function totalSwitchHint(list, nights) {
    const known = list.filter(l => l.priceWord && l.totalPrice != null);
    if (!nights || nights < 2 || known.length < 5) return null;
    return known.every(l => !l.isTotal) ? tr('extras.totalSwitch') : null;
  }
  // Preisanzeige wechselt zwischen den gesammelten Seiten (Gesamt- und Nachtpreise gemischt)
  function mixedUnits(pool) {
    const by = {};
    for (const i of Object.values(pool?.items || {})) if (i.priceWord && i.totalPrice != null) (by[i.page] ||= new Set()).add(i.isTotal ? 'T' : 'N');
    const units = new Set(Object.values(by).flatMap(x => x.size === 1 ? [...x] : []));
    return Object.keys(by).length >= 2 && units.size === 2 ? tr('extras.mixedUnits') : null;
  }
  // Zwei Wohnungen nebeneinander (unter 200 m) für große Gruppen, zusammen günstiger als die günstigste große?
  function distM(a, b) { const C = root.StayMatchCore; if (C?.distM) return C.distM(a, b); const r = Math.PI / 180, x = (b.lon - a.lon) * r * Math.cos((a.lat + b.lat) / 2 * r), y = (b.lat - a.lat) * r; return Math.sqrt(x * x + y * y) * 6371000; }
  function twoFlats(list, ctx = {}) {
    const people = ctx.people || 0;
    if (people < 6) return null;
    const cap = l => l.sleeps ?? l.beds ?? null;
    const big = list.filter(l => cap(l) >= people && l.rank?.stay != null).sort((a, b) => a.rank.stay - b.rank.stay)[0];
    const small = list.filter(l => l.lat != null && cap(l) != null && cap(l) < people && l.rank?.stay != null && (l.rating == null || l.rating >= 4.5)).slice(0, 200);
    let best = null;
    for (let i = 0; i < small.length; i++) for (let j = i + 1; j < small.length; j++) {
      const a = small[i], b = small[j];
      if (cap(a) + cap(b) < people || curOf(a) !== curOf(b)) continue;
      const d = distM(a, b);
      if (d > 200) continue;
      const sum = a.rank.stay + b.rank.stay;
      if (!best || sum < best.sum) best = { a, b, sum, d };
    }
    if (!best || (big && (curOf(big) !== curOf(best.a) || best.sum >= big.rank.stay * 0.95))) return null;
    return { ids: [best.a.id, best.b.id], text: tr('extras.twoFlats', { d: Math.round(best.d), a: title(best.a), b: title(best.b), sum: money(best.sum, best.a.currency), less: big ? tr('extras.twoFlats.less', { amount: money(big.rank.stay - best.sum, best.a.currency) }) : '' }) };
  }
  // Ungewöhnlich teuer / Wochenend-Aufschlag aus deinen eigenen früheren Suchen (log: [{ path, ci, nights, med, cur }])
  function priceHistoryNotes(log, now) {
    const out = [];
    if (!now || !now.med) return out;
    const same = (log || []).filter(e => e.path === now.path && e.cur === now.cur && e.ci !== now.ci && e.med);
    const prev = same.at(-1);
    if (prev && now.med / prev.med >= 1.5) out.push(tr('extras.hist.dear', { x: sep(now.med / prev.med), ci: prev.ci }));
    const wk = e => { const d = new Date(e.ci + 'T12:00:00Z').getUTCDay(); return (d === 5 || d === 6) && e.nights <= 3; };
    const all = [...same, now].filter(e => e.ci && e.nights);
    const we = med(all.filter(wk).map(e => e.med)), wd = med(all.filter(e => !wk(e) && e.nights <= 4).map(e => e.med));
    if (we && wd && we / wd >= 1.1) out.push(tr('extras.hist.weekend', { pct: Math.round((we / wd - 1) * 100) }));
    return out;
  }
  // Alles für den Abschnitt „Mehr zu dieser Seite“

  // „Seit deinem letzten Besuch“: Vergleich der Trefferliste dieser Suche mit dem Stand des vorigen Besuchs (alles lokal).
  // entry: { base: {id:[preis,isTotal]}|null, basePages, baseAt, cur: {...}, curPages, curAt }. Ein neuer Besuch beginnt nach 30 Minuten Pause.
  // „Verschwunden“ nur, wenn heute mindestens so viele Seiten offen waren wie damals (sonst fehlen die Treffer nur, weil du nicht geblättert hast).
  const VISIT_GAP = 30 * 60e3, VISIT_MAX = 12;
  function sinceLastVisit(entry, listings, pages = 1, now = Date.now()) {
    const cur = {};
    for (const l of listings || []) if (l?.id) cur[l.id] = [l.totalPrice ?? null, !!l.isTotal];
    let e = entry && entry.cur ? { ...entry } : null;
    if (e && now - (e.curAt || 0) > VISIT_GAP) e = { base: e.cur, basePages: e.curPages || 1, baseAt: e.curAt, cur: {}, curPages: 0, curAt: now };
    if (!e) e = { base: null, basePages: 0, baseAt: 0, cur: {}, curPages: 0, curAt: now };
    const merged = { ...e.cur, ...cur }; // Seiten desselben Besuchs sammeln sich an
    const next = { ...e, cur: merged, curPages: Math.max(e.curPages || 0, pages), curAt: now };
    if (!e.base) return { entry: next, diff: null };
    const base = e.base, ids = Object.keys(merged);
    const fresh = ids.filter(id => !(id in base));
    const cheaper = ids.filter(id => id in base && base[id][0] != null && merged[id][0] != null && base[id][1] === merged[id][1] && merged[id][0] <= base[id][0] * 0.97)
      .map(id => ({ id, from: base[id][0], to: merged[id][0] }));
    const dearer = ids.filter(id => id in base && base[id][0] != null && merged[id][0] != null && base[id][1] === merged[id][1] && merged[id][0] >= base[id][0] * 1.03).length;
    const gone = pages >= (e.basePages || 1) ? Object.keys(base).filter(id => !(id in merged)) : [];
    return { entry: next, diff: { since: e.baseAt, fresh, cheaper, dearer, gone } };
  }
  function visitStore(visits, key, entry) {
    const all = { ...(visits || {}), [key]: entry };
    const keys = Object.keys(all).sort((a, b) => (all[b].curAt || 0) - (all[a].curAt || 0)).slice(0, VISIT_MAX);
    return Object.fromEntries(keys.map(k => [k, all[k]]));
  }
  function visitText(d, now = Date.now()) {
    if (!d || !(d.fresh.length || d.cheaper.length || d.gone.length)) return null;
    const days = Math.max(0, Math.floor((now - d.since) / 864e5));
    const when = days === 0 ? tr('extras.visit.today') : days === 1 ? tr('extras.visit.yesterday') : tr('extras.visit.ago', { days });
    const parts = [d.fresh.length && tr('extras.visit.new', { c: d.fresh.length }), d.cheaper.length && tr('extras.visit.cheaper', { c: d.cheaper.length }), d.gone.length && tr('extras.visit.gone', { c: d.gone.length })].filter(Boolean);
    return tr('extras.visit.line', { when, parts: jn(parts) });
  }

  function pageInsights(list, top, ctx = {}, opt = {}) {
    const lines = [];
    const add = x => { if (x) lines.push(typeof x === 'string' ? x : x.text); };
    add(totalSwitchHint(list, ctx.nights));
    add(mixedUnits(opt.pool));
    add(priceAnchor(list, ctx));
    add(budgetRest(top[0], ctx));
    add(budgetLever(list, ctx));
    cheapTwins(top, list).forEach(add);
    add(soloAlternative(list, top, ctx));
    add(twoFlats(list, ctx));
    add(outlierPick(list, top, ctx));
    add(discountThreshold(ctx.nights));
    add(starPrice(list, ctx));
    add(stopPaging(opt.pool, list, top));
    add(mapCorner(list, top));
    (opt.history || []).forEach(add);
    add(cancelTradeoff(top, ctx.known));
    add(opt.lastYear);
    if (opt.listings) add(robustness(opt.listings, ctx, top.map(l => l.id)));
    return lines;
  }

  // ================= Teil 3: Popup und Verlauf =================
  // Link-Echtheit: exakt eine Airbnb-Domain aus der Liste? Nachbauten („airbnb-secure-pay.com“) erkennen
  const OFFICIAL_EXTRA = ['abnb.me', 'airbnb.hu', 'airbnb.co.in'];
  function linkCheck(url, domains) {
    let u; try { u = new URL(String(url).trim()); } catch { return { ok: false, text: tr('extras.link.invalid') }; }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    // abnb.me ist die offizielle Kurzlink-Domain; weitere offizielle Landesdomains
    if (domains.includes(host) || OFFICIAL_EXTRA.includes(host)) return u.protocol === 'https:' ? { ok: true, text: tr('extras.link.ok', { host }) } : { ok: false, text: tr('extras.link.nohttps') };
    if (/a[i1l]r[bh]n[bh]|airbnb/i.test(host)) return { ok: false, scam: true, text: tr('extras.link.fake', { host }) };
    return { ok: false, text: tr('extras.link.foreign', { host }) };
  }
  // Merkliste eines Freundes (Text aus „Merkliste kopieren“): Unterkunfts-Ids einsammeln
  function friendIds(text) { return [...new Set([...S(text).matchAll(/\/rooms\/(?:[a-z]+\/)?(\d+)/g)].map(m => m[1]))]; }
  // Gebuchte Etappen als Text: Reihenfolge, Daten, Preis pro Kopf, Storno-Kette, Wechselkosten (Reinigung)
  function tripsText(items) {
    const b = (items || []).filter(i => i.booked).sort((a, c) => S(a.booked.checkin).localeCompare(S(c.booked.checkin)));
    if (!b.length) return '';
    const lines = [tr('extras.trip.head')];
    let clean = 0, cleanCur = null, cleanN = 0;
    b.forEach((i, n) => {
      const k = i.booked, pp = k.total && k.people > 1 ? tr('extras.trip.pp', { amount: money(k.total / k.people, k.currency) }) : k.total ? ` · ${money(k.total, k.currency)}` : '';
      lines.push('', `${n + 1}. ${i.title || tr('extras.defaultTitle')}${i.locality ? ` (${i.locality})` : ''}`, `   ${tr('extras.trip.dates', { from: k.checkin || '?', to: k.checkout || '?' })}${pp}`,
        `   ${tr('extras.trip.cancel', { x: k.cancel ? (k.cancel !== 'ja' ? tr('extras.trip.freeUntil', { d: k.cancel }) : tr('extras.trip.free')) : tr('extras.trip.notFree') })}`);
      if (i.url) lines.push(`   ${i.url}`);
      if (i.extra?.fees?.cleaning) { clean += i.extra.fees.cleaning; cleanCur = i.extra.fees.currency; cleanN++; }
    });
    if (b.length >= 2 && cleanN >= 2) lines.push('', tr('extras.trip.clean', { c: cleanN, amount: money(clean, cleanCur) }));
    return lines.join('\n');
  }
  // Datenauskunft: was liegt lokal?
  function storageSummary(all) {
    const ls = Object.entries(all || {}).filter(([k]) => k.startsWith('l:')).map(([, v]) => v);
    const n = f => ls.filter(f).length;
    return [
      tr('extras.store.history', { c: ls.length, up: n(i => i.vote === 1), down: n(i => i.vote === -1), notes: n(i => i.note), booked: n(i => i.booked) }),
      tr('extras.store.excerpts', { a: n(i => i.reviewTexts?.length), b: n(i => i.priceHistory?.length) }),
      all?.trip ? tr('extras.store.trip', { city: all.trip.city || '?', c: all.trip.people?.length || 0 }) : tr('extras.store.noTrip'),
      all?.pool ? tr('extras.store.pool', { c: (all.pool.pages || []).length }) : null,
      all?.priceLog?.length ? tr('extras.store.priceLog', { c: all.priceLog.length }) : null,
      all?.friendLikes ? tr('extras.store.friends', { c: Object.keys(all.friendLikes).length }) : null,
      tr('extras.store.local'),
    ].filter(Boolean);
  }

  // ================= Teil 4: weitere Hinweise =================
  // Last-Minute- oder Frühbucher-Rabatt im Buchungsbereich
  const lastMinute = t => /last[- ]?minute|kurzfristig\w* rabatt|frühbucher\w*|early[- ]bird|réduction de dernière minute|descuento de última hora/i.test(S(t));
  // Rabatt-Ehrlichkeit: war der „Normalpreis“ bei einem früheren Besuch (gleiche Reise) schon so niedrig?
  function discountHonesty(was, now, history, key) {
    if (!was || !now || was <= now) return null;
    const same = (history || []).filter(e => e.p && key(e));
    const low = same.length ? Math.min(...same.map(e => e.p)) : null;
    return low != null && low <= now * 1.02 ? tr('extras.honesty', { low: fmt(low) }) : null;
  }
  // Teilbewertungen (Sauberkeit, Genauigkeit, Check-in, Kommunikation, Lage, Preis-Leistung)
  const SUB = { clean: /sauberkeit|cleanliness|propreté|limpieza|pulizia/i, accuracy: /genauigkeit|accuracy|exactitude|veracidad|precisione/i, checkin: /check-?in|arrivée|llegada/i,
    communication: /kommunikation|communication|comunicación|comunicazione/i, location: /\blage\b|location|emplacement|ubicación|posizione/i, value: /preis-leistung|value|qualité-prix|calidad-precio|qualità-prezzo/i };
  function subRatings(t) {
    const out = {};
    for (const line of S(t).split(/\n/)) for (const [k, re] of Object.entries(SUB)) {
      if (out[k] != null || !re.test(line)) continue;
      const m = line.match(/(\d)[.,](\d)\b/) || null;
      if (m) out[k] = +(m[1] + '.' + m[2]);
    }
    // „Sauberkeit\n4,5“: Zahl in der nächsten Zeile
    const lines = S(t).split(/\n/).map(x => x.trim());
    lines.forEach((l, i) => { for (const [k, re] of Object.entries(SUB)) if (out[k] == null && re.test(l) && l.length < 30) { const m = (lines[i + 1] || '').match(/^(\d)[.,](\d)$/); if (m) out[k] = +(m[1] + '.' + m[2]); } });
    return Object.fromEntries(Object.entries(out).filter(([, v]) => v >= 1 && v <= 5));
  }
  const subName = k => tr('extras.sub.' + k);
  function subRatingNotes(sub, wishes) {
    const warn = [], info = [];
    if (!sub || !Object.keys(sub).length) return { warn, info };
    if ((wishes || []).includes('clean') && sub.clean != null && sub.clean < 4.6) warn.push(tr('extras.sub.warnClean', { v: sep(sub.clean) }));
    const low = Object.entries(sub).filter(([k, v]) => v < 4.5 && !(k === 'clean' && (wishes || []).includes('clean'))).map(([k, v]) => `${subName(k)} ${sep(v)}`);
    if (low.length) info.push(tr('extras.sub.low', { list: jn(low) }));
    return { warn, info };
  }
  // Kontaktdaten markiert (Telefon, Mail): außerhalb der Plattform zahlen ist ein häufiger Betrug
  const contactLike = t => /[\w.+-]+@[\w-]+\.[a-z]{2,}|(?:\+|00)\d[\d\s()/-]{7,}\d|(?<![\w.\-/])0[1-9]\d{1,4}[\s/-]?\d{6,}(?!\d)/i.test(S(t));
  // Gastgeber hat viele Bewertungen (Bilanz für neue Inserate)
  function hostReviewCount(t) { const m = S(t).match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:bewertungen|reviews|commentaires|evaluaciones|reseñas|recensioni)/i); return m ? +m[1].replace(/[.,]/g, '') : null; }
  // Storno-Preis-Abwägung: zwei fast gleich gute Top-Inserate, eines kostenlos stornierbar (von der Unterkunftsseite bekannt)
  function cancelTradeoff(top, known) {
    const k = l => known?.get?.(l.id)?.cancellation?.kind || null;
    for (let i = 0; i < top.length; i++) for (let j = 0; j < top.length; j++) {
      const a = top[i], b = top[j];
      if (i === j || k(a) !== 'free' || !k(b) || k(b) === 'free' || a.rank?.stay == null || b.rank?.stay == null) continue;
      if (Math.abs(a.rank.score - b.rank.score) > 5 || a.rank.stay <= b.rank.stay) continue;
      return tr('extras.cancelTradeoff', { i: i + 1, diff: money(a.rank.stay - b.rank.stay, a.currency), j: j + 1 });
    }
    return null;
  }
  // Vorjahresvergleich: früher gebuchte Unterkunft in derselben Stadt
  function lastYear(booked, cityPath, medNow, cur) {
    const city = decodeURIComponent(String(cityPath || '').split('/')[2] || '').split(/--|[–,]/)[0].replace(/-/g, ' ').trim().toLowerCase();
    if (!city || !medNow) return null;
    const b = (booked || []).filter(i => i.booked && i.pricePerNight && String(i.city || i.locality || '').toLowerCase().replace(/-/g, ' ').includes(city) && (R().normCur(i.currency) || '€') === cur && i.booked.checkin)
      .sort((x, y) => S(y.booked.checkin).localeCompare(S(x.booked.checkin)))[0];
    return b ? tr('extras.lastYear', { ci: b.booked.checkin, p: money(b.pricePerNight, b.currency), m: money(medNow, cur) }) : null;
  }

  root.StayMatchExtras = {
    claimConflicts, lastMinute, discountHonesty, subRatings, subRatingNotes, contactLike, hostReviewCount, cancelTradeoff, lastYear,
    linkCheck, friendIds, tripsText, storageSummary,
    priceAnchor, whyNotFirst, budgetLever, cheapTwins, robustness, gapToFirst, discountThreshold, shiftLinks, filterSuggestion, soloAlternative, outlierPick, stopPaging, mapCorner,
    budgetRest, starPrice, totalSwitchHint, mixedUnits, twoFlats, priceHistoryNotes, pageInsights, sinceLastVisit, visitStore, visitText, VISIT_GAP, mainCurrency, pageCurrency,
    advanceText,
    deposit, extraGuestFee, extraGuestCost, onSiteCosts, checkoutChores, fees, feeShare, parkingInfo, diningSeats, dishesFor, bedWidth, area, floorInfo,
    features, coffee, kitchenLevel, minAge, petLimits, petFee, allergy, ruleCount, hostExtra, license, greenClaims, superlatives, dayLength,
    roomExtras, roomNotes, isColdSeason, EXTRA_WISHES, PROFILES, wishesFromSentence, FEATURES, money, _R: R,
  };
})(typeof window !== 'undefined' ? window : globalThis);
