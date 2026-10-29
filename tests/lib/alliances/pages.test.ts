import { describe, expect, it } from "vitest";
import { alliancePath, guidesOfAlliance, tagFromSegment } from "@/lib/alliances/pages";

describe("alliance page addresses", () => {
  it("round-trip any tag, case kept", () => {
    for (const tag of ["NAM", "Nam", "K1/2", "♛ok", "a b"]) expect(tagFromSegment(alliancePath(tag).split("/")[2])).toBe(tag);
    expect(alliancePath("Nam")).toBe("/alliances/Nam");
  });

  it("take a segment that isn't valid encoding as typed", () => {
    expect(tagFromSegment("100%")).toBe("100%");
  });
});

describe("guidesOfAlliance", () => {
  const guides = [
    { id: "g1", published: true },
    { id: "g2", published: true },
    { id: "g3", published: false },
  ];
  const sections = [
    { guideId: "g2", allianceTag: "NAM", published: true },
    { guideId: "g1", allianceTag: "NAM", published: true },
    { guideId: "g3", allianceTag: "NAM", published: true },
    { guideId: "g1", allianceTag: "Nam", published: true },
    { guideId: "g2", allianceTag: "ULU", published: false },
  ];

  it("lists the shown guides with a shown section of exactly this tag, in the guides' order", () => {
    expect(guidesOfAlliance("NAM", guides, sections).map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(guidesOfAlliance("Nam", guides, sections).map((g) => g.id)).toEqual(["g1"]);
    expect(guidesOfAlliance("ULU", guides, sections)).toEqual([]);
  });
});
