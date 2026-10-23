# Kingdom 1241

Community website for **Kingshot Kingdom 1241** — rules, announcements, event times in every player's time zone, guides and tools, in five languages (and counting). Modelled on 1424.win, hosted for free.

**Phase 1** (this repo today): site layout, languages, Home, Events, Rules, Guides, Tools.
Later phases add the admin panel with Discord login, KvK sign-ups and battle plan, alliance pages from MightPulse, transfers and minister bookings.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript, Cache Components) on **Vercel**
- [Supabase](https://supabase.com) Postgres + Storage for content and images
- [Gemini](https://ai.google.dev) for translations — run only when content is added or edited, never on page view
- Tailwind CSS v4, self-hosted fonts (Nunito, Noto Sans KR, Noto Sans Arabic)

See **[SETUP.md](SETUP.md)** for getting the keys and deploying, **[docs/PLAN.md](docs/PLAN.md)** for the full product plan and phases, and **[CLAUDE.md](CLAUDE.md)** for the working conventions.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional — the site runs on bundled seed content without it
npm run dev
```

## How it fits together

```
src/
  app/[locale]/           pages: / (home), /events, /rules, /guides, /guides/[slug], /tools
  app/api/translate       Supabase webhook → Gemini → writes translations back, refreshes cache
  app/api/revalidate      manual cache refresh
  proxy.ts                sends /, /events, … to the visitor's language (/en/events)
  components/             layout (header, bottom tab bar, language switcher, theme), pages, tools
  content/seed/           boilerplate content + hand-translated UI strings (en/de/ko/pl/ar)
  lib/data/               cached loaders ('use cache' + tags), Supabase ↔ app type mappers
  lib/i18n/               language registry (direction, font), fallback helper, negotiation
  lib/translate/          Gemini client, glossary, batched row translator with change hashes
  lib/tools/              pure calculator logic (rally refill, pack value) + tests
supabase/
  migrations/0001_init.sql  schema, RLS, storage bucket
  webhooks.sql              one-shot SQL to wire every table to /api/translate
scripts/
  seed.ts                 npm run db:seed
  translate.ts            npm run translate
```

### Languages and translation

- The list of offered languages is the `languages` table (seeded with English, German, Korean, Polish, Arabic). Each code maps to a text direction and font stack in `src/lib/i18n/languages.ts`; Arabic renders fully right-to-left.
- Every translatable field is a JSON object `{"en": …, "de": …}`. English is the source; pages fall back to English for anything missing.
- Translation happens in `src/lib/translate`: a Supabase webhook (or `npm run translate`) sends the English text with a game-term glossary to Gemini. A hash of the English source is stored on the row, so unchanged rows — including the pipeline's own writes — are skipped.

### Caching

Pages are prerendered and content is cached for 5 minutes (`cacheLife('content')` in `next.config.ts`). The translation webhook and `/api/revalidate` invalidate the cache immediately after a change.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `npm run build` / `npm start` | Next.js |
| `npm run lint` / `npm run typecheck` / `npm run test` | ESLint, TypeScript, Vitest |
| `npm run db:seed` | Insert seed content into Supabase (idempotent) |
| `npm run translate` | Translate missing/outdated content with Gemini |

## License

MIT — see [LICENSE](LICENSE).
