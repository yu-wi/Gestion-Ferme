-- Gestion Ferme - Suppression des anciennes tables confirmees.
-- A executer dans Supabase > SQL Editor apres controle.
--
-- Tables signalees comme hors interface :
-- - daily_tasks
-- - feed_stock
-- - feed_stock_movements
-- - mortalites

-- 1) Controle avant suppression : nombre de lignes dans chaque ancienne table.
select
  'daily_tasks' as table_name,
  case when to_regclass('public.daily_tasks') is null then null
       else (select count(*) from public.daily_tasks)
  end as nombre_lignes
union all
select
  'feed_stock',
  case when to_regclass('public.feed_stock') is null then null
       else (select count(*) from public.feed_stock)
  end
union all
select
  'feed_stock_movements',
  case when to_regclass('public.feed_stock_movements') is null then null
       else (select count(*) from public.feed_stock_movements)
  end
union all
select
  'mortalites',
  case when to_regclass('public.mortalites') is null then null
       else (select count(*) from public.mortalites)
  end;

-- 2) Suppression des anciennes tables.
-- daily_tasks : ancienne table de taches, remplacee par evenements/planning.
drop table if exists public.daily_tasks cascade;

-- feed_stock et feed_stock_movements : ancien suivi du stock d'aliment,
-- remplace par livraisons_aliment, consommations_aliment et inventaire mensuel.
drop table if exists public.feed_stock_movements cascade;
drop table if exists public.feed_stock cascade;

-- mortalites : ancienne table de mortalites, remplacee par mortalites_volailles
-- et direct_sale_mortalities.
drop table if exists public.mortalites cascade;

-- 3) Controle apres suppression.
select
  table_name as table_ancienne_restante
from information_schema.tables
where table_schema = 'public'
  and table_type = 'BASE TABLE'
  and table_name in (
    'daily_tasks',
    'feed_stock',
    'feed_stock_movements',
    'mortalites'
  )
order by table_name;

notify pgrst, 'reload schema';
