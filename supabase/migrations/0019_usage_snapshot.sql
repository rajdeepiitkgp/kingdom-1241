-- Kingdom 1241 — the owner's Usage tab: what the database can tell about itself
--
--   public.usage_snapshot() returns one JSON object for Admin → Settings → Usage:
--     * databases_bytes  every database of the project, as Supabase counts the free plan's 500 MB
--     * wal_bytes        the write-ahead log, which also takes disk (null where it can't be read)
--     * tables           the public tables with their size (indexes included) and live rows
--     * connections / max_connections, and cache_hit (share of table reads served from memory)
--     * storage_bytes / storage_objects  the files in Supabase Storage (null where unreadable)
--     * cron             the pg_cron jobs with their last run (null without pg_cron)
--   Read-only. Security definer so it can read the statistics, callable by the service role only
--   (the site's server); anon and signed-in browsers get no execute right.
--
--   Additive and idempotent: the previous deploy never calls it.

create or replace function public.usage_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  wal bigint;
  storage_size bigint;
  storage_count bigint;
  jobs jsonb;
begin
  select jsonb_build_object(
    'databases_bytes', (select sum(pg_database_size(d.datname)) from pg_catalog.pg_database d),
    'connections', (select count(*) from pg_catalog.pg_stat_activity a where a.datname = current_database()),
    'max_connections', current_setting('max_connections')::int,
    'cache_reads', (select coalesce(sum(s.heap_blks_hit) + sum(s.heap_blks_read), 0) from pg_catalog.pg_statio_user_tables s),
    'cache_hit', (
      select case when coalesce(sum(s.heap_blks_hit) + sum(s.heap_blks_read), 0) = 0 then null
                  else round(sum(s.heap_blks_hit)::numeric / (sum(s.heap_blks_hit) + sum(s.heap_blks_read)), 4) end
      from pg_catalog.pg_statio_user_tables s
    ),
    'tables', (
      select coalesce(jsonb_agg(jsonb_build_object('name', c.relname, 'bytes', pg_total_relation_size(c.oid), 'rows', coalesce(t.n_live_tup, 0))
                                order by pg_total_relation_size(c.oid) desc), '[]'::jsonb)
      from pg_catalog.pg_class c
      join pg_catalog.pg_namespace n on n.oid = c.relnamespace
      left join pg_catalog.pg_stat_user_tables t on t.relid = c.oid
      where n.nspname = 'public' and c.relkind in ('r', 'p')
    )
  ) into result;

  begin
    select sum(w.size) into wal from pg_catalog.pg_ls_waldir() w;
  exception when others then
    wal := null;
  end;

  begin
    select coalesce(sum((o.metadata ->> 'size')::bigint), 0), count(*) into storage_size, storage_count from storage.objects o;
  exception when others then
    storage_size := null;
    storage_count := null;
  end;

  begin
    select coalesce(jsonb_agg(jsonb_build_object(
             'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
             'status', r.status, 'started_at', r.start_time, 'message', left(r.return_message, 200)
           ) order by j.jobname), '[]'::jsonb)
      into jobs
      from cron.job j
      left join lateral (
        select d.status, d.start_time, d.return_message from cron.job_run_details d where d.jobid = j.jobid order by d.start_time desc limit 1
      ) r on true;
  exception when others then
    jobs := null;
  end;

  return result || jsonb_build_object('wal_bytes', wal, 'storage_bytes', storage_size, 'storage_objects', storage_count, 'cron', jobs);
end;
$$;

revoke all on function public.usage_snapshot() from public;
revoke all on function public.usage_snapshot() from anon, authenticated;
grant execute on function public.usage_snapshot() to service_role;
