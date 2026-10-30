import { SEED_ALLIANCES } from "@/content/seed/alliances";
import { SEED_GUIDES } from "@/content/seed/guides";

/** Examples for the routes with a parameter, from the seed the test server shows. */
export const SEED_GUIDE = SEED_GUIDES[0].slug;
export const SEED_ALLIANCE = SEED_ALLIANCES[0].tag;

/**
 * The public pages, one entry per route under `src/app/[locale]` (the admin
 * area aside); `tests/architecture/qa-coverage.test.ts` fails when a page is
 * missing here, so a new page is checked from its first pull request.
 */
export const PUBLIC_PAGES: ReadonlyArray<{ route: string; path: string }> = [
  { route: "/", path: "/" },
  { route: "/events", path: "/events" },
  { route: "/rules", path: "/rules" },
  { route: "/guides", path: "/guides" },
  { route: "/guides/[slug]", path: `/guides/${SEED_GUIDE}` },
  { route: "/alliances/[tag]", path: `/alliances/${encodeURIComponent(SEED_ALLIANCE)}` },
  { route: "/transfers", path: "/transfers" },
  { route: "/tools", path: "/tools" },
  { route: "/tools/rally-sync", path: "/tools/rally-sync" },
  { route: "/tools/rally-sync/[code]", path: "/tools/rally-sync/TEST23" },
  { route: "/kvk", path: "/kvk" },
  { route: "/kvk/leaders", path: "/kvk/leaders" },
  { route: "/kvk/checklist", path: "/kvk/checklist" },
  { route: "/kvk/prep", path: "/kvk/prep" },
  { route: "/kvk/feedback", path: "/kvk/feedback" },
];
