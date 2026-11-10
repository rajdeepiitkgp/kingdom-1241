-- 0028_ministry_roster_publish.sql
--
-- Ministry appointments: a draft for moderators, a published copy for players.
--
--   ministry_rosters.published      the day's appointments as players see them
--                                   ([{"signup_id", "slot", "source"}, …]),
--                                   written by the run at the deadline and by
--                                   a moderator's Publish. null = the day was
--                                   never published.
--   ministry_rosters.published_at   when.
--
--   The working appointments stay in ministry_appointments; what moderators
--   change there after a publish is a draft until they publish again.
--
--   Days that are assigned already get what players see today as their
--   published copy, once (only when the column is added), so nothing changes
--   for them. Additive and idempotent; the previous deploy ignores both columns.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'ministry_rosters' and column_name = 'published'
  ) then
    alter table public.ministry_rosters add column published jsonb;
    update public.ministry_rosters r
      set published = coalesce(
        (select jsonb_agg(jsonb_build_object('signup_id', a.signup_id, 'slot', a.slot, 'source', a.source) order by a.slot)
           from public.ministry_appointments a
          where a.round = r.round and a.day = r.day),
        '[]'::jsonb);
  end if;
end;
$$;

alter table public.ministry_rosters add column if not exists published_at timestamptz;
update public.ministry_rosters set published_at = assigned_at where published is not null and published_at is null;
