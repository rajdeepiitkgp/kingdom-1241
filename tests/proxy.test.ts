import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The paths the proxy leaves alone, read from its matcher in the source: Next.js
 * wants the matcher as a literal, so it can't be imported. The matcher is
 * `/((?!…).*)`, a negative lookahead on the path after its first slash.
 */
function excluded(): RegExp {
  const source = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8");
  const match = /matcher:\s*\[\s*(?:\/\/[^\n]*\n\s*)*"\/\(\(\?!(.*?)\)\.\*\)",?\s*\]/.exec(source);
  if (!match) throw new Error("the matcher was not found in src/proxy.ts");
  // The source holds the pattern as a string literal: `\\.` there is `\.` in the pattern.
  return new RegExp(`^(?:${match[1].replace(/\\\\/g, "\\")})`);
}

describe("proxy matcher", () => {
  const skip = excluded();
  const skipped = (path: string) => skip.test(path.slice(1));

  it("leaves the API, auth, Next internals, metadata files and static assets alone", () => {
    for (const path of ["/api", "/api/translate", "/auth/callback", "/_next/static/chunks/a.js", "/_next/image", "/favicon.ico", "/robots.txt", "/icon.png", "/apple-icon.png", "/items/wood.webp", "/heroes/amane.png", "/x/logo.svg"]) {
      expect(skipped(path), path).toBe(true);
    }
  });

  it("routes every page, also addresses that merely start like api or auth, or carry a dot", () => {
    for (const path of ["/", "/authors", "/apiary", "/en", "/en/kvk", "/kvk/prep", "/en/admin/alliances/2.0", "/en/guides/v1.2-notes", "/en/tools/rally-sync/E2R123"]) {
      expect(skipped(path), path).toBe(false);
    }
  });
});
