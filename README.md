# Kingdom 1241

Community website for **Kingshot Kingdom 1241** — rules, announcements, event times in every player's time zone, guides and tools, in five languages (and counting). Modelled on 1424.win, hosted for free.

**Live today:** site layout, languages, Home (with the real alliances of 1241), Events, Rules, Guides, Tools, and the password-locked **KvK battle plan** (formations with hero portraits and troop ratios, coordinators, instructions — for both the internal castle battle and KvK, which alternate every two weeks).
Later phases add the admin panel with Discord login, KvK sign-ups and history, alliance pages from MightPulse, transfers and minister bookings.

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
  app/[locale]/           pages: / (home), /events, /rules, /guides, /guides/[slug], /kvk, /tools
  app/api/translate       Supabase webhook → Gemini → writes translations back, refreshes cache
  app/api/revalidate      manual cache refresh
  proxy.ts                sends /, /events, … to the visitor's language; adds x-request-id
  components/             layout (header, bottom tab bar, language switcher, theme), home, kvk, tools
  content/seed/           boilerplate content, heroes, placeholder battle plan, UI strings (en/de/ko/pl/ar)
  lib/data/               cached loaders ('use cache' + tags), Supabase ↔ app type mappers
  lib/i18n/               language registry (direction, font), fallback helper, negotiation
  lib/kvk/                password lock (signed cookie), Server Actions, formation helpers
  lib/log.ts              structured logger (pretty in dev, JSON lines in production) + request ids
  lib/translate/          provider switch (Anthropic / Gemini / off), shared prompt + glossary, batched row translator with change hashes
  lib/tools/              pure calculator logic (rally refill, pack value)
tests/                    unit tests, same tree as src/ (tests/lib/kvk/access.test.ts ↔ src/lib/kvk/access.ts)
public/heroes/            128px hero portraits (from kingshotdata.com)
supabase/
  migrations/0001_init.sql  schema, RLS, storage bucket
  migrations/0002_kvk.sql   heroes + battle plan tables (service-role only)
  webhooks.sql              one-shot SQL to wire every table to /api/translate
  config.toml               Supabase CLI config (used by the Deploy database workflow)
scripts/
  seed.ts                 npm run db:seed
  translate.ts            npm run translate
.github/workflows/        CI (lint/typecheck/test/build), Deploy database (migrations), Maintenance
```

### Languages and translation

- The list of offered languages is the `languages` table (seeded with English, German, Korean, Polish, Arabic). Each code maps to a text direction and font stack in `src/lib/i18n/languages.ts`; Arabic renders fully right-to-left.
- Every translatable field is a JSON object `{"en": …, "de": …}`. English is the source; pages fall back to English for anything missing.
- Translation happens in `src/lib/translate`: a Supabase webhook (or `npm run translate`) sends the English text with a game-term glossary to the configured provider (Anthropic Claude or Gemini; `TRANSLATION_PROVIDER` switches or turns it off). A hash of the English source is stored on the row, so unchanged rows — including the pipeline's own writes — are skipped.

### KvK battle plan

`/kvk` is locked with one shared password per plan (`kvk_plans.password`). A correct entry sets an HttpOnly cookie holding an HMAC of the plan id and password, so changing the password logs everyone out. The `kvk_*` tables have no public read policy; the server reads them with the service-role key only after checking the cookie, and the password never reaches a component. Formations reference the `heroes` table; players tick off the ones they saved in the game (kept in their browser).

### Logging

Server code logs through `createLogger(scope)` (`src/lib/log.ts`): coloured lines in development, JSON lines in production that Vercel's log viewer parses. Route handlers and the unlock action tag every line with a `reqId`, which is also returned as the `x-request-id` header.

### Caching

Pages are prerendered and content is cached for 5 minutes (`cacheLife('content')` in `next.config.ts`). The translation webhook and `/api/revalidate` invalidate the cache immediately after a change.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run lint` / `npm run typecheck` / `npm run test` | ESLint, TypeScript, Vitest (tests in `tests/`) |
| `npm run db:seed` | Insert seed content into Supabase (idempotent) |
| `npm run translate` | Translate missing/outdated content with Gemini |

## License

MIT — see [LICENSE](LICENSE).
