create extension if not exists pgcrypto;

create table if not exists public.sica_delivery_schedule (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.lots_volailles(id) on delete cascade,
  delivery_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(lot_id)
);

create index if not exists sica_delivery_schedule_lot_idx
on public.sica_delivery_schedule(lot_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sica_delivery_schedule_set_updated_at
on public.sica_delivery_schedule;

create trigger sica_delivery_schedule_set_updated_at
before update on public.sica_delivery_schedule
for each row execute function public.set_updated_at();

alter table public.sica_delivery_schedule enable row level security;

drop policy if exists "Utilisateurs connectes - sica_delivery_schedule"
on public.sica_delivery_schedule;

create policy "Utilisateurs connectes - sica_delivery_schedule"
on public.sica_delivery_schedule
for all to authenticated
using (true)
with check (true);

grant all on public.sica_delivery_schedule to authenticated;

notify pgrst, 'reload schema';
