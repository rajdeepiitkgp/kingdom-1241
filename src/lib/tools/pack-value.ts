/**
 * Pack value calculator.
 *
 * Every item is converted to a gem-equivalent value (community estimates),
 * summed, and compared with the gems you would get for the same money by
 * buying gems directly (default: 500 gems per 1 USD).
 */

export type PackItemCategory =
  | "gems"
  | "speedups"
  | "resources"
  | "hero"
  | "heroGear"
  | "governorGear"
  | "pets"
  | "other";

export interface PackItemDefinition {
  id: string;
  /** English name — game items are usually referred to by their English names. */
  name: string;
  category: PackItemCategory;
  /** Gem-equivalent value of one unit. */
  gems: number;
  /** Basic resources can be excluded from the total. */
  basicResource?: boolean;
}

export const DEFAULT_GEMS_PER_UNIT = 500;

export const PACK_ITEM_CATALOG: PackItemDefinition[] = [
  // Gems & currency
  { id: "gem", name: "Gem", category: "gems", gems: 1 },
  { id: "gold", name: "Gold", category: "gems", gems: 1 },
  { id: "vip-point", name: "VIP point", category: "gems", gems: 2 },
  { id: "vip-30d", name: "30-day VIP time", category: "gems", gems: 10_000 },
  { id: "stamina", name: "Governor stamina (1)", category: "gems", gems: 300 },
  { id: "truegold", name: "Truegold", category: "gems", gems: 500 },
  { id: "truegold-chest", name: "Truegold chest", category: "gems", gems: 6_400 },

  // Speedups (≈13.3 gems per minute)
  { id: "speedup-1m", name: "Speedup 1 min", category: "speedups", gems: 13 },
  { id: "speedup-5m", name: "Speedup 5 min", category: "speedups", gems: 66 },
  { id: "speedup-1h", name: "Speedup 1 h", category: "speedups", gems: 800 },
  { id: "speedup-3h", name: "Speedup 3 h", category: "speedups", gems: 2_400 },
  { id: "speedup-8h", name: "Speedup 8 h", category: "speedups", gems: 6_400 },
  { id: "speedup-24h", name: "Speedup 24 h", category: "speedups", gems: 19_200 },

  // Basic resources
  { id: "bread-10k", name: "Bread ×10k", category: "resources", gems: 5, basicResource: true },
  { id: "wood-10k", name: "Wood ×10k", category: "resources", gems: 5, basicResource: true },
  { id: "stone-10k", name: "Stone ×10k", category: "resources", gems: 25, basicResource: true },
  { id: "iron-10k", name: "Iron ×10k", category: "resources", gems: 100, basicResource: true },
  { id: "resource-chest-1", name: "Lv1 custom resource chest", category: "resources", gems: 5, basicResource: true },
  { id: "resource-chest-2", name: "Lv2 custom resource chest", category: "resources", gems: 50, basicResource: true },
  { id: "resource-chest-3", name: "Lv3 custom resource chest", category: "resources", gems: 338, basicResource: true },

  // Heroes
  { id: "hero-xp-5k", name: "Hero XP ×5,000", category: "hero", gems: 150 },
  { id: "hero-xp-10k", name: "Hero XP ×10,000", category: "hero", gems: 300 },
  { id: "manual-rare", name: "Rare skill manual", category: "hero", gems: 150 },
  { id: "manual-epic", name: "Epic skill manual", category: "hero", gems: 500 },
  { id: "manual-mythic", name: "Mythic skill manual", category: "hero", gems: 1_000 },
  { id: "shard-rare", name: "Rare general hero shard", category: "hero", gems: 500 },
  { id: "shard-epic", name: "Epic general hero shard", category: "hero", gems: 1_000 },
  { id: "shard-mythic", name: "Mythic general hero shard", category: "hero", gems: 5_000 },
  { id: "hero-widget", name: "Custom hero widget", category: "hero", gems: 5_000 },

  // Hero gear
  { id: "enhancement-xp-100", name: "Enhancement XP component ×100", category: "heroGear", gems: 500 },
  { id: "forgehammer", name: "Forgehammer", category: "heroGear", gems: 2_500 },
  { id: "mithril", name: "Mithril", category: "heroGear", gems: 10_000 },
  { id: "lucky-gear-chest", name: "Lucky hero gear chest", category: "heroGear", gems: 2_000 },
  { id: "mythic-gear-chest", name: "Custom mythic hero gear chest", category: "heroGear", gems: 120_000 },

  // Governor gear & charms
  { id: "charm-design", name: "Charm design", category: "governorGear", gems: 1_000 },
  { id: "charm-guide", name: "Charm guide", category: "governorGear", gems: 1_000 },
  { id: "artisans-vision", name: "Artisan's Vision", category: "governorGear", gems: 1_000 },
  { id: "gilded-threads", name: "Gilded Threads", category: "governorGear", gems: 200 },
  { id: "satin", name: "Satin", category: "governorGear", gems: 2 },
  { id: "gov-gear-materials-chest", name: "Governor gear materials chest", category: "governorGear", gems: 2_600 },
  { id: "gov-gear-variety-chest", name: "Governor gear variety chest", category: "governorGear", gems: 3_370 },
  { id: "gov-charm-material-chest", name: "Governor charm material chest", category: "governorGear", gems: 3_090 },

  // Pets
  { id: "taming-mark-common", name: "Common taming mark", category: "pets", gems: 500 },
  { id: "taming-mark-advanced", name: "Advanced taming mark", category: "pets", gems: 6_000 },
  { id: "nutrient-potion", name: "Nutrient potion", category: "pets", gems: 1_500 },
  { id: "promotion-medallion", name: "Promotion medallion", category: "pets", gems: 3_000 },
  { id: "growth-manual", name: "Growth manual", category: "pets", gems: 300 },
  { id: "pet-food", name: "Pet food", category: "pets", gems: 2 },

  // Other
  { id: "advanced-teleporter", name: "Advanced teleporter", category: "other", gems: 4_000 },
  { id: "silver-key", name: "Silver key", category: "other", gems: 500 },
  { id: "gold-key", name: "Gold key", category: "other", gems: 1_500 },
  { id: "lucky-chip", name: "Lucky chip", category: "other", gems: 1_500 },
  { id: "combat-boost-12h", name: "12 h combat boost (any)", category: "other", gems: 20_000 },
];

