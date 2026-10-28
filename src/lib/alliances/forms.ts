import { BATTLE_ALLIANCE_TAGS } from "./sync-plan";

/**
 * The owner's alliance form (pure, unit-tested): add an alliance by hand or
 * correct one while MightPulse is down. Power is typed as the game shows it
 * ("26,062,114,452") or short ("26.06B").
 */

export interface AllianceFields {
  tag: string;
  name: string;
  color: string;
  power: number | null;
  leader: string | null;
  members: number | null;
}

/** Banner-like colours for new alliances: the first one no alliance on the list uses. */
export const ALLIANCE_COLORS = ["#e2559b", "#3b7fe4", "#7b5df2", "#3fae6a", "#38a3e0", "#e4893b", "#d64545", "#c9a227", "#2bb3a3", "#8a8f98"];

export function nextAllianceColor(used: readonly string[]): string {
  const taken = new Set(used.map((color) => color.toLowerCase()));
  return ALLIANCE_COLORS.find((color) => !taken.has(color)) ?? ALLIANCE_COLORS[used.length % ALLIANCE_COLORS.length];
}

const SCALE = { k: 1e3, m: 1e6, b: 1e9 } as const;
export const POWER_HINT = "As the game shows it (26,062,114,452) or short (26.06B, 950M).";

export function parsePower(input: string): { ok: true; value: number | null } | { ok: false } {
  let raw = input.trim().toLowerCase().replace(/[\s,_'’]/g, "");
  if (!raw) return { ok: true, value: null };
  // 26.062.114.452: dots as thousands separators.
  if (/^\d{1,3}(\.\d{3}){2,}$/.test(raw)) raw = raw.replace(/\./g, "");
  const match = /^(\d+(?:\.\d+)?)([kmb])?$/.exec(raw);
  if (!match) return { ok: false };
  const value = Math.round(Number(match[1]) * (match[2] ? SCALE[match[2] as keyof typeof SCALE] : 1));
  return Number.isSafeInteger(value) && value <= 1e15 ? { ok: true, value } : { ok: false };
}

export const MAX_MEMBERS = 150;

export function parseAllianceForm(form: { get(name: string): unknown }): { ok: true; value: AllianceFields } | { ok: false; errors: Record<string, string> } {
  const field = (name: string) => {
    const value = form.get(name);
    return typeof value === "string" ? value.trim() : "";
  };
  const errors: Record<string, string> = {};
  const tag = field("tag").replace(/^\[(.*)\]$/, "$1").trim();
  if (!/^[^\s[\]]{1,8}$/u.test(tag)) errors.tag = "1 to 8 letters or digits, without brackets.";
  else if (BATTLE_ALLIANCE_TAGS.includes(tag)) errors.tag = "[KvK] and [TMP] are the battle alliances; they aren't listed on Home.";
  const name = field("name");
  if (!name || name.length > 60) errors.name = "1 to 60 characters.";
  const color = field("color").toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(color)) errors.color = "Pick a colour.";
  const power = parsePower(field("power"));
  if (!power.ok) errors.power = POWER_HINT;
  const leader = field("leader");
  if (leader.length > 40) errors.leader = "At most 40 characters.";
  const membersText = field("members");
  const members = membersText ? Number(membersText) : null;
  if (members !== null && !(Number.isInteger(members) && members >= 0 && members <= MAX_MEMBERS)) errors.members = `0 to ${MAX_MEMBERS}.`;
  if (Object.keys(errors).length > 0 || !power.ok) return { ok: false, errors };
  return { ok: true, value: { tag, name, color, power: power.value, leader: leader || null, members } };
}

/** Power, leader or members differ: the save marks the numbers as typed by hand. */
export function statsChanged(before: Pick<AllianceFields, "power" | "leader" | "members">, after: Pick<AllianceFields, "power" | "leader" | "members">): boolean {
  return before.power !== after.power || before.leader !== after.leader || before.members !== after.members;
}
