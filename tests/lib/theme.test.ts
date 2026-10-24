import { describe, expect, it } from "vitest";
import { parseTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "@/lib/theme";

describe("theme", () => {
  it("only knows light and dark", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme("system")).toBe("light");
    expect(parseTheme(null)).toBe("light");
  });
  it("keeps the storage key next-themes used and ships a self-contained init script", () => {
    expect(THEME_STORAGE_KEY).toBe("theme");
    expect(THEME_INIT_SCRIPT).toContain('"theme"');
    expect(THEME_INIT_SCRIPT).toMatch(/classList\.add/);
    expect(() => new Function(THEME_INIT_SCRIPT)).not.toThrow();
  });
});
