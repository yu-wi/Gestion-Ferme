-- Journal des ajouts de produits : a executer dans Supabase SQL Editor.
-- Prerequis : aquaponie-suivi.sql. Script reexecutable sans supprimer de donnees.
begin;
create table if not exists public.aquaponie_product_additions (
  id uuid primary key default gen_random_uuid(),
  product_name text not null check(length(trim(product_name)) between 1 and 150),
  quantity numeric not null check(quantity > 0 and quantity::text not in ('NaN','Infinity','-Infinity')),
  unit text not null check(unit in ('g','kg','mL','L','unite')),
  addition_date date not null,
  addition_time time without time zone not null,
  target_type text not null check(target_type in ('bassin','cuve','systeme')),
  basin_id uuid references public.aquaponie_basins(id) on delete set null,
  tank_id uuid references public.aquaponie_tanks(id) on delete set null,
  target_label text not null check(length(trim(target_label)) > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint aquaponie_product_additions_target_check check(
    (target_type = 'bassin' and tank_id is null) or
    (target_type = 'cuve' and basin_id is null) or
    (target_type = 'systeme' and basin_id is null and tank_id is null)
  )
);
create index if not exists aquaponie_product_additions_date_idx on public.aquaponie_product_additions(addition_date desc,addition_time desc,id);
create or replace function public.aquaponie_product_additions_updated_at()
returns trigger language plpgsql set search_path = public as $$begin new.updated_at=clock_timestamp(); return new; end;$$;
drop trigger if exists aquaponie_product_additions_updated_at on public.aquaponie_product_additions;
create trigger aquaponie_product_additions_updated_at before update on public.aquaponie_product_additions
for each row execute function public.aquaponie_product_additions_updated_at();
alter table public.aquaponie_product_additions enable row level security;
revoke all on public.aquaponie_product_additions from public, anon;
grant select,insert,update,delete on public.aquaponie_product_additions to authenticated;
drop policy if exists aquaponie_product_additions_users on public.aquaponie_product_additions;
do $$
begin
  if to_regprocedure('public.is_active_app_user()') is not null then
    execute 'create policy aquaponie_product_additions_users on public.aquaponie_product_additions for all to authenticated using (public.is_active_app_user()) with check (public.is_active_app_user())';
  elsif to_regclass('public.app_profiles') is not null then
    execute 'create policy aquaponie_product_additions_users on public.aquaponie_product_additions for all to authenticated using (exists(select 1 from public.app_profiles where user_id=auth.uid() and is_active)) with check (exists(select 1 from public.app_profiles where user_id=auth.uid() and is_active))';
  else
    execute 'create policy aquaponie_product_additions_users on public.aquaponie_product_additions for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)';
  end if;
end $$;
notify pgrst, 'reload schema';
commit;
