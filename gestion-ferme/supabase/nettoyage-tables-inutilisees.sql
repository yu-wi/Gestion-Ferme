-- Gestion Ferme - Nettoyage des tables Supabase inutilisees.
-- A executer dans Supabase > SQL Editor.
--
-- Ce script supprime uniquement les anciennes tables identifiees comme
-- obsoletes par rapport a l'interface actuelle.

-- Tables actuellement utilisees par l'interface :
-- - app_profiles
-- - charges
-- - consommations_aliment
-- - direct_sale_customers
-- - direct_sale_deliveries
-- - direct_sale_lots
-- - direct_sale_mortalities
-- - direct_sale_orders
-- - evenements
-- - feed_reference
-- - livraisons_aliment
-- - livraisons_volailles
-- - lots_volailles
-- - monthly_inventory_snapshots
-- - mortalites_volailles

-- 1) Controle avant suppression : tables presentes dans public mais non
-- appelees par l'interface actuelle.
with tables_utilisees(table_name) as (
  values
    ('app_profiles'),
    ('charges'),
    ('consommations_aliment'),
    ('direct_sale_customers'),
    ('direct_sale_deliveries'),
    ('direct_sale_lots'),
    ('direct_sale_mortalities'),
    ('direct_sale_orders'),
    ('evenements'),
    ('feed_reference'),
    ('livraisons_aliment'),
    ('livraisons_volailles'),
    ('lots_volailles'),
    ('monthly_inventory_snapshots'),
    ('mortalites_volailles')
)
select
  table_name as table_hors_interface_a_verifier
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name not in (select table_name from tables_utilisees)
order by table_name;

-- 2) Suppression des tables obsoletes connues.
-- Ancienne table de consommation d'aliment, remplacee par consommations_aliment.
drop table if exists public.feed_consumption cascade;

-- 3) Nettoyage des anciennes politiques liees a cette table si elles existaient.
-- Le DROP TABLE CASCADE les supprime normalement deja, cette section est
-- volontairement vide pour garder une trace de l'intention.

-- 3bis) Mise a jour de la fonction de suppression des lots pour retirer
-- l'ancienne reference a feed_consumption.
create or replace function public.supprimer_lot_volaille(p_lot_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.charges where lot_id = p_lot_id;
  delete from public.consommations_aliment where lot_id = p_lot_id;
  delete from public.mortalites_volailles where lot_id = p_lot_id;
  delete from public.livraisons_volailles where lot_id = p_lot_id;
  delete from public.lots_volailles where id = p_lot_id;
end;
$$;

grant execute on function public.supprimer_lot_volaille(uuid) to authenticated;

-- 4) Controle apres suppression.
with tables_utilisees(table_name) as (
  values
    ('app_profiles'),
    ('charges'),
    ('consommations_aliment'),
    ('direct_sale_customers'),
    ('direct_sale_deliveries'),
    ('direct_sale_lots'),
    ('direct_sale_mortalities'),
    ('direct_sale_orders'),
    ('evenements'),
    ('feed_reference'),
    ('livraisons_aliment'),
    ('livraisons_volailles'),
    ('lots_volailles'),
    ('monthly_inventory_snapshots'),
    ('mortalites_volailles')
)
select
  table_name as table_hors_interface_restante
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name not in (select table_name from tables_utilisees)
order by table_name;

notify pgrst, 'reload schema';
