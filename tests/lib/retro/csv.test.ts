import { describe, expect, it } from "vitest";
import { csvCell, csvFileName, responsesCsv, toCsv } from "@/lib/retro/csv";
import { defaultConfig } from "@/lib/retro/questions";

describe("csv", () => {
  it("quotes what needs quoting and defuses formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", twice')).toBe('"say ""hi"", twice"');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
    expect(csvCell("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvCell("-5 things")).toBe("'-5 things");
    expect(csvCell(null)).toBe("");
    expect(csvCell(4)).toBe("4");
  });

  it("writes a BOM, CRLF and the configured columns without identity", () => {
    const config = defaultConfig();
    config.texts.suggestions.shown = false;
    const csv = responsesCsv(
      [
        {
          id: "r1",
          createdAt: "2026-10-25T10:00:00.000Z",
          allianceTag: "NAM",
          verified: true,
          locale: "de",
          ratings: { overall: 4, planning: 0 },
          texts: { went_well: "Good, fast", went_wrong: "", suggestions: "hidden column" },
          textsEn: { went_well: "Good, fast (en)" },
        },
      ],
      config,
    );
    const lines = csv.split("\r\n");
    expect(lines[0].charCodeAt(0)).toBe(0xfeff);
    expect(lines[0].slice(1)).toBe("id,submitted_utc,alliance,verified,language,rating_overall,rating_planning,rating_coordination,rating_formations,went_well,went_well_en,went_wrong,went_wrong_en");
    expect(lines[1]).toBe('r1,2026-10-25T10:00:00.000Z,NAM,yes,de,4,0,,,"Good, fast","Good, fast (en)",,');
    expect(csv).not.toContain("hidden column");
    expect(lines.at(-1)).toBe("");
  });

  it("builds a safe file name", () => {
    expect(csvFileName("Castle Battle — 1 Nov")).toBe("feedback-castle-battle-1-nov.csv");
    expect(csvFileName("")).toBe("feedback-responses.csv");
    expect(toCsv([["a", "b"], [1, 2]])).toBe("﻿a,b\r\n1,2\r\n");
  });
});
