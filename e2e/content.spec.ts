import { SEED_ALLIANCES } from "@/content/seed/alliances";
import { SEED_EVENTS } from "@/content/seed/events";
import { SEED_RULE_TOPICS } from "@/content/seed/rules";
import { at, expectHealthyPage, hydrated, t } from "./support/site";
import { expect, test } from "./support/test";

test("HOME-01 Home lists the alliances and each opens its own page", async ({ page }) => {
  await page.goto(at("en", "/"));
  for (const alliance of SEED_ALLIANCES) await expect(page.getByRole("link", { name: alliance.name }).first()).toBeVisible();
  const first = SEED_ALLIANCES[0];
  await page.getByRole("link", { name: first.name }).first().click();
  await expect(page).toHaveURL(at("en", `/alliances/${encodeURIComponent(first.tag)}`));
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`[${first.tag}]`);
  await expectHealthyPage(page, "en");
});

test("HOME-02 while transfers are closed there is no badge and the page says so", async ({ page }) => {
  await page.goto(at("en", "/"));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(t("home.transfersOpen"))).toHaveCount(0);
  await page.goto(at("en", "/transfers"));
  await expect(page.getByText(t("transfers.statusClosed"))).toBeVisible();
  // Whom to ask is shown whether transfers are open or not.
  await expect(page.getByRole("heading", { name: t("transfers.contactTitle") })).toBeVisible();
});

test("CONT-01 an event's guide link opens that guide", async ({ page }) => {
  await page.goto(at("en", "/events"));
  for (const event of SEED_EVENTS) await expect(page.getByText(event.name, { exact: true }).first()).toBeVisible();
  const withGuide = SEED_EVENTS.find((event) => event.guideSlug)!;
  await page.locator(`a[href="${at("en", `/guides/${withGuide.guideSlug}`)}"]`).first().click();
  await expect(page).toHaveURL(at("en", `/guides/${withGuide.guideSlug}`));
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectHealthyPage(page, "en");
});

test("CONT-02 rules open one topic at a time, and a #topic address opens that topic", async ({ page }) => {
  const [first, second] = SEED_RULE_TOPICS;
  await page.goto(at("en", "/rules"));
  const tab = (title: string) => page.getByRole("tab", { name: title });
  await expect(tab(first.title)).toHaveAttribute("aria-selected", "true");
  await hydrated(tab(second.title));
  await tab(second.title).click();
  await expect(tab(second.title)).toHaveAttribute("aria-selected", "true");
  await expect(page).toHaveURL(new RegExp(`#${second.slug}$`));
  await expect(page.getByRole("tabpanel")).toContainText(second.rules[0].title);
  // A shared link lands on its topic.
  await page.goto(at("en", `/rules#${second.slug}`));
  await page.reload();
  await expect(tab(second.title)).toHaveAttribute("aria-selected", "true");
});

test("CONT-03 the guides list opens each guide", async ({ page }) => {
  await page.goto(at("en", "/guides"));
  const links = page.locator(`main a[href^="${at("en", "/guides/")}"]`);
  const hrefs = [...new Set(await links.evaluateAll((anchors) => anchors.map((a) => a.getAttribute("href"))))];
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) {
    await test.step(href!, async () => {
      const response = await page.goto(href!);
      expect(response?.status()).toBe(200);
      await expectHealthyPage(page, "en");
    });
  }
});
