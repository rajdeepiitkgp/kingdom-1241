import { expect, type Page } from "@playwright/test";
import { format } from "@/lib/i18n/dictionary";
import { hydrated, t } from "./site";

/** The page's "?" (in a rally room it sits in the status line). */
export const tourButton = (page: Page, locale = "en") => page.getByRole("button", { name: t("tour.open", locale), exact: true }).first();

/**
 * Opens the page's guided tour and reads it to the end, step by step, as a
 * player would: each card has a title and a text, "Next" moves on and the
 * last card's "Done" closes it. Returns how many steps it had.
 */
export async function walkTour(page: Page, locale = "en"): Promise<number> {
  const opener = tourButton(page, locale);
  await hydrated(opener);
  await opener.click();
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();
  // "Step 1 of 6" (in Korean the total comes first); one step has no counter.
  const pattern = new RegExp(`^${format(t("tour.step", locale), { n: "\\d+", total: "(\\d+)" })}$`);
  const counter = card.getByText(pattern);
  const total = (await counter.count()) === 0 ? 1 : Number((await counter.textContent())?.match(pattern)?.[1]);
  for (let n = 1; n <= total; n++) {
    if (total > 1) await expect(card.getByText(format(t("tour.step", locale), { n, total }), { exact: true })).toBeVisible();
    await expect(card.locator("#tour-title")).not.toBeEmpty();
    await expect(card.locator("#tour-body")).not.toBeEmpty();
    await card.getByRole("button", { name: t(n === total ? "tour.done" : "tour.next", locale), exact: true }).click();
  }
  await expect(card).toBeHidden();
  // Closing hands the keyboard back to the "?".
  await expect(opener).toBeFocused();
  return total;
}