export const PACK_CATEGORIES: PackItemCategory[] = [
  "gems",
  "speedups",
  "resources",
  "hero",
  "heroGear",
  "governorGear",
  "pets",
  "other",
];

export interface PackLine {
  /** Catalog id, or "custom". */
  itemId: string;
  name: string;
  quantity: number;
  /** Gems per unit (editable, pre-filled from the catalog). */
  gems: number;
  basicResource: boolean;
}

export interface PackLineResult extends PackLine {
  total: number;
  /** Share of the (filtered) total in percent. */
  share: number;
}

export type PackRating = "insane" | "great" | "good" | "average" | "poor";

export interface PackValueResult {
  lines: PackLineResult[];
  totalGems: number;
  baselineGems: number;
  /** total / baseline × 100 (0 when the price is 0). */
  valuePercent: number;
  rating: PackRating;
}

const clamp0 = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function ratePack(valuePercent: number): PackRating {
  if (valuePercent >= 4000) return "insane";
  if (valuePercent >= 3000) return "great";
  if (valuePercent >= 2000) return "good";
  if (valuePercent >= 1000) return "average";
  return "poor";
}

export function calculatePackValue(
  lines: PackLine[],
  price: number,
  gemsPerUnit: number = DEFAULT_GEMS_PER_UNIT,
  excludeBasicResources = false,
): PackValueResult {
  const counted = lines.filter((l) => !(excludeBasicResources && l.basicResource));
  const totals = counted.map((l) => clamp0(l.quantity) * clamp0(l.gems));
  const totalGems = totals.reduce((a, b) => a + b, 0);
  const baselineGems = clamp0(price) * clamp0(gemsPerUnit);
  const valuePercent = baselineGems > 0 ? (totalGems / baselineGems) * 100 : 0;

  const resultLines: PackLineResult[] = lines.map((line) => {
    const excluded = excludeBasicResources && line.basicResource;
    const total = excluded ? 0 : clamp0(line.quantity) * clamp0(line.gems);
    return {
      ...line,
      total,
      share: totalGems > 0 ? (total / totalGems) * 100 : 0,
    };
  });

  return { lines: resultLines, totalGems, baselineGems, valuePercent, rating: ratePack(valuePercent) };
}
