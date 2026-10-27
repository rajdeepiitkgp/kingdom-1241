# Kingdom 1241 Website Plan

A community website for Kingshot Kingdom 1241, inspired by 1424.win. Free to host, easy for alliance leaders to update, and readable in every language our players use.

## Goals

- One place for rules, announcements, event times and guides for all alliances in 1241.
- Useful tools for players: troop refill and pack value calculators, gift codes, and Rally Sync so rally leaders land at the same second.
- KvK sign-ups and minister appointment booking directly on the site.
- Every line of text available in each player's language.

## Features

- **Home:** announcements, server time, daily reset countdown, upcoming events, alliances, gift codes.
- **Events:** schedule shown in each visitor's local time, with countdowns.
- **Rules:** kingdom-wide rules grouped by topic.
- **Guides:** how 1241 plays each event (Vikings, Bear Hunt, Swordland, KvK, Alliance Championship, more later).
- **Tools:** rally troop refill, pack value check, and **Rally Sync**: rooms (opened by moderators, at most three at once) where rally leaders enter their march time and each gets a UTC start time so every rally or counter-rally lands at the same second; the coordinator sets or re-syncs the hit time and everyone's page updates live, sees every browser in the room (watchers by a name or a random tag) and can remove any, with a countdown that grows and turns red in the last 15 seconds and beeps from 5 to GO. Rooms close after 30 minutes with nobody on the page. Garrison rooms do the same for defenders: the coordinator marks each incoming enemy rally by tapping the countdown the game shows, and every player's page tells them when to send their refill so it lands between two enemy hits, with the speedup to use if a send has to come later.
- **KvK:** battle day sign-ups and group lists; minister appointment booking with automatic slot allocation (later phase).
- **KvK battle plan (password-locked):** one page for both of the kingdom's battle events — the internal castle battle and KvK, which alternate every two weeks. It holds the formations every player must save in the game (hero portraits, required top-right skill level and stars, troop ratio, attack/defence tags and the role: rally lead/join when attacking, garrison lead/join when defending), the coordinators of the two battle alliances ([KvK] rallies the castle, [TMP] counter-rallies) and the battle-day instructions. Later: which players join which rally leader, attack and defence groups with their UTC hours, and a name search for assignments.
- **Rally-leader plan (password-locked, separate):** a second page for the players who start rallies, with its own password and its own audience: who leads which rally with which of their own heroes and ratio, assigned by in-game name.
- **KvK prep days (public):** the five scoring days before every KvK (every four weeks), what to use, wait for or skip on each day, the points each item scores, the council's tips (intel stacking with Master Pan, bison skill, Alliance RSS node, gathering speed boost, War Academy research, shield and home coordinates on battle day), an item × day table with game icons and the "save these for KvK" list, with live countdowns (the round, and each day) on the page and on Home.
- **Commander checklist:** for the battle commander and the coordinators, a third password-locked page in the KvK menu with its own password: the things to prepare and confirm before, on and after battle day (outposts connected, everyone teleported, …), ticked off on the commander's device per battle and copied into the next plan, plus the commander's orders (how to run the battle and keep rally leaders and joiners on the plan) and general guidelines.
- **Battle retrospective:** after the battle, players submit feedback against their Governor ID (one entry per player and battle; the id is checked against MightPulse when a key is set, which also fills in the name and alliance). Star ratings 0–5 from a fixed, translated catalogue (the council picks which are shown and required per battle) and up to three optional short texts in any language. Only the owner sees who wrote what; moderators read, export (CSV without identity) and prune; a retention setting and a size cap keep the free database from filling up. Later: machine translation of the texts to English and an AI summary of mood and themes, on demand.
- **Resource dashboard (owner):** database size and row counts per table, translation spend, and the Vercel and Supabase usage figures their APIs expose, with a warning before a free-tier limit is reached.
- **KvK history:** every past KvK with opponent, result and notes.
- **Alliance pages:** leaders, power, members and requirements, updated automatically from MightPulse.
- **Transfers:** a section that admins can switch on or off; when off, a short note naming who to contact about transfers.
- **Content editing:** a rich text editor with headings, lists, tables and images; images are shrunk automatically and kept to a minimum.
- **Exports:** sign-up and booking lists download as spreadsheet files.

## Languages

- Live in ten languages: English, German, Korean, Polish and Arabic (hand-written interface strings), plus Turkish, Italian, Japanese, Chinese (Traditional) and French (machine-translated, correctable by hand).
- Languages are configurable: admins can add or remove one at any time.
- Each language sets its own reading direction, so Arabic and other right-to-left languages get a properly mirrored layout.
- All content is translated by AI when it's added or edited, never when someone views the page. Leaders can correct any translation by hand.
- An Arabic-speaking player will review the Arabic version before launch.

## Roles

