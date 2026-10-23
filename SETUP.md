# Setup guide — Kingdom 1241 website

Everything runs on free tiers — **GitHub** (code + CI), **Vercel** (hosting), **Supabase** (database + image storage) — plus an AI translation provider: **Anthropic** (Claude, recommended; about a dollar a month for this site) or **Google Gemini** (free tier). Discord login is a phase-2 feature; its keys are described at the end so the Supabase side is ready.

Nothing secret is ever committed. Keys live in `.env.local` on your machine, in the Vercel project settings and in the GitHub repository secrets.

## How a change reaches players

```
git push / merge to main
   ├─ GitHub Actions "CI"              lint · typecheck · tests · build   (also on every PR)
   ├─ GitHub Actions "Deploy database" applies supabase/migrations/*.sql  (only when a migration changed)
   └─ Vercel (Git integration)         builds and deploys main → production URL
                                       builds every PR → preview URL
```

Supabase content (announcements, rules, the KvK plan…) is edited in the Supabase table editor and shows up within 5 minutes, or immediately through the webhook — no deploy needed.

---

## 1. Supabase — database and image storage

1. Go to <https://supabase.com/dashboard>, **New project**. Pick a region close to most players (e.g. Frankfurt). **Save the database password** — CI needs it (step 6).
2. Note the values you'll need:
   - **Project Settings → General → Project ID** (the `abcdefghijklmnop` part of `https://abcdefghijklmnop.supabase.co`) → `SUPABASE_PROJECT_ID`
   - **Project Settings → API Keys**:
     - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
     - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` *(older projects show an `anon` key — that works too)*
     - **Secret key** (`sb_secret_…`, or the legacy `service_role` key) → `SUPABASE_SECRET_KEY`
   - <https://supabase.com/dashboard/account/tokens> → **Generate new token** (e.g. "GitHub Actions") → `SUPABASE_ACCESS_TOKEN`

   The publishable key is safe to expose; Row Level Security only lets it read published content. The secret key bypasses security and must only ever be set on the server (Vercel, GitHub secrets, your `.env.local`).
3. Create the tables. Either:
   - **Automatic (recommended):** finish step 6 and run the **Deploy database** workflow once. It applies every file in `supabase/migrations/` in order and remembers which ones ran.
   - **Manual:** **SQL Editor → New query**, paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), **Run**; then the same with [`0002_kvk.sql`](supabase/migrations/0002_kvk.sql). (The files are idempotent, so running them again later via CI is harmless.)

## 2. Translation provider — Anthropic (recommended) or Gemini

The pipeline only runs when content is added or edited, batches small texts together, and skips anything already translated, so the volume is tiny: translating the whole site into four languages costs about $1 on Claude Opus 5.5 (cents on Haiku), and a new announcement a few cents.

**Option A — Anthropic (Claude).** <https://platform.claude.com> → API keys → create one → `ANTHROPIC_API_KEY`. Load a small prepaid credit. Optional: `ANTHROPIC_MODEL` (default `claude-opus-5-5`; `claude-sonnet-5-5` is about half the price, `claude-haiku-5-5` a fortieth).

**Option B — Google Gemini (free tier).** <https://aistudio.google.com/apikey> → **Create API key** → `GEMINI_API_KEY`. Optional: `GEMINI_MODEL` (default `gemini-3.5-flash`; on 24 Oct 2026 `gemini-3.8-flash` took about 130 s per request for a fresh key versus 5 s, so check latency with one call before changing it). Google retires models for new keys from time to time; a 404 naming another model means updating this variable.

**Choosing / switching / turning it off.** The provider is picked automatically: Anthropic if `ANTHROPIC_API_KEY` is set, otherwise Gemini if `GEMINI_API_KEY` is set, otherwise off. Force it with `TRANSLATION_PROVIDER=anthropic | gemini | off` (in Vercel for the webhook, in GitHub *variables* for the Maintenance workflow, in `.env.local` locally). With translation off the site keeps working — players see English for anything not translated — and edits still refresh the cache.

## 3. Secrets you generate yourself

```bash
openssl rand -hex 32    # run twice
```

- First value → `TRANSLATE_WEBHOOK_SECRET` — protects `/api/translate` and `/api/revalidate`. Goes into Vercel, GitHub secrets and the webhook SQL (step 7).
- Second value → `KVK_SESSION_SECRET` — signs the KvK access cookie. Optional: when unset the webhook secret is used.
- `KVK_SEED_PASSWORD` (optional) — the password the seed script writes into the placeholder battle plan (default `1241`). The real password is set in the `kvk_plans` table (step 9).

## 4. Run it locally

```bash
cp .env.example .env.local      # fill in the values from steps 1–3
npm install
npm run db:seed                  # boilerplate content, heroes and a placeholder KvK plan → Supabase (safe to re-run)
npm run translate                # fill in German/Korean/Polish/Arabic with Gemini
npm run dev                      # http://localhost:3000
```

Without any env vars the site still runs with the bundled English seed content (KvK password `1241`) — handy for checking the design. With Supabase configured the pages read from the database.

| Command | What it does |
| --- | --- |
| `npm run db:seed` | Inserts seed rows that don't exist yet (never touches rows you edited). `-- --sync-ui` also updates the interface strings from the code (after a wording change). `-- --overwrite` replaces every seed row, dropping translations. |
| `npm run translate` | Translates everything missing or outdated. `-- --table guides`, `-- --locale de`, `-- --force`, `-- --dry-run`. |
| `npm run test` / `npm run lint` / `npm run typecheck` | Checks (tests live in `tests/`, mirroring `src/`). |
| `npm run build` | Production build (what Vercel and CI run). |

## 5. Vercel — hosting with automatic deploys

1. Push the repository to GitHub. Go to <https://vercel.com/new>, **Import** `kingdom-1241`. Framework preset: **Next.js** (auto-detected), no build settings to change. Production branch: `main` (default).
2. Before the first deploy open **Environment Variables** and add, for **Production** and **Preview**:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | step 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | step 1 |
   | `SUPABASE_SECRET_KEY` | step 1 (mark as *Sensitive*) — also needed by the KvK page |
   | `ANTHROPIC_API_KEY` | step 2, option A (*Sensitive*) |
   | `GEMINI_API_KEY` | step 2, option B (*Sensitive*, optional) |
   | `TRANSLATION_PROVIDER` | optional: `anthropic`, `gemini` or `off` |
   | `TRANSLATE_WEBHOOK_SECRET` | step 3 (*Sensitive*) |
   | `KVK_SESSION_SECRET` | step 3 (*Sensitive*, optional) |
   | `SITE_URL` | your site URL, e.g. `https://kingdom-1241.vercel.app` (fill in after the first deploy) |
   | `LOG_LEVEL` | optional, `info` (default) or `debug` while investigating a problem |

