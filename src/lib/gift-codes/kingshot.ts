// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.

/**
 * kingshot.net's list of active gift codes (pure, unit-tested; sync.ts makes
 * the call). A free endpoint without a key, read once an hour by the site's
 * server: browsers can't call it (no CORS), and it would hand every visitor's
 * address to a third party. It lists only the codes that still work, with the
 * date kingshot.net added them and, sometimes, an expiry; no rewards.
 */

export const KINGSHOT_GIFT_CODES_URL = "https://kingshot.net/api/gift-codes";
/** Credited on Home (the codes come from there). */
export const KINGSHOT_SITE = "kingshot.net";
export const KINGSHOT_GIFT_CODES_PAGE = "https://kingshot.net/gift-codes";
/** The game's own page for redeeming a code with a player ID. */
export const OFFICIAL_REDEEM_PAGE = "https://ks-giftcode.centurygame.com/";

export interface FeedCode {
  code: string;
  expiresAt: string | null;
  /** When kingshot.net added it. */
  createdAt: string | null;
}

/** A gift code as players type it: case-sensitive, no spaces. */
export const GIFT_CODE_PATTERN = /^\S{2,40}$/u;

const iso = (value: unknown): string | null => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? new Date(Date.parse(value)).toISOString() : null);

/**
 * The codes in the answer, or null when the answer isn't the list it should
 * be: a changed format must never read as "no codes" (that would end every
 * code on Home). Entries that aren't a code are skipped.
 */
export function parseGiftCodeFeed(value: unknown): FeedCode[] | null {
  if (!value || typeof value !== "object") return null;
  const body = value as { status?: unknown; data?: { giftCodes?: unknown } };
  if (body.status !== "success" || !body.data || !Array.isArray(body.data.giftCodes)) return null;
  const seen = new Set<string>();
  const codes: FeedCode[] = [];
  for (const entry of body.data.giftCodes as unknown[]) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const code = typeof row.code === "string" ? row.code.trim() : "";
    if (!GIFT_CODE_PATTERN.test(code) || seen.has(code)) continue;
    seen.add(code);
    codes.push({ code, expiresAt: iso(row.expiresAt), createdAt: iso(row.createdAt) });
  }
  return codes;
}
