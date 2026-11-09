-- Copyright (c) 2026 Rajdeep Biswas. All rights reserved. Not open source: no copying, reuse or AI re-creation; see LICENSE.
-- Kingdom 1241 — Rally Sync: a plain text chat in every room
--
--   * rally_sync_messages  one row per message: the room, the browser that sent it (instance_id, null once
--                          that browser was removed), how the sender was called at the time (author = its
--                          own name or its leaders' names, null for a watcher, who is shown as "Watcher" +
--                          tag), whether the sender had coordinator rights, the text (1–500 characters,
--                          kept as written: no translation, the browser's own page translation may do it)
--                          and whether the coordinator pinned it (one per room, it stays on top of the chat
--                          and under the room's status line). Messages die with the room (cascade) and the
--                          room keeps the last 100 (the trim below; a pinned one is kept). RLS on, no
--                          policy: server only. Not backed up.
--
--   Realtime: a content-free "chat" ping on the room's topic after an insert, after a pin or unpin and after a
--   delete statement (one per statement, so clearing the chat or trimming it is one ping), separate from the rooms' "changed"
--   so pages fetch only the new messages (GET /api/rally-sync/<code>/chat). Additive and idempotent: the
--   previous deploy ignores the table.

create table if not exists public.rally_sync_messages (
  id            bigint generated always as identity primary key,
  room_id       uuid not null references public.rally_sync_rooms (id) on delete cascade,
  instance_id   uuid references public.rally_sync_instances (id) on delete set null,
  author        text check (author is null or char_length(author) between 1 and 120),
  tag           text not null check (tag ~ '^[A-HJKMNP-Z2-9]{4}$'),
  coordinator   boolean not null default false,
  body          text not null check (char_length(body) between 1 and 500),
  pinned        boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists rally_sync_messages_room_idx on public.rally_sync_messages (room_id, id);
-- One pinned message per room.
create unique index if not exists rally_sync_messages_pinned_idx on public.rally_sync_messages (room_id) where pinned;

alter table public.rally_sync_messages enable row level security;

-- A room keeps its last 100 messages: once 20 more have piled up, the oldest go (one delete statement, one ping); a pinned one stays.
create or replace function public.rally_sync_messages_trim()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (select count(*) from public.rally_sync_messages m where m.room_id = new.room_id) > 120 then
    delete from public.rally_sync_messages m
      where m.room_id = new.room_id
        and not m.pinned
        and m.id < (select t.id from public.rally_sync_messages t where t.room_id = new.room_id order by t.id desc offset 99 limit 1);
  end if;
  return null;
end;
$$;

-- "chat" on the room's topic: after each new message (row), after a pin or unpin (row) and after each delete statement
-- (rooms of the deleted rows).
create or replace function public.rally_sync_chat_broadcast()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  topic_key text;
begin
  if tg_op in ('INSERT', 'UPDATE') then
    select r.channel_key into topic_key from public.rally_sync_rooms r where r.id = new.room_id;
    if topic_key is not null then
      begin
        perform realtime.send(jsonb_build_object('at', floor(extract(epoch from now()) * 1000)), 'chat', 'rally:' || topic_key, false);
      exception when others then
        raise warning 'rally sync chat broadcast failed: %', sqlerrm;
      end;
    end if;
  else
    -- Messages deleted with their room find no room any more: the room's own "closed" covers them.
    for topic_key in select distinct r.channel_key from deleted d join public.rally_sync_rooms r on r.id = d.room_id loop
      begin
        perform realtime.send(jsonb_build_object('at', floor(extract(epoch from now()) * 1000)), 'chat', 'rally:' || topic_key, false);
      exception when others then
        raise warning 'rally sync chat broadcast failed: %', sqlerrm;
      end;
    end loop;
  end if;
  return null;
end;
$$;

drop trigger if exists rally_sync_messages_broadcast on public.rally_sync_messages;
create trigger rally_sync_messages_broadcast after insert or update of pinned on public.rally_sync_messages
  for each row execute function public.rally_sync_chat_broadcast();

drop trigger if exists rally_sync_messages_deleted on public.rally_sync_messages;
create trigger rally_sync_messages_deleted after delete on public.rally_sync_messages
  referencing old table as deleted
  for each statement execute function public.rally_sync_chat_broadcast();

drop trigger if exists rally_sync_messages_trim on public.rally_sync_messages;
create trigger rally_sync_messages_trim after insert on public.rally_sync_messages
  for each row execute function public.rally_sync_messages_trim();
