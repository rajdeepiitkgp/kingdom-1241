/**
 * The terms of a transfer window as the game sets them (the `site_settings`
 * row `transfer_terms`, numbers and times only, so nothing to translate):
 * which kingdoms may move here, when the window runs and the Transfer Power
 * caps. Every part is optional; the transfers page shows the ones set.
 */
export interface TransferTerms {
  /** The game's transfer group, such as kingdoms 1201 to 1260. */
  kingdomFrom: number | null;
  kingdomTo: number | null;
  /** The window in UTC (ISO). */
  windowStart: string | null;
  windowEnd: string | null;
  /** The most Transfer Power a governor may have to move here without a special invite, while 1241 is a regular or a leading kingdom. */
  powerRegular: number | null;
  powerLeading: number | null;
}

export const NO_TRANSFER_TERMS: TransferTerms = {
  kingdomFrom: null,
  kingdomTo: null,
  windowStart: null,
  windowEnd: null,
  powerRegular: null,
  powerLeading: null,
};

const positive = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null);
const instant = (value: unknown) => (typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null);

/** The stored value → terms; anything unreadable counts as not set (a missing row, "", an older shape). */
export function parseTransferTerms(value: unknown): TransferTerms {
  if (!value || typeof value !== "object" || Array.isArray(value)) return NO_TRANSFER_TERMS;
  const v = value as Record<string, unknown>;
  const from = positive(v.kingdomFrom);
  const to = positive(v.kingdomTo);
  const start = instant(v.windowStart);
  const end = instant(v.windowEnd);
  const pair = from !== null && to !== null && from <= to;
  const window = start !== null && end !== null && Date.parse(start) < Date.parse(end);
  return {
    kingdomFrom: pair ? from : null,
    kingdomTo: pair ? to : null,
    windowStart: window ? start : null,
    windowEnd: window ? end : null,
    powerRegular: positive(v.powerRegular),
    powerLeading: positive(v.powerLeading),
  };
}

export function hasTransferTerms(terms: TransferTerms): boolean {
  return Object.values(terms).some((value) => value !== null);
}

/**
 * Both ends of the window in UTC with the language's own date words
 * ("Sun 15 Nov, 00:00" in en-GB), so server and browser render the same.
 * Two strings, so a right-to-left page can isolate each and still read start → end.
 */
export function formatTransferWindow(startIso: string, endIso: string, locale: string): [string, string] {
  const at = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
  return [at.format(new Date(startIso)), at.format(new Date(endIso))];
}
