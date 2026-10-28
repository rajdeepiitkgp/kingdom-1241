-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — gift codes from kingshot.net
--
--   * source    'kingshot': found in kingshot.net's list of active codes (checked every hour); it ends
--               when it leaves that list. 'manual': added by a moderator (a code from in-game mail or
--               Discord that kingshot.net doesn't list yet); the next check takes it over once
--               kingshot.net lists it.
--   * ended_at  when the code left kingshot.net's list (null while it is in it, and for hand-added
--               codes). Home shows a code while it is active (not hidden by a moderator), not ended
--               and not past expires_at. Ended and expired codes are deleted 30 days later.
--   * the two example codes of the first setup (KINGDOM1241, WELCOME2026) were never real: removed.
--
--   Additive and idempotent: the previous deploy reads gift codes with `select *` and ignores the
--   new columns.

alter table public.gift_codes add column if not exists source text not null default 'manual';
alter table public.gift_codes add column if not exists ended_at timestamptz;

alter table public.gift_codes drop constraint if exists gift_codes_source_check;
alter table public.gift_codes add constraint gift_codes_source_check check (source in ('manual', 'kingshot'));

delete from public.gift_codes
  where id in ('c1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002')
    and code in ('KINGDOM1241', 'WELCOME2026');
