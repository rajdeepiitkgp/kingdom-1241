import { describe, expect, it } from "vitest";
import { adminPath, loginPath, safeNextPath } from "@/lib/auth/paths";

describe("admin paths", () => {
  it("builds admin and login paths", () => {
    expect(adminPath("en")).toBe("/en/admin");
    expect(adminPath("de", "/kvk")).toBe("/de/admin/kvk");
    expect(loginPath("en")).toBe("/en/admin/login");
    expect(loginPath("en", "/en/admin/kvk")).toBe("/en/admin/login?next=%2Fen%2Fadmin%2Fkvk");
  });

  it("only accepts same-site relative destinations", () => {
    expect(safeNextPath("/en/admin/kvk", "/en/admin")).toBe("/en/admin/kvk");
    expect(safeNextPath("https://evil.example", "/en/admin")).toBe("/en/admin");
    expect(safeNextPath("//evil.example", "/en/admin")).toBe("/en/admin");
    expect(safeNextPath("/\\evil.example", "/en/admin")).toBe("/en/admin");
    expect(safeNextPath("/en/admin\r\nSet-Cookie: x", "/en/admin")).toBe("/en/admin");
    expect(safeNextPath(null, "/en/admin")).toBe("/en/admin");
  });
});
