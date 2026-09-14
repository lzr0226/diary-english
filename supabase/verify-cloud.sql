-- Read-only diagnostics. Run in the Supabase project used by the live website.
-- Returns only schema/configuration metadata, never users, diary text or secrets.
select to_regclass('public.learning_data') as learning_data,
       to_regclass('public.service_usage') as service_usage,
       to_regprocedure('public.save_learning_data(bigint,jsonb)') as save_function,
       to_regprocedure('public.consume_service_quota(text)') as quota_function;

select n.nspname as schema_name, c.relname as table_name, c.relrowsecurity as rls_enabled
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('learning_data','service_usage');

select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where (schemaname='public' and tablename in ('learning_data','service_usage'))
   or (schemaname='storage' and tablename='objects' and policyname in
      ('Read own diary photos','Upload own diary photos','Delete own diary photos'));

select id, public, file_size_limit, allowed_mime_types
from storage.buckets where id='diary-images';
