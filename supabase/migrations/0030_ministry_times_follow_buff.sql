-- 0030 — Ministry sign-ups: a player's times follow their buff when the council moves the buff days.
--
--   The council may swap the construction and the research day, put both on
--   one day or split them again after players signed up. A sign-up's `slots`
--   are kept per buff DAY, so until now such a change left players on the
--   wrong day's list, or on none.
--
--   ministry_signups.times          the half-hours the player picked per BUFF
--                                   (`{ "construction": [0…47], "research": […], "training": […] }`).
--                                   `slots` stays what the page, the ranking and
--                                   the assignment read: the times per day with
--                                   the buff days as they are now. Null on a row
--                                   from before this migration, which is read
--                                   from its `slots` (src/lib/ministry/times.ts).
--   ministry_signups.days_moved_at  when a change of the buff days last moved
--                                   this entry's times to other days; cleared
--                                   when the entry's times are saved again. The
--                                   player's card asks them to check their times.
--   ministry_move_days()            the Prep days save for a round with
--                                   sign-ups, all or nothing: every entry's
--                                   `slots` and `times` as the site worked them
--                                   out, the rosters of the days that changed
--                                   hands dropped (they are made anew at their
--                                   deadline, or at once when it has passed),
--                                   and the new buff days stored. It refuses
--                                   ("ministry_move_changed") when a sign-up was
--                                   added, changed or removed since the site
--                                   read them, so nothing is overwritten.
--
--   Takes the lock ministry_assign() takes on each of those days. Additive and
--   idempotent: the previous deploy reads and writes `slots` as before and
--   ignores the new columns and the function.

alter table public.ministry_signups
  add column if not exists times jsonb check (times is null or (jsonb_typeof(times) = 'object' and pg_column_size(times) <= 2000));
alter table public.ministry_signups
  add column if not exists days_moved_at timestamptz;

create or replace function public.ministry_move_days(p_round date, p_rows jsonb, p_days integer[], p_schedule jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day integer;
  v_total integer;
  v_written integer;
begin
  -- No sign-up is added or changed while the round's entries are rewritten.
  lock table public.ministry_signups in share row exclusive mode;
  for v_day in select d from unnest(p_days) as d order by d loop
    perform pg_advisory_xact_lock(hashtext('ministry_assign:' || p_round::text || ':' || v_day::text));
  end loop;

  select count(*) into v_total from public.ministry_signups where round = p_round;
  update public.ministry_signups s
    set slots = r.slots,
        times = r.times,
        days_moved_at = case when r.moved then now() else s.days_moved_at end
    from jsonb_to_recordset(p_rows) as r(id uuid, slots jsonb, times jsonb, moved boolean, updated_at timestamptz)
    where s.id = r.id and s.round = p_round and s.updated_at = r.updated_at;
  get diagnostics v_written = row_count;
  -- Every sign-up of the round, exactly as the site read it: otherwise nothing is written.
  if v_written <> v_total or v_written <> jsonb_array_length(p_rows) then
    raise exception 'ministry_move_changed';
  end if;

  delete from public.ministry_appointments where round = p_round and day = any (p_days);
  delete from public.ministry_rosters where round = p_round and day = any (p_days);

  insert into public.app_config (key, value) values ('prep_schedule', p_schedule)
    on conflict (key) do update set value = excluded.value;
  return 'ok';
end;
$$;

revoke all on function public.ministry_move_days(date, jsonb, integer[], jsonb) from public, anon, authenticated;
grant execute on function public.ministry_move_days(date, jsonb, integer[], jsonb) to service_role;
