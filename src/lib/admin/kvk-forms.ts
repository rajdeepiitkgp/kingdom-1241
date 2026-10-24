import type { CoordinatorTeam, FormationRole, FormationSide, KvkEventType, KvkRuleKind } from "@/lib/data/types";
import {
  boolField,
  intField,
  oneOfField,
  optionalText,
  slugify,
  textField,
  utcDateTimeField,
  type FormResult,
} from "./forms";

/** Parsers for the battle-plan editor forms (pure, unit-tested). */

export const MAX_FORMATIONS = 12;
/** The game offers twelve troop-ratio presets; players name them A–L. */
export const FORMATION_LABELS: readonly string[] = [..."ABCDEFGHIJKL"];

export const EVENT_TYPES: readonly KvkEventType[] = ["castle_battle", "kvk"];
export const SIDES: readonly FormationSide[] = ["attack", "defense", "any"];
export const FORMATION_ROLES: readonly FormationRole[] = ["rally_lead", "rally_join", "any"];
export const RULE_KINDS: readonly KvkRuleKind[] = ["do", "dont", "info"];
export const TEAMS: readonly CoordinatorTeam[] = ["kvk", "tmp"];

export interface PlanInput {
  slug: string;
  eventType: KvkEventType;
  title: string;
  opponent: string | null;
  battleAt: string | null;
  /** Markdown written by the admin; rendered to sanitised HTML on save. */
  introSource: string;
  minHeroStars: number;
  minSkillLevel: number;
  password: string;
  active: boolean;
  published: boolean;
}

export function parsePlanForm(fd: FormData): FormResult<PlanInput> {
  const errors: Record<string, string> = {};
  const title = textField(fd, "title");
  if (!title) errors.title = "Give the plan a title.";
  else if (title.length > 120) errors.title = "Keep the title under 120 characters.";

  const slug = slugify(textField(fd, "slug") || title);
  if (!slug) errors.slug = "The slug needs at least one letter or digit.";

  const password = textField(fd, "password");
  if (password.length < 4) errors.password = "Use at least 4 characters (longer is safer; guesses are throttled either way).";
  else if (password.length > 64) errors.password = "Keep the password under 64 characters.";

  const battleAt = utcDateTimeField(fd, "battleAt");
  if (battleAt === undefined) errors.battleAt = "Enter the date and time as the form shows them (UTC).";

  const introSource = textField(fd, "introSource");
  if (introSource.length > 20_000) errors.introSource = "Keep the introduction under 20 000 characters.";

  const minHeroStars = intField(fd, "minHeroStars", 0, 5);
  if (minHeroStars === null) errors.minHeroStars = "Stars go from 0 to 5.";
  const minSkillLevel = intField(fd, "minSkillLevel", 0, 5);
  if (minSkillLevel === null) errors.minSkillLevel = "Skill levels go from 0 to 5.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      slug,
      eventType: oneOfField(fd, "eventType", EVENT_TYPES, "castle_battle"),
      title,
      opponent: optionalText(fd, "opponent"),
      battleAt: battleAt ?? null,
      introSource,
      minHeroStars: minHeroStars ?? 4,
      minSkillLevel: minSkillLevel ?? 5,
      password,
      active: boolField(fd, "active"),
      published: boolField(fd, "published"),
    },
  };
}

export interface RuleInput {
  kind: KvkRuleKind;
  text: string;
  published: boolean;
}

export function parseRuleForm(fd: FormData): FormResult<RuleInput> {
  const text = textField(fd, "text");
  if (!text) return { ok: false, errors: { text: "Write the instruction." } };
  if (text.length > 400) return { ok: false, errors: { text: "Keep an instruction under 400 characters." } };
  return {
    ok: true,
    value: {
      kind: oneOfField(fd, "kind", RULE_KINDS, "info"),
      text,
      published: boolField(fd, "published"),
    },
  };
}

export interface CoordinatorInput {
  team: CoordinatorTeam;
  name: string;
  allianceTag: string | null;
  note: string;
  published: boolean;
}

export function parseCoordinatorForm(fd: FormData, allianceTags: readonly string[]): FormResult<CoordinatorInput> {
  const errors: Record<string, string> = {};
  const name = textField(fd, "name");
  if (!name) errors.name = "Enter the in-game name.";
  else if (name.length > 60) errors.name = "Keep the name under 60 characters.";
  const tag = optionalText(fd, "allianceTag");
  if (tag && !allianceTags.includes(tag)) errors.allianceTag = "Pick one of the kingdom's alliances.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      team: oneOfField(fd, "team", TEAMS, "kvk"),
      name,
      allianceTag: tag,
      note: textField(fd, "note").slice(0, 200),
      published: boolField(fd, "published"),
    },
  };
}

export interface FormationInput {
  label: string;
  side: FormationSide;
  role: FormationRole;
  heroes: [string | null, string | null, string | null];
  infantry: number;
  cavalry: number;
  archers: number;
  note: string;
  published: boolean;
}

export function parseFormationForm(fd: FormData, heroSlugs: readonly string[]): FormResult<FormationInput> {
  const errors: Record<string, string> = {};
  const label = textField(fd, "label").toUpperCase();
  if (!FORMATION_LABELS.includes(label)) errors.label = "Pick a preset letter from A to L.";

  const heroes = [1, 2, 3].map((n) => optionalText(fd, `hero${n}`)) as [string | null, string | null, string | null];
  heroes.forEach((slug, i) => {
    if (slug && !heroSlugs.includes(slug)) errors[`hero${i + 1}`] = "Unknown hero.";
  });
  const chosen = heroes.filter((h): h is string => Boolean(h));
  if (new Set(chosen).size !== chosen.length) errors.heroes = "A hero can only be in one slot.";

  const infantry = intField(fd, "infantry", 0, 100);
  const cavalry = intField(fd, "cavalry", 0, 100);
  const archers = intField(fd, "archers", 0, 100);
  if (infantry === null || cavalry === null || archers === null) {
    errors.ratio = "Each troop share must be a whole number from 0 to 100.";
  } else if (infantry + cavalry + archers !== 100) {
    errors.ratio = `The three shares must add up to 100 (now ${infantry + cavalry + archers}).`;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      label,
      side: oneOfField(fd, "side", SIDES, "any"),
      role: oneOfField(fd, "role", FORMATION_ROLES, "any"),
      heroes,
      infantry: infantry ?? 0,
      cavalry: cavalry ?? 0,
      archers: archers ?? 0,
      note: textField(fd, "note").slice(0, 200),
      published: boolField(fd, "published"),
    },
  };
}

/** First preset letter not used by the plan yet, or null when all twelve are taken. */
export function nextFreeLabel(used: readonly string[]): string | null {
  const taken = new Set(used.map((l) => l.toUpperCase()));
  return FORMATION_LABELS.find((l) => !taken.has(l)) ?? null;
}

export const MOVE_DIRECTIONS = ["up", "down"] as const;
export type MoveDirection = (typeof MOVE_DIRECTIONS)[number];

export function isMoveDirection(value: string): value is MoveDirection {
  return (MOVE_DIRECTIONS as readonly string[]).includes(value);
}

/**
 * The order of `ids` after moving `id` one step up or down, or null when the
 * id is unknown or already at that end (nothing to write). Rows are never
 * numbered by hand: new rows go last and the arrows swap neighbours.
 */
export function moveInList(ids: readonly string[], id: string, direction: MoveDirection): string[] | null {
  const index = ids.indexOf(id);
  if (index === -1) return null;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ids.length) return null;
  const next = [...ids];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
