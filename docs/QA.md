# Quality assurance

How Kingdom 1241's site is tested, what each test promises, and what still needs a person with a phone. The specs below are the contract: every rule has an ID, and each browser test's title starts with the ID it checks. `tests/architecture/qa-coverage.test.ts` fails when a `Browser` or `Live` spec has no test, when a test names an ID this page doesn't list, when a `Unit` spec points at a test file that doesn't exist, or when a public page is missing from the browser suite.

## Layers

| Layer | What it catches | Where | When |
| --- | --- | --- | --- |
| Lint and typecheck | Type errors, React rule breaks, non-canonical Tailwind classes | `npm run lint`, `npm run typecheck` | Every pull request and push to `main` (CI) |
| Unit tests | The logic under the pages: timings, calendars, parsers, forms, the translation pipeline, access tokens | `tests/` (Vitest), `npm run test` | Every pull request (CI) |
| Architecture guards | Rules about the code itself: no server module reachable from the browser, edit forms that keep their saved values, every spec here tested | `tests/architecture/` | Every pull request (CI) |
| Browser suite | The site as players use it: every page in every language, the menu, tours, the locked battle pages, Rally Sync between two devices | `e2e/` (Playwright), `npm run e2e` | Every pull request (CI: laptop and Android on Linux, iPhone on macOS) |
| Live check | The deployed site with its real data: pages load in every language the site offers, the database answers | `e2e/live/`, the E2E live workflow | Daily at 06:30 UTC, and by hand |
| Manual checks | What only a real device or a real account shows: sound, the screen staying awake, Discord sign-in, the admin forms | The list at the end | Before each battle day and after a change in those areas |

### The browser suite

The pull-request suite runs against a production build of the branch with **no keys**: no Supabase, no Anthropic, no MightPulse (`playwright.config.ts` blanks every key, which also wins over a local `.env.local`). The server is plain `http://localhost`, where WebKit refuses a Secure cookie, so `E2E_HTTP_COOKIES=1` leaves that flag off the battle-page and Rally Sync cookies there (`src/lib/secure-cookies.ts`; Vercel ignores it). Pages show the bundled seed content and Rally Sync uses its in-memory rooms (`RALLY_SYNC_STORE=memory`). Nothing a test does can reach production. Each test runs on three devices:

- `desktop-chromium`: a laptop, Chrome, time zone Pago Pago (UTC−11).
- `phone-chromium`: an Android phone 390 px wide, Chrome, time zone Kiritimati (UTC+14).
- `phone-webkit`: an iPhone 13 (390 px), Safari's engine, time zone Seoul. In CI it runs on a macOS machine (the `Browser tests (iPhone)` job): Apple's WebKit is what iPhones run, while WebKit's Linux build has older locale data.

The far-apart time zones make a date drawn on the server (in UTC) and again in the browser disagree whenever the code forgets `timeZone: "UTC"`. React then reports error #418, which fails the test. Every page a test opens is watched: an error in the browser console or an uncaught exception fails the test (`e2e/support/test.ts`). Each page is also checked for its language and direction, for the error page, and for anything wider than the screen (`expectHealthyPage` in `e2e/support/site.ts`).

The tests read their words from the same seed files the pages are built from (`t("sync.join.submit")`), so rewording a label doesn't break a test. Rally Sync tests open a fresh room each (codes `E2R…`, `E2G…` and `E2C…` in the memory store, numbered by test worker), so tests running side by side never share a hit time.

### The live check

The daily run behaves like a visitor and changes nothing: it never types a password, opens a room or sends a form, so it never trips the wrong-password alarms. It answers Next's link prefetches itself with an empty reply. Without that, every link in view would make Vercel rebuild that page in that language for nobody, spending ISR writes. When it fails, GitHub e-mails the owner. Run it by hand from Actions → E2E live → Run workflow, or locally with `E2E_BASE_URL=https://kingdom-1241.vercel.app npm run e2e`.

## Running it

```bash
npx playwright install chromium webkit   # once per Playwright version
npm run e2e                              # builds the site offline, then runs everything
npx playwright test e2e/rally-sync.spec.ts --project=phone-webkit   # one file on one device
npx playwright test -g "RS-03"           # one spec
npx playwright show-report               # the HTML report of the last run
```

`npm run e2e` builds into `.next` with the keys blanked. Run `npm run build` again before `npm start` with real keys. The suite never reuses a running server.

## Reports

Each CI run publishes:

