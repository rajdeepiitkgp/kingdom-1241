-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — Rally Sync: garrison rooms (refills that land between enemy rally hits)
--
--   * mode 'garrison'   a room for defenders: the coordinator marks incoming enemy rallies, and every
--                       player's page works out when to send their refill so it lands in the gap
--                       between two hits (src/lib/rally-sync/garrison.ts). Chosen when the room is
--                       created; a rally room never turns into one.
--   * garrison          one JSON value per room: the enemy rally leaders with their march time to the
--                       castle ({ id, name, marchSeconds, active, previousMarchSeconds, marchChangedAt })
--                       and the incoming rallies ({ id, enemyId, name, marchSeconds, launchAt, movedAt }).
--                       Players' own march times never leave their device.
--
--   The rooms' broadcast trigger from 0012 already pings on every change of a room row. Additive and
--   idempotent: the previous deploy reads named columns and shows a garrison room as a rally room for
--   the minute until it is replaced.

alter table public.rally_sync_rooms
  add column if not exists garrison jsonb not null default '{}'::jsonb;

-- A size guard: the app keeps at most 12 leaders and 10 rallies, far below this.
alter table public.rally_sync_rooms drop constraint if exists rally_sync_rooms_garrison_size;
alter table public.rally_sync_rooms add constraint rally_sync_rooms_garrison_size check (octet_length(garrison::text) <= 16384);

alter table public.rally_sync_rooms drop constraint if exists rally_sync_rooms_mode_check;
alter table public.rally_sync_rooms add constraint rally_sync_rooms_mode_check check (mode in ('rally', 'counter', 'garrison'));
