// StayMatch – Zusatz-Hinweise (Runde 7 E). Reine Funktionen ohne chrome.* und ohne DOM.
// Teil 1: Texte der Unterkunftsseite (Beschreibung, Hausregeln, Ausstattung, Gastgeber, Buchungsbereich).
// Teil 2: Auswertungen über alle Karten der Suchseite (Preisanker, Lockpreis, Zwilling, Stabilität …).
// Alle Texte sind deutsch und stehen hier lokal (später nach i18n.js). Ungeprüft live: wie Airbnb die Abschnitte genau schreibt.
(function (root) {
  const P = root.StayMatchParse || (typeof require === 'function' ? (require('./parse.js'), globalThis.StayMatchParse) : null);
  const R = () => root.StayMatchRank || globalThis.StayMatchRank;
  const S = v => String(v || '');
  const sep = (n, d = 1) => String(Math.round(n * 10 ** d) / 10 ** d).replace('.', ',');
  const fmt = v => Math.round(v).toLocaleString('de-DE');
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
    [/strom\s+(?:nach|wird nach)\s+verbrauch|electricity (?:is )?(?:charged|paid) (?:separately|by consumption|on site)|électricité en sus/i, 'Strom nach Verbrauch'],
    [/heiz(?:kosten|ung)\s+(?:nach verbrauch|extra|wird extra)|heating (?:is )?(?:charged|extra)/i, 'Heizkosten extra'],
    [/(?:kurtaxe|ortstaxe|city tax|tourist tax|taxe de séjour|tasa turística|tassa di soggiorno)[^.\n]{0,40}(?:bar|vor ort|in cash|on site|on arrival|sur place|en efectivo|in contanti)/i, 'Kurtaxe vor Ort'],
    [/endreinigung[^.\n]{0,30}vor ort|final cleaning[^.\n]{0,30}(?:on site|on arrival|cash)|ménage final[^.\n]{0,30}sur place/i, 'Endreinigung vor Ort'],
    [/bettwäsche[^.\n]{0,40}(?:gegen gebühr|gegen aufpreis|kostenpflichtig|extra|mieten)|(?:bed )?linens?[^.\n]{0,30}(?:for a fee|extra charge|not included|available for rent)|draps[^.\n]{0,30}(?:en supplément|non fournis)/i, 'Bettwäsche/Handtücher gegen Gebühr'],
  ];
  const onSiteCosts = t => ONSITE.filter(([re]) => re.test(S(t))).map(([, l]) => l);

  // Putzliste beim Check-out
  const CHORES = [
    [/spülmaschine|geschirr\s+(?:spülen|abwaschen)|dishwasher|wash (?:the )?dishes|vaisselle/i, 'Geschirr'],
    [/bettwäsche\s+abziehen|betten\s+abziehen|strip (?:the )?beds?|enlever les draps/i, 'Betten abziehen'],
    [/müll|abfall|trash|garbage|rubbish|poubelles?/i, 'Müll'],
    [/handtücher\s+(?:sammeln|zusammen)|towels? (?:in|into) (?:a )?pile|gather (?:the )?towels/i, 'Handtücher'],
    [/staubsaugen|fegen|vacuum|sweep/i, 'Saugen/Fegen'],
    [/waschmaschine\s+(?:anstellen|laufen)|start (?:a |the )?(?:laundry|washing machine)/i, 'Wäsche'],
  ];
  function checkoutChores(t) {
    const s = S(t);
    const m = s.match(/(?:vor (?:der |deiner )?abreise|beim check-?out|check-?out[- ]?(?:anweisungen|anleitung|instructions)|before you leave|avant de partir)[\s\S]{0,400}/i);
    const part = m ? m[0] : '';
    return CHORES.filter(([re]) => re.test(part)).map(([, l]) => l);
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
  function area(t) { const m = S(t).match(/(\d{2,4})\s*(?:m²|m2|qm|quadratmeter|sq\.?\s*m|square met(?:er|re)s?)(?![\p{L}\d])/iu); const v = m ? +m[1] : null; return v && v >= 8 && v <= 2000 ? v : null; }
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
    workspace: /arbeitsplatz|schreibtisch|arbeitsbereich|dedicated workspace|workspace|desk\b|espace de travail|escritorio|scrivania/i,
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
    fireplace: /kamin|fireplace|cheminée|chimenea|camino/i,
    sauna: /sauna/i,
    fridge: /kühlschrank|refrigerator|fridge|réfrigérateur|frigorífico|nevera|frigorifero/i,
    miniFridge: /minikühlschrank|mini[- ]?(?:fridge|kühlschrank)|minibar|kühlfach/i,
    freezer: /gefrierfach|gefrierschrank|tiefkühl\w*|freezer|congélateur|congelador/i,
    oven: /backofen|ofen\b|\boven\b|four\b|horno|forno/i,
    stove: /herd|kochfeld|stove|cooktop|cuisinière|plaques? de cuisson|vitrocerámica|fornelli/i,
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
    [/nespresso|kapselmaschine|kaffeekapsel|pod coffee|capsule|dolce gusto|tassimo|senseo|keurig/i, 'Kapselmaschine'],
    [/siebträger|espressomaschine|espresso machine|machine à expresso|cafetera express/i, 'Espressomaschine'],
    [/vollautomat|kaffeevollautomat|bean[- ]to[- ]cup/i, 'Vollautomat'],
    [/filterkaffee|filtermaschine|kaffeemaschine|drip coffee|coffee maker|cafetière filtre|cafetera de goteo/i, 'Filterkaffee'],
    [/french press|stempelkanne|cafetière à piston/i, 'French Press'],
    [/moka|herdkanne|espressokocher|bialetti/i, 'Herdkanne'],
    [/instant|löslich\w* kaffee|nescafé/i, 'nur Instant'],
  ];
  function features(t) {
    const out = {};
    for (const [k, re] of Object.entries(FEATURES)) if (present(t, re)) out[k] = true;
    return out;
  }
  const coffee = t => { const s = S(t); const hit = COFFEE.find(([re]) => re.test(s)); return hit ? hit[1] : null; };
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
    if (/nur kleine? (?:hunde|haustiere|tiere)|small (?:dogs|pets) only|only small (?:dogs|pets)|petits chiens uniquement/i.test(s)) out.push('nur kleine Tiere');
    const m = s.match(/(?:max(?:imal|\.)?|höchstens|up to|maximum(?: of)?)\s*(\d)\s*(?:haustier\w*|hund\w*|tier\w*|pets?|dogs?|animaux)/i);
    if (m) out.push(`höchstens ${m[1]} ${+m[1] === 1 ? 'Tier' : 'Tiere'}`);
    if (/keine katzen|no cats|pas de chats/i.test(s)) out.push('keine Katzen');
    if (/keine hunde|no dogs|pas de chiens/i.test(s)) out.push('keine Hunde');
    return out;
  }
  const petFee = t => amountAfter(t, /haustiergebühr|gebühr für (?:haus)?tiere|tierpauschale|pet fee|pet cleaning fee|frais (?:pour )?animaux|tarifa (?:por )?mascota/i, 40);
  // Allergie: Tiere leben in der Unterkunft, Teppich, Federbetten
  const ALLERGY = [
    [/(?:katze|kater)\s+(?:lebt|wohnt)|(?:unsere?|meine?)\s+katzen?\b|cat lives|resident cat|(?:our|my) cats?\b|chat vit/i, 'Katze lebt in der Unterkunft'],
    [/(?:hund)\s+(?:lebt|wohnt)|(?:unser|mein)\s+hund\b|dog lives|resident dog|(?:our|my) dogs?\b|chien vit/i, 'Hund lebt in der Unterkunft'],
    [/teppichboden|teppiche\b|carpet(?:ed|ing)?\b|moquette/i, 'Teppichboden'],
    [/federbett\w*|daunen\w*|feather (?:duvet|pillows?)|down (?:duvet|comforter|pillows?)|couette en plumes/i, 'Federbetten/Daunen'],
  ];
  const allergy = t => ALLERGY.filter(([re]) => re.test(S(t))).map(([, l]) => l);
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
  const GREEN = [[/ökostrom|grüner strom|green (?:energy|electricity)|renewable energy|énergie verte/i, 'Ökostrom'], [/solar\w*|photovoltaik|solar panels?|panneaux solaires/i, 'Solar'],
    [/wärmepumpe|heat pump|pompe à chaleur/i, 'Wärmepumpe'], [/mülltrennung|recycling|tri sélectif|reciclaje/i, 'Mülltrennung']];
  const greenClaims = t => GREEN.filter(([re]) => re.test(S(t))).map(([, l]) => l);
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
  const CLAIMS = [['ruhig', /\bruhig\w*|quiet|calme|tranquil/i, /⚠️ (laut|hellhörig|Baustelle|Ohrstöpsel)/], ['schnelles WLAN', /schnell\w* (wlan|internet|wifi)|fast (wifi|internet)|glasfaser|fibre|fiber/i, /⚠️ WLAN/],
    ['sauber', /blitzsauber|sehr sauber|spotless|impeccably clean/i, /⚠️ (schmutzig|Geruch|Ungeziefer)/], ['hell', /lichtdurchflutet|sehr hell|bright|lumineux|luminoso/i, /⚠️ dunkel/]];
  const claims = t => CLAIMS.filter(([, re]) => re.test(S(t))).map(([l]) => l);
  // Abgleich mit den Bewertungs-Stichworten
  function claimConflicts(cl, hints) {
    return (cl || []).map(l => { const c = CLAIMS.find(x => x[0] === l); const bad = c && (hints || []).find(x => c[2].test(x)); return bad ? `Inserat sagt „${l}“, Gäste sagen „${bad.replace(/^⚠️\s*/, '')}“` : null; }).filter(Boolean);
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
    const summer = month && (south ? [12, 1, 2] : [6, 7, 8]).includes(month);
    const winter = month && (south ? [5, 6, 7, 8, 9] : [11, 12, 1, 2, 3]).includes(month);
    const cur = ctx.currency || x.fees?.currency || null;
    // Preis
    if (x.deposit) info.push(`Kaution ${money(x.deposit.amount, x.deposit.currency)} (kommt zurück, aber erst später)`);
    const eg = extraGuestCost(x.extraGuest, people, ctx.nights);
    if (eg) warn.push(`Zusatzgast-Gebühr: etwa ${money(eg, x.extraGuest.currency)} für ${people} Personen (ab ${x.extraGuest.included + 1}. Gast${x.extraGuest.perNight ? ', pro Nacht' : ''})`);
    else if (x.extraGuest && x.extraGuest.included == null) info.push(`Gebühr für weitere Gäste: ${money(x.extraGuest.amount, x.extraGuest.currency)}`);
    if (x.onSite?.length) warn.push(`Kommt vor Ort noch dazu: ${x.onSite.join(', ')}`);
    const share = feeShare(x.fees, ctx.total);
    if (share != null && ctx.nights && ctx.nights <= 2) (share >= 0.25 ? warn : info).push(`Reinigung und Service machen ${Math.round(share * 100)} % des Preises aus (Kurztrip)`);
    if (x.fees?.cleaning && x.chores?.length >= 2) warn.push(`Reinigungsgebühr ${money(x.fees.cleaning, cur)} und trotzdem Putzliste (${x.chores.join(', ')})`);
    else if (x.chores?.length >= 3) info.push(`Check-out-Pflichten: ${x.chores.join(', ')}`);
    if (x.parking?.paid) info.push(`Parken kostet extra${x.parking.amount ? ` (${money(x.parking.amount, x.parking.currency)})` : ''}`);
    else if (x.parking?.garage) plus.push('Garage oder Parkhaus (Gepäck bleibt sicher)');
    // Räume und Betten
    if (x.passRoom && people >= 3) warn.push('Durchgangszimmer oder offener Schlafbereich: wenig Privatsphäre');
    if (x.seats && people && x.seats < people) warn.push(`Esstisch für ${x.seats}, ihr seid ${people}`);
    if (x.dishes && people && x.dishes < people) warn.push(`Geschirr für ${x.dishes}, ihr seid ${people}`);
    if (x.hostNear) info.push('Gastgeber wohnt im Haus oder nebenan (Privatsphäre, aber Hilfe nah)');
    if (x.floors && (kids || people >= 4)) info.push('Schlafzimmer auf mehreren Etagen oder im Nebengebäude');
    if (x.loft) (kids ? warn : info).push('Hochbett oder Galerie mit Leiter: für Kleinkinder gefährlich, für Ältere unpraktisch');
    if (x.bedWidth && people === 2 && x.bedWidth <= 140) info.push(`Bett ${x.bedWidth} cm breit: für zwei Erwachsene eher schmal`);
    if (x.area && people) { const pp = x.area / people; (pp < 10 ? warn : info).push(`${x.area} m², also ${sep(pp, 0)} m² pro Person${pp < 10 ? ' (eng)' : ''}`); }
    if (x.floor && !x.floor.ground && x.floor.floor >= 2 && !f.elevator) info.push(`${x.floor.floor}. Stock, kein Aufzug angegeben`);
    if (x.floor?.ground) plus.push('Erdgeschoss');
    // Hausregeln
    if (x.notForKids && kids) warn.push('Laut Hausregeln nicht für Kinder geeignet, ihr reist mit Kindern');
    if (x.minAge) info.push(`Mindestalter ${x.minAge} Jahre`);
    if (x.noVisitors) info.push('Keine Besucher erlaubt');
    if (x.smokingOk) info.push('Rauchen erlaubt (Rauchgeruch möglich)');
    if (ctx.pets && x.petLimits?.length) warn.push(`Haustiere: ${x.petLimits.join(', ')}`);
    if (ctx.pets && x.petFee) info.push(`Haustiergebühr ${money(x.petFee.amount, x.petFee.currency)}`);
    if (x.allergy?.length) ((ctx.wishes || []).includes('petFree') ? warn : info).push(`Für Allergiker: ${x.allergy.join(', ')}`);
    if (x.rules >= 15) info.push(`Lange Hausregel-Liste (${x.rules} Punkte): Gastgeber legt viel fest`);
    if (ctx.smoker && ctx.noSmoking) (f.balcony ? info : warn).push(f.balcony ? 'Rauchen nur draußen (Balkon/Terrasse vorhanden)' : 'Rauchverbot und keine Außenfläche angegeben');
    if (ctx.pets && ctx.noPets) info.push('Assistenztiere gelten bei Airbnb nicht als Haustiere (Regel „keine Haustiere“ betrifft sie nicht, siehe Airbnb-Hilfe „Assistenztiere“)');
    // Sicherheit (nur wenn die Ausstattung gelesen wurde)
    if (x.amenRead) {
      const miss = [!f.smoke && 'Rauchmelder', !f.co && 'CO-Melder', !f.extinguisher && 'Feuerlöscher'].filter(Boolean);
      if (miss.length) info.push(`Nicht angegeben: ${miss.join(', ')}`);
    }
    if (f.camera || f.noiseSensor) info.push(`Laut Inserat: ${[f.camera && 'Außenkamera', f.noiseSensor && 'Lärmsensor'].filter(Boolean).join(' und ')}`);
    // Familie
    if (kids) {
      const baby = [['crib', 'Kinderbett'], ['highchair', 'Hochstuhl'], ['babyBath', 'Babybadewanne'], ['toys', 'Spielzeug/Bücher']];
      if (ctx.infants) { const have = baby.filter(([k]) => f[k]).map(([, l]) => l), miss = baby.filter(([k]) => !f[k]).map(([, l]) => l); info.push(`Baby an Bord: ${have.length ? '✓ ' + have.join(', ') : 'nichts angegeben'}${miss.length && have.length ? ` · fehlt: ${miss.join(', ')}` : ''}`); }
      if (f.pool && !f.fencedGarden) info.push('Pool: Zaun nicht erwähnt, mit Kleinkindern nachfragen');
      if (f.stairGate || f.outletCovers) plus.push(`Kindersicherheit: ${[f.stairGate && 'Treppenschutzgitter', f.outletCovers && 'Steckdosenschutz'].filter(Boolean).join(', ')}`);
      if (f.garden) plus.push(f.fencedGarden ? 'Eingezäunter Garten' : 'Garten oder Innenhof');
    }
    if (ctx.pets && f.fencedGarden) plus.push('Eingezäunter Garten (gut für Hunde)');
    if ((kids || (ctx.nights || 0) >= 5) && f.washer) plus.push('Waschmaschine');
    else if ((ctx.nights || 0) >= 7 && x.amenRead && !f.washer) info.push('Keine Waschmaschine angegeben (lange Reise)');
    // Saison
    if (f.pool && winter) info.push('Außenpool in der kalten Jahreszeit: oft kalt oder geschlossen, beim Gastgeber fragen');
    if (summer && !f.ac && /dachgeschoss|dachwohnung|attic|top floor|sous les toits|ático|mansarda/i.test(ctx.text || '')) warn.push('Dachgeschoss im Hochsommer ohne Klimaanlage: kann sehr heiß werden');
    if (month && ctx.checkin) {
      const md = String(ctx.checkin).slice(5, 10), nights = ctx.nights || 1;
      const end = new Date(Date.parse(ctx.checkin) + nights * 864e5).toISOString().slice(5, 10);
      const coversNye = md <= '12-31' && md >= '12-20' && (end >= '01-01' && end <= '01-15' || end === '12-31');
      if (coversNye) { const s = [ctx.noParties && 'Partyverbot', x.deposit && `Kaution ${money(x.deposit.amount, x.deposit.currency)}`, x.noVisitors && 'keine Besucher'].filter(Boolean); if (s.length) warn.push(`Silvester: ${s.join(', ')}`); }
    }
    if ((ctx.nights || 0) >= 28) info.push('Ab 28 Nächten gilt bei Airbnb oft eine eigene Stornoregel für Langzeitaufenthalte; je nach Land auch Meldepflichten. Bedingungen genau lesen.');
    const dl = ctx.lat != null && ctx.checkin ? dayLength(ctx.lat, ctx.checkin) : null;
    if (dl != null && (dl < 9 || dl > 17)) info.push(`Tageslicht am Anreisetag: etwa ${sep(dl, 0)} Stunden`);
    if (dl != null && dl > 17 && !f.blackout && x.amenRead) info.push('Helle Nächte: keine Verdunkelung angegeben');
    // Gastgeber
    const hx = x.host || {};
    if (hx.notVerified) warn.push('Identität des Gastgebers nicht bestätigt');
    if (hx.listings != null && hx.listings >= 5) info.push(`Gastgeber vermietet ${hx.listings} Unterkünfte`);
    if (hx.listings >= 10 && ctx.hostSince && +ctx.hostSince >= new Date().getFullYear() - 1) warn.push(`Neues Gastgeber-Konto mit ${hx.listings} Unterkünften (Agentur oder Fake?)`);
    if (hx.livesIn) info.push(`Gastgeber lebt in ${hx.livesIn}`);
    if (hx.languages?.length) info.push(`Gastgeber spricht ${hx.languages.join(', ')}`);
    if (ctx.responseTime === 'day' && ctx.checkin) { const days = (Date.parse(ctx.checkin) - (ctx.now || Date.now())) / 864e5; if (days >= 0 && days < 2) warn.push('Gastgeber antwortet meist erst innerhalb eines Tages, die Anreise ist bald: Sofortbuchung bevorzugen'); }
    // Sonstiges
    if (x.license) info.push(`Registriernummer laut Inserat: ${x.license}`);
    if (x.green?.length) info.push(`Laut Gastgeber (nicht geprüft): ${x.green.join(', ')}`);
    if (x.superlatives?.count >= 4) info.push(`${x.superlatives.count} Werbewörter in der Beschreibung („atemberaubend“ & Co.): auf Fakten achten 😉`);
    if (x.kitchen === 'basic') info.push('Nur Kochnische oder Mikrowelle');
    else if (x.kitchen === 'full') plus.push('Voll ausgestattete Küche');
    if (x.coffee) info.push(`Kaffee: ${x.coffee}`);
    if (f.basics || f.coffeeTea) plus.push('Grundausstattung zum Kochen (Öl, Salz, Kaffee …)');
    if (f.miniFridge && !f.fridge && people >= 3) warn.push('Nur Minikühlschrank');
    if (f.freezer) plus.push('Gefrierfach');
    const access = [f.stepFree && 'stufenlos', f.wideDoor && 'breite Türen', f.showerSeat && 'Duschsitz', f.grabBars && 'Haltegriffe'].filter(Boolean);
    if (access.length) plus.push(`Barrierefrei laut Inserat: ${access.join(', ')}`);
    return { warn, info, plus };
  }

  // ---------- Wünsche, die erst die Unterkunftsseite prüfen kann (Ausstattung) ----------
  // check(x) bekommt die gespeicherten roomExtras; true/false/null. false nur, wenn die Ausstattung gelesen wurde.
  const has = k => x => (x?.features?.[k] ? true : x?.amenRead ? false : null);
  const EXTRA_WISHES = {
    workspace: { label: '💻 Arbeitsplatz', ok: 'Arbeitsplatz', no: 'kein Arbeitsplatz angegeben', check: has('workspace'), src: 'Ausstattung der Unterkunftsseite' },
    selfCheckin: { label: '🔑 Self-Check-in', ok: 'Self-Check-in', no: 'kein Self-Check-in', check: has('selfCheckin'), src: 'Ausstattung der Unterkunftsseite' },
    bathtub: { label: '🛁 Badewanne', ok: 'Badewanne', no: 'keine Badewanne angegeben', check: has('bathtub'), src: 'Ausstattung und Beschreibung' },
    view: { label: '🌅 Aussicht', ok: 'Aussicht', no: 'keine Aussicht erwähnt', check: x => (x?.features?.view ? true : null), src: 'Ausstattung und Beschreibung' },
    washer: { label: '🧺 Waschmaschine', ok: 'Waschmaschine', no: 'keine Waschmaschine', check: has('washer'), src: 'Ausstattung der Unterkunftsseite' },
    ac: { label: '❄️ Klimaanlage', ok: 'Klimaanlage', no: 'keine Klimaanlage', check: has('ac'), src: 'Ausstattung der Unterkunftsseite' },
    parking: { label: '🚗 Parkplatz', ok: 'Parkplatz', no: 'kein Parkplatz', check: x => (x?.parking?.garage || x?.parking?.street || x?.parking?.paid ? true : null), src: 'Ausstattung und Beschreibung' },
    ev: { label: '🔌 E-Auto laden', ok: 'Ladestation', no: 'keine Ladestation', check: has('ev'), src: 'Ausstattung der Unterkunftsseite' },
    bike: { label: '🚲 Fahrradkeller', ok: 'Platz für Fahrräder', no: 'kein Fahrradraum', check: x => (x?.features?.bike ? true : null), src: 'Ausstattung und Beschreibung' },
    grill: { label: '🔥 Grill', ok: 'Grill', no: 'kein Grill', check: has('grill'), src: 'Ausstattung der Unterkunftsseite' },
    blackout: { label: '🌙 Verdunkelung', ok: 'Verdunkelung', no: 'keine Verdunkelung angegeben', check: has('blackout'), src: 'Ausstattung der Unterkunftsseite' },
    garden: { label: '🌳 Garten', ok: 'Garten/Innenhof', no: 'kein Garten', check: has('garden'), src: 'Ausstattung und Beschreibung' },
    baby: { label: '👶 Baby an Bord', ok: 'Kinderbett', no: 'kein Kinderbett angegeben', check: has('crib'), src: 'Ausstattung der Unterkunftsseite' },
    lock: { label: '🔒 abschließbares Zimmer', ok: 'abschließbares Zimmer', no: 'kein Schloss angegeben', check: x => (x?.features?.lock ? true : null), src: 'Ausstattung der Unterkunftsseite' },
    monitor: { label: '🖥️ Monitor', ok: 'externer Monitor', no: 'kein Monitor', check: x => (x?.features?.monitor ? true : null), src: 'Ausstattung der Unterkunftsseite' },
    fireplace: { label: '🔥 Kamin', ok: 'Kamin', no: 'kein Kamin', check: has('fireplace'), src: 'Ausstattung der Unterkunftsseite', season: 'winter' },
    sauna: { label: '🧖 Sauna', ok: 'Sauna', no: 'keine Sauna', check: has('sauna'), src: 'Ausstattung der Unterkunftsseite', season: 'winter' },
    stepFree: { label: '♿ stufenlos', ok: 'stufenloser Zugang', no: 'stufenloser Zugang nicht angegeben', check: x => (x?.features?.stepFree || x?.floor?.ground ? true : x?.amenRead ? false : null), src: 'Barrierefreiheit-Abschnitt und Beschreibung' },
    beach: { label: '🏖️ Strandausstattung', ok: 'Strandausstattung', no: 'keine Strandausstattung', check: x => (x?.features?.beach ? true : null), src: 'Ausstattung der Unterkunftsseite' },
    ski: { label: '⛷️ Skiraum', ok: 'Skiraum', no: 'kein Skiraum', check: x => (x?.features?.ski ? true : null), src: 'Ausstattung und Beschreibung' },
    petFree: { label: '🤧 tierfrei', ok: 'keine Tiere/Teppiche erwähnt', no: 'Tiere oder Teppich (Allergie)', check: x => (x?.allergy?.length ? false : null), src: 'Beschreibung und Hausregeln' },
    hostOnSite: { label: '🙋 Gastgeber vor Ort', ok: 'Gastgeber vor Ort', no: null, check: (x, l) => (x?.hostNear || /privatzimmer|private room|chambre privée/i.test(S(l?.kind)) ? true : null), src: 'Art der Unterkunft und Beschreibung' },
  };
  // Profile: ein Klick setzt mehrere Wünsche
  const PROFILES = {
    work: { label: '💼 Arbeiten', wishes: ['wifi', 'workspace', 'quiet', 'selfCheckin'] },
    holiday: { label: '🌴 Urlaub', wishes: ['whole', 'trusted', 'clean'] },
    solo: { label: '🧍 Allein', wishes: ['selfCheckin', 'trusted', 'reviews'] },
    family: { label: '👨‍👩‍👧 Familie', wishes: ['whole', 'baby', 'washer', 'garden'] },
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
    const b = s.match(/(?:unter|bis|max(?:imal)?|höchstens|under|below|up to)\s*(\d{2,5})\s*(?:€|eur|euro)?/i);
    return { wishes, budgetNight: b ? +b[1] : null };
  }

  // Vorkasse-Text für die Gruppe: wer bucht, streckt vor
  function advanceText(total, people, cur, cancel) {
    if (!total || !people || people < 2) return '';
    const each = Math.ceil(total / people);
    const c = cancel?.kind === 'free' ? ` Kostenlos stornierbar${cancel.until ? ' bis ' + cancel.until : ''}.` : cancel?.kind === 'nonrefundable' ? ' Nicht erstattungsfähig.' : '';
    return `Ich zahle die Unterkunft: ${money(total, cur)}. Bitte je ${money(each, cur)} an mich (${people} Personen).${c}`;
  }

  // ================= Teil 2: Suchseite (über alle bewerteten Karten) =================
  const med = a => { const x = a.filter(v => v != null && isFinite(v)).sort((p, q) => p - q); if (!x.length) return null; const m = x.length >> 1; return x.length % 2 ? x[m] : (x[m - 1] + x[m]) / 2; };
  const qt = (a, p) => { const x = a.filter(v => v != null && isFinite(v)).sort((u, v) => u - v); return x.length ? x[Math.min(x.length - 1, Math.max(0, Math.round((x.length - 1) * p)))] : null; };
  const title = l => { const t = String(l.title || l.kind || 'Unterkunft'); return t.length > 40 ? t.slice(0, 39) + '…' : t; };
  const isTrusted = l => (l.badges || []).some(b => /favorit|superhost/i.test(b));
  const curOf = l => R().normCur(l.currency) || '€';
  // Hauptwährung der Seite (die meisten Karten), damit € und $ nicht gemischt werden
  function mainCurrency(list) { const c = {}; for (const l of list) { const k = curOf(l); c[k] = (c[k] || 0) + 1; } return Object.entries(c).sort((a, b) => b[1] - a[1])[0]?.[0] || '€'; }
  const night = (l, nights) => (l.priceImplausible ? null : R().perNight(l, nights));
  const PRIVATE = /privatzimmer|private room|chambre privée|habitación privada|camera privata/i;

  // Preisanker: günstigstes Zehntel, Median, teuerstes Zehntel pro Nacht
  function priceAnchor(list, ctx = {}) {
    const cur = mainCurrency(list);
    const v = list.filter(l => curOf(l) === cur).map(l => night(l, ctx.nights)).filter(x => x != null);
    if (v.length < 8) return null;
    return { p10: qt(v, 0.1), median: med(v), p90: qt(v, 0.9), currency: cur, text: `Preisrahmen pro Nacht: günstigstes Zehntel bis ${money(qt(v, 0.1), cur)}, Mitte ${money(med(v), cur)}, teuerstes Zehntel ab ${money(qt(v, 0.9), cur)}` };
  }
  // Budget-Hebel: was brächten 10 % mehr Budget?
  function budgetLever(list, ctx = {}) {
    const eb = R().effectiveBudget(ctx);
    const bn = ctx.budgetPerNight || (eb && ctx.nights ? eb / ctx.nights : null);
    if (!bn) return null;
    const extra = Math.max(5, Math.round(bn * 0.1));
    const gain = list.filter(l => { const n = night(l, ctx.nights); return n != null && n > bn && n <= bn + extra && isTrusted(l) && (l.rating || 0) >= 4.7; });
    return gain.length ? `Mit ${money(extra, '€')} mehr pro Nacht kämen ${gain.length} gut bewertete ${gain.length === 1 ? 'Superhost-/Favoriten-Unterkunft' : 'Superhost-/Favoriten-Unterkünfte'} dazu` : null;
  }
  // Günstiger Zwilling: fast gleich gut (höchstens 3 Punkte weniger), deutlich günstiger
  function cheapTwins(top, list) {
    const ids = new Set(top.map(l => l.id)), out = [];
    top.forEach((t, i) => {
      if (t.rank?.stay == null) return;
      const c = list.filter(l => !ids.has(l.id) && !l.rank?.disliked && l.rank?.stay != null && curOf(l) === curOf(t) && l.rank.score >= t.rank.score - 3 && l.rank.stay <= t.rank.stay * 0.95)
        .sort((a, b) => a.rank.stay - b.rank.stay)[0];
      if (c) out.push({ for: i + 1, id: c.id, text: `Zu Platz ${i + 1}: „${title(c)}“ fast gleich gut (${c.rank.score}), ${money(t.rank.stay - c.rank.stay, c.currency)} günstiger` });
    });
    return out;
  }
  // Robuste Empfehlung: bleibt Platz 1, wenn Preis, Sterne oder Viertel etwas mehr zählen?
  function robustness(listings, ctx, topIds) {
    if (!topIds?.length || listings.length < 4) return null;
    const changed = [];
    for (const [k, name] of [['price', 'Preis'], ['rating', 'Sterne'], ['area', 'Viertel']]) {
      const r = R().rankListings(listings, { ...ctx, weightTweak: { [k]: 1.3 } }).filter(l => !ctx.disliked?.has?.(l.id)).map(l => l.id);
      if (r[0] !== topIds[0]) changed.push(name);
    }
    return changed.length ? { stable: false, text: `Empfehlung knapp: zählt ${changed.join(' oder ')} etwas mehr, wäre ein anderes Inserat vorn` } : { stable: true, text: 'Empfehlung stabil: Platz 1 bleibt, auch wenn Preis, Sterne oder Viertel etwas mehr zählen' };
  }
  // Abstand zu Platz 1: wo fehlen die Punkte?
  const PART = { area: 'Viertel', rating: 'Sterne', price: 'Preis', wishes: 'Wünsche', beds: 'Betten', taste: 'Geschmack' };
  function gapToFirst(l, first) {
    if (!first || l === first || !l.rank || !first.rank) return null;
    const pts = x => Object.fromEntries((x.rank.breakdown || []).map(b => [b.key, b.points]));
    const a = pts(l), b = pts(first);
    const diff = Object.keys({ ...a, ...b }).map(k => [k, (a[k] || 0) - (b[k] || 0)]).filter(([, d]) => d <= -1).sort((x, y) => x[1] - y[1]).slice(0, 2);
    const gap = first.rank.score - l.rank.score;
    if (gap <= 0) return null;
    return `${gap} ${gap === 1 ? 'Punkt' : 'Punkte'} hinter Platz 1${diff.length ? ` (vor allem ${diff.map(([k, d]) => `${PART[k] || k} ${Math.round(d)}`).join(', ')})` : ''}`;
  }
  // Rabattschwellen bei 7 und 28 Nächten
  function discountThreshold(nights) {
    if (nights === 5 || nights === 6) return 'Ab 7 Nächten geben viele Gastgeber Wochenrabatt: prüfe, ob eine Nacht mehr kaum mehr kostet';
    if (nights >= 25 && nights <= 27) return 'Ab 28 Nächten geben viele Gastgeber Monatsrabatt: prüfe einen längeren Zeitraum';
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
    return [-1, 1].map(n => { const x = new URL(u); x.searchParams.set(ciK, shift(ci, n)); x.searchParams.set(coK, shift(co, n)); for (const k of ['items_offset', 'cursor', 'pagination_search']) x.searchParams.delete(k); return { label: `Anreise einen Tag ${n < 0 ? 'früher' : 'später'}`, url: x.href }; });
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
    return { url: u.href, text: `Mindestens ${need} Schlafzimmer als Filter setzen: das entfernt ${bad} unpassende` };
  }
  // Allein reisen: gut bewertetes Privatzimmer als günstige Alternative zur ganzen Wohnung
  function soloAlternative(list, top, ctx = {}) {
    if (ctx.people !== 1 || !top[0]) return null;
    const t = top[0], tn = night(t, ctx.nights);
    if (!tn || PRIVATE.test(`${t.kind} ${t.title}`)) return null;
    const c = list.filter(l => PRIVATE.test(String(l.kind)) && isTrusted(l) && (l.rating || 0) >= 4.7 && curOf(l) === curOf(t) && night(l, ctx.nights) != null && night(l, ctx.nights) <= tn * 0.6)
      .sort((a, b) => night(a, ctx.nights) - night(b, ctx.nights))[0];
    return c ? { id: c.id, text: `Allein unterwegs: Zimmer bei Superhost/Favorit „${title(c)}“, ${Math.round((1 - night(c, ctx.nights) / tn) * 100)} % günstiger als Platz 1` } : null;
  }
  // Ausreißer gegen die eigene Filterblase: sehr gut bewertet, aber anders als dein Geschmack
  function outlierPick(list, top, ctx = {}) {
    if (!ctx.taste) return null;
    const ids = new Set(top.map(l => l.id));
    const c = list.filter(l => !ids.has(l.id) && !l.rank?.disliked && l.rank?.parts?.taste != null && l.rank.parts.taste <= 0.5 && (l.rating || 0) >= 4.9 && (l.reviewCount || 0) >= 20 && l.rank.score >= 55)
      .sort((a, b) => b.rank.score - a.rank.score)[0];
    return c ? { id: c.id, text: `Mal was anderes: „${title(c)}“ (⭐ ${sep(c.rating, 2)}, ${c.rank.score} Punkte), passt nicht zu deinem bisherigen Geschmack` } : null;
  }
  // Weiterblättern lohnt nicht mehr: die zuletzt geöffnete Seite brachte nichts für die Top 3
  function stopPaging(pool, list, top) {
    if (!pool || (pool.pages || []).length < 3 || top.length < 3) return null;
    const last = pool.pages.at(-1), min = Math.min(...top.map(l => l.rank.score));
    const lastIds = new Set(Object.values(pool.items || {}).filter(i => i.page === last).map(i => i.id));
    if (!lastIds.size) return null;
    const better = list.filter(l => lastIds.has(l.id) && l.rank.score >= Math.max(70, min)).length;
    return better ? null : 'Die zuletzt geöffnete Seite brachte nichts für deine Top 3: Weiterblättern lohnt kaum noch';
  }
  // Kartenausschnitt-Tipp: alle besten Treffer in einer Ecke
  function mapCorner(list, top) {
    const pts = list.filter(l => l.lat != null && l.lon != null);
    const tp = top.filter(l => l.lat != null && l.lon != null);
    if (pts.length < 15 || tp.length < 3) return null;
    const lats = pts.map(l => l.lat), lons = pts.map(l => l.lon);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2, midLon = (Math.min(...lons) + Math.max(...lons)) / 2;
    const quad = l => (l.lat >= midLat ? 'Nord' : 'Süd') + (l.lon >= midLon ? 'osten' : 'westen');
    const qs = new Set(tp.map(quad));
    return qs.size === 1 ? `Deine besten Treffer liegen alle im ${[...qs][0]} des Kartenausschnitts: Karte dorthin verschieben zeigt mehr davon` : null;
  }
  // Budget-Rest für Platz 1 (Reisebudget ist in €)
  function budgetRest(first, ctx = {}) {
    const eb = R().effectiveBudget(ctx);
    if (!first || !eb || first.rank?.stay == null || first.rank?.parts?.price == null) return null;
    const share = first.rank.stay / eb;
    if (share > 1) return null;
    const rest = eb - first.rank.stay;
    return `Platz 1 nutzt ${Math.round(share * 100)} % des Budgets, es bleiben ${money(rest, '€')}${ctx.people > 1 ? ` (${money(rest / ctx.people, '€')} pro Person)` : ''}`;
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
    return per01 >= 1 ? `0,1 Sterne mehr kosten hier im Schnitt etwa ${money(per01, cur)} pro Nacht (grobe Schätzung)` : null;
  }
  // Gesamtpreis-Schalter: Airbnb zeigt Nachtpreise ohne Gebühren
  function totalSwitchHint(list, nights) {
    const known = list.filter(l => l.priceWord && l.totalPrice != null);
    if (!nights || nights < 2 || known.length < 5) return null;
    return known.every(l => !l.isTotal) ? 'Airbnb zeigt hier Nachtpreise ohne Gebühren. Schalte bei Airbnb „Gesamtpreis anzeigen“ ein, dann vergleicht StayMatch die echten Kosten.' : null;
  }
  // Preisanzeige wechselt zwischen den gesammelten Seiten (Gesamt- und Nachtpreise gemischt)
  function mixedUnits(pool) {
    const by = {};
    for (const i of Object.values(pool?.items || {})) if (i.priceWord && i.totalPrice != null) (by[i.page] ||= new Set()).add(i.isTotal ? 'T' : 'N');
    const units = new Set(Object.values(by).flatMap(x => x.size === 1 ? [...x] : []));
    return Object.keys(by).length >= 2 && units.size === 2 ? 'Die gesammelten Seiten zeigen teils Gesamt-, teils Nachtpreise: Vergleich kann schief sein (Gesamtpreis-Schalter prüfen)' : null;
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
    return { ids: [best.a.id, best.b.id], text: `Zwei Wohnungen ${Math.round(best.d)} m auseinander („${title(best.a)}“ + „${title(best.b)}“) kosten zusammen ${money(best.sum, best.a.currency)}${big ? `, ${money(big.rank.stay - best.sum, best.a.currency)} weniger als die günstigste große` : ''}` };
  }
  // Ungewöhnlich teuer / Wochenend-Aufschlag aus deinen eigenen früheren Suchen (log: [{ path, ci, nights, med, cur }])
  function priceHistoryNotes(log, now) {
    const out = [];
    if (!now || !now.med) return out;
    const same = (log || []).filter(e => e.path === now.path && e.cur === now.cur && e.ci !== now.ci && e.med);
    const prev = same.at(-1);
    if (prev && now.med / prev.med >= 1.5) out.push(`Heute ${sep(now.med / prev.med)}× so teuer wie bei deiner Suche für den ${prev.ci}: vielleicht ein Event oder Feiertag`);
    const wk = e => { const d = new Date(e.ci + 'T12:00:00Z').getUTCDay(); return (d === 5 || d === 6) && e.nights <= 3; };
    const all = [...same, now].filter(e => e.ci && e.nights);
    const we = med(all.filter(wk).map(e => e.med)), wd = med(all.filter(e => !wk(e) && e.nights <= 4).map(e => e.med));
    if (we && wd && we / wd >= 1.1) out.push(`Wochenende kostet hier etwa +${Math.round((we / wd - 1) * 100)} % (aus deinen eigenen Suchen)`);
    return out;
  }
  // Alles für den Abschnitt „Mehr zu dieser Seite“
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
  function linkCheck(url, domains) {
    let u; try { u = new URL(String(url).trim()); } catch { return { ok: false, text: 'Kein gültiger Link' }; }
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    if (domains.includes(host)) return u.protocol === 'https:' ? { ok: true, text: `Echte Airbnb-Adresse (${host})` } : { ok: false, text: 'Airbnb-Adresse, aber ohne https: nicht öffnen' };
    if (/a[i1l]r[bh]n[bh]|airbnb/i.test(host)) return { ok: false, text: `Vorsicht: ${host} ist KEINE Airbnb-Adresse (Nachbau). Nichts eingeben, nichts zahlen.` };
    return { ok: false, text: `${host} gehört nicht zu Airbnb` };
  }
  // Merkliste eines Freundes (Text aus „Merkliste kopieren“): Unterkunfts-Ids einsammeln
  function friendIds(text) { return [...new Set([...S(text).matchAll(/\/rooms\/(?:[a-z]+\/)?(\d+)/g)].map(m => m[1]))]; }
  // Gebuchte Etappen als Text: Reihenfolge, Daten, Preis pro Kopf, Storno-Kette, Wechselkosten (Reinigung)
  function tripsText(items) {
    const b = (items || []).filter(i => i.booked).sort((a, c) => S(a.booked.checkin).localeCompare(S(c.booked.checkin)));
    if (!b.length) return '';
    const lines = ['Unsere Etappen (StayMatch)'];
    let clean = 0, cleanCur = null, cleanN = 0;
    b.forEach((i, n) => {
      const k = i.booked, pp = k.total && k.people > 1 ? ` · ${money(k.total / k.people, k.currency)} p. P.` : k.total ? ` · ${money(k.total, k.currency)}` : '';
      lines.push('', `${n + 1}. ${i.title || 'Unterkunft'}${i.locality ? ` (${i.locality})` : ''}`, `   ${k.checkin || '?'} bis ${k.checkout || '?'}${pp}`,
        `   Storno: ${k.cancel ? `kostenlos${k.cancel !== 'ja' ? ' bis ' + k.cancel : ''}` : 'nicht kostenlos oder unbekannt'}`);
      if (i.url) lines.push(`   ${i.url}`);
      if (i.extra?.fees?.cleaning) { clean += i.extra.fees.cleaning; cleanCur = i.extra.fees.currency; cleanN++; }
    });
    if (b.length >= 2 && cleanN >= 2) lines.push('', `Reinigungsgebühren der ${cleanN} Wechsel zusammen: ${money(clean, cleanCur)}`);
    return lines.join('\n');
  }
  // Datenauskunft: was liegt lokal?
  function storageSummary(all) {
    const ls = Object.entries(all || {}).filter(([k]) => k.startsWith('l:')).map(([, v]) => v);
    const n = f => ls.filter(f).length;
    return [
      `${ls.length} Unterkünfte im Verlauf (${n(i => i.vote === 1)} 👍, ${n(i => i.vote === -1)} 👎, ${n(i => i.note)} mit Notiz, ${n(i => i.booked)} gebucht)`,
      `${n(i => i.reviewTexts?.length)} mit gespeicherten Bewertungsauszügen, ${n(i => i.priceHistory?.length)} mit Preisverlauf`,
      all?.trip ? `Reise: ${all.trip.city || '?'}, ${all.trip.people?.length || 0} Personen` : 'Keine Reise gespeichert',
      all?.pool ? `Gesammelte Suchseiten: ${(all.pool.pages || []).length}` : null,
      all?.priceLog?.length ? `${all.priceLog.length} Preis-Mediane deiner Suchen (nur Stadt, Datum, Median)` : null,
      all?.friendLikes ? `Merklisten von Freunden: ${Object.keys(all.friendLikes).length} Unterkünfte` : null,
      'Alles liegt nur in diesem Browser (chrome.storage.local).',
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
    return low != null && low <= now * 1.02 ? `Rabatt mit Vorsicht: bei einem früheren Besuch kostete es schon ${fmt(low)} pro Nacht ohne Rabatt-Hinweis` : null;
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
  const SUB_NAMES = { clean: 'Sauberkeit', accuracy: 'Genauigkeit', checkin: 'Check-in', communication: 'Kommunikation', location: 'Lage', value: 'Preis-Leistung' };
  function subRatingNotes(sub, wishes) {
    const warn = [], info = [];
    if (!sub || !Object.keys(sub).length) return { warn, info };
    if ((wishes || []).includes('clean') && sub.clean != null && sub.clean < 4.6) warn.push(`passt nicht zu deinem Wunsch „sauber“: Sauberkeit nur ${sep(sub.clean)}`);
    const low = Object.entries(sub).filter(([k, v]) => v < 4.5 && !(k === 'clean' && (wishes || []).includes('clean'))).map(([k, v]) => `${SUB_NAMES[k]} ${sep(v)}`);
    if (low.length) info.push(`Schwächere Teilnoten: ${low.join(', ')}`);
    return { warn, info };
  }
  // Kontaktdaten markiert (Telefon, Mail): außerhalb der Plattform zahlen ist ein häufiger Betrug
  const contactLike = t => /[\w.+-]+@[\w-]+\.[a-z]{2,}|(?:\+|00)\d[\d\s()/-]{7,}\d|\b0\d{2,4}[\s/-]?\d{4,}/i.test(S(t));
  // Gastgeber hat viele Bewertungen (Bilanz für neue Inserate)
  function hostReviewCount(t) { const m = S(t).match(/(\d{1,3}(?:[.,]\d{3})*|\d+)\s*(?:bewertungen|reviews|commentaires|evaluaciones|reseñas|recensioni)/i); return m ? +m[1].replace(/[.,]/g, '') : null; }
  // Storno-Preis-Abwägung: zwei fast gleich gute Top-Inserate, eines kostenlos stornierbar (von der Unterkunftsseite bekannt)
  function cancelTradeoff(top, known) {
    const k = l => known?.get?.(l.id)?.cancellation?.kind || null;
    for (let i = 0; i < top.length; i++) for (let j = 0; j < top.length; j++) {
      const a = top[i], b = top[j];
      if (i === j || k(a) !== 'free' || !k(b) || k(b) === 'free' || a.rank?.stay == null || b.rank?.stay == null) continue;
      if (Math.abs(a.rank.score - b.rank.score) > 5 || a.rank.stay <= b.rank.stay) continue;
      return `Platz ${i + 1} kostet ${money(a.rank.stay - b.rank.stay, a.currency)} mehr als Platz ${j + 1}, ist aber kostenlos stornierbar`;
    }
    return null;
  }
  // Vorjahresvergleich: früher gebuchte Unterkunft in derselben Stadt
  function lastYear(booked, cityPath, medNow, cur) {
    const city = decodeURIComponent(String(cityPath || '').split('/')[2] || '').split(/[-–,]/)[0].trim().toLowerCase();
    if (!city || !medNow) return null;
    const b = (booked || []).filter(i => i.booked && i.pricePerNight && String(i.city || i.locality || '').toLowerCase().includes(city) && (R().normCur(i.currency) || '€') === cur && i.booked.checkin)
      .sort((x, y) => S(y.booked.checkin).localeCompare(S(x.booked.checkin)))[0];
    return b ? `Bei deiner Buchung ab ${b.booked.checkin} hast du hier ${money(b.pricePerNight, b.currency)} pro Nacht gezahlt, heute liegt die Mitte bei ${money(medNow, cur)}` : null;
  }

  root.StayMatchExtras = {
    claimConflicts, lastMinute, discountHonesty, subRatings, subRatingNotes, contactLike, hostReviewCount, cancelTradeoff, lastYear,
    linkCheck, friendIds, tripsText, storageSummary,
    priceAnchor, budgetLever, cheapTwins, robustness, gapToFirst, discountThreshold, shiftLinks, filterSuggestion, soloAlternative, outlierPick, stopPaging, mapCorner,
    budgetRest, starPrice, totalSwitchHint, mixedUnits, twoFlats, priceHistoryNotes, pageInsights, mainCurrency,
    advanceText,
    deposit, extraGuestFee, extraGuestCost, onSiteCosts, checkoutChores, fees, feeShare, parkingInfo, diningSeats, dishesFor, bedWidth, area, floorInfo,
    features, coffee, kitchenLevel, minAge, petLimits, petFee, allergy, ruleCount, hostExtra, license, greenClaims, superlatives, dayLength,
    roomExtras, roomNotes, EXTRA_WISHES, PROFILES, wishesFromSentence, FEATURES, money, _R: R,
  };
})(typeof window !== 'undefined' ? window : globalThis);
