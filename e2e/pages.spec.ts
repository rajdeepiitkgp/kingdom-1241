import { at, expectHealthyPage, LOCALES, PUBLIC_PAGES, t } from "./support/site";
import { expect, test } from "./support/test";

test.describe("every page in every language", () => {
  for (const locale of LOCALES) {
    test(`SITE-01 every public page opens in ${locale}`, async ({ page }) => {
      test.slow(); // every public page in one language: a sweep, three times the budget (the macOS runner takes three to five times longer than Linux for the same pages)
      for (const { path } of PUBLIC_PAGES) {
        await test.step(path, async () => {
          const response = await page.goto(at(locale, path));
          expect(response?.status(), `${at(locale, path)} answers`).toBe(200);
          await expect(page.getByRole("heading").first()).toBeVisible();
          await expectHealthyPage(page, locale);
        });
      }
    });
  }
});

test.describe("addresses", () => {
  test.use({ consoleAllow: [/status of 404/] });

  test("SITE-02 an unknown address shows the not-found page in the visitor's language", async ({ page }) => {
    for (const locale of ["en", "ar"]) {
      const response = await page.goto(at(locale, "/no-such-page"));
      expect(response?.status()).toBe(404);
      await expect(page.getByRole("heading", { level: 1, name: t("notFound.title", locale) })).toBeVisible();
      await expect(page.getByRole("link", { name: t("notFound.home", locale) })).toHaveAttribute("href", at(locale, "/"));
      await expect(page.getByRole("navigation", { name: "Main" }).filter({ visible: true })).toBeVisible();
      await expectHealthyPage(page, locale);
    }
  });
});

test("SITE-03 an address without a language opens the page in a language", async ({ page }) => {
  await page.goto("/kvk/prep");
  await expect(page).toHaveURL(/\/en\/kvk\/prep$/);
  await expect(page.getByRole("heading", { level: 1, name: t("prep.title") })).toBeVisible();
});

test("SITE-08 search engines are asked to stay away", async ({ page, request }) => {
  await page.goto(at("en", "/"));
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const robots = await request.get("/robots.txt");
  expect(await robots.text()).toMatch(/^Disallow: \/$/m);
});

test("SITE-10 the admin area asks to sign in when nobody is signed in", async ({ page }) => {
  await page.goto(at("en", "/admin"));
  await expect(page).toHaveURL(/\/en\/admin\/login/);
  await expect(page.getByRole("heading", { level: 1, name: "Admin area" })).toBeVisible();
  await expectHealthyPage(page, "en");
});
