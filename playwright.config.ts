import { defineConfig, devices } from "@playwright/test";

/**
 * Browser tests (docs/QA.md). The pull-request suite runs against a production
 * build of this checkout with no keys at all: the bundled seed content and
 * Rally Sync's in-memory rooms, so nothing reaches Supabase, Anthropic,
 * MightPulse or Vercel. A variable set to "" wins over `.env.local` (Next only
 * fills in variables that are unset), so a local run is as offline as CI.
 *
 * With `E2E_BASE_URL` set, only the live check (`e2e/live`) runs, read-only,
 * against that address (the daily E2E live workflow).
 */
const PORT = 3100;
const liveUrl = process.env.E2E_BASE_URL?.trim();
const ci = Boolean(process.env.CI);

const OFFLINE_ENV: Record<string, string> = {
  NEXT_PUBLIC_SUPABASE_URL: "",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
  SUPABASE_SECRET_KEY: "",
  SUPABASE_SERVICE_ROLE_KEY: "",
  ANTHROPIC_API_KEY: "",
  GEMINI_API_KEY: "",
  TRANSLATION_PROVIDER: "off",
  MIGHTPULSE_API_KEY: "",
  TRANSLATE_WEBHOOK_SECRET: "",
  ALERT_DISCORD_WEBHOOK_URL: "",
  ADMIN_DEV_LOGIN: "",
  SITE_OWNER: "",
  KVK_SEED_PASSWORD: "",
  KVK_SEED_LEADER_PASSWORD: "",
  KVK_SEED_CHECKLIST_PASSWORD: "",
  // Signs the test server's cookies only; production has its own secret.
  KVK_SESSION_SECRET: "e2e-only-not-a-real-secret",
  RALLY_SYNC_STORE: "memory",
  // Plain http://localhost: WebKit refuses the Secure flag there (secure-cookies.ts; Vercel ignores this).
  E2E_HTTP_COOKIES: "1",
  LOG_LEVEL: "warn",
  NEXT_TELEMETRY_DISABLED: "1",
};

// CI has built the site in the step before; a local run builds it here, offline.
// Idle connections stay open longer than any test runs (45 s; RS-12 90 s): Node closes them after
// 5 s by default, and WebKit reuses a connection the server has just closed and fails a Server
// Action with "The network connection was lost" (a GET it retries, a POST never; Chromium retries
// both). Only this test server is affected: Vercel's edge keeps the browser's connections itself.
const KEEP_ALIVE_MS = 120_000;
const serve = `npm run start -- --port ${PORT} --keepAliveTimeout ${KEEP_ALIVE_MS}`;

export default defineConfig({
  testDir: "e2e",
  testIgnore: liveUrl ? undefined : "live/**",
  fullyParallel: true,
  forbidOnly: ci,
  // A flaky test gets its cause fixed (CLAUDE.md), never a second try that hides it.
  retries: 0,
  workers: ci ? 3 : undefined,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  // CI also writes JUnit XML: the run's test summary and the failure notes on the pull request come from it.
  reporter: ci
    ? [["list"], ["html", { open: "never" }], ["junit", { outputFile: "reports/junit/e2e.xml", includeProjectInTestName: true }]]
    : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: liveUrl || `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: liveUrl
    ? [{ name: "live", testDir: "e2e/live", use: { ...devices["Desktop Chrome"], timezoneId: "Pacific/Kiritimati" } }]
    : [
        // Far-apart time zones: a date rendered on the server in UTC and again in the browser must agree (React error #418).
        { name: "desktop-chromium", use: { ...devices["Desktop Chrome"], timezoneId: "Pacific/Pago_Pago" } },
        { name: "phone-chromium", use: { ...devices["Pixel 7"], viewport: { width: 390, height: 844 }, timezoneId: "Pacific/Kiritimati" } },
        { name: "phone-webkit", use: { ...devices["iPhone 13"], timezoneId: "Asia/Seoul" } },
      ],
  webServer: liveUrl
    ? undefined
    : {
        command: ci ? serve : `npm run build && ${serve}`,
        url: `http://localhost:${PORT}/en`,
        env: OFFLINE_ENV,
        reuseExistingServer: false,
        timeout: 300_000,
        stdout: "ignore",
        stderr: "pipe",
      },
});
