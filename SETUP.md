# Setup guide — Kingdom 1241 website

Everything the site needs runs on free tiers: **Vercel** (hosting), **Supabase** (database + image storage) and **Gemini** (translations). Discord login is a phase-2 feature, but its keys are described here so the Supabase side is ready.

Nothing secret is ever committed. Keys live in `.env.local` on your machine and in the Vercel project settings.

---

## 1. Supabase — database and image storage

1. Go to <https://supabase.com/dashboard>, **New project**. Pick a region close to most players (e.g. Frankfurt). Save the database password somewhere safe (you rarely need it).
2. When the project is ready, open **SQL Editor → New query**, paste the whole file [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) and **Run**. This creates all tables, the read-only security policies and the public `images` storage bucket.
3. Open **Project Settings → API Keys** and note:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
     *(older projects show an `anon` key instead — that works too, put it in the same variable)*
   - **Secret key** (`sb_secret_…`, or the legacy `service_role` key) → `SUPABASE_SECRET_KEY`

   The publishable key is safe to expose; Row Level Security only lets it read published content. The secret key bypasses security and must only ever be set on the server (Vercel env vars, your `.env.local`).

## 2. Gemini — translations

1. Go to <https://aistudio.google.com/apikey>, sign in with a Google account, **Create API key** → `GEMINI_API_KEY`.
2. The free tier is enough: the pipeline only runs when content is added or edited and batches small texts together. If you hit a rate limit the scripts wait and retry.
3. Optional: `GEMINI_MODEL` overrides the model (default `gemini-2.5-flash`).

## 3. Webhook secret

The translation and cache routes are protected by a shared secret. Generate one:

```bash
openssl rand -hex 32
```

→ `TRANSLATE_WEBHOOK_SECRET`. You will paste the same value into Vercel (step 5) and into the Supabase webhook SQL (step 6).

## 4. Run it locally

```bash
cp .env.example .env.local      # then fill in the values from steps 1–3
npm install
npm run db:seed                  # boilerplate content → Supabase (safe to re-run)
npm run translate                # fill in German/Korean/Polish/Arabic with Gemini
npm run dev                      # http://localhost:3000
```

Without any env vars the site still runs with the bundled English seed content — handy for checking the design. With Supabase configured the pages read from the database.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run db:seed` | Inserts seed rows that don't exist yet (never touches rows you edited). `-- --overwrite` replaces seed rows, dropping their translations. |
| `npm run translate` | Translates everything missing or outdated. `-- --table guides`, `-- --locale de`, `-- --force`, `-- --dry-run`. |
| `npm run test` / `npm run lint` / `npm run typecheck` | Checks. |
| `npm run build` | Production build (what Vercel runs). |

## 5. Deploy to Vercel

1. Push the repository to GitHub, go to <https://vercel.com/new>, **Import** `kingdom-1241`. Framework preset: **Next.js** (auto-detected). No build settings to change.
2. Before the first deploy, open **Environment Variables** and add, for **Production** and **Preview**:

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | step 1 |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | step 1 |
   | `SUPABASE_SECRET_KEY` | step 1 (mark as *Sensitive*) |
   | `GEMINI_API_KEY` | step 2 (mark as *Sensitive*) |
   | `TRANSLATE_WEBHOOK_SECRET` | step 3 (mark as *Sensitive*) |
   | `SITE_URL` | your site URL, e.g. `https://kingdom-1241.vercel.app` (fill in after the first deploy) |

   Later you can change these under **Project → Settings → Environment Variables**; redeploy after changing one.
3. **Deploy**. The first build takes a minute. Note the URL (`https://<project>.vercel.app`) — set it as `SITE_URL` and redeploy. You can add a custom domain under **Settings → Domains** at any time.

The site sends `noindex` headers and a `robots.txt` that blocks every crawler; it is only reachable through the shared link.

## 6. Supabase → site webhooks (automatic translation)

Translation runs when a row is inserted or edited in Supabase — never when a page is viewed. Supabase tells the site about changes through Database Webhooks:

1. Dashboard → **Database → Webhooks** → **Enable webhooks** (one-time).
2. Open **SQL Editor**, paste [`supabase/webhooks.sql`](supabase/webhooks.sql), replace `YOUR-SITE.vercel.app` and `YOUR_TRANSLATE_WEBHOOK_SECRET` with your values, **Run**.

That creates one trigger per content table. Each change POSTs to `/api/translate`, which answers immediately, translates the row in the background (only if its English text changed — so its own write doesn't cause a loop) and refreshes the page cache. You can watch the calls under **Database → Webhooks** and in the Vercel function logs.

Without webhooks the site still works: run `npm run translate` after editing, and the cache refreshes itself every 5 minutes.

## 7. Discord OAuth (ready for phase 2)

Admins and moderators will sign in with Discord through Supabase Auth.

1. <https://discord.com/developers/applications> → **New Application** (e.g. "Kingdom 1241 site").
2. **OAuth2** → copy **Client ID** → `DISCORD_CLIENT_ID`, and **Reset Secret** → `DISCORD_CLIENT_SECRET`.
3. Under **Redirects** add `https://<your-project-ref>.supabase.co/auth/v1/callback` (the exact URL is shown in the next step).
4. Supabase Dashboard → **Authentication → Sign In / Providers → Discord** → enable, paste the Client ID and Secret, save.
5. Add `DISCORD_CLIENT_ID` and `DISCORD_CLIENT_SECRET` to Vercel (Sensitive) and to `.env.local`. Phase 1 doesn't read them yet.

---

## Everyday tasks (until the admin panel exists)

**Edit content.** Supabase Dashboard → **Table Editor**. Edit the `en` value inside the JSON of `title`, `body`, etc. (bodies are HTML). Save — the webhook translates the other languages within a minute. Set `published` to false to hide a row.

**Add a language.** Insert a row in `languages` (e.g. `fr`, enabled, sort order) — if the code isn't in `src/lib/i18n/languages.ts` yet, add it there (name, direction, font) and redeploy. Then run `npm run translate` once to backfill existing content.

**Fix a translation by hand.** Edit the language's value in the JSON. It stays until the English text of that row changes, which re-translates every language.

**Refresh the cache now.** Content is cached for up to 5 minutes. To refresh immediately:

```bash
curl -X POST https://<your-site>/api/revalidate -H "Authorization: Bearer <TRANSLATE_WEBHOOK_SECRET>"
```

**Change site settings.** Table `site_settings`: `kingdom_name`, `tagline`, `daily_reset_utc_hour`, `discord_invite_url`, `transfer_contact`.

## Troubleshooting

- **Pages show the seed content, not my edits.** Check the Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL` / `…PUBLISHABLE_KEY`) and redeploy; the data layer falls back to the bundled seed when Supabase is unreachable (see the function logs for `[data] Failed to load`).
- **Translations don't appear.** Vercel → Logs: look for `[translate]`. Common causes: webhook SQL still has placeholders, secret mismatch (401), `GEMINI_API_KEY` missing, Gemini quota exceeded (the row keeps its old `source_hash`, so the next `npm run translate` finishes it).
- **A language shows English text.** The row has no translation for it yet (fallback is intentional). Run `npm run translate`.
- **`npm run db:seed` fails with "Supabase admin client needs…".** `.env.local` is missing `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_SECRET_KEY`.
