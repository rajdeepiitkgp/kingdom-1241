import { describe, expect, it } from "vitest";
import { randomDigits, SUGGESTED_CODE_LENGTH } from "@/lib/random-code";

describe("randomDigits", () => {
  it("gives six digits by default", () => {
    for (let i = 0; i < 50; i++) expect(randomDigits()).toMatch(new RegExp(`^\\d{${SUGGESTED_CODE_LENGTH}}$`));
  });

  it("skips bytes that would make some digits likelier than others", () => {
    const feed = [255, 250, 3, 249, 17, 252, 0, 9, 128, 64];
    let at = 0;
    const random = (bytes: Uint8Array) => bytes.map(() => feed[at++ % feed.length]);
    expect(randomDigits(6, random)).toBe("397098");
  });

  it("keeps drawing until the code is complete", () => {
    let calls = 0;
    const random = (bytes: Uint8Array) => {
      calls += 1;
      return bytes.map((_, i) => (calls === 1 && i > 0 ? 251 : 5));
    };
    expect(randomDigits(4, random)).toBe("5555");
    expect(calls).toBe(2);
  });
});
