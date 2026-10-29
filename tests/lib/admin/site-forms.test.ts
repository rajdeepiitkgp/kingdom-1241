import { describe, expect, it } from "vitest";
import {
  discordInvite,
  eventFormValues,
  parseAllianceProfileForm,
  parseEventForm,
  millionsField,
  parseTransfersForm,
  scheduleSummary,
} from "@/lib/admin/site-forms";
import { NO_TRANSFER_TERMS } from "@/lib/transfers/terms";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [key, value] of Object.entries(entries)) fd.set(key, value);
  return fd;
};

const EVENT = {
  name: "Alliance Championship",
  summary: "Three lanes,\n  five rounds.",
  icon: "🏆",
  color: "violet",
  category: "alliance",
  guideSlug: "alliance-championship",
  timing: "fixed",
  startDate: "2026-10-26",
  startTime: "00:00",
  durationValue: "6",
  durationUnit: "days",
  repeatEveryDays: "7",
  published: "on",
};
const guides = { guideSlugs: ["alliance-championship", "bear-hunt"] };

describe("parseEventForm", () => {
  it("reads a same-time event with its schedule in UTC", () => {
    const parsed = parseEventForm(form(EVENT), guides);
    expect(parsed.ok && parsed.value).toMatchObject({
      name: "Alliance Championship",
      startsAt: "2026-10-26T00:00:00.000Z",
      durationMinutes: 6 * 24 * 60,
      repeatEveryDays: 7,
      alsoAfterDays: null,
      timing: "fixed",
      guideSlug: "alliance-championship",
      published: true,
    });
  });

  it("stores an alliance-timed event at midnight UTC, whatever time was typed", () => {
    const parsed = parseEventForm(form({ ...EVENT, timing: "alliance", startTime: "19:30", repeatEveryDays: "14", alsoAfterDays: "2", durationValue: "1", durationUnit: "hours" }), guides);
    expect(parsed.ok && parsed.value).toMatchObject({ startsAt: "2026-10-26T00:00:00.000Z", timing: "alliance", alsoAfterDays: 2 });
  });

  it("refuses a second day at or after the next round, and one that overlaps the first", () => {
    const late = parseEventForm(form({ ...EVENT, alsoAfterDays: "7" }), guides);
    expect(!late.ok && late.errors.alsoAfterDays).toMatch(/less than 7 days/);
    const overlap = parseEventForm(form({ ...EVENT, alsoAfterDays: "2" }), guides);
    expect(!overlap.ok && overlap.errors.alsoAfterDays).toMatch(/before the first one ends/);
  });

  it("explains missing and unknown values field by field", () => {
    const parsed = parseEventForm(form({ ...EVENT, name: "", startDate: "26/10/2026", durationValue: "0", repeatEveryDays: "x", guideSlug: "gone" }), guides);
    expect(!parsed.ok && Object.keys(parsed.errors).sort()).toEqual(["durationValue", "guideSlug", "name", "repeatEveryDays", "startDate"]);
  });

  it("keeps a one-time event one-time and falls back to safe choices", () => {
    const parsed = parseEventForm(form({ ...EVENT, repeatEveryDays: "", color: "neon", category: "pvp", published: "" }), guides);
    expect(parsed.ok && parsed.value).toMatchObject({ repeatEveryDays: null, color: "sky", category: "alliance", published: false });
  });
});

describe("eventFormValues and scheduleSummary", () => {
  it("shows a stored event in its largest whole unit", () => {
    expect(eventFormValues({ startsAt: "2026-10-26T13:05:00.000Z", durationMinutes: 6 * 24 * 60 })).toEqual({
      startDate: "2026-10-26",
      startTime: "13:05",
      durationValue: 6,
      durationUnit: "days",
    });
    expect(eventFormValues({ startsAt: "2026-10-26T13:05:00.000Z", durationMinutes: 90 }).durationUnit).toBe("minutes");
    expect(eventFormValues(null)).toMatchObject({ startDate: "", startTime: "12:00", durationValue: 1, durationUnit: "hours" });
  });

  it("says the schedule in one line", () => {
    expect(scheduleSummary({ startsAt: "2026-10-26T00:00:00.000Z", durationMinutes: 8640, repeatEveryDays: 7, alsoAfterDays: null, timing: "fixed" })).toBe(
      "Every 7 days from Mon, 26 Oct 2026 · 00:00 UTC for 6 days",
    );
    expect(scheduleSummary({ startsAt: "2026-11-03T00:00:00.000Z", durationMinutes: 60, repeatEveryDays: 14, alsoAfterDays: 2, timing: "alliance" })).toBe(
      "Every 14 days from Tue, 3 Nov 2026 and 2 days later · each alliance picks its times",
    );
    expect(scheduleSummary({ startsAt: "2026-11-14T12:00:00.000Z", durationMinutes: 60, repeatEveryDays: null, alsoAfterDays: null, timing: "fixed" })).toBe(
      "Once, on Sat, 14 Nov 2026 · 12:00 UTC for 1 hour",
    );
  });
});

