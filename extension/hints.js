// StayMatch – Stichworte aus Bewertungstexten, die DU auf der Unterkunftsseite geöffnet hast.
// Reine Funktion ohne chrome.* und ohne DOM, damit sie sich testen lässt.
(function (root) {
  // R7: \b ist in JS nur ASCII („zu heiß“, „Überteuert“ fielen durch). Daher echte Unicode-Wortgrenze.
  // R9: \p{L} ist in V8 sehr teuer zu kompilieren (jedes \b wird sechsfach ausgeschrieben: ~2,5 s beim ersten Aufruf).
  // Darum ein ausgeschriebener Buchstabenbereich (Latein inkl. Erweiterungen, Griechisch, Kyrillisch) statt \p{L}.
  const LET = 'A-Za-z\\u00C0-\\u024F\\u0370-\\u04FF';
  const WB = `(?:(?<![0-9${LET}])(?=[0-9${LET}])|(?<=[0-9${LET}])(?![0-9${LET}]))`;
  const U = re => new RegExp(re.source.replace(/\\b/g, WB).replace(/\\p\{L\}/g, `[${LET}]`), 'iu');
  // R9: FR/ES/IT/NL/PL. Zusätzliche Alternativen je Label (gleiche Bedeutung/Flags wie DE/EN).
  // Vorsicht: Muster mit eigener Verneinung („sans ascenseur“) gehören zu Labels ohne Umdrehen.
  const w = s => '\\b(?:' + s + ')\\b';
  const EXTRA = {
    'sauber': [
      String.raw`(?:(?:était|etait|est|très|tres|pas|vraiment|bien|super|parfaitement)\s+)+propres?|impeccable\p{L}*|nickel|propreté irréprochable`,
      String.raw`(?:(?:estaba|estaban|muy|súper|super|nada|no|todo|bien)\s+)+limpi[oa]s?|impecable\p{L}*|limpísim[oa]s?|inmaculad[oa]s?`,
      String.raw`(?:(?:era|erano|molto|davvero|non|tutto|sempre|super|estremamente)\s+)+pulit[aeio]|pulitissim[aeio]|impeccabil[ei]`,
      String.raw`schoon|brandschoon|smetteloos|spic en span|keurig schoon`,
      String.raw`czyst[aeoyi]|czyściutk\p{L}*|czystość|czystości`,
    ],
    'Lage': [
      String.raw`emplacement\s+(?:idéal|parfait|excellent|top|central|super|génial)|(?:excellent|parfait|super|idéal|bel)\s+emplacement|(?:idéalement|très bien|parfaitement)\s+situé\p{L}*|situation\s+(?:idéale|parfaite|excellente|centrale)`,
      String.raw`(?:excelente|perfecta|magnífica|fantástica|ideal|inmejorable)\s+(?:ubicaci[oó]n|localizaci[oó]n)|ubicaci[oó]n\s+(?:excelente|perfecta|ideal|inmejorable|céntrica|genial|estupenda)|muy bien ubicad[oa]s?`,
      String.raw`(?:posizione|ubicazione)\s+(?:ottima|perfetta|eccellente|ideale|centrale|strategica|fantastica)|(?:ottima|perfetta|eccellente|splendida|fantastica)\s+(?:posizione|ubicazione)`,
      String.raw`(?:perfecte|prima|geweldige|uitstekende|ideale|fantastische|centrale)\s+(?:locatie|ligging)|(?:locatie|ligging)\s+(?:is\s+|was\s+)?(?:perfect|prima|geweldig|uitstekend|top|ideaal|fantastisch|centraal)`,
      String.raw`(?:doskonał\p{L}*|idealn\p{L}*|świetn\p{L}*|znakomit\p{L}*|centraln\p{L}*|wspaniał\p{L}*)\s+(?:lokalizacj\p{L}*|położeni\p{L}*)|lokalizacj\p{L}*\s+(?:jest\s+|była\s+)?(?:doskonał\p{L}*|idealn\p{L}*|świetn\p{L}*|znakomit\p{L}*|centraln\p{L}*)`,
    ],
    'Gastgeber': [
      String.raw`(?:hôte|hote|propriétaire)[^.]{0,40}\b(?:sympa\p{L}*|gentil\p{L}*|accueillant\p{L}*|serviable\p{L}*|réactif\p{L}*|adorable\p{L}*|charmant\p{L}*|génial\p{L}*|incroyable|exceptionnel\p{L}*)`,
      String.raw`anfitri[oó]n\p{L}*[^.]{0,40}\b(?:amable\p{L}*|atent[oa]\p{L}*|encantador\p{L}*|genial\p{L}*|maravillos[oa]|servicial\p{L}*|excelente|increíble|fantástic\p{L}*)`,
      String.raw`(?:host|proprietari[oa]|padrone di casa)[^.]{0,40}\b(?:gentil\p{L}*|disponibil\p{L}*|cordial\p{L}*|simpatic\p{L}*|fantastic\p{L}*|premuros\p{L}*|accogliente)`,
      String.raw`(?:gastheer|gastvrouw|verhuurder|host)[^.]{0,40}\b(?:vriendelijk\p{L}*|behulpzaam\p{L}*|aardig\p{L}*|geweldig\p{L}*|fantastisch\p{L}*|attent\p{L}*|gastvrij\p{L}*)`,
      String.raw`(?:gospodarz\p{L}*|gospodyni|właściciel\p{L}*)[^.]{0,40}\b(?:miły\p{L}*|mili|uprzejm\p{L}*|pomocn\p{L}*|sympatyczn\p{L}*|wspaniał\p{L}*|świetn\p{L}*|kontaktow\p{L}*|przemił\p{L}*)`,
    ],
    'laut': [
      String.raw`bruyant\p{L}*|bruits?|tapage\p{L}*|nuisances? sonores?`,
      String.raw`ruidos[oa]s?|ruidos?`,
      String.raw`rumoros[aeio]|rumore|rumori|chiassos[aeio]|baccano`,
      String.raw`lawaai\p{L}*|luidruchtig\p{L}*|rumoerig`,
      String.raw`głośn\p{L}*|hałaś\p{L}*|hałas\p{L}*`,
    ],
    'hellhörig': [
      String.raw`murs (?:très )?(?:fins|minces)|cloisons (?:fines|minces)|on entend (?:tout|les voisins)`,
      String.raw`paredes (?:muy )?(?:finas|delgadas)|se (?:oye|escucha|oía|escuchaba) todo`,
      String.raw`(?:pareti|muri) sottili|si sent(?:e|iva) tutto`,
      String.raw`dunne (?:muren|wanden)|gehorig|je hoort alles|hoorde alles`,
      String.raw`cienkie (?:ściany|mury)|cienkich ścian|słychać wszystko|wszystko słychać`,
    ],
    'Baustelle': [
      String.raw`chantier|travaux`,
      String.raw`obras|construcción`,
      String.raw`cantiere|lavori in corso|lavori edili`,
      String.raw`bouwwerkzaamheden|bouwterrein|verbouwing\p{L}*|wegwerkzaamheden`,
      String.raw`budowa|budowy|budowie|budowę|remont\p{L}*`,
    ],
    'schmutzig': [
      String.raw`(?:très|assez|trop|vraiment|était|etait|est|bien|un peu|tout)\s+sales?|crasseu\p{L}*|poussiéreu\p{L}*|dégoûtant\p{L}*|saleté\p{L}*`,
      String.raw`sucio|sucia|sucios|sucias|suciedad|mugre|mugros[oa]s?`,
      String.raw`sporc[oa]|sporch[ie]|sporcizia|sudici\p{L}*|schifos[aeio]`,
      String.raw`vies|vuil|vuile|vuilig\p{L}*|smerig\p{L}*|vervuild\p{L}*`,
      String.raw`brudn\p{L}*|brud|zabrudzon\p{L}*|niedomyt\p{L}*|syf\p{L}*`,
    ],
    'Ungeziefer': [
      String.raw`cafards?|punaises? de lit|souris|fourmis|vermine`,
      String.raw`cucarachas?|chinches|hormigas|ratones|ratas|plagas?`,
      String.raw`scarafagg\p{L}*|blatte|cimici|formiche|topi`,
      String.raw`kakkerlakken?|bedwantsen|bedwants|muizen|ratten|mieren|ongedierte`,
      String.raw`karaluch\p{L}*|pluskw\p{L}*|myszy|mrówk\p{L}*|szczur\p{L}*|robactw\p{L}*`,
    ],
    'Bett unbequem': [
      String.raw`inconfortable\p{L}*|lit (?:était |etait )?(?:très )?(?:dur|inconfortable)`,
      String.raw`incómod[oa]s?|poco cómod[oa]s?`,
      String.raw`scomod[aeio]`,
      String.raw`oncomfortabel\p{L}*|ongemakkelijk\p{L}*|slecht bed|hard bed|harde bedden`,
      String.raw`niewygodn\p{L}*`,
    ],
    'WLAN': [
      String.raw`(?:wifi|wi-fi|internet|connexion)\b[^.]{0,30}\b(?:mauvais\p{L}*|lent\p{L}*|faible|nul|capricieux|instable|inexistant\p{L}*)`,
      String.raw`(?:wifi|wi-fi|internet|conexión)\b[^.]{0,30}\b(?:malo|mala|lento|lenta|débil|pésim\p{L}*|inestable|horrible)`,
      String.raw`(?:wifi|wi-fi|internet|connessione)\b[^.]{0,30}\b(?:scadente|lent[oa]|debole|pessim\p{L}*|instabile|inesistente)`,
      String.raw`(?:wifi|wi-fi|internet|wlan)\b[^.]{0,30}\b(?:slecht\p{L}*|langzaam|traag|zwak|onstabiel)`,
      String.raw`(?:wifi|wi-fi|internet)\b[^.]{0,30}\b(?:słab\p{L}*|wolno|wolny|wolne|fatalny|kiepski)`,
    ],
    'Treppen': [
      String.raw`(?:beaucoup d'|trop d'|de nombreux |\d+ )(?:escaliers|marches)|escaliers? (?:raides?|étroits?|très raides?)`,
      String.raw`(?:muchas|demasiadas)\s+escaleras|escaleras\s+(?:empinadas|estrechas|muy empinadas)|\d+\s+(?:tramos de\s+)?escaleras`,
      String.raw`(?:molte|tante|\d+)\s+(?:scale|gradini)|scale\s+(?:ripide|strette|molto ripide)`,
      String.raw`(?:veel|\d+)\s+trappen|steile\s+trapp?en?|smalle\s+trapp?en?`,
      String.raw`(?:dużo|wiele|\d+)\s+(?:schodów|stopni)|strome schody|wąskie schody|schody\s+(?:strome|wąskie)`,
    ],
    'kein Aufzug': [
      String.raw`sans ascenseur|pas d'ascenseur|aucun ascenseur`,
      String.raw`sin ascensor|no (?:hay|tiene|había) (?:ascensor|elevador)`,
      String.raw`senza ascensore|niente ascensore|non c'(?:è|era) (?:l')?ascensore`,
      String.raw`geen lift|zonder lift|geen liften`,
      String.raw`bez windy|brak windy|nie (?:ma|było) windy`,
    ],
    'Reinigungsgebühr hoch': [
      String.raw`frais de ménage (?:élevés|excessifs|exorbitants)|ménage (?:hors de prix|trop cher)`,
      String.raw`(?:tasa|gastos) de limpieza (?:alt[oa]s?|elevad[oa]s?|excesiv[oa]s?|abusiv[oa]s?)`,
      String.raw`(?:costi|spese) di pulizia (?:alt[ie]|elevat[ie]|eccessiv[ie])`,
      String.raw`schoonmaakkosten (?:hoog|te hoog|erg hoog|buitensporig)|hoge schoonmaakkosten`,
      String.raw`opłata za sprzątanie (?:wysoka|zawyżona|duża)|wysoka opłata za sprzątanie`,
    ],
    'ohne Klimaanlage': [
      String.raw`(?:pas de|sans|aucune?)\s+(?:climatisation|clim)|trop chaud|chaleur étouffante`,
      String.raw`(?:sin|no hay|no tiene|no había)\s+(?:aire acondicionado|climatizaci[oó]n)|demasiado calor`,
      String.raw`(?:senza|niente|non c'(?:è|era))\s+(?:l')?(?:aria condizionata|condizionatore|climatizzazione)|troppo caldo`,
      String.raw`(?:geen|zonder)\s+(?:airco|airconditioning)|te warm|veel te warm`,
      String.raw`(?:brak|bez|nie ma)\s+klimatyzacji|zbyt gorąco|za gorąco|upał`,
    ],
    'Matratze schlecht': [
      String.raw`matelas\s+(?:était\s+|etait\s+|très\s+)?(?:dur|mou|usé|affaissé|défoncé|vieux|inconfortable)`,
      String.raw`colch[oó]n\s+(?:estaba\s+|era\s+|muy\s+)*(?:duro|blando|viejo|hundido|incómodo|malo|gastado)`,
      String.raw`materasso\s+(?:era\s+|molto\s+)*(?:duro|morbido|vecchio|scomodo|scadente|consumato|sfondato)`,
      String.raw`matras\s+(?:was\s+|erg\s+|te\s+|zeer\s+)*(?:hard|zacht|oud|slecht|doorgezakt|versleten|oncomfortabel)|doorgezakte matras`,
      String.raw`materac\p{L}*\s+(?:był\s+|była\s+|było\s+|bardzo\s+|zbyt\s+)*(?:twardy|miękki|stary|zapadnięty|niewygodny|zużyty|zły)`,
    ],
    'Warmwasser': [
      String.raw`pas d'eau chaude|plus d'eau chaude|eau chaude\s+(?:insuffisante|limitée|froide)|peu d'eau chaude|faible pression`,
      String.raw`(?:sin|no había|no hay|no tenía)\s+agua caliente|agua caliente\s+(?:se acabó|limitada|escasa|fría)|poca presión`,
      String.raw`(?:senza|niente|non c'(?:è|era))\s+acqua calda|acqua calda\s+(?:finita|poca|fredda|scarsa)|poca pressione`,
      String.raw`(?:geen|weinig)\s+warm water|warm water\s+(?:was\s+)?(?:op|koud|beperkt)|lage waterdruk|weinig waterdruk`,
      String.raw`(?:brak|nie było|nie ma)\s+ciepłej wody|ciepłej wody\s+(?:brakowało|zabrakło)|słabe ciśnienie|niskie ciśnienie`,
    ],
    'Geruch/Feuchtigkeit': [
      String.raw`moisissure\p{L}*|humid\p{L}*|odeur (?:de )?(?:moisi|humidité|tabac|cigarette|fumée)|sent le (?:moisi|renfermé|tabac)|renfermé`,
      String.raw`moho|humedad|olor a (?:humedad|tabaco|moho|cerrado|humo)|huele a (?:humedad|tabaco|moho|cerrado)|mal olor|malos olores`,
      String.raw`muffa|umidità|odore di (?:muffa|chiuso|fumo|umido)|puzza|puzzava|cattivo odore|odore sgradevole`,
      String.raw`schimmel\p{L}*|vochtig\p{L}*|muf\p{L}*|rookgeur|sigarettenlucht|stank|stinkt\p{L}*`,
      String.raw`pleśń|pleśni|wilgoć\p{L}*|wilgotn\p{L}*|stęchli\p{L}*|zapach (?:stęchlizny|wilgoci|dymu|papierosów)|śmierdzi\p{L}*|smród`,
    ],
    'Gäste kamen wieder': [
      String.raw`(?:deuxième|troisième|\d+(?:e|ème))\s+(?:fois|séjour)|nous reviendrons|on reviendra|reviendrai|reviendrons`,
      String.raw`(?:segunda|tercera|cuarta)\s+vez|volveremos|volveré|volver[eé] seguro|repetiremos`,
      String.raw`(?:seconda|terza|quarta)\s+volta|torneremo|ritorneremo|tornerei`,
      String.raw`(?:tweede|derde|vierde)\s+keer|we komen (?:zeker\s+)?terug|komen graag terug|komen zeker weer`,
      String.raw`(?:drugi|trzeci|kolejny)\s+raz|wrócimy|wrócę`,
    ],
    'Gastgeber hat storniert': [
      String.raw`l'ospite ha annullato|l'host ha (?:annullato|cancellato)|de (?:gastheer|host) heeft (?:[^.]{0,30}\s)?geannuleerd|gospodarz anulował\p{L}*`,
    ],
    'ruhig': [
      String.raw`très calme|au calme|calme absolu|insonoris\p{L}*|vraiment calme|super calme|(?:logement|quartier|endroit|appartement) calme`,
      String.raw`muy tranquil[oa]s?|muy silencios[oa]s?|(?:zona|barrio) tranquil[oa]|insonorizad[oa]s?|súper tranquil[oa]|silencio absoluto`,
      String.raw`molto tranquill[oa]|molto silenzios[oa]|zona tranquilla|insonorizzat[oa]|silenzio assoluto|tranquillissim[oa]`,
      String.raw`heel rustig|zeer rustig|erg rustig|super rustig|rustige (?:buurt|straat|locatie|omgeving|ligging)|geluidsdicht`,
      String.raw`bardzo cich[oay]|cicha okolica|cich[ae]\s+(?:okolica|ulica|dzielnica|lokalizacja)|wyciszon\p{L}*|bardzo spokojn\p{L}*|cisza`,
    ],
  };
  // [Label, Muster, positiv?, Verneinung umdrehen?, Label bei Verneinung (sonst „nicht <Label>“)]
  // Negative Muster, die selbst schon "kein/ohne" enthalten, werden nicht umgedreht.
  const HINTS = [
    ['sauber', /\b(sauber|blitzsauber|spotless|very clean|super clean|so clean)\b/, true, true],
    ['Lage', /\b(tolle|super|perfekte|zentrale) lage\b|\b(great|perfect|excellent) location\b/, true, true, 'Lage enttäuschend'],
    ['Gastgeber', /\bgastgeber\w*\b[^.]{0,40}\b(nett|freundlich|hilfsbereit)\b|\bhost was (great|helpful|friendly|amazing)\b/, true, true, 'Gastgeber unfreundlich'],
    // R7: „laut“ als Präposition („Laut Beschreibung …“) ist kein Lärm
    ['laut', /\b((?<!klimaanlage\s+(?:war\s+)?(?:sehr\s+)?)laut(?!\s+(?:der|dem|den|des|einer?|eigenen?|beschreibung|inserat|anzeige|gastgeber\w*|airbnb|bewertung\w*|website|foto\w*))|lärm|lärmig|noisy|noise)\b/, false, true],
    ['hellhörig', /\b(hellhörig|dünne wände|thin walls|paper[- ]thin)\b/, false, false],
    ['Baustelle', /\b(baustelle|baulärm|construction (site|work|noise))\b/, false, true, 'keine Baustelle'],
    ['schmutzig', /\b(schmutzig|dreckig|dirty|unclean)\b/, false, true],
    ['Ungeziefer', /\b(kakerlake\w*|ungeziefer|bettwanzen|cockroach\w*|bed ?bugs?|ameisen|mäuse|mice)\b/, false, true, 'kein Ungeziefer'],
    ['Bett unbequem', /\b(unbequem\w*|uncomfortable)\b/, false, true, 'Bett bequem'],
    ['WLAN', /\b(wlan|wifi|wi-fi)\b[^.]{0,30}\b(schlecht|langsam|bad|slow|poor)\b/, false, true, 'WLAN ok'],
    ['Treppen', /\b(viele|steile|steilen|enge|engen|\d+)\s+(treppen|stufen|stockwerke|stairs|flights)\b|\b(steile|steilen)\s+treppe\w*|\b(steep|narrow|many|lots of) stairs\b|\bwalk[- ]?up\b|\bohne aufzug\b/, false, true, 'wenig Treppen'],
    ['kein Aufzug', /\b(kein|keinen|ohne)\s+(aufzug|fahrstuhl|lift)\b|\bno (elevator|lift)\b/, false, false],
    ['Reinigungsgebühr hoch', /\b(hohe|hohen|teure|teuren|überteuerte|high|expensive|steep)\s+(reinigungsgebühr\w*|endreinigung|putzgebühr\w*|cleaning fee)|\b(reinigungsgebühr\w*|endreinigung|putzgebühr\w*|cleaning fee)\b[^.]{0,40}\b(hoch|teuer|überteuert|zu viel|high|expensive|steep)\b/, false, false],
    ['ohne Klimaanlage', /\b(kein\w*|ohne)\s+klima\w*|\bno (air ?conditioning|a\/c)\b|\b(zu heiß|too hot)\b/, false, false],
    ['anders als im Inserat', /\b(anders als (auf )?(den )?(fotos|bildern)|nicht wie (auf )?(den )?(fotos|bildern)|not as (pictured|described)|misleading (photos|pictures))\b/, false, false],
    // R7 E: weitere Kategorien (Runde 7 E, Bewertungs-Analyse)
    ['Matratze schlecht', /\b(matratze\w*\s+(war\s+)?(durchgelegen|alt|weich|hart|kaputt)|durchgelegen\w*|schlafsofa\s+(war\s+)?(hart|unbequem)|(saggy|old|worn|lumpy|hard)\s+mattress\w*|mattress\s+(was\s+)?(saggy|old|worn|lumpy|hard))\b/, false, false],
    ['Warmwasser', /\b(kein\w*\s+warm(es)?\s*wasser|warmwasser\s+(war\s+)?(knapp|kalt|aus)|boiler\s+(zu\s+)?klein|wenig\s+wasserdruck|wasserdruck\s+(war\s+)?(schwach|gering)|no hot water|(low|poor|weak) water pressure|hot water ran out)\b/, false, false],
    ['Geruch/Feuchtigkeit', /\b(schimmel\w*|muffig\w*|modrig\w*|feucht\w*|rauchgeruch|roch nach (rauch|zigaretten)|mou?ld\w*|musty|damp|mildew|smelled of smoke|smell of smoke)\b/, false, true, 'kein Geruch'],
    ['Nachbarn-Ärger', /\b(nachbarn?\s+(haben\s+sich\s+)?beschwer\w*|hausverwaltung\s+kam|neighbou?rs?\s+complained|building manager came)\b/, false, false],
    ['sichere Gegend', /\b(nachts\s+sicher|sichere\w*\s+(gegend|viertel|nachbarschaft)|felt (very )?safe|safe (area|neighbou?rhood))\b/, true, true, 'Gegend unsicher'],
    ['unsicher', /\b(unsichere\w*\s+(gegend|viertel|straße)|(fühlte\w*)\s+(mich|uns)\s+(nachts\s+)?unsicher|dunkle\w*\s+hinterhof|dunkle\w*\s+gasse|felt unsafe|unsafe (area|neighbou?rhood)|sketchy)\b/, false, false],
    ['Gastgeber löst Probleme', /\b(sofort\s+(reagiert|repariert|gekümmert)|schnell\s+(repariert|behoben|gelöst)|innerhalb\s+(einer|1)\s+stunde\s+(repariert|behoben|da)|fixed (it )?(right away|immediately|quickly)|responded immediately|resolved (it )?quickly)\b/, true, false],
    ['Gäste kamen wieder', /\b(zum\s+(zweiten|dritten|vierten|\d+\.)\s+mal|kommen\s+(gerne\s+)?wieder|wiederkommen|stayed here (again|before)|(second|third|fourth) (time|stay)|will (definitely )?(be back|come back|return))\b/, true, true, 'würden nicht wiederkommen'],
    ['Gastgeber hat storniert', /\b(gastgeber\w*\s+hat\s+[^.]{0,40}storniert|host canceled|host cancelled|l'hôte a annulé|el anfitrión canceló)\b/, false, false],
    ['Ohrstöpsel nötig', /\b((ohrstöpsel|oropax)\s+(waren\s+|sind\s+)?(nötig|notwendig|gebraucht|benötigt|empfehlenswert|ein muss|mitnehmen)|brauchten\s+(\w+\s+)?(ohrstöpsel|oropax)|(needed|bring|recommend)\s+earplugs|earplugs\s+(are\s+|were\s+)?(a must|needed|necessary|recommended))\b/, false, true, 'keine Ohrstöpsel nötig'],
    ['Klimaanlage laut', /\b(klimaanlage\s+(war\s+)?(sehr\s+)?laut|laute\s+klimaanlage|(ac|air conditioning|air conditioner)\s+(was\s+)?(very\s+)?(loud|noisy)|noisy (ac|air conditioning))\b/, false, false],
    ['hell', /\b(lichtdurchflutet\w*|sehr\s+hell(?!hörig)\w*|viel\s+(tages)?licht|bright and|so bright|lots of (natural )?light|flooded with light)\b/, true, false],
    ['dunkel', /\b((wohnung|zimmer|apartment|room)\s+(war\s+|was\s+)?(sehr\s+|very\s+)?dunkel|wenig\s+(tages)?licht|kaum\s+licht|(dark|gloomy) (apartment|room|flat)|not much (natural )?light)\b/, false, false],
    ['mit Rollstuhl/Rollator', /\b(mit\s+(dem\s+|meinem\s+|unserem\s+)?(rollstuhl|rollator)|(in|with) a wheelchair|wheelchair user|with (my |our )?walker)\b/, true, false],
    ['mit Hund da', /\b(mit\s+(unserem|meinem|dem)\s+hund|with (our|my) dog|hundefreundlich|dog[- ]friendly)\b/, true, false],
    ['ruhig', /\b(schlafzimmer\s+zum\s+hof|schallisoliert\w*|sehr\s+ruhig|absolut\s+ruhig|very quiet|super quiet|soundproof\w*)\b/, true, true, 'nicht ruhig'],
    // R9: Heizung/WLAN-Ausfall in allen Sprachen (eigene Verneinung im Muster, nicht umdrehen)
    ['Heizung defekt', new RegExp([
      String.raw`heizung\s+(?:war\s+|ging\s+)?(?:kaputt|defekt|aus|kalt)|(?:keine|ohne)\s+heizung|zu kalt|eiskalt`,
      String.raw`no heating|heating\s+(?:was\s+|did\s*n't\s+|didn't\s+|did not\s+|wasn't\s+|not\s+)?(?:broken|work|working|on)|(?:too|very) cold|freezing`,
      String.raw`(?:pas de|sans|aucun) chauffage|chauffage\s+(?:en panne|ne marchait pas|ne fonctionnait pas|défaillant)|trop froid|très froid|glacial`,
      String.raw`(?:sin|no hay|no había|no tiene)\s+calefacci[oó]n|calefacci[oó]n\s+(?:no funcionaba|rota|averiada)|mucho frío|demasiado frío`,
      String.raw`(?:senza|niente|non c'era|non c'è)\s+riscaldamento|riscaldamento\s+(?:non funzionava|rotto|guasto)|troppo freddo|gelido`,
      String.raw`(?:geen|zonder)\s+verwarming|verwarming\s+(?:werkte niet|was kapot|stuk|defect)|te koud|ijskoud`,
      String.raw`(?:brak|bez|nie ma)\s+ogrzewania|ogrzewanie\s+(?:nie działało|nie działa|było zepsute|zepsute)|za zimno|bardzo zimno|lodowat\p{L}*`,
    ].map(w).join('|')), false, false],
    ['WLAN defekt', new RegExp([
      String.raw`(?:wlan|wifi|wi-fi|internet)\b[^.]{0,20}\b(?:funktionierte nicht|ging nicht|did(?:n't| not) work|not working|ne marchait pas|ne fonctionnait pas|no funcionaba|non funzionava|werkte niet|nie działał\p{L}*)`,
    ].map(w).join('|')), false, false],
  ].map(([label, re, pos, flip, negLabel]) => [label, U(EXTRA[label] ? new RegExp(re.source + '|' + EXTRA[label].map(w).join('|')) : re), pos, flip, negLabel]);
  const NEG = U(/\b(nicht|kein|keine|keinen|nie|not|never|no|wasn't|isn't|pas|jamais|aucun\p{L}*|sans|nunca|sin|nada|tampoco|non|mai|senza|niente|niet|geen|nooit|zonder|bez|brak|nigdy|żadn\p{L}*)\b/);
  // R9: „sans doute“, „sin duda“ … sind keine Verneinung; Verneinung gilt nur im selben Teilsatz
  const NO_DOUBT = new RegExp(U(/\b(sans (aucun )?doute|sin (ninguna )?duda|senza dubbio|zonder twijfel|bez wątpienia|ohne frage|without a doubt)\b/).source, 'giu');
  const CLAUSE = U(/[,;:–—]|\b(aber|und|sondern|but|and|et|mais|pero|y|maar|ma|e|ale|oraz)\b/g);
  const CLAUSE_G = new RegExp(CLAUSE.source, 'giu');
  // R7: „nicht nur sauber, sondern …“ ist keine Verneinung
  const NOT_ONLY = U(/\b(nicht nur|not only|not just|non solo|pas seulement|no solo)\b/g);
  const NOT_ONLY_G = new RegExp(NOT_ONLY.source, 'giu'); // R8: einmal bauen, nicht je Satz

  // → ["👍 sauber", "⚠️ laut (2×)", …], häufigste zuerst
  function reviewHints(text) {
    const sentences = String(text || '').split(/(?<=[.!?\n])\s+/);
    const counts = {};
    for (const raw of sentences) {
      NOT_ONLY_G.lastIndex = 0;
      const s = raw.replace(/[’‘]/g, "'").replace(NOT_ONLY_G, ' ').replace(NO_DOUBT, ' ');
      for (const [label, re, pos, flip, negLabel] of HINTS) {
        const m = s.match(re);
        if (!m) continue;
        const before = s.slice(Math.max(0, m.index - 30), m.index).split(CLAUSE_G).pop();
        // R7: Verneinung auch im Treffer selbst („Gastgeber war nicht freundlich“, „WLAN war nicht schlecht“)
        const negated = flip && (NEG.test(before) || NEG.test(m[0]));
        const isPos = negated ? !pos : pos;
        const key = (isPos ? '👍 ' : '⚠️ ') + (negated ? negLabel || 'nicht ' + label : label);
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => n > 1 ? `${k} (${n}×)` : k);
  }

  const warnings = hints => (hints || []).filter(x => String(x).startsWith('⚠️'));

  // ---------- R7 E: Auswertungen über einzelne Bewertungen (reviewTexts: je Bewertung ein Text) ----------
  // R8: je Text nur einmal rechnen (criticalShare, hostReplies fragen denselben Text mehrfach)
  const CRIT_CACHE = new Map();
  const critical = t => {
    const k = String(t || '');
    let v = CRIT_CACHE.get(k);
    if (v === undefined) {
      v = reviewHints(k).some(x => x.startsWith('⚠️'));
      if (CRIT_CACHE.size > 500) CRIT_CACHE.clear();
      CRIT_CACHE.set(k, v);
    }
    return v;
  };
  // „4 von 30 Bewertungen kritisch“; ein Kritiker unter vielen Lobenden ist ein Einzelfall
  function criticalShare(texts) {
    const list = (texts || []).filter(Boolean);
    if (list.length < 5) return null;
    const n = list.filter(critical).length;
    return { critical: n, total: list.length, single: n === 1 && list.length >= 15 };
  }
  // Wann ist es laut? Uhrzeiten in Sätzen mit Lärm-Wörtern
  const NOISE = U(/\b(laut(?!\s+(?:der|dem|den|des|beschreibung))|lärm\w*|noisy|noise|müllabfuhr|garbage truck|party|feiern|bars?|bruits?|bruyant\p{L}*|ruidos?|ruidos[oa]s?|rumore|rumori|lawaai|hałas\p{L}*|głośn\p{L}*)\b/);
  function noiseTimes(texts) {
    let night = 0, morning = 0;
    for (const s of String((texts || []).join('\n')).split(/(?<=[.!?\n])\s+/)) {
      if (!NOISE.test(s)) continue;
      // R8: „am“/„pm“ nur als eigenes Wort („2 amazing nights“ ist keine Uhrzeit)
      for (const m of s.matchAll(/(?<![\d:.,])\b(\d{1,2})(?:[:.](\d{2}))?\s*(uhr\b|h\b|(?:am|pm)(?![\p{L}])|a\.m\.|p\.m\.)/giu)) {
        let h = +m[1]; const ap = m[3].toLowerCase();
        if (ap.startsWith('p') && h < 12) h += 12; if (ap.startsWith('a') && h === 12) h = 0;
        if (h >= 22 || h <= 4) night++; else if (h >= 5 && h <= 9) morning++;
      }
      if (/nachts|in der nacht|at night|all night|bis spät|la nuit|toute la nuit|de nuit|de noche|por la noche|toda la noche|di notte|tutta la notte|'s nachts|snachts|de hele nacht|w nocy|całą noc|nocą/i.test(s)) night++;
      if (/morgens|früh am morgen|in the morning|early morning|le matin|por la mañana|di mattina|al mattino|'s ochtends|vroeg in de ochtend|rano\b|wcześnie rano/i.test(s)) morning++;
    }
    if (!night && !morning) return null;
    return night >= morning ? 'meist nachts' : 'meist morgens';
  }
  // Gästemix: wer war dort?
  const MIX = [['Paare', /\b(mein(e|em|er)? (freund|freundin|partner\w*|mann|frau)|wir (beide|zwei)|romantisch\w*|my (husband|wife|partner|boyfriend|girlfriend)|couple|honeymoon)\b/], ['Familien', /\b(kinder|kids|familie|family|baby|tochter|sohn|daughter|son)\b/], ['Dienstreisen', /\b(dienstreise|geschäftsreise|business trip|work trip|arbeiten|homeoffice|remote work)\b/], ['Freunde', /\b(freunde\w*|freundesgruppe|mädelstrip|jungs|friends|group of)\b/]].map(([l, re]) => [l, U(re)]);
  function guestMix(texts) {
    const c = {}; let n = 0;
    for (const t of texts || []) { const hit = MIX.filter(([, re]) => re.test(t)); if (hit.length) n++; for (const [l] of hit) c[l] = (c[l] || 0) + 1; }
    const top = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
    return top && n >= 4 && top[1] / n >= 0.5 ? { top: top[0], share: top[1] / n, n } : null;
  }
  // Sprachen der Bewertungen über häufige Füllwörter (grob, nur Hinweis)
  const LANGS = { de: /\b(und|nicht|sehr|wir|war)\b/i, en: /\b(the|and|was|very|we)\b/i, fr: /\b(et|très|nous|était|le|la)\b/i, es: /\b(muy|y|el|la|nosotros|fue)\b/i, it: /\b(molto|e|era|abbiamo|il)\b/i, nl: /\b(het|en|zeer|was|wij|erg)\b/i, pt: /\b(muito|e|foi|nós|o)\b/i, pl: /\b(nie|bardzo|jest|oraz|dla|ale|tylko)\b/i };
  function languages(texts) {
    const seen = new Set();
    for (const t of texts || []) { let best = null, bs = 0; for (const [k, re] of Object.entries(LANGS)) { const n = (String(t).match(new RegExp(re.source, 'gi')) || []).length; if (n > bs) { bs = n; best = k; } } if (best && bs >= 2) seen.add(best); }
    return seen.size;
  }
  // Konkrete Zahlen aus Bewertungen („10 Minuten zur Metro“, „3. Stock ohne Aufzug“)
  function numberFacts(texts) {
    const out = [];
    const re = /\b\d{1,2}\s*(?:min(?:uten|\.)?|minutes?)\s+(?:zu[mr]?|bis zu[mr]?|to the|from the|walk to)\s+[\p{L}-]{3,20}|\b\d{1,2}\.\s*(?:stock|etage)\s+ohne\s+(?:aufzug|lift)|\b\d{1,2}(?:st|nd|rd|th)\s+floor\s+(?:without|no)\s+(?:elevator|lift)/giu;
    for (const t of texts || []) for (const m of String(t).matchAll(re)) { const s = m[0].trim(); if (!out.some(x => x.toLowerCase() === s.toLowerCase())) out.push(s); if (out.length >= 4) return out; }
    return out;
  }
  // Renovierung: „neu renoviert“, „neue Matratzen“ in den jüngsten Bewertungen
  const RENOV = U(/\b(neu\s+renoviert|frisch\s+renoviert|renovier\w*|neue\s+matratze\w*|newly renovated|just renovated|new mattress\w*)\b/);
  // R8: „jüngste“ stimmt nur, wenn die Texte neueste zuerst kommen. Airbnb sortiert standardmäßig nach Relevanz:
  // ohne opts.newestFirst (der Aufrufer muss die Sortierung kennen) gibt es keine Aussage über „zuletzt“.
  const renovated = (texts, recent = 5, opts = {}) => !!opts?.newestFirst && (texts || []).slice(0, recent).some(t => RENOV.test(t));
  // Stichwort-Trend: Lob „sauber“ in den neuesten 10 gegen ältere (Reihenfolge wie auf der Seite: neueste zuerst)
  function keywordTrend(texts, label = 'sauber', opts = {}) {
    if (!opts?.newestFirst) return null; // R8: Reihenfolge unbekannt (Relevanz-Sortierung) → kein Trend behaupten
    const list = texts || []; if (list.length < 16) return null;
    const rate = a => a.filter(t => reviewHints(t).some(x => x.startsWith('👍 ' + label))).length / a.length;
    const neu = rate(list.slice(0, 10)), alt = rate(list.slice(10));
    if (alt >= 0.3 && neu <= alt / 2) return `„${label}“ früher oft gelobt, zuletzt selten`;
    return null;
  }
  // Gastgeber antwortet auf Kritik? Kritische Bewertungen mit Antwort, lösungsorientiert („behoben“, „ersetzt“)
  function hostReplies(texts) {
    const crit = (texts || []).filter(critical);
    if (crit.length < 2) return null;
    const RE = /antwort (?:des|vom|von) gastgeber|response from|réponse de l'hôte|respuesta del anfitrión|risposta dell'host|antwoord van de gastheer|odpowiedź gospodarza/i;
    const replied = crit.filter(t => RE.test(t));
    const fix = replied.filter(t => /behoben|repariert|ersetzt|ausgetauscht|neu gekauft|fixed|replaced|repaired|resolved|réparé|remplacé|riparato|sostituito|risolto|gerepareerd|vervangen|opgelost|naprawion|wymienion|arreglado|reparado|solucionado/i.test(t));
    return { critical: crit.length, replied: replied.length, fixing: fix.length };
  }

  root.StayMatchHints = { reviewHints, warnings, HINTS, criticalShare, noiseTimes, guestMix, languages, numberFacts, renovated, keywordTrend, hostReplies };
})(typeof window !== 'undefined' ? window : globalThis);