- **Administrators:** full control, including languages and who becomes a moderator.
- **Moderators:** manage content and regular members.
- **Members:** view the site; no login needed.
- Admins and moderators sign in with Discord. The site owner (set in the hosting configuration, not in the site) is always an administrator and is the only one who can appoint administrators; administrators appoint moderators.
- Players submit sign-ups and bookings with their Governor ID, which the site checks before accepting.

## Privacy

- The battle plan is locked behind one shared password, so enemy kingdoms can't read it. Admins can change it at any time, for example after each KvK or if it leaks.
- The whole site is hidden from search engines; players find it only through the shared link.

## Look and feel

- Light, cute and polished by default, with an optional dark mode.
- Works well on phones, since most players will use it there.
- Visitors can shrink or enlarge the text (A− / AA / A+, four steps up to 125%); that choice and the theme are remembered on the device and survive a language switch.
- Changes of language, theme, text size and page use a short crossfade, switched off for people who prefer reduced motion.

## Technology

- A modern web app hosted for free (Next.js on Vercel).
- A free database for content, roles and submissions (Supabase Postgres + Storage).
- An AI service for translations (Anthropic Claude for quality, about a dollar a month; Google Gemini's free tier as the alternative; can be switched or turned off at any time).

## Phases

1. Site layout, languages, home, events, rules, guides and tools. — **done (PR "Phase 1")**; text-size control, remembered preferences and crossfades — **done (PR "Text size and transitions")**
2. Admin panel: Discord sign-in, roles, user management and the battle-plan editor — **done (PR "Admin area")**; the content editor with images for announcements, rules, guides and events, language management and translation fixes — open.
3. KvK: battle plan with formations, coordinators and instructions — **done (PR "KvK battle plan")**; editor polish (arrows instead of order numbers, language dropdown, live `{{when}}` / `{{date}}` / `{{time}}` / `{{utc}}` tokens in the intro) — **done (PR "Admin area")**. Retrospective form with retention controls (star ratings and short texts per battle, Governor ID verified through MightPulse, owner-only identity, results, CSV export, daily prune) — **done (PR "Battle feedback")**; its AI step (translate the free text to English and summarise the mood and themes on demand) — **done (PR "Battle feedback AI summary")**. Rally-leader plan with its own password, and a KvK dropdown in the navigation — **done (PR "Rally-leader plan")**. Commander checklist (a third password-locked page in the KvK dropdown, for the battle commander and coordinators; no feedback form) — **done (PR "Commander checklist")**. Public KvK prep days page with countdowns, day tips, points and the item × day table — **done (PR "KvK prep days")**. Rally Sync (rooms with a per-room password and invite link, live start times for rally and counter-rally, moderator-created, limits and auto-close) — **done (PR "Rally Sync")**; every browser in a room visible to the coordinator and removable, password changes that keep everyone in, a two-tap Re-sync during a rally, and *Suggest* for shared passwords — **done (PR "Rally Sync: who is in the room")**. Garrison rooms (refills timed between enemy rally hits, enemy leaders with recorded march times, tap-on-countdown marking, per-player send times and speedups, copy for game chat) — **done (PR "Rally Sync: garrison refills")**. *Copy for game chat* in rally and counter-rally rooms too (hit time and every leader's start) — **done (PR "Rally Sync: copy for game chat")**. Then: sign-ups, group lists, assignments and KvK history — open.
4. Alliance pages from MightPulse and the transfer section.
5. Minister appointment booking and slot allocation.
6. Owner resource dashboard: own-database figures first (size, rows per table, translation tokens per run), then Vercel and Supabase usage through their management APIs where tokens allow.

## Operations

- Code on GitHub; every pull request runs lint, typecheck, tests and build; `main` is protected by that check.
- Vercel deploys `main` to production and every pull request to a preview link.
- Database changes are SQL files in `supabase/migrations/`, applied to Supabase by a GitHub Action when they reach `main`.
- Logs are structured (JSON in production) with a request id on every API response, so problems can be traced.
- Every Monday the Maintenance workflow stores an encrypted backup of all content, roles and the audit log as a 90-day artifact; `npm run backup -- --restore` brings it back, also into a fresh Supabase project (SETUP.md § 10 and the rebuild runbook in § 11).
- Supabase's webhook triggers and auth configuration are declared in the repository (`supabase/webhooks.sql`, `supabase/config.toml`) and applied with one-click Maintenance tasks, so nothing lives only in a dashboard.
- Player-submitted data (feedback, later sign-ups) is bounded by design: one row per player and battle, short text limits, a per-battle cap, and a retention period after which the Maintenance workflow prunes it; admins can delete a battle's submissions at any time.

## Open questions

- Alliance leaders, member counts, descriptions and Discord links (tags, names and power are in).
- Real event times and rules for 1241; the exact dates of the castle battle / KvK two-week cycle.
- Site address: free subdomain or a custom domain.
