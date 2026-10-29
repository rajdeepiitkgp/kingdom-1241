import { expect, type Locator, type Page } from "@playwright/test";
import { SEED_LANGUAGES } from "@/content/seed/languages";
import { withReviewed } from "@/content/seed/ui-reviewed";
import { UI_STRINGS, type UiKey } from "@/content/seed/ui-strings";
import { format } from "@/lib/i18n/dictionary";
import { pick } from "@/lib/i18n/localized";

export { PUBLIC_PAGES, SEED_ALLIANCE, SEED_GUIDE } from "./pages";

/**
 * What the browser tests know about the site. The test server runs on the
 * bundled seed content (playwright.config.ts), so the words and the examples
 * come from the same files the pages are built from: a reworded label never
 * breaks a test.
 */

/** Every language the seed shows, in menu order. */
export const LOCALES = SEED_LANGUAGES.filter((l) => l.enabled).map((l) => l.code);

/** The interface text of a key in a language, as the page shows it without a database. */
export function t(key: UiKey, locale = "en", vars?: Record<string, string | number>): string {
  const text = pick(withReviewed(key, UI_STRINGS[key]), locale);
  return vars ? format(text, vars) : text;
}

/** A pattern for a key's text with its `{placeholders}` matching anything. */
export function tPattern(key: UiKey, locale = "en"): RegExp {
  const parts = t(key, locale).split(/\{\w+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(parts.join(".+"));
}

/** A pattern for text that starts with a key's words (a menu entry whose name runs on into its hint). */
export function tStart(key: UiKey, locale = "en"): RegExp {
  return new RegExp(`^${t(key, locale).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`);
}

/** A path in a language: `at("de", "/kvk")` → `/de/kvk`. */
export function at(locale: string, path: string): string {
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** The seed passwords of the locked battle pages (src/content/seed/kvk.ts). */
export const SEED_PASSWORDS = { plan: "1241", leaders: "1241-leaders", checklist: "1241-commander" } as const;

/**
 * What every page must be: in its language and direction, not the error page,
 * and nothing wider than the screen (a phone must never scroll sideways).
 */
export async function expectHealthyPage(page: Page, locale: string) {
  const html = page.locator("html");
  await expect(html).toHaveAttribute("lang", locale);
  await expect(html).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
  // One page on screen. Next keeps the page before a language switch in the document, hidden, for Back.
  await expect(page.locator("main").filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Something went wrong" })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
}

export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    if (root.scrollWidth <= root.clientWidth + 1) return null;
    // Name the widest element, so the report says what to fix.
    const wide = [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((el) => el.getBoundingClientRect().right > root.clientWidth + 1)
      .sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0];
    return `page is ${root.scrollWidth}px wide on a ${root.clientWidth}px screen; widest: <${wide?.tagName.toLowerCase()} class="${wide?.className}">`;
  });
  expect(overflow, "nothing may stick out sideways").toBeNull();
}

/**
 * Waits until React has taken over an element (its handlers are attached).
 * Safari's engine loses a form's submit tapped before that: nothing is sent
 * (docs/QA.md, known issues), so tests tap the way a player does once the
 * page has settled.
 */
export async function hydrated(locator: Locator) {
  await expect.poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps$")))).toBe(true);
}

/** Opens a locked battle page with its password. */
export async function unlock(page: Page, password: string, locale = "en") {
  const button = page.getByRole("button", { name: t("kvk.unlock", locale) });
  await hydrated(button);
  await page.getByLabel(t("kvk.password", locale)).fill(password);
  await button.click();
}
