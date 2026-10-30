// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { at, expectHealthyPage, hydrated, t } from "./support/site";
import { expect, test } from "./support/test";

test("TOOLS-01 the calculators answer as the numbers change", async ({ page }) => {
  await page.goto(at("en", "/tools"));

  // Rally refill: remaining = capacity − what is in the rally (the defaults: 1,500,000 − 600,000).
  const refill = page.getByRole("region", { name: t("tools.refill.title") });
  const capacity = refill.getByLabel(t("tools.refill.capacity"));
  await hydrated(capacity);
  await expect(refill).toContainText("900,000");
  await capacity.fill("1000000");
  await expect(refill).toContainText("400,000");
  await expect(refill).not.toContainText("900,000");

  // Pack value: a pack twice the price is worth half as much per unit of money.
  const pack = page.getByRole("region", { name: t("tools.pack.title") });
  // The big number under the "Pack value" label (the lines' own shares are percentages too).
  const percent = pack.getByText(t("tools.pack.valuePercent"), { exact: true }).locator("xpath=following-sibling::p[1]");
  const before = Number((await percent.innerText()).replace(/\D/g, ""));
  expect(before).toBeGreaterThan(0);
  await pack.getByLabel(t("tools.pack.price")).fill("9.98");
  await expect.poll(async () => Number((await percent.innerText()).replace(/\D/g, ""))).toBeLessThan(before);
  await expectHealthyPage(page, "en");
});
