-- Gestion Ferme - Calcul automatique des totaux Volailles.
-- A executer une seule fois dans Supabase > SQL Editor.

create or replace function public.recalculer_totaux_lot_volaille(p_lot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nb_morts integer;
  v_poids_livre numeric;
begin
  select coalesce(sum(nombre), 0)::integer
  into v_nb_morts
  from public.mortalites_volailles
  where lot_id = p_lot_id;

  select coalesce(sum(poids), 0)
  into v_poids_livre
  from public.livraisons_volailles
  where lot_id = p_lot_id;

  update public.lots_volailles
  set
    nb_morts = v_nb_morts,
    sujets_restants =
      coalesce(quantite, 0)
      - v_nb_morts
      - coalesce(autoconsommation, 0),
    total_poids_livre = v_poids_livre
  where id = p_lot_id;
end;
$$;

create or replace function public.actualiser_totaux_depuis_mouvement_volaille()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recalculer_totaux_lot_volaille(old.lot_id);
    return old;
  end if;

  perform public.recalculer_totaux_lot_volaille(new.lot_id);

  if tg_op = 'UPDATE' and old.lot_id is distinct from new.lot_id then
    perform public.recalculer_totaux_lot_volaille(old.lot_id);
  end if;

  return new;
end;
$$;

drop trigger if exists actualiser_totaux_mortalites_volailles
on public.mortalites_volailles;

create trigger actualiser_totaux_mortalites_volailles
after insert or update or delete
on public.mortalites_volailles
for each row
execute function public.actualiser_totaux_depuis_mouvement_volaille();

drop trigger if exists actualiser_totaux_livraisons_volailles
on public.livraisons_volailles;

create trigger actualiser_totaux_livraisons_volailles
after insert or update or delete
on public.livraisons_volailles
for each row
execute function public.actualiser_totaux_depuis_mouvement_volaille();

create or replace function public.actualiser_totaux_avant_modification_lot_volaille()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(sum(nombre), 0)::integer
  into new.nb_morts
  from public.mortalites_volailles
  where lot_id = new.id;

  select coalesce(sum(poids), 0)
  into new.total_poids_livre
  from public.livraisons_volailles
  where lot_id = new.id;

  new.sujets_restants =
    coalesce(new.quantite, 0)
    - coalesce(new.nb_morts, 0)
    - coalesce(new.autoconsommation, 0);

  return new;
end;
$$;

drop trigger if exists actualiser_totaux_lot_volaille
on public.lots_volailles;

create trigger actualiser_totaux_lot_volaille
before insert or update of quantite, autoconsommation
on public.lots_volailles
for each row
execute function public.actualiser_totaux_avant_modification_lot_volaille();

revoke execute on function public.recalculer_totaux_lot_volaille(uuid)
from public, anon, authenticated;

revoke execute on function public.actualiser_totaux_depuis_mouvement_volaille()
from public, anon, authenticated;

revoke execute on function public.actualiser_totaux_avant_modification_lot_volaille()
from public, anon, authenticated;

do $$
declare
  lot record;
begin
  for lot in select id from public.lots_volailles loop
    perform public.recalculer_totaux_lot_volaille(lot.id);
  end loop;
end;
$$;
