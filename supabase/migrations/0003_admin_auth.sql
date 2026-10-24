-- Kingdom 1241 — phase 2: admin sign-in, roles and audit log
--
-- Admins and moderators sign in with Discord through Supabase Auth. The browser
-- never gets a key that can write: every admin write happens in a Server Action
-- that checks the role in `profiles` and then uses the service role. These
-- tables therefore have no write policies for the API keys.
--
--   * profiles     one row per signed-in account, created by the site on first sign-in
--   * role_grants  pre-authorisations by Discord username or e-mail: the role a
--                  person receives when they sign in, so the council can add an
--                  admin before that person has ever visited the site
--   * audit_log    who changed what in the admin area

-- ---------------------------------------------------------------------------
-- Profiles & roles
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  role              text not null default 'member' check (role in ('admin', 'moderator', 'member')),
  display_name      text not null default '',
  discord_id        text,                                  -- stable Discord user id
  discord_username  text,                                  -- Discord handle, lower-case, no '@'
  email             text,
  avatar_url        text,
  last_sign_in_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create unique index if not exists profiles_discord_id_idx on public.profiles (discord_id) where discord_id is not null;
create index if not exists profiles_role_idx on public.profiles (role);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table if not exists public.role_grants (
  id                uuid primary key default gen_random_uuid(),
  role              text not null check (role in ('admin', 'moderator')),
  discord_username  text,                                  -- lower-case, no '@'
  email             text,                                  -- lower-case
  note              text not null default '',
  created_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  constraint role_grants_target check (discord_username is not null or email is not null)
);

create unique index if not exists role_grants_discord_idx on public.role_grants (discord_username) where discord_username is not null;
create unique index if not exists role_grants_email_idx on public.role_grants (email) where email is not null;

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------

create table if not exists public.audit_log (
  id          bigint generated always as identity primary key,
  actor_id    uuid references public.profiles (id) on delete set null,
  actor_name  text not null default '',
  action      text not null,                               -- 'kvk_plan.save', 'profile.role', ...
  table_name  text,
  row_id      text,
  details     jsonb not null default '{}'::jsonb,          -- never passwords or whole rows
  created_at  timestamptz not null default now()
);

create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

-- ---------------------------------------------------------------------------
-- The battle plan introduction is written as Markdown in the admin area; the
-- rendered HTML stays in `intro` (what the page shows), the source here.
-- ---------------------------------------------------------------------------

alter table public.kvk_plans add column if not exists intro_source text;

-- ---------------------------------------------------------------------------
-- Row Level Security: a signed-in person may read their own profile; everything
-- else is reachable only with the service role (server code).
-- ---------------------------------------------------------------------------

alter table public.profiles     enable row level security;
alter table public.role_grants  enable row level security;
alter table public.audit_log    enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
