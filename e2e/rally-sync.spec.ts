// Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
import type { Locator, Page } from "@playwright/test";
import { DEFAULT_SETTINGS, ROOM_CODE_ALPHABET } from "@/lib/rally-sync/room";
import { at, expectHealthyPage, hydrated, t, tPattern } from "./support/site";
import { expect, test } from "./support/test";
import { walkTour } from "./support/tour";

/**
 * Rally Sync on the test server's in-memory rooms (memory-store.ts): a code
 * E2R/E2G/E2C plus three characters opens a fresh rally, garrison or
 * counter-rally room with three placeholder leaders or enemies, so tests
 * running side by side never share a hit time.
 */
const DEMO = { password: "review123", coordinatorToken: "local-review-coordinator" };
const RALLY_TIMER = DEFAULT_SETTINGS.rallyWaitSeconds;
const BUFFER = DEFAULT_SETTINGS.bufferSeconds;
const DAY = 24 * 60 * 60;

let roomsOpened = 0;

/** A room code no other test of the run uses: the worker's number (unique per run) and this worker's count. */
function freshRoom(mode: "R" | "G" | "C"): string {
  const digit = (n: number) => ROOM_CODE_ALPHABET[n % ROOM_CODE_ALPHABET.length];
  const worker = test.info().workerIndex;
  return `E2${mode}${digit(Math.floor(worker / ROOM_CODE_ALPHABET.length))}${digit(worker)}${digit(roomsOpened++)}`;
}

/** Opens a room by its link and password, as its coordinator when asked. */
async function openRoom(page: Page, code: string, { coordinator = false } = {}) {
  await page.goto(at("en", `/tools/rally-sync/${code}`) + (coordinator ? `#c=${DEMO.coordinatorToken}` : ""));
  const open = page.getByRole("button", { name: t("sync.join.submit") });
  await hydrated(open);
  await page.getByLabel(t("kvk.password")).fill(DEMO.password);
  await open.click();
  const status = page.locator('[data-tour="sync-status"]');
  await expect(status).toBeVisible();
  // Every tap in a room is a JS handler (no plain forms): wait until React has the page.
  await hydrated(status);
}

const CLOCK = /\b(\d{2}):(\d{2}):(\d{2})\b/;
const seconds = (clock: string) => {
  const [, h, m, s] = CLOCK.exec(clock) ?? [];
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};
const clockText = (total: number) => {
  const s = ((total % DAY) + DAY) % DAY;
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, "0")).join(":");
};
/** b − a on the clock face, across midnight. */
const after = (a: number, b: number) => (((b - a) % DAY) + DAY) % DAY;
const march = (text: string) => text.split(":").reduce((total, part) => total * 60 + Number(part), 0);

/** The hit time the focus block shows ("All rallies land at"). */
async function hitTime(page: Page): Promise<number> {
  const focus = page.locator('[data-tour="sync-focus"]');
  await expect(focus).toContainText(t("sync.hit.title"), { ignoreCase: true });
  return seconds((await focus.innerText()).match(CLOCK)?.[0] ?? "");
}

/** The page's own clock, as the focus block shows it ("now HH:MM:SS"). */
async function pageClock(page: Page): Promise<number> {
  const text = await page.locator('[data-tour="sync-focus"]').innerText();
  const prefix = t("sync.hero.now").split("{time}")[0];
  const at = text.indexOf(prefix);
  return at === -1 ? -1 : seconds(text.slice(at + prefix.length));
}

/** The leaders' rows as shown: start time, name and march, top to bottom. */
async function leaderRows(list: Locator) {
  const text = await list.innerText();
  const row = new RegExp(`(\\d{2}:\\d{2}:\\d{2})\\n(?:[^\\n]*\\n)?([^\\n]+)\\n${t("sync.march")} (\\d+:\\d{2})`, "g");
  return [...text.matchAll(row)].map(([, start, name, marchText]) => ({ start: seconds(start), name, march: march(marchText) }));
}

test("RS-01 a room opens with its ID and password, and a wrong password is refused", async ({ page }) => {
  const code = freshRoom("R");
  await page.goto(at("en", "/tools/rally-sync"));
  await hydrated(page.getByRole("button", { name: t("sync.join.submit") }));
  await page.getByLabel(t("sync.roomId")).fill(code);
  await page.getByLabel(t("kvk.password")).fill("wrong-password");
  await page.getByRole("button", { name: t("sync.join.submit") }).click();
  await expect(page.getByText(t("sync.error.wrong"))).toBeVisible();
  await expect(page.getByLabel(t("sync.roomId"))).toHaveValue(code);
  await page.getByLabel(t("kvk.password")).fill(DEMO.password);
  await page.getByRole("button", { name: t("sync.join.submit") }).click();
  await expect(page).toHaveURL(at("en", `/tools/rally-sync/${code}`));
  await expect(page.locator('[data-tour="sync-status"]')).toBeVisible();
  await expect(page.getByText(t("sync.hit.none"))).toBeVisible();
  await expectHealthyPage(page, "en");
});

