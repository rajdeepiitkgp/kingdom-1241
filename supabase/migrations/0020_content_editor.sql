-- Kingdom 1241 — the content editor (announcements first; rules and guides use the same columns)
--
--   * body_source: the Markdown a moderator wrote, per language ({"en": …, "de": …}),
--     next to the HTML in `body` that players see. Like kvk_plans.intro_source:
--     English is the source, the pipeline translates `body`, and a hand correction
--     of one language writes both columns of that language. Not translated itself.
--   * content_images: one row per image uploaded through the editor (the file is in
--     the public `images` bucket under content/). The editor's budget sums `bytes`;
--     the daily prune deletes images no text refers to any more. Service role only.
--   * The `images` bucket takes only what the editor produces: WebP or JPEG, at
--     most 900 KB (the editor shrinks every image before upload).
--
-- Additive and idempotent: the previous deploy ignores the new columns and table.

alter table public.announcements add column if not exists body_source jsonb not null default '{}'::jsonb;
alter table public.rules add column if not exists body_source jsonb not null default '{}'::jsonb;
alter table public.guides add column if not exists body_source jsonb not null default '{}'::jsonb;

create table if not exists public.content_images (
  path        text primary key check (path ~ '^content/[0-9a-f-]{36}-[0-9]{1,4}x[0-9]{1,4}\.(webp|jpg)$'),
  bytes       integer not null check (bytes > 0),
  created_at  timestamptz not null default now()
);

alter table public.content_images enable row level security;
-- No policies: only the service role (the admin actions, the prune) reads or writes it.

update storage.buckets
set file_size_limit = 921600, -- 900 KB
    allowed_mime_types = array['image/webp', 'image/jpeg']
where id = 'images';
