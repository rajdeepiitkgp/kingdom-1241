---
name: translation-review
description: Review the site's machine translations with the session's model (the owner's Claude subscription, not the API key) - the interface strings and the admin-written content (the active battle plan with its leader, checklist and feedback pages, and the public content) - view first, fix only wrong meaning or misleading words. Interface fixes go through src/content/seed/ui-reviewed.ts and a PR; content fixes through a file the owner applies with `npm run content:fixes`. Use when the owner asks to check, align or fix translations, after a battle plan is filled in, or about once a month.
---

# Translation review

The pipeline translates every text on its own with a small model, so what goes wrong is mostly consistency and context, not grammar: a guide that names a button differently from the button, a game term that changes from one text to the next, a role mixed up (coordinator vs commander), Japanese slipping into casual endings, now and then a sentence that says something else. This skill reviews the live texts with the session's model and fixes them; nothing here costs anything on the API key.

## How to judge: view first

Read everything in scope, then change only what is wrong:

- **Leave it** when the meaning is right, even if you would phrase it differently: style alone (politeness, a synonym, word order) is no reason to touch a text.
- **Fix it** when the meaning is clearly different from the English, a role is wrong (a coordinator called "commander"), a word sends players looking for something that isn't there (a button, field or label the page names differently, e.g. a "monarch ID" when the form asks for the Governor ID), or a placeholder or the HTML is broken.
- In interface strings a game term or label that differs from what the page shows counts as misleading (players look for those words); a synonym in a battle plan doesn't.
- Findings are hints from simple checks, not verdicts; a capitalised phrase at the start of a sentence can look like a label without naming one.
- A language marked `manual` was corrected by hand by a moderator: never change it. If it looks clearly wrong, tell the owner.

## Rules

- Never call the Anthropic or Gemini API, never run `translate`, `db:seed`, `prune` or `backup`, never print a key or the contents of `.env.local`. The exports (`ui:review`, `content:review`) only read.
- Never write to the database yourself. Interface fixes reach the site through a PR and `sync-ui`; content fixes are applied by the owner with `npm run content:fixes`.
- **Battle-plan texts are secret and the repository is public.** Keep the content export and the fixes file in a temporary folder (the session's scratchpad if it has one), never in the repository, a commit, a PR, an issue or a log. In your report, name a text by table and column, not by quoting it.
- Don't change English. The hand-written interface languages (de, ko, pl, ar in `src/content/seed/ui-strings.ts`) aren't part of the interface review; if one is wrong, tell the owner.

## A. Interface strings (`ui_strings`)

1. **Branch.** `git switch main && git pull --ff-only && git switch -c i18n/review-<YYYY-MM-DD>`. Stop if the working tree isn't clean.
2. **Export.** `npm run ui:review -- --out <dir>`: prints the languages and findings and writes `review.json` with `items` (strings changed since the last review, or with an error), `glossary` (the word per term and language) and `locales`. Add `--all` to see hints on strings reviewed before. The first full review covers about 800 strings: go area by area with `--prefix` (comma list), e.g. `tour.`, then `sync.`, then `kvk.,leaders.,checklist.`, then `prep.`, `retro.`, then the rest.
3. **Review** `review.json` in slices (a few dozen items at a time). `changed: true` means nobody has reviewed this version yet, so read it even without findings. `live:` and `reviewed:` findings aren't errors: `sync-ui` hasn't run since the code changed.
4. **Fix** in `src/content/seed/ui-reviewed.ts`: one entry per key, sorted by key, `en` copied exactly from `ui-strings.ts`, only the languages you corrected (merge into an existing entry), every placeholder kept. When the same wrong word shows up in many strings, also set that language's word in `src/lib/translate/glossary.ts`. A guide text (`tour.*`) that names a button can use `{{ui:<key>}}` instead of its words; that changes the English, so update the hand-written languages the same way and give every machine language an entry.
5. **Check.** `npm run lint && npm run typecheck && npm run test` (`ui-reviewed.test.ts` fails on stale English, a hand-written language or a lost placeholder).
6. **Record.** `npm run ui:review -- --mark-reviewed` with the same `--prefix` (writes `state.json`, so the next run only shows what changed).
7. **PR.** Commit as `i18n: review <areas>`, push, open a PR listing the fixes per language and any glossary change, with the attribution lines.
8. **Tell the owner:** merge, wait until the Vercel deployment of `main` is Ready (`npx vercel ls`), then Actions → Maintenance → `sync-ui`.

## B. Content (battle plan, leader, checklist and feedback pages, public content)

Content isn't in the repository; it is reviewed straight from the database and fixed by the owner's command. The active battle plan is worth a look whenever the council has filled it in or changed it.

1. **Export.** `npm run content:review -- --out <dir>` (read-only, service key, ids and translatable columns only). It writes `content-review.json`: `items` (texts changed since the last review, or with an error), each with `table`, `id`, `column`, `html`, `en` and per language `text`, `findings` and `manual` (corrected by hand: leave alone). `--table kvk_plans,kvk_rules,…` narrows it; `--all` adds hints on texts reviewed before. Every site language is machine-translated here, de/ko/pl/ar included.
2. **Review** the battle-plan tables first (`kvk_*`), then the rest. Seed placeholder content (events, rules, guides still marked as placeholders) isn't worth fixing until the council writes it.
3. **Write the fixes** to `<dir>/fixes.json`, never inside the repository: `{ "fixes": [{ "table", "id", "column", "lang", "en", "from", "to" }] }`, with `en` and `from` copied exactly from the export (the current English and translation) and `to` the corrected text. HTML columns keep exactly the English's tags; placeholders such as `{{when}}` stay.
4. **Dry run.** `npm run content:fixes -- --file <dir>/fixes.json` checks every fix against the database and prints what it would change; nothing is written.
5. **Report to the owner** per table and language what you would fix and why (without quoting battle-plan text), and give the command to apply: `npm run content:fixes -- --file <dir>/fixes.json --apply`. The owner runs it, or approves it. It writes a fix only while the English and the translation are still the reviewed ones, leaves moderators' corrections alone, keeps `source_hash` (so the pipeline keeps the fix) and writes an audit entry `translation.review` for each fix; the webhook refreshes the page.
6. **Record.** After the owner has applied the fixes, `npm run content:review -- --mark-reviewed` (same `--table` if you narrowed it). The state file holds only hashes and is git-ignored.
