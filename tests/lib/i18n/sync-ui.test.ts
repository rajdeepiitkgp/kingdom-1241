import { describe, expect, it } from "vitest";
import { mergeUiRow, uiRowsToWrite, type StoredUiString, type UiStringRow } from "@/lib/i18n/sync-ui";

const row = (key: string, en: string, de = `${en} (de)`, hash = `h-${en}`): UiStringRow => ({
  key,
  text: { en, de },
  source_hash: hash,
});

const stored = (key: string, text: unknown, source_hash: unknown = `h-${(text as { en?: string })?.en}`): StoredUiString => ({ key, text, source_hash });

describe("mergeUiRow", () => {
  it("keeps the languages the pipeline added while the English is unchanged", () => {
    const merged = mergeUiRow(row("a", "Hello"), stored("a", { en: "Hello", de: "Hallo (alt)", fr: "Bonjour" }));
    expect(merged.text).toEqual({ en: "Hello", de: "Hello (de)", fr: "Bonjour" });
  });

  it("drops them once the English changed, so the pipeline translates again", () => {
    const merged = mergeUiRow(row("a", "Hello there"), stored("a", { en: "Hello", de: "Hallo", fr: "Bonjour" }));
    expect(merged.text).toEqual({ en: "Hello there", de: "Hello there (de)" });
  });

  it("writes the code's row when nothing usable is stored", () => {
    expect(mergeUiRow(row("a", "Hello"), undefined).text).toEqual({ en: "Hello", de: "Hello (de)" });
    expect(mergeUiRow(row("a", "Hello"), stored("a", null)).text).toEqual({ en: "Hello", de: "Hello (de)" });
    expect(mergeUiRow(row("a", "Hello"), stored("a", ["Hello"])).text).toEqual({ en: "Hello", de: "Hello (de)" });
  });
});

describe("uiRowsToWrite", () => {
  it("writes new keys and leaves identical rows alone", () => {
    const plan = uiRowsToWrite([row("new", "New"), row("same", "Same")], [stored("same", { en: "Same", de: "Same (de)" })]);
    expect(plan.write.map((r) => r.key)).toEqual(["new"]);
    expect(plan.unchanged).toBe(1);
  });

  it("counts a row with extra pipeline languages as unchanged", () => {
    const plan = uiRowsToWrite([row("a", "Hello")], [stored("a", { en: "Hello", de: "Hello (de)", fr: "Bonjour", ja: "こんにちは" })]);
    expect(plan.write).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });

  it("writes a row whose hand-written translation changed, keeping the pipeline's languages", () => {
    const plan = uiRowsToWrite([row("a", "Hello", "Hallo!")], [stored("a", { en: "Hello", de: "Hallo", fr: "Bonjour" })]);
    expect(plan.write).toEqual([{ key: "a", text: { en: "Hello", de: "Hallo!", fr: "Bonjour" }, source_hash: "h-Hello" }]);
    expect(plan.unchanged).toBe(0);
  });

  it("writes a row whose English changed, without the old languages", () => {
    const plan = uiRowsToWrite([row("a", "Hi")], [stored("a", { en: "Hello", de: "Hallo", fr: "Bonjour" })]);
    expect(plan.write).toEqual([{ key: "a", text: { en: "Hi", de: "Hi (de)" }, source_hash: "h-Hi" }]);
  });

  it("writes a row whose stored hash is off even when the texts match", () => {
    const plan = uiRowsToWrite([row("a", "Hello")], [stored("a", { en: "Hello", de: "Hello (de)" }, "stale")]);
    expect(plan.write.map((r) => r.key)).toEqual(["a"]);
    expect(plan.unchanged).toBe(0);
  });

  it("writes a row whose stored text is damaged", () => {
    expect(uiRowsToWrite([row("a", "Hello")], [stored("a", "Hello")]).write).toHaveLength(1);
  });

  it("ignores stored keys the code no longer has", () => {
    const plan = uiRowsToWrite([row("a", "Hello")], [stored("a", { en: "Hello", de: "Hello (de)" }), stored("gone", { en: "Old" })]);
    expect(plan.write).toEqual([]);
    expect(plan.unchanged).toBe(1);
  });
});
