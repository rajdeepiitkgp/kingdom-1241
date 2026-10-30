import { describe, expect, it } from "vitest";
import { readAll } from "@/lib/supabase/read-all";

describe("readAll", () => {
  it("asks for one page after another until a short page and returns every row in order", async () => {
    const table = Array.from({ length: 2_345 }, (_, i) => ({ key: `k${i}` }));
    const asked: Array<[number, number]> = [];
    const rows = await readAll(async (from, to) => {
      asked.push([from, to]);
      return { data: table.slice(from, to + 1), error: null };
    });
    expect(rows).toEqual(table);
    expect(asked).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("stops after a full last page with one more, empty, read", async () => {
    const table = Array.from({ length: 10 }, (_, i) => i);
    const rows = await readAll(async (from, to) => ({ data: table.slice(from, to + 1), error: null }), 5);
    expect(rows).toEqual(table);
  });

  it("throws the database's message", async () => {
    await expect(readAll(async () => ({ data: null, error: { message: "permission denied" } }))).rejects.toThrow("permission denied");
  });
});
