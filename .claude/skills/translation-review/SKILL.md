---
name: translation-review
description: Review the site's machine-translated interface strings (every language that isn't English or hand-written, e.g. fr, it, tr, ja, zh-TW) against the labels the page really shows, the glossary and their meaning, and fix them in src/content/seed/ui-reviewed.ts through a PR. Use when the owner asks to check, align or fix translations, or runs /translation-review (about once a month, or after many new texts).
---

# Translation review

The pipeline translates every interface string on its own, with a small model, so what goes wrong is consistency, not grammar: a guide that names a button differently from the button, a game term that changes from one text to the next ("rassemblement" here, "ralliement" there), a role mixed up (coordinator vs commander), Japanese slipping into casual endings. This skill reviews the live strings with the session's model (the owner's Claude subscription, not the API key) and writes the fixes into the repository. The owner's `sync-ui` click puts them on the site after the merge.

## Rules

- Read-only towards production. The only script you run is `npm run ui:review` (public key, read-only). Never run `translate`, `db:seed`, `prune`, `backup` or any other script, never write to the database, never call the Anthropic or Gemini API, never print a key or the contents of `.env.local`.
- Only the machine-translated languages the tool lists. Don't change English. The hand-written languages (de, ko, pl, ar) live in `src/content/seed/ui-strings.ts`: if one of those is wrong, tell the owner instead of changing it here.
- Interface strings only. Battle plans, rules and other content are fixed per language by moderators in the admin.
- Leave a correct text alone even if you'd phrase it differently. A finding is a hint, not a verdict: a capitalised phrase at the start of a sentence can look like a label without naming one.

## Steps

1. **Branch.** `git switch main && git pull --ff-only && git switch -c i18n/review-<YYYY-MM-DD>`. Stop if the working tree isn't clean.
2. **Export.** `npm run ui:review -- --out <dir>` with `<dir>` in a temporary folder (the session's scratchpad if it has one). It prints the languages and the findings per kind and writes `review.json`: `items` (strings that changed since the last review or have a finding), `glossary` (the word to use per term and language) and `locales`. The first full review covers about 800 strings: do it area by area with `--prefix` (comma list), for example `tour.`, then `sync.`, then `kvk.,leaders.,checklist.`, then `prep.`, `retro.`, then the rest. A later run only shows what changed.
3. **Review** `review.json` in slices (a few dozen items at a time, e.g. a short `python3 -c` filter by prefix and language). For every item and language, compare the text with `en`:
   - the meaning, including who does what (a coordinator runs a team or a room; the commander is the one battle commander; a rally leader starts a rally);
   - a button or heading named in the text uses the words the page shows (the `label:` finding quotes them);
   - game terms follow the glossary for that language;
   - placeholders (`{n}`, `{{date}}`, `{{ui:…}}`) are unchanged;
   - Japanese uses です/ます, Chinese is Traditional (Taiwan);
   - the same thing is called the same way as in the rest of the UI.
   `changed: true` means nobody has reviewed this version yet, so read it even without findings. `live:` and `reviewed:` findings aren't errors: they mean `sync-ui` hasn't run since the code changed.
4. **Fix** in `src/content/seed/ui-reviewed.ts`: one entry per key, sorted by key, with `en` copied exactly from `ui-strings.ts` and only the languages you corrected (merge into an existing entry). Keep every placeholder. When the same wrong word shows up in many strings, also set that language's word in `src/lib/translate/glossary.ts`, so new machine translations follow it.
   A guide text (`tour.*`) that names a button in a sentence can use `{{ui:<key>}}` instead of the words (the page fills in its label in every language). That changes the English, so update the hand-written languages in `ui-strings.ts` the same way and give every machine language an entry in `ui-reviewed.ts`.
5. **Check.** `npm run lint && npm run typecheck && npm run test`. `tests/content/seed/ui-reviewed.test.ts` fails when an entry's English is out of date, covers a hand-written language or loses a placeholder.
6. **Record** what you reviewed: `npm run ui:review -- --mark-reviewed` with the same `--prefix` as the export (none for everything). It writes `.claude/skills/translation-review/state.json`, so the next run only shows strings that changed after today.
7. **PR.** Commit as `i18n: review <areas>`, push and open a PR that lists the fixes per language and any glossary change, with the attribution lines.
8. **Tell the owner:** merge, wait until the Vercel deployment of `main` is Ready (`npx vercel ls`), then Actions → Maintenance → `sync-ui`. The fixes are then live and marked up to date, so the pipeline leaves them alone; a later change to the English drops a fix by itself and the test asks for a new review.
