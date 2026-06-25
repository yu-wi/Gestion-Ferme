-- Historique des mortalites pour les lots Vente directe.
-- A executer dans Supabase > SQL Editor avant d'utiliser la saisie datee.

create table if not exists public.direct_sale_mortalities (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.direct_sale_lots(id) on delete cascade,
  date date not null default current_date,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create index if not exists direct_sale_mortalities_lot_date_idx
on public.direct_sale_mortalities(lot_id, date desc);

alter table public.direct_sale_mortalities enable row level security;

drop policy if exists "authenticated_all_direct_sale_mortalities"
on public.direct_sale_mortalities;

create policy "authenticated_all_direct_sale_mortalities"
on public.direct_sale_mortalities
for all to authenticated
using (true)
with check (true);

notify pgrst, 'reload schema';