- **A results table in the run's summary** (Actions → the run → Summary), made from the JUnit XML of the unit tests (`reports/junit/unit.xml`) and of the browser suite (`reports/junit/e2e.xml`, one line per test and device), with flaky tests listed separately.
- **Failure notes on the pull request**: each failing test is marked on the file and line of the test.
- **The `test-reports` and `test-reports-iphone` artifacts**, kept 14 days: both JUnit files, Playwright's HTML report, and for a failed test its screenshot and trace (`npx playwright show-trace trace.zip` replays it step by step). It shows only seed content, so it is safe on a public repository.

A test that fails once and passes on its retry counts as **flaky** and is listed as such. Fix the cause; don't add retries.

## Adding to it

Every new feature or page comes with its specs, the same way it comes with a guided tour:

1. Add rows to the table of its area below (or a new area), with a new ID and what must hold, in words a player or moderator would recognise.
2. Write the tests. A browser test's title starts with the ID (`test("RS-08 …")`). Use `t(key)` for words and `data-tour` markers to find parts of a page. Add `expectHealthyPage` after each new screen. For anything that needs two players, use `otherDevice`.
3. A new public page goes into `PUBLIC_PAGES` (`e2e/support/pages.ts`). The coverage test fails until it does, and from then on it is opened in every language on every device.
4. Something a browser can't check goes in as `Unit` with its test file, or as `Manual` in the checklist.

When a feature changes, change its specs first, then the code. A test that fails because the spec changed is updated with it, in the same pull request.

## Known issues

Found by the browser suite and not fixed yet. Each has a decision pending; the tests wait it out so they stay green.

- **A tap in the first moment after a page appears can be lost in Safari's engine.** On the locked battle pages, Rally Sync's Open room and other forms, a tap on the button before the page's scripts have taken over sends nothing: the page stays as it was, the password still in the field, no message. A second tap works. Chrome sends it anyway (as a plain form post). Seen in Playwright's WebKit, which iPhones share; to confirm on a real iPhone on a slow connection. Tests wait for the page with `hydrated()` before tapping.

## Specs

`Browser` = the pull-request suite, `Live` = the daily check, `Unit: <file>` = a Vitest file, `Manual` = the checklist below.

### Site-wide

| ID | What must hold | Checked by |
| --- | --- | --- |
| SITE-01 | Every public page opens in every shown language: answer 200, the right language and direction, not the error page, no console error, nothing wider than a phone. | Browser |
| SITE-02 | An unknown address shows the not-found page in the visitor's language, with the menu and a way home, and answers 404. | Browser |
| SITE-03 | An address without a language (`/kvk/prep`) opens the page in a language. | Browser |
| SITE-04 | The menu reaches every section, from the header on a laptop and from the bottom bar on a phone; KvK opens a list of its pages; the current section is marked; the logo leads home. | Browser |
| SITE-05 | The language switcher opens the same page in the chosen language, and the choice is remembered for addresses without a language. | Browser |
| SITE-06 | Dark mode stays on across pages, a language switch and a reload. | Browser |
| SITE-07 | The largest text size (125 %) stays on across pages, and every page still fits a phone in German, the longest language. | Browser |
| SITE-08 | Search engines are asked to stay away (robots meta and `robots.txt`). | Browser |
| SITE-09 | Reviewed translations keep every placeholder of the English and step aside once the English changes. | Unit: tests/content/seed/ui-reviewed.test.ts |

### Guided tours

| ID | What must hold | Checked by |
| --- | --- | --- |
| TOUR-01 | Every public page's "?" opens its tour, every step has a title and a text, Next leads to Done, and closing gives the keyboard back to the "?". A locked battle page's tour gains steps once the page is open. | Browser |
| TOUR-02 | Escape closes a tour and the page stays as it was. | Browser |
| TOUR-03 | "New here?" shows until that tour is opened or hidden on the device, stays gone after a reload, and is still shown for other pages' tours. | Browser |
| TOUR-04 | Tours read right to left in Arabic, also right after switching language. | Browser |
| TOUR-05 | Every tour step points at a marker that exists on its page, and button names in steps use the page's own words. | Unit: tests/lib/tour/targets.test.ts |

### Home and content

