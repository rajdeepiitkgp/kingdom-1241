// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * Game-term glossary for the translation pipeline.
 *
 * Every entry tells the model how to render a Kingshot term in each target
 * language so that "Bear Hunt" is always the same words on every page. A
 * missing language means "use the official in-game term for that language,
 * or keep the English if unsure". `keep: true` means never translate.
 *
 * Add terms here as the kingdom's vocabulary grows; the pipeline sends the
 * relevant subset with every request.
 */
export interface GlossaryEntry {
  term: string;
  /** Keep exactly as written in every language (names, codes, abbreviations). */
  keep?: boolean;
  /** Preferred translation per language code. */
  translations?: Record<string, string>;
  /** Short note for the model about the term. */
  note?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "Kingshot", keep: true, note: "The name of the game." },
  { term: "Kingdom 1241", keep: true, note: "Our kingdom. Keep the number." },
  { term: "KvK", keep: true, note: "Kingdom vs Kingdom; also the tag of the kingdom's castle-rally alliance [KvK]. Keep the abbreviation." },
  { term: "R4", keep: true, note: "Alliance rank 4 (officer)." },
  { term: "R5", keep: true, note: "Alliance rank 5 (leader)." },
  { term: "UTC", keep: true },
  { term: "Discord", keep: true },
  { term: "MightPulse", keep: true },
  {
    term: "Kingdom",
    translations: { de: "Königreich", pl: "Królestwo", ko: "왕국", ar: "المملكة", fr: "Royaume", it: "Regno", tr: "Krallık", ja: "王国", "zh-TW": "王國" },
    note: "A game server.",
  },
  {
    term: "Alliance",
    translations: { de: "Allianz", pl: "Sojusz", ko: "연맹", ar: "التحالف", fr: "Alliance", it: "Alleanza", tr: "İttifak", ja: "同盟", "zh-TW": "聯盟" },
  },
  {
    term: "Governor",
    translations: { de: "Gouverneur", pl: "Gubernator", ko: "영주", ar: "الحاكم", fr: "Gouverneur", it: "Governatore", tr: "Vali", ja: "領主", "zh-TW": "領主" },
    note: "A player.",
  },
  {
    term: "Governor ID",
    translations: { de: "Gouverneur-ID", pl: "ID gubernatora", ko: "영주 ID", ar: "معرّف الحاكم", fr: "ID de Gouverneur", it: "ID Governatore", tr: "Vali ID", ja: "領主ID", "zh-TW": "領主ID" },
  },
  {
    term: "Town Center",
    translations: { de: "Stadtzentrum", pl: "Centrum miasta", ko: "마을 회관", ar: "مركز المدينة", fr: "Centre-ville", it: "Centro città", tr: "Şehir Merkezi", ja: "タウンセンター", "zh-TW": "城鎮中心" },
    note: "The main building; its level is the player's level (TC 25 etc.).",
  },
  {
    term: "Bear Hunt",
    translations: { de: "Bärenjagd", pl: "Polowanie na niedźwiedzia", ko: "곰 사냥", ar: "صيد الدب", fr: "Chasse à l'ours", it: "Caccia all'orso", tr: "Ayı Avı", ja: "クマ狩り", "zh-TW": "獵熊" },
    note: "Alliance rally event against a bear.",
  },
  {
    term: "Viking Vengeance",
    translations: { de: "Rache der Wikinger", pl: "Zemsta Wikingów", ko: "바이킹의 복수", ar: "انتقام الفايكنج", fr: "Vengeance des Vikings", it: "Vendetta dei Vichinghi", tr: "Viking İntikamı", ja: "ヴァイキングの復讐", "zh-TW": "維京復仇" },
    note: "Alliance defence event with waves of Vikings.",
  },
  {
    term: "Swordland Showdown",
    translations: { de: "Schwertland-Showdown", pl: "Starcie w Krainie Mieczy", ko: "검의 땅 결전", ar: "مواجهة أرض السيوف", fr: "Affrontement de Swordland", it: "Resa dei conti di Swordland", tr: "Kılıç Diyarı Hesaplaşması", ja: "ソードランド決戦", "zh-TW": "劍境對決" },
    note: "Cross-kingdom alliance battle.",
  },
  {
    term: "Alliance Championship",
    translations: { de: "Allianz-Meisterschaft", pl: "Mistrzostwa Sojuszy", ko: "연맹 챔피언십", ar: "بطولة التحالفات", fr: "Championnat d'alliance", it: "Campionato delle alleanze", tr: "İttifak Şampiyonası", ja: "同盟チャンピオンシップ", "zh-TW": "聯盟錦標賽" },
  },
  {
    term: "Kingdom of Power",
    translations: { de: "Königreich der Macht", pl: "Królestwo Potęgi", ko: "권력의 왕국", ar: "مملكة القوة", fr: "Royaume de la Puissance", it: "Regno del Potere", tr: "Güç Krallığı", ja: "力の王国", "zh-TW": "強權王國" },
    note: "The official name of the KvK event.",
  },
  {
    term: "Strongest Governor",
    translations: { de: "Stärkster Gouverneur", pl: "Najsilniejszy Gubernator", ko: "최강 영주", ar: "أقوى حاكم", fr: "Gouverneur le plus fort", it: "Governatore più forte", tr: "En Güçlü Vali", ja: "最強領主", "zh-TW": "最強領主" },
  },
  {
    term: "Castle",
    translations: { de: "Burg", pl: "Zamek", ko: "성", ar: "القلعة", fr: "château", it: "castello", tr: "kale", ja: "城", "zh-TW": "王城" },
    note: "The central castle fought over in KvK.",
  },
  {
    term: "Rally",
    translations: { de: "Rally", pl: "Rajd", ko: "집결", ar: "الحشد", fr: "ralliement", it: "rally", tr: "ralli", ja: "集結", "zh-TW": "集結" },
    note: "A group attack started by one player that others join.",
  },
  {
    term: "March",
    translations: { de: "Marsch", pl: "Marsz", ko: "출정", ar: "المسيرة", fr: "marche", it: "marcia", tr: "sefer", ja: "行軍", "zh-TW": "行軍" },
    note: "A group of troops sent out.",
  },
  {
    term: "Garrison",
    translations: { de: "Garnison", pl: "Garnizon", ko: "주둔", ar: "الحامية", fr: "garnison", it: "guarnigione", tr: "garnizon", ja: "駐屯", "zh-TW": "駐防" },
  },
  {
    term: "Reinforce",
    translations: { de: "Verstärken", pl: "Wzmocnić", ko: "지원", ar: "تعزيز", fr: "Renforcer", it: "Rinforzare", tr: "Takviye etmek", ja: "増援する", "zh-TW": "增援" },
  },
  {
    term: "Rally leader",
    translations: { de: "Rally-Leiter", pl: "lider rajdu", ko: "집결 대장", ar: "قائد الحشد", fr: "chef de ralliement", it: "leader del rally", tr: "ralli lideri", ja: "集結リーダー", "zh-TW": "集結隊長" },
    note: "The player who starts a rally; not an alliance leader.",
  },
  {
    term: "Coordinator",
    translations: { de: "Koordinator", pl: "koordynator", ko: "코디네이터", ar: "المنسق", fr: "coordinateur", it: "coordinatore", tr: "koordinatör", ja: "コーディネーター", "zh-TW": "協調員" },
    note: "Runs a team or a Rally Sync room on battle day; not the commander.",
  },
  {
    term: "Commander",
    translations: { de: "Kommandant", pl: "dowódca", ko: "지휘관", ar: "القائد", fr: "commandant", it: "comandante", tr: "komutan", ja: "指揮官", "zh-TW": "指揮官" },
    note: "The one battle commander, above the coordinators.",
  },
  {
    term: "Council",
    translations: { de: "Rat", pl: "rada", ko: "운영진", ar: "المجلس", fr: "conseil", it: "consiglio", tr: "konsey", ja: "評議会", "zh-TW": "議會" },
    note: "The kingdom's leadership that runs this site.",
  },
  {
    term: "Pets",
    translations: { de: "Haustiere", pl: "zwierzaki", ko: "펫", ar: "الحيوانات الأليفة", fr: "familiers", it: "pet", tr: "evcil hayvanlar", ja: "ペット", "zh-TW": "寵物" },
    note: "In-game pets whose skills boost a march for two hours.",
  },
  {
    term: "Hit time",
    translations: { de: "Einschlagzeit", pl: "czas uderzenia", ko: "도착 시간", ar: "وقت الإصابة", fr: "heure d'impact", it: "orario d'impatto", tr: "vuruş zamanı", ja: "着弾時刻", "zh-TW": "命中時間" },
    note: "When the rallies land on the target.",
  },
  {
    term: "Room",
    translations: { de: "Raum", pl: "pokój", ko: "방", ar: "غرفة", fr: "salon", it: "stanza", tr: "oda", ja: "ルーム", "zh-TW": "房間" },
    note: "A Rally Sync room.",
  },
  {
    term: "Rally Sync",
    translations: { de: "Rally-Sync", pl: "Rally Sync", ko: "집결 동기화", ar: "مزامنة الحشود", fr: "Synchro des ralliements", it: "Sincronizzazione Rally", tr: "Ralli Senkronu", ja: "集結同期", "zh-TW": "集結同步" },
    note: "The site's rally timing tool.",
  },
  {
    term: "Infantry",
    translations: { de: "Infanterie", pl: "Piechota", ko: "보병", ar: "المشاة", fr: "Infanterie", it: "Fanteria", tr: "Piyade", ja: "歩兵", "zh-TW": "步兵" },
  },
  {
    term: "Cavalry",
    translations: { de: "Kavallerie", pl: "Kawaleria", ko: "기병", ar: "الفرسان", fr: "Cavalerie", it: "Cavalleria", tr: "Süvari", ja: "騎兵", "zh-TW": "騎兵" },
  },
  {
    term: "Archers",
    translations: { de: "Bogenschützen", pl: "Łucznicy", ko: "궁병", ar: "الرماة", fr: "Archers", it: "Arcieri", tr: "Okçular", ja: "弓兵", "zh-TW": "弓兵" },
  },
  {
    term: "Hero",
    translations: { de: "Held", pl: "Bohater", ko: "영웅", ar: "البطل", fr: "héros", it: "eroe", tr: "kahraman", ja: "英雄", "zh-TW": "英雄" },
  },
  {
    term: "Expedition skill",
    translations: { de: "Expeditionsfähigkeit", pl: "Umiejętność ekspedycyjna", ko: "원정 스킬", ar: "مهارة الحملة", fr: "Compétence d'expédition", it: "Abilità di spedizione", tr: "Sefer becerisi", ja: "遠征スキル", "zh-TW": "遠征技能" },
  },
  {
    term: "Top Expedition Skill",
    translations: { de: "Oberste Expeditionsfähigkeit", pl: "Główna umiejętność ekspedycyjna", ko: "최상위 원정 스킬", ar: "مهارة الحملة العليا", fr: "Compétence d'expédition principale", it: "Abilità di spedizione principale", tr: "Ana sefer becerisi", ja: "最上位遠征スキル", "zh-TW": "首要遠征技能" },
    note: "The hero's top-right skill, marked with a flag icon in the game.",
  },
  {
    term: "Lethality",
    translations: { de: "Tödlichkeit", pl: "Śmiercionośność", ko: "치명", ar: "الفتك", fr: "Létalité", it: "Letalità", tr: "Öldürücülük", ja: "致死率", "zh-TW": "致命" },
  },
  {
    term: "Gems",
    translations: { de: "Edelsteine", pl: "Klejnoty", ko: "보석", ar: "الجواهر", fr: "Gemmes", it: "Gemme", tr: "Mücevher", ja: "ジェム", "zh-TW": "寶石" },
    note: "Premium currency.",
  },
  {
    term: "Speedup",
    translations: { de: "Beschleunigung", pl: "Przyspieszenie", ko: "가속", ar: "التسريع", fr: "accélérateur", it: "acceleratore", tr: "hızlandırma", ja: "加速", "zh-TW": "加速" },
  },
  {
    term: "Gift code",
    translations: { de: "Geschenkcode", pl: "Kod podarunkowy", ko: "선물 코드", ar: "رمز الهدية", fr: "Code cadeau", it: "Codice regalo", tr: "Hediye kodu", ja: "ギフトコード", "zh-TW": "禮包碼" },
  },
  {
    term: "Forgehammer",
    translations: { de: "Schmiedehammer", pl: "Młot kowalski", ko: "단조 망치", ar: "مطرقة الحدادة", fr: "Marteau de forge", it: "Martello da forgia", tr: "Demirci Çekici", ja: "鍛造ハンマー", "zh-TW": "鍛造錘" },
  },
  {
    term: "Mithril",
    translations: { de: "Mithril", pl: "Mithril", ko: "미스릴", ar: "الميثريل", fr: "Mithril", it: "Mithril", tr: "Mithril", ja: "ミスリル", "zh-TW": "秘銀" },
  },
  {
    term: "Truegold",
    translations: { de: "Truegold", pl: "Truegold", ko: "트루골드", ar: "الذهب الحقيقي", fr: "Truegold", it: "Truegold", tr: "Truegold", ja: "トゥルーゴールド", "zh-TW": "真金" },
  },
  {
    term: "Tempered Truegold",
    translations: { de: "gehärtetes Truegold", pl: "hartowany Truegold", ko: "강화 트루골드", ar: "الذهب الحقيقي المُقسّى", fr: "Truegold trempé", it: "Truegold temprato", tr: "Sertleştirilmiş Truegold", ja: "強化トゥルーゴールド", "zh-TW": "淬鍊真金" },
  },
  {
    term: "Truegold Dust",
    translations: { de: "Truegold-Staub", pl: "Pył Truegold", ko: "트루골드 가루", ar: "غبار الذهب الحقيقي", fr: "Poussière de Truegold", it: "Polvere di Truegold", tr: "Truegold Tozu", ja: "トゥルーゴールドの粉", "zh-TW": "真金粉塵" },
  },
  {
    term: "Watchtower",
    translations: { de: "Wachturm", pl: "Strażnica", ko: "망루", ar: "برج المراقبة", fr: "Tour de guet", it: "Torre di guardia", tr: "Gözetleme Kulesi", ja: "監視塔", "zh-TW": "瞭望塔" },
    note: "Building that gives the daily intel missions.",
  },
  {
    term: "Intel mission",
    translations: { de: "Aufklärungsmission", pl: "Misja wywiadowcza", ko: "첩보 임무", ar: "مهمة استخبارات", fr: "Mission de renseignement", it: "Missione di intelligence", tr: "İstihbarat görevi", ja: "情報ミッション", "zh-TW": "情報任務" },
  },
  {
    term: "Governor Charm",
    translations: { de: "Gouverneurs-Charm", pl: "Amulet gubernatora", ko: "영주 부적", ar: "تميمة الحاكم", fr: "Charme de Gouverneur", it: "Amuleto del Governatore", tr: "Vali Tılsımı", ja: "領主のお守り", "zh-TW": "領主護符" },
  },
  {
    term: "Governor Gear",
    translations: { de: "Gouverneursausrüstung", pl: "Ekwipunek gubernatora", ko: "영주 장비", ar: "عتاد الحاكم", fr: "Équipement de Gouverneur", it: "Equipaggiamento del Governatore", tr: "Vali Teçhizatı", ja: "領主装備", "zh-TW": "領主裝備" },
  },
  {
    term: "Hero Roulette",
    translations: { de: "Helden-Roulette", pl: "Ruletka bohaterów", ko: "영웅 룰렛", ar: "روليت الأبطال", fr: "Roulette des héros", it: "Roulette degli eroi", tr: "Kahraman Ruleti", ja: "ヒーロールーレット", "zh-TW": "英雄輪盤" },
  },
  {
    term: "Hero Shard",
    translations: { de: "Heldensplitter", pl: "Odłamek bohatera", ko: "영웅 조각", ar: "شظية البطل", fr: "Fragment de héros", it: "Frammento di eroe", tr: "Kahraman Parçası", ja: "ヒーローの欠片", "zh-TW": "英雄碎片" },
  },
  {
    term: "Widget",
    translations: { de: "Widget", pl: "Widżet", ko: "위젯", ar: "أداة (Widget)", fr: "Widget", it: "Widget", tr: "Widget", ja: "ウィジェット", "zh-TW": "小工具" },
  },
  {
    term: "Master Emblem",
    translations: { de: "Meister-Emblem", pl: "Emblemat mistrza", ko: "마스터 엠블럼", ar: "شعار المعلّم", fr: "Emblème de maître", it: "Emblema del maestro", tr: "Usta Amblemi", ja: "マスターエンブレム", "zh-TW": "大師徽章" },
  },
  {
    term: "Master's Manuscript",
    translations: { de: "Meister-Manuskript", pl: "Manuskrypt mistrza", ko: "마스터의 원고", ar: "مخطوطة المعلّم", fr: "Manuscrit du maître", it: "Manoscritto del maestro", tr: "Ustanın El Yazması", ja: "マスターの写本", "zh-TW": "大師手稿" },
  },
  {
    term: "Taming Mark",
    translations: { de: "Zähmungsmarke", pl: "Znak oswajania", ko: "길들이기 표식", ar: "علامة الترويض", fr: "Marque d'apprivoisement", it: "Marchio di addomesticamento", tr: "Evcilleştirme İşareti", ja: "調教の印", "zh-TW": "馴獸印記" },
    note: "Pet upgrade item.",
  },
  {
    term: "War Academy",
    translations: { de: "Kriegsakademie", pl: "Akademia Wojenna", ko: "전쟁 아카데미", ar: "أكاديمية الحرب", fr: "Académie de guerre", it: "Accademia di guerra", tr: "Savaş Akademisi", ja: "戦争アカデミー", "zh-TW": "戰爭學院" },
  },
  { term: "Master Pan", keep: true, note: "A name in the game; keep it." },
  {
    term: "Bison",
    translations: { de: "Bison", pl: "Bizon", ko: "들소", ar: "البيسون", fr: "Bison", it: "Bisonte", tr: "Bizon", ja: "バイソン", "zh-TW": "野牛" },
    note: "A pet whose skill speeds up gathering.",
  },
  {
    term: "Alliance RSS node",
    translations: { de: "Allianz-Ressourcenfeld", pl: "Węzeł surowców sojuszu", ko: "연맹 자원지", ar: "عقدة موارد التحالف", fr: "Nœud de ressources d'alliance", it: "Nodo risorse dell'alleanza", tr: "İttifak kaynak noktası", ja: "同盟資源地", "zh-TW": "聯盟資源點" },
    note: "A protected resource tile the alliance places (one resource type per day): nobody can attack marches gathering there, they gather up to full capacity, and players recall them before the 00:00 UTC reset to get the rewards.",
  },
  {
    term: "Invasion",
    translations: { de: "Invasion", pl: "Inwazja", ko: "침공", ar: "الغزو", fr: "Invasion", it: "Invasione", tr: "İstila", ja: "侵攻", "zh-TW": "入侵" },
    note: "The KvK phase on Saturday when kingdoms can attack each other.",
  },
  {
    term: "State Medal",
    translations: { de: "Staatsmedaille", pl: "Medal Państwowy", ko: "국가 메달", ar: "وسام الدولة", fr: "Médaille d'État", it: "Medaglia di Stato", tr: "Devlet Madalyası", ja: "国家勲章", "zh-TW": "國家勳章" },
  },
  {
    term: "Shield",
    translations: { de: "Schild", pl: "Tarcza", ko: "보호막", ar: "الدرع", fr: "Bouclier", it: "Scudo", tr: "Kalkan", ja: "シールド", "zh-TW": "護盾" },
    note: "Protection that prevents attacks on a town (\"shield up\").",
  },
  {
    term: "Minister",
    translations: { de: "Minister", pl: "Minister", ko: "장관", ar: "الوزير", fr: "Ministre", it: "Ministro", tr: "Bakan", ja: "大臣", "zh-TW": "大臣" },
    note: "Appointed kingdom position with buffs during KvK.",
  },
  {
    term: "Transfer",
    translations: { de: "Transfer", pl: "Transfer", ko: "이전", ar: "الانتقال", fr: "Transfert", it: "Trasferimento", tr: "Transfer", ja: "移転", "zh-TW": "遷移" },
    note: "Moving a player to another kingdom.",
  },
  {
    term: "Daily reset",
    translations: { de: "Täglicher Reset", pl: "Dzienny reset", ko: "일일 초기화", ar: "إعادة التعيين اليومية", fr: "Réinitialisation quotidienne", it: "Reset giornaliero", tr: "Günlük sıfırlama", ja: "日次リセット", "zh-TW": "每日重置" },
  },
  { term: "TMP", keep: true, note: "Tag of one of Kingdom 1241's two battle alliances ([TMP] counter-rallies, [KvK] rallies the castle). Keep the tag." },
  {
    term: "Counter-rally",
    translations: { de: "Gegen-Rally", pl: "Kontr-rajd", ko: "카운터 집결", ar: "حشد مضاد", fr: "Contre-rassemblement", it: "Contro-raduno", tr: "Karşı toplanma", ja: "カウンター集結", "zh-TW": "反集結" },
    note: "A rally launched against the enemy's rally or against the castle they hold.",
  },
  {
    term: "Castle Battle",
    translations: { de: "Burgschlacht", pl: "Bitwa o Zamek", ko: "성 전투", ar: "معركة القلعة", fr: "Bataille du château", it: "Battaglia del castello", tr: "Kale Savaşı", ja: "城の戦い", "zh-TW": "城堡戰" },
    note: "The fight for the castle on KvK battle day.",
  },
  {
    term: "Formation",
    translations: { de: "Formation", pl: "Formacja", ko: "편성", ar: "التشكيلة", fr: "Formation", it: "Formazione", tr: "Düzen", ja: "編成", "zh-TW": "編隊" },
    note: "A saved set of heroes + troop ratio.",
  },
  {
    term: "Troop Ratio",
    translations: { de: "Truppenverhältnis", pl: "Proporcje wojsk", ko: "병력 비율", ar: "نسبة توزيع القوات", fr: "Ratio de troupes", it: "Rapporto truppe", tr: "Birlik Oranı", ja: "兵種比率", "zh-TW": "兵力比例" },
    note: "The in-game preset feature where formations are saved.",
  },
  {
    term: "Rally lead",
    translations: { de: "Rally-Leiter", pl: "Lider rajdu", ko: "집결 대장", ar: "قائد الحشد", fr: "Chef de rassemblement", it: "Capo raduno", tr: "Toplanma lideri", ja: "集結リーダー", "zh-TW": "集結隊長" },
    note: "The player who starts a rally (attack). Others 'rally join'.",
  },
  {
    term: "Garrison lead",
    translations: { de: "Garnison-Leiter", pl: "Lider garnizonu", ko: "주둔 대장", ar: "قائد الحامية", fr: "Chef de garnison", it: "Capo guarnigione", tr: "Garnizon lideri", ja: "駐屯リーダー", "zh-TW": "駐防隊長" },
    note: "The defending counterpart of a rally lead: the player whose garrison others join ('garrison join'). Never 'rally' on the defence side.",
  },
  {
    term: "Buff",
    translations: { de: "Buff", pl: "Buff", ko: "버프", ar: "تعزيز", fr: "Bonus", it: "Bonus", tr: "Güçlendirme", ja: "バフ", "zh-TW": "增益" },
  },
  {
    term: "Pet",
    translations: { de: "Haustier", pl: "Zwierzak", ko: "펫", ar: "الحيوان الأليف", fr: "Familier", it: "Animale", tr: "Evcil hayvan", ja: "ペット", "zh-TW": "寵物" },
  },
  {
    term: "Deployment Capacity",
    translations: { de: "Einsatzkapazität", pl: "Pojemność rozmieszczenia", ko: "배치 수용량", ar: "سعة الانتشار", fr: "Capacité de déploiement", it: "Capacità di schieramento", tr: "Konuşlandırma Kapasitesi", ja: "出撃上限", "zh-TW": "出征容量" },
    note: "A buff that lets a player send more troops.",
  },
];

/** Render the glossary for a target language as prompt text. */
export function glossaryForPrompt(targetLocale: string): string {
  const lines: string[] = [];
  for (const entry of GLOSSARY) {
    if (entry.keep) {
      lines.push(`- "${entry.term}": keep exactly as is${entry.note ? ` (${entry.note})` : ""}`);
      continue;
    }
    const preferred = entry.translations?.[targetLocale];
    if (preferred) {
      lines.push(`- "${entry.term}" → "${preferred}"${entry.note ? ` (${entry.note})` : ""}`);
    } else {
      lines.push(`- "${entry.term}": use the official in-game term, or keep English if unsure${entry.note ? ` (${entry.note})` : ""}`);
    }
  }
  return lines.join("\n");
}
