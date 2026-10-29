/**
 * The public alliance pages (pure): their address, which alliance an address
 * names, and the guides an alliance has its own section in.
 */

/** `/alliances/<tag>`; tags are case-sensitive ([NAM] isn't [Nam]) and may hold any character. */
export function alliancePath(tag: string): string {
  return `/alliances/${encodeURIComponent(tag)}`;
}

/** The tag in an address segment (decoded once; a segment that isn't valid encoding is taken as typed). */
export function tagFromSegment(segment: string): string {
  if (!segment.includes("%")) return segment;
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The shown guides with a shown section of this alliance, in the guides' own order. */
export function guidesOfAlliance<G extends { id: string; published: boolean }>(
  tag: string,
  guides: readonly G[],
  sections: ReadonlyArray<{ guideId: string; allianceTag: string; published: boolean }>,
): G[] {
  const ids = new Set(sections.filter((section) => section.published && section.allianceTag === tag).map((section) => section.guideId));
  return guides.filter((guide) => guide.published && ids.has(guide.id));
}