3. **Deploy**. Note the URL (`https://<project>.vercel.app`), set it as `SITE_URL`, redeploy. A custom domain can be added under **Settings → Domains** at any time.

From now on Vercel deploys **every push to `main` to production** and **every pull request to a preview URL** (the link appears on the PR). Vercel's build doesn't wait for GitHub Actions, so protect `main` (step 6c) — then only code that passed CI can reach `main`.

The site sends `noindex` headers and a `robots.txt` that blocks every crawler; it is only reachable through the shared link.

## 6. GitHub Actions — CI and database deploys

Three workflows live in `.github/workflows/`:

| Workflow | Runs when | Does |
| --- | --- | --- |
| **CI** | every PR, every push to `main` | `npm ci`, lint, typecheck, unit tests, production build |
| **Deploy database** | a push to `main` that touches `supabase/migrations/`, or manually | `supabase link` + `supabase db push` — applies new migration files to the production database |
| **Maintenance** | manually (Actions → Maintenance → Run workflow) | `seed`, `translate`, `translate-dry-run` or `revalidate` without a laptop |

**a. Add the secrets** — GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Used by | Value |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Deploy database | personal access token (step 1) |
| `SUPABASE_PROJECT_ID` | Deploy database | project ref (step 1) |
| `SUPABASE_DB_PASSWORD` | Deploy database | database password (step 1) |
| `NEXT_PUBLIC_SUPABASE_URL` | Maintenance | step 1 |
| `SUPABASE_SECRET_KEY` | Maintenance | step 1 |
| `ANTHROPIC_API_KEY` | Maintenance | step 2, option A |
| `GEMINI_API_KEY` | Maintenance | step 2, option B (optional) |
| `SITE_URL` | Maintenance | step 5 |
| `TRANSLATE_WEBHOOK_SECRET` | Maintenance | step 3 |
| `KVK_SEED_PASSWORD` | Maintenance (optional) | step 3 |

