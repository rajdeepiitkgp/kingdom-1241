-- Kingdom 1241 — commander checklist (password-locked, separate from the battle plan and the rally-leader plan)
--
--   * kvk_checklist_briefs  one row per battle plan: the checklist page's own
--                           password and the commander's brief (intro, Markdown
--                           source per language like kvk_plans). Without a row
--                           the page says "no checklist yet".
--   * kvk_checklist_items   what has to be done, by phase: before battle day,
--                           on battle day before the start, during, after. The
--                           visitor ticks items off on their own device; nothing
--                           about the ticks is stored here.
--   * kvk_checklist_rules   the battle commander's orders and the council's
--                           general guidelines, as do / don't / info lines.
--   Items and rules belong to the battle plan, so duplicating a plan copies them.
--   Same rules as the other kvk_* tables: RLS on, NO policy for anon or
--   authenticated, read on the server with the service role after the
--   checklist password was checked. Additive: the previous deploy ignores all three.

create table if not exists public.kvk_checklist_briefs (
  id            uuid primary key default gen_random_uuid(),
  plan_id       uuid not null unique references public.kvk_plans (id) on delete cascade,
  password      text not null,                           -- the checklist's own password; change it any time
  intro         jsonb not null default '{}'::jsonb,      -- sanitised HTML per language
  intro_source  jsonb,                                   -- Markdown per language (as kvk_plans.intro_source)
  published     boolean not null default true,
  source_hash   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists kvk_checklist_briefs_updated_at on public.kvk_checklist_briefs;
create trigger kvk_checklist_briefs_updated_at before update on public.kvk_checklist_briefs
  for each row execute function public.set_updated_at();

create table if not exists public.kvk_checklist_items (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.kvk_plans (id) on delete cascade,
  phase        text not null default 'before' check (phase in ('before', 'day', 'during', 'after')),
  text         jsonb not null,                           -- the task, e.g. {"en": "Share the battle-plan password on Discord"}
  note         jsonb not null default '{}'::jsonb,       -- optional detail: who, where, how
  sort_order   integer not null default 0,
  published    boolean not null default true,
  source_hash  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists kvk_checklist_items_plan_idx on public.kvk_checklist_items (plan_id, sort_order);

drop trigger if exists kvk_checklist_items_updated_at on public.kvk_checklist_items;
create trigger kvk_checklist_items_updated_at before update on public.kvk_checklist_items
  for each row execute function public.set_updated_at();

create table if not exists public.kvk_checklist_rules (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references public.kvk_plans (id) on delete cascade,
  section      text not null default 'commander' check (section in ('commander', 'general')),
  kind         text not null default 'info' check (kind in ('do', 'dont', 'info')),
  text         jsonb not null,
  sort_order   integer not null default 0,
  published    boolean not null default true,
  source_hash  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists kvk_checklist_rules_plan_idx on public.kvk_checklist_rules (plan_id, sort_order);

drop trigger if exists kvk_checklist_rules_updated_at on public.kvk_checklist_rules;
create trigger kvk_checklist_rules_updated_at before update on public.kvk_checklist_rules
  for each row execute function public.set_updated_at();

alter table public.kvk_checklist_briefs enable row level security;
alter table public.kvk_checklist_items  enable row level security;
alter table public.kvk_checklist_rules  enable row level security;

-- Deliberately NO policies: like the battle plan, only the service role reads these.
