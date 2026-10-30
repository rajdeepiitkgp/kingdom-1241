// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import mermaid from "astro-mermaid";
import starlightLinksValidator from "starlight-links-validator";

/**
 * The code guide of the Kingdom 1241 website: a Starlight site published to
 * GitHub Pages by .github/workflows/guide.yml. Chapters live in
 * src/content/docs (one folder per part); README.md describes the chapter
 * template. Links inside the guide start with the base path (/kingdom-1241/),
 * because the link check refuses relative links.
 */
const REPO = "https://github.com/rajdeepiitkgp/kingdom-1241";

export default defineConfig({
  site: "https://rajdeepiitkgp.github.io",
  base: "/kingdom-1241",
  trailingSlash: "always",
  integrations: [
    // Must come before Starlight (astro-mermaid's README): it turns ```mermaid blocks into diagrams.
    mermaid({
      theme: "default",
      autoTheme: true,
      enableLog: false,
      // Natural size: a diagram never shrinks its text to fit a phone; its box scrolls sideways instead.
      mermaidConfig: {
        flowchart: { useMaxWidth: false, wrappingWidth: 300 },
        sequence: { useMaxWidth: false, actorMargin: 24, width: 110, diagramMarginX: 8, mirrorActors: false },
      },
    }),
    starlight({
      title: "Kingdom 1241 guide",
      description: "How the Kingdom 1241 website is built, explained from the ground up.",
      logo: { src: "./src/assets/book.svg", alt: "" },
      favicon: "/favicon.svg",
      social: [{ icon: "github", label: "The code on GitHub", href: REPO }],
      editLink: { baseUrl: `${REPO}/edit/main/guide/` },
      // A study guide, not a page for search engines (the kingdom's own site is hidden from them too).
      head: [{ tag: "meta", attrs: { name: "robots", content: "noindex, nofollow" } }],
      customCss: [
        "@fontsource-variable/nunito",
        "@fontsource-variable/fraunces",
        "@fontsource-variable/jetbrains-mono",
        "./src/styles/guide.css",
      ],
      components: { Footer: "./src/components/Footer.astro" },
      // Fails the build on a broken link between chapters (links to the code are checked by
      // tests/architecture/guide-code-links.test.ts in the site's own test run).
      plugins: [starlightLinksValidator()],
      sidebar: [
        { label: "1 · Start here", items: [{ autogenerate: { directory: "start-here" } }] },
        { label: "2 · The big picture", items: [{ autogenerate: { directory: "big-picture" } }] },
      ],
    }),
  ],
});
