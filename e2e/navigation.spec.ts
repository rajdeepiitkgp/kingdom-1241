import type { Page } from "@playwright/test";
import { at, expectHealthyPage, expectNoSidewaysScroll, hydrated, PUBLIC_PAGES, t, tStart } from "./support/site";
import { expect, test } from "./support/test";

/** The menu of this screen: the header's on a laptop, the bottom bar on a phone (both are named "Main"). */
const mainMenu = (page: Page) => page.getByRole("navigation", { name: "Main" }).filter({ visible: true });

test("SITE-04 the menu reaches every section", async ({ page }) => {
  await page.goto(at("en", "/"));
  const sections = [
    { key: "nav.events", path: "/events" },
    { key: "nav.rules", path: "/rules" },
    { key: "nav.guides", path: "/guides" },
    { key: "nav.tools", path: "/tools" },
    { key: "nav.transfers", path: "/transfers" },
  ] as const;
  for (const { key, path } of sections) {
    await mainMenu(page).getByRole("link", { name: t(key) }).click();
    await expect(page).toHaveURL(at("en", path));
    await expect(mainMenu(page).getByRole("link", { name: t(key) })).toHaveAttribute("aria-current", "page");
  }
  // KvK is a dropdown of its pages.
  const kvkPages = [
    { key: "kvk.menu.prep", path: "/kvk/prep" },
    { key: "kvk.menu.leaders", path: "/kvk/leaders" },
    { key: "kvk.menu.checklist", path: "/kvk/checklist" },
    { key: "kvk.menu.rallySync", path: "/tools/rally-sync" },
  ] as const;
  for (const { key, path } of kvkPages) {
    await mainMenu(page).getByRole("button", { name: t("nav.kvk") }).click();
    await mainMenu(page).getByRole("link", { name: tStart(key) }).click();
    await expect(page).toHaveURL(at("en", path));
  }
  // The logo leads home from anywhere.
  await page.getByRole("banner").getByRole("link").first().click();
  await expect(page).toHaveURL(at("en", "/"));
});

test("SITE-05 the language switcher opens the same page in another language", async ({ page }) => {
  await page.goto(at("en", "/kvk/prep"));
  await hydrated(page.getByRole("combobox", { name: t("lang.label") }));
  await page.getByRole("combobox", { name: t("lang.label") }).selectOption("de");
  await expect(page).toHaveURL(at("de", "/kvk/prep"));
  await expect(page.getByRole("heading", { level: 1, name: t("prep.title", "de") })).toBeVisible();
  await page.getByRole("combobox", { name: t("lang.label", "de") }).selectOption("ar");
  await expect(page).toHaveURL(at("ar", "/kvk/prep"));
  await expectHealthyPage(page, "ar");
  // The choice is remembered: an address without a language opens in Arabic.
  await page.goto("/tools");
  await expect(page).toHaveURL(at("ar", "/tools"));
});

test("SITE-06 dark mode stays on across pages and a language switch", async ({ page }) => {
  await page.goto(at("en", "/"));
  const isDark = async () => ((await page.locator("html").getAttribute("class")) ?? "").split(/\s+/).includes("dark");
  const wanted = !(await isDark());
  const toggle = page.getByRole("button", { name: t("theme.toggle") });
  await hydrated(toggle);
  await toggle.click();
  await expect.poll(isDark).toBe(wanted);
  await mainMenu(page).getByRole("link", { name: t("nav.rules") }).click();
  await expect(page).toHaveURL(at("en", "/rules"));
  expect(await isDark()).toBe(wanted);
  await page.getByRole("combobox", { name: t("lang.label") }).selectOption("ko");
  await expect(page).toHaveURL(at("ko", "/rules"));
  await expect.poll(isDark).toBe(wanted);
  await page.reload();
  expect(await isDark()).toBe(wanted);
});

test("SITE-07 the largest text size is kept across pages and every page still fits", async ({ page }) => {
  await page.goto(at("de", "/"));
  const larger = page.getByRole("button", { name: t("textSize.larger", "de") });
  await hydrated(larger);
  await larger.click();
  await larger.click();
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-text-scale", "xl");
  // German has the longest words; at 125 % nothing may stick out sideways on any page.
  for (const { path } of PUBLIC_PAGES) {
    await test.step(path, async () => {
      await page.goto(at("de", path));
      await expect(html).toHaveAttribute("data-text-scale", "xl");
      await expectNoSidewaysScroll(page);
    });
  }
});
