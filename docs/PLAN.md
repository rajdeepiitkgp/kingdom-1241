# Kingdom 1241 Website Plan

A community website for Kingshot Kingdom 1241, inspired by 1424.win. Free to host, easy for alliance leaders to update, and readable in every language our players use.

## Goals

- One place for rules, announcements, event times and guides for all alliances in 1241.
- Useful tools for players: troop refill and pack value calculators, gift codes.
- KvK sign-ups and minister appointment booking directly on the site.
- Every line of text available in each player's language.

## Features

- **Home:** announcements, server time, daily reset countdown, upcoming events, alliances, gift codes.
- **Events:** schedule shown in each visitor's local time, with countdowns.
- **Rules:** kingdom-wide rules grouped by topic.
- **Guides:** how 1241 plays each event (Vikings, Bear Hunt, Swordland, KvK, Alliance Championship, more later).
- **Tools:** rally troop refill, pack value check.
- **KvK:** battle day sign-ups and group lists; minister appointment booking with automatic slot allocation (later phase).
- **KvK battle plan (password-locked):** one page for both of the kingdom's battle events — the internal castle battle and KvK, which alternate every two weeks. It holds the formations every player must save in the game (hero portraits, required top-right skill level and stars, troop ratio, attack/defence and rally-lead/rally-join tags), the coordinators of the two battle alliances ([KvK] rallies the castle, [TMP] counter-rallies) and the battle-day instructions. Later: which players join which rally leader, attack and defence groups with their UTC hours, and a name search for assignments.
- **KvK history:** every past KvK with opponent, result and notes.
- **Alliance pages:** leaders, power, members and requirements, updated automatically from MightPulse.
- **Transfers:** a section that admins can switch on or off; when off, a short note naming who to contact about transfers.
- **Content editing:** a rich text editor with headings, lists, tables and images; images are shrunk automatically and kept to a minimum.
- **Exports:** sign-up and booking lists download as spreadsheet files.

## Languages

- Starting with English, German, Korean, Polish and Arabic.
- Languages are configurable: admins can add or remove one at any time.
- Each language sets its own reading direction, so Arabic and other right-to-left languages get a properly mirrored layout.
- All content is translated by AI when it's added or edited, never when someone views the page. Leaders can correct any translation by hand.
- An Arabic-speaking player will review the Arabic version before launch.

## Roles

- **Administrators:** full control, including languages and who becomes a moderator.
- **Moderators:** manage content and regular members.
- **Members:** view the site; no login needed.
- Admins and moderators sign in with Discord.
- Players submit sign-ups and bookings with their Governor ID, which the site checks before accepting.

## Privacy

- The battle plan is locked behind one shared password, so enemy kingdoms can't read it. Admins can change it at any time, for example after each KvK or if it leaks.
- The whole site is hidden from search engines; players find it only through the shared link.

## Look and feel

- Light, cute and polished by default, with an optional dark mode.
- Works well on phones, since most players will use it there.

## Technology

- A modern web app hosted for free (Next.js on Vercel).
- A free database for content, roles and submissions (Supabase Postgres + Storage).
- An AI service for translations (Anthropic Claude for quality, about a dollar a month; Google Gemini's free tier as the alternative; can be switched or turned off at any time).

## Phases

1. Site layout, languages, home, events, rules, guides and tools. — **done (PR "Phase 1")**
2. Admin panel with Discord login, roles and the content editor (including the battle plan and formations).
3. KvK: battle plan with formations, coordinators and instructions — **done (PR "KvK battle plan")**; sign-ups, group lists, assignments and KvK history — open.
4. Alliance pages from MightPulse and the transfer section.
5. Minister appointment booking and slot allocation.

## Operations

- Code on GitHub; every pull request runs lint, typecheck, tests and build; `main` is protected by that check.
- Vercel deploys `main` to production and every pull request to a preview link.
- Database changes are SQL files in `supabase/migrations/`, applied to Supabase by a GitHub Action when they reach `main`.
- Logs are structured (JSON in production) with a request id on every API response, so problems can be traced.

## Open questions

- Alliance leaders, member counts, descriptions and Discord links (tags, names and power are in).
- Real event times and rules for 1241; the exact dates of the castle battle / KvK two-week cycle.
- Site address: free subdomain or a custom domain.
