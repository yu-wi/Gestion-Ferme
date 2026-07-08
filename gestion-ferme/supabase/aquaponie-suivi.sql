create extension if not exists pgcrypto;

create table if not exists public.aquaponie_basins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  species text not null default 'Non renseigné',
  fish_count integer not null default 0,
  water_capacity_l numeric,
  water_current_l numeric,
  status text not null default 'stable' check (status in ('stable', 'surveillance', 'probleme')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aquaponie_tanks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  water_capacity_l numeric,
  water_current_l numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aquaponie_basins
  add column if not exists water_capacity_l numeric;

alter table public.aquaponie_basins
  add column if not exists water_current_l numeric;

create table if not exists public.aquaponie_water_measures (
  id uuid primary key default gen_random_uuid(),
  basin_id uuid references public.aquaponie_basins(id) on delete set null,
  tank_id uuid references public.aquaponie_tanks(id) on delete set null,
  target_type text not null default 'bassin' check (target_type in ('bassin', 'cuve')),
  measure_date date not null default current_date,
  temperature_c numeric,
  ph numeric,
  no2 numeric,
  no3 numeric,
  conductivity numeric,
  oxygen_mg_l numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.aquaponie_water_measures
  add column if not exists tank_id uuid references public.aquaponie_tanks(id) on delete set null;

alter table public.aquaponie_water_measures
  add column if not exists target_type text not null default 'bassin';

do $$
begin
  alter table public.aquaponie_water_measures
    add constraint aquaponie_water_measures_target_type_check
    check (target_type in ('bassin', 'cuve'));
exception
  when duplicate_object then null;
end $$;

create table if not exists public.aquaponie_cultures (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  variety text,
  location text,
  planted_at date not null default current_date,
  expected_harvest_at date,
  quantity integer,
  growth_percent integer not null default 0 check (growth_percent between 0 and 100),
  status text not null default 'croissance' check (status in ('semis', 'croissance', 'pret', 'recolte')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aquaponie_harvests (
  id uuid primary key default gen_random_uuid(),
  culture_id uuid references public.aquaponie_cultures(id) on delete set null,
  harvest_date date not null default current_date,
  weight_kg numeric not null default 0,
  destination text not null default 'vente' check (destination in ('vente', 'autoconsommation', 'perte')),
  value_eur numeric,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aquaponie_water_measures_date_idx on public.aquaponie_water_measures (measure_date desc);
create index if not exists aquaponie_water_measures_basin_idx on public.aquaponie_water_measures (basin_id);
create index if not exists aquaponie_water_measures_tank_idx on public.aquaponie_water_measures (tank_id);
create index if not exists aquaponie_cultures_status_idx on public.aquaponie_cultures (status, planted_at desc);
create index if not exists aquaponie_harvests_date_idx on public.aquaponie_harvests (harvest_date desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists aquaponie_basins_set_updated_at on public.aquaponie_basins;
create trigger aquaponie_basins_set_updated_at
before update on public.aquaponie_basins
for each row execute function public.set_updated_at();

drop trigger if exists aquaponie_tanks_set_updated_at on public.aquaponie_tanks;
create trigger aquaponie_tanks_set_updated_at
before update on public.aquaponie_tanks
for each row execute function public.set_updated_at();

drop trigger if exists aquaponie_water_measures_set_updated_at on public.aquaponie_water_measures;
create trigger aquaponie_water_measures_set_updated_at
before update on public.aquaponie_water_measures
for each row execute function public.set_updated_at();

drop trigger if exists aquaponie_cultures_set_updated_at on public.aquaponie_cultures;
create trigger aquaponie_cultures_set_updated_at
before update on public.aquaponie_cultures
for each row execute function public.set_updated_at();

drop trigger if exists aquaponie_harvests_set_updated_at on public.aquaponie_harvests;
create trigger aquaponie_harvests_set_updated_at
before update on public.aquaponie_harvests
for each row execute function public.set_updated_at();

alter table public.aquaponie_basins enable row level security;
alter table public.aquaponie_tanks enable row level security;
alter table public.aquaponie_water_measures enable row level security;
alter table public.aquaponie_cultures enable row level security;
alter table public.aquaponie_harvests enable row level security;

drop policy if exists "Utilisateurs connectes - aquaponie_basins" on public.aquaponie_basins;
create policy "Utilisateurs connectes - aquaponie_basins"
on public.aquaponie_basins for all to authenticated using (true) with check (true);

drop policy if exists "Utilisateurs connectes - aquaponie_tanks" on public.aquaponie_tanks;
create policy "Utilisateurs connectes - aquaponie_tanks"
on public.aquaponie_tanks for all to authenticated using (true) with check (true);

drop policy if exists "Utilisateurs connectes - aquaponie_water_measures" on public.aquaponie_water_measures;
create policy "Utilisateurs connectes - aquaponie_water_measures"
on public.aquaponie_water_measures for all to authenticated using (true) with check (true);

drop policy if exists "Utilisateurs connectes - aquaponie_cultures" on public.aquaponie_cultures;
create policy "Utilisateurs connectes - aquaponie_cultures"
on public.aquaponie_cultures for all to authenticated using (true) with check (true);

drop policy if exists "Utilisateurs connectes - aquaponie_harvests" on public.aquaponie_harvests;
create policy "Utilisateurs connectes - aquaponie_harvests"
on public.aquaponie_harvests for all to authenticated using (true) with check (true);

grant all on public.aquaponie_basins to authenticated;
grant all on public.aquaponie_tanks to authenticated;
grant all on public.aquaponie_water_measures to authenticated;
grant all on public.aquaponie_cultures to authenticated;
grant all on public.aquaponie_harvests to authenticated;

notify pgrst, 'reload schema';
