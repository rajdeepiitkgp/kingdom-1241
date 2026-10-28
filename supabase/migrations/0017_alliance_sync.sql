-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — alliances follow MightPulse
--
--   * mightpulse_aid  MightPulse's alliance id (the game's): the sync finds an alliance by it, so a
--                     new tag or name follows on the next sync. Null until the first sync links the
--                     row by its tag. One row per id.
--   * stats_source    where power, leader and members come from: 'mightpulse' (the daily sync or the
--                     owner's Sync now), 'manual' (typed by the owner while MightPulse was down; the
--                     next successful sync replaces it) or 'seed' (the rows of 0001's seed).
--   * stats_at        when those numbers were last written.
--   * a new tag follows everywhere the site names an alliance by its tag: the admins' profiles, the
--     battle plans' coordinators and rally leaders, and battle feedback answers. Exact (tags are
--     case-sensitive in the game: [NAM] and [Nam] are two alliances of 1241) and in the same
--     transaction as the rename, so it covers the sync, the owner's edit and a dashboard edit alike.
--
--   Additive and idempotent: the previous deploy reads alliances with `select *` and ignores the
--   new columns.

alter table public.alliances add column if not exists mightpulse_aid bigint;
alter table public.alliances add column if not exists stats_source text not null default 'seed';
alter table public.alliances add column if not exists stats_at timestamptz;

alter table public.alliances drop constraint if exists alliances_stats_source_check;
alter table public.alliances add constraint alliances_stats_source_check check (stats_source in ('seed', 'mightpulse', 'manual'));

create unique index if not exists alliances_mightpulse_aid_key on public.alliances (mightpulse_aid) where mightpulse_aid is not null;

create or replace function public.alliances_follow_tag()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.profiles set alliance_tag = new.tag where alliance_tag = old.tag;
  update public.kvk_coordinators set alliance_tag = new.tag where alliance_tag = old.tag;
  update public.kvk_rally_leaders set alliance_tag = new.tag where alliance_tag = old.tag;
  update public.kvk_retro_responses set alliance_tag = new.tag where alliance_tag = old.tag;
  return new;
end;
$$;

drop trigger if exists alliances_follow_tag on public.alliances;
create trigger alliances_follow_tag after update of tag on public.alliances
  for each row when (old.tag is distinct from new.tag) execute function public.alliances_follow_tag();
