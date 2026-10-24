-- Kingdom 1241 — brute-force protection for the shared KvK password
--
--   kvk_unlock_throttle: one row per scope, written by the server (service
--   role) on every wrong password:
--     'ip:<plan id>:<hash>'  wrong tries from one address (hashed, never stored
--                            in clear): five in 15 minutes lock that address,
--                            doubling from an hour up to a day;
--     'plan:<plan id>'       wrong tries for the plan from every address: never
--                            locks anyone out, but past a threshold the site
--                            writes an audit entry and alerts the council
--                            (alerted_at marks that it has done so this window).
--   Rules in src/lib/kvk/throttle.ts; rows older than two days are pruned
--   opportunistically. No policies: the API keys never read it.

create table if not exists public.kvk_unlock_throttle (
  scope             text primary key,
  failures          integer not null default 0,
  window_started_at timestamptz not null default now(),
  locked_until      timestamptz,
  lockouts          integer not null default 0,
  alerted_at        timestamptz,
  updated_at        timestamptz not null default now()
);

create index if not exists kvk_unlock_throttle_updated_idx on public.kvk_unlock_throttle (updated_at);

alter table public.kvk_unlock_throttle enable row level security;
