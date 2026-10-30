import { test as base, expect, type Page } from "@playwright/test";

/**
 * The `test` every spec imports. Each page a test opens is watched: an error
 * in the browser console or an uncaught exception fails the test, so a
 * hydration mismatch (React #418) or a crash behind a page that still looks
 * fine is caught. `consoleAllow` lists what a spec expects to see (a 404 on
 * the not-found page). `otherDevice` opens a second browser with the same
 * device settings, for flows between two players.
 */
export const test = base.extend<{
  consoleAllow: RegExp[];
  consoleProblems: string[];
  otherDevice: () => Promise<Page>;
}>({
  consoleAllow: [[], { option: true }],
  consoleProblems: [
    async ({ page, consoleAllow }, provide) => {
      const problems: string[] = [];
      watchConsole(page, problems, consoleAllow);
      await provide(problems);
      expect(problems, "the browser console must stay free of errors").toEqual([]);
    },
    { auto: true },
  ],
  otherDevice: async ({ browser, baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, timezoneId, consoleProblems, consoleAllow }, provide) => {
    const contexts: Awaited<ReturnType<typeof browser.newContext>>[] = [];
    await provide(async () => {
      const context = await browser.newContext({ baseURL, viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, timezoneId });
      contexts.push(context);
      const page = await context.newPage();
      watchConsole(page, consoleProblems, consoleAllow);
      return page;
    });
    await Promise.all(contexts.map((context) => context.close()));
  },
});

/**
 * Noise that isn't the site's: WebKit reports a link prefetch (`?_rsc=`) that
 * a navigation cancelled as an access-control failure; the next page loads fine.
 */
const BROWSER_NOISE = [/\?_rsc=\S+ due to access control checks/];

function watchConsole(page: Page, problems: string[], allow: RegExp[]) {
  const expected = (text: string) => [...BROWSER_NOISE, ...allow].some((pattern) => pattern.test(text));
  page.on("console", (message) => {
    if (message.type() === "error" && !expected(message.text())) problems.push(`${page.url()}: ${message.text()}`);
  });
  page.on("pageerror", (error) => {
    if (!expected(error.message)) problems.push(`${page.url()}: uncaught ${error.message}`);
  });
}

export { expect };
