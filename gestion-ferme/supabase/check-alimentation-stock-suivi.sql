-- Controle apres creation des tables.

select
  table_name,
  case when table_name is not null then 'OK' else 'A VERIFIER' end as statut
from information_schema.tables
where table_schema = 'public'
  and table_name in ('consommations_aliment', 'livraisons_aliment')
order by table_name;

select
  feed_type,
  coalesce(sum(entree_kg), 0) as entrees_kg,
  coalesce(sum(sortie_kg), 0) as consommations_kg,
  coalesce(sum(entree_kg), 0) - coalesce(sum(sortie_kg), 0) as stock_kg
from (
  select feed_type, quantite_kg as entree_kg, 0::numeric as sortie_kg
  from public.livraisons_aliment
  union all
  select feed_type, 0::numeric, quantite_kg
  from public.consommations_aliment
) mouvements
group by feed_type
order by feed_type;
