// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import { at, hydrated, SEED_ALLIANCE, SEED_PASSWORDS, t, unlock } from "./support/site";
import { expect, test } from "./support/test";
import { tourButton, walkTour } from "./support/tour";

test("TOUR-01 every public guide reads from the first step to Done", async ({ page }) => {
  test.slow(); // every public tour to its end: a sweep, three times the budget
  const pages = ["/", `/alliances/${encodeURIComponent(SEED_ALLIANCE)}`, "/kvk/prep", "/kvk/feedback"];
  for (const path of pages) {
    await test.step(path, async () => {
      await page.goto(at("en", path));
      expect(await walkTour(page)).toBeGreaterThanOrEqual(1);
    });
  }
});

test("TOUR-01 the locked battle pages explain more once they are open", async ({ page }) => {
  test.slow(); // three locked pages, each unlocked and toured: a sweep, three times the budget
  const areas = [
    { path: "/kvk", password: SEED_PASSWORDS.plan },
    { path: "/kvk/leaders", password: SEED_PASSWORDS.leaders },
    { path: "/kvk/checklist", password: SEED_PASSWORDS.checklist },
  ];
  for (const { path, password } of areas) {
    await test.step(path, async () => {
      await page.goto(at("en", path));
      // The password card streams in after the header's "?": opened before it, the tour would have no step for it,
      // and the card's field (autofocus) would take the focus the closing tour hands back to the "?".
      await expect(page.locator('[data-tour="kvk-unlock"]')).toBeVisible();
      const locked = await walkTour(page);
      await unlock(page, password);
      await expect(page.getByRole("button", { name: t("kvk.lock") })).toBeVisible();
      // Steps about the plan's parts are left out while it is locked and come back with it.
      expect(await walkTour(page)).toBeGreaterThan(locked);
    });
  }
});

test("TOUR-02 Escape closes the tour and the page stays", async ({ page }) => {
  await page.goto(at("en", "/kvk/prep"));
  await hydrated(tourButton(page));
  await tourButton(page).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: t("prep.title") })).toBeVisible();
});

test("TOUR-03 'New here?' shows until the tour is opened or hidden on this device", async ({ page }) => {
  await page.goto(at("en", "/"));
  const nudge = page.getByText(t("tour.new"), { exact: true });
  await expect(nudge).toBeVisible();
  await page.getByRole("button", { name: t("tour.hide"), exact: true }).click();
  await expect(nudge).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(nudge).toBeHidden();
  // Another page's tour is still new.
  await page.goto(at("en", "/kvk/prep"));
  await expect(nudge).toBeVisible();
  await page.getByRole("button", { name: t("tour.start"), exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(nudge).toBeHidden();
});

test("TOUR-04 tours read right to left in Arabic, also after switching language", async ({ page }) => {
  test.slow(); // two tours and a language switch: three times the budget
  await page.goto(at("en", "/"));
  await hydrated(page.getByRole("combobox", { name: t("lang.label") }));
  // Switching keeps the English page hidden in the document; the tour must use the Arabic one.
  await page.getByRole("combobox", { name: t("lang.label") }).selectOption("ar");
  await expect(page).toHaveURL(at("ar", "/"));
  await tourButton(page, "ar").click();
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  expect(await card.evaluate((element) => getComputedStyle(element).direction)).toBe("rtl");
  await page.keyboard.press("Escape");
  expect(await walkTour(page, "ar")).toBeGreaterThan(1);
});

test("TOUR-06 the read-aloud speaker shows only where the browser has a voice for the page's language", async ({ page, otherDevice }) => {
  // No speech at all: the speaker stays away and the tour still opens.
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: undefined });
  });
  await page.goto(at("en", "/"));
  await hydrated(tourButton(page));
  await tourButton(page).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: t("tour.voice") })).toHaveCount(0);

  // A voice for the page's language: the speaker shows.
  const voiced = await otherDevice();
  await voiced.addInitScript(() => {
    const voice = { voiceURI: "fake-en", name: "Fake English", lang: "en-US", localService: true, default: true };
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { getVoices: () => [voice], addEventListener: () => undefined, removeEventListener: () => undefined, speak: () => undefined, cancel: () => undefined, pause: () => undefined, resume: () => undefined, speaking: false, pending: false, paused: false },
    });
  });
  await voiced.goto(at("en", "/"));
  await hydrated(tourButton(voiced));
  await tourButton(voiced).click();
  await expect(voiced.getByRole("dialog").getByRole("button", { name: t("tour.voice") })).toBeVisible();
});
