-- Kingdom 1241 — battle plan: end time
--
--   * kvk_plans.battle_end_at   when the battle is over (UTC). Optional: without
--                               it the page keeps saying "Battle day!" after the
--                               start; with it the badge turns into "Battle in
--                               progress" and then "Battle ended".
--   Additive: the previous deploy ignores the column.

alter table public.kvk_plans add column if not exists battle_end_at timestamptz;
