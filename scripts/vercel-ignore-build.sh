#!/usr/bin/env bash
# Vercel's "Ignored Build Step" (vercel.json `ignoreCommand`): Vercel runs this
# in its fresh clone of the commit before every build. Exit 0 skips the build
# (the deployment ends as "Canceled by Ignored Build Step", a green status on
# GitHub, after a few seconds), exit 1 builds. When in doubt it builds.
#
# 1. The switch: PAUSE_DEPLOYS=1 among the project's environment variables
#    skips every build of the environment it is set for (Production, Preview or
#    both) until it is removed (SETUP.md § 5, "Skipped builds").
# 2. Otherwise only a change to what the site is made of builds: the files that
#    changed since this branch's last successful deployment are compared with
#    NOT_SITE below. A pull request's first preview compares with the commit it
#    was branched from instead. A redeploy of an unchanged commit always builds.
#
# Plain git and bash only: it runs before `npm install`. Unit-tested by
# tests/scripts/vercel-ignore-build.test.ts. Never reads or prints a secret.
set -u

# Paths the website's build never reads (checked against src/ and next.config.ts
# in Oct 2026): the code guide, notes, tests, CI, the database's SQL, the CLI
# scripts and the tools' own configs. Anything not listed builds, so a new
# top-level file is deployed until it is added here.
NOT_SITE='^(guide/|docs/|e2e/|tests/|scripts/|supabase/|\.github/|\.claude/|[^/]+\.md$|LICENSE$|\.nvmrc$|\.gitignore$|\.env\.example$|playwright\.config\.ts$|vitest\.config\.mts$|eslint\.config\.mjs$)'

say() { echo "ignore-build: $*"; }
build() { say "$* → building"; exit 1; }
skip() { say "$* → skipped"; exit 0; }

env_name="${VERCEL_ENV:-unknown}"

case "$(printf '%s' "${PAUSE_DEPLOYS:-}" | tr '[:upper:]' '[:lower:]')" in
  1 | true | yes | on) skip "PAUSE_DEPLOYS is on for $env_name" ;;
esac

base="${VERCEL_GIT_PREVIOUS_SHA:-}"
if [ -n "$base" ]; then
  # Vercel clones only the last ten commits; a base further back can't be compared.
  git cat-file -e "$base^{commit}" 2>/dev/null || build "the last deployed commit ${base:0:7} is older than the clone"
  what="since the last deployment (${base:0:7})"
elif [ "$env_name" = "preview" ]; then
  # A branch's first preview: compare with the newest merge into main it contains.
  base="$(git log -1 --format=%H --grep='^Merge pull request #' HEAD^ 2>/dev/null)"
  [ -n "$base" ] || build "first preview of this branch and no merge into main within the clone"
  what="since the branch left main (${base:0:7})"
else
  build "no earlier deployment of this branch"
fi

# --no-renames lists both sides of a move, so moving a file out of src/ counts.
changed="$(git -c core.quotePath=false diff --no-renames --name-only "$base" HEAD)" || build "git could not compare with ${base:0:7}"
[ -n "$changed" ] || build "nothing changed $what (a redeploy)"

site="$(printf '%s\n' "$changed" | grep -Ev "$NOT_SITE")"
if [ -n "$site" ]; then
  say "site files changed $what:"
  printf '%s\n' "$site" | head -n 10 | sed 's/^/  /'
  build "$(printf '%s\n' "$site" | wc -l | tr -d ' ') site file(s)"
fi
skip "only guide, docs, tests, CI or database files changed $what"
