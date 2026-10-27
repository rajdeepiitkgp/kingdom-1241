# Setup guide — Kingdom 1241 website

Everything runs on free tiers — **GitHub** (code + CI), **Vercel** (hosting), **Supabase** (database + image storage) — plus an AI translation provider: **Anthropic** (Claude, recommended; about a dollar a month for this site) or **Google Gemini** (free tier). Admin sign-in (Discord through Supabase Auth) is described in § 8.

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
   - **Manual:** **SQL Editor → New query**, paste each file of [`supabase/migrations/`](supabase/migrations/) in name order (`0001_init.sql`, `0002_kvk.sql`, … up to the newest), **Run** after each. The files are idempotent, so the CI run later is harmless; if it then complains that something "already exists", see Troubleshooting.

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
- `KVK_SEED_PASSWORD` (optional) — the password the seed script writes into the placeholder battle plan (default `1241`). The real password is set in the `kvk_plans` table (step 9). `KVK_SEED_LEADER_PASSWORD` (optional, default `1241-leaders`) does the same for the placeholder rally-leader page; change it under Admin → Battle plans → Rally leaders. `KVK_SEED_CHECKLIST_PASSWORD` (optional, default `1241-commander`) does the same for the placeholder commander checklist; change it under Admin → Battle plans → Checklist.

## 4. Run it locally

```bash
cp .env.example .env.local      # fill in the values from steps 1–3
npm install
npm run db:seed                  # boilerplate content, heroes and a placeholder KvK plan → Supabase (safe to re-run)
npm run translate                # fill in the other languages with the configured provider
npm run dev                      # http://localhost:3000
```

Without any env vars the site still runs with the bundled English seed content (KvK password `1241`) — handy for checking the design. With Supabase configured the pages read from the database.

| Command | What it does |
| --- | --- |
| `npm run db:seed` | Inserts seed rows that don't exist yet (never touches rows you edited). `-- --sync-ui` also updates the interface strings from the code (after a wording change). `-- --overwrite` replaces every seed row, dropping translations. |
| `npm run translate` | Translates everything missing or outdated. `-- --table guides`, `-- --locale de`, `-- --force`, `-- --dry-run`. |
| `npm run test` / `npm run lint` / `npm run typecheck` | Checks (tests live in `tests/`, mirroring `src/`). |
| `npm run build` | Production build (what Vercel and CI run). |
| `npm run backup` | Encrypted dump of every content and admin table into `backups/` (needs `BACKUP_PASSPHRASE`). `-- --restore <file> --yes` writes it back, `-- --decrypt <file>` makes a readable copy. § 10. |
| `npm run prune` | Deletes battle feedback past its retention period and closes those forms (`-- --dry-run` to preview). § 9a. |

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
   | `SITE_OWNER` | your Discord user id (§ 8.2): the owner is always an administrator |
   | `ALERT_DISCORD_WEBHOOK_URL` | optional: a Discord webhook that receives council alerts (§ 9) (*Sensitive*) |
   | `MIGHTPULSE_API_KEY` | optional: verifies Governor IDs on the battle feedback form (§ 9) (*Sensitive*) |
   | `LOG_LEVEL` | optional, `info` (default) or `debug` while investigating a problem |

   `SITE_URL` is *not* needed here: only the scripts and the Maintenance workflow use it (step 6).

3. **Deploy**. Note the URL (`https://<project>.vercel.app`): it goes into the GitHub secret `SITE_URL` (step 6), the webhook installer (step 7) and `supabase/config.toml` (step 8.1). A custom domain can be added under **Settings → Domains** at any time.

From now on Vercel deploys **every push to `main` to production** and **every pull request to a preview URL** (the link appears on the PR). Vercel's build doesn't wait for GitHub Actions, so protect `main` (step 6c) — then only code that passed CI can reach `main`.

The site sends `noindex` headers and a `robots.txt` that blocks every crawler; it is only reachable through the shared link.

## 6. GitHub Actions — CI and database deploys

Three workflows live in `.github/workflows/`:

| Workflow | Runs when | Does |
| --- | --- | --- |
| **CI** | every PR, every push to `main` | `npm ci`, lint, typecheck, unit tests, production build |
| **Deploy database** | a push to `main` that touches `supabase/migrations/`, or manually; a PR that touches them gets a dry run | `supabase link` + `supabase db push` — applies new migration files to the production database (`--dry-run` on the PR only lists them) |
| **Maintenance** | manually (Actions → Maintenance → Run workflow), every Monday on its own for the backup and daily for the prune | `seed`, `sync-ui`, `translate`, `translate-dry-run`, `revalidate`, `backup` (§ 10), `prune` / `prune-dry-run` (§ 9, battle feedback), `webhooks` (§ 7), `config-push` (§ 8.1): everything you would otherwise run from a laptop |

**a. Add the secrets** — GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Used by | Value |
| --- | --- | --- |
| `SUPABASE_ACCESS_TOKEN` | Deploy database, Maintenance (`webhooks`, `config-push`) | personal access token (step 1) |
| `SUPABASE_PROJECT_ID` | Deploy database, Maintenance (`webhooks`, `config-push`) | project ref (step 1) |
| `SUPABASE_DB_PASSWORD` | Deploy database, Maintenance (`webhooks`, `config-push`) | database password (step 1) |
| `NEXT_PUBLIC_SUPABASE_URL` | Maintenance | step 1 |
| `SUPABASE_SECRET_KEY` | Maintenance | step 1 |
| `ANTHROPIC_API_KEY` | Maintenance | step 2, option A |
| `GEMINI_API_KEY` | Maintenance | step 2, option B (optional) |
| `SITE_URL` | Maintenance | step 5 |
| `TRANSLATE_WEBHOOK_SECRET` | Maintenance | step 3 |
| `KVK_SEED_PASSWORD` | Maintenance (optional) | step 3 |
| `BACKUP_PASSPHRASE` | Maintenance (`backup`) | `openssl rand -hex 32`; keep a copy outside GitHub (§ 10) |

**Variables** (same page, tab *Variables*; all optional, same meaning as in step 2): `TRANSLATION_PROVIDER` (`anthropic`, `gemini` or `off`), `ANTHROPIC_MODEL`, `GEMINI_MODEL`.

**b. First run** — Actions → **Deploy database** → **Run workflow** (creates the tables), then Actions → **Maintenance** → task `seed`, then task `translate`. The complete order, including webhooks, sign-in and a restore, is the runbook in § 11.

**c. Protect `main`** — **Settings → Branches → Add branch ruleset** (or *Add rule*) for `main`: *Require a pull request before merging* and *Require status checks to pass* → pick **Lint, typecheck, test, build**. With that, a green CI is the gate for every production deploy.

**d. Adding a migration later** — add `supabase/migrations/000N_<name>.sql`, open a PR (the Deploy database workflow shows what it would apply), merge. CI checks the code, Deploy database applies the SQL, Vercel deploys the app. The two deploys run side by side, so a migration must be additive and work with the previous code (CLAUDE.md § Data and security). Never edit a migration that has already run; add a new file.

**e. Versions** — the actions in the workflows are pinned to a commit and the Supabase CLI to a version (`SUPABASE_CLI_VERSION` in `deploy-database.yml` and `maintenance.yml`; keep the two equal). Dependabot opens a weekly PR for new action releases and npm updates (`.github/dependabot.yml`); merge them when CI is green. Bump the CLI version by hand now and then, after running `npx supabase@<version> db push --linked --dry-run` locally once.

## 7. Supabase → site webhooks (automatic translation)

Translation runs when a row is inserted or edited in Supabase — never when a page is viewed. Supabase tells the site about changes through Database Webhooks:

1. Dashboard → **Database → Webhooks** → **Enable webhooks** (one-time).
2. Actions → **Maintenance** → task **`webhooks`**: it fills the two placeholders of [`supabase/webhooks.sql`](supabase/webhooks.sql) from the `SITE_URL` and `TRANSLATE_WEBHOOK_SECRET` secrets and runs the file through the Supabase CLI. (By hand instead: **SQL Editor**, paste the file, replace `YOUR-SITE.vercel.app` and `YOUR_TRANSLATE_WEBHOOK_SECRET`, **Run**.) Re-run it whenever a content table is added or the secret changes; it replaces the triggers in place.

