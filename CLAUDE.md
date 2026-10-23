# Kingdom 1241 — instructions for Claude

Community website for Kingshot Kingdom 1241 (rules, events, guides, tools, later KvK sign-ups and an admin panel). Free hosting: Vercel + Supabase + Gemini. The product plan with all phases is in `docs/PLAN.md`; setup and keys are in `SETUP.md`; the code map is in `README.md`. Read those before starting a task.

## Working agreement

- Work on a feature branch (`feat/<phase-or-topic>`), commit in small steps with clear messages, open a PR against `main` when done. Never commit secrets: `.env.local` is ignored, only `.env.example` is tracked.
- Before pushing, all of these must pass: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`. The same four run in GitHub Actions (`.github/workflows/ci.yml`) on every PR; `main` is protected by that check and Vercel deploys `main`.
- Unit tests live in `tests/`, mirroring `src/` (`src/lib/kvk/access.ts` → `tests/lib/kvk/access.test.ts`), never next to the source file. Import the code under test through the `@/` alias. Add tests for any new pure logic (helpers, mappers, seed validity).
- Keep the site light: it runs on free tiers. No new dependencies without a clear reason, no client-side libraries for things CSS or a few lines can do, small images (hero portraits are 128px and rendered with `unoptimized` to save image transformations), everything cacheable stays in the static shell.
- For UI changes, check the result in a browser on a phone-width viewport (390px) and desktop, in light and dark mode, and in Arabic (`/ar/...`) for RTL. Playwright with the bundled Chromium works for screenshots.
- Seed content is boilerplate that admins will edit; don't invent "real" kingdom facts (alliances, times, rules). Mark placeholders clearly.
- This is a noindex community site; keep it that way (`robots.ts` + robots meta in the root layout).

## Next.js 16 rules (Cache Components is ON)

`AGENTS.md` is right: this Next.js differs from older training data. Consult `node_modules/next/dist/docs` for anything Next-specific. Rules that matter here:

- Data loaders in `src/lib/data/index.ts` are `"use cache"` functions with `cacheLife("content")` (5-minute profile defined in `next.config.ts`) and `cacheTag(...)`. Add new content loaders the same way and register their table → tag in `cacheTagForTable`. Invalidate with `revalidateTag(tag, { expire: 0 })` in route handlers (webhook, `/api/revalidate`).
- Never call `cookies()`, `headers()`, `searchParams` or `Date.now()`/`new Date()` in Server Components outside a cache or Suspense boundary; it breaks prerendering. Time-dependent UI (clock, countdowns, expiry checks) lives in Client Components using `useNow()` (`src/components/time/useNow.ts`), which returns `null` until hydrated.
- Client hooks that read the URL (`usePathname`, `useParams`, `useSelectedLayoutSegment`, `useSearchParams`) must sit in a small leaf component wrapped in `<Suspense>` — see `src/components/layout/NavLink.tsx`. Event handlers may read `window.location` directly.
- Routes with dynamic params below `[locale]` should `await params` inside a Suspense boundary (see `guides/[slug]/page.tsx`) and provide `generateStaticParams`.
- The root layout is `src/app/[locale]/layout.tsx`; `[locale]` is a root param, read it with `import { locale } from "next/root-params"`. `proxy.ts` (not middleware) adds the locale prefix to bare URLs.
- React lint rules are strict: no `setState` directly inside effects (use `useSyncExternalStore` for external state), no impure calls during render.
- Tailwind v4: tokens are CSS variables in `src/app/globals.css` mapped through `@theme inline`; custom component classes live in `@layer components` and must not be `@apply`-ed by other classes (define a `@utility` instead, e.g. `tabular`, `no-scrollbar`). Dark mode is the `.dark` class (next-themes).
- Tailwind classes are linted by `eslint-plugin-better-tailwindcss` (part of `npm run lint`, which fails on warnings): canonical forms (`max-h-[28rem]` → `max-h-112`, `leading-tight` folded into `text-xs/tight`, `start-1` → `inset-s-1`, `[var(--x)]` → `(--x)`), shorthands, class order, duplicate/conflicting/unknown classes. Run `npx eslint --fix` to apply the automatic ones. `@apply` lines in CSS aren't linted — keep them canonical by hand. The `enforce-logical-properties` rule is off on purpose (it also rewrites heights and borders); keep using `ms-/me-/ps-/pe-/start-/end-/text-start` for the inline axis yourself.

## Logging

- Server code logs through `createLogger(scope)` from `src/lib/log.ts` — never bare `console.*` in app code (CLI scripts in `scripts/` may print). Development output is pretty, production output is one JSON line per event (Vercel parses it). Levels: `debug` (per-batch detail), `info` (normal events), `warn` (degraded, e.g. seed fallback), `error` (needs a look).
- Route handlers and Server Actions take a request id with `requestId(request | headers)` (Vercel's `x-vercel-id`, else random), log with `log.child({ reqId })` and echo it as the `x-request-id` header. `proxy.ts` forwards it to pages.
- Never log secrets, passwords, cookies or full row contents; log ids, table names, counts and durations (`elapsedMs`).

## Internationalisation rules

- Every piece of text players see is translatable. Interface strings live in `src/content/seed/ui-strings.ts` (typed keys; English + hand-written de/ko/pl/ar); pages get them via `getDictionary(locale)` and pass the `Dictionary` object down as a prop to Client Components. Add a new key there with all five languages when you add UI text.
- Content fields are `Localized` JSON (`{ en, de, ... }`); read with `pick(value, locale)` which falls back to English. English is always the source language.
- Use logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) and `rtl:` variants, never left/right, so Arabic mirrors correctly. Put `dir="auto"` on elements that show content text (so English fallback reads correctly on RTL pages) and `dir="ltr"` on codes, numbers and clocks.
- Language list = `languages` table (seeded in `src/content/seed/languages.ts`); direction/font per code = `src/lib/i18n/languages.ts`. Adding a language means both places plus `npm run translate`.
- Translation is done only by the pipeline in `src/lib/translate` (Gemini, glossary in `glossary.ts`), triggered by Supabase webhooks → `POST /api/translate` or `npm run translate`. Never translate during a page render. Rows carry a `source_hash`; keep that mechanism when adding tables (add them to `src/lib/translate/tables.ts` and `supabase/webhooks.sql`).

## Data and security

- Schema changes go in a new file `supabase/migrations/000N_<name>.sql` (don't edit `0001_init.sql` after it has been applied). Keep RLS on; the anon key may only read published rows. Writes use the service-role client (`src/lib/supabase/admin.ts`) from server code and scripts only — never import it in Client Components.
- Rich text is stored as HTML and must pass through `sanitizeRichText` on write and on render (`RichText` component).
- API routes that mutate or revalidate are protected by `TRANSLATE_WEBHOOK_SECRET` (`src/lib/api-auth.ts`). Phase 2 adds Supabase Auth (Discord) with roles `admin` / `moderator`; the public site stays login-free.
- **KvK battle plan** (`/kvk`): the `kvk_*` tables have no anon read policy — read them only through `createAdminClient()` in server code (`getActiveKvkPlan`). The visitor's cookie is an HMAC of plan id + password (`src/lib/kvk/access.ts`); verify it in a Server Component inside `<Suspense>` (`KvkGate`), strip `password` before passing the plan to any component, and keep the unlock check in the Server Action (`src/lib/kvk/actions.ts`). On any data problem return `null` (page shows "no plan"), never the seed plan. One `kvk_plans` row is active at a time; `event_type` says whether it is the internal castle battle or the cross-kingdom KvK (they alternate every two weeks). `[KvK]` and `[TMP]` are the kingdom's two battle alliances (castle rallies / counter-rallies), not game terms.
- Schema changes: add `supabase/migrations/000N_<name>.sql`; the Deploy database workflow applies it on merge. Keep files idempotent (`if not exists`, `drop … if exists`) so a manual run and the CLI run can coexist.
- Seed data: `npm run db:seed` inserts missing rows only; `--overwrite` replaces seed rows (and drops their translations).

## Roadmap (see docs/PLAN.md for details)

1. **Done** — layout, languages, Home, Events, Rules, Guides, Tools.
2. Admin panel: Discord login (Supabase Auth), roles, rich-text editor with image upload (resize client-side, `images` bucket), language management, manual translation fixes, editing the KvK plan and formations.
3. KvK: **done** — password-locked battle plan with formations (hero portraits, troop ratios), coordinators, instructions, hero catalogue. **Open** — battle-day sign-ups with Governor ID validation, group lists, name search for assignments, KvK history, spreadsheet exports.
4. Alliance pages synced from MightPulse; transfers section with on/off switch.
5. Minister appointment booking with automatic slot allocation.

Open questions from the plan (ask the owner, don't guess): real event times and rules, exact dates of the castle battle / KvK cycle, site domain. The alliance list is real (seeded from the in-game ranking); leaders, member counts and descriptions still come from the R5s.