| ID | What must hold | Checked by |
| --- | --- | --- |
| HOME-01 | Home lists the alliances, and each opens its own page. | Browser |
| HOME-02 | While transfers are closed, Home shows no "Transfers open" badge, and the transfers page says they're closed and still shows whom to ask. | Browser |
| CONT-01 | Events list every event, and an event's guide link opens that guide. | Browser |
| CONT-02 | Rules show one topic at a time; picking a topic puts it in the address (`#topic`), and a shared `#topic` link opens that topic. | Browser |
| CONT-03 | Every guide in the guides list opens. | Browser |
| CONT-04 | Events repeat on their schedule (fixed time or each alliance's own day, second days included). | Unit: tests/lib/events/occurrences.test.ts |
| CONT-05 | Gift codes follow kingshot.net: new codes are added, ended ones leave Home, a moderator's own code is never ended. | Unit: tests/lib/gift-codes/sync-plan.test.ts |
| CONT-06 | Alliances follow MightPulse by alliance id, battle days keep the numbers from before the battle, and a new climber is held for review. | Unit: tests/lib/alliances/sync-plan.test.ts |

### KvK pages

| ID | What must hold | Checked by |
| --- | --- | --- |
| KVK-01 | The battle plan is locked; a wrong password says so; the right one opens it, it stays open after a reload, and Lock page locks it again. | Browser |
| KVK-02 | The rally-leader page and the commander checklist each need their own password; the battle plan's password opens neither. | Browser |
| KVK-03 | The commander's ticks stay on the device after a reload, and unticking sticks too. | Browser |
| KVK-04 | On a prep day the prep page opens on that day, marked Today, with its countdown running; another day can be picked. | Browser |
| KVK-05 | The feedback page says so when there is no feedback form. | Browser |
| KVK-06 | The prep calendar: rounds every 28 days from 1 Nov 2026, the day boundaries, the Saturday shield and battle times, the intel stacking days. | Unit: tests/lib/kvk/prep.test.ts |
| KVK-07 | Wrong passwords lock out one address for a while and only alert for the plan; nobody is ever locked out by other players' guesses. | Unit: tests/lib/kvk/throttle.test.ts |
| KVK-08 | A battle's plan stays active while its feedback form is open: the editor refuses to activate another plan or deactivate this one until the form is closed, and a form opens for the active plan only. | Unit: tests/lib/admin/kvk-forms.test.ts |

### Rally Sync

| ID | What must hold | Checked by |
| --- | --- | --- |
| RS-01 | A room opens with its ID and password from the Rally Sync page; a wrong password is refused and the typed room ID stays. | Browser |
| RS-02 | Re-sync sets the earliest hit everyone can make (now + rally timer + longest march + buffer), and every leader's start is hit − rally timer − march, earliest first. | Browser |
| RS-03 | A leader who joins, or whom the coordinator adds, during a running rally is in from the next one (nothing moves under the others); when the coordinator sets the next hit time, the leader's own start appears on their device without a reload. | Browser |
| RS-04 | Re-sync while a rally runs needs a second tap: the first only shows what it would do. | Browser |
| RS-05 | Garrison: a marked enemy rally launches after the countdown it showed and lands a march later; a defender who enters their march sees when to send, without a reload. | Browser |
| RS-06 | Counter-rally: leaders go slowest march first, and each cue is rally timer − (that leader's march − own march). | Browser |
| RS-07 | Each room type's guided tour reads to the end. | Browser |
| RS-08 | Timing rules: stages (waiting, ready, alert, GO, passed), the game-clock adjustment, the rally that runs while a hit time is ahead. | Unit: tests/lib/rally-sync/timing.test.ts |
| RS-09 | Garrison refill windows, the send plan with speedups, and the waves clearing after their last hit. | Unit: tests/lib/rally-sync/garrison.test.ts |
| RS-10 | Room limits per type stay within the Realtime budget, and the database triggers use the same numbers. | Unit: tests/lib/rally-sync/capacity.test.ts |

### Live site

| ID | What must hold | Checked by |
| --- | --- | --- |
| LIVE-01 | Home opens in every language the live site offers. | Live |
| LIVE-02 | The main pages open: events, rules, guides, transfers, tools, Rally Sync, the battle plan, the prep days. | Live |
| LIVE-03 | Home shows the alliances from the database, and an alliance's page opens. | Live |
| LIVE-04 | An unknown address shows the not-found page and answers 404. | Live |

### Manual checklist

Run through the ones that apply before each battle day, and after any change in their area.

| ID | What must hold | Checked by |
| --- | --- | --- |
| MAN-01 | Rally Sync sounds: the chime and the ticks to GO are heard on Android and iPhone with the game in front. | Manual |
| MAN-02 | Rally Sync keeps the screen awake while a room is open, where the phone allows it. | Manual |
| MAN-03 | A real room on the live site: the Realtime dot is green, a second phone follows a new hit time within a second, and the invite link opens the room. | Manual |
| MAN-04 | Tour read-aloud speaks in the page's language on Android Chrome and on iPhone, and the speaker button is hidden where there is no voice. | Manual |
| MAN-05 | Admin: Discord sign-in works; a moderator can publish an announcement, and Home shows it after the save. | Manual |
| MAN-06 | Admin: a role change, a battle-plan edit and a translation fix save, and keep their values on screen after Save. | Manual |
| MAN-07 | The feedback results print to PDF on light and dark paper in Chrome and Safari. | Manual |
