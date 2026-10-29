-- Kingdom 1241 — events whose times each alliance picks, and rounds of two days
--
--   * timing: 'fixed' (the same start for everyone, shown with its time and a
--     countdown) or 'alliance' (each alliance picks its own times, as for Bear
--     Hunt and Viking Vengeance: the site shows the day only, and the times go
--     in the alliances' sections of the event's guide).
--   * also_after_days: a second day in each round, N days after the first
--     (Viking Vengeance: a Tuesday and the Thursday after, every two weeks).
--   * The seeded Bear Hunt and Viking Vengeance placeholders become
--     alliance-timed (no moderator could edit events before this).
--
-- Additive and idempotent: the previous deploy ignores the new columns.

alter table public.events add column if not exists timing text not null default 'fixed';
alter table public.events add column if not exists also_after_days integer;

alter table public.events drop constraint if exists events_timing_check;
alter table public.events add constraint events_timing_check check (timing in ('fixed', 'alliance'));

alter table public.events drop constraint if exists events_also_after_days_check;
alter table public.events add constraint events_also_after_days_check
  check (also_after_days is null or (also_after_days > 0 and (repeat_every_days is null or also_after_days < repeat_every_days)));

update public.events
   set timing = 'alliance'
 where id in ('e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002')
   and timing = 'fixed';
