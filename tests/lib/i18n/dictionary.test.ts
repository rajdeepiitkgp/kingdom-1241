import { describe, expect, it } from "vitest";
import { coversKey, type Dictionary, format, pickDictionary } from "@/lib/i18n/dictionary";

describe("format", () => {
  it("replaces placeholders and leaves unknown ones alone", () => {
    expect(format("Every {n} days", { n: 3 })).toBe("Every 3 days");
    expect(format("{a} {b}", { a: "x" })).toBe("x {b}");
    expect(format("{constructor} {toString}", {})).toBe("{constructor} {toString}");
  });
});

describe("pickDictionary", () => {
  const dict = { "kvk.title": "Plan", "kvk.role.lead": "Lead", "kvkx.other": "No", "tour.kvk.lock.body": "Lock", "tour.sync.go.body": "Go", "nav": "Menu" } as unknown as Dictionary;

  it("keeps the keys under the prefixes and the prefixes themselves, nothing that only starts alike", () => {
    expect(Object.keys(pickDictionary(dict, ["kvk", "tour.kvk"]))).toEqual(["kvk.title", "kvk.role.lead", "tour.kvk.lock.body"]);
    expect(Object.keys(pickDictionary(dict, ["nav"]))).toEqual(["nav"]);
    expect(Object.keys(pickDictionary(dict, []))).toEqual([]);
  });

  it("tells whether a key is covered", () => {
    expect(coversKey(["kvk"], "kvk.role.lead")).toBe(true);
    expect(coversKey(["kvk"], "kvkx.other")).toBe(false);
    expect(coversKey(["kvk.role"], "kvk.title")).toBe(false);
    expect(coversKey(["tour.kvk"], "tour.kvk.lock.body")).toBe(true);
  });

  it("covers one level with a trailing .*", () => {
    expect(coversKey(["tour.*"], "tour.next")).toBe(true);
    expect(coversKey(["tour.*"], "tour.kvk.lock.body")).toBe(false);
    expect(coversKey(["tour.*"], "tour")).toBe(false);
    expect(coversKey(["tour.*"], "tours.next")).toBe(false);
    expect(Object.keys(pickDictionary(dict, ["tour.*"]))).toEqual([]);
    expect(Object.keys(pickDictionary({ ...dict, "tour.next": "Next" } as unknown as Dictionary, ["tour.*"]))).toEqual(["tour.next"]);
  });
});
