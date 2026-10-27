# Kingdom 1241

Community website for **Kingshot Kingdom 1241** — rules, announcements, event times in every player's time zone, guides and tools, in ten languages (English, German, Korean, Polish, Arabic, Turkish, Italian, Japanese, Traditional Chinese, French — more are a table row away). Modelled on 1424.win, hosted for free.

**Live today:** site layout, ten languages, Home (with the real alliances of 1241), Events, Rules, Guides, Tools, the password-locked **KvK battle plan** (formations with hero portraits and troop ratios, coordinators, instructions — for both the internal castle battle and KvK, which alternate every two weeks), the separate password-locked **rally-leader plan** (who leads which rally with which of their own heroes and troop ratio), the **battle feedback** form players fill in after each battle (star ratings and short texts, Governor ID checked through MightPulse, results, CSV export and an on-demand AI summary for the council, deleted automatically after 30 days) and the **admin area** (Discord sign-in, roles, battle-plan editor, feedback results, per-language translation fixes). What comes next is in [docs/PLAN.md](docs/PLAN.md) § Phases, the one place where the roadmap lives.

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
  app/[locale]/           pages: / (home), /events, /rules, /guides, /guides/[slug], /kvk, /kvk/feedback, /kvk/leaders, /tools
  app/[locale]/admin/     council area (Discord sign-in): overview, battle-plan editor, feedback results + CSV export, users; English only
  app/auth/callback       finishes the Discord sign-in (code → session cookies)
  app/api/translate       Supabase webhook → translation provider → writes translations back, refreshes cache
  app/api/revalidate      manual cache refresh
  proxy.ts                sends /, /events, … to the visitor's language; adds x-request-id; refreshes the admin session
  components/             layout (header, bottom tab bar, language switcher, theme), home, kvk, tools, admin (forms)
  content/seed/           boilerplate content, heroes, placeholder battle plan, UI strings (en/de/ko/pl/ar)
  lib/auth/               Supabase Auth session (cookies), identity → profile, roles, pre-authorisations, sign-in actions
  lib/admin/              uncached admin loaders, Server Actions (plan editor, users, profile), FormData parsers, shared action replies, audit log
  lib/data/               cached loaders ('use cache' + tags), cache tags per table, Supabase ↔ app type mappers
  lib/i18n/               language registry (direction, font), fallback helper, negotiation
  lib/kvk/                password locks (one signed cookie per page: plan, leaders), Server Actions, formation helpers
  lib/retro/              battle feedback: question catalogue, form rules, MightPulse lookup, summary maths, CSV, retention and prune
  lib/log.ts              structured logger (pretty in dev, JSON lines in production) + request ids
  lib/translate/          provider switch (Anthropic / Gemini / off), shared prompt + glossary, batched row translator with change hashes
  lib/backup/             what the encrypted content backup contains and how it is restored (pure; the script is scripts/backup.ts)
  lib/tools/              pure calculator logic (rally refill, pack value)
tests/                    unit tests, same tree as src/ (tests/lib/kvk/access.test.ts ↔ src/lib/kvk/access.ts); tests/architecture keeps server-only code out of Client Components
public/heroes/            128px hero portraits (from kingshotdata.com)
supabase/
  migrations/000N_*.sql     schema, one additive file per change (init, kvk, admin auth, game names, alliance tag, unlock throttle, …)
  webhooks.sql              wires every content table to /api/translate (Maintenance → webhooks runs it)
  config.toml               Supabase auth settings declared in code (Maintenance → config-push applies them)
scripts/
  seed.ts                 npm run db:seed
  translate.ts            npm run translate
  dev-admin.ts            npm run dev:admin (local admin account, see SETUP.md § 8.3)
  backup.ts               npm run backup (encrypted dump and restore of all content, SETUP.md § 10)
  prune.ts                npm run prune (deletes battle feedback past its retention period, SETUP.md § 9a)
.github/workflows/        CI (lint/typecheck/test/build), Deploy database (migrations; dry run on PRs), Maintenance (seed, translate, revalidate, weekly encrypted backup, webhooks, config push); dependabot.yml for updates
```

### Languages and translation

- The list of offered languages is the `languages` table (seeded with English, German, Korean, Polish, Arabic). Each code maps to a text direction and font stack in `src/lib/i18n/languages.ts`; Arabic renders fully right-to-left.
- Every translatable field is a JSON object `{"en": …, "de": …}`. English is the source; pages fall back to English for anything missing.
- Translation happens in `src/lib/translate`: a Supabase webhook (or `npm run translate`) sends the English text with a game-term glossary to the configured provider (Anthropic Claude or Gemini; `TRANSLATION_PROVIDER` switches or turns it off). A hash of the English source is stored on the row, so unchanged rows — including the pipeline's own writes — are skipped.

### KvK battle plan

`/kvk` is locked with one shared password per plan (`kvk_plans.password`). A correct entry sets an HttpOnly cookie holding an HMAC of the plan id and password, so changing the password logs everyone out. The `kvk_*` tables have no public read policy; the server reads them with the service-role key only after checking the cookie, and the password never reaches a component. Formations reference the `heroes` table; players tick off the ones they saved in the game (kept in their browser).

`/kvk/leaders` is the rally-leader plan of the same battle, behind its own password (`kvk_leader_briefs.password`, never the plan's) and its own cookie and throttle scope; `kvk_leader_rules` holds the leaders' instructions (for every leader, rally leads or garrison leads) and `kvk_rally_leaders` who leads which rally: battle team, position, UTC start time, when to use pets, heroes and ratio. The header's KvK entry is a dropdown with both pages.

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
| `npm run prune` | Delete battle feedback past its retention period (`-- --dry-run` to preview; SETUP.md § 9a) |

## License

MIT — see [LICENSE](LICENSE).