**b. First run** — Actions → **Deploy database** → **Run workflow** (creates the tables), then Actions → **Maintenance** → task `seed`, then task `translate`.

**c. Protect `main`** — **Settings → Branches → Add branch ruleset** (or *Add rule*) for `main`: *Require a pull request before merging* and *Require status checks to pass* → pick **Lint, typecheck, test, build**. With that, a green CI is the gate for every production deploy.

**d. Adding a migration later** — add `supabase/migrations/0003_<name>.sql`, open a PR, merge. CI checks the code, Deploy database applies the SQL, Vercel deploys the app. Never edit a migration that has already run; add a new file.

## 7. Supabase → site webhooks (automatic translation)

Translation runs when a row is inserted or edited in Supabase — never when a page is viewed. Supabase tells the site about changes through Database Webhooks:

1. Dashboard → **Database → Webhooks** → **Enable webhooks** (one-time).
2. **SQL Editor**, paste [`supabase/webhooks.sql`](supabase/webhooks.sql), replace `YOUR-SITE.vercel.app` and `YOUR_TRANSLATE_WEBHOOK_SECRET` with your values, **Run**. Re-run it whenever a new content table is added (the file lists them).

That creates one trigger per content table. Each change POSTs to `/api/translate`, which answers immediately, translates the row in the background (only if its English text changed — so its own write doesn't cause a loop) and refreshes the page cache. You can watch the calls under **Database → Webhooks** and in the Vercel function logs (search for the `reqId` printed in the response).

Without webhooks the site still works: run `npm run translate` (or the Maintenance workflow) after editing, and the cache refreshes itself every 5 minutes.

## 8. Discord OAuth (ready for phase 2)

Admins and moderators will sign in with Discord through Supabase Auth.

1. <https://discord.com/developers/applications> → **New Application** (e.g. "Kingdom 1241 site").
2. **OAuth2** → copy **Client ID** → `DISCORD_CLIENT_ID`, and **Reset Secret** → `DISCORD_CLIENT_SECRET`.
3. Under **Redirects** add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Supabase Dashboard → **Authentication → Sign In / Providers → Discord** → enable, paste the Client ID and Secret, save.
5. Add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to Vercel (*Sensitive*) and to `.env.local`. Phase 1 doesn't read them yet.

## 9. KvK battle plan (password-locked page)

Kingdom 1241 alternates two events every two weeks — the **internal castle battle** (practice inside the kingdom) and **KvK** (against another kingdom). Both use the same page and password: the `/kvk` page shows the plan whose row in `kvk_plans` has `active = true`, and its `event_type` (`castle_battle` or `kvk`) is shown as a badge. Players unlock it with one shared password; the site stores a signed cookie for 30 days. The `kvk_*` tables have **no public read policy** — only the server (with `SUPABASE_SECRET_KEY`) can read them, so the plan can't be pulled from the database API.

**Change the password:** Table Editor → `kvk_plans` → edit `password`. Everyone is logged out immediately (the cookie is derived from the password) — share the new one on Discord.

**Edit the plan** (`kvk_plans`): `event_type` (`castle_battle` or `kvk`), `title` and `intro` (HTML, translated automatically), `opponent` (KvK only), `battle_at` (UTC — the page converts it to each player's local time and counts down), `min_hero_stars` (default 4), `min_skill_level` (the required level of the hero's Top Expedition Skill — the top-right skill with the flag icon; default 5).

**Instructions** (`kvk_rules`): one row per bullet; `kind` is `do`, `dont` or `info`; `sort_order` orders them.

**Coordinators** (`kvk_coordinators`): `team` is which battle alliance they run — `kvk` ([KvK], rallies the castle) or `tmp` ([TMP], counter-rallies); `name` is the in-game name; `alliance_tag` is their home alliance and colours the badge (must match `alliances.tag`); `note` e.g. the languages they speak.

**Formations** (`kvk_formations`, up to 12 — the game's preset slots):

| Column | Meaning |
| --- | --- |
| `label` | The preset name players save in the game: `A`, `B`, … |
| `side` | `attack`, `defense` or `any` |
| `role` | `rally_lead`, `rally_join` or `any` |
| `hero_1` … `hero_3` | Hero slugs from the `heroes` table (`amane`, `long-fei`, …). Leave empty for "any hero". |
| `infantry_pct` / `cavalry_pct` / `archers_pct` | Troop ratio; must add up to 100 |
| `note` | Optional hint, translated automatically |

Formations tagged with a side or role get filter chips on the page; untagged ones show as "attack or defense".

**Heroes** (`heroes`): one row per hero with `slug`, `name`, `troop_type`, `rarity`, `generation`, `icon_url`. The seed ships 37 heroes with 128px portraits in `public/heroes/`. To add a new hero, insert a row and set `icon_url` to any image URL (e.g. upload the portrait to the `images` storage bucket and use its public URL).

**Next event (castle battle → KvK → castle battle …):** insert a new `kvk_plans` row (new `slug`, `event_type`, password), add its rules/coordinators/formations, then set `active = false` on the old row and `active = true` on the new one (only one plan can be active). Keeping old rows gives you a history for later.

---

## Everyday tasks

**Edit content.** Supabase Dashboard → **Table Editor**. Edit the `en` value inside the JSON of `title`, `body`, etc. (bodies are HTML). Save — the webhook translates the other languages within a minute. Set `published` to false to hide a row.

**Alliances.** Table `alliances`: `tag`, `name`, `color` (hex), `power`, `members`, `leader`, `description`, `requirements`, `languages`, `discord_url`, `sort_order` (= ranking on the home page). The seed contains the five alliances of 1241 with their power from the in-game ranking; fill in the rest, or wait for the MightPulse sync (phase 4).

**Add a language.** Insert a row in `languages` (e.g. `fr`, enabled, sort order) — if the code isn't in `src/lib/i18n/languages.ts` yet, add it there (name, direction, font) and deploy. Then run `npm run translate` (or the Maintenance workflow) once to backfill existing content.

**Fix a translation by hand.** Edit the language's value in the JSON. It stays until the English text of that row changes, which re-translates every language.

**Refresh the cache now.** Content is cached for up to 5 minutes. To refresh immediately: Maintenance workflow → `revalidate`, or

```bash
curl -X POST https://<your-site>/api/revalidate -H "Authorization: Bearer <TRANSLATE_WEBHOOK_SECRET>"
```

**Change site settings.** Table `site_settings`: `kingdom_name`, `tagline`, `daily_reset_utc_hour`, `discord_invite_url`, `transfer_contact`.

## Logs

Vercel → your project → **Logs**. In production every server log line is JSON with `level`, `scope` (`data`, `translate`, `kvk`, `proxy`, …), `msg` and `reqId`. Every page response and API response carries the same id in the `x-request-id` header (API responses also return it in the JSON body), so a screenshot of an error can be matched with its log line. Set `LOG_LEVEL=debug` in Vercel (and redeploy) to see the translation pipeline's per-batch messages; set it back to `info` afterwards.

## Troubleshooting

- **Pages show the seed content, not my edits.** Check the Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL` / `…PUBLISHABLE_KEY`) and redeploy; the data layer falls back to the bundled seed when Supabase is unreachable (look for `"Failed to load from Supabase"` in the logs).
- **The KvK page says "No battle plan has been published yet".** Either no row in `kvk_plans` has `active = true` and `published = true`, or `SUPABASE_SECRET_KEY` is missing in Vercel (the logs say which).
- **Translations don't appear.** Logs: scope `translate`. Common causes: webhook SQL still has placeholders, secret mismatch (401), no provider key (`ANTHROPIC_API_KEY` / `GEMINI_API_KEY`) or `TRANSLATION_PROVIDER=off`, provider quota or a retired model (the row keeps its old `source_hash`, so the next `npm run translate` finishes it).
- **A language shows English text.** The row has no translation for it yet (fallback is intentional). Run `npm run translate`.
- **`npm run db:seed` fails with "Supabase admin client needs…".** `.env.local` is missing `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SECRET_KEY`.
- **Deploy database fails at `supabase link`.** Check `SUPABASE_ACCESS_TOKEN` (not expired), `SUPABASE_PROJECT_ID` (the ref, not the URL) and `SUPABASE_DB_PASSWORD`. Fails at `db push` with "already exists"? The migration was applied by hand before; the files are idempotent, so re-run — if it still fails, run `supabase migration repair --status applied <version>` locally once (see the Supabase CLI docs).
- **CI fails but it works on my machine.** CI uses the Node version in `.nvmrc` (24, the same major Vercel runs; `engines` in package.json pins it for Vercel) and `npm ci` (exact lockfile). Run `nvm use && npm ci && npm run lint && npm run typecheck && npm run test && npm run build` locally.
