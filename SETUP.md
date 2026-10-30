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

Content (announcements, events, rules, guides, the KvK plan…) is edited in the admin area and shows up within seconds through the webhook — no deploy needed.

---

## 0. Before anything: the owner and the kingdom

Two things are decided once, before the first deploy, and never in the site.

**The owner.** One person owns the site: always an administrator, the only one who appoints administrators, and the only one who sees **Admin → Settings**. The owner is whoever signs in with the Discord account named in `SITE_OWNER`, and nothing in the site can change that. Use the Discord **user id**, not the username: a username can be renamed and then registered by someone else. Discord → User Settings → Advanced → turn on Developer Mode, then click your own name or avatar → **Copy User ID** (a number of 17 to 20 digits). Put it in `.env.local` and in Vercel (§ 5, Production and Preview), and keep a copy in your password manager. A production build refuses to deploy without exactly one Discord user id in `SITE_OWNER` (the live site stays as it was); a preview build only warns. Changing the owner later means changing that variable and redeploying. Details in § 8.2.

**The kingdom.** This repository is set up for Kingdom 1241: the number is `kingdomNumber` in `src/content/seed/settings.ts` (the battle feedback form only accepts Governor IDs from that kingdom), the name and tagline sit next to it, and the alliances in `src/content/seed/alliances.ts`. Set them before the first `npm run db:seed`; for another kingdom this is where to start.

## 1. Supabase — database and image storage

1. Go to <https://supabase.com/dashboard>, **New project**. Pick a region close to most players (e.g. Frankfurt). The site's server code runs in Frankfurt too (`vercel.json`, § 5); with another region, change `regions` there to the Vercel region in the same city. **Save the database password** — CI needs it (step 6).
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

**Option A — Anthropic (Claude).** <https://platform.claude.com> → API keys → create one → `ANTHROPIC_API_KEY`. Load a small prepaid credit. Optional: `ANTHROPIC_MODEL` (default `claude-haiku-5-5`, the cheapest: a full translation run costs cents; `claude-sonnet-5-5` costs about 20 times as much and `claude-opus-5-5` about 40 times, which is what ran up the bill before Haiku became the default).

**Option B — Google Gemini (free tier).** <https://aistudio.google.com/apikey> → **Create API key** → `GEMINI_API_KEY`. Optional: `GEMINI_MODEL` (default `gemini-3.5-flash`; on 24 Oct 2026 `gemini-3.8-flash` took about 130 s per request for a fresh key versus 5 s, so check latency with one call before changing it). Google retires models for new keys from time to time; a 404 naming another model means updating this variable.

**Choosing / switching / turning it off.** The provider is picked automatically: Anthropic if `ANTHROPIC_API_KEY` is set, otherwise Gemini if `GEMINI_API_KEY` is set, otherwise off. Force it with `TRANSLATION_PROVIDER=anthropic | gemini | off` (in Vercel for the webhook, in GitHub *variables* for the Maintenance workflow, in `.env.local` locally). With translation off the site keeps working — players see English for anything not translated — and edits still refresh the cache. To stop the AI bill for a while without touching any keys, the owner pauses machine translation under **Admin → Settings → Machine translation**: the webhook then only refreshes the cache, `npm run translate` refuses to run and the feedback AI buttons wait. After resuming, run Maintenance → `translate` once to fill in what was edited meanwhile.

**Reviewing the interface translations (about once a month, free).** The machine translates each string on its own, so it can name a button differently from the button, switch between two words for the same game term, or mix up roles. In Claude Code, run `/translation-review` (`.claude/skills/translation-review/SKILL.md`): it reads the live strings with the public key (`npm run ui:review`, read-only), checks them against the labels the page shows, the glossary and their meaning, writes the fixes into `src/content/seed/ui-reviewed.ts` and opens a PR. It runs on your Claude subscription, not on the API key, and writes nothing to the database. After you merge, wait until Vercel shows the deployment of `main` as *Ready*, then run Maintenance → `sync-ui`: the fixes go live and the pipeline leaves them alone until their English changes. (Run `sync-ui` only once that deployment is live in general: the translation webhooks are answered by whichever deployment is live, and on 28 Oct a sync that ran a minute early was translated by the previous one.) The same skill reviews the admin-written content: the active battle plan with its leader, checklist and feedback pages, and the public content (worth a look whenever the council has filled in a plan). It reads them with `npm run content:review` (read-only), leaves alone every language a moderator corrected by hand (§ 8.5), and gives you a fixes file and the command to apply it: `npm run content:fixes -- --file <file>` shows what would change, `--apply` writes it (each fix only while the English and that translation are unchanged since the review, logged in the audit as `translation.review`). Battle-plan texts never go into the repository or a PR, because the repository is public.

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
| `npm run db:seed` | Inserts seed rows that don't exist yet (never touches rows you edited). `-- --sync-ui` also updates the interface strings from the code (after a wording change), with the reviewed translations of `src/content/seed/ui-reviewed.ts`. `-- --overwrite` replaces every seed row, dropping translations. |
| `npm run translate` | Translates everything missing or outdated. `-- --table guides`, `-- --locale de`, `-- --force`, `-- --dry-run`. |
| `npm run ui:review` | Read-only export of the live interface strings for the translation review (public key only; § 2). |
| `npm run content:review` / `npm run content:fixes` | Read-only export of the admin-written content for the translation review, and applying its fixes (`-- --file <file>` previews, `--apply` writes; § 2). |
| `npm run test` / `npm run lint` / `npm run typecheck` | Checks (tests live in `tests/`, mirroring `src/`). |
| `npm run build` | Production build (what Vercel and CI run). |
| `npm run backup` | Encrypted dump of every content and admin table into `backups/` (needs `BACKUP_PASSPHRASE`). `-- --restore <file> --yes` writes it back, `-- --decrypt <file>` makes a readable copy. § 10. |
| `npm run prune` | Deletes battle feedback past its retention period and closes those forms, Rally Sync rooms that have closed, and editor images no announcement, rule, guide or alliance section uses any more (`-- --dry-run` to preview). § 9a, § 9b, § 9f. |

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
   | `MIGHTPULSE_API_KEY` | optional: verifies Governor IDs on the battle feedback form (§ 9) and syncs the alliances on Home (§ 9c) (*Sensitive*) |
   | `LOG_LEVEL` | optional, `info` (default) or `debug` while investigating a problem |

   `SITE_URL` is *not* needed here: only the scripts and the Maintenance workflow use it (step 6).

3. **Deploy**. Note the URL (`https://<project>.vercel.app`): it goes into the GitHub secret `SITE_URL` (step 6), the webhook installer (step 7) and `supabase/config.toml` (step 8.1). A custom domain can be added under **Settings → Domains** at any time.