describe("parseAllianceProfileForm", () => {
  it("keeps line breaks and cleans the Discord invite", () => {
    const parsed = parseAllianceProfileForm(
      form({ description: "Friendly.\r\n\r\n\r\nActive at 19:00 UTC.  ", requirements: "TC 25", languages: " EN  /  DE ", discordUrl: "discord.gg/Abc-123/" }),
    );
    expect(parsed.ok && parsed.value).toEqual({ description: "Friendly.\n\nActive at 19:00 UTC.", requirements: "TC 25", languages: "EN / DE", discordUrl: "https://discord.gg/Abc-123" });
  });

  it("refuses links that aren't Discord invites", () => {
    const parsed = parseAllianceProfileForm(form({ discordUrl: "https://example.com/invite" }));
    expect(!parsed.ok && parsed.errors.discordUrl).toMatch(/Discord invite/);
  });
});

describe("discordInvite", () => {
  it("accepts both invite forms and nothing else", () => {
    expect(discordInvite("")).toBeNull();
    expect(discordInvite("https://discord.com/invite/k1241")).toBe("https://discord.com/invite/k1241");
    expect(discordInvite("http://www.discord.gg/k1241")).toBe("https://discord.gg/k1241");
    expect(discordInvite("https://discord.com/channels/1/2")).toBeUndefined();
    expect(discordInvite("javascript:alert(1)")).toBeUndefined();
  });
});

describe("parseTransfersForm", () => {
  it("takes everything as optional", () => {
    const empty = parseTransfersForm(form({ open: "on", info: "", contact: "" }));
    expect(empty.ok && empty.value).toEqual({ discordUrl: null, open: true, terms: NO_TRANSFER_TERMS, info: "", contact: "", transferDiscordUrl: null });
  });

  it("reads the game's terms: kingdoms, the window in UTC and the power caps in millions", () => {
    const parsed = parseTransfersForm(
      form({
        open: "on",
        contact: "Ask Rudy.",
        kingdomFrom: "1201",
        kingdomTo: "1260",
        windowStart: "2026-11-15T00:00",
        windowEnd: "2026-11-21T23:59",
        powerRegular: "150",
        powerLeading: "97,5",
      }),
    );
    expect(parsed.ok && parsed.value.terms).toEqual({
      kingdomFrom: 1201,
      kingdomTo: 1260,
      windowStart: "2026-11-15T00:00:00.000Z",
      windowEnd: "2026-11-21T23:59:00.000Z",
      powerRegular: 150_000_000,
      powerLeading: 97_500_000,
    });
  });

  it("wants both ends of each pair, in order, and real numbers", () => {
    const half = parseTransfersForm(form({ contact: "Ask Rudy.", kingdomFrom: "1201", windowEnd: "2026-11-21T23:59" }));
    expect(!half.ok && Object.keys(half.errors).sort()).toEqual(["kingdomTo", "windowStart"]);
    const backwards = parseTransfersForm(
      form({ contact: "Ask Rudy.", kingdomFrom: "1260", kingdomTo: "1201", windowStart: "2026-11-21T00:00", windowEnd: "2026-11-15T00:00" }),
    );
    expect(!backwards.ok && Object.keys(backwards.errors).sort()).toEqual(["kingdomTo", "windowEnd"]);
    const words = parseTransfersForm(form({ contact: "Ask Rudy.", powerRegular: "150M", powerLeading: "0" }));
    expect(!words.ok && Object.keys(words.errors).sort()).toEqual(["powerLeading", "powerRegular"]);
  });

  it("keeps the Markdown of both texts as written, without images", () => {
    const md = "**20 slots**\r\n\n- Be active\n- Join an alliance";
    const parsed = parseTransfersForm(form({ contact: "**Anna**\r\nDiscord: anna_1241", info: md }));
    expect(parsed.ok && [parsed.value.info, parsed.value.contact]).toEqual(["**20 slots**\n\n- Be active\n- Join an alliance", "**Anna**\nDiscord: anna_1241"]);
    const image = parseTransfersForm(form({ contact: "![me](https://example.com/b.webp)", info: "Look: ![map](https://example.com/a.webp)" }));
    expect(!image.ok && Object.keys(image.errors).sort()).toEqual(["contact", "info"]);
  });

  it("takes both Discord invites as optional, and only real invites", () => {
    const both = parseTransfersForm(form({ contact: "Ask Rudy.", discordUrl: "discord.gg/k1241", transferDiscordUrl: "https://discord.com/invite/k1241-transfers" }));
    expect(both.ok && [both.value.discordUrl, both.value.transferDiscordUrl]).toEqual(["https://discord.gg/k1241", "https://discord.com/invite/k1241-transfers"]);
    const bad = parseTransfersForm(form({ contact: "Ask Rudy.", discordUrl: "https://t.me/k1241", transferDiscordUrl: "x" }));
    expect(!bad.ok && Object.keys(bad.errors).sort()).toEqual(["discordUrl", "transferDiscordUrl"]);
  });
});

describe("millionsField", () => {
  it("turns millions into power, with a comma or a point", () => {
    expect(millionsField(form({ p: "97.5" }), "p")).toBe(97_500_000);
    expect(millionsField(form({ p: "97,25" }), "p")).toBe(97_250_000);
    expect(millionsField(form({ p: "" }), "p")).toBeNull();
    expect(millionsField(form({ p: "1.234" }), "p")).toBeUndefined();
    expect(millionsField(form({ p: "-5" }), "p")).toBeUndefined();
  });
});
