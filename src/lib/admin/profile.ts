import type { FormResult } from "./forms";

/**
 * A person's own profile in the admin area: in-game name and home alliance
 * (pure, unit-tested). Kingshot shows players as "[TAG] Name"; here the two
 * are stored apart so a change of alliance is one dropdown, not a retype.
 */

export interface ProfileInput {
  gameName: string;
  /** Matches `alliances.tag`, or null when the person plays outside the kingdom's listed alliances. */
  allianceTag: string | null;
}

export function parseGameName(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (name.length < 2) return { ok: false, error: "Enter your in-game name (at least 2 characters)." };
  if (name.length > 40) return { ok: false, error: "Keep the name under 40 characters." };
  if (/\p{Cc}/u.test(name)) return { ok: false, error: "The name contains invalid characters." };
  return { ok: true, value: name };
}

/** "[ULU] Rudy" → name "Rudy", tag "ULU" when ULU is one of the kingdom's alliances; anything else is left alone. */
export function splitAllianceTag(value: string, tags: readonly string[]): { name: string; tag: string | null } {
  const match = /^\[\s*([A-Za-z0-9]{2,6})\s*\]\s*(.*)$/.exec(value.trim());
  if (!match) return { name: value, tag: null };
  const tag = tags.find((t) => t.toUpperCase() === match[1].toUpperCase());
  return tag ? { name: match[2], tag } : { name: value, tag: null };
}

/**
 * The profile form: the dropdown sets the alliance; a tag typed in front of
 * the name ("[ULU] Rudy") wins over the dropdown and is stripped from the name.
 */
export function parseProfileForm(fd: FormData, tags: readonly string[]): FormResult<ProfileInput> {
  const raw = fd.get("gameName");
  const typed = splitAllianceTag(typeof raw === "string" ? raw : "", tags);
  const name = parseGameName(typed.name);
  if (!name.ok) return { ok: false, errors: { gameName: name.error } };
  const selected = fd.get("allianceTag");
  const fromSelect = typeof selected === "string" && tags.includes(selected) ? selected : null;
  return { ok: true, value: { gameName: name.value, allianceTag: typed.tag ?? fromSelect } };
}

/** "[ULU] Rudy", or just the name without an alliance; null without a name. */
export function formatGameName(gameName: string | null | undefined, allianceTag: string | null | undefined): string | null {
  if (!gameName) return null;
  return allianceTag ? `[${allianceTag}] ${gameName}` : gameName;
}

/** True when another account already goes by this in-game name (case and spacing ignored), so audit entries can't be made to look like a colleague's. */
export function gameNameTaken(gameName: string, ownId: string, profiles: ReadonlyArray<{ id: string; game_name: string | null }>): boolean {
  const key = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
  const wanted = key(gameName);
  return profiles.some((profile) => profile.id !== ownId && typeof profile.game_name === "string" && key(profile.game_name) === wanted);
}
