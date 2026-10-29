-- Kingdom 1241 — alliance sections of a guide
--
--   * guide_sections: how one alliance plays a guide's event, shown as a tab
--     under the guide's shared text. At most one section per alliance and
--     guide; the alliance is named by its tag (case-sensitive, like everywhere).
--     `body` is the HTML players see and the pipeline translates, `body_source`
--     the Markdown a moderator wrote (as on announcements, rules and guides).
--   * alliances_follow_tag: a renamed alliance keeps its sections.
--
-- Additive and idempotent: the previous deploy ignores the new table.

create table if not exists public.guide_sections (
  id            uuid primary key default gen_random_uuid(),
  guide_id      uuid not null references public.guides (id) on delete cascade,
  alliance_tag  text not null,
  body          jsonb not null default '{}'::jsonb,
  body_source   jsonb not null default '{}'::jsonb,
  published     boolean not null default true,
  source_hash   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (guide_id, alliance_tag)
);

drop trigger if exists guide_sections_updated_at on public.guide_sections;
create trigger guide_sections_updated_at before update on public.guide_sections
  for each row execute function public.set_updated_at();

alter table public.guide_sections enable row level security;

drop policy if exists "public read guide sections" on public.guide_sections;
create policy "public read guide sections" on public.guide_sections
  for select to anon, authenticated using (published);

create or replace function public.alliances_follow_tag()
returns trigger language plpgsql set search_path = '' as $$
begin
  update public.profiles set alliance_tag = new.tag where alliance_tag = old.tag;
  update public.kvk_coordinators set alliance_tag = new.tag where alliance_tag = old.tag;
  update public.kvk_rally_leaders set alliance_tag = new.tag where alliance_tag = old.tag;
  update public.kvk_retro_responses set alliance_tag = new.tag where alliance_tag = old.tag;
  update public.guide_sections set alliance_tag = new.tag where alliance_tag = old.tag;
  return new;
end;
$$;
