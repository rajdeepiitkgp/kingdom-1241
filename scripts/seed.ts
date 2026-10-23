/**
 * Seed the Supabase database with the boilerplate content from src/content/seed.
 *
 *   npm run db:seed               # insert anything that is missing (safe to re-run)
 *   npm run db:seed -- --overwrite  # also replace existing seed rows (drops their translations!)
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
 * After seeding, run `npm run translate` to fill in the other languages.
 */
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const overwrite = args.overwrite === true;

async function main() {
  const [{ buildSeedContent, SEED_LANGUAGES }, { settingsToRows }, { createAdminClient }, { sourceHash }] =
    await Promise.all([
      import("@/content/seed"),
      import("@/lib/data/mappers"),
      import("@/lib/supabase/admin"),
      import("@/lib/translate/hash"),
    ]);

  const supabase = createAdminClient();
  const seed = buildSeedContent();
  const summary: string[] = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function upsertMissing(table: string, key: string, rows: Array<Record<string, any>>) {
    if (rows.length === 0) return;
    const { data: existing, error } = await supabase.from(table).select(key);
    if (error) throw new Error(`${table}: ${error.message}`);
    const present = new Set(((existing ?? []) as unknown as Array<Record<string, unknown>>).map((r) => String(r[key])));
    const toWrite = overwrite ? rows : rows.filter((r) => !present.has(String(r[key])));
    if (toWrite.length === 0) {
      summary.push(`${table}: nothing to do (${present.size} rows present)`);
      return;
    }
    const { error: upsertError } = await supabase.from(table).upsert(toWrite, { onConflict: key });
    if (upsertError) throw new Error(`${table}: ${upsertError.message}`);
    summary.push(`${table}: ${overwrite ? "wrote" : "inserted"} ${toWrite.length} row(s)`);
  }

  await upsertMissing(
    "languages",
    "code",
    SEED_LANGUAGES.map((l) => ({ code: l.code, enabled: l.enabled, sort_order: l.sortOrder })),
  );

  await upsertMissing(
    "site_settings",
    "key",
    settingsToRows(seed.settings).map((row) => ({ key: row.key, value: row.value })),
  );

  // UI strings ship with hand-made translations: mark them up to date so the
  // translator doesn't redo them (use `npm run translate -- --table ui_strings --force` to regenerate).
  await upsertMissing(
    "ui_strings",
    "key",
    seed.uiStrings.map((s) => ({ key: s.key, text: s.text, source_hash: sourceHash({ text: s.text.en ?? "" }) })),
  );

  await upsertMissing(
    "announcements",
    "id",
    seed.announcements.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      pinned: a.pinned,
      published: a.published,
      published_at: a.publishedAt,
      expires_at: a.expiresAt,
    })),
  );

  await upsertMissing(
    "events",
    "id",
    seed.events.map((e) => ({
      id: e.id,
      slug: e.slug,
      name: e.name,
      summary: e.summary,
      category: e.category,
      icon: e.icon,
      color: e.color,
      starts_at: e.startsAt,
      duration_minutes: e.durationMinutes,
      repeat_every_days: e.repeatEveryDays,
      guide_slug: e.guideSlug,
      published: e.published,
    })),
  );

  await upsertMissing(
    "rule_topics",
    "id",
    seed.ruleTopics.map((t) => ({
      id: t.id,
      slug: t.slug,
      title: t.title,
      icon: t.icon,
      sort_order: t.sortOrder,
      published: t.published,
    })),
  );

  await upsertMissing(
    "rules",
    "id",
    seed.ruleTopics.flatMap((t) =>
      t.rules.map((r) => ({
        id: r.id,
        topic_id: r.topicId,
        title: r.title,
        body: r.body,
        sort_order: r.sortOrder,
        published: r.published,
      })),
    ),
  );

  await upsertMissing(
    "guides",
    "id",
    seed.guides.map((g) => ({
      id: g.id,
      slug: g.slug,
      title: g.title,
      summary: g.summary,
      body: g.body,
      icon: g.icon,
      cover_image_url: g.coverImageUrl,
      sort_order: g.sortOrder,
      published: g.published,
    })),
  );

  await upsertMissing(
    "alliances",
    "id",
    seed.alliances.map((a) => ({
      id: a.id,
      tag: a.tag,
      name: a.name,
      color: a.color,
      leader: a.leader,
      power: a.power,
      members: a.members,
      max_members: a.maxMembers,
      description: a.description,
      requirements: a.requirements,
      languages: a.languages,
      discord_url: a.discordUrl,
      sort_order: a.sortOrder,
      published: a.published,
    })),
  );

  await upsertMissing(
    "gift_codes",
    "id",
    seed.giftCodes.map((c) => ({
      id: c.id,
      code: c.code,
      rewards: c.rewards,
      expires_at: c.expiresAt,
      active: c.active,
      added_at: c.addedAt,
    })),
  );

  console.log(summary.join("\n"));
  console.log("\nDone. Next: `npm run translate` to fill in the other languages, then refresh the site cache (see SETUP.md).");
}

main().catch((error) => {
  console.error("Seeding failed:", error instanceof Error ? error.message : error);
  process.exit(1);
});
