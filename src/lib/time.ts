/** Small, dependency-free date helpers shared by server and client code. */

export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Next moment the daily reset happens (defaults to 00:00 UTC). */
export function nextDailyReset(now: Date, resetHourUtc = 0): Date {
  const next = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHourUtc, 0, 0, 0),
  );
  if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export interface Duration {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

export function splitDuration(ms: number): Duration {
  const totalMs = Math.max(0, ms);
  const totalSeconds = Math.floor(totalMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3_600),
    minutes: Math.floor((totalSeconds % 3_600) / 60),
    seconds: totalSeconds % 60,
    totalMs,
  };
}

export function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/** "13:05:09" in UTC. */
export function formatUtcClock(date: Date): string {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}`;
}

/** "Fri, 23 Oct" style UTC date using the visitor's locale for names. */
export function formatUtcDate(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

/** Visitor-local date and time, e.g. "Sat 25 Oct, 14:00". */
export function formatLocalDateTime(date: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatUtcTime(date: Date): string {
  return `${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())} UTC`;
}

/** The visitor's IANA time zone name, e.g. "Europe/Warsaw". */
export function localTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
}
