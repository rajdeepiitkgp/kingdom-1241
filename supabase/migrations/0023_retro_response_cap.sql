-- Battle feedback: the database keeps a retrospective's cap (max_responses).
--
--   The submit action counts the answers and then inserts, so two players on
--   the last free place at the same instant could both get in. This trigger
--   locks the retrospective's row for the insert and refuses the answer past
--   the cap with 'kvk_retro_full', which the action answers as "full".
--
-- Additive and idempotent: older code meets only an error at the cap, which it
-- already reports as unavailable.

create or replace function public.kvk_retro_responses_cap()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  cap integer;
  taken integer;
begin
  select max_responses into cap from public.kvk_retrospectives where id = new.retrospective_id for update;
  if cap is null then
    return new; -- no retrospective: the foreign key refuses the row
  end if;
  select count(*) into taken from public.kvk_retro_responses where retrospective_id = new.retrospective_id;
  if taken >= cap then
    raise exception 'kvk_retro_full' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists kvk_retro_responses_cap on public.kvk_retro_responses;
create trigger kvk_retro_responses_cap before insert on public.kvk_retro_responses
  for each row execute function public.kvk_retro_responses_cap();
