import { isLocaleCode } from "@/lib/i18n/languages";
import { GAME_NAME_MAX, isTextKey, RATING_MAX, RATING_MIN, type RatingKey, type RetroConfig, TEXT_MAX, type TextKey, TEXT_KEYS } from "./questions";

/**
 * Parsing of a player's feedback submission (pure, unit-tested). Errors are
 * codes, not sentences: the form shows them in the player's language.
 */

export type RetroErrorCode = "required" | "invalid" | "tooLong";
export type RetroErrors = Record<string, RetroErrorCode>;

export interface RetroSubmission {
  governorId: string;
  gameName: string;
  /** `null` = other / no alliance. */
  allianceTag: string | null;
  ratings: Partial<Record<RatingKey, number>>;
  texts: Record<TextKey, string>;
  locale: string;
}

/** The value of the alliance dropdown that means "other / no alliance". */
export const NO_ALLIANCE = "-";

/** Field names of the player form. */
export const FIELD = {
  governorId: "governorId",
  gameName: "gameName",
  alliance: "alliance",
  locale: "locale",
  token: "token",
  retroId: "retroId",
  /** Honeypot: hidden from people, filled by bots. */
  honeypot: "website",
  rating: (key: RatingKey) => `rating.${key}`,
  text: (key: TextKey) => `text.${key}`,
} as const;

function text(fd: FormData, name: string): string {
  const value = fd.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/** Digits only, spaces and the usual separators dropped ("12 345 678" → "12345678"). */
export function normalizeGovernorId(raw: string): string {
  return raw.replace(/[\s.\-_]/g, "");
}

export function isGovernorId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9]{4,16}$/.test(value);
}

export function isHoneypotFilled(fd: FormData): boolean {
  return text(fd, FIELD.honeypot) !== "";
}

export interface ParseRetroOptions {
  /** Name and alliance confirmed through MightPulse: the form's own values are ignored. */
  verified?: { name: string; allianceTag: string | null } | null;
}

export type RetroFormResult = { ok: true; value: RetroSubmission } | { ok: false; errors: RetroErrors };

export function parseRetroForm(fd: FormData, config: RetroConfig, allianceTags: readonly string[], options: ParseRetroOptions = {}): RetroFormResult {
  const errors: RetroErrors = {};

  const governorId = normalizeGovernorId(text(fd, FIELD.governorId));
  if (!governorId) errors[FIELD.governorId] = "required";
  else if (!isGovernorId(governorId)) errors[FIELD.governorId] = "invalid";

  let gameName: string;
  let allianceTag: string | null;
  if (options.verified) {
    gameName = options.verified.name.slice(0, GAME_NAME_MAX);
    const known = options.verified.allianceTag && allianceTags.includes(options.verified.allianceTag) ? options.verified.allianceTag : null;
    // An alliance the site doesn't list yet (or none): the player's own choice counts, if it is a listed one.
    const chosen = text(fd, FIELD.alliance);
    allianceTag = known ?? (chosen && chosen !== NO_ALLIANCE && allianceTags.includes(chosen) ? chosen : null);
  } else {
    gameName = text(fd, FIELD.gameName);
    if (!gameName) errors[FIELD.gameName] = "required";
    else if (gameName.length > GAME_NAME_MAX) errors[FIELD.gameName] = "tooLong";
    const alliance = text(fd, FIELD.alliance);
    if (!alliance) errors[FIELD.alliance] = "required";
    else if (alliance !== NO_ALLIANCE && !allianceTags.includes(alliance)) errors[FIELD.alliance] = "invalid";
    allianceTag = alliance === NO_ALLIANCE ? null : alliance;
  }

  const ratings: Partial<Record<RatingKey, number>> = {};
  for (const [key, setting] of Object.entries(config.ratings) as [RatingKey, RetroConfig["ratings"][RatingKey]][]) {
    if (!setting.shown) continue;
    const raw = text(fd, FIELD.rating(key));
    if (!raw) {
      if (setting.required) errors[FIELD.rating(key)] = "required";
      continue;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n < RATING_MIN || n > RATING_MAX) {
      errors[FIELD.rating(key)] = "invalid";
      continue;
    }
    ratings[key] = n;
  }

  const texts = Object.fromEntries(TEXT_KEYS.map((key) => [key, ""])) as Record<TextKey, string>;
  for (const [key, setting] of Object.entries(config.texts) as [TextKey, RetroConfig["texts"][TextKey]][]) {
    if (!setting.shown || !isTextKey(key)) continue;
    const value = text(fd, FIELD.text(key)).replace(/\r\n/g, "\n");
    if (!value) {
      if (setting.required) errors[FIELD.text(key)] = "required";
      continue;
    }
    if (value.length > TEXT_MAX) {
      errors[FIELD.text(key)] = "tooLong";
      continue;
    }
    texts[key] = value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  const locale = text(fd, FIELD.locale);
  return {
    ok: true,
    value: { governorId, gameName, allianceTag, ratings, texts, locale: isLocaleCode(locale) ? locale : "en" },
  };
}
