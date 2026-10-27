-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — Rally Sync: nothing about a running rally changes under the leaders' feet
--
--   * status              'active'   in the rally that is set now (start time, countdown, sounds);
--                         'next'     joined, or came back from sitting out, while a rally was running:
--                                    in from the next hit time;
--                         'inactive' sitting out (marked by the leader or the coordinator): no start
--                                    time, no sounds, not counted by Re-sync, until they come back.
--   * next_march_seconds  a leader's own new march time saved while they were in a running rally:
--                         their start doesn't move mid-countdown; it becomes march_seconds with the
--                         next hit time. The coordinator's edits still apply at once.
--
--   Setting a hit time (or clearing it) starts the next rally: 'next' becomes 'active' and waiting
--   march times take over (startNextRally in src/lib/rally-sync/actions.ts; the rules are pure in
--   src/lib/rally-sync/room.ts). Additive and idempotent; the leaders' broadcast trigger from 0012
--   already pings on every update of the row.

alter table public.rally_sync_leaders
  add column if not exists status text not null default 'active' check (status in ('active', 'next', 'inactive')),
  add column if not exists next_march_seconds integer check (next_march_seconds between 1 and 3600);

-- Re-sync's hit = now + rally timer + longest march + buffer: the march is already counted, so the
-- buffer is only the slowest leader's time to get ready. 30 s (was 120) like DEFAULT_BUFFER_SECONDS;
-- the app always writes the column, this keeps the table's default in step.
alter table public.rally_sync_rooms alter column buffer_seconds set default 30;
