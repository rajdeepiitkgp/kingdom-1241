import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** Load .env.local then .env (same precedence as Next.js) for CLI scripts. */
export function loadEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (existsSync(path)) config({ path, quiet: true });
  }
}

/** Tiny argv parser: `--flag`, `--key value`, `--key=value`. */
export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    if (inlineValue !== undefined) {
      out[rawKey] = inlineValue;
    } else if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
      out[rawKey] = argv[++i];
    } else {
      out[rawKey] = true;
    }
  }
  return out;
}
