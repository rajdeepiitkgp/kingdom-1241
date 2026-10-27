-- Kingdom 1241 — rally-leader plan (password-locked, separate from the battle plan)
--
--   * kvk_leader_briefs   one row per battle plan: the leader page's own
--                         password and its instructions (intro, Markdown source
--                         per language like kvk_plans). Without a row the
--                         leader page says "no leader plan yet".
--   * kvk_leader_rules    the leaders' do / don't / info lines, for every
--                         leader or only rally leads / garrison leads.
--   * kvk_rally_leaders   who leads which rally, by in-game name: battle team
--                         ([KvK] rallies, [TMP] counter-rallies; the home
--                         alliance is separate), where to teleport, when to
--                         start (UTC), when to use pets (minutes after the
--                         battle starts) and their own heroes and troop ratio.
--   Leader rules and rallies belong to the battle plan, so duplicating a plan
--   copies them too.
--   Same rules as the other kvk_* tables: RLS on, NO policy for anon or
--   authenticated, read on the server with the service role after the
--   leader password was checked. Additive: the previous deploy ignores all three.

create table if not exists public.kvk_leader_briefs (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null unique references public.kvk_plans (id) on delete cascade,
  password      text not null,                           -- the leaders' own password; change it any time
  intro         jsonb not null default '{}'::jsonb,      -- sanitised HTML per language
  intro_source  jsonb,                                   -- Markdown per language (as kvk_plans.intro_source)
  published     boolean not null default true,
  source_hash   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists kvk_leader_briefs_updated_at on public.kvk_leader_briefs;
create trigger kvk_leader_briefs_updated_at before update on public.kvk_leader_briefs
  for each row execute function public.set_updated_at();

create table if not exists public.kvk_leader_rules (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.kvk_plans (id) on delete cascade,
  audience     text not null default 'all' check (audience in ('all', 'rally', 'garrison')),
  kind         text not null default 'info' check (kind in ('do', 'dont', 'info')),
  text         jsonb not null,
  sort_order   integer not null default 0,
  published    boolean not null default true,
  source_hash  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists kvk_leader_rules_plan_idx on public.kvk_leader_rules (plan_id, sort_order);

drop trigger if exists kvk_leader_rules_updated_at on public.kvk_leader_rules;
create trigger kvk_leader_rules_updated_at before update on public.kvk_leader_rules
  for each row execute function public.set_updated_at();

create table if not exists public.kvk_rally_leaders (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null references public.kvk_plans (id) on delete cascade,
  target        jsonb not null default '{}'::jsonb,      -- which rally, e.g. {"en": "Castle — first wave"}
  side          text not null default 'attack' check (side in ('attack', 'defense', 'any')),
  team          text not null default 'kvk' check (team in ('kvk', 'tmp')),   -- battle alliance on the day
  name          text not null,                           -- in-game name of the leader
  alliance_tag  text,                                    -- home alliance (matches alliances.tag)
  position      jsonb not null default '{}'::jsonb,      -- where to teleport / stand, e.g. {"en": "In front of the castle"}
  start_at      timestamptz,                             -- when to start the rally (UTC)
  pets_offset_minutes integer check (pets_offset_minutes between 0 and 1440),  -- pets: minutes after the battle start; null = no pets
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
  constraint kvk_rally_leaders_ratio_sum check (infantry_pct + cavalry_pct + archers_pct = 100)
);

create index if not exists kvk_rally_leaders_plan_idx on public.kvk_rally_leaders (plan_id, sort_order);

drop trigger if exists kvk_rally_leaders_updated_at on public.kvk_rally_leaders;
create trigger kvk_rally_leaders_updated_at before update on public.kvk_rally_leaders
  for each row execute function public.set_updated_at();

alter table public.kvk_leader_briefs  enable row level security;
alter table public.kvk_leader_rules   enable row level security;
alter table public.kvk_rally_leaders  enable row level security;

-- Deliberately NO policies: like the battle plan, only the service role reads these.
