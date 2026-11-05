-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — a garrison room may hold up to 160 browsers (was 60)
--
--   Garrison rooms are one coordinator broadcasting to many defenders, so the owner may give one
--   room most of the Realtime budget. Only the garrison room's browser bound changes; the defaults,
--   the other bounds and the 180 browsers across all open rooms (migration 0016) stay. The numbers
--   repeat CAPACITY_BOUNDS in src/lib/rally-sync/capacity.ts (a test compares them).
--
--   Additive and idempotent: the previous deploy's settings page still stops at 60, which this allows.

-- One Rally Sync limit: the owner's number, else the default, always within the bounds; 0 for an unknown type.
create or replace function public.rally_sync_capacity(room_mode text, field text)
returns integer language plpgsql stable set search_path = '' as $$
declare
  defaults constant jsonb := '{"rally":{"rooms":5,"leaders":10,"browsers":12},"garrison":{"rooms":5,"leaders":0,"browsers":22},"counter":{"rooms":1,"leaders":10,"browsers":10}}';
  bounds constant jsonb := '{"rally":{"rooms":[1,8],"leaders":[2,15],"browsers":[5,30]},"garrison":{"rooms":[1,8],"leaders":[0,0],"browsers":[5,160]},"counter":{"rooms":[1,2],"leaders":[2,15],"browsers":[2,20]}}';
  raw text;
  wanted integer;
begin
  select c.value -> room_mode ->> field into raw from public.app_config c where c.key = 'rally_sync_capacity';
  wanted := case when raw ~ '^[0-9]{1,4}$' then raw::integer else (defaults -> room_mode ->> field)::integer end;
  return coalesce(least((bounds -> room_mode -> field ->> 1)::integer, greatest((bounds -> room_mode -> field ->> 0)::integer, wanted)), 0);
end;
$$;
