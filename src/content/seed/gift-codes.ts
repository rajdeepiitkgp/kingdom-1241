/**
 * Gift codes shown on the home page. None are seeded: the real ones come from
 * kingshot.net every hour (src/lib/gift-codes/), and moderators add others on
 * the admin page. The two example codes of the first setup were removed by
 * migration 0018.
 */
export interface SeedGiftCode {
  id: string;
  code: string;
  rewards: string;
  expiresAt: string | null;
  addedAt: string;
}

export const SEED_GIFT_CODES: SeedGiftCode[] = [];
