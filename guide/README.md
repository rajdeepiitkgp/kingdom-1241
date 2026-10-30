# The code guide

A study guide to the Kingdom 1241 website, written for someone who can write "hello world": what every part does, why it was built that way, and how to explain it in a job interview. It is a [Starlight](https://starlight.astro.build) site (Astro), kept in this folder with its own `package.json` so the website's dependencies stay untouched, and published to GitHub Pages by `.github/workflows/guide.yml` whenever `guide/` changes on `main`.

## Run it

```sh
cd guide
npm install
npm run dev        # http://localhost:4321/kingdom-1241/, reloads on save
npm run build      # what CI runs: fails on a broken link between chapters
npm run preview    # serves the built site
```

## Where things are

| Path | What |
| --- | --- |
| `src/content/docs/` | The chapters: one folder per part (`start-here/`, `big-picture/`, …), one `.mdx` file per chapter. `index.mdx` is the home page with the map of parts. |
| `astro.config.mjs` | Title, sidebar (one group per part), diagrams, link check, fonts. A new part gets a sidebar group here and a row on the home page's map. |
| `src/components/` | `OneMinute`, `TryIt`, `QA` and `CodeLink`, used by every chapter; `Footer` adds the copyright line. |
| `src/styles/guide.css` | Colours (the site's gold), the three typefaces, the chapter boxes, diagram sizing. |

## A chapter

Every chapter has the same shape, in this order:

1. Front matter: `title`, a one-line `description`, `sidebar.order`.
2. `<OneMinute>`: the chapter in one paragraph.
3. At least one Mermaid diagram (a ```` ```mermaid ```` block). Keep it at most 600 px wide on desktop: prefer `flowchart TB`, short labels, and stack unconnected boxes with `~~~`. Diagrams keep their natural size, so a wide one scrolls sideways on a phone rather than shrinking.
4. The explanation: short sections, plain words, one idea per paragraph. Starlight's asides (`<Aside>`), cards, tabs, steps and tables for variety.
5. **Where to look in the code**: `<CodeLink path="src/…" />`, path from the repository root, a trailing `/` for a folder.
6. `<TryIt>`: something safe to do locally. Never a script from `scripts/` (they use the production keys in `.env.local`) and never anything that writes to the live site.
7. **Interview questions**: two to four `<QA q="…">` with a good answer each.
8. **Read more** (when a topic is too big for the chapter): `<LinkCard>`s to good references, naming the section to read.

## Rules

- **Every fact is checked against the code** before it goes in: names, numbers, times, who may do what. Write what the code does, not what it probably does.
- **Updated with the code.** A pull request that changes something a chapter explains updates that chapter. `tests/architecture/guide-code-links.test.ts` (in the website's own test run) fails when a `CodeLink` points at a file that no longer exists.
- **Links between chapters start with the base path**: `/kingdom-1241/big-picture/the-pieces/`. The link check refuses relative links and fails the build on a broken one.
- **Nothing secret**: no keys, passwords, battle-plan content, player data or production addresses beyond what the repository already shows.
- **The kingdom's website never links to the guide.** The guide may link to the repository and describe the site.
- The guide is not indexed by search engines (`robots` meta tag) and, like the code, is not open source.
