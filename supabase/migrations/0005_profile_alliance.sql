-- Kingdom 1241 — home alliance on profiles
--
--   profiles.alliance_tag: the alliance the person plays in (matches
--   alliances.tag, e.g. 'ULU'), chosen by the person themselves next to their
--   in-game name. Shown as "[ULU] Rudy" in the admin bar, the user list and
--   audit_log.actor_name. Not a foreign key: alliances come and go, and an old
--   tag on a profile is harmless.

alter table public.profiles add column if not exists alliance_tag text;
