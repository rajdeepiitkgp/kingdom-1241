import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf8");

/** Custom properties declared in the first rule whose selector starts with `selector`. */
function tokensOf(selector: string): string[] {
  const start = css.indexOf(selector);
  expect(start, selector).toBeGreaterThan(-1);
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return [...body.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
}

describe("the print view's paper scopes", () => {
  it("hand every theme token back to the site theme on screen", () => {
    const theme = tokensOf(":root,\n.paper-light {");
    const reset = tokensOf("  .paper-light,\n  .paper-dark {");
    expect(theme.length).toBeGreaterThan(10);
    expect(reset.sort()).toEqual(theme.sort());
    expect(tokensOf(".dark,\n.paper-dark {").every((token) => theme.includes(token))).toBe(true);
  });
});
