// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { allianceLabel, openSection, orderByAlliance } from "@/lib/content/guide-sections";

describe("orderByAlliance", () => {
  it("follows Home's alliance order and puts unknown alliances last, by tag", () => {
    const alliances = [{ tag: "ULU" }, { tag: "NAM" }, { tag: "Nam" }];
    const sections = ["XYZ", "Nam", "ABC", "NAM", "ULU"].map((allianceTag) => ({ allianceTag }));
    expect(orderByAlliance(sections, alliances).map((s) => s.allianceTag)).toEqual(["ULU", "NAM", "Nam", "ABC", "XYZ"]);
    expect(sections[0].allianceTag).toBe("XYZ"); // the input stays as it was
  });
});

describe("openSection", () => {
  it("opens the remembered alliance when the guide has it, else the first", () => {
    expect(openSection(["NAM", "ULU"], "ULU")).toBe("ULU");
    expect(openSection(["NAM", "ULU"], "BRT")).toBe("NAM");
    expect(openSection(["NAM", "ULU"], null)).toBe("NAM");
    expect(openSection(["NAM"], "Nam")).toBe("NAM"); // tags are case-sensitive
    expect(openSection([], "NAM")).toBeNull();
  });
});

describe("allianceLabel", () => {
  it("names the alliance when Home lists it", () => {
    expect(allianceLabel("ULU", "United Legion")).toBe("[ULU] United Legion");
    expect(allianceLabel("OLD", undefined)).toBe("[OLD]");
  });
});
