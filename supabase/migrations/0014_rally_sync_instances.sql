-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — Rally Sync: every browser in a room is an instance the coordinator can see and remove
--
--   * rally_sync_instances  one row per browser that opened a room (password or invite link). The
--                           room cookie names the row and is signed with the server secret, so a
--                           password change keeps everyone who is in; removing the row ends that
--                           browser's access at once (it needs the password to come back). `tag` is
--                           a random 4-character label ("Watcher K7M4") for instances without a
--                           name; `name` is optional and set by the instance itself; `coordinator`
--                           marks instances that used coordinator rights. One player may run
--                           several instances (Chrome and Safari, say), each with its own leader.
--   * rally_sync_leaders.instance_id  the instance that added the leader (null when the coordinator
--                           added it, or after that instance was removed): the coordinator's list
--                           shows an unnamed instance by its leader's name.
--
--   At most 50 instances per room (under the same lock as the other limits). The broadcast trigger
--   from 0012 pings the room when an instance joins, renames itself, turns coordinator or is removed;
--   the heartbeat (last_seen_at) sends nothing. RLS on, no policy: server only. Not backed up.
--   Additive: the previous deploy ignores the table and the column.

create table if not exists public.rally_sync_instances (
  id            uuid primary key default gen_random_uuid(),
  room_id       uuid not null references public.rally_sync_rooms (id) on delete cascade,
  tag           text not null check (tag ~ '^[A-HJKMNP-Z2-9]{4}$'),
  name          text check (name is null or char_length(name) between 1 and 30),
  coordinator   boolean not null default false,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create index if not exists rally_sync_instances_room_idx on public.rally_sync_instances (room_id);

alter table public.rally_sync_instances enable row level security;

alter table public.rally_sync_leaders
  add column if not exists instance_id uuid references public.rally_sync_instances (id) on delete set null;

create or replace function public.rally_sync_instance_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('rally_sync_limits'));
  if not exists (select 1 from public.rally_sync_rooms r where r.id = new.room_id and public.rally_sync_is_open(r.last_seen_at, r.created_at)) then
    raise exception 'rally_sync_room_closed';
  end if;
  if (select count(*) from public.rally_sync_instances i where i.room_id = new.room_id) >= 50 then
    raise exception 'rally_sync_instance_limit';
  end if;
  return new;
end;
$$;

drop trigger if exists rally_sync_instances_limit on public.rally_sync_instances;
create trigger rally_sync_instances_limit before insert on public.rally_sync_instances
  for each row execute function public.rally_sync_instance_limit();

drop trigger if exists rally_sync_instances_broadcast on public.rally_sync_instances;
create trigger rally_sync_instances_broadcast after insert or delete or update of name, coordinator on public.rally_sync_instances
  for each row execute function public.rally_sync_broadcast();
