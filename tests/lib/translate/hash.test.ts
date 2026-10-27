// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { columnHashes, encodeColumnHashes, sourceHash, staleColumns, storedColumnHashes } from "@/lib/translate/hash";

describe("per-column hashes", () => {
  const source = { title: "Castle Battle", intro: "<p>Hi</p>" };

  it("expands a matching legacy whole-row hash to every column", () => {
    expect(storedColumnHashes(sourceHash(source), source)).toEqual(columnHashes(source));
    expect(staleColumns(source, sourceHash(source))).toEqual([]);
  });

  it("treats a stale legacy hash as nothing known", () => {
    expect(storedColumnHashes(sourceHash({ title: "Old", intro: "<p>Hi</p>" }), source)).toEqual({});
    expect(staleColumns(source, sourceHash({ title: "Old", intro: "<p>Hi</p>" }))).toEqual(["title", "intro"]);
  });

  it("reports only the changed column with per-column hashes", () => {
    const stored = encodeColumnHashes(columnHashes({ title: "Old title", intro: "<p>Hi</p>" }));
    expect(staleColumns(source, stored)).toEqual(["title"]);
    expect(staleColumns(source, encodeColumnHashes(columnHashes(source)))).toEqual([]);
  });

  it("ignores empty columns and garbage", () => {
    expect(staleColumns({ title: "T", summary: "" }, null)).toEqual(["title"]);
    expect(storedColumnHashes("{not json", source)).toEqual({});
    expect(storedColumnHashes('{"title":1}', source)).toEqual({});
  });

  it("encodes with sorted keys", () => {
    expect(encodeColumnHashes({ intro: "b", title: "a" })).toBe('{"intro":"b","title":"a"}');
  });
});
