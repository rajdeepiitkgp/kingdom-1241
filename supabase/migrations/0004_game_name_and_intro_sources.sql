-- Kingdom 1241 — in-game names on profiles; per-language Markdown sources for the plan intro
--
--   * profiles.game_name: the name a person uses in Kingshot, set by the person
--     themselves in the admin area. Shown in the user list (next to the Discord
--     handle, which stays the identity that roles are granted on) and used as the
--     actor name in audit_log.
--   * kvk_plans.intro_source becomes JSONB {"en": markdown, "de": markdown, ...}
--     so a translation can be corrected by hand in its own language; the English
--     source is kept.

alter table public.profiles add column if not exists game_name text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'kvk_plans'
      and column_name = 'intro_source' and data_type = 'text'
  ) then
    alter table public.kvk_plans
      alter column intro_source type jsonb
      using case when intro_source is null then null else jsonb_build_object('en', intro_source) end;
  end if;
end $$;
