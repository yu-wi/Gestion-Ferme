-- Supprime un lot et toutes ses donnees rattachees dans une seule transaction.

create or replace function public.supprimer_lot_volaille(p_lot_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.charges where lot_id = p_lot_id;
  delete from public.consommations_aliment where lot_id = p_lot_id;

  -- Ancienne table de consommations, encore utilisee par certains lots.
  if to_regclass('public.feed_consumption') is not null then
    execute 'delete from public.feed_consumption where lot_id = $1'
      using p_lot_id;
  end if;

  delete from public.mortalites_volailles where lot_id = p_lot_id;
  delete from public.livraisons_volailles where lot_id = p_lot_id;
  delete from public.lots_volailles where id = p_lot_id;
end;
$$;

grant execute on function public.supprimer_lot_volaille(uuid) to authenticated;
