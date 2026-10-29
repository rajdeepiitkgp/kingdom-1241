import type { Request } from "@playwright/test";
import { at, expectHealthyPage, t } from "../support/site";
import { expect, test } from "../support/test";

/**
 * The daily look at the live site (the E2E live workflow, `E2E_BASE_URL`):
 * what a visitor sees, read-only. It never types a password, opens a room or
 * sends a form, so it changes nothing and trips no alarm. A link prefetch is
 * answered here with an empty reply: otherwise every link in view would make
 * Vercel rebuild that page in that language once a day (ISR writes) for
 * nobody. The words are the bundled English ones, which the live site may
 * have reworded since, so these checks lean on structure.
 */
const isPrefetch = (request: Request) => {
  const headers = request.headers();
  return "next-router-prefetch" in headers || "next-router-segment-prefetch" in headers;
};

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) => (isPrefetch(route.request()) ? route.fulfill({ status: 204, body: "" }) : route.continue()));
});

test("LIVE-01 Home opens in every language the site offers", async ({ page }) => {
  await page.goto(at("en", "/"));
  const locales = await page.locator('[data-tour="site-language"] select option').evaluateAll((options) => options.map((o) => (o as HTMLOptionElement).value));
  expect(locales).toContain("en");
  for (const locale of locales) {
    await test.step(locale, async () => {
      const response = await page.goto(at(locale, "/"));
      expect(response?.status()).toBe(200);
      await expectHealthyPage(page, locale);
    });
  }
});

test("LIVE-02 the main pages open", async ({ page }) => {
  for (const path of ["/events", "/rules", "/guides", "/transfers", "/tools", "/tools/rally-sync", "/kvk", "/kvk/prep"]) {
    await test.step(path, async () => {
      const response = await page.goto(at("en", path));
      expect(response?.status()).toBe(200);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectHealthyPage(page, "en");
    });
  }
});

test("LIVE-03 Home shows the alliances from the database, each with its page", async ({ page }) => {
  await page.goto(at("en", "/"));
  const alliances = page.locator(`main a[href^="${at("en", "/alliances/")}"]`);
  await expect(alliances.first()).toBeVisible();
  const href = await alliances.first().getAttribute("href");
  const response = await page.goto(href!);
  expect(response?.status()).toBe(200);
  await expectHealthyPage(page, "en");
});

test.describe("addresses", () => {
  test.use({ consoleAllow: [/status of 404/] });

  test("LIVE-04 an unknown address shows the not-found page", async ({ page }) => {
    const response = await page.goto(at("en", "/no-such-page"));
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: t("notFound.home") })).toBeVisible();
  });
});
