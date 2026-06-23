-- Liaison entre le suivi d'alimentation et les lots de vente directe.
-- A executer dans Supabase > SQL Editor.

alter table public.consommations_aliment
alter column lot_id drop not null;

alter table public.consommations_aliment
add column if not exists direct_sale_lot_id uuid
references public.direct_sale_lots(id) on delete cascade;

alter table public.consommations_aliment
add column if not exists source_type text not null default 'sica'
check (source_type in ('sica', 'vente_directe'));

create index if not exists consommations_aliment_direct_lot_date_idx
on public.consommations_aliment(direct_sale_lot_id, date desc);

notify pgrst, 'reload schema';
