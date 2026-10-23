# Kingdom 1241 — instructions for Claude

Community website for Kingshot Kingdom 1241 (rules, events, guides, tools, later KvK sign-ups and an admin panel). Free hosting: Vercel + Supabase + Gemini. The product plan with all phases is in `docs/PLAN.md`; setup and keys are in `SETUP.md`; the code map is in `README.md`. Read those before starting a task.

## Working agreement

- Work on a feature branch (`feat/<phase-or-topic>`), commit in small steps with clear messages, open a PR against `main` when done. Never commit secrets: `.env.local` is ignored, only `.env.example` is tracked.
- Before pushing, all of these must pass: `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.
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
- Tailwind v4: tokens are CSS variables in `src/app/globals.css` mapped through `@theme inline`; custom component classes live in `@layer components` and must not be `@apply`-ed by other classes (define a `@utility` instead, e.g. `tabular`). Dark mode is the `.dark` class (next-themes).

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
- Seed data: `npm run db:seed` inserts missing rows only; `--overwrite` replaces seed rows (and drops their translations).

## Roadmap (see docs/PLAN.md for details)

1. **Done** — layout, languages, Home, Events, Rules, Guides, Tools.
2. Admin panel: Discord login (Supabase Auth), roles, rich-text editor with image upload (resize client-side, `images` bucket), language management, manual translation fixes.
3. KvK: battle-day sign-ups with Governor ID validation, group lists, password-locked battle plan with name search, KvK history, spreadsheet exports.
4. Alliance pages synced from MightPulse; transfers section with on/off switch.
5. Minister appointment booking with automatic slot allocation.

Open questions from the plan (ask the owner, don't guess): final alliance list/tags/colours, real event times and rules, site domain.
