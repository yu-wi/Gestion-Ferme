-- Gestion Ferme - Suivi quotidien et stock d'aliment.
-- A executer dans Supabase > SQL Editor avant de deployer l'interface.

create table if not exists public.consommations_aliment (
  id uuid primary key default gen_random_uuid(),
  lot_id uuid references public.lots_volailles(id) on delete set null,
  date date not null default current_date,
  feed_type text not null check (length(trim(feed_type)) > 0),
  quantite_kg numeric not null check (quantite_kg > 0),
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.livraisons_aliment (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  feed_type text not null check (length(trim(feed_type)) > 0),
  quantite_kg numeric not null check (quantite_kg > 0),
  fournisseur text,
  prix_total_ht numeric check (prix_total_ht is null or prix_total_ht >= 0),
  note text,
  created_at timestamptz not null default now()
);

create index if not exists consommations_aliment_lot_date_idx
on public.consommations_aliment(lot_id, date desc);

create index if not exists consommations_aliment_type_date_idx
on public.consommations_aliment(feed_type, date desc);

create index if not exists livraisons_aliment_type_date_idx
on public.livraisons_aliment(feed_type, date desc);

alter table public.consommations_aliment enable row level security;
alter table public.livraisons_aliment enable row level security;

drop policy if exists "authenticated_all_consommations_aliment"
on public.consommations_aliment;

drop policy if exists "authenticated_all_livraisons_aliment"
on public.livraisons_aliment;

create policy "authenticated_all_consommations_aliment"
on public.consommations_aliment
for all
to authenticated
using (true)
with check (true);

create policy "authenticated_all_livraisons_aliment"
on public.livraisons_aliment
for all
to authenticated
using (true)
with check (true);
