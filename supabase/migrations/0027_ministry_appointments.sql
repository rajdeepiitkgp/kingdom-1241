-- Ministry appointments, part two: who got which of a buff day's 48
-- half-hour appointments (the roster on /kvk/ministry and /admin/ministry).
--
--   * ministry_appointments  one row per filled appointment: the prep round
--                            (its Day 0), the buff day (1–5), the half-hour
--                            slot (0–47, UTC) and the sign-up that holds it.
--                            `source` says who put it there: `auto` the
--                            assignment, `moderator` a moderator by hand,
--                            `late` a player who took a free appointment
--                            after the deadline. A new run of the assignment
--                            replaces only its own rows. The table itself
--                            keeps the two rules that must hold whoever
--                            writes: one player per appointment, one
--                            appointment per player and day. Rows go with
--                            their sign-up (set aside, removed, pruned).
--
--   * ministry_rosters       one row per round and buff day once its
--                            assignment has run (also when nobody signed
--                            up): the roster is then shown, and the run at
--                            the deadline happens once.
--
--   * ministry_assign()      replaces a day's `auto` rows and marks the day
--                            as assigned, in one transaction, so a roster is
--                            never seen half-written and a free appointment
--                            taken at the same moment makes the whole run
--                            fail instead of losing a player.
--
--   No policies: read and written on the server with the service role only.
--   Additive and idempotent.

create table if not exists public.ministry_appointments (
  id          uuid primary key default gen_random_uuid(),
  round       date not null,
  day         smallint not null check (day between 1 and 5),
  slot        smallint not null check (slot between 0 and 47),
  signup_id   uuid not null references public.ministry_signups (id) on delete cascade,
  source      text not null default 'auto' check (source in ('auto', 'moderator', 'late')),
  created_at  timestamptz not null default now(),
  constraint ministry_appointments_one_per_slot unique (round, day, slot),
  constraint ministry_appointments_one_per_player unique (round, day, signup_id)
);

create index if not exists ministry_appointments_signup_idx on public.ministry_appointments (signup_id);

alter table public.ministry_appointments enable row level security;

create table if not exists public.ministry_rosters (
  id           uuid primary key default gen_random_uuid(),
  round        date not null,
  day          smallint not null check (day between 1 and 5),
  assigned_at  timestamptz not null default now(),
  constraint ministry_rosters_one_per_day unique (round, day)
);

alter table public.ministry_rosters enable row level security;

-- Deliberately NO policies on either table: the service role only.

-- p_rows: [{"signup_id": "<uuid>", "slot": 14}, …], the assignment's own places.
-- p_first: the run at the deadline, which happens once: it steps aside (false) when the day has its roster already.
create or replace function public.ministry_assign(p_round date, p_day integer, p_rows jsonb, p_first boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  -- One run per day at a time: two visitors arriving at the deadline together.
  perform pg_advisory_xact_lock(hashtext('ministry_assign:' || p_round::text || ':' || p_day::text));
  if p_first and exists (select 1 from public.ministry_rosters where round = p_round and day = p_day) then
    return false;
  end if;
  delete from public.ministry_appointments where round = p_round and day = p_day and source = 'auto';
  insert into public.ministry_appointments (round, day, slot, signup_id, source)
    select p_round, p_day, (entry ->> 'slot')::smallint, (entry ->> 'signup_id')::uuid, 'auto'
    from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as entry;
  insert into public.ministry_rosters (round, day) values (p_round, p_day)
    on conflict (round, day) do update set assigned_at = now();
  return true;
end;
$$;

revoke all on function public.ministry_assign(date, integer, jsonb, boolean) from public, anon, authenticated;
grant execute on function public.ministry_assign(date, integer, jsonb, boolean) to service_role;
