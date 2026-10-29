// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { describe, expect, it } from "vitest";
import { ADMIN_TOURS, adminPageFor } from "@/lib/admin/tours";

describe("the admin page guides", () => {
  it("pick the guide of the open admin page, in any language", () => {
    expect(adminPageFor("/en/admin")).toBe("overview");
    expect(adminPageFor("/de/admin/")).toBe("overview");
    expect(adminPageFor("/en/admin/kvk")).toBe("plans");
    expect(adminPageFor("/en/admin/kvk/new")).toBe("plan");
    expect(adminPageFor("/ar/admin/kvk/3f2a")).toBe("plan");
    expect(adminPageFor("/en/admin/kvk/3f2a/leaders")).toBe("leaders");
    expect(adminPageFor("/en/admin/kvk/3f2a/checklist")).toBe("checklist");
    expect(adminPageFor("/en/admin/feedback")).toBe("feedback");
    expect(adminPageFor("/en/admin/announcements")).toBe("announcements");
    expect(adminPageFor("/en/admin/announcements/new")).toBe("announcement");
    expect(adminPageFor("/en/admin/announcements/3f2a/x")).toBeNull();
    expect(adminPageFor("/en/admin/feedback/3f2a")).toBe("results");
    expect(adminPageFor("/en/admin/feedback/3f2a/print")).toBe("print");
    expect(adminPageFor("/en/admin/rally-sync")).toBe("rallySync");
    expect(adminPageFor("/en/admin/gift-codes")).toBe("giftCodes");
    expect(adminPageFor("/en/admin/users")).toBe("users");
    expect(adminPageFor("/en/admin/settings")).toBe("settings");
    for (const tab of ["usage", "rally-sync", "alliances", "languages"]) expect(adminPageFor(`/en/admin/settings/${tab}`), tab).toBe("settings");
    expect(adminPageFor("/en/admin/settings/elsewhere")).toBeNull();
  });

  it("have no guide outside the admin pages", () => {
    for (const path of ["/en/admin/login", "/en/admin/kvk/3f2a/other", "/en/admin/feedback/3f2a/export", "/en/kvk", "/en/tools/rally-sync", "/admin"]) {
      expect(adminPageFor(path), path).toBeNull();
    }
  });

  it("keep every step short enough for the card on a phone", () => {
    for (const tour of Object.values(ADMIN_TOURS)) {
      for (const s of tour.steps) {
        expect(s.title.length, s.title).toBeLessThanOrEqual(40);
        expect(s.body.length, s.title).toBeLessThanOrEqual(330);
      }
    }
  });
});