test("RS-02 Re-sync sets the earliest hit and every leader's start = hit − rally timer − march", async ({ page }) => {
  await openRoom(page, freshRoom("R"), { coordinator: true });
  await page.getByRole("button", { name: t("sync.coord.resync") }).click();
  const hit = await hitTime(page);
  const rows = await leaderRows(page.locator('[data-tour="sync-leaders"]'));
  expect(rows.map((r) => r.name).sort()).toEqual(["Demo leader A", "Demo leader B", "Demo leader C"]);
  for (const row of rows) expect(clockText(row.start), `${row.name}'s start`).toBe(clockText(hit - RALLY_TIMER - row.march));
  // Earliest first, which is the longest march first.
  expect(rows.map((r) => r.march)).toEqual([...rows.map((r) => r.march)].sort((a, b) => b - a));
  // The earliest hit everyone can make: now + rally timer + longest march + buffer.
  const now = seconds((await page.locator('[data-tour="sync-focus"]').innerText()).match(new RegExp(`${t("sync.hero.now", "en", { time: "" }).trim()} (\\d{2}:\\d{2}:\\d{2})`))?.[1] ?? "");
  const longest = Math.max(...rows.map((r) => r.march));
  expect(after(now, hit)).toBeGreaterThanOrEqual(RALLY_TIMER + longest + BUFFER - 3);
  expect(after(now, hit)).toBeLessThanOrEqual(RALLY_TIMER + longest + BUFFER + 3);
});

test("RS-03 a leader who joins or is added mid-rally waits for the next one, then gets their own start on every device", async ({ page, otherDevice }) => {
  test.slow(); // two devices and two polling rounds: three times the budget
  const code = freshRoom("R");
  await openRoom(page, code, { coordinator: true });
  await page.getByRole("button", { name: t("sync.coord.resync") }).click();
  const first = await hitTime(page);

  const leader = await otherDevice();
  await openRoom(leader, code);
  await leader.getByRole("button", { name: t("sync.join.toggle") }).click();
  await leader.getByLabel(t("sync.form.name")).fill("E2E Leader");
  await leader.getByLabel(t("sync.form.marchSeconds")).fill("50");
  await leader.getByRole("button", { name: t("sync.join.leaderSubmit") }).click();
  const me = leader.locator('[data-tour="sync-me"]');
  await expect(me).toContainText("E2E Leader");
  await expect(me).toContainText(t("sync.you"));
  // Nothing moves under the running rally: the new leader is in from the next one.
  await expect(me).toContainText(t("sync.row.nextRally"));
  await expect(leader.locator('[data-tour="sync-focus"]')).toContainText("--:--:--");

  // A leader the coordinator adds by hand (under More options) during the same rally is in from the next one as well.
  await page.locator('[data-tour="sync-more"]').click();
  const addPanel = page.locator("details", { hasText: t("sync.coord.addLeader") });
  await addPanel.locator("summary").click();
  await addPanel.getByLabel(t("sync.form.name")).fill("E2E Added");
  await addPanel.getByLabel(t("sync.form.marchSeconds")).fill("40");
  await addPanel.getByRole("button", { name: t("sync.coord.add"), exact: true }).click();
  const addedRow = page.locator('[data-tour="sync-leaders"] li', { hasText: "E2E Added" });
  await expect(addedRow).toContainText(t("sync.row.nextRally"));

  // The coordinator sets the next hit time by hand; the leader's page follows without a reload.
  const next = first + 120;
  await page.getByLabel(tPattern("sync.coord.hitAt")).fill(clockText(next));
  await page.getByRole("button", { name: t("sync.coord.set"), exact: true }).click();
  await expect(page.locator('[data-tour="sync-focus"]')).toContainText(clockText(next));
  const focus = leader.locator('[data-tour="sync-focus"]');
  await expect(focus).toContainText(t("sync.yourStart"), { ignoreCase: true, timeout: 15_000 });
  await expect(focus).toContainText(clockText(next - RALLY_TIMER - 50), { timeout: 15_000 });
  await expect(me).not.toContainText(t("sync.row.nextRally"));
  // And the coordinator sees both new leaders' starts in the list.
  await expect(page.locator('[data-tour="sync-leaders"]')).toContainText("E2E Leader", { timeout: 15_000 });
  await expect(addedRow).not.toContainText(t("sync.row.nextRally"));
  await expect(addedRow).toContainText(clockText(next - RALLY_TIMER - 40));
});

