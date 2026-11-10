// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Page } from "@playwright/test";
import { at, expectHealthyPage, hydrated, SEED_PASSWORDS, t, unlock } from "./support/site";
import { expect, test } from "./support/test";

/**
 * The ministry sign-ups (/kvk/ministry). The test server keeps them in its own
 * memory (MINISTRY_STORE=memory): the round after the current one is open and
 * the buff days follow the template (construction Day 1, research Day 2,
 * training Day 4). Construction and research take sign-ups (deadlines weeks
 * ahead on any date); the training day is past its deadline, so its six demo
 * players have their appointments and the roster shows.
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
  // A tile per buff day taken, with the day and, until its sign-ups close, where the appointment will show.
  await expect(mine).toContainText(t("ministry.mine.times"));
  await expect(mine).toContainText(t("ministry.mine.pending"));
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
  await dayCard(page, 1).getByRole("switch").click();
  await send.click();
  await expect(dayCard(page, 1).getByText(t("ministry.error.noSlots"))).toBeVisible();
  await slotButtons(page, 1).first().click();
  await send.click();
  await expect(dayCard(page, 1).getByText(t("ministry.error.noAmount"))).toBeVisible();
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

test("MIN-06 after a day's deadline its roster shows: every player in a time they picked, free times marked, found by name or Governor ID", async ({ page }) => {
  await open(page);
  const roster = page.locator('[data-tour="ministry-roster"]');
  await expect(roster).toContainText(t("prep.council.training"));
  // Six demo players, 48 half-hours.
  await expect(roster).toContainText(t("ministry.roster.filled").replace("{filled}", "6").replace("{total}", "48"));
  // A table from 00:00 to 24:00 UTC: every half-hour with its start and end, its player or "Free".
  const rows = roster.locator("tbody tr");
  await expect(rows).toHaveCount(48);
  await expect(rows.first()).toContainText("00:00–00:30");
  await expect(rows.last()).toContainText("23:30–24:00");
  await expect(rows.filter({ hasText: t("ministry.roster.free") })).toHaveCount(42);
  await expect(roster.getByText(t("ministry.roster.freeNote"))).toBeVisible();
  // The visitor's own time has a column of its own, named.
  await expect(roster.getByRole("columnheader", { name: t("ministry.roster.col.utc") })).toBeVisible();
  await expect(roster.getByRole("columnheader", { name: t("ministry.roster.col.local") })).toBeVisible();
  // The highest score has the first of her own times (12:00–20:00 UTC).
  await expect(rows.filter({ hasText: "Aurelia" })).toContainText("12:00–12:30");
  // Everyone sits inside the times they picked: Eun-ji picked 04:00–10:00.
  const eunji = await rows.filter({ hasText: "Eun-ji" }).innerText();
  expect(Number(eunji.slice(0, 2))).toBeGreaterThanOrEqual(4);
  expect(Number(eunji.slice(0, 2))).toBeLessThan(10);

  // By name: only the match stays.
  const find = roster.getByLabel(t("ministry.roster.find"));
  await hydrated(find);
  await find.fill("bor");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("[NAM] Borin");
  // By Governor ID (the roster itself carries none): looked up on the server.
  await find.fill("40000006");
  await find.press("Enter");
  await expect(rows).toHaveCount(1);
  await expect(rows).toContainText("Farid");
  await find.fill("nobody-of-that-name");
  await expect(roster.getByText(t("ministry.roster.find.none"))).toBeVisible();
  // The free times alone.
  await find.fill("");
  await roster.getByRole("button", { name: t("ministry.roster.onlyFree") }).click();
  await expect(rows).toHaveCount(42);
  await expectHealthyPage(page, "en");
});
