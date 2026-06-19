select
  count(*) as nombre_references,
  count(id) as references_avec_identifiant,
  case
    when count(*) = count(id) then 'OK'
    else 'A VERIFIER'
  end as statut
from public.feed_reference;
