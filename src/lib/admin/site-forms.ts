import type { EventCategory, EventTiming } from "@/lib/data/types";
import { EVENT_CATEGORIES, EVENT_COLOR_KEYS, EVENT_TIMINGS, type EventColorKey } from "@/lib/events/options";
import { imageUrls } from "@/lib/content/images";
import { DAY, MINUTE } from "@/lib/time";
import type { TransferTerms } from "@/lib/transfers/terms";
import { iconField } from "./content-forms";
import { boolField, type FieldErrors, type FormResult, intField, oneOfField, textField, utcDateTimeField } from "./forms";

/**
 * The forms of the events editor, the alliance pages and the transfer
 * section (pure, unit-tested): `FormData` in, typed values or field errors out.
 */

export const EVENT_NAME_MAX = 80;
export const EVENT_SUMMARY_MAX = 300;
/** The longest occurrence: a long event (Strongest Governor) runs a week or more. */
const DURATION_MAX_MINUTES = 60 * 24 * 60;

export const DURATION_UNITS = ["minutes", "hours", "days"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
const UNIT_MINUTES: Record<DurationUnit, number> = { minutes: 1, hours: 60, days: 24 * 60 };

export interface EventInput {
  name: string;
  summary: string;
  icon: string;
  color: EventColorKey;
  category: EventCategory;
  guideSlug: string | null;
  timing: EventTiming;
  startsAt: string;
  durationMinutes: number;
  repeatEveryDays: number | null;
  alsoAfterDays: number | null;
  published: boolean;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** An event in English with its schedule. `guideSlugs` are the guides it may link to. */
export function parseEventForm(fd: FormData, options: { guideSlugs: readonly string[] }): FormResult<EventInput> {
  const errors: FieldErrors = {};
  const name = textField(fd, "name");
  if (!name) errors.name = "Give the event a name.";
  else if (name.length > EVENT_NAME_MAX) errors.name = `Keep the name under ${EVENT_NAME_MAX} characters.`;
  const summary = textField(fd, "summary").replace(/\s+/g, " ");
  if (summary.length > EVENT_SUMMARY_MAX) errors.summary = `Keep the summary under ${EVENT_SUMMARY_MAX} characters.`;
  const icon = iconField(fd, "📅", errors);

  const guide = textField(fd, "guideSlug");
  if (guide && !options.guideSlugs.includes(guide)) errors.guideSlug = "That guide no longer exists. Pick another one or none.";

  const timing = oneOfField(fd, "timing", EVENT_TIMINGS, "fixed");
  const date = textField(fd, "startDate");
  // An alliance-timed event is a game day: its own clock time means nothing, so it is stored as midnight UTC.
  const time = timing === "alliance" ? "00:00" : textField(fd, "startTime");
  let startsAt = "";
  if (!DATE.test(date) || Number.isNaN(Date.parse(`${date}T00:00Z`))) errors.startDate = "Pick the day of the first (or next) round.";
  else if (!TIME.test(time) || Number.isNaN(Date.parse(`${date}T${time}Z`))) errors.startTime = "Type the start time in UTC, such as 12:00.";
  else startsAt = new Date(Date.parse(`${date}T${time}Z`)).toISOString();

  const unit = oneOfField(fd, "durationUnit", DURATION_UNITS, "minutes");
  const amount = intField(fd, "durationValue", 1, DURATION_MAX_MINUTES);
  const durationMinutes = amount === null ? null : amount * UNIT_MINUTES[unit];
  if (durationMinutes === null || durationMinutes > DURATION_MAX_MINUTES) errors.durationValue = "How long one round lasts: a whole number, at most 60 days.";

  const repeatRaw = textField(fd, "repeatEveryDays");
  const repeatEveryDays = repeatRaw ? intField(fd, "repeatEveryDays", 1, 365) : null;
  if (repeatRaw && repeatEveryDays === null) errors.repeatEveryDays = "Every 1 to 365 days, or empty for a one-time event.";
  const alsoRaw = textField(fd, "alsoAfterDays");
  const alsoAfterDays = alsoRaw ? intField(fd, "alsoAfterDays", 1, 364) : null;
  if (alsoRaw && alsoAfterDays === null) errors.alsoAfterDays = "A whole number of days, or empty for one day per round.";
  else if (alsoAfterDays !== null && repeatEveryDays !== null && alsoAfterDays >= repeatEveryDays) {
    errors.alsoAfterDays = `The second day must come before the next round (less than ${repeatEveryDays} days).`;
  }
  // Two days of one round must not overlap, or the second would start while the first still runs.
  if (alsoAfterDays !== null && durationMinutes !== null && timing === "fixed" && durationMinutes * MINUTE > alsoAfterDays * DAY && !errors.alsoAfterDays) {
    errors.alsoAfterDays = "The second day starts before the first one ends: shorten the duration or move the second day.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      name,
      summary,
      icon,
      color: oneOfField(fd, "color", EVENT_COLOR_KEYS, "sky"),
      category: oneOfField(fd, "category", EVENT_CATEGORIES, "alliance"),
      guideSlug: guide || null,
      timing,
      startsAt,
      durationMinutes: durationMinutes!,
      repeatEveryDays,
      alsoAfterDays,
      published: boolField(fd, "published"),
    },
  };
}

/** What the event form shows for a stored event: the UTC day and time, and the duration in its largest whole unit. */
export function eventFormValues(event: { startsAt: string; durationMinutes: number } | null): {
  startDate: string;
  startTime: string;
  durationValue: number;
  durationUnit: DurationUnit;
} {
  const ms = event ? Date.parse(event.startsAt) : Number.NaN;
  const iso = Number.isNaN(ms) ? "" : new Date(ms).toISOString();
  const minutes = event?.durationMinutes ?? 60;
  const durationUnit: DurationUnit = minutes % UNIT_MINUTES.days === 0 ? "days" : minutes % UNIT_MINUTES.hours === 0 ? "hours" : "minutes";
  return { startDate: iso.slice(0, 10), startTime: iso.slice(11, 16) || "12:00", durationValue: minutes / UNIT_MINUTES[durationUnit], durationUnit };
}

/** The schedule in one line for the admin list ("Every 2 days from Sat, 24 Oct 2026 · each alliance picks its times"). */
export function scheduleSummary(event: {
  startsAt: string;
  durationMinutes: number;
  repeatEveryDays: number | null;
  alsoAfterDays: number | null;
  timing: EventTiming;
}): string {
  const ms = Date.parse(event.startsAt);
  if (Number.isNaN(ms)) return "No valid start";
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(ms);
  const time = new Date(ms).toISOString().slice(11, 16);
  const second = event.alsoAfterDays ? ` and ${event.alsoAfterDays} day${event.alsoAfterDays === 1 ? "" : "s"} later` : "";
  const repeat = event.repeatEveryDays
    ? `Every ${event.repeatEveryDays === 1 ? "day" : `${event.repeatEveryDays} days`} from ${day}${second}`
    : `Once, on ${day}${second}`;
  if (event.timing === "alliance") return `${repeat} · each alliance picks its times`;
  const { durationValue, durationUnit } = eventFormValues(event);
  return `${repeat} · ${time} UTC for ${durationValue} ${durationValue === 1 ? durationUnit.slice(0, -1) : durationUnit}`;
}

// ---------------------------------------------------------------------------
// Alliance pages
// ---------------------------------------------------------------------------

export const ALLIANCE_DESCRIPTION_MAX = 1000;
export const ALLIANCE_REQUIREMENTS_MAX = 300;
const ALLIANCE_LANGUAGES_MAX = 40;

export interface AllianceProfileInput {
  description: string;
  requirements: string;
  languages: string | null;
  discordUrl: string | null;
}

/** Plain text with its line breaks kept (trimmed, at most two empty lines in a row). */
function plainText(fd: FormData, name: string): string {
  return textField(fd, name)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
}

/** A Discord invite: discord.gg/… or discord.com/invite/…, always https. */
export function discordInvite(raw: string): string | null | undefined {
  const value = raw.trim();
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return undefined;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  const invite = host === "discord.gg" ? /^\/[\w-]+$/.test(path) : (host === "discord.com" || host === "discordapp.com") && /^\/invite\/[\w-]+$/.test(path);
  return invite ? `https://${host}${path}` : undefined;
}

/** What the R5s say about their alliance (the numbers come from MightPulse). */
export function parseAllianceProfileForm(fd: FormData): FormResult<AllianceProfileInput> {
  const errors: FieldErrors = {};
  const description = plainText(fd, "description");
  if (description.length > ALLIANCE_DESCRIPTION_MAX) errors.description = `Keep the description under ${ALLIANCE_DESCRIPTION_MAX} characters.`;
  const requirements = plainText(fd, "requirements");
  if (requirements.length > ALLIANCE_REQUIREMENTS_MAX) errors.requirements = `Keep the requirements under ${ALLIANCE_REQUIREMENTS_MAX} characters.`;
  const languages = textField(fd, "languages").replace(/\s+/g, " ");
  if (languages.length > ALLIANCE_LANGUAGES_MAX) errors.languages = `Keep it short, such as “EN / DE” (under ${ALLIANCE_LANGUAGES_MAX} characters).`;
  const discordUrl = discordInvite(textField(fd, "discordUrl"));
  if (discordUrl === undefined) errors.discordUrl = "Paste a Discord invite link, such as https://discord.gg/abc123.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { description, requirements, languages: languages || null, discordUrl: discordUrl ?? null } };
}

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export const TRANSFER_INFO_MAX = 1500;
export const TRANSFER_CONTACT_MAX = 500;

export interface TransfersInput {
  /** The kingdom's own Discord (Home and the footer); null = none shown. */
  discordUrl: string | null;
  open: boolean;
  terms: TransferTerms;
  /** Markdown, like `contact`; the action stores both as HTML. */
  info: string;
  contact: string;
  /** A separate invite on the transfers page; null = the kingdom's Discord. */
  transferDiscordUrl: string | null;
}

/** The highest kingdom number the form takes. */
const KINGDOM_MAX = 99_999;
/** Power caps are typed in millions, such as 97.5; at most 100,000 (100 billion). */
const POWER_MAX_MILLIONS = 100_000;

/** Millions with at most two decimals ("97.5" or "97,5") → power; null when empty, undefined when not such a number. */
export function millionsField(fd: FormData, name: string): number | null | undefined {
  const raw = textField(fd, name).replace(",", ".");
  if (!raw) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return undefined;
  const millions = Number(raw);
  return millions > 0 && millions <= POWER_MAX_MILLIONS ? Math.round(millions * 1_000_000) : undefined;
}

/** The game's numbers for the window: each pair both or neither, every part optional. */
function parseTerms(fd: FormData, errors: FieldErrors): TransferTerms {
  const fromRaw = textField(fd, "kingdomFrom");
  const toRaw = textField(fd, "kingdomTo");
  const kingdomFrom = fromRaw ? intField(fd, "kingdomFrom", 1, KINGDOM_MAX) : null;
  const kingdomTo = toRaw ? intField(fd, "kingdomTo", 1, KINGDOM_MAX) : null;
  if (fromRaw && kingdomFrom === null) errors.kingdomFrom = "A kingdom number, such as 1201.";
  if (toRaw && kingdomTo === null) errors.kingdomTo = "A kingdom number, such as 1260.";
  if (!errors.kingdomFrom && !errors.kingdomTo) {
    if ((kingdomFrom === null) !== (kingdomTo === null)) errors[kingdomFrom === null ? "kingdomFrom" : "kingdomTo"] = "Fill in both kingdoms, or neither.";
    else if (kingdomFrom !== null && kingdomTo !== null && kingdomFrom > kingdomTo) errors.kingdomTo = "The last kingdom can't come before the first.";
  }

  const windowStart = utcDateTimeField(fd, "windowStart");
  const windowEnd = utcDateTimeField(fd, "windowEnd");
  if (windowStart === undefined) errors.windowStart = "Pick when the window opens (UTC).";
  if (windowEnd === undefined) errors.windowEnd = "Pick when the window closes (UTC).";
  if (windowStart !== undefined && windowEnd !== undefined) {
    if ((windowStart === null) !== (windowEnd === null)) errors[windowStart === null ? "windowStart" : "windowEnd"] = "Fill in both times, or neither.";
    else if (windowStart && windowEnd && Date.parse(windowEnd) <= Date.parse(windowStart)) errors.windowEnd = "The window must close after it opens.";
  }

  const powerRegular = millionsField(fd, "powerRegular");
  const powerLeading = millionsField(fd, "powerLeading");
  const powerError = `In millions, such as 150 or 97.5 (at most ${POWER_MAX_MILLIONS.toLocaleString("en")}).`;
  if (powerRegular === undefined) errors.powerRegular = powerError;
  if (powerLeading === undefined) errors.powerLeading = powerError;

  return {
    kingdomFrom: kingdomFrom ?? null,
    kingdomTo: kingdomTo ?? null,
    windowStart: windowStart ?? null,
    windowEnd: windowEnd ?? null,
    powerRegular: powerRegular ?? null,
    powerLeading: powerLeading ?? null,
  };
}

/** One of the two texts (Markdown, optional): whitespace inside matters (line breaks), only the ends are trimmed. */
function transferText(fd: FormData, name: string, max: number, errors: FieldErrors): string {
  const text = textField(fd, name).replace(/\r\n?/g, "\n");
  if (text.length > max) errors[name] = `Keep it under ${max} characters.`;
  // Nothing keeps an image of these texts from the prune (it looks in the content tables), so none go in.
  else if (imageUrls(text).length > 0) errors[name] = "Images can't go in this text; link to a guide or an announcement instead.";
  return text;
}

/**
 * The kingdom's Discord, and the transfer section: open or closed, the game's
 * terms for the window, anything else players should know while it is open,
 * whom to ask (always shown; both texts Markdown, stored as HTML) and its own
 * Discord invite. Everything is optional.
 */
export function parseTransfersForm(fd: FormData): FormResult<TransfersInput> {
  const errors: FieldErrors = {};
  const discordUrl = discordInvite(textField(fd, "discordUrl"));
  if (discordUrl === undefined) errors.discordUrl = "Paste a Discord invite link, such as https://discord.gg/abc123, or leave it empty.";
  const transferDiscordUrl = discordInvite(textField(fd, "transferDiscordUrl"));
  if (transferDiscordUrl === undefined) errors.transferDiscordUrl = "Paste a Discord invite link, such as https://discord.gg/abc123, or leave it empty.";
  const open = boolField(fd, "open");
  const terms = parseTerms(fd, errors);
  const info = transferText(fd, "info", TRANSFER_INFO_MAX, errors);
  const contact = transferText(fd, "contact", TRANSFER_CONTACT_MAX, errors);
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { discordUrl: discordUrl ?? null, open, terms, info, contact, transferDiscordUrl: transferDiscordUrl ?? null } };
}