From now on Vercel deploys **every push to `main` to production** and **every pull request to a preview URL** (the link appears on the PR). Vercel's build doesn't wait for GitHub Actions, so protect `main` (step 6c) — then only code that passed CI can reach `main`.

The site sends `noindex` headers and a `robots.txt` that blocks every crawler; it is only reachable through the shared link.

**Region.** Pages and files come from Vercel's network nearest to each visitor, but the server code (admin pages, unlocking, Rally Sync, the webhooks) runs in one region, and the free plan allows exactly one. `vercel.json` sets it to Frankfurt (`fra1`), next to the database: a request makes several database calls one after another (a Rally Sync Re-sync about eight), and from Vercel's default Washington each one crossed the Atlantic, which cost about two seconds per Re-sync. Keep the two in the same city; if the database moves, change `regions` with it. To check: a response's `x-vercel-id` header has the visitor's edge first and the code's region second (`arn1::fra1::…`).

**Old deployments.** Every build is stored (about 150 MB: every page in every language), and the Hobby plan has 10 GB of Deployment Storage. Vercel keeps each deployment for 30 days, and when the team goes over 10 GB it can block new deployments. The **Prune deployments** workflow (step 6) therefore deletes old ones after every finished deployment and once a day. It keeps the live deployment, the one before it (for a rollback from **Deployments → ⋯ → Instant Rollback**), the newest preview of each open pull request and anything still building. Deleted deployments stay under **Settings → Security → Recently Deleted** for a while (a day up to 30 days, depending on their age) and can be restored there. It needs one token:

1. Vercel → avatar → **Account Settings → Tokens → Create**: name `github-prune-deployments`, scope the team that owns the project, an expiry you will remember (a year).
2. Store it as the GitHub secret `VERCEL_TOKEN` (step 6a), e.g. `gh secret set VERCEL_TOKEN` and paste it when asked.
3. Actions → **Prune deployments** → **Run workflow** (a dry run by default) and read the list; from then on it runs on its own.

The token can do anything in that Vercel team, so it lives only in GitHub's secrets; when it expires, the workflow leaves a warning and deletes nothing until a new one is stored. As a backstop you can also shorten **Settings → Security → Deployment Retention Policy** (e.g. Pre-Production 1 day, Production 7 days).

## 6. GitHub Actions — CI and database deploys

These workflows live in `.github/workflows/`:

| Workflow | Runs when | Does |
| --- | --- | --- |
| **CI** | every PR, every push to `main` | `npm ci`, lint, typecheck, unit tests, production build, then the browser tests against that build with no keys (`docs/QA.md`): laptop and Android in this job, the iPhone in a second job on macOS (**Browser tests (iPhone)**); the run's summary shows the JUnit results, and the `test-reports` artifacts keep the reports for 14 days |
| **Deploy database** | a push to `main` that touches `supabase/migrations/`, or manually; a PR that touches them gets a dry run | `supabase link` + `supabase db push` — applies new migration files to the production database (`--dry-run` on the PR only lists them) |
| **Maintenance** | manually (Actions → Maintenance → Run workflow), every Monday on its own for the backup, daily for the prune and the alliance sync | `seed`, `sync-ui`, `translate`, `translate-dry-run`, `revalidate`, `backup` (§ 10), `prune` / `prune-dry-run` (§ 9, battle feedback), `webhooks` (§ 7), `config-push` (§ 8.1), `alliances` (§ 9c): everything you would otherwise run from a laptop |
| **Gift codes** | every hour, or manually | asks the site to check kingshot.net's gift codes (§ 9d) |
| **E2E live** | daily at 06:30 UTC, or manually | opens the live site's pages like a visitor, in every language it offers, read-only (`docs/QA.md`, the live check); a failure e-mails you like any failed workflow |
| **Prune deployments** | after every finished Vercel deployment, daily, or manually (a dry run by default) | deletes old Vercel deployments, keeping the live one, the one before it and open pull requests' previews (§ 5) |

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
| `SITE_URL` | Maintenance, Gift codes, E2E live | step 5 |
| `TRANSLATE_WEBHOOK_SECRET` | Maintenance | step 3 |
| `KVK_SEED_PASSWORD` | Maintenance (optional) | step 3 |
| `BACKUP_PASSPHRASE` | Maintenance (`backup`) | `openssl rand -hex 32`; keep a copy outside GitHub (§ 10) |
| `VERCEL_TOKEN` | Prune deployments | Vercel account token scoped to the team (§ 5) |

**Variables** (same page, tab *Variables*; all optional, same meaning as in step 2): `TRANSLATION_PROVIDER` (`anthropic`, `gemini` or `off`), `ANTHROPIC_MODEL`, `GEMINI_MODEL`.

**b. First run** — Actions → **Deploy database** → **Run workflow** (creates the tables), then Actions → **Maintenance** → task `seed`, then task `translate`. The complete order, including webhooks, sign-in and a restore, is the runbook in § 11.

**c. Protect `main`** — **Settings → Branches → Add branch ruleset** (or *Add rule*) for `main`: *Require a pull request before merging* and *Require status checks to pass* → pick **Lint, typecheck, test, build** and **Browser tests (iPhone)**. With that, a green CI is the gate for every production deploy.

**d. Adding a migration later** — add `supabase/migrations/000N_<name>.sql`, open a PR (the Deploy database workflow shows what it would apply), merge. CI checks the code, Deploy database applies the SQL, Vercel deploys the app. The two deploys run side by side, so a migration must be additive and work with the previous code (CLAUDE.md § Data and security). Never edit a migration that has already run; add a new file.

**e. Versions** — the actions in the workflows are pinned to a commit and the Supabase CLI to a version (`SUPABASE_CLI_VERSION` in `deploy-database.yml` and `maintenance.yml`; keep the two equal). Dependabot opens a weekly PR for new action releases and npm updates (`.github/dependabot.yml`); merge them when CI is green. Bump the CLI version by hand now and then, after running `npx supabase@<version> db push --linked --dry-run` locally once.

## 7. Supabase → site webhooks (automatic translation)

Translation runs when a row is inserted or edited in Supabase — never when a page is viewed. Supabase tells the site about changes through Database Webhooks:

1. Dashboard → **Database → Webhooks** → **Enable webhooks** (one-time).
2. Actions → **Maintenance** → task **`webhooks`**: it fills the two placeholders of [`supabase/webhooks.sql`](supabase/webhooks.sql) from the `SITE_URL` and `TRANSLATE_WEBHOOK_SECRET` secrets and runs the file through the Supabase CLI. (By hand instead: **SQL Editor**, paste the file, replace `YOUR-SITE.vercel.app` and `YOUR_TRANSLATE_WEBHOOK_SECRET`, **Run**.) Re-run it whenever a content table is added or the secret changes; it replaces the triggers in place.

