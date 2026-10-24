import { DAY, formatUtcTime } from "@/lib/time";

/**
 * Live battle-time tokens for the plan intro. Admins write "{{when}}" instead
 * of "tomorrow" and the text never goes stale: each visitor sees the battle
 * time in their own language, calendar and time zone, computed from the
 * plan's `battle_at`.
 *
 *   {{when}}  today / tomorrow / in 3 days / yesterday   (Intl.RelativeTimeFormat)
 *   {{date}}  Sunday, November 8                         (visitor's zone)
 *   {{time}}  15:00                                      (visitor's zone)
 *   {{utc}}   14:00 UTC
 *
 * Before hydration (`now` is null) everything is rendered in UTC, exactly as
 * the server knows it, so the HTML never mismatches; the visitor's values take
 * over once the page is interactive (same rule as every other clock here).
 * Pure and unit-tested; `LiveIntro` is the component.
 */

export type BattleToken = "when" | "date" | "time" | "utc";

const TOKEN = /\{\{\s*(when|date|time|utc)\s*\}\}/gi;

export function hasBattleTokens(text: string): boolean {
  return new RegExp(TOKEN.source, "i").test(text);
}

export interface BattleTokenOptions {
  locale: string;
  /** The visitor's clock, or null before hydration. */
  now: Date | null;
  /** IANA zone; the browser default when omitted (tests pass one). */
  timeZone?: string;
}

/** Replaces the tokens in (sanitised) HTML; tokens vanish when the plan has no battle time. */
export function renderBattleTokens(html: string, battleAt: string | null, options: BattleTokenOptions): string {
  const battle = battleAt ? new Date(battleAt) : null;
  if (!battle || Number.isNaN(battle.getTime())) return html.replace(TOKEN, "");
  return html.replace(TOKEN, (_match, name: string) => escapeHtml(tokenValue(name.toLowerCase() as BattleToken, battle, options)));
}

function tokenValue(token: BattleToken, battle: Date, { locale, now, timeZone }: BattleTokenOptions): string {
  const zone = now ? timeZone : "UTC";
  switch (token) {
    case "utc":
      return formatUtcTime(battle);
    case "time":
      return now ? formatIn(locale, { hour: "2-digit", minute: "2-digit", timeZone: zone }, battle) : formatUtcTime(battle);
    case "date":
      return formatIn(locale, { weekday: "long", day: "numeric", month: "long", timeZone: zone }, battle);
    case "when":
      return now ? relativeDay(battle, now, locale, timeZone) : formatIn(locale, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }, battle);
  }
}

/** "today", "tomorrow", "in 3 days", "yesterday" in the visitor's language, by calendar day in `timeZone`. */
export function relativeDay(target: Date, now: Date, locale: string, timeZone?: string): string {
  const days = Math.round((dayStamp(target, timeZone) - dayStamp(now, timeZone)) / DAY);
  try {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(days, "day");
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day");
  }
}

/** Midnight of the calendar day of `date` in `timeZone`, as a UTC timestamp (for day differences). */
function dayStamp(date: Date, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"));
}

function formatIn(locale: string, options: Intl.DateTimeFormatOptions, date: Date): string {
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return new Intl.DateTimeFormat("en", options).format(date);
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
