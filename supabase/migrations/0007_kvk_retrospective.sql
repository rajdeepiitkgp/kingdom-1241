-- Kingdom 1241 — battle retrospective: a short feedback form per battle plan
--
--   * kvk_retrospectives   one row per battle plan; the council opens it after
--                          the battle. Holds the editable title and intro
--                          (translated like the plan), which rating questions
--                          and text prompts are shown and required (`config`),
--                          the response cap, the retention period and an
--                          optional closing time. At most one is open at a time.
--   * kvk_retro_responses  one row per player and battle, keyed on the Governor
--                          ID (unique per retrospective). `ratings` is a JSON map
--                          question key → 0..5; the three texts are capped at 500
--                          characters in the database as well as in the form.
--                          The Maintenance task `prune` deletes the rows
--                          retention_days after the battle (SETUP.md § 9).
--
--   No policies: like the other kvk_* tables both are read and written with the
--   service role only, behind the shared battle-plan password.

create table if not exists public.kvk_retrospectives (
  id              uuid primary key default gen_random_uuid(),
  plan_id         uuid not null unique references public.kvk_plans (id) on delete cascade,
  open            boolean not null default false,
  title           jsonb not null default '{}'::jsonb,       -- {"en": "How did the castle battle go?"}
  intro           jsonb not null default '{}'::jsonb,       -- sanitised HTML per language
  intro_source    jsonb not null default '{}'::jsonb,       -- Markdown per language
  config          jsonb not null default '{}'::jsonb,       -- {"ratings": {"overall": {"shown": true, "required": true}}, "texts": {...}}
  closes_at       timestamptz,                               -- optional: the form closes by itself at this moment (UTC)
  max_responses   integer not null default 600 check (max_responses between 1 and 2000),
  retention_days  integer not null default 30 check (retention_days between 7 and 365),
  source_hash     text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Only one feedback form can be open at a time.
create unique index if not exists kvk_retrospectives_one_open_idx on public.kvk_retrospectives (open) where open;

drop trigger if exists kvk_retrospectives_updated_at on public.kvk_retrospectives;
create trigger kvk_retrospectives_updated_at before update on public.kvk_retrospectives
  for each row execute function public.set_updated_at();

create table if not exists public.kvk_retro_responses (
  id                uuid primary key default gen_random_uuid(),
  retrospective_id  uuid not null references public.kvk_retrospectives (id) on delete cascade,
  governor_id       text not null check (governor_id ~ '^[0-9]{4,16}$'),
  game_name         text not null default '' check (char_length(game_name) <= 40),
  alliance_tag      text check (char_length(alliance_tag) <= 8),
  verified          boolean not null default false,          -- Governor ID and name confirmed through MightPulse
  ratings           jsonb not null default '{}'::jsonb check (jsonb_typeof(ratings) = 'object' and pg_column_size(ratings) <= 600),
  went_well         text not null default '' check (char_length(went_well) <= 500),
  went_wrong        text not null default '' check (char_length(went_wrong) <= 500),
  suggestions       text not null default '' check (char_length(suggestions) <= 500),
  locale            text not null default 'en' check (char_length(locale) <= 10),  -- page language the player wrote on (a hint)
  created_at        timestamptz not null default now(),
  constraint kvk_retro_responses_one_per_governor unique (retrospective_id, governor_id)
);

create index if not exists kvk_retro_responses_retro_idx on public.kvk_retro_responses (retrospective_id, created_at);

alter table public.kvk_retrospectives   enable row level security;
alter table public.kvk_retro_responses  enable row level security;

-- Deliberately NO policies: read and written on the server with the service role only.
