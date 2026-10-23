/**
 * Languages the site offers on first deploy. Admins can change this list in
 * the `languages` table later (phase 2 adds a UI for it). The codes must
 * exist in `src/lib/i18n/languages.ts`.
 */
export const SEED_LANGUAGES: Array<{ code: string; enabled: boolean; sortOrder: number }> = [
  { code: "en", enabled: true, sortOrder: 0 },
  { code: "de", enabled: true, sortOrder: 1 },
  { code: "ko", enabled: true, sortOrder: 2 },
  { code: "pl", enabled: true, sortOrder: 3 },
  { code: "ar", enabled: true, sortOrder: 4 },
  { code: "tr", enabled: true, sortOrder: 5 },
  { code: "it", enabled: true, sortOrder: 6 },
  { code: "ja", enabled: true, sortOrder: 7 },
  { code: "zh-TW", enabled: true, sortOrder: 8 },
  { code: "fr", enabled: true, sortOrder: 9 },
];
