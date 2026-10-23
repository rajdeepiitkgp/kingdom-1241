-- Kingdom 1241 — hero catalogue + password-locked KvK battle plan
--
-- Run after 0001_init.sql (Supabase Dashboard → SQL Editor, or `supabase db push`).
--
--   * `heroes` is public (published rows), like the other content tables.
--   * `kvk_plans`, `kvk_rules`, `kvk_coordinators` and `kvk_formations` have
--     Row Level Security enabled and NO policy for the anon/authenticated roles:
--     only the service role can read them. The site reads them on the server,
--     after checking the shared password, so enemy kingdoms can't pull the plan
--     through the public REST API. Phase 2 adds admin policies.
--   * Translatable columns are JSONB {"en": ...}; `source_hash` works as in 0001.

-- ---------------------------------------------------------------------------
-- Heroes
-- ---------------------------------------------------------------------------

create table if not exists public.heroes (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,                     -- 'amane', 'long-fei'
  name         jsonb not null,                           -- {"en": "Amane", ...}
  troop_type   text not null check (troop_type in ('infantry', 'cavalry', 'archers')),
  rarity       text not null default 'legendary' check (rarity in ('legendary', 'epic', 'rare')),
  generation   integer,
  icon_url     text,                                     -- '/heroes/amane.png' or any https URL
  sort_order   integer not null default 0,
  published    boolean not null default true,
  source_hash  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists heroes_updated_at on public.heroes;
create trigger heroes_updated_at before update on public.heroes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Battle plans (one row per event; the row with active = true is shown on /kvk)
--
-- Kingdom 1241 alternates two events every two weeks: the internal castle
-- battle (practice inside the kingdom) and KvK (against another kingdom).
-- Both use this page; `event_type` says which one the plan is for.
-- ---------------------------------------------------------------------------

create table if not exists public.kvk_plans (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  event_type       text not null default 'kvk' check (event_type in ('castle_battle', 'kvk')),
  title            jsonb not null,                       -- {"en": "Castle Battle — 25 Oct"}
  opponent         text,                                 -- 'Kingdom 1198' (KvK only)
  battle_at        timestamptz,                          -- start of the castle battle (UTC)
  intro            jsonb not null default '{}'::jsonb,   -- sanitised HTML per language
  min_hero_stars   integer not null default 4 check (min_hero_stars between 0 and 5),
  min_skill_level  integer not null default 5 check (min_skill_level between 0 and 5),
  password         text not null,                        -- shared password; change it any time
  active           boolean not null default false,
  published        boolean not null default true,
  source_hash      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Only one plan can be active at a time.
create unique index if not exists kvk_plans_one_active_idx on public.kvk_plans (active) where active;

drop trigger if exists kvk_plans_updated_at on public.kvk_plans;
create trigger kvk_plans_updated_at before update on public.kvk_plans
  for each row execute function public.set_updated_at();

-- Short instructions shown as a checklist ("No buffs except...").
create table if not exists public.kvk_rules (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.kvk_plans (id) on delete cascade,
  kind         text not null default 'info' check (kind in ('do', 'dont', 'info')),
  text         jsonb not null,
  sort_order   integer not null default 0,
  published    boolean not null default true,
  source_hash  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists kvk_rules_plan_idx on public.kvk_rules (plan_id, sort_order);

drop trigger if exists kvk_rules_updated_at on public.kvk_rules;
create trigger kvk_rules_updated_at before update on public.kvk_rules
  for each row execute function public.set_updated_at();

-- Who to listen to on battle day. [KvK] and [TMP] are the kingdom's two battle
-- alliances: [KvK] rallies the castle, [TMP] counter-rallies. `team` says which
-- one the coordinator runs; `alliance_tag` is their home alliance (badge colour).
create table if not exists public.kvk_coordinators (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.kvk_plans (id) on delete cascade,
  team          text not null default 'kvk' check (team in ('kvk', 'tmp')),
  name          text not null,                           -- in-game name
  alliance_tag  text,                                    -- home alliance, e.g. 'NAM' (matches alliances.tag)
  note          jsonb not null default '{}'::jsonb,      -- e.g. {"en": "English / Arabic"}
  sort_order    integer not null default 0,
  published     boolean not null default true,
  source_hash   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists kvk_coordinators_plan_idx on public.kvk_coordinators (plan_id, team, sort_order);

drop trigger if exists kvk_coordinators_updated_at on public.kvk_coordinators;
create trigger kvk_coordinators_updated_at before update on public.kvk_coordinators
  for each row execute function public.set_updated_at();

-- Formations players save in the game's Troop Ratio presets (12 slots).
create table if not exists public.kvk_formations (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.kvk_plans (id) on delete cascade,
  label         text not null,                           -- 'A' .. 'L'
  side          text not null default 'any' check (side in ('attack', 'defense', 'any')),
  role          text not null default 'any' check (role in ('rally_lead', 'rally_join', 'any')),
  hero_1        text references public.heroes (slug) on update cascade on delete set null,
  hero_2        text references public.heroes (slug) on update cascade on delete set null,
  hero_3        text references public.heroes (slug) on update cascade on delete set null,
  infantry_pct  integer not null default 0 check (infantry_pct between 0 and 100),
  cavalry_pct   integer not null default 0 check (cavalry_pct between 0 and 100),
  archers_pct   integer not null default 0 check (archers_pct between 0 and 100),
  note          jsonb not null default '{}'::jsonb,
  sort_order    integer not null default 0,
  published     boolean not null default true,
  source_hash   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint kvk_formations_ratio_sum check (infantry_pct + cavalry_pct + archers_pct = 100),
  constraint kvk_formations_label_unique unique (plan_id, label)
);

create index if not exists kvk_formations_plan_idx on public.kvk_formations (plan_id, sort_order);

drop trigger if exists kvk_formations_updated_at on public.kvk_formations;
create trigger kvk_formations_updated_at before update on public.kvk_formations
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.heroes            enable row level security;
alter table public.kvk_plans         enable row level security;
alter table public.kvk_rules         enable row level security;
alter table public.kvk_coordinators  enable row level security;
alter table public.kvk_formations    enable row level security;

drop policy if exists "public read heroes" on public.heroes;
create policy "public read heroes" on public.heroes
  for select to anon, authenticated using (published);

-- Deliberately NO select policies on the kvk_* tables: the battle plan is
-- read with the service role on the server only (see src/lib/data/index.ts).
