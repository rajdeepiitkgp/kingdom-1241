-- Kingdom 1241 — Rally Sync (Tools → Rally Sync): rally leaders hit a target at the same second
--
--   * rally_sync_rooms    one row per room. A moderator creates it in the admin area; players
--                         open it with the room code + password or the invite link. The
--                         coordinator changes the live settings: mode (rally / counter-rally),
--                         rally timer, buffer, counter offset, the hit time and its history.
--   * rally_sync_leaders  the rally leaders in a room: in-game name and march time (seconds).
--
--   Rooms are short-lived: the coordinator destroys them, or they close after 30 minutes with
--   nobody on the page (last_seen_at, bumped by open pages) or 24 hours after creation. pg_cron
--   deletes closed rooms every five minutes when the extension is available; the daily prune
--   (npm run prune) does it otherwise. Not backed up.
--
--   Secrets are stored as hashes only: the room password (scrypt), the coordinator token and
--   each leader's edit token (sha256). channel_key names the Realtime topic on which the
--   triggers below broadcast a content-free "changed" / "closed"; pages then refetch through
--   the password-checked API route, so nothing is readable with the public key.
--
--   RLS on, NO policy for anon or authenticated: read and written on the server with the
--   service role. The limits (3 open rooms, 10 leaders per room, 15 leaders across open rooms)
--   are enforced here, under a lock, so two people at once can't go past them.
--   Additive: the previous deploy ignores both tables.

