select
  case
    when to_regprocedure('public.supprimer_lot_volaille(uuid)') is not null
      then 'OK'
    else 'A VERIFIER'
  end as statut;
