import type { GiftCode } from "@/lib/data/types";
import { pick } from "@/lib/i18n/localized";

/** A gift code as Home's card sees it: what it gives in the visitor's language only. */
export type GiftCodeView = Omit<GiftCode, "rewards"> & { rewards: string };

export function giftCodeView(code: GiftCode, locale: string): GiftCodeView {
  return { ...code, rewards: pick(code.rewards, locale) };
}
