// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { at, expectHealthyPage, hydrated, SEED_PASSWORDS, t, unlock } from "./support/site";
import { expect, test } from "./support/test";

test("KVK-01 the battle plan opens with its password only and locks again", async ({ page }) => {
  await page.goto(at("en", "/kvk"));
  const lock = page.getByRole("button", { name: t("kvk.lock") });
  await expect(lock).toBeHidden();
  await unlock(page, "not-the-password");
  await expect(page.getByText(t("kvk.wrongPassword"))).toBeVisible();
  await unlock(page, SEED_PASSWORDS.plan);
  await expect(lock).toBeVisible();
  await expect(page.locator('[data-tour="kvk-formations"]')).toBeVisible();
  await expectHealthyPage(page, "en");
  // The cookie keeps it open on the next visit, until Lock page.
  await page.reload();
  await expect(lock).toBeVisible();
  await hydrated(lock);
  await lock.click();
  await expect(page.getByLabel(t("kvk.password"))).toBeVisible();
  await expect(page.locator('[data-tour="kvk-formations"]')).toHaveCount(0);
});

test("KVK-02 the rally-leader page and the checklist each need their own password", async ({ page }) => {
  for (const { path, password, marker } of [
    { path: "/kvk/leaders", password: SEED_PASSWORDS.leaders, marker: "leaders-rallies" },
    { path: "/kvk/checklist", password: SEED_PASSWORDS.checklist, marker: "checklist-board" },
  ]) {
    await test.step(path, async () => {
      await page.goto(at("en", path));
      await unlock(page, SEED_PASSWORDS.plan);
      await expect(page.getByText(t("kvk.wrongPassword"))).toBeVisible();
      await unlock(page, password);
      await expect(page.locator(`[data-tour="${marker}"]`).first()).toBeVisible();
      await expectHealthyPage(page, "en");
    });
  }
});

test("KVK-03 the commander's ticks stay on this device", async ({ page }) => {
  await page.goto(at("en", "/kvk/checklist"));
  await unlock(page, SEED_PASSWORDS.checklist);
  // Players tap the card; the box itself is drawn by the card.
  const card = page.locator('[data-tour="checklist-board"] label').first();
  const box = page.getByRole("checkbox").first();
  await expect(box).not.toBeChecked();
  await hydrated(card);
  await card.click();
  await expect(box).toBeChecked();
  await page.reload();
  await expect(box).toBeChecked();
  await card.click();
  await expect(box).not.toBeChecked();
  await page.reload();
  await expect(box).not.toBeChecked();
});

test("KVK-04 the prep page opens on today's prep day with its countdown", async ({ page }) => {
  // Wednesday of the first round: Day 3 (rounds start Sunday 1 Nov 2026, Day 1 is the Monday).
  await page.clock.install({ time: new Date("2026-11-04T12:00:00Z") });
  await page.goto(at("en", "/kvk/prep"));
  const day3 = page.getByRole("button", { name: new RegExp(t("prep.day", "en", { n: 3 })) });
  await expect(day3).toHaveAttribute("aria-pressed", "true");
  await expect(day3.getByText(t("prep.today"), { exact: true })).toBeVisible();
  // The status card counts down (its "--" stands in until the clock is known) and keeps counting.
  const status = page.locator('[data-tour="prep-status"]');
  await expect(status).not.toContainText("--");
  const shown = await status.innerText();
  await page.clock.runFor(61_000);
  await expect(status).not.toHaveText(shown);
  // Another day can be picked and today stays marked.
  const day5 = page.getByRole("button", { name: new RegExp(t("prep.day", "en", { n: 5 })) });
  await hydrated(day5);
  await day5.click();
  await expect(day5).toHaveAttribute("aria-pressed", "true");
  await expect(day3).toHaveAttribute("aria-pressed", "false");
  await expectHealthyPage(page, "en");
});

test("KVK-05 the feedback page says so when there is no form", async ({ page }) => {
  await page.goto(at("en", "/kvk/feedback"));
  await expect(page.getByText(t("retro.none"))).toBeVisible();
});

test("KVK-10 the battlefield map is a narrow, centred table whose cells centre, and never wider than the screen", async ({ page }) => {
  await page.goto(at("en", "/kvk"));
  await unlock(page, SEED_PASSWORDS.plan);
  // A table with centred header cells (`|:-:|` in the editor) is drawn as a diagram.
  const map = page.locator('[data-tour="kvk-header"] table:has(th[align="center"])').first();
  await expect(map).toBeVisible();
  const wrap = map.locator("xpath=..");
  const boxes = async () => {
    const [table, outer] = await Promise.all([map.boundingBox(), wrap.boundingBox()]);
    if (!table || !outer) throw new Error("the map is not drawn");
    return { table, outer, left: table.x - outer.x, right: outer.x + outer.width - (table.x + table.width) };
  };
  const normal = await boxes();
  expect(normal.table.width, "the map stays inside the text column").toBeLessThanOrEqual(normal.outer.width + 1);
  expect(Math.abs(normal.left - normal.right), "the map sits in the middle").toBeLessThan(2);
  // On a wide screen the map is narrower than the text, with space on both sides; on a phone it takes the width.
  if (normal.outer.width > 640) expect(normal.left).toBeGreaterThan(20);
  await expect(map.locator("td").first()).toHaveCSS("vertical-align", "middle");
  // The header row centres like the body: its middle cell (the shared turrets' symbol) sits over the middle column.
  await expect(map.locator("th").nth(2)).toHaveCSS("text-align", "center");
  await expectHealthyPage(page, "en");
  // At the largest text size the five columns can outgrow a phone: the map then scrolls inside its wrapper and the page stays put.
  await page.evaluate(() => localStorage.setItem("kd1241_text_scale", "xl"));
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-text-scale", "xl");
  await expect(map).toBeVisible();
  const large = await boxes();
  expect(large.table.width).toBeLessThanOrEqual(await wrap.evaluate((el) => el.scrollWidth + 1));
  await expectHealthyPage(page, "en");
});
