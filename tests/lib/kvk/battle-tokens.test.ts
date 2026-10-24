import { describe, expect, it } from "vitest";
import { hasBattleTokens, relativeDay, renderBattleTokens } from "@/lib/kvk/battle-tokens";

const battleAt = "2026-11-08T14:00:00.000Z";
const html = "<p>Castle battle {{when}}, {{date}} at {{time}} ({{utc}}).</p>";

describe("renderBattleTokens", () => {
  it("detects tokens regardless of case and spacing, and ignores other braces", () => {
    expect(hasBattleTokens("see you {{ WHEN }}")).toBe(true);
    expect(hasBattleTokens("no tokens {n} or {{other}} here")).toBe(false);
  });

  it("renders everything in UTC before the visitor's clock is known (server HTML)", () => {
    expect(renderBattleTokens(html, battleAt, { locale: "en", now: null })).toBe(
      "<p>Castle battle Sunday, November 8, Sunday, November 8 at 14:00 UTC (14:00 UTC).</p>",
    );
  });

  it("uses the visitor's language, zone and calendar once hydrated", () => {
    const now = new Date("2026-11-07T20:00:00.000Z"); // 21:00 on the 7th in Berlin → the battle is tomorrow
    expect(renderBattleTokens(html, battleAt, { locale: "de", now, timeZone: "Europe/Berlin" })).toBe(
      "<p>Castle battle morgen, Sonntag, 8. November at 15:00 (14:00 UTC).</p>",
    );
  });

  it("drops the tokens when the plan has no battle time and keeps the HTML around them", () => {
    expect(renderBattleTokens("<p>{{when}} {n} <b>{{unknown}}</b></p>", null, { locale: "en", now: null })).toBe("<p> {n} <b>{{unknown}}</b></p>");
    expect(renderBattleTokens("<p>{{ Date }}</p>", "not a date", { locale: "en", now: null })).toBe("<p></p>");
  });
});

describe("relativeDay", () => {
  const battle = new Date(battleAt);

  it("counts calendar days in the visitor's zone, not in UTC", () => {
    // 23:30 UTC on the 7th is already the morning of the 8th in Seoul.
    expect(relativeDay(battle, new Date("2026-11-07T23:30:00.000Z"), "en", "Asia/Seoul")).toBe("today");
    expect(relativeDay(battle, new Date("2026-11-07T23:30:00.000Z"), "en", "UTC")).toBe("tomorrow");
  });

  it("speaks the visitor's language", () => {
    expect(relativeDay(battle, new Date("2026-11-05T10:00:00.000Z"), "en", "UTC")).toBe("in 3 days");
    expect(relativeDay(battle, new Date("2026-11-10T10:00:00.000Z"), "en", "UTC")).toBe("2 days ago");
    expect(relativeDay(battle, new Date("2026-11-07T10:00:00.000Z"), "ko", "UTC")).toBe("내일");
    expect(relativeDay(battle, new Date("2026-11-07T10:00:00.000Z"), "ar", "UTC")).toBe("غدًا");
  });
});
