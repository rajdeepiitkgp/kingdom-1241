// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { checkAccess } from "@/lib/auth/server";
import { createLogger } from "@/lib/log";
import type { Signup } from "@/lib/ministry/ministry";
import { rosterFor } from "@/lib/ministry/roster";
import { type MinistryRound, ministryRounds } from "@/lib/ministry/state";
import { ministryStore, NO_ROSTER, type RoundRoster } from "@/lib/ministry/store";

/**
 * What the admin ministry page shows (moderators and up, uncached): the
 * offered rounds with their settings, and the chosen round's sign-ups.
 * Returns nothing without access, like every admin loader.
 */

const log = createLogger("admin");

export interface AdminSignup extends Signup {
  /** A browser holds this entry's key: the player can change it there until the deadline. */
  ownedByBrowser: boolean;
}

export interface MinistryAdminData {
  /** False without a database or before migration 0026. */
  available: boolean;
  rounds: MinistryRound[];
  /** The round whose sign-ups are listed. */
  selected: MinistryRound;
  signups: AdminSignup[];
  /** The round's appointments and which days are assigned (the deadline's run happens on this read when it is due). */
  roster: RoundRoster;
}

export async function getMinistryAdmin(roundKey: string | undefined, now: Date): Promise<MinistryAdminData | null> {
  const access = await checkAccess("moderator");
  if ("denied" in access) return null;
  const store = ministryStore();
  const { rounds, available } = await ministryRounds(now, store);
  const selected = rounds.find((round) => round.key === roundKey) ?? rounds.find((round) => round.settings.open) ?? rounds[0];
  if (!store || !available) return { available: false, rounds, selected, signups: [], roster: NO_ROSTER };
  try {
    const roster = await rosterFor(store, selected, now);
    const rows = await store.list(selected.key);
    return { available: true, rounds, selected, roster, signups: rows.map(({ deviceHash, ...signup }) => ({ ...signup, ownedByBrowser: deviceHash !== null })) };
  } catch (error) {
    log.warn("Could not read the ministry sign-ups", { round: selected.key, error: error instanceof Error ? error.message : String((error as { message?: string })?.message ?? error) });
    return { available: false, rounds, selected, signups: [], roster: NO_ROSTER };
  }
}
