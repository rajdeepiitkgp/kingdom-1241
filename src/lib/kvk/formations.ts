import type { FormationRole, FormationSide, KvkFormation, TroopType } from "@/lib/data/types";

/** Pure helpers for the formation board (no React, unit-tested). */

export const TROOP_ORDER: TroopType[] = ["infantry", "cavalry", "archers"];

/**
 * The word for a role depends on the side: attackers rally (rally lead / rally
 * join), defenders garrison (garrison lead / garrison join). The database keeps
 * `rally_lead` / `rally_join` for both; only the label changes.
 */
export type RoleLabelKey = "rally_lead" | "rally_join" | "garrison_lead" | "garrison_join" | "lead" | "join";

/** Dictionary key suffix (`kvk.role.<key>`) for a formation's role, or null when it has no role. */
export function roleLabelKey(side: FormationSide, role: FormationRole): RoleLabelKey | null {
  if (role === "any") return null;
  const part = role === "rally_lead" ? "lead" : "join";
  if (side === "attack") return `rally_${part}`;
  if (side === "defense") return `garrison_${part}`;
  return part;
}

/** Chips above the board. `all` is always first; the others only appear when used. */
export type FormationFilter = "all" | Exclude<FormationSide, "any"> | Exclude<RoleLabelKey, "lead" | "join">;

const FILTER_ORDER: FormationFilter[] = ["all", "attack", "defense", "rally_lead", "rally_join", "garrison_lead", "garrison_join"];

export function isValidRatio(f: Pick<KvkFormation, "infantry" | "cavalry" | "archers">): boolean {
  const parts = [f.infantry, f.cavalry, f.archers];
  return parts.every((p) => Number.isInteger(p) && p >= 0 && p <= 100) && f.infantry + f.cavalry + f.archers === 100;
}

function matchesFilter(f: KvkFormation, filter: FormationFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attack":
    case "defense":
      return f.side === filter;
    case "rally_lead":
    case "rally_join":
      return f.role === filter && f.side !== "defense";
    case "garrison_lead":
      return f.role === "rally_lead" && f.side !== "attack";
    case "garrison_join":
      return f.role === "rally_join" && f.side !== "attack";
  }
}

export function filterFormations(list: KvkFormation[], filter: FormationFilter): KvkFormation[] {
  return list.filter((f) => matchesFilter(f, filter));
}

/** Filters worth showing: `all` plus every side/role at least one formation is tagged with. */
export function availableFilters(list: KvkFormation[]): FormationFilter[] {
  const used = FILTER_ORDER.filter((filter) => filter !== "all" && list.some((f) => matchesFilter(f, filter)));
  return used.length > 0 ? ["all", ...used] : ["all"];
}

/** Sort by explicit order, then by label (A, B, C…). */
export function sortFormations(list: KvkFormation[]): KvkFormation[] {
  return [...list].sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "en"));
}

/** "50 / 15 / 35" in infantry / cavalry / archers order. */
export function ratioLabel(f: Pick<KvkFormation, "infantry" | "cavalry" | "archers">): string {
  return `${f.infantry} / ${f.cavalry} / ${f.archers}`;
}

/** Number of free hero slots ("+ 2 other heroes"). */
export function openSlots(f: Pick<KvkFormation, "heroSlugs">): number {
  return f.heroSlugs.filter((slug) => !slug).length;
}

/**
 * One-line text for sharing in chat, e.g.
 * "A) Amane + 2 other heroes — Infantry 50% / Cavalry 15% / Archers 35%".
 */
export function formationSummary(
  f: KvkFormation,
  heroNames: string[],
  labels: { troops: Record<TroopType, string>; otherHeroes: (n: number) => string },
): string {
  const parts = [...heroNames];
  const open = openSlots(f);
  if (open > 0) parts.push(labels.otherHeroes(open));
  const ratio = TROOP_ORDER.map((type) => `${labels.troops[type]} ${f[type]}%`).join(" / ");
  return `${f.label}) ${parts.join(" + ")} — ${ratio}`;
}
