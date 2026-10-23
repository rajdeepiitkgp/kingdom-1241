import { beforeEach, describe, expect, it, vi } from "vitest";
import { sourceHash } from "@/lib/translate/hash";

// Mock Gemini: pretend-translate by prefixing the locale.
const fakeTranslate = async (fields: Record<string, string>, locale: string) =>
  Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `[${locale}] ${v}`]));
const translateFields = vi.fn(fakeTranslate);
vi.mock("@/lib/translate/gemini", () => ({
  translateFields: (fields: Record<string, string>, locale: string) => translateFields(fields, locale),
  withRetry: <T>(fn: () => Promise<T>) => fn(),
}));

import { translateRows } from "@/lib/translate/translate-row";

/** Minimal in-memory stand-in for the Supabase client used by translateRows. */
function fakeSupabase(rows: Record<string, Record<string, unknown>>) {
  const updates: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const client = {
    from: () => ({
      update: (patch: Record<string, unknown>) => ({
        eq: async (_key: string, id: string) => {
          updates.push({ id, patch });
          Object.assign(rows[id], patch);
          return { error: null };
        },
      }),
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { client: client as any, updates };
}

describe("translateRows", () => {
  beforeEach(() => {
    translateFields.mockReset();
    translateFields.mockImplementation(fakeTranslate);
  });

  it("translates missing languages, stores the hash, and is a no-op the second time", async () => {
    const rows = {
      a: { id: "a", name: { en: "Bear Hunt" }, summary: { en: "Rally the bear." }, source_hash: null },
    };
    const { client, updates } = fakeSupabase(rows);

    const first = await translateRows(client, "events", [rows.a], ["de", "pl"]);
    expect(first[0].skipped).toBe(false);
    expect(first[0].translated.sort()).toEqual(["de", "pl"]);
    expect(translateFields).toHaveBeenCalledTimes(2); // one request per language, both fields batched
    expect(rows.a.name).toEqual({ en: "Bear Hunt", de: "[de] Bear Hunt", pl: "[pl] Bear Hunt" });
    expect(rows.a.source_hash).toBe(sourceHash({ name: "Bear Hunt", summary: "Rally the bear." }));

    // Simulates the webhook firing again because of our own UPDATE.
    const second = await translateRows(client, "events", [rows.a], ["de", "pl"]);
    expect(second[0].skipped).toBe(true);
    expect(second[0].reason).toBe("up to date");
    expect(updates).toHaveLength(1);
  });

  it("re-translates everything when the English text changes", async () => {
    const hash = sourceHash({ name: "Old", summary: "" });
    const rows = { a: { id: "a", name: { en: "New", de: "[de] Old" }, summary: { en: "" }, source_hash: hash } };
    const { client } = fakeSupabase(rows);

    const result = await translateRows(client, "events", [rows.a], ["de"]);
    expect(result[0].translated).toEqual(["de"]);
    expect(rows.a.name).toEqual({ en: "New", de: "[de] New" });
  });

  it("only fills in a newly enabled language", async () => {
    const hash = sourceHash({ name: "Bear Hunt", summary: "" });
    const rows = { a: { id: "a", name: { en: "Bear Hunt", de: "Bärenjagd" }, summary: { en: "" }, source_hash: hash } };
    const { client } = fakeSupabase(rows);

    const result = await translateRows(client, "events", [rows.a], ["de", "ko"]);
    expect(result[0].translated).toEqual(["ko"]);
    expect(rows.a.name).toEqual({ en: "Bear Hunt", de: "Bärenjagd", ko: "[ko] Bear Hunt" });
    expect(translateFields).toHaveBeenCalledTimes(1);
  });

  it("batches many small rows into one request per language", async () => {
    const rows: Record<string, Record<string, unknown>> = {};
    for (let i = 0; i < 10; i++) rows[`k${i}`] = { key: `k${i}`, text: { en: `Label ${i}` }, source_hash: null };
    const { client } = fakeSupabase(rows);

    const results = await translateRows(client, "ui_strings", Object.values(rows), ["ar"]);
    expect(results.every((r) => !r.skipped)).toBe(true);
    expect(translateFields).toHaveBeenCalledTimes(1);
    expect(rows.k3.text).toEqual({ en: "Label 3", ar: "[ar] Label 3" });
  });

  it("sanitises translated HTML and skips rows without English text", async () => {
    translateFields.mockImplementationOnce(async (fields) =>
      Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `${v}<script>alert(1)</script>`])),
    );
    const rows = {
      g: { id: "g", title: { en: "Guide" }, summary: { en: "" }, body: { en: "<p>Hi</p>" }, source_hash: null },
      empty: { id: "empty", title: {}, summary: {}, body: {}, source_hash: null },
    };
    const { client } = fakeSupabase(rows);

    const results = await translateRows(client, "guides", [rows.g, rows.empty], ["de"]);
    expect((rows.g.body as Record<string, string>).de).toBe("<p>Hi</p>");
    expect(results.find((r) => r.id === "empty")?.reason).toBe("no English source text");
  });

  it("does not mark a row up to date when a language fails", async () => {
    translateFields.mockImplementationOnce(async () => {
      throw new Error("429 rate limited");
    });
    const rows = { a: { id: "a", name: { en: "Bear Hunt" }, summary: { en: "" }, source_hash: null } };
    const { client } = fakeSupabase(rows);

    const result = await translateRows(client, "events", [rows.a], ["de", "pl"]);
    expect(result[0].translated).toEqual(["pl"]);
    expect(result[0].reason).toBe("partial");
    expect(rows.a.source_hash).toBeNull();
  });

  it("only translates the localized settings rows", async () => {
    const rows = {
      kingdom_name: { key: "kingdom_name", value: { en: "Kingdom 1241" }, source_hash: null },
      daily_reset_utc_hour: { key: "daily_reset_utc_hour", value: 0, source_hash: null },
    };
    const { client } = fakeSupabase(rows);
    const results = await translateRows(client, "site_settings", Object.values(rows), ["de"]);
    expect(results).toHaveLength(1);
    expect(rows.kingdom_name.value).toEqual({ en: "Kingdom 1241", de: "[de] Kingdom 1241" });
    expect(rows.daily_reset_utc_hour.value).toBe(0);
  });
});
