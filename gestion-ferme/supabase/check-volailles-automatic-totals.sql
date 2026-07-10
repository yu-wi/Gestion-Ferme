-- Controle des totaux apres installation de l'automatisation.
-- La colonne "statut" doit afficher "OK" pour chaque lot.

select
  lot.nom,
  lot.nb_morts,
  coalesce(mortalites.total, 0) as mortalites_calculees,
  lot.sujets_restants,
  coalesce(lot.quantite, 0)
    - coalesce(mortalites.total, 0)
    - coalesce(lot.autoconsommation, 0)
    - coalesce(livraisons.total_quantite, 0) as sujets_restants_calcules,
  lot.total_poids_livre,
  coalesce(livraisons.total_poids, 0) as poids_livre_calcule,
  case
    when lot.nb_morts = coalesce(mortalites.total, 0)
      and lot.sujets_restants =
        coalesce(lot.quantite, 0)
        - coalesce(mortalites.total, 0)
        - coalesce(lot.autoconsommation, 0)
        - coalesce(livraisons.total_quantite, 0)
      and lot.total_poids_livre = coalesce(livraisons.total_poids, 0)
    then 'OK'
    else 'A VERIFIER'
  end as statut
from public.lots_volailles lot
left join (
  select lot_id, sum(nombre)::integer as total
  from public.mortalites_volailles
  group by lot_id
) mortalites on mortalites.lot_id = lot.id
left join (
  select lot_id, sum(quantite)::integer as total_quantite, sum(poids) as total_poids
  from public.livraisons_volailles
  group by lot_id
) livraisons on livraisons.lot_id = lot.id
order by lot.nom;
