-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — the owner's settings, and Rally Sync limits per room type
--
--   * app_config     one JSON value per setting, written only from the owner's settings page
--                    (/admin/settings) through the service role; every change is an audit entry.
--                    RLS on, no policy: visitors can't read it. Backed up.
--   * Rally Sync     the limits of migrations 0012 and 0014 become limits per room type (rally,
--                    garrison, counter), read from app_config 'rally_sync_capacity'. A missing or
--                    malformed number takes its default, and every number stays within the same
--                    bounds as the settings page (DEFAULT_CAPACITY and CAPACITY_BOUNDS in
--                    src/lib/rally-sync/capacity.ts; a test compares them). Leaders across all open
--                    rooms are no longer counted. A browser counts towards its room while it had the
--                    room on screen in the last 10 minutes, so one that left frees its place, and all
--                    open rooms together never hold more than 180 such browsers (Supabase's free plan
--                    allows 200 live Realtime connections; the settings page keeps the most the rooms
--                    could hold within 180 too).
--
--   Additive and idempotent: the previous deploy ignores the table, and its own checks are stricter
--   than these.

create table if not exists public.app_config (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

alter table public.app_config enable row level security;

drop trigger if exists app_config_updated_at on public.app_config;
create trigger app_config_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

-- One Rally Sync limit: the owner's number, else the default, always within the bounds; 0 for an unknown type.
create or replace function public.rally_sync_capacity(room_mode text, field text)
returns integer language plpgsql stable set search_path = '' as $$
declare
  defaults constant jsonb := '{"rally":{"rooms":5,"leaders":10,"browsers":12},"garrison":{"rooms":5,"leaders":0,"browsers":22},"counter":{"rooms":1,"leaders":10,"browsers":10}}';
  bounds constant jsonb := '{"rally":{"rooms":[1,8],"leaders":[2,15],"browsers":[5,30]},"garrison":{"rooms":[1,8],"leaders":[0,0],"browsers":[5,60]},"counter":{"rooms":[1,2],"leaders":[2,15],"browsers":[2,20]}}';
  raw text;
  wanted integer;
begin
  select c.value -> room_mode ->> field into raw from public.app_config c where c.key = 'rally_sync_capacity';
  wanted := case when raw ~ '^[0-9]{1,4}$' then raw::integer else (defaults -> room_mode ->> field)::integer end;
  return coalesce(least((bounds -> room_mode -> field ->> 1)::integer, greatest((bounds -> room_mode -> field ->> 0)::integer, wanted)), 0);
end;
$$;

create or replace function public.rally_sync_room_limit()
returns trigger language plpgsql set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtext('rally_sync_limits'));
  if (select count(*) from public.rally_sync_rooms r
      where r.mode = new.mode and public.rally_sync_is_open(r.last_seen_at, r.created_at)) >= public.rally_sync_capacity(new.mode, 'rooms') then
    raise exception 'rally_sync_room_limit';
  end if;
  return new;
end;
$$;

create or replace function public.rally_sync_leader_limit()
returns trigger language plpgsql set search_path = '' as $$
declare
  room_mode text;
begin
  perform pg_advisory_xact_lock(hashtext('rally_sync_limits'));
  select r.mode into room_mode from public.rally_sync_rooms r
    where r.id = new.room_id and public.rally_sync_is_open(r.last_seen_at, r.created_at);
  if room_mode is null then
    raise exception 'rally_sync_room_closed';
  end if;
  if (select count(*) from public.rally_sync_leaders l where l.room_id = new.room_id) >= public.rally_sync_capacity(room_mode, 'leaders') then
    raise exception 'rally_sync_leader_limit';
  end if;
  return new;
end;
$$;

create or replace function public.rally_sync_instance_limit()
returns trigger language plpgsql set search_path = '' as $$
declare
  room_mode text;
begin
  perform pg_advisory_xact_lock(hashtext('rally_sync_limits'));
  select r.mode into room_mode from public.rally_sync_rooms r
    where r.id = new.room_id and public.rally_sync_is_open(r.last_seen_at, r.created_at);
  if room_mode is null then
    raise exception 'rally_sync_room_closed';
  end if;
  if (select count(*) from public.rally_sync_instances i
      where i.room_id = new.room_id and i.last_seen_at > now() - interval '10 minutes') >= public.rally_sync_capacity(room_mode, 'browsers') then
    raise exception 'rally_sync_instance_limit';
  end if;
  -- Every open room together, whatever is stored.
  if (select count(*) from public.rally_sync_instances i join public.rally_sync_rooms r on r.id = i.room_id
      where public.rally_sync_is_open(r.last_seen_at, r.created_at) and i.last_seen_at > now() - interval '10 minutes') >= 180 then
    raise exception 'rally_sync_instance_limit';
  end if;
  return new;
end;
$$;
