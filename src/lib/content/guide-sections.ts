// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
/**
 * The alliance sections of a guide (pure): each alliance that plays an event
 * its own way has a tab under the guide's shared text. The tabs follow Home's
 * alliance order (strongest first), and the player's pick is remembered on
 * the device for every guide, since a player belongs to one alliance.
 */

/** localStorage key of the alliance tag the player last picked in a guide. */
export const GUIDE_ALLIANCE_KEY = "kd1241_guide_alliance";

/** Sections in the order of Home's alliances; an alliance not on that list goes last, by tag. */
export function orderByAlliance<T extends { allianceTag: string }>(sections: readonly T[], alliances: ReadonlyArray<{ tag: string }>): T[] {
  const rank = new Map(alliances.map((alliance, index) => [alliance.tag, index]));
  const position = (tag: string) => rank.get(tag) ?? alliances.length;
  return [...sections].sort((a, b) => position(a.allianceTag) - position(b.allianceTag) || a.allianceTag.localeCompare(b.allianceTag));
}

/** The tab to open: the remembered alliance when this guide has its section (exact tag: [NAM] isn't [Nam]), else the first. */
export function openSection(tags: readonly string[], remembered: string | null): string | null {
  return remembered && tags.includes(remembered) ? remembered : (tags[0] ?? null);
}

/** "[TAG] Name", or "[TAG]" when the alliance isn't on Home's list. */
export function allianceLabel(tag: string, name: string | undefined): string {
  return name ? `[${tag}] ${name}` : `[${tag}]`;
}
