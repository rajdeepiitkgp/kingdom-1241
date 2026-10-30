import { describe, expect, it } from "vitest";
import { format } from "@/lib/i18n/dictionary";

describe("format", () => {
  it("replaces placeholders and leaves unknown ones alone", () => {
    expect(format("Every {n} days", { n: 3 })).toBe("Every 3 days");
    expect(format("{a} {b}", { a: "x" })).toBe("x {b}");
  });
});
