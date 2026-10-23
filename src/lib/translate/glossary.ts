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
  { term: "KvK", keep: true, note: "Kingdom vs Kingdom. Keep the abbreviation." },
  { term: "R4", keep: true, note: "Alliance rank 4 (officer)." },
  { term: "R5", keep: true, note: "Alliance rank 5 (leader)." },
  { term: "UTC", keep: true },
  { term: "Discord", keep: true },
  { term: "MightPulse", keep: true },
  {
    term: "Kingdom",
    translations: { de: "Königreich", pl: "Królestwo", ko: "왕국", ar: "المملكة" },
    note: "A game server.",
  },
  {
    term: "Alliance",
    translations: { de: "Allianz", pl: "Sojusz", ko: "연맹", ar: "التحالف" },
  },
  {
    term: "Governor",
    translations: { de: "Gouverneur", pl: "Gubernator", ko: "영주", ar: "الحاكم" },
    note: "A player.",
  },
  {
    term: "Governor ID",
    translations: { de: "Gouverneur-ID", pl: "ID gubernatora", ko: "영주 ID", ar: "معرّف الحاكم" },
  },
  {
    term: "Town Center",
    translations: { de: "Stadtzentrum", pl: "Centrum miasta", ko: "마을 회관", ar: "مركز المدينة" },
    note: "The main building; its level is the player's level (TC 25 etc.).",
  },
  {
    term: "Bear Hunt",
    translations: { de: "Bärenjagd", pl: "Polowanie na niedźwiedzia", ko: "곰 사냥", ar: "صيد الدب" },
    note: "Alliance rally event against a bear.",
  },
  {
    term: "Viking Vengeance",
    translations: { de: "Rache der Wikinger", pl: "Zemsta Wikingów", ko: "바이킹의 복수", ar: "انتقام الفايكنج" },
    note: "Alliance defence event with waves of Vikings.",
  },
  {
    term: "Swordland Showdown",
    translations: { de: "Schwertland-Showdown", pl: "Starcie w Krainie Mieczy", ko: "검의 땅 결전", ar: "مواجهة أرض السيوف" },
    note: "Cross-kingdom alliance battle.",
  },
  {
    term: "Alliance Championship",
    translations: { de: "Allianz-Meisterschaft", pl: "Mistrzostwa Sojuszy", ko: "연맹 챔피언십", ar: "بطولة التحالفات" },
  },
  {
    term: "Kingdom of Power",
    translations: { de: "Königreich der Macht", pl: "Królestwo Potęgi", ko: "권력의 왕국", ar: "مملكة القوة" },
    note: "The official name of the KvK event.",
  },
  {
    term: "Strongest Governor",
    translations: { de: "Stärkster Gouverneur", pl: "Najsilniejszy Gubernator", ko: "최강 영주", ar: "أقوى حاكم" },
  },
  {
    term: "Castle",
    translations: { de: "Burg", pl: "Zamek", ko: "성", ar: "القلعة" },
    note: "The central castle fought over in KvK.",
  },
  {
    term: "Rally",
    translations: { de: "Rally", pl: "Rajd", ko: "집결", ar: "الحشد" },
    note: "A group attack started by one player that others join.",
  },
  {
    term: "March",
    translations: { de: "Marsch", pl: "Marsz", ko: "출정", ar: "المسيرة" },
    note: "A group of troops sent out.",
  },
  {
    term: "Garrison",
    translations: { de: "Garnison", pl: "Garnizon", ko: "주둔", ar: "الحامية" },
  },
  {
    term: "Reinforce",
    translations: { de: "Verstärken", pl: "Wzmocnić", ko: "지원", ar: "تعزيز" },
  },
  {
    term: "Infantry",
    translations: { de: "Infanterie", pl: "Piechota", ko: "보병", ar: "المشاة" },
  },
  {
    term: "Cavalry",
    translations: { de: "Kavallerie", pl: "Kawaleria", ko: "기병", ar: "الفرسان" },
  },
  {
    term: "Archers",
    translations: { de: "Bogenschützen", pl: "Łucznicy", ko: "궁병", ar: "الرماة" },
  },
  {
    term: "Hero",
    translations: { de: "Held", pl: "Bohater", ko: "영웅", ar: "البطل" },
  },
  {
    term: "Expedition skill",
    translations: { de: "Expeditionsfähigkeit", pl: "Umiejętność ekspedycyjna", ko: "원정 스킬", ar: "مهارة الحملة" },
  },
  {
    term: "Lethality",
    translations: { de: "Tödlichkeit", pl: "Śmiercionośność", ko: "치명", ar: "الفتك" },
  },
  {
    term: "Gems",
    translations: { de: "Edelsteine", pl: "Klejnoty", ko: "보석", ar: "الجواهر" },
    note: "Premium currency.",
  },
  {
    term: "Speedup",
    translations: { de: "Beschleunigung", pl: "Przyspieszenie", ko: "가속", ar: "التسريع" },
  },
  {
    term: "Gift code",
    translations: { de: "Geschenkcode", pl: "Kod podarunkowy", ko: "선물 코드", ar: "رمز الهدية" },
  },
  {
    term: "Forgehammer",
    translations: { de: "Schmiedehammer", pl: "Młot kowalski", ko: "단조 망치", ar: "مطرقة الحدادة" },
  },
  {
    term: "Mithril",
    translations: { de: "Mithril", pl: "Mithril", ko: "미스릴", ar: "الميثريل" },
  },
  {
    term: "Truegold",
    translations: { de: "Truegold", pl: "Truegold", ko: "트루골드", ar: "الذهب الحقيقي" },
  },
  {
    term: "State Medal",
    translations: { de: "Staatsmedaille", pl: "Medal Państwowy", ko: "국가 메달", ar: "وسام الدولة" },
  },
  {
    term: "Shield",
    translations: { de: "Schild", pl: "Tarcza", ko: "보호막", ar: "الدرع" },
    note: "Protection that prevents attacks on a town (\"shield up\").",
  },
  {
    term: "Minister",
    translations: { de: "Minister", pl: "Minister", ko: "장관", ar: "الوزير" },
    note: "Appointed kingdom position with buffs during KvK.",
  },
  {
    term: "Transfer",
    translations: { de: "Transfer", pl: "Transfer", ko: "이전", ar: "الانتقال" },
    note: "Moving a player to another kingdom.",
  },
  {
    term: "Daily reset",
    translations: { de: "Täglicher Reset", pl: "Dzienny reset", ko: "일일 초기화", ar: "إعادة التعيين اليومية" },
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
