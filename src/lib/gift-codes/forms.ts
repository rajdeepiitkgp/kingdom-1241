import { type FieldErrors, type FormResult, textField, utcDateTimeField } from "@/lib/admin/forms";
import { GIFT_CODE_PATTERN } from "./kingshot";

/**
 * The moderators' gift-code form (pure, unit-tested): add a code kingshot.net
 * doesn't list yet, or write what a code gives and when it expires.
 */

export const MAX_REWARDS = 120;
export const CODE_HINT = "Exactly as in the game: codes are case-sensitive, no spaces.";

export interface GiftCodeFields {
  /** Only when adding: a code is never renamed (delete it and add the right one). */
  code: string | null;
  /** English; the translation pipeline fills the other languages. */
  rewards: string;
  expiresAt: string | null;
}

export function parseGiftCodeForm(form: FormData, { adding, now }: { adding: boolean; now: number }): FormResult<GiftCodeFields> {
  const errors: FieldErrors = {};
  const code = adding ? textField(form, "code") : null;
  if (code !== null && !GIFT_CODE_PATTERN.test(code)) errors.code = "2 to 40 characters, no spaces.";
  const rewards = textField(form, "rewards");
  if (rewards.length > MAX_REWARDS) errors.rewards = `At most ${MAX_REWARDS} characters.`;
  const expiresAt = utcDateTimeField(form, "expiresAt");
  if (expiresAt === undefined) errors.expiresAt = "Pick a date and time (UTC), or leave it empty.";
  // A code added with an expiry behind us would never show; an existing one may be corrected to the past (it then hides itself).
  else if (adding && expiresAt !== null && Date.parse(expiresAt) <= now) errors.expiresAt = "That moment is already past.";
  if (Object.keys(errors).length > 0 || expiresAt === undefined) return { ok: false, errors };
  return { ok: true, value: { code, rewards, expiresAt } };
}
