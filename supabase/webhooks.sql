-- Database Webhooks → translation pipeline
--
-- Creates one trigger per content table that POSTs every insert/update/delete
-- to the site's /api/translate route. The route translates the row with the
-- configured provider (only when English text changed) and refreshes the page cache.
--
-- Before running:
--   1. Deploy the site and note its URL (e.g. https://kingdom-1241.vercel.app).
--   2. Set the same TRANSLATE_WEBHOOK_SECRET in Vercel and in the GitHub secrets.
--   3. Enable Database Webhooks once: Dashboard → Database → Webhooks → "Enable webhooks"
--      (this installs the `supabase_functions` schema used below).
-- Then run it: Actions → Maintenance → `webhooks` fills in the two placeholders
-- from the SITE_URL and TRANSLATE_WEBHOOK_SECRET secrets and runs the file
-- (SETUP.md § 7); or paste it into the SQL editor and replace them by hand.
-- Re-running it is safe (triggers are replaced). A new content table goes
-- into the list below (tests/lib/translate/tables.test.ts checks it).

do $$
declare
  site_url text := 'https://YOUR-SITE.vercel.app';          -- ← replace
  secret   text := 'YOUR_TRANSLATE_WEBHOOK_SECRET';          -- ← replace
  t        text;
  headers  text;
begin
  headers := format('{"Content-Type":"application/json","Authorization":"Bearer %s"}', secret);

  foreach t in array array[
    'languages', 'site_settings', 'ui_strings', 'announcements', 'events',
    'rule_topics', 'rules', 'guides', 'alliances', 'gift_codes',
    'heroes', 'kvk_plans', 'kvk_rules', 'kvk_coordinators', 'kvk_formations'
  ] loop
    execute format('drop trigger if exists %I on public.%I', 'webhook_translate_' || t, t);
    execute format(
      $trg$
        create trigger %I
        after insert or update or delete on public.%I
        for each row
        execute function supabase_functions.http_request(%L, 'POST', %L, '{}', '5000')
      $trg$,
      'webhook_translate_' || t, t, site_url || '/api/translate', headers
    );
  end loop;
end $$;
