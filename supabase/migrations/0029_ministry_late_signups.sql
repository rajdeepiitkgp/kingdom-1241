-- 0029_ministry_late_signups.sql
--
-- Ministry appointments: late sign-ups. After a buff day's deadline a player
-- may take one of the appointments nobody holds.
--
--   ministry_take_late()   gives a player a free half-hour in one step: the
--                          row in ministry_appointments (source 'late') and
--                          the same entry in the day's published copy
--                          (ministry_rosters.published), so players see it at
--                          once and a moderator's draft is left as it is. The
--                          half-hour must be free in both; a player holds one
--                          appointment per day. Answers 'ok', 'taken' (the
--                          half-hour has someone), 'held' (the player has an
--                          appointment that day) or 'closed' (the day has no
--                          published roster).
--
--   ministry_publish()     the moderators' Publish as one step: the published
--                          copy becomes the day's appointments. Before, the
--                          site read the appointments and wrote the copy in
--                          two calls, and a free time taken in between would
--                          have been missing from the copy.
--
--   Both take the lock ministry_assign() takes, so a run, a publish and a
--   late player never interleave on one day. Functions only: additive and
--   idempotent; the previous deploy calls neither.

create or replace function public.ministry_take_late(p_round date, p_day integer, p_slot integer, p_signup uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_published jsonb;
begin
  perform pg_advisory_xact_lock(hashtext('ministry_assign:' || p_round::text || ':' || p_day::text));
  select published into v_published from public.ministry_rosters where round = p_round and day = p_day for update;
  if not found or v_published is null or jsonb_typeof(v_published) <> 'array' then
    return 'closed';
  end if;
  if exists (select 1 from public.ministry_appointments where round = p_round and day = p_day and signup_id = p_signup)
     or exists (select 1 from jsonb_array_elements(v_published) as entry where entry ->> 'signup_id' = p_signup::text) then
    return 'held';
  end if;
  if exists (select 1 from public.ministry_appointments where round = p_round and day = p_day and slot = p_slot)
     or exists (select 1 from jsonb_array_elements(v_published) as entry where (entry ->> 'slot')::integer = p_slot) then
    return 'taken';
  end if;
  insert into public.ministry_appointments (round, day, slot, signup_id, source)
    values (p_round, p_day, p_slot::smallint, p_signup, 'late');
  update public.ministry_rosters
    set published = v_published || jsonb_build_array(jsonb_build_object('signup_id', p_signup, 'slot', p_slot, 'source', 'late'))
    where round = p_round and day = p_day;
  return 'ok';
end;
$$;

revoke all on function public.ministry_take_late(date, integer, integer, uuid) from public, anon, authenticated;
grant execute on function public.ministry_take_late(date, integer, integer, uuid) to service_role;

create or replace function public.ministry_publish(p_round date, p_day integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtext('ministry_assign:' || p_round::text || ':' || p_day::text));
  update public.ministry_rosters r
    set published = coalesce(
          (select jsonb_agg(jsonb_build_object('signup_id', a.signup_id, 'slot', a.slot, 'source', a.source) order by a.slot)
             from public.ministry_appointments a
            where a.round = r.round and a.day = r.day),
          '[]'::jsonb),
        published_at = now()
    where r.round = p_round and r.day = p_day;
end;
$$;

revoke all on function public.ministry_publish(date, integer) from public, anon, authenticated;
grant execute on function public.ministry_publish(date, integer) to service_role;
