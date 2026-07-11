-- Supprime un lot SICA et ses donnees rattachees dans une seule transaction.
-- Les consommations d'aliment sont conservees pour ne pas fausser le stock.

create or replace function public.supprimer_lot_volaille(p_lot_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nom_lot text;
begin
  select nom into v_nom_lot
  from public.lots_volailles
  where id = p_lot_id;

  update public.consommations_aliment
  set
    lot_id = null,
    source_type = 'sica',
    note = concat_ws(
      E'\n',
      nullif(note, ''),
      'Historique conserve apres suppression du lot SICA ' || coalesce(v_nom_lot, p_lot_id::text)
    )
  where lot_id = p_lot_id;

  delete from public.charges where lot_id = p_lot_id;

  delete from public.mortalites_volailles where lot_id = p_lot_id;
  delete from public.livraisons_volailles where lot_id = p_lot_id;
  delete from public.lots_volailles where id = p_lot_id;
end;
$$;

grant execute on function public.supprimer_lot_volaille(uuid) to authenticated;
