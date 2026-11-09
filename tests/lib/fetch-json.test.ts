import { describe, expect, it } from "vitest";
import { JSON_RESPONSE_LIMIT, readJson, ResponseTooLargeError } from "@/lib/fetch-json";

describe("readJson", () => {
  it("parses an answer within the cap", async () => {
    expect(await readJson(new Response(JSON.stringify({ ok: true, list: [1, 2] })))).toEqual({ ok: true, list: [1, 2] });
    expect(JSON_RESPONSE_LIMIT).toBe(1_000_000);
  });

  it("refuses an answer over the cap, whether declared or streamed", async () => {
    const declared = new Response("{}", { headers: { "content-length": "5000" } });
    await expect(readJson(declared, 100)).rejects.toBeInstanceOf(ResponseTooLargeError);
    const streamed = new Response(JSON.stringify({ text: "y".repeat(500) }));
    await expect(readJson(streamed, 100)).rejects.toThrow(/larger than 100 bytes/);
  });

  it("rejects a body that isn't JSON", async () => {
    await expect(readJson(new Response("<html>down</html>"))).rejects.toThrow();
  });
});
