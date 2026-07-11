-- Gestion Ferme - Module Vente directe.
-- A executer une fois dans Supabase > SQL Editor avant d'utiliser la page.

create table if not exists public.direct_sale_lots (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  species text not null check (species in ('poulet', 'pintade')),
  arrival_date date not null,
  initial_quantity integer not null check (initial_quantity > 0),
  remaining_quantity integer not null check (remaining_quantity >= 0),
  mortality_count integer not null default 0 check (mortality_count >= 0),
  location text,
  status text not null default 'elevage'
    check (status in ('elevage', 'pret', 'termine')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.direct_sale_lots
add column if not exists mortality_count integer not null default 0
check (mortality_count >= 0);

create table if not exists public.direct_sale_mortalities (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid not null references public.direct_sale_lots(id) on delete cascade,
  date date not null default current_date,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.direct_sale_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_sale_orders (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  customer_id uuid not null references public.direct_sale_customers(id) on delete restrict,
  lot_id uuid references public.direct_sale_lots(id) on delete set null,
  delivery_date date not null,
  species text not null check (species in ('poulet', 'pintade')),
  quantity_ordered integer not null check (quantity_ordered > 0),
  target_weight numeric check (target_weight is null or target_weight > 0),
  pricing_mode text not null default 'kg'
    check (pricing_mode in ('kg', 'unite')),
  unit_price numeric not null default 0 check (unit_price >= 0),
  status text not null default 'a_preparer'
    check (status in ('a_preparer', 'prete', 'livree', 'annulee')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.direct_sale_deliveries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  order_id uuid references public.direct_sale_orders(id) on delete set null,
  customer_id uuid not null references public.direct_sale_customers(id) on delete restrict,
  lot_id uuid not null references public.direct_sale_lots(id) on delete restrict,
  delivery_date date not null default current_date,
  quantity_delivered integer not null check (quantity_delivered > 0),
  total_weight numeric check (total_weight is null or total_weight >= 0),
  pricing_mode text not null default 'kg'
    check (pricing_mode in ('kg', 'unite')),
  unit_price numeric not null default 0 check (unit_price >= 0),
  amount_invoiced numeric not null default 0 check (amount_invoiced >= 0),
  amount_paid numeric not null default 0 check (amount_paid >= 0),
  payment_date date,
  payment_method text,
  notes text,
  created_at timestamptz not null default now()
);

alter table public.direct_sale_orders
add column if not exists batch_id uuid;

alter table public.direct_sale_deliveries
add column if not exists batch_id uuid;

-- Permettre au stock d'aliment commun d'enregistrer les consommations
-- des lots SICA Madras et des lots de vente directe.
alter table public.consommations_aliment
alter column lot_id drop not null;

alter table public.consommations_aliment
add column if not exists direct_sale_lot_id uuid
references public.direct_sale_lots(id) on delete set null;

alter table public.consommations_aliment
add column if not exists source_type text not null default 'sica'
check (source_type in ('sica', 'vente_directe'));

create index if not exists consommations_aliment_direct_lot_date_idx
on public.consommations_aliment(direct_sale_lot_id, date desc);

notify pgrst, 'reload schema';

create index if not exists direct_sale_lots_status_idx
on public.direct_sale_lots(status, arrival_date desc);

create index if not exists direct_sale_mortalities_lot_date_idx
on public.direct_sale_mortalities(lot_id, date desc);

create index if not exists direct_sale_orders_date_idx
on public.direct_sale_orders(delivery_date, status);

create index if not exists direct_sale_orders_batch_idx
on public.direct_sale_orders(batch_id);

create index if not exists direct_sale_deliveries_date_idx
on public.direct_sale_deliveries(delivery_date desc);

create index if not exists direct_sale_deliveries_batch_idx
on public.direct_sale_deliveries(batch_id);

alter table public.direct_sale_lots enable row level security;
alter table public.direct_sale_mortalities enable row level security;
alter table public.direct_sale_customers enable row level security;
alter table public.direct_sale_orders enable row level security;
alter table public.direct_sale_deliveries enable row level security;

drop policy if exists "authenticated_all_direct_sale_lots" on public.direct_sale_lots;
drop policy if exists "authenticated_all_direct_sale_mortalities" on public.direct_sale_mortalities;
drop policy if exists "authenticated_all_direct_sale_customers" on public.direct_sale_customers;
drop policy if exists "authenticated_all_direct_sale_orders" on public.direct_sale_orders;
drop policy if exists "authenticated_all_direct_sale_deliveries" on public.direct_sale_deliveries;

create policy "authenticated_all_direct_sale_lots"
on public.direct_sale_lots for all to authenticated using (true) with check (true);

create policy "authenticated_all_direct_sale_mortalities"
on public.direct_sale_mortalities for all to authenticated using (true) with check (true);

create policy "authenticated_all_direct_sale_customers"
on public.direct_sale_customers for all to authenticated using (true) with check (true);

create policy "authenticated_all_direct_sale_orders"
on public.direct_sale_orders for all to authenticated using (true) with check (true);

create policy "authenticated_all_direct_sale_deliveries"
on public.direct_sale_deliveries for all to authenticated using (true) with check (true);
