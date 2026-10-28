# Kingdom 1241

Community website for **Kingshot Kingdom 1241** — rules, announcements, event times in every player's time zone, guides and tools, in ten languages (English, German, Korean, Polish, Arabic, Turkish, Italian, Japanese, Traditional Chinese, French — more are a table row away). Modelled on 1424.win, hosted for free.

**Live today:** site layout, ten languages, Home (with the real alliances of 1241), Events, Rules, Guides, Tools, the public **KvK prep days** page (what to use, wait for or save on each of the five scoring days, with a live countdown), the password-locked **KvK battle plan** (formations with hero portraits and troop ratios, coordinators, instructions — for both the internal castle battle and KvK, which alternate every two weeks), the separate password-locked **rally-leader plan** (who leads which rally with which of their own heroes and troop ratio), the third password-locked page, the **commander checklist** (what to prepare by phase, ticked off on the commander's device, the battle commander's orders and general guidelines), **Rally Sync** (rooms where rally leaders get their own UTC start time so every rally lands at the same second, with live updates, a clock correction and a countdown that turns red in the last 15 seconds; counter-rally rooms give the counter alliance its launch order; garrison rooms time the defenders' refills so they land between enemy rally hits), the **battle feedback** form players fill in after each battle (star ratings and short texts, Governor ID checked through MightPulse, results, CSV export and an English translations of the answers for the council and an on-demand AI summary run by the owner, deleted automatically after 30 days) and the **admin area** (Discord sign-in, roles, battle-plan editor, feedback results, per-language translation fixes). What comes next is in [docs/PLAN.md](docs/PLAN.md) § Phases, the one place where the roadmap lives.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript, Cache Components) on **Vercel**
- [Supabase](https://supabase.com) Postgres + Storage for content and images
- AI translations — [Anthropic Claude](https://platform.claude.com) by default, [Gemini](https://ai.google.dev) as the free alternative, or off — run only when content is added or edited, never on page view
- Tailwind CSS v4, self-hosted fonts (Nunito, Noto Sans KR, Noto Sans Arabic)

See **[SETUP.md](SETUP.md)** for getting the keys, deploying and the CI/CD pipeline, **[docs/PLAN.md](docs/PLAN.md)** for the full product plan and phases, and **[CLAUDE.md](CLAUDE.md)** for the working conventions.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — the site runs on bundled seed content without it
npm run dev
```

## How it fits together

```
src/
  app/[locale]/           pages: / (home), /events, /rules, /guides, /guides/[slug], /kvk, /kvk/prep, /kvk/feedback, /kvk/leaders, /kvk/checklist, /tools, /tools/rally-sync, /tools/rally-sync/[code]
  app/[locale]/admin/     council area (Discord sign-in): overview, battle-plan editor, feedback results (paged, print view, CSV export), Rally Sync rooms, users, the owner's settings, each with its own "Page guide"; English only
  app/auth/callback       finishes the Discord sign-in (code → session cookies)
  app/api/translate       Supabase webhook → translation provider → writes translations back, refreshes cache
  app/api/revalidate      manual cache refresh
  app/api/rally-sync      a Rally Sync room's state for visitors who unlocked it (+ the server clock)
  proxy.ts                sends /, /events, … to the visitor's language; adds x-request-id; refreshes the admin session
  components/             layout (header, bottom tab bar, language switcher, theme), home, kvk, tools, admin (forms), tour (the guided-tour "?" and overlay, with its read-aloud speaker)
  content/seed/           boilerplate content, heroes, placeholder battle plan, UI strings (en/de/ko/pl/ar) and reviewed machine translations (ui-reviewed.ts)
  lib/auth/               Supabase Auth session (cookies), identity → profile, roles, pre-authorisations, sign-in actions
  lib/admin/              uncached admin loaders, Server Actions (plan editor, users, profile, owner settings: Rally Sync capacity, languages, translation pause, password rules, feedback defaults), FormData parsers, shared action replies, audit log
  lib/data/               cached loaders ('use cache' + tags), cache tags per table, Supabase ↔ app type mappers
  lib/config/             the owner's settings (table app_config): read and write, tolerant number settings, the readers the site uses (defaults on any problem)
  lib/i18n/               language registry (direction, font, translation style), fallback helper, negotiation, the translation review's checks (ui-review.ts, content-review.ts)
  lib/kvk/                password locks (one signed cookie per page: plan, leaders, checklist), Server Actions, formation helpers, the prep-week schedule and item × day table (`prep.ts`)
  lib/rally-sync/         Rally Sync: timing maths, garrison refills, the counter-rally order, game-chat texts and room rules (pure), password/cookie/invite signatures, storage (Supabase or in-memory for local review), Server Actions, a small Realtime client, device memory, countdown sounds, the room limits per type (capacity)
  lib/retro/              battle feedback: question catalogue, form rules, MightPulse lookup, summary maths, results paging and the hide-names view, CSV, retention and prune
  lib/log.ts              structured logger (pretty in dev, JSON lines in production) + request ids
  lib/translate/          provider switch (Anthropic / Gemini / off), shared prompt + glossary, batched row translator with change hashes
  lib/backup/             what the encrypted content backup contains and how it is restored (pure; the script is scripts/backup.ts)
  lib/vercel/             which old Vercel deployments to delete (pure; the script is scripts/prune-deployments.ts)
  lib/tools/              pure calculator logic (rally refill, pack value)
  lib/tour/               guided tours: which tours a device has seen, where the step card goes, which voice reads a step aloud (pure); each feature keeps its own steps (lib/rally-sync/tours.ts, lib/admin/tours.ts, lib/kvk/tours.ts, lib/tour/home.ts)
tests/                    unit tests, same tree as src/ (tests/lib/kvk/access.test.ts ↔ src/lib/kvk/access.ts); tests/architecture keeps server-only code out of Client Components
public/heroes/            128px hero portraits (from kingshotdata.com)
public/items/             128px game icons for the KvK prep page (kingshotdata.com, kingshot.net, kingshotwiki.com, g2384/Kingshot-Data)
supabase/
  migrations/000N_*.sql     schema, one additive file per change (init, kvk, admin auth, game names, alliance tag, unlock throttle, …)
  webhooks.sql              wires every content table to /api/translate (Maintenance → webhooks runs it)
  config.toml               Supabase auth settings declared in code (Maintenance → config-push applies them)
scripts/
  seed.ts                 npm run db:seed
  translate.ts            npm run translate
  ui-review.ts            npm run ui:review (read-only export of the live UI strings for the /translation-review skill)
  content-review.ts       npm run content:review (read-only export of the battle plan and other content for the same review)
  content-fixes.ts        npm run content:fixes (applies the review's content fixes; preview without --apply)
  dev-admin.ts            npm run dev:admin (local admin account, see SETUP.md § 8.3)
  backup.ts               npm run backup (encrypted dump and restore of all content, SETUP.md § 10)
  prune.ts                npm run prune (deletes battle feedback past its retention period and closed Rally Sync rooms, SETUP.md § 9a/9b)
  prune-deployments.ts    npm run deployments:prune (deletes old Vercel deployments, SETUP.md § 5)
.github/workflows/        CI (lint/typecheck/test/build), Deploy database (migrations; dry run on PRs), Maintenance (seed, translate, revalidate, weekly encrypted backup, webhooks, config push), Prune deployments (old Vercel deployments, after every deploy); dependabot.yml for updates
```

### Languages and translation

- The list of offered languages is the `languages` table (seeded with English, German, Korean, Polish, Arabic). Each code maps to a text direction and font stack in `src/lib/i18n/languages.ts`; Arabic renders fully right-to-left.
- Every translatable field is a JSON object `{"en": …, "de": …}`. English is the source; pages fall back to English for anything missing.
- Translation happens in `src/lib/translate`: a Supabase webhook (or `npm run translate`) sends the English text with a game-term glossary to the configured provider (Anthropic Claude or Gemini; `TRANSLATION_PROVIDER` switches or turns it off). A hash of the English source is stored on the row, so unchanged rows — including the pipeline's own writes — are skipped.
- The `/translation-review` skill (`.claude/skills/translation-review/`) reviews the machine-translated interface strings in Claude Code and fixes them through `src/content/seed/ui-reviewed.ts` (applied by `sync-ui`); it also reviews the battle plan and other content, whose fixes the owner applies with `npm run content:fixes`; see SETUP.md § 2.

### KvK battle plan

`/kvk` is locked with one shared password per plan (`kvk_plans.password`). A correct entry sets an HttpOnly cookie holding an HMAC of the plan id and password, so changing the password logs everyone out. The `kvk_*` tables have no public read policy; the server reads them with the service-role key only after checking the cookie, and the password never reaches a component. Formations reference the `heroes` table; players tick off the ones they saved in the game (kept in their browser).

`/kvk/leaders` is the rally-leader plan of the same battle, behind its own password (`kvk_leader_briefs.password`, never the plan's) and its own cookie and throttle scope; `kvk_leader_rules` holds the leaders' instructions (for every leader, rally leads or garrison leads) and `kvk_rally_leaders` who leads which rally: battle team, position, UTC start time, when to use pets, heroes and ratio.

`/kvk/checklist` is the battle commander's checklist for the same battle, again behind its own password (`kvk_checklist_briefs.password`; no two pages of a battle may share one) and its own cookie and throttle scope. `kvk_checklist_items` are the tasks by phase (before battle day, battle day before the start, during, after), which the commander ticks off in their browser (per plan, so the next battle starts fresh), and `kvk_checklist_rules` the commander's orders and the general guidelines as do / don't / info lines. The header's KvK entry is a dropdown with all three pages.

`/kvk/prep` is public: the KvK preparation week, which repeats every four weeks (Day 0 on Sunday, Days 1–4 Monday to Thursday 00:00–24:00 UTC, Day 5 from Friday 00:00 UTC until the invasion on Saturday 10:00 UTC, shields up 10:00–22:00 UTC around the 12:00–17:00 UTC castle battle). Prep proper starts on Monday; Sunday is the get-ready day. The page shows a live status card, one tab per day with its own countdown, each day's ✅ use / 🆗 also counts lists with the points per item, ⚠ get-ready items, the council's tips (intel stacking with Master Pan, bison skill, Alliance RSS node, gathering speed boost, War Academy research, shield and home coordinates), the item × day table and the "save these for KvK" list. The schedule, the table, the points (the council's sheet, checked against kingshotdata.com) and the tips are fixed in `src/lib/kvk/prep.ts` and the `prep.*` interface strings; a change is a PR. The page and the Home card are static and the client picks today and fills the countdowns. Item pictures are 128px WebP files in `public/items/` (downloaded once, rendered `unoptimized` like the hero portraits); items without one keep their emoji.

### Rally Sync

`/tools/rally-sync` coordinates rally leaders so their rallies land at the same second (start = hit − rally timer − march). Moderators create rooms in the admin area (how many of each kind may be open at once, and how many leaders and browsers each takes, is the owner's setting on the admin Settings page, kept within what Supabase's free plan allows); players open a room with its invite link or its ID and password, and leaders add their name and march time. The coordinator (the creator's device or the coordinator link) sets the hit time with *Re-sync* (one tap; two while a rally is running, so a stray tap can't replace it) or a UTC time. A **counter-rally** room (each room's mode is fixed when it is created) has no hit time: it shows the counter alliance's launch order, slowest march first, and every other leader's cue, the countdown of an earlier counter rally (seen in the game's alliance war list) at which to start, so all of them land in the same second. Every browser in a room is an instance with its own signed cookie: the coordinator sees them all ("In the room": own name, leader name or "Watcher" + tag) and can remove any, and a password change keeps everyone who is in. A **garrison** room (fixed when the room is created) is for defenders instead: the coordinator marks each incoming enemy rally by tapping the countdown the game shows, the enemy leaders' recorded march times turn that into hit times, and every player's page works out when to send their refill so it lands in the gap between two hits, from a march time that stays on their device. Tables `rally_sync_rooms` (the garrison state is one JSON column), `rally_sync_leaders` and `rally_sync_instances` (migrations 0012–0015) have no policies; the database enforces the limits and broadcasts a content-free ping on a per-room Realtime topic, and pages refetch through `/api/rally-sync/[code]`, which also gives them the server clock. Rooms close after 30 minutes with nobody on the page (pg_cron and `npm run prune` delete them). Each room has a "?" in its status line for a short guided tour of the parts that visitor sees, in their language. Details in SETUP.md § 9b.

### Logging

Server code logs through `createLogger(scope)` (`src/lib/log.ts`): coloured lines in development, JSON lines in production that Vercel's log viewer parses. Route handlers, the unlock action and the admin actions tag every line with a `reqId`, which is also returned as the `x-request-id` header.

### Caching

Pages are prerendered and content is cached for 5 minutes (`cacheLife('content')` in `next.config.ts`). The translation webhook and `/api/revalidate` invalidate the cache immediately after a change.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run lint` / `npm run typecheck` / `npm run test` | ESLint, TypeScript, Vitest (tests in `tests/`) |
| `npm run db:seed` | Insert seed content into Supabase (idempotent) |
| `npm run translate` | Translate missing/outdated content with the configured provider |
| `npm run dev:admin` | Create the local development admin account (SETUP.md § 8.3) |
| `npm run backup` | Encrypted dump of all content and admin tables; `-- --restore <file> --yes` writes it back (SETUP.md § 10) |
| `npm run prune` | Delete battle feedback past its retention period and closed Rally Sync rooms (`-- --dry-run` to preview; SETUP.md § 9a, § 9b) |
| `npm run deployments:prune` | Delete old Vercel deployments, keeping the live one, the one before it and open pull requests' previews (`-- --dry-run` to preview; needs `VERCEL_TOKEN`, SETUP.md § 5) |

## License

All rights reserved. The code is public to read, but it is not open source and no license is granted: the code, its logic and its design may not be copied, reused or re-created (also not with AI tools) without written permission. Kingshot's names and images belong to the game's publisher. See [LICENSE](LICENSE).