test("RS-04 Re-sync during a running rally needs a second tap", async ({ page }) => {
  await openRoom(page, freshRoom("R"), { coordinator: true });
  const resync = page.locator('[data-tour="sync-resync"]');
  await resync.click();
  const first = await hitTime(page);
  // Two seconds later on the page's own clock: the rally is running, and the Re-sync confirmed
  // below lands on a later hit than the first whatever the rounding.
  const clockAtFirst = await pageClock(page);
  await expect.poll(() => pageClock(page), { timeout: 10_000 }).toBeGreaterThanOrEqual(clockAtFirst + 2);
  await resync.click();
  // The first tap only arms it and says what it would do.
  await expect(resync).toContainText(t("sync.coord.resyncConfirm").split("(")[0].trim());
  expect(await hitTime(page)).toBe(first);
  await resync.click();
  await expect.poll(() => hitTime(page)).toBeGreaterThan(first);
  await expectHealthyPage(page, "en");
});

test("RS-05 garrison: a marked enemy rally lands after its countdown plus march, and players get send times", async ({ page, otherDevice }) => {
  const code = freshRoom("G");
  await openRoom(page, code, { coordinator: true });
  const enemy = (name: string) => page.locator('[data-tour="gar-enemies"] > li').filter({ hasText: name });
  for (const { name, chip } of [
    { name: "Demo enemy A", chip: "4:45" },
    { name: "Demo enemy B", chip: "4:30" },
  ]) {
    await enemy(name).getByRole("button", { name: t("sync.gar.rallyStarted") }).click();
    await enemy(name).getByRole("button", { name: chip, exact: true }).click();
    await expect(enemy(name)).toContainText(tPattern("sync.gar.launchesIn"));
  }
  // Lands = the moment of the tap + the countdown it showed + that enemy's march (42 s and 38 s).
  const nowText = await page.locator('[data-tour="sync-status"]').innerText();
  const now = seconds(nowText.match(CLOCK)?.[0] ?? "");
  const lands = async (name: string) => seconds((await enemy(name).innerText()).match(new RegExp(`${t("sync.gar.lands", "en", { time: "" }).trim()} (\\d{2}:\\d{2}:\\d{2})`))?.[1] ?? "");
  expect(after(now, await lands("Demo enemy A"))).toBeGreaterThanOrEqual(285 + 42 - 5);
  expect(after(now, await lands("Demo enemy A"))).toBeLessThanOrEqual(285 + 42 + 1);
  expect(after(now, await lands("Demo enemy B"))).toBeGreaterThanOrEqual(270 + 38 - 5);
  expect(after(now, await lands("Demo enemy B"))).toBeLessThanOrEqual(270 + 38 + 1);

  // A defender types their march and sees when to send, without a reload.
  const defender = await otherDevice();
  await openRoom(defender, code);
  await defender.getByLabel(t("sync.gar.march")).fill("20");
  await defender.getByRole("button", { name: t("sync.save"), exact: true }).click();
  await expect(defender.getByText(t("sync.gar.sendAt"), { exact: false }).first()).toBeVisible({ timeout: 15_000 });
  await expectHealthyPage(defender, "en");
});

test("RS-06 counter-rally: slowest march first, each cue = rally timer − (first march − own march)", async ({ page }) => {
  await openRoom(page, freshRoom("C"), { coordinator: true });
  const order = page.locator('[data-tour="counter-order"]');
  const text = await order.innerText();
  // Demo counters: B 0:52, A 0:45, C 0:40.
  expect(text.indexOf("Demo counter B")).toBeLessThan(text.indexOf("Demo counter A"));
  expect(text.indexOf("Demo counter A")).toBeLessThan(text.indexOf("Demo counter C"));
  const cue = (first: number, own: number) => `${Math.floor((RALLY_TIMER - (first - own)) / 60)}:${String((RALLY_TIMER - (first - own)) % 60).padStart(2, "0")}`;
  expect(text).toContain(`Demo counter B ${cue(52, 45)}`);
  expect(text).toContain(`Demo counter B ${cue(52, 40)}`);
  expect(text).toContain(`Demo counter A ${cue(45, 40)}`);
});

test("RS-07 every room type's guided tour reads to the end", async ({ page }) => {
  test.slow(); // three rooms, each toured to the end: a sweep, three times the budget
  for (const mode of ["R", "G", "C"] as const) {
    await test.step(mode, async () => {
      await openRoom(page, freshRoom(mode), { coordinator: true });
      expect(await walkTour(page)).toBeGreaterThan(1);
    });
  }
});

