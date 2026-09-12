-- Transitional prototype repository. Migrate to normalized diary/vocabulary tables before launch.
create table public.prototype_data (
 user_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 updated_at timestamptz not null default now()
);
alter table public.prototype_data enable row level security;
create policy "Read own data" on public.prototype_data for select to authenticated using (auth.uid() = user_id);
create policy "Insert own data" on public.prototype_data for insert to authenticated with check (auth.uid() = user_id);
create policy "Update own data" on public.prototype_data for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Delete own data" on public.prototype_data for delete to authenticated using (auth.uid() = user_id);
