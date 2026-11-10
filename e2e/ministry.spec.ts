// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Page } from "@playwright/test";
import { at, expectHealthyPage, hydrated, SEED_PASSWORDS, t, unlock } from "./support/site";
import { expect, test } from "./support/test";

/**
 * The ministry sign-ups (/kvk/ministry). The test server keeps them in its own
 * memory (MINISTRY_STORE=memory): the round after the current one is open, its
 * deadlines weeks ahead on any date, and the buff days follow the template
 * (construction Day 1, research Day 2, training Day 4).
 */

/** A Governor ID no other test uses (tests run side by side on one server). */
const governorId = () => String(60_000_000 + Math.floor(Math.random() * 30_000_000));

async function open(page: Page) {
  await page.goto(at("en", "/kvk/ministry"));
  await unlock(page, SEED_PASSWORDS.plan);
  await expect(page.locator('[data-tour="ministry-round"]')).toBeVisible();
}

const dayCard = (page: Page, index: number) => page.locator('[data-tour="ministry-day"]').nth(index);
const slotButtons = (page: Page, index: number) => dayCard(page, index).locator('[data-tour="ministry-slots"] button[aria-pressed]').filter({ hasText: /\d\d:\d\d/ });

/** Fills the account and the construction day (the first card) and sends the form. */
async function signUp(page: Page, id: string, name: string) {
  const idField = page.getByLabel(t("retro.governorId"));
  await hydrated(idField);
  await idField.fill(id);
  await page.getByLabel(t("retro.name")).fill(name);
  await page.getByLabel(t("retro.alliance")).selectOption({ index: 1 });
  await dayCard(page, 0).getByRole("switch").click();
  await dayCard(page, 0).getByLabel(t("prep.item.truegold"), { exact: true }).fill("1200");
  await slotButtons(page, 0).nth(2).click();
  await slotButtons(page, 0).nth(5).click();
  await page.getByRole("button", { name: t("ministry.submit"), exact: true }).click();
}

test("MIN-01 a player signs up for a buff day behind the battle plan's password, and the device keeps the sign-up", async ({ page }) => {
  await page.goto(at("en", "/kvk/ministry"));
  // Locked: the password card and nothing of the round.
  await expect(page.getByLabel(t("kvk.password"))).toBeVisible();
  await expect(page.locator('[data-tour="ministry-round"]')).toHaveCount(0);
  await unlock(page, SEED_PASSWORDS.plan);
  // The round's three buff days, each with its own card.
  const round = page.locator('[data-tour="ministry-round"]');
  for (const buff of ["construction", "research", "training"] as const) await expect(round).toContainText(t(`prep.council.${buff}`));
  await expect(page.locator('[data-tour="ministry-day"]')).toHaveCount(3);

  const id = governorId();
  await signUp(page, id, "Mina the Tester");
  const mine = page.locator('[data-tour="ministry-mine"]');
  await expect(mine).toContainText("Mina the Tester");
  await expect(mine).toContainText(id);
  // Two two-hour blocks, shown as their UTC times.
  await expect(mine).toContainText("04:00–06:00, 10:00–12:00 UTC");
  await expect(mine.getByRole("status")).toBeVisible();
  await expectHealthyPage(page, "en");
  // The device remembers its sign-up; the form makes way for it.
  await page.reload();
  await expect(page.locator('[data-tour="ministry-mine"]')).toContainText("Mina the Tester");
  await expect(page.getByRole("button", { name: t("ministry.submit"), exact: true })).toHaveCount(0);
});

test("MIN-02 a day needs an amount and a time, and the message sits on that day", async ({ page }) => {
  await open(page);
  const idField = page.getByLabel(t("retro.governorId"));
  await hydrated(idField);
  await idField.fill(governorId());
  await page.getByLabel(t("retro.name")).fill("Nobody yet");
  await page.getByLabel(t("retro.alliance")).selectOption({ index: 1 });
  const send = page.getByRole("button", { name: t("ministry.submit"), exact: true });
  // No day at all.
  await send.click();
  await expect(page.getByText(t("ministry.error.sections"))).toBeVisible();
  // A day with neither an amount nor a time.
  await dayCard(page, 2).getByRole("switch").click();
  await send.click();
  await expect(dayCard(page, 2).getByText(t("ministry.error.noSlots"))).toBeVisible();
  await slotButtons(page, 2).first().click();
  await send.click();
  await expect(dayCard(page, 2).getByText(t("ministry.error.noAmount"))).toBeVisible();
  await expect(page.locator('[data-tour="ministry-mine"]')).toHaveCount(0);
  await expectHealthyPage(page, "en");
});

test("MIN-03 the device that signed up changes and withdraws its entry; another device can't take the Governor ID", async ({ page, otherDevice }) => {
  await open(page);
  const id = governorId();
  await signUp(page, id, "Owner of the entry");
  const mine = page.locator('[data-tour="ministry-mine"]');
  await expect(mine).toContainText("Owner of the entry");

  // Another browser with the password can't sign the same Governor ID up again.
  const other = await otherDevice();
  await open(other);
  await signUp(other, id, "Someone else");
  await expect(other.getByText(t("ministry.error.taken"))).toBeVisible();
  await expect(other.locator('[data-tour="ministry-mine"]')).toHaveCount(0);

  // Change: the form opens with what was saved; one more block is added.
  await mine.getByRole("button", { name: t("ministry.mine.edit") }).click();
  await expect(dayCard(page, 0).getByLabel(t("prep.item.truegold"), { exact: true })).toHaveValue("1200");
  await expect(slotButtons(page, 0).nth(2)).toHaveAttribute("aria-pressed", "true");
  await slotButtons(page, 0).nth(11).click();
  await page.getByRole("button", { name: t("ministry.save") }).click();
  await expect(mine).toContainText("04:00–06:00, 10:00–12:00, 22:00–24:00 UTC");

  // Withdraw takes two taps.
  const withdraw = mine.getByRole("button", { name: t("ministry.mine.withdraw"), exact: true });
  await withdraw.click();
  await mine.getByRole("button", { name: t("ministry.mine.withdraw.confirm") }).click();
  await expect(page.locator('[data-tour="ministry-mine"]')).toHaveCount(0);
  await expect(page.getByRole("button", { name: t("ministry.submit"), exact: true })).toBeVisible();
});
