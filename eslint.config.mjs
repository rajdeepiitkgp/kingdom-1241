import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  // Tailwind class hygiene (the same checks the IntelliSense extension shows):
  // canonical classes (max-h-[28rem] → max-h-112), shorthands, logical
  // properties for RTL, unknown/conflicting classes, class order.
  // `npm run lint` runs with --max-warnings 0, so warnings fail CI too.
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "better-tailwindcss": betterTailwindcss },
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/app/globals.css",
      },
    },
    rules: {
      ...betterTailwindcss.configs.recommended.rules,
      // Our component classes (card, btn-*, chip, input, label, …) are defined in
      // @layer components of the entry CSS; let the rule read them from there.
      "better-tailwindcss/no-unknown-classes": ["error", { detectComponentClasses: true }],
      "better-tailwindcss/enforce-shorthand-classes": "warn",
      "better-tailwindcss/enforce-consistent-variable-syntax": "warn",
      // Too broad: it also rewrites heights, widths and borders (h-16 → block-16)
      // which gains nothing for RTL. CLAUDE.md mandates logical classes on the
      // inline axis (ms-/me-/ps-/pe-/start-/end-/text-start) instead.
      "better-tailwindcss/enforce-logical-properties": "off",
      // Long class strings stay on one line; wrapping them is noise in diffs.
      "better-tailwindcss/enforce-consistent-line-wrapping": "off",
    },
  },

  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
