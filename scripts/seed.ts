/**
 * Seed the Supabase database with the boilerplate content from src/content/seed.
 *
 *   npm run db:seed               # insert anything that is missing (safe to re-run)
 *   npm run db:seed -- --sync-ui    # also update the interface strings (ui_strings) from the code
 *   npm run db:seed -- --overwrite  # also replace existing seed rows (drops their translations!)
 *
 * The texts of the content editor (announcements, events, rule topics and
 * rules, guides) belong to the moderators once the site runs: they are seeded only
 * into an empty table, never by --sync-ui, so a placeholder a moderator
 * deleted doesn't come back; --overwrite still replaces them.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local.
 * The KvK battle plan is seeded with the password from KVK_SEED_PASSWORD
 * (default "1241") — change it in the kvk_plans table afterwards.
 * After seeding, run `npm run translate` to fill in the other languages.
 */
import { loadEnv, parseArgs } from "./env";

loadEnv();

const args = parseArgs(process.argv.slice(2));
const overwrite = args.overwrite === true;
// UI strings are maintained in code (src/content/seed/ui-strings.ts, with hand
// translations), so they may be re-synced without touching any content row.
const syncUi = overwrite || args["sync-ui"] === true;

async function main() {
  const [
    { buildSeedContent, SEED_LANGUAGES },
    { settingsToRows },
    { createAdminClient },
    { sourceHash },
    { kvkChecklistBriefId, kvkLeaderBriefId },
  ] = await Promise.all([
    import("@/content/seed"),
    import("@/lib/data/mappers"),
    import("@/lib/supabase/admin"),
    import("@/lib/translate/hash"),
    import("@/content/seed/kvk"),
  ]);

  const supabase = createAdminClient();
  const seed = buildSeedContent();
  const summary: string[] = [];

  /** Seed an editor-managed table only into a new database (see the top of this file). */
  async function seedEditorTables(tables: string[], write: () => Promise<void>) {
    const leave = () => void summary.push(`${tables.join(" + ")}: left to the moderators (seeded into an empty table only)`);
    if (!overwrite) {
      if (syncUi) return leave();
      for (const table of tables) {
        const { count, error } = await supabase.from(table).select("*", { count: "exact", head: true });
        if (error) throw new Error(`${table}: ${error.message}`);
        if ((count ?? 0) > 0) return leave();
      }
    }
    await write();
  }

  async function upsertMissing(
    table: string,
    key: string,
    rows: Array<Record<string, unknown>>,
    replace = overwrite,
  ) {
    if (rows.length === 0) return;
    const { data: existing, error } = await supabase.from(table).select(key);
    if (error) throw new Error(`${table}: ${error.message}`);
    const present = new Set(
      ((existing ?? []) as unknown as Array<Record<string, unknown>>).map((r) =>
        String(r[key]),
      ),
    );
    const toWrite = replace
      ? rows
      : rows.filter((r) => !present.has(String(r[key])));
    if (toWrite.length === 0) {
      summary.push(`${table}: nothing to do (${present.size} rows present)`);
      return;
    }
    const { error: upsertError } = await supabase
      .from(table)
      .upsert(toWrite, { onConflict: key });
    if (upsertError) throw new Error(`${table}: ${upsertError.message}`);
    summary.push(
      `${table}: ${replace ? "wrote" : "inserted"} ${toWrite.length} row(s)`,
    );
  }

  await upsertMissing(
    "languages",
    "code",
    SEED_LANGUAGES.map((l) => ({
      code: l.code,
      enabled: l.enabled,
      sort_order: l.sortOrder,
    })),
  );

  await upsertMissing(
    "site_settings",
    "key",
    settingsToRows(seed.settings).map((row) => ({
      key: row.key,
      value: row.value,
    })),
  );

  // UI strings ship with hand-made translations: mark them up to date so the
  // translator doesn't redo them (use `npm run translate -- --table ui_strings --force` to regenerate).
  // With --sync-ui, languages the pipeline added (not in the code) are kept as
  // long as the English text is unchanged; a changed English text replaces the
  // row, and the pipeline then re-translates every language.
  let uiRows = seed.uiStrings.map((s) => ({
    key: s.key,
    text: s.text as Record<string, string>,
    source_hash: sourceHash({ text: s.text.en ?? "" }),
  }));
  if (syncUi) {
    const { data: existingUi, error: uiError } = await supabase.from("ui_strings").select("key, text");
    if (uiError) throw new Error(`ui_strings: ${uiError.message}`);
    const byKey = new Map((existingUi ?? []).map((r) => [String(r.key), (r.text ?? {}) as Record<string, string>]));
    uiRows = uiRows.map((row) => {
      const existing = byKey.get(row.key);
      return existing && existing.en === row.text.en ? { ...row, text: { ...existing, ...row.text } } : row;
    });
  }
  await upsertMissing("ui_strings", "key", uiRows, syncUi);

  await seedEditorTables(["announcements"], () =>
    upsertMissing(
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
        // A replaced text drops the Markdown an editor saved, so the editor opens the seed's HTML again.
        ...(overwrite ? { body_source: {} } : {}),
      })),
    ),
  );

  await seedEditorTables(["events"], () =>
    upsertMissing(
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
        also_after_days: e.alsoAfterDays,
        timing: e.timing,
        guide_slug: e.guideSlug,
        published: e.published,
      })),
    ),
  );

  // Topics and their rules are one unit: rules are seeded only with their topics.
  await seedEditorTables(["rule_topics", "rules"], async () => {
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
          ...(overwrite ? { body_source: {} } : {}),
        })),
      ),
    );
  });

  await seedEditorTables(["guides"], () =>
    upsertMissing(
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
        ...(overwrite ? { body_source: {} } : {}),
      })),
    ),
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

  await upsertMissing(
    "heroes",
    "id",
    seed.heroes.map((h) => ({
      id: h.id,
      slug: h.slug,
      name: h.name,
      troop_type: h.troopType,
      rarity: h.rarity,
      generation: h.generation,
      icon_url: h.iconUrl,
      sort_order: h.sortOrder,
      published: h.published,
    })),
  );

  // KvK battle plan. Only one plan may be active; if the council already has
  // one, the placeholder goes in as inactive so it never replaces the real plan.
  // The plan and its rules/coordinators/formations are seeded as ONE unit: once
  // the plan row exists, its child rows are never re-added (the council deletes
  // and replaces them freely).
  const plan = seed.kvkPlan;
  const { data: planRows, error: planError } = await supabase
    .from("kvk_plans")
    .select("id, active");
  if (planError) throw new Error(`kvk_plans: ${planError.message}`);
  const planExists = (planRows ?? []).some((row) => row.id === plan.id);
  const otherActive = (planRows ?? []).some(
    (row) => row.id !== plan.id && row.active,
  );

  if (planExists && !overwrite) {
    summary.push(
      "kvk_plans: placeholder plan already present — leaving the plan and its rows alone",
    );
  } else {
    await upsertMissing("kvk_plans", "id", [
      {
        id: plan.id,
        slug: plan.slug,
        event_type: plan.eventType,
        title: plan.title,
        opponent: plan.opponent,
        battle_at: plan.battleAt,
        intro: plan.intro,
        min_hero_stars: plan.minHeroStars,
        min_skill_level: plan.minSkillLevel,
        password: plan.password,
        active: otherActive ? false : plan.active,
        published: plan.published,
      },
    ]);

    await upsertMissing(
      "kvk_rules",
      "id",
      plan.rules.map((r) => ({
        id: r.id,
        plan_id: r.planId,
        kind: r.kind,
        text: r.text,
        sort_order: r.sortOrder,
        published: r.published,
      })),
    );

    await upsertMissing(
      "kvk_coordinators",
      "id",
      plan.coordinators.map((c) => ({
        id: c.id,
        plan_id: c.planId,
        team: c.team,
        name: c.name,
        alliance_tag: c.allianceTag,
        note: c.note,
        sort_order: c.sortOrder,
        published: c.published,
      })),
    );

    await upsertMissing(
      "kvk_formations",
      "id",
      plan.formations.map((f) => ({
        id: f.id,
        plan_id: f.planId,
        label: f.label,
        side: f.side,
        role: f.role,
        hero_1: f.heroSlugs[0],
        hero_2: f.heroSlugs[1],
        hero_3: f.heroSlugs[2],
        infantry_pct: f.infantry,
        cavalry_pct: f.cavalry,
        archers_pct: f.archers,
        note: f.note,
        sort_order: f.sortOrder,
        published: f.published,
      })),
    );

    // The rally-leader page of the placeholder plan, with its own password.
    const leaders = seed.kvkLeaderPlan;
    await upsertMissing("kvk_leader_briefs", "id", [
      {
        id: kvkLeaderBriefId,
        plan_id: leaders.planId,
        password: leaders.password,
        intro: leaders.intro,
        published: true,
      },
    ]);

    await upsertMissing(
      "kvk_leader_rules",
      "id",
      leaders.rules.map((r) => ({
        id: r.id,
        plan_id: r.planId,
        audience: r.audience,
        kind: r.kind,
        text: r.text,
        sort_order: r.sortOrder,
        published: r.published,
      })),
    );

    await upsertMissing(
      "kvk_rally_leaders",
      "id",
      leaders.rallies.map((r) => ({
        id: r.id,
        plan_id: r.planId,
        target: r.target,
        side: r.side,
        team: r.team,
        name: r.name,
        alliance_tag: r.allianceTag,
        position: r.position,
        start_at: r.startAt,
        pets_offset_minutes: r.petsOffsetMinutes,
        hero_1: r.heroSlugs[0],
        hero_2: r.heroSlugs[1],
        hero_3: r.heroSlugs[2],
        infantry_pct: r.infantry,
        cavalry_pct: r.cavalry,
        archers_pct: r.archers,
        note: r.note,
        sort_order: r.sortOrder,
        published: r.published,
      })),
    );

    // The commander checklist of the placeholder plan, with its own password.
    const checklist = seed.kvkChecklistPlan;
    await upsertMissing("kvk_checklist_briefs", "id", [
      {
        id: kvkChecklistBriefId,
        plan_id: checklist.planId,
        password: checklist.password,
        intro: checklist.intro,
        published: true,
      },
    ]);

    await upsertMissing(
      "kvk_checklist_items",
      "id",
      checklist.items.map((i) => ({
        id: i.id,
        plan_id: i.planId,
        phase: i.phase,
        text: i.text,
        note: i.note,
        sort_order: i.sortOrder,
        published: i.published,
      })),
    );

    await upsertMissing(
      "kvk_checklist_rules",
      "id",
      checklist.rules.map((r) => ({
        id: r.id,
        plan_id: r.planId,
        section: r.section,
        kind: r.kind,
        text: r.text,
        sort_order: r.sortOrder,
        published: r.published,
      })),
    );
  }

  console.log(summary.join("\n"));
  console.log(
    "\nDone. Next: `npm run translate` to fill in the other languages, then refresh the site cache (see SETUP.md).",
  );
  console.log(
    'KvK: the placeholder battle plan uses the password from KVK_SEED_PASSWORD (default "1241") — change it in the kvk_plans table.',
  );
  console.log(
    'KvK: its rally-leader page uses KVK_SEED_LEADER_PASSWORD (default "1241-leaders") — change it under Admin → Battle plans → Rally leaders.',
  );
  console.log(
    'KvK: its commander checklist uses KVK_SEED_CHECKLIST_PASSWORD (default "1241-commander") — change it under Admin → Battle plans → Commander checklist.',
  );
}

main().catch((error) => {
  console.error(
    "Seeding failed:",
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
});