That creates one trigger per content table. Each change POSTs to `/api/translate`, which answers immediately, translates the row in the background (only if its English text changed — so its own write doesn't cause a loop) and refreshes the page cache. You can watch the calls under **Database → Webhooks** and in the Vercel function logs (search for the `reqId` printed in the response).

Without webhooks the site still works: run `npm run translate` (or the Maintenance workflow) after editing, then the Maintenance task `revalidate`; the cache refreshes itself only once a day.

## 8. Admin area — Discord sign-in and roles

Council members edit the site at `/<lang>/admin` (link at the bottom of every page). Sign-in is done with Discord through Supabase Auth; the site never sees anyone's Discord password.

**Page guide.** Every admin page has a **Page guide** button in the admin bar: a short tour of that page that dims it, lights up one part at a time and says what goes there, which password or link goes to whom, and the good practice (new passwords per battle, coordinator links kept to one or two people, export feedback before it is deleted). It adapts to the role (moderators don't get the Users steps). The speaker on its card reads the steps aloud in English (off until tapped, remembered per device). Nothing opens by itself; a "New here?" line points at the button until it has been opened once on that device. A new moderator needs no other instructions: pre-authorise them (§ 8.2), tell them to sign in, and the Overview's guide takes it from there.

### 8.1 Discord application (once)

1. <https://discord.com/developers/applications> → **New Application** (e.g. "Kingdom 1241 site").
2. **OAuth2** → copy **Client ID** → `DISCORD_CLIENT_ID`, and **Reset Secret** → `DISCORD_CLIENT_SECRET`. Put both in `.env.local`; they only configure Supabase, the site itself never reads them.
3. Under **Redirects** add `https://<your-project-ref>.supabase.co/auth/v1/callback`.
4. Supabase Dashboard → **Authentication → Sign In / Providers → Discord** → enable, paste the Client ID and Secret, save.
5. The site URL, the allowed redirect URLs (localhost and production; deliberately no `*.vercel.app` wildcard, because other Vercel accounts can claim matching names and would receive an admin's sign-in code, so preview deployments have no admin login) and "e-mail sign-ups off" are declared in `supabase/config.toml` under `[auth]`. `npx supabase config diff` shows what differs from the project; `npx supabase config push` applies it (needs `npx supabase login` once), and Actions → **Maintenance** → task **`config-push`** does the same from GitHub. The Discord provider itself is deliberately *not* declared there (its secret would have to live in an environment variable the CLI can read): the diff keeps listing it as "remote only", which is fine, because a push leaves undeclared properties unchanged. Keep "Allow new users to sign up" on in the dashboard; it is the global switch for every provider, and a new account gets no admin rights until promoted.

### 8.2 The owner and the first administrator

Set `SITE_OWNER` to your Discord **user id** (§ 0: Discord → User Settings → Advanced → Developer Mode, then "Copy User ID" on your profile; a number such as `123456789012345678`) in `.env.local` and in Vercel (§ 5). A Discord username still signs in locally, but production builds need the id: a username can be renamed and re-registered by someone else. Locally it may be a comma-separated list, e.g. `123456789012345678,dev-admin@kingdom1241.local`, so the dev e-mail account stays an owner next to your Discord account; production holds one value. Whoever signs in with that Discord account is the **owner**: always an administrator, impossible to demote, and the only person who can appoint or remove other administrators. Changing the owner means changing that variable, nothing in the site can do it. The owner alone sees **Admin → Settings**, five tabs: **General** (who the owner is, read-only, and the small switches), **Usage** (§ 9e), **Rally Sync**, **Alliances** and **Languages**; together they hold the site's runtime settings: the Rally Sync capacity (§ 9b), the alliances (§ 9c), the languages (§ 8.2a), a pause for machine translation (§ 2), the wrong-password rules (§ 9) and what a new feedback form starts with (§ 9a); every change there is in the audit log.

Nobody gets any access just by signing in: a new account is a **member** until the owner or an administrator raises it under **Admin → Users**, either for someone who has already signed in (role dropdown) or ahead of time by Discord username (pre-authorisation). **Administrators** appoint and remove moderators and can delete plans; **moderators** edit content and the battle plan. Setting someone to **Member** revokes all admin access at once; **Remove** on the Users page deletes the account itself (they can sign in again later, as a member). Nobody removes themselves or the owner, and only the owner removes administrators. Both take effect on the person's **next request**, even while they are signed in: the role is read from the database on every admin page and inside every save action, and every request asks Supabase whether the account still exists, so a demoted person is refused on their next click and a removed one lands on the login page. Nothing is pushed to their browser; an open tab simply stops working.

**In-game names.** After signing in, everyone sets their own in-game name and home alliance (also on the "no access" screen); the site then shows them as "[ULU] Rudy", like the game does. Type the name without the tag and pick the alliance from the kingdom's list, or type "[ULU] Rudy" and the tag is split off. The user list shows it next to the Discord handle and every audit entry carries it. Roles still belong to the Discord account: check that the handle matches the person you expect before promoting someone, because the in-game name is typed by the person themselves.

**Finding the sign-in.** The key icon in the site header (tablet and desktop) and the "Admin sign-in" line in the footer lead to the login page; both say that it is for the council only and that players need no account. Once you are signed in they turn into an "Admin panel" shortcut (wrench icon), and inside the admin area they disappear: the admin bar there shows who you are and has the only "Sign out" button.

### 8.2a Languages: show, hide, order, add

**Admin → Settings → Languages** (owner) lists every language with how many texts are not translated into it yet. ▲ ▼ set the order of the language menu; **Hide** takes a language out of the menu, its links open the same page in the player's other language and nothing is translated into it any more, so it costs nothing (English can't be hidden); **Show** brings it back. Arrange the list, then press **Save**: players see nothing until then, and one save updates the menu on every page at once (each save renders the whole site again, so a save per click would be wasteful). Texts edited while it was hidden show in English there until Maintenance → `translate` has run (with *language* set to its code, only that language is translated). After the save the menu changes at once (players who have the site open see it after a reload); for up to a minute a link to a just-hidden language may still show "not found".

**Adding a language** is a code change, so it comes with the game's words and is reviewed like the others:

1. A PR with the language in `src/lib/i18n/languages.ts` (English and native name, direction, font, flag, and a `style` rule where the general one doesn't fit, e.g. Japanese です/ます), its word for every term in `src/lib/translate/glossary.ts` (the in-game terms, so "Bear Hunt" is the same everywhere), and a row in `src/content/seed/languages.ts` with `enabled: false`.
2. After the merge: Maintenance → `seed` (adds the row, hidden), then Maintenance → `translate` with *language* set to the new code: everything is translated into it while players can't see it yet (cents on Haiku).
3. `/translation-review` for that language, and its fixes in a PR (§ 2).
4. **Admin → Settings → Languages → Show**, then **Save**.

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

**Change the password:** Admin → battle plan → "Shared password" (or Table Editor → `kvk_plans` → `password`); *Suggest* next to every shared-password field fills in a random six-digit code, easy to read out and type on a phone. Everyone is logged out immediately (the cookie is derived from the password) — share the new one on Discord.

**Guessing protection.** The password stays simple on purpose, so guessing is slowed instead: an address that enters five wrong passwords within 15 minutes is locked out for an hour, doubling with every further lockout up to a day (the form shows a countdown); addresses are stored only as hashes. These are the defaults: the owner changes the numbers under **Admin → Settings → Wrong passwords** (the same rules apply to the leader and checklist pages and to Rally Sync rooms). Wrong tries from *all* addresses are also counted per hour, and past 30 the site writes a "kvk.bruteforce" entry to the admin overview's change log and, if `ALERT_DISCORD_WEBHOOK_URL` is set (Discord → Server settings → Integrations → Webhooks → New webhook → copy URL, then add the variable in Vercel), posts an alert to that channel. That layer never locks anyone out: when it fires, change the password. `KVK_SESSION_SECRET` (or `TRANSLATE_WEBHOOK_SECRET`) is required in production; the app refuses to sign cookies with a development fallback there.

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

**AI step (Results → "Translate answers" and "Translate and analyse").** Never automatic. *Translate answers* (any moderator or administrator) translates the written answers of every response that has no English version yet, in batches, and stores them next to the original, so nothing is translated twice; it uses the small model and is cheap. *Translate and analyse* is **the owner's alone** (the button is shown only to them and the server checks again): it translates what is left, then one request reads every response and stores a summary on the retrospective: the mood on the 0–5 scale, the positive/neutral/negative share per prompt, the recurring themes with a count and a quote, and three suggested actions. Administrators and moderators read the stored summary on the same page. The page shows it with the number of responses it saw and the tokens it used; "Update analysis" re-runs it after new answers. It uses the translation provider (§ 2): with Anthropic, `RETRO_TRANSLATE_MODEL` for the translation and `RETRO_ANALYSIS_MODEL` (at high effort) for the summary, both `claude-haiku-5-5` by default; with Gemini, `GEMINI_MODEL` for both. **Cost:** on Haiku both cost cents. A larger model (`claude-sonnet-5-5`, `claude-opus-5-5` in `RETRO_ANALYSIS_MODEL`) writes a somewhat better summary at many times the price (Haiku's own rate rises fivefold above 100K prompt tokens, still cents), so it is a setting to try, not the default. Either way, run the summary once, after the form has closed, not after every few answers; the token counts of each run are in its audit entry. Only alliance, ratings and texts go to the model, never a Governor ID or a name. Every run is an audit entry (`retro.translate` or `retro.analyse`) with its token counts.

**Limits and retention.** Each form has a response cap (default 600, the editor allows up to 2 000; the kingdom has about 300 active players, so far more is somebody flooding the form) and a per-address budget of eight submissions an hour; a hidden honeypot field catches the dumbest bots. Answers are kept for `retention_days` after the battle (default 30, from 7 to 365; the owner sets what a new form starts with, and the cap's default, under **Admin → Settings → Feedback forms**): the Maintenance task `prune` runs every day at 05:41 UTC (`npm run prune`, `prune-dry-run` to preview), deletes what is due, closes those forms and writes a `retro.prune` entry to the change log. The Feedback page shows every battle's deletion date in advance. Tables: `kvk_retrospectives` (settings) and `kvk_retro_responses` (answers), both service-role only; both are part of the weekly backup (a few hundred small rows).

### 9b. Rally Sync (Tools → Rally Sync)

Rally leaders get their own UTC start time so every rally lands on the target at the same second: start = hit time − rally timer − march time. Pages: `/tools/rally-sync` (join a room) and `/tools/rally-sync/<room ID>` (the room); the Tools page and the KvK menu link to it. **Nothing to configure**: no new environment variables, no Supabase setting to change.

**Rooms.** Moderators and administrators create them in the admin area (Admin → **Rally Sync**): a title, a password (6+ characters; *Suggest* fills in a random six-digit code), the mode (rally, counter-rally or garrison refill, see below; fixed for the room, since each is run by different players), the rally timer (default 5:00), the Re-sync buffer (default 30 s: Re-sync sets the hit to now + rally timer + longest march + buffer, so the buffer is just the time the leader with the longest march has to get ready before starting; everyone else has longer). The page then shows, once, the **room ID + password**, the **invite link** (opens the room directly; its key sits after the `#`, so it never reaches a server log) and the **coordinator link** (full control, for whoever runs the room). The creator's device is coordinator straight away. *New coordinator link* replaces a lost one (the old one stops working); *Destroy* closes a room. Players need no account: they open the link, or type the room ID and password on `/tools/rally-sync`, and add their in-game name and march time; their device keeps a token so they can change their own entry later or take it out again (*Edit* → *Remove my entry*; they stay in the room). A coordinator who leads a rally too manages their own entry the same way, since it sits above the list rather than in it.

**The coordinator** sets the hit time (*Re-sync* = now + rally timer + longest march + buffer, in one tap; or a UTC time), adds, edits, removes or sits out leaders, copies the plan for the game chat (*Copy for game chat*, once a hit time is set: the hit time, the rally timer and every leader's start time on its own line, for leaders without the page; a leader who can't make the hit is marked "too late"), shares the invite and changes the password (everyone already in the room stays in; newcomers need the new password and old invite links stop working). While a rally is running, *Re-sync* needs a second tap within four seconds: the first tap only arms it (it turns red and shows the new hit time), so a stray tap can't replace a running hit time; with no rally running one tap is enough. On a computer every time field takes ↑ / ↓ to add or take off a second (Shift: ten); an empty hit-time field starts from the current hit time.

**Who is in the room.** Every browser that opens a room (password or invite link) is an *instance* of it, so one player can run two leaders from Chrome and Safari. The coordinator's *More options* → **In the room** lists them all: by the name a browser gave itself, else its leader's name, else "Watcher" and a random four-letter tag (a watcher can *Set a name*; a leader renames their browser in their *Edit* card, e.g. when they run the entry for someone else; joining as a leader switches the browser to the leader's name, leaving keeps it), with who coordinates and when each was last on screen. *Remove* logs one browser out at once and *Log everyone else out* all but the coordinator's own; a removed browser can come back with the current password, so change the password too if it shouldn't. Removing a browser leaves its leader entries in place. The *Invite* panel checks the link and password this device saved against the room each time it opens, so a password changed by another coordinator never leaves a dead link on screen.

**During a rally** (from the moment a hit time is set until it lands) nothing changes under the leaders' feet. Someone who joins then gets no start time for it and is in from the next one. A leader who changes their own march time keeps their start; the new time shows as "next rally" and takes over with the next hit time. A leader can **sit out** (Edit → *Sit out*, or the coordinator on their row): no start time, no sounds, not counted by Re-sync; *Back in* brings them back at once before a rally, or from the next one during it. Setting a new hit time (Re-sync or a typed time) or clearing it starts the next rally for everyone waiting. The coordinator's own edits of a leader apply at once, so they can still fix a mistake mid-rally.

**Counter-rally rooms** are for the counter alliance. When the enemy rallies the castle our main alliance holds, the counter alliance rallies the same castle so it lands just after the enemy. The counter leaders can't see the enemy's rally (only the main alliance can), but they do see their own alliance's rallies, with the countdown, in the alliance chat and the war list. So the room gives no times, only the **launch order**: the slowest march starts first when the main alliance says go, and every other leader starts when an earlier counter rally's countdown shows their cue (rally timer − the difference in march), so all the counter rallies land in the same second. For example, with a 5:00 timer, Mira (0:47) starts when Rajx's (0:52) rally shows 4:55. From the third leader on the page gives two cues, the first rally's and the one just before, so a second's slip along the chain doesn't add up. Each leader sees their own cue big at the top and the whole order below; the order updates itself when anyone changes a march time (pets), leaders sitting out drop out of it. Every cue is also given in seconds after that rally started ("+5 s"; the leader's card says "or count 5 s after Rajx starts") for leaders who count on their own clock, and the coordinator has two copy buttons for the game chat, one per style: *Copy: countdowns* (`2. Mira: Rajx 4:55`) and *Copy: seconds after* (`2. Mira: Rajx +5 s`), one leader per line. Everyone in the room uses the room's rally timer. There is no hit time, countdown or sound in these rooms: when the counter lands relative to the enemy is the main alliance's call.

**Garrison rooms** are for defending the castle. Enemy rallies hit it one after another, and our garrison refills have to land *between* two hits: too early and the garrison is still full, so the troops turn back; too late and the next hit lands first. The gaps are often only a second or two, so this mode works it out for every player.

- **The coordinator** (one or two people) first adds the enemy rally leaders (*Edit enemy list*): a name (optional; empty gives #1, #2 …) and the march time from that leader to our castle, recorded from earlier hits; a tick box says who rallies this time. Each active leader then has a card that keeps its place. When the game shows an enemy rally coming, tap *Rally started* on that leader's card and then the countdown button (4:45 … 3:00) at the moment the game's rally countdown shows that value (or *Other countdown*: type what it shows and tap *Now*). The page takes the tap's moment from the coordinator's corrected game clock, so typing speed doesn't matter. Until the rally launches, −1 s / +1 s and *Re-time* fix it; once it marches, the card counts down to the hit ("Lands in 0:34", like the game's own countdown, so a second or two off shows at a glance) and only *Correct landing time* (type what "lands in" shows, tap *Now*), which also saves that leader's march time for the next waves. Pets speed a leader up for two hours: change the march with the pencil next to it in the card's top corner; the previous value stays one tap away (*Use 0:42 again*).
- **Enemy hit** = launch + that leader's march. A **refill window** is a moment between two hits at least 2 s apart, at most 3 s after the first; hits in the same second leave no window, and nothing is planned after the last hit (that refill is the coordinator's call). The refill windows show at the top of the coordinator's view, and **Copy for game chat** copies each enemy's hit time and our refill landing times, one per line, for players without the page.
- **Every player** types their own march time to the castle (and how quickly they can send one march after another, default 5 s) once; it stays on their device. Their page then shows a card per refill: *Send at* 21:41:08 with a countdown, beeps (a chime 30 s ahead, ticks to GO) and SEND NOW. The next send is big and the rest small; sends (and speedups) 5 s apart or closer are big together from the start and stay big until the last of them, so no card grows or shrinks while the player is tapping, and once a burst is sent the next one turns big. Everyone aims at every window with separate marches (tip: save a garrison formation). When a send can't be made in time after the previous one, the page plans it later with a speedup, which cuts the remaining march time: 25 % (400 gems) when the march shows four times the delay, else 50 % (2000 gems) at twice the delay. A window that moves after a correction is marked *Updated*.
- **After the wave** the list clears itself 30 s after the last hit; *Clear all* (two taps) does it at once. Players never see a list of who is in.

**Limits.** Set by the owner per kind of room under **Admin → Settings → Rally Sync capacity**: rooms open at once, leaders per room and browsers per room. The defaults fit a battle on the castle and the four turrets: **5 rally rooms** of up to 10 leaders and 12 browsers, **5 garrison rooms** of up to 22 browsers (defenders take no leader slot) and **1 counter-rally room** (at most 2) of up to 10 leaders and 10 browsers. Every browser with a room open holds one live Supabase Realtime connection and the free plan allows 200, so the three kinds share one limit: if every room were full they may hold **180 browsers** together (20 spare). The page checks that total with every change, outlines the numbers that feed it when it is over, offers the single changes that would fix it and saves only once it fits; the database also refuses a 181st browser across all open rooms. A browser counts while it had its room on screen in the last 10 minutes, so one that left frees its place. Lowering a number never closes a room or removes anyone; it only stops new ones. The database enforces all of it (migration 0012; 0013 adds the leaders' status and next-rally march time; 0014 the browsers in a room; 0015 garrison rooms; 0016 the limits per kind of room), so two moderators at once can't go past them, and every change of the limits is in the audit log. A room closes after **30 minutes with nobody on the page** (open pages check in every three minutes while they are on screen) and **24 hours** after it was created at the latest; closed rooms are deleted every five minutes by `pg_cron` (the migration enables it and schedules the job `rally-sync-close-idle-rooms`; Dashboard → Integrations → Cron shows it) and by the daily `prune` task as a backstop. Wrong passwords use the same lockout as the battle plan (§ 9). Rooms are not backed up.

**Realtime.** Pages listen on a Supabase Realtime **broadcast** topic that is random per room and only given to visitors who unlocked it; the database triggers send nothing but "changed" or "closed", and every page then refetches the room through the password-checked route `GET /api/rally-sync/<room ID>`, so nothing is readable with the public key. This needs Realtime enabled (the default) and Dashboard → Realtime → Settings → **Allow public access to channels** left on (the default). Without Realtime the pages still work: they poll every 30 seconds. Expected use (two rooms, 15 people) stays around 5 % of the free tiers: ~15 of 200 Realtime connections, ~100 000 of 2 million messages and ~40 000 of 1 million Vercel function calls a month; a full battle day at the default limits stays within the 200 connections by design. Supabase also allows 100 messages a second: in the busiest second of a garrison wave many rooms may get a ping at once, and if that is ever too much Supabase drops the links for a moment and pages reconnect (and poll meanwhile). Dashboard → Reports → Realtime shows it after a battle.

**Clocks.** The **game clock is the source of truth**: the hit time and every start time are game-clock times, the same numbers on every screen, to match against the in-game clock. By default the page assumes the game clock is UTC: each room request returns the server's clock and the page corrects the device's own clock with it. If the clock the game shows is a second or two off, the player opens the clock button on the room page and nudges **Game clock** with − / + until the seconds tick together (labelled "game clock +2 s"). That only moves *that device's* "now": its countdown and beeps then reach zero when its game clock shows the start time, and the times shown don't change. The coordinator's typed hit times are game times as typed; their Re-sync, and in a garrison room the moment of each tap, count from their own adjusted clock. Sound (a chime at 60 s, rising beeps at 5 … 1, a GO tone), keeping the screen on and the game-clock adjustment are remembered per device.

**Layout.** A rally room is deliberately quiet (counter-rally and garrison rooms are laid out as described above): one status line (room, mode, live dot, clock, icon switches), one big block with the player's own start time (it turns amber at 60 s, red at 15 s, then GO, and stays pinned below the header from 60 s; the start time keeps its size throughout, since players start on the in-game clock, and the countdown under it grows but stays smaller), the player's own entry as a highlighted card, and the other leaders as quiet grey rows below (the coordinator sees them with their stage colours). The coordinator's main controls (Re-sync, hit time) are always visible; settings, adding a leader, inviting, who is in the room, previous hit times, clearing and destroying sit under *More options*.

**Guided tour.** The **?** at the end of the status line walks through the room: the page dims, the part each step explains stays lit, and a card at the bottom says what it is for (*Next* / *Back*, Esc or a tap on the dimmed page ends it). Each visitor gets only the parts they see: a watcher, a leader and the coordinator get different steps, and each mode has its own tour. Nothing opens by itself, so an invite link always lands on the room; a first-time visitor sees the **?** highlighted and a quiet *New here? Take the quick tour* line until they open the tour or hide the line (remembered per device), and never while a rally is running or enemy rallies are coming in. The texts are interface strings, so they come in every language of the site. The speaker on the card reads each step aloud with the device's own voices (off until tapped, then remembered on that device); it shows only when the device has a voice for the page's language.

**Trying it locally without the database.** `RALLY_SYNC_STORE=memory npm run dev` (or `npm run build && RALLY_SYNC_STORE=memory npm start`) keeps rooms in the server's memory and always offers three demo rooms: the rally room `/en/tools/rally-sync/TEST23`, password `review123`; add `#c=local-review-coordinator` to the room's address to be its coordinator. `/en/tools/rally-sync/DEFEND` (same password and coordinator token) is a demo garrison room with three enemy leaders, and `/en/tools/rally-sync/CNTR22` a demo counter-rally room with three leaders. That fixed token belongs to the demo rooms alone: real rooms get a random 32-character coordinator token at creation, stored only as a hash. There is no Realtime in this mode, so pages poll every five seconds. The admin page works too after a Discord sign-in on localhost. The variable is ignored on Vercel.

### 9c. Alliances from MightPulse (Admin → Settings → Alliances)

The alliances on Home are a list the owner keeps, and their numbers come from [MightPulse](https://api.mightpulse.com) (the same `MIGHTPULSE_API_KEY` as the Governor check, § 9). Each alliance on the list is linked to its alliance in the game by MightPulse's alliance id, so when an alliance changes its tag or name, the site follows on the next sync. The five alliances of the first setup are linked by their tags on the first sync.

- **Daily sync, 06:07 UTC.** Maintenance runs the task `alliances`, which asks the site (`POST /api/alliances/sync`, with `SITE_URL` and `TRANSLATE_WEBHOOK_SECRET`, no new secret; the MightPulse key stays in Vercel) to read the kingdom's power ranking and each alliance on the list, and to update tag, name, power, leader and members. It uses a handful of MightPulse's 5 000 calls a day. When MightPulse is down the run fails (you get GitHub's e-mail), the settings page says so, and the alliances stay as they were. Run the task by hand, or press **Sync now** on the page, to sync at once (once a minute at most; MightPulse itself refreshes an alliance about hourly).
- **The list.** Each alliance shows its rank in the game (red when it falls below the top six), its numbers and where they come from. **Edit** corrects tag, name, power, leader, members and its colour on Home; numbers typed there show as "typed by hand" and are logged apart from the sync (`alliance.edit_by_hand`) until the next successful sync replaces them. **Hide from Home** keeps it on the list (and syncing); **Remove** takes it off.
- **The ranking.** The kingdom's ten strongest alliances as MightPulse last saw them; **Add** puts one on the list and on Home, already linked. **Add one by hand** is for an alliance MightPulse doesn't know yet (or while it is down): the next sync links it by its tag.

**Battle alliances.** [KvK] and [TMP] are where every player goes for the castle battle and KvK, so on battle day they top MightPulse's ranking and the home alliances empty out. The site knows them (by their tag the first time, then by MightPulse's id): they never appear on Home or get an Add button, they don't count in the ranks (so the strongest home alliance stays Rank 1 on battle day), and the page lists them on their own line.

**Battle days.** A battle is every second Saturday (KvK on the prep round's Saturday, the castle battle on the Saturdays in between: 24 Oct, 7 Nov, 21 Nov 2026, …), or on the date of the active battle plan if a battle moves. From 00:00 UTC on a battle day until noon UTC the day after, the sync keeps the alliances' power, members and leaders from before the battle (tag and name still follow) and the page says so. Nothing about a battle is guessed from power.

**Only your list is shown.** Home shows exactly the alliances on the list, strongest first; nothing joins or leaves it by itself. An alliance that isn't on the list but climbs into the top six is flagged **Held for review** on the page, for you to add or ignore; one on the list stays however far it falls (a neutral note says when it ranks below the top six).

**A new tag follows everywhere.** The site names an alliance by its tag in a few other places: the admins' profiles, the battle plans' coordinators and rally leaders, and battle feedback answers. When an alliance's tag changes (by the sync, your Edit, or the Supabase dashboard), the database rewrites those in the same step, so they stay with their alliance. Tags are case-sensitive in the game (**[NAM]** NewAgeMonarchs and **[Nam]** NAMacademy are two alliances), and the site keeps them exactly as the game writes them.

Home shows the alliances strongest first, so the rank badge matches the game. Descriptions, requirements and Discord links are not part of the sync and stay as they are in the table.

### 9d. Gift codes (Admin → Gift codes)

Home lists the gift codes that work right now. They come from [kingshot.net](https://kingshot.net/gift-codes), a fan site that keeps a list of working Kingshot codes and offers it without a key; Home credits it and links the game's official redeem page.

- **Every hour, at minute 23.** The **Gift codes** workflow (its own, so its 24 runs a day don't fill the Maintenance history) asks the site (`POST /api/gift-codes/sync`, with `SITE_URL` and `TRANSLATE_WEBHOOK_SECRET`, no new secret) to read kingshot.net's list. A new code goes on Home within the hour; a code kingshot.net stops listing leaves Home (it shows as *Ended* on the admin page and is deleted 30 days later, like an expired one). Home is only rebuilt when something changed. The same run takes announcements and gift codes that reached their expiry since its last run off Home (the pages otherwise refresh once a day). GitHub runs scheduled workflows when it can: on a quiet repository "every hour" is often every few hours, so a new code or an expiry can take that long. Check now on the gift-code page fetches new codes at once; the Maintenance task `revalidate` refreshes every page at once.
- **When kingshot.net is down** nothing changes and the run still passes; it is tried again the next hour. Only after six hours without an answer (or when the database is the problem) does the run fail, so GitHub e-mails you. kingshot.net's list has no official documentation, so if its format changes the check stops changing anything (it never reads a new format as "no codes") and the admin page says the last check failed: add codes by hand meanwhile and tell a developer.
- **The admin page** (moderators and up) shows the last check with **Check now**, the codes on Home and the ended ones. Moderators **add a code** kingshot.net doesn't list yet (from in-game mail or Discord; codes are case-sensitive), write **what it gives** (English, translated by itself) and its **expiry** if known, **hide** a code from Home, and **delete** codes they added or that ended. A code kingshot.net still lists can only be hidden: deleted, it would come back within the hour. Once kingshot.net lists a hand-added code, the hourly check takes it over and ends it when it stops working.
- **Run it by hand:** Actions → Gift codes → Run workflow, or Check now on the page (once a minute).

### 9f. Announcements, events, rules, guides, alliance pages and transfers (Admin → Website)

The news on Home, the events, the rules page, the guides and the alliance pages are written in the admin area by moderators and up (transfers by administrators); there is no approval step, and every save is in the change log with its author.

- **Events** are either **the same time for everyone** (Alliance Championship: players see the start in their own time zone, with a countdown) or **picked by each alliance** (Bear Hunt, Viking Vengeance: players see the day only, in UTC, with "Each alliance sets its own times"; each alliance writes its times in its section of the event's guide). A round can have a second day (Viking Vengeance: a Tuesday, repeating every 14 days, second day 2 days later). The start is any past or coming round; the site counts on from it. The seeded events are placeholders: check every one before players rely on it.
- **Alliance pages** (`/alliances/<tag>`, linked from each alliance on Home): the rank, power, leader and members come from MightPulse every day; moderators write a few lines about the alliance, its requirements, its languages and a Discord invite that never expires. The list of alliances stays the owner's (Settings → Alliances). The page also lists the guides where the alliance has its own section, and a guide opened from there shows that alliance's tab.
- **Discord & transfers** (administrators): the **kingdom Discord** invite (the server for all of 1241) puts a "Join our Discord" button on Home and a link at the foot of every page; empty, neither shows. **Transfers** (`/transfers`, in the main menu and linked next to the alliances on Home; while open, Home's banner shows a "Transfers open" badge) are switched open or closed. While open the page shows the game's terms as the Transfer Manager gives them (the transfer group's kingdoms, the window in UTC, the Transfer Power caps as a regular or a leading kingdom, typed in millions; each optional) and anything else you write; whom to ask (for instance a name with their Discord handle) shows either way; both texts take formatting (bold, lists, links; no images) and are optional, with a Discord button: the transfer server's invite ("Join the transfer Discord"; it may differ from the kingdom's), else the kingdom Discord ("Join our Discord"), else none. Every Discord link (kingdom, transfers, each alliance's) is optional and must be an invite (discord.gg/… or discord.com/invite/…); use one that never expires.

- **Rules** are grouped in topics, the tabs of the rules page. The ▲ ▼ arrows order the topics and, inside each topic, its rules; a hidden topic takes its rules off the page with it. A topic's address is the end of its link (`/rules#attacks`).
- **Guides** have a text for everyone and, for each alliance that plays the event its own way, an **alliance section** (one per alliance and guide, written by any moderator). Players see the sections as tabs under the text, in the order of Home's alliances, and their device remembers the alliance they picked, for every guide. A guide's address is the end of its link (`/guides/bear-hunt`); a changed address takes the events that link to the guide along, and a deleted guide unlinks them. The alliance list is the owner's (Settings → Alliances); a renamed alliance keeps its sections.
- **The placeholders** from the seed (announcements, rules, guides) are the moderators' to edit or delete: `db:seed` fills these tables only when they are empty, and `sync-ui` never touches them, so a deleted placeholder stays deleted.

- **The editor** is Markdown with buttons (bold, italics, heading, lists, quote as a gold box, a red danger box for "don't do this" warnings (`> [!DANGER]`), link, table, image) and a **Preview** tab that shows the text through the same pipeline as the live page. Text copied from Discord keeps its formatting (Discord writes Markdown too; a `# heading` becomes a section heading). English is the source: a changed English text is translated again within a minute, and every other language can be corrected by hand from the language menu (that correction stays until the English changes). The battle-plan, rally-leader, checklist and feedback introductions use the same editor, without images.
- **Images** go to the public `images` bucket in Supabase Storage (not the 500 MB database; one small row per image in `content_images`). The browser shrinks every image before upload: at most 1600 × 2560 pixels (a full phone screenshot stays sharp), WebP, or JPEG on Safari, aiming at 600 KB; re-encoding drops camera data such as the location, and the server strips the small metadata block Safari adds. The server takes WebP or JPEG up to 900 KB only, refuses uploads once all images reach **500 MB** (half the free 1 GB), and texts hold at most **3 images** (announcements, rules) or **10** (guides). Images from other sites aren't shown (a hotlinked image tells a stranger who reads the page, and Discord's attachment links expire). On the page an image fits the column and opens full size on a tap.
- **Translations** keep the images: the pipeline sends each image to the model as a placeholder and puts the original back afterwards. A translation is only saved when every image is back in the same place as in English; if the model moves or drops one, it is asked once more, and if that fails too the language shows the English text until the next translation run (the log says "lost or moved an image"; Settings → Languages counts it as a missing text). The image's description stays in English.
- **Clean-up:** an image no text refers to any more (taken out of a text, or its announcement deleted) is deleted by the daily `prune` once it is a day old. The image files are not in the weekly backup (only the list of them is); Storage is outside the database dump.
- **Locked pages take no images:** the bucket is public, so anyone with an image's link could open it; the battle-plan forms refuse images.
- **Migration 0020** adds `body_source` (the Markdown) to announcements, rules and guides, the `content_images` table, and limits the bucket to WebP/JPEG up to 900 KB. Until it is applied, saving still works and uploads say so.
- **Migration 0021** adds `guide_sections` (the alliance sections, readable by visitors when shown) and lets them follow an alliance's renamed tag. Until it is applied the guide editor says sections are on their way. Afterwards run the Maintenance tasks **`webhooks`** (so a section is translated when it is saved) and **`sync-ui`** (the guide page's three new labels in the machine-translated languages).
- **Migration 0022** adds an event's `timing` (same time for everyone, or picked by each alliance) and `also_after_days` (a second day per round), and marks the seeded Bear Hunt and Viking Vengeance as picked by each alliance. Until it is applied, events save as before and the editor says the new choices are on their way. Afterwards run the Maintenance task **`sync-ui`** (the new event, alliance-page and transfer labels, and the transfer texts) once the deployment is live. `sync-ui` writes many strings at once, and every page in every language is rebuilt as their translations land: a burst of Vercel ISR writes (200K a month on Hobby). When the month's ISR writes are already high (Vercel → Usage), wait for the new billing cycle: until then the new labels show in English and the four hand-written languages, and transfers count as closed until the first save on Discord & transfers.

### 9e. Usage (Admin → Settings → Usage)

One page, owner only, for a daily look at whether the free plans hold. A verdict on top (**All fine**, something **to watch** in amber, something that **needs action** in red, with their names) also sits at the top of the admin Overview, so the look is one click; each line below says what it measures, what it means and where to act.

- **Database (Supabase):** its size against the free plan's 500 MB, the disk (database plus its write-ahead log against the fixed 2 GB; at 95 % the database turns read-only), the editor's images in Storage (against the 500 MB the editor allows itself, half of the free 1 GB), open connections, and the share of reads served from memory (speed). The database reports these itself (`public.usage_snapshot()`, migration 0019), with every table by size and rows. A line turns amber at 70 % of its limit and red at 90 %.
- **Live use and jobs:** the Rally Sync browsers open now against the budget of 180, pg_cron's jobs (the idle-room cleanup every five minutes; a failure shows Supabase's own message), and when the weekly backup, the daily cleanup, the alliance sync and the hourly gift-code check last ran. The backup and the cleanup note their runs from this version on, so right after the deploy the backup shows "none noted yet" until Monday's run (or run Maintenance → backup).
- **Measured elsewhere:** Vercel (Active CPU, ISR writes, data transfer, deployment storage), Supabase (egress, Realtime messages, peak connections) and the AI bill only show on those dashboards; the page links them. A look once a week is enough, and whenever they e-mail you.

Nothing here changes anything: each line links to the place to act (a settings tab, the Feedback page, the Maintenance runs, Supabase's report or billing).

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

1. **What you need** — a clone of the repository (`main`) and, from your password manager: `BACKUP_PASSPHRASE`, `SITE_OWNER` (your Discord user id, § 0: without it production won't build) and, ideally, the old `TRANSLATE_WEBHOOK_SECRET` and `KVK_SESSION_SECRET`. New secrets work too: players unlock the battle plan once more, nothing else changes.
2. **Supabase project** (§ 1) — create it, save the database password, collect the project ref, URL, publishable and secret keys, create an access token.
3. **GitHub secrets** (§ 6a) — set them all. Put the same values into `.env.local`.
4. **Tables** — Actions → **Deploy database** → *Run workflow* applies every migration to the empty project.
5. **Content** — with a backup: `npm run backup -- --restore <newest file> --yes` (§ 10). Without one: Maintenance → `seed` gives you the placeholder content, then edit it as in the beginning.
6. **Vercel** (§ 5) — import the repository, set the environment variables (with `SITE_OWNER` and, if you had one, `ALERT_DISCORD_WEBHOOK_URL`), deploy. If the production URL changed, update the `SITE_URL` secret and `site_url` / `additional_redirect_urls` in `supabase/config.toml` (a small PR). Then create the `VERCEL_TOKEN` secret (§ 5, *Old deployments*); if the Vercel team or project name changed, also update `TEAM`, `PROJECT` and `PRODUCTION_DOMAIN` at the top of `scripts/prune-deployments.ts` (same PR).
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

**Refresh the cache now.** Content is cached for up to a day when nothing expires it. To refresh immediately: Maintenance workflow → `revalidate`, or

```bash
curl -X POST https://<your-site>/api/revalidate -H "Authorization: Bearer <TRANSLATE_WEBHOOK_SECRET>"
```

**Change site settings.** Table `site_settings`: `kingdom_name`, `tagline`, `daily_reset_utc_hour`; the Discord invite and the transfer keys are edited in Cockpit → Discord & transfers.

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
- **Prune deployments warns "VERCEL_TOKEN is not set" or fails with 401/403.** The token expired (they are created for a year) or was revoked: create a new one and store it again (§ 5, *Old deployments*). Until then nothing is deleted, so keep an eye on Usage → Deployment Storage. "Can't tell which deployment … serves" means the team, project or domain at the top of `scripts/prune-deployments.ts` no longer matches Vercel; nothing was deleted.
- **An old preview link from a pull request says the deployment was deleted.** Expected: Prune deployments keeps only the live deployment, the one before it and open pull requests' newest previews. Restore one under Vercel → Settings → Security → **Recently Deleted** while it is listed there.
- **A guided tour has no speaker on some device.** That device or browser has no voice for the page's language (for example Arabic in Chrome on Windows), or no speech at all; the speaker is hidden there on purpose. The tour itself works the same.
- **CI fails but it works on my machine.** CI uses the Node version in `.nvmrc` (24, the same major Vercel runs; `engines` in package.json pins it for Vercel) and `npm ci` (exact lockfile). Run `nvm use && npm ci && npm run lint && npm run typecheck && npm run test && npm run build` locally.
