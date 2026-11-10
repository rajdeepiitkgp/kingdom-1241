-- Ministry appointments: players sign up for the king's buff days of a KvK
-- prep round (/kvk/ministry, behind the battle plan's password).
--
--   * ministry_signups  one row per player and prep round, keyed on the
--                       Governor ID. `round` is the round's Day 0 (a Sunday,
--                       UTC). `amounts` is what the player will use
--                       ({"truegold": 120, "constructionMinutes": 4320, …}),
--                       `slots` the half-hour appointments (0–47, UTC) they
--                       can take per buff day ({"1": [0, 1, 2, 3], "4": […]}).
--                       `device_hash` is the sha256 of a key that stays in the
--                       browser that signed up: that browser may change the
--                       entry until the day's deadline, everyone else asks a
--                       moderator. `disabled` keeps an entry but leaves it out
--                       of the lists.
--                       The daily prune deletes a round's rows two weeks
--                       after its battle.
--
--   The round's switch (open or not) and the deadline of each buff day are one
--   app_config value, `ministry`.
--
--   No policies: read and written on the server with the service role only.
--   Additive and idempotent.

create table if not exists public.ministry_signups (
  id            uuid primary key default gen_random_uuid(),
  round         date not null,
  governor_id   text not null check (governor_id ~ '^[0-9]{4,16}$'),
  game_name     text not null default '' check (char_length(game_name) <= 40),
  alliance_tag  text check (char_length(alliance_tag) <= 8),
  verified      boolean not null default false,          -- Governor ID and name confirmed through MightPulse
  power         bigint check (power is null or power >= 0), -- as MightPulse reported it at sign-up
  amounts       jsonb not null default '{}'::jsonb check (jsonb_typeof(amounts) = 'object' and pg_column_size(amounts) <= 600),
  slots         jsonb not null default '{}'::jsonb check (jsonb_typeof(slots) = 'object' and pg_column_size(slots) <= 2000),
  disabled      boolean not null default false,
  device_hash   text check (char_length(device_hash) <= 64),
  locale        text not null default 'en' check (char_length(locale) <= 10),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint ministry_signups_one_per_governor unique (round, governor_id)
);

create index if not exists ministry_signups_device_idx on public.ministry_signups (round, device_hash);

drop trigger if exists ministry_signups_updated_at on public.ministry_signups;
create trigger ministry_signups_updated_at before update on public.ministry_signups
  for each row execute function public.set_updated_at();

alter table public.ministry_signups enable row level security;

-- Deliberately NO policies: read and written on the server with the service role only.