test("RS-11 the invite link opens the room without the password", async ({ page, otherDevice }) => {
  const code = freshRoom("R");
  await openRoom(page, code, { coordinator: true });
  await page.locator('[data-tour="sync-more"]').click();
  const invite = page.locator("details", { hasText: t("sync.invite.title") });
  await invite.locator("summary").click();
  // The panel first checks what this device saved (a server call), then shows the link, or offers to make it from the typed password.
  const show = invite.getByRole("button", { name: t("sync.invite.makeLink"), exact: true });
  const link = invite.locator("p.input", { hasText: "#k=" }).first();
  await expect(link.or(show).first()).toBeVisible({ timeout: 15_000 });
  if (await show.isVisible()) await show.click();
  await expect(link).toBeVisible();
  const url = (await link.innerText()).trim();

  const guest = await otherDevice();
  await guest.goto(url);
  await expect(guest.locator('[data-tour="sync-status"]')).toBeVisible();
  await expect(guest.getByLabel(t("kvk.password"))).toHaveCount(0);
  await expectHealthyPage(guest, "en");
});

test.describe("a removed browser", () => {
  // The removed browser's next check-in is answered 403 on purpose (that is how it learns): the browser notes the resource failure.
  test.use({ consoleAllow: [/status of 403/] });

  test("RS-12 the coordinator can log another browser out, and it needs the password again", async ({ page, otherDevice }) => {
  test.setTimeout(90_000);
  const code = freshRoom("R");
  await openRoom(page, code, { coordinator: true });
  const watcher = await otherDevice();
  await openRoom(watcher, code);

  await page.locator('[data-tour="sync-more"]').click();
  const inRoom = page.locator("details", { hasText: tPattern("sync.instances.title") });
  await inRoom.locator("summary").click();
  const remove = inRoom.getByRole("button", { name: t("sync.instances.remove"), exact: true }).first();
  await expect(remove).toBeVisible({ timeout: 15_000 });
  await remove.click();
  await inRoom.getByRole("button", { name: t("sync.instances.removeConfirm"), exact: true }).click();
  await expect(inRoom.getByText(t("sync.instances.removed"))).toBeVisible();
  // The removed browser learns it on its next check-in (polling, as the offline build has no Realtime) and asks for the password.
  await expect(watcher.getByLabel(t("kvk.password"))).toBeVisible({ timeout: 45_000 });
  await expectHealthyPage(watcher, "en");
  });
});

test("RS-13 garrison: the wave copies for the game chat, and Clear all needs two taps", async ({ page }) => {
  await openRoom(page, freshRoom("G"), { coordinator: true });
  const enemy = page.locator('[data-tour="gar-enemies"] > li').filter({ hasText: "Demo enemy A" });
  await enemy.getByRole("button", { name: t("sync.gar.rallyStarted") }).click();
  await enemy.getByRole("button", { name: "4:45", exact: true }).click();
  await expect(enemy).toContainText(tPattern("sync.gar.launchesIn"));

  // Copied, or shown to copy by hand where the browser keeps the clipboard away from the page.
  await page.getByRole("button", { name: t("sync.copyChat"), exact: true }).first().click();
  await expect(page.getByText(t("common.copied")).or(page.getByText(t("sync.copyByHand"))).first()).toBeVisible();

  await page.getByRole("button", { name: t("sync.gar.clear"), exact: true }).click();
  const confirm = page.getByRole("button", { name: t("sync.gar.clearConfirm"), exact: true });
  await expect(confirm).toBeVisible();
  await expect(enemy).toContainText(tPattern("sync.gar.launchesIn")); // one tap changes nothing
  await confirm.click();
  await expect(enemy.getByRole("button", { name: t("sync.gar.rallyStarted") })).toBeVisible();
  await expectHealthyPage(page, "en");
});

test("RS-14 the screen-awake switch asks the browser for a wake lock, and hides where the browser has none", async ({ page, otherDevice }) => {
  await page.addInitScript(() => {
    const calls: string[] = [];
    (window as unknown as { __wakeCalls: string[] }).__wakeCalls = calls;
    Object.defineProperty(navigator, "wakeLock", {
      configurable: true,
      value: {
        request: async (type: string) => {
          calls.push(type);
          return { released: false, release: async () => undefined, addEventListener: () => undefined };
        },
      },
    });
  });
  const code = freshRoom("R");
  await openRoom(page, code);
  const wake = page.locator('[data-tour="sync-wake"]');
  await expect(wake).toBeVisible();
  if ((await wake.getAttribute("aria-label")) === t("sync.wake.off")) await wake.click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __wakeCalls: string[] }).__wakeCalls.length)).toBeGreaterThan(0);

  const plain = await otherDevice();
  await plain.addInitScript(() => {
    delete (Navigator.prototype as unknown as Record<string, unknown>).wakeLock;
  });
  await openRoom(plain, code);
  await expect(plain.locator('[data-tour="sync-wake"]')).toHaveCount(0);
  await expectHealthyPage(plain, "en");
});
