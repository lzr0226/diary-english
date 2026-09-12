-- Run once in the intended Supabase project. Does not alter the previous prototype table.
create table if not exists public.learning_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null check (jsonb_typeof(data)='object' and octet_length(data::text)<2097152),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.learning_data enable row level security;
create policy "Own learning data" on public.learning_data for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
grant select,insert,update,delete on public.learning_data to authenticated;
revoke all on public.learning_data from anon;

create or replace function public.save_learning_data(expected_revision bigint,payload jsonb)
returns bigint language plpgsql security invoker set search_path='' as $$
declare result bigint;
begin
 if auth.uid() is null then raise exception 'Unauthenticated' using errcode='42501'; end if;
 if jsonb_typeof(payload) <> 'object' or jsonb_typeof(payload->'diaries') is distinct from 'array' or jsonb_typeof(payload->'words') is distinct from 'array' or octet_length(payload::text)>=2097152 then raise exception 'Invalid data'; end if;
 if expected_revision=0 then
   insert into public.learning_data(user_id,data,revision) values(auth.uid(),payload,1) on conflict do nothing returning revision into result;
 else
   update public.learning_data set data=payload,revision=revision+1,updated_at=now() where user_id=auth.uid() and revision=expected_revision returning revision into result;
 end if;
 if result is null then raise exception 'Revision conflict' using errcode='40001'; end if;
 return result;
end $$;
revoke all on function public.save_learning_data(bigint,jsonb) from public,anon;
grant execute on function public.save_learning_data(bigint,jsonb) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('diary-images','diary-images',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "Read own diary photos" on storage.objects for select to authenticated using(bucket_id='diary-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Upload own diary photos" on storage.objects for insert to authenticated with check(bucket_id='diary-images' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "Delete own diary photos" on storage.objects for delete to authenticated using(bucket_id='diary-images' and (storage.foldername(name))[1]=auth.uid()::text);

create table if not exists public.service_usage(user_id uuid not null references auth.users(id) on delete cascade,service text not null,day date not null default current_date,used integer not null default 0,primary key(user_id,service,day));
alter table public.service_usage enable row level security;
revoke all on public.service_usage from public,anon,authenticated;
create or replace function public.consume_service_quota(service_name text) returns boolean language plpgsql security definer set search_path='' as $$
declare limit_count integer; count_used integer;
begin
 if auth.uid() is null then raise exception 'Unauthenticated' using errcode='42501'; end if;
 if service_name='ai' then limit_count=30; elsif service_name='feedback' then limit_count=5; else raise exception 'Invalid service'; end if;
 insert into public.service_usage(user_id,service,day,used) values(auth.uid(),service_name,current_date,1)
 on conflict(user_id,service,day) do update set used=public.service_usage.used+1 where public.service_usage.used<limit_count returning used into count_used;
 return count_used is not null;
end $$;
revoke all on function public.consume_service_quota(text) from public,anon;
grant execute on function public.consume_service_quota(text) to authenticated;
