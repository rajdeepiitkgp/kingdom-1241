import { describe, expect, it } from "vitest";
import { pick } from "@/lib/i18n/localized";

describe("pick", () => {
  it("prefers the locale, then English, then anything", () => {
    expect(pick({ en: "Hello", de: "Hallo" }, "de")).toBe("Hallo");
    expect(pick({ en: "Hello", de: "" }, "de")).toBe("Hello");
    expect(pick({ en: "Hello" }, "ar")).toBe("Hello");
    expect(pick({ pl: "Cześć" }, "ar")).toBe("Cześć");
    expect(pick(undefined, "en")).toBe("");
  });
});
