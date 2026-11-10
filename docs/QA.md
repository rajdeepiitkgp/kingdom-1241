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

The daily run behaves like a visitor and changes nothing: it never types a password, opens a room or sends a form, so it never trips the wrong-password alarms. It answers Next's link prefetches itself with an empty reply. Without that, every link in view would make Vercel rebuild that page in that language for nobody, spending ISR writes. A page's own payload is let through: an address not rendered since the last deploy (the not-found page, on a deploy day) arrives as an empty shell that fetches its own content with the same prefetch headers, and an empty answer would leave it blank. It also opts its browsers out of the visitor count (Vercel's `va-disable` flag, set before any page loads), so the daily run never shows up as three visitors. When it fails, GitHub e-mails the owner. Run it by hand from Actions → E2E live → Run workflow, or locally with `E2E_BASE_URL=https://kingdom-1241.vercel.app npm run e2e`.

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

- **A tap in the first moment after a page appears can be lost in Safari's engine.** On the locked battle pages, Rally Sync's Open room and other forms, a tap on the button before the page's scripts have taken over sends nothing: the page stays as it was, the password still in the field, no message. A second tap works. Chrome sends it anyway (as a plain form post). Seen in Playwright's WebKit, which iPhones share; to confirm on a real iPhone on a slow connection. Tests wait for the page with `hydrated()` before tapping. A second cause, found Nov 2026 and fixed, affected every browser: a page whose content streams in (the prep board, the KvK gates, a room) was revealed inside a 200 ms view transition, and a tap during one is dropped; the template's boundary now has `update="none"`, so only route changes crossfade (TOUR-02 checks).

## Specs

`Browser` = the pull-request suite, `Live` = the daily check, `Unit: <file>` = a Vitest file, `Manual` = the checklist below.

### Site-wide

| ID | What must hold | Checked by |
| --- | --- | --- |
| SITE-01 | Every public page opens in every shown language: answer 200, the right language and direction, not the error page, no console error, nothing wider than a phone. | Browser |
| SITE-02 | An unknown address shows the not-found page in the visitor's language, with the menu and a way home, and answers 404. | Browser |
| SITE-03 | An address without a language (`/kvk/prep`) opens the page in a language. | Browser |
| SITE-04 | The menu reaches every section, from the header on a laptop and from the bottom bar on a phone; KvK opens a list of its pages; the current section is marked; the logo leads home. | Browser |
| SITE-05 | The language switcher opens the same page in the chosen language, with its query and anchor, and the choice is remembered for addresses without a language. | Browser |
| SITE-06 | Dark mode stays on across pages, a language switch and a reload. | Browser |
| SITE-07 | The largest text size (125 %) stays on across pages, and every page still fits a phone in German, the longest language. | Browser |
| SITE-08 | Search engines are asked to stay away (robots meta and `robots.txt`). | Browser |
| SITE-09 | Reviewed translations keep every placeholder of the English and step aside once the English changes. | Unit: tests/content/seed/ui-reviewed.test.ts |
| SITE-10 | The admin area asks to sign in when nobody is signed in: the login page, never the error page. | Browser |
| SITE-11 | A link in a language the site knows but doesn't show opens the same page in the visitor's language. | Unit: tests/lib/i18n/negotiate.test.ts |
| SITE-12 | A theme, text-size or language change made while a new page is still fading in happens at once and leaves no error in the console (a new crossfade would cut React's short, and React reports that as an error). | Browser |
| SITE-13 | Visitor counting (Vercel Web Analytics and Speed Insights) is drawn on Vercel only, so a local build and the test server load no script and send nothing; the browsers of signed-in council members and browsers that opted out send nothing, so the council's own visits and the live check's devices never count. | Unit: tests/lib/analytics.test.ts |
| SITE-14 | A sync of the interface strings writes only the rows whose text or hash differs from the database, so an unchanged string fires no translation webhook. | Unit: tests/lib/i18n/sync-ui.test.ts |
| SITE-15 | Every public page sends only the interface strings its code can reach (the slice it declares); a key outside the slice fails the tests instead of rendering blank. | Unit: tests/architecture/page-strings.test.ts |

### Guided tours

| ID | What must hold | Checked by |
| --- | --- | --- |
| TOUR-01 | Every public page's "?" opens its tour, every step has a title and a text, Next leads to Done, and closing gives the keyboard back to the "?". A locked battle page's tour gains steps once the page is open. | Browser |
| TOUR-02 | Escape closes a tour and the page stays as it was; a first load runs no view transition, so the "?" tapped as soon as a streamed page appears is not lost. | Browser |
| TOUR-03 | "New here?" shows until that tour is opened or hidden on the device, stays gone after a reload, and is still shown for other pages' tours. | Browser |
| TOUR-04 | Tours read right to left in Arabic, also right after switching language. | Browser |
| TOUR-05 | Every tour step points at a marker that exists on its page, and button names in steps use the page's own words. | Unit: tests/architecture/tour-targets.test.ts |
| TOUR-06 | The read-aloud speaker shows only where the browser has a voice for the page's language; without speech the tour still opens. | Browser |

### Home and content

| ID | What must hold | Checked by |
| --- | --- | --- |
| HOME-01 | Home lists the alliances, and each opens its own page. | Browser |
| HOME-02 | While transfers are closed, Home shows no "Transfers open" badge, and the transfers page says they're closed and still shows whom to ask. | Browser |
| HOME-03 | Home shows the gift codes, or says there are none, with kingshot.net's credit and the official redeem page. | Browser |
| CONT-01 | Events list every event, and an event's guide link opens that guide. | Browser |
| CONT-02 | Rules show one topic at a time; picking a topic puts it in the address (`#topic`), and a shared `#topic` link opens that topic. | Browser |
| CONT-03 | Every guide in the guides list opens. | Browser |
| CONT-04 | Events repeat on their schedule (fixed time or each alliance's own day, second days included). | Unit: tests/lib/events/occurrences.test.ts |
| CONT-05 | Gift codes follow kingshot.net: new codes are added, ended ones leave Home, a moderator's own code is never ended. | Unit: tests/lib/gift-codes/sync-plan.test.ts |
| CONT-06 | Alliances follow MightPulse by alliance id, battle days keep the numbers from before the battle, and a new climber is held for review. | Unit: tests/lib/alliances/sync-plan.test.ts |
| CONT-07 | An event each alliance schedules itself shows its day and says so; an event with a fixed time shows the time. | Browser |

### KvK pages

| ID | What must hold | Checked by |
| --- | --- | --- |
| KVK-01 | The battle plan is locked; a wrong password says so; the right one opens it, it stays open after a reload, and Lock page locks it again. | Browser |
| KVK-02 | The rally-leader page and the commander checklist each need their own password; the battle plan's password opens neither. | Browser |
| KVK-03 | The commander's ticks stay on the device after a reload, and unticking sticks too. | Browser |
| KVK-04 | On a prep day the prep page opens on that day, marked Today, with its countdown running; another day can be picked. | Browser |
| KVK-05 | The feedback page says so when there is no feedback form. | Browser |
| KVK-06 | The prep calendar: rounds every 28 days from 1 Nov 2026, the day boundaries, the Saturday shield and battle times, the intel stacking days, the gathering tips (marches sent out the day before a gathering day, recalled before it ends); and every ✅ or 🆗 of the item × day table, with or without the council's buff days, falls on a day the game scores that item (the in-game Point Sources, Nov 2026). | Unit: tests/lib/kvk/prep.test.ts |
| KVK-07 | Wrong passwords lock out one address for a while and only alert for the plan; nobody is ever locked out by other players' guesses. | Unit: tests/lib/kvk/throttle.test.ts |
| KVK-08 | A battle's plan stays active while its feedback form is open: the editor refuses to activate another plan or deactivate this one until the form is closed, and a form opens for the active plan only. | Unit: tests/lib/admin/kvk-forms.test.ts |
| KVK-09 | The battle-plan intro's `{{when}}`, `{{date}}`, `{{time}}` and `{{utc}}` tokens come from the battle time: UTC in the server's HTML, the visitor's zone and words once the page is live. | Unit: tests/lib/kvk/battle-tokens.test.ts |
| KVK-10 | A table with centred header cells in a battle-page text (the battlefield map) is drawn as a diagram: narrow and centred on a wide screen, the width of the text on a phone, its cells centred, header cells included; at the largest text size it scrolls sideways inside its box instead of being cut, and the page never scrolls sideways. | Browser |
| KVK-11 | The prep page shows the five ministry items (Truegold, Tempered Truegold, construction speedups, Truegold Dust, research speedups) as ✅ on Days 1, 2 and 5 for everyone; the council's buff days (construction and research as set, training on Day 4) appear only with the battle plan's password, typed in a popup from the plan's row (a wrong one stays in the popup), which narrows those ✅ to the chosen days (the other two 🆗), and Lock page hides them again. | Browser |
| KVK-12 | The council's buff days: the stored value is read tolerantly, a round without one follows the template (construction Day 1, research Day 2), the admin form takes Days 1, 2 or 5 only (the same day for both allowed) and rounds that are over are dropped at a save. | Unit: tests/lib/kvk/prep-schedule.test.ts |

### Ministry sign-ups

| ID | What must hold | Checked by |
| --- | --- | --- |
| MIN-01 | The ministry page is locked with the battle plan's password. Unlocked, it shows the open prep round with its buff days (construction and research as the council set them, training on Day 4) and a card per day; a player who gives a Governor ID, name, alliance, an amount and at least one time is signed up, sees the entry under "Your sign-ups on this device" with its times in UTC, and still sees it after a reload. | Browser |
| MIN-02 | A sign-up needs at least one day, and every day taken needs an amount and a time; the message sits on the day it is about and nothing is saved. | Browser |
| MIN-03 | The browser that signed up changes its entry (the form opens with what was saved) and withdraws it with two taps; another browser with the password can't sign the same Governor ID up and is told to ask a moderator. | Browser |
| MIN-04 | A buff day has 48 half-hour appointments from 00:00 to 24:00 UTC (Day 5 is the whole Friday); the picker's buttons cover the day once whatever their length; construction and research on one day are one section; a section's score uses the prep page's points (Truegold 2,000, Tempered Truegold 30,000, Truegold Dust 1,000, a minute of speedups 30), and training is ranked by its speedups alone and shown as days and hours, never as points (the game scores the troops trained); the list is ranked by score, then by who signed up first, without entries set aside; a day's deadline is a day before it starts unless the council set one, never after the day's start; only one round is open at a time (opening one closes the other, which keeps its deadlines); sign-ups are deleted two weeks after their week. | Unit: tests/lib/ministry/ministry.test.ts |
| MIN-05 | The sign-up form: amounts are whole numbers within their limits, a day the player sits out is ignored, a name and alliance confirmed by MightPulse replace what was typed (tags case-sensitive), and a day past its deadline keeps what was stored whatever the form says. | Unit: tests/lib/ministry/form.test.ts |
| MIN-06 | After a buff day's deadline its roster shows on the ministry page: a table of the 48 half-hours from 00:00 to 24:00 UTC, each with its start and end, the same half-hour in the visitor's time in a named column of its own, and its player or "Free", how many are filled, and that free ones go through a moderator; a player is found by name, or by Governor ID through the server (the roster carries no IDs); the free times can be shown alone. A browser's own entries show their appointment, or that they got none. | Browser |
| MIN-07 | The assignment: as many appointments filled as any placing could; a player only in a time they picked; one per player and day; when two can't both be placed the higher on the list is (never dropped for a lower one, only moved); players placed by hand and players who took a free time stay and are planned around; a place of a player set aside is dropped; a hand placement needs a slot of the day that nobody else holds; the roster copies for the game chat. | Unit: tests/lib/ministry/assign.test.ts |

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
| RS-11 | The invite link opens a room without the password. | Browser |
| RS-12 | The coordinator can log another browser out; it needs the password again. | Browser |
| RS-13 | Garrison: the wave copies for the game chat (or shows the text to copy by hand), and Clear all needs two taps. | Browser |
| RS-14 | The screen-awake switch asks the browser for a wake lock, and hides where the browser has none. | Browser |
| RS-15 | Re-sync on the next :00 sets the hit so the slowest leader starts on the first whole minute at least the room's buffer away and every start is hit − rally timer − march; the clock copy and the start order for any minute both copy. | Browser |
| RS-16 | The next :00 moves to the minute after when it is closer than the buffer; the start order for any minute puts the slowest leader at 0:00 and the others longest march − own march later, with no clock. | Unit: tests/lib/rally-sync/timing.test.ts |
| RS-17 | The rally timer can't change while a rally runs (every start is hit − timer − march, so it would move them all); the buffer can. | Browser |
| RS-18 | A leader in from the next rally, or a march time waiting for it, is in once the hit has passed, with or without a new hit time. | Browser |
| RS-19 | New browsers from one address in one room are budgeted (30 per 10 minutes, then the address waits 10 minutes), so a leaked password can't fill a room by script; the store lists every browser the largest room may hold. | Unit: tests/lib/rally-sync/capacity.test.ts |
| RS-20 | The "Tap anywhere to allow sound" hint floats above the bottom bar and leaves after the first tap without moving anything on the page (a line leaving the status card shifted every control below it under a quick second tap). | Browser |
| RS-21 | The room chat opens from its floating button (a window on a laptop, a sheet on a phone): a message sent in a room reaches every other browser in it without a reload, named after its sender (the browser's own name, its leader's, or "Watcher" and its tag) and marked when it came from a coordinator; the button counts the new messages until the chat is opened; a message the coordinator pins sits on top of the chat and under the status line on every page until unpinned; the coordinator can clear the chat with two taps, and every page empties; closing brings the button back. | Browser |
| RS-22 | Chat rules: a message is 1–500 characters of plain text, a room keeps its last 100, a browser may send 20 a minute and then waits a minute, a fetch merges in order and drops what the room no longer holds, only others' messages after the last one seen count as new, and a new message stays silent while a countdown cue of the device is within a minute. | Unit: tests/lib/rally-sync/room-chat.test.ts |

### Tools

| ID | What must hold | Checked by |
| --- | --- | --- |
| TOOLS-01 | The rally refill and pack value calculators answer as the numbers change. | Browser |
| TOOLS-02 | Numbers are read as the visitor's language writes them: `2.500` and `2,5` in German, `2,500` and `2.5` in English, Arabic digits too. | Unit: tests/lib/tools/number-input.test.ts |

### Operations

| ID | What must hold | Checked by |
| --- | --- | --- |
| OPS-01 | The weekly backup carries the content images as an encrypted archive next to the table dump, refuses a damaged or altered archive, and a restore uploads only the files the bucket lacks. | Unit: tests/lib/backup/images.test.ts |

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
| MAN-04 | Tour read-aloud speaks in the page's language on Android Chrome and on iPhone (TOUR-06 checks when the speaker shows). | Manual |
| MAN-05 | Admin: Discord sign-in works; a moderator can publish an announcement, and Home shows it after the save. | Manual |
| MAN-06 | Admin: a role change, a battle-plan edit and a translation fix save, and keep their values on screen after Save. | Manual |
| MAN-07 | The feedback results print to PDF on light and dark paper in Chrome and Safari. | Manual |
| MAN-08 | Admin: with transfers switched open, the transfers page shows the terms and Home's banner shows the badge; closed again, both go. | Manual |
| MAN-09 | Admin: the editor's Preview shows a text as players will see it (formatting, a danger box, an image). | Manual |
| MAN-10 | Admin: a moderator moves the construction buff to Day 5 under Prep days; the unlocked prep page shows Day 5 ✅ for Truegold on the next visit, and the change is listed under Recent changes. | Manual |
| MAN-11 | Admin: a moderator opens the next round under Ministry sign-ups and sets a deadline; a player signs up on the Ministry page; the moderator sees the entry ranked on its buff day with its score, edits its numbers, sets it aside and puts it back, removes it, and each step is listed under Recent changes. | Manual |
| MAN-12 | With MightPulse answering: a Governor ID typed on the Ministry page or the feedback form fills in the name and alliance; changing or emptying the ID empties both again, so a name never stays with another ID. | Manual |
| MAN-13 | Admin, Ministry sign-ups: a round's Save is greyed out until its switch or a deadline differs from what is stored, and again after the save; opening one round unticks the other without a reload; the round and day buttons of the list keep the page where it is; the Add and Edit forms show each day's score while typing. | Manual |
| MAN-14 | Admin, Ministry sign-ups: before a day's deadline the Appointments block shows a preview; with the deadline set to a past time the appointments are given out on the next visit (audit `ministry.assign`); the day shows as a table (time, player, what they bring, score); the arrows move a player half an hour earlier or later and trade places with a neighbour; a player is moved by hand into a free time with the one form under the table and keeps it through Assign again (two taps); setting a player aside frees their time; moving the deadline back into the future takes the roster away again; Copy for game chat gives one line per appointment. | Manual |
| MAN-15 | Admin, Ministry sign-ups: the buff days are tabs (two lines each; construction and research on one day share a tab) and everything below follows the tab picked. As an administrator, "Remove all sign-ups" under Start clean empties the picked round with two taps (entries set aside and appointments too; the other round, the switch and the deadlines stay; audit `ministry.signup_remove_all` with the count); a moderator doesn't see the section. On the Ministry page, a day past its deadline shows the appointment in the account's tile with the visitor's own time and a countdown ("Starts in", "Live now", "Ended"). | Manual |
| MAN-16 | Admin, Ministry sign-ups, "Add a sign-up by hand": a real Governor ID of the kingdom fills in the name and alliance when the field is left, and the saved entry carries the verified tick and its power; an ID MightPulse doesn't know or has in another kingdom says so under the field and can still be added (a test entry); changing the ID after a fill empties name and alliance. | Manual |
| MAN-17 | Admin, Ministry sign-ups: a sign-up added by hand (or put back from Set aside) after a buff day's appointments were given out gets the earliest free time among its own on that day at once, and the notice names the time; nobody else moves. With none of its times free the notice says to move the player by hand. The "Done" notice of Assign this day again doesn't follow to another day's tab. *Start this day from scratch* (two taps) gives the day out anew and a player moved by hand before is placed by the rules again, while *Assign this day again* leaves them where they were moved. | Manual |
| MAN-18 | Admin, Ministry sign-ups, draft and publish: after a day's deadline the Appointments block says "Published" in green and players see the same list. Move a player with an arrow: the block turns gold ("Draft: 2 half-hours differ…"), the rows are marked Draft, and the Ministry page still shows the old list and the player's old appointment. *Publish to players* (two taps) makes the Ministry page show the new one; *Discard the draft* (two taps) puts the table back to what players see. *Start this day from scratch* leaves the players' list alone until Publish. Audit: `ministry.publish`, `ministry.discard`. | Manual |
