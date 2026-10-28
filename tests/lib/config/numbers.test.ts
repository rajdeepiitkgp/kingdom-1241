import { describe, expect, it } from "vitest";
import { numberDefaults, parseNumberForm, parseNumbers } from "@/lib/config/numbers";

const SCHEMA = { days: { min: 7, max: 365, default: 30 }, cap: { min: 1, max: 2000, default: 600 } };

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("number settings", () => {
  it("default every number", () => {
    expect(numberDefaults(SCHEMA)).toEqual({ days: 30, cap: 600 });
  });

  it("read a stored value tolerantly, within the bounds", () => {
    expect(parseNumbers(SCHEMA, null)).toEqual({ days: 30, cap: 600 });
    expect(parseNumbers(SCHEMA, { days: 3, cap: "50" })).toEqual({ days: 7, cap: 600 });
    expect(parseNumbers(SCHEMA, { days: 400.5, cap: 9999 })).toEqual({ days: 30, cap: 2000 });
  });

  it("read the form strictly", () => {
    expect(parseNumberForm(SCHEMA, form({ days: " 14 ", cap: "100" }))).toEqual({ ok: true, value: { days: 14, cap: 100 } });
    expect(parseNumberForm(SCHEMA, form({ days: "6", cap: "1e3" }))).toEqual({ ok: false, errors: { days: "7 to 365.", cap: "1 to 2000." } });
  });
});
