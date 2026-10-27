import type { ChecklistPhase, ChecklistSection, KvkChecklistItem, KvkChecklistRule } from "@/lib/data/types";

/** Pure helpers for the commander checklist (no React, unit-tested). */

export const CHECKLIST_PHASES: readonly ChecklistPhase[] = ["before", "day", "during", "after"];
export const CHECKLIST_SECTIONS: readonly ChecklistSection[] = ["commander", "general"];

/** Items grouped by phase, in battle order (council's order within a phase); empty phases are left out. */
export function itemsByPhase<T extends Pick<KvkChecklistItem, "phase">>(items: T[]): Array<{ phase: ChecklistPhase; items: T[] }> {
  return CHECKLIST_PHASES.map((phase) => ({ phase, items: items.filter((i) => i.phase === phase) })).filter((group) => group.items.length > 0);
}

/** The commander's orders or the general guidelines, in the council's order. */
export function rulesInSection(rules: KvkChecklistRule[], section: ChecklistSection): KvkChecklistRule[] {
  return rules.filter((r) => r.section === section);
}

/**
 * Ticked item ids as stored on the device (a JSON array of strings). Anything
 * else, e.g. a value edited by hand, counts as nothing ticked.
 */
export function parseTicked(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/** How many of the current items are ticked; ticks of items the council removed don't count. */
export function checklistProgress(itemIds: readonly string[], ticked: ReadonlySet<string>): { done: number; total: number } {
  return { done: itemIds.filter((id) => ticked.has(id)).length, total: itemIds.length };
}

/** The ticks after toggling one item, keeping only ids of current items so old ones don't pile up on the device. */
export function toggleTicked(ticked: ReadonlySet<string>, id: string, itemIds: readonly string[]): string[] {
  const next = new Set(ticked);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return itemIds.filter((itemId) => next.has(itemId));
}
