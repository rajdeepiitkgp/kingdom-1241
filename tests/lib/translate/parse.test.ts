// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { parseTranslationJson, translationSchema } from "@/lib/translate/parse";

describe("parseTranslationJson", () => {
  it("returns exactly the requested keys, trimmed, tolerating code fences", () => {
    const out = parseTranslationJson('```json\n{"f0": " Bärenjagd ", "f1": "", "extra": "x"}\n```', ["f0", "f1", "f2"]);
    expect(out).toEqual({ f0: "Bärenjagd", f1: "", f2: "" });
  });

  it("rejects non-JSON and non-object replies", () => {
    expect(() => parseTranslationJson("not json", ["f0"])).toThrow(/invalid JSON/);
    expect(() => parseTranslationJson("[1,2]", ["f0"])).toThrow(/non-object/);
  });
});

describe("translationSchema", () => {
  it("is a strict object schema with one string per field", () => {
    const schema = translationSchema(["f0", "f1"]);
    expect(schema.required).toEqual(["f0", "f1"]);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.f1).toEqual({ type: "string" });
  });
});
