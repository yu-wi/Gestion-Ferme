-- Conservation de l'historique d'alimentation lors de la suppression d'un lot.
-- A executer dans Supabase > SQL Editor.
--
-- Objectif :
-- - garder les consommations dans consommations_aliment ;
-- - continuer a les deduire du stock ;
-- - eviter qu'une suppression de lot efface l'historique de consommation.

alter table public.consommations_aliment
alter column lot_id drop not null;

alter table public.consommations_aliment
add column if not exists direct_sale_lot_id uuid;

alter table public.consommations_aliment
add column if not exists source_type text not null default 'sica'
check (source_type in ('sica', 'vente_directe'));

update public.consommations_aliment consommation
set
  lot_id = null,
  source_type = 'sica',
  note = concat_ws(
    E'\n',
    nullif(consommation.note, ''),
    'Historique conserve apres suppression d''un lot SICA'
  )
where consommation.lot_id is not null
  and not exists (
    select 1
    from public.lots_volailles lot
    where lot.id = consommation.lot_id
  );

update public.consommations_aliment consommation
set
  direct_sale_lot_id = null,
  source_type = 'vente_directe',
  note = concat_ws(
    E'\n',
    nullif(consommation.note, ''),
    'Historique conserve apres suppression d''un lot Vente directe'
  )
where consommation.direct_sale_lot_id is not null
  and not exists (
    select 1
    from public.direct_sale_lots lot
    where lot.id = consommation.direct_sale_lot_id
  );

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.consommations_aliment'::regclass
    and confrelid = 'public.lots_volailles'::regclass
    and contype = 'f'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.consommations_aliment drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.consommations_aliment
add constraint consommations_aliment_lot_id_fkey
foreign key (lot_id)
references public.lots_volailles(id)
on delete set null;

do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint
  where conrelid = 'public.consommations_aliment'::regclass
    and confrelid = 'public.direct_sale_lots'::regclass
    and contype = 'f'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.consommations_aliment drop constraint %I',
      constraint_name
    );
  end if;
end $$;

alter table public.consommations_aliment
add constraint consommations_aliment_direct_sale_lot_id_fkey
foreign key (direct_sale_lot_id)
references public.direct_sale_lots(id)
on delete set null;

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

create or replace function public.supprimer_lot_vente_directe(p_lot_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_nom_lot text;
begin
  select name into v_nom_lot
  from public.direct_sale_lots
  where id = p_lot_id;

  update public.consommations_aliment
  set
    direct_sale_lot_id = null,
    source_type = 'vente_directe',
    note = concat_ws(
      E'\n',
      nullif(note, ''),
      'Historique conserve apres suppression du lot Vente directe ' || coalesce(v_nom_lot, p_lot_id::text)
    )
  where direct_sale_lot_id = p_lot_id;

  delete from public.direct_sale_lots where id = p_lot_id;
end;
$$;

grant execute on function public.supprimer_lot_vente_directe(uuid) to authenticated;

notify pgrst, 'reload schema';
