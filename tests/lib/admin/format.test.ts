import { describe, expect, it } from "vitest";
import { utcLabel } from "@/lib/admin/format";

describe("utcLabel", () => {
  it("prints the moment in UTC, in the admin area's English format", () => {
    expect(utcLabel("2026-10-25T14:00:00Z")).toBe("25 Oct 2026, 14:00");
    expect(utcLabel("2026-10-25T14:00:00+02:00")).toBe("25 Oct 2026, 12:00");
  });
  it("shows a dash for nothing or garbage", () => {
    expect(utcLabel(null)).toBe("—");
    expect(utcLabel(undefined)).toBe("—");
    expect(utcLabel("soon")).toBe("—");
  });
});
