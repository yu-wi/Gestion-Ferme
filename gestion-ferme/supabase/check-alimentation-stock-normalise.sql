-- Controle du stock d'aliment avec regroupement normalise.
-- Permet de reperer les ecarts dus aux majuscules, accents ou espaces dans feed_type.

with mouvements as (
  select
    lower(translate(trim(feed_type), 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC')) as aliment_normalise,
    trim(feed_type) as aliment_saisi,
    quantite_kg as entree_kg,
    0::numeric as sortie_kg,
    date,
    'livraison' as origine
  from public.livraisons_aliment

  union all

  select
    lower(translate(trim(feed_type), 'àâäéèêëîïôöùûüçÀÂÄÉÈÊËÎÏÔÖÙÛÜÇ', 'aaaeeeeiioouuucAAAEEEEIIOOUUUC')) as aliment_normalise,
    trim(feed_type) as aliment_saisi,
    0::numeric as entree_kg,
    quantite_kg as sortie_kg,
    date,
    'consommation' as origine
  from public.consommations_aliment
),
stock as (
  select
    aliment_normalise,
    string_agg(distinct aliment_saisi, ', ' order by aliment_saisi) as libelles_trouves,
    round(sum(entree_kg) / 25, 2) as sacs_livres,
    round(sum(sortie_kg) / 25, 2) as sacs_consommes,
    round((sum(entree_kg) - sum(sortie_kg)) / 25, 2) as sacs_restants
  from mouvements
  group by aliment_normalise
)
select *
from stock
order by
  case aliment_normalise
    when 'starter' then 1
    when 'croissance' then 2
    when 'finition' then 3
    else 4
  end,
  aliment_normalise;

-- Detail des 30 derniers mouvements, utile si un stock ne correspond pas au reel.
with mouvements as (
  select
    trim(feed_type) as aliment_saisi,
    quantite_kg as entree_kg,
    0::numeric as sortie_kg,
    date,
    'livraison' as origine
  from public.livraisons_aliment

  union all

  select
    trim(feed_type) as aliment_saisi,
    0::numeric as entree_kg,
    quantite_kg as sortie_kg,
    date,
    'consommation' as origine
  from public.consommations_aliment
)
select
  date,
  origine,
  aliment_saisi,
  round(entree_kg / 25, 2) as sacs_livres,
  round(sortie_kg / 25, 2) as sacs_consommes
from mouvements
order by date desc, origine
limit 30;

-- Resultat exact utilise par l'interface si la fonction est installee.
select
  feed_type,
  round(entrees_kg / 25, 2) as sacs_livres,
  round(consommations_kg / 25, 2) as sacs_consommes,
  round(stock_kg / 25, 2) as sacs_restants
from public.calculer_stock_aliment();