That creates one trigger per content table. Each change POSTs to `/api/translate`, which answers immediately, translates the row in the background (only if its English text changed — so its own write doesn't cause a loop) and refreshes the page cache. You can watch the calls under **Database → Webhooks** and in the Vercel function logs (search for the `reqId` printed in the response).

Without webhooks the site still works: run `npm run translate` (or the Maintenance workflow) after editing, and the cache refreshes itself every 5 minutes.

## 8. Admin area — Discord sign-in and roles

Council members edit the site at `/<lang>/admin` (link at the bottom of every page). Sign-in is done with Discord through Supabase Auth; the site never sees anyone's Discord password.

### 8.1 Discord application (once)

1. <https://discord.com/developers/applications> → **New Application** (e.g. "Kingdom 1241 site").
2. **OAuth2** → copy **Client ID** → `DISCORD_CLIENT_ID`, and **Reset Secret** → `DISCORD_CLIENT_SECRET`. Put both in `.env.local`; they only configure Supabase, the site itself never reads them.
3. Under **Redirects** add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Supabase Dashboard → **Authentication → Sign In / Providers → Discord** → enable, paste the Client ID and Secret, save.
5. The site URL, the allowed redirect URLs (localhost, production, Vercel previews) and "e-mail sign-ups off" are declared in `supabase/config.toml` under `[auth]`. `npx supabase config diff` shows what differs from the project; `npx supabase config push` applies it (needs `npx supabase login` once), and Actions → **Maintenance** → task **`config-push`** does the same from GitHub. The Discord provider itself is deliberately *not* declared there (its secret would have to live in an environment variable the CLI can read): the diff keeps listing it as "remote only", which is fine, because a push leaves undeclared properties unchanged. Keep "Allow new users to sign up" on in the dashboard; it is the global switch for every provider, and a new account gets no admin rights until promoted.

### 8.2 The owner and the first administrator

Set `SITE_OWNER` to your Discord **user id** (Discord → User Settings → Advanced → Developer Mode, then "Copy User ID" on your profile; a number such as `123456789012345678`) or, less robustly, your Discord username (the handle, not the display name; handles can be renamed and re-registered) in `.env.local` and in Vercel (§ 5). Locally it may be a comma-separated list, e.g. `123456789012345678,dev-admin@kingdom1241.local`, so the dev e-mail account stays an owner next to your Discord account; production holds one value. Whoever signs in with that Discord account is the **owner**: always an administrator, impossible to demote, and the only person who can appoint or remove other administrators. Changing the owner means changing that variable, nothing in the site can do it.

Nobody gets any access just by signing in: a new account is a **member** until the owner or an administrator raises it under **Admin → Users**, either for someone who has already signed in (role dropdown) or ahead of time by Discord username (pre-authorisation). **Administrators** appoint and remove moderators and can delete plans; **moderators** edit content and the battle plan. Setting someone to **Member** revokes all admin access at once; **Remove** on the Users page deletes the account itself (they can sign in again later, as a member). Nobody removes themselves or the owner, and only the owner removes administrators. Both take effect on the person's **next request**, even while they are signed in: the role is read from the database on every admin page and inside every save action, and every request asks Supabase whether the account still exists, so a demoted person is refused on their next click and a removed one lands on the login page. Nothing is pushed to their browser; an open tab simply stops working.

**In-game names.** After signing in, everyone sets their own in-game name and home alliance (also on the "no access" screen); the site then shows them as "[ULU] Rudy", like the game does. Type the name without the tag and pick the alliance from the kingdom's list, or type "[ULU] Rudy" and the tag is split off. The user list shows it next to the Discord handle and every audit entry carries it. Roles still belong to the Discord account: check that the handle matches the person you expect before promoting someone, because the in-game name is typed by the person themselves.

**Finding the sign-in.** The key icon in the site header (tablet and desktop) and the "Admin sign-in" line in the footer lead to the login page; both say that it is for the council only and that players need no account. Once you are signed in they turn into an "Admin panel" shortcut (wrench icon), and inside the admin area they disappear: the admin bar there shows who you are and has the only "Sign out" button.

### 8.3 Working on the admin area without Discord (local development)

Add to `.env.local`:

```
ADMIN_DEV_LOGIN=1
DEV_ADMIN_EMAIL=dev-admin@kingdom1241.local
DEV_ADMIN_PASSWORD=<12 or more random characters>
```

Set `SITE_OWNER=dev-admin@kingdom1241.local` as well, run `npm run dev:admin` (creates the account in Supabase Auth), start the site and use the e-mail form on `/en/admin/login`; the account is then the owner. The form only exists in development builds; never set `ADMIN_DEV_LOGIN` in Vercel. Delete the account under Supabase → Authentication → Users when it is no longer needed.

### 8.4 What happens on sign-in

`/auth/callback` exchanges the Discord code for a session (HttpOnly, Secure cookies that scripts can never read; a separate harmless marker cookie tells the site header that someone is signed in), creates or refreshes the person's row in `profiles` and applies any matching pre-authorisation. Identity comes from the data Discord gave Supabase, never from the user-editable profile metadata. Demoting or removing an account also removes the pre-authorisations that would re-apply the role at the next sign-in; the Users page shows a "pre-authorised" chip where one exists. Every admin write is a Server Action that re-checks the role, writes with the service role and records who did what in `audit_log` (the "Recent changes" list on the admin overview).

### 8.5 Correcting a translation

The battle-plan editor has a language dropdown ("Editing texts in"; it starts on the site language you are browsing in). English is the source: saving an English text re-translates that text into every other language (only that text: changing the title does not re-translate the intro, and editing one instruction touches nothing else), and until the machine is done that text is locked in the other languages (the page refreshes itself). Pick another language to correct its text; a correction applies to that language only and is kept until the English text changes again, so nothing can bounce between languages.

### 8.6 Ordering and live battle times

Instructions, coordinators and formations are ordered with the ▲ ▼ arrows next to each row (new rows go to the end); nobody types order numbers. In the plan intro, write `{{when}}`, `{{date}}`, `{{time}}` or `{{utc}}` instead of "tomorrow" or a clock time: each player sees the battle time from `battle_at` in their own language and time zone ("tomorrow", "Sunday, November 8", "15:00", "14:00 UTC"), updated live, so the text never goes stale. The translation pipeline keeps these placeholders as they are.

## 9. KvK battle plan (password-locked page)

Kingdom 1241 alternates two events every two weeks — the **internal castle battle** (practice inside the kingdom) and **KvK** (against another kingdom). Both use the same page and password: the `/kvk` page shows the plan whose row in `kvk_plans` has `active = true`, and its `event_type` (`castle_battle` or `kvk`) is shown as a badge. Players unlock it with one shared password; the site stores a signed cookie for 30 days. The `kvk_*` tables have **no public read policy** — only the server (with `SUPABASE_SECRET_KEY`) can read them, so the plan can't be pulled from the database API.

**Change the password:** Admin → battle plan → "Shared password" (or Table Editor → `kvk_plans` → `password`). Everyone is logged out immediately (the cookie is derived from the password) — share the new one on Discord.

**Guessing protection.** The password stays simple on purpose, so guessing is slowed instead: an address that enters five wrong passwords within 15 minutes is locked out for an hour, doubling with every further lockout up to a day (the form shows a countdown); addresses are stored only as hashes. Wrong tries from *all* addresses are also counted per hour, and past 30 the site writes a "kvk.bruteforce" entry to the admin overview's change log and, if `ALERT_DISCORD_WEBHOOK_URL` is set (Discord → Server settings → Integrations → Webhooks → New webhook → copy URL, then add the variable in Vercel), posts an alert to that channel. That layer never locks anyone out: when it fires, change the password. `KVK_SESSION_SECRET` (or `TRANSLATE_WEBHOOK_SECRET`) is required in production; the app refuses to sign cookies with a development fallback there.

**Edit the plan** (`kvk_plans`): `event_type` (`castle_battle` or `kvk`), `title` and `intro` (HTML, translated automatically), `opponent` (KvK only), `battle_at` (UTC — the page converts it to each player's local time and counts down; the editor only accepts a future time when you change it, and a duplicated plan starts without one), `battle_end_at` (optional; the editor's *Standard window* button fills the usual 12:00–17:00 UTC castle battle), `min_hero_stars` (default 4), `min_skill_level` (the required level of the hero's Top Expedition Skill — the top-right skill with the flag icon; default 5).

**Instructions** (`kvk_rules`): one row per bullet; `kind` is `do`, `dont` or `info`; `sort_order` orders them (the arrows in the editor).

**Coordinators** (`kvk_coordinators`): `team` is which battle alliance they run — `kvk` ([KvK], rallies the castle) or `tmp` ([TMP], counter-rallies); `name` is the in-game name; `alliance_tag` is their home alliance and colours the badge (must match `alliances.tag`); `note` e.g. the languages they speak.

**Formations** (`kvk_formations`, up to 12 — the game's preset slots):

| Column | Meaning |
| --- | --- |
| `label` | The preset name players save in the game: `A`, `B`, … |
| `side` | `attack`, `defense` or `any` |
| `role` | `rally_lead`, `rally_join` or `any` — shown as "rally lead/join" on the attack side and "garrison lead/join" on the defence side (the kingdom's words; attackers rally, defenders garrison) |
| `hero_1` … `hero_3` | Hero slugs from the `heroes` table (`amane`, `long-fei`, …). Leave empty for "any hero". |
| `infantry_pct` / `cavalry_pct` / `archers_pct` | Troop ratio; must add up to 100 |
| `note` | Optional hint, translated automatically |

Formations tagged with a side or role get filter chips on the page (attack, defence, rally lead/join, garrison lead/join); untagged ones show as "attack or defense".

**Heroes** (`heroes`): one row per hero with `slug`, `name`, `troop_type`, `rarity`, `generation`, `icon_url`. The seed ships 37 heroes with 128px portraits in `public/heroes/`. To add a new hero, insert a row and set `icon_url` to any image URL (e.g. upload the portrait to the `images` storage bucket and use its public URL).

**Next event (castle battle → KvK → castle battle …):** insert a new `kvk_plans` row (new `slug`, `event_type`, password), add its rules/coordinators/formations, then set `active = false` on the old row and `active = true` on the new one (only one plan can be active). Keeping old rows gives you a history for later.

### 9a. Battle feedback (retrospective)

After a battle the council can open a short feedback form for that plan: Admin → battle plan → **Player feedback** → tick *Open* and save. Players reach it from the card at the top of the battle plan or at `/kvk/feedback`, behind the same password as the plan (the cookie of the active plan is accepted too, so the previous battle can collect feedback while the next plan is already live). One form is open at a time; opening one closes the others.

**What players fill in:** their Governor ID (one answer per id; a second one is refused), their in-game name and alliance, star ratings from 0 to 5 for the questions you chose, and up to three short texts (500 characters each, any language). The questions come from a fixed catalogue (`src/lib/retro/questions.ts`, translated with the interface strings); per battle you tick which ones are **shown** and which are **required**. Texts are optional by default. The title and intro are yours (English, Markdown), translated by the pipeline like the plan intro and correctable per language in the editor's language dropdown.

**Governor ID check (`MIGHTPULSE_API_KEY`, optional).** With a key from [api.mightpulse.com](https://api.mightpulse.com) (sign in with Discord → create an API key; the standard key allows 60 lookups a minute and 5 000 a day) the form checks the id while the player types, fills in the name and alliance from the game and refuses ids that don't exist or belong to another kingdom. Without the key, or while MightPulse is down or over its budget, nothing is checked and players type name and alliance themselves; no error is shown. The site never sends the key or the player's texts to MightPulse, only the id. Set the variable in Vercel (and `.env.local`).

**Who sees what.** Governor IDs and names are shown to the owner only (`SITE_OWNER`); moderators and administrators see every answer with the alliance, the page language and a *verified* badge, but no identity. The CSV export (Results → **Export CSV**) carries the row id, never the identity, and goes to the audit log. Moderators can delete a single abusive answer; only administrators can delete all answers of a battle (export first, it cannot be undone). Every deletion is an audit entry with the count, never the text.

**AI summary (Results → "Translate and analyse").** One click, never automatic: the written answers of every response that has no English version yet are translated in batches (stored next to the original, so a second run doesn't pay for them again), then one request reads every response and stores a summary on the retrospective: the mood on the 0–5 scale, the positive/neutral/negative share per prompt, the recurring themes with a count and a quote, and three suggested actions. The page shows the stored summary with the number of responses it saw and the tokens it used; "Update analysis" re-runs it after new answers. It uses the translation provider (§ 2): with Anthropic, `RETRO_TRANSLATE_MODEL` (default `claude-haiku-5-5`, $0.10 / $0.50 per million tokens in / out) for the bulk translation and `RETRO_ANALYSIS_MODEL` (default `claude-opus-5-5`, $4 / $20) for the summary; with Gemini, `GEMINI_MODEL` for both. Rough cost at the standard prices: 300 responses with about a thousand characters of text each translate for a few cents and summarise for roughly forty cents, so well under a dollar per run; a re-run pays the summary only. Only alliance, ratings and texts go to the model, never a Governor ID or a name. Every run is an audit entry (`retro.analyse`) with its token counts.

**Limits and retention.** Each form has a response cap (default 600, the editor allows up to 2 000; the kingdom has about 300 active players, so far more is somebody flooding the form) and a per-address budget of eight submissions an hour; a hidden honeypot field catches the dumbest bots. Answers are kept for `retention_days` after the battle (default 30, from 7 to 365): the Maintenance task `prune` runs every day at 05:41 UTC (`npm run prune`, `prune-dry-run` to preview), deletes what is due, closes those forms and writes a `retro.prune` entry to the change log. The Feedback page shows every battle's deletion date in advance. Tables: `kvk_retrospectives` (settings) and `kvk_retro_responses` (answers), both service-role only; both are part of the weekly backup (a few hundred small rows).

## 10. Backups

Supabase's free plan keeps no backups of its own, so the site makes one. Every Monday the **Maintenance** workflow runs `npm run backup`, which dumps every content and admin table (languages, settings, interface strings, announcements, events, rules, guides, alliances, gift codes, heroes, the battle plans with their instructions, coordinators and formations, the feedback forms and their answers, profiles, pre-authorisations and the audit log; not the wrong-password counters) into one JSON file, encrypts it with `BACKUP_PASSPHRASE` and keeps it as a workflow artifact for 90 days. Translations are part of the rows, so they come back too. The list of tables is `BACKUP_TABLES` in `src/lib/backup/tables.ts`; a test fails when a migration adds a table that is in neither that list nor `NOT_BACKED_UP`.

**One-time setup:** `openssl rand -hex 32` → GitHub secret `BACKUP_PASSPHRASE` (§ 6a) and your `.env.local`. Keep a copy outside GitHub (a password manager): the file cannot be read without it, and a backup should survive the loss of the repository as well. The repository is public and anyone with a GitHub account can download an artifact, which is why the file is encrypted before it leaves the runner; never upload a plain dump.

**Check it:** Actions → Maintenance → the latest `backup` run → *Artifacts*; the log lists the row counts per table. Run the task by hand before a risky change (a bulk edit, a password change). It is free.

**Restore** (on your machine, with `.env.local` pointing at the project to restore into):

```bash
# download the artifact zip from the run page and unzip it, then:
npm run backup -- --restore kingdom-1241-2026-10-26T041722Z.json.enc        # shows what the file holds, writes nothing
npm run backup -- --restore kingdom-1241-2026-10-26T041722Z.json.enc --yes  # writes it back
npm run backup -- --restore <file> --yes --tables guides,rules              # only some tables
```

A restore writes rows by primary key and never deletes, so content added after the backup stays and a wrongly edited row goes back to its backed-up state. Into a fresh project (§ 11) everything is restored except the accounts themselves: Supabase Auth users are not content, they are recreated when people sign in, and the backed-up administrators and moderators become pre-authorisations so each gets their role back at their first sign-in. The audit log is appended only into an empty table. Afterwards run Maintenance → `revalidate` (or wait five minutes) so the pages show the restored rows.

`npm run backup -- --decrypt <file>` writes a readable JSON copy next to the file. It contains the battle-plan password; delete it when done.

**Schedules pause.** GitHub stops the scheduled workflows of a public repository after 60 days without a commit and shows a banner with an *Enable* button on the workflow page; a merged PR starts them again as well. Dependabot's weekly PRs usually keep the repository active, but check the backup list after a quiet autumn.

## 11. Rebuild from zero

If the Supabase project, the Vercel project or both are gone, this order gets the site back. Each step points at the section with the details.

1. **What you need** — a clone of the repository (`main`) and, from your password manager: `BACKUP_PASSPHRASE`, `SITE_OWNER` (your Discord user id) and, ideally, the old `TRANSLATE_WEBHOOK_SECRET` and `KVK_SESSION_SECRET`. New secrets work too: players unlock the battle plan once more, nothing else changes.
2. **Supabase project** (§ 1) — create it, save the database password, collect the project ref, URL, publishable and secret keys, create an access token.
3. **GitHub secrets** (§ 6a) — set them all. Put the same values into `.env.local`.
4. **Tables** — Actions → **Deploy database** → *Run workflow* applies every migration to the empty project.
5. **Content** — with a backup: `npm run backup -- --restore <newest file> --yes` (§ 10). Without one: Maintenance → `seed` gives you the placeholder content, then edit it as in the beginning.
6. **Vercel** (§ 5) — import the repository, set the environment variables (with `SITE_OWNER` and, if you had one, `ALERT_DISCORD_WEBHOOK_URL`), deploy. If the production URL changed, update the `SITE_URL` secret and `site_url` / `additional_redirect_urls` in `supabase/config.toml` (a small PR).
7. **Translation** (§ 2) — Maintenance → `sync-ui` (interface strings added to the code since the backup), then `translate` for whatever the backup lacked.
8. **Webhooks** (§ 7) — Dashboard → Database → Webhooks → *Enable webhooks* once, then Maintenance → `webhooks`.
9. **Discord sign-in** (§ 8.1) — the Discord application is not part of the project and survives; add the new project's callback URL (`https://<new-ref>.supabase.co/auth/v1/callback`) under its *Redirects*, enable the Discord provider in the Supabase dashboard with the client id and secret, then Maintenance → `config-push` for the site URL and redirect list. Sign in: you are the owner through `SITE_OWNER`; everyone else gets their role back on their first sign-in through the restored pre-authorisations.
10. **Protect `main`** (§ 6c), then check: Home shows the restored announcements, `/kvk` unlocks with the old password, the admin overview lists the restored audit log, and a test edit in the table editor is translated within a minute.

If only Vercel is gone, steps 6 and 9 (the environment variables and nothing else) are enough. If only Supabase is gone, skip step 6 but redeploy after changing Vercel's Supabase variables.

---

## Everyday tasks

**Edit content.** Supabase Dashboard → **Table Editor**. Edit the `en` value inside the JSON of `title`, `body`, etc. (bodies are HTML). Save — the webhook translates the other languages within a minute. Set `published` to false to hide a row.

**Alliances.** Table `alliances`: `tag`, `name`, `color` (hex), `power`, `members`, `leader`, `description`, `requirements`, `languages`, `discord_url`, `sort_order` (= ranking on the home page). The seed contains the five alliances of 1241 with their power from the in-game ranking; fill in the rest, or wait for the MightPulse sync (phase 4).

**Add a language.** Insert a row in `languages` (e.g. `fr`, enabled, sort order) — if the code isn't in `src/lib/i18n/languages.ts` yet, add it there (name, direction, font) and deploy. Then run `npm run translate` (or the Maintenance workflow) once to backfill existing content.

**Fix a translation by hand.** Edit the language's value in the JSON. It stays until the English text of that row changes, which re-translates every language.

**After a battle.** Admin → the plan → *Player feedback* → tick *Open*, save; a day or two later read the results under *Feedback*, export the CSV, then untick *Open* (or let the closing time do it). § 9a.

**KvK prep days** (`/kvk/prep`, public). Nothing to do per round: the page moves to the next round by itself (every 28 days from Sunday 1 Nov 2026). The schedule, the item × day table, the points and the tips are code (`src/lib/kvk/prep.ts`, texts `prep.*` in `src/content/seed/ui-strings.ts`), so a change is a PR; after a wording change run Maintenance → `sync-ui`, then `translate`. If the game ever shifts a round, change `FIRST_PREP_ROUND` in the same file.

**Restore content.** From the weekly backup, § 10.

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
- **The weekly backup stopped running.** GitHub pauses the schedules of a public repository after 60 days without a commit (banner on Actions → Maintenance, button *Enable*). Any merged PR re-enables them.
- **`npm run backup` fails with "Set BACKUP_PASSPHRASE".** The passphrase (16+ characters) is missing from `.env.local` or the GitHub secrets (§ 10).
- **Maintenance `webhooks` or `config-push` fails at `supabase link`.** Same causes as the Deploy database failure above: they use the same three secrets.
- **CI fails but it works on my machine.** CI uses the Node version in `.nvmrc` (24, the same major Vercel runs; `engines` in package.json pins it for Vercel) and `npm ci` (exact lockfile). Run `nvm use && npm ci && npm run lint && npm run typecheck && npm run test && npm run build` locally.
