import type { HeroRarity, TroopType } from "@/lib/data/types";

/**
 * Hero catalogue used by the KvK formations. Names, troop types, rarities and
 * generations follow the Kingshot database (kingshotdata.com); the 128px
 * portraits in `public/heroes/` come from the same place. Admins can add new
 * heroes in the `heroes` table (set `icon_url` to any image URL) — the site
 * reads the table, this list is only the first fill.
 */
export interface SeedHero {
  id: string;
  slug: string;
  name: string;
  troopType: TroopType;
  rarity: HeroRarity;
  generation: number | null;
}

const hid = (n: number) => `f1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const LIST: Array<[slug: string, name: string, troopType: TroopType, rarity: HeroRarity, generation: number | null]> = [
  // Legendary, newest generation first
  ["diego", "Diego", "infantry", "legendary", 8],
  ["liz", "Liz", "cavalry", "legendary", 8],
  ["luna", "Luna", "archers", "legendary", 8],
  ["charles", "Charles", "infantry", "legendary", 7],
  ["ava", "Ava", "cavalry", "legendary", 7],
  ["wee-woo", "Wee & Woo", "archers", "legendary", 7],
  ["triton", "Triton", "infantry", "legendary", 6],
  ["sophia", "Sophia", "cavalry", "legendary", 6],
  ["yang", "Yang", "archers", "legendary", 6],
  ["long-fei", "Long Fei", "infantry", "legendary", 5],
  ["thrud", "Thrud", "cavalry", "legendary", 5],
  ["vivian", "Vivian", "archers", "legendary", 5],
  ["alcar", "Alcar", "infantry", "legendary", 4],
  ["margot", "Margot", "cavalry", "legendary", 4],
  ["rosa", "Rosa", "archers", "legendary", 4],
  ["eric", "Eric", "infantry", "legendary", 3],
  ["petra", "Petra", "cavalry", "legendary", 3],
  ["jaeger", "Jaeger", "archers", "legendary", 3],
  ["zoe", "Zoe", "infantry", "legendary", 2],
  ["hilde", "Hilde", "cavalry", "legendary", 2],
  ["marlin", "Marlin", "archers", "legendary", 2],
  ["helga", "Helga", "infantry", "legendary", 1],
  ["amadeus", "Amadeus", "infantry", "legendary", 1],
  ["jabel", "Jabel", "cavalry", "legendary", 1],
  ["saul", "Saul", "archers", "legendary", 1],
  // Epic
  ["howard", "Howard", "infantry", "epic", 1],
  ["gordon", "Gordon", "cavalry", "epic", 1],
  ["quinn", "Quinn", "archers", "epic", 1],
  ["chenko", "Chenko", "cavalry", "epic", 1],
  ["diana", "Diana", "archers", "epic", 1],
  ["amane", "Amane", "archers", "epic", 1],
  ["yeonwoo", "Yeonwoo", "archers", "epic", 1],
  ["fahd", "Fahd", "cavalry", "epic", 1],
  // Rare
  ["forrest", "Forrest", "infantry", "rare", 1],
  ["seth", "Seth", "infantry", "rare", 1],
  ["edwin", "Edwin", "cavalry", "rare", 1],
  ["olive", "Olive", "archers", "rare", 1],
];

export const SEED_HEROES: SeedHero[] = LIST.map(([slug, name, troopType, rarity, generation], index) => ({
  id: hid(index + 1),
  slug,
  name,
  troopType,
  rarity,
  generation,
}));

/** Where the bundled portrait of a hero lives (`public/heroes/<slug>.png`). */
export function bundledHeroIcon(slug: string): string {
  return `/heroes/${slug}.png`;
}
