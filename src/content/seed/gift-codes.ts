/**
 * Gift codes shown on the home page. These are EXAMPLES — replace them with
 * real, working codes. Expired codes are hidden automatically.
 */
export interface SeedGiftCode {
  id: string;
  code: string;
  rewards: string;
  expiresAt: string | null;
  addedAt: string;
}

export const SEED_GIFT_CODES: SeedGiftCode[] = [
  {
    id: "c1000000-0000-4000-8000-000000000001",
    code: "KINGDOM1241",
    rewards: "Example code — replace with a real one. (Gems, speedups, resources)",
    expiresAt: null,
    addedAt: "2026-10-23T10:00:00.000Z",
  },
  {
    id: "c1000000-0000-4000-8000-000000000002",
    code: "WELCOME2026",
    rewards: "Example code — replace with a real one. (Hero shards, Forgehammers)",
    expiresAt: "2026-12-31T23:59:59.000Z",
    addedAt: "2026-10-23T10:00:00.000Z",
  },
];
