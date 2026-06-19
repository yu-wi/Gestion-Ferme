select
  case
    when to_regprocedure('public.supprimer_lot_volaille(uuid)') is not null
      and pg_get_functiondef(
        to_regprocedure('public.supprimer_lot_volaille(uuid)')
      ) like '%feed_consumption%'
      then 'OK'
    else 'A VERIFIER'
  end as statut;