create table if not exists public.rally_sync_rooms (
  id                      uuid primary key default gen_random_uuid(),
  code                    text not null unique check (code ~ '^[A-HJKMNP-Z2-9]{6}$'),   -- no 0/O, 1/I/L
  title                   text not null default '' check (char_length(title) <= 40),
  password_hash           text not null,                     -- scrypt, see src/lib/rally-sync/access.ts
  coordinator_hash        text not null,                     -- sha256 of the coordinator token
  channel_key             text not null,                     -- Realtime topic suffix (random)
  mode                    text not null default 'rally' check (mode in ('rally', 'counter')),
  rally_wait_seconds      integer not null default 300 check (rally_wait_seconds between 0 and 3600),
  buffer_seconds          integer not null default 120 check (buffer_seconds between 0 and 600),
  counter_offset_seconds  integer not null default 3 check (counter_offset_seconds between 0 and 10),
  -- The three times below are GAME-CLOCK times (the game clock is the source of truth; it equals UTC unless
  -- players adjust their device's game clock). One value per room, shown unchanged on every device; a device's
  -- adjustment only moves its own "now". See src/lib/rally-sync/timing.ts.
  enemy_hit_at            timestamptz,                       -- counter mode: when the enemy rally lands
  hit_at                  timestamptz,                       -- when every rally lands
  hit_set_at              timestamptz,                       -- when hit_at was last set, on the coordinator's game clock ("too late" check)
  hit_history             jsonb not null default '[]'::jsonb, -- previous hit times, newest first, at most 10
  created_by              uuid references public.profiles (id) on delete set null,
  created_by_name         text,
  last_seen_at            timestamptz not null default now(),
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

drop trigger if exists rally_sync_rooms_updated_at on public.rally_sync_rooms;
create trigger rally_sync_rooms_updated_at before update on public.rally_sync_rooms
  for each row execute function public.set_updated_at();

create table if not exists public.rally_sync_leaders (
  id                      uuid primary key default gen_random_uuid(),
  room_id                 uuid not null references public.rally_sync_rooms (id) on delete cascade,
  name                    text not null check (char_length(name) between 1 and 30),
  march_seconds           integer not null check (march_seconds between 1 and 3600),
  previous_march_seconds  integer,                           -- the march time before the last change
  march_changed_at        timestamptz,                       -- when it changed (flagged while after hit_set_at)
  token_hash              text,                              -- the leader's edit token; null when the coordinator added the row
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index if not exists rally_sync_leaders_room_idx on public.rally_sync_leaders (room_id);

drop trigger if exists rally_sync_leaders_updated_at on public.rally_sync_leaders;
create trigger rally_sync_leaders_updated_at before update on public.rally_sync_leaders
  for each row execute function public.set_updated_at();

alter table public.rally_sync_rooms enable row level security;
alter table public.rally_sync_leaders enable row level security;

-- A room is open while somebody had it on screen in the last 30 minutes and it is under a day old
-- (the same rule as isRoomOpen in src/lib/rally-sync/room.ts).
create or replace function public.rally_sync_is_open(last_seen timestamptz, created timestamptz)
returns boolean language sql stable set search_path = '' as $$
  select last_seen > now() - interval '30 minutes' and created > now() - interval '24 hours'
$$;

-- ---------------------------------------------------------------------------
-- Limits (the server checks them first for a friendly message; this is the race-proof backstop)
-- ---------------------------------------------------------------------------

create or replace function public.rally_sync_room_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('rally_sync_limits'));
  if (select count(*) from public.rally_sync_rooms r where public.rally_sync_is_open(r.last_seen_at, r.created_at)) >= 3 then
    raise exception 'rally_sync_room_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists rally_sync_rooms_limit on public.rally_sync_rooms;
create trigger rally_sync_rooms_limit before insert on public.rally_sync_rooms
  for each row execute function public.rally_sync_room_limit();

create or replace function public.rally_sync_leader_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('rally_sync_limits'));
  if not exists (select 1 from public.rally_sync_rooms r where r.id = new.room_id and public.rally_sync_is_open(r.last_seen_at, r.created_at)) then
    raise exception 'rally_sync_room_closed';
  end if;
  if (select count(*) from public.rally_sync_leaders l where l.room_id = new.room_id) >= 10 then
    raise exception 'rally_sync_leader_limit';
  end if;
  if (select count(*) from public.rally_sync_leaders l join public.rally_sync_rooms r on r.id = l.room_id
      where public.rally_sync_is_open(r.last_seen_at, r.created_at)) >= 15 then
    raise exception 'rally_sync_total_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists rally_sync_leaders_limit on public.rally_sync_leaders;
create trigger rally_sync_leaders_limit before insert on public.rally_sync_leaders
  for each row execute function public.rally_sync_leader_limit();

-- ---------------------------------------------------------------------------
-- Realtime: a content-free ping on the room's public topic after every change
-- ---------------------------------------------------------------------------

-- "changed" after a write to a room or its leaders, "closed" when the room is deleted. The
-- heartbeat (last_seen_at) changes nothing a page shows, so it sends nothing. A failed send
-- never blocks the write: pages also poll.
create or replace function public.rally_sync_broadcast()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  topic_key text;
  event_name text := 'changed';
begin
  if tg_table_name = 'rally_sync_rooms' then
    if tg_op = 'DELETE' then
      topic_key := old.channel_key;
      event_name := 'closed';
    elsif tg_op = 'UPDATE' and (to_jsonb(new) - 'last_seen_at' - 'updated_at') = (to_jsonb(old) - 'last_seen_at' - 'updated_at') then
      return null;
    else
      topic_key := new.channel_key;
    end if;
  elsif tg_op = 'DELETE' then
    -- A leader removed with the whole room finds no room any more: the room's own "closed" covers it.
    select r.channel_key into topic_key from public.rally_sync_rooms r where r.id = old.room_id;
  else
    select r.channel_key into topic_key from public.rally_sync_rooms r where r.id = new.room_id;
  end if;

  if topic_key is null then
    return null;
  end if;
  begin
    perform realtime.send(jsonb_build_object('at', floor(extract(epoch from now()) * 1000)), event_name, 'rally:' || topic_key, false);
  exception when others then
    raise warning 'rally sync broadcast failed: %', sqlerrm;
  end;
  return null;
end;
$$;

drop trigger if exists rally_sync_rooms_broadcast on public.rally_sync_rooms;
create trigger rally_sync_rooms_broadcast after insert or update or delete on public.rally_sync_rooms
  for each row execute function public.rally_sync_broadcast();

drop trigger if exists rally_sync_leaders_broadcast on public.rally_sync_leaders;
create trigger rally_sync_leaders_broadcast after insert or update or delete on public.rally_sync_leaders
  for each row execute function public.rally_sync_broadcast();

-- ---------------------------------------------------------------------------
-- Cleanup every five minutes (pg_cron). Without the extension the daily prune does it.
-- ---------------------------------------------------------------------------

do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule(
    'rally-sync-close-idle-rooms',
    '*/5 * * * *',
    $job$delete from public.rally_sync_rooms where not public.rally_sync_is_open(last_seen_at, created_at)$job$
  );
  -- pg_cron keeps a row per run; a five-minute job would add ~9,000 a month.
  perform cron.schedule(
    'cron-run-history-cleanup',
    '17 3 * * *',
    $job$delete from cron.job_run_details where end_time < now() - interval '3 days'$job$
  );
exception when others then
  raise notice 'pg_cron is not available (%); the daily prune closes idle rally rooms instead', sqlerrm;
end;
$$;
