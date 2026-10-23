-- Kingdom 1241 — phase 1 schema
--
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- or with the Supabase CLI: `supabase db push`.
--
-- Conventions
--   * Every translatable text column is JSONB of shape {"en": "...", "de": "...", ...}.
--     English is always present; other languages are filled by the translation pipeline.
--   * `source_hash` stores a hash of the English text at the time it was last translated.
--     The translation pipeline skips rows whose hash is unchanged, which also prevents
--     webhook loops (the pipeline's own write triggers the webhook again → hash matches → skip).
--   * Public visitors read through the anon key; RLS exposes published rows only.
--     Writes happen with the service role key (seed script, translation pipeline) and,
--     from phase 2, through authenticated admins.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Languages offered on the site
-- ---------------------------------------------------------------------------

create table if not exists public.languages (
  code        text primary key,                 -- 'en', 'de', 'ko', 'pl', 'ar', ...
  enabled     boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Site-wide settings (single row per key)
-- ---------------------------------------------------------------------------

create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null,
  updated_at  timestamptz not null default now()
);

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Interface strings (navigation, labels, buttons)
-- ---------------------------------------------------------------------------

create table if not exists public.ui_strings (
  key          text primary key,
  text         jsonb not null,                   -- {"en": "...", ...}
  source_hash  text,
  updated_at   timestamptz not null default now()
);

drop trigger if exists ui_strings_updated_at on public.ui_strings;
create trigger ui_strings_updated_at before update on public.ui_strings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------

create table if not exists public.announcements (
  id            uuid primary key default gen_random_uuid(),
  title         jsonb not null,
  body          jsonb not null,                  -- sanitised HTML per language
  pinned        boolean not null default false,
  published     boolean not null default true,
  published_at  timestamptz not null default now(),
  expires_at    timestamptz,
  source_hash   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists announcements_published_idx
  on public.announcements (published, pinned desc, published_at desc);

drop trigger if exists announcements_updated_at on public.announcements;
create trigger announcements_updated_at before update on public.announcements
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table if not exists public.events (
  id                uuid primary key default gen_random_uuid(),
  slug              text not null unique,
  name              jsonb not null,
  summary           jsonb not null default '{}'::jsonb,
  category          text not null default 'alliance'
                    check (category in ('alliance', 'kingdom', 'cross-kingdom', 'solo')),
  icon              text not null default '📅',
  color             text not null default 'sky',
  starts_at         timestamptz not null,
  duration_minutes  integer not null default 60 check (duration_minutes > 0),
  repeat_every_days integer check (repeat_every_days is null or repeat_every_days > 0),
  guide_slug        text,
  published         boolean not null default true,
  source_hash       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists events_updated_at on public.events;
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Rules (topics → rules)
-- ---------------------------------------------------------------------------

create table if not exists public.rule_topics (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  title        jsonb not null,
  icon         text not null default '📜',
  sort_order   integer not null default 0,
  published    boolean not null default true,
  source_hash  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists rule_topics_updated_at on public.rule_topics;
create trigger rule_topics_updated_at before update on public.rule_topics
  for each row execute function public.set_updated_at();

create table if not exists public.rules (
  id           uuid primary key default gen_random_uuid(),
  topic_id     uuid not null references public.rule_topics (id) on delete cascade,
  title        jsonb not null,
  body         jsonb not null,
  sort_order   integer not null default 0,
  published    boolean not null default true,
  source_hash  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists rules_topic_idx on public.rules (topic_id, sort_order);

drop trigger if exists rules_updated_at on public.rules;
create trigger rules_updated_at before update on public.rules
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Guides
-- ---------------------------------------------------------------------------

create table if not exists public.guides (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            jsonb not null,
  summary          jsonb not null default '{}'::jsonb,
  body             jsonb not null,
  icon             text not null default '📖',
  cover_image_url  text,
  sort_order       integer not null default 0,
  published        boolean not null default true,
  source_hash      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists guides_updated_at on public.guides;
create trigger guides_updated_at before update on public.guides
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Alliances
-- ---------------------------------------------------------------------------

create table if not exists public.alliances (
  id            uuid primary key default gen_random_uuid(),
  tag           text not null unique,
  name          text not null,
  color         text not null default '#3b82f6',
  leader        text,
  power         bigint,
  members       integer,
  max_members   integer not null default 100,
  description   jsonb not null default '{}'::jsonb,
  requirements  jsonb not null default '{}'::jsonb,
  languages     text,
  discord_url   text,
  sort_order    integer not null default 0,
  published     boolean not null default true,
  source_hash   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists alliances_updated_at on public.alliances;
create trigger alliances_updated_at before update on public.alliances
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Gift codes
-- ---------------------------------------------------------------------------

create table if not exists public.gift_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null unique,
  rewards      jsonb not null default '{}'::jsonb,
  expires_at   timestamptz,
  active       boolean not null default true,
  source_hash  text,
  added_at     timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists gift_codes_updated_at on public.gift_codes;
create trigger gift_codes_updated_at before update on public.gift_codes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security: the public can read, nobody can write with the anon key.
-- (Phase 2 adds policies for authenticated admins/moderators.)
-- ---------------------------------------------------------------------------

alter table public.languages      enable row level security;
alter table public.site_settings  enable row level security;
alter table public.ui_strings     enable row level security;
alter table public.announcements  enable row level security;
alter table public.events         enable row level security;
alter table public.rule_topics    enable row level security;
alter table public.rules          enable row level security;
alter table public.guides         enable row level security;
alter table public.alliances      enable row level security;
alter table public.gift_codes     enable row level security;

drop policy if exists "public read languages" on public.languages;
create policy "public read languages" on public.languages
  for select to anon, authenticated using (enabled);

drop policy if exists "public read settings" on public.site_settings;
create policy "public read settings" on public.site_settings
  for select to anon, authenticated using (true);

drop policy if exists "public read ui strings" on public.ui_strings;
create policy "public read ui strings" on public.ui_strings
  for select to anon, authenticated using (true);

drop policy if exists "public read announcements" on public.announcements;
create policy "public read announcements" on public.announcements
  for select to anon, authenticated using (published);

drop policy if exists "public read events" on public.events;
create policy "public read events" on public.events
  for select to anon, authenticated using (published);

drop policy if exists "public read rule topics" on public.rule_topics;
create policy "public read rule topics" on public.rule_topics
  for select to anon, authenticated using (published);

drop policy if exists "public read rules" on public.rules;
create policy "public read rules" on public.rules
  for select to anon, authenticated using (published);

drop policy if exists "public read guides" on public.guides;
create policy "public read guides" on public.guides
  for select to anon, authenticated using (published);

drop policy if exists "public read alliances" on public.alliances;
create policy "public read alliances" on public.alliances
  for select to anon, authenticated using (published);

drop policy if exists "public read gift codes" on public.gift_codes;
create policy "public read gift codes" on public.gift_codes
  for select to anon, authenticated using (active);

-- ---------------------------------------------------------------------------
-- Storage: public bucket for images used in announcements, guides and rules.
-- Uploads are done by admins (phase 2) through the service role / admin policies.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'images',
  'images',
  true,
  2097152, -- 2 MB; the editor shrinks images before upload
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

drop policy if exists "public read images" on storage.objects;
create policy "public read images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'images');
